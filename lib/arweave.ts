import Arweave from 'arweave';

// Initialize Arweave
const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https'
});

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
  try {
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
    const transaction = await arweave.createTransaction({
      data: fileData,
    });

    // Add default tags
    transaction.addTag('Content-Type', file.type);
    transaction.addTag('App-Name', 'PermaTell');
    
    // Add additional tags
    tags.forEach(tag => {
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
    const response = await arweave.transactions.post(transaction);
    
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