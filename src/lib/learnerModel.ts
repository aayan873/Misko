import {
  store,
  DiagnosisSource,
  ConfirmationStatus,
  MisconceptionEventRow,
  AttemptRow,
  SpotMistakeAttemptRow,
} from "./store";
import { CONCEPTS, ConceptId, Subject, conceptsForSubject, getConcept } from "./domain/concepts";
import { getMisconception } from "./domain/misconceptions";
import {
  Difficulty,
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
/** Every subject-scoped function below defaults to algebra when no subject is
 *  given, so every pre-existing caller (routes, tests) keeps working exactly
 *  as before without having to learn about subjects at all. */
const DEFAULT_SUBJECT: Subject = "algebra";

/**
 * Spaced review of already-mastered concepts, spaced by problems-answered-since
 * rather than calendar time — the standard spacing-effect research (see
 * RESEARCH/LEARNING_SCIENCE.md) is normally applied with day/week intervals, which
 * makes it real but undemoable within a single sitting. Counting *interactions*
 * instead of days is a legitimate reading of the same effect (spacing between
 * repetitions matters; that spacing doesn't have to be wall-clock time to work)
 * and means this can actually be watched happening live, not just cited.
 */
export const BASE_REVIEW_INTERVAL = 4;
export const MAX_REVIEW_INTERVAL = 40;

export interface ConceptMasteryRow {
  learner_id: string;
  concept_id: ConceptId;
  attempts: number;
  correct: number;
  streak: number;
  /** Bayesian Knowledge Tracing estimate of P(learner knows this concept), 0-1. See bkt.ts. */
  p_mastery: number;
  mastered: number;
  /** When `mastered` first flipped to 1 — see the comment in store.ts on why
   * this can't just be updated_at. Null until mastered. */
  mastered_at: number | null;
  /** Current spacing, in the learner's OWN total attempts (not calendar time) — see note above. */
  review_interval: number;
  /** This concept is due for spaced review once the learner's total attempt count reaches this. null = not yet scheduled (never mastered, or mastered before this feature existed). */
  due_after_attempts: number | null;
  updated_at: number;
}

export function getConceptMastery(learnerId: string, conceptId: ConceptId): ConceptMasteryRow {
  const row = store.raw.conceptMastery.find(
    (r) => r.learner_id === learnerId && r.concept_id === conceptId
  );
  // Some fields may be missing on a row written before BKT / spaced review were
  // added — default them rather than let a stale on-disk file produce NaN/undefined
  // through the update math.
  if (row) {
    return {
      ...row,
      p_mastery: row.p_mastery === undefined ? initialMastery() : row.p_mastery,
      review_interval: row.review_interval === undefined ? 0 : row.review_interval,
      due_after_attempts: row.due_after_attempts === undefined ? null : row.due_after_attempts,
      // A row mastered before this field existed has no way to know when —
      // treat as "always", i.e. never counted as "mastered during" any window.
      mastered_at: row.mastered_at === undefined ? null : row.mastered_at,
    };
  }
  return {
    learner_id: learnerId,
    concept_id: conceptId,
    attempts: 0,
    correct: 0,
    streak: 0,
    p_mastery: initialMastery(),
    mastered: 0,
    mastered_at: null,
    review_interval: 0,
    due_after_attempts: null,
    updated_at: Date.now(),
  };
}

function learnerTotalAttempts(learnerId: string): number {
  return store.raw.attempts.filter((a) => a.learner_id === learnerId).length;
}

/** The single most-overdue mastered concept within this subject, if any — see
 *  decideNextProblem. Subject-scoped so switching subjects doesn't surface a
 *  review problem from the OTHER subject out of context. */
function dueForReview(learnerId: string, subject: Subject): ConceptId | null {
  const total = learnerTotalAttempts(learnerId);
  const subjectIds = new Set(conceptsForSubject(subject).map((c) => c.id));
  const due = getAllMastery(learnerId)
    .filter(
      (m) =>
        subjectIds.has(m.concept_id) &&
        m.mastered === 1 &&
        m.due_after_attempts !== null &&
        total >= m.due_after_attempts
    )
    .sort((a, b) => (a.due_after_attempts as number) - (b.due_after_attempts as number));
  return due[0]?.concept_id ?? null;
}

export function getAllMastery(learnerId: string): ConceptMasteryRow[] {
  return CONCEPTS.map((c) => getConceptMastery(learnerId, c.id));
}

function isConceptMastered(learnerId: string, conceptId: ConceptId): boolean {
  return getConceptMastery(learnerId, conceptId).mastered === 1;
}

/** The concept the learner should currently be working toward within this
 *  subject, per that subject's own prerequisite chain. Subjects are
 *  independent frontiers (see concepts.ts) — mastering all of algebra is
 *  never a prerequisite for starting chemistry, or vice versa. */
export function frontierConcept(learnerId: string, subject: Subject = DEFAULT_SUBJECT): ConceptId | null {
  for (const concept of conceptsForSubject(subject)) {
    const prereqsMet = concept.prerequisites.every((p) => isConceptMastered(learnerId, p));
    if (prereqsMet && !isConceptMastered(learnerId, concept.id)) return concept.id;
  }
  return null; // everything in this subject mastered
}

/** Most recent misconception this learner hit that hasn't yet been resolved by
 *  a correct answer. `subject` is optional and, when given, only considers
 *  that subject's concepts — used by decideNextProblem so switching subjects
 *  doesn't surface the OTHER subject's unresolved misconception out of
 *  context. Left unfiltered (the default) for submit-answer's own use, which
 *  doesn't need subject-scoping since misconception ids are already globally
 *  unique across subjects — matching one already implies the same subject. */
function activeMisconception(
  learnerId: string,
  subject?: Subject
): { misconceptionId: string; conceptId: ConceptId } | null {
  const subjectIds = subject ? new Set(conceptsForSubject(subject).map((c) => c.id)) : null;
  const events = store.raw.misconceptionEvents
    .filter((e) => e.learner_id === learnerId && e.resolved === 0 && (!subjectIds || subjectIds.has(e.concept_id)))
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
 * problem. See "Catching the Correct Answer Trap" in ARCHITECTURE.md. `subject`
 * is optional — see activeMisconception's doc comment for why it's only
 * passed from decideNextProblem, not from submit-answer's own lookup.
 */
export function pendingConfirmation(
  learnerId: string,
  subject?: Subject
): { misconceptionId: string; conceptId: ConceptId; problemPrompt: string } | null {
  const subjectIds = subject ? new Set(conceptsForSubject(subject).map((c) => c.id)) : null;
  const row = store.raw.attempts
    .filter(
      (a) =>
        a.learner_id === learnerId &&
        a.confirmation_status === "pending" &&
        (!subjectIds || subjectIds.has(a.concept_id))
    )
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

function weakestReviewableConcept(learnerId: string, exclude: ConceptId, subject: Subject): ConceptId | null {
  const subjectIds = new Set(conceptsForSubject(subject).map((c) => c.id));
  const attempted = getAllMastery(learnerId).filter(
    (m) => m.attempts > 0 && m.concept_id !== exclude && subjectIds.has(m.concept_id)
  );
  if (attempted.length === 0) return null;
  attempted.sort((a, b) => a.correct / Math.max(a.attempts, 1) - b.correct / Math.max(b.attempts, 1));
  return attempted[0].concept_id;
}

/** Structured category for the "why this problem" reason — lets the UI give each type its own badge instead of parsing free text (see prompt.md §9 "not a black box"). */
export type ReasonType = "confirmation" | "retarget" | "review" | "spaced-review" | "frontier" | "done";

export interface NextProblemResult {
  done: boolean;
  problem?: ProblemInstance;
  /** Why this problem was chosen — surfaced in the UI so the personalization is visible, not a black box. */
  reason: string;
  reasonType: ReasonType;
}

const DIFFICULTY_EASY_CEILING = 0.5;
const DIFFICULTY_MEDIUM_CEILING = 0.85;

/**
 * Adaptive difficulty (prompt.md §7) — a concept's own current p_mastery
 * decides how hard its numbers are (problemEngine.ts's Difficulty), so a
 * learner three problems from mastering a concept sees meaningfully bigger
 * numbers than one just starting it, and an already-mastered concept's
 * spaced-review problems (p_mastery is always >= BKT_MASTERY_THRESHOLD by
 * the time they fire) are always the hardest tier — testing that mastery
 * holds up under harder numbers too, not just easier ones re-served forever.
 */
function difficultyForMastery(pMastery: number): Difficulty {
  if (pMastery < DIFFICULTY_EASY_CEILING) return "easy";
  if (pMastery < DIFFICULTY_MEDIUM_CEILING) return "medium";
  return "hard";
}

function difficultyForConcept(learnerId: string, conceptId: ConceptId): Difficulty {
  return difficultyForMastery(getConceptMastery(learnerId, conceptId).p_mastery);
}

/**
 * The mastery gate: decides what the learner sees next. This is where the
 * "two learners can get different experiences" behavior (prompt.md §9) actually
 * happens — the decision depends entirely on this learner's stored history.
 * `subject` defaults to algebra so every pre-existing caller keeps working
 * unchanged; the practice UI's subject switcher is what actually passes
 * "chemistry" through (see /api/next-problem).
 */
export function decideNextProblem(learnerId: string, subject: Subject = DEFAULT_SUBJECT): NextProblemResult {
  const pending = pendingConfirmation(learnerId, subject);
  if (pending) {
    return {
      done: false,
      problem: generateProblemForMisconception(
        pending.misconceptionId,
        difficultyForConcept(learnerId, pending.conceptId)
      ),
      reason: `Double-checking your last correct answer with a similar problem.`,
      reasonType: "confirmation",
    };
  }

  const active = activeMisconception(learnerId, subject);
  if (active) {
    return {
      done: false,
      problem: generateProblemForMisconception(
        active.misconceptionId,
        difficultyForConcept(learnerId, active.conceptId)
      ),
      reason: `Retargeting "${getMisconception(active.misconceptionId)?.name}" until resolved.`,
      reasonType: "retarget",
    };
  }

  // Checked before the "all mastered" exit below, on purpose — review is exactly
  // as relevant (more, arguably) once the curriculum is "done" as while still
  // working through it. See dueForReview / BASE_REVIEW_INTERVAL above.
  const due = dueForReview(learnerId, subject);
  if (due) {
    return {
      done: false,
      problem: generateProblem(due, difficultyForConcept(learnerId, due)),
      reason: `Spaced review: making sure ${getConcept(due).name} actually stuck.`,
      reasonType: "spaced-review",
    };
  }

  const frontier = frontierConcept(learnerId, subject);
  if (!frontier) {
    return { done: true, reason: `All ${subject} concepts mastered.`, reasonType: "done" };
  }

  if (Math.random() < INTERLEAVE_PROBABILITY) {
    const review = weakestReviewableConcept(learnerId, frontier, subject);
    if (review) {
      return {
        done: false,
        problem: generateProblem(review, difficultyForConcept(learnerId, review)),
        reason: `Interleaved review: ${getConcept(review).name} (your weakest reviewed concept).`,
        reasonType: "review",
      };
    }
  }

  return {
    done: false,
    problem: generateProblem(frontier, difficultyForConcept(learnerId, frontier)),
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
  /** Client-measured ms between the problem being shown and this submission —
   *  see useProblemTimer.ts. Undefined/omitted when the client didn't report one. */
  timeSpentMs?: number | null;
}

export function recordAttempt(input: RecordAttemptInput): void {
  const now = Date.now();
  const s = store.raw;

  const diagnosisSource: DiagnosisSource = input.diagnosisSource ?? null;
  // Captured before this attempt is pushed — "was this concept already due when
  // this problem was served" needs the count as of serving it, not after.
  const totalAttemptsBefore = learnerTotalAttempts(input.learnerId);

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
    time_spent_ms: input.timeSpentMs ?? null,
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

  // Spaced review scheduling — see BASE_REVIEW_INTERVAL's comment above for why
  // this counts problems, not calendar time.
  let reviewInterval = current.review_interval;
  let dueAfterAttempts = current.due_after_attempts;
  const justMastered = current.mastered === 0 && mastered === 1;
  const wasDueReview =
    current.mastered === 1 && current.due_after_attempts !== null && totalAttemptsBefore >= current.due_after_attempts;
  if (justMastered) {
    reviewInterval = BASE_REVIEW_INTERVAL;
    dueAfterAttempts = totalAttemptsBefore + 1 + reviewInterval;
  } else if (wasDueReview) {
    // Correct: retrieval succeeded, space it out further. Wrong: forgetting
    // caught, bring it back soon — same "growth on success, reset on miss"
    // shape as a real spaced-repetition scheduler (SM-2/Leitner family).
    reviewInterval = wasCorrect ? Math.min(reviewInterval * 2, MAX_REVIEW_INTERVAL) : BASE_REVIEW_INTERVAL;
    dueAfterAttempts = totalAttemptsBefore + 1 + reviewInterval;
  }

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
    mastered_at: justMastered ? now : current.mastered_at,
    review_interval: reviewInterval,
    due_after_attempts: dueAfterAttempts,
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
      // Latest occurrence wins, not "was it EVER resolved" — a misconception
      // that recurs after being fixed once needs to show as Active again, not
      // stuck showing Resolved from the earlier occurrence. This used to be
      // Math.max(existing.resolved, e.resolved), which stuck at 1 forever the
      // first time it was ever resolved, regardless of anything after.
      existing.resolved = e.resolved;
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export interface TimingInsight {
  type: "rushing";
  /** Median ms spent on wrong answers vs. correct ones, for this learner specifically —
   *  a personal baseline, not a fixed cutoff, since "fast" varies by person and problem. */
  medianWrongMs: number;
  medianCorrectMs: number;
  wrongCount: number;
  correctCount: number;
}

const TIMING_MIN_SAMPLE = 5;
// Wrong answers have to be meaningfully faster than correct ones, not just
// slightly — this is deliberately conservative for the same reason
// getCalibrationInsight's thresholds are: a false "you're rushing" callout
// for someone who just happens to solve some problems quickly is worse than
// occasionally missing a real instance.
const RUSHING_RATIO = 0.5;

/**
 * "Time spent" is one of the signals prompt.md's personalization section
 * calls out that nothing tracked before this feature — see useProblemTimer.ts
 * for how it's measured, and RESEARCH/LEARNING_SCIENCE.md #9/#10 for why
 * confidence calibration alone doesn't catch this: a learner can report
 * accurate confidence while still visibly rushing (answering wrong questions
 * much faster than their own correct ones), which is a distinct, actionable
 * "slow down and actually work through it" signal rather than a knowledge gap.
 * Compares this learner's OWN median time on wrong vs. correct answers (not a
 * fixed cutoff — what counts as "fast" varies enormously by person and by
 * problem), only among attempts that reported timing data at all.
 */
export function getTimingInsight(learnerId: string): TimingInsight | null {
  const timed = store.raw.attempts.filter(
    (a) => a.learner_id === learnerId && a.time_spent_ms !== null
  );
  const wrongTimes = timed.filter((a) => a.outcome !== "correct").map((a) => a.time_spent_ms as number);
  const correctTimes = timed.filter((a) => a.outcome === "correct").map((a) => a.time_spent_ms as number);

  if (wrongTimes.length < TIMING_MIN_SAMPLE || correctTimes.length < TIMING_MIN_SAMPLE) return null;

  const medianWrongMs = median(wrongTimes);
  const medianCorrectMs = median(correctTimes);
  if (medianCorrectMs > 0 && medianWrongMs <= medianCorrectMs * RUSHING_RATIO) {
    return { type: "rushing", medianWrongMs, medianCorrectMs, wrongCount: wrongTimes.length, correctCount: correctTimes.length };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Export / import — this app deliberately has no accounts (prompt.md §19):
// progress lives only in one
// browser's localStorage-derived learner id. That's a real, previously
// unaddressed downside of that design — clear cookies, switch devices, or
// lose localStorage, and the learner model is gone with no recovery path.
// This doesn't add accounts; it gives the learner a portable backup of their
// own data, in their own hands, consistent with collecting no more than the
// minimum needed.
// ---------------------------------------------------------------------------

export interface LearnerExport {
  exportedAt: number;
  learnerId: string;
  conceptMastery: ConceptMasteryRow[];
  misconceptionEvents: Omit<MisconceptionEventRow, "id" | "learner_id">[];
  attempts: Omit<AttemptRow, "id" | "learner_id">[];
  spotMistakeAttempts: Omit<SpotMistakeAttemptRow, "id" | "learner_id">[];
}

export function exportLearnerData(learnerId: string): LearnerExport {
  const s = store.raw;
  return {
    exportedAt: Date.now(),
    learnerId,
    conceptMastery: s.conceptMastery.filter((r) => r.learner_id === learnerId),
    misconceptionEvents: s.misconceptionEvents
      .filter((r) => r.learner_id === learnerId)
      .map((r) => ({
        misconception_id: r.misconception_id,
        concept_id: r.concept_id,
        problem_prompt: r.problem_prompt,
        learner_answer: r.learner_answer,
        resolved: r.resolved,
        created_at: r.created_at,
        diagnosis_source: r.diagnosis_source,
      })),
    attempts: s.attempts
      .filter((r) => r.learner_id === learnerId)
      .map((r) => ({
        concept_id: r.concept_id,
        misconception_id: r.misconception_id,
        outcome: r.outcome,
        confidence_before: r.confidence_before,
        hint_level_used: r.hint_level_used,
        created_at: r.created_at,
        diagnosis_source: r.diagnosis_source,
        confirmation_status: r.confirmation_status,
        problem_prompt: r.problem_prompt,
        time_spent_ms: r.time_spent_ms,
      })),
    spotMistakeAttempts: s.spotMistakeAttempts
      .filter((r) => r.learner_id === learnerId)
      .map((r) => ({
        misconception_id: r.misconception_id,
        concept_id: r.concept_id,
        correct: r.correct,
        created_at: r.created_at,
      })),
  };
}

export interface LearnerImportData {
  // mastered_at is optional here specifically so a backup exported before
  // this field existed can still be re-imported — see the matching comment
  // on importConceptMasteryRowSchema in validation.ts.
  conceptMastery: (Omit<ConceptMasteryRow, "learner_id" | "mastered_at"> & { mastered_at?: number | null })[];
  misconceptionEvents: Omit<MisconceptionEventRow, "id" | "learner_id">[];
  // time_spent_ms optional for the same "don't break old backups" reason as
  // mastered_at above — see importAttemptRowSchema in validation.ts.
  attempts: (Omit<AttemptRow, "id" | "learner_id" | "time_spent_ms"> & { time_spent_ms?: number | null })[];
  spotMistakeAttempts?: Omit<SpotMistakeAttemptRow, "id" | "learner_id">[];
}

/** Clean replace, not merge, for the target learner id — same shape as
 * store.resetLearner, just followed by writing the imported rows back in
 * under fresh ids so they can't collide with anything already in the store. */
export function importLearnerData(targetLearnerId: string, data: LearnerImportData): void {
  const s = store.raw;
  s.conceptMastery = s.conceptMastery.filter((r) => r.learner_id !== targetLearnerId);
  s.misconceptionEvents = s.misconceptionEvents.filter((r) => r.learner_id !== targetLearnerId);
  s.attempts = s.attempts.filter((r) => r.learner_id !== targetLearnerId);
  s.spotMistakeAttempts = s.spotMistakeAttempts.filter((r) => r.learner_id !== targetLearnerId);

  for (const row of data.conceptMastery) {
    s.conceptMastery.push({ ...row, learner_id: targetLearnerId, mastered_at: row.mastered_at ?? null });
  }
  for (const row of data.misconceptionEvents) {
    s.misconceptionEvents.push({ ...row, id: s.nextEventId++, learner_id: targetLearnerId });
  }
  for (const row of data.attempts) {
    s.attempts.push({
      ...row,
      id: s.nextAttemptId++,
      learner_id: targetLearnerId,
      time_spent_ms: row.time_spent_ms ?? null,
    });
  }
  for (const row of data.spotMistakeAttempts ?? []) {
    s.spotMistakeAttempts.push({ ...row, id: s.nextSpotMistakeId++, learner_id: targetLearnerId });
  }
  store.save();
}

// ---------------------------------------------------------------------------
// Spot the Mistake stats — kept in its own table, separate from BKT/mastery
// on purpose (see src/app/spot-the-mistake/page.tsx and its API routes):
// diagnosing someone else's mistake is a different skill from solving a
// problem yourself, and folding it into p_mastery would conflate two
// different signals without real justification. This just persists what was
// previously ephemeral React state, so it survives a refresh and is visible
// on the dashboard, without touching the mastery gate at all.
// ---------------------------------------------------------------------------

export function recordSpotMistakeAttempt(params: {
  learnerId: string;
  misconceptionId: string;
  conceptId: ConceptId;
  correct: boolean;
}): void {
  const s = store.raw;
  s.spotMistakeAttempts.push({
    id: s.nextSpotMistakeId++,
    learner_id: params.learnerId,
    misconception_id: params.misconceptionId,
    concept_id: params.conceptId,
    correct: params.correct ? 1 : 0,
    created_at: Date.now(),
  });
  store.save();
}

export interface SpotMistakeStats {
  attempted: number;
  caught: number;
}

export function getSpotMistakeStats(learnerId: string): SpotMistakeStats {
  const rows = store.raw.spotMistakeAttempts.filter((r) => r.learner_id === learnerId);
  return { attempted: rows.length, caught: rows.filter((r) => r.correct === 1).length };
}

// ---------------------------------------------------------------------------
// Session summary — a closing-loop moment, not a new persisted concept. "This
// session" is defined purely client-side (sessionStorage, cleared when the tab
// closes — see useSessionStart.ts) and passed in as a timestamp; this just
// answers "what happened since then" from data that already exists. No new
// storage, no new event type — every other feature here just gets windowed by
// time after the fact.
// ---------------------------------------------------------------------------

export interface SessionSummary {
  attempts: number;
  correct: number;
  /** Distinct misconceptions actually diagnosed in this window, most recent first. */
  misconceptionNames: string[];
  confirmed: number;
  caught: number;
  conceptsMasteredNow: string[];
}

export function getSessionSummary(learnerId: string, sinceTimestamp: number): SessionSummary {
  const attempts = store.raw.attempts.filter((a) => a.learner_id === learnerId && a.created_at >= sinceTimestamp);
  const correct = attempts.filter((a) => a.outcome === "correct").length;

  const misconceptionIds = Array.from(
    new Set(
      attempts
        .slice()
        .reverse()
        .filter((a) => a.misconception_id)
        .map((a) => a.misconception_id as string)
    )
  );
  const misconceptionNames = misconceptionIds
    .map((id) => getMisconception(id)?.name)
    .filter((n): n is string => Boolean(n));

  const confirmed = attempts.filter((a) => a.confirmation_status === "confirmed").length;
  const caught = attempts.filter((a) => a.confirmation_status === "caught").length;

  const conceptsMasteredNow = getAllMastery(learnerId)
    .filter((m) => m.mastered_at !== null && m.mastered_at >= sinceTimestamp)
    .map((m) => getConcept(m.concept_id).name);

  return { attempts: attempts.length, correct, misconceptionNames, confirmed, caught, conceptsMasteredNow };
}

