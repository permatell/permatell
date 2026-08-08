#!/usr/bin/env node
/**
 * Portal-style mainnet spawn + hydrate for Permatell registry processes.
 *
 * Spawns Story Points, then Stories (with story-points id injected), Eval-hydrates
 * both with Lua from processes/, and prints env lines to paste into Vercel/.env.local.
 *
 * Usage:
 *   node scripts/spawn-mainnet-processes.mjs --wallet /path/to/jwk.json
 *
 * Env (optional overrides; never commit JWKs):
 *   AO_WALLET_PATH / WALLET_PATH
 *   NEXT_PUBLIC_AO_WRITE_URL (default https://app-1.forward.computer)
 *   NEXT_PUBLIC_AO_MAINNET_SCHEDULER (required)
 *   NEXT_PUBLIC_AO_MAINNET_MODULE
 *   NEXT_PUBLIC_AO_MAINNET_AUTHORITY
 *   NEXT_PUBLIC_AO_MAINNET_DEVICE (default relay@1.0; informational for browser)
 *
 * Dry-run (config check only, no spawn):
 *   node scripts/spawn-mainnet-processes.mjs --dry-run
 *
 * Node spawn uses a JWK `createSigner` (ANS-104 + HTTP-SIG capable). Browser writes
 * stay on relay@1.0 + DataItem signer. If Portal hangs on POST /push, the script
 * falls back to https://app-1.forward.computer while keeping the Portal scheduler.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, createSigner } from "@permaweb/aoconnect";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_MODULE = "ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s";
const DEFAULT_AUTHORITY = "a5ZMUKbGClAsKzB4SHDYrwkOZZHIIfpbaxrmKwUHCe8";
const DEFAULT_WRITE_URL = "https://app-1.forward.computer";
const PORTAL_SCHEDULER = "n_XZJhUnmldNFo4dhajoPZWhBXuJk-OcQr5JQ49c4Zo";
const APP1_WRITE_URL = "https://app-1.forward.computer";
const PLACEHOLDER = "__STORY_POINTS_PROCESS_ID__";
const WRITE_TIMEOUT_MS = 25_000;
const META_TIMEOUT_MS = 12_000;
const BODY_PREVIEW_CHARS = 1_200;

function argValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function clean(value) {
  return String(value || "").trim();
}

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

loadEnvFile(resolve(ROOT, ".env.local"));
loadEnvFile(resolve(ROOT, ".env"));

function normalizeUrl(value) {
  return clean(value).replace(/\/+$/, "");
}

function dedupeUrls(urls) {
  const seen = new Set();
  const out = [];
  for (const url of urls) {
    const normalized = normalizeUrl(url);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function requireConfig() {
  const writeUrl =
    normalizeUrl(argValue("--url")) ||
    normalizeUrl(process.env.NEXT_PUBLIC_AO_WRITE_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_HYPERBEAM_WRITE_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_HYPERBEAM_URL) ||
    DEFAULT_WRITE_URL;
  const scheduler = clean(process.env.NEXT_PUBLIC_AO_MAINNET_SCHEDULER);
  const moduleId =
    clean(process.env.NEXT_PUBLIC_AO_MAINNET_MODULE) || DEFAULT_MODULE;
  const authority =
    clean(process.env.NEXT_PUBLIC_AO_MAINNET_AUTHORITY) || DEFAULT_AUTHORITY;
  const device =
    clean(process.env.NEXT_PUBLIC_AO_MAINNET_DEVICE) || "relay@1.0";

  if (!scheduler || scheduler === "REPLACE_WITH_MAINNET_SCHEDULER_ID") {
    throw new Error(
      "Set NEXT_PUBLIC_AO_MAINNET_SCHEDULER before spawning (Portal scheduler id)."
    );
  }

  return { writeUrl, scheduler, moduleId, authority, device };
}

function isHungPortalWriteUrl(url) {
  try {
    const host = new URL(normalizeUrl(url)).hostname.toLowerCase();
    return host === "hb.portalinto.com" || host.endsWith(".portalinto.com");
  } catch {
    return /portalinto\.com/i.test(String(url || ""));
  }
}

function spawnCandidateUrls(writeUrl, scheduler) {
  const urls = [];
  if (!isHungPortalWriteUrl(writeUrl)) urls.push(writeUrl);
  else {
    console.warn(
      `Skipping hung Portal write URL ${writeUrl}; using ${APP1_WRITE_URL}`
    );
  }
  if (hasFlag("--no-fallback")) return dedupeUrls(urls.length ? urls : [APP1_WRITE_URL]);
  if (scheduler === PORTAL_SCHEDULER) urls.push(APP1_WRITE_URL);
  if (!urls.length) urls.push(APP1_WRITE_URL);
  return dedupeUrls(urls);
}

function loadWallet() {
  const walletPath =
    argValue("--wallet") ||
    clean(process.env.AO_WALLET_PATH) ||
    clean(process.env.WALLET_PATH);
  if (!walletPath) {
    throw new Error(
      "Provide --wallet /path/to/jwk.json (or AO_WALLET_PATH). Never commit JWKs."
    );
  }
  const absolute = resolve(walletPath);
  const jwk = JSON.parse(readFileSync(absolute, "utf8"));
  if (!jwk?.n || !jwk?.d) {
    throw new Error(`Wallet at ${absolute} does not look like an RSA JWK.`);
  }
  return { jwk, path: absolute };
}

function readLua(relativePath) {
  return readFileSync(resolve(ROOT, relativePath), "utf8");
}

function sanitizeTags(tags) {
  return tags
    .map((tag) => ({
      name: String(tag.name || "").trim(),
      value: String(tag.value || "")
        .replace(/\r?\n/g, " ")
        .trim(),
    }))
    .filter((tag) => tag.name && tag.value);
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function previewBody(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, BODY_PREVIEW_CHARS);
}

function formatSpawnError(err, lastHttp) {
  const lines = [`${err?.name || "Error"}: ${err?.message || err}`];
  if (err?.code) lines.push(`code: ${err.code}`);
  if (lastHttp?.url) {
    lines.push(`URL: ${lastHttp.method || "POST"} ${lastHttp.url}`);
  }
  if (lastHttp?.status != null) lines.push(`status: ${lastHttp.status}`);
  if (lastHttp?.ms != null) lines.push(`elapsed: ${lastHttp.ms}ms`);
  if (lastHttp?.body) lines.push(`body: ${previewBody(lastHttp.body)}`);
  const cause =
    err?.cause?.message ||
    err?.originalError?.message ||
    err?.originalError?.cause?.message ||
    lastHttp?.cause;
  if (cause) lines.push(`cause: ${cause}`);
  if (err?.context && typeof err.context === "object") {
    try {
      lines.push(`context: ${JSON.stringify(err.context)}`);
    } catch {
      // ignore
    }
  }
  return lines.join("\n");
}

function installFetchDiagnostics(timeoutMs = WRITE_TIMEOUT_MS) {
  const origFetch = globalThis.fetch.bind(globalThis);
  const state = { last: null };

  globalThis.fetch = async (input, init = {}) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = String(
      init.method || (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort(new Error(`HyperBEAM request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    const signal = init.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal;

    try {
      const res = await origFetch(input, { ...init, signal });
      let body = "";
      if (!res.ok) {
        body = await res
          .clone()
          .text()
          .then((text) => previewBody(text))
          .catch((readErr) => `[body read failed: ${readErr.message}]`);
      }
      state.last = {
        url,
        method,
        status: res.status,
        ok: res.ok,
        ms: Date.now() - started,
        body,
        process: res.headers.get("process"),
      };
      return res;
    } catch (err) {
      state.last = {
        url,
        method,
        status: null,
        ok: false,
        ms: Date.now() - started,
        body: "",
        cause: err?.message || String(err),
      };
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  return state;
}

async function probeNode(writeUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), META_TIMEOUT_MS);
  try {
    const res = await fetch(`${writeUrl}/~meta@1.0/info`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[probe] ${writeUrl} returned HTTP ${res.status}`);
      return null;
    }
    const reader = res.body?.getReader?.();
    if (reader) {
      const { value } = await reader.read();
      await reader.cancel();
      const chunk = new TextDecoder().decode(value || new Uint8Array());
      const addressMatch = chunk.match(/"address"\s*:\s*"([^"]+)"/);
      const forceMatch = chunk.match(/"force[_-]signed"\s*:\s*"?([^",}\s]+)"?/);
      return {
        address: addressMatch?.[1],
        "force-signed": forceMatch?.[1],
        raw: chunk.slice(0, 120),
      };
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      console.warn("[probe] meta info was not JSON");
      return { raw: text.slice(0, 120) };
    }
  } catch (err) {
    console.warn(`[probe] ${writeUrl} failed: ${err?.message || err}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function createAoClient(writeUrl, scheduler, signer) {
  return connect({
    MODE: "mainnet",
    URL: writeUrl,
    SCHEDULER: scheduler,
    signer,
  });
}

async function spawnProcess(ao, { moduleId, scheduler, authority, name, data }) {
  const tags = sanitizeTags([
    { name: "Authority", value: authority },
    { name: "Data-Protocol", value: "ao" },
    { name: "App-Name", value: "PermaTell" },
    { name: "Name", value: name },
    { name: "PermaTell-Asset-Type", value: "registry-process" },
    { name: "Process-Timestamp", value: Date.now().toString() },
  ]);

  const processId = String(
    await ao.spawn({
      module: moduleId,
      scheduler,
      tags,
      data: data || name,
    })
  );

  if (!processId || processId === "undefined") {
    throw new Error(`Spawn failed for ${name}: empty process id`);
  }
  return processId;
}

async function hydrateEval(ao, processId, luaSource) {
  return ao.message({
    process: processId,
    tags: sanitizeTags([
      { name: "Data-Protocol", value: "ao" },
      { name: "Action", value: "Eval" },
      { name: "Message-Timestamp", value: Date.now().toString() },
    ]),
    data: luaSource,
  });
}

async function spawnWithFallback(candidates, scheduler, signer, spawnFn) {
  let lastError = null;
  for (const writeUrl of candidates) {
    console.log(`Trying write node: ${writeUrl}`);
    const ao = createAoClient(writeUrl, scheduler, signer);
    try {
      const result = await spawnFn(ao);
      return { ao, writeUrl, ...result };
    } catch (err) {
      lastError = err;
      console.warn(formatSpawnError(err, globalThis.__permatellLastHttp?.last));
      if (writeUrl !== candidates[candidates.length - 1]) {
        console.warn("Falling back to next write node...\n");
      }
    }
  }
  throw lastError || new Error("All HyperBEAM write nodes failed");
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const cfg = requireConfig();
  const candidates = spawnCandidateUrls(cfg.writeUrl, cfg.scheduler);
  const fetchState = installFetchDiagnostics();
  globalThis.__permatellLastHttp = fetchState;

  console.log("=== Permatell mainnet spawn ===");
  console.log(`URL:       ${cfg.writeUrl}`);
  if (candidates.length > 1) {
    console.log(`FALLBACK:  ${candidates.slice(1).join(", ")}`);
  }
  console.log(`SCHEDULER: ${cfg.scheduler}`);
  console.log(`MODULE:    ${cfg.moduleId}`);
  console.log(`AUTHORITY: ${cfg.authority}`);
  console.log(
    `DEVICE:    ${cfg.device} (browser default; Node spawn uses createSigner / ANS-104)`
  );

  console.log("\nProbing HyperBEAM node(s)...");
  for (const url of candidates) {
    const info = await probeNode(url);
    if (info?.address) {
      console.log(`${url} address: ${info.address}`);
      if (info["force-signed"] != null) {
        console.log(`${url} force-signed: ${info["force-signed"]}`);
      }
    } else if (info) {
      console.log(`${url}: reachable (meta ok).`);
    } else {
      console.warn(`${url}: probe failed.`);
    }
  }

  if (dryRun) {
    console.log("\n--dry-run: config OK. No wallet load / spawn performed.");
    console.log("Next: re-run with --wallet /path/to/jwk.json");
    return;
  }

  const { jwk, path: walletPath } = loadWallet();
  console.log(`\nWallet: ${walletPath}`);

  const signer = createSigner(jwk);

  console.log("\n[1/4] Spawning Story Points process...");
  const spawned = await spawnWithFallback(
    candidates,
    cfg.scheduler,
    signer,
    async (ao) => {
      const storyPointsId = await spawnProcess(ao, {
        moduleId: cfg.moduleId,
        scheduler: cfg.scheduler,
        authority: cfg.authority,
        name: "PermaTell Story Points",
        data: "PermaTell Story Points",
      });
      return { storyPointsId };
    }
  );
  const { ao, writeUrl: usedWriteUrl, storyPointsId } = spawned;
  console.log(`Story Points process: ${storyPointsId}`);
  if (usedWriteUrl !== cfg.writeUrl) {
    console.log(`Spawn succeeded on fallback node: ${usedWriteUrl}`);
  }

  await sleep(1500);

  console.log("\n[2/4] Hydrating Story Points (Eval)...");
  const storyPointsLua = readLua("processes/story-points.lua");
  await hydrateEval(ao, storyPointsId, storyPointsLua);
  console.log("Story Points Eval queued.");

  await sleep(1500);

  console.log("\n[3/4] Spawning Stories process...");
  const storiesId = await spawnProcess(ao, {
    moduleId: cfg.moduleId,
    scheduler: cfg.scheduler,
    authority: cfg.authority,
    name: "PermaTell Stories",
    data: "PermaTell Stories",
  });
  console.log(`Stories process: ${storiesId}`);

  await sleep(1500);

  console.log("\n[4/4] Hydrating Stories (Eval with story-points id)...");
  let storiesLua = readLua("processes/stories.lua");
  if (!storiesLua.includes(PLACEHOLDER)) {
    throw new Error(
      `processes/stories.lua missing placeholder ${PLACEHOLDER}`
    );
  }
  storiesLua = storiesLua.split(PLACEHOLDER).join(storyPointsId);
  await hydrateEval(ao, storiesId, storiesLua);
  console.log("Stories Eval queued.");

  console.log("\n=== Done. Add these to Vercel / .env.local (do not commit) ===\n");
  console.log(`NEXT_PUBLIC_MAINNET_STORIES_PROCESS_ID=${storiesId}`);
  console.log(`NEXT_PUBLIC_MAINNET_STORYPOINTS_PROCESS_ID=${storyPointsId}`);
  console.log("");
  console.log("Already required (confirm present):");
  console.log(`NEXT_PUBLIC_AO_MODE=mainnet`);
  console.log(`NEXT_PUBLIC_AO_WRITE_URL=${usedWriteUrl}`);
  console.log(`NEXT_PUBLIC_AO_MAINNET_SCHEDULER=${cfg.scheduler}`);
  console.log(`NEXT_PUBLIC_AO_MAINNET_AUTHORITY=${cfg.authority}`);
  console.log(`NEXT_PUBLIC_AO_MAINNET_DEVICE=relay@1.0`);
  console.log("");
  console.log(
    "After env deploy: mainnet mode uses these IDs for browser writes (Data in message body)."
  );
  if (usedWriteUrl !== cfg.writeUrl) {
    console.log(
      `\nNote: configured URL ${cfg.writeUrl} did not accept spawn; browser writes should use ${usedWriteUrl} (relay@1.0 DataItem signer unchanged).`
    );
  }
}

main().catch((err) => {
  console.error(
    "\nSpawn failed:\n" +
      formatSpawnError(err, globalThis.__permatellLastHttp?.last)
  );
  process.exitCode = 1;
}).finally(() => {
  // aoconnect can keep the event loop alive after success.
  setTimeout(() => process.exit(process.exitCode ?? 0), 50);
});
