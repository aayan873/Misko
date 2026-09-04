import { store, DiagnosisSource, ConfirmationStatus } from "./store";
import { CONCEPTS, ConceptId, getConcept } from "./domain/concepts";
import { getMisconception } from "./domain/misconceptions";
import {
  generateProblem,
  generateProblemForMisconception,
  ProblemInstance,
} from "./domain/problemEngine";
import { initialMastery, updateMastery, BKT_MASTERY_THRESHOLD } from "./bkt";

/** Extra floor alongside the BKT threshold, so mastery can't be granted off a
 *  freak early streak before there's a reasonable sample size. */
export const MASTERY_MIN_ATTEMPTS = 3;
/** Chance of serving a review problem from a weaker, previously-seen concept instead of the frontier concept (interleaving, see RESEARCH/LEARNING_SCIENCE.md #8). */
const INTERLEAVE_PROBABILITY = 0.25;

export interface ConceptMasteryRow {
  learner_id: string;
  concept_id: ConceptId;
  attempts: number;
  correct: number;
  streak: number;
  /** Bayesian Knowledge Tracing estimate of P(learner knows this concept), 0-1. See bkt.ts. */
  p_mastery: number;
  mastered: number;
  updated_at: number;
}

export function getConceptMastery(learnerId: string, conceptId: ConceptId): ConceptMasteryRow {
  const row = store.raw.conceptMastery.find(
    (r) => r.learner_id === learnerId && r.concept_id === conceptId
  );
  // p_mastery may be missing on a row written before BKT was added — default it
  // rather than let a stale on-disk file produce NaN through the update math.
  if (row) return row.p_mastery === undefined ? { ...row, p_mastery: initialMastery() } : row;
  return {
    learner_id: learnerId,
    concept_id: conceptId,
    attempts: 0,
    correct: 0,
    streak: 0,
    p_mastery: initialMastery(),
    mastered: 0,
    updated_at: Date.now(),
  };
}

export function getAllMastery(learnerId: string): ConceptMasteryRow[] {
  return CONCEPTS.map((c) => getConceptMastery(learnerId, c.id));
}

function isConceptMastered(learnerId: string, conceptId: ConceptId): boolean {
  return getConceptMastery(learnerId, conceptId).mastered === 1;
}

/** The concept the learner should currently be working toward, per the prerequisite chain. */
export function frontierConcept(learnerId: string): ConceptId | null {
  for (const concept of CONCEPTS) {
    const prereqsMet = concept.prerequisites.every((p) => isConceptMastered(learnerId, p));
    if (prereqsMet && !isConceptMastered(learnerId, concept.id)) return concept.id;
  }
  return null; // everything mastered
}

/** Most recent misconception this learner hit that hasn't yet been resolved by a correct answer. */
function activeMisconception(
  learnerId: string
): { misconceptionId: string; conceptId: ConceptId } | null {
  const events = store.raw.misconceptionEvents
    .filter((e) => e.learner_id === learnerId && e.resolved === 0)
    // Sort by monotonic id, not created_at — two events can share a millisecond
    // timestamp (e.g. rapid consecutive requests), and Date.now() ties would make
    // "most recent" ambiguous. id is strictly increasing by insertion order.
    .sort((a, b) => b.id - a.id);
  const row = events[0];
  return row ? { misconceptionId: row.misconception_id, conceptId: row.concept_id } : null;
}

/**
 * A correct answer whose reasoning raised a soft hypothesis (see
 * classifyCorrectReasoning) and is still awaiting its silent confirmation-round
 * problem. See "Catching the Correct Answer Trap" in ARCHITECTURE.md.
 */
export function pendingConfirmation(
  learnerId: string
): { misconceptionId: string; conceptId: ConceptId; problemPrompt: string } | null {
  const row = store.raw.attempts
    .filter((a) => a.learner_id === learnerId && a.confirmation_status === "pending")
    // id, not created_at — see activeMisconception's comment on timestamp ties.
    .sort((a, b) => b.id - a.id)[0];
  if (!row || !row.misconception_id) return null;
  return {
    misconceptionId: row.misconception_id,
    conceptId: row.concept_id,
    problemPrompt: row.problem_prompt,
  };
}

/**
 * The learner's most recent attempt on this concept, if it was a wrong answer
 * matched to a specific misconception. Used to decide whether a fresh correct
 * answer immediately follows a slip on the same concept — right this time, but
 * was the underlying reasoning actually fixed, or just retried until it landed?
 * Deterministic and always available (no AI, no shown-work required) — see
 * submit-answer route's confirmation-trigger step 1, and "Catching the Correct
 * Answer Trap" in ARCHITECTURE.md.
 */
