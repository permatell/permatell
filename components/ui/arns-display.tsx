"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { arnManager } from "@/lib/ario";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FaCheck, FaClock, FaExclamationTriangle, FaInfoCircle } from "react-icons/fa";
import { toast } from "sonner";

interface ArNSDisplayProps {
  address: string;
}

export const ArNSDisplay: React.FC<ArNSDisplayProps> = ({ address }) => {
  const [loading, setLoading] = useState(true);
  const [arns, setArns] = useState<any[]>([]);
  const [primaryArn, setPrimaryArn] = useState<string | null>(null);
  const [gatewayNode, setGatewayNode] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<any | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const fetchArNSData = async () => {
      if (!address) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log("Fetching ArNS data for address:", address);
        
        // Fetch all ArNS data in parallel
        const [arnsResult, primaryResult, gatewayResult, pendingResult, balanceResult] = await Promise.all([
          arnManager.getAllPrimaryNames(address),
          arnManager.getPrimaryARN(address),
          arnManager.getGatewayNode(address),
          arnManager.checkPrimaryNameRequest(address),
          arnManager.checkBalance(address)
        ]);
        
        console.log("ArNS data fetched:", {
          arns: arnsResult,
          primary: primaryResult,
          gateway: gatewayResult,
          pending: pendingResult,
          balance: balanceResult
        });
        
        setArns(arnsResult);
        setPrimaryArn(primaryResult);
        setGatewayNode(gatewayResult?.fqdn || null);
        setPendingRequest(pendingResult);
        setBalance(balanceResult?.balance || null);
        setIsOffline(false);
      } catch (error) {
        console.error("Error fetching ArNS data:", error);
        setError("Failed to load ArNS data. Please try again later.");
        setIsOffline(true);
      } finally {
        setLoading(false);
      }
    };
    
    fetchArNSData();
  }, [address]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Spinner className="text-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-4 text-red-300">
        <div className="flex items-center gap-2 mb-2">
          <FaExclamationTriangle className="text-red-400" />
          <h3 className="font-semibold">Error Loading ArNS Data</h3>
        </div>
        <p>{error}</p>
        <Button 
          onClick={handleRetry} 
          className="mt-3 bg-red-800 hover:bg-red-700"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-white">Your ArNS Names</h4>
        {balance !== null && (
          <div className="text-sm text-gray-400">
            ARIO Balance: <span className="text-purple-400 font-medium">{balance}</span>
          </div>
        )}
      </div>
      
      {isOffline && (
        <div className="bg-yellow-900/20 border border-yellow-800/50 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FaInfoCircle className="text-yellow-400" />
            <h3 className="font-semibold text-yellow-300">ArNS Service Unavailable</h3>
          </div>
          <p className="text-gray-300">
            The ArNS service is currently experiencing issues. Some features may be limited.
          </p>
          <Button 
            onClick={handleRetry} 
            className="mt-3 bg-yellow-800 hover:bg-yellow-700"
          >
            Retry Connection
          </Button>
        </div>
      )}

      {gatewayNode && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h5 className="text-white font-medium mb-2">Gateway Node</h5>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Domain:</span>
            <span className="text-cyan-400">{gatewayNode}</span>
          </div>
        </div>
      )}

      {primaryArn && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h5 className="text-white font-medium mb-2">Primary ArNS</h5>
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Name:</span>
            <span className="text-cyan-400">{primaryArn}</span>
          </div>
        </div>
      )}

      {arns.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h5 className="text-white font-medium mb-2">All ArNS Names</h5>
          <div className="space-y-2">
            {arns.map((arn, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-gray-300">{arn.domain}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 