"use client";

import React, { useState, useRef, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "./avatar";
import Link from "next/link";
import { FaUser } from "react-icons/fa";
import { User, ChevronDown, LogOut, Settings, Wallet, ExternalLink, Copy, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import { ArnsName } from "@/components/ui/arns-name";
import { getAllArnsNames } from "@/utils/arns";

const ProfileAvatar: React.FC = () => {
  const { profile, profileLoading } = useWallet();

  if (profileLoading) {
    return (
      <Avatar className="h-8 w-8 bg-black/60 flex items-center justify-center">
        <FaUser className="text-gray-400 animate-pulse" />
      </Avatar>
    );
  }

  const displayName = profile?.displayName || profile?.userName;
  const initials = displayName
    ? displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : "?";

  return (
    <Avatar className="h-8 w-8">
      {profile?.thumbnail ? (
        <AvatarImage src={profile.thumbnail} alt={displayName || "Profile"} />
      ) : null}
      <AvatarFallback className="bg-black/60 text-gray-400">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};

// Helper function to truncate addresses
const truncateAddress = (address: string | undefined): string => {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

export function WalletStatus() {
  const { 
    address, 
    profile, 
    profileLoading, 
    connectWallet, 
    connectAOsyncWallet, 
    disconnectWallet,
    refreshBalance
  } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedProfileId, setCopiedProfileId] = useState(false);
  const [allArns, setAllArns] = useState<string[]>([]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchArnsNames = async () => {
      if (!address) return;
      
      try {
        const names = await getAllArnsNames(address);
        console.log('Fetched ARNS names:', names);
        setAllArns(names);
      } catch (error) {
        console.error('Error fetching ARNS names:', error);
      }
    };
    
    fetchArnsNames();
  }, [address]);

  // Add debugging for profile and balance
  useEffect(() => {
    if (profile) {
      console.log('Profile in wallet-status:', profile);
      console.log('ARIO Balance:', profile.balance);
    }
  }, [profile]);

  const handleDisconnect = () => {
    disconnectWallet();
    setIsOpen(false);
  };

  const copyToClipboard = (text: string, type: 'address' | 'profileId') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'address') {
        setCopiedAddress(true);
        setTimeout(() => setCopiedAddress(false), 2000);
      } else {
        setCopiedProfileId(true);
        setTimeout(() => setCopiedProfileId(false), 2000);
      }
      toast.success("Copied to clipboard!");
    }).catch(err => {
      toast.error("Failed to copy to clipboard");
      console.error("Failed to copy: ", err);
    });
  };

  // Add a function to handle balance refresh
  const handleRefreshBalance = async () => {
    try {
      await refreshBalance();
      toast.success("Balance refreshed!");
    } catch (error) {
      console.error("Error refreshing balance:", error);
      toast.error("Failed to refresh balance");
    }
  };

  if (!address) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="default">
            {profileLoading ? "Connecting..." : "Connect Wallet"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect your wallet</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Button
              onClick={connectWallet}
              variant="default"
              disabled={profileLoading}
              className="flex items-center justify-center py-8 text-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-all duration-300"
            >
              {profileLoading ? (
                "Connecting..."
              ) : (
                <>
                  <img 
                    src="https://arweave.net/ZafBy2bAp4kj-dFUVJm-EsupwgGhcDJPTpufsa7AYsI" 
                    alt="Wander" 
                    width={32} 
                    height={32} 
                    className="mr-4"
                  />
                  Wander
                </>
              )}
            </Button>
            <Button
              onClick={connectAOsyncWallet}
              variant="default"
              disabled={profileLoading}
              className="flex items-center justify-center py-8 text-xl shadow-[0_4px_14px_0_rgba(0,0,0,0.2)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.3)] transition-all duration-300"
            >
              {profileLoading ? (
                "Connecting..."
              ) : (
                <>
                  <img 
                    src="https://arweave.net/iXL24MHFs5MRS0uwAHLQgxEluwolVc9VKYVou7ngM6o" 
                    alt="Beacon" 
                    width={32} 
                    height={32} 
                    className="mr-4"
                  />
                  Beacon
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-white hover:text-gray-300 transition-colors"
      >
        {profileLoading ? (
          <div className="w-8 h-8 rounded-full bg-gray-700 animate-pulse" />
        ) : profile?.thumbnail ? (
          <img
            src={profile.thumbnail.startsWith('http') 
              ? profile.thumbnail 
              : `https://arweave.net/${profile.thumbnail}`}
            alt={profile.displayName || "Profile"}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
            <User className="w-4 h-4 text-gray-400" />
          </div>
        )}
        <span className="hidden md:inline-block">
          {profileLoading ? (
            "Loading..."
          ) : address ? (
            <div className="flex items-center">
              <ArnsName address={address} showAddress={false} />
              <span className="ml-1 text-xs text-purple-400">ArNS</span>
            </div>
          ) : (
            truncateAddress(address)
          )}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-gray-800 rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <div>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center">
                  <p className="text-xs text-gray-500">
                    <span className="text-gray-500 text-sm">Wallet: </span>
                    {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''}
                  </p>
                  <button 
                    onClick={() => copyToClipboard(address || '', 'address')}
                    className="ml-2 text-gray-400 hover:text-white"
                    title="Copy address"
                  >
                    {copiedAddress ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                {profile?.id && (
                  <div className="flex items-center mt-1">
                    <p className="text-gray-500 text-sm">
                      Profile ID: {`${profile.id.slice(0, 6)}...${profile.id.slice(-4)}`}
                    </p>
                    <button 
                      onClick={() => copyToClipboard(profile.id || '', 'profileId')}
                      className="ml-2 text-gray-400 hover:text-white"
                      title="Copy profile ID"
                    >
                      {copiedProfileId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                )}
              </div>
              {profile?.description && (
                <p className="text-gray-300 text-sm mt-2">{profile.description}</p>
              )}
            </div>
          </div>

          {profile?.primaryArn && (
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-white font-medium mb-2">Your ArNS</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Primary:</span>
                  <span className="text-cyan-400">{profile.primaryArn}</span>
                </div>
              </div>
            </div>
          )}

          {profile?.gatewayNode && (
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-white font-medium mb-2">Your Gateway Node</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Domain:</span>
                  <span className="text-cyan-400">{profile.gatewayNode}</span>
                </div>
              </div>
            </div>
          )}

          {/* Display assets if they exist in the profile */}
          {profile && profile.assets && profile.assets.length > 0 && (
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-white font-medium mb-2">Profile Assets</h4>
              <div className="overflow-x-auto">
                <div className="flex space-x-2 pb-2">
                  {profile.assets.slice(0, 10).map((asset, index) => (
                    <a 
                      key={index} 
                      href={`https://bazar.arweave.net/#/asset/${asset}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={`https://arweave.net/${asset}`}
                        alt={`Asset ${index + 1}`}
                        className="w-16 h-16 rounded object-cover"
                      />
                    </a>
                  ))}
                  {profile.assets.length > 10 && (
                    <div className="flex-shrink-0 w-16 h-16 rounded bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">
                        +{profile.assets.length - 10} more
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="p-4">
            <Link href="/profile" className="block w-full mb-2">
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                <Settings className="w-4 h-4 mr-2" />
                View Full Profile
              </Button>
            </Link>
            <button
              onClick={handleDisconnect}
              className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
