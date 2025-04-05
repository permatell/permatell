// Enhanced AO API proxy with better rate limiting handling
// This will serve as a more robust way to communicate with AO processes

import { randomUUID } from 'crypto';

// Simple in-memory cache with TTL
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Rate limiting with request queuing
const rateLimitQueue = [];
const processingRequests = new Set();
const MAX_CONCURRENT_REQUESTS = 3;
const REQUEST_DELAY = 500; // ms between requests

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, { timestamp }] of cache.entries()) {
    if (now - timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}, 60000); // Check every minute

// Process the request queue
function processQueue() {
  // If we're already at max concurrent requests, wait
  if (processingRequests.size >= MAX_CONCURRENT_REQUESTS) {
    return;
  }
  
  // Get the next request from the queue
  const next = rateLimitQueue.shift();
  if (!next) return;
  
  const { id, execute, resolve, reject } = next;
  
  // Mark this request as processing
  processingRequests.add(id);
  
  // Execute the request
  execute()
    .then(resolve)
    .catch(reject)
    .finally(() => {
      // Clean up and process next request
      processingRequests.delete(id);
      
      // Wait a bit before processing the next request
      setTimeout(processQueue, REQUEST_DELAY);
    });
}

// Add a request to the queue and return a promise
function queueRequest(execute) {
  return new Promise((resolve, reject) => {
    const request = {
      id: randomUUID(),
      execute,
      resolve,
      reject
    };
    
    rateLimitQueue.push(request);
    
    // Start processing if not already processing
    if (processingRequests.size < MAX_CONCURRENT_REQUESTS) {
      processQueue();
    }
  });
}

// Helper function to get cached response or fetch new one with queuing
async function getCachedOrFetch(url, method = 'GET', body = null, maxRetries = 3) {
  const cacheKey = `${method}:${url}:${body ? JSON.stringify(body) : ''}`;
  const now = Date.now();
  
  // Check cache first
  if (cache.has(cacheKey)) {
    const { data, timestamp } = cache.get(cacheKey);
    if (now - timestamp < CACHE_DURATION) {
      console.log(`Cache hit for ${url}`);
      return data;
    }
    console.log(`Cache expired for ${url}`);
  }
  
  // Define the fetch function to be queued
  const executeFetch = async () => {
    let retries = maxRetries;
    let lastError = null;
    
    while (retries >= 0) {
      try {
        let response;
        
        if (method === 'GET') {
          response = await fetch(url, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'PermaTell App/1.0'
            }
          });
        } else {
          response = await fetch(url, {
            method,
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'PermaTell App/1.0'
            },
            body: body ? JSON.stringify(body) : undefined,
          });
        }
        
        // Handle response status
        if (response.status === 429) {
          // Rate limited, throw error to trigger retry
          throw new Error('Rate limited');
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
      } catch (error) {
        lastError = error;
        
        // If we're out of retries, give up
        if (retries <= 0) {
          break;
        }
        
        // Calculate backoff time with jitter (100-800ms)
        const backoff = Math.floor(100 * Math.pow(2, maxRetries - retries)) + Math.floor(Math.random() * 100);
        
        // Wait for backoff period
        await new Promise(resolve => setTimeout(resolve, backoff));
        
        retries--;
      }
    }
    
    // If we have cached data, return it even if expired
    if (cache.has(cacheKey)) {
      console.log(`Using expired cache due to failure for ${url}`);
      return cache.get(cacheKey).data;
    }
    
    // If all retries failed, return an error
    return {
      error: lastError?.message || 'Failed to fetch data after multiple attempts',
      status: lastError?.message?.includes('Rate limited') ? 429 : 500
    };
  };
  
  // Queue the request instead of executing immediately
  return queueRequest(executeFetch);
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
    
    // For all requests, use the queuing system
    const result = await getCachedOrFetch(url, 'POST', body);
    
    if (result.error) {
      return Response.json({ error: result.error }, { status: result.status || 500 });
    }
    
    return Response.json(result.data, { status: result.status });
  } catch (error) {
    console.error('Error posting to AO testnet:', error);
    return Response.json({ error: 'Failed to post to AO testnet' }, { status: 500 });
  }
}
