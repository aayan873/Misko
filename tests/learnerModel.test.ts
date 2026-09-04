import { describe, it, expect, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

// Isolate the store from real dev data before importing anything that touches it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "misko-test-"));
process.env.MISKO_DATA_DIR = tmpDir;

const { store } = await import("../src/lib/store");
const {
  decideNextProblem,
  recordAttempt,
  frontierConcept,
  getConceptMastery,
  pendingConfirmation,
  resolvePendingConfirmation,
  getConfirmationStats,
  lastMisconceptionOnConcept,
  getMisconceptionHistory,
  getCalibrationInsight,
  getClassMisconceptionSummary,
  getAtRiskLearners,
  getClassRoster,
  MASTERY_MIN_ATTEMPTS,
  BASE_REVIEW_INTERVAL,
  MAX_REVIEW_INTERVAL,
} = await import("../src/lib/learnerModel");
const { initialMastery, updateMastery, BKT_MASTERY_THRESHOLD } = await import("../src/lib/bkt");

function learnerId(name: string) {
  return name; // ids don't need to be real UUIDs for internal store tests
}

/** How many consecutive correct answers it takes BKT to cross the mastery threshold — computed from the actual math, not hardcoded, so this stays correct if the BKT params ever change. */
function attemptsToCrossThreshold(): number {
  let p = initialMastery();
  let n = 0;
  while (p < BKT_MASTERY_THRESHOLD) {
    p = updateMastery(p, true);
    n++;
  }
  return n;
}

beforeEach(() => {
  store._resetForTests();
});

describe("mastery gate", () => {
  it("does not mark a concept mastered before enough correct answers to cross the BKT threshold", () => {
    const id = learnerId("l1");
    const short = attemptsToCrossThreshold() - 1;
    for (let i = 0; i < short; i++) {
      recordAttempt({
        learnerId: id,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "correct",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "x",
      });
    }
    expect(getConceptMastery(id, "order-of-operations").mastered).toBe(0);
  });

  it("marks a concept mastered once BKT's P(knows) crosses the threshold (min attempts met)", () => {
    const id = learnerId("l2");
    const needed = Math.max(attemptsToCrossThreshold(), MASTERY_MIN_ATTEMPTS);
    for (let i = 0; i < needed; i++) {
      recordAttempt({
        learnerId: id,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "correct",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "x",
      });
    }
    const row = getConceptMastery(id, "order-of-operations");
    expect(row.mastered).toBe(1);
    expect(row.p_mastery).toBeGreaterThanOrEqual(BKT_MASTERY_THRESHOLD);
  });

  it("a single wrong answer after mastery lowers p_mastery but does not revoke mastered (sticky)", () => {
    const id = learnerId("l-sticky");
    const needed = Math.max(attemptsToCrossThreshold(), MASTERY_MIN_ATTEMPTS);
    for (let i = 0; i < needed; i++) {
      recordAttempt({
        learnerId: id,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "correct",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "x",
      });
    }
    const pBefore = getConceptMastery(id, "order-of-operations").p_mastery;

    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });

    const row = getConceptMastery(id, "order-of-operations");
    expect(row.p_mastery).toBeLessThan(pBefore);
    expect(row.mastered).toBe(1);
  });

  it("resets the streak on a wrong answer", () => {
    const id = learnerId("l3");
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "x",
    });
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });
    expect(getConceptMastery(id, "order-of-operations").streak).toBe(0);
  });

  it("does not advance the frontier concept until prerequisites are mastered", () => {
    const id = learnerId("l4");
    expect(frontierConcept(id)).toBe("order-of-operations");
    for (let i = 0; i < Math.max(attemptsToCrossThreshold(), MASTERY_MIN_ATTEMPTS); i++) {
      recordAttempt({
        learnerId: id,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "correct",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "x",
      });
    }
    expect(frontierConcept(id)).toBe("negative-numbers");
  });

  it("re-targets an unresolved misconception on the next problem instead of moving on", () => {
    const id = learnerId("l5");
    recordAttempt({
      learnerId: id,
      conceptId: "negative-numbers",
      misconceptionId: "NEG_MULT_SIGN",
      outcome: "matched_misconception",
      confidenceBefore: 2,
      hintLevelUsed: 1,
      problemPrompt: "(-3) x (-4)",
      learnerAnswer: "-12",
    });
    const next = decideNextProblem(id);
    expect(next.done).toBe(false);
    expect(next.problem?.targetMisconceptionId).toBe("NEG_MULT_SIGN");
    expect(next.reason.length).toBeGreaterThan(0);
  });

  it("resolves an open misconception event once the learner answers that concept correctly again", () => {
    const id = learnerId("l6");
    recordAttempt({
      learnerId: id,
      conceptId: "negative-numbers",
      misconceptionId: "NEG_MULT_SIGN",
      outcome: "matched_misconception",
      confidenceBefore: 2,
      hintLevelUsed: 1,
      problemPrompt: "(-3) x (-4)",
      learnerAnswer: "-12",
    });
    expect(decideNextProblem(id).problem?.targetMisconceptionId).toBe("NEG_MULT_SIGN");

    recordAttempt({
      learnerId: id,
      conceptId: "negative-numbers",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "(-3) x (-4)",
      learnerAnswer: "12",
    });
    // No longer retargeted — should fall through to frontier/interleave logic.
    // (Not asserting on which misconception the resulting problem happens to target:
    // generateProblem() picks randomly among a concept's generators, so it could
    // coincidentally re-pick NEG_MULT_SIGN by chance even when not being retargeted.
    // The actual behavior under test is the *reason*, not the random problem content.)
    const next = decideNextProblem(id);
    expect(next.reason).not.toContain("Retargeting");
  });
});

