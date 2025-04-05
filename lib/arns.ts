/**
 * Utility functions for Arweave Name Service (ARN) integration
 */

/**
 * Get the primary ARN name for a wallet address
 * @param address The wallet address to get the primary ARN for
 * @returns The primary ARN name or null if not found
 */
export async function getPrimaryArn(address: string): Promise<string | null> {
  try {
    // Use a more reliable API endpoint with proper error handling
    const response = await fetch(`https://arweave.net/wallet/${address}/arns`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add this to bypass SSL certificate issues in development
      mode: 'cors',
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch ARNs for address ${address}: ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    // Check if there are any ARNs
    if (data && data.arns && data.arns.length > 0) {
      // Return the first ARN as primary
      return data.arns[0];
    }
    
    return null;
  } catch (error) {
    console.warn(`Error fetching ARN for address ${address}:`, error);
    return null;
  }
}

/**
 * Sets a specified ARN name as primary for a wallet address
 * @param name The ARN name to set as primary
 * @param address The wallet address
 * @returns The transaction ID or null if the operation failed
 */
export async function setPrimaryArn(name: string, address: string): Promise<string | null> {
  try {
    // This would typically involve creating and signing a transaction
    // For now, we'll just log that this would happen
    console.log(`Setting ARN ${name} as primary for address ${address}`);
    
    // In a real implementation, this would return the transaction ID
    return "placeholder-tx-id";
  } catch (error) {
    console.error(`Error setting ARN ${name} as primary:`, error);
    return null;
  }
}

/**
 * Get all ARN names for a wallet address
 * @param address The wallet address to get ARNs for
 * @returns Array of ARN names
 */
export async function getAllArns(address: string): Promise<string[]> {
  try {
    // Use a more reliable API endpoint with proper error handling
    const response = await fetch(`https://arweave.net/wallet/${address}/arns`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Add this to bypass SSL certificate issues in development
      mode: 'cors',
    });
    
    if (!response.ok) {
      console.warn(`Failed to fetch ARNs for address ${address}: ${response.statusText}`);
      return [];
    }
    
    const data = await response.json();
    
    // Check if there are any ARNs
    if (data && data.arns && Array.isArray(data.arns)) {
      return data.arns;
    }
    
    return [];
  } catch (error) {
    console.warn(`Error fetching ARNs for address ${address}:`, error);
    return [];
  }
} 