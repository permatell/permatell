"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { createDataItemSigner, connect } from "@permaweb/aoconnect";
import { useWallet } from "@/contexts/WalletContext";
import { Story, CurrentStory } from "@/interfaces/Story";

const GATEWAY_URL = "https://arweave.net";
const MU_URL = "https://mu.ao-testnet.xyz";
const CU_URL = "https://cu.ao-testnet.xyz";
const PROCESS_ID = "EuMgUzNJ-O0pQndTEOlUhb6wgW9sInX2ZPD1lC9exWY";

const { message, dryrun } = connect({
  MU_URL,
  CU_URL,
  GATEWAY_URL,
});

interface StoriesProcessContextType {
  createStory: (payload: {
    title: string;
    content: string;
    is_public: boolean;
    cover_image?: string;
    category?: string;
  }) => Promise<void>;
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
}

const StoriesProcessContext = createContext<
  StoriesProcessContextType | undefined
>(undefined);

export const StoriesProcessProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { address } = useWallet();
  const [stories, setStories] = useState<CurrentStory[]>([]);
  const [loading, setLoading] = useState(false);

  const getSigner = () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }
    return createDataItemSigner(globalThis.arweaveWallet);
  };

  const sendMessage = async (tags: { name: string; value: string }[]) => {
    const signer = getSigner();
    const res = await message({
      process: PROCESS_ID,
      tags,
      signer,
    });
    return res;
  };

  const getDryrunResult = async (tags: { name: string; value: string }[]) => {
    const res = await dryrun({
      process: PROCESS_ID,
      tags,
    });

    if (res.Messages && res.Messages.length > 0) {
      const data = res.Messages[0]?.Data;
      try {
        return JSON.parse(data);
      } catch (error) {
        return data;
      }
    }

    throw new Error("No messages returned from the process");
  };

  const createStory = async (payload: {
    title: string;
    content: string;
    is_public: boolean;
    cover_image?: string;
    category?: string;
  }) => {
    setLoading(true);
    try {
      sendMessage([
        { name: "Action", value: "CreateStory" },
        { name: "title", value: payload.title },
        { name: "content", value: payload.content },
        { name: "is_public", value: payload.is_public ? "true" : "false" },
        { name: "cover_image", value: payload.cover_image || "" },
        { name: "category", value: payload.category || "" },
      ]);
      await getStories();
    } catch (error) {
      console.error(error);
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
      await sendMessage([
        { name: "Action", value: "CreateStoryVersion" },
        { name: "story_id", value: payload.story_id },
        { name: "title", value: payload.title || "" },
        { name: "content", value: payload.content || "" },
        { name: "cover_image", value: payload.cover_image || "" },
        { name: "category", value: payload.category || "" },
      ]);
      await getStories();
    } catch (error) {
      console.error(error);
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
      await sendMessage([
        { name: "Action", value: "RevertStoryToVersion" },
        { name: "story_id", value: payload.story_id },
        { name: "version_id", value: payload.version_id },
      ]);
      await getStories();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStories = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getDryrunResult([
        { name: "Action", value: "GetStories" },
      ]);
      if (Array.isArray(result)) {
        setStories(result);
      } else {
        setStories([]);
      }
    } catch (error) {
      console.error(error);
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [getDryrunResult]);

  const getStory = async (payload: {
    story_id: string;
  }): Promise<Story | null> => {
    setLoading(true);
    try {
      const result = await getDryrunResult([
        { name: "Action", value: "GetStory" },
        { name: "story_id", value: payload.story_id },
      ]);
      if (result.message === "Story not found!") {
        return null;
      }
      return result as Story;
    } catch (error) {
      console.error(error);
      return null;
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
