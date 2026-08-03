"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { ethers } from "ethers";
import { FEATURES } from "@/lib/ao-config";

// ---------------------------------------------------------------------------
// Session Key Management (Bazar pattern – ephemeral key kept for 7 days)
// ---------------------------------------------------------------------------

export interface SessionKeyData {
  privateKey: string;
  address: string;
  mainAccount: string;
  expiry: number;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function generateSessionKey(mainAccount: string): SessionKeyData {
  const wallet = ethers.Wallet.createRandom();
  return {
    privateKey: wallet.privateKey,
    address: wallet.address,
    mainAccount: mainAccount.toLowerCase(),
    expiry: Date.now() + ONE_WEEK_MS,
  };
}

export function getSessionKey(mainAccount: string): SessionKeyData | null {
  if (!mainAccount) return null;
  const storageKey = `ethSessionKey_${mainAccount.toLowerCase()}`;
  const stored =
    typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;
  if (!stored) return null;

  try {
    const sessionData: SessionKeyData = JSON.parse(stored);
    const timeUntilExpiry = sessionData.expiry - Date.now();

    if (timeUntilExpiry <= 0 || timeUntilExpiry <= ONE_DAY_MS) {
      console.log("Session key expired or expiring soon – will regenerate.");
      return null;
    }

    if (sessionData.mainAccount.toLowerCase() !== mainAccount.toLowerCase()) {
      return null;
    }

    return sessionData;
  } catch {
    if (typeof window !== "undefined") localStorage.removeItem(storageKey);
    return null;
  }
}

export function storeSessionKey(sessionData: SessionKeyData): void {
  const storageKey = `ethSessionKey_${sessionData.mainAccount.toLowerCase()}`;
  if (typeof window !== "undefined") {
    localStorage.setItem(storageKey, JSON.stringify(sessionData));
  }
}

export function clearSessionKey(mainAccount: string): void {
  if (!mainAccount || typeof window === "undefined") return;
  const storageKey = `ethSessionKey_${mainAccount.toLowerCase()}`;
  localStorage.removeItem(storageKey);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface EvmWalletContextState {
  evmAddress: string | null;
  evmBalance: string | null;
  sessionKey: SessionKeyData | null;
  isConnected: boolean;
  chainId: number | null;
  connectEvm: () => Promise<string | null>;
  disconnectEvm: () => void;
  initializeSession: (mainAccount: string) => Promise<SessionKeyData | null>;
  clearSession: () => void;
  refreshSession: () => Promise<void>;
}

const DEFAULT_CONTEXT: EvmWalletContextState = {
  evmAddress: null,
  evmBalance: null,
  sessionKey: null,
  isConnected: false,
  chainId: null,
  connectEvm: async () => null,
  disconnectEvm: () => {},
  initializeSession: async () => null,
  clearSession: () => {},
  refreshSession: async () => {},
};

const EvmWalletContext = createContext<EvmWalletContextState>(DEFAULT_CONTEXT);

export function useEvmWallet(): EvmWalletContextState {
  return useContext(EvmWalletContext);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function EvmWalletProvider({ children }: { children: React.ReactNode }) {
  const [evmAddress, setEvmAddress] = useState<string | null>(null);
  const [evmBalance, setEvmBalance] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<SessionKeyData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [chainId, setChainId] = useState<number | null>(null);

  // ---- session key helpers ------------------------------------------------

  const initializeSession = useCallback(
    async (mainAccount: string): Promise<SessionKeyData | null> => {
      if (!mainAccount) return null;
      try {
        let session = getSessionKey(mainAccount);
        if (!session) {
          session = generateSessionKey(mainAccount);
          storeSessionKey(session);
          console.log("New EVM session key generated:", session.address);
        } else {
          console.log("Reusing existing EVM session key:", session.address);
        }
        setSessionKey(session);
        return session;
      } catch (error) {
        console.error("Error initializing EVM session key:", error);
        return null;
      }
    },
    []
  );

  const clearSession = useCallback(() => {
    if (evmAddress) {
      clearSessionKey(evmAddress);
      setSessionKey(null);
    }
  }, [evmAddress]);

  const refreshSession = useCallback(async () => {
    if (evmAddress) {
      clearSessionKey(evmAddress);
      await initializeSession(evmAddress);
    }
  }, [evmAddress, initializeSession]);

  // ---- wallet connection via window.ethereum (MetaMask etc.) ---------------

  const connectEvm = useCallback(async (): Promise<string | null> => {
    if (!FEATURES.EVM_WALLET) return null;
    if (typeof window === "undefined" || !window.ethereum) {
      console.error("No EVM wallet detected (e.g. MetaMask).");
      return null;
    }

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as any);
      const accounts: string[] = await provider.send("eth_requestAccounts", []);
      if (accounts.length === 0) return null;

      const address = accounts[0];
      const network = await provider.getNetwork();
      const balance = await provider.getBalance(address);

      setEvmAddress(address);
      setIsConnected(true);
      setChainId(network.chainId);
      setEvmBalance(ethers.utils.formatEther(balance));

      // auto-initialise session key
      await initializeSession(address);
      return address;
    } catch (err) {
      console.error("EVM connect failed:", err);
      return null;
    }
  }, [initializeSession]);

  const disconnectEvm = useCallback(() => {
    if (evmAddress) clearSessionKey(evmAddress);
    setEvmAddress(null);
    setEvmBalance(null);
    setSessionKey(null);
    setIsConnected(false);
    setChainId(null);
  }, [evmAddress]);

  // ---- listen for MetaMask account changes --------------------------------

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectEvm();
      } else {
        const newAccount = accounts[0];
        setEvmAddress(newAccount);
        initializeSession(newAccount);
      }
    };

    const handleChainChanged = (newChainId: string) => {
      setChainId(parseInt(newChainId, 16));
    };

    (window.ethereum as any).on?.("accountsChanged", handleAccountsChanged);
    (window.ethereum as any).on?.("chainChanged", handleChainChanged);

    return () => {
      (window.ethereum as any).removeListener?.(
        "accountsChanged",
        handleAccountsChanged
      );
      (window.ethereum as any).removeListener?.(
        "chainChanged",
        handleChainChanged
      );
    };
  }, [disconnectEvm, initializeSession]);

  // ---- render -------------------------------------------------------------

  const value: EvmWalletContextState = {
    evmAddress,
    evmBalance,
    sessionKey,
    isConnected,
    chainId,
    connectEvm,
    disconnectEvm,
    initializeSession,
    clearSession,
    refreshSession,
  };

  return (
    <EvmWalletContext.Provider value={value}>
      {children}
    </EvmWalletContext.Provider>
  );
}
