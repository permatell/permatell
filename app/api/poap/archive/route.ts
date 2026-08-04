import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { isPoapArchiveConfigured, lookupPoapArchive } from "../_archive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isPoapArchiveConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "POAP archive is not configured. Set POAP_ARCHIVE_DB_PATH and POAP_ARCHIVE_ARTWORK_DIR.",
      },
      { status: 503 }
    );
  }

  const tokenId = request.nextUrl.searchParams.get("tokenId") || "";
  const dropId = request.nextUrl.searchParams.get("dropId") || "";
  const ownerAddress = request.nextUrl.searchParams.get("ownerAddress") || "";

  if (tokenId && !/^\d+$/.test(tokenId)) {
    return NextResponse.json(
      { error: "tokenId must be numeric." },
      { status: 400 }
    );
  }
  if (dropId && !/^\d+$/.test(dropId)) {
    return NextResponse.json(
      { error: "dropId must be numeric." },
      { status: 400 }
    );
  }
  if (ownerAddress && !isAddress(ownerAddress)) {
    return NextResponse.json(
      { error: "ownerAddress must be a valid EVM address." },
      { status: 400 }
    );
  }
  if (!tokenId && !dropId) {
    return NextResponse.json(
      { error: "Provide tokenId or dropId." },
      { status: 400 }
    );
  }

  const result = await lookupPoapArchive({ tokenId, dropId, ownerAddress });
  if (!result?.drop) {
    return NextResponse.json(
      { configured: true, found: false },
      { status: 404 }
    );
  }

  return NextResponse.json({
    configured: true,
    found: true,
    ...result,
  });
}
