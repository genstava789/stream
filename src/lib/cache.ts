/**
 * Fast In-Memory Cache with TTL & Stale-While-Revalidate (SWR) Support
 * 
 * Used for:
 * 1. TMDB API responses (prevents repeated remote API calls)
 * 2. Markdown directory scanning & gray-matter parsing (prevents disk thrashing)
 * 3. Enriched Featured items calculation
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  staleAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private maxEntries = 1000;

  /**
   * Get an item from cache if it exists and is not expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set an item in cache with TTL (in milliseconds).
   * @param ttlMs Time until entry is completely expired (default: 5 minutes)
   * @param staleMs Time after which entry is considered stale for SWR (default: 1 minute)
   */
  set<T>(key: string, value: T, ttlMs: number = 300_000, staleMs: number = 60_000): void {
    if (this.store.size >= this.maxEntries) {
      // Evict oldest 20% entries
      const keys = Array.from(this.store.keys());
      for (let i = 0; i < Math.floor(this.maxEntries * 0.2); i++) {
        this.store.delete(keys[i]);
      }
    }

    const now = Date.now();
    this.store.set(key, {
      value,
      expiresAt: now + ttlMs,
      staleAt: now + staleMs,
    });
  }

  /**
   * Gets cached value or executes fetcher if missing or expired.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 300_000,
    staleMs: number = 60_000
  ): Promise<T> {
    const entry = this.store.get(key);
    const now = Date.now();

    // Cache hit and still fresh
    if (entry && now < entry.staleAt) {
      return entry.value as T;
    }

    // Cache hit but stale: return stale value immediately and refresh in background (SWR)
    if (entry && now < entry.expiresAt) {
      fetcher()
        .then((freshValue) => {
          this.set(key, freshValue, ttlMs, staleMs);
        })
        .catch((err) => {
          console.warn(`[MemoryCache] SWR background refresh failed for key ${key}:`, err);
        });
      return entry.value as T;
    }

    // Cache miss or hard expired: fetch synchronously
    try {
      const freshValue = await fetcher();
      this.set(key, freshValue, ttlMs, staleMs);
      return freshValue;
    } catch (error) {
      // If fetcher fails but we have an expired entry, fallback to expired entry instead of crashing
      if (entry) {
        console.warn(`[MemoryCache] Fetcher failed for ${key}, falling back to expired cache:`, error);
        return entry.value as T;
      }
      throw error;
    }
  }

  /**
   * Invalidates specific cache key or all keys starting with prefix.
   */
  invalidate(keyOrPrefix: string): void {
    const keys = Array.from(this.store.keys());
    for (const key of keys) {
      if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clears entire in-memory store.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Current number of stored keys.
   */
  size(): number {
    return this.store.size;
  }
}

// Global Singleton Memory Cache instance shared across all Next.js bundles
declare global {
  var _memoryCacheInstance: MemoryCache | undefined;
}

export const memoryCache = global._memoryCacheInstance || (global._memoryCacheInstance = new MemoryCache());

export default memoryCache;
