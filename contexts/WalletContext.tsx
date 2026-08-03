"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useWallet as useAOSyncWallet } from "@vela-ventures/aosync-sdk-react";
import Arweave from "arweave";
import AOProfile from "@permaweb/aoprofile";
import { arnManager } from "@/lib/ario";
import { useEvmWallet } from "./EvmWalletContext";
import { arnsCache, generateCacheKey } from "@/utils/cache";
import { createDataItemSigner, FEATURES, getAO } from "@/lib/ao-config";
import { getZoneProfileByWalletAddress } from "@/lib/profileLookup";

// Initialize Arweave
const arweave = Arweave.init({});

function normalizeProfileMediaUrl(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    return normalizeProfileMediaUrl(
      source.url || source.src || source.href || source.txId || source.id
    );
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "None") return null;
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    const match = trimmed.match(/\/([A-Za-z0-9_-]{43})(?:$|[?#/])/);
    if (
      match?.[1] &&
      /:\/\/(?:[^/]+\.)?(?:arweave\.net|arweave\.dev|g8way\.io|ar-io\.dev|permagate\.io|turbo-gateway\.com|akrd\.net|ardrive\.net)\//i.test(
        trimmed
      )
    ) {
      return `https://arweave.net/${match[1]}`;
    }
    return trimmed;
  }
  const id = trimmed.startsWith("ar://") ? trimmed.slice(5) : trimmed;
  return id ? `https://arweave.net/${id}` : null;
}

export type WalletType = "wander" | "beacon" | "evm" | null;

export interface AOProfileData {
  id?: string;
  userName?: string;
  displayName?: string;
  description?: string;
  thumbnail?: string;
  banner?: string;
  wallet_address?: string;
  created_at?: string;
  updated_at?: string;
  social_links?: {
    twitter?: string;
    github?: string;
    website?: string;
  };
  primaryArn?: string;
  allArns?: string[];
  pendingArnRequest?: string;
  gatewayNode?: string;
  balance?: number;
  assets?: string[];
}

