import "@/lib/buffer-base64url";

/**
 * Centralized AO / HyperBEAM configuration.
 *
 * NOTE: aoconnect's dryrun/result APIs require the LEGACY format (CU_URL with
 * /dry-run and /result endpoints). HyperBEAM nodes use a different protocol
 * (AO 2.0 process@1.0) and do NOT expose /dry-run. cu.ao.xyz does not resolve (NXDOMAIN).
 *
 * Strategy: Always use legacy connect() for dryrun/result. Use CU_URL as follows:
 * - When HyperBEAM is configured and healthy: try it (it may 404 for /dry-run)
 * - Otherwise: use forward.computer as the CU read fallback. Legacy writes
 *   still need the legacy MU while the story processes remain legacynet-era.
 */

import {
  connect as originalConnect,
  createDataItemSigner as originalCreateDataItemSigner,
  dryrun as originalDryrun,
  message as originalMessage,
  result as originalResult,
  results as originalResults,
  spawn as originalSpawn,
} from "@permaweb/aoconnect";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AOMode = "mainnet" | "legacy";

export interface AOConfig {
  mode: AOMode;
  mu_url: string;
  cu_url: string;
  gateway: string;
  hyperbeam_url: string | null;
}

// ---------------------------------------------------------------------------
// Process IDs (legacy = dryrun/CU; mainnet = same or env override for HyperBEAM)
// ---------------------------------------------------------------------------

export const PROCESS_IDS = {
  stories:
    process.env.NEXT_PUBLIC_STORIES_PROCESS_ID ||
    "yNXoHCY4InORm5cgoIKh1592-5JNNGeTqUaZzVTo_0E",
  storyPoints:
    process.env.NEXT_PUBLIC_STORYPOINTS_PROCESS_ID ||
    "CiCoT60SUbCAJYY2ncv_-BJOQvGB0tHib_mTLJv4Q6Q",
} as const;

export const MAINNET_PROCESS_IDS = {
  stories:
    process.env.NEXT_PUBLIC_MAINNET_STORIES_PROCESS_ID ||
    process.env.NEXT_PUBLIC_STORIES_PROCESS_ID ||
    PROCESS_IDS.stories,
  storyPoints:
    process.env.NEXT_PUBLIC_MAINNET_STORYPOINTS_PROCESS_ID ||
    process.env.NEXT_PUBLIC_STORYPOINTS_PROCESS_ID ||
    PROCESS_IDS.storyPoints,
} as const;

// ---------------------------------------------------------------------------
// Endpoint resolution
// ---------------------------------------------------------------------------

const LEGACY_ENDPOINTS = {
  mu: process.env.NEXT_PUBLIC_AO_MU_URL || "https://mu.ao-testnet.xyz",
  cu: process.env.NEXT_PUBLIC_AO_CU_URL || "https://forward.computer",
  gateway:
    process.env.NEXT_PUBLIC_AO_GATEWAY_URL || "https://arweave.net",
};

const MAINNET_ENDPOINTS = {
  mu: process.env.NEXT_PUBLIC_AO_MAINNET_MU_URL || "https://mu.ao.xyz",
  cu: process.env.NEXT_PUBLIC_AO_MAINNET_CU_URL || "https://forward.computer",
  gateway: "https://arweave.net",
};

// ---------------------------------------------------------------------------
// Mainnet HyperBEAM defaults (Portal-like)
// ---------------------------------------------------------------------------

export const MAINNET_DEFAULTS = {
  /**
   * HyperBEAM node base URL used for general reads / operator experiments.
   * Do not mix this URL with Portal's scheduler unless this node owns that
   * scheduler.
   */
  hyperbeamUrl: process.env.NEXT_PUBLIC_HYPERBEAM_URL || "https://arweave.nyc",
  /**
   * HyperBEAM write URL. Defaults to Portal because the default scheduler and
   * authority below are Portal's production triple.
   */
  writeUrl:
    process.env.NEXT_PUBLIC_AO_WRITE_URL ||
    process.env.NEXT_PUBLIC_HYPERBEAM_WRITE_URL ||
    "https://hb.portalinto.com",
  authority:
    process.env.NEXT_PUBLIC_AO_MAINNET_AUTHORITY ||
    process.env.NEXT_PUBLIC_AO_AUTHORITY ||
    "a5ZMUKbGClAsKzB4SHDYrwkOZZHIIfpbaxrmKwUHCe8",
  /**
   * Scheduler base URL or identifier as required by aoconnect mainnet mode.
   * Portal passes `SCHEDULER` to `connect({ MODE: "mainnet", URL, SCHEDULER })`.
   */
  scheduler:
    process.env.NEXT_PUBLIC_AO_MAINNET_SCHEDULER ||
    process.env.NEXT_PUBLIC_AO_SCHEDULER ||
    "",
  schedulerDevice:
    process.env.NEXT_PUBLIC_AO_MAINNET_SCHEDULER_DEVICE ||
    process.env.NEXT_PUBLIC_AO_SCHEDULER_DEVICE ||
    "scheduler@1.0",
  executionDevice:
    process.env.NEXT_PUBLIC_AO_MAINNET_EXECUTION_DEVICE ||
    process.env.NEXT_PUBLIC_AO_EXECUTION_DEVICE ||
    "",
  pushDevice:
    process.env.NEXT_PUBLIC_AO_MAINNET_PUSH_DEVICE ||
    process.env.NEXT_PUBLIC_AO_PUSH_DEVICE ||
    "",
} as const;

