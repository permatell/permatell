"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import {
  getAO,
  getMainnetAO,
  PROCESS_IDS,
  MAINNET_PROCESS_IDS,
  createDataItemSigner,
  HAS_EXPLICIT_MAINNET_PROCESS_IDS,
  isAoProcessId,
} from "@/lib/ao-config";
import { withHyperbeamGlobalFetch } from "@/lib/hyperbeamFetch";
import { useWallet } from "@/contexts/WalletContext";
import { useNetworkMode } from "@/contexts/NetworkModeContext";
import { Story, CurrentStory } from "@/interfaces/Story";
import { useStoryPointsProcess } from "./StoryPointsProcessContext";
import {
  createStoryAtomicAsset,
  type StoryAtomicAssetResult,
} from "@/lib/permatellAssets";
import {
  applyLocalStoryUpvote,
  applyLocalStoryVersion,
  evalPerStoryHandlers,
  fetchHyperbeamStory,
  isValidCurrentStory,
  hydrateMainnetDiscoveryStories,
  indexMainnetDiscoveryStories,
  readStoredMainnetCurrentStories,
  readStoredMainnetStory,
  spawnMainnetStoryProcess,
} from "@/lib/mainnetStories";

export interface CreateStoryResult {
  atomicAsset?: StoryAtomicAssetResult;
}

const AO_READ_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), AO_READ_TIMEOUT_MS);
    }),
  ]);
}

interface StoriesProcessContextType {
  createStory: (payload: {
    title: string;
    content: string;
    is_public: boolean;
    cover_image?: string;
    category?: string;
    mint_atomic_asset?: boolean;
    asset_description?: string;
  }) => Promise<CreateStoryResult>;
  createStoryVersion: (payload: {
    story_id: string;
    title: string;
    content: string;
    cover_image: string;
    category?: string;
  }) => Promise<void>;
  getStories: () => Promise<void>;
  getStory: (payload: { story_id: string }) => Promise<Story | null>;
  revertStoryToVersion: (payload: {
    story_id: string;
    version_id: string;
  }) => Promise<void>;
  stories: CurrentStory[];
  loading: boolean;
  upvoteStoryVersion: (payload: {
    story_id: string;
    version_id: string;
  }) => Promise<void>;
  currentStory: Story | null;
  setCurrentStory: (story: Story | null) => void;
}

const StoriesProcessContext = createContext<
  StoriesProcessContextType | undefined
>(undefined);