export function lastMisconceptionOnConcept(learnerId: string, conceptId: ConceptId): string | null {
  const row = store.raw.attempts
    .filter((a) => a.learner_id === learnerId && a.concept_id === conceptId)
    // id, not created_at — see activeMisconception's comment on timestamp ties.
    .sort((a, b) => b.id - a.id)[0];
  if (!row || row.outcome !== "matched_misconception" || !row.misconception_id) return null;
  return row.misconception_id;
}

function weakestReviewableConcept(learnerId: string, exclude: ConceptId): ConceptId | null {
  const attempted = getAllMastery(learnerId).filter(
    (m) => m.attempts > 0 && m.concept_id !== exclude
  );
  if (attempted.length === 0) return null;
  attempted.sort((a, b) => a.correct / Math.max(a.attempts, 1) - b.correct / Math.max(b.attempts, 1));
  return attempted[0].concept_id;
}

/** Structured category for the "why this problem" reason — lets the UI give each type its own badge instead of parsing free text (see prompt.md §9 "not a black box"). */
export type ReasonType = "confirmation" | "retarget" | "review" | "frontier" | "done";

export interface NextProblemResult {
  done: boolean;
  problem?: ProblemInstance;
  /** Why this problem was chosen — surfaced in the UI so the personalization is visible, not a black box. */
  reason: string;
  reasonType: ReasonType;
}

/**
 * The mastery gate: decides what the learner sees next. This is where the
 * "two learners can get different experiences" behavior (prompt.md §9) actually
 * happens — the decision depends entirely on this learner's stored history.
 */
export function decideNextProblem(learnerId: string): NextProblemResult {
  const pending = pendingConfirmation(learnerId);
  if (pending) {
    return {
      done: false,
      problem: generateProblemForMisconception(pending.misconceptionId),
      reason: `Double-checking your last correct answer with a similar problem.`,
      reasonType: "confirmation",
    };
  }

  const active = activeMisconception(learnerId);
  if (active) {
    return {
      done: false,
      problem: generateProblemForMisconception(active.misconceptionId),
      reason: `Retargeting "${getMisconception(active.misconceptionId)?.name}" until resolved.`,
      reasonType: "retarget",
    };
  }

  const frontier = frontierConcept(learnerId);
  if (!frontier) {
    return { done: true, reason: "All concepts mastered.", reasonType: "done" };
  }

  if (Math.random() < INTERLEAVE_PROBABILITY) {
    const review = weakestReviewableConcept(learnerId, frontier);
    if (review) {
      return {
        done: false,
        problem: generateProblem(review),
        reason: `Interleaved review: ${getConcept(review).name} (your weakest reviewed concept).`,
        reasonType: "review",
      };
    }
  }

  return {
    done: false,
    problem: generateProblem(frontier),
    reason: `Frontier concept: ${getConcept(frontier).name}.`,
    reasonType: "frontier",
  };
}

export interface RecordAttemptInput {
  learnerId: string;
  conceptId: ConceptId;
  misconceptionId: string | null;
  outcome: "correct" | "matched_misconception" | "unrecognized";
  confidenceBefore: number; // 1-5
  hintLevelUsed: number;
  problemPrompt: string;
  learnerAnswer: string;
  /** How the misconception (if any) was identified — rule-based distractor match, or Gemini classifying freeform reasoning. */
  diagnosisSource?: DiagnosisSource;
  /** See ConfirmationStatus in store.ts — only meaningful when outcome is "correct". */
  confirmationStatus?: ConfirmationStatus;
}

