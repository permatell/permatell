// Simple in-memory cache with expiration
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

class Cache {
  private cache: Map<string, CacheItem<any>> = new Map();
  private defaultTTL: number = 1000 * 60 * 60; // 1 hour default TTL

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now() + ttl,
    });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }
    
    // Check if item has expired
    if (Date.now() > item.timestamp) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

// Create singleton instances for different data types
export const profileCache = new Cache();
export const arnsCache = new Cache();

// Helper function to generate cache keys
export const generateCacheKey = (type: string, id: string): string => {
  return `${type}:${id}`;
}; 