describe("catching the Correct Answer Trap (pending confirmation)", () => {
  it("has no pending confirmation for a learner with no history", () => {
    const id = learnerId("trap1");
    expect(pendingConfirmation(id)).toBeNull();
  });

  it("a correct answer with confirmationStatus 'pending' surfaces as a pending confirmation", () => {
    const id = learnerId("trap2");
    recordAttempt({
      learnerId: id,
      conceptId: "combining-like-terms",
      misconceptionId: "CLT_EXPONENT_ADD",
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "4x^2 + 3x^2",
      learnerAnswer: "7x^2",
      confirmationStatus: "pending",
    });
    const pending = pendingConfirmation(id);
    expect(pending).not.toBeNull();
    expect(pending?.conceptId).toBe("combining-like-terms");
    expect(pending?.problemPrompt).toBe("4x^2 + 3x^2");
  });

  it("decideNextProblem prioritizes a pending confirmation over the frontier concept", () => {
    const id = learnerId("trap3");
    // Give the learner an unrelated open misconception too — pending confirmation
    // should still win over even the "active misconception" retargeting tier.
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 2,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });
    recordAttempt({
      learnerId: id,
      conceptId: "combining-like-terms",
      misconceptionId: "CLT_EXPONENT_ADD",
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "4x^2 + 3x^2",
      learnerAnswer: "7x^2",
      confirmationStatus: "pending",
    });

    const next = decideNextProblem(id);
    expect(next.reason).toContain("Double-checking");
    expect(next.reasonType).toBe("confirmation");
    expect(next.problem?.targetMisconceptionId).toBe("CLT_EXPONENT_ADD");
  });

  it("resolvePendingConfirmation('confirmed') clears the pending state and counts toward stats", () => {
    const id = learnerId("trap4");
    recordAttempt({
      learnerId: id,
      conceptId: "combining-like-terms",
      misconceptionId: "CLT_EXPONENT_ADD",
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "4x^2 + 3x^2",
      learnerAnswer: "7x^2",
      confirmationStatus: "pending",
    });
    expect(pendingConfirmation(id)).not.toBeNull();

    resolvePendingConfirmation(id, "confirmed");

    expect(pendingConfirmation(id)).toBeNull();
    const stats = getConfirmationStats(id);
    expect(stats).toEqual({ confirmed: 1, caught: 0, checked: 1 });
  });

  it("resolvePendingConfirmation('caught') clears the pending state and counts toward stats", () => {
    const id = learnerId("trap5");
    recordAttempt({
      learnerId: id,
      conceptId: "combining-like-terms",
      misconceptionId: "CLT_EXPONENT_ADD",
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "4x^2 + 3x^2",
      learnerAnswer: "7x^2",
      confirmationStatus: "pending",
    });

    resolvePendingConfirmation(id, "caught");

    expect(pendingConfirmation(id)).toBeNull();
    const stats = getConfirmationStats(id);
    expect(stats).toEqual({ confirmed: 0, caught: 1, checked: 1 });
  });

  it("resolvePendingConfirmation is a no-op when nothing is pending", () => {
    const id = learnerId("trap6");
    expect(() => resolvePendingConfirmation(id, "confirmed")).not.toThrow();
    expect(getConfirmationStats(id)).toEqual({ confirmed: 0, caught: 0, checked: 0 });
  });
});

