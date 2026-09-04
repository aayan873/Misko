import fs from "fs";
import os from "os";
import path from "path";
import { ConceptId } from "./domain/concepts";

/**
 * A minimal, dependency-free JSON-file persistence layer.
 *
 * We deliberately avoid a native-binding SQL driver (e.g. better-sqlite3) here:
 * it requires compiling a native addon against the exact Node ABI in use, which
 * is a real portability risk for a hackathon submission judges will run on their
 * own machines (verified failing — a fresh `require('better-sqlite3')` segfaulted
 * in this dev environment). At this app's data volume (one browser-scoped
 * learner model), a synchronous JSON store is simpler, has zero install-time
 * risk, and is trivially inspectable/resettable for a demo.
 *
 * The data file deliberately lives OUTSIDE the project directory (in the OS temp
 * dir by default) rather than under `./data` — `next dev`'s file watcher scopes
 * the whole project directory, so writing the store inside it triggered a
 * write -> recompile -> (next request) -> write loop that made the dev server
 * unresponsive. Override with MISKO_DATA_DIR if a specific location is needed.
 */

const DATA_DIR = process.env.MISKO_DATA_DIR || path.join(os.tmpdir(), "misko-data");
const DB_PATH = path.join(DATA_DIR, "misko-store.json");

export interface LearnerRow {
  id: string;
  display_name: string;
  created_at: number;
}

export interface ConceptMasteryRow {
  learner_id: string;
  concept_id: ConceptId;
  attempts: number;
  correct: number;
  streak: number;
  /** Bayesian Knowledge Tracing estimate of P(learner knows this concept), 0-1. See src/lib/bkt.ts. */
  p_mastery: number;
  mastered: number;
  /** Spaced-review scheduling, in the learner's own attempt count — see learnerModel.ts. */
  review_interval: number;
  due_after_attempts: number | null;
  updated_at: number;
}

/** How a misconception was identified: a deterministic distractor-value match, or Gemini classifying the learner's own written reasoning. */
export type DiagnosisSource = "rule" | "ai" | null;

export interface MisconceptionEventRow {
  id: number;
  learner_id: string;
  misconception_id: string;
  concept_id: ConceptId;
  problem_prompt: string;
  learner_answer: string;
  resolved: number;
  created_at: number;
  diagnosis_source: DiagnosisSource;
}

/**
 * Tracks whether a CORRECT answer's reasoning was independently re-checked
 * (see ARCHITECTURE.md "Catching the Correct Answer Trap"):
 * - "none": no reasoning check was ever run (no shown-work text, or nothing suspicious found).
 * - "pending": a hypothesis was raised; a confirmation-round problem is queued but not yet answered.
 * - "confirmed": the learner independently answered the confirmation-round problem correctly —
 *   the original correct answer's reasoning holds up.
 * - "caught": the learner missed the confirmation-round problem — the original "correct" answer
 *   was likely a lucky/fluent-but-not-understood guess (the illusion-of-fluency case).
 */
export type ConfirmationStatus = "none" | "pending" | "confirmed" | "caught";

export interface AttemptRow {
  id: number;
  learner_id: string;
  concept_id: ConceptId;
  misconception_id: string | null;
  outcome: string;
  confidence_before: number;
  hint_level_used: number;
  created_at: number;
  diagnosis_source: DiagnosisSource;
  confirmation_status: ConfirmationStatus;
  problem_prompt: string;
}

interface StoreShape {
  learners: LearnerRow[];
  conceptMastery: ConceptMasteryRow[];
  misconceptionEvents: MisconceptionEventRow[];
  attempts: AttemptRow[];
  nextEventId: number;
  nextAttemptId: number;
}

function emptyStore(): StoreShape {
  return {
    learners: [],
    conceptMastery: [],
    misconceptionEvents: [],
    attempts: [],
    nextEventId: 1,
    nextAttemptId: 1,
  };
}

const globalForStore = globalThis as unknown as { __miskoStore?: StoreShape };

function load(): StoreShape {
  if (globalForStore.__miskoStore) return globalForStore.__miskoStore;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    try {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const parsed = { ...emptyStore(), ...JSON.parse(raw) };
      globalForStore.__miskoStore = parsed;
      return parsed;
    } catch {
      // corrupt/missing file — start fresh rather than crash the app
    }
  }
  const fresh = emptyStore();
  globalForStore.__miskoStore = fresh;
  return fresh;
}

let saveScheduled = false;
function persist(store: StoreShape) {
  // Synchronous, debounced-by-microtask write — fine at this app's write volume
  // (single-user, request-driven), and guarantees the file is never read half-written.
  if (saveScheduled) return;
  saveScheduled = true;
  queueMicrotask(() => {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(store));
    } finally {
      saveScheduled = false;
    }
  });
}

export const store = {
  get raw(): StoreShape {
    return load();
  },
  save(): void {
    persist(load());
  },
  /** Test-only: resets to a genuinely empty store. Sets a fresh object directly
   * rather than clearing the cache pointer — clearing it alone would make the
   * next access reload from the same on-disk temp file every test in a run
   * shares, silently accumulating state across tests instead of isolating them.
   * Harmless for tests that always filter by a unique per-test learner id, but
   * a real bug for anything that queries across all learners. */
  _resetForTests(): void {
    globalForStore.__miskoStore = emptyStore();
  },
  /** Wipes all stored history for one learner id — used to re-seed the /compare demo to a clean state on each visit. */
  resetLearner(learnerId: string): void {
    const s = load();
    s.conceptMastery = s.conceptMastery.filter((r) => r.learner_id !== learnerId);
    s.misconceptionEvents = s.misconceptionEvents.filter((r) => r.learner_id !== learnerId);
    s.attempts = s.attempts.filter((r) => r.learner_id !== learnerId);
    persist(s);
  },
};
