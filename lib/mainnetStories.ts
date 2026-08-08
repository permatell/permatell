"use client";

import "@/lib/buffer-base64url";
import { createDataItemSigner } from "@permaweb/aoconnect";
import {
  DEFAULT_HYPERBEAM_WRITE_URL,
  getHyperbeamWriteUrl,
  getMainnetAO,
  isAoProcessId,
  MAINNET_DEFAULTS,
  normalizeHyperbeamUrl,
} from "@/lib/ao-config";
import { withHyperbeamGlobalFetch } from "@/lib/hyperbeamFetch";
import type { CurrentStory, Story } from "@/interfaces/Story";
import type { StoryCategory } from "@/types/StoryCategory";

export interface MainnetStoryInput {
  title: string;
  content: string;
  is_public: boolean;
  cover_image?: string;
  category?: string;
  creator: string;
}

export interface StoredMainnetStory {
  id: string;
  owner: string;
  scheduler: string;
  nodeUrl: string;
  createdAt: string;
  story: Story;
}

const STORAGE_KEY = "permatell_mainnet_story_processes";
const APP_NAME = "PermaTell";
const DEFAULT_MAINNET_MODULE = "ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s";
const DEFAULT_AUTHORITY = "a5ZMUKbGClAsKzB4SHDYrwkOZZHIIfpbaxrmKwUHCe8";

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function clean(value: string | undefined | null): string {
  return String(value || "").trim();
}

function getScheduler(): string {
  const scheduler = clean(MAINNET_DEFAULTS.scheduler);
  if (!scheduler || scheduler === "REPLACE_WITH_MAINNET_SCHEDULER_ID") {
    throw new Error(
      "Set NEXT_PUBLIC_AO_MAINNET_SCHEDULER before spawning HyperBEAM story processes."
    );
  }
  return scheduler;
}

function getModule(): string {
  return (
    clean(process.env.NEXT_PUBLIC_AO_MAINNET_MODULE) || DEFAULT_MAINNET_MODULE
  );
}

function getAuthority(): string {
  return clean(MAINNET_DEFAULTS.authority) || DEFAULT_AUTHORITY;
}

function sanitizeTags(tags: { name: string; value: string }[]) {
  return tags
    .map((tag) => ({
      name: tag.name.trim(),
      value: tag.value.replace(/\r?\n/g, " ").trim(),
    }))
    .filter((tag) => tag.name && tag.value);
}

