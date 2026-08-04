import { dryrun } from "@permaweb/aoconnect";

export const POMP_APP_NAME = "PermaTell";
export const POMP_TYPE = "POMP";

const AO_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const POMP_GRAPHQL_ENDPOINTS = [
  process.env.AO_GQL_URL,
  process.env.NEXT_PUBLIC_AO_GQL_URL,
  "https://ao-search-gateway.goldsky.com/graphql",
  "https://arweave.net/graphql",
].filter(Boolean) as string[];

const CAMPAIGN_GATEWAYS = [
  "https://arweave.net",
  "https://aoweave.tech",
  "https://g8way.io",
];

const CU_ENDPOINTS = [
  process.env.AO_CU_URL,
  process.env.NEXT_PUBLIC_AO_MAINNET_CU_URL,
  process.env.NEXT_PUBLIC_AO_CU_URL,
  "https://forward.computer",
].filter(Boolean) as string[];

export interface PompAsset {
  assetId: string;
  bazarUrl: string;
  arweaveUrl: string;
  artworkUrl?: string;
  artworkId?: string;
  title: string;
  tokenId: string;
  dropId: string;
  poapNetwork: string;
  poapOwner: string;
  arweaveOwner: string;
  claimedAt: string;
  assetType?: string;
  sourceProtocol?: string;
  source: "arweave";
}

export interface PompCampaignClaim {
  Timestamp?: string;
  WalletAddress?: string;
  Recipient?: string;
  AssetId?: string;
  ClaimIndex?: number;
}

export interface PompCampaignInfo {
  assetId: string;
  config: Record<string, any>;
  claims: Record<string, PompCampaignClaim>;
  claimed: number;
  remaining: number;
  ownerBalance: string;
  source: "dryrun" | "gateway";
}

export interface PompAssetDetail extends PompAsset {
  tags: Record<string, string>;
  metadata: Record<string, any>;
  description: string;
  eventUrl: string;
  city: string;
  country: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  campaign: PompCampaignInfo | null;
}

export function normalizeAoId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const id = trimmed.startsWith("ar://") ? trimmed.slice(5) : trimmed;
  if (AO_ID_PATTERN.test(id)) return id;
  const match = id.match(/[A-Za-z0-9_-]{43}/);
  return match?.[0] || null;
}

function normalizeText(value: unknown): string {
  try {
    return String(value || "").normalize("NFC").trim();
  } catch {
    return String(value || "").trim();
  }
}

export function getTagValue(
  tags: Array<{ name?: string; value?: string }> | undefined,
  names: string[]
): string {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const tag of tags || []) {
    const name = normalizeText(tag?.name).toLowerCase();
    const value = normalizeText(tag?.value);
    if (wanted.has(name) && value) return value;
  }
  return "";
}

export function pompAssetFromGraphqlEdge(
  edge: any,
  fallbackOwner = ""
): PompAsset | null {
  const node = edge?.node;
  const assetId = normalizeAoId(node?.id);
  if (!assetId) return null;
  const tags = node?.tags || [];
  const artworkId = normalizeAoId(getTagValue(tags, ["POMP-Artwork", "Artwork"]));
  const sourceArtworkUrl = getTagValue(tags, ["POAP-Artwork-Source"]);
  const timestamp = Number(node?.block?.timestamp || 0);
  return {
    assetId,
    bazarUrl: `https://bazar.arweave.net/#/asset/${assetId}`,
    arweaveUrl: `https://arweave.net/${assetId}`,
    artworkUrl: artworkId
      ? `https://arweave.net/${artworkId}`
      : sourceArtworkUrl || undefined,
    artworkId: artworkId || undefined,
    title: getTagValue(tags, ["Title"]) || "POMP",
    tokenId: getTagValue(tags, ["POAP-Token-Id"]),
    dropId: getTagValue(tags, ["POAP-Drop-Id"]),
    poapNetwork: getTagValue(tags, ["POAP-Network"]),
    poapOwner: getTagValue(tags, ["POAP-Owner"]),
    arweaveOwner: normalizeText(node?.owner?.address) || fallbackOwner,
    claimedAt: timestamp ? new Date(timestamp * 1000).toISOString() : "",
    assetType: getTagValue(tags, ["POMP-Asset-Type"]),
    sourceProtocol: getTagValue(tags, ["POMP-Source"]),
    source: "arweave",
  };
}

export function tagsToRecord(
  tags: Array<{ name?: string; value?: string }> | undefined
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tag of tags || []) {
    const name = normalizeText(tag?.name);
    const value = normalizeText(tag?.value);
    if (name && value) out[name] = value;
  }
  return out;
}

export function parseCampaignPayload(value: any): Omit<PompCampaignInfo, "source"> | null {
  const asset = typeof value?.asset === "string" ? safeJson(value.asset) : value?.asset;
  const source = asset || value;
  const config = source?.POMPCampaignConfig || source?.config;
  const claims = source?.POMPClaims || source?.claims || {};
  if (!config && !source?.claimed && !source?.remaining) return null;
  const claimed =
    typeof source?.claimed === "number"
      ? source.claimed
      : Object.keys(claims || {}).length;
  const total = Number(config?.TotalSupply || config?.maxClaims || 0);
  const remaining =
    typeof source?.remaining === "number"
      ? source.remaining
      : Math.max(0, total - claimed);
  return {
    assetId: normalizeAoId(source?.assetId || config?.ParentAssetId) || "",
    config: config || {},
    claims,
    claimed,
    remaining,
    ownerBalance: String(source?.ownerBalance || ""),
  };
}

