"use client";
import React, { createContext, useContext, useState, useEffect } from "react";
import { connect, createDataItemSigner } from '@permaweb/aoconnect';
import Arweave from 'arweave';
import AOProfile from '@permaweb/aoprofile';

// Enable simulation mode for development/testing
const SIMULATION_MODE = false;
const SIMULATED_WALLET_ADDRESS = "jt19WluLXKr9lcostp_XNmXRmpdxM4VwmXbmyDLoyNM";

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
}

interface WalletContextType {
  address: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  loading: boolean;
  profileLoading: boolean;
  profile: AOProfileData | null;
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

  // Initialize the AO Profile SDK
  useEffect(() => {
    if (!address) return;

    const initSDK = async () => {
      try {
        // SIMULATION MODE - Commented out since we now have @permaweb/aoprofile installed
        // console.log('AO Profile simulation mode enabled');
        // setProfileSDK({
        //   createProfile: async () => 'simulated-profile-id',
        //   updateProfile: async () => 'simulated-update-id',
        //   getProfileById: async () => ({
        //     id: 'simulated-profile-id',
        //     userName: 'SimulatedUser',
        //     displayName: 'Simulated User',
        //     description: 'This is a simulated profile',
        //     thumbnail: '',
        //     banner: '',
        //   }),
        //   getProfileByWalletAddress: async () => ({
        //     id: 'simulated-profile-id',
        //     userName: 'SimulatedUser',
        //     displayName: 'Simulated User',
        //     description: 'This is a simulated profile',
        //     thumbnail: '',
        //     banner: '',
        //   }),
        //   getRegistryProfiles: async () => ([]),
        // });
        // 
        // // Set simulated profile
        // setProfile({
        //   id: 'simulated-profile-id',
        //   userName: 'SimulatedUser',
        //   displayName: 'Simulated User',
        //   description: 'This is a simulated profile',
        //   thumbnail: '',
        //   banner: '',
        // });
        
        // REAL IMPLEMENTATION - Using the installed @permaweb/aoprofile package
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
      } catch (err) {
        console.error('Error in AO Profile initialization:', err);
        setProfile(null);
        setProfileLoading(false);
      }
    };

    initSDK();
  }, [address]);

  // Create a new profile
  const createProfile = async (profileData: AOProfileData): Promise<string | null> => {
    if (!address) {
      console.error('Cannot create profile: wallet not connected');
      return null;
    }
    
    try {
      setProfileLoading(true);
      
      // REAL IMPLEMENTATION - Using the installed @permaweb/aoprofile package
      if (!profileSDK) {
        console.error('AO Profile SDK not initialized');
        return null;
      }
      
      const profileId = await profileSDK.createProfile(profileData);
      
      // Refresh the profile
      const newProfile = await profileSDK.getProfileById({ profileId });
      
      // Process the profile to ensure image URLs have the Arweave gateway prefix
      if (newProfile) {
        // Add Arweave gateway URL to thumbnail and banner if they're just transaction IDs
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
      
      // REAL IMPLEMENTATION - Using the installed @permaweb/aoprofile package
      if (!profileSDK) {
        console.error('AO Profile SDK not initialized');
        return null;
      }
      
      const updateId = await profileSDK.updateProfile({
        profileId,
        ...profileData
      });
      
      // Refresh the profile
      const updatedProfile = await profileSDK.getProfileById({ profileId });
      
      // Process the profile to ensure image URLs have the Arweave gateway prefix
      if (updatedProfile) {
        // Add Arweave gateway URL to thumbnail and banner if they're just transaction IDs
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

  const connectWallet = async () => {
    try {
      setLoading(true);
      
      // Use simulation mode for development/testing
      if (SIMULATION_MODE) {
        console.log('Wallet simulation mode enabled');
        console.log('Using simulated wallet address:', SIMULATED_WALLET_ADDRESS);
        setAddress(SIMULATED_WALLET_ADDRESS);
        setLoading(false);
        return;
      }
      
      await globalThis.arweaveWallet.connect([
        "ACCESS_ADDRESS",
        "SIGN_TRANSACTION",
      ]);
      const walletAddress = await globalThis.arweaveWallet.getActiveAddress();
      setAddress(walletAddress);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      
      // Fallback to simulation mode if the actual connection fails
      if (SIMULATION_MODE) {
        console.log('Falling back to wallet simulation mode after error');
        console.log('Using simulated wallet address:', SIMULATED_WALLET_ADDRESS);
        setAddress(SIMULATED_WALLET_ADDRESS);
      }
    } finally {
      setLoading(false);
    }
  };

  const disconnectWallet = async () => {
    try {
      setLoading(true);
      
      // Handle simulation mode
      if (SIMULATION_MODE) {
        console.log('Disconnecting simulated wallet');
        setAddress(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      
      await globalThis.arweaveWallet.disconnect();
      setAddress(null);
      setProfile(null);
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const disconnectOnReload = async () => {
      setLoading(true);
      try {
        // Skip actual wallet disconnect in simulation mode
        if (!SIMULATION_MODE) {
          await globalThis.arweaveWallet.disconnect();
        }
        setAddress(null);
      } catch (error) {
        console.error("Error disconnecting wallet on reload:", error);
      } finally {
        setLoading(false);
      }
    };

    disconnectOnReload();
  }, []);

  return (
    <WalletContext.Provider
      value={{ 
        address, 
        connectWallet, 
        disconnectWallet, 
        loading,
        profileLoading,
        profile,
        createProfile,
        updateProfile
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
