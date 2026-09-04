import { describe, it, expect } from "vitest";
import { GENERATORS_BY_MISCONCEPTION, generateProblem } from "../src/lib/domain/problemEngine";
import { analyzeAnswer } from "../src/lib/analyzer";
import { MISCONCEPTIONS } from "../src/lib/domain/misconceptions";
import { CONCEPTS } from "../src/lib/domain/concepts";

const ITERATIONS = 500;

describe("problem generators", () => {
  for (const misconception of MISCONCEPTIONS) {
    it(`${misconception.id}: correct and distractor answers are always distinct`, () => {
      for (let i = 0; i < ITERATIONS; i++) {
        const problem = GENERATORS_BY_MISCONCEPTION[misconception.id]();
        expect(
          problem.correctAnswer,
          `collision in ${misconception.id} with meta ${JSON.stringify(problem.meta)}`
        ).not.toBe(problem.distractorAnswer);
      }
    });

    it(`${misconception.id}: analyzer correctly classifies correct/distractor/unrecognized`, () => {
      for (let i = 0; i < 20; i++) {
        const problem = GENERATORS_BY_MISCONCEPTION[misconception.id]();

        const correctResult = analyzeAnswer(problem, problem.correctAnswer);
        expect(correctResult.outcome).toBe("correct");

        const distractorResult = analyzeAnswer(problem, problem.distractorAnswer);
        expect(distractorResult).toEqual({
          outcome: "matched_misconception",
          misconceptionId: misconception.id,
        });

        const junkResult = analyzeAnswer(problem, "totally-not-a-real-answer-xyz");
        expect(junkResult.outcome).toBe("unrecognized");
      }
    });
  }

  it("every misconception has a generator", () => {
    for (const m of MISCONCEPTIONS) {
      expect(GENERATORS_BY_MISCONCEPTION[m.id], `missing generator for ${m.id}`).toBeDefined();
    }
  });

  it("generateProblem(conceptId) only returns problems for that concept", () => {
    for (const concept of CONCEPTS) {
      for (let i = 0; i < 30; i++) {
        const problem = generateProblem(concept.id);
        expect(problem.conceptId).toBe(concept.id);
      }
    }
  });
});
