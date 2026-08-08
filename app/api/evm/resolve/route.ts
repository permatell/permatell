import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { TtlCache } from "@/lib/ttlCache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ENS_RPC_URL =
  process.env.ETHEREUM_RPC_URL || "https://ethereum-rpc.publicnode.com";
const RESOLVE_TIMEOUT_MS = 8_000;
const RESOLVE_CACHE_TTL_MS = 5 * 60_000;

const resolveCache = new TtlCache<{ address: string; name?: string }>(
  RESOLVE_CACHE_TTL_MS
);

/**
 * Resolves an ENS name (or passes through a plain address) server side.
 *
 * Doing this on the server keeps `viem/chains` and the ENS universal resolver
 * out of the client bundle, and avoids depending on a public RPC allowing
 * cross-origin browser requests.
 */
export async function GET(request: NextRequest) {
  const value = (request.nextUrl.searchParams.get("value") || "").trim();
  if (!value) {
    return NextResponse.json(
      { error: "An address or ENS name is required." },
      { status: 400 }
    );
  }

  if (isAddress(value)) {
    return NextResponse.json({ address: getAddress(value) });
  }

  /**
   * Restricted to ASCII on purpose. `normalize` from `viem/ens` cannot be used
   * here: `next.config.js` runs viem through `transpilePackages`, and that
   * breaks the `@adraffy/ens-normalize` interop badly enough that `normalize`
   * returns `undefined` instead of throwing. For the ASCII subset below, ENS
   * normalisation is just lower-casing, and anything outside it is rejected
   * rather than guessed at -- which also sidesteps homograph lookalikes.
   */
  if (!/^[a-z0-9-_.]+\.[a-z]{2,}$/i.test(value)) {
    return NextResponse.json(
      {
        error:
          "Enter a valid EVM address (0x…) or a plain ENS name. For names with emoji or non-Latin characters, paste the 0x address instead.",
      },
      { status: 400 }
    );
  }

  const name = value.toLowerCase();
  const cacheKey = `ens:${name}`;
  const cached = resolveCache.get(cacheKey);
  if (cached) return NextResponse.json(cached);

  const client = createPublicClient({
    chain: mainnet,
    transport: http(ENS_RPC_URL, {
      timeout: RESOLVE_TIMEOUT_MS,
      retryCount: 1,
    }),
  });

  try {
    const address = await client.getEnsAddress({ name });
    if (!address) {
      return NextResponse.json(
        { error: `${value} does not resolve to an address.` },
        { status: 404 }
      );
    }
    const payload = { address: getAddress(address), name };
    resolveCache.set(cacheKey, payload);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { error: "Unable to reach ENS right now. Paste the 0x address instead." },
      { status: 502 }
    );
  }
}
