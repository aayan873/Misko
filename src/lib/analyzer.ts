import { ProblemInstance, normalizeAnswer } from "./domain/problemEngine";

export type AnalysisResult =
  | { outcome: "correct" }
  | { outcome: "matched_misconception"; misconceptionId: string }
  | { outcome: "unrecognized" };

/**
 * Deterministically classifies a learner's answer against a problem instance's
 * known-correct answer and known-distractor (misconception) answer. This is the
 * "answer analyzer" step in ARCHITECTURE.md — pure, testable, and never delegated
 * to the LLM, since correctness must not depend on model output.
 */
export function analyzeAnswer(problem: ProblemInstance, rawAnswer: string): AnalysisResult {
  const normalized = normalizeAnswer(rawAnswer, problem.answerType);

  if (normalized === problem.correctAnswer) {
    return { outcome: "correct" };
  }
  if (normalized === problem.distractorAnswer) {
    return { outcome: "matched_misconception", misconceptionId: problem.targetMisconceptionId };
  }
  return { outcome: "unrecognized" };
}
