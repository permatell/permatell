import { NextRequest, NextResponse } from "next/server";
import {
  isPoapArchiveRemoteConfigured,
  searchPoapArchive,
} from "../../_archive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!isPoapArchiveRemoteConfigured()) {
    return NextResponse.json(
      { error: "The Arweave POAP archive search is disabled." },
      { status: 503 }
    );
  }

  const query = request.nextUrl.searchParams.get("q") || "";
  if (query.trim().length < 2) {
    return NextResponse.json(
      { error: "Search for at least two characters." },
      { status: 400 }
    );
  }

  try {
    const results = await searchPoapArchive(query);
    return NextResponse.json({
      query,
      count: results.length,
      snapshot: results[0]?.snapshot || "2026-07-02",
      results,
    });
  } catch (error) {
    console.error("[poap-archive] search failed:", error);
    return NextResponse.json(
      { error: "Unable to search the Arweave POAP archive." },
      { status: 502 }
    );
  }
}
