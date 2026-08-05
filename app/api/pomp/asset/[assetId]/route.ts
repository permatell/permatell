import { NextRequest, NextResponse } from "next/server";
import { fetchPompAssetDetail, normalizeAoId } from "../../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ assetId: string }> }
) {
  const params = await context.params;
  const assetId = normalizeAoId(params.assetId);
  if (!assetId) {
    return NextResponse.json(
      { error: "A valid POMP asset id is required." },
      { status: 400 }
    );
  }

  console.info("[pomp-detail] api request", { assetId });
  const asset = await fetchPompAssetDetail(assetId);
  if (!asset) {
    console.warn("[pomp-detail] api not found", { assetId });
    return NextResponse.json(
      { error: "POMP asset was not found." },
      { status: 404 }
    );
  }

  console.info("[pomp-detail] api response", {
    assetId,
    title: asset.title,
    artworkUrl: asset.artworkUrl,
    assetType: asset.assetType,
    sourceProtocol: asset.sourceProtocol,
    metadataKeys: Object.keys(asset.metadata || {}),
    tagKeys: Object.keys(asset.tags || {}),
    hasCampaign: Boolean(asset.campaign),
  });
  return NextResponse.json(asset);
}
