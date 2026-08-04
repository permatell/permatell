import { NextRequest, NextResponse } from "next/server";
import { fetchPompCampaignInfo, normalizeAoId } from "../../_shared";

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

  const campaign = await fetchPompCampaignInfo(assetId);
  if (!campaign) {
    return NextResponse.json(
      { error: "Campaign state was not found for this POMP." },
      { status: 404 }
    );
  }

  return NextResponse.json(campaign);
}