export function recordAttempt(input: RecordAttemptInput): void {
  const now = Date.now();
  const s = store.raw;

  const diagnosisSource: DiagnosisSource = input.diagnosisSource ?? null;

  s.attempts.push({
    id: s.nextAttemptId++,
    learner_id: input.learnerId,
    concept_id: input.conceptId,
    misconception_id: input.misconceptionId,
    outcome: input.outcome,
    confidence_before: input.confidenceBefore,
    hint_level_used: input.hintLevelUsed,
    created_at: now,
    diagnosis_source: diagnosisSource,
    confirmation_status: input.confirmationStatus ?? "none",
    problem_prompt: input.problemPrompt,
  });

  const wasCorrect = input.outcome === "correct";
  const current = getConceptMastery(input.learnerId, input.conceptId);
  const attempts = current.attempts + 1;
  const correct = current.correct + (wasCorrect ? 1 : 0);
  const streak = wasCorrect ? current.streak + 1 : 0;
  const pMastery = updateMastery(current.p_mastery, wasCorrect);
  // Sticky: once mastered, a single slip on a later review problem shouldn't revoke
  // it outright (BKT still lowers p_mastery on a slip — this just stops that alone
  // from re-locking a concept the learner already demonstrated).
  const mastered =
    current.mastered === 1 || (pMastery >= BKT_MASTERY_THRESHOLD && attempts >= MASTERY_MIN_ATTEMPTS)
      ? 1
      : 0;

  const existingIdx = s.conceptMastery.findIndex(
    (r) => r.learner_id === input.learnerId && r.concept_id === input.conceptId
  );
  const updatedRow: ConceptMasteryRow = {
    learner_id: input.learnerId,
    concept_id: input.conceptId,
    attempts,
    correct,
    streak,
    p_mastery: pMastery,
    mastered,
    updated_at: now,
  };
  if (existingIdx >= 0) s.conceptMastery[existingIdx] = updatedRow;
  else s.conceptMastery.push(updatedRow);

  if (input.outcome === "matched_misconception" && input.misconceptionId) {
    s.misconceptionEvents.push({
      id: s.nextEventId++,
      learner_id: input.learnerId,
      misconception_id: input.misconceptionId,
      concept_id: input.conceptId,
      problem_prompt: input.problemPrompt,
      learner_answer: input.learnerAnswer,
      resolved: 0,
      created_at: now,
      diagnosis_source: diagnosisSource,
    });
  }

  if (wasCorrect) {
    // Resolve any still-open misconception events for this concept (the learner just
    // demonstrated correct reasoning on it again).
    for (const e of s.misconceptionEvents) {
      if (e.learner_id === input.learnerId && e.concept_id === input.conceptId && e.resolved === 0) {
        e.resolved = 1;
      }
    }
  }

  store.save();
}

/**
 * Retroactively resolves the learner's most recent pending confirmation once the
 * confirmation-round problem has been answered — see the submit-answer route,
 * which calls this instead of surfacing anything to the learner about the ORIGINAL
 * correct answer until this resolves it one way or the other.
 */
export function resolvePendingConfirmation(learnerId: string, resolution: "confirmed" | "caught"): void {
  const s = store.raw;
  const row = s.attempts
    .filter((a) => a.learner_id === learnerId && a.confirmation_status === "pending")
    // id, not created_at — see activeMisconception's comment on timestamp ties.
    .sort((a, b) => b.id - a.id)[0];
  if (!row) return;
  row.confirmation_status = resolution;
  store.save();
}

export interface ConfirmationStats {
  confirmed: number;
  caught: number;
  /** confirmed + caught — correct answers that were actually independently re-checked. */
  checked: number;
}

/** Powers the dashboard's headline "Confirmed Mastery" stat — see prompt.md's "wow moment" framing, made concrete as a single ownable number. */
export function getConfirmationStats(learnerId: string): ConfirmationStats {
  const attempts = store.raw.attempts.filter((a) => a.learner_id === learnerId);
  const confirmed = attempts.filter((a) => a.confirmation_status === "confirmed").length;
  const caught = attempts.filter((a) => a.confirmation_status === "caught").length;
  return { confirmed, caught, checked: confirmed + caught };
}

/**
 * Per-concept breakdown of the same stats — lets the concept-path visualization
 * show mastery depth (raw accuracy vs. independently-confirmed) per concept, not
 * just a single global number. See ARCHITECTURE.md "Catching the Correct Answer Trap".
 */
export function getConfirmationStatsByConcept(learnerId: string): Record<ConceptId, ConfirmationStats> {
  const attempts = store.raw.attempts.filter((a) => a.learner_id === learnerId);
  const result = {} as Record<ConceptId, ConfirmationStats>;
  for (const concept of CONCEPTS) {
    const forConcept = attempts.filter((a) => a.concept_id === concept.id);
    const confirmed = forConcept.filter((a) => a.confirmation_status === "confirmed").length;
    const caught = forConcept.filter((a) => a.confirmation_status === "caught").length;
    result[concept.id] = { confirmed, caught, checked: confirmed + caught };
  }
  return result;
}

export interface MisconceptionHistoryEntry {
  misconception_id: string;
  concept_id: ConceptId;
  occurrences: number;
  resolved: number;
  last_seen: number;
  diagnosis_source: DiagnosisSource;
}