interface WalletContextType {
  address: string | null;
  walletType: WalletType;
  connectWallet: () => Promise<void>;
  connectAOsyncWallet: () => Promise<void>;
  connectEvmWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  loading: boolean;
  profile: AOProfileData | null;
  profileLoading: boolean;
  createProfile: (profileData: AOProfileData) => Promise<string | null>;
  updateProfile: (
    profileId: string,
    profileData: AOProfileData
  ) => Promise<string | null>;
  requestPrimaryArn: (name: string) => Promise<void>;
  checkPendingArnRequest: () => Promise<string | null>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profile, setProfile] = useState<AOProfileData | null>(null);
  const [profileSDK, setProfileSDK] = useState<any | null>(null);

  const {
    connect: connectAOSync,
    getAddress: getAOSyncAddress,
    isConnected: isAOSyncConnected,
    disconnect: disconnectAOSync,
  } = useAOSyncWallet();

  // EVM wallet integration
  const evmWallet = useEvmWallet();

  // Initialize the AO Profile SDK when address changes
  useEffect(() => {
    if (!address) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    const initializeProfile = async () => {
      try {
        console.log("Initializing SDKs for address:", address);

        // Create a data item signer using the connected wallet
        // For EVM wallets, we use the session key; for AR wallets, the native signer
        let signer: any;
        if (walletType === "evm" && evmWallet.sessionKey) {
          // TODO: For EVM wallets, the session key would need to be adapted
          // to an Arweave-compatible signer. For now, skip profile SDK init
          // for EVM wallets until the bridge is fully implemented.
          console.log("EVM wallet connected – session key available.");
          setProfileLoading(false);
          return;
        } else if (window.arweaveWallet) {
          signer = createDataItemSigner(window.arweaveWallet);
        } else {
          console.warn("No wallet available for signing");
          setProfileLoading(false);
          return;
        }

        // Initialize the AO Profile SDK
        const {
          createProfile,
          updateProfile,
          getProfileById,
          getProfileByWalletAddress,
          getRegistryProfiles,
        } = AOProfile.init({ ao: getAO(), signer, arweave });

        setProfileSDK({
          createProfile,
          updateProfile,
          getProfileById,
          getProfileByWalletAddress,
          getRegistryProfiles,
        });

        // Fetch the user's profile and ARN data in parallel
        setProfileLoading(true);
        try {
          console.log("Fetching profile and ARN data...");

          // Check cache first
          const cacheKey = generateCacheKey("arns", address);
          const cachedProfile = arnsCache.get(cacheKey);

          if (cachedProfile) {
            setProfile(cachedProfile);
            setProfileLoading(false);
            return;
          }

          // Prefer the Portal/Bazar Zone profile lookup used by StreamVault.
          // The aoprofile registry delegate dry-run can fail on forward.computer,
          // even when the wallet already owns a valid Zone profile.
          let userProfile = await getZoneProfileByWalletAddress(address);
          if (!userProfile) {
            try {
              userProfile = await getProfileByWalletAddress({ address });
            } catch (profileError) {
              console.warn(
                "AO Profile registry lookup failed; no Zone profile fallback found:",
                profileError
              );
            }
          }
          console.log("AO Profile fetched:", userProfile);

          // Then fetch ArNS data
          let arnsData: {
            primaryArn: string | null;
            allArns: string[];
            pendingArnRequest: string | null;
            balance: number;
            gatewayNode?: string;
          } = {
            primaryArn: null,
            allArns: [],
            pendingArnRequest: null,
            balance: 0,
          };

          try {
            console.log("Fetching ArNS data...");
            const [
              primaryArn,
              allArns,
              pendingRequest,
              balanceResult,
              gatewayNode,
            ] = await Promise.all([
              arnManager.getPrimaryARN(address),
              arnManager.getAllPrimaryNames(address),
              arnManager.checkPrimaryNameRequest(address),
              arnManager.checkBalance(address),
              arnManager.getGatewayNode(address),
            ]);

            arnsData = {
              primaryArn,
              allArns: allArns.map((arn) => arn.domain),
              pendingArnRequest: pendingRequest?.domain || null,
              balance: balanceResult?.balance || 0,
              gatewayNode: gatewayNode?.fqdn || undefined,
            };

            console.log("ArNS data fetched:", arnsData);
          } catch (arnsError) {
            console.error("Error fetching ArNS data:", arnsError);
          }

          // Process the profile to ensure image URLs have the Arweave gateway prefix
          if (userProfile) {
            const processedProfile = {
              ...userProfile,
              primaryArn: arnsData.primaryArn,
              allArns: arnsData.allArns,
              pendingArnRequest: arnsData.pendingArnRequest,
              balance: arnsData.balance,
              gatewayNode: arnsData.gatewayNode,
              thumbnail: normalizeProfileMediaUrl(
                userProfile.thumbnail ||
                  userProfile.Thumbnail ||
                  userProfile.avatar ||
                  userProfile.Avatar ||
                  userProfile.image ||
                  userProfile.Image ||
                  userProfile.profileImage ||
                  userProfile.ProfileImage
              ),
              banner: normalizeProfileMediaUrl(
                userProfile.banner ||
                  userProfile.Banner ||
                  userProfile.cover ||
                  userProfile.Cover ||
                  userProfile.coverImage ||
                  userProfile.CoverImage
              ),
              assets: userProfile.assets || [],
            };

            console.log("Processed profile with ArNS data:", processedProfile);

            // Cache the processed profile
            arnsCache.set(cacheKey, processedProfile);

            setProfile(processedProfile);
          } else {
            console.log("No AO profile found for address:", address);
            setProfile(null);
          }
        } catch (err) {
          console.error("Error fetching profile and ARN data:", err);
          setProfile(null);
        } finally {
          setProfileLoading(false);
        }
      } catch (err) {
        console.error("Error initializing profile:", err);
        setProfile(null);
        setProfileLoading(false);
      }
    };

    initializeProfile();
  }, [address, walletType]);

  // ---- Wallet connect handlers -------------------------------------------

  const connectWallet = async () => {
    try {
      setLoading(true);
      await globalThis.arweaveWallet.connect([
        "ACCESS_ADDRESS",
        "SIGN_TRANSACTION",
      ]);
      const walletAddress = await globalThis.arweaveWallet.getActiveAddress();
      setAddress(walletAddress);
      setWalletType("wander");
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const connectAOsyncWallet = async () => {
    try {
      setLoading(true);
      await connectAOSync();
      const walletAddress = await getAOSyncAddress();
      if (walletAddress) {
        setAddress(walletAddress);
        setWalletType("beacon");
      }
    } catch (error) {
      console.error("Failed to connect AOSync wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const connectEvmWallet = async () => {
    if (!FEATURES.EVM_WALLET) {
      console.warn("EVM wallet feature is disabled.");
      return;
    }
    try {
      setLoading(true);
      const evmAddress = await evmWallet.connectEvm();
      if (evmAddress) {
        setAddress(evmAddress);
        setWalletType("evm");
      }
    } catch (error) {
      console.error("Failed to connect EVM wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  // React to EVM wallet connecting externally
  useEffect(() => {
    if (
      evmWallet.isConnected &&
      evmWallet.evmAddress &&
      walletType === null
    ) {
      // Only auto-set if no wallet is currently connected
      setAddress(evmWallet.evmAddress);
      setWalletType("evm");
    }
  }, [evmWallet.isConnected, evmWallet.evmAddress, walletType]);

  const disconnectWallet = async () => {
    try {
      setLoading(true);
      if (walletType === "wander") {
        await globalThis.arweaveWallet.disconnect();
      } else if (walletType === "beacon") {
        await disconnectAOSync();
      } else if (walletType === "evm") {
        evmWallet.disconnectEvm();
      }
      setAddress(null);
      setWalletType(null);
      setProfile(null);
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---- Profile CRUD -------------------------------------------------------

  const createProfile = async (
    profileData: AOProfileData
  ): Promise<string | null> => {
    if (!address) {
      console.error("Cannot create profile: wallet not connected");
      return null;
    }

    try {
      setProfileLoading(true);

      if (!profileSDK) {
        console.error("AO Profile SDK not initialized");
        return null;
      }

      const profileToCreate = {
        ...profileData,
        wallet_address: address,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const profileId = await profileSDK.createProfile(profileToCreate);

      // Refresh the profile
      const newProfile = await profileSDK.getProfileById({ profileId });

      if (newProfile) {
        if (newProfile.thumbnail && !newProfile.thumbnail.startsWith("http")) {
          newProfile.thumbnail = `https://arweave.net/${newProfile.thumbnail}`;
        }
        if (newProfile.banner && !newProfile.banner.startsWith("http")) {
          newProfile.banner = `https://arweave.net/${newProfile.banner}`;
        }
      }

      setProfile(newProfile);
      return profileId;
    } catch (err) {
      console.error("Error creating AO Profile:", err);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  const updateProfile = async (
    profileId: string,
    profileData: AOProfileData
  ): Promise<string | null> => {
    if (!address) {
      console.error("Cannot update profile: wallet not connected");
      return null;
    }

    try {
      setProfileLoading(true);

      if (!profileSDK) {
        console.error("AO Profile SDK not initialized");
        return null;
      }

      const profileToUpdate = {
        ...profileData,
        wallet_address: address,
        updated_at: new Date().toISOString(),
      };

      const updateId = await profileSDK.updateProfile({
        profileId,
        ...profileToUpdate,
      });

      // Refresh the profile
      const updatedProfile = await profileSDK.getProfileById({ profileId });

      if (updatedProfile) {
        if (
          updatedProfile.thumbnail &&
          !updatedProfile.thumbnail.startsWith("http")
        ) {
          updatedProfile.thumbnail = `https://arweave.net/${updatedProfile.thumbnail}`;
        }
        if (
          updatedProfile.banner &&
          !updatedProfile.banner.startsWith("http")
        ) {
          updatedProfile.banner = `https://arweave.net/${updatedProfile.banner}`;
        }
      }

      setProfile(updatedProfile);
      return updateId;
    } catch (err) {
      console.error("Error updating AO Profile:", err);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  // ---- ArNS helpers -------------------------------------------------------

  const requestPrimaryArn = async (name: string) => {
    if (!address) {
      console.error("Cannot request primary ARN: wallet not connected");
      return;
    }

    try {
      setLoading(true);
      await arnManager.requestPrimaryName(name, address);

      const pendingRequest = await arnManager.checkPrimaryNameRequest(address);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              pendingArnRequest: pendingRequest?.domain,
            }
          : null
      );
    } catch (error) {
      console.error("Error requesting primary ARN:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const checkPendingArnRequest = async () => {
    if (!address) return null;
    try {
      const request = await arnManager.checkPrimaryNameRequest(address);
      return request?.domain || null;
    } catch (error) {
      console.error("Error checking pending ARN request:", error);
      return null;
    }
  };

  const refreshBalance = async () => {
    if (!address) return;
    try {
      const balanceResult = await arnManager.checkBalance(address);
      if (profile) {
        setProfile({
          ...profile,
          balance: balanceResult.balance,
        });
      }
    } catch (error) {
      console.error("Error refreshing balance:", error);
    }
  };

  // ---- Lifecycle -----------------------------------------------------------

  useEffect(() => {
    const disconnectOnReload = async () => {
      setLoading(true);
      try {
        if (globalThis.arweaveWallet) {
          await globalThis.arweaveWallet.disconnect();
        }
        await disconnectAOSync();
        setAddress(null);
        setWalletType(null);
        setProfile(null);
      } catch (error) {
        console.error("Error disconnecting wallet on reload:", error);
      } finally {
        setLoading(false);
      }
    };

    disconnectOnReload();
  }, []);

  useEffect(() => {
    const handleDisconnect = async () => {
      if (isAOSyncConnected === false && walletType === "beacon") {
        setLoading(true);
        try {
          if (globalThis.arweaveWallet) {
            await globalThis.arweaveWallet.disconnect();
          }
          setAddress(null);
          setWalletType(null);
          setProfile(null);
        } catch (error) {
          console.error("Error disconnecting from beacon:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    handleDisconnect();
  }, [isAOSyncConnected, walletType]);

  return (
    <WalletContext.Provider
      value={{
        address,
        walletType,
        connectWallet,
        connectAOsyncWallet,
        connectEvmWallet,
        disconnectWallet,
        loading,
        profile,
        profileLoading,
        createProfile,
        updateProfile,
        requestPrimaryArn,
        checkPendingArnRequest,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = (): WalletContextType => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
};
