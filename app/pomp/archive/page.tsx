"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Search, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEvmWallet } from "@/contexts/EvmWalletContext";
import { POAP_NETWORK_OPTIONS, verifyPoapOwnership } from "@/lib/pomp";
import type { PoapNetworkKey, PoapOwnershipResult } from "@/lib/pomp";

interface ArchiveResult {
  dropId: string;
  title: string;
  year: number | null;
  city: string;
  country: string;
  artworkId: string;
  artworkUrl: string;
  snapshot: string;
}

function networkFromPoap(value: string): PoapNetworkKey {
  const normalized = value.toLowerCase();
  if (normalized.includes("polygon")) return "polygon";
  if (normalized.includes("base")) return "base";
  if (normalized.includes("arbitrum")) return "arbitrum";
  if (normalized.includes("linea")) return "linea";
  if (normalized.includes("celo")) return "celo";
  if (normalized.includes("ethereum") || normalized === "mainnet") return "ethereum";
  return "gnosis";
}

function createPompUrl(
  result: ArchiveResult,
  tokenId: string,
  network: string,
  poap?: any
) {
  const params = new URLSearchParams({
    fromArchive: "1",
    dropId: result.dropId,
    tokenId,
    network,
    title: poap?.title || result.title,
    description: poap?.description || "",
    artworkId: result.artworkId,
    artworkUrl: result.artworkUrl,
    eventUrl: poap?.eventUrl || "",
    year: poap?.year || (result.year ? String(result.year) : ""),
    city: poap?.city || result.city,
    country: poap?.country || result.country,
    startDate: poap?.startDate || "",
    endDate: poap?.endDate || "",
    archiveSnapshot: result.snapshot,
  });
  return `/pomp?${params.toString()}`;
}

