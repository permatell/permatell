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

  const asset = await fetchPompAssetDetail(assetId);
  if (!asset) {
    return NextResponse.json(
      { error: "POMP asset was not found." },
      { status: 404 }
    );
  }

  return NextResponse.json(asset);
}
