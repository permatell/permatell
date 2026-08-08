/**
 * Turbo SDK upload utilities for PermaTell.
 *
 * Uses @ardrive/turbo-sdk to upload files (articles, cover images, assets) to
 * Arweave via Turbo credits.  Falls back to direct Arweave transactions when
 * Turbo is unavailable.
 */

import Arweave from "arweave";
import { FEATURES } from "@/lib/ao-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadResult {
  id: string; // Arweave transaction ID
  url: string; // Full URL to access the content
}

export interface UploadOptions {
  contentType?: string;
  tags?: { name: string; value: string }[];
}

// ---------------------------------------------------------------------------
// Lazy-load Turbo SDK (Portal pattern)
// ---------------------------------------------------------------------------

let turboModule: any = null;

async function getTurboSDK() {
  if (!FEATURES.TURBO_UPLOADS) {
    throw new Error("Turbo uploads are disabled");
  }
  if (!turboModule) {
    // The web entry point keeps node:stream/node:buffer out of the browser
    // bundle; dynamic import also avoids pulling the SDK into SSR.
    turboModule = await import("@ardrive/turbo-sdk/web");
  }
  return turboModule;
}

// ---------------------------------------------------------------------------
// Browser wallet signer
// ---------------------------------------------------------------------------

/**
 * Turbo signs data items through the wallet, which needs the public key on top
 * of the permissions the app requests when connecting.
 */
const TURBO_WALLET_PERMISSIONS = [
  "ACCESS_ADDRESS",
  "ACCESS_PUBLIC_KEY",
  "SIGNATURE",
];

function getBrowserWallet(): any {
  const wallet = (globalThis as any).arweaveWallet;
  if (!wallet) {
    throw new Error(
      "No Arweave wallet detected. Install and connect Wander (ArConnect) to upload."
    );
  }
  return wallet;
}

async function ensureTurboPermissions(wallet: any): Promise<void> {
  if (typeof wallet.getPermissions !== "function") return;
  const granted: string[] = (await wallet.getPermissions()) || [];
  const missing = TURBO_WALLET_PERMISSIONS.filter(
    (permission) => !granted.includes(permission)
  );
  if (missing.length > 0) {
    await wallet.connect([...granted, ...missing]);
  }
}

async function getAuthenticatedTurbo() {
  const { TurboFactory, ArconnectSigner } = await getTurboSDK();
  const wallet = getBrowserWallet();
  await ensureTurboPermissions(wallet);
  return TurboFactory.authenticated({ signer: new ArconnectSigner(wallet) });
}

// ---------------------------------------------------------------------------
// Upload functions
// ---------------------------------------------------------------------------

/**
 * Upload a file to Arweave via Turbo.
 * Requires the user to have a connected Arweave wallet (Wander/ArConnect).
 */
export async function uploadWithTurbo(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const turbo = await getAuthenticatedTurbo();

  // Prepare tags
  const tags: { name: string; value: string }[] = [
    { name: "Content-Type", value: options.contentType || file.type },
    { name: "App-Name", value: "PermaTell" },
    ...(options.tags || []),
  ];

  // Read file into a buffer
  const data = new Uint8Array(await file.arrayBuffer());

  // Upload
  const uploadResult = await turbo.uploadFile({
    fileStreamFactory: () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(data);
          controller.close();
        },
      }),
    fileSizeFactory: () => file.size,
    signal: AbortSignal.timeout(120_000), // 2 minute timeout
    dataItemOpts: {
      tags,
    },
  });

  return {
    id: uploadResult.id,
    url: `https://arweave.net/${uploadResult.id}`,
  };
}

/**
 * Upload raw data (e.g. markdown article content) as a transaction.
 */
export async function uploadDataWithTurbo(
  data: string | Uint8Array,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const turbo = await getAuthenticatedTurbo();

  const tags: { name: string; value: string }[] = [
    { name: "Content-Type", value: options.contentType || "text/plain" },
    { name: "App-Name", value: "PermaTell" },
    ...(options.tags || []),
  ];

  const encoder = new TextEncoder();
  const bytes = typeof data === "string" ? encoder.encode(data) : data;

  const uploadResult = await turbo.uploadFile({
    fileStreamFactory: () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      }),
    fileSizeFactory: () => bytes.length,
    signal: AbortSignal.timeout(120_000),
    dataItemOpts: {
      tags,
    },
  });

  return {
    id: uploadResult.id,
    url: `https://arweave.net/${uploadResult.id}`,
  };
}

/**
 * Upload an article to Arweave with proper metadata tags.
 * This stores the article content permanently and returns the tx ID
 * which can be stored as metadata in the AO process.
 */
