import { describe, it, expect } from "vitest";
import { Difficulty, GENERATORS_BY_MISCONCEPTION, generateProblem } from "../src/lib/domain/problemEngine";
import { analyzeAnswer } from "../src/lib/analyzer";
import { MISCONCEPTIONS } from "../src/lib/domain/misconceptions";
import { CONCEPTS } from "../src/lib/domain/concepts";

const ITERATIONS = 500;
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

describe("problem generators", () => {
  for (const misconception of MISCONCEPTIONS) {
    for (const difficulty of DIFFICULTIES) {
      it(`${misconception.id} (${difficulty}): correct and distractor answers are always distinct`, () => {
        for (let i = 0; i < ITERATIONS; i++) {
          const problem = GENERATORS_BY_MISCONCEPTION[misconception.id](difficulty);
          expect(
            problem.correctAnswer,
            `collision in ${misconception.id} at ${difficulty} with meta ${JSON.stringify(problem.meta)}`
          ).not.toBe(problem.distractorAnswer);
        }
      });

      it(`${misconception.id} (${difficulty}): analyzer correctly classifies correct/distractor/unrecognized`, () => {
        for (let i = 0; i < 20; i++) {
          const problem = GENERATORS_BY_MISCONCEPTION[misconception.id](difficulty);

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
  }

  it("every misconception has a generator", () => {
    for (const m of MISCONCEPTIONS) {
      expect(GENERATORS_BY_MISCONCEPTION[m.id], `missing generator for ${m.id}`).toBeDefined();
    }
  });

  it("generateProblem(conceptId) only returns problems for that concept, at every difficulty", () => {
    for (const concept of CONCEPTS) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 30; i++) {
          const problem = generateProblem(concept.id, difficulty);
          expect(problem.conceptId).toBe(concept.id);
          expect(problem.meta.difficulty).toBe({ easy: 1, medium: 2, hard: 3 }[difficulty]);
        }
      }
    }
  });

  it("generateProblem defaults to medium difficulty when none is given", () => {
    const problem = generateProblem(CONCEPTS[0].id);
    expect(problem.meta.difficulty).toBe(2);
  });
});
