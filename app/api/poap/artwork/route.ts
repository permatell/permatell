import { NextRequest, NextResponse } from "next/server";
import { readPoapArchiveArtwork } from "../_archive";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const dropId = request.nextUrl.searchParams.get("dropId") || "";
  if (dropId) {
    if (!/^\d+$/.test(dropId)) {
      return NextResponse.json(
        { error: "dropId must be numeric." },
        { status: 400 }
      );
    }

    const bytes = await readPoapArchiveArtwork(dropId);
    if (!bytes) {
      return NextResponse.json(
        { error: "Archived POAP artwork was not found." },
        { status: 404 }
      );
    }

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  const rawUrl = request.nextUrl.searchParams.get("url") || "";
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Valid artwork URL is required." }, { status: 400 });
  }

  if (url.protocol !== "https:") {
    return NextResponse.json(
      { error: "Only HTTPS artwork URLs are supported." },
      { status: 400 }
    );
  }

  const response = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
    },
  });

  if (!response.ok) {
    return NextResponse.json(
      { error: `Artwork request failed with ${response.status}.` },
      { status: response.status }
    );
  }

  const contentType = response.headers.get("content-type") || "image/webp";
  const bytes = await response.arrayBuffer();
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
    },
  });
}
