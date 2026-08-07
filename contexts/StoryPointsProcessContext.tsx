"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import {
  getAO,
  getMainnetAO,
  PROCESS_IDS,
  MAINNET_PROCESS_IDS,
  createDataItemSigner,
  HAS_EXPLICIT_MAINNET_PROCESS_IDS,
} from "@/lib/ao-config";
import { withHyperbeamGlobalFetch } from "@/lib/hyperbeamFetch";
import { useWallet } from "@/contexts/WalletContext";
import { useNetworkMode } from "@/contexts/NetworkModeContext";

interface StoryPointsProcessContextType {
  getAllStoryPoints: () => Promise<void>;
  getUserStoryPoints: (address: string) => Promise<void>;
  loading: boolean;
  allUsersStoryPoints: Record<string, number>;
  userStoryPoints: number;
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
  const { networkMode } = useNetworkMode();

  const useMainnetStoryPointsProcess =
    networkMode === "mainnet" && HAS_EXPLICIT_MAINNET_PROCESS_IDS;
  const useMainnetPerStoryProcesses =
    networkMode === "mainnet" && !HAS_EXPLICIT_MAINNET_PROCESS_IDS;
  const processId =
    useMainnetStoryPointsProcess
      ? MAINNET_PROCESS_IDS.storyPoints
      : PROCESS_IDS.storyPoints;

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
      if (useMainnetPerStoryProcesses) {
        return {};
      }

      if (useMainnetStoryPointsProcess) {
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
              "AO story points read"
            );
            return parseDryrunData(res);
          }
        } catch (mainnetReadError) {
          console.warn(
            "[story-points] mainnet dryrun failed, trying legacy CU",
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
        "AO story points read"
      );
      return parseDryrunData(res);
    },
    [useMainnetPerStoryProcesses, useMainnetStoryPointsProcess, processId]
  );

  const getAllStoryPoints = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      if (useMainnetPerStoryProcesses) {
        setAllUsersStoryPoints((prev) =>
          Object.keys(prev).length === 0 ? prev : {}
        );
        return;
      }

      const result = await getDryrunResult([
        { name: "Action", value: "GetAllStoryPoints" },
      ]);
      setAllUsersStoryPoints(result ?? {});
    } catch (error) {
      console.error("Error fetching all story points:", error);
    } finally {
      setLoading(false);
    }
  }, [getDryrunResult, useMainnetPerStoryProcesses]);

  const getUserStoryPoints = useCallback(
    async (address: string): Promise<void> => {
      setLoading(true);
      try {
        if (useMainnetPerStoryProcesses) {
          setUserStoryPoints(0);
          return;
        }

        const result = await getDryrunResult([
          { name: "Action", value: "GetUserStoryPoints" },
          { name: "address", value: address },
        ]);
        setUserStoryPoints(
          result && typeof result === "object" && "points" in result
            ? Number((result as { points: number }).points)
            : 0
        );
      } catch (error) {
        console.error("Error fetching user story points:", error);
        setUserStoryPoints(0);
      } finally {
        setLoading(false);
      }
    },
    [getDryrunResult, useMainnetPerStoryProcesses]
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