export const HAS_EXPLICIT_MAINNET_PROCESS_IDS = Boolean(
  process.env.NEXT_PUBLIC_MAINNET_STORIES_PROCESS_ID &&
    process.env.NEXT_PUBLIC_MAINNET_STORYPOINTS_PROCESS_ID
);

export type MainnetDevice = "relay@1.0" | "process@1.0";

export const MAINNET_DEVICE: MainnetDevice =
  (process.env.NEXT_PUBLIC_AO_MAINNET_DEVICE as MainnetDevice) || "relay@1.0";

/**
 * Whether we've verified the HyperBEAM node is reachable.
 * `null` = not checked yet, `true` = healthy, `false` = unreachable.
 */
let _hyperbeamHealthy: boolean | null = null;
let _hyperbeamCheckPromise: Promise<boolean> | null = null;

async function checkHyperBEAMHealth(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
    return res.ok || res.status === 302;
  } catch {
    return false;
  }
}

/**
 * Probes the configured HyperBEAM node and caches the result.
 * Safe to call multiple times – only one probe runs concurrently.
 */
export async function probeHyperBEAM(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_HYPERBEAM_URL;
  if (!url) return false;

  if (_hyperbeamHealthy !== null) return _hyperbeamHealthy;

  if (!_hyperbeamCheckPromise) {
    _hyperbeamCheckPromise = checkHyperBEAMHealth(url).then((ok) => {
      _hyperbeamHealthy = ok;
      _hyperbeamCheckPromise = null;
      if (!ok) {
        console.warn(
          `[ao-config] HyperBEAM node at ${url} is unreachable – falling back to standard CU`
        );
      }
      return ok;
    });
  }

  return _hyperbeamCheckPromise;
}

/**
 * Return the fully-resolved AO configuration taking environment variables
 * into account.
 *
 * IMPORTANT: HyperBEAM nodes do NOT expose /dry-run (they use AO 2.0 protocol).
 * cu.ao.xyz does not resolve (NXDOMAIN). So for dryrun/result we always use
 * a legacy CU: cu.ao-testnet.xyz (or override via env).
 */
export function getAOConfig(): AOConfig {
  const mode: AOMode =
    (process.env.NEXT_PUBLIC_AO_MODE as AOMode) || "legacy";
  const hyperbeam_url =
    process.env.NEXT_PUBLIC_HYPERBEAM_URL || null;

  const endpoints =
    mode === "mainnet" ? MAINNET_ENDPOINTS : LEGACY_ENDPOINTS;

  return {
    mode,
    mu_url: endpoints.mu,
    cu_url: endpoints.cu,
    gateway: endpoints.gateway,
    hyperbeam_url,
  };
}

// ---------------------------------------------------------------------------
// Wrapped aoconnect helpers
// ---------------------------------------------------------------------------

/** Re-export createDataItemSigner as-is */
export const createDataItemSigner = originalCreateDataItemSigner;

/**
 * Returns a pre-configured `connect()` result using the current AO config.
 * The MODE is set based on the environment so that aoconnect knows whether to
 * use mainnet or legacy message routing.
 */
export function aoConnect(overrides?: Record<string, unknown>) {
  const config = getAOConfig();
  const connectArgs = {
    MODE: config.mode as "mainnet" | "legacy",
    MU_URL: config.mu_url,
    CU_URL: config.cu_url,
    GATEWAY_URL: config.gateway,
    ...overrides,
  };

  // aoconnect's connect() overloads require a discriminated union on MODE.
  // We cast here because the mode is resolved at runtime from env vars.
  if (config.mode === "mainnet") {
    return originalConnect({ ...connectArgs, MODE: "mainnet" as const });
  }
  return originalConnect({ ...connectArgs, MODE: "legacy" as const });
}

/**
 * Execute a dryrun (read) against the configured CU (or HyperBEAM node).
 * Passes CU_URL directly per-call so config changes (e.g. after HyperBEAM
 * probe) take effect immediately.
 */
export const aoDryrun = (args: Parameters<typeof originalDryrun>[0]) => {
  const config = getAOConfig();
  return originalDryrun({ ...args, CU_URL: config.cu_url } as any);
};

/**
 * Send a message through the configured MU.
 */
export const aoMessage = (args: Parameters<typeof originalMessage>[0]) => {
  const config = getAOConfig();
  return originalMessage({ ...args, MU_URL: config.mu_url } as any);
};

/**
 * Read a result from the configured CU.
 */
export const aoResult = (args: Parameters<typeof originalResult>[0]) => {
  const config = getAOConfig();
  return originalResult({ ...args, CU_URL: config.cu_url } as any);
};

