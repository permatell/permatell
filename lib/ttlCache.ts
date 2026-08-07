type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type InFlightEntry<T> = {
  promise: Promise<T>;
};

/**
 * Tiny process-local TTL cache with in-flight request coalescing.
 * Safe for Next.js route handlers and browser modules.
 */
export class TtlCache<T> {
  private readonly values = new Map<string, CacheEntry<T>>();
  private readonly inflight = new Map<string, InFlightEntry<T>>();

  constructor(private readonly ttlMs: number, private readonly maxEntries = 200) {}

  get(key: string): T | undefined {
    const hit = this.values.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.expiresAt) {
      this.values.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T, ttlMs = this.ttlMs): void {
    if (this.values.size >= this.maxEntries) {
      const oldest = this.values.keys().next().value;
      if (oldest !== undefined) this.values.delete(oldest);
    }
    this.values.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  delete(key: string): void {
    this.values.delete(key);
  }

  async getOrLoad(key: string, loader: () => Promise<T>, ttlMs = this.ttlMs): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;

    const pending = this.inflight.get(key);
    if (pending) return pending.promise;

    const promise = (async () => {
      try {
        const value = await loader();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, { promise });
    return promise;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isRateLimitStatus(status: number): boolean {
  return status === 429;
}

export function rateLimitMessage(source: string, details = ""): string {
  const suffix = details ? ` ${details}` : "";
  return `${source} is rate-limited right now. Wait a moment and try again.${suffix}`.trim();
}
