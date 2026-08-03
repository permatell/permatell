"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

const STORAGE_KEY = "permatell_network_mode";
const CONFIGURED_MODE =
  process.env.NEXT_PUBLIC_AO_MODE === "legacy" ? "legacy" : "mainnet";

export type NetworkMode = "mainnet" | "legacy";

interface NetworkModeContextType {
  networkMode: NetworkMode;
  setNetworkMode: (mode: NetworkMode) => void;
  isLegacy: boolean;
}

const NetworkModeContext = createContext<NetworkModeContextType | undefined>(
  undefined
);

function readStoredMode(): NetworkMode {
  if (CONFIGURED_MODE === "mainnet") return "mainnet";
  if (typeof window === "undefined") return CONFIGURED_MODE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "legacy" || stored === "mainnet") return stored;
  } catch {
    // ignore
  }
  return CONFIGURED_MODE;
}

export function NetworkModeProvider({ children }: { children: React.ReactNode }) {
  const [networkMode, setNetworkModeState] = useState<NetworkMode>(CONFIGURED_MODE);

  useEffect(() => {
    setNetworkModeState(readStoredMode());
  }, []);

  const setNetworkMode = useCallback((mode: NetworkMode) => {
    if (CONFIGURED_MODE === "mainnet") {
      setNetworkModeState("mainnet");
      try {
        localStorage.setItem(STORAGE_KEY, "mainnet");
      } catch {
        // ignore
      }
      return;
    }
    setNetworkModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const value: NetworkModeContextType = {
    networkMode,
    setNetworkMode,
    isLegacy: networkMode === "legacy",
  };

  return (
    <NetworkModeContext.Provider value={value}>
      {children}
    </NetworkModeContext.Provider>
  );
}

export function useNetworkMode(): NetworkModeContextType {
  const context = useContext(NetworkModeContext);
  if (context === undefined) {
    throw new Error(
      "useNetworkMode must be used within a NetworkModeProvider"
    );
  }
  return context;
}
