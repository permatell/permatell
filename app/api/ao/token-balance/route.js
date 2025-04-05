// /api/ao/token-balance route handler
// Proxies token balance requests to avoid CORS issues

import { connect } from '@permaweb/aoconnect';

// AO Connect configuration (using environment variables if available)
const GATEWAY_URL = process.env.GATEWAY_URL || "https://arweave.net";
const MU_URL = process.env.MU_URL || "https://mu.ao-testnet.xyz";
const CU_URL = process.env.CU_URL || "https://cu.ao-testnet.xyz";

// Initialize AO connection
const ao = connect({
  MU_URL,
  CU_URL,
  GATEWAY_URL,
});

export async function POST(request) {
  try {
    // Parse the request body to get the address
    const data = await request.json();
    const { tokenContractId, address } = data;
    
    if (!tokenContractId || !address) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameters: tokenContractId and address", 
          success: false 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log(`Checking token balance for address ${address} on contract ${tokenContractId}`);
    
    // Use aoconnect to query the token balance
    const result = await ao.dryrun({
      process: tokenContractId,
      tags: [
        { name: "Action", value: "Balance" },
        { name: "Target", value: address }
      ]
    });
    
    let balance = 0;
    
    // Extract the balance from the response
    if (result.Messages && result.Messages.length > 0) {
      const balanceTag = result.Messages[0]?.Tags?.find(tag => tag.name === "Balance");
      
      if (balanceTag) {
        balance = parseFloat(balanceTag.value);
      }
    }
    
    // Return the balance
    return new Response(
      JSON.stringify({ 
        balance, 
        success: true,
        raw: result // Include the raw response for debugging
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error checking token balance:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Unknown error',
        success: false
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
