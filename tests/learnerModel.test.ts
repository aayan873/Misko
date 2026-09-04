import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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
  getAllMastery,
  pendingConfirmation,
  resolvePendingConfirmation,
  getConfirmationStats,
  lastMisconceptionOnConcept,
  getMisconceptionHistory,
  getCalibrationInsight,
  getTimingInsight,
  getClassMisconceptionSummary,
  getAtRiskLearners,
  getClassRoster,
  exportLearnerData,
  importLearnerData,
  recordSpotMistakeAttempt,
  getSpotMistakeStats,
  getSessionSummary,
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

  it("shows Active again (resolved: 0) when a fixed misconception recurs later — not stuck as Resolved forever", () => {
    const id = learnerId("hist-recur");
    // 1. Wrong: misconception raised, unresolved.
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "p1",
      learnerAnswer: "x",
    });
    // 2. Correct: resolves it.
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "p2",
      learnerAnswer: "y",
    });
    expect(getMisconceptionHistory(id)[0].resolved).toBe(1);

    // 3. The exact same mistake recurs — a fresh, unresolved occurrence.
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "p3",
      learnerAnswer: "x",
    });

    const history = getMisconceptionHistory(id);
    expect(history).toHaveLength(1);
    expect(history[0].occurrences).toBe(2);
    // Must reflect the LATEST occurrence, not "was it ever resolved" — this
    // was previously stuck at resolved:1 forever via Math.max.
    expect(history[0].resolved).toBe(0);
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

