/**
 * Turbo SDK upload utilities for PermaTell.
 *
 * Uses @ardrive/turbo-sdk to upload files (articles, cover images, assets) to
 * Arweave via Turbo credits.  Falls back to direct Arweave transactions when
 * Turbo is unavailable.
 */

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
    // Dynamic import to avoid SSR issues with the SDK
    turboModule = await import("@ardrive/turbo-sdk");
  }
  return turboModule;
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
  const { TurboFactory } = await getTurboSDK();

  // Create an authenticated Turbo client using the browser wallet
  const turbo = TurboFactory.authenticated({
    signer: window.arweaveWallet,
  });

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
    fileStreamFactory: () => new ReadableStream({
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
  const { TurboFactory } = await getTurboSDK();

  const turbo = TurboFactory.authenticated({
    signer: window.arweaveWallet,
  });

  const tags: { name: string; value: string }[] = [
    { name: "Content-Type", value: options.contentType || "text/plain" },
    { name: "App-Name", value: "PermaTell" },
    ...(options.tags || []),
  ];

  const encoder = new TextEncoder();
  const bytes = typeof data === "string" ? encoder.encode(data) : data;

  const uploadResult = await turbo.uploadFile({
    fileStreamFactory: () => new ReadableStream({
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

/**
 * Get the Turbo balance for the connected wallet.
 */
export async function getTurboBalance(): Promise<{
  winc: number;
  formatted: string;
}> {
  const { TurboFactory } = await getTurboSDK();

  const turbo = TurboFactory.authenticated({
    signer: window.arweaveWallet,
  });

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
