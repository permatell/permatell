"use client";

import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { MintAllocation } from "@/components/ui/mint-allocation";
import { GoddessesVerification } from "@/components/ui/goddesses-verification";
import { useWallet } from "@/contexts/WalletContext";
import { useTokenGating } from "@/hooks/useTokenGating";
import { Spinner } from "@/components/ui/spinner";
import { Disclaimer } from "@/components/ui/disclaimer";

export default function MintPage() {
  const { address } = useWallet();
  const { isAuthorized, loading: tokenLoading, error } = useTokenGating();

  // Token gating check
  if (tokenLoading) {
    return (
      <div className="container mx-auto py-6 px-4 flex flex-col items-center justify-center min-h-[70vh]">
        <Spinner className="text-purple-500 w-12 h-12" />
        <p className="mt-4 text-gray-300">Verifying token ownership...</p>
      </div>
    );
  }

  if (!isAuthorized && address) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="bg-black/40 backdrop-blur-md border border-red-900/50 rounded-lg p-6 mt-6 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold mb-4 text-white">Access Restricted</h2>
          <p className="text-gray-300 mb-6">
            PermaTell requires at least one $HOOD token to access content. Please acquire $HOOD tokens (Contract ID: Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE) to continue.
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <a 
                href="https://botega.arweave.net/#/swap?from=xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10&to=Nn3wPBPJXqmqHlzi41v4Yu9PVJYVXx-ENQKHsMqRreE"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none">
                  Get $HOOD Tokens
                </Button>
              </a>
              <Link href="/disclaimer">
                <Button variant="outline">Learn More</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto py-6 px-4">
        <PageHeader title="$HOOD Minting Platform">
          <div className="flex gap-3">
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
            <Link href="/mint-guide">
              <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-none">
                Mint Guide
              </Button>
            </Link>
          </div>
        </PageHeader>

        <div className="max-w-3xl mx-auto mt-6">
          <div className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-white">About $HOOD Minting</h2>
            <p className="text-gray-300 mb-4">
              The $HOOD minting platform allows you to allocate a percentage of your AO yield to mint $HOOD tokens. 
              By participating in this process, you support the PermaTell ecosystem and gain access to enhanced features and benefits.
            </p>
            <p className="text-gray-300">
              The minting process follows the AO/Arweave Fair Launch model, ensuring a fair and transparent distribution of tokens.
              70% of the total $HOOD supply is allocated to this minting process, with the remaining 30% split between the community and development team.
            </p>
          </div>

          <MintAllocation className="w-full mb-6" />
          
          <GoddessesVerification className="w-full mb-6" />

          <div className="bg-black/40 backdrop-blur-md border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-white">$HOOD Token Benefits</h2>
            <ul className="list-disc pl-5 text-gray-300 space-y-2">
              <li>2x story points for all actions</li>
              <li>20% reduction in reward threshold requirements</li>
              <li>Increased storage capacity (100 stories vs 10 for standard users)</li>
              <li>Access to premium features</li>
              <li>Governance rights in the PermaTell ecosystem</li>
            </ul>
          </div>
        </div>
      </div>
      <Disclaimer />
    </>
  );
}
