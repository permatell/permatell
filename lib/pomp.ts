"use client";

import Arweave from "arweave";
import { connect, createDataItemSigner } from "@permaweb/aoconnect";
import Permaweb from "@permaweb/libs";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import type { Chain } from "viem";
import {
  getHyperbeamWriteUrl,
  MAINNET_DEFAULTS,
} from "@/lib/ao-config";
import { withHyperbeamGlobalFetch } from "@/lib/hyperbeamFetch";
import { getArweaveUrl, uploadToArweave } from "@/lib/arweave";
import { POMP_CAMPAIGN_LUA } from "@/lib/pompCampaignLua";

export const POMP_APP_NAME = "PermaTell";
export const POMP_TYPE = "POMP";
export const POAP_CONTRACT_ADDRESS =
  "0x22C1f6050E56d2876009903609a2cC3fEf83B415";

const AO_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_TITLE_LENGTH = 150;
const FREE_BUNDLE_TARGET_BYTES = 100 * 1024;
const COMPRESSED_ARTWORK_TARGET_BYTES = 96 * 1024;

const poapAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenEvent",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type PoapNetworkKey =
  | "ethereum"
  | "gnosis"
  | "base"
  | "arbitrum"
  | "polygon"
  | "linea"
  | "celo";

export interface PoapNetworkConfig {
  key: PoapNetworkKey;
  label: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl: string;
}

export const POAP_NETWORKS: Record<PoapNetworkKey, PoapNetworkConfig> = {
  ethereum: {
    key: "ethereum",
    label: "Ethereum",
    chainId: 1,
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    explorerUrl: "https://etherscan.io",
  },
  gnosis: {
    key: "gnosis",
    label: "Gnosis",
    chainId: 100,
    rpcUrl: "https://rpc.gnosischain.com",
    explorerUrl: "https://gnosisscan.io",
  },
  base: {
    key: "base",
    label: "Base",
    chainId: 8453,
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
  },
  arbitrum: {
    key: "arbitrum",
    label: "Arbitrum",
    chainId: 42161,
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    explorerUrl: "https://arbiscan.io",
  },
  polygon: {
    key: "polygon",
    label: "Polygon",
    chainId: 137,
    rpcUrl: "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
  },
  linea: {
    key: "linea",
    label: "Linea",
    chainId: 59144,
    rpcUrl: "https://rpc.linea.build",
    explorerUrl: "https://lineascan.build",
  },
  celo: {
    key: "celo",
    label: "Celo",
    chainId: 42220,
    rpcUrl: "https://forno.celo.org",
    explorerUrl: "https://celoscan.io",
  },
};

export const POAP_NETWORK_OPTIONS = Object.values(POAP_NETWORKS);

export interface PoapOwnershipInput {
  network: PoapNetworkKey;
  tokenId: string;
  ownerAddress: string;
}

export interface PoapOwnershipResult {
  owns: boolean;
  owner: string;
  expectedOwner: string;
  dropId?: string;
  network: PoapNetworkConfig;
  tokenUrl: string;
}

export interface PompDropInput {
  title: string;
  description: string;
  artworkId?: string;
  sourceArtworkUrl?: string;
  eventUrl?: string;
  city?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
}

export interface PompCampaignRules {
  enabled?: boolean;
  claimMethod: "secret-word";
  claimWord?: string;
  claimCodeHash?: string;
  claimStart?: string;
  claimEnd?: string;
  maxClaims: number;
}

export interface PompPoapClaimInput {
  network: PoapNetworkKey;
  tokenId: string;
  dropId?: string;
  ownerAddress: string;
  archiveSnapshot?: string;
}

export interface CreatePompAtomicAssetInput {
  drop: PompDropInput;
  claim: PompPoapClaimInput;
  creator: string;
}

export interface CreateNativePompAtomicAssetInput {
  drop: PompDropInput;
  creator: string;
  campaign?: PompCampaignRules;
}

export interface PompAtomicAssetResult {
  assetId: string;
  artworkUpload?: UploadResult;
  bazarUrl: string;
  arweaveUrl: string;
  claimUrl?: string;
  campaign?: {
    enabled: boolean;
    maxClaims: number;
    claimMethod: string;
    claimStart: string;
    claimEnd: string;
  };
}

