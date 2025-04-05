"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { connect, createDataItemSigner } from "@permaweb/aoconnect";

const GATEWAY_URL = "https://arweave.net";
const MU_URL = "https://mu.ao-testnet.xyz";
const CU_URL = "https://cu.ao-testnet.xyz";
const PROCESS_ID = "CiCoT60SUbCAJYY2ncv_-BJOQvGB0tHib_mTLJv4Q6Q"; // Using the same process ID as StoryPoints for now

const { dryrun, message } = connect({
  MU_URL,
  CU_URL,
  GATEWAY_URL,
});

export interface AOProfileData {
  id: string;
  wallet_address: string;
  username: string;
  bio: string;
  avatar_url: string;
  social_links: {
    twitter?: string;
    github?: string;
    website?: string;
  };
  created_at: string;
  updated_at: string;
}

interface AOProfileContextType {
  profile: AOProfileData | null;
  loading: boolean;
  error: string | null;
  createProfile: (data: Omit<AOProfileData, "id" | "created_at" | "updated_at">) => Promise<void>;
  updateProfile: (data: Partial<AOProfileData>) => Promise<void>;
  getProfileById: (id: string) => Promise<AOProfileData | null>;
  getProfileByWalletAddress: (walletAddress: string) => Promise<AOProfileData | null>;
  fetchProfile: () => Promise<void>;
}

const AOProfileContext = createContext<AOProfileContextType | undefined>(undefined);

export const AOProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { address } = useWallet();
  const [profile, setProfile] = useState<AOProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const sendMessage = async (tags: { name: string; value: string }[]) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    const signer = createDataItemSigner(globalThis.arweaveWallet);
    const res = await message({
      process: PROCESS_ID,
      tags,
      signer,
    });
    return res;
  };

  const createProfile = useCallback(async (data: Omit<AOProfileData, "id" | "created_at" | "updated_at">) => {
    if (!address) {
      throw new Error("Wallet not connected");
    }

    setLoading(true);
    setError(null);

    try {
      await sendMessage([
        { name: "Action", value: "CreateProfile" },
        { name: "wallet_address", value: address },
        { name: "username", value: data.username },
        { name: "bio", value: data.bio },
        { name: "avatar_url", value: data.avatar_url },
        { name: "social_links", value: JSON.stringify(data.social_links) },
      ]);

      // Fetch the updated profile
      await fetchProfile();
    } catch (error) {
      console.error("Error creating profile:", error);
      setError("Failed to create profile");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [address]);

  const updateProfile = useCallback(async (data: Partial<AOProfileData>) => {
    if (!address || !profile) {
      throw new Error("Wallet not connected or profile not found");
    }

    setLoading(true);
    setError(null);

    try {
      const updatedData = {
        ...profile,
        ...data,
        updated_at: new Date().toISOString(),
      };

      await sendMessage([
        { name: "Action", value: "UpdateProfile" },
        { name: "profile_id", value: profile.id },
        { name: "wallet_address", value: address },
        { name: "username", value: updatedData.username },
        { name: "bio", value: updatedData.bio },
        { name: "avatar_url", value: updatedData.avatar_url },
        { name: "social_links", value: JSON.stringify(updatedData.social_links) },
      ]);

      // Fetch the updated profile
      await fetchProfile();
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update profile");
      throw error;
    } finally {
      setLoading(false);
    }
  }, [address, profile]);

  const getProfileById = useCallback(async (id: string): Promise<AOProfileData | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await getDryrunResult([
        { name: "Action", value: "GetProfileById" },
        { name: "profile_id", value: id },
      ]);

      return result;
    } catch (error) {
      console.error("Error getting profile by ID:", error);
      setError("Failed to get profile");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProfileByWalletAddress = useCallback(async (walletAddress: string): Promise<AOProfileData | null> => {
    setLoading(true);
    setError(null);

    try {
      const result = await getDryrunResult([
        { name: "Action", value: "GetProfileByWalletAddress" },
        { name: "wallet_address", value: walletAddress },
      ]);

      return result;
    } catch (error) {
      console.error("Error getting profile by wallet address:", error);
      setError("Failed to get profile");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    if (!address) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await getProfileByWalletAddress(address);
      setProfile(result);
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError("Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  }, [address, getProfileByWalletAddress]);

  useEffect(() => {
    if (address) {
      fetchProfile();
    } else {
      setProfile(null);
    }
  }, [address, fetchProfile]);

  return (
    <AOProfileContext.Provider
      value={{
        profile,
        loading,
        error,
        createProfile,
        updateProfile,
        getProfileById,
        getProfileByWalletAddress,
        fetchProfile,
      }}
    >
      {children}
    </AOProfileContext.Provider>
  );
};

export const useAOProfile = () => {
  const context = useContext(AOProfileContext);
  if (context === undefined) {
    throw new Error("useAOProfile must be used within an AOProfileProvider");
  }
  return context;
}; 