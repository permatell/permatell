"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@/contexts/WalletContext";
import { useTokenGating } from "@/hooks/useTokenGating";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ProcessStatusIndicator } from "@/components/ui/process-status-indicator";

export const WalletStatus: React.FC = () => {
  const { 
    address, 
    connectWallet, 
    disconnectWallet, 
    loading,
    profile,
    profileLoading
  } = useWallet();
  const { isAuthorized, loading: tokenLoading, error, balance, formattedBalance } = useTokenGating();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Profile avatar component
  const ProfileAvatar = () => {
    if (profileLoading) {
      return (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
          <Spinner size="sm" />
        </div>
      );
    }
    
    if (profile?.thumbnail) {
      return (
        <img 
          src={profile.thumbnail} 
          alt={profile.displayName || 'Profile'} 
          className="w-8 h-8 rounded-full object-cover cursor-pointer"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        />
      );
    }
    
    // Default avatar with first letter of display name or username
    const initial = profile?.displayName?.charAt(0) || 
                   profile?.userName?.charAt(0) || 
                   address?.charAt(0) || 
                   '?';
    
    return (
      <div 
        className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center cursor-pointer"
        onClick={() => setDropdownOpen(!dropdownOpen)}
      >
        <span className="text-white font-semibold">{initial.toUpperCase()}</span>
      </div>
    );
  };
  
  // Profile dropdown component
  const ProfileDropdown = () => {
    if (!dropdownOpen) return null;
    
    return (
      <div 
        ref={dropdownRef}
        className="absolute top-12 right-0 w-80 bg-gray-800 rounded-lg shadow-lg p-4 z-50"
      >
        <div className="flex items-start gap-3 mb-3">
          {profile?.thumbnail ? (
            <img 
              src={profile.thumbnail} 
              alt={profile.displayName || 'Profile'} 
              className="w-12 h-12 rounded-full object-cover"
              onError={(e) => {
                // If image fails to load, replace with default avatar
                e.currentTarget.style.display = 'none';
                const sibling = e.currentTarget.nextElementSibling;
                if (sibling && sibling instanceof HTMLElement) {
                  sibling.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div 
            className="w-12 h-12 rounded-full bg-purple-700 flex items-center justify-center"
            style={{ display: profile?.thumbnail ? 'none' : 'flex' }}
          >
            <span className="text-white text-lg font-semibold">
              {(profile?.displayName?.charAt(0) || profile?.userName?.charAt(0) || address?.charAt(0) || '?').toUpperCase()}
            </span>
          </div>
          
          <div className="flex-1 overflow-hidden">
            {profile ? (
              <>
                <div className="font-semibold text-white">{profile.displayName || 'Unnamed'}</div>
                {profile.userName && <div className="text-sm text-gray-300">@{profile.userName}</div>}
              </>
            ) : (
              <div className="font-semibold text-white">No Profile</div>
            )}
            <div className="text-xs text-gray-400 mt-1 truncate" title={address || ''}>
              {address && address.length > 20 ? `${address.slice(0, 10)}...${address.slice(-10)}` : address}
            </div>
            {profile?.id && (
              <div className="text-xs text-gray-400 mt-1 truncate" title={profile.id}>
                Profile ID: {profile.id.length > 20 ? `${profile.id.slice(0, 10)}...${profile.id.slice(-10)}` : profile.id}
              </div>
            )}
          </div>
        </div>
        
        {profile?.description && (
          <div className="text-sm text-gray-300 mb-3 border-t border-gray-700 pt-2">
            {profile.description}
          </div>
        )}
        
        {/* Story Process Status */}
        <div className="border-t border-gray-700 pt-3 pb-3">
          <div className="text-sm font-medium text-white mb-2">Process Status</div>
          <ProcessStatusIndicator compact={true} />
        </div>
        
        <div className="border-t border-gray-700 pt-3 mt-2">
          <Link 
            href="/profile" 
            className="block text-sm text-purple-400 hover:text-purple-300 mb-2"
            onClick={() => setDropdownOpen(false)}
          >
            {profile ? 'Edit Profile' : 'Create Profile'}
          </Link>
          
          <Button 
            onClick={() => {
              setDropdownOpen(false);
              disconnectWallet();
            }} 
            variant="destructive" 
            className="w-full text-sm" 
            disabled={loading}
          >
            {loading ? "Disconnecting..." : "Disconnect Wallet"}
          </Button>
        </div>
      </div>
    );
  };

  if (!address) {
    return (
      <div className="flex items-center gap-2">
        <Button onClick={connectWallet} variant="default" disabled={loading}>
          {loading ? "Connecting..." : "Connect Wallet"}
        </Button>
        <Link href="/disclaimer" className="text-xs text-purple-400 hover:text-purple-300">
          Get $HOOD tokens
        </Link>
      </div>
    );
  }

  const shortenedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="flex items-center gap-4 relative">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
        <div className="text-white">{shortenedAddress}</div>
        {tokenLoading ? (
          <div className="text-xs text-gray-400">Checking tokens...</div>
        ) : isAuthorized ? (
          <div className="text-xs px-2 py-1 bg-green-900/50 text-green-400 rounded-full">$HOOD: {formattedBalance}</div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="text-xs px-2 py-1 bg-red-900/50 text-red-400 rounded-full">No $HOOD tokens</div>
            <Link href="/disclaimer" className="text-xs text-purple-400 hover:text-purple-300">
              Get tokens
            </Link>
          </div>
        )}
      </div>
      
      <div className="relative">
        <ProfileAvatar />
        <ProfileDropdown />
      </div>
    </div>
  );
};
