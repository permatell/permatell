import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import type { Chain } from "viem";

export const dynamic = "force-dynamic";

const POAP_API_BASE = process.env.POAP_API_BASE || "https://api.poap.tech";
const POAP_CONTRACT_ADDRESS = "0x22C1f6050E56d2876009903609a2cC3fEf83B415";
const MAX_ONCHAIN_TOKENS_PER_NETWORK = 120;

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
  {
    key: "polygon",
    label: "Polygon",
    chainId: 137,
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
  },
  {
    key: "base",
    label: "Base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
  },
  {
    key: "arbitrum",
    label: "Arbitrum",
    chainId: 42161,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
  },
  {
    key: "linea",
    label: "Linea",
    chainId: 59144,
    rpcUrl: "https://rpc.linea.build",
    explorerUrl: "https://lineascan.build",
  },
  {
    key: "celo",
    label: "Celo",
    chainId: 42220,
    rpcUrl: "https://forno.celo.org",
    explorerUrl: "https://celoscan.io",
  },
];

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
  };
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
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return {};
    return await response.json();
  } catch {
    return {};
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

async function fetchOnchainPoapsForNetwork(
  address: string,
  network: PoapNetworkConfig
): Promise<NormalizedPoap[]> {
  const client = createPublicClient({
    chain: poapChain(network),
    transport: http(network.rpcUrl),
  });

  const owner = getAddress(address);
  const balance = await client.readContract({
    address: POAP_CONTRACT_ADDRESS,
    abi: poapAbi,
    functionName: "balanceOf",
    args: [owner],
  });
  const count = Math.min(Number(balance), MAX_ONCHAIN_TOKENS_PER_NETWORK);
  if (!count) return [];

  const rows = await Promise.allSettled(
    Array.from({ length: count }, async (_, index) => {
      const details = await client.readContract({
        address: POAP_CONTRACT_ADDRESS,
        abi: poapAbi,
        functionName: "tokenDetailsOfOwnerByIndex",
        args: [owner, BigInt(index)],
      });
      const tokenId = details[0].toString();
      const dropId = details[1].toString();
      const tokenUri = await client.readContract({
        address: POAP_CONTRACT_ADDRESS,
        abi: poapAbi,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });
      const metadata = await fetchTokenMetadata(tokenUri);
      return normalizeMetadataPoap(
        network,
        owner,
        tokenId,
        dropId,
        metadata,
        tokenUri
      );
    })
  );

  return rows
    .filter(
      (row): row is PromiseFulfilledResult<NormalizedPoap> =>
        row.status === "fulfilled"
    )
    .map((row) => row.value);
}

async function fetchOnchainPoaps(address: string): Promise<NormalizedPoap[]> {
  const results = await Promise.allSettled(
    POAP_NETWORKS.map((network) => fetchOnchainPoapsForNetwork(address, network))
  );
  return results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );
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

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address") || "";
  if (!isAddress(address)) {
    return NextResponse.json(
      { error: "A valid EVM address is required." },
      { status: 400 }
    );
  }

  const apiKey =
    process.env.POAP_API_KEY || process.env.NEXT_PUBLIC_POAP_API_KEY || "";
  const bearer = process.env.POAP_AUTH_TOKEN || process.env.POAP_BEARER_TOKEN || "";
  if (!apiKey && !bearer) {
    const poaps = await fetchOnchainPoaps(address);
    return NextResponse.json({
      address,
      count: poaps.length,
      source: "onchain",
      truncatedPerNetworkAt: MAX_ONCHAIN_TOKENS_PER_NETWORK,
      poaps,
    });
  }

  const headers: HeadersInit = {
    Accept: "application/json",
  };
  if (apiKey) headers["x-api-key"] = apiKey;
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  const url = `${POAP_API_BASE.replace(/\/+$/, "")}/actions/scan/${address}`;
  const response = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const text = await response.text();
  if (!response.ok) {
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

  return NextResponse.json({
    address,
    count: items.length,
    source: "poap-api",
    poaps: items.map(normalizePoap),
  });
}
