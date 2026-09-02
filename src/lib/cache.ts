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
  private pending = new Map<string, Promise<any>>();
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
   * Features:
   * 1. Single-flight in-flight request deduplication (prevents parallel thundering herds)
   * 2. Stale-While-Revalidate without data corruption
   * 3. Prevents overwriting valid populated arrays with empty arrays on transient connection glitches
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = 300_000,
    staleMs: number = 60_000
  ): Promise<T> {
    const entry = this.store.get(key);
    const now = Date.now();

    // 1. Cache hit and still completely fresh
    if (entry && now < entry.staleAt) {
      return entry.value as T;
    }

    // 2. If a fetch is already in flight for this exact key, share the same Promise
    if (this.pending.has(key)) {
      if (entry && now < entry.expiresAt) {
        return entry.value as T;
      }
      return this.pending.get(key) as Promise<T>;
    }

    // 3. Cache hit but stale: return stale value immediately and execute deduped background refresh
    if (entry && now < entry.expiresAt) {
      const bgPromise = (async () => {
        try {
          const freshValue = await fetcher();
          // Never overwrite a valid populated list with an empty result from a transient error
          if (
            Array.isArray(freshValue) &&
            freshValue.length === 0 &&
            Array.isArray(entry.value) &&
            entry.value.length > 0
          ) {
            return entry.value as T;
          }
          if (freshValue !== undefined && freshValue !== null) {
            this.set(key, freshValue, ttlMs, staleMs);
          }
          return freshValue;
        } catch (err) {
          console.warn(`[MemoryCache] Background refresh warning for ${key}:`, err);
          return entry.value as T;
        } finally {
          this.pending.delete(key);
        }
      })();

      this.pending.set(key, bgPromise);
      return entry.value as T;
    }

    // 4. Cache miss or hard expired: fetch synchronously with in-flight deduplication
    const fetchPromise = (async () => {
      try {
        const freshValue = await fetcher();
        // Protect populated cache from being corrupted by empty result
        if (
          Array.isArray(freshValue) &&
          freshValue.length === 0 &&
          entry &&
          Array.isArray(entry.value) &&
          entry.value.length > 0
        ) {
          return entry.value as T;
        }
        if (freshValue !== undefined && freshValue !== null) {
          this.set(key, freshValue, ttlMs, staleMs);
        }
        return freshValue;
      } catch (error) {
        if (entry) {
          console.warn(`[MemoryCache] Fetcher failed for ${key}, falling back to existing cache:`, error);
          return entry.value as T;
        }
        throw error;
      } finally {
        this.pending.delete(key);
      }
    })();

    this.pending.set(key, fetchPromise);
    return fetchPromise;
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
