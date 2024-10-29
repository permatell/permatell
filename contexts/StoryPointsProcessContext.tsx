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
const CU_URL = "https://cu.ao-testnet.xyz";
const PROCESS_ID = "CcsBc_giuk4t5-3oIzmepMalbgzRHdy63x5XyJcCIv8";

const { dryrun } = connect({
  MU_URL,
  CU_URL,
  GATEWAY_URL,
});

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

  const getAllStoryPoints = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await getDryrunResult([
        { name: "Action", value: "GetAllStoryPoints" },
      ]);
      setAllUsersStoryPoints(result);
    } catch (error) {
      console.error(error);
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
        setUserStoryPoints(result.points);
      } catch (error) {
        console.error(error);
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
