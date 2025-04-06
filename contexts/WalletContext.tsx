"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { useWallet as useAOSyncWallet } from "@vela-ventures/aosync-sdk-react";
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import AOProfile from '@permaweb/aoprofile';
import { arnManager } from '@/lib/ario';
import { useRouter } from 'next/navigation';
import { useStoriesProcess } from './StoriesProcessContext';
import { useStoryPointsProcess } from './StoryPointsProcessContext';
import { useAOProfile } from './AOProfileContext';
import { arnsCache, generateCacheKey } from "@/utils/cache";

// Initialize Arweave
const arweave = Arweave.init({});

// Initialize AO connection
const aoConnection = connect();

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
  connectWallet: () => Promise<void>;
  connectAOsyncWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  loading: boolean;
  profile: AOProfileData | null;
  profileLoading: boolean;
  createProfile: (profileData: AOProfileData) => Promise<string | null>;
  updateProfile: (profileId: string, profileData: AOProfileData) => Promise<string | null>;
  requestPrimaryArn: (name: string) => Promise<void>;
  checkPendingArnRequest: () => Promise<string | null>;
  refreshBalance: () => Promise<void>;
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
      setProfileLoading(false);
      return;
    }

    const initializeProfile = async () => {
      try {
        console.log('Initializing SDKs for address:', address);
        
        // Create a data item signer using the connected wallet
        const signer = createDataItemSigner(window.arweaveWallet);
        
        // Initialize the AO Profile SDK
        const { 
          createProfile, 
          updateProfile, 
          getProfileById, 
          getProfileByWalletAddress, 
          getRegistryProfiles 
        } = AOProfile.init({ ao: aoConnection, signer, arweave });
        
        setProfileSDK({
          createProfile,
          updateProfile,
          getProfileById,
          getProfileByWalletAddress,
          getRegistryProfiles
        });
        
        // Fetch the user's profile and ARN data in parallel
        setProfileLoading(true);
        try {
          console.log('Fetching profile and ARN data...');
          
          // Check cache first
          const cacheKey = generateCacheKey('arns', address);
          const cachedProfile = arnsCache.get(cacheKey);
          
          if (cachedProfile) {
            setProfile(cachedProfile);
            setProfileLoading(false);
            return;
          }
          
          // Fetch the profile
          const userProfile = await getProfileByWalletAddress({ address });
          console.log('AO Profile fetched:', userProfile);
          
          // Then fetch ArNS data using our new AO-based implementation
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
            balance: 0
          };
          
          try {
            console.log('Fetching ArNS data...');
            const [primaryArn, allArns, pendingRequest, balanceResult, gatewayNode] = await Promise.all([
              arnManager.getPrimaryARN(address),
              arnManager.getAllPrimaryNames(address),
              arnManager.checkPrimaryNameRequest(address),
              arnManager.checkBalance(address),
              arnManager.getGatewayNode(address)
            ]);
            
            arnsData = {
              primaryArn,
              allArns: allArns.map(arn => arn.domain),
              pendingArnRequest: pendingRequest?.domain || null,
              balance: balanceResult?.balance || 0,
              gatewayNode: gatewayNode?.fqdn || undefined
            };
            
            console.log('ArNS data fetched:', arnsData);
          } catch (arnsError) {
            console.error('Error fetching ArNS data:', arnsError);
            // Continue with empty ArNS data
            // The ArNSDisplay component will handle displaying appropriate error messages
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
              thumbnail: userProfile.thumbnail ? 
                (userProfile.thumbnail.startsWith('http') ? 
                  userProfile.thumbnail : 
                  `https://arweave.net/${userProfile.thumbnail}`
                ) : null,
              banner: userProfile.banner ? 
                (userProfile.banner.startsWith('http') ? 
                  userProfile.banner : 
                  `https://arweave.net/${userProfile.banner}`
                ) : null,
              // Keep the assets array as is, we'll handle the URLs in the UI
              assets: userProfile.assets || []
            };
            
            console.log('Processed profile with ArNS data:', processedProfile);
            
            // Cache the processed profile
            arnsCache.set(cacheKey, processedProfile);
            
            setProfile(processedProfile);
          } else {
            console.log('No AO profile found for address:', address);
            setProfile(null);
          }
        } catch (err) {
          console.error('Error fetching profile and ARN data:', err);
          setProfile(null);
        } finally {
          setProfileLoading(false);
        }
      } catch (err) {
        console.error('Error initializing profile:', err);
        setProfile(null);
        setProfileLoading(false);
      }
    };

    initializeProfile();
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

  // Add function to request a primary ARN
  const requestPrimaryArn = async (name: string) => {
    if (!address) {
      console.error('Cannot request primary ARN: wallet not connected');
      return;
    }

    try {
      setLoading(true);
      await arnManager.requestPrimaryName(name, address);
      
      // Refresh profile to update ARN status
      const pendingRequest = await arnManager.checkPrimaryNameRequest(address);
      setProfile(prev => prev ? {
        ...prev,
        pendingArnRequest: pendingRequest?.domain
      } : null);
    } catch (error) {
      console.error('Error requesting primary ARN:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Add function to check pending ARN requests
  const checkPendingArnRequest = async () => {
    if (!address) return null;
    
    try {
      const request = await arnManager.checkPrimaryNameRequest(address);
      return request?.domain || null;
    } catch (error) {
      console.error('Error checking pending ARN request:', error);
      return null;
    }
  };

  // Function to refresh the ARIO balance
  const refreshBalance = async () => {
    if (!address) return;
    
    try {
      console.log('Refreshing ARIO balance for address:', address);
      const balanceResult = await arnManager.checkBalance(address);
      console.log('New balance result:', balanceResult);
      
      if (profile) {
        setProfile({
          ...profile,
          balance: balanceResult.balance
        });
      }
    } catch (error) {
      console.error('Error refreshing balance:', error);
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
        connectAOsyncWallet,
        disconnectWallet,
        loading,
        profile,
        profileLoading,
        createProfile,
        updateProfile,
        requestPrimaryArn,
        checkPendingArnRequest,
        refreshBalance
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