function luaString(value: string | number | boolean): string {
  return JSON.stringify(String(value))
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function getWallet(): any {
  const wallet = globalThis.arweaveWallet;
  if (!wallet) {
    throw new Error("Wander/ArConnect wallet is required for HyperBEAM story spawning.");
  }
  return wallet;
}

/**
 * Shared per-story handlers. Relies on a global `Story` table.
 * Reads Action fields from msg.* or msg.Tags (HyperBEAM relay often only
 * puts them in Tags).
 *
 * HyperBEAM patch@1.0 shallow-merges linked maps: nested `versions["2"]`
 * keys and in-place `votes` updates often never land under
 * `/now/story/versions/{n}`. Scalars (current_version) do update — which is
 * why POMP Story showed current_version=2 with only version 1 linked.
 * Persist the full Story as `story_json` (same pattern as POMP campaign
 * json.encode blobs) and still attempt pathable delta patches.
 */
const STORY_HANDLER_LUA = `
local function msg_value(msg, name)
  local direct = msg[name]
  if type(direct) == "string" and direct ~= "" then return direct end
  if type(direct) == "number" then return tostring(direct) end
  local tags = msg.Tags
  if type(tags) ~= "table" then return nil end
  local mapped = tags[name]
  if type(mapped) == "string" and mapped ~= "" then return mapped end
  for _, tag in ipairs(tags) do
    if type(tag) == "table" then
      local tagName = tag.name or tag.Name
      local tagValue = tag.value or tag.Value
      if tagName == name and type(tagValue) == "string" and tagValue ~= "" then
        return tagValue
      end
    end
  end
  return nil
end

local function story_content(msg)
  if type(msg.Data) == "string" and msg.Data ~= "" then
    return msg.Data
  end
  local tagged = msg_value(msg, "content")
  if type(tagged) == "string" and tagged ~= "" then
    return tagged
  end
  return ""
end

local function encode_story_json()
  if type(json) == "table" and type(json.encode) == "function" then
    return json.encode(Story)
  end
  local ok, encoded = pcall(function()
    return require("json").encode(Story)
  end)
  if ok then return encoded end
  return nil
end

local function resolve_version(version_id)
  if type(Story) ~= "table" or type(Story.versions) ~= "table" then
    return nil, nil
  end
  if version_id and Story.versions[version_id] then
    return version_id, Story.versions[version_id]
  end
  local best_id, best_num = nil, -1
  for vid, ver in pairs(Story.versions) do
    local n = tonumber(vid) or tonumber(ver and ver.id) or -1
    if n > best_num then
      best_num = n
      best_id = tostring(vid)
    end
  end
  if best_id then
    return best_id, Story.versions[best_id]
  end
  return nil, nil
end

local function publish_story_state()
  pcall(function()
    local current_id, current = resolve_version(Story.current_version)
    current = current or {}
    local versions_delta = {}
    for vid, ver in pairs(Story.versions or {}) do
      versions_delta[tostring(vid)] = ver
    end
    local patch = {
      device = "patch@1.0",
      current_version = Story.current_version,
      is_public = Story.is_public,
      title = current.title or Story.id,
      name = current.title or "PermaTell Story",
      versions = versions_delta,
      story = {
        id = Story.id,
        current_version = Story.current_version,
        is_public = Story.is_public,
        versions = versions_delta
      }
    }
    local encoded = encode_story_json()
    if type(encoded) == "string" and encoded ~= "" then
      patch.story_json = encoded
      patch.story.story_json = encoded
    end
    Send(patch)
  end)
end

local function generate_new_version_id(story)
  local max_id = 0
  for version_id, ver in pairs(story.versions or {}) do
    local id_num = tonumber(version_id) or tonumber(ver and ver.id) or 0
    if id_num > max_id then
      max_id = id_num
    end
  end
  return tostring(max_id + 1)
end

Handlers.add("create_story_version",
  { Action = "CreateStoryVersion" },
  function(msg)
    local _, current_version = resolve_version(Story.current_version)
    if not current_version then
      ao.send({ Target = msg.From, Data = "Story version not found!" })
      return
    end
    local new_version_id = generate_new_version_id(Story)
    local next_content = story_content(msg)
    if next_content == "" then
      next_content = current_version.content
    end
    Story.current_version = new_version_id
    Story.versions[new_version_id] = {
      id = tonumber(new_version_id),
      title = msg_value(msg, "title") or current_version.title,
      content = next_content,
      cover_image = msg_value(msg, "cover_image") or current_version.cover_image,
      author = msg.From,
      timestamp = os.time(),
      category = msg_value(msg, "category") or current_version.category,
      votes = 0
    }
    publish_story_state()
    ao.send({ Target = msg.From, Data = "Story updated with new version: " .. new_version_id })
  end
)

Handlers.add("revert_story_to_version",
  { Action = "RevertStoryToVersion" },
  function(msg)
    local version_id = msg_value(msg, "version_id")
    if version_id and Story.versions[version_id] then
      Story.current_version = version_id
      publish_story_state()
      ao.send({ Target = msg.From, Data = "Story reverted to version: " .. version_id })
    else
      ao.send({ Target = msg.From, Data = "Story version not found!" })
    end
  end
)

Handlers.add("get_story",
  { Action = "GetStory" },
  function(msg)
    ao.send({ Target = msg.From, Data = encode_story_json() or Story })
  end
)

Handlers.add("upvote_story_version",
  { Action = "UpvoteStoryVersion" },
  function(msg)
    local version_id = msg_value(msg, "version_id")
    local _, version = resolve_version(version_id)
    if version_id and version then
      version.votes = (tonumber(version.votes) or 0) + 1
      Story.versions[version_id] = version
      publish_story_state()
      ao.send({ Target = msg.From, Data = "Upvote successful for story " .. ao.id .. ", version " .. version_id })
    else
      ao.send({ Target = msg.From, Data = "Story version not found!" })
    end
  end
)

publish_story_state()
`;

function buildStoryLua(input: MainnetStoryInput): string {
  const timestamp = nowSeconds();
  const title = clean(input.title);
  const content = input.content || "";
  const coverImage = clean(input.cover_image);
  const category = clean(input.category);
  const isPublic = input.is_public ? "true" : "false";

  return `
Story = {
  id = ao.id,
  current_version = "1",
  is_public = ${isPublic},
  versions = {
    ["1"] = {
      id = 1,
      title = ${luaString(title)},
      content = ${luaString(content)},
      cover_image = ${luaString(coverImage)},
      author = ${luaString(input.creator)},
      timestamp = ${timestamp},
      category = ${luaString(category)},
      votes = 0
    }
  }
}
${STORY_HANDLER_LUA}
`;
}

function buildStoryTableLua(story: Story): string {
  const versions = Object.entries(story.versions || {})
    .map(([id, version]) => {
      const timestamp = Number(version.timestamp);
      return `    [${luaString(id)}] = {
      id = ${Number(version.id) || Number(id) || 0},
      title = ${luaString(version.title)},
      content = ${luaString(version.content || "")},
      cover_image = ${luaString(version.cover_image || "")},
      author = ${luaString(version.author || "")},
      timestamp = ${Number.isFinite(timestamp) ? timestamp : nowSeconds()},
      category = ${luaString(version.category || "Uncategorized")},
      votes = ${Number(version.votes) || 0}
    }`;
    })
    .join(",\n");

  return `Story = {
  id = ao.id,
  current_version = ${luaString(story.current_version || "1")},
  is_public = ${story.is_public ? "true" : "false"},
  versions = {
${versions}
  }
}`;
}

/** Reinstall handlers. Prefer seeding from HyperBEAM /now so old closure-scoped Story is not lost. */
function buildStoryRepairLua(seed?: Story | null): string {
  const seedLua =
    seed && Object.keys(seed.versions || {}).length
      ? buildStoryTableLua(seed)
      : `if type(Story) ~= "table" then
  Story = {
    id = ao.id,
    current_version = "1",
    is_public = true,
    versions = {}
  }
end
if type(Story.versions) ~= "table" then
  Story.versions = {}
end`;

  return `
${seedLua}
${STORY_HANDLER_LUA}
`;
}

const repairedProcessIds = new Set<string>();

function getHyperbeamReadUrls(): string[] {
  const urls = [
    getHyperbeamWriteUrl(),
    DEFAULT_HYPERBEAM_WRITE_URL,
    normalizeHyperbeamUrl(process.env.NEXT_PUBLIC_HYPERBEAM_URL),
    normalizeHyperbeamUrl(process.env.NEXT_PUBLIC_AO_WRITE_URL),
  ]
    .map((url) => url.replace(/\/+$/, ""))
    .filter(Boolean);
  return [...new Set(urls)];
}

async function fetchHbJson(url: string, timeoutMs = 8_000): Promise<any | null> {
  if (typeof window === "undefined") return null;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      const title = text.replace(/\s+/g, " ").trim();
      return title ? { title, name: title } : null;
    }
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function storyFromNowMetadata(
  processId: string,
  now: Record<string, any> | null | undefined
): Story | null {
  if (!now || now.body === "not_found") return null;
  const title =
    clean(now.title) ||
    clean(now.name) ||
    clean(now["bootloader-title"]) ||
    clean(now["Bootloader-Title"]);
  const author =
    clean(now.creator) ||
    clean(now["bootloader-creator"]) ||
    clean(now["Bootloader-Creator"]) ||
    clean(now.author);
  if (!title && !author) return null;
  const currentVersion = String(now.current_version || "1");
  const category =
    clean(now["permatell-category"]) ||
    clean(now["bootloader-category"]) ||
    clean(now.category) ||
    "Uncategorized";
  return {
    id: processId,
    title: title || "Untitled",
    cover_image: clean(now.cover_image) || clean(now["bootloader-cover-image"]),
    author,
    current_version: currentVersion,
    is_public: String(now.is_public ?? now["bootloader-is-public"] ?? "true") !== "false",
    versions: {
      [currentVersion]: {
        id: Number(currentVersion) || 1,
        title: title || "Untitled",
        content: typeof now.content === "string" ? now.content : "",
        cover_image: clean(now.cover_image) || clean(now["bootloader-cover-image"]),
        author,
        timestamp: String(now.timestamp || now["process-timestamp"] || ""),
        category: category as StoryCategory,
        votes: Number(now.votes || 0),
      },
    },
  };
}

function versionIdsFromLinks(data: Record<string, unknown> | null | undefined): string[] {
  const ids = new Set<string>();
  for (const key of Object.keys(data || {})) {
    const match = key.match(/^(\d+)\+link$/);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

function parseStoryVersion(raw: any, fallbackId: string): Story["versions"][string] | null {
  if (!raw || raw.body === "not_found" || Number(raw.status) === 404) return null;
  const title = clean(raw.title);
  const content = typeof raw.content === "string" ? raw.content : "";
  if (!title && !content && raw.id == null) return null;
  return {
    id: Number(raw.id ?? fallbackId) || Number(fallbackId) || 0,
    title,
    content,
    cover_image: clean(raw.cover_image),
    author: clean(raw.author),
    timestamp: String(raw.timestamp ?? ""),
    category: (clean(raw.category) || "Uncategorized") as StoryCategory,
    votes: Number(raw.votes || 0),
  };
}

function parseStoryJsonBlob(
  processId: string,
  raw: unknown
): Story | null {
  let parsed: any = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "not_found") return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  // HyperBEAM sometimes wraps the blob under body / data.
  if (typeof parsed.body === "string" || typeof parsed.story_json === "string") {
    const nested =
      parseStoryJsonBlob(processId, parsed.body) ||
      parseStoryJsonBlob(processId, parsed.story_json);
    if (nested) return nested;
  }
  const versionsRaw = parsed.versions;
  if (!versionsRaw || typeof versionsRaw !== "object") return null;
  const versions: Story["versions"] = {};
  for (const [versionId, value] of Object.entries(versionsRaw)) {
    const version = parseStoryVersion(value, versionId);
    if (version) versions[String(versionId)] = version;
  }
  if (!Object.keys(versions).length) return null;
  let currentVersion = String(parsed.current_version || "1");
  if (!versions[currentVersion]) {
    currentVersion = Object.keys(versions).sort(
      (a, b) => Number(a) - Number(b)
    )[Object.keys(versions).length - 1];
  }
  const current = versions[currentVersion];
  return {
    id: clean(parsed.id) || processId,
    title: current?.title || clean(parsed.title) || "Untitled",
    cover_image: current?.cover_image || clean(parsed.cover_image),
    author: current?.author || clean(parsed.author),
    current_version: currentVersion,
    is_public: String(parsed.is_public ?? "true") !== "false",
    versions,
  };
}

function storyVersionCount(story: Story | null | undefined): number {
  return Object.keys(story?.versions || {}).length;
}

function storyVoteTotal(story: Story | null | undefined): number {
  return Object.values(story?.versions || {}).reduce(
    (sum, version) => sum + (Number(version?.votes) || 0),
    0
  );
}

/** Prefer the fresher of two story snapshots (more versions, then more votes, then higher current). */
export function preferFresherStory(a: Story | null, b: Story | null): Story | null {
  if (!a) return b;
  if (!b) return a;
  const score = (story: Story) =>
    storyVersionCount(story) * 1_000_000 +
    storyVoteTotal(story) * 1_000 +
    (Number(story.current_version) || 0);
  return score(a) >= score(b) ? a : b;
}

function rememberFetchedStory(story: Story, extra?: Partial<StoredMainnetStory>) {
  const existing = readStoredMainnetStories().find((item) => item.id === story.id);
  const merged = preferFresherStory(existing?.story || null, story) || story;
  rememberMainnetStory({
    id: story.id,
    owner: extra?.owner || existing?.owner || merged.author || "",
    scheduler: extra?.scheduler || existing?.scheduler || clean(MAINNET_DEFAULTS.scheduler),
    nodeUrl: extra?.nodeUrl || existing?.nodeUrl || getHyperbeamWriteUrl(),
    createdAt: extra?.createdAt || existing?.createdAt || new Date().toISOString(),
    story: merged,
  });
}

async function fetchStoryJsonFromNode(
  base: string,
  processId: string,
  now?: Record<string, any> | null
): Promise<Story | null> {
  const candidates: unknown[] = [
    now?.story_json,
    now?.["story_json"],
  ];
  const direct = await fetchHbJson(
    `${base}/${processId}~process@1.0/now/story_json`
  );
  candidates.push(direct, direct?.body, direct?.data);
  const storyNode = await fetchHbJson(
    `${base}/${processId}~process@1.0/now/story`
  );
  candidates.push(storyNode?.story_json, storyNode?.body);
  for (const candidate of candidates) {
    const parsed = parseStoryJsonBlob(processId, candidate);
    if (parsed) return parsed;
  }
  return null;
}

export async function fetchHyperbeamStory(processId: string): Promise<Story | null> {
  const id = clean(processId);
  if (!id) return null;

  let lastNow: Record<string, any> | null = null;
  let lastBase = "";
  let best: Story | null = null;

  for (const base of getHyperbeamReadUrls()) {
    const now = await fetchHbJson(`${base}/${id}~process@1.0/now`);
    if (!now || now.body === "not_found") continue;
    lastNow = now;
    lastBase = base;

    const fromJson = await fetchStoryJsonFromNode(base, id, now);
    if (fromJson) {
      best = preferFresherStory(best, fromJson);
      if (storyVersionCount(fromJson) > 1 || storyVoteTotal(fromJson) > 0) {
        rememberFetchedStory(fromJson, {
          owner: fromJson.author,
          scheduler: clean(now.scheduler) || undefined,
          nodeUrl: base,
        });
        return preferFresherStory(best, fromJson)!;
      }
    }

    const storyNow = await fetchHbJson(`${base}/${id}~process@1.0/now/story`);
    const versionsIndex = await fetchHbJson(
      `${base}/${id}~process@1.0/now/story/versions`
    );
    const currentVersion = String(
      storyNow?.current_version || now.current_version || "1"
    );
    const linkedIds = versionIdsFromLinks(versionsIndex);
    const maxProbe = Math.max(
      1,
      Number(currentVersion) || 1,
      ...linkedIds.map((value) => Number(value) || 0)
    );
    const ids = new Set<string>([
      ...linkedIds,
      ...Array.from({ length: maxProbe }, (_, index) => String(index + 1)),
    ]);

    const versions: Story["versions"] = {};
    await Promise.all(
      [...ids].map(async (versionId) => {
        const raw = await fetchHbJson(
          `${base}/${id}~process@1.0/now/story/versions/${versionId}`
        );
        const parsed = parseStoryVersion(raw, versionId);
        if (parsed) versions[versionId] = parsed;
      })
    );

    if (!Object.keys(versions).length) {
      if (fromJson) best = preferFresherStory(best, fromJson);
      continue;
    }

    let resolvedCurrent = currentVersion;
    // If HB header says N but only older linked versions exist, keep the
    // highest real version — do not invent an empty shell for N.
    if (!versions[resolvedCurrent]) {
      const available = Object.keys(versions).sort(
        (a, b) => Number(a) - Number(b)
      );
      resolvedCurrent = available[available.length - 1] || "1";
    }

    const current = versions[resolvedCurrent];
    const story: Story = {
      id,
      title: current?.title || clean(now.title) || clean(now.name) || "Untitled",
      cover_image: current?.cover_image || "",
      author:
        current?.author ||
        clean(now.creator) ||
        clean(now["bootloader-creator"]) ||
        "",
      current_version: resolvedCurrent,
      is_public: String(storyNow?.is_public ?? now.is_public ?? "true") !== "false",
      versions,
    };
    best = preferFresherStory(best, preferFresherStory(fromJson, story));
    if (best) {
      rememberFetchedStory(best, {
        owner: best.author,
        scheduler: clean(now.scheduler) || undefined,
        nodeUrl: base,
      });
      return best;
    }
  }

  if (best) {
    rememberFetchedStory(best, {
      owner: best.author,
      scheduler: clean(lastNow?.scheduler) || undefined,
      nodeUrl: lastBase,
    });
    return best;
  }

  const local = readStoredMainnetStory(id);
  const fallback = preferFresherStory(local, storyFromNowMetadata(id, lastNow));
  if (fallback) {
    rememberFetchedStory(fallback, {
      owner: fallback.author,
      scheduler: clean(lastNow?.scheduler) || undefined,
      nodeUrl: lastBase,
    });
    return fallback;
  }
  return null;
}

/** Poll HyperBEAM until story_json / versions reflect at least minVersions / minVotes. */
export async function waitForHyperbeamStory(
  processId: string,
  opts?: {
    minVersions?: number;
    minVotes?: number;
    minCurrentVersion?: number;
    attempts?: number;
    delayMs?: number;
  }
): Promise<Story | null> {
  const attempts = opts?.attempts ?? 6;
  const delayMs = opts?.delayMs ?? 800;
  let latest: Story | null = null;
  for (let i = 0; i < attempts; i++) {
    latest = await fetchHyperbeamStory(processId);
    if (latest) {
      const versionOk =
        !opts?.minVersions || storyVersionCount(latest) >= opts.minVersions;
      const votesOk =
        !opts?.minVotes || storyVoteTotal(latest) >= opts.minVotes;
      const currentOk =
        !opts?.minCurrentVersion ||
        (Number(latest.current_version) || 0) >= opts.minCurrentVersion;
      if (versionOk && votesOk && currentOk) return latest;
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return latest || readStoredMainnetStory(processId);
}

const HANDLER_REPAIR_VERSION = "story-json-v1";

export async function evalPerStoryHandlers(processId: string): Promise<void> {
  const repairKey = `${processId}:${HANDLER_REPAIR_VERSION}`;
  if (repairedProcessIds.has(repairKey)) return;
  const seed =
    preferFresherStory(
      await fetchHyperbeamStory(processId),
      readStoredMainnetStory(processId)
    ) || readStoredMainnetStory(processId);
  const wallet = getWallet();
  const signer = createDataItemSigner(wallet);
  const ao = getMainnetAO(signer)!;
  await withHyperbeamGlobalFetch(() =>
    ao.message({
      process: processId,
      signer,
      tags: [
        { name: "Data-Protocol", value: "ao" },
        { name: "Action", value: "Eval" },
        { name: "Message-Timestamp", value: Date.now().toString() },
      ],
      data: buildStoryRepairLua(seed),
    })
  );
  repairedProcessIds.add(repairKey);
}

export function toCurrentStory(story: Story | null | undefined): CurrentStory | null {
  if (!story?.id) return null;
  const versions = story.versions || {};
  const preferred =
    versions[story.current_version] ||
    Object.values(versions).sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))[0];
  if (!preferred && !clean(story.title) && !clean(story.author)) return null;
  return {
    id: story.id,
    current_version: preferred
      ? String(preferred.id || story.current_version || "1")
      : story.current_version || "1",
    is_public: story.is_public !== false,
    version_data: preferred || {
      id: Number(story.current_version) || 1,
      title: story.title || "Untitled",
      content: "",
      cover_image: story.cover_image || "",
      author: story.author || "",
      timestamp: "",
      category: "Uncategorized" as StoryCategory,
      votes: 0,
    },
  };
}

export function isValidCurrentStory(story: unknown): story is CurrentStory {
  const candidate = story as CurrentStory | null;
  return Boolean(clean(candidate?.id) && clean(candidate?.version_data?.title));
}

function storyToCurrent(story: Story): CurrentStory | null {
  return toCurrentStory(story);
}

export function readStoredMainnetStories(): StoredMainnetStory[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function readStoredMainnetStory(id: string): Story | null {
  return readStoredMainnetStories().find((item) => item.id === id)?.story || null;
}

export function readStoredMainnetCurrentStories(): CurrentStory[] {
  return readStoredMainnetStories()
    .map((item) => storyToCurrent(item.story))
    .filter(isValidCurrentStory);
}

type DiscoveredStoryProcess = {
  id: string;
  title?: string;
  author?: string;
  category?: string;
};

/** Known mainnet per-story processes that must appear in Discovery even if GraphQL/localStorage lag. */
const SEEDED_MAINNET_STORIES: DiscoveredStoryProcess[] = [
  {
    id: "hJ7Intf25bH2h70lN4y1P1VcKC9rYQ4RTU1uklvyM5M",
    title: "POMP Story",
    author: "n43BPVPwpQZelVa3lXECIUv65sh69RlvDID0eNzRE9k",
    category: "Web3",
  },
];

const STORY_PROCESS_GRAPHQL = `
query DiscoverPermaTellStories($tags: [TagFilter!]!, $first: Int!) {
  transactions(tags: $tags, first: $first, sort: HEIGHT_DESC) {
    edges {
      node {
        id
        owner { address }
        tags { name value }
      }
    }
  }
}
`;

function getTagValue(
  tags: Array<{ name?: string; value?: string }> | undefined,
  names: string[]
): string {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  for (const tag of tags || []) {
    const name = clean(tag?.name).toLowerCase();
    const value = clean(tag?.value);
    if (wanted.has(name) && value) return value;
  }
  return "";
}

function currentStoryFromDiscoveryMeta(
  meta: DiscoveredStoryProcess
): CurrentStory | null {
  if (!isAoProcessId(meta.id) || (!clean(meta.title) && !clean(meta.author))) {
    return null;
  }
  return {
    id: meta.id,
    current_version: "1",
    is_public: true,
    version_data: {
      id: 1,
      title: clean(meta.title) || "Untitled",
      content: "",
      cover_image: "",
      author: clean(meta.author),
      timestamp: "",
      category: (clean(meta.category) || "Uncategorized") as StoryCategory,
      votes: 0,
    },
  };
}

async function postGraphql(
  endpoint: string,
  variables: Record<string, unknown>
): Promise<any[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: STORY_PROCESS_GRAPHQL, variables }),
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.transactions?.edges || [];
  } catch {
    return null;
  }
}

