"use client";

import Arweave from "arweave";
import { connect, createDataItemSigner } from "@permaweb/aoconnect";
import Permaweb from "@permaweb/libs";
import {
  getAOConfig,
  getHyperbeamUrl,
  getHyperbeamWriteUrl,
  MAINNET_DEFAULTS,
} from "@/lib/ao-config";
import { withHyperbeamGlobalFetch } from "@/lib/hyperbeamFetch";

export interface CreateStoryAtomicAssetInput {
  storyId?: string;
  title: string;
  content: string;
  creator: string;
  description?: string;
  category?: string;
  coverImage?: string;
  isPublic?: boolean;
}

export interface StoryAtomicAssetResult {
  assetId: string;
  storyId?: string;
  bazarUrl: string;
  arweaveUrl: string;
}

const APP_NAME = "PermaTell";
const MAX_TITLE_LENGTH = 150;
const AO_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const DISCOVERABILITY_TYPE = "blog-post";

function normalizeText(value: string): string {
  try {
    return value.normalize("NFC").trim();
  } catch {
    return value.trim();
  }
}

function assetTitle(value: string): string {
  const title = normalizeText(value);
  return title.length > MAX_TITLE_LENGTH
    ? title.slice(0, MAX_TITLE_LENGTH)
    : title;
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
    try {
      out[key] = JSON.stringify(value);
    } catch {
      console.warn("[permatell-assets] Skipping metadata field", key);
    }
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

function normalizeAoId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const id = trimmed.startsWith("ar://") ? trimmed.slice(5) : trimmed;
  if (AO_ID_PATTERN.test(id)) return id;

  const match = id.match(/[A-Za-z0-9_-]{43}/);
  return match?.[0] || null;
}

function uniqueTopics(topics: string[]): string[] {
  const seen = new Set<string>();
  return topics
    .map((topic) => normalizeText(topic))
    .filter((topic) => {
      const key = topic.toLowerCase();
      if (!topic || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function getScheduler(): string {
  const scheduler = MAINNET_DEFAULTS.scheduler.trim();
  if (!scheduler || scheduler === "REPLACE_WITH_MAINNET_SCHEDULER_ID") {
    throw new Error(
      "Set NEXT_PUBLIC_AO_MAINNET_SCHEDULER before minting HyperBEAM atomic assets."
    );
  }
  return scheduler;
}

function createPermawebClient() {
  const wallet = globalThis.arweaveWallet;
  if (!wallet) {
    throw new Error("Wander/ArConnect wallet is required to mint an atomic asset.");
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

export async function createStoryAtomicAsset(
  input: CreateStoryAtomicAssetInput
): Promise<StoryAtomicAssetResult> {
  const title = assetTitle(input.title);
  const category = normalizeText(input.category || "Story");
  const storyId = normalizeAoId(input.storyId);
  const description =
    normalizeText(input.description || "") ||
    `Permanent story by ${input.creator}`;

  if (!title) throw new Error("Atomic asset mint requires a title.");
  if (!normalizeText(input.content)) {
    throw new Error("Atomic asset mint requires story content.");
  }
  if (!normalizeText(input.creator)) {
    throw new Error("Atomic asset mint requires a creator address.");
  }

  const permaweb = createPermawebClient();
  if (!permaweb?.createAtomicAsset) {
    throw new Error("@permaweb/libs createAtomicAsset is unavailable.");
  }

  const metadata = sanitizeMetadata({
    appName: APP_NAME,
    assetKind: "story",
    discoverabilityType: DISCOVERABILITY_TYPE,
    storyId,
    category,
    creator: input.creator,
    coverImage: input.coverImage,
    isPublic: input.isPublic,
    hyperbeamNode: getHyperbeamUrl(),
    createdAt: new Date().toISOString(),
  });

  const tags = dedupeTags([
    { name: "App-Name", value: APP_NAME },
    { name: "Title", value: title },
    { name: "Type", value: DISCOVERABILITY_TYPE },
    { name: "PermaTell-Asset-Type", value: "story" },
    { name: "PermaTell-Category", value: category },
    ...(storyId ? [{ name: "PermaTell-Story-Id", value: storyId }] : []),
    ...(input.coverImage
      ? [{ name: "Cover-Image", value: input.coverImage }]
      : []),
  ]);

  const rawAssetId = await withHyperbeamGlobalFetch(() =>
    permaweb.createAtomicAsset(
      {
        name: title,
        description,
        topics: uniqueTopics(["Story", "PermaTell", category]),
        creator: input.creator,
        data: input.content,
        contentType: "text/markdown",
        assetType: DISCOVERABILITY_TYPE,
        supply: 1,
        denomination: 1,
        transferable: true,
        metadata,
        tags,
      },
      (status: string) => {
        console.log("[permatell-assets]", status);
      }
    )
  );
  const assetId = normalizeAoId(rawAssetId);

  if (!assetId) {
    throw new Error("Atomic asset mint did not return a valid AO process id.");
  }

  return {
    assetId,
    ...(storyId ? { storyId } : {}),
    bazarUrl: `https://bazar.arweave.net/#/asset/${assetId}`,
    arweaveUrl: `https://arweave.net/${assetId}`,
  };
}
