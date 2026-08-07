import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import type { Chain } from "viem";
import { lookupPoapArchive } from "../_archive";
import {
  TtlCache,
  isRateLimitStatus,
  rateLimitMessage,
} from "@/lib/ttlCache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POAP_API_BASE = process.env.POAP_API_BASE || "https://api.poap.tech";
const POAP_CONTRACT_ADDRESS = "0x22C1f6050E56d2876009903609a2cC3fEf83B415";
const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;
const RPC_TIMEOUT_MS = 12_000;
const METADATA_TIMEOUT_MS = 5_000;
const ARCHIVE_ENRICH_TIMEOUT_MS = 8_000;
const COLLECTOR_CACHE_TTL_MS = 60_000;
/**
 * Page offsets are derived from per-network balances, so the balances have to
 * stay fixed for the duration of a paging session or pages would shift and
 * duplicate/skip rows. Cache the layout for longer than a page response.
 */
const LAYOUT_CACHE_TTL_MS = 5 * 60_000;
const SCAN_CACHE_TTL_MS = 5 * 60_000;
/** Keep RPC batches small enough for public endpoints to accept them. */
const MULTICALL_BATCH_SIZE = 150;
/** Bound outbound requests per page so paging cannot flood RPCs into 429s. */
const RPC_CONCURRENCY = 4;
const METADATA_CONCURRENCY = 8;
/** Upper bound on index scanning when resolving a single drop in a wallet. */
const DROP_SCAN_MAX_INDICES = 6_000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const poapAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "tokenDetailsOfOwnerByIndex",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      { name: "tokenId", type: "uint256" },
      { name: "eventId", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

interface PoapNetworkConfig {
  key: string;
  label: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}

/**
 * Discovery is limited to the POAP deployments that implement
 * ERC721Enumerable. POAP is deployed at the same address on Polygon, Base,
 * Arbitrum, Linea and Celo, but those contracts report
 * `supportsInterface(0x780e9d63) === false` and revert on both
 * `tokenOfOwnerByIndex` and `tokenDetailsOfOwnerByIndex`, so a wallet's tokens
 * there cannot be listed by index. Including them only inflated `balanceOf`
 * totals with rows that could never load.
 *
 * This list is discovery-only. Ownership verification and claiming still
 * support every network in `POAP_NETWORKS` in `lib/pomp.ts`, because those
 * paths use `ownerOf`/`tokenEvent`, which work without enumeration.
 */
const POAP_NETWORKS: PoapNetworkConfig[] = [
  {
    key: "gnosis",
    label: "Gnosis",
    chainId: 100,
    rpcUrl: "https://rpc.gnosischain.com",
    explorerUrl: "https://gnosisscan.io",
  },
  {
    key: "ethereum",
    label: "Ethereum",
    chainId: 1,
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorerUrl: "https://etherscan.io",
  },
];

/**
 * Page offsets are derived from the position of each network in this list, so
 * a cached layout built from a different list would shift every offset after
 * the changed entry. Namespacing the cache keys makes stale entries
 * unreachable instead of silently wrong.
 */
const NETWORK_SIGNATURE = POAP_NETWORKS.map((network) => network.key).join("-");

interface NormalizedPoap {
  id: string;
  tokenId: string;
  dropId: string;
  title: string;
  description: string;
  imageUrl: string;
  eventUrl: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  year: string;
  network: string;
  ownerAddress: string;
  raw: unknown;
}

type CollectorPayload = {
  address: string;
  count: number;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  failedNetworks?: string[];
  source: string;
  poaps: NormalizedPoap[];
};

const collectorCache = new TtlCache<CollectorPayload>(COLLECTOR_CACHE_TTL_MS);
const scanCache = new TtlCache<NormalizedPoap[]>(SCAN_CACHE_TTL_MS);

function pickString(source: any, keys: string[]): string {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
  }
  return "";
}

function withArtworkSize(url: string, size = "medium"): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("size")) {
      parsed.searchParams.set("size", size);
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function poapChain(network: PoapNetworkConfig): Chain {
  return {
    id: network.chainId,
    name: network.label,
    nativeCurrency: { name: "Native Token", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [network.rpcUrl] },
      public: { http: [network.rpcUrl] },
    },
    blockExplorers: {
      default: { name: network.label, url: network.explorerUrl },
    },
    contracts: {
      multicall3: { address: MULTICALL3_ADDRESS },
    },
  };
}