function persistSeededMainnetStories() {
  if (typeof window === "undefined") return;
  for (const seed of SEEDED_MAINNET_STORIES) {
    if (!isAoProcessId(seed.id) || readStoredMainnetStory(seed.id)) continue;
    rememberMainnetStory({
      id: seed.id,
      owner: seed.author || "",
      scheduler: clean(MAINNET_DEFAULTS.scheduler),
      nodeUrl: getHyperbeamWriteUrl(),
      createdAt: new Date().toISOString(),
      story: {
        id: seed.id,
        title: seed.title || "Untitled",
        cover_image: "",
        author: seed.author || "",
        current_version: "1",
        is_public: true,
        versions: {
          "1": {
            id: 1,
            title: seed.title || "Untitled",
            content: "",
            cover_image: "",
            author: seed.author || "",
            timestamp: "",
            category: (seed.category || "Uncategorized") as StoryCategory,
            votes: 0,
          },
        },
      },
    });
  }
}

/**
 * Index mainnet per-story processes from localStorage and Arweave GraphQL.
 * Registry GetStories does not list spawned HyperBEAM story processes.
 */
export async function discoverMainnetStoryProcesses(): Promise<
  DiscoveredStoryProcess[]
> {
  const byId = new Map<string, DiscoveredStoryProcess>();

  persistSeededMainnetStories();

  for (const seed of SEEDED_MAINNET_STORIES) {
    if (!isAoProcessId(seed.id)) continue;
    byId.set(seed.id, { ...seed });
  }

  for (const stored of readStoredMainnetStories()) {
    if (!isAoProcessId(stored.id)) continue;
    const existing = byId.get(stored.id);
    byId.set(stored.id, {
      id: stored.id,
      title: existing?.title || stored.story?.title,
      author: existing?.author || stored.owner || stored.story?.author,
      category:
        existing?.category ||
        stored.story?.versions?.[stored.story.current_version]?.category,
    });
  }

  const tagSets = [
    [
      { name: "App-Name", values: ["PermaTell"] },
      { name: "PermaTell-Asset-Type", values: ["story-process"] },
    ],
    [
      { name: "App-Name", values: ["PermaTell"] },
      { name: "Zone-Type", values: ["Story"] },
    ],
  ];
  const endpoints = [
    typeof window !== "undefined" ? "/api/arweave/graphql" : "",
    "https://arweave.net/graphql",
  ].filter(Boolean);

  for (const tags of tagSets) {
    for (const endpoint of endpoints) {
      const edges = await postGraphql(endpoint, { first: 50, tags });
      if (!edges?.length) continue;
      for (const edge of edges) {
        const id = clean(edge?.node?.id);
        if (!isAoProcessId(id)) continue;
        const nodeTags = edge?.node?.tags || [];
        const existing = byId.get(id);
        byId.set(id, {
          id,
          title:
            existing?.title ||
            getTagValue(nodeTags, ["Title", "Name", "Bootloader-Title"]),
          author:
            existing?.author ||
            getTagValue(nodeTags, ["Creator", "Bootloader-Creator"]) ||
            clean(edge?.node?.owner?.address),
          category:
            existing?.category ||
            getTagValue(nodeTags, [
              "PermaTell-Category",
              "Bootloader-Category",
              "Category",
            ]),
        });
      }
      break;
    }
  }

  return [...byId.values()];
}

