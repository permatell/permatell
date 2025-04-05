"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { Spinner } from "@/components/ui/spinner";
import Link from "next/link";
import { updateHoodAllocation, getHoodAllocation } from "@/lib/ao-process-api";

interface MintAllocationProps {
  className?: string;
}

export const MintAllocation: React.FC<MintAllocationProps> = ({ className }) => {
  const { address } = useWallet();
  const [percentage, setPercentage] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [allocation, setAllocation] = useState<any>(null);
  const [predictedTokens, setPredictedTokens] = useState<string>("0");
  const [mintedTokens, setMintedTokens] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current allocation when component mounts or address changes
  useEffect(() => {
    if (address) {
      fetchAllocation();
    }
  }, [address]);

  const fetchAllocation = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await getHoodAllocation(address);
      
      // Check if result has an error
      if (result && result.error) {
        console.error("Error from getHoodAllocation:", result.error);
        setError("Failed to fetch your current allocation. Please try again later.");
        return;
      }
      
      // Check if result has Data
      if (result && result.Data) {
        let data;
        
        // Try to parse the data if it's a string
        try {
          data = typeof result.Data === 'string' ? JSON.parse(result.Data) : result.Data;
        } catch (parseError) {
          console.error("Error parsing allocation data:", parseError);
          data = result.Data; // Use as is if parsing fails
        }
        
        // Set allocation if available
        if (data && data.allocation) {
          setAllocation(data.allocation);
          setPercentage(data.allocation.percentage);
        }
        
        // Set predicted tokens if available
        if (data && data.predicted_tokens) {
          setPredictedTokens(data.predicted_tokens);
        }
        
        // Set minted tokens if available
        if (data && data.minted_tokens) {
          setMintedTokens(data.minted_tokens);
        }
      } else {
        // If no data, set default values
        setAllocation(null);
        setPercentage(0);
        setPredictedTokens("0");
        setMintedTokens("0");
      }
    } catch (err) {
      console.error("Error fetching allocation:", err);
      setError("Failed to fetch your current allocation. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAllocation = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const result = await updateHoodAllocation(percentage);
      
      // Check if result has an error
      if (result && result.error) {
        console.error("Error from updateHoodAllocation:", result.error);
        setError("Failed to update allocation. Please try again later.");
        return;
      }
      
      // Check if result has Data
      if (result && result.Data) {
        let dataStr;
        
        // Convert data to string for checking
        try {
          dataStr = typeof result.Data === 'string' ? result.Data : JSON.stringify(result.Data);
        } catch (parseError) {
          console.error("Error stringifying result data:", parseError);
          dataStr = String(result.Data); // Fallback to simple conversion
        }
        
        // Check for success or error messages
        if (dataStr.includes("successfully")) {
          setSuccess(percentage > 0 
            ? `Successfully allocated ${percentage}% of your AO yield to mint $HOOD tokens.` 
            : "Successfully removed your allocation.");
          
          // Update local state with new data
          if (result.allocation) {
            setAllocation(result.allocation);
          } else if (percentage === 0) {
            setAllocation(null);
          }
          
          if (result.predicted_tokens) {
            setPredictedTokens(result.predicted_tokens);
          } else if (percentage === 0) {
            setPredictedTokens("0");
          }
          
          if (result.minted_tokens) {
            setMintedTokens(result.minted_tokens);
          }
          
          // Refresh allocation data
          await fetchAllocation();
        } else if (dataStr.includes("Invalid percentage")) {
          setError("Minimum allocation is 5%. Please select a higher percentage or set to 0% to remove allocation.");
        } else {
          setError("Failed to update allocation. Please try again later.");
        }
      } else {
        // If no data, show a generic success message
        setSuccess(percentage > 0 
          ? `Allocation request sent for ${percentage}% of your AO yield.` 
          : "Allocation removal request sent.");
        
        // Refresh allocation data
        await fetchAllocation();
      }
    } catch (err) {
      console.error("Error updating allocation:", err);
      setError("Failed to update allocation. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const formatTokenAmount = (amount: string): string => {
    try {
      const num = parseFloat(amount);
      if (isNaN(num)) return "0";
      
      if (num === 0) return "0";
      
      // For large numbers, use appropriate suffixes
      if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + "M";
      } else if (num >= 1000) {
        return (num / 1000).toFixed(2) + "K";
      } else {
        return num.toFixed(2);
      }
    } catch (e) {
      return "0";
    }
  };

  if (!address) {
    return (
      <div className={`bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6 ${className}`}>
        <h2 className="text-xl font-semibold mb-4 text-white">$HOOD Minting</h2>
        <p className="text-gray-300 mb-4">
          Connect your wallet to allocate a percentage of your AO yield to mint $HOOD tokens.
        </p>
        <Link href="/mint-guide">
          <Button variant="outline" className="text-purple-400 hover:text-purple-300">
            Learn More
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={`bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">$HOOD Minting</h2>
        <Link href="/mint-guide">
          <Button variant="outline" size="sm" className="text-purple-400 hover:text-purple-300">
            Learn More
          </Button>
        </Link>
      </div>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Spinner className="text-purple-500 w-8 h-8 mb-4" />
          <p className="text-gray-300">Loading allocation data...</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <p className="text-gray-300 mb-4">
              Allocate a percentage of your AO yield to mint $HOOD tokens. The minimum allocation is 5%.
            </p>
            
            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-900/30 border border-green-800 rounded-lg p-3 mb-4">
                <p className="text-green-300 text-sm">{success}</p>
              </div>
            )}
            
            <div className="bg-black/60 border border-gray-800 rounded-lg p-4 mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-xs text-gray-400">0%</span>
                <span className="text-xs text-gray-400">100%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={percentage}
                onChange={(e) => setPercentage(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-800 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, rgb(168, 85, 247) 0%, rgb(6, 182, 212) ${percentage}%, rgb(31, 41, 55) ${percentage}%)`,
                }}
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400">Selected Allocation:</span>
                <span className="text-white font-medium">{percentage}%</span>
              </div>
            </div>
            
            {percentage > 0 && percentage < 5 && (
              <p className="text-yellow-400 text-sm mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Minimum allocation is 5%. Please select a higher percentage or set to 0% to remove allocation.
              </p>
            )}
            
            {percentage >= 5 && (
              <p className="text-yellow-400 text-sm mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                You will no longer receive AO for the allocated percentage, and will begin receiving $HOOD instead.
              </p>
            )}
            
            <div className="flex justify-center">
              <Button 
                onClick={handleUpdateAllocation} 
                disabled={loading || (percentage > 0 && percentage < 5)}
                className={percentage === 0 
                  ? "bg-red-600 hover:bg-red-700 text-white" 
                  : "bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none"
                }
              >
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Processing...
                  </>
                ) : percentage === 0 ? (
                  allocation ? "Remove Allocation" : "No Allocation"
                ) : allocation ? (
                  "Update Allocation"
                ) : (
                  "Add Allocation"
                )}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-black/60 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Minted $HOOD</h3>
              <p className="text-2xl font-bold text-white">{formatTokenAmount(mintedTokens)}</p>
              <p className="text-xs text-gray-500 mt-1">Total tokens received so far</p>
            </div>
            
            <div className="bg-black/60 border border-gray-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Predicted $HOOD (30 days)</h3>
              <p className="text-2xl font-bold text-white">{formatTokenAmount(predictedTokens)}</p>
              <p className="text-xs text-gray-500 mt-1">Estimated tokens over next 30 days</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
