"use client";

import { ExternalLink } from "lucide-react";
import { CardContainer } from "@/components/ui/card-container";
import type { PompAssetDetail } from "@/lib/pomp";

function shortAddress(value: string) {
  return value ? `${value.slice(0, 8)}...${value.slice(-6)}` : "Unknown";
}

function DetailRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="rounded-md border border-gray-800 bg-black/30 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 break-words text-sm text-gray-100">{value}</p>
    </div>
  );
}

export function PompAssetDetails({ asset }: { asset: PompAssetDetail }) {
  const claims = Object.values(asset.campaign?.claims || {});
  const assetKind =
    asset.assetType === "native-event"
      ? "Native POMP Campaign"
      : asset.sourceProtocol === "POAP"
      ? "POAP Migration POMP"
      : "POMP Atomic Asset";

  return (
    <CardContainer className="border border-gray-800 bg-black/45 p-5 shadow-lg">
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="overflow-hidden rounded-lg border border-purple-400/25 bg-gray-950">
            {asset.artworkUrl ? (
              <img
                src={asset.artworkUrl}
                alt={asset.title}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-gray-500">
                POMP
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <a
              href={asset.bazarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
            >
              Bazar <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <a
              href={asset.arweaveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
            >
              Arweave <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {asset.artworkUrl && (
              <a
                href={asset.artworkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200"
              >
                Artwork <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-4">
            <p className="text-sm text-purple-200">{assetKind}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">
              {asset.title}
            </h2>
            {asset.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">
                {asset.description}
              </p>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Asset id" value={asset.assetId} />
            <DetailRow label="Creator" value={shortAddress(asset.arweaveOwner)} />
            <DetailRow label="Source" value={asset.sourceProtocol || "POMP"} />
            <DetailRow label="Asset type" value={asset.assetType || "POMP"} />
            <DetailRow label="City" value={asset.city} />
            <DetailRow label="Country" value={asset.country} />
            <DetailRow label="Start date" value={asset.startDate} />
            <DetailRow label="End date" value={asset.endDate} />
            <DetailRow label="Event URL" value={asset.eventUrl} />
            <DetailRow label="Created" value={asset.createdAt} />
            <DetailRow label="POAP token" value={asset.tokenId} />
            <DetailRow label="POAP drop" value={asset.dropId} />
            <DetailRow label="POAP network" value={asset.poapNetwork} />
            <DetailRow label="POAP owner" value={asset.poapOwner} />
          </div>

          {asset.campaign && (
            <div className="mt-5 rounded-lg border border-cyan-400/20 bg-cyan-400/10 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold text-white">AO Campaign State</h3>
                  <p className="mt-1 text-sm text-cyan-100/75">
                    Loaded from {asset.campaign.source}
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md bg-black/30 px-3 py-2">
                    <p className="text-gray-500">Claimed</p>
                    <p className="font-semibold text-white">
                      {asset.campaign.claimed}
                    </p>
                  </div>
                  <div className="rounded-md bg-black/30 px-3 py-2">
                    <p className="text-gray-500">Remaining</p>
                    <p className="font-semibold text-white">
                      {asset.campaign.remaining}
                    </p>
                  </div>
                  <div className="rounded-md bg-black/30 px-3 py-2">
                    <p className="text-gray-500">Owner</p>
                    <p className="font-semibold text-white">
                      {asset.campaign.ownerBalance || "0"}
                    </p>
                  </div>
                </div>
              </div>

              {claims.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-md border border-cyan-400/15">
                  <div className="grid grid-cols-[64px_1fr] bg-black/40 px-3 py-2 text-xs uppercase tracking-wide text-cyan-100/60">
                    <span>#</span>
                    <span>Claim Wallet</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {claims.map((claim, index) => (
                      <div
                        key={`${claim.WalletAddress || index}`}
                        className="grid grid-cols-[64px_1fr] border-t border-cyan-400/10 px-3 py-2 text-sm"
                      >
                        <span className="text-cyan-100/70">
                          {claim.ClaimIndex || index + 1}
                        </span>
                        <span className="break-all font-mono text-cyan-100">
                          {claim.WalletAddress || claim.Recipient || "Unknown"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </CardContainer>
  );
}