export async function indexMainnetDiscoveryStories(): Promise<CurrentStory[]> {
  const byId = new Map<string, CurrentStory>();

  for (const local of readStoredMainnetCurrentStories()) {
    byId.set(local.id, local);
  }

  const discovered = await discoverMainnetStoryProcesses();
  for (const meta of discovered) {
    if (byId.has(meta.id)) continue;
    const stub = currentStoryFromDiscoveryMeta(meta);
    if (stub) byId.set(meta.id, stub);
  }

  return [...byId.values()].filter(isValidCurrentStory);
}

export async function hydrateMainnetDiscoveryStories(
  stories?: CurrentStory[]
): Promise<CurrentStory[]> {
  const indexed = stories?.length
    ? stories
    : await indexMainnetDiscoveryStories();
  const byId = new Map(indexed.map((story) => [story.id, story]));

  await Promise.all(
    indexed.map(async (story) => {
      if (!isAoProcessId(story.id)) return;
      try {
        const remote = await fetchHyperbeamStory(story.id);
        const current = toCurrentStory(remote);
        if (current) byId.set(story.id, current);
      } catch (error) {
        console.warn("[stories] HyperBEAM discovery read failed", story.id, error);
      }
    })
  );

  return [...byId.values()].filter(isValidCurrentStory);
}

