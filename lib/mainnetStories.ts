"use client";

import "@/lib/buffer-base64url";
import { connect, createDataItemSigner } from "@permaweb/aoconnect";
import {
  getHyperbeamWriteUrl,
  MAINNET_DEFAULTS,
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

function buildStoryLua(input: MainnetStoryInput): string {
  const timestamp = nowSeconds();
  const title = clean(input.title);
  const content = input.content || "";
  const coverImage = clean(input.cover_image);
  const category = clean(input.category);
  const isPublic = input.is_public ? "true" : "false";

  return `
local Story = {
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

local function publish_story_state()
  pcall(function()
    Send({
      device = "patch@1.0",
      story = Story,
      current_version = Story.current_version,
      is_public = Story.is_public
    })
  end)
end

local function generate_new_version_id(story)
  local max_id = 0
  for version_id, _ in pairs(story.versions) do
    local id_num = tonumber(version_id)
    if id_num and id_num > max_id then
      max_id = id_num
    end
  end
  return tostring(max_id + 1)
end

publish_story_state()

Handlers.add("create_story_version",
  { Action = "CreateStoryVersion" },
  function(msg)
    local new_version_id = generate_new_version_id(Story)
    local current_version = Story.versions[Story.current_version]
    Story.current_version = new_version_id
    Story.versions[new_version_id] = {
      id = tonumber(new_version_id),
      title = msg.title or current_version.title,
      content = msg.content or current_version.content,
      cover_image = msg.cover_image or current_version.cover_image,
      author = msg.From,
      timestamp = os.time(),
      category = msg.category or current_version.category,
      votes = 0
    }
    publish_story_state()
    ao.send({ Target = msg.From, Data = "Story updated with new version: " .. new_version_id })
  end
)

Handlers.add("revert_story_to_version",
  { Action = "RevertStoryToVersion" },
  function(msg)
    if Story.versions[msg.version_id] then
      Story.current_version = msg.version_id
      publish_story_state()
      ao.send({ Target = msg.From, Data = "Story reverted to version: " .. msg.version_id })
    else
      ao.send({ Target = msg.From, Data = "Story version not found!" })
    end
  end
)

Handlers.add("get_story",
  { Action = "GetStory" },
  function(msg)
    ao.send({ Target = msg.From, Data = Story })
  end
)

Handlers.add("upvote_story_version",
  { Action = "UpvoteStoryVersion" },
  function(msg)
    if Story.versions[msg.version_id] then
      Story.versions[msg.version_id].votes = (Story.versions[msg.version_id].votes or 0) + 1
      publish_story_state()
      ao.send({ Target = msg.From, Data = "Upvote successful for story " .. ao.id .. ", version " .. msg.version_id })
    else
      ao.send({ Target = msg.From, Data = "Story version not found!" })
    end
  end
)
`;
}

function storyToCurrent(story: Story): CurrentStory {
  const current = story.versions[story.current_version];
  return {
    id: story.id,
    current_version: story.current_version,
    is_public: story.is_public,
    version_data: current,
  };
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
  return readStoredMainnetStories().map((item) => storyToCurrent(item.story));
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

export async function spawnMainnetStoryProcess(
  input: MainnetStoryInput
): Promise<StoredMainnetStory> {
  const wallet = getWallet();
  const signer = createDataItemSigner(wallet);
  const scheduler = getScheduler();
  const authority = getAuthority();
  const nodeUrl = getHyperbeamWriteUrl();
  const moduleId = getModule();
  const ao = connect({
    MODE: "mainnet",
    URL: nodeUrl,
    SCHEDULER: scheduler,
    signer,
  } as any);
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