export function safeJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function fetchJsonFromGateways(id: string): Promise<Record<string, any>> {
  for (const gateway of CAMPAIGN_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}/${id}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const parsed = safeJson(await response.text());
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // Try next gateway.
    }
  }
  return {};
}

export async function fetchPompAssetDetail(
  assetId: string
): Promise<PompAssetDetail | null> {
  const id = normalizeAoId(assetId);
  if (!id) return null;

  const query = `
    query PompAsset($ids: [ID!]!) {
      transactions(ids: $ids, first: 1) {
        edges {
          node {
            id
            owner { address }
            block { timestamp }
            tags { name value }
          }
        }
      }
    }
  `;

  let asset: PompAsset | null = null;
  let tags: Record<string, string> = {};
  for (const endpoint of POMP_GRAPHQL_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables: { ids: [id] } }),
        cache: "no-store",
      });
      if (!response.ok) continue;
      const json = await response.json();
      const edge = json?.data?.transactions?.edges?.[0];
      const parsed = pompAssetFromGraphqlEdge(edge);
      if (!parsed) continue;
      asset = parsed;
      tags = tagsToRecord(edge?.node?.tags || []);
      break;
    } catch {
      // Try next endpoint.
    }
  }

  const metadata = await fetchJsonFromGateways(id);
  const drop = metadata?.drop || {};
  const source = metadata?.source || {};
  const campaign = await fetchPompCampaignInfo(id);

  const assetType =
    asset?.assetType ||
    tags["POMP-Asset-Type"] ||
    (source?.mode === "native-event" ? "native-event" : "");
  const sourceProtocol =
    asset?.sourceProtocol || tags["POMP-Source"] || source?.protocol || "";
  const artworkId =
    asset?.artworkId ||
    normalizeAoId(drop?.artworkId || tags["POMP-Artwork"] || tags.Artwork) ||
    undefined;

  const baseAsset: PompAsset =
    asset || {
      assetId: id,
      bazarUrl: `https://bazar.arweave.net/#/asset/${id}`,
      arweaveUrl: `https://arweave.net/${id}`,
      title: tags.Title || metadata?.title || campaign?.config?.Name || "POMP",
      tokenId: tags["POAP-Token-Id"] || "",
      dropId: tags["POAP-Drop-Id"] || "",
      poapNetwork: tags["POAP-Network"] || "",
      poapOwner: tags["POAP-Owner"] || "",
      arweaveOwner: tags.Creator || source?.creator || "",
      claimedAt: metadata?.createdAt || "",
      source: "arweave",
    };

  return {
    ...baseAsset,
    title:
      baseAsset.title ||
      metadata?.title ||
      campaign?.config?.Name ||
      tags.Title ||
      "POMP",
    artworkId,
    artworkUrl:
      artworkId
        ? `https://arweave.net/${artworkId}`
        : baseAsset.artworkUrl || tags["POAP-Artwork-Source"] || undefined,
    assetType,
    sourceProtocol,
    tags,
    metadata,
    description:
      metadata?.description ||
      drop?.description ||
      campaign?.config?.Description ||
      tags.Description ||
      "",
    eventUrl: drop?.eventUrl || campaign?.config?.EventUrl || tags["Event-URL"] || "",
    city: drop?.city || campaign?.config?.City || tags["Event-City"] || "",
    country:
      drop?.country || campaign?.config?.Country || tags["Event-Country"] || "",
    startDate:
      drop?.startDate ||
      campaign?.config?.StartDate ||
      tags["Event-Start-Date"] ||
      "",
    endDate:
      drop?.endDate || campaign?.config?.EndDate || tags["Event-End-Date"] || "",
    createdAt: metadata?.createdAt || baseAsset.claimedAt || "",
    campaign,
  };
}

function resultTagsToRecord(tags: any): Record<string, string> {
  if (!tags) return {};
  if (!Array.isArray(tags) && typeof tags === "object") {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      if (typeof value === "string") out[key] = value;
    }
    return out;
  }
  const out: Record<string, string> = {};
  for (const tag of tags || []) {
    const name = normalizeText(tag?.name || tag?.Name);
    const value = normalizeText(tag?.value || tag?.Value);
    if (name) out[name] = value;
  }
  return out;
}

function parseDryrunCampaign(result: any): Omit<PompCampaignInfo, "source"> | null {
  const messages = Array.isArray(result?.Messages) ? result.Messages : [];
  for (const message of messages) {
    const tags = resultTagsToRecord(message?.Tags);
    if (tags.Action !== "POMP-Campaign-Info-Response") continue;
    const parsed = safeJson(message?.Data || "");
    const campaign = parseCampaignPayload(parsed);
    if (campaign) return campaign;
  }
  return null;
}

export async function fetchPompCampaignInfo(
  assetId: string
): Promise<PompCampaignInfo | null> {
  const id = normalizeAoId(assetId);
  if (!id) return null;

  for (const cu of CU_ENDPOINTS) {
    try {
      const result = await dryrun({
        process: id,
        tags: [{ name: "Action", value: "POMP-Campaign-Info" }],
        CU_URL: cu,
      } as any);
      const parsed = parseDryrunCampaign(result);
      if (parsed) return { ...parsed, assetId: parsed.assetId || id, source: "dryrun" };
    } catch {
      // Try the next CU or gateway fallback.
    }
  }

  for (const gateway of CAMPAIGN_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}/${id}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) continue;
      const text = await response.text();
      const parsed = parseCampaignPayload(safeJson(text));
      if (parsed) return { ...parsed, assetId: parsed.assetId || id, source: "gateway" };
    } catch {
      // Try next gateway.
    }
  }

  return null;
}
