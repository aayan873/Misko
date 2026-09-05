import { describe, it, expect } from "vitest";
import { MISCONCEPTIONS } from "../src/lib/domain/misconceptions";
import { Difficulty, generateProblemForMisconception } from "../src/lib/domain/problemEngine";
import { buildFlawedWalkthrough, hasFlawedWalkthrough } from "../src/lib/domain/flawedWorkedExample";

const ITERATIONS = 200;
// Covers every difficulty tier, not just the default — the walkthrough
// builders just interpolate problem.meta directly (see their own file), so
// nothing about them SHOULD depend on difficulty, but "hard" is exactly where
// wider generator ranges would most likely surface a drift if one existed.
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

describe("flawed worked examples", () => {
  it("every misconception in the taxonomy has a walkthrough builder", () => {
    for (const m of MISCONCEPTIONS) {
      expect(hasFlawedWalkthrough(m.id), `missing builder for ${m.id}`).toBe(true);
    }
  });

  for (const misconception of MISCONCEPTIONS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${misconception.id} (${difficulty}): walkthrough is internally consistent`, () => {
        for (let i = 0; i < ITERATIONS; i++) {
          const problem = generateProblemForMisconception(misconception.id, difficulty);
          const walkthrough = buildFlawedWalkthrough(problem);

          expect(walkthrough.problemText).toBe(problem.promptText);
          expect(walkthrough.steps.length).toBeGreaterThanOrEqual(2);
          expect(walkthrough.flawedStepIndex).toBeGreaterThanOrEqual(0);
          expect(walkthrough.flawedStepIndex).toBeLessThan(walkthrough.steps.length);

          // The walkthrough's final step must land on the same distractor value the
          // deterministic problem engine independently computed — if these ever
          // drift apart, the exercise would ask the learner to spot a "mistake"
          // that doesn't match what the app would actually grade as wrong.
          const lastStep = walkthrough.steps[walkthrough.steps.length - 1].text;
          expect(
            lastStep,
            `final step "${lastStep}" doesn't contain distractor ${problem.distractorAnswer} (meta ${JSON.stringify(problem.meta)})`
          ).toContain(problem.distractorAnswer);
        }
      });
    }
  }
});
