"use client";

import React from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

export const WalletStatus: React.FC = () => {
  const { address, connectWallet, connectAOsyncWallet, disconnectWallet, loading } = useWallet();

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
      <div className="text-white">{shortenedAddress}</div>
      <Button onClick={disconnectWallet} variant="default" disabled={loading}>
        {loading ? "Disconnecting..." : "Disconnect"}
      </Button>
    </div>
  );
};
