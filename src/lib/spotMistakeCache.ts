import { FlawedWalkthrough } from "./domain/flawedWorkedExample";

/**
 * In-memory cache for "spot the mistake" rounds — mirrors problemCache.ts's
 * single-process design and limitations (see README "Limitations"). Keeps the
 * flawed step index server-side so the client never sees which step is wrong.
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  walkthrough: FlawedWalkthrough;
  misconceptionId: string;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as { __miskoSpotMistakeCache?: Map<string, CacheEntry> };
const cache = globalForCache.__miskoSpotMistakeCache ?? new Map<string, CacheEntry>();
globalForCache.__miskoSpotMistakeCache = cache;

export function cacheRound(roundId: string, walkthrough: FlawedWalkthrough, misconceptionId: string): void {
  cache.set(roundId, { walkthrough, misconceptionId, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > 5000) {
    const now = Date.now();
    cache.forEach((entry, id) => {
      if (entry.expiresAt < now) cache.delete(id);
    });
  }
}

export function getCachedRound(roundId: string): CacheEntry | null {
  const entry = cache.get(roundId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(roundId);
    return null;
  }
  return entry;
}
