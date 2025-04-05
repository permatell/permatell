"use client";

import React, { useState, useEffect } from "react";
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
import { getPrimaryArn } from "@/lib/arns";

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

export const WalletStatus: React.FC = () => {
  const { address, connectWallet, connectAOsyncWallet, disconnectWallet, loading, profile } = useWallet();
  const [arnName, setArnName] = useState<string | null>(null);

  useEffect(() => {
    const fetchArn = async () => {
      if (address) {
        try {
          const primaryArn = await getPrimaryArn(address);
          setArnName(primaryArn);
        } catch (error) {
          console.error("Error fetching ARN:", error);
        }
      }
    };

    fetchArn();
  }, [address]);

  if (!address) {
    return (
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="default">
            {loading ? "Connecting..." : "Connect Wallet"}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md !w-fit bg-gradient-to-br from-black to-[#0F0514] backdrop-blur-md border border-gray-800/50 shadow-lg">
          <DialogHeader>
            <DialogTitle className="text-primary-foreground text-center">
              Connect with an Arweave wallet
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Button
              onClick={connectWallet}
              variant="default"
              disabled={loading}
            >
              {loading ? "Connecting..." : "Wander"}
            </Button>
            <Button onClick={connectAOsyncWallet} variant="default" disabled={loading}>Beacon</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const shortenedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div className="flex items-center gap-4">
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex items-center gap-2 cursor-pointer">
            <ProfileAvatar />
            <div className="flex flex-col">
              {arnName ? (
                <span className="text-white font-medium">{arnName}</span>
              ) : (
                <span className="text-white">{shortenedAddress}</span>
              )}
              {arnName && (
                <span className="text-xs text-gray-400">{shortenedAddress}</span>
              )}
            </div>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 bg-gradient-to-br from-black to-[#0F0514] backdrop-blur-md border border-gray-800/50">
          <DropdownMenuLabel className="text-gray-400">
            {profile?.displayName || profile?.userName || "Anonymous"}
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="bg-gray-800" />
          <DropdownMenuItem asChild>
            <Link href="/profile" className="cursor-pointer text-white hover:text-purple-300 hover:bg-gray-800/50">
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={disconnectWallet}
            disabled={loading}
            className="cursor-pointer text-red-400 hover:text-red-300 hover:bg-gray-800/50"
          >
            {loading ? "Disconnecting..." : "Disconnect"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
