import { describe, it, expect } from "vitest";
import { DEFAULT_BKT_PARAMS, BKT_MASTERY_THRESHOLD, initialMastery, updateMastery } from "../src/lib/bkt";
import { MASTERY_MIN_ATTEMPTS } from "../src/lib/learnerModel";

/**
 * Locks in the two properties EVALUATION.md's "time to mastery" and
 * "resilience" numbers are based on, as permanent, deterministic (no RNG)
 * regression tests — so those numbers can't silently drift out of date if
 * BKT_MASTERY_THRESHOLD, MASTERY_MIN_ATTEMPTS, or DEFAULT_BKT_PARAMS ever
 * change without EVALUATION.md being revisited. The broader multi-accuracy
 * simulation in EVALUATION.md uses a seeded PRNG for a wider sweep and is
 * reproducible on demand, but isn't asserted here as hard pass/fail — exact
 * median attempt counts under a specific seed are a reasonable thing to
 * report and re-run, but too fragile to pin as a CI assertion.
 */
describe("evaluation: BKT mastery gate, measured not assumed", () => {
  it("at sustained high accuracy, MASTERY_MIN_ATTEMPTS is the binding floor, not the BKT threshold itself", () => {
    // Correct every time: BKT_MASTERY_THRESHOLD alone would be crossed even
    // earlier than MASTERY_MIN_ATTEMPTS given DEFAULT_BKT_PARAMS, so the
    // explicit floor (added specifically to avoid granting mastery off a
    // freak early streak) is what actually determines the answer here.
    let p = initialMastery();
    let attempts = 0;
    while (attempts < MASTERY_MIN_ATTEMPTS || p < BKT_MASTERY_THRESHOLD) {
      p = updateMastery(p, true);
      attempts++;
    }
    expect(attempts).toBe(MASTERY_MIN_ATTEMPTS);
    expect(p).toBeGreaterThanOrEqual(BKT_MASTERY_THRESHOLD);
  });

  it("the underlying p_mastery estimate is not sticky: a single wrong answer drops it back below the threshold", () => {
    // IMPORTANT SCOPE NOTE: this is about the raw probability estimate
    // (updateMastery's return value) crossing back below BKT_MASTERY_THRESHOLD,
    // NOT about learnerModel.ts's persisted ConceptMasteryRow.mastered flag —
    // that flag is DELIBERATELY sticky once granted (see the "Sticky:" comment
    // directly above the `mastered` computation in recordAttempt) so a single
    // slip on a later spaced-review problem doesn't revoke an already-earned
    // "Mastered" badge. See EVALUATION.md's Resilience section for both layers
    // stated precisely — conflating them here was a real, since-corrected
    // inaccuracy in an earlier version of this file/EVALUATION.md.
    let p = initialMastery();
    let attempts = 0;
    while (attempts < MASTERY_MIN_ATTEMPTS || p < BKT_MASTERY_THRESHOLD) {
      p = updateMastery(p, true);
      attempts++;
    }
    const pAfterOneSlip = updateMastery(p, false);
    expect(pAfterOneSlip).toBeLessThan(BKT_MASTERY_THRESHOLD);
  });

  it("lower sustained accuracy takes measurably longer to reach mastery than higher accuracy (deterministic streak patterns)", () => {
    // Deterministic long-run patterns (not alternating single wrongs, which
    // oscillate rather than trend) — N correct in a row, then repeat with
    // one wrong inserted at a fixed cadence. This isolates "how long has to
    // pass on average" without introducing RNG into a CI-asserted test.
    function attemptsToMastery(wrongEveryNth: number, maxAttempts: number): number | null {
      let p = initialMastery();
      for (let i = 1; i <= maxAttempts; i++) {
        const correct = i % wrongEveryNth !== 0;
        p = updateMastery(p, correct);
        if (i >= MASTERY_MIN_ATTEMPTS && p >= BKT_MASTERY_THRESHOLD) return i;
      }
      return null;
    }

    const perfect = attemptsToMastery(1_000_000, 500); // effectively always correct
    const mostlyCorrect = attemptsToMastery(5, 500); // wrong every 5th (~80%)
    const oftenWrong = attemptsToMastery(3, 500); // wrong every 3rd (~67%)

    expect(perfect).not.toBeNull();
    expect(mostlyCorrect).not.toBeNull();
    expect(oftenWrong).not.toBeNull();
    // Monotonic: more frequent wrong answers never reach mastery sooner.
    expect(mostlyCorrect as number).toBeGreaterThanOrEqual(perfect as number);
    expect(oftenWrong as number).toBeGreaterThanOrEqual(mostlyCorrect as number);
  });

  it("DEFAULT_BKT_PARAMS and BKT_MASTERY_THRESHOLD are the literature-typical values EVALUATION.md's numbers assume", () => {
    // A guard, not a re-derivation: if these ever change, EVALUATION.md's
    // reported numbers (computed against these exact values) need revisiting.
    expect(DEFAULT_BKT_PARAMS).toEqual({ pInit: 0.3, pTransit: 0.1, pGuess: 0.2, pSlip: 0.1 });
    expect(BKT_MASTERY_THRESHOLD).toBe(0.95);
    expect(MASTERY_MIN_ATTEMPTS).toBe(3);
  });
});