export interface PompCampaignClaimResult {
  messageId: string;
  assetId: string;
  bazarUrl: string;
  arweaveUrl: string;
  accepted: boolean;
  status: string;
  responseAction: string;
  message: string;
  remaining?: number;
  claimedAt?: string;
  recipient?: string;
}

export interface PompCampaignInfo {
  assetId: string;
  config: Record<string, any>;
  claims: Record<
    string,
    {
      Timestamp?: string;
      WalletAddress?: string;
      Recipient?: string;
      AssetId?: string;
      ClaimIndex?: number;
    }
  >;
  claimed: number;
  remaining: number;
  ownerBalance: string;
  source: "dryrun" | "gateway";
}

export interface UploadResult {
  id: string;
  url: string;
}

export interface PompClaimedAsset {
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
  assetType?: "poap-claim" | "native-event" | string;
  sourceProtocol?: "POAP" | "POMP" | string;
  source: "arweave" | "browser";
}

export interface PompAssetDetail extends PompClaimedAsset {
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

export interface OwnedPoap {
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

const POMP_GRAPHQL_ENDPOINTS = [
  process.env.NEXT_PUBLIC_AO_GQL_URL ||
    "https://ao-search-gateway.goldsky.com/graphql",
  "https://arweave.net/graphql",
] as const;

function normalizeText(value: string | undefined | null): string {
  try {
    return String(value || "").normalize("NFC").trim();
  } catch {
    return String(value || "").trim();
  }
}

function shortTitle(value: string): string {
  const title = normalizeText(value);
  return title.length > MAX_TITLE_LENGTH
    ? title.slice(0, MAX_TITLE_LENGTH)
    : title;
}

function normalizeAoId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const id = trimmed.startsWith("ar://") ? trimmed.slice(5) : trimmed;
  if (AO_ID_PATTERN.test(id)) return id;
  const match = id.match(/[A-Za-z0-9_-]{43}/);
  return match?.[0] || null;
}

function sanitizeMetadata(
  metadata: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) out[key] = trimmed;
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      out[key] = String(value);
      continue;
    }
    out[key] = JSON.stringify(value);
  }
  return out;
}

function dedupeTags(
  tags: { name: string; value: string }[]
): { name: string; value: string }[] {
  const seen = new Set<string>();
  const out: { name: string; value: string }[] = [];
  for (const tag of tags) {
    const name = tag.name.trim();
    const value = tag.value.trim();
    if (!name || !value || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, value });
  }
  return out;
}

