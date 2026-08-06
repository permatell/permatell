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
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") || 24), 1),
    100
  );
  const owner = request.nextUrl.searchParams.get("owner")?.trim() || "";
  const creator = request.nextUrl.searchParams.get("creator")?.trim() || "";
  const assetType =
    request.nextUrl.searchParams.get("assetType")?.trim() || "";

  const query = `
    query DiscoverPomps($owners: [String!], $tags: [TagFilter!], $first: Int!) {
      transactions(owners: $owners, tags: $tags, first: $first, sort: HEIGHT_DESC) {
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
  const variables: Record<string, unknown> = {
    owners: owner ? [owner] : undefined,
    first: limit,
    tags: [
      { name: "App-Name", values: [POMP_APP_NAME] },
      { name: "Type", values: [POMP_TYPE] },
      {
        name: "POMP-Asset-Type",
        values: assetType ? [assetType] : ["poap-claim", "native-event"],
      },
      { name: "POMP-Source", values: ["POAP", "POMP"] },
      ...(creator ? [{ name: "Creator", values: [creator] }] : []),
    ],
  };

  let lastError = "Unable to discover POMPs.";
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
        lastError = `POMP discovery failed with ${response.status}: ${text.slice(0, 300)}`;
        continue;
      }
      const json = JSON.parse(text);
      const edges = json?.data?.transactions?.edges || [];
      const pomps = edges
        .map((edge: any) => pompAssetFromGraphqlEdge(edge, owner))
        .filter(Boolean);
      if (pomps.length > 0) {
        return NextResponse.json({
          source: endpoint,
          count: pomps.length,
          pomps,
        });
      }
      lastError = `No POMPs indexed at ${endpoint}.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
