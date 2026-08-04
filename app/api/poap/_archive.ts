import { existsSync } from "fs";
import { readFile } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

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
  source: "poap-archive";
}

const SQLITE_TIMEOUT_MS = 8000;

function archiveDbPath(): string {
  return process.env.POAP_ARCHIVE_DB_PATH || "";
}

function archiveArtworkDir(): string {
  return process.env.POAP_ARCHIVE_ARTWORK_DIR || "";
}

export function isPoapArchiveConfigured(): boolean {
  const dbPath = archiveDbPath();
  return Boolean(dbPath && existsSync(dbPath));
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

export async function lookupPoapArchive(input: {
  tokenId?: string;
  dropId?: string;
  ownerAddress?: string;
}): Promise<PoapArchiveLookup | null> {
  if (!isPoapArchiveConfigured()) return null;

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

  return {
    drop,
    token,
    artworkUrl: `/api/poap/artwork?dropId=${encodeURIComponent(resolvedDropId)}`,
    source: "poap-archive",
  };
}
