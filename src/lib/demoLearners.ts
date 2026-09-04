import { store } from "./store";
import { recordAttempt } from "./learnerModel";

/**
 * Two fixed, seeded learner profiles used ONLY by /compare to demonstrate — live,
 * against the real backend, not scripted text — that the mastery gate and diagnosis
 * prompt genuinely depend on stored per-learner history (prompt.md §9/§14). Seeding
 * is idempotent: /api/demo/seed wipes and rebuilds both every time the page loads.
 */
export const DEMO_LEARNER_A = {
  id: "a1000000-0000-4000-8000-000000000001",
  name: "Priya",
  persona: "Has recently struggled with sign errors on negative numbers.",
};

export const DEMO_LEARNER_B = {
  id: "b2000000-0000-4000-8000-000000000002",
  name: "Marcus",
  persona: "Has recently struggled with combining-like-terms exponent confusion.",
};

function seedCorrectStreak(learnerId: string, conceptId: Parameters<typeof recordAttempt>[0]["conceptId"], count: number) {
  for (let i = 0; i < count; i++) {
    recordAttempt({
      learnerId,
      conceptId,
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 4,
      hintLevelUsed: 1,
      problemPrompt: "(seed)",
      learnerAnswer: "(seed)",
    });
  }
}

export function seedDemoLearners(): void {
  store.resetLearner(DEMO_LEARNER_A.id);
  store.resetLearner(DEMO_LEARNER_B.id);

  // Priya: mastered order-of-operations, has a recent (resolved) history of
  // negative-number sign errors — this is what will surface in her diagnosis context.
  seedCorrectStreak(DEMO_LEARNER_A.id, "order-of-operations", 3);
  recordAttempt({
    learnerId: DEMO_LEARNER_A.id,
    conceptId: "negative-numbers",
    misconceptionId: "NEG_SUBTRACT_SIGN",
    outcome: "matched_misconception",
    confidenceBefore: 4,
    hintLevelUsed: 1,
    problemPrompt: "(seed) 8 - (-3)",
    learnerAnswer: "5",
    diagnosisSource: "rule",
  });
  recordAttempt({
    learnerId: DEMO_LEARNER_A.id,
    conceptId: "negative-numbers",
    misconceptionId: null,
    outcome: "correct",
    confidenceBefore: 3,
    hintLevelUsed: 1,
    problemPrompt: "(seed) 8 - (-3)",
    learnerAnswer: "11",
  });
  recordAttempt({
    learnerId: DEMO_LEARNER_A.id,
    conceptId: "negative-numbers",
    misconceptionId: "NEG_MULT_SIGN",
    outcome: "matched_misconception",
    confidenceBefore: 5,
    hintLevelUsed: 1,
    problemPrompt: "(seed) (-4) x (-2)",
    learnerAnswer: "-8",
    diagnosisSource: "rule",
  });
  recordAttempt({
    learnerId: DEMO_LEARNER_A.id,
    conceptId: "negative-numbers",
    misconceptionId: null,
    outcome: "correct",
    confidenceBefore: 3,
    hintLevelUsed: 1,
    problemPrompt: "(seed) (-4) x (-2)",
    learnerAnswer: "8",
  });

  // Marcus: mastered order-of-operations AND negative-numbers, has a recent
  // (resolved) history of combining-like-terms exponent confusion instead.
  seedCorrectStreak(DEMO_LEARNER_B.id, "order-of-operations", 3);
  seedCorrectStreak(DEMO_LEARNER_B.id, "negative-numbers", 3);
  recordAttempt({
    learnerId: DEMO_LEARNER_B.id,
    conceptId: "combining-like-terms",
    misconceptionId: "CLT_EXPONENT_ADD",
    outcome: "matched_misconception",
    confidenceBefore: 4,
    hintLevelUsed: 1,
    problemPrompt: "(seed) 4x^2 + 3x^2",
    learnerAnswer: "7x^4",
    diagnosisSource: "rule",
  });
  recordAttempt({
    learnerId: DEMO_LEARNER_B.id,
    conceptId: "combining-like-terms",
    misconceptionId: null,
    outcome: "correct",
    confidenceBefore: 3,
    hintLevelUsed: 1,
    problemPrompt: "(seed) 4x^2 + 3x^2",
    learnerAnswer: "7x^2",
  });
}
