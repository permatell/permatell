#!/usr/bin/env node
/**
 * Wallet-free smoke test for Portal-style mainnet connect config.
 * Does not spawn or sign — only validates env + HyperBEAM reachability.
 *
 *   node scripts/smoke-mainnet-connect.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { connect } from "@permaweb/aoconnect";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

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

function clean(value) {
  return String(value || "").trim();
}

async function fetchWithTimeout(url, ms = 10_000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

function normalizeUrl(value) {
  return clean(value).replace(/\/+$/, "");
}

async function probeMeta(writeUrl) {
  const res = await fetchWithTimeout(`${writeUrl}/~meta@1.0/info`);
  console.log(`${writeUrl} meta status:`, res.status);
  if (!res.ok) throw new Error(`HyperBEAM meta failed: ${res.status}`);

  const reader = res.body?.getReader?.();
  if (reader) {
    const { value } = await reader.read();
    await reader.cancel();
    const chunk = new TextDecoder().decode(value || new Uint8Array());
    const addressMatch = chunk.match(/"address"\s*:\s*"([^"]+)"/);
    if (addressMatch) console.log(`${writeUrl} node address:`, addressMatch[1]);
    else console.log(`${writeUrl} meta ok (body chunk`, chunk.length, "bytes)");
  } else {
    const text = await res.text();
    console.log(`${writeUrl} meta bytes:`, text.length);
  }
}

async function main() {
  const writeUrl =
    normalizeUrl(process.env.NEXT_PUBLIC_AO_WRITE_URL) ||
    normalizeUrl(process.env.NEXT_PUBLIC_HYPERBEAM_URL) ||
    "https://app-1.forward.computer";
  const scheduler = clean(process.env.NEXT_PUBLIC_AO_MAINNET_SCHEDULER);
  const stories = clean(process.env.NEXT_PUBLIC_MAINNET_STORIES_PROCESS_ID);
  const storyPoints = clean(
    process.env.NEXT_PUBLIC_MAINNET_STORYPOINTS_PROCESS_ID
  );
  const fallbackUrl = "https://app-1.forward.computer";

  console.log("writeUrl:", writeUrl);
  console.log("scheduler:", scheduler || "(missing)");
  console.log("mainnet stories:", stories || "(not set yet)");
  console.log("mainnet storypoints:", storyPoints || "(not set yet)");

  if (!scheduler) {
    throw new Error("NEXT_PUBLIC_AO_MAINNET_SCHEDULER is required");
  }

  const ao = connect({
    MODE: "mainnet",
    URL: writeUrl,
    SCHEDULER: scheduler,
  });
  console.log("connect() MODE:", ao.MODE);
  console.log(
    "apis:",
    ["spawn", "message", "result", "dryrun"]
      .map((k) => `${k}=${typeof ao[k]}`)
      .join(", ")
  );

  await probeMeta(writeUrl);
  if (
    scheduler === "n_XZJhUnmldNFo4dhajoPZWhBXuJk-OcQr5JQ49c4Zo" &&
    writeUrl !== fallbackUrl
  ) {
    console.log(
      `\nPortal spawn POSTs often hang; spawn script falls back to ${fallbackUrl}.`
    );
    try {
      await probeMeta(fallbackUrl);
    } catch (err) {
      console.warn(`Fallback probe failed: ${err?.message || err}`);
    }
  }

  console.log("\nSmoke OK. Spawn with:");
  console.log(
    "  node scripts/spawn-mainnet-processes.mjs --wallet /path/to/jwk.json"
  );
}

main().catch((err) => {
  console.error("Smoke failed:", err?.message || err);
  process.exitCode = 1;
}).finally(() => {
  setTimeout(() => process.exit(process.exitCode ?? 0), 50);
});
