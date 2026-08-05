import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { gunzip } from "zlib";

const execFileAsync = promisify(execFile);

export interface PoapArchiveDrop {
  drop_id: number;
  fancy_id?: string | null;
  title?: string | null;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  city?: string | null;
  country?: string | null;
  event_url?: string | null;
  year?: number | null;
  is_virtual?: number | null;
  is_private?: number | null;
  channel?: string | null;
  platform?: string | null;
  location_type?: string | null;
  timezone?: string | null;
  created_at?: string | null;
}

export interface PoapArchiveToken {
  source_uid: string;
  poap_id?: number | null;
  drop_id: number;
  minted_on?: number | null;
  owner_address?: string | null;
  network?: string | null;
  transfer_count?: number | null;
}

export interface PoapArchiveLookup {
  drop: PoapArchiveDrop | null;
  token: PoapArchiveToken | null;
  artworkUrl: string;
  artworkId?: string;
  snapshot?: string;
  source: "poap-archive" | "poap-archive-arweave";
}

const SQLITE_TIMEOUT_MS = 8000;
const REMOTE_ARCHIVE_SNAPSHOT = "2026-07-02";
const REMOTE_ARCHIVE_CORE_INDEX_ID =
  "3BNsifdQEoVvi2QV2AoXU75Jq1_0sxiuIG22ixtxSqQ";
const REMOTE_ARCHIVE_ARTWORK_INDEX_ID =
  "uI1JpiqF7PcAG2Qk1rzMrcWBbVhgdtejLBCMYJbSkr8";

interface RemoteArchiveCoreIndex {
  ids: number[];
  t?: string[];
  y?: Array<number | null>;
  c?: Array<string | null>;
  n?: Array<string | null>;
}

interface RemoteArchiveArtworkIndex {
  at?: Array<string | null>;
  tt?: Array<string | null>;
}

interface RemoteArchiveIndexes {
  core: RemoteArchiveCoreIndex;
  artwork: RemoteArchiveArtworkIndex;
}

export interface PoapArchiveSearchResult {
  dropId: string;
  title: string;
  year: number | null;
  city: string;
  country: string;
  artworkId: string;
  artworkUrl: string;
  snapshot: string;
}

let remoteArchiveIndexes: RemoteArchiveIndexes | null = null;
let remoteArchiveIndexesPromise: Promise<RemoteArchiveIndexes | null> | null = null;

function archiveDbPath(): string {
  return process.env.POAP_ARCHIVE_DB_PATH || "";
}

function archiveArtworkDir(): string {
  return process.env.POAP_ARCHIVE_ARTWORK_DIR || "";
}

function isRemoteArchiveEnabled(): boolean {
  return process.env.POAP_ARCHIVE_REMOTE_ENABLED !== "false";
}

function remoteArchiveGateway(): string {
  return (process.env.POAP_ARCHIVE_GATEWAY_URL || "https://arweave.net").replace(
    /\/+$/,
    ""
  );
}

export function isPoapArchiveConfigured(): boolean {
  const dbPath = archiveDbPath();
  return Boolean(dbPath && existsSync(dbPath));
}

export function isPoapArchiveRemoteConfigured(): boolean {
  return isRemoteArchiveEnabled();
}

export function getPoapArchiveArtworkPath(dropId: string): string {
  const artworkDir = archiveArtworkDir();
  if (!artworkDir || !/^\d+$/.test(dropId)) return "";
  return `${artworkDir.replace(/\/+$/, "")}/${dropId}.webp`;
}

export async function readPoapArchiveArtwork(
  dropId: string
): Promise<Buffer | null> {
  const path = getPoapArchiveArtworkPath(dropId);
  if (!path || !existsSync(path)) return null;
  return readFile(path);
}

function sqliteQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function queryArchiveJson<T>(sql: string): Promise<T[]> {
  const dbPath = archiveDbPath();
  if (!dbPath || !existsSync(dbPath)) return [];

  const sqliteBin = process.env.POAP_ARCHIVE_SQLITE_BIN || "sqlite3";
  const args = [
    "-readonly",
    "-json",
    dbPath,
    sql,
  ];
  const { stdout } = await execFileAsync(sqliteBin, args, {
    timeout: SQLITE_TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  if (!stdout.trim()) return [];
  return JSON.parse(stdout) as T[];
}

function gunzipJson<T>(bytes: ArrayBuffer): Promise<T> {
  return new Promise((resolve, reject) => {
    gunzip(Buffer.from(bytes), (error, output) => {
      if (error) {
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(output.toString("utf8")) as T);
      } catch (parseError) {
        reject(parseError);
      }
    });
  });
}

async function fetchRemoteArchiveIndex<T>(id: string): Promise<T> {
  const response = await fetch(`${remoteArchiveGateway()}/${id}`, {
    // The indexes are cached in memory below. Next's data cache rejects the
    // larger artwork index because its decompressed response exceeds 2 MB.
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`POAP archive index request failed with ${response.status}.`);
  }
  return gunzipJson<T>(await response.arrayBuffer());
}

async function loadRemoteArchiveIndexes(): Promise<RemoteArchiveIndexes | null> {
  if (!isRemoteArchiveEnabled()) return null;
  if (remoteArchiveIndexes) return remoteArchiveIndexes;
  if (remoteArchiveIndexesPromise) return remoteArchiveIndexesPromise;

  remoteArchiveIndexesPromise = Promise.all([
    fetchRemoteArchiveIndex<RemoteArchiveCoreIndex>(
      process.env.POAP_ARCHIVE_CORE_INDEX_ID || REMOTE_ARCHIVE_CORE_INDEX_ID
    ),
    fetchRemoteArchiveIndex<RemoteArchiveArtworkIndex>(
      process.env.POAP_ARCHIVE_ARTWORK_INDEX_ID ||
        REMOTE_ARCHIVE_ARTWORK_INDEX_ID
    ),
  ])
    .then(([core, artwork]) => {
      if (!Array.isArray(core.ids) || !core.ids.length) {
        throw new Error("POAP archive core index is invalid.");
      }
      remoteArchiveIndexes = { core, artwork };
      return remoteArchiveIndexes;
    })
    .catch((error) => {
      console.warn("[poap-archive] remote index unavailable:", error);
      return null;
    })
    .finally(() => {
      remoteArchiveIndexesPromise = null;
    });

  return remoteArchiveIndexesPromise;
}

async function lookupRemotePoapArchive(input: {
  dropId?: string;
}): Promise<PoapArchiveLookup | null> {
  const dropId = input.dropId?.trim() || "";
  if (!/^\d+$/.test(dropId)) return null;

  const indexes = await loadRemoteArchiveIndexes();
  if (!indexes) return null;

  const index = indexes.core.ids.indexOf(Number(dropId));
  if (index < 0) return null;

  const artworkId =
    indexes.artwork.at?.[index] || indexes.artwork.tt?.[index] || "";
  const year = indexes.core.y?.[index];

  return {
    drop: {
      drop_id: Number(dropId),
      title: indexes.core.t?.[index] || null,
      year: typeof year === "number" ? year : null,
      city: indexes.core.c?.[index] || null,
      country: indexes.core.n?.[index] || null,
    },
    token: null,
    artworkId: artworkId || undefined,
    artworkUrl: artworkId ? `${remoteArchiveGateway()}/${artworkId}` : "",
    snapshot: REMOTE_ARCHIVE_SNAPSHOT,
    source: "poap-archive-arweave",
  };
}

export async function searchPoapArchive(
  query: string,
  limit = 24
): Promise<PoapArchiveSearchResult[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const indexes = await loadRemoteArchiveIndexes();
  if (!indexes) return [];

  const maxResults = Math.min(Math.max(Number(limit) || 24, 1), 50);
  const results: PoapArchiveSearchResult[] = [];

  for (let index = 0; index < indexes.core.ids.length; index += 1) {
    const dropId = String(indexes.core.ids[index]);
    const title = indexes.core.t?.[index] || "";
    const city = indexes.core.c?.[index] || "";
    const country = indexes.core.n?.[index] || "";
    const year = indexes.core.y?.[index];
    const searchable = `${dropId} ${title} ${city} ${country} ${year || ""}`.toLowerCase();
    if (!searchable.includes(normalizedQuery)) continue;

    const artworkId =
      indexes.artwork.at?.[index] || indexes.artwork.tt?.[index] || "";
    results.push({
      dropId,
      title: title || `POAP Drop ${dropId}`,
      year: typeof year === "number" ? year : null,
      city,
      country,
      artworkId,
      artworkUrl: artworkId ? `${remoteArchiveGateway()}/${artworkId}` : "",
      snapshot: REMOTE_ARCHIVE_SNAPSHOT,
    });
    if (results.length >= maxResults) break;
  }

  return results;
}

export async function lookupPoapArchive(input: {
  tokenId?: string;
  dropId?: string;
  ownerAddress?: string;
}): Promise<PoapArchiveLookup | null> {
  if (!isPoapArchiveConfigured()) {
    return lookupRemotePoapArchive({ dropId: input.dropId });
  }

  const tokenId = input.tokenId?.trim() || "";
  const dropId = input.dropId?.trim() || "";
  const ownerAddress = input.ownerAddress?.trim().toLowerCase() || "";

  let token: PoapArchiveToken | null = null;
  if (/^\d+$/.test(tokenId)) {
    const tokens = await queryArchiveJson<PoapArchiveToken>(
      `SELECT source_uid, poap_id, drop_id, minted_on, owner_address, network, transfer_count
       FROM tokens
       WHERE source_uid = ${sqliteQuote(tokenId)} OR poap_id = ${Number(tokenId)}
       LIMIT 1`
    );
    token = tokens[0] || null;
  }

  if (!token && /^\d+$/.test(dropId) && ownerAddress) {
    const tokens = await queryArchiveJson<PoapArchiveToken>(
      `SELECT source_uid, poap_id, drop_id, minted_on, owner_address, network, transfer_count
       FROM tokens
       WHERE drop_id = ${Number(dropId)} AND lower(owner_address) = ${sqliteQuote(ownerAddress)}
       ORDER BY minted_on DESC
       LIMIT 1`
    );
    token = tokens[0] || null;
  }

  const resolvedDropId = String(token?.drop_id || dropId || "");
  if (!/^\d+$/.test(resolvedDropId)) return null;

  const drops = await queryArchiveJson<PoapArchiveDrop>(
    `SELECT drop_id, fancy_id, title, description, start_date, end_date, city,
            country, event_url, year, is_virtual, is_private, channel, platform,
            location_type, timezone, created_at
     FROM drops
     WHERE drop_id = ${Number(resolvedDropId)}
     LIMIT 1`
  );
  const drop = drops[0] || null;

  const localResult = {
    drop,
    token,
    artworkUrl: `/api/poap/artwork?dropId=${encodeURIComponent(resolvedDropId)}`,
    source: "poap-archive",
  } satisfies PoapArchiveLookup;

  if (drop) return localResult;
  return lookupRemotePoapArchive({ dropId: resolvedDropId });
}