describe("lastMisconceptionOnConcept (deterministic confirmation trigger, no AI required)", () => {
  it("returns null for a learner with no history on the concept", () => {
    const id = learnerId("trigger1");
    expect(lastMisconceptionOnConcept(id, "order-of-operations")).toBeNull();
  });

  it("returns the misconception id when the most recent attempt on the concept matched one", () => {
    const id = learnerId("trigger2");
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "8 + 5 x 9",
      learnerAnswer: "117",
    });
    expect(lastMisconceptionOnConcept(id, "order-of-operations")).toBe("ORDER_LEFT_TO_RIGHT");
  });

  it("returns null once a later correct attempt on the concept supersedes the slip", () => {
    const id = learnerId("trigger3");
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "8 + 5 x 9",
      learnerAnswer: "117",
    });
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "6 + 7 x 9",
      learnerAnswer: "69",
    });
    // The most recent attempt is now the correct one — no fresh slip to double-check.
    expect(lastMisconceptionOnConcept(id, "order-of-operations")).toBeNull();
  });

  it("is scoped per concept — a slip on one concept doesn't trigger on another", () => {
    const id = learnerId("trigger4");
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "8 + 5 x 9",
      learnerAnswer: "117",
    });
    expect(lastMisconceptionOnConcept(id, "combining-like-terms")).toBeNull();
  });

  it("returns null when the most recent attempt was unrecognized (no specific misconception matched)", () => {
    const id = learnerId("trigger5");
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "unrecognized",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "8 + 5 x 9",
      learnerAnswer: "42",
    });
    expect(lastMisconceptionOnConcept(id, "order-of-operations")).toBeNull();
  });
});

describe("getMisconceptionHistory", () => {
  it("groups repeated occurrences of the same misconception and counts them", () => {
    const id = learnerId("hist1");
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "a",
      learnerAnswer: "x",
      diagnosisSource: "rule",
    });
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "b",
      learnerAnswer: "y",
      diagnosisSource: "ai",
    });

    const history = getMisconceptionHistory(id);
    expect(history).toHaveLength(1);
    expect(history[0].occurrences).toBe(2);
    // The most recent occurrence's diagnosis_source wins, not the first.
    expect(history[0].diagnosis_source).toBe("ai");
  });

  it("orders distinct misconceptions by recency even when timestamps tie (uses event id, not created_at)", () => {
    const id = learnerId("hist2");
    // Two back-to-back synchronous calls can share the same Date.now() millisecond
    // — this is exactly the race that made "most recent" ambiguous before the fix.
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "a",
      learnerAnswer: "x",
    });
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_EXPONENT_LAST",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "b",
      learnerAnswer: "y",
    });

    const history = getMisconceptionHistory(id);
    expect(history).toHaveLength(2);
    // ORDER_EXPONENT_LAST was recorded second, so it must sort first regardless
    // of whether its timestamp actually differs from the first event's.
    expect(history[0].misconception_id).toBe("ORDER_EXPONENT_LAST");
    expect(history[1].misconception_id).toBe("ORDER_LEFT_TO_RIGHT");
  });

  it("returns an empty array for a learner with no misconception history", () => {
    expect(getMisconceptionHistory(learnerId("hist3"))).toEqual([]);
  });
});

