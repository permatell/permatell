import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GRAPHQL_ENDPOINTS = [
  process.env.AO_GQL_URL,
  process.env.NEXT_PUBLIC_AO_GQL_URL,
  "https://ao-search-gateway.goldsky.com/graphql",
  "https://arweave.net/graphql",
].filter(Boolean) as string[];

export async function POST(request: NextRequest) {
  const body = await request.text();
  let lastError = "Unable to query Arweave GraphQL.";

  for (const endpoint of GRAPHQL_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = `GraphQL proxy failed with ${response.status}: ${text.slice(0, 300)}`;
        continue;
      }
      return new NextResponse(text, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
