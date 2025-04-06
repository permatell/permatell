"use client";

import React, { useState, useEffect } from "react";
import { getPrimaryArnsName } from "@/utils/arns";

interface ArnsNameProps {
  address: string | null;
  className?: string;
  showAddress?: boolean;
}

export const ArnsName: React.FC<ArnsNameProps> = ({ 
  address, 
  className = "",
  showAddress = false
}) => {
  const [arnsName, setArnsName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    const fetchArnsName = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);
        const name = await getPrimaryArnsName(address);
        setArnsName(name);
      } catch (error) {
        console.error('Error fetching ARNS name:', error);
        setError(true);
        setArnsName(null);
      } finally {
        setLoading(false);
      }
    };

    fetchArnsName();
  }, [address]);

  // Format address for display
  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 5)}...${addr.slice(-4)}`;
  };

  if (loading) {
    return <span className={`animate-pulse ${className}`}>Loading...</span>;
  }

  if (error || !arnsName) {
    return showAddress ? (
      <span className={className}>
        {formatAddress(address || "")}
      </span>
    ) : null;
  }

  return (
    <span className={className}>
      {arnsName}
    </span>
  );
}; 