export default function PoapArchivePage() {
  const { evmAddress, connectEvm } = useEvmWallet();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArchiveResult[]>([]);
  const [selected, setSelected] = useState<ArchiveResult | null>(null);
  const [tokenId, setTokenId] = useState("");
  const [network, setNetwork] = useState<PoapNetworkKey>("gnosis");
  const [verification, setVerification] = useState<PoapOwnershipResult | null>(null);
  const [ownedPoap, setOwnedPoap] = useState<any | null>(null);
  const [searching, setSearching] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [loadingOwnedPoap, setLoadingOwnedPoap] = useState(false);
  const ownedLookupKey = useRef("");

  useEffect(() => {
    if (!selected || !evmAddress) return;
    const lookupKey = `${evmAddress}:${selected.dropId}`;
    if (ownedLookupKey.current === lookupKey) return;
    ownedLookupKey.current = lookupKey;

    let cancelled = false;
    setLoadingOwnedPoap(true);
    setVerification(null);
    setOwnedPoap(null);
    setTokenId("");
    fetch(`/api/poap/collector?address=${encodeURIComponent(evmAddress)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json?.error || "Unable to load POAPs for this wallet.");
        }
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        const matches = (Array.isArray(json?.poaps) ? json.poaps : []).filter(
          (poap: any) => String(poap?.dropId || "") === selected.dropId
        );
        const poap = matches[0];
        if (!poap?.tokenId) {
          toast.message("This wallet does not have a POAP from the selected drop.");
          return;
        }

        setTokenId(String(poap.tokenId));
        if (poap.network) setNetwork(networkFromPoap(String(poap.network)));
        setOwnedPoap(poap);
        toast.success("POAP found. Details and token ID filled automatically.");
      })
      .catch((error: any) => {
        if (!cancelled) toast.error(error?.message || "Unable to find this wallet's POAP.");
      })
      .finally(() => {
        if (!cancelled) setLoadingOwnedPoap(false);
      });

    return () => {
      cancelled = true;
    };
  }, [evmAddress, selected]);

  const pompHref = useMemo(
    () =>
      selected && verification?.owns
        ? createPompUrl(selected, tokenId.trim(), network, ownedPoap)
        : "",
    [network, ownedPoap, selected, tokenId, verification]
  );

  const searchArchive = async (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) {
      toast.error("Search for at least two characters.");
      return;
    }
    setSearching(true);
    setSelected(null);
    setVerification(null);
    setOwnedPoap(null);
    ownedLookupKey.current = "";
    try {
      const response = await fetch(
        `/api/poap/archive/search?q=${encodeURIComponent(query.trim())}`,
        { cache: "no-store" }
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json?.error || "Unable to search the POAP archive.");
      setResults(Array.isArray(json?.results) ? json.results : []);
      if (!json?.results?.length) toast.message("No archived POAP drops matched your search.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to search the POAP archive.");
    } finally {
      setSearching(false);
    }
  };

  const connectEvmWallet = async () => {
    try {
      await connectEvm();
    } catch (error: any) {
      toast.error(error?.message || "Unable to connect an EVM wallet.");
    }
  };

  const verifyOwnership = async () => {
    if (!selected) return toast.error("Select an archived POAP first.");
    if (!/^\d+$/.test(tokenId.trim())) return toast.error("Enter the POAP token ID.");
    if (!evmAddress) return toast.error("Connect the EVM wallet that owns this POAP.");
    setVerifying(true);
    setVerification(null);
    try {
      const result = await verifyPoapOwnership({
        network,
        tokenId: tokenId.trim(),
        ownerAddress: evmAddress,
      });
      setVerification(result);
      if (result.owns) toast.success("Current POAP ownership verified.");
      else toast.error("This wallet does not currently own that POAP.");
    } catch (error: any) {
      toast.error(error?.message || "Unable to verify POAP ownership.");
    } finally {
      setVerifying(false);
    }
  };

  const selectedDropPanel = selected ? (
    <section className="sticky top-16 z-20 rounded-lg border border-cyan-400/25 bg-slate-950/95 p-5 shadow-xl shadow-black/30 backdrop-blur md:top-20">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-cyan-300" />
        <div>
          <h2 className="text-xl font-semibold text-white">Verify and preserve this POAP</h2>
          <p className="mt-1 text-sm text-gray-300">
            {selected.title} · Drop {selected.dropId}
          </p>
          <p className="mt-1 text-sm text-gray-400">
            Archive metadata and artwork are ready. Ownership is checked against the live POAP contract.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Input
          value={tokenId}
          readOnly
          placeholder={loadingOwnedPoap ? "Finding your POAP..." : "Connect wallet to find POAP"}
          className="border-gray-700 bg-black/40 text-white"
        />
        <select value={network} onChange={(event) => setNetwork(event.target.value as PoapNetworkKey)} className="h-10 rounded-md border border-gray-700 bg-black/40 px-3 text-sm text-white">
          {POAP_NETWORK_OPTIONS.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
        {evmAddress ? (
          <Button type="button" onClick={verifyOwnership} disabled={verifying || loadingOwnedPoap || !tokenId} className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            {verifying ? "Verifying..." : "Verify ownership"}
          </Button>
        ) : (
          <Button type="button" onClick={connectEvmWallet} className="gap-2">
            <Wallet className="h-4 w-4" /> Connect EVM wallet
          </Button>
        )}
      </div>
      {verification?.owns && (
        <div className="mt-5 flex flex-col gap-3 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-emerald-100">Ownership verified for {evmAddress?.slice(0, 6)}...{evmAddress?.slice(-4)}.</p>
          <Link href={pompHref}>
            <Button type="button" className="gap-2 bg-emerald-600 hover:bg-emerald-500">
              Create POMP <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      )}
    </section>
  ) : null;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/pomp" className="text-sm text-cyan-300 hover:text-cyan-200">
            Back to POMP
          </Link>
          <h1 className="mt-3 text-4xl font-bold text-white">POAP Archive</h1>
          <p className="mt-3 max-w-3xl text-gray-300">
            Search the permanent POAP snapshot, verify current ownership, and preserve a POAP as a POMP atomic asset.
          </p>
        </div>
        <a
          href="https://389357275212728.arweave.net/data.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-cyan-300 hover:text-cyan-200"
        >
          Archive provenance ↗
        </a>
      </div>

      <form onSubmit={searchArchive} className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, drop ID, city, country, or year"
            className="border-gray-700 bg-black/40 pl-9 text-white"
          />
        </div>
        <Button type="submit" disabled={searching} className="sm:min-w-28">
          {searching ? "Searching..." : "Search"}
        </Button>
      </form>

      {selectedDropPanel}

      {results.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {results.map((result) => (
            <button
              key={result.dropId}
              type="button"
              onClick={() => {
                setSelected(result);
                setVerification(null);
                setOwnedPoap(null);
                ownedLookupKey.current = "";
                setTokenId("");
              }}
              className={`overflow-hidden rounded-lg border text-left transition ${
                selected?.dropId === result.dropId
                  ? "border-emerald-400/70 bg-emerald-400/10"
                  : "border-gray-800 bg-black/35 hover:border-cyan-400/50"
              }`}
            >
              {result.artworkUrl ? (
                <img src={result.artworkUrl} alt={result.title} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-gray-950 text-sm text-gray-500">No artwork</div>
              )}
              <div className="p-4">
                <h2 className="line-clamp-2 font-medium text-white">{result.title}</h2>
                <p className="mt-2 text-xs text-gray-400">
                  Drop {result.dropId}{result.year ? ` · ${result.year}` : ""}
                  {result.city || result.country ? ` · ${[result.city, result.country].filter(Boolean).join(", ")}` : ""}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  );
}
