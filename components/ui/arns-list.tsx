"use client";

import React, { useState, useEffect } from "react";
import { getPrimaryArnsName, getAllArnsNames } from "@/utils/arns";
import { ARIO } from '@ar.io/sdk';

interface ArnsListProps {
  address: string | null;
  className?: string;
}

export const ArnsList: React.FC<ArnsListProps> = ({ 
  address, 
  className = ""
}) => {
  const [primaryName, setPrimaryName] = useState<string | null>(null);
  const [allNames, setAllNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArnsNames = async () => {
      if (!address) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Fetch primary name
        const primary = await getPrimaryArnsName(address);
        console.log('Primary ARNS name:', primary);
        setPrimaryName(primary);
        
        // Fetch all names
        const names = await getAllArnsNames(address);
        console.log('All ARNS names:', names);
        setAllNames(names);
      } catch (error) {
        console.error('Error in fetchArnsNames:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchArnsNames();
  }, [address]);

  if (loading) {
    return <div className={`animate-pulse ${className}`}>Loading ARNS names...</div>;
  }

  // Check if we have any ARNS names from the profile
  const hasArnsNames = primaryName || allNames.length > 0;

  if (!hasArnsNames) {
    return <div className={className}>No ARNS names found</div>;
  }

  return (
    <div className={className}>
      {primaryName && (
        <div className="mb-2">
          <span className="font-medium text-purple-400">Primary:</span> <span className="text-white">{primaryName}</span>
        </div>
      )}
      
      {allNames.length > 0 && (
        <div>
          <span className="font-medium text-purple-400">All ArNS:</span>
          <ul className="list-disc list-inside mt-1 ml-2 text-white">
            {allNames.map((name, index) => (
              <li key={index}>{name}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}; 