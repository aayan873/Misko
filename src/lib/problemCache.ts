import { ProblemInstance } from "./domain/problemEngine";

/**
 * In-memory cache mapping a served problem's id to its full instance (including
 * the correct/distractor answers, which must never be sent to the client until
 * the round is resolved). Single-process only — a documented limitation for a
 * hackathon-scale deployment (see README "Limitations"): a multi-instance
 * deployment would need this moved to shared storage (e.g. the same SQLite DB).
 */
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  problem: ProblemInstance;
  expiresAt: number;
}

const globalForCache = globalThis as unknown as { __miskoProblemCache?: Map<string, CacheEntry> };
const cache = globalForCache.__miskoProblemCache ?? new Map<string, CacheEntry>();
globalForCache.__miskoProblemCache = cache;

export function cacheProblem(problem: ProblemInstance): void {
  cache.set(problem.id, { problem, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > 5000) {
    // cheap eviction of expired entries when the cache grows large
    const now = Date.now();
    cache.forEach((entry, id) => {
      if (entry.expiresAt < now) cache.delete(id);
    });
  }
}

export function getCachedProblem(problemId: string): ProblemInstance | null {
  const entry = cache.get(problemId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(problemId);
    return null;
  }
  return entry.problem;
}

/** Strips fields that would leak the answer to the client. */
export function toClientProblem(problem: ProblemInstance) {
  return {
    id: problem.id,
    conceptId: problem.conceptId,
    promptText: problem.promptText,
    answerType: problem.answerType,
  };
}