function getTagValue(
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

function getScheduler(): string {
  const scheduler = MAINNET_DEFAULTS.scheduler.trim();
  if (!scheduler || scheduler === "REPLACE_WITH_MAINNET_SCHEDULER_ID") {
    throw new Error(
      "Set NEXT_PUBLIC_AO_MAINNET_SCHEDULER before minting POMP atomic assets."
    );
  }
  return scheduler;
}

function getWallet(): any {
  const wallet = globalThis.arweaveWallet;
  if (!wallet) {
    throw new Error("Wander/ArConnect wallet is required for POMP actions.");
  }
  return wallet;
}

function createPompAoClient() {
  const wallet = getWallet();
  const signer = createDataItemSigner(wallet);
  const scheduler = getScheduler();
  const nodeUrl = getHyperbeamWriteUrl();
  const ao = connect({
    MODE: "mainnet",
    URL: nodeUrl,
    SCHEDULER: scheduler,
    signer,
  } as any);
  return { ao, signer, scheduler, nodeUrl };
}

function dateToUnixSeconds(value?: string): string {
  const textValue = normalizeText(value);
  if (!textValue) return "0";
  const date = new Date(textValue);
  if (Number.isNaN(date.getTime())) return "0";
  return String(Math.floor(date.getTime() / 1000));
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPompClaimWord(
  assetId: string,
  claimWord: string
): Promise<string> {
  const word = normalizeText(claimWord).toLowerCase();
  if (!word) throw new Error("Claim word is required.");
  return sha256Hex(`pomp:${normalizeText(assetId)}:${word}`);
}

async function resolveCampaignCodeHash(
  assetId: string,
  campaign: PompCampaignRules
): Promise<string> {
  if (campaign.claimCodeHash) return normalizeText(campaign.claimCodeHash);
  if (campaign.claimWord) return hashPompClaimWord(assetId, campaign.claimWord);
  throw new Error("POMP campaign requires a secret claim word.");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function parseJsonObject(value: unknown): Record<string, any> {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parsePompClaimResult(
  result: any
): Pick<
  PompCampaignClaimResult,
  "accepted" | "status" | "responseAction" | "message" | "remaining" | "claimedAt" | "recipient"
> | null {
  const messages = Array.isArray(result?.Messages) ? result.Messages : [];
  for (const message of messages) {
    const tags = resultTagsToRecord(message?.Tags);
    const action = tags.Action || message?.Action || "";
    if (!String(action).startsWith("POMP-Claim-")) continue;

    const data = parseJsonObject(message?.Data);
    const status = tags.Status || data.status || "";
    const accepted = action === "POMP-Claim-Success" || status === "Claimed";
    return {
      accepted,
      status: status || (accepted ? "Claimed" : "Error"),
      responseAction: action,
      message:
        data.message ||
        data.error ||
        (accepted ? "POMP claimed." : "POMP claim was rejected."),
      remaining:
        typeof data.remaining === "number"
          ? data.remaining
          : data.remaining
          ? Number(data.remaining)
          : undefined,
      claimedAt: data.claimedAt ? String(data.claimedAt) : undefined,
      recipient: data.recipient || tags.Recipient,
    };
  }
  return null;
}

async function readPompCampaignClaimResult(input: {
  ao: any;
  process: string;
  messageId: string;
}) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const result = await withHyperbeamGlobalFetch(() =>
        input.ao.result({
          process: input.process,
          message: input.messageId,
        })
      );
      const parsed = parsePompClaimResult(result);
      if (parsed) return parsed;
    } catch (error) {
      lastError = error;
    }
    await sleep(1200 + attempt * 400);
  }

  if (lastError) {
    console.warn("[pomp] Unable to read claim result before timeout.", lastError);
  }
  return null;
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

function createPompPermawebClient() {
  const wallet = globalThis.arweaveWallet;
  if (!wallet) {
    throw new Error("Wander/ArConnect wallet is required to mint a POMP.");
  }

  const signer = createDataItemSigner(wallet);
  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  const scheduler = getScheduler();
  const ao = connect({
    MODE: "mainnet",
    URL: getHyperbeamWriteUrl(),
    SCHEDULER: scheduler,
    signer,
  } as any);

  return Permaweb.init({
    ao,
    arweave,
    gateway: "https://arweave.net",
    node: {
      url: getHyperbeamWriteUrl(),
      scheduler,
      authority: MAINNET_DEFAULTS.authority,
    },
    signer,
  });
}

function contentTypeExtension(contentType: string): string {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  return "webp";
}

function blobFromCanvas(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Unable to compress POAP artwork."));
      },
      type,
      quality
    );
  });
}

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to read POAP artwork image."));
      img.src = imageUrl;
    });
    return createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function compressArtworkForBundling(file: File): Promise<File> {
  if (file.size <= FREE_BUNDLE_TARGET_BYTES) return file;
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file;
  }

  const image = await loadImageBitmap(file);
  try {
    const largestSide = Math.max(image.width, image.height);
    const dimensionCaps = [768, 640, 512, 448, 384, 320];
    const qualities = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38];
    let best: Blob | null = null;

    for (const cap of dimensionCaps) {
      const scale = Math.min(1, cap / largestSide);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Unable to prepare POAP artwork compression.");
      context.drawImage(image, 0, 0, width, height);

      for (const quality of qualities) {
        const blob = await blobFromCanvas(canvas, "image/webp", quality);
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= COMPRESSED_ARTWORK_TARGET_BYTES) {
          return new File(
            [blob],
            file.name.replace(/\.[^.]+$/, "") + ".webp",
            { type: "image/webp" }
          );
        }
      }
    }

    if (best && best.size < file.size) {
      return new File([best], file.name.replace(/\.[^.]+$/, "") + ".webp", {
        type: "image/webp",
      });
    }
    return file;
  } finally {
    image.close();
  }
}

