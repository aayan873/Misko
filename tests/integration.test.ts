import { describe, it, expect, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";

// Isolate the store from real dev data before importing anything that touches it.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "misko-integration-test-"));
process.env.MISKO_DATA_DIR = tmpDir;

const { store } = await import("../src/lib/store");
const {
  decideNextProblem,
  recordAttempt,
  getConceptMastery,
  getAllMastery,
  getConfirmationStats,
  lastMisconceptionOnConcept,
  getMisconceptionHistory,
  getCalibrationInsight,
  exportLearnerData,
  importLearnerData,
  recordSpotMistakeAttempt,
  getSpotMistakeStats,
  resolvePendingConfirmation,
} = await import("../src/lib/learnerModel");

beforeEach(() => {
  store._resetForTests();
});

/**
 * This doesn't test any one function in isolation — every other test file
 * does that. This walks one learner through a single long, realistic session
 * touching nine different features in sequence, the way an actual user would,
 * and checks they compose correctly rather than just each working alone.
 * Modeled directly on a manual live run against the real running server
 * during this session (see the LOOP commit history) — verified there via
 * curl that the real API route orchestration matches; this locks the same
 * scenario in as a permanent, fast, no-server-needed regression test using
 * the same learnerModel primitives the routes call.
 */
describe("full-session integration: many features composing correctly together", () => {
  const learner = "integration-learner";

  it("builds overconfidence, mastery, a rule-based confirmation catch, spaced review, and an intact export/import round-trip — all consistently", () => {
    // --- Phase 1: five wrong, high-confidence answers on the same misconception ---
    // (a real learner overconfidently repeating the same mistake).
    for (let i = 0; i < 5; i++) {
      recordAttempt({
        learnerId: learner,
        conceptId: "order-of-operations",
        misconceptionId: "ORDER_ADD_BEFORE_MULT",
        outcome: "matched_misconception",
        confidenceBefore: 5,
        hintLevelUsed: 1,
        problemPrompt: `wrong-${i}`,
        learnerAnswer: "x",
        diagnosisSource: "rule",
      });
    }

    const insight = getCalibrationInsight(learner);
    expect(insight).toEqual({ type: "overconfident", accuracy: 0, count: 5 });

    // --- Phase 2: the deterministic rule trigger the real submit-answer route
    // runs before recording a correct answer — did the learner just slip on
    // this exact concept? ---
    const suspect = lastMisconceptionOnConcept(learner, "order-of-operations");
    expect(suspect).toBe("ORDER_ADD_BEFORE_MULT");

    // Route would now record this correct answer WITH confirmationStatus
    // "pending" and the suspect misconception attached, exactly as verified
    // live against /api/submit-answer.
    recordAttempt({
      learnerId: learner,
      conceptId: "order-of-operations",
      misconceptionId: suspect,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "correct-1",
      learnerAnswer: "y",
      confirmationStatus: "pending",
      diagnosisSource: "rule",
    });

    // --- Phase 3: the next problem must be the silent confirmation round,
    // ahead of anything else, targeting the same misconception. ---
    const next1 = decideNextProblem(learner);
    expect(next1.reasonType).toBe("confirmation");
    expect(next1.problem?.targetMisconceptionId).toBe("ORDER_ADD_BEFORE_MULT");

    // Answer it correctly too — the route would call resolvePendingConfirmation
    // "confirmed" before this recordAttempt; simulate that ordering directly.
    resolvePendingConfirmation(learner, "confirmed");
    recordAttempt({
      learnerId: learner,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "correct-2",
      learnerAnswer: "y",
    });

    expect(getConfirmationStats(learner)).toEqual({ confirmed: 1, caught: 0, checked: 1 });
    expect(getMisconceptionHistory(learner)).toHaveLength(1);
    expect(getMisconceptionHistory(learner)[0].resolved).toBe(1);

    // --- Phase 4: two more correct answers cross the BKT mastery threshold. ---
    recordAttempt({
      learnerId: learner,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "correct-3",
      learnerAnswer: "y",
    });
    const beforeMastery = getConceptMastery(learner, "order-of-operations");
    expect(beforeMastery.mastered).toBe(1);
    expect(beforeMastery.due_after_attempts).not.toBeNull();

    // --- Phase 5: enough further activity on the next concept to cross the
    // spaced-review due threshold for order-of-operations. ---
    const dueAt = beforeMastery.due_after_attempts as number;
    let totalSoFar = store.raw.attempts.filter((a) => a.learner_id === learner).length;
    while (totalSoFar < dueAt) {
      recordAttempt({
        learnerId: learner,
        conceptId: "negative-numbers",
        misconceptionId: null,
        outcome: "correct",
        confidenceBefore: 3,
        hintLevelUsed: 1,
        problemPrompt: "filler",
        learnerAnswer: "y",
      });
      totalSoFar += 1;
    }

    const next2 = decideNextProblem(learner);
    expect(next2.reasonType).toBe("spaced-review");
    expect(next2.problem?.conceptId).toBe("order-of-operations");

    // --- Phase 6: Spot the Mistake, tracked separately from concept mastery. ---
    recordSpotMistakeAttempt({
      learnerId: learner,
      misconceptionId: "NEG_MULT_SIGN",
      conceptId: "negative-numbers",
      correct: true,
    });
    recordSpotMistakeAttempt({
      learnerId: learner,
      misconceptionId: "CLT_DROP_VARIABLE",
      conceptId: "combining-like-terms",
      correct: false,
    });
    expect(getSpotMistakeStats(learner)).toEqual({ attempted: 2, caught: 1 });
    // Confirmed separate from the mastery gate — no combining-like-terms
    // attempts were ever recorded through the normal practice flow.
    expect(getConceptMastery(learner, "combining-like-terms").attempts).toBe(0);

    // --- Phase 7: export this whole rich state and import it into a fresh
    // learner id — the two must be indistinguishable afterward. ---
    const exported = exportLearnerData(learner);
    const restored = "integration-restored";
    importLearnerData(restored, {
      conceptMastery: exported.conceptMastery,
      misconceptionEvents: exported.misconceptionEvents,
      attempts: exported.attempts,
      spotMistakeAttempts: exported.spotMistakeAttempts,
    });

    expect(getAllMastery(restored)).toEqual(
      getAllMastery(learner).map((m) => ({ ...m, learner_id: restored }))
    );
    expect(getSpotMistakeStats(restored)).toEqual(getSpotMistakeStats(learner));
    expect(getConfirmationStats(restored)).toEqual(getConfirmationStats(learner));
    expect(getMisconceptionHistory(restored)).toEqual(getMisconceptionHistory(learner));
  });
});
