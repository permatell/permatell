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
 *   NEXT_PUBLIC_AO_WRITE_URL (default https://hb.portalinto.com)
 *   NEXT_PUBLIC_AO_MAINNET_SCHEDULER (required)
 *   NEXT_PUBLIC_AO_MAINNET_MODULE
 *   NEXT_PUBLIC_AO_MAINNET_AUTHORITY
 *   NEXT_PUBLIC_AO_MAINNET_DEVICE (default relay@1.0; informational for browser)
 *
 * Dry-run (config check only, no spawn):
 *   node scripts/spawn-mainnet-processes.mjs --dry-run
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect, createDataItemSigner } from "@permaweb/aoconnect";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DEFAULT_MODULE = "ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s";
const DEFAULT_AUTHORITY = "a5ZMUKbGClAsKzB4SHDYrwkOZZHIIfpbaxrmKwUHCe8";
const DEFAULT_WRITE_URL = "https://hb.portalinto.com";
const PLACEHOLDER = "__STORY_POINTS_PROCESS_ID__";

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

function requireConfig() {
  const writeUrl =
    clean(process.env.NEXT_PUBLIC_AO_WRITE_URL) ||
    clean(process.env.NEXT_PUBLIC_HYPERBEAM_WRITE_URL) ||
    clean(process.env.NEXT_PUBLIC_HYPERBEAM_URL) ||
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

async function probeNode(writeUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(`${writeUrl.replace(/\/+$/, "")}/~meta@1.0/info`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`[probe] ${writeUrl} returned HTTP ${res.status}`);
      return null;
    }
    // Portal meta can be huge — only read the first chunk.
    const reader = res.body?.getReader?.();
    if (reader) {
      const { value } = await reader.read();
      await reader.cancel();
      const chunk = new TextDecoder().decode(value || new Uint8Array());
      const addressMatch = chunk.match(/"address"\s*:\s*"([^"]+)"/);
      const forceMatch = chunk.match(/"force-signed"\s*:\s*"?([^",}\s]+)"?/);
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
    console.warn(`[probe] failed: ${err?.message || err}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
  const slotOrId = await ao.message({
    process: processId,
    tags: sanitizeTags([
      { name: "Data-Protocol", value: "ao" },
      { name: "Action", value: "Eval" },
      { name: "Message-Timestamp", value: Date.now().toString() },
    ]),
    data: luaSource,
  });
  return slotOrId;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const cfg = requireConfig();

  console.log("=== Permatell mainnet spawn ===");
  console.log(`URL:       ${cfg.writeUrl}`);
  console.log(`SCHEDULER: ${cfg.scheduler}`);
  console.log(`MODULE:    ${cfg.moduleId}`);
  console.log(`AUTHORITY: ${cfg.authority}`);
  console.log(`DEVICE:    ${cfg.device} (browser default; Node uses DataItem signer)`);

  console.log("\nProbing HyperBEAM node...");
  const info = await probeNode(cfg.writeUrl);
  if (info?.address) {
    console.log(`Node address: ${info.address}`);
    if (info["force-signed"] != null) {
      console.log(`force-signed: ${info["force-signed"]}`);
    }
  } else if (info) {
    console.log("Node reachable (meta ok).");
  } else {
    console.warn("Node probe failed; continuing anyway.");
  }

  if (dryRun) {
    console.log("\n--dry-run: config OK. No wallet load / spawn performed.");
    console.log("Next: re-run with --wallet /path/to/jwk.json");
    return;
  }

  const { jwk, path: walletPath } = loadWallet();
  console.log(`\nWallet: ${walletPath}`);

  const signer = createDataItemSigner(jwk);
  const ao = connect({
    MODE: "mainnet",
    URL: cfg.writeUrl,
    SCHEDULER: cfg.scheduler,
    signer,
    device: cfg.device,
  });

  console.log("\n[1/4] Spawning Story Points process...");
  const storyPointsId = await spawnProcess(ao, {
    moduleId: cfg.moduleId,
    scheduler: cfg.scheduler,
    authority: cfg.authority,
    name: "PermaTell Story Points",
    data: "PermaTell Story Points",
  });
  console.log(`Story Points process: ${storyPointsId}`);

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
  console.log(`NEXT_PUBLIC_AO_WRITE_URL=${cfg.writeUrl}`);
  console.log(`NEXT_PUBLIC_AO_MAINNET_SCHEDULER=${cfg.scheduler}`);
  console.log(`NEXT_PUBLIC_AO_MAINNET_AUTHORITY=${cfg.authority}`);
  console.log(`NEXT_PUBLIC_AO_MAINNET_DEVICE=relay@1.0`);
  console.log("");
  console.log(
    "After env deploy: mainnet mode uses these IDs for browser writes (Data in message body)."
  );
}

main().catch((err) => {
  console.error("\nSpawn failed:", err?.message || err);
  process.exitCode = 1;
}).finally(() => {
  // aoconnect can keep the event loop alive after success.
  setTimeout(() => process.exit(process.exitCode ?? 0), 50);
});