describe("getTimingInsight", () => {
  function record(id: string, correct: boolean, timeSpentMs: number | null) {
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: correct ? "correct" : "unrecognized",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
      timeSpentMs,
    });
  }

  it("returns null with no history", () => {
    expect(getTimingInsight(learnerId("time1"))).toBeNull();
  });

  it("returns null below the minimum sample size on either side, even with a huge gap", () => {
    const id = learnerId("time2");
    for (let i = 0; i < 4; i++) record(id, false, 1000); // only 4 wrong, needs 5
    for (let i = 0; i < 5; i++) record(id, true, 20000);
    expect(getTimingInsight(id)).toBeNull();
  });

  it("flags rushing: wrong answers land at or under half the median time of correct ones", () => {
    const id = learnerId("time3");
    for (let i = 0; i < 5; i++) record(id, false, 2000); // 2s each, wrong
    for (let i = 0; i < 5; i++) record(id, true, 10000); // 10s each, correct
    const insight = getTimingInsight(id);
    expect(insight).not.toBeNull();
    expect(insight?.type).toBe("rushing");
    expect(insight?.medianWrongMs).toBe(2000);
    expect(insight?.medianCorrectMs).toBe(10000);
    expect(insight?.wrongCount).toBe(5);
    expect(insight?.correctCount).toBe(5);
  });

  it("returns null when wrong answers are only slightly faster, not enough to flag", () => {
    const id = learnerId("time4");
    for (let i = 0; i < 5; i++) record(id, false, 8000); // 8s
    for (let i = 0; i < 5; i++) record(id, true, 10000); // 10s — ratio 0.8, above the 0.5 cutoff
    expect(getTimingInsight(id)).toBeNull();
  });

  it("ignores attempts with no reported timing data entirely", () => {
    const id = learnerId("time5");
    for (let i = 0; i < 5; i++) record(id, false, null);
    for (let i = 0; i < 5; i++) record(id, true, null);
    expect(getTimingInsight(id)).toBeNull();
  });

  it("mixes timed and untimed attempts correctly — only the timed ones count toward the sample", () => {
    const id = learnerId("time6");
    for (let i = 0; i < 5; i++) record(id, false, 2000);
    for (let i = 0; i < 3; i++) record(id, false, null); // shouldn't count
    for (let i = 0; i < 5; i++) record(id, true, 10000);
    const insight = getTimingInsight(id);
    expect(insight?.wrongCount).toBe(5);
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

describe("export / import", () => {
  it("exports only the given learner's rows, with id and learner_id stripped from event/attempt rows", () => {
    const a = learnerId("exp-a");
    const other = learnerId("exp-other");
    recordAttempt({
      learnerId: a,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
      diagnosisSource: "rule",
    });
    recordAttempt({
      learnerId: other,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "z",
      learnerAnswer: "w",
    });

    const exported = exportLearnerData(a);
    expect(exported.learnerId).toBe(a);
    expect(exported.attempts).toHaveLength(1);
    expect(exported.misconceptionEvents).toHaveLength(1);
    expect("id" in exported.attempts[0]).toBe(false);
    expect("learner_id" in exported.attempts[0]).toBe(false);
    expect("id" in exported.misconceptionEvents[0]).toBe(false);
  });

  it("round-trips: importing a learner's export into a different id reproduces the same state", () => {
    const source = learnerId("exp-src");
    recordAttempt({
      learnerId: source,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "8 + 5 x 9",
      learnerAnswer: "117",
      diagnosisSource: "rule",
    });
    recordAttempt({
      learnerId: source,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "6 + 7 x 9",
      learnerAnswer: "69",
    });
    recordSpotMistakeAttempt({
      learnerId: source,
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      conceptId: "order-of-operations",
      correct: true,
    });

    const exported = exportLearnerData(source);
    const target = learnerId("exp-target");
    importLearnerData(target, {
      conceptMastery: exported.conceptMastery,
      misconceptionEvents: exported.misconceptionEvents,
      attempts: exported.attempts,
      spotMistakeAttempts: exported.spotMistakeAttempts,
    });

    const sourceMastery = getConceptMastery(source, "order-of-operations");
    const targetMastery = getConceptMastery(target, "order-of-operations");
    expect(targetMastery.attempts).toBe(sourceMastery.attempts);
    expect(targetMastery.correct).toBe(sourceMastery.correct);
    expect(targetMastery.p_mastery).toBe(sourceMastery.p_mastery);
    expect(getMisconceptionHistory(target)).toHaveLength(1);
    expect(getMisconceptionHistory(target)[0].misconception_id).toBe("ORDER_LEFT_TO_RIGHT");
    expect(getSpotMistakeStats(target)).toEqual(getSpotMistakeStats(source));
    expect(getSpotMistakeStats(target)).toEqual({ attempted: 1, caught: 1 });

    // The original learner is untouched by exporting/importing from it.
    expect(getConceptMastery(source, "order-of-operations").attempts).toBe(2);
  });

  it("round-trips time_spent_ms, and defaults it to null for a pre-existing backup that never had the field", () => {
    const source = learnerId("exp-timing-src");
    recordAttempt({
      learnerId: source,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
      timeSpentMs: 4321,
    });
    const exported = exportLearnerData(source);
    expect(exported.attempts[0].time_spent_ms).toBe(4321);

    const target = learnerId("exp-timing-target");
    importLearnerData(target, {
      conceptMastery: exported.conceptMastery,
      misconceptionEvents: exported.misconceptionEvents,
      attempts: exported.attempts,
    });
    expect(exportLearnerData(target).attempts[0].time_spent_ms).toBe(4321);

    // An old-style backup, authored before this field existed at all.
    const oldStyleTarget = learnerId("exp-timing-old-backup");
    importLearnerData(oldStyleTarget, {
      conceptMastery: [],
      misconceptionEvents: [],
      attempts: [
        {
          concept_id: "order-of-operations",
          misconception_id: null,
          outcome: "correct",
          confidence_before: 3,
          hint_level_used: 1,
          created_at: Date.now(),
          diagnosis_source: null,
          confirmation_status: "none",
          problem_prompt: "old backup, no time_spent_ms field at all",
          // time_spent_ms omitted on purpose
        },
      ],
    });
    expect(exportLearnerData(oldStyleTarget).attempts[0].time_spent_ms).toBeNull();
  });

  it("import is a clean replace, not a merge — old data for the target id is gone afterward", () => {
    const target = learnerId("exp-replace");
    recordAttempt({
      learnerId: target,
      conceptId: "negative-numbers",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "old data",
      learnerAnswer: "y",
    });
    expect(getConceptMastery(target, "negative-numbers").attempts).toBe(1);

    importLearnerData(target, { conceptMastery: [], misconceptionEvents: [], attempts: [] });

    expect(getConceptMastery(target, "negative-numbers").attempts).toBe(0);
    expect(getAllMastery(target).every((m) => m.attempts === 0)).toBe(true);
  });

  it("imported rows get fresh ids that don't collide with subsequent new attempts", () => {
    const source = learnerId("exp-ids-src");
    for (let i = 0; i < 3; i++) {
      recordAttempt({
        learnerId: source,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "correct",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "x",
        learnerAnswer: "y",
      });
    }
    const exported = exportLearnerData(source);
    const target = learnerId("exp-ids-target");
    importLearnerData(target, {
      conceptMastery: exported.conceptMastery,
      misconceptionEvents: exported.misconceptionEvents,
      attempts: exported.attempts,
    });

    // A brand new attempt for an unrelated learner afterward must not collide
    // with (or be confused for) anything just imported.
    recordAttempt({
      learnerId: learnerId("exp-ids-unrelated"),
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "fresh",
      learnerAnswer: "y",
    });

    expect(getConceptMastery(target, "order-of-operations").attempts).toBe(3);
    expect(getConceptMastery(learnerId("exp-ids-unrelated"), "order-of-operations").attempts).toBe(1);
  });
});

describe("Spot the Mistake stats (persisted, separate from BKT/mastery)", () => {
  it("starts at zero for a learner with no attempts", () => {
    expect(getSpotMistakeStats(learnerId("smk1"))).toEqual({ attempted: 0, caught: 0 });
  });

  it("accumulates across multiple attempts and survives independently of the mastery gate", () => {
    const id = learnerId("smk2");
    recordSpotMistakeAttempt({ learnerId: id, misconceptionId: "ORDER_LEFT_TO_RIGHT", conceptId: "order-of-operations", correct: true });
    recordSpotMistakeAttempt({ learnerId: id, misconceptionId: "NEG_MULT_SIGN", conceptId: "negative-numbers", correct: false });
    recordSpotMistakeAttempt({ learnerId: id, misconceptionId: "CLT_DROP_VARIABLE", conceptId: "combining-like-terms", correct: true });

    expect(getSpotMistakeStats(id)).toEqual({ attempted: 3, caught: 2 });
    // Doesn't touch concept mastery at all — a separate, additive signal.
    expect(getConceptMastery(id, "order-of-operations").attempts).toBe(0);
  });

  it("is scoped per learner", () => {
    const a = learnerId("smk-a");
    const b = learnerId("smk-b");
    recordSpotMistakeAttempt({ learnerId: a, misconceptionId: "ORDER_LEFT_TO_RIGHT", conceptId: "order-of-operations", correct: true });
    expect(getSpotMistakeStats(b)).toEqual({ attempted: 0, caught: 0 });
  });
});

describe("getSessionSummary", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("only counts attempts at or after the given timestamp", () => {
    vi.useFakeTimers();
    const id = learnerId("sess1");
    vi.setSystemTime(1000);
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "before-session",
      learnerAnswer: "y",
    });
    vi.setSystemTime(5000);
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "in-session",
      learnerAnswer: "y",
    });

    const summary = getSessionSummary(id, 3000);
    expect(summary.attempts).toBe(1);
    expect(summary.correct).toBe(1);
  });

  it("only flags a concept as mastered-this-session if mastered_at falls in the window, not just updated_at", () => {
    vi.useFakeTimers();
    const id = learnerId("sess2");
    vi.setSystemTime(1000);
    for (let i = 0; i < MASTERY_MIN_ATTEMPTS; i++) {
      recordAttempt({
        learnerId: id,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "correct",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: `mastery-${i}`,
        learnerAnswer: "y",
      });
    }
    expect(getConceptMastery(id, "order-of-operations").mastered).toBe(1);

    // Session starts AFTER mastery was already reached...
    const sessionStart = 10_000;
    vi.setSystemTime(15_000);
    // ...but the concept gets touched again during the session (e.g. a spaced
    // review), which bumps updated_at without changing mastered_at.
    recordAttempt({
      learnerId: id,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "later-review",
      learnerAnswer: "y",
    });

    const row = getConceptMastery(id, "order-of-operations");
    expect(row.updated_at).toBeGreaterThanOrEqual(sessionStart); // touched this session
    expect(row.mastered_at).toBeLessThan(sessionStart); // but mastered before it

    const summary = getSessionSummary(id, sessionStart);
    expect(summary.conceptsMasteredNow).toEqual([]);
  });

  it("does flag a concept mastered during the session window", () => {
    vi.useFakeTimers();
    const id = learnerId("sess3");
    const sessionStart = 1000;
    vi.setSystemTime(sessionStart);
    for (let i = 0; i < MASTERY_MIN_ATTEMPTS; i++) {
      recordAttempt({
        learnerId: id,
        conceptId: "order-of-operations",
        misconceptionId: null,
        outcome: "correct",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: `mastery-${i}`,
        learnerAnswer: "y",
      });
    }
    const summary = getSessionSummary(id, sessionStart);
    expect(summary.conceptsMasteredNow).toEqual(["Order of Operations"]);
  });

  it("lists distinct misconception names, most recent first", () => {
    const id = learnerId("sess4");
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
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "b",
      learnerAnswer: "x",
    });
    recordAttempt({
      learnerId: id,
      conceptId: "negative-numbers",
      misconceptionId: "NEG_MULT_SIGN",
      outcome: "matched_misconception",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "c",
      learnerAnswer: "x",
    });

    const summary = getSessionSummary(id, 0);
    expect(summary.misconceptionNames).toEqual([
      "Negative-times-negative sign error",
      "Strict left-to-right evaluation",
    ]);
  });

  it("returns zeros/empties for a learner with no activity in the window", () => {
    const summary = getSessionSummary(learnerId("sess5"), Date.now());
    expect(summary).toEqual({
      attempts: 0,
      correct: 0,
      misconceptionNames: [],
      confirmed: 0,
      caught: 0,
      conceptsMasteredNow: [],
    });
  });
});
