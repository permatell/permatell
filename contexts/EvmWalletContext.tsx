"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { ethers } from "ethers";
// Type-only import: the WalletConnect provider is loaded lazily inside
// `connectEvm` so its browser-only module graph never reaches the SSR bundle.
import type { EthereumProvider as WalletConnectProvider } from "@walletconnect/ethereum-provider";
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

type Eip1193Provider = {
  request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeListener?: (event: string, handler: (...args: any[]) => void) => void;
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
  isBraveWallet?: boolean;
  isPhantom?: boolean;
  selectedAddress?: string;
  chainId?: string;
};

function getInjectedEvmProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  const injected = window.ethereum as Eip1193Provider | undefined;
  if (!injected) return null;

  const providers = Array.isArray(injected.providers)
    ? injected.providers
    : [injected];

  return (
    providers.find((provider) => provider.isMetaMask) ||
    providers.find((provider) => provider.isRabby) ||
    providers.find((provider) => provider.isCoinbaseWallet) ||
    providers.find((provider) => provider.isBraveWallet) ||
    providers.find(
      (provider) => provider.isPhantom && typeof provider.request === "function"
    ) ||
    providers.find((provider) => typeof provider.request === "function") ||
    null
  );
}

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
  const walletConnectProviderRef = useRef<
    InstanceType<typeof WalletConnectProvider> | null
  >(null);

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

  // ---- wallet connection via injected providers or WalletConnect -----------

  const connectEvm = useCallback(async (): Promise<string | null> => {
    if (!FEATURES.EVM_WALLET) return null;
    let providerLike = getInjectedEvmProvider();

    if (!providerLike) {
      const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
      if (!projectId || projectId === "YOUR_PROJECT_ID") {
        throw new Error(
          "Mobile wallet connection is not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID."
        );
      }

      const { EthereumProvider } = await import(
        "@walletconnect/ethereum-provider"
      );

      const walletConnectProvider =
        walletConnectProviderRef.current ||
        (await EthereumProvider.init({
          projectId,
          chains: [1],
          optionalChains: [100, 137, 8453, 42161, 59144, 42220],
          showQrModal: true,
          metadata: {
            name: "PermaTell",
            description: "Permanent stories and POMP memories",
            url: window.location.origin,
            icons: [`${window.location.origin}/favicon.svg`],
          },
        }));

      walletConnectProviderRef.current = walletConnectProvider;
      if (!walletConnectProvider.connected) {
        await walletConnectProvider.connect();
      }
      providerLike = walletConnectProvider as unknown as Eip1193Provider;
    }

    try {
      const provider = new ethers.providers.Web3Provider(providerLike as any);
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
    void walletConnectProviderRef.current?.disconnect().catch(() => undefined);
    walletConnectProviderRef.current = null;
    setEvmAddress(null);
    setEvmBalance(null);
    setSessionKey(null);
    setIsConnected(false);
    setChainId(null);
  }, [evmAddress]);

  // ---- listen for MetaMask account changes --------------------------------

  useEffect(() => {
    const injectedProvider = getInjectedEvmProvider();
    if (!injectedProvider) return;

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

    injectedProvider.on?.("accountsChanged", handleAccountsChanged);
    injectedProvider.on?.("chainChanged", handleChainChanged);

    return () => {
      injectedProvider.removeListener?.("accountsChanged", handleAccountsChanged);
      injectedProvider.removeListener?.("chainChanged", handleChainChanged);
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
