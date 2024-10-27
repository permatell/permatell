"use client";

import React from "react";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";

export const WalletStatus: React.FC = () => {
  const { address, connectWallet, disconnectWallet, loading } = useWallet();

  if (!address) {
    return (
      <Button onClick={connectWallet} variant="default" disabled={loading}>
        {loading ? "Connecting..." : "Connect Wallet"}
      </Button>
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