export const StoriesProcessProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { address, walletType } = useWallet();
  const { networkMode } = useNetworkMode();
  const [stories, setStories] = useState<CurrentStory[]>([]);
  const [loading, setLoading] = useState(false);
  const { getUserStoryPoints } = useStoryPointsProcess();
  const [currentStory, setCurrentStory] = useState<Story | null>(null);

  const getSigner = () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }
    if (walletType === "evm") {
      throw new Error(
        "Story writes require a Wander or Beacon wallet until EVM session keys are bridged to an Arweave-compatible signer."
      );
    }
    if (!globalThis.arweaveWallet) {
      throw new Error("No Arweave wallet signer is available.");
    }
    return createDataItemSigner(globalThis.arweaveWallet);
  };

  const useMainnetRegistryProcess =
    networkMode === "mainnet" && HAS_EXPLICIT_MAINNET_PROCESS_IDS;
  const useMainnetPerStoryProcesses =
    networkMode === "mainnet" && !HAS_EXPLICIT_MAINNET_PROCESS_IDS;
  const processId = useMainnetRegistryProcess
    ? MAINNET_PROCESS_IDS.stories
    : PROCESS_IDS.stories;

  /** Per-story HyperBEAM processes use the process id as the story id. */
  const isPerStoryProcessId = (storyId?: string) =>
    networkMode === "mainnet" && isAoProcessId(storyId);

  const sendMessage = async (
    tags: { name: string; value: string }[],
    data?: string,
    targetProcess = processId
  ) => {
    const signer = getSigner();
    if (useMainnetPerStoryProcesses || useMainnetRegistryProcess) {
      const ao = getMainnetAO(signer)!;
      await withHyperbeamGlobalFetch(() =>
        ao.message({
          process: targetProcess,
          tags,
          data: data ?? undefined,
          signer,
        })
      );
    } else {
      const { message } = getAO();
      await message({
        process: targetProcess,
        tags,
        signer,
      });
    }
  };

  const parseDryrunData = (res: { Messages?: { Data?: unknown }[] }) => {
    if (res.Messages && res.Messages.length > 0) {
      const data = res.Messages[0]?.Data;
      try {
        return typeof data === "string" ? JSON.parse(data) : data;
      } catch {
        return data;
      }
    }
    throw new Error("No messages returned from the process");
  };

  const getDryrunResult = useCallback(
    async (tags: { name: string; value: string }[]) => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Explicit mainnet registry: prefer HyperBEAM dryrun (Portal path).
        // Fall back to legacy CU for wallet-less / CU-indexed processes.
        if (useMainnetRegistryProcess) {
          try {
            if (globalThis.arweaveWallet) {
              const signer = createDataItemSigner(globalThis.arweaveWallet);
              const ao = getMainnetAO(signer)!;
              const res = await withTimeout(
                withHyperbeamGlobalFetch(() =>
                  ao.dryrun({
                    process: processId,
                    tags,
                  })
                ),
                "AO story read"
              );
              if (address) getUserStoryPoints(address);
              return parseDryrunData(res);
            }
          } catch (mainnetReadError) {
            console.warn(
              "[stories] mainnet dryrun failed, trying legacy CU",
              mainnetReadError
            );
          }
        }

        const { dryrun } = getAO();
        const res = await withTimeout(
          dryrun({
            process: processId,
            tags,
          }),
          "AO story read"
        );
        if (address) getUserStoryPoints(address);
        return parseDryrunData(res);
      } catch (error: any) {
        if (error.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          throw new Error("Rate limit exceeded. Please try again in a few seconds.");
        }
        throw error;
      }
    },
    [address, getUserStoryPoints, useMainnetRegistryProcess, processId]
  );

  const createStory = async (payload: {
    title: string;
    content: string;
    is_public: boolean;
    cover_image?: string;
    category?: string;
    mint_atomic_asset?: boolean;
    asset_description?: string;
  }): Promise<CreateStoryResult> => {
    setLoading(true);
    try {
      if (networkMode === "mainnet") {
        const record = await spawnMainnetStoryProcess({
          title: payload.title,
          content: payload.content,
          is_public: payload.is_public,
          cover_image: payload.cover_image,
          category: payload.category,
          creator: address || "",
        });
        await getStories();
        const result: CreateStoryResult = {};
        if (payload.mint_atomic_asset) {
          result.atomicAsset = await createStoryAtomicAsset({
            storyId: record.id,
            title: payload.title,
            content: payload.content,
            creator: address || "",
            description: payload.asset_description,
            category: payload.category,
            coverImage: payload.cover_image,
            isPublic: payload.is_public,
          });
        }
        setCurrentStory(record.story);
        return result;
      }

      await sendMessage([
        { name: "Action", value: "CreateStory" },
        { name: "title", value: payload.title },
        { name: "content", value: payload.content },
        { name: "is_public", value: payload.is_public ? "true" : "false" },
        { name: "cover_image", value: payload.cover_image || "" },
        { name: "category", value: payload.category || "" },
      ]);
      const result: CreateStoryResult = {};
      if (payload.mint_atomic_asset) {
        result.atomicAsset = await createStoryAtomicAsset({
          title: payload.title,
          content: payload.content,
          creator: address || "",
          description: payload.asset_description,
          category: payload.category,
          coverImage: payload.cover_image,
          isPublic: payload.is_public,
        });
      }
      await getStories();
      return result;
    } catch (error) {
      console.error("Error creating story:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const createStoryVersion = async (payload: {
    story_id: string;
    title: string;
    content: string;
    cover_image: string;
    category?: string;
  }) => {
    setLoading(true);
    try {
      if (useMainnetPerStoryProcesses || isPerStoryProcessId(payload.story_id)) {
        await evalPerStoryHandlers(payload.story_id);
        await sendMessage(
          [
            { name: "Action", value: "CreateStoryVersion" },
            { name: "title", value: payload.title || "" },
            { name: "cover_image", value: payload.cover_image || "" },
            { name: "category", value: payload.category || "" },
          ],
          payload.content,
          payload.story_id
        );
        const updated = applyLocalStoryVersion(payload.story_id, {
          title: payload.title,
          content: payload.content,
          cover_image: payload.cover_image,
          category: payload.category,
          author: address || undefined,
        });
        if (updated) setCurrentStory(updated);
        const remote = await fetchHyperbeamStory(payload.story_id);
        if (remote) setCurrentStory(remote);
        await getStories();
        return;
      }

      if (useMainnetRegistryProcess) {
        await sendMessage(
          [
            { name: "Action", value: "CreateStoryVersion" },
            { name: "story_id", value: payload.story_id },
            { name: "title", value: payload.title || "" },
            { name: "cover_image", value: payload.cover_image || "" },
            { name: "category", value: payload.category || "" },
          ],
          payload.content
        );
      } else {
        await sendMessage([
          { name: "Action", value: "CreateStoryVersion" },
          { name: "story_id", value: payload.story_id },
          { name: "title", value: payload.title || "" },
          { name: "content", value: payload.content || "" },
          { name: "cover_image", value: payload.cover_image || "" },
          { name: "category", value: payload.category || "" },
        ]);
      }
      await getStories();
    } catch (error) {
      console.error("Error creating story version:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const revertStoryToVersion = async (payload: {
    story_id: string;
    version_id: string;
  }): Promise<void> => {
    setLoading(true);
    try {
      if (useMainnetPerStoryProcesses || isPerStoryProcessId(payload.story_id)) {
        await evalPerStoryHandlers(payload.story_id);
        await sendMessage(
          [
            { name: "Action", value: "RevertStoryToVersion" },
            { name: "version_id", value: payload.version_id },
          ],
          undefined,
          payload.story_id
        );
        const remote = await fetchHyperbeamStory(payload.story_id);
        if (remote) setCurrentStory(remote);
        await getStories();
        return;
      }

      await sendMessage([
        { name: "Action", value: "RevertStoryToVersion" },
        { name: "story_id", value: payload.story_id },
        { name: "version_id", value: payload.version_id },
      ]);
      await getStories();
    } catch (error) {
      console.error("Error reverting story:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const getStories = useCallback(async () => {
    setLoading(true);
    try {
      if (networkMode === "mainnet") {
        const indexed = await indexMainnetDiscoveryStories();
        setStories(indexed);
        setLoading(false);

        const mergeAndHydrate = async () => {
          let nextStories = indexed;
          if (useMainnetRegistryProcess) {
            try {
              const result = await getDryrunResult([
                { name: "Action", value: "GetStories" },
              ]);
              const registryStories = (
                Array.isArray(result) ? result : []
              ).filter(isValidCurrentStory);
              const byId = new Map(
                registryStories.map((story) => [story.id, story])
              );
              for (const story of indexed) {
                byId.set(story.id, story);
              }
              nextStories = Array.from(byId.values());
              setStories(nextStories);
            } catch (registryError) {
              console.warn(
                "[stories] registry GetStories failed, using per-story Discovery",
                registryError
              );
            }
          }
          setStories(await hydrateMainnetDiscoveryStories(nextStories));
        };

        void mergeAndHydrate().catch((error) =>
          console.warn("[stories] HyperBEAM Discovery hydrate failed", error)
        );
        return;
      }

      const result = await getDryrunResult([
        { name: "Action", value: "GetStories" },
      ]);
      setStories((Array.isArray(result) ? result : []).filter(isValidCurrentStory));
    } catch (error) {
      console.error("Error fetching stories:", error);
      setStories(
        networkMode === "mainnet" ? readStoredMainnetCurrentStories() : []
      );
    } finally {
      setLoading(false);
    }
  }, [getDryrunResult, networkMode, useMainnetRegistryProcess]);

  const getStory = async (payload: {
    story_id: string;
  }): Promise<Story | null> => {
    setLoading(true);
    try {
      if (useMainnetPerStoryProcesses || isPerStoryProcessId(payload.story_id)) {
        try {
          const remote = await fetchHyperbeamStory(payload.story_id);
          if (remote) return remote;
        } catch (error) {
          console.warn("[stories] HyperBEAM story read failed", error);
        }
        const local = readStoredMainnetStory(payload.story_id);
        if (local) return local;
        if (useMainnetPerStoryProcesses) return null;
      }

      const result = await getDryrunResult([
        { name: "Action", value: "GetStory" },
        { name: "story_id", value: payload.story_id },
      ]);
      if (result.message === "Story not found!") {
        return null;
      }
      return result as Story;
    } catch (error) {
      console.error("Error fetching story:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const upvoteStoryVersion = async (payload: {
    story_id: string;
    version_id: string;
  }): Promise<void> => {
    setLoading(true);
    try {
      if (useMainnetPerStoryProcesses || isPerStoryProcessId(payload.story_id)) {
        await evalPerStoryHandlers(payload.story_id);
        await sendMessage(
          [
            { name: "Action", value: "UpvoteStoryVersion" },
            { name: "version_id", value: payload.version_id },
          ],
          undefined,
          payload.story_id
        );
        const updated = applyLocalStoryUpvote(payload.story_id, payload.version_id);
        if (updated) setCurrentStory(updated);
        const remote = await fetchHyperbeamStory(payload.story_id);
        if (remote) setCurrentStory(remote);
        await getStories();
        return;
      }

      await sendMessage([
        { name: "Action", value: "UpvoteStoryVersion" },
        { name: "story_id", value: payload.story_id },
        { name: "version_id", value: payload.version_id },
      ]);
      await getStories();
    } catch (error) {
      console.error("Error upvoting story:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: StoriesProcessContextType = {
    createStory,
    createStoryVersion,
    getStories,
    getStory,
    revertStoryToVersion,
    stories,
    loading,
    upvoteStoryVersion,
    currentStory,
    setCurrentStory,
  };

  return (
    <StoriesProcessContext.Provider value={value}>
      {children}
    </StoriesProcessContext.Provider>
  );
};

export const useStoriesProcess = (): StoriesProcessContextType => {
  const context = useContext(StoriesProcessContext);
  if (context === undefined) {
    throw new Error(
      "useStoriesProcess must be used within a StoriesProcessProvider"
    );
  }
  return context;
};
