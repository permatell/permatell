"use client";

import { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CardContainer } from "@/components/ui/card-container";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/contexts/WalletContext";
import { ARIO, ANT } from "@ar.io/sdk/web";
import { createDataItemSigner } from "@/lib/ao-config";
import { toast } from "sonner";
import { FiSearch, FiExternalLink, FiCopy, FiRefreshCw } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ArNSRecord {
  name: string;
  processId: string;
  type: "lease" | "permabuy";
  startTimestamp: number;
  endTimestamp?: number;
  purchasePrice?: number;
  undernameLimit?: number;
}

interface ArNSSearchResult {
  available: boolean;
  record?: ArNSRecord;
  cost?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ArNSPage() {
  const { address, walletType } = useWallet();
  const [searchName, setSearchName] = useState("");
  const [searchResult, setSearchResult] = useState<ArNSSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [userNames, setUserNames] = useState<ArNSRecord[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [arioBalance, setArioBalance] = useState<number | null>(null);
  const [purchaseType, setPurchaseType] = useState<"lease" | "permabuy">("lease");
  const [leaseYears, setLeaseYears] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);

  // ---- ARIO SDK helpers ---------------------------------------------------

  const getArIO = useCallback(() => {
    return ARIO.init();
  }, []);

  // ---- Load user's ArNS names and balance ---------------------------------

  const loadUserData = useCallback(async () => {
    if (!address) return;
    setLoadingNames(true);
    try {
      const ario = getArIO();

      // Fetch balance
      const balanceInMARIO = await ario.getBalance({ address });
      setArioBalance(
        typeof balanceInMARIO === "number" ? balanceInMARIO / 1_000_000 : 0
      );

      // Fetch user's ArNS records
      const records = await ario.getArNSRecords({
        limit: 1000,
        sortBy: "startTimestamp",
        sortOrder: "desc",
      });

      // Note: ArNS records don't directly expose owner, we filter by processId
      // In practice, you'd need to check ANT ownership
      const userRecords: ArNSRecord[] = [];
      for (const item of records.items) {
        try {
          // Try to see if this ANT process is owned by the user
          const ant = ANT.init({ processId: item.processId });
          const info = await ant.getInfo();
          if (info && (info as any).Owner === address) {
            userRecords.push({
              name: item.name,
              processId: item.processId,
              type: item.type,
              startTimestamp: item.startTimestamp,
              endTimestamp: (item as any).endTimestamp,
              purchasePrice: (item as any).purchasePrice,
              undernameLimit: (item as any).undernameLimit,
            });
          }
        } catch {
          // Skip records we can't check
        }
        // Limit to checking 20 records to avoid rate limiting
        if (userRecords.length >= 20) break;
      }

      setUserNames(userRecords);
    } catch (error) {
      console.error("Error loading user ArNS data:", error);
    } finally {
      setLoadingNames(false);
    }
  }, [address, getArIO]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // ---- Search for a name --------------------------------------------------

  const searchArNS = useCallback(async () => {
    if (!searchName.trim()) return;
    setSearching(true);
    setSearchResult(null);
    setEstimatedCost(null);

    try {
      const ario = getArIO();
      const name = searchName.trim().toLowerCase();

      // Check if name exists
      let record: any = null;
      try {
        record = await ario.getArNSRecord({ name });
      } catch {
        // Name doesn't exist = available
      }

      if (record) {
        setSearchResult({
          available: false,
          record: {
            name,
            processId: record.processId,
            type: record.type,
            startTimestamp: record.startTimestamp,
            endTimestamp: record.endTimestamp,
            purchasePrice: record.purchasePrice,
            undernameLimit: record.undernameLimit,
          },
        });
      } else {
        // Name is available - get cost estimate
        try {
          const cost = await ario.getTokenCost({
            intent: "Buy-Name",
            name,
            type: purchaseType,
            years: purchaseType === "lease" ? leaseYears : undefined,
          });
          setEstimatedCost(typeof cost === "number" ? cost / 1_000_000 : null);
        } catch (costErr) {
          console.error("Error estimating cost:", costErr);
        }

        setSearchResult({ available: true });
      }
    } catch (error) {
      console.error("Error searching ArNS:", error);
      toast.error("Failed to search. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [searchName, getArIO, purchaseType, leaseYears]);

  // ---- Purchase a name ----------------------------------------------------

  const purchaseName = useCallback(async () => {
    if (!address || !searchName.trim() || walletType === "evm") {
      toast.error("Please connect an Arweave wallet to purchase names.");
      return;
    }

    setPurchasing(true);
    try {
      const signer = createDataItemSigner(globalThis.arweaveWallet);
      const ario = ARIO.init({ signer });

      const name = searchName.trim().toLowerCase();

      const result = await ario.buyRecord({
        name,
        type: purchaseType,
        years: purchaseType === "lease" ? leaseYears : undefined,
      } as any);

      toast.success(`Successfully purchased "${name}"! TX: ${result}`);

      // Refresh data
      setSearchResult(null);
      setSearchName("");
      await loadUserData();
    } catch (error: any) {
      console.error("Error purchasing ArNS name:", error);
      toast.error(
        error?.message || "Failed to purchase name. Please try again."
      );
    } finally {
      setPurchasing(false);
    }
  }, [address, searchName, purchaseType, leaseYears, walletType, loadUserData]);

  // ---- Extend a lease -----------------------------------------------------

  const extendLease = useCallback(
    async (name: string, years: number = 1) => {
      if (!address || walletType === "evm") {
        toast.error("Please connect an Arweave wallet.");
        return;
      }

      try {
        const signer = createDataItemSigner(globalThis.arweaveWallet);
        const ario = ARIO.init({ signer });

        const result = await ario.extendLease({ name, years } as any);
        toast.success(`Lease for "${name}" extended by ${years} year(s)!`);
        await loadUserData();
      } catch (error: any) {
        console.error("Error extending lease:", error);
        toast.error(error?.message || "Failed to extend lease.");
      }
    },
    [address, walletType, loadUserData]
  );

  // ---- Copy helper --------------------------------------------------------

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  // ---- Render -------------------------------------------------------------

  return (
    <div className="space-y-8 relative z-10">
      <PageHeader
        title="ArNS Names"
        description="Search, buy, and manage Arweave Name Service names"
      />

      {/* Balance card */}
      {address && (
        <Card className="bg-gray-900/80 border-gray-800">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">ARIO Balance</p>
                <p className="text-2xl font-bold text-white">
                  {arioBalance !== null
                    ? `${arioBalance.toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })} ARIO`
                    : "Loading..."}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={loadUserData}
                disabled={loadingNames}
              >
                <FiRefreshCw
                  className={loadingNames ? "animate-spin" : ""}
                  size={16}
                />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search section */}
      <Card className="bg-gray-900/80 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">Search ArNS Names</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Enter a name to search (e.g. myapp)"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchArNS()}
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <Button onClick={searchArNS} disabled={searching || !searchName.trim()}>
              {searching ? <Spinner /> : <FiSearch size={18} />}
              <span className="ml-2">Search</span>
            </Button>
          </div>

          {/* Purchase options */}
          <div className="flex gap-4 items-center">
            <div className="flex gap-2">
              <Button
                variant={purchaseType === "lease" ? "default" : "outline"}
                size="sm"
                onClick={() => setPurchaseType("lease")}
              >
                Lease
              </Button>
              <Button
                variant={purchaseType === "permabuy" ? "default" : "outline"}
                size="sm"
                onClick={() => setPurchaseType("permabuy")}
              >
                Permabuy
              </Button>
            </div>
            {purchaseType === "lease" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">Years:</span>
                <select
                  value={leaseYears}
                  onChange={(e) => setLeaseYears(Number(e.target.value))}
                  className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-white"
                >
                  {[1, 2, 3, 4, 5].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Search result */}
          <AnimatePresence>
            {searchResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-4"
              >
                {searchResult.available ? (
                  <div className="p-4 rounded-lg border border-green-700/50 bg-green-900/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-400 font-semibold">
                          &quot;{searchName}&quot; is available!
                        </p>
                        {estimatedCost !== null && (
                          <p className="text-sm text-gray-400 mt-1">
                            Estimated cost:{" "}
                            <span className="text-white font-medium">
                              {estimatedCost.toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}{" "}
                              ARIO
                            </span>
                            {" "}({purchaseType === "lease" ? `${leaseYears} year lease` : "permanent"})
                          </p>
                        )}
                      </div>
                      {address && (
                        <Button
                          onClick={purchaseName}
                          disabled={purchasing}
                          isLoading={purchasing}
                        >
                          {purchasing ? "Purchasing..." : "Buy Now"}
                        </Button>
                      )}
                    </div>
                    {!address && (
                      <p className="text-sm text-yellow-400 mt-2">
                        Connect your wallet to purchase this name.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-lg border border-red-700/50 bg-red-900/20">
                    <p className="text-red-400 font-semibold">
                      &quot;{searchName}&quot; is taken
                    </p>
                    {searchResult.record && (
                      <div className="mt-2 space-y-1 text-sm text-gray-400">
                        <p>
                          Type:{" "}
                          <span className="text-white">
                            {searchResult.record.type}
                          </span>
                        </p>
                        <p className="flex items-center gap-1">
                          Process:{" "}
                          <span className="text-white font-mono text-xs">
                            {searchResult.record.processId.slice(0, 12)}...
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard(searchResult.record!.processId)
                            }
                            className="text-gray-500 hover:text-white"
                          >
                            <FiCopy size={12} />
                          </button>
                        </p>
                        <a
                          href={`https://${searchName}.arweave.net`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300"
                        >
                          Visit {searchName}.arweave.net{" "}
                          <FiExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* User's names */}
      {address && (
        <Card className="bg-gray-900/80 border-gray-800">
          <CardHeader>
            <CardTitle className="text-white">Your ArNS Names</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingNames ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : userNames.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                You don&apos;t own any ArNS names yet. Search and buy one above!
              </p>
            ) : (
              <div className="space-y-3">
                {userNames.map((record) => (
                  <div
                    key={record.name}
                    className="flex items-center justify-between p-4 rounded-lg bg-gray-800/50 border border-gray-700/50"
                  >
                    <div>
                      <p className="text-white font-semibold">{record.name}</p>
                      <div className="flex gap-3 mt-1 text-sm text-gray-400">
                        <span className="px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-400 text-xs">
                          {record.type}
                        </span>
                        {record.endTimestamp && (
                          <span>
                            Expires:{" "}
                            {new Date(
                              record.endTimestamp
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={`https://${record.name}.arweave.net`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="sm">
                          <FiExternalLink size={14} />
                        </Button>
                      </a>
                      {record.type === "lease" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => extendLease(record.name)}
                        >
                          Extend
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Not connected message */}
      {!address && (
        <Card className="bg-gray-900/80 border-gray-800">
          <CardContent className="py-12 text-center">
            <p className="text-gray-400 text-lg">
              Connect your wallet to view your ArNS names and make purchases.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
