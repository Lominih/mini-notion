/**
 * In-memory cache with configurable TTL.
 *
 * Used for short-lived caching of frequently queried data
 * (e.g. page tree snapshots) to reduce database load.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30_000; // 30 seconds

const store = new Map<string, CacheEntry<unknown>>();

/**
 * Retrieve a cached value by key. Returns `undefined` on miss or expiry.
 */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;

  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }

  return entry.value as T;
}

/**
 * Store a value in the cache with an optional TTL (defaults to 30 s).
 */
export function cacheSet<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Invalidate a single cache entry.
 */
export function cacheInvalidate(key: string): void {
  store.delete(key);
}

/**
 * Invalidate all entries whose key starts with the given prefix.
 */
export function cacheInvalidatePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
    }
  }
}

/**
 * Clear the entire cache. Useful for tests.
 */
export function cacheClear(): void {
  store.clear();
}
