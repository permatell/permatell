"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Award, ExternalLink, KeyRound, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContainer } from "@/components/ui/card-container";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { claimPompCampaign } from "@/lib/pomp";

export default function PompClaimPage() {
  const params = useParams<{ assetId: string }>();
  const assetId = String(params?.assetId || "");
  const { address, connectWallet, loading, walletType } = useWallet();
  const [claimWord, setClaimWord] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimedMessageId, setClaimedMessageId] = useState("");

  const arweaveAddress = walletType === "wander" ? address : null;

  const handleClaim = async () => {
    if (!arweaveAddress) {
      toast.error("Connect Wander or ArConnect before claiming.");
      return;
    }
    if (!claimWord.trim()) {
      toast.error("Enter the event claim word.");
      return;
    }

    setClaiming(true);
    setClaimedMessageId("");
    try {
      const result = await claimPompCampaign({
        assetId,
        claimWord,
        claimant: arweaveAddress,
      });
      setClaimedMessageId(result.messageId);
      toast.success("POMP claim sent to AO.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to claim this POMP.");
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <Link href="/pomp" className="text-sm text-cyan-300 hover:text-cyan-200">
          Back to POMP
        </Link>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-400/10 px-3 py-1 text-sm text-purple-100">
          <Award className="h-4 w-4" />
          POMP Event Claim
        </div>
        <h1 className="mt-4 text-4xl font-bold text-white">Claim POMP</h1>
        <p className="mt-3 text-gray-300">
          Enter the event word to claim one edition from this POMP campaign.
        </p>
      </div>

      <CardContainer className="border border-gray-800 bg-black/45 p-5 shadow-lg">
        <div className="mb-5 rounded-lg border border-gray-800 bg-black/30 p-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            POMP asset
          </p>
          <p className="mt-2 break-all font-mono text-sm text-purple-100">
            {assetId}
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <a
              href={`https://bazar.arweave.net/#/asset/${assetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
            >
              Bazar <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={`https://arweave.net/${assetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
            >
              Arweave <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-purple-400/25 bg-purple-400/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-white">
                <Wallet className="h-5 w-5 text-purple-200" />
                <h2 className="font-semibold">Claim Wallet</h2>
              </div>
              <p className="mt-2 font-mono text-sm text-purple-100">
                {arweaveAddress
                  ? `${arweaveAddress.slice(0, 8)}...${arweaveAddress.slice(-6)}`
                  : "Not connected"}
              </p>
            </div>
            <Button
              type="button"
              onClick={connectWallet}
              disabled={loading}
              className="border border-purple-300/35 bg-purple-300/10 text-purple-100 hover:bg-purple-300/15"
            >
              {loading ? "Connecting" : arweaveAddress ? "Connected" : "Connect"}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <Input
            label="Event claim word"
            type="password"
            value={claimWord}
            onChange={(event) => setClaimWord(event.target.value)}
            placeholder="Enter the word shared at the event"
            className="bg-black/40 border-gray-800"
          />
          <Button
            type="button"
            onClick={handleClaim}
            disabled={claiming || !arweaveAddress || !claimWord.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-600 hover:to-cyan-600"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {claiming ? "Claiming..." : "Claim POMP"}
          </Button>
        </div>

        {claimedMessageId && (
          <div className="mt-5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-4 text-sm text-emerald-100">
            <p className="font-medium">Claim message sent.</p>
            <p className="mt-2 break-all font-mono text-xs">
              {claimedMessageId}
            </p>
            <p className="mt-2 text-emerald-100/75">
              AO indexing can take a moment. Refresh the asset in Bazar or the
              POMP page to see the updated balance and claim state.
            </p>
          </div>
        )}
      </CardContainer>
    </div>
  );
}
