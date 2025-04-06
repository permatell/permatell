"use client";

import React, { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { FaUser } from "react-icons/fa";
import { connect } from "@permaweb/aoconnect";
import AOProfile from '@permaweb/aoprofile';
import Arweave from 'arweave';
import { profileCache, generateCacheKey } from "@/utils/cache";

// Initialize Arweave
const arweave = Arweave.init({});

// Initialize AO connection
const aoConnection = connect();

// Create a dummy signer for read-only operations
const dummySigner = {
  signMessage: async () => new Uint8Array(0),
  getAddress: async () => "",
};

interface AuthorAvatarProps {
  address: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export const AuthorAvatar: React.FC<AuthorAvatarProps> = ({ 
  address, 
  size = "md",
  className = ""
}) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Check cache first
        const cacheKey = generateCacheKey('profile', address);
        const cachedProfile = profileCache.get(cacheKey);
        
        if (cachedProfile) {
          setProfile(cachedProfile);
          setLoading(false);
          return;
        }
        
        // Initialize the AO Profile SDK
        const { getProfileByWalletAddress } = AOProfile.init({ 
          ao: aoConnection, 
          arweave,
          signer: dummySigner
        });
        
        // Fetch the profile
        const userProfile = await getProfileByWalletAddress({ address });
        
        if (userProfile) {
          // Process the profile to ensure image URLs have the Arweave gateway prefix
          const processedProfile = {
            ...userProfile,
            thumbnail: userProfile.thumbnail ? 
              (userProfile.thumbnail.startsWith('http') ? 
                userProfile.thumbnail : 
                `https://arweave.net/${userProfile.thumbnail}`
              ) : null,
          };
          
          // Cache the processed profile
          profileCache.set(cacheKey, processedProfile);
          
          setProfile(processedProfile);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('Error fetching author profile:', err);
        setError('Failed to fetch profile');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [address]);

  // Size classes
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12"
  };

  // Get initials from display name or username
  const getInitials = () => {
    if (!profile) return "?";
    
    const displayName = profile.displayName || profile.userName;
    if (!displayName) return "?";
    
    return displayName
      .split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <Avatar className={`${sizeClasses[size]} bg-black/60 flex items-center justify-center animate-pulse ${className}`}>
        <FaUser className="text-gray-400" />
      </Avatar>
    );
  }

  return (
    <Avatar className={`${sizeClasses[size]} ${className}`}>
      {profile?.thumbnail ? (
        <AvatarImage 
          src={profile.thumbnail} 
          alt={profile.displayName || profile.userName || "Author"} 
        />
      ) : null}
      <AvatarFallback className="bg-black/60 text-gray-400">
        {getInitials()}
      </AvatarFallback>
    </Avatar>
  );
}; 