"use client";

import {
  DEFAULT_HYPERBEAM_WRITE_URL,
  getHyperbeamWriteUrl,
  isHungPortalWriteUrl,
  normalizeHyperbeamUrl,
} from "@/lib/ao-config";

/** Hard cap on distinct push URLs per aoconnect message(). */
const MAX_PUSH_ATTEMPTS = 2;

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

function pathnameOf(url: string): string {
  try {
    return new URL(url, window.location.href).pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

function isRelayPath(url: string): boolean {
  return pathnameOf(url).includes("~relay@1.0/");
}

function isSchedulePath(url: string): boolean {
  return pathnameOf(url).endsWith("/schedule");
}

function hyperbeamDebugEnabled(): boolean {
  try {
    if (process.env.NEXT_PUBLIC_HYPERBEAM_DEBUG === "1") return true;
    return (
      typeof window !== "undefined" &&
      window.localStorage?.getItem("hyperbeamDebug") === "1"
    );
  } catch {
    return false;
  }
}

function debugLog(...args: unknown[]): void {
  if (hyperbeamDebugEnabled()) console.debug("[hyperbeam]", ...args);
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

/**
 * Normalize aoconnect (or mistaken) paths onto the write node.
 * app-1.forward.computer serves `/{id}~process@1.0/push` (400 on bad body)
 * and hard-404s `~relay@1.0/*` including `/schedule`. Never emit those.
 */
function toProcessPushUrl(url: string): string {
  const parsed = new URL(url, window.location.href);
  parsed.pathname = parsed.pathname
    .replace(/~relay@1\.0\//g, "~process@1.0/")
    .replace(/\/schedule\/?$/, "/push");
  parsed.searchParams.delete("async");
  parsed.searchParams.delete("max-depth");
  return parsed.toString();
}

/**
 * aoconnect mainnet `message()` hardcodes `/{id}~process@1.0/push`.
 * Host-rewrite to the write node, keep process@1.0/push first, optionally one
 * `?async=true` retry. Cap at MAX_PUSH_ATTEMPTS. Spawn `/push` unchanged.
 */
function buildAttemptUrls(url: string): string[] {
  const node = getWriteNodeUrls()[0];
  if (!node) return [];

  const hostUrl = toProcessPushUrl(rewriteHost(url, node));
  const urls = [hostUrl];
  if (pathnameOf(hostUrl).endsWith("/push")) {
    urls.push(withQueryParam(hostUrl, "async", "true"));
  }
  return dedupe(urls).slice(0, MAX_PUSH_ATTEMPTS);
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
    return (await response.clone().text()).slice(0, 240);
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
        debugLog("request failed", {
          url,
          method: baseRequest.method,
          status: res.status,
        });
      }
      return res;
    }

    const attempts = buildAttemptUrls(url);
    let lastResponse: Response | null = null;
    let lastError: unknown = null;
    let skipRelay = false;
    let skipSchedule = false;

    for (const attemptUrl of attempts) {
      if (skipRelay && isRelayPath(attemptUrl)) continue;
      if (skipSchedule && isSchedulePath(attemptUrl)) continue;

      try {
        const res = await fetchWithTimeout(fetchImpl, attemptUrl, baseRequest);
        if (!isRetryableResponse(res)) {
          debugLog("push ok", { url: attemptUrl, status: res.status });
          return res;
        }

        lastResponse = res;
        // Hard 404 on relay/schedule: never retry sibling async/schedule variants.
        if (res.status === 404 && isRelayPath(attemptUrl)) {
          skipRelay = true;
          debugLog("skipping remaining relay@1.0 paths after 404", attemptUrl);
          continue;
        }
        if (res.status === 404 && isSchedulePath(attemptUrl)) {
          skipSchedule = true;
          debugLog("skipping remaining /schedule paths after 404", attemptUrl);
          continue;
        }
        debugLog("push attempt failed", {
          url: attemptUrl,
          status: res.status,
        });
      } catch (error) {
        lastError = error;
        debugLog("push attempt errored", {
          url: attemptUrl,
          error: String((error as { message?: string })?.message || error),
        });
      }
    }

    const summary = {
      tried: attempts.length,
      lastUrl: attempts[attempts.length - 1] || url,
      status: lastResponse?.status,
      body: lastResponse ? await responseBody(lastResponse) : undefined,
      error: lastError
        ? String((lastError as { message?: string })?.message || lastError)
        : undefined,
    };
    console.warn("[hyperbeam] push failed", summary);

    if (lastResponse) return lastResponse;
    throw lastError instanceof Error
      ? lastError
      : new Error("HyperBEAM push failed");
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
