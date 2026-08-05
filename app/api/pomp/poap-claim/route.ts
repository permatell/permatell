import { NextRequest, NextResponse } from "next/server";
import {
  POMP_APP_NAME,
  POMP_GRAPHQL_ENDPOINTS,
  POMP_TYPE,
  pompAssetFromGraphqlEdge,
} from "../_shared";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const tokenId = request.nextUrl.searchParams.get("tokenId")?.trim() || "";
  const network = request.nextUrl.searchParams.get("network")?.trim() || "";

  if (!/^\d+$/.test(tokenId)) {
    return NextResponse.json(
      { error: "A numeric POAP token id is required." },
      { status: 400 }
    );
  }
  if (!network) {
    return NextResponse.json(
      { error: "A POAP network is required." },
      { status: 400 }
    );
  }

  const query = `
    query ExistingPompPoapClaim($tags: [TagFilter!]!) {
      transactions(tags: $tags, first: 1, sort: HEIGHT_DESC) {
        edges {
          node {
            id
            owner { address }
            block { timestamp }
            tags { name value }
          }
        }
      }
    }
  `;
  const variables = {
    tags: [
      { name: "App-Name", values: [POMP_APP_NAME] },
      { name: "Type", values: [POMP_TYPE] },
      { name: "POMP-Asset-Type", values: ["poap-claim"] },
      { name: "POMP-Source", values: ["POAP"] },
      { name: "POAP-Network", values: [network] },
      { name: "POAP-Token-Id", values: [tokenId] },
    ],
  };

  let lastError = "Unable to check existing POAP POMP claims.";
  for (const endpoint of POMP_GRAPHQL_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
        cache: "no-store",
      });
      const text = await response.text();
      if (!response.ok) {
        lastError = `POAP POMP lookup failed with ${response.status}: ${text.slice(0, 300)}`;
        continue;
      }
      const json = JSON.parse(text);
      const edge = json?.data?.transactions?.edges?.[0];
      const pomp = edge ? pompAssetFromGraphqlEdge(edge) : null;
      return NextResponse.json({
        exists: Boolean(pomp),
        pomp,
        source: endpoint,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
