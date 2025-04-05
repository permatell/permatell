'use client';

import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";

// Goddesses collection ID on BazAR
const GODDESSES_COLLECTION_ID = "1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0";

// Enable simulation mode for development/testing
const SIMULATION_MODE = false;
const SIMULATED_OWNERSHIP = true; // Set to true to simulate ownership

export const useGoddessesNFT = () => {
  const { address } = useWallet();
  const [isVerified, setIsVerified] = useState<boolean>(false);
  const [nftCount, setNftCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to delay execution (for retry logic)
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Function to verify NFT ownership
  const verifyOwnership = async (retries = 3) => {
    setLoading(true);
    setError(null);

    // Use simulation mode for development/testing
    if (SIMULATION_MODE) {
      console.log('Simulation mode enabled for Goddesses NFT verification');
      console.log('Simulated ownership:', SIMULATED_OWNERSHIP);
      
      setIsVerified(SIMULATED_OWNERSHIP);
      setNftCount(SIMULATED_OWNERSHIP ? 1 : 0);
      setLoading(false);
      return;
    }

    try {
      console.log('Verifying Goddesses NFT ownership for address:', address);
      
      // Use our proxy API route to verify ownership
      const response = await fetch('/api/ao/verify-nft-ownership', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          collectionId: GODDESSES_COLLECTION_ID,
          address: address
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Goddesses verification response:', result);
      
      if (result.success) {
        setIsVerified(result.verified);
        setNftCount(result.nftCount || 0);
      } else {
        console.log('Error in verification response:', result.error);
        
        // If error and we have retries left, try again after a delay
        if (retries > 0) {
          console.log(`Retrying verification. Retries left: ${retries}`);
          setLoading(false);
          
          // Wait for a bit before retrying
          await delay(2000);
          
          // Retry with one less retry attempt
          return verifyOwnership(retries - 1);
        }
        
        setIsVerified(false);
        setNftCount(0);
        setError(result.error || 'Failed to verify NFT ownership');
      }
    } catch (err: any) {
      console.error('Error verifying Goddesses NFT ownership:', err);
      
      // If error and we have retries left, try again after a delay
      if (retries > 0) {
        console.log(`Retrying verification after error. Retries left: ${retries}`);
        
        // Wait for a bit before retrying
        await delay(2000);
        
        // Retry with one less retry attempt
        return verifyOwnership(retries - 1);
      }
      
      // Fallback to simulation mode if the actual check fails
      if (SIMULATION_MODE) {
        console.log('Falling back to simulation mode after error');
        console.log('Simulated ownership:', SIMULATED_OWNERSHIP);
        
        setIsVerified(SIMULATED_OWNERSHIP);
        setNftCount(SIMULATED_OWNERSHIP ? 1 : 0);
      } else {
        setIsVerified(false);
        setNftCount(0);
        setError(err.message || 'Failed to verify NFT ownership');
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to manually trigger a verification
  const refreshVerification = () => {
    if (address) {
      setLoading(true);
      setTimeout(() => {
        verifyOwnership();
      }, 100);
    }
  };

  // Effect to verify ownership when address changes
  useEffect(() => {
    // Reset verification if wallet is disconnected
    if (!address) {
      setIsVerified(false);
      setNftCount(0);
      setLoading(false);
      return;
    }

    verifyOwnership();
    
    // We don't need to regularly check for NFT ownership like we do for token balance,
    // since NFT ownership rarely changes. If the user wants to check again, they can
    // refresh the page or we could add a manual refresh button.
  }, [address]);

  return { 
    isVerified, 
    nftCount, 
    loading, 
    error,
    refreshVerification
  };
};
