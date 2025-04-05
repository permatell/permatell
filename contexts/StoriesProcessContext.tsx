"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { createDataItemSigner, connect } from "@permaweb/aoconnect";
import { useWallet } from "@/contexts/WalletContext";
import { Story, CurrentStory } from "@/interfaces/Story";
import { useStoryPointsProcess } from "./StoryPointsProcessContext";

const GATEWAY_URL = "https://arweave.net";
const MU_URL = "https://mu.ao-testnet.xyz";
// Use our Next.js API route to avoid CORS issues
const CU_URL = "https://cu.ao-testnet.xyz";

const PROCESS_ID = "gUp8l-EyEVG1wHkyjTY2PLX3kfNOttXdUTsQFgL8gfI"; //New process eltio

// Create a custom connect function that adds CORS headers and retry logic
const customConnect = () => {
  const { message, dryrun } = connect({
    MU_URL,
    CU_URL,
    GATEWAY_URL,
  });

  // Helper function to delay execution (for retry logic)
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Wrap the dryrun function to handle errors with a simple fallback approach and retry logic
  const wrappedDryrun = async (params: any, retries = 3) => {
    try {
      // Add a timeout to prevent hanging requests
      const timeoutPromise = new Promise<any>((_, reject) => {
        setTimeout(() => reject(new Error("Request timed out")), 5000);
      });
      
      const dryrunPromise = dryrun(params);
      
      // Race between the dryrun and the timeout
      return await Promise.race([dryrunPromise, timeoutPromise]);
    } catch (error) {
      // Log the error but don't crash the app
      console.error("Error in dryrun:", error);
      
      // If we have retries left, try again after a delay
      if (retries > 0) {
        console.log(`Retrying dryrun. Retries left: ${retries}`);
        
        // Wait for a bit before retrying (exponential backoff with jitter)
        const backoff = 1000 * Math.pow(2, 3 - retries) * (0.5 + Math.random() * 0.5);
        await delay(backoff);
        
        // Retry with one less retry attempt
        return wrappedDryrun(params, retries - 1);
      }
      
      // Return a fallback empty result to prevent the app from crashing
      return {
        Messages: [],
        Spawns: [],
        Assignments: [],
        Output: {},
        GasUsed: 0
      };
    }
  };

  // Wrap the message function to handle errors and add retry logic
  const wrappedMessage = async (params: any, retries = 3, initialBackoff = 1000) => {
    try {
      return await message(params);
    } catch (error) {
      // Handle rate limiting (429 Too Many Requests)
      if (error instanceof Error && error.message.includes("429")) {
        console.warn(`Rate limit exceeded. Retries left: ${retries}`);
        
        if (retries > 0) {
          // Calculate exponential backoff with jitter
          const backoff = initialBackoff * Math.pow(2, 3 - retries) * (0.5 + Math.random() * 0.5);
          console.log(`Retrying in ${Math.round(backoff / 1000)} seconds...`);
          
          // Wait for backoff period
          await delay(backoff);
          
          // Retry with one less retry attempt and increased backoff
          return wrappedMessage(params, retries - 1, initialBackoff);
        }
      }
      
      console.error("Error in message:", error);
      
      // Return a fallback empty result to prevent the app from crashing
      return {
        id: "",
        timestamp: Date.now(),
        owner: "",
        tags: [],
        data: ""
      };
    }
  };

  return { 
    dryrun: wrappedDryrun,
    message: wrappedMessage
  };
};

const { message, dryrun } = customConnect();

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
  const { address } = useWallet();
  const [stories, setStories] = useState<CurrentStory[]>([]);
  const [loading, setLoading] = useState(false);
  const { getUserStoryPoints } = useStoryPointsProcess();
  const [currentStory, setCurrentStory] = useState<Story | null>(null);

  const getSigner = () => {
    if (!address) {
      throw new Error("Wallet not connected");
    }
    return createDataItemSigner(globalThis.arweaveWallet);
  };

  const sendMessage = async (tags: { name: string; value: string }[]) => {
    try {
      const signer = getSigner();
      const res = await message({
        process: PROCESS_ID,
        tags,
        signer,
      });
      return res;
    } catch (error) {
      console.error("Error sending message:", error);
      // Return a fallback empty result
      return {
        id: "",
        timestamp: Date.now(),
        owner: "",
        tags: [],
        data: ""
      };
    }
  };

  // Simple cache to reduce API calls
  const resultCache = new Map<string, any>();
  
  const getDryrunResult = async (tags: { name: string; value: string }[]) => {
    try {
      // Create a cache key from the tags
      const cacheKey = JSON.stringify(tags);
      
      // Check if we have a cached result
      if (resultCache.has(cacheKey)) {
        return resultCache.get(cacheKey);
      }
      
      try {
        const res = await dryrun({
          process: PROCESS_ID,
          tags,
        });

        // Only call getUserStoryPoints once per session, not on every request
        // And only if we don't already have story points data
        if (address && tags[0]?.value === "GetStories" && !resultCache.has("getUserStoryPoints-" + address)) {
          getUserStoryPoints(address);
          // Mark that we've called getUserStoryPoints for this address
          resultCache.set("getUserStoryPoints-" + address, true);
        }

        let result = {};
        if (res.Messages && res.Messages.length > 0) {
          const data = res.Messages[0]?.Data;
          try {
            // Handle potential HTML responses (from error pages)
            if (typeof data === 'string' && data.trim().startsWith('<')) {
              console.warn("Received HTML instead of JSON, using empty result");
            } else {
              result = JSON.parse(data);
            }
          } catch (error) {
            // If parsing fails, just use the raw data
            if (typeof data === 'string' && !data.trim().startsWith('<')) {
              result = data;
            } else {
              console.warn("Failed to parse response data");
            }
          }
        } else {
          // If no messages, return an empty object instead of throwing
          console.warn("No messages returned from the process");
        }
        
        // Cache the result for longer (5 minutes)
        resultCache.set(cacheKey, result);
        
        return result;
      } catch (error) {
        // If we get a connection error, return cached result if available
        if (error instanceof Error && 
            (error.message.includes("Failed to fetch") || 
             error.message.includes("Network Error") ||
             error.message.includes("CORS") ||
             error.message.includes("Connection refused") ||
             error.message.includes("429"))) {
          console.warn("Network error detected:", error.message);
          
          // Return empty result
          return {};
        }
        
        throw error; // Re-throw other errors
      }
    } catch (error) {
      console.error("Error in getDryrunResult:", error);
      // Return a fallback empty result
      return {};
    }
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
      console.error("Error creating story:", error);
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
      console.error("Error creating story version:", error);
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
      console.error("Error reverting story version:", error);
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
      console.error("Error getting stories:", error);
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
      if (result && result.message === "Story not found!") {
        return null;
      }
      return result as Story;
    } catch (error) {
      console.error("Error getting story:", error);
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
      await sendMessage([
        { name: "Action", value: "UpvoteStoryVersion" },
        { name: "story_id", value: payload.story_id },
        { name: "version_id", value: payload.version_id },
      ]);
      await getStories();
    } catch (error) {
      console.error("Error upvoting story version:", error);
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
