"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Award, ExternalLink, Images, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { CardContainer } from "@/components/ui/card-container";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/contexts/WalletContext";
import { useEvmWallet } from "@/contexts/EvmWalletContext";
import { EvmOwnerPanel } from "@/components/pomp/evm-owner-panel";
import {
  createNativePompAtomicAsset,
  createPompAtomicAsset,
  fetchExistingPoapPompClaim,
  fetchOwnedPoapsPage,
  fetchPompCampaignInfo,
  fetchPompCampaignsByCreator,
  fetchPompAssetsByOwner,
  mirrorPoapArtworkToArweave,
  uploadPompArtworkToArweave,
  type OwnedPoap,
  type PoapNetworkKey,
  type PoapOwnershipResult,
  type PompAtomicAssetResult,
  type PompCampaignInfo,
  type PompClaimedAsset,
  verifyPoapOwnership,
} from "@/lib/pomp";

const CLAIMED_POMPS_STORAGE_KEY = "permatell_claimed_pomps";
const CREATED_POMP_CAMPAIGNS_STORAGE_KEY = "permatell_created_pomp_campaigns";
type PompMode = "poap" | "native";

interface CreatedPompCampaign {
  assetId: string;
  title: string;
  creator: string;
  claimUrl: string;
  claimWord?: string;
  maxClaims: number;
  createdAt: string;
  source?: "browser" | "arweave";
}

function networkFromPoap(value: string): PoapNetworkKey {
  const normalized = value.toLowerCase();
  if (normalized.includes("polygon")) return "polygon";
  if (normalized.includes("base")) return "base";
  if (normalized.includes("arbitrum")) return "arbitrum";
  if (normalized.includes("linea")) return "linea";
  if (normalized.includes("celo")) return "celo";
  if (normalized.includes("ethereum") || normalized === "mainnet") {
    return "ethereum";
  }
  return "gnosis";
}

function formatDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function dateInputValue(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const usMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const monthNames: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };
  const namedMonthMatch = trimmed.match(
    /^(\d{1,2})[-/\s]([A-Za-z]{3,9})[-/\s](\d{4})$/
  );
  if (namedMonthMatch) {
    const [, day, monthName, year] = namedMonthMatch;
    const month = monthNames[monthName.toLowerCase()];
    if (month) return `${year}-${month}-${day.padStart(2, "0")}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function readClaimedPomps(): PompClaimedAsset[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CLAIMED_POMPS_STORAGE_KEY) || "[]"
    );
    return Array.isArray(parsed)
      ? parsed.map((claim) => ({ ...claim, source: claim.source || "browser" }))
      : [];
  } catch {
    return [];
  }
}

function writeClaimedPomps(claims: PompClaimedAsset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CLAIMED_POMPS_STORAGE_KEY, JSON.stringify(claims));
}

function readCreatedPompCampaigns(): CreatedPompCampaign[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CREATED_POMP_CAMPAIGNS_STORAGE_KEY) || "[]"
    );
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCreatedPompCampaigns(campaigns: CreatedPompCampaign[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CREATED_POMP_CAMPAIGNS_STORAGE_KEY,
    JSON.stringify(campaigns)
  );
}

function mergeCreatedCampaigns(
  networkCampaigns: CreatedPompCampaign[],
  browserCampaigns: CreatedPompCampaign[]
): CreatedPompCampaign[] {
  const merged = new Map<string, CreatedPompCampaign>();
  for (const campaign of networkCampaigns) {
    merged.set(campaign.assetId, campaign);
  }
  for (const campaign of browserCampaigns) {
    const existing = merged.get(campaign.assetId);
    merged.set(campaign.assetId, {
      ...existing,
      ...campaign,
      claimWord: campaign.claimWord || existing?.claimWord,
      source: existing?.source === "arweave" ? "arweave" : campaign.source || "browser",
    });
  }
  return Array.from(merged.values()).sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}

function mergeClaims(
  networkClaims: PompClaimedAsset[],
  browserClaims: PompClaimedAsset[]
): PompClaimedAsset[] {
  const merged = new Map<string, PompClaimedAsset>();
  for (const claim of browserClaims) merged.set(claim.assetId, claim);
  for (const claim of networkClaims) merged.set(claim.assetId, claim);
  return Array.from(merged.values()).sort((a, b) => {
    const aTime = a.claimedAt ? Date.parse(a.claimedAt) : 0;
    const bTime = b.claimedAt ? Date.parse(b.claimedAt) : 0;
    return bTime - aTime;
  });
}

export default function PompPage() {
  const {
    address,
    arweaveAddress,
    connectWallet,
    loading: arweaveWalletLoading,
    walletType,
  } = useWallet();
  const {
    evmAddress,
    connectEvm,
    evmEnvironment,
    poapOwnerAddress,
    setPoapOwnerAddress,
    isAddressProven,
  } = useEvmWallet();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<PompMode>("poap");
  const [poaps, setPoaps] = useState<OwnedPoap[]>([]);
  const [selectedPoap, setSelectedPoap] = useState<OwnedPoap | null>(null);
  const [loadingPoaps, setLoadingPoaps] = useState(false);
  const [loadingMorePoaps, setLoadingMorePoaps] = useState(false);
  const [poapPage, setPoapPage] = useState(0);
  const [poapTotalCount, setPoapTotalCount] = useState(0);
  const [poapHasMore, setPoapHasMore] = useState(false);
  const [tokenId, setTokenId] = useState("");
  const [dropId, setDropId] = useState("");
  const [network, setNetwork] = useState<PoapNetworkKey>("gnosis");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [artworkId, setArtworkId] = useState("");
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [campaignEnabled, setCampaignEnabled] = useState(true);
  const [claimWord, setClaimWord] = useState("");
  const [maxClaims, setMaxClaims] = useState("100");
  const [claimStart, setClaimStart] = useState("");
  const [claimEnd, setClaimEnd] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [mirroringArtwork, setMirroringArtwork] = useState(false);
  const [minting, setMinting] = useState(false);
  const [verification, setVerification] =
    useState<PoapOwnershipResult | null>(null);
  const [asset, setAsset] = useState<PompAtomicAssetResult | null>(null);
  const [claimedPomps, setClaimedPomps] = useState<PompClaimedAsset[]>([]);
  const [createdCampaigns, setCreatedCampaigns] = useState<
    CreatedPompCampaign[]
  >([]);
  const [campaignDetails, setCampaignDetails] = useState<
    Record<string, PompCampaignInfo>
  >({});
  const [loadingPompClaims, setLoadingPompClaims] = useState(false);
  const [loadingCreatedCampaigns, setLoadingCreatedCampaigns] = useState(false);
  const archiveHydrationKey = useRef("");

  useEffect(() => {
    setClaimedPomps(readClaimedPomps());
    setCreatedCampaigns(readCreatedPompCampaigns());
  }, []);

  useEffect(() => {
    if (searchParams.get("fromArchive") !== "1") return;

    const archiveDropId = searchParams.get("dropId") || "";
    const archiveTokenId = searchParams.get("tokenId") || "";
    const archiveTitle = searchParams.get("title") || "";
    if (!archiveDropId || !archiveTokenId || !archiveTitle) return;

    const archiveArtworkId = searchParams.get("artworkId") || "";
    const archiveArtworkUrl = searchParams.get("artworkUrl") || "";
    const archiveDescription = searchParams.get("description") || "";
    const archiveEventUrl = searchParams.get("eventUrl") || "";
    const archiveStartDate = searchParams.get("startDate") || "";
    const archiveEndDate = searchParams.get("endDate") || "";
    const archiveNetwork = networkFromPoap(searchParams.get("network") || "gnosis");
    const archiveSnapshot = searchParams.get("archiveSnapshot") || "2026-07-02";
    const archiveOwner = poapOwnerAddress?.trim() || evmAddress || "";
    const hydrationKey = [
      archiveDropId,
      archiveTokenId,
      archiveNetwork,
      archiveOwner,
    ].join(":");
    if (archiveHydrationKey.current === hydrationKey) return;
    archiveHydrationKey.current = hydrationKey;
    const archivePoap: OwnedPoap = {
      id: `archive-${archiveDropId}-${archiveTokenId}`,
      tokenId: archiveTokenId,
      dropId: archiveDropId,
      title: archiveTitle,
      description:
        archiveDescription ||
        "POAP metadata recovered from the permanent Arweave archive.",
      imageUrl: archiveArtworkUrl,
      eventUrl: archiveEventUrl,
      city: searchParams.get("city") || "",
      country: searchParams.get("country") || "",
      startDate: archiveStartDate,
      endDate: archiveEndDate,
      year: searchParams.get("year") || "",
      network: archiveNetwork,
      ownerAddress: archiveOwner,
      raw: {
        source: "poap-archive-arweave",
        archive: {
          source: "poap-archive-arweave",
          snapshot: archiveSnapshot,
          artworkId: archiveArtworkId,
        },
      },
    };

    setMode("poap");
    setSelectedPoap(archivePoap);
    setTokenId(archiveTokenId);
    setDropId(archiveDropId);
    setNetwork(archiveNetwork);
    setTitle(archiveTitle);
    setDescription(archivePoap.description);
    setArtworkId(archiveArtworkId);
    setEventUrl(archiveEventUrl);
    setCity(archivePoap.city);
    setCountry(archivePoap.country);
    setStartDate(dateInputValue(archiveStartDate));
    setEndDate(dateInputValue(archiveEndDate));
    setVerification(null);
    if (!archiveOwner) {
      toast.message(
        "Archived POAP loaded. Connect or enter the EVM address to verify ownership."
      );
      return;
    }

    let cancelled = false;
    setVerifying(true);
    toast.message("Archived POAP loaded. Verifying current ownership...");
    verifyPoapOwnership({
      network: archiveNetwork,
      tokenId: archiveTokenId,
      ownerAddress: archiveOwner,
    })
      .then((result) => {
        if (cancelled) return;
        setVerification(result);
        if (result.dropId) setDropId(result.dropId);
        if (result.owns) {
          toast.success("POAP ownership verified. Connect Arweave to create the POMP.");
        } else {
          toast.error("That EVM wallet does not currently own this POAP.");
        }
      })
      .catch((error: any) => {
        if (cancelled) return;
        setVerification(null);
        toast.error(error?.message || "Unable to verify POAP ownership.");
      })
      .finally(() => {
        if (!cancelled) setVerifying(false);
      });

    return () => {
      cancelled = true;
    };
  }, [evmAddress, poapOwnerAddress, searchParams]);

  const activeOwner = useMemo(
    () => poapOwnerAddress?.trim() || evmAddress || "",
    [poapOwnerAddress, evmAddress]
  );
  /**
   * POAP ownership is read with `ownerOf`, so any address passes that check --
   * including one the visitor merely typed in. Claiming is permanent and first
   * claim wins, so it additionally requires proof that the visitor controls the
   * address, via a live wallet connection or a verified signature.
   */
  const ownerProven = isAddressProven(activeOwner);
  /**
   * On a phone there is no wallet to connect to in this browser, so a Connect
   * button can only ever fail. The owner panel offers the app handoff instead.
   */
  const evmConnectUnavailable =
    evmEnvironment.ready && evmEnvironment.capability === "unavailable";
  const currentOrigin =
    typeof window === "undefined" ? "" : window.location.origin;
  const arweaveMintAddress =
    arweaveAddress || (walletType === "wander" ? address : null);
  const createdCampaignsForWallet = useMemo(
    () =>
      createdCampaigns.filter((item) => item.creator === arweaveMintAddress),
    [arweaveMintAddress, createdCampaigns]
  );
  const isPoapMode = mode === "poap";
  const missingMintRequirement = useMemo(() => {
    if (isPoapMode && !selectedPoap) return "Select a POAP";
    if (isPoapMode && !verification?.owns) return "Verify selected POAP";
    if (isPoapMode && !ownerProven) return "Prove you control the EVM address";
    if (!arweaveMintAddress) return "Connect Wander or ArConnect";
    if (!title.trim()) return "Confirm a POMP title";
    if (!isPoapMode && !startDate.trim()) return "Add an event start date";
    if (!isPoapMode && campaignEnabled && !claimWord.trim()) {
      return "Add a claim word";
    }
    return "";
  }, [
    arweaveMintAddress,
    campaignEnabled,
    claimWord,
    isPoapMode,
    ownerProven,
    selectedPoap,
    startDate,
    title,
    verification,
  ]);
  const canMint =
    (!isPoapMode || Boolean(selectedPoap)) &&
    Boolean(arweaveMintAddress) &&
    (!isPoapMode || (Boolean(verification?.owns) && ownerProven)) &&
    Boolean(title.trim()) &&
    (!isPoapMode || Boolean(tokenId.trim())) &&
    (isPoapMode ||
      (Boolean(startDate.trim()) &&
        (!campaignEnabled || Boolean(claimWord.trim()))));
  const poapDetailsLocked = isPoapMode && Boolean(selectedPoap);

  const loadClaimedPomps = async () => {
    const browserClaims = readClaimedPomps();
    if (!arweaveMintAddress) {
      setClaimedPomps(browserClaims);
      return;
    }

    setLoadingPompClaims(true);
    try {
      const networkClaims = await fetchPompAssetsByOwner(arweaveMintAddress);
      setClaimedPomps(mergeClaims(networkClaims, browserClaims));
    } catch (error: any) {
      setClaimedPomps(browserClaims);
      toast.warning(
        error?.message ||
          "Unable to load POMPs from Arweave, showing browser cache."
      );
    } finally {
      setLoadingPompClaims(false);
    }
  };

  const loadCreatedCampaigns = async () => {
    const browserCampaigns = readCreatedPompCampaigns();
    if (!arweaveMintAddress) {
      setCreatedCampaigns(browserCampaigns);
      return;
    }

    setLoadingCreatedCampaigns(true);
    try {
      const networkAssets = await fetchPompCampaignsByCreator(
        arweaveMintAddress
      );
      const networkCampaigns = networkAssets
        .filter((claim) => isCampaignPomp(claim))
        .map(
          (claim): CreatedPompCampaign => ({
            assetId: claim.assetId,
            title: claim.title || "POMP Campaign",
            creator: arweaveMintAddress,
            claimUrl: `/pomp/claim/${claim.assetId}`,
            maxClaims: 0,
            createdAt: claim.claimedAt || new Date(0).toISOString(),
            source: "arweave",
          })
        );
      setCreatedCampaigns(
        mergeCreatedCampaigns(networkCampaigns, browserCampaigns)
      );
    } catch (error) {
      console.warn("Unable to load created POMP campaigns:", error);
      setCreatedCampaigns(browserCampaigns);
    } finally {
      setLoadingCreatedCampaigns(false);
    }
  };

  useEffect(() => {
    loadClaimedPomps();
    loadCreatedCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arweaveMintAddress]);

  const handleConnectEvmWallet = async () => {
    try {
      const connected = await connectEvm();
      if (connected) {
        toast.success("EVM wallet connected.");
      } else {
        toast.error("Unable to connect EVM wallet.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Unable to connect EVM wallet.");
    }
  };

  const handleConnectAndLoad = async () => {
    setLoadingPoaps(true);
    setAsset(null);
    try {
      const collector = activeOwner;
      if (!collector) {
        toast.error("Connect or enter an EVM wallet before loading POAPs.");
        return;
      }
      setPoapOwnerAddress(collector);
      const result = await fetchOwnedPoapsPage(collector, 1);
      setPoaps(result.poaps);
      setPoapPage(result.page);
      setPoapTotalCount(result.totalCount);
      setPoapHasMore(result.hasMore);
      if (result.poaps.length === 0) {
        toast.message(
          `No POAPs found for ${collector.slice(0, 6)}...${collector.slice(-4)}. If this wallet should have POAPs, wait a moment and try again.`
        );
      } else if (result.hasMore) {
        toast.success(
          `Loaded ${result.poaps.length} of ${result.totalCount} POAPs. Use "Load more" for the rest.`
        );
      } else {
        toast.success(`Loaded ${result.poaps.length} POAPs.`);
      }
    } catch (error: any) {
      const message = error?.message || "Unable to load POAP collection.";
      toast.error(message);
    } finally {
      setLoadingPoaps(false);
    }
  };

  const handleLoadMorePoaps = async () => {
    const collector = activeOwner;
    if (!collector || loadingPoaps || loadingMorePoaps || !poapHasMore) return;
    setLoadingMorePoaps(true);
    try {
      const result = await fetchOwnedPoapsPage(collector, poapPage + 1);
      setPoaps((current) => {
        const seen = new Set(current.map((poap) => poap.id));
        return [...current, ...result.poaps.filter((poap) => !seen.has(poap.id))];
      });
      setPoapPage(result.page);
      setPoapTotalCount(result.totalCount);
      setPoapHasMore(result.hasMore);
      if (result.poaps.length === 0 && result.hasMore) {
        toast.message("That page came back empty. Try loading more again.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Unable to load more POAPs.");
    } finally {
      setLoadingMorePoaps(false);
    }
  };

  const handleConnectArweave = async () => {
    try {
      await connectWallet();
    } catch (error: any) {
      toast.error(error?.message || "Unable to connect Arweave wallet.");
    }
  };

  const selectPoap = (poap: OwnedPoap) => {
    setSelectedPoap(poap);
    setVerification(null);
    setAsset(null);
    setNetwork(networkFromPoap(poap.network));
    setTokenId(poap.tokenId);
    setDropId(poap.dropId);
    setTitle(poap.title);
    setDescription(poap.description);
    const archivedArtworkId =
      typeof poap.raw === "object" && poap.raw !== null
        ? String((poap.raw as any)?.archive?.artworkId || "")
        : "";
    setArtworkId(archivedArtworkId);
    setEventUrl(poap.eventUrl);
    setCity(poap.city);
    setCountry(poap.country);
    setStartDate(dateInputValue(poap.startDate));
    setEndDate(dateInputValue(poap.endDate));
  };

  const resetPompForm = () => {
    setSelectedPoap(null);
    setVerification(null);
    setAsset(null);
    setTokenId("");
    setDropId("");
    setTitle("");
    setDescription("");
    setArtworkId("");
    setArtworkFile(null);
    if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
    setArtworkPreviewUrl("");
    setEventUrl("");
    setCity("");
    setCountry("");
    setStartDate("");
    setEndDate("");
    setCampaignEnabled(true);
    setClaimWord("");
    setMaxClaims("100");
    setClaimStart("");
    setClaimEnd("");
  };

  const handleArtworkFileChange = (file: File | null) => {
    if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
    setArtworkId("");
    setArtworkFile(file);
    setArtworkPreviewUrl(file ? URL.createObjectURL(file) : "");
  };

  const copyClaimLink = async (claimUrl: string) => {
    const url = `${window.location.origin}${claimUrl}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Claim link copied.");
    } catch {
      toast.error("Unable to copy claim link.");
    }
  };

  const loadCampaignDetails = async (assetId: string) => {
    try {
      const details = await fetchPompCampaignInfo(assetId);
      setCampaignDetails((current) => ({ ...current, [assetId]: details }));
    } catch (error) {
      console.warn("Unable to load POMP campaign details:", error);
    }
  };

  useEffect(() => {
    createdCampaignsForWallet.forEach((campaign) => {
      if (!campaignDetails[campaign.assetId]) {
        loadCampaignDetails(campaign.assetId);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createdCampaignsForWallet]);

  const isCampaignPomp = (claim: PompClaimedAsset) =>
    claim.assetType === "native-event" ||
    claim.sourceProtocol === "POMP" ||
    (!claim.poapNetwork && !claim.tokenId && !claim.dropId);

  const rememberCreatedCampaign = (
    result: PompAtomicAssetResult,
    creator: string
  ) => {
    if (!result.claimUrl || !campaignEnabled) return;
    const campaign: CreatedPompCampaign = {
      assetId: result.assetId,
      title,
      creator,
      claimUrl: result.claimUrl,
      claimWord,
      maxClaims: Number(maxClaims) || 1,
      createdAt: new Date().toISOString(),
      source: "browser",
    };
    const next = [
      campaign,
      ...readCreatedPompCampaigns().filter(
        (item) => item.assetId !== campaign.assetId
      ),
    ];
    writeCreatedPompCampaigns(next);
    setCreatedCampaigns(next);
  };

  useEffect(() => {
    return () => {
      if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
    };
  }, [artworkPreviewUrl]);

  const switchMode = (nextMode: PompMode) => {
    setMode(nextMode);
    resetPompForm();
  };

  const handleVerifySelected = async () => {
    if (!selectedPoap) {
      toast.error("Select a POAP first.");
      return;
    }
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
    if (isPoapMode && (!selectedPoap || !verification?.owns)) {
      toast.error("Select and verify a POAP before minting.");
      return;
    }
    if (isPoapMode && !ownerProven) {
      toast.error(
        "Connect this EVM wallet or add a signed ownership proof before claiming."
      );
      return;
    }
    if (!arweaveMintAddress || !globalThis.arweaveWallet) {
      toast.error("Connect Wander or ArConnect before claiming a POMP.");
      return;
    }
    setMinting(true);
    setAsset(null);
    try {
      if (isPoapMode) {
        const existing = await fetchExistingPoapPompClaim({
          network,
          tokenId,
        });
        if (existing) {
          setAsset(existing);
          toast.error("This POAP has already been claimed as a POMP.");
          return;
        }
      }

      let finalArtworkId = artworkId.trim();
      if (isPoapMode && selectedPoap && !finalArtworkId && selectedPoap.imageUrl) {
        setMirroringArtwork(true);
        toast.message("Mirroring POAP artwork to Arweave...");
        try {
          const upload = await mirrorPoapArtworkToArweave(selectedPoap);
          finalArtworkId = upload.id;
          setArtworkId(upload.id);
        } catch (error) {
          console.warn(
            "[pomp] Artwork mirror failed; minting POMP with source artwork URL.",
            error
          );
          toast.warning(
            "Artwork mirror failed, so the POMP will use the POAP source artwork URL."
          );
        } finally {
          setMirroringArtwork(false);
        }
      }
      if (!isPoapMode && artworkFile && !finalArtworkId) {
        setMirroringArtwork(true);
        toast.message("Uploading POMP artwork to Arweave...");
        try {
          const upload = await uploadPompArtworkToArweave(artworkFile, title);
          finalArtworkId = upload.id;
          setArtworkId(upload.id);
        } finally {
          setMirroringArtwork(false);
        }
      }

      const result =
        isPoapMode && selectedPoap && verification
          ? await createPompAtomicAsset({
              creator: arweaveMintAddress,
              drop: {
                title,
                description,
                artworkId: finalArtworkId,
                sourceArtworkUrl: selectedPoap.imageUrl,
                eventUrl,
                city,
                country,
                startDate,
                endDate,
              },
              claim: {
                network,
                tokenId,
                dropId: dropId || verification.dropId || selectedPoap.dropId,
                ownerAddress: verification.expectedOwner,
                archiveSnapshot:
                  (selectedPoap.raw as any)?.archive?.snapshot
                    ? `Arweave POAP archive ${
                        (selectedPoap.raw as any).archive.snapshot
                      }`
                    : "POAP API + poaparchive.com",
              },
            })
          : await createNativePompAtomicAsset({
              creator: arweaveMintAddress,
              drop: {
                title,
                description,
                artworkId: finalArtworkId,
                eventUrl,
                city,
                country,
                startDate,
                endDate,
              },
              campaign: campaignEnabled
                ? {
                    enabled: true,
                    claimMethod: "secret-word",
                    claimWord,
                    maxClaims: Number(maxClaims) || 1,
                    claimStart: claimStart || startDate,
                    claimEnd: claimEnd || endDate,
                  }
                : undefined,
            });
      setAsset(
        finalArtworkId
          ? {
              ...result,
              artworkUpload: {
                id: finalArtworkId,
                url: `https://arweave.net/${finalArtworkId}`,
              },
            }
          : result
      );
      const claim: PompClaimedAsset = {
        assetId: result.assetId,
        bazarUrl: result.bazarUrl,
        arweaveUrl: result.arweaveUrl,
        artworkUrl: finalArtworkId
          ? `https://arweave.net/${finalArtworkId}`
          : selectedPoap?.imageUrl,
        artworkId: finalArtworkId || undefined,
        title,
        tokenId,
        dropId:
          isPoapMode && selectedPoap && verification
            ? dropId || verification.dropId || selectedPoap.dropId
            : dropId,
        poapNetwork: isPoapMode ? network : "",
        poapOwner: isPoapMode && verification ? verification.expectedOwner : "",
        arweaveOwner: arweaveMintAddress,
        claimedAt: new Date().toISOString(),
        assetType: isPoapMode ? "poap-claim" : "native-event",
        sourceProtocol: isPoapMode ? "POAP" : "POMP",
        source: "browser",
      };
      const nextClaims = [
        claim,
        ...readClaimedPomps().filter((item) => item.assetId !== claim.assetId),
      ];
      writeClaimedPomps(nextClaims);
      setClaimedPomps(nextClaims);
      if (!isPoapMode) rememberCreatedCampaign(result, arweaveMintAddress);
      toast.success(
        isPoapMode
          ? "POMP atomic asset minted."
          : campaignEnabled
          ? "POMP event campaign created."
          : "POMP event created."
      );
    } catch (error: any) {
      setMirroringArtwork(false);
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
          <div className="flex items-center gap-4">
            <Image
              src="/pomp-logo.png"
              alt="POMP logo — Proof of Memory Protocol"
              width={72}
              height={72}
              className="h-[72px] w-[72px]"
              priority
            />
            <h1 className="text-4xl font-bold text-white">POMP</h1>
          </div>
          <p className="mt-3 max-w-3xl text-gray-300">
            Migrate existing POAP memories to Arweave or create a new native
            POMP event as a HyperBEAM atomic asset.
          </p>
        </div>
        <Link href="/dashboard">
          <Button className="border border-gray-700 bg-gray-900 text-gray-100 hover:bg-gray-800">
            Back to Stories
          </Button>
        </Link>
      </div>

      <div className="mb-6 inline-flex rounded-lg border border-gray-800 bg-black/45 p-1">
        <button
          type="button"
          onClick={() => switchMode("poap")}
          className={`rounded-md px-4 py-2 text-sm transition ${
            isPoapMode
              ? "bg-emerald-500 text-white"
              : "text-gray-300 hover:bg-gray-900"
          }`}
        >
          Migrate POAP
        </button>
        <button
          type="button"
          onClick={() => switchMode("native")}
          className={`rounded-md px-4 py-2 text-sm transition ${
            !isPoapMode
              ? "bg-purple-500 text-white"
              : "text-gray-300 hover:bg-gray-900"
          }`}
        >
          Create New POMP
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-white">Looking for an older POAP?</p>
          <p className="mt-1 text-sm text-gray-300">
            Search the permanent archive, verify ownership, and bring it here as a POMP.
          </p>
        </div>
        <Link href="/pomp/archive">
          <Button type="button" className="border border-cyan-400/30 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20">
            Browse POAP Archive
          </Button>
        </Link>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <CardContainer className="border border-emerald-400/25 bg-emerald-400/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-emerald-200/70">
                Step 1
              </p>
              <h2 className="mt-1 font-semibold text-white">
                {isPoapMode ? "Set Your EVM Address" : "POAP Wallet Optional"}
              </h2>
              <p className="mt-2 text-sm text-gray-300">
                {!isPoapMode
                  ? "Only needed when migrating existing POAPs."
                  : evmConnectUnavailable
                  ? "Enter an address below to browse POAPs, then prove it is yours to claim."
                  : "Connect a wallet, or enter an address to browse POAPs read-only."}
              </p>
              <p className="mt-3 font-mono text-sm text-emerald-100">
                {activeOwner
                  ? `${activeOwner.slice(0, 6)}...${activeOwner.slice(-4)}`
                  : "Not set"}
              </p>
              {isPoapMode && activeOwner && (
                <p className="mt-1 text-xs text-emerald-200/70">
                  {ownerProven ? "Control proven" : "View only"}
                </p>
              )}
            </div>
            {!evmConnectUnavailable && (
              <Button
                type="button"
                onClick={handleConnectEvmWallet}
                disabled={!isPoapMode}
                className="h-9 bg-emerald-500 px-3 text-sm text-white hover:bg-emerald-600"
              >
                {activeOwner ? "Switch" : "Connect"}
              </Button>
            )}
          </div>
        </CardContainer>

        <CardContainer className="border border-purple-400/25 bg-purple-400/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-purple-200/70">
                Step 2
              </p>
              <h2 className="mt-1 font-semibold text-white">
                Connect Arweave Wallet
              </h2>
              <p className="mt-2 text-sm text-gray-300">
                Used to mirror artwork and receive the POMP atomic asset.
              </p>
              <p className="mt-3 font-mono text-sm text-purple-100">
                {arweaveMintAddress
                  ? `${arweaveMintAddress.slice(0, 6)}...${arweaveMintAddress.slice(-4)}`
                  : "Not connected"}
              </p>
              {arweaveMintAddress && walletType && (
                <p className="mt-1 text-xs text-purple-200/60">
                  {walletType === "wander" ? "Wander/ArConnect" : walletType}
                </p>
              )}
            </div>
            <Button
              type="button"
              onClick={handleConnectArweave}
              disabled={arweaveWalletLoading}
              className="h-9 border border-purple-300/35 bg-purple-300/10 px-3 text-sm text-purple-100 hover:bg-purple-300/15"
            >
              {arweaveWalletLoading
                ? "Connecting"
                : arweaveMintAddress
                ? "Connected"
                : "Connect"}
            </Button>
          </div>
        </CardContainer>

        <CardContainer className="border border-cyan-400/25 bg-cyan-400/10 p-4">
          <p className="text-xs uppercase tracking-wide text-cyan-200/70">
            Step 3
          </p>
          <h2 className="mt-1 font-semibold text-white">Claim POMP</h2>
          <p className="mt-2 text-sm text-gray-300">
            {isPoapMode
              ? "Select a POAP, verify it, then claim the Arweave asset."
              : "Add event details, then mint the native POMP asset."}
          </p>
          <p className="mt-3 text-sm text-cyan-100">
            {asset
              ? "POMP minted"
              : !isPoapMode && title
              ? "Ready to create"
              : verification?.owns
              ? "Ready to claim"
              : selectedPoap
              ? "Verification needed"
              : isPoapMode
              ? "Select a POAP"
              : "Add event details"}
          </p>
        </CardContainer>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <CardContainer className="border border-gray-800 bg-black/45 p-5 shadow-lg">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Images className="h-5 w-5 text-emerald-300" />
                <h2 className="text-xl font-semibold text-white">
                  {isPoapMode ? "Choose a POAP" : "Create a Native POMP"}
                </h2>
              </div>
              <p className="text-sm text-gray-400">
                {isPoapMode
                  ? "Use the EVM wallet above to load POAPs, then select the memory you want to preserve."
                  : "Use the event form to create a POMP directly on Arweave and AO. No POAP ownership check is required."}
              </p>
            </div>
            {isPoapMode && (
              <Button
                type="button"
                onClick={handleConnectAndLoad}
                disabled={loadingPoaps || !activeOwner}
                className="bg-emerald-500 text-white hover:bg-emerald-600"
              >
                {loadingPoaps
                  ? "Loading POAPs..."
                  : activeOwner
                  ? "Load POAPs"
                  : "Connect EVM First"}
              </Button>
            )}
          </div>

          {isPoapMode && <EvmOwnerPanel className="mb-5" />}

          {isPoapMode && poaps.length > 0 ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
                <span>
                  Showing {poaps.length}
                  {poapHasMore && poapTotalCount > poaps.length
                    ? ` of ${poapTotalCount}`
                    : ""}{" "}
                  POAP{poaps.length === 1 ? "" : "s"}
                </span>
                {poapHasMore && (
                  <span className="text-gray-500">
                    Load more to reach the rest of this collection.
                  </span>
                )}
              </div>
              <div className="grid max-h-[680px] grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {poaps.map((poap) => {
                const selected = selectedPoap?.id === poap.id;
                return (
                  <button
                    key={poap.id}
                    type="button"
                    onClick={() => selectPoap(poap)}
                    className={`overflow-hidden rounded-lg border text-left transition ${
                      selected
                        ? "border-emerald-300 bg-emerald-400/10"
                        : "border-gray-800 bg-black/35 hover:border-gray-600"
                    }`}
                  >
                    <div className="aspect-square bg-gray-950">
                      {poap.imageUrl ? (
                        <img
                          src={poap.imageUrl}
                          alt={poap.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">
                          No artwork
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 p-3">
                      <p className="line-clamp-2 text-sm font-medium text-white">
                        {poap.title}
                      </p>
                      <p className="text-xs text-gray-400">
                        Token {poap.tokenId || "unknown"}{" "}
                        {poap.dropId ? `· Drop ${poap.dropId}` : ""}
                      </p>
                      {(poap.city || poap.country || poap.startDate) && (
                        <p className="text-xs text-gray-500">
                          {[poap.city, poap.country].filter(Boolean).join(", ")}
                          {poap.startDate ? ` · ${formatDate(poap.startDate)}` : ""}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
              </div>
              {poapHasMore && (
                <Button
                  type="button"
                  onClick={handleLoadMorePoaps}
                  disabled={loadingMorePoaps || loadingPoaps}
                  className="w-full border border-emerald-400/40 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/20"
                >
                  {loadingMorePoaps
                    ? "Loading more POAPs..."
                    : `Load more (${Math.max(
                        poapTotalCount - poaps.length,
                        0
                      )} remaining)`}
                </Button>
              )}
            </div>
          ) : isPoapMode ? (
            <div className="rounded-lg border border-gray-800 bg-black/30 p-8 text-center text-gray-400">
              {loadingPoaps
                ? "Loading POAP collection..."
                : "No POAPs loaded yet."}
            </div>
          ) : (
            <div className="rounded-lg border border-purple-400/25 bg-purple-400/10 p-6 text-gray-300">
              <p className="text-sm">
                Fresh POMPs are for events created directly in PermaTell. The
                event data stays editable until mint, then becomes the permanent
                record for the atomic asset.
              </p>
              <p className="mt-4 font-mono text-xs text-purple-100">
                Mint wallet:{" "}
                {arweaveMintAddress
                  ? `${arweaveMintAddress.slice(0, 6)}...${arweaveMintAddress.slice(-4)}`
                  : "Connect Wander or ArConnect"}
              </p>
            </div>
          )}

          <div className="mt-6 border-t border-gray-800 pt-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Claimed POMPs
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Loaded from Arweave for your connected mint wallet, with
                  browser cache as immediate fallback.
                </p>
              </div>
              <Button
                type="button"
                onClick={loadClaimedPomps}
                disabled={loadingPompClaims}
                className="h-8 border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 hover:bg-gray-800"
              >
                {loadingPompClaims ? "Loading" : "Refresh"}
              </Button>
            </div>

            {claimedPomps.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {claimedPomps.map((claim) => {
                  const campaign = isCampaignPomp(claim);
                  const cardBody = (
                    <>
                      <div className="aspect-square bg-gray-950">
                        {claim.artworkUrl ? (
                          <img
                            src={claim.artworkUrl}
                            alt={claim.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-gray-500">
                            No artwork
                          </div>
                        )}
                      </div>
                      <div className="space-y-2 p-3">
                        <p className="line-clamp-2 text-sm font-medium text-white">
                          {claim.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          Token {claim.tokenId}
                          {claim.dropId ? ` · Drop ${claim.dropId}` : ""}
                        </p>
                        <p className="text-xs text-gray-500">
                          {claim.source === "arweave"
                            ? "Loaded from Arweave/AO"
                            : "Browser cache, indexing pending"}
                        </p>
                        <p className="break-all font-mono text-[11px] text-cyan-300">
                          {claim.assetId}
                        </p>
                      </div>
                    </>
                  );

                  return (
                    <div
                      key={claim.assetId}
                      className="overflow-hidden rounded-lg border border-purple-400/25 bg-purple-400/10"
                    >
                      <Link
                        href={`/pomp/${claim.assetId}`}
                        onClick={() =>
                          console.info("[pomp-detail] claimed card opened", {
                            assetId: claim.assetId,
                            assetType: claim.assetType,
                            sourceProtocol: claim.sourceProtocol,
                            poapNetwork: claim.poapNetwork,
                            tokenId: claim.tokenId,
                          })
                        }
                        className="block transition hover:bg-purple-400/5 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      >
                        {cardBody}
                      </Link>
                      <div className="flex flex-wrap gap-3 px-3 pb-3 pt-1 text-sm">
                        {campaign && (
                          <Link
                            href={`/pomp/claim/${claim.assetId}`}
                            className="text-cyan-300 hover:text-cyan-200"
                          >
                            Claim
                          </Link>
                        )}
                        <a
                          href={claim.bazarUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-300 hover:text-cyan-200"
                        >
                          Bazar
                        </a>
                        <a
                          href={claim.arweaveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-300 hover:text-cyan-200"
                        >
                          Arweave
                        </a>
                        {claim.artworkUrl && (
                          <a
                            href={claim.artworkUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-300 hover:text-cyan-200"
                          >
                            Artwork
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-800 bg-black/30 p-6 text-center text-gray-400">
                {loadingPompClaims
                  ? "Loading POMPs from Arweave..."
                  : arweaveMintAddress
                  ? "No POMPs found for this Arweave wallet yet."
                  : "Connect Wander or ArConnect to load POMPs from Arweave."}
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-gray-800 pt-5">
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">
                Created POMP Campaigns
              </h2>
              <p className="mt-1 text-sm text-gray-400">
                Campaigns discovered from Arweave/AO for this creator wallet.
                Claim words only show when they were saved in this browser.
              </p>
            </div>

            {createdCampaignsForWallet.length > 0 ? (
              <div className="space-y-3">
                {createdCampaignsForWallet.map((campaign) => (
                  <div
                    key={campaign.assetId}
                    className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">
                          {campaign.title}
                        </p>
                        <Link
                          href={campaign.claimUrl}
                          className="mt-1 block break-all font-mono text-xs text-cyan-300 hover:text-cyan-200"
                        >
                          {currentOrigin}
                          {campaign.claimUrl}
                        </Link>
                        <p className="mt-2 text-xs text-cyan-100/75">
                          Max claims:{" "}
                          {campaignDetails[campaign.assetId]?.config?.TotalSupply ||
                            campaign.maxClaims ||
                            "Indexing"}
                        </p>
                        {campaignDetails[campaign.assetId] ? (
                          <p className="mt-1 text-xs text-cyan-100/75">
                            Claimed: {campaignDetails[campaign.assetId].claimed}{" "}
                            · Remaining:{" "}
                            {campaignDetails[campaign.assetId].remaining} ·
                            Owner balance:{" "}
                            {campaignDetails[campaign.assetId].ownerBalance ||
                              "0"}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-cyan-100/60">
                            Loading AO campaign state...
                          </p>
                        )}
                        <p className="mt-1 text-xs text-cyan-100/75">
                          {campaign.claimWord ? (
                            <>
                              Claim word saved locally:{" "}
                              <span className="font-mono">
                                {campaign.claimWord}
                              </span>
                            </>
                          ) : (
                            "Claim word is not stored on-chain; it was not found in this browser."
                          )}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link href={campaign.claimUrl}>
                          <Button
                            type="button"
                            className="h-8 border border-purple-300/35 bg-purple-300/10 px-3 text-sm text-purple-100 hover:bg-purple-300/15"
                          >
                            Claim Page
                          </Button>
                        </Link>
                        <Button
                          type="button"
                          onClick={() => copyClaimLink(campaign.claimUrl)}
                          className="h-8 border border-cyan-300/35 bg-cyan-300/10 px-3 text-sm text-cyan-100 hover:bg-cyan-300/15"
                        >
                          Copy Link
                        </Button>
                        <Button
                          type="button"
                          onClick={() => loadCampaignDetails(campaign.assetId)}
                          className="h-8 border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 hover:bg-gray-800"
                        >
                          Refresh Stats
                        </Button>
                      </div>
                    </div>
                    {campaignDetails[campaign.assetId] &&
                      Object.values(
                        campaignDetails[campaign.assetId].claims || {}
                      ).length > 0 && (
                        <div className="mt-3 max-h-36 overflow-y-auto rounded-md border border-cyan-400/15 bg-black/25">
                          {Object.values(
                            campaignDetails[campaign.assetId].claims || {}
                          ).map((claim, index) => (
                            <div
                              key={`${claim.WalletAddress || index}`}
                              className="border-t border-cyan-400/10 px-3 py-2 first:border-t-0"
                            >
                              <p className="text-xs text-cyan-100/60">
                                Claim #{claim.ClaimIndex || index + 1}
                              </p>
                              <p className="break-all font-mono text-xs text-cyan-100">
                                {claim.WalletAddress ||
                                  claim.Recipient ||
                                  "Unknown wallet"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-gray-800 bg-black/30 p-5 text-center text-sm text-gray-400">
                {arweaveMintAddress
                  ? loadingCreatedCampaigns
                    ? "Loading creator campaigns from Arweave..."
                    : "No POMP campaigns found for this creator wallet yet."
                  : "Connect the creator Arweave wallet to view campaign details."}
              </div>
            )}
          </div>
        </CardContainer>

        <CardContainer className="border border-gray-800 bg-black/45 p-5 shadow-lg">
          <div className="mb-5 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-300" />
            <h2 className="text-xl font-semibold text-white">
              {isPoapMode ? "Claim POMP Asset" : "Create POMP Event"}
            </h2>
          </div>

          {selectedPoap?.imageUrl && (
            <div className="mb-5 overflow-hidden rounded-lg border border-gray-800">
              <img
                src={selectedPoap.imageUrl}
                alt={selectedPoap.title}
                className="max-h-64 w-full object-cover"
              />
            </div>
          )}

          {!isPoapMode && artworkPreviewUrl && (
            <div className="mb-5 overflow-hidden rounded-lg border border-gray-800">
              <img
                src={artworkPreviewUrl}
                alt={title || "POMP artwork preview"}
                className="max-h-64 w-full object-cover"
              />
            </div>
          )}

          {poapDetailsLocked && (
            <div className="mb-5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 p-3 text-sm text-emerald-100">
              POAP event details are locked for migration so the POMP preserves
              the original event record.
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="POMP title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={
                isPoapMode ? "Select a POAP to fill this" : "Event name"
              }
              disabled={poapDetailsLocked}
              className="bg-black/40 border-gray-800"
            />
            <Textarea
              label="Memory description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={
                isPoapMode
                  ? "POAP description will fill this when available."
                  : "What this event or memory represents."
              }
              disabled={poapDetailsLocked}
              className="min-h-[120px] bg-black/40 border-gray-800"
            />
            {!isPoapMode && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  POMP artwork
                </label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) =>
                    handleArtworkFileChange(event.target.files?.[0] || null)
                  }
                  className="block w-full rounded-md border border-gray-800 bg-black/40 px-3 py-2 text-sm text-gray-200 file:mr-4 file:rounded-md file:border-0 file:bg-purple-500 file:px-3 file:py-1.5 file:text-sm file:text-white hover:file:bg-purple-600"
                />
                {artworkFile && (
                  <p className="mt-2 text-xs text-gray-400">
                    {artworkFile.name} · {Math.round(artworkFile.size / 1024)}KB
                  </p>
                )}
              </div>
            )}
            <Input
              label={
                isPoapMode
                  ? "Artwork Arweave id"
                  : "Artwork Arweave id fallback"
              }
              value={artworkId}
              onChange={(event) => setArtworkId(event.target.value)}
              placeholder={
                isPoapMode
                  ? "Automatically uploaded before mint"
                  : "Optional existing artwork tx id"
              }
              className="bg-black/40 border-gray-800"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {isPoapMode && (
                <>
                  <Input
                    label="POAP token id"
                    value={tokenId}
                    onChange={(event) => setTokenId(event.target.value)}
                    disabled={poapDetailsLocked}
                    className="bg-black/40 border-gray-800"
                  />
                  <Input
                    label="POAP drop id"
                    value={dropId}
                    onChange={(event) => setDropId(event.target.value)}
                    disabled={poapDetailsLocked}
                    className="bg-black/40 border-gray-800"
                  />
                </>
              )}
              <Input
                label="City"
                value={city}
                onChange={(event) => setCity(event.target.value)}
                disabled={poapDetailsLocked}
                className="bg-black/40 border-gray-800"
              />
              <Input
                label="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                disabled={poapDetailsLocked}
                className="bg-black/40 border-gray-800"
              />
              <Input
                label="Start date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                disabled={poapDetailsLocked}
                className="bg-black/40 border-gray-800"
              />
              <Input
                label="End date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                disabled={poapDetailsLocked}
                className="bg-black/40 border-gray-800"
              />
            </div>
            <Input
              label="Event URL"
              value={eventUrl}
              onChange={(event) => setEventUrl(event.target.value)}
              placeholder="https://..."
              disabled={poapDetailsLocked}
              className="bg-black/40 border-gray-800"
            />
            {!isPoapMode && (
              <div className="rounded-lg border border-purple-400/25 bg-purple-400/10 p-4">
                <label className="flex items-center gap-3 text-sm font-medium text-gray-100">
                  <input
                    type="checkbox"
                    checked={campaignEnabled}
                    onChange={(event) => setCampaignEnabled(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-700 bg-black"
                  />
                  Enable audience claims
                </label>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Secret claim word"
                    type="password"
                    value={claimWord}
                    onChange={(event) => setClaimWord(event.target.value)}
                    placeholder="Shared at the event"
                    disabled={!campaignEnabled}
                    className="bg-black/40 border-gray-800"
                  />
                  <Input
                    label="Max claims"
                    type="number"
                    min="1"
                    value={maxClaims}
                    onChange={(event) => setMaxClaims(event.target.value)}
                    disabled={!campaignEnabled}
                    className="bg-black/40 border-gray-800"
                  />
                  <Input
                    label="Claim opens"
                    type="datetime-local"
                    value={claimStart}
                    onChange={(event) => setClaimStart(event.target.value)}
                    disabled={!campaignEnabled}
                    className="bg-black/40 border-gray-800"
                  />
                  <Input
                    label="Claim closes"
                    type="datetime-local"
                    value={claimEnd}
                    onChange={(event) => setClaimEnd(event.target.value)}
                    disabled={!campaignEnabled}
                    className="bg-black/40 border-gray-800"
                  />
                </div>
                <p className="mt-3 text-xs text-purple-100/70">
                  The claim word is hashed before it is stored in AO. Attendees
                  claim from the event asset process, which tracks one claim per
                  wallet in Lua state.
                </p>
              </div>
            )}
          </div>

          {isPoapMode && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={handleVerifySelected}
                disabled={verifying || !selectedPoap || !tokenId.trim() || !activeOwner}
                className="border border-emerald-400/35 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
              >
                {verifying ? "Verifying..." : "Verify Selected POAP"}
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
          )}

          <div className="mt-5 space-y-2 rounded-lg border border-gray-800 bg-black/30 p-3 text-sm">
            {isPoapMode ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-300">POAP selected</span>
                  <span className={selectedPoap ? "text-emerald-300" : "text-gray-500"}>
                    {selectedPoap ? "Ready" : "Required"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-300">POAP ownership</span>
                  <span className={verification?.owns ? "text-emerald-300" : "text-gray-500"}>
                    {verification?.owns ? "Verified" : "Required"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-300">EVM address control</span>
                  <span className={ownerProven ? "text-emerald-300" : "text-gray-500"}>
                    {ownerProven ? "Proven" : "Required to claim"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-300">Event details</span>
                  <span className={title && startDate ? "text-emerald-300" : "text-gray-500"}>
                    {title && startDate ? "Ready" : "Required"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-gray-300">Audience claims</span>
                  <span
                    className={
                      !campaignEnabled || claimWord
                        ? "text-emerald-300"
                        : "text-gray-500"
                    }
                  >
                    {campaignEnabled
                      ? claimWord
                        ? `${maxClaims || "1"} max`
                        : "Claim word required"
                      : "Disabled"}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-300">Artwork on Arweave</span>
              <span className={artworkId ? "text-emerald-300" : "text-amber-200"}>
                {artworkId
                  ? "Ready"
                  : isPoapMode
                  ? "Uploads during mint"
                  : artworkFile
                  ? "Uploads during mint"
                  : "Optional"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-300">Arweave mint wallet</span>
              <span className={arweaveMintAddress ? "text-emerald-300" : "text-gray-500"}>
                {arweaveMintAddress
                  ? `${arweaveMintAddress.slice(0, 6)}...${arweaveMintAddress.slice(-4)}`
                  : "Required"}
              </span>
            </div>
          </div>

          {!arweaveMintAddress && (
            <Button
              type="button"
              onClick={handleConnectArweave}
              disabled={arweaveWalletLoading}
              className="mt-4 w-full border border-purple-400/35 bg-purple-400/10 text-purple-100 hover:bg-purple-400/15"
            >
              {arweaveWalletLoading
                ? "Connecting Arweave Wallet..."
                : isPoapMode
                ? "Connect Wander or ArConnect to Claim"
                : "Connect Wander or ArConnect to Create"}
            </Button>
          )}

          <Button
            type="button"
            onClick={handleMint}
            disabled={minting || !canMint}
            className="mt-5 w-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-600 hover:to-cyan-600"
          >
            {minting || mirroringArtwork
              ? mirroringArtwork
                ? isPoapMode
                  ? "Uploading POAP Artwork..."
                  : "Uploading POMP Artwork..."
                : "Minting POMP..."
              : canMint
              ? isPoapMode
                ? "Claim POMP Atomic Asset"
                : "Create POMP Atomic Asset"
              : missingMintRequirement}
          </Button>

          {!arweaveMintAddress && (
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
              {asset.artworkUpload && (
                <p className="mt-2 break-all text-xs text-purple-100/80">
                  Artwork: {asset.artworkUpload.id}
                </p>
              )}
              {asset.claimUrl && (
                <div className="mt-3 rounded-md border border-purple-400/20 bg-black/25 p-3">
                  <p className="text-sm font-medium text-white">
                    Audience claim link
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-purple-100/80">
                    {currentOrigin}
                    {asset.claimUrl}
                  </p>
                  <p className="mt-2 text-xs text-purple-100/65">
                    Attendees use this link and the event word to receive one
                    balance from this POMP campaign asset.
                  </p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                {asset.artworkUpload && (
                  <a
                    href={asset.artworkUpload.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-cyan-300 hover:text-cyan-200"
                  >
                    Open artwork
                  </a>
                )}
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
                {asset.claimUrl && (
                  <>
                    <Link
                      href={asset.claimUrl}
                      className="text-sm text-cyan-300 hover:text-cyan-200"
                    >
                      Open claim page
                    </Link>
                    <button
                      type="button"
                      onClick={() => copyClaimLink(asset.claimUrl!)}
                      className="text-sm text-cyan-300 hover:text-cyan-200"
                    >
                      Copy claim link
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContainer>
      </div>
    </div>
  );
}
