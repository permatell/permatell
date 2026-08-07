"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

export type NetworkMode = "mainnet" | "legacy";

const STORAGE_KEY = "permatell_network_mode";
/** Default mode from env; users can still toggle unless explicitly locked. */
const DEFAULT_MODE: NetworkMode =
  process.env.NEXT_PUBLIC_AO_MODE === "legacy" ? "legacy" : "mainnet";
/** Set NEXT_PUBLIC_AO_LOCK_NETWORK=true to freeze the UI on DEFAULT_MODE. */
const NETWORK_LOCKED = process.env.NEXT_PUBLIC_AO_LOCK_NETWORK === "true";

interface NetworkModeContextType {
  networkMode: NetworkMode;
  setNetworkMode: (mode: NetworkMode) => void;
  isLegacy: boolean;
}

const NetworkModeContext = createContext<NetworkModeContextType | undefined>(
  undefined
);

function readStoredMode(): NetworkMode {
  if (NETWORK_LOCKED) return DEFAULT_MODE;
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "legacy" || stored === "mainnet") return stored;
  } catch {
    // ignore
  }
  return DEFAULT_MODE;
}

export function NetworkModeProvider({ children }: { children: React.ReactNode }) {
  const [networkMode, setNetworkModeState] = useState<NetworkMode>(DEFAULT_MODE);

  useEffect(() => {
    setNetworkModeState(readStoredMode());
  }, []);

  const setNetworkMode = useCallback((mode: NetworkMode) => {
    if (NETWORK_LOCKED) {
      setNetworkModeState(DEFAULT_MODE);
      try {
        localStorage.setItem(STORAGE_KEY, DEFAULT_MODE);
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