export function getMisconceptionHistory(learnerId: string): MisconceptionHistoryEntry[] {
  // Tracks each group's most recent event by monotonic id, not created_at — two
  // events can share a millisecond timestamp (see activeMisconception's comment
  // on timestamp ties), which would make "most recent" ambiguous both within a
  // group (which diagnosis_source wins) and across groups (final sort order).
  // store.raw.misconceptionEvents is append-only, so iterating it in order is
  // already ascending by id — the last occurrence seen for a key is the latest.
  const grouped = new Map<string, MisconceptionHistoryEntry & { lastEventId: number }>();
  const events = store.raw.misconceptionEvents.filter((e) => e.learner_id === learnerId);
  for (const e of events) {
    const existing = grouped.get(e.misconception_id);
    if (!existing) {
      grouped.set(e.misconception_id, {
        misconception_id: e.misconception_id,
        concept_id: e.concept_id,
        occurrences: 1,
        resolved: e.resolved,
        last_seen: e.created_at,
        diagnosis_source: e.diagnosis_source,
        lastEventId: e.id,
      });
    } else {
      existing.occurrences += 1;
      existing.resolved = Math.max(existing.resolved, e.resolved);
      existing.diagnosis_source = e.diagnosis_source;
      existing.last_seen = e.created_at;
      existing.lastEventId = e.id;
    }
  }
  return Array.from(grouped.values())
    .sort((a, b) => b.lastEventId - a.lastEventId)
    .map((g) => ({
      misconception_id: g.misconception_id,
      concept_id: g.concept_id,
      occurrences: g.occurrences,
      resolved: g.resolved,
      last_seen: g.last_seen,
      diagnosis_source: g.diagnosis_source,
    }));
}

export interface CalibrationPoint {
  confidence_before: number;
  accuracy: number;
  count: number;
}

/** Average accuracy grouped by the confidence the learner reported *before* answering — the raw material for metacognitive-calibration feedback (RESEARCH/LEARNING_SCIENCE.md #10). */
export function getCalibration(learnerId: string): CalibrationPoint[] {
  const attempts = store.raw.attempts.filter((a) => a.learner_id === learnerId);
  const byLevel = new Map<number, { correct: number; total: number }>();
  for (const a of attempts) {
    const bucket = byLevel.get(a.confidence_before) ?? { correct: 0, total: 0 };
    bucket.total += 1;
    if (a.outcome === "correct") bucket.correct += 1;
    byLevel.set(a.confidence_before, bucket);
  }
  return Array.from(byLevel.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([confidence_before, { correct, total }]) => ({
      confidence_before,
      accuracy: total > 0 ? correct / total : 0,
      count: total,
    }));
}

export type CalibrationInsightType = "overconfident" | "underconfident";

export interface CalibrationInsight {
  type: CalibrationInsightType;
  /** Accuracy across the pooled attempts this insight is based on. */
  accuracy: number;
  count: number;
}

const CALIBRATION_MIN_SAMPLE = 5;
const OVERCONFIDENT_ACCURACY_CEILING = 0.5;
const UNDERCONFIDENT_ACCURACY_FLOOR = 0.85;

/**
 * getCalibration above produces the data for a chart, but nothing acts on it —
 * this turns it into an actual signal. Pools high-confidence (4-5) and
 * low-confidence (1-2) attempts separately (not per-level, so there's enough
 * sample size to say something meaningful) and flags a specific, well-documented
 * miscalibration pattern: consistently confident-but-wrong, or consistently
 * unsure-but-right. See RESEARCH/LEARNING_SCIENCE.md #10. Overconfidence is
 * checked first — unearned confidence skipping a double-check is the more
 * consequential failure mode of the two.
 */
export function getCalibrationInsight(learnerId: string): CalibrationInsight | null {
  const attempts = store.raw.attempts.filter((a) => a.learner_id === learnerId);

  const highConfidence = attempts.filter((a) => a.confidence_before >= 4);
  if (highConfidence.length >= CALIBRATION_MIN_SAMPLE) {
    const correct = highConfidence.filter((a) => a.outcome === "correct").length;
    const accuracy = correct / highConfidence.length;
    if (accuracy < OVERCONFIDENT_ACCURACY_CEILING) {
      return { type: "overconfident", accuracy, count: highConfidence.length };
    }
  }

  const lowConfidence = attempts.filter((a) => a.confidence_before <= 2);
  if (lowConfidence.length >= CALIBRATION_MIN_SAMPLE) {
    const correct = lowConfidence.filter((a) => a.outcome === "correct").length;
    const accuracy = correct / lowConfidence.length;
    if (accuracy > UNDERCONFIDENT_ACCURACY_FLOOR) {
      return { type: "underconfident", accuracy, count: lowConfidence.length };
    }
  }

  return null;
}