type PoapClient = ReturnType<typeof createPublicClient>;

function poapClient(network: PoapNetworkConfig): PoapClient {
  return createPublicClient({
    chain: poapChain(network),
    transport: http(network.rpcUrl, {
      timeout: RPC_TIMEOUT_MS,
      retryCount: 1,
    }),
  });
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index], index);
      }
    }
  );
  await Promise.all(runners);
  return results;
}

type TokenRef = { index: number; tokenId: string; dropId: string };

/**
 * Reads `tokenDetailsOfOwnerByIndex` for a contiguous index range. Uses
 * Multicall3 so a 50-item page costs a couple of RPC round trips instead of
 * one per token, and degrades to individual reads if a chain rejects the batch.
 */
async function readTokenRefs(
  client: PoapClient,
  owner: `0x${string}`,
  startIndex: number,
  count: number
): Promise<TokenRef[]> {
  if (count <= 0) return [];
  const indexes = Array.from({ length: count }, (_, offset) => startIndex + offset);
  const batches = chunk(indexes, MULTICALL_BATCH_SIZE);

  const batchResults = await mapWithConcurrency(
    batches,
    RPC_CONCURRENCY,
    async (batch): Promise<TokenRef[]> => {
      const contracts = batch.map((index) => ({
        address: POAP_CONTRACT_ADDRESS as `0x${string}`,
        abi: poapAbi,
        functionName: "tokenDetailsOfOwnerByIndex" as const,
        args: [owner, BigInt(index)] as const,
      }));

      try {
        const rows = await client.multicall({ contracts, allowFailure: true });
        return rows.flatMap((row, offset) => {
          if (row.status !== "success" || !row.result) return [];
          const [tokenId, dropId] = row.result as readonly [bigint, bigint];
          return [
            {
              index: batch[offset],
              tokenId: tokenId.toString(),
              dropId: dropId.toString(),
            },
          ];
        });
      } catch {
        // Multicall3 missing or batch rejected: fall back to single reads.
        const rows = await mapWithConcurrency(
          batch,
          RPC_CONCURRENCY,
          async (index): Promise<TokenRef | null> => {
            try {
              const details = await client.readContract({
                address: POAP_CONTRACT_ADDRESS,
                abi: poapAbi,
                functionName: "tokenDetailsOfOwnerByIndex",
                args: [owner, BigInt(index)],
              });
              return {
                index,
                tokenId: details[0].toString(),
                dropId: details[1].toString(),
              };
            } catch {
              return null;
            }
          }
        );
        return rows.filter((row): row is TokenRef => row !== null);
      }
    }
  );

  return batchResults.flat().sort((a, b) => a.index - b.index);
}

async function readTokenUris(
  client: PoapClient,
  tokenIds: string[]
): Promise<string[]> {
  if (!tokenIds.length) return [];
  const batches = chunk(tokenIds, MULTICALL_BATCH_SIZE);
  const batchResults = await mapWithConcurrency(
    batches,
    RPC_CONCURRENCY,
    async (batch): Promise<string[]> => {
      const contracts = batch.map((tokenId) => ({
        address: POAP_CONTRACT_ADDRESS as `0x${string}`,
        abi: poapAbi,
        functionName: "tokenURI" as const,
        args: [BigInt(tokenId)] as const,
      }));
      try {
        const rows = await client.multicall({ contracts, allowFailure: true });
        return rows.map((row) =>
          row.status === "success" ? String(row.result ?? "") : ""
        );
      } catch {
        return mapWithConcurrency(batch, RPC_CONCURRENCY, async (tokenId) => {
          try {
            return await client.readContract({
              address: POAP_CONTRACT_ADDRESS,
              abi: poapAbi,
              functionName: "tokenURI",
              args: [BigInt(tokenId)],
            });
          } catch {
            return "";
          }
        });
      }
    }
  );
  return batchResults.flat();
}

async function hydrateTokenRefs(
  network: PoapNetworkConfig,
  client: PoapClient,
  owner: `0x${string}`,
  refs: TokenRef[]
): Promise<NormalizedPoap[]> {
  if (!refs.length) return [];
  const tokenUris = await readTokenUris(
    client,
    refs.map((ref) => ref.tokenId)
  );
  const metadata = await mapWithConcurrency(
    tokenUris,
    METADATA_CONCURRENCY,
    (uri) => fetchTokenMetadata(uri)
  );
  return refs.map((ref, offset) =>
    normalizeMetadataPoap(
      network,
      owner,
      ref.tokenId,
      ref.dropId,
      metadata[offset],
      tokenUris[offset] || ""
    )
  );
}

