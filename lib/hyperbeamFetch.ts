"use client";

import {
  DEFAULT_HYPERBEAM_WRITE_URL,
  getHyperbeamWriteUrl,
  isHungPortalWriteUrl,
  MAINNET_DEVICE,
  normalizeHyperbeamUrl,
} from "@/lib/ao-config";

function getUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function isPushRequest(url: string, method: string): boolean {
  if (method.toUpperCase() !== "POST") return false;
  try {
    const path = new URL(url, window.location.href).pathname.replace(/\/+$/, "");
    return path.endsWith("/push") || path.endsWith("/schedule");
  } catch {
    return false;
  }
}

function isArweaveGraphqlRequest(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.hostname === "arweave.net" && parsed.pathname === "/graphql";
  } catch {
    return false;
  }
}

async function proxyArweaveGraphql(
  fetchImpl: typeof fetch,
  baseRequest: Request
): Promise<Response> {
  const headers = new Headers(baseRequest.headers);
  headers.set("Content-Type", headers.get("Content-Type") || "application/json");
  return fetchImpl("/api/arweave/graphql", {
    method: baseRequest.method,
    headers,
    body: await baseRequest.clone().text(),
    cache: "no-store",
  });
}

function withQueryParam(url: string, key: string, value: string): string {
  const parsed = new URL(url, window.location.href);
  parsed.searchParams.set(key, value);
  return parsed.toString();
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim().replace(/\/+$/, "");
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

/**
 * Write nodes for HyperBEAM POST /push. Never include hung Portal
 * (hb.portalinto.com). Prefer the resolved write URL, then explicit env,
 * then app-1.forward.computer.
 */
function getWriteNodeUrls(): string[] {
  return dedupe(
    [
      getHyperbeamWriteUrl(),
      normalizeHyperbeamUrl(process.env.NEXT_PUBLIC_AO_WRITE_URL),
      normalizeHyperbeamUrl(process.env.NEXT_PUBLIC_HYPERBEAM_WRITE_URL),
      normalizeHyperbeamUrl(process.env.NEXT_PUBLIC_HYPERBEAM_URL),
      DEFAULT_HYPERBEAM_WRITE_URL,
    ].filter((url) => url && !isHungPortalWriteUrl(url))
  );
}

function rewriteHost(url: string, nodeBase: string): string {
  const parsed = new URL(url, window.location.href);
  const node = new URL(`${nodeBase.replace(/\/+$/, "")}/`);
  return `${node.origin}${parsed.pathname}${parsed.search}`;
}

function rewritePushToSchedule(url: string): string {
  const parsed = new URL(url, window.location.href);
  parsed.pathname = parsed.pathname.replace(/\/push$/, "/schedule");
  parsed.searchParams.delete("async");
  parsed.searchParams.delete("max-depth");
  return parsed.toString();
}

function rewriteProcessToRelay(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.href);
    if (!parsed.pathname.includes("~process@1.0/")) return null;
    parsed.pathname = parsed.pathname.replace(
      /~process@1\.0\//g,
      "~relay@1.0/"
    );
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * aoconnect mainnet `message()` hardcodes `/{id}~process@1.0/push` and
 * ignores `connect({ device })`. Prefer relay@1.0 for Wander ANS-104
 * DataItems; keep the original process@1.0 path as a same-node fallback.
 * Spawn `/push` (no process id) is unchanged.
 */
function deviceVariants(url: string): string[] {
  if (MAINNET_DEVICE !== "relay@1.0") return [url];
  const relayUrl = rewriteProcessToRelay(url);
  return relayUrl ? [relayUrl, url] : [url];
}

function buildAttemptUrls(url: string): string[] {
  const nodes = getWriteNodeUrls();
  const urls: string[] = [];
  for (const node of nodes) {
    for (const hostUrl of deviceVariants(rewriteHost(url, node))) {
      urls.push(withQueryParam(hostUrl, "async", "true"));
      urls.push(hostUrl);
      urls.push(rewritePushToSchedule(hostUrl));
    }
  }
  const seen = new Set<string>();
  return urls.filter((attemptUrl) => {
    if (seen.has(attemptUrl)) return false;
    seen.add(attemptUrl);
    return true;
  });
}

function createAttemptRequest(
  url: string,
  baseRequest: Request,
  signal: AbortSignal
): Request {
  const init: RequestInit & { duplex?: "half" } = {
    method: baseRequest.method,
    headers: baseRequest.headers,
    body: baseRequest.clone().body,
    redirect: "manual",
    signal,
  };

  if (init.body) {
    init.duplex = "half";
  }

  return new Request(url, init);
}

async function fetchWithTimeout(
  fetchImpl: typeof fetch,
  url: string,
  baseRequest: Request,
  timeoutMs = 10_000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => {
    controller.abort(new DOMException("HyperBEAM push timed out", "TimeoutError"));
  }, timeoutMs);
  try {
    return await fetchImpl(
      createAttemptRequest(url, baseRequest, controller.signal)
    );
  } finally {
    window.clearTimeout(timeout);
  }
}

function isRetryableResponse(response: Response): boolean {
  return (
    response.status === 404 ||
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  );
}

async function responseBody(response: Response): Promise<string> {
  try {
    return (await response.clone().text()).slice(0, 1_000);
  } catch {
    return "";
  }
}

export function createHyperbeamFetch(fetchImpl: typeof fetch = fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const baseRequest = new Request(input, init);
    const url = getUrl(baseRequest);

    if (isArweaveGraphqlRequest(url)) {
      return proxyArweaveGraphql(fetchImpl, baseRequest);
    }

    if (!isPushRequest(url, baseRequest.method)) {
      const res = await fetchImpl(baseRequest);
      if (!res.ok) {
        console.warn("[hyperbeam] request failed", {
          url,
          method: baseRequest.method,
          status: res.status,
          body: await responseBody(res),
        });
      }
      return res;
    }

    let lastResponse: Response | null = null;
    let lastError: unknown = null;
    for (const attemptUrl of buildAttemptUrls(url)) {
      try {
        const res = await fetchWithTimeout(fetchImpl, attemptUrl, baseRequest);
        if (!isRetryableResponse(res)) return res;
        lastResponse = res;
        console.warn("[hyperbeam] push attempt failed", {
          url: attemptUrl,
          status: res.status,
          body: await responseBody(res),
        });
      } catch (error) {
        lastError = error;
        console.warn("[hyperbeam] push attempt errored", {
          url: attemptUrl,
          error: String((error as { message?: string })?.message || error),
        });
      }
    }

    if (lastResponse) return lastResponse;
    throw lastError instanceof Error ? lastError : new Error("HyperBEAM push failed");
  }) as typeof fetch;
}

export async function withHyperbeamGlobalFetch<T>(fn: () => Promise<T>): Promise<T> {
  const global = globalThis as typeof globalThis & { fetch: typeof fetch };
  const previous = global.fetch.bind(global);
  global.fetch = createHyperbeamFetch(previous);
  try {
    return await fn();
  } finally {
    global.fetch = previous;
  }
}
