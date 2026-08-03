"use client";

import "@/lib/buffer-base64url";
import Arweave from "arweave";
import { connect } from "@permaweb/aoconnect";
import Permaweb from "@permaweb/libs";
import {
  getHyperbeamWriteUrl,
  MAINNET_DEFAULTS,
} from "@/lib/ao-config";

type ProfileOption = {
  id: string;
  timestamp?: number;
  scheduler?: string | null;
  tags?: Array<{ name?: string; value?: string }>;
};

const GRAPHQL_ENDPOINT =
  process.env.NEXT_PUBLIC_AO_GQL_URL ||
  "https://ao-search-gateway.goldsky.com/graphql";
const PROFILE_READ_NODES = [
  getHyperbeamWriteUrl(),
  "https://app-1.forward.computer",
];
const PROFILE_CACHE = new Map<string, { at: number; data: any | null }>();
const PROFILE_CACHE_TTL_MS = 30_000;

let permawebReader: any | null = null;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getTagValue(
  tags: Array<{ name?: string; value?: string }> | undefined,
  names: string[]
): string | null {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const tag of tags || []) {
    const name = clean(tag?.name).toLowerCase();
    const value = clean(tag?.value);
    if (wanted.has(name) && value) return value;
  }
  return null;
}

function pickString(source: any, keys: string[]): string | null {
  for (const key of keys) {
    const value = clean(source?.[key]);
    if (value) return value;
  }
  return null;
}

function pickAny(source: any, keys: string[]): unknown {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) return value;
  }
  return null;
}

function arweaveUrl(value: unknown): string | null {
  if (value && typeof value === "object") {
    return arweaveUrl(pickAny(value, ["url", "src", "href", "txId", "id"]));
  }
  const raw = clean(value);
  if (!raw || raw === "None") return null;
  if (raw.startsWith("data:")) return raw;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    const match = raw.match(/\/([A-Za-z0-9_-]{43})(?:$|[?#/])/);
    if (
      match?.[1] &&
      /:\/\/(?:[^/]+\.)?(?:arweave\.net|arweave\.dev|g8way\.io|ar-io\.dev|permagate\.io|turbo-gateway\.com|akrd\.net|ardrive\.net)\//i.test(
        raw
      )
    ) {
      return `https://arweave.net/${match[1]}`;
    }
    return raw;
  }
  const id = raw.startsWith("ar://") ? raw.slice(5) : raw;
  return id ? `https://arweave.net/${id}` : null;
}

function parseJsonObject(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace <= 0) return null;
    try {
      return JSON.parse(text.slice(0, lastBrace + 1));
    } catch {
      return null;
    }
  }
}

async function fetchHyperbeamJsonStream(
  url: string,
  timeoutMs = 5_000
): Promise<any | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const decoder = new TextDecoder();
  let text = "";
  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "accept-bundle": "true",
        "require-codec": "application/json",
      },
      signal: controller.signal,
    });
    const reader = response.body?.getReader();
    if (!reader) {
      text = await response.text();
      return parseJsonObject(text);
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return parseJsonObject(text);
  } catch {
    return parseJsonObject(text);
  } finally {
    window.clearTimeout(timer);
  }
}

function linkedId(value: unknown): string | null {
  const id = clean(value);
  return /^[A-Za-z0-9_-]{43}$/.test(id) ? id : null;
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(`${label} timed out`)),
      timeoutMs
    );
    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

function getReader() {
  if (permawebReader) return permawebReader;
  const scheduler = clean(MAINNET_DEFAULTS.scheduler);
  const nodeUrl = getHyperbeamWriteUrl();
  const ao = connect({
    MODE: "mainnet",
    URL: nodeUrl,
    SCHEDULER: scheduler,
    GATEWAY_URL: "https://arweave.net",
  } as any);

  permawebReader = Permaweb.init({
    ao,
    arweave: Arweave.init({}),
    gateway: "https://arweave.net",
    node: {
      url: nodeUrl,
      scheduler,
      authority: MAINNET_DEFAULTS.authority || undefined,
    },
  });
  return permawebReader;
}

function normalizeProfile(raw: any, walletAddress: string): any | null {
  if (!raw?.id) return null;
  const store =
    raw?.store && typeof raw.store === "object"
      ? raw.store
      : raw?.Store && typeof raw.Store === "object"
        ? raw.Store
        : null;
  const merged = store ? { ...raw, ...store } : raw;
  const wallet =
    pickString(merged, ["walletAddress", "WalletAddress", "owner", "Owner"]) ||
    walletAddress;

  return {
    ...merged,
    id: clean(merged.id),
    wallet_address: wallet,
    walletAddress: wallet,
    userName: pickString(merged, [
      "userName",
      "username",
      "Username",
      "handle",
      "Handle",
    ]),
    displayName: pickString(merged, [
      "displayName",
      "DisplayName",
      "Display-Name",
      "name",
      "Name",
    ]),
    description: pickString(merged, [
      "description",
      "Description",
      "bio",
      "Bio",
    ]),
    thumbnail: arweaveUrl(
      pickAny(merged, [
        "thumbnail",
        "Thumbnail",
        "avatar",
        "Avatar",
        "image",
        "Image",
        "profileImage",
        "ProfileImage",
      ])
    ),
    banner: arweaveUrl(
      pickAny(merged, [
        "banner",
        "Banner",
        "cover",
        "Cover",
        "coverImage",
        "CoverImage",
      ])
    ),
    assets: merged.assets || merged.Assets || [],
  };
}

function profileFromHyperbeamStore(
  profileId: string,
  zone: any,
  store: any,
  walletAddress: string
): any | null {
  if (!store || typeof store !== "object") return null;
  return normalizeProfile(
    {
      id: profileId,
      owner: zone?.Owner || zone?.owner || walletAddress,
      assets: [],
      roles: [],
      invites: [],
      version: zone?.Version || zone?.version || null,
      authorities: [],
      ...store,
    },
    walletAddress
  );
}

