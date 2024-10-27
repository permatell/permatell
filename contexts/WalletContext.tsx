"use client";
import React, { createContext, useContext, useState, useEffect } from "react";

interface WalletContextType {
  address: string | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  loading: boolean;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const disconnectWallet = async () => {
    try {
      setLoading(true);
      await globalThis.arweaveWallet.disconnect();
      setAddress(null);
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
        await globalThis.arweaveWallet.disconnect();
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
      value={{ address, connectWallet, disconnectWallet, loading }}
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
