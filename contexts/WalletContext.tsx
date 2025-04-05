"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useWallet as useAOSyncWallet } from "@vela-ventures/aosync-sdk-react";
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import AOProfile from '@permaweb/aoprofile';

// Initialize Arweave
const arweave = Arweave.init({});

// Initialize AO connection
const ao = connect();

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
}

interface WalletContextType {
  address: string | null;
  connectWallet: () => Promise<void>;
  connectAOsyncWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  loading: boolean;
  profile: AOProfileData | null;
  profileLoading: boolean;
  createProfile: (profileData: AOProfileData) => Promise<string | null>;
  updateProfile: (profileId: string, profileData: AOProfileData) => Promise<string | null>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [address, setAddress] = useState<string | null>(null);
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

  // Initialize the AO Profile SDK when address changes
  useEffect(() => {
    if (!address) {
      setProfile(null);
      return;
    }

    const initSDK = async () => {
      try {
        // Create a data item signer using the connected wallet
        const signer = createDataItemSigner(window.arweaveWallet);
        
        // Initialize the AO Profile SDK
        const { 
          createProfile, 
          updateProfile, 
          getProfileById, 
          getProfileByWalletAddress, 
          getRegistryProfiles 
        } = AOProfile.init({ ao, signer, arweave });
        
        setProfileSDK({
          createProfile,
          updateProfile,
          getProfileById,
          getProfileByWalletAddress,
          getRegistryProfiles
        });
        
        // Fetch the user's profile
        setProfileLoading(true);
        try {
          const userProfile = await getProfileByWalletAddress({ address });
          
          // Process the profile to ensure image URLs have the Arweave gateway prefix
          if (userProfile) {
            // Add Arweave gateway URL to thumbnail and banner if they're just transaction IDs
            if (userProfile.thumbnail && !userProfile.thumbnail.startsWith('http')) {
              userProfile.thumbnail = `https://arweave.net/${userProfile.thumbnail}`;
            }
            
            if (userProfile.banner && !userProfile.banner.startsWith('http')) {
              userProfile.banner = `https://arweave.net/${userProfile.banner}`;
            }
          }
          
          setProfile(userProfile);
        } catch (err) {
          console.error('Error fetching AO Profile:', err);
          setProfile(null);
        } finally {
          setProfileLoading(false);
        }
      } catch (err) {
        console.error('Error initializing AO Profile SDK:', err);
        setProfile(null);
        setProfileLoading(false);
      }
    };

    initSDK();
  }, [address]);

  const connectWallet = async () => {
    try {
      setLoading(true);
      await globalThis.arweaveWallet.connect([
        "ACCESS_ADDRESS",
        "SIGN_TRANSACTION",
      ]);
      const walletAddress = await globalThis.arweaveWallet.getActiveAddress();
      setAddress(walletAddress);
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
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      setLoading(true);
      await globalThis.arweaveWallet.disconnect();
      setAddress(null);
      setProfile(null);
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  // Create a new profile
  const createProfile = async (profileData: AOProfileData): Promise<string | null> => {
    if (!address) {
      console.error('Cannot create profile: wallet not connected');
      return null;
    }
    
    try {
      setProfileLoading(true);
      
      if (!profileSDK) {
        console.error('AO Profile SDK not initialized');
        return null;
      }
      
      // Ensure the profile data has the required fields
      const profileToCreate = {
        ...profileData,
        wallet_address: address,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const profileId = await profileSDK.createProfile(profileToCreate);
      
      // Refresh the profile
      const newProfile = await profileSDK.getProfileById({ profileId });
      
      // Process the profile to ensure image URLs have the Arweave gateway prefix
      if (newProfile) {
        if (newProfile.thumbnail && !newProfile.thumbnail.startsWith('http')) {
          newProfile.thumbnail = `https://arweave.net/${newProfile.thumbnail}`;
        }
        
        if (newProfile.banner && !newProfile.banner.startsWith('http')) {
          newProfile.banner = `https://arweave.net/${newProfile.banner}`;
        }
      }
      
      setProfile(newProfile);
      
      return profileId;
    } catch (err) {
      console.error('Error creating AO Profile:', err);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  // Update an existing profile
  const updateProfile = async (profileId: string, profileData: AOProfileData): Promise<string | null> => {
    if (!address) {
      console.error('Cannot update profile: wallet not connected');
      return null;
    }
    
    try {
      setProfileLoading(true);
      
      if (!profileSDK) {
        console.error('AO Profile SDK not initialized');
        return null;
      }
      
      // Ensure the profile data has the required fields
      const profileToUpdate = {
        ...profileData,
        wallet_address: address,
        updated_at: new Date().toISOString()
      };
      
      const updateId = await profileSDK.updateProfile({
        profileId,
        ...profileToUpdate
      });
      
      // Refresh the profile
      const updatedProfile = await profileSDK.getProfileById({ profileId });
      
      // Process the profile to ensure image URLs have the Arweave gateway prefix
      if (updatedProfile) {
        if (updatedProfile.thumbnail && !updatedProfile.thumbnail.startsWith('http')) {
          updatedProfile.thumbnail = `https://arweave.net/${updatedProfile.thumbnail}`;
        }
        
        if (updatedProfile.banner && !updatedProfile.banner.startsWith('http')) {
          updatedProfile.banner = `https://arweave.net/${updatedProfile.banner}`;
        }
      }
      
      setProfile(updatedProfile);
      
      return updateId;
    } catch (err) {
      console.error('Error updating AO Profile:', err);
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  useEffect(() => {
    const disconnectOnReload = async () => {
      setLoading(true);
      try {
        await globalThis.arweaveWallet.disconnect();
        await disconnectAOSync();
        setAddress(null);
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
      if (isAOSyncConnected === false) {
        setLoading(true);
        try {
          await globalThis.arweaveWallet.disconnect();
          setAddress(null);
          setProfile(null);
        } catch (error) {
          console.error("Error disconnecting from beacon:", error);
        } finally {
          setLoading(false);
        }
      }
    };

    handleDisconnect();
  }, [isAOSyncConnected]);

  return (
    <WalletContext.Provider
      value={{
        address,
        connectWallet,
        disconnectWallet,
        connectAOsyncWallet,
        loading,
        profile,
        profileLoading,
        createProfile,
        updateProfile,
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
