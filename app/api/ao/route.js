// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 10; // requests per minute
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds

// Helper function to check rate limit
function checkRateLimit(endpoint) {
  const now = Date.now();
  const key = endpoint;
  
  // Initialize or clean up old entries
  if (!requestCounts.has(key)) {
    requestCounts.set(key, []);
  }
  
  // Remove requests older than the window
  const requests = requestCounts.get(key).filter(time => now - time < RATE_LIMIT_WINDOW);
  requestCounts.set(key, requests);
  
  // Check if we're over the limit
  if (requests.length >= RATE_LIMIT) {
    return false;
  }
  
  // Add this request
  requests.push(now);
  return true;
}

// Helper function to get cached response or fetch new one
async function getCachedOrFetch(url, method = 'GET', body = null) {
  const cacheKey = `${method}:${url}:${body ? JSON.stringify(body) : ''}`;
  const now = Date.now();
  
  // Check cache
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (now - timestamp < CACHE_DURATION) {
      console.log(`Cache hit for ${url}`);
      return data;
    }
    console.log(`Cache expired for ${url}`);
  }
  
  // Check rate limit
  if (!checkRateLimit(url)) {
    console.warn(`Rate limit exceeded for ${url}`);
    
    // If we have cached data, return it even if expired
    if (cache.has(cacheKey)) {
      console.log(`Using expired cache due to rate limiting for ${url}`);
      return cache.get(cacheKey).data;
    }
    
    // Otherwise return a rate limit error
    return {
      error: 'Rate limit exceeded',
      status: 429
    };
  }
  
  // Fetch new data
  console.log(`Fetching ${url}`);
  let response;
  if (method === 'GET') {
    response = await fetch(url);
  } else {
    response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  
  let result;
  
  // Process response
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    result = {
      data,
      status: response.status
    };
  } else {
    // If not JSON, try to parse as JSON anyway (sometimes content-type is wrong)
    const text = await response.text();
    try {
      const jsonData = JSON.parse(text);
      result = {
        data: jsonData,
        status: response.status
      };
    } catch (e) {
      // If it's not JSON, return a structured error
      result = {
        error: 'Non-JSON response from AO testnet',
        responseText: text.substring(0, 500), // Limit the size
        status: response.status
      };
    }
  }
  
  // Cache the result
  cache.set(cacheKey, {
    data: result,
    timestamp: now
  });
  
  return result;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  let endpoint = searchParams.get('endpoint') || '';
  
  // Remove leading slash if present to avoid double slashes in the URL
  if (endpoint.startsWith('/')) {
    endpoint = endpoint.substring(1);
  }
  
  const url = `https://cu.ao-testnet.xyz/${endpoint}`;
  
  try {
    const result = await getCachedOrFetch(url);
    
    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status || 500 });
    }
    
    return Response.json(result.data, { status: result.status });
  } catch (error) {
    console.error('Error fetching from AO testnet:', error);
    return Response.json({ error: 'Failed to fetch from AO testnet' }, { status: 500 });
  }
}

export async function POST(request) {
  const { searchParams } = new URL(request.url);
  let endpoint = searchParams.get('endpoint') || '';
  
  // Remove leading slash if present to avoid double slashes in the URL
  if (endpoint.startsWith('/')) {
    endpoint = endpoint.substring(1);
  }
  
  const url = `https://cu.ao-testnet.xyz/${endpoint}`;
  
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    // For dry-run requests, use caching
    if (endpoint.includes('dry-run')) {
      const result = await getCachedOrFetch(url, 'POST', body);
      
      if (result.error) {
        return Response.json({ error: result.error }, { status: result.status || 500 });
      }
      
      return Response.json(result.data, { status: result.status });
    }
    
    // For other requests (like sending messages), don't use caching
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
    });
    
    // Check if the response is JSON
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return Response.json(data);
    } else {
      // If not JSON, return the text
      const text = await response.text();
      
      // Try to parse as JSON anyway (sometimes content-type is wrong)
      try {
        const jsonData = JSON.parse(text);
        return Response.json(jsonData);
      } catch (e) {
        // If it's not JSON, return a structured error
        return Response.json({ 
          error: 'Non-JSON response from AO testnet',
          responseText: text.substring(0, 500) // Limit the size
        }, { status: response.status });
      }
    }
  } catch (error) {
    console.error('Error posting to AO testnet:', error);
    return Response.json({ error: 'Failed to post to AO testnet' }, { status: 500 });
  }
}
