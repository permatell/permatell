"use client";

import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function MintGuidePage() {
  return (
    <div className="container mx-auto py-6 px-4">
      <PageHeader title="$HOOD Mint Process Guide">
        <Link href="/dashboard">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </PageHeader>

      <div className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6 mt-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="bg-purple-900/30 p-3 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">$HOOD Minting Process</h2>
            <p className="text-gray-400">Learn how to mint and collect $HOOD tokens</p>
          </div>
        </div>

        <p className="text-gray-300 mb-6">
          The $HOOD minting process follows a carefully designed emission curve to ensure a secure token economy for all participants. 
          By allocating a percentage of your AO yield to $HOOD, you can participate in the PermaTell ecosystem and gain access to 
          enhanced features and benefits.
        </p>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-white">Token Distribution</h3>
          <div className="bg-black/60 border border-gray-800 rounded-lg p-4 mb-4">
            <p className="text-gray-300 mb-3">
              $HOOD has a fixed total supply of 21,000,000 tokens, divided into three allocations:
            </p>
            <ul className="list-disc pl-5 text-gray-300 space-y-2 mb-3">
              <li><span className="font-medium text-white">70%</span> (14,700,000 $HOOD) allocated to the PI Fair Launch via AO yield delegation</li>
              <li><span className="font-medium text-white">20%</span> (4,200,000 $HOOD) reserved for community growth and ecosystem development:
                <ul className="list-disc pl-5 mt-1 ml-2 text-gray-300">
                  <li><span className="font-medium text-white">4%</span> (840,000 $HOOD) specifically for Goddesses atomic assets holders</li>
                  <li><span className="font-medium text-white">16%</span> (3,360,000 $HOOD) for public users creating and contributing to stories</li>
                </ul>
              </li>
              <li><span className="font-medium text-white">10%</span> (2,100,000 $HOOD) allocated for future platform sustainability and developer incentives</li>
            </ul>
            <p className="text-gray-300">
              No additional $HOOD tokens will be minted beyond this allocation.
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-white">Emission Schedule</h3>
          <div className="bg-black/60 border border-gray-800 rounded-lg p-4 mb-4">
            <ul className="list-disc pl-5 text-gray-300 space-y-2">
              <li>Initial year: 17% of the fair launch supply minted</li>
              <li>Years 2-4: Gradual decrease in emission rate (20% reduction per year)</li>
              <li>Year 5: First halving event, reducing emission rate by 50%</li>
              <li>Subsequent halvings: Every 4 years (Years 9, 13, etc.)</li>
            </ul>
          </div>
          <p className="text-sm text-gray-400 italic">
            This emission schedule is designed to ensure long-term sustainability and value for $HOOD token holders, while rewarding early participants.
          </p>
        </div>

        <h2 className="text-xl font-semibold mb-4 text-white">How to Mint $HOOD Tokens</h2>
        
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2 text-white">Prerequisites</h3>
          <div className="bg-black/60 border border-gray-800 rounded-lg p-4 mb-4">
            <p className="text-gray-300 mb-2">Before you can mint $HOOD tokens, you need:</p>
            <ul className="list-disc pl-5 text-gray-300 space-y-2">
              <li>DAI or stETH bridged from Ethereum to the AO Mint Contract, OR</li>
              <li>AR tokens for minting AO</li>
            </ul>
            <p className="text-gray-300 mt-2">
              If you are unfamiliar with the AO mint bridge, please ensure your assets are bridged to AO before proceeding.
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-white">Minting Process</h3>
          
          <div className="space-y-6">
            <div className="bg-black/60 border border-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-purple-400 mb-2">Step 1: Connect Your Wallet</h4>
              <p className="text-gray-300 mb-3">
                Open the Mint page and connect your Arweave address. This address must be the same address being used to receive AO.
              </p>
              <div className="bg-gray-900/50 p-3 rounded-lg mb-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Wallet Status:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-white">Connected</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-black/60 border border-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-purple-400 mb-2">Step 2: Select Allocation Percentage</h4>
              <p className="text-gray-300 mb-3">
                Use the slider to select the percentage of your AO yield you wish to allocate to mint $HOOD. 
                The minimum allocation is 5% of your AO yield, and there is no maximum.
              </p>
              <div className="bg-gray-900/50 p-3 rounded-lg mb-3">
                <div className="mb-2">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-gray-400">5%</span>
                    <span className="text-xs text-gray-400">100%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full">
                    <div className="h-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full w-1/4"></div>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Selected Allocation:</span>
                  <span className="text-white font-medium">25%</span>
                </div>
              </div>
              <p className="text-sm text-yellow-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Important: You will no longer receive AO for the allocated percentage, and will begin receiving $HOOD instead.
              </p>
            </div>

            <div className="bg-black/60 border border-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-purple-400 mb-2">Step 3: Confirm Allocation</h4>
              <p className="text-gray-300 mb-3">
                Click the "Add Allocation" button to confirm your selection. Your Arweave wallet will ask you to sign a message 
                to confirm you wish to update your percentage allocation to $HOOD.
              </p>
              <div className="flex justify-center mb-3">
                <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none">
                  Add Allocation
                </Button>
              </div>
            </div>

            <div className="bg-black/60 border border-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-purple-400 mb-2">Step 4: Monitor Your $HOOD Tokens</h4>
              <p className="text-gray-300 mb-3">
                Congratulations! Your allocation is now made and you are receiving minted $HOOD. On the Dashboard, you can see:
              </p>
              <ul className="list-disc pl-5 text-gray-300 space-y-2 mb-3">
                <li>The amount of $HOOD received so far</li>
                <li>Predicted amount of $HOOD you will receive over the next 30 days</li>
              </ul>
              <p className="text-sm text-gray-400 italic">
                Note: The predicted amount may vary and is likely to be volatile during the early days of minting. 
                Check regularly for up-to-date expectations.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-white">How to Remove Allocations</h3>
          <div className="bg-black/60 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-300 mb-3">
              There is no lockup or hold on assets, and the allocation can be removed at any point:
            </p>
            <ol className="list-decimal pl-5 text-gray-300 space-y-2 mb-3">
              <li>Follow the same steps as above</li>
              <li>Select "0%" on the allocation slider</li>
              <li>Click "Save Changes"</li>
            </ol>
            <p className="text-gray-300">
              You will no longer receive minted $HOOD and will revert to receiving AO.
            </p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-white">Goddesses NFT Holder Benefits</h3>
          <div className="bg-black/60 border border-gray-800 rounded-lg p-4 mb-4">
            <p className="text-gray-300 mb-3">
              Holders of Goddesses NFTs from the <a href="https://bazar.arweave.net/#/collection/1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0/assets/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">Goddesses Collection</a> on BazAR receive special benefits:
            </p>
            <ul className="list-disc pl-5 text-gray-300 space-y-2">
              <li>Dedicated allocation of 840,000 $HOOD tokens (4% of total supply)</li>
              <li>Enhanced rewards for creating stories and contributing to the platform</li>
              <li>Connect your Goddesses wallet to PermaTell to verify ownership</li>
              <li>Earn additional $HOOD tokens for writing stories and contributing to other stories</li>
            </ul>
            
            <div className="mt-4 p-3 bg-purple-900/20 border border-purple-800 rounded-lg">
              <h4 className="font-medium text-purple-400 mb-2">How to Verify Ownership</h4>
              <ol className="list-decimal pl-5 text-gray-300 space-y-1">
                <li>Connect the wallet containing your Goddesses NFTs</li>
                <li>Navigate to your profile section</li>
                <li>Click "Verify Goddesses Ownership"</li>
                <li>Once verified, you'll automatically be eligible for enhanced rewards</li>
              </ol>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4 text-white">$HOOD Token Information</h3>
          <div className="bg-black/60 border border-gray-800 rounded-lg p-4">
            <p className="text-gray-300 mb-3">
              Important information about the $HOOD token:
            </p>
            <ul className="list-disc pl-5 text-gray-300 space-y-3">
              <li>
                <span className="font-medium text-white">Token Contract ID:</span><br />
                <code className="bg-black/40 px-2 py-1 rounded text-xs">Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE</code>
              </li>
              <li>
                <span className="font-medium text-white">Current Price:</span><br />
                $0.008182
              </li>
              <li>
                <span className="font-medium text-white">Market Cap:</span><br />
                $171.83K
              </li>
              <li>
                <span className="font-medium text-white">Token Generation Event (TGE):</span><br />
                March 16th, 2025 at 9am PDT, 12pm EDT, 5pm UTC
              </li>
              <li>
                <span className="font-medium text-white">Transferability:</span><br />
                Initially, $HOOD tokens will not be transferable. After AO mainnet goes live, liquidity will be added to a DEX at a designated value, at which point $HOOD will become transferable.
              </li>
              <li>
                <span className="font-medium text-white">Benefits:</span><br />
                $HOOD token holders receive special benefits on PermaTell:
                <ul className="list-disc pl-5 mt-1 text-gray-300">
                  <li>2x story points for all actions</li>
                  <li>20% reduction in reward threshold requirements</li>
                  <li>Increased storage capacity (100 stories vs 10 for standard users)</li>
                  <li>Access to premium features and future governance rights</li>
                </ul>
              </li>
              <li>
                <span className="font-medium text-white">Links:</span><br />
                <ul className="list-disc pl-5 mt-1 text-gray-300">
                  <li>
                    <a href="https://www.ao.link/#/token/Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
                      AO Explorer
                    </a>
                  </li>
                  <li>
                    <a href="https://botega.arweave.net/#/swap?from=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&to=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300">
                      Botega DEX
                    </a>
                  </li>
                </ul>
              </li>
            </ul>
          </div>
        </div>

        <div className="p-4 bg-purple-900/30 border border-purple-800 rounded-lg">
          <h4 className="font-semibold text-white mb-2">Disclaimer</h4>
          <p className="text-purple-200 text-sm">
            This is a fully decentralized process and PermaTell has no control to reverse any action made by mistake by the user. 
            Please ensure that all addresses are correct and that you retain the seed phrases and private keys to all wallets so not to lose access to your tokens. 
            We recommend to always use a hardware wallet where possible. PermaTell is not responsible for any loss due to usage of this platform.
          </p>
        </div>
      </div>
    </div>
  );
}