function normalizeMetadataUrl(value: string): string {
  if (!value) return "";
  if (value.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${value.slice("ipfs://".length)}`;
  }
  return value;
}

async function fetchTokenMetadata(uri: string): Promise<any> {
  const url = normalizeMetadataUrl(uri);
  if (!url || !/^https?:\/\//i.test(url)) return {};
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), METADATA_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeMetadataImage(value: string): string {
  if (!value) return "";
  if (value.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${value.slice("ipfs://".length)}`;
  }
  return value;
}

function normalizeAttributeKey(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMetadataPoap(
  network: PoapNetworkConfig,
  ownerAddress: string,
  tokenId: string,
  dropId: string,
  metadata: any,
  tokenUri: string
): NormalizedPoap {
  const event = metadata?.event || metadata?.drop || metadata?.poap_event || {};
  const attributes = Array.isArray(metadata?.attributes) ? metadata.attributes : [];
  const normalizedNames = (names: string[]) =>
    names.map(normalizeAttributeKey);
  const attributeValue = (names: string[]) => {
    const targets = normalizedNames(names);
    const found = attributes.find((attribute: any) =>
      targets.includes(
        normalizeAttributeKey(
          String(attribute?.trait_type || attribute?.type || attribute?.key || "")
        )
      )
    );
    return pickString(found, ["value"]);
  };
  const title =
    pickString(event, ["name", "title", "fancy_id"]) ||
    pickString(metadata, ["name", "title", "fancy_id"]) ||
    attributeValue(["event", "event name", "drop"]) ||
    `POAP ${tokenId}`;
  const imageUrl = withArtworkSize(
    normalizeMetadataImage(
      pickString(event, ["image_url", "imageUrl", "image"]) ||
        pickString(metadata, ["image_url", "imageUrl", "image"])
    )
  );
  const startDate =
    pickString(event, ["start_date", "startDate", "start", "date"]) ||
    pickString(metadata, [
      "start_date",
      "startDate",
      "start",
      "date",
      "event_start_date",
      "eventStartDate",
    ]) ||
    attributeValue(["startDate", "start date", "start", "date", "event date"]);
  const endDate =
    pickString(event, ["end_date", "endDate", "end"]) ||
    pickString(metadata, [
      "end_date",
      "endDate",
      "end",
      "event_end_date",
      "eventEndDate",
    ]) ||
    attributeValue(["endDate", "end date", "end"]);

  return {
    id: `${network.key}-${dropId || "drop"}-${tokenId}`,
    tokenId,
    dropId,
    title,
    description:
      pickString(event, ["description"]) || pickString(metadata, ["description"]),
    imageUrl,
    eventUrl:
      pickString(event, ["external_url", "externalUrl", "event_url", "eventUrl", "url"]) ||
      pickString(metadata, ["external_url", "externalUrl", "event_url", "eventUrl", "url"]) ||
      attributeValue(["event url", "url"]),
    city: pickString(event, ["city"]) || pickString(metadata, ["city"]) || attributeValue(["city"]),
    country:
      pickString(event, ["country"]) ||
      pickString(metadata, ["country"]) ||
      attributeValue(["country"]),
    startDate,
    endDate,
    year:
      pickString(event, ["year"]) ||
      pickString(metadata, ["year"]) ||
      attributeValue(["year"]),
    network: network.key,
    ownerAddress,
    raw: { source: "onchain-token-uri", tokenUri, metadata },
  };
}

/**
 * Per-network balances for one wallet. The global POAP ordering is the fixed
 * `POAP_NETWORKS` order, and within each network the on-chain owner index
 * 0..balance-1, so a page maps to the same rows on every request as long as
 * this layout is stable. Failed networks stay in the layout with a count of 0
 * so a transient RPC error cannot shift the offsets of later networks.
 */
type CollectionLayout = {
  counts: number[];
  totalCount: number;
  failedNetworks: string[];
  succeededNetworks: number;
};

const layoutCache = new TtlCache<CollectionLayout>(LAYOUT_CACHE_TTL_MS);

async function getCollectionLayout(address: string): Promise<CollectionLayout> {
  const owner = getAddress(address);
  const cacheKey = `layout:${NETWORK_SIGNATURE}:${owner.toLowerCase()}`;
  const cached = layoutCache.get(cacheKey);
  if (cached) return cached;

  const balances = await Promise.allSettled(
    POAP_NETWORKS.map(async (network) => {
      const balance = await poapClient(network).readContract({
        address: POAP_CONTRACT_ADDRESS,
        abi: poapAbi,
        functionName: "balanceOf",
        args: [owner],
      });
      return Number(balance);
    })
  );

  const counts: number[] = [];
  const failedNetworks: string[] = [];
  let succeededNetworks = 0;
  balances.forEach((result, index) => {
    if (result.status === "fulfilled" && Number.isFinite(result.value)) {
      counts.push(Math.max(0, result.value));
      succeededNetworks += 1;
    } else {
      counts.push(0);
      failedNetworks.push(POAP_NETWORKS[index].key);
    }
  });

  const layout: CollectionLayout = {
    counts,
    totalCount: counts.reduce((sum, value) => sum + value, 0),
    failedNetworks,
    succeededNetworks,
  };

  // Only pin a layout that we actually managed to read, otherwise a total RPC
  // outage would be cached as "this wallet has no POAPs" for five minutes.
  if (succeededNetworks > 0) layoutCache.set(cacheKey, layout);
  return layout;
}

type PageSlice = {
  network: PoapNetworkConfig;
  startIndex: number;
  count: number;
};

function planPageSlices(
  layout: CollectionLayout,
  page: number,
  pageSize: number
): PageSlice[] {
  const pageStart = (page - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const slices: PageSlice[] = [];
  let offset = 0;

  POAP_NETWORKS.forEach((network, index) => {
    const networkTotal = layout.counts[index] ?? 0;
    const start = Math.max(0, pageStart - offset);
    const end = Math.min(networkTotal, pageEnd - offset);
    if (start < end) {
      slices.push({ network, startIndex: start, count: end - start });
    }
    offset += networkTotal;
  });

  return slices;
}

async function fetchOnchainPoaps(
  address: string,
  page: number,
  pageSize: number
): Promise<{
  poaps: NormalizedPoap[];
  failedNetworks: string[];
  succeededNetworks: number;
  totalCount: number;
  hasMore: boolean;
}> {
  const owner = getAddress(address);
  const layout = await getCollectionLayout(owner);
  const slices = planPageSlices(layout, page, pageSize);

  // Slices run sequentially: a page rarely spans more than one network, and
  // serial networks keep concurrent RPC load bounded by RPC_CONCURRENCY.
  const pages: NormalizedPoap[][] = [];
  for (const slice of slices) {
    const client = poapClient(slice.network);
    try {
      const refs = await readTokenRefs(
        client,
        owner,
        slice.startIndex,
        slice.count
      );
      pages.push(await hydrateTokenRefs(slice.network, client, owner, refs));
    } catch {
      pages.push([]);
    }
  }

  return {
    poaps: pages.flat(),
    failedNetworks: layout.failedNetworks,
    succeededNetworks: layout.succeededNetworks,
    totalCount: layout.totalCount,
    hasMore: page * pageSize < layout.totalCount,
  };
}

/**
 * Resolves a single drop inside a wallet without paging through it. Only the
 * cheap `tokenDetailsOfOwnerByIndex` read is batched across the collection,
 * and the scan stops at the first match.
 */
async function findOnchainPoapByDrop(
  address: string,
  dropId: string
): Promise<{
  poap: NormalizedPoap | null;
  layout: CollectionLayout;
  scanTruncated: boolean;
}> {
  const owner = getAddress(address);
  const layout = await getCollectionLayout(owner);
  let scanned = 0;
  let scanTruncated = false;

  for (const [index, network] of POAP_NETWORKS.entries()) {
    const networkTotal = layout.counts[index] ?? 0;
    if (!networkTotal) continue;
    const client = poapClient(network);

    for (let start = 0; start < networkTotal; start += MULTICALL_BATCH_SIZE) {
      if (scanned >= DROP_SCAN_MAX_INDICES) {
        scanTruncated = true;
        break;
      }
      const count = Math.min(
        MULTICALL_BATCH_SIZE,
        networkTotal - start,
        DROP_SCAN_MAX_INDICES - scanned
      );
      scanned += count;

      let refs: TokenRef[] = [];
      try {
        refs = await readTokenRefs(client, owner, start, count);
      } catch {
        continue;
      }

      const match = refs.find((ref) => ref.dropId === dropId);
      if (match) {
        const [poap] = await hydrateTokenRefs(network, client, owner, [match]);
        return { poap: poap ?? null, layout, scanTruncated };
      }
    }
    if (scanTruncated) break;
  }

  return { poap: null, layout, scanTruncated };
}

function normalizePoap(raw: any): NormalizedPoap {
  const event = raw?.event || raw?.drop || raw?.poap_event || {};
  const tokenId = pickString(raw, [
    "tokenId",
    "token_id",
    "poap_id",
    "id",
    "source_uid",
  ]);
  const dropId =
    pickString(event, ["id", "event_id", "drop_id", "dropId"]) ||
    pickString(raw, ["event_id", "drop_id", "dropId"]);
  const title =
    pickString(event, ["name", "title", "fancy_id"]) ||
    pickString(raw, ["name", "title", "fancy_id"]) ||
    `POAP ${tokenId}`;
  const imageUrl = withArtworkSize(
    pickString(event, ["image_url", "imageUrl", "image"]) ||
      pickString(raw, ["image_url", "imageUrl", "image"])
  );

  return {
    id: `${dropId || "drop"}-${tokenId || "token"}`,
    tokenId,
    dropId,
    title,
    description:
      pickString(event, ["description"]) || pickString(raw, ["description"]),
    imageUrl,
    eventUrl:
      pickString(event, ["event_url", "eventUrl", "url"]) ||
      pickString(raw, ["event_url", "eventUrl", "url"]),
    city: pickString(event, ["city"]) || pickString(raw, ["city"]),
    country: pickString(event, ["country"]) || pickString(raw, ["country"]),
    startDate:
      pickString(event, ["start_date", "startDate"]) ||
      pickString(raw, ["start_date", "startDate"]),
    endDate:
      pickString(event, ["end_date", "endDate"]) ||
      pickString(raw, ["end_date", "endDate"]),
    year: pickString(event, ["year"]) || pickString(raw, ["year"]),
    network:
      pickString(raw, ["chain", "network", "minting_network"]) ||
      pickString(event, ["chain", "network", "minting_network"]),
    ownerAddress: pickString(raw, ["owner", "owner_address", "ownerAddress"]),
    raw,
  };
}

async function enrichWithPoapArchive(
  poap: NormalizedPoap
): Promise<NormalizedPoap> {
  const shouldCheckArchive =
    process.env.POAP_ARCHIVE_ALWAYS_ENRICH === "true" ||
    !poap.title ||
    /^POAP \d+$/i.test(poap.title) ||
    !poap.description ||
    !poap.imageUrl ||
    !poap.startDate ||
    !poap.endDate ||
    !poap.city ||
    !poap.country ||
    !poap.eventUrl ||
    !poap.year;

  if (!shouldCheckArchive) return poap;

  const archive = await lookupPoapArchive({
    tokenId: poap.tokenId,
    dropId: poap.dropId,
    ownerAddress: poap.ownerAddress,
  }).catch(() => null);

  const drop = archive?.drop;
  if (!drop) return poap;

  const archiveTokenId =
    archive?.token?.poap_id != null
      ? String(archive.token.poap_id)
      : archive?.token?.source_uid || "";
  const archiveNetwork = archive?.token?.network || "";
  const archiveOwner = archive?.token?.owner_address || "";

  return {
    ...poap,
    tokenId: poap.tokenId || archiveTokenId,
    dropId: poap.dropId || String(drop.drop_id),
    title:
      poap.title && !/^POAP \d+$/i.test(poap.title)
        ? poap.title
        : drop.title || poap.title,
    description: poap.description || drop.description || "",
    imageUrl: poap.imageUrl || archive.artworkUrl,
    eventUrl: poap.eventUrl || drop.event_url || "",
    city: poap.city || drop.city || "",
    country: poap.country || drop.country || "",
    startDate: poap.startDate || drop.start_date || "",
    endDate: poap.endDate || drop.end_date || "",
    year: poap.year || (drop.year != null ? String(drop.year) : ""),
    network: poap.network || archiveNetwork,
    ownerAddress: poap.ownerAddress || archiveOwner,
    raw: {
      live: poap.raw,
      archive,
    },
  };
}

async function enrichPoapsWithArchive(
  poaps: NormalizedPoap[]
): Promise<NormalizedPoap[]> {
  return Promise.all(poaps.map(enrichWithPoapArchive));
}

function numericKey(value: string): bigint {
  try {
    return /^\d+$/.test(value) ? BigInt(value) : BigInt(0);
  } catch {
    return BigInt(0);
  }
}

/**
 * The POAP API does not guarantee a stable order, so impose one before slicing
 * pages. Without this, page 2 could repeat or skip rows from page 1.
 */
function sortForStablePaging(poaps: NormalizedPoap[]): NormalizedPoap[] {
  return [...poaps].sort((a, b) => {
    if (a.network !== b.network) return a.network < b.network ? -1 : 1;
    const dropDiff = numericKey(a.dropId) - numericKey(b.dropId);
    if (dropDiff !== BigInt(0)) return dropDiff < BigInt(0) ? -1 : 1;
    const tokenDiff = numericKey(a.tokenId) - numericKey(b.tokenId);
    if (tokenDiff !== BigInt(0)) return tokenDiff < BigInt(0) ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/**
 * Slices the cached POAP API scan before archive enrichment so a wallet with
 * thousands of POAPs only pays enrichment cost for the requested page.
 */
async function buildApiPayload(
  address: string,
  scanned: NormalizedPoap[],
  page: number,
  pageSize: number,
  dropId: string
): Promise<CollectorPayload> {
  if (dropId) {
    const matches = scanned.filter((poap) => poap.dropId === dropId);
    const poaps = await withTimeout(
      enrichPoapsWithArchive(matches.slice(0, pageSize)),
      ARCHIVE_ENRICH_TIMEOUT_MS,
      matches.slice(0, pageSize)
    );
    return {
      address,
      count: poaps.length,
      totalCount: scanned.length,
      page: 1,
      pageSize,
      hasMore: false,
      source: "poap-api-drop-lookup",
      poaps,
    };
  }

  const pageStart = (page - 1) * pageSize;
  const slice = scanned.slice(pageStart, pageStart + pageSize);
  const poaps = await withTimeout(
    enrichPoapsWithArchive(slice),
    ARCHIVE_ENRICH_TIMEOUT_MS,
    slice
  );
  return {
    address,
    count: poaps.length,
    totalCount: scanned.length,
    page,
    pageSize,
    hasMore: pageStart + pageSize < scanned.length,
    source: "poap-api+archive-fallback",
    poaps,
  };
}

export async function GET(request: NextRequest) {
  const addressParam = request.nextUrl.searchParams.get("address") || "";
  if (!isAddress(addressParam)) {
    return NextResponse.json(
      { error: "A valid EVM address is required." },
      { status: 400 }
    );
  }
  const address = getAddress(addressParam);
  const page = Math.max(
    1,
    Number(request.nextUrl.searchParams.get("page") || "1") || 1
  );
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(
      1,
      Number(
        request.nextUrl.searchParams.get("pageSize") || DEFAULT_PAGE_SIZE
      ) || DEFAULT_PAGE_SIZE
    )
  );
  const dropId = (request.nextUrl.searchParams.get("dropId") || "").trim();
  const cacheKey = dropId
    ? `poap:${NETWORK_SIGNATURE}:${address.toLowerCase()}:drop:${dropId}`
    : `poap:${NETWORK_SIGNATURE}:${address.toLowerCase()}:${page}:${pageSize}`;
  const cached = collectorCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  }

  const apiKey =
    process.env.POAP_API_KEY || process.env.NEXT_PUBLIC_POAP_API_KEY || "";
  const bearer = process.env.POAP_AUTH_TOKEN || process.env.POAP_BEARER_TOKEN || "";

  const respond = (payload: CollectorPayload) => {
    collectorCache.set(cacheKey, payload);
    return NextResponse.json(payload);
  };

  const noApiCredentials = !apiKey && !bearer;

  // Targeted single-drop lookup, used by the archive flow. Scanning by index is
  // far cheaper than paging the whole wallet just to find one token.
  if (dropId && noApiCredentials) {
    const found = await findOnchainPoapByDrop(address, dropId);
    if (found.layout.succeededNetworks === 0) {
      return NextResponse.json(
        {
          error:
            "Unable to read on-chain POAPs from any network. RPCs may be rate-limited or unreachable. Try again shortly.",
          failedNetworks: found.layout.failedNetworks,
        },
        { status: 502 }
      );
    }
    const matches = found.poap ? [found.poap] : [];
    const poaps = await withTimeout(
      enrichPoapsWithArchive(matches),
      ARCHIVE_ENRICH_TIMEOUT_MS,
      matches
    );
    return respond({
      address,
      count: poaps.length,
      totalCount: found.layout.totalCount,
      page: 1,
      pageSize,
      hasMore: false,
      failedNetworks: found.layout.failedNetworks,
      source: found.scanTruncated
        ? "onchain-drop-lookup-truncated"
        : "onchain-drop-lookup",
      poaps,
    });
  }

  if (noApiCredentials) {
    const onchain = await fetchOnchainPoaps(address, page, pageSize);
    if (onchain.succeededNetworks === 0) {
      return NextResponse.json(
        {
          error:
            "Unable to read on-chain POAPs from any network. RPCs may be rate-limited or unreachable. Try again shortly.",
          failedNetworks: onchain.failedNetworks,
        },
        { status: 502 }
      );
    }
    const poaps = await withTimeout(
      enrichPoapsWithArchive(onchain.poaps),
      ARCHIVE_ENRICH_TIMEOUT_MS,
      onchain.poaps
    );
    return respond({
      address,
      count: poaps.length,
      totalCount: onchain.totalCount,
      page,
      pageSize,
      hasMore: onchain.hasMore,
      failedNetworks: onchain.failedNetworks,
      source: "onchain+archive-fallback",
      poaps,
    });
  }

  const headers: HeadersInit = {
    Accept: "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const scanCacheKey = `scan:${NETWORK_SIGNATURE}:${address.toLowerCase()}`;
  const cachedScan = scanCache.get(scanCacheKey);
  if (cachedScan) {
    return respond(
      await buildApiPayload(address, cachedScan, page, pageSize, dropId)
    );
  }

  const url = `${POAP_API_BASE.replace(/\/+$/, "")}/actions/scan/${address}`;
  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
    // Prefer a partial on-chain answer over a hard failure when the API is
    // rate-limited or temporarily unavailable.
    if (isRateLimitStatus(response.status) || response.status >= 500) {
      if (dropId) {
        const found = await findOnchainPoapByDrop(address, dropId);
        if (found.layout.succeededNetworks > 0) {
          const matches = found.poap ? [found.poap] : [];
          const poaps = await withTimeout(
            enrichPoapsWithArchive(matches),
            ARCHIVE_ENRICH_TIMEOUT_MS,
            matches
          );
          return respond({
            address,
            count: poaps.length,
            totalCount: found.layout.totalCount,
            page: 1,
            pageSize,
            hasMore: false,
            failedNetworks: found.layout.failedNetworks,
            source: "onchain-drop-lookup-after-poap-api-error",
            poaps,
          });
        }
      }
      const onchain = await fetchOnchainPoaps(address, page, pageSize);
      if (onchain.poaps.length > 0 || onchain.succeededNetworks > 0) {
        const poaps = await withTimeout(
          enrichPoapsWithArchive(onchain.poaps),
          ARCHIVE_ENRICH_TIMEOUT_MS,
          onchain.poaps
        );
        return respond({
          address,
          count: poaps.length,
          totalCount: onchain.totalCount,
          page,
          pageSize,
          hasMore: onchain.hasMore,
          failedNetworks: onchain.failedNetworks,
          source: "onchain-fallback-after-poap-api-error",
          poaps,
        });
      }
      return NextResponse.json(
        {
          error: rateLimitMessage(
            "POAP API",
            `Request failed with ${response.status}.`
          ),
          details: text.slice(0, 500),
        },
        {
          status: isRateLimitStatus(response.status) ? 429 : 502,
          headers: isRateLimitStatus(response.status)
            ? { "Retry-After": "30" }
            : undefined,
        }
      );
    }
    return NextResponse.json(
      {
        error: `POAP API request failed with ${response.status}.`,
        details: text.slice(0, 500),
      },
      { status: response.status }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "POAP API returned invalid JSON." },
      { status: 502 }
    );
  }

  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as any)?.tokens)
    ? (parsed as any).tokens
    : Array.isArray((parsed as any)?.poaps)
    ? (parsed as any).poaps
    : Array.isArray((parsed as any)?.data)
    ? (parsed as any).data
    : [];

  const normalized = sortForStablePaging(items.map(normalizePoap));
  scanCache.set(scanCacheKey, normalized);
  return respond(
    await buildApiPayload(address, normalized, page, pageSize, dropId)
  );
}
