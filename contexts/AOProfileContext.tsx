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
  getProfile: () => Promise<void>;
  updateProfile: (data: Partial<AOProfileData>) => Promise<void>;
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

  const getProfile = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getDryrunResult([
        { name: "Action", value: "GetProfile" },
        { name: "address", value: address },
      ]);
      
      if (result && typeof result === "object") {
        setProfile(result as AOProfileData);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError("Failed to fetch profile");
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const updateProfile = useCallback(async (data: Partial<AOProfileData>) => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const tags = [
        { name: "Action", value: "UpdateProfile" },
        { name: "address", value: address },
      ];
      
      if (data.username) tags.push({ name: "username", value: data.username });
      if (data.bio) tags.push({ name: "bio", value: data.bio });
      if (data.avatar_url) tags.push({ name: "avatar_url", value: data.avatar_url });
      
      if (data.social_links) {
        if (data.social_links.twitter) 
          tags.push({ name: "twitter", value: data.social_links.twitter });
        if (data.social_links.github) 
          tags.push({ name: "github", value: data.social_links.github });
        if (data.social_links.website) 
          tags.push({ name: "website", value: data.social_links.website });
      }
      
      await sendMessage(tags);
      await getProfile(); // Refresh profile after update
    } catch (error) {
      console.error("Error updating profile:", error);
      setError("Failed to update profile");
    } finally {
      setLoading(false);
    }
  }, [address, getProfile]);

  useEffect(() => {
    if (address) {
      getProfile();
    }
  }, [address, getProfile]);

  const value: AOProfileContextType = {
    profile,
    loading,
    error,
    getProfile,
    updateProfile,
  };

  return (
    <AOProfileContext.Provider value={value}>
      {children}
    </AOProfileContext.Provider>
  );
};

export const useAOProfile = (): AOProfileContextType => {
  const context = useContext(AOProfileContext);
  if (context === undefined) {
    throw new Error("useAOProfile must be used within an AOProfileProvider");
  }
  return context;
}; 