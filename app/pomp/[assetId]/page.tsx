"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PompAssetDetails } from "@/components/pomp/pomp-asset-details";
import { fetchPompAssetDetail, type PompAssetDetail } from "@/lib/pomp";

export default function PompAssetPage() {
  const params = useParams<{ assetId: string }>();
  const assetId = String(params?.assetId || "");
  const [asset, setAsset] = useState<PompAssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAsset = async () => {
    if (!assetId) return;
    setLoading(true);
    setError("");
    console.info("[pomp-detail] loading asset page", { assetId });
    try {
      const detail = await fetchPompAssetDetail(assetId);
      setAsset(detail);
      console.info("[pomp-detail] asset page loaded", {
        assetId,
        title: detail.title,
        artworkUrl: detail.artworkUrl,
        assetType: detail.assetType,
        sourceProtocol: detail.sourceProtocol,
        metadataKeys: Object.keys(detail.metadata || {}),
        tagKeys: Object.keys(detail.tags || {}),
        hasCampaign: Boolean(detail.campaign),
      });
    } catch (err: any) {
      setAsset(null);
      setError(err?.message || "Unable to load POMP asset.");
      console.warn("[pomp-detail] asset page failed", {
        assetId,
        error: err,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAsset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  const isCampaign = asset?.assetType === "native-event" || Boolean(asset?.campaign);

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/pomp" className="text-sm text-cyan-300 hover:text-cyan-200">
            Back to POMP
          </Link>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-400/10 px-3 py-1 text-sm text-purple-100">
            <Award className="h-4 w-4" />
            POMP Asset
          </div>
          <h1 className="mt-4 text-4xl font-bold text-white">
            {asset?.title || "POMP Details"}
          </h1>
          <p className="mt-3 text-gray-300">
            Permanent memory asset metadata, provenance tags, artwork, and AO
            campaign state when available.
          </p>
        </div>
        {isCampaign && (
          <Link href={`/pomp/claim/${assetId}`}>
            <Button className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white hover:from-purple-600 hover:to-cyan-600">
              Claim POMP
            </Button>
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex min-h-[240px] items-center justify-center">
          <Spinner className="h-8 w-8 text-purple-500" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-400/25 bg-red-400/10 p-6 text-red-100">
          {error}
        </div>
      ) : asset ? (
        <PompAssetDetails asset={asset} />
      ) : null}
    </div>
  );
}
