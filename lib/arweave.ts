import Arweave from 'arweave';

// Initialize Arweave
export const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

const uploadGateways = [
  { host: 'arweave.net', port: 443, protocol: 'https' },
  { host: 'aoweave.tech', port: 443, protocol: 'https' },
  { host: 'ar-io.dev', port: 443, protocol: 'https' },
  { host: 'g8way.io', port: 443, protocol: 'https' },
] as const;

const FREE_BUNDLE_TARGET_BYTES = 100 * 1024;
const turboUploadEndpoints = [
  'https://upload.ardrive.io/v1/tx',
] as const;

function defaultTags(file: File, tags: { name: string; value: string }[]) {
  return [
    { name: 'Content-Type', value: file.type || 'application/octet-stream' },
    { name: 'App-Name', value: 'PermaTell' },
    ...tags,
  ];
}

/**
 * Uploads a file to Arweave using direct transaction
 * @param file The file to upload
 * @param tags Additional tags to add to the transaction
 * @returns The transaction ID
 */
export async function uploadToArweave(
  file: File,
  tags: { name: string; value: string }[] = []
): Promise<string> {
  let lastError: unknown = null;

  if (file.size <= FREE_BUNDLE_TARGET_BYTES) {
    try {
      return await uploadBundledDataItem(file, tags);
    } catch (error) {
      lastError = error;
      console.warn(
        "Bundled Arweave upload failed; trying direct gateway upload.",
        error
      );
    }
  }

  for (const gateway of uploadGateways) {
    try {
      return await uploadToArweaveGateway(file, tags, gateway);
    } catch (error) {
      lastError = error;
      console.warn(
        `Upload via ${gateway.host} failed; trying next gateway if available.`,
        error
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to upload to Arweave.");
}

async function uploadBundledDataItem(
  file: File,
  tags: { name: string; value: string }[]
): Promise<string> {
  const wallet = window.arweaveWallet;
  if (!wallet?.signDataItem) {
    throw new Error("Connected Arweave wallet does not support data item upload.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const signedDataItem = await wallet.signDataItem({
    data,
    tags: defaultTags(file, tags),
  });

  let lastError: unknown = null;
  for (const endpoint of turboUploadEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/octet-stream',
        },
        body: signedDataItem,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          json?.message ||
            json?.error ||
            `Bundled upload failed with status ${response.status}.`
        );
      }
      if (!json?.id || typeof json.id !== 'string') {
        throw new Error("Bundled upload did not return a transaction id.");
      }
      return json.id;
    } catch (error) {
      lastError = error;
      console.warn(`Bundled upload via ${endpoint} failed.`, error);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Bundled upload failed.");
}

async function uploadToArweaveGateway(
  file: File,
  tags: { name: string; value: string }[],
  gateway: (typeof uploadGateways)[number]
): Promise<string> {
  try {
    const client = Arweave.init(gateway);

    // Check if wallet is connected
    if (!window.arweaveWallet) {
      throw new Error("Arweave wallet not connected");
    }

    // Get the wallet address
    const address = await window.arweaveWallet.getActiveAddress();
    if (!address) {
      throw new Error("No active wallet address found");
    }

    // Check if the file is too large
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      throw new Error("File is too large. Maximum size is 100MB.");
    }

    // Read the file data
    const fileData = await file.arrayBuffer();
    
    // Create a transaction
    const transaction = await client.createTransaction({
      data: fileData,
    });

    defaultTags(file, tags).forEach(tag => {
      transaction.addTag(tag.name, tag.value);
    });
    
    // Sign the transaction with the user's wallet
    try {
      // @ts-ignore - The sign method exists but TypeScript doesn't recognize it
      await window.arweaveWallet.sign(transaction);
    } catch (signError) {
      console.error("Error signing transaction:", signError);
      throw new Error("Failed to sign transaction. Please make sure your wallet is connected and has permissions to sign transactions.");
    }
    
    // Post the transaction
    const response = await client.transactions.post(transaction);
    
    if (response.status === 200) {
      return transaction.id;
    } else {
      throw new Error(`Failed to upload to Arweave: ${response.statusText}`);
    }
  } catch (error) {
    console.error("Error uploading to Arweave:", error);
    throw error;
  }
}

/**
 * Gets the URL for an Arweave transaction ID
 * @param txId The transaction ID
 * @returns The URL to access the content
 */
export function getArweaveUrl(txId: string): string {
  if (!txId) return "";
  if (txId.startsWith('data:')) return txId;
  if (txId.startsWith('http')) return txId;
  return `https://arweave.net/${txId}`;
} 