export async function loadMainnetDiscoveryStories(): Promise<CurrentStory[]> {
  return hydrateMainnetDiscoveryStories(await indexMainnetDiscoveryStories());
}

function rememberMainnetStory(record: StoredMainnetStory) {
  if (typeof window === "undefined") return;
  const existing = readStoredMainnetStories().filter(
    (item) => item.id !== record.id
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...existing]));
}

export function updateStoredMainnetStory(story: Story) {
  if (typeof window === "undefined") return;
  const existing = readStoredMainnetStories();
  const next = existing.map((item) =>
    item.id === story.id ? { ...item, story } : item
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function applyLocalStoryVersion(
  storyId: string,
  input: {
    title: string;
    content: string;
    cover_image?: string;
    category?: string;
    author?: string;
  }
): Story | null {
  const existing = readStoredMainnetStory(storyId);
  if (!existing) return null;
  const current = existing.versions[existing.current_version];
  const nextId = String(
    Math.max(0, ...Object.keys(existing.versions).map((id) => Number(id) || 0)) +
      1
  );
  const updated: Story = {
    ...existing,
    current_version: nextId,
    versions: {
      ...existing.versions,
      [nextId]: {
        id: Number(nextId),
        title: input.title || current.title,
        content: input.content || current.content,
        cover_image: input.cover_image || current.cover_image,
        author: input.author || current.author,
        timestamp: String(nowSeconds()),
        category: (input.category || current.category || "Uncategorized") as StoryCategory,
        votes: 0,
      },
    },
  };
  updateStoredMainnetStory(updated);
  return updated;
}

export function applyLocalStoryUpvote(
  storyId: string,
  versionId: string
): Story | null {
  const existing = readStoredMainnetStory(storyId);
  if (!existing?.versions[versionId]) return null;
  const version = existing.versions[versionId];
  const updated: Story = {
    ...existing,
    versions: {
      ...existing.versions,
      [versionId]: {
        ...version,
        votes: (Number(version.votes) || 0) + 1,
      },
    },
  };
  updateStoredMainnetStory(updated);
  return updated;
}

export async function spawnMainnetStoryProcess(
  input: MainnetStoryInput
): Promise<StoredMainnetStory> {
  const wallet = getWallet();
  const signer = createDataItemSigner(wallet);
  const scheduler = getScheduler();
  const authority = getAuthority();
  const nodeUrl = getHyperbeamWriteUrl();
  const moduleId = getModule();
  const ao = getMainnetAO(signer)!;
  const processData = clean(input.title) || "PermaTell Story";
  const processTags = sanitizeTags([
    { name: "Authority", value: authority },
    { name: "Data-Protocol", value: "ao" },
    { name: "Zone-Type", value: "Story" },
    { name: "App-Name", value: APP_NAME },
    { name: "Name", value: clean(input.title) || "PermaTell Story" },
    { name: "Title", value: clean(input.title) || "PermaTell Story" },
    { name: "PermaTell-Asset-Type", value: "story-process" },
    { name: "PermaTell-Category", value: clean(input.category) || "Uncategorized" },
    { name: "Creator", value: input.creator },
    { name: "Bootloader-Title", value: clean(input.title) || "PermaTell Story" },
    { name: "Bootloader-Creator", value: input.creator },
    { name: "Bootloader-Category", value: clean(input.category) || "Uncategorized" },
    { name: "Bootloader-Is-Public", value: input.is_public ? "true" : "false" },
    ...(clean(input.cover_image)
      ? [{ name: "Bootloader-Cover-Image", value: clean(input.cover_image) }]
      : []),
    { name: "Process-Timestamp", value: Date.now().toString() },
  ]);

  const processId = String(
    await withHyperbeamGlobalFetch(() =>
      ao.spawn({
        module: moduleId,
        scheduler,
        signer,
        tags: processTags,
        data: processData,
      })
    )
  );

  if (!processId || processId === "undefined") {
    throw new Error("HyperBEAM did not return a process id for the story process.");
  }

  await withHyperbeamGlobalFetch(() =>
    ao.message({
      process: processId,
      signer,
      tags: [
        { name: "Data-Protocol", value: "ao" },
        { name: "Action", value: "Eval" },
        { name: "Message-Timestamp", value: Date.now().toString() },
      ],
      data: buildStoryLua(input),
    })
  );

  await withHyperbeamGlobalFetch(() =>
    ao.message({
      process: processId,
      signer,
      tags: [
        { name: "Action", value: "Init" },
        { name: "Message-Timestamp", value: Date.now().toString() },
      ],
    })
  );

  const story: Story = {
    id: processId,
    title: input.title,
    cover_image: input.cover_image || "",
    author: input.creator,
    current_version: "1",
    is_public: input.is_public,
    versions: {
      "1": {
        id: 1,
        title: input.title,
        content: input.content,
        cover_image: input.cover_image || "",
        author: input.creator,
        timestamp: String(nowSeconds()),
        category: (input.category || "Uncategorized") as StoryCategory,
        votes: 0,
      },
    },
  };

  const record: StoredMainnetStory = {
    id: processId,
    owner: input.creator,
    scheduler,
    nodeUrl,
    createdAt: new Date().toISOString(),
    story,
  };
  rememberMainnetStory(record);
  return record;
}
