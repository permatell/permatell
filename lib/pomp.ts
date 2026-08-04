"use client";

import Arweave from "arweave";
import { connect, createDataItemSigner } from "@permaweb/aoconnect";
import Permaweb from "@permaweb/libs";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import type { Chain } from "viem";
import {
  getAOConfig,
  getHyperbeamWriteUrl,
  MAINNET_DEFAULTS,
} from "@/lib/ao-config";
import { withHyperbeamGlobalFetch } from "@/lib/hyperbeamFetch";

export const POMP_APP_NAME = "PermaTell";
export const POMP_TYPE = "POMP";
export const POAP_CONTRACT_ADDRESS =
  "0x22C1f6050E56d2876009903609a2cC3fEf83B415";

const AO_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MAX_TITLE_LENGTH = 150;

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
  eventUrl?: string;
  city?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
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

export interface PompAtomicAssetResult {
  assetId: string;
  bazarUrl: string;
  arweaveUrl: string;
}

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

function getScheduler(): string {
  const scheduler = MAINNET_DEFAULTS.scheduler.trim();
  if (!scheduler || scheduler === "REPLACE_WITH_MAINNET_SCHEDULER_ID") {
    throw new Error(
      "Set NEXT_PUBLIC_AO_MAINNET_SCHEDULER before minting POMP atomic assets."
    );
  }
  return scheduler;
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
  const config = getAOConfig();
  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  if (config.mode === "mainnet") {
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

  const ao = connect({
    MODE: "legacy",
    MU_URL: config.mu_url,
    CU_URL: config.cu_url,
    GATEWAY_URL: config.gateway,
    signer,
  } as any);

  return Permaweb.init({
    ao,
    arweave,
    gateway: "https://arweave.net",
    signer,
  });
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
    { name: "POAP-Contract", value: POAP_CONTRACT_ADDRESS },
    { name: "POAP-Network", value: network.key },
    { name: "POAP-Chain-Id", value: String(network.chainId) },
    { name: "POAP-Token-Id", value: input.claim.tokenId },
    ...(dropId ? [{ name: "POAP-Drop-Id", value: dropId }] : []),
    { name: "POAP-Owner", value: poapOwner },
    ...(artworkId ? [{ name: "POMP-Artwork", value: artworkId }] : []),
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
