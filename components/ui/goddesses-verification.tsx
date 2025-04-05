"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useGoddessesNFT } from "@/hooks/useGoddessesNFT";
import Link from "next/link";

interface GoddessesVerificationProps {
  className?: string;
}

export const GoddessesVerification: React.FC<GoddessesVerificationProps> = ({ className }) => {
  const { isVerified, nftCount, loading, error, refreshVerification } = useGoddessesNFT();

  return (
    <div className={`bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Goddesses NFT Verification</h2>
        <Link 
          href="https://bazar.arweave.net/#/collection/1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0/assets/" 
          target="_blank" 
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="text-purple-400 hover:text-purple-300">
            View Collection
          </Button>
        </Link>
      </div>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <Spinner className="text-purple-500 w-8 h-8 mb-4" />
          <p className="text-gray-300">Verifying Goddesses NFT ownership...</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <p className="text-gray-300 mb-4">
              Holders of Goddesses NFTs receive special benefits in the PermaTell ecosystem, including enhanced $HOOD token rewards for creating and contributing to stories.
            </p>
            
            {error && (
              <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}
            
            <div className="bg-black/60 border border-gray-800 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Verification Status:</span>
                <div className="flex items-center gap-2">
                  {isVerified ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-400 font-medium">Verified</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-red-400 font-medium">Not Verified</span>
                    </>
                  )}
                </div>
              </div>
              
              {isVerified && (
                <div className="mt-3 pt-3 border-t border-gray-800">
                  <p className="text-gray-300 text-sm">
                    <span className="text-purple-400 font-medium">{nftCount}</span> Goddesses {nftCount === 1 ? 'NFT' : 'NFTs'} found in your wallet
                  </p>
                </div>
              )}
            </div>
            
            {isVerified ? (
              <div className="bg-green-900/20 border border-green-800 rounded-lg p-4 mb-4">
                <h3 className="text-green-400 font-medium mb-2">Special Benefits Unlocked</h3>
                <ul className="list-disc pl-5 text-gray-300 space-y-1">
                  <li>Access to 4% dedicated $HOOD token allocation (840,000 $HOOD)</li>
                  <li>Enhanced rewards for creating stories</li>
                  <li>Enhanced rewards for contributing to other stories</li>
                  <li>Priority verification badge on your profile</li>
                </ul>
              </div>
            ) : (
              <div className="bg-gray-900/30 border border-gray-800 rounded-lg p-4 mb-4">
                <h3 className="text-gray-400 font-medium mb-2">Verification Required</h3>
                <p className="text-gray-300 text-sm mb-3">
                  To receive special benefits, you need to own at least one Goddesses NFT from the collection.
                </p>
                <Link 
                  href="https://bazar.arweave.net/#/collection/1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0/assets/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none">
                    View Collection on BazAR
                  </Button>
                </Link>
              </div>
            )}
            
            <div className="flex justify-center">
              <Button 
                onClick={refreshVerification} 
                disabled={loading}
                variant="outline"
                className="text-purple-400 hover:text-purple-300"
              >
                {loading ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Verifying...
                  </>
                ) : (
                  "Refresh Verification"
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
