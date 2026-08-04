import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
