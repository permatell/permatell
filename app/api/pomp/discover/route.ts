import { NextRequest, NextResponse } from "next/server";
import {
  POMP_APP_NAME,
  POMP_GRAPHQL_ENDPOINTS,
  POMP_TYPE,
  getTagValue,
  pompAssetFromGraphqlEdge,
} from "../_shared";
import {
  TtlCache,
  isRateLimitStatus,
  rateLimitMessage,
  sleep,
} from "@/lib/ttlCache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DISCOVER_CACHE_TTL_MS = 60_000;
const RATE_LIMIT_BACKOFF_MS = 750;
const discoverCache = new TtlCache<{
  source: string;
  count: number;
  pomps: unknown[];
}>(DISCOVER_CACHE_TTL_MS);

type GraphqlResult =
  | { ok: true; edges: any[] }
  | { ok: false; status: number; error: string; rateLimited: boolean };

async function postGraphql(
  endpoint: string,
  query: string,
  variables: Record<string, unknown>
): Promise<GraphqlResult> {
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      cache: "no-store",
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: `POMP discovery failed with ${response.status}: ${text.slice(0, 300)}`,
        rateLimited: isRateLimitStatus(response.status),
      };
    }
    const json = JSON.parse(text);
    return {
      ok: true,
      edges: json?.data?.transactions?.edges || [],
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error instanceof Error ? error.message : String(error),
      rateLimited: false,
    };
  }
}

function mapPomps(edges: any[], owner: string, limit: number) {
  return edges
    .map((edge: any) => pompAssetFromGraphqlEdge(edge, owner))
    .filter(Boolean)
    .slice(0, limit);
}

function filterBroadPomps(edges: any[], owner: string, limit: number) {
  return edges
    .filter((edge: any) => {
      const tags = edge?.node?.tags || [];
      const type = getTagValue(tags, ["Type"]);
      const assetType = getTagValue(tags, ["POMP-Asset-Type"]);
      const source = getTagValue(tags, ["POMP-Source"]);
      return (
        type === POMP_TYPE ||
        ["poap-claim", "native-event"].includes(assetType) ||
        ["POAP", "POMP"].includes(source)
      );
    })
    .map((edge: any) => pompAssetFromGraphqlEdge(edge, owner))
    .filter(Boolean)
    .slice(0, limit);
}

export async function GET(request: NextRequest) {
  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit") || 24), 1),
    100
  );
  const owner = request.nextUrl.searchParams.get("owner")?.trim() || "";
  const creator = request.nextUrl.searchParams.get("creator")?.trim() || "";
  const assetType =
    request.nextUrl.searchParams.get("assetType")?.trim() || "";

  const cacheKey = `discover:${owner}:${creator}:${assetType}:${limit}`;
  const cached = discoverCache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=30" },
    });
  }

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
  // Some indexers do not expose every POMP tag consistently in a compound
  // GraphQL filter. Keep the strict query for efficiency, then use this
  // broader PermaTell query as a compatibility fallback.
  const broadQuery = `
    query DiscoverPermaTell($owners: [String!], $tags: [TagFilter!], $first: Int!) {
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
  let sawRateLimit = false;
  let broadFallbackUsed = false;

  for (const endpoint of POMP_GRAPHQL_ENDPOINTS) {
    const strict = await postGraphql(endpoint, query, variables);
    if (!strict.ok) {
      lastError = strict.error;
      if (strict.rateLimited) {
        sawRateLimit = true;
        await sleep(RATE_LIMIT_BACKOFF_MS);
      }
      continue;
    }

    const pomps = mapPomps(strict.edges, owner, limit);
    if (pomps.length > 0) {
      const payload = { source: endpoint, count: pomps.length, pomps };
      discoverCache.set(cacheKey, payload);
      return NextResponse.json(payload);
    }

    // Successful empty response from a healthy indexer is authoritative.
    // Only run the broad compatibility fallback once across all endpoints.
    if (!broadFallbackUsed) {
      broadFallbackUsed = true;
      const broad = await postGraphql(endpoint, broadQuery, {
        owners: owner ? [owner] : undefined,
        first: Math.max(limit, 100),
        tags: [{ name: "App-Name", values: [POMP_APP_NAME] }],
      });
      if (!broad.ok) {
        lastError = broad.error;
        if (broad.rateLimited) {
          sawRateLimit = true;
          await sleep(RATE_LIMIT_BACKOFF_MS);
        }
      } else {
        const broadPomps = filterBroadPomps(broad.edges, owner, limit);
        if (broadPomps.length > 0) {
          const payload = {
            source: endpoint,
            count: broadPomps.length,
            pomps: broadPomps,
          };
          discoverCache.set(cacheKey, payload);
          return NextResponse.json(payload);
        }
        const emptyPayload = { source: endpoint, count: 0, pomps: [] as unknown[] };
        discoverCache.set(cacheKey, emptyPayload, 20_000);
        return NextResponse.json(emptyPayload);
      }
    } else {
      const emptyPayload = { source: endpoint, count: 0, pomps: [] as unknown[] };
      discoverCache.set(cacheKey, emptyPayload, 20_000);
      return NextResponse.json(emptyPayload);
    }
  }

  if (sawRateLimit) {
    return NextResponse.json(
      { error: rateLimitMessage("POMP discovery", lastError) },
      {
        status: 429,
        headers: { "Retry-After": "30" },
      }
    );
  }

  return NextResponse.json({ error: lastError }, { status: 502 });
}
