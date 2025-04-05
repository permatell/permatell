"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { connect } from "@permaweb/aoconnect";
import { useWallet } from "@/contexts/WalletContext";

const GATEWAY_URL = "https://arweave.net";
const MU_URL = "https://mu.ao-testnet.xyz";
// Use our Next.js API route to avoid CORS issues
const CU_URL = "https://cu.ao-testnet.xyz";
const PROCESS_ID = "UwYxEKXxEmbd9-sIJtSVgAPMj85QQC7ExMt1VeLxXsA";

// Create a custom connect function with simplified error handling
const customConnect = () => {
  const { dryrun } = connect({
    MU_URL,
    CU_URL,
    GATEWAY_URL,
  });

  // Wrap the dryrun function to handle errors with a simple fallback approach
  const wrappedDryrun = async (params: any) => {
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

  return { dryrun: wrappedDryrun };
};

const { dryrun } = customConnect();

interface StoryPointsProcessContextType {
  getAllStoryPoints: () => Promise<void>;
  getUserStoryPoints: (address: string) => Promise<void>;
  loading: boolean;
  allUsersStoryPoints: Record<string, number>;
  userStoryPoints: number;
}

const StoryPointsProcessContext = createContext<
  StoryPointsProcessContextType | undefined
>(undefined);

export const StoryPointsProcessProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [loading, setLoading] = useState(false);
  const [allUsersStoryPoints, setAllUsersStoryPoints] = useState<
    Record<string, number>
  >({});
  const [userStoryPoints, setUserStoryPoints] = useState<number>(0);
  const { address } = useWallet();

  // Simple cache to reduce API calls
  const resultCache = new Map<string, any>();
  
  const getDryrunResult = async (tags: { name: string; value: string }[]) => {
    try {
      // Create a cache key from the tags
      const cacheKey = JSON.stringify(tags);
      
      // Check if we have a cached result
      if (resultCache.has(cacheKey)) {
        console.log("Using cached result for", tags[0]?.value);
        return resultCache.get(cacheKey);
      }
      
      try {
        const res = await dryrun({
          process: PROCESS_ID,
          tags,
        });

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
        
        // Cache the result
        resultCache.set(cacheKey, result);
        
        return result;
      } catch (error) {
        // If we get a connection error, return empty result
        if (error instanceof Error && 
            (error.message.includes("Failed to fetch") || 
             error.message.includes("Network Error") ||
             error.message.includes("CORS") ||
             error.message.includes("Connection refused"))) {
          console.warn("Network error detected");
          
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

  const getAllStoryPoints = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await getDryrunResult([
        { name: "Action", value: "GetAllStoryPoints" },
      ]);
      
      // Check if result is an object with points and reward_thresholds
      if (result && typeof result === 'object' && 'points' in result) {
        // Only set the points, not the entire object
        setAllUsersStoryPoints(result.points);
      } else if (result && typeof result === 'object') {
        // Fallback to using the entire result if it doesn't have the expected structure
        setAllUsersStoryPoints(result);
      } else {
        // If result is not an object or is empty, set an empty object
        setAllUsersStoryPoints({});
      }
    } catch (error) {
      console.error("Error in getAllStoryPoints:", error);
      // Set an empty object on error
      setAllUsersStoryPoints({});
    } finally {
      setLoading(false);
    }
  }, []);

  const getUserStoryPoints = useCallback(
    async (address: string): Promise<void> => {
      setLoading(true);
      try {
        const result = await getDryrunResult([
          { name: "Action", value: "GetUserStoryPoints" },
          { name: "address", value: address },
        ]);
        
        // Check if result has points property
        if (result && typeof result === 'object' && 'points' in result) {
          setUserStoryPoints(result.points);
        } else {
          // Default to 0 if points not found
          setUserStoryPoints(0);
        }
      } catch (error) {
        console.error("Error in getUserStoryPoints:", error);
        setUserStoryPoints(0);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (address) {
      getUserStoryPoints(address);
    }
  }, [address, getUserStoryPoints]);

  const value: StoryPointsProcessContextType = {
    getAllStoryPoints,
    getUserStoryPoints,
    loading,
    allUsersStoryPoints,
    userStoryPoints,
  };

  return (
    <StoryPointsProcessContext.Provider value={value}>
      {children}
    </StoryPointsProcessContext.Provider>
  );
};

export const useStoryPointsProcess = (): StoryPointsProcessContextType => {
  const context = useContext(StoryPointsProcessContext);
  if (context === undefined) {
    throw new Error(
      "useStoryPointsProcess must be used within a StoryPointsProcessProvider"
    );
  }
  return context;
};
