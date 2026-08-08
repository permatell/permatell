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
import {
  detectEvmEnvironment,
  INITIAL_EVM_ENVIRONMENT,
  type EvmBrowserEnvironment,
} from "@/lib/evmEnvironment";
import {
  getInjectedEvmProvider,
  type Eip1193Provider,
} from "@/lib/evmProvider";
import {
  buildEvmOwnershipMessage,
  proofKey,
  readEvmProofs,
  verifyEvmOwnershipSignature,
  writeEvmProofs,
  type EvmAddressProof,
} from "@/lib/evmProof";

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

const POAP_OWNER_STORAGE_KEY = "permatell_poap_owner_address";

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
  /** What this browser can actually do about connecting an EVM wallet. */
  evmEnvironment: EvmBrowserEnvironment;
  /**
   * Address whose POAPs are being browsed. Shared across the POMP pages so a
   * manually entered address survives navigation between them. Read-only on its
   * own: minting additionally requires `isAddressProven`.
   */
  poapOwnerAddress: string | null;
  setPoapOwnerAddress: (address: string | null) => void;
  /** Accepts a 0x address or an ENS name and returns a checksummed address. */
  resolveOwnerAddress: (value: string) => Promise<string>;
  evmProofs: Record<string, EvmAddressProof>;
  isAddressProven: (address: string | null | undefined) => boolean;
  ownershipMessageFor: (address: string) => string;
  /** Signs the proof message with the connected wallet, for copying elsewhere. */
  signOwnershipProof: (address: string) => Promise<string>;
  /** Verifies a signature pasted from another browser and stores the proof. */
  addPastedOwnershipProof: (
    address: string,
    signature: string
  ) => Promise<EvmAddressProof>;
  clearOwnershipProof: (address: string) => void;
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
  evmEnvironment: INITIAL_EVM_ENVIRONMENT,
  poapOwnerAddress: null,
  setPoapOwnerAddress: () => {},
  resolveOwnerAddress: async (value: string) => value,
  evmProofs: {},
  isAddressProven: () => false,
  ownershipMessageFor: (address: string) => address,
  signOwnershipProof: async () => "",
  addPastedOwnershipProof: async () => {
    throw new Error("EVM wallet context is unavailable.");
  },
  clearOwnershipProof: () => {},
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
  const [evmEnvironment, setEvmEnvironment] = useState<EvmBrowserEnvironment>(
    INITIAL_EVM_ENVIRONMENT
  );
  const [poapOwnerAddress, setPoapOwnerAddressState] = useState<string | null>(
    null
  );
  const [evmProofs, setEvmProofs] = useState<Record<string, EvmAddressProof>>(
    {}
  );
  const walletConnectProviderRef = useRef<
    InstanceType<typeof WalletConnectProvider> | null
  >(null);
  /** Whatever provider the current connection came from, for message signing. */
  const activeProviderRef = useRef<Eip1193Provider | null>(null);

  // ---- environment + persisted state --------------------------------------

  useEffect(() => {
    const refresh = () => setEvmEnvironment(detectEvmEnvironment());
    refresh();
    // Wander injects `window.arweaveWallet` asynchronously, and that presence
    // is part of how the in-app browser is recognised.
    window.addEventListener("arweaveWalletLoaded", refresh);
    return () => window.removeEventListener("arweaveWalletLoaded", refresh);
  }, []);

  useEffect(() => {
    setEvmProofs(readEvmProofs());
    try {
      const stored = localStorage.getItem(POAP_OWNER_STORAGE_KEY);
      if (stored) setPoapOwnerAddressState(stored);
    } catch {
      // Ignore unavailable storage.
    }
  }, []);

  const setPoapOwnerAddress = useCallback((address: string | null) => {
    setPoapOwnerAddressState(address);
    try {
      if (address) localStorage.setItem(POAP_OWNER_STORAGE_KEY, address);
      else localStorage.removeItem(POAP_OWNER_STORAGE_KEY);
    } catch {
      // Ignore unavailable storage.
    }
  }, []);

  const resolveOwnerAddress = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) throw new Error("Enter an EVM address or ENS name.");
    const response = await fetch(
      `/api/evm/resolve?value=${encodeURIComponent(trimmed)}`,
      { cache: "no-store" }
    );
    const json = await response.json().catch(() => ({}));
    if (!response.ok || !json?.address) {
      throw new Error(json?.error || "Unable to resolve that address.");
    }
    return String(json.address);
  }, []);

  // ---- proof of address control -------------------------------------------

  const storeProof = useCallback((proof: EvmAddressProof) => {
    setEvmProofs((current) => {
      const next = { ...current, [proofKey(proof.address)]: proof };
      writeEvmProofs(next);
      return next;
    });
  }, []);

  const isAddressProven = useCallback(
    (address: string | null | undefined) => {
      if (!address) return false;
      const key = proofKey(address);
      // A live provider connection is itself proof of control, which keeps the
      // existing desktop flow free of any extra signing step.
      if (evmAddress && proofKey(evmAddress) === key) return true;
      return Boolean(evmProofs[key]);
    },
    [evmAddress, evmProofs]
  );

  const ownershipMessageFor = useCallback(
    (address: string) => buildEvmOwnershipMessage(address),
    []
  );

  const clearOwnershipProof = useCallback((address: string) => {
    setEvmProofs((current) => {
      const next = { ...current };
      delete next[proofKey(address)];
      writeEvmProofs(next);
      return next;
    });
  }, []);

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

      activeProviderRef.current = providerLike;
      setEvmAddress(address);
      setIsConnected(true);
      setChainId(network.chainId);
      setEvmBalance(ethers.utils.formatEther(balance));
      setPoapOwnerAddress(address);

      // auto-initialise session key
      await initializeSession(address);
      return address;
    } catch (err) {
      console.error("EVM connect failed:", err);
      return null;
    }
  }, [initializeSession, setPoapOwnerAddress]);

  const signOwnershipProof = useCallback(
    async (address: string): Promise<string> => {
      const providerLike =
        activeProviderRef.current || getInjectedEvmProvider();
      if (!providerLike) {
        throw new Error(
          "Connect an EVM wallet in this browser before signing the proof."
        );
      }
      const provider = new ethers.providers.Web3Provider(providerLike as any);
      const signer = provider.getSigner(address);
      const message = buildEvmOwnershipMessage(address);
      const signature = await signer.signMessage(message);
      const proof = await verifyEvmOwnershipSignature({ address, signature });
      storeProof({
        address: proof.address,
        message: proof.message,
        signature: proof.signature,
        period: proof.period,
        verifiedAt: Date.now(),
      });
      return proof.signature;
    },
    [storeProof]
  );

  const addPastedOwnershipProof = useCallback(
    async (address: string, signature: string): Promise<EvmAddressProof> => {
      const verified = await verifyEvmOwnershipSignature({
        address,
        signature,
      });
      const proof: EvmAddressProof = {
        address: verified.address,
        message: verified.message,
        signature: verified.signature,
        period: verified.period,
        verifiedAt: Date.now(),
      };
      storeProof(proof);
      return proof;
    },
    [storeProof]
  );

  const disconnectEvm = useCallback(() => {
    if (evmAddress) {
      clearSessionKey(evmAddress);
      clearOwnershipProof(evmAddress);
    }
    void walletConnectProviderRef.current?.disconnect().catch(() => undefined);
    walletConnectProviderRef.current = null;
    activeProviderRef.current = null;
    setEvmAddress(null);
    setEvmBalance(null);
    setSessionKey(null);
    setIsConnected(false);
    setChainId(null);
  }, [clearOwnershipProof, evmAddress]);

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
        setPoapOwnerAddress(newAccount);
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
  }, [disconnectEvm, initializeSession, setPoapOwnerAddress]);

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
    evmEnvironment,
    poapOwnerAddress,
    setPoapOwnerAddress,
    resolveOwnerAddress,
    evmProofs,
    isAddressProven,
    ownershipMessageFor,
    signOwnershipProof,
    addPastedOwnershipProof,
    clearOwnershipProof,
  };

  return (
    <EvmWalletContext.Provider value={value}>
      {children}
    </EvmWalletContext.Provider>
  );
}
