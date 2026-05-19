/**
 * Generic TTL-based localStorage cache.
 * Keys are prefixed with 'fs_cache_v2_' to avoid collisions.
 * Version bump clears any data cached under the old v1 prefix.
 */

const PREFIX = 'fs_cache_v2_';

interface CacheEntry<T> {
  data: T;
  expiresAt: number; // ms since epoch
}

export function cacheGet<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Storage quota exceeded -- silently skip.
  }
}

export function cacheDel(key: string): void {
  try { localStorage.removeItem(PREFIX + key); } catch { /* noop */ }
}
