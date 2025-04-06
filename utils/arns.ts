import { arnsCache, generateCacheKey } from './cache';
import { getFallbackArnsName } from './arns-fallback';
import { ARIO } from '@ar.io/sdk';

// Initialize ARIO
const ario = ARIO.init();

// Function to fetch ARNS name using the ARIO SDK
export const getPrimaryArnsName = async (address: string): Promise<string | null> => {
  if (!address) return null;
  
  try {
    // Check cache first
    const cacheKey = generateCacheKey('arnsName', address);
    const cachedName = arnsCache.get<string>(cacheKey);
    
    if (cachedName) {
      return cachedName;
    }
    
    try {
      // Try to fetch from the ARIO SDK
      const result = await ario.getPrimaryName({
        address,
      });
      
      if (result && result.name) {
        // Cache the result for 1 hour
        arnsCache.set(cacheKey, result.name);
        return result.name;
      }
    } catch (apiError) {
      console.error('API error fetching ARNS name:', apiError);
      // Continue to fallback
    }
    
    // If API fails or returns no data, try the fallback
    const fallbackName = getFallbackArnsName(address);
    if (fallbackName) {
      arnsCache.set(cacheKey, fallbackName);
      return fallbackName;
    }
    
    return null;
  } catch (error) {
    console.error('Error in getPrimaryArnsName:', error);
    return null;
  }
};

// Function to fetch all ARNS names for an address
export const getAllArnsNames = async (address: string): Promise<string[]> => {
  if (!address) return [];
  
  try {
    // Check cache first
    const cacheKey = generateCacheKey('allArnsNames', address);
    const cachedNames = arnsCache.get<string[]>(cacheKey);
    
    if (cachedNames) {
      return cachedNames;
    }
    
    try {
      // Try to fetch from the ARIO SDK
      const result = await ario.getPrimaryNames();
      
      if (result && Array.isArray(result)) {
        // Filter names owned by the address and map to names
        const names = result
          .filter(item => item.owner && item.owner.toLowerCase() === address.toLowerCase())
          .map(item => item.name)
          .filter(Boolean);
        
        // Cache the result for 1 hour
        arnsCache.set(cacheKey, names);
        return names;
      }
    } catch (apiError) {
      console.error('API error fetching all ARNS names:', apiError);
    }
    
    return [];
  } catch (error) {
    console.error('Error in getAllArnsNames:', error);
    return [];
  }
}; 