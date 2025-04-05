'use client';

import { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
// The actual AO token contract ID for the $HOOD token
const HOOD_TOKEN_CONTRACT = "Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE";
const MIN_REQUIRED_TOKENS = 1;

// Enable simulation mode for development/testing
const SIMULATION_MODE = false;
const SIMULATED_TOKEN_BALANCE = 1; // 1 token
// const SIMULATED_TOKEN_BALANCE = 10489400; // 10.4894 million (should display as 10.49M)

/**
 * Formats a token balance to a human-readable string
 * @param balance The token balance to format
 * @returns A human-readable string representation of the balance
 */
const formatTokenBalance = (balance: number): string => {
  // If the balance is 0, return "0"
  if (balance === 0) return "0";
  
  // If the balance is less than 1, show up to 4 decimal places
  if (balance < 1) {
    return balance.toFixed(4).replace(/\.?0+$/, '');
  }
  
  // If the balance is exactly 1, return "1"
  if (balance === 1) {
    return "1";
  }
  
  // If the balance is less than 1,000, show up to 2 decimal places without suffix
  if (balance < 1000) {
    return balance.toFixed(2).replace(/\.?0+$/, '');
  }
  
  // For large numbers, use appropriate suffixes
  const suffixes = ['', 'K', 'M', 'B', 'T'];
  
  // Convert to string and handle scientific notation
  const balanceStr = balance.toString();
  
  // If the number is in scientific notation (e.g., 1.04895e+24)
  if (balanceStr.includes('e+')) {
    const parts = balanceStr.split('e+');
    const mantissa = parseFloat(parts[0]);
    const exponent = parseInt(parts[1], 10);
    
    // Calculate the suffix index (how many thousands)
    const suffixIndex = Math.min(Math.floor(exponent / 3), suffixes.length - 1);
    
    // Calculate the adjusted mantissa
    const adjustedMantissa = mantissa * Math.pow(10, exponent % 3);
    
    // Format the result
    return `${adjustedMantissa.toFixed(2).replace(/\.?0+$/, '')}${suffixes[suffixIndex]}`;
  }
  
  // For regular numbers
  const suffixNum = Math.min(Math.floor(Math.log10(Math.abs(balance)) / 3), suffixes.length - 1);
  
  // If the suffix is empty (i.e., the number is less than 1000), just return the formatted number
  if (suffixNum === 0) {
    return balance.toFixed(2).replace(/\.?0+$/, '');
  }
  
  const shortBalance = balance / Math.pow(10, suffixNum * 3);
  const formatted = shortBalance.toFixed(2).replace(/\.?0+$/, '');
  
  return `${formatted}${suffixes[suffixNum]}`;
};

export const useTokenGating = () => {
  const { address } = useWallet();
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [formattedBalance, setFormattedBalance] = useState<string>("0");

  useEffect(() => {
    // Reset authorization if wallet is disconnected
    if (!address) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    // Helper function to delay execution (for retry logic)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const checkTokenBalance = async (retries = 3) => {
      setLoading(true);
      setError(null);

      // Use simulation mode for development/testing
      if (SIMULATION_MODE) {
        console.log('Simulation mode enabled');
        console.log('Simulated token balance:', SIMULATED_TOKEN_BALANCE);
        
        setBalance(SIMULATED_TOKEN_BALANCE);
        setFormattedBalance(formatTokenBalance(SIMULATED_TOKEN_BALANCE));
        setIsAuthorized(SIMULATED_TOKEN_BALANCE >= MIN_REQUIRED_TOKENS);
        setLoading(false);
        return;
      }

      try {
        console.log('Checking token balance for address:', address);
        
        // Use our proxy API route to query the token balance
        const response = await fetch('/api/ao/token-balance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tokenContractId: HOOD_TOKEN_CONTRACT,
            address: address
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Token balance response:', result);
        
        if (result.success) {
          const tokenBalance = result.balance;
          console.log('Actual token balance:', tokenBalance);
          
          setBalance(tokenBalance);
          setFormattedBalance(formatTokenBalance(tokenBalance));
          setIsAuthorized(tokenBalance >= MIN_REQUIRED_TOKENS);
        } else {
          console.log('Error in token balance response:', result.error);
          
          // If error and we have retries left, try again after a delay
          if (retries > 0) {
            console.log(`Retrying token balance check. Retries left: ${retries}`);
            setLoading(false);
            
            // Wait for a bit before retrying
            await delay(2000);
            
            // Retry with one less retry attempt
            return checkTokenBalance(retries - 1);
          }
          
          setBalance(0);
          setFormattedBalance("0");
          setIsAuthorized(false);
        }
      } catch (err) {
        console.error('Error checking token balance:', err);
        
        // If error and we have retries left, try again after a delay
        if (retries > 0) {
          console.log(`Retrying token balance check after error. Retries left: ${retries}`);
          
          // Wait for a bit before retrying
          await delay(2000);
          
          // Retry with one less retry attempt
          return checkTokenBalance(retries - 1);
        }
        
        // Fallback to simulation mode if the actual check fails
        if (SIMULATION_MODE) {
          console.log('Falling back to simulation mode after error');
          console.log('Simulated token balance:', SIMULATED_TOKEN_BALANCE);
          
          setBalance(SIMULATED_TOKEN_BALANCE);
          setFormattedBalance(formatTokenBalance(SIMULATED_TOKEN_BALANCE));
          setIsAuthorized(SIMULATED_TOKEN_BALANCE >= MIN_REQUIRED_TOKENS);
        } else {
          setError('Failed to verify token ownership. Please try again later.');
          setIsAuthorized(false);
          setBalance(0);
          setFormattedBalance("0");
        }
      } finally {
        setLoading(false);
      }
    };

    checkTokenBalance();
    
    // Set up a refresh interval to periodically check the token balance
    // But only if we don't already have a balance or if there was an error
    const refreshInterval = setInterval(() => {
      if (address && (balance === 0 || error)) {
        console.log("Refreshing token balance due to zero balance or previous error");
        checkTokenBalance(1); // Only retry once for periodic checks
      }
    }, 30000); // Check every 30 seconds
    
    return () => clearInterval(refreshInterval);
  }, [address, balance, error]);

  return { isAuthorized, loading, error, balance, formattedBalance };
};