/**
 * Read results from the configured CU.
 */
export const aoResults = (args: Parameters<typeof originalResults>[0]) => {
  const config = getAOConfig();
  return originalResults({ ...args, CU_URL: config.cu_url } as any);
};

/**
 * Spawn a new process through the configured MU.
 */
export const aoSpawn = (args: Parameters<typeof originalSpawn>[0]) => {
  const config = getAOConfig();
  return originalSpawn({ ...args, MU_URL: config.mu_url } as any);
};

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export const FEATURES = {
  EVM_WALLET:
    process.env.NEXT_PUBLIC_ENABLE_EVM !== "false",
  TURBO_UPLOADS:
    process.env.NEXT_PUBLIC_ENABLE_TURBO_UPLOADS !== "false",
  ARNS_TRADING:
    process.env.NEXT_PUBLIC_ENABLE_ARNS_TRADING !== "false",
} as const;

// ---------------------------------------------------------------------------
// Convenience singleton – most contexts can just import this.
// Always connects in "legacy" mode so that the returned object
// contains all helpers (dryrun, message, result, spawn, etc.).
// ---------------------------------------------------------------------------

function createAOInstance() {
  // Always connect in "legacy" mode so the returned object includes dryrun,
  // message, result, spawn, etc. These helpers talk to the original legacy
  // story processes, so keep them pinned to legacy endpoints even when the app
  // is also configured for mainnet HyperBEAM writes.
  return originalConnect({
    MODE: "legacy" as const,
    MU_URL: LEGACY_ENDPOINTS.mu,
    CU_URL: LEGACY_ENDPOINTS.cu,
    GATEWAY_URL: LEGACY_ENDPOINTS.gateway,
  });
}

type AOInstance = ReturnType<typeof createAOInstance>;

let _aoSingleton: AOInstance | null = null;
let _aoSingletonCU: string | null = null;

/**
 * Returns the AO connection singleton (legacy mode: dryrun, message, result, etc.).
 * Recreates if the resolved CU URL changed (e.g. after HyperBEAM probe).
 */
export function getAO(): AOInstance {
  if (!_aoSingleton || _aoSingletonCU !== LEGACY_ENDPOINTS.cu) {
    _aoSingleton = createAOInstance();
    _aoSingletonCU = LEGACY_ENDPOINTS.cu;
  }
  return _aoSingleton;
}

// ---------------------------------------------------------------------------
// Mainnet + HyperBEAM (Portal-style: URL, no dryrun – use message + result)
// ---------------------------------------------------------------------------

export function getHyperbeamUrl(): string | null {
  return process.env.NEXT_PUBLIC_HYPERBEAM_URL || MAINNET_DEFAULTS.hyperbeamUrl;
}

export function getHyperbeamWriteUrl(): string {
  return MAINNET_DEFAULTS.writeUrl;
}

let _mainnetSingleton: ReturnType<typeof originalConnect> | null = null;
let _mainnetSigner: unknown = undefined;

/**
 * Returns the mainnet AO connection (Portal-style HyperBEAM).
 *
 * Portal config is effectively:
 * `connect({ MODE: "mainnet", URL: AO_NODE.url, SCHEDULER: AO_NODE.scheduler, signer? })`
 *
 * We intentionally do NOT provide MU_URL/CU_URL overrides here, because mainnet
 * HyperBEAM routing should be controlled via `URL` + `SCHEDULER` (and providing
 * legacy MU/CU endpoints has caused DNS / relay issues in practice).
 *
 * Spawn registry processes with `npm run ao:spawn-mainnet`, then set
 * NEXT_PUBLIC_MAINNET_STORIES_PROCESS_ID / NEXT_PUBLIC_MAINNET_STORYPOINTS_PROCESS_ID
 * so browser writes target those IDs (content in message Data).
 */
export function getMainnetAO(signer?: unknown) {
  const url = getHyperbeamWriteUrl();
  if (!url) throw new Error("HyperBEAM URL is required for mainnet mode");

  const scheduler = MAINNET_DEFAULTS.scheduler;
  if (!scheduler) {
    throw new Error(
      "NEXT_PUBLIC_AO_MAINNET_SCHEDULER (or NEXT_PUBLIC_AO_SCHEDULER) is required for mainnet mode"
    );
  }

  const s = signer ?? _mainnetSigner;
  if (!_mainnetSingleton || _mainnetSigner !== s) {
    _mainnetSigner = s;
    const config: Record<string, unknown> = {
      MODE: "mainnet",
      URL: url,
      // Prefer relay@1.0 for browser DataItem signers. process@1.0 push often
      // expects RFC-9421 HTTP signatures that wallet extensions do not provide.
      device: MAINNET_DEVICE,
      SCHEDULER: scheduler,
      GATEWAY_URL: "https://arweave.net",
    };
    if (s) config.signer = s;

    _mainnetSingleton = originalConnect(
      config as Parameters<typeof originalConnect>[0]
    ) as ReturnType<typeof originalConnect>;
  }
  return _mainnetSingleton;
}
