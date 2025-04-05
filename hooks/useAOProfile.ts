'use client';

import { useState } from 'react';
import { useWallet, AOProfileData } from '@/contexts/WalletContext';

export interface ProfileHookReturn {
  profile: any | null;
  loading: boolean;
  error: string | null;
  createProfile: (profileData: AOProfileData) => Promise<string | null>;
  updateProfile: (profileId: string, profileData: AOProfileData) => Promise<string | null>;
  getProfileById: (profileId: string) => Promise<any>;
  getProfileByWalletAddress: (address: string) => Promise<any>;
}

/**
 * This hook is now a wrapper around the WalletContext's profile functionality.
 * The actual implementation has been moved to the WalletContext for better integration.
 */
export const useAOProfile = (): ProfileHookReturn => {
  const { 
    profile, 
    profileLoading, 
    createProfile: contextCreateProfile,
    updateProfile: contextUpdateProfile
  } = useWallet();
  
  const [error, setError] = useState<string | null>(null);

  // These functions are now just wrappers around the WalletContext functions
  const createProfile = async (profileData: AOProfileData): Promise<string | null> => {
    try {
      return await contextCreateProfile(profileData);
    } catch (err) {
      console.error('Error creating AO Profile:', err);
      setError('Failed to create AO Profile. Please try again later.');
      return null;
    }
  };

  const updateProfile = async (profileId: string, profileData: AOProfileData): Promise<string | null> => {
    try {
      return await contextUpdateProfile(profileId, profileData);
    } catch (err) {
      console.error('Error updating AO Profile:', err);
      setError('Failed to update AO Profile. Please try again later.');
      return null;
    }
  };

  // These functions are stubs since we don't need them anymore
  // The profile is already loaded in the WalletContext
  const getProfileById = async (profileId: string): Promise<any> => {
    setError('This function is deprecated. The profile is already loaded in the WalletContext.');
    return null;
  };

  const getProfileByWalletAddress = async (walletAddress: string): Promise<any> => {
    setError('This function is deprecated. The profile is already loaded in the WalletContext.');
    return null;
  };

  return {
    profile,
    loading: profileLoading,
    error,
    createProfile,
    updateProfile,
    getProfileById,
    getProfileByWalletAddress
  };
};
