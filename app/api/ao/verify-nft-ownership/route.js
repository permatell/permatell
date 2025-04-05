// /api/ao/verify-nft-ownership route handler
// Verifies ownership of NFTs in specified collections

export async function POST(request) {
  try {
    // Parse the request body
    const data = await request.json();
    const { address, collectionId } = data;
    
    if (!address || !collectionId) {
      return new Response(
        JSON.stringify({ 
          error: "Missing required parameters: address and collectionId", 
          success: false 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log(`Verifying NFT ownership for address ${address} in collection ${collectionId}`);
    
    // For Goddesses collection on BazAR (ID: 1NOj1dFvK_ZdXrx8zYlQniXkC3eOUaO7pV8m2-2g1E0)
    // Query the Arweave GraphQL API to check for ownership
    // This is a simplified example that queries BazAR's GraphQL endpoint
    
    // Construct GraphQL query to check for ownership
    const query = `
      query {
        transactions(
          tags: [
            { name: "Collection", values: ["${collectionId}"] },
            { name: "Owner", values: ["${address}"] }
          ]
        ) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;
    
    const response = await fetch('https://arweave.net/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    
    if (!response.ok) {
      throw new Error(`GraphQL request failed with status ${response.status}`);
    }
    
    const result = await response.json();
    
    // Check if the user owns any NFTs in the collection
    const ownsNFTs = result.data.transactions.edges.length > 0;
    
    return new Response(
      JSON.stringify({ 
        verified: ownsNFTs,
        nftCount: result.data.transactions.edges.length,
        collection: collectionId,
        success: true
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error verifying NFT ownership:', error);
    
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