async function readProfileByHyperbeamLinks(
  profileId: string,
  walletAddress: string
): Promise<any | null> {
  for (const node of PROFILE_READ_NODES) {
    const base = clean(node).replace(/\/+$/, "");
    if (!base) continue;
    try {
      const compute = await fetchHyperbeamJsonStream(
        `${base}/${profileId}~process@1.0/compute`,
        5_000
      );
      const zoneLink = linkedId(compute?.["zone+link"]);
      if (!zoneLink) continue;
      const zone = await fetchHyperbeamJsonStream(`${base}/${zoneLink}`, 4_000);
      const storeLink = linkedId(zone?.["Store+link"]);
      if (!storeLink) continue;
      const store = await fetchHyperbeamJsonStream(`${base}/${storeLink}`, 4_000);
      const profile = profileFromHyperbeamStore(
        profileId,
        zone,
        store,
        walletAddress
      );
      if (profile?.id) return profile;
    } catch {
      // Try the next read node.
    }
  }
  return null;
}

function profileFromTags(option: ProfileOption, walletAddress: string): any | null {
  const tags = option.tags || [];
  return normalizeProfile(
    {
      id: option.id,
      walletAddress,
      scheduler: option.scheduler,
      displayName: getTagValue(tags, [
        "Bootloader-DisplayName",
        "Display-Name",
        "DisplayName",
      ]),
      username: getTagValue(tags, [
        "Bootloader-Username",
        "Username",
        "Handle",
      ]),
      description: getTagValue(tags, [
        "Bootloader-Description",
        "Description",
      ]),
      thumbnail: getTagValue(tags, [
        "Bootloader-Thumbnail",
        "Bootloader-Avatar",
        "Bootloader-Image",
        "Thumbnail",
        "Avatar",
        "Image",
        "ProfileImage",
      ]),
      banner: getTagValue(tags, [
        "Bootloader-Banner",
        "Bootloader-Cover",
        "Banner",
        "Cover",
        "CoverImage",
      ]),
      indexedFromSpawn: true,
    },
    walletAddress
  );
}

async function queryProfileOptions(
  walletAddress: string
): Promise<ProfileOption[]> {
  const query = `
    query PermaTellProfilesByWallet($owners: [String!], $tags: [TagFilter!]) {
      transactions(owners: $owners, tags: $tags, first: 25, sort: HEIGHT_DESC) {
        edges {
          node {
            id
            block { timestamp }
            tags { name value }
          }
        }
      }
    }
  `;

  const tagSets = [
    [
      { name: "Data-Protocol", values: ["ao"] },
      { name: "Zone-Type", values: ["User"] },
    ],
    [
      { name: "data-protocol", values: ["ao"] },
      { name: "zone-type", values: ["User"] },
    ],
  ];

  const responses = await Promise.allSettled(
    tagSets.map((tags) =>
      fetch(GRAPHQL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          variables: { owners: [walletAddress], tags },
        }),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`GraphQL HTTP ${response.status}`);
        return response.json();
      })
    )
  );

  const deduped = new Map<string, ProfileOption>();
  for (const response of responses) {
    if (response.status !== "fulfilled") continue;
    const edges = response.value?.data?.transactions?.edges || [];
    for (const edge of edges) {
      const id = clean(edge?.node?.id);
      if (!id) continue;
      const tags = edge.node.tags || [];
      const timestamp = edge.node.block?.timestamp
        ? Number(edge.node.block.timestamp) * 1000
        : undefined;
      const scheduler = getTagValue(tags, [
        "Scheduler",
        "Scheduler-Location",
        "scheduler",
        "scheduler-location",
      ]);
      const current = deduped.get(id);
      if (!current || (timestamp || 0) > (current.timestamp || 0)) {
        deduped.set(id, { id, timestamp, scheduler, tags });
      }
    }
  }

  const portalScheduler = clean(MAINNET_DEFAULTS.scheduler);
  return Array.from(deduped.values()).sort((a, b) => {
    const aPortal = a.scheduler === portalScheduler ? 1 : 0;
    const bPortal = b.scheduler === portalScheduler ? 1 : 0;
    if (aPortal !== bPortal) return bPortal - aPortal;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });
}

export async function getZoneProfileByWalletAddress(
  walletAddress: string
): Promise<any | null> {
  const wallet = clean(walletAddress);
  if (!wallet) return null;
  const cacheKey = wallet.toLowerCase();
  const cached = PROFILE_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < PROFILE_CACHE_TTL_MS) {
    return cached.data;
  }

  const options = await queryProfileOptions(wallet);
  const reader = getReader();
  for (const option of options.slice(0, 5)) {
    const fromLinks = await readProfileByHyperbeamLinks(option.id, wallet);
    if (fromLinks?.id) {
      PROFILE_CACHE.set(cacheKey, { at: Date.now(), data: fromLinks });
      return fromLinks;
    }

    try {
      if (reader?.getProfileById) {
        const profile = await withTimeout(
          reader.getProfileById(option.id),
          5_000,
          "getProfileById"
        );
        const normalized = normalizeProfile(profile, wallet);
        if (normalized?.id) {
          PROFILE_CACHE.set(cacheKey, { at: Date.now(), data: normalized });
          return normalized;
        }
      }
    } catch {
      const indexed = profileFromTags(option, wallet);
      if (indexed?.id) {
        PROFILE_CACHE.set(cacheKey, { at: Date.now(), data: indexed });
        return indexed;
      }
    }
  }

  PROFILE_CACHE.set(cacheKey, { at: Date.now(), data: null });
  return null;
}
