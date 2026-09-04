/**
 * A minimal in-memory sliding-window rate limiter — no dependency, consistent
 * with the rest of this app's "dependency-free where reasonable" choices
 * (store.ts, textSimilarity.ts). Single-process only, same limitation as
 * everything else stateful here (see README "Limitations" on serverless).
 *
 * Exists specifically because /api/transcribe-work calls a real, billed
 * Gemini vision endpoint with no protection at all right now — and this
 * isn't hypothetical: this app's own testing tonight hit a real 429 quota
 * error from Gemini after enough live requests. A key with no rate limiting
 * in front of it is a real cost/abuse surface, not just a theoretical one.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

// Cheap periodic cleanup so `buckets` doesn't grow unbounded across a long
// process lifetime — triggered opportunistically on writes, not a timer.
let checksSinceCleanup = 0;
function maybeCleanup(now: number, windowMs: number) {
  checksSinceCleanup += 1;
  if (checksSinceCleanup < 200) return;
  checksSinceCleanup = 0;
  buckets.forEach((bucket, key) => {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);
    if (bucket.timestamps.length === 0) buckets.delete(key);
  });
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the caller could plausibly retry — informational only. */
  retryAfterMs: number;
}

/** Sliding window: allows at most `limit` calls per `key` within `windowMs`. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  maybeCleanup(now, windowMs);

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0];
    buckets.set(key, bucket);
    return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - oldest)) };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0 };
}

/** Test-only: clears all rate-limit state. */
export function _resetRateLimitsForTests(): void {
  buckets.clear();
}