export async function uploadArticle(
  content: string,
  metadata: {
    title: string;
    category?: string;
    author?: string;
    coverImageTxId?: string;
  }
): Promise<UploadResult> {
  const tags: { name: string; value: string }[] = [
    { name: "Content-Type", value: "text/markdown" },
    { name: "App-Name", value: "PermaTell" },
    { name: "Type", value: "article" },
    { name: "Title", value: metadata.title },
  ];

  if (metadata.category) {
    tags.push({ name: "Category", value: metadata.category });
  }
  if (metadata.author) {
    tags.push({ name: "Author", value: metadata.author });
  }
  if (metadata.coverImageTxId) {
    tags.push({ name: "Cover-Image", value: metadata.coverImageTxId });
  }

  return uploadDataWithTurbo(content, { contentType: "text/markdown", tags });
}

// ---------------------------------------------------------------------------
// Image uploads (story cover images)
// ---------------------------------------------------------------------------

/** Both Turbo and Wander's `dispatch` bundle uploads of this size for free. */
export const FREE_UPLOAD_MAX_BYTES = 100 * 1024;

/** Hard cap so a full-resolution photo is rejected before any wallet prompt. */
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Returns an error message when the file cannot be uploaded, or null when it is
 * acceptable.
 */
export function validateImageFile(file: File): string | null {
  const type = (file.type || "").toLowerCase();
  if (!type.startsWith("image/") || !ALLOWED_IMAGE_TYPES.includes(type)) {
    return "Only PNG, JPEG, WebP, GIF, AVIF or SVG images can be uploaded.";
  }
  if (file.size === 0) {
    return "That file is empty.";
  }
  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return `That image is ${formatBytes(file.size)}. The maximum is ${formatBytes(
      MAX_IMAGE_UPLOAD_BYTES
    )} — please resize it first.`;
  }
  return null;
}

/**
 * Upload a file through the connected wallet's `dispatch` API. Wander bundles
 * anything under 100 KiB for free, so this needs no Turbo credits and no AR.
 */
export async function uploadWithWalletDispatch(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const wallet = (globalThis as any).arweaveWallet;
  if (!wallet?.dispatch) {
    throw new Error(
      "The connected wallet cannot dispatch transactions. Connect Wander (ArConnect) to upload images."
    );
  }

  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  const data = new Uint8Array(await file.arrayBuffer());
  const transaction = await arweave.createTransaction({ data });
  transaction.addTag("Content-Type", options.contentType || file.type);
  transaction.addTag("App-Name", "PermaTell");
  for (const tag of options.tags || []) {
    transaction.addTag(tag.name, tag.value);
  }

  const result = await wallet.dispatch(transaction);
  if (!result?.id) {
    throw new Error("The wallet did not return a transaction id.");
  }

  return {
    id: result.id,
    url: `https://arweave.net/${result.id}`,
  };
}

function isFundingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /insufficient|balance|payment required|402|not enough|fund/i.test(
    message
  );
}

/**
 * Upload an image to Arweave using the connected wallet.
 *
 * Small images go through the wallet's free `dispatch` bundler; anything larger
 * needs Turbo credits, and funding failures are reported explicitly instead of
 * being swallowed.
 */
export async function uploadImage(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const uploadOptions: UploadOptions = {
    ...options,
    tags: [{ name: "Type", value: "cover-image" }, ...(options.tags || [])],
  };

  if (file.size <= FREE_UPLOAD_MAX_BYTES) {
    try {
      return await uploadWithWalletDispatch(file, uploadOptions);
    } catch (error) {
      if (!FEATURES.TURBO_UPLOADS) throw error;
    }
  }

  try {
    return await uploadWithTurbo(file, uploadOptions);
  } catch (error) {
    if (isFundingError(error)) {
      throw new Error(
        `This ${formatBytes(
          file.size
        )} image needs Turbo credits to upload (uploads up to ${formatBytes(
          FREE_UPLOAD_MAX_BYTES
        )} are free). Top up at turbo.ardrive.io, or pick a smaller image.`
      );
    }
    throw error;
  }
}

/**
 * Get the Turbo balance for the connected wallet.
 */
export async function getTurboBalance(): Promise<{
  winc: number;
  formatted: string;
}> {
  const turbo = await getAuthenticatedTurbo();

  const balance = await turbo.getBalance();
  const winc = Number(balance.winc || 0);

  return {
    winc,
    formatted: (winc / 1_000_000_000_000).toFixed(6), // Convert winston credits to AR-like display
  };
}

/**
 * Estimate the cost to upload data of a given size.
 */
export async function estimateUploadCost(
  bytes: number
): Promise<{ winc: number; formatted: string }> {
  const { TurboFactory } = await getTurboSDK();

  const turbo = TurboFactory.unauthenticated();
  const [cost] = await turbo.getUploadCosts({ bytes: [bytes] });

  return {
    winc: Number(cost.winc || 0),
    formatted: (Number(cost.winc || 0) / 1_000_000_000_000).toFixed(6),
  };
}
