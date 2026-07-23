/**
 * In-memory cache + simple IP rate limit for GitHub activity fetches.
 * Process-local (fine for single Railway instance).
 */

type CacheEntry<T> = { at: number; value: T };

const activityCache = new Map<string, CacheEntry<unknown>>();
const rateBuckets = new Map<string, { count: number; reset: number }>();

const CACHE_TTL_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 30;

export function cacheGet<T>(key: string): T | null {
  const hit = activityCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    activityCache.delete(key);
    return null;
  }
  return hit.value as T;
}

export function cacheSet(key: string, value: unknown): void {
  activityCache.set(key, { at: Date.now(), value });
  if (activityCache.size > 500) {
    const oldest = activityCache.keys().next().value;
    if (oldest) activityCache.delete(oldest);
  }
}

/** Returns true if the request is allowed. */
export function rateLimitAllow(ip: string): boolean {
  const now = Date.now();
  const key = ip || "unknown";
  let bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.reset) {
    bucket = { count: 0, reset: now + RATE_WINDOW_MS };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= RATE_MAX;
}