describe("getCalibrationInsight", () => {
  function record(id: string, confidenceBefore: number, correct: boolean) {
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: correct ? "correct" : "unrecognized",
      confidenceBefore,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });
  }

  it("returns null with no history", () => {
    expect(getCalibrationInsight(learnerId("cal1"))).toBeNull();
  });

  it("returns null below the minimum sample size even if every high-confidence answer is wrong", () => {
    const id = learnerId("cal2");
    for (let i = 0; i < 4; i++) record(id, 5, false);
    expect(getCalibrationInsight(id)).toBeNull();
  });

  it("flags overconfident: high confidence, mostly wrong, enough samples", () => {
    const id = learnerId("cal3");
    for (let i = 0; i < 4; i++) record(id, 5, false);
    record(id, 4, true);
    const insight = getCalibrationInsight(id);
    expect(insight).not.toBeNull();
    expect(insight?.type).toBe("overconfident");
    expect(insight?.count).toBe(5);
    expect(insight?.accuracy).toBeCloseTo(0.2);
  });

  it("flags underconfident: low confidence, mostly right, enough samples", () => {
    const id = learnerId("cal4");
    for (let i = 0; i < 5; i++) record(id, 1, true);
    const insight = getCalibrationInsight(id);
    expect(insight).not.toBeNull();
    expect(insight?.type).toBe("underconfident");
    expect(insight?.count).toBe(5);
    expect(insight?.accuracy).toBe(1);
  });

  it("returns null for a well-calibrated learner", () => {
    const id = learnerId("cal5");
    for (let i = 0; i < 3; i++) record(id, 5, true);
    for (let i = 0; i < 2; i++) record(id, 5, false);
    for (let i = 0; i < 3; i++) record(id, 1, false);
    for (let i = 0; i < 2; i++) record(id, 1, true);
    expect(getCalibrationInsight(id)).toBeNull();
  });
});

describe("class-wide (teacher-facing) aggregation", () => {
  it("getClassMisconceptionSummary ranks by distinct learners before raw count", () => {
    const a = learnerId("class-a");
    const b = learnerId("class-b");
    const c = learnerId("class-c");

    // Two different learners hit ORDER_LEFT_TO_RIGHT once each...
    for (const id of [a, b]) {
      recordAttempt({
        learnerId: id,
        conceptId: "order-of-operations",
        misconceptionId: "ORDER_LEFT_TO_RIGHT",
        outcome: "matched_misconception",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "y",
      });
    }
    // ...while a single learner hits ORDER_EXPONENT_LAST five times.
    for (let i = 0; i < 5; i++) {
      recordAttempt({
        learnerId: c,
        conceptId: "order-of-operations",
        misconceptionId: "ORDER_EXPONENT_LAST",
        outcome: "matched_misconception",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "y",
      });
    }

    const summary = getClassMisconceptionSummary();
    expect(summary[0].misconceptionId).toBe("ORDER_LEFT_TO_RIGHT");
    expect(summary[0].distinctLearners).toBe(2);
    expect(summary[1].misconceptionId).toBe("ORDER_EXPONENT_LAST");
    expect(summary[1].distinctLearners).toBe(1);
    expect(summary[1].totalOccurrences).toBe(5);
  });

  it("getAtRiskLearners flags overconfidence and stuck-ness with distinct reasons, and skips fine learners", () => {
    const overconfident = learnerId("risk-overconfident");
    for (let i = 0; i < 5; i++) {
      recordAttempt({
        learnerId: overconfident,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "unrecognized",
        confidenceBefore: 5,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "y",
      });
    }

    const stuck = learnerId("risk-stuck");
    // Comfortably above STUCK_MIN_ATTEMPTS (6) in learnerModel.ts, all wrong so
    // p_mastery stays well under STUCK_MAX_MASTERY (0.4).
    for (let i = 0; i < 8; i++) {
      recordAttempt({
        learnerId: stuck,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "unrecognized",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "y",
      });
    }

    const fine = learnerId("risk-fine");
    recordAttempt({
      learnerId: fine,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });

    const atRisk = getAtRiskLearners();
    const byId = new Map(atRisk.map((r) => [r.learnerId, r]));

    expect(byId.get(overconfident)?.reason).toBe("overconfident");
    expect(byId.get(stuck)?.reason).toBe("stuck");
    expect(byId.has(fine)).toBe(false);
  });

  it("getClassRoster aggregates attempts and mastered-concept count per learner", () => {
    const id = learnerId("roster-1");
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "unrecognized",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });

    const roster = getClassRoster();
    const entry = roster.find((r) => r.learnerId === id);
    expect(entry?.totalAttempts).toBe(2);
    expect(entry?.conceptsMastered).toBe(0);
  });
});

