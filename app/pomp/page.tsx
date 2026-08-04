"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Award, ExternalLink, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContainer } from "@/components/ui/card-container";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWallet } from "@/contexts/WalletContext";
import { useEvmWallet } from "@/contexts/EvmWalletContext";
import {
  createPompAtomicAsset,
  POAP_NETWORK_OPTIONS,
  type PoapNetworkKey,
  type PoapOwnershipResult,
  verifyPoapOwnership,
  type PompAtomicAssetResult,
} from "@/lib/pomp";

export default function PompPage() {
  const { address } = useWallet();
  const { evmAddress, connectEvm } = useEvmWallet();
  const [network, setNetwork] = useState<PoapNetworkKey>("gnosis");
  const [ownerAddress, setOwnerAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [dropId, setDropId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [artworkId, setArtworkId] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [minting, setMinting] = useState(false);
  const [verification, setVerification] =
    useState<PoapOwnershipResult | null>(null);
  const [asset, setAsset] = useState<PompAtomicAssetResult | null>(null);

  const activeOwner = useMemo(
    () => ownerAddress.trim() || evmAddress || "",
    [ownerAddress, evmAddress]
  );
  const canMint =
    Boolean(address) &&
    Boolean(verification?.owns) &&
    Boolean(title.trim()) &&
    Boolean(tokenId.trim());

  const handleUseConnectedEvm = async () => {
    const connected = evmAddress || (await connectEvm());
    if (connected) setOwnerAddress(connected);
  };

  const handleVerify = async () => {
    setVerifying(true);
    setAsset(null);
    try {
      const result = await verifyPoapOwnership({
        network,
        tokenId,
        ownerAddress: activeOwner,
      });
      setVerification(result);
      if (result.dropId && !dropId.trim()) setDropId(result.dropId);
      if (result.owns) {
        toast.success("POAP ownership verified.");
      } else {
        toast.error("That wallet does not own this POAP token.");
      }
    } catch (error: any) {
      setVerification(null);
      toast.error(error?.message || "Unable to verify POAP ownership.");
    } finally {
      setVerifying(false);
    }
  };

  const handleMint = async () => {
    if (!verification?.owns) {
      toast.error("Verify POAP ownership before minting a POMP.");
      return;
    }
    setMinting(true);
    try {
      const result = await createPompAtomicAsset({
        creator: address || "",
        drop: {
          title,
          description,
          artworkId,
          eventUrl,
          city,
          country,
          startDate,
          endDate,
        },
        claim: {
          network,
          tokenId,
          dropId: dropId || verification.dropId,
          ownerAddress: verification.expectedOwner,
          archiveSnapshot: "poaparchive.com July 2026",
        },
      });
      setAsset(result);
      toast.success("POMP atomic asset minted.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to mint POMP.");
    } finally {
      setMinting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-sm text-emerald-100">
            <Award className="h-4 w-4" />
            Proof of Memory Protocol
          </div>
          <h1 className="text-4xl font-bold text-white">POMP</h1>
          <p className="mt-3 max-w-2xl text-gray-300">
            Claim an Arweave-native memory asset from a POAP you already own.
            This first lab verifies live POAP ownership and mints a POMP atomic
            asset with provenance tags.
          </p>
        </div>
        <Link href="/dashboard">
          <Button className="border border-gray-700 bg-gray-900 text-gray-100 hover:bg-gray-800">
            Back to Stories
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <CardContainer className="border border-gray-800 bg-black/45 p-5 shadow-lg">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-300" />
            <h2 className="text-xl font-semibold text-white">
              Verify POAP Ownership
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-200">
                Network
              </label>
              <Select
                value={network}
                onValueChange={(value) => {
                  setNetwork(value as PoapNetworkKey);
                  setVerification(null);
                }}
              >
                <SelectTrigger className="bg-black/40 border-gray-800 text-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-800">
                  {POAP_NETWORK_OPTIONS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Input
              label="POAP token id"
              value={tokenId}
              onChange={(event) => {
                setTokenId(event.target.value);
                setVerification(null);
              }}
              placeholder="123456"
              className="bg-black/40 border-gray-800"
            />
            <div className="md:col-span-2">
              <Input
                label="Owner EVM address"
                value={ownerAddress}
                onChange={(event) => {
                  setOwnerAddress(event.target.value);
                  setVerification(null);
                }}
                placeholder={evmAddress || "0x..."}
                className="bg-black/40 border-gray-800"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  onClick={handleUseConnectedEvm}
                  className="h-8 border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 hover:bg-gray-800"
                >
                  Use Connected EVM Wallet
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleVerify}
              disabled={verifying || !tokenId.trim() || !activeOwner}
              className="bg-emerald-500 text-white hover:bg-emerald-600"
            >
              {verifying ? "Verifying..." : "Verify POAP"}
            </Button>
            {verification && (
              <a
                href={verification.tokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200"
              >
                View token <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>

          {verification && (
            <div
              className={`mt-4 rounded-lg border p-4 ${
                verification.owns
                  ? "border-emerald-400/30 bg-emerald-400/10"
                  : "border-red-400/30 bg-red-400/10"
              }`}
            >
              <p className="text-sm text-gray-200">
                Chain owner:{" "}
                <span className="font-mono text-xs text-white">
                  {verification.owner}
                </span>
              </p>
              {verification.dropId && (
                <p className="mt-1 text-sm text-gray-200">
                  POAP drop id:{" "}
                  <span className="font-mono text-xs text-white">
                    {verification.dropId}
                  </span>
                </p>
              )}
            </div>
          )}
        </CardContainer>

        <CardContainer className="border border-gray-800 bg-black/45 p-5 shadow-lg">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-300" />
            <h2 className="text-xl font-semibold text-white">
              Mint POMP Asset
            </h2>
          </div>

          <div className="space-y-4">
            <Input
              label="POMP title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="ETHDenver 2024"
              className="bg-black/40 border-gray-800"
            />
            <Textarea
              label="Memory description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this attendance proof means."
              className="min-h-[120px] bg-black/40 border-gray-800"
            />
            <Input
              label="Artwork Arweave id"
              value={artworkId}
              onChange={(event) => setArtworkId(event.target.value)}
              placeholder="Optional migrated artwork tx id"
              className="bg-black/40 border-gray-800"
            />
            <Input
              label="POAP drop id"
              value={dropId}
              onChange={(event) => setDropId(event.target.value)}
              placeholder="Filled from tokenEvent when available"
              className="bg-black/40 border-gray-800"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                className="bg-black/40 border-gray-800"
              />
              <Input
                label="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                className="bg-black/40 border-gray-800"
              />
              <Input
                label="Start date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="bg-black/40 border-gray-800"
              />
              <Input
                label="End date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="bg-black/40 border-gray-800"
              />
            </div>
            <Input
              label="Event URL"
              value={eventUrl}
              onChange={(event) => setEventUrl(event.target.value)}
              placeholder="https://..."
              className="bg-black/40 border-gray-800"
            />
          </div>

          <Button
            type="button"
            onClick={handleMint}
            disabled={minting || !canMint}
            className="mt-5 w-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-600 hover:to-cyan-600"
          >
            {minting ? "Minting POMP..." : "Mint POMP Atomic Asset"}
          </Button>

          {!address && (
            <p className="mt-3 text-sm text-amber-200">
              Connect a Wander or ArConnect wallet before minting on Arweave.
            </p>
          )}

          {asset && (
            <div className="mt-5 rounded-lg border border-purple-400/30 bg-purple-400/10 p-4">
              <p className="font-medium text-white">POMP minted.</p>
              <p className="mt-1 break-all font-mono text-xs text-purple-100">
                {asset.assetId}
              </p>
              <div className="mt-3 flex gap-3">
                <a
                  href={asset.bazarUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cyan-300 hover:text-cyan-200"
                >
                  Open in Bazar
                </a>
                <a
                  href={asset.arweaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-cyan-300 hover:text-cyan-200"
                >
                  Open on Arweave
                </a>
              </div>
            </div>
          )}
        </CardContainer>
      </div>
    </div>
  );
}