export async function fetchOwnedPoaps(address: string): Promise<OwnedPoap[]> {
  if (!isAddress(address)) {
    throw new Error("Connect or enter a valid EVM wallet address.");
  }

  const response = await fetch(
    `/api/poap/collector?address=${encodeURIComponent(getAddress(address))}`,
    { cache: "no-store" }
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to fetch POAP collection.");
  }
  return Array.isArray(json?.poaps) ? json.poaps : [];
}

export async function fetchPompAssetsByOwner(
  ownerAddress: string
): Promise<PompClaimedAsset[]> {
  const owner = normalizeText(ownerAddress);
  if (!owner) return [];

  const response = await fetch(
    `/api/pomp/discover?owner=${encodeURIComponent(owner)}&limit=50`,
    { cache: "no-store" }
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to load POMPs from Arweave.");
  }
  return Array.isArray(json?.pomps) ? json.pomps : [];
}

export async function fetchPompCampaignsByCreator(
  creatorAddress: string
): Promise<PompClaimedAsset[]> {
  const creator = normalizeText(creatorAddress);
  if (!creator) return [];

  const response = await fetch(
    `/api/pomp/discover?creator=${encodeURIComponent(
      creator
    )}&assetType=native-event&limit=50`,
    { cache: "no-store" }
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to load created POMP campaigns.");
  }
  return Array.isArray(json?.pomps) ? json.pomps : [];
}