describe("spaced review scheduling", () => {
  function correctOn(id: string, conceptId: "order-of-operations" | "negative-numbers") {
    recordAttempt({
      learnerId: id,
      conceptId,
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });
  }

  it("schedules a review only once a concept is actually mastered", () => {
    const id = learnerId("sr1");
    correctOn(id, "order-of-operations");
    expect(getConceptMastery(id, "order-of-operations").due_after_attempts).toBeNull();
  });

  it("is not due immediately after mastering — needs BASE_REVIEW_INTERVAL more attempts first", () => {
    const id = learnerId("sr2");
    for (let i = 0; i < MASTERY_MIN_ATTEMPTS; i++) correctOn(id, "order-of-operations");
    expect(getConceptMastery(id, "order-of-operations").mastered).toBe(1);
    expect(decideNextProblem(id).reasonType).not.toBe("spaced-review");
  });

  it("becomes due after BASE_REVIEW_INTERVAL more attempts on other concepts, and decideNextProblem serves it ahead of frontier", () => {
    const id = learnerId("sr3");
    for (let i = 0; i < MASTERY_MIN_ATTEMPTS; i++) correctOn(id, "order-of-operations");
    for (let i = 0; i < BASE_REVIEW_INTERVAL; i++) correctOn(id, "negative-numbers");

    const next = decideNextProblem(id);
    expect(next.reasonType).toBe("spaced-review");
    expect(next.problem?.conceptId).toBe("order-of-operations");
  });

  it("answering a due review correctly doubles the interval (capped at MAX_REVIEW_INTERVAL)", () => {
    const id = learnerId("sr4");
    for (let i = 0; i < MASTERY_MIN_ATTEMPTS; i++) correctOn(id, "order-of-operations");
    for (let i = 0; i < BASE_REVIEW_INTERVAL; i++) correctOn(id, "negative-numbers");
    expect(decideNextProblem(id).reasonType).toBe("spaced-review");

    correctOn(id, "order-of-operations"); // answers the due review correctly
    const row = getConceptMastery(id, "order-of-operations");
    expect(row.review_interval).toBe(Math.min(BASE_REVIEW_INTERVAL * 2, MAX_REVIEW_INTERVAL));
    // Not due again immediately — the interval actually grew.
    expect(decideNextProblem(id).reasonType).not.toBe("spaced-review");
  });

  it("answering a due review incorrectly resets the interval instead of growing it", () => {
    const id = learnerId("sr5");
    for (let i = 0; i < MASTERY_MIN_ATTEMPTS; i++) correctOn(id, "order-of-operations");
    for (let i = 0; i < BASE_REVIEW_INTERVAL; i++) correctOn(id, "negative-numbers");
    expect(decideNextProblem(id).reasonType).toBe("spaced-review");

    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "unrecognized",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });

    const row = getConceptMastery(id, "order-of-operations");
    expect(row.review_interval).toBe(BASE_REVIEW_INTERVAL);
    // Still marked mastered (sticky) even though the review was missed.
    expect(row.mastered).toBe(1);
  });
});
