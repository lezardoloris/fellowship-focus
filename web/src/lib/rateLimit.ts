/** Simple sliding-window rate limit (in-memory; per process). */

type Bucket = { times: number[] };

const buckets = new Map<string, Bucket>();

export function clientKey(req: Request, suffix = ""): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = req.headers.get("x-real-ip")?.trim();
  const ip = fwd || real || "unknown";
  return `${ip}:${suffix}`;
}

/**
 * Returns true if the action is allowed; false if over limit.
 * @param limit max events in windowMs
 */
export function allowRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { times: [] };
    buckets.set(key, b);
  }
  b.times = b.times.filter((t) => now - t < windowMs);
  if (b.times.length >= limit) return false;
  b.times.push(now);
  return true;
}