function pompAssetFromGraphqlEdge(
  edge: any,
  fallbackOwner = ""
): PompClaimedAsset | null {
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

export async function fetchDiscoverPomps(
  limit = 24
): Promise<PompClaimedAsset[]> {
  const response = await fetch(`/api/pomp/discover?limit=${limit}`, {
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to discover POMPs from Arweave.");
  }
  return Array.isArray(json?.pomps) ? json.pomps : [];
}

export async function fetchPompCampaignInfo(
  assetId: string
): Promise<PompCampaignInfo> {
  const id = normalizeAoId(assetId);
  if (!id) throw new Error("A valid POMP asset id is required.");
  const response = await fetch(`/api/pomp/campaign/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to load POMP campaign details.");
  }
  return json;
}

export async function fetchPompAssetDetail(
  assetId: string
): Promise<PompAssetDetail> {
  const id = normalizeAoId(assetId);
  if (!id) throw new Error("A valid POMP asset id is required.");
  const response = await fetch(`/api/pomp/asset/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to load POMP asset details.");
  }
  return json;
}

export async function fetchExistingPoapPompClaim(input: {
  network: PoapNetworkKey;
  tokenId: string;
}): Promise<PompClaimedAsset | null> {
  const tokenId = normalizeText(input.tokenId);
  if (!/^\d+$/.test(tokenId)) {
    throw new Error("POAP token id must be a numeric string.");
  }
  const response = await fetch(
    `/api/pomp/poap-claim?network=${encodeURIComponent(
      input.network
    )}&tokenId=${encodeURIComponent(tokenId)}`,
    { cache: "no-store" }
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json?.error || "Unable to check existing POAP POMP claim.");
  }
  return json?.pomp || null;
}

export async function mirrorPoapArtworkToArweave(
  poap: Pick<OwnedPoap, "imageUrl" | "title" | "tokenId" | "dropId">
): Promise<UploadResult> {
  if (!poap.imageUrl) {
    throw new Error("Selected POAP does not include artwork.");
  }

  const response = await fetch(
    `/api/poap/artwork?url=${encodeURIComponent(poap.imageUrl)}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    const json = await response.json().catch(() => ({}));
    throw new Error(json?.error || "Unable to download POAP artwork.");
  }

  const contentType = response.headers.get("content-type") || "image/webp";
  const bytes = await response.arrayBuffer();
  const extension = contentTypeExtension(contentType);
  const file = new File(
    [bytes],
    `poap-${poap.dropId || "drop"}-${poap.tokenId || "token"}.${extension}`,
    { type: contentType }
  );
  const uploadFile = await compressArtworkForBundling(file);

  const id = await uploadToArweave(uploadFile, [
      { name: "Type", value: "POMP-Artwork" },
      { name: "POMP-Source", value: "POAP" },
      { name: "POAP-Token-Id", value: poap.tokenId },
      ...(poap.dropId ? [{ name: "POAP-Drop-Id", value: poap.dropId }] : []),
      { name: "Title", value: poap.title || "POAP Artwork" },
      { name: "POMP-Original-Artwork-Bytes", value: String(file.size) },
      { name: "POMP-Uploaded-Artwork-Bytes", value: String(uploadFile.size) },
      ...(uploadFile.type !== file.type
        ? [{ name: "POMP-Artwork-Transcoded", value: "true" }]
        : []),
    ]);

  return {
    id,
    url: getArweaveUrl(id),
  };
}

export async function uploadPompArtworkToArweave(
  file: File,
  title: string
): Promise<UploadResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("POMP artwork must be an image file.");
  }

  const uploadFile = await compressArtworkForBundling(file);
  const id = await uploadToArweave(uploadFile, [
    { name: "Type", value: "POMP-Artwork" },
    { name: "POMP-Source", value: "POMP" },
    { name: "Title", value: title || "POMP Artwork" },
    { name: "POMP-Original-Artwork-Bytes", value: String(file.size) },
    { name: "POMP-Uploaded-Artwork-Bytes", value: String(uploadFile.size) },
    ...(uploadFile.type !== file.type
      ? [{ name: "POMP-Artwork-Transcoded", value: "true" }]
      : []),
  ]);

  return {
    id,
    url: getArweaveUrl(id),
  };
}

export async function verifyPoapOwnership(
  input: PoapOwnershipInput
): Promise<PoapOwnershipResult> {
  const network = POAP_NETWORKS[input.network];
  if (!network) throw new Error("Unsupported POAP network.");
  if (!input.tokenId || !/^\d+$/.test(input.tokenId.trim())) {
    throw new Error("POAP token id must be a numeric string.");
  }
  if (!isAddress(input.ownerAddress)) {
    throw new Error("Owner address must be a valid EVM address.");
  }

  const client = createPublicClient({
    chain: poapChain(network),
    transport: http(network.rpcUrl),
  });
  const tokenId = BigInt(input.tokenId);
  const owner = await client.readContract({
    address: POAP_CONTRACT_ADDRESS,
    abi: poapAbi,
    functionName: "ownerOf",
    args: [tokenId],
  });
  let dropId: string | undefined;
  try {
    const eventId = await client.readContract({
      address: POAP_CONTRACT_ADDRESS,
      abi: poapAbi,
      functionName: "tokenEvent",
      args: [tokenId],
    });
    dropId = eventId.toString();
  } catch {
    dropId = undefined;
  }

  const expectedOwner = getAddress(input.ownerAddress);
  return {
    owns: owner.toLowerCase() === expectedOwner.toLowerCase(),
    owner,
    expectedOwner,
    dropId,
    network,
    tokenUrl: `${network.explorerUrl}/token/${POAP_CONTRACT_ADDRESS}?a=${input.tokenId}`,
  };
}

export async function createPompAtomicAsset(
  input: CreatePompAtomicAssetInput
): Promise<PompAtomicAssetResult> {
  const title = shortTitle(input.drop.title);
  const description =
    normalizeText(input.drop.description) ||
    `Permanent proof of memory for POAP ${input.claim.tokenId}`;
  const network = POAP_NETWORKS[input.claim.network];
  const poapOwner = isAddress(input.claim.ownerAddress)
    ? getAddress(input.claim.ownerAddress)
    : "";
  const artworkId = normalizeAoId(input.drop.artworkId);
  const dropId = normalizeText(input.claim.dropId);

  if (!title) throw new Error("POMP mint requires a title.");
  if (!network) throw new Error("POMP mint requires a supported POAP network.");
  if (!poapOwner) throw new Error("POMP mint requires a valid POAP owner.");
  if (!/^\d+$/.test(input.claim.tokenId.trim())) {
    throw new Error("POMP mint requires a numeric POAP token id.");
  }
  if (!normalizeText(input.creator)) {
    throw new Error("POMP mint requires a connected Arweave creator address.");
  }

  const permaweb = createPompPermawebClient();
  if (!permaweb?.createAtomicAsset) {
    throw new Error("@permaweb/libs createAtomicAsset is unavailable.");
  }

  const data = JSON.stringify(
    {
      protocol: POMP_TYPE,
      title,
      description,
    drop: {
        ...input.drop,
        artworkId: artworkId || input.drop.artworkId || "",
        sourceArtworkUrl: input.drop.sourceArtworkUrl || "",
      },
      source: {
        protocol: "POAP",
        contract: POAP_CONTRACT_ADDRESS,
        network: network.key,
        chainId: network.chainId,
        tokenId: input.claim.tokenId,
        dropId,
        ownerAddress: poapOwner,
        archiveSnapshot: input.claim.archiveSnapshot || "poaparchive.com",
      },
      createdAt: new Date().toISOString(),
    },
    null,
    2
  );

  const metadata = sanitizeMetadata({
    appName: POMP_APP_NAME,
    assetKind: POMP_TYPE,
    discoverabilityType: POMP_TYPE,
    poapContract: POAP_CONTRACT_ADDRESS,
    poapNetwork: network.key,
    poapChainId: network.chainId,
    poapTokenId: input.claim.tokenId,
    poapDropId: dropId,
    poapOwner,
    archiveSnapshot: input.claim.archiveSnapshot || "poaparchive.com",
    artworkId,
    sourceArtworkUrl: input.drop.sourceArtworkUrl,
    eventUrl: input.drop.eventUrl,
    city: input.drop.city,
    country: input.drop.country,
    startDate: input.drop.startDate,
    endDate: input.drop.endDate,
    creator: input.creator,
    createdAt: new Date().toISOString(),
  });

  const tags = dedupeTags([
    { name: "App-Name", value: POMP_APP_NAME },
    { name: "Title", value: title },
    { name: "Type", value: POMP_TYPE },
    { name: "POMP-Version", value: "0.1" },
    { name: "POMP-Asset-Type", value: "poap-claim" },
    { name: "POMP-Claim-Mode", value: "poap-owner-verified" },
    { name: "POMP-Source", value: "POAP" },
    { name: "Creator", value: input.creator },
    { name: "POAP-Contract", value: POAP_CONTRACT_ADDRESS },
    { name: "POAP-Network", value: network.key },
    { name: "POAP-Chain-Id", value: String(network.chainId) },
    { name: "POAP-Token-Id", value: input.claim.tokenId },
    ...(dropId ? [{ name: "POAP-Drop-Id", value: dropId }] : []),
    { name: "POAP-Owner", value: poapOwner },
    ...(artworkId ? [{ name: "POMP-Artwork", value: artworkId }] : []),
    ...(input.drop.sourceArtworkUrl
      ? [{ name: "POAP-Artwork-Source", value: input.drop.sourceArtworkUrl }]
      : []),
  ]);

  const rawAssetId = await withHyperbeamGlobalFetch(() =>
    permaweb.createAtomicAsset(
      {
        name: title,
        description,
        topics: ["POMP", "POAP", "PermaTell", network.label],
        creator: input.creator,
        data,
        contentType: "application/json",
        assetType: POMP_TYPE,
        supply: 1,
        denomination: 1,
        transferable: true,
        metadata,
        tags,
      },
      (status: string) => {
        console.log("[pomp-assets]", status);
      }
    )
  );
  const assetId = normalizeAoId(rawAssetId);
  if (!assetId) {
    throw new Error("POMP mint did not return a valid AO process id.");
  }

  return {
    assetId,
    bazarUrl: `https://bazar.arweave.net/#/asset/${assetId}`,
    arweaveUrl: `https://arweave.net/${assetId}`,
  };
}

async function installPompCampaignAddon(input: {
  assetId: string;
  creator: string;
  title: string;
  description: string;
  drop: PompDropInput;
  campaign: PompCampaignRules;
  artworkId: string;
}) {
  const { ao, signer } = createPompAoClient();
  const claimCodeHash = await resolveCampaignCodeHash(
    input.assetId,
    input.campaign
  );
  const maxClaims = Math.max(1, Math.floor(input.campaign.maxClaims || 1));

  await withHyperbeamGlobalFetch(() =>
    ao.message({
      process: input.assetId,
      signer,
      tags: [
        { name: "Data-Protocol", value: "ao" },
        { name: "Action", value: "Eval" },
        { name: "Message-Timestamp", value: Date.now().toString() },
      ],
      data: POMP_CAMPAIGN_LUA,
    })
  );

  await withHyperbeamGlobalFetch(() =>
    ao.message({
      process: input.assetId,
      signer,
      tags: dedupeTags([
        { name: "Action", value: "Setup-POMP-Campaign" },
        { name: "Title", value: input.title },
        { name: "Description", value: input.description },
        { name: "Creator", value: input.creator },
        { name: "POMP-Claim-Method", value: input.campaign.claimMethod },
        { name: "POMP-Claim-Code-Hash", value: claimCodeHash },
        { name: "POMP-Claim-Start", value: dateToUnixSeconds(input.campaign.claimStart) },
        { name: "POMP-Claim-End", value: dateToUnixSeconds(input.campaign.claimEnd) },
        { name: "POMP-Max-Claims", value: String(maxClaims) },
        ...(input.artworkId
          ? [{ name: "POMP-Artwork", value: input.artworkId }]
          : []),
        ...(input.drop.city
          ? [{ name: "Event-City", value: input.drop.city }]
          : []),
        ...(input.drop.country
          ? [{ name: "Event-Country", value: input.drop.country }]
          : []),
        ...(input.drop.startDate
          ? [{ name: "Event-Start-Date", value: input.drop.startDate }]
          : []),
        ...(input.drop.endDate
          ? [{ name: "Event-End-Date", value: input.drop.endDate }]
          : []),
        ...(input.drop.eventUrl
          ? [{ name: "Event-URL", value: input.drop.eventUrl }]
          : []),
        { name: "Message-Timestamp", value: Date.now().toString() },
      ]),
    })
  );

  return {
    enabled: true,
    maxClaims,
    claimMethod: input.campaign.claimMethod,
    claimStart: dateToUnixSeconds(input.campaign.claimStart),
    claimEnd: dateToUnixSeconds(input.campaign.claimEnd),
  };
}

export async function createNativePompAtomicAsset(
  input: CreateNativePompAtomicAssetInput
): Promise<PompAtomicAssetResult> {
  const title = shortTitle(input.drop.title);
  const description =
    normalizeText(input.drop.description) || `Permanent proof of memory`;
  const artworkId = normalizeAoId(input.drop.artworkId);

  if (!title) throw new Error("POMP event requires a title.");
  if (!normalizeText(input.creator)) {
    throw new Error("POMP event requires a connected Arweave creator address.");
  }
  const campaignEnabled = Boolean(input.campaign?.enabled);
  const maxClaims = campaignEnabled
    ? Math.max(1, Math.floor(input.campaign?.maxClaims || 1))
    : 1;

  const permaweb = createPompPermawebClient();
  if (!permaweb?.createAtomicAsset) {
    throw new Error("@permaweb/libs createAtomicAsset is unavailable.");
  }

  const data = JSON.stringify(
    {
      protocol: POMP_TYPE,
      title,
      description,
      drop: {
        ...input.drop,
        artworkId: artworkId || input.drop.artworkId || "",
      },
      source: {
        protocol: "POMP",
        mode: "native-event",
        creator: input.creator,
      },
      createdAt: new Date().toISOString(),
    },
    null,
    2
  );

  const metadata = sanitizeMetadata({
    appName: POMP_APP_NAME,
    assetKind: POMP_TYPE,
    discoverabilityType: POMP_TYPE,
    pompAssetType: "native-event",
    pompCampaignEnabled: campaignEnabled,
    pompMaxClaims: maxClaims,
    pompClaimMethod: campaignEnabled ? input.campaign?.claimMethod : undefined,
    artworkId,
    eventUrl: input.drop.eventUrl,
    city: input.drop.city,
    country: input.drop.country,
    startDate: input.drop.startDate,
    endDate: input.drop.endDate,
    creator: input.creator,
    createdAt: new Date().toISOString(),
  });

  const tags = dedupeTags([
    { name: "App-Name", value: POMP_APP_NAME },
    { name: "Title", value: title },
    { name: "Type", value: POMP_TYPE },
    { name: "POMP-Version", value: "0.1" },
    { name: "POMP-Asset-Type", value: "native-event" },
    {
      name: "POMP-Claim-Mode",
      value: campaignEnabled ? "secret-word-campaign" : "creator-minted",
    },
    { name: "POMP-Source", value: "POMP" },
    { name: "Creator", value: input.creator },
    { name: "POMP-Campaign-Enabled", value: campaignEnabled ? "true" : "false" },
    { name: "POMP-Max-Claims", value: String(maxClaims) },
    ...(campaignEnabled && input.campaign
      ? [
          { name: "POMP-Claim-Method", value: input.campaign.claimMethod },
          { name: "POMP-Claim-Start", value: dateToUnixSeconds(input.campaign.claimStart) },
          { name: "POMP-Claim-End", value: dateToUnixSeconds(input.campaign.claimEnd) },
        ]
      : []),
    ...(input.drop.city ? [{ name: "Event-City", value: input.drop.city }] : []),
    ...(input.drop.country
      ? [{ name: "Event-Country", value: input.drop.country }]
      : []),
    ...(input.drop.startDate
      ? [{ name: "Event-Start-Date", value: input.drop.startDate }]
      : []),
    ...(input.drop.endDate
      ? [{ name: "Event-End-Date", value: input.drop.endDate }]
      : []),
    ...(input.drop.eventUrl
      ? [{ name: "Event-URL", value: input.drop.eventUrl }]
      : []),
    ...(artworkId ? [{ name: "POMP-Artwork", value: artworkId }] : []),
  ]);

  const rawAssetId = await withHyperbeamGlobalFetch(() =>
    permaweb.createAtomicAsset(
      {
        name: title,
        description,
        topics: ["POMP", "PermaTell", "Event"],
        creator: input.creator,
        data,
        contentType: "application/json",
        assetType: POMP_TYPE,
        supply: maxClaims,
        denomination: 1,
        transferable: true,
        metadata,
        tags,
      },
      (status: string) => {
        console.log("[pomp-assets]", status);
      }
    )
  );
  const assetId = normalizeAoId(rawAssetId);
  if (!assetId) {
    throw new Error("POMP event mint did not return a valid AO process id.");
  }

  const campaign =
    campaignEnabled && input.campaign
      ? await installPompCampaignAddon({
          assetId,
          creator: input.creator,
          title,
          description,
          drop: input.drop,
          campaign: input.campaign,
          artworkId: artworkId || "",
        })
      : undefined;

  return {
    assetId,
    bazarUrl: `https://bazar.arweave.net/#/asset/${assetId}`,
    arweaveUrl: `https://arweave.net/${assetId}`,
    claimUrl: campaign ? `/pomp/claim/${assetId}` : undefined,
    campaign,
  };
}

export async function claimPompCampaign(input: {
  assetId: string;
  claimWord: string;
  claimant: string;
}): Promise<PompCampaignClaimResult> {
  const assetId = normalizeAoId(input.assetId);
  if (!assetId) throw new Error("A valid POMP asset id is required.");
  const claimant = normalizeAoId(input.claimant);
  if (!claimant) throw new Error("Connect a valid Arweave wallet to claim.");
  const claimCodeHash = await hashPompClaimWord(assetId, input.claimWord);
  const { ao, signer } = createPompAoClient();

  const messageId = String(
    await withHyperbeamGlobalFetch(() =>
      ao.message({
        process: assetId,
        signer,
        tags: [
          { name: "Action", value: "Claim" },
          { name: "Wallet-Address", value: claimant },
          { name: "Recipient", value: claimant },
          { name: "POMP-Claim-Code-Hash", value: claimCodeHash },
          { name: "Message-Timestamp", value: Date.now().toString() },
        ],
      })
    )
  );
  const claimResult = await readPompCampaignClaimResult({
    ao,
    process: assetId,
    messageId,
  });

  if (claimResult && !claimResult.accepted) {
    throw new Error(claimResult.message || "POMP claim was rejected.");
  }

  return {
    messageId,
    assetId,
    bazarUrl: `https://bazar.arweave.net/#/asset/${assetId}`,
    arweaveUrl: `https://arweave.net/${assetId}`,
    accepted: claimResult?.accepted ?? true,
    status: claimResult?.status || "Submitted",
    responseAction: claimResult?.responseAction || "Pending-Result",
    message:
      claimResult?.message ||
      "Claim message submitted. AO result is still indexing.",
    remaining: claimResult?.remaining,
    claimedAt: claimResult?.claimedAt,
    recipient: claimResult?.recipient,
  };
}
