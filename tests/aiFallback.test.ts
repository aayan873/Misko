import { describe, it, expect, beforeEach } from "vitest";

// Ensure no key is configured for these tests, regardless of the shell environment,
// so we're specifically exercising the "AI service unavailable" degrade path
// required by prompt.md §16 ("must fail gracefully when AI services are unavailable").
beforeEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe("AI layer graceful degradation (no API key configured)", () => {
  it("isGeminiConfigured() is false", async () => {
    const { isGeminiConfigured } = await import("../src/lib/ai/gemini");
    expect(isGeminiConfigured()).toBe(false);
  });

  it("generateDiagnosis falls back to a non-empty, misconception-specific template", async () => {
    const { generateDiagnosis } = await import("../src/lib/ai/gemini");
    const { generateProblemForMisconception } = await import("../src/lib/domain/problemEngine");
    const { getMisconception } = await import("../src/lib/domain/misconceptions");

    const problem = generateProblemForMisconception("NEG_MULT_SIGN");
    const misconception = getMisconception("NEG_MULT_SIGN")!;

    const result = await generateDiagnosis({
      problem,
      learnerAnswer: problem.distractorAnswer,
      misconception,
      hintLevel: 1,
      recentMisconceptionNames: [],
    });

    expect(result.source).toBe("fallback");
    expect(result.text.length).toBeGreaterThan(0);
    // The fallback must never leak the correct answer directly.
    expect(result.text).not.toContain(problem.correctAnswer);
  });

  it("generateDiagnosis handles an unrecognized (no-misconception) case without crashing", async () => {
    const { generateDiagnosis } = await import("../src/lib/ai/gemini");
    const { generateProblem } = await import("../src/lib/domain/problemEngine");

    const problem = generateProblem("order-of-operations");
    const result = await generateDiagnosis({
      problem,
      learnerAnswer: "not-a-real-answer",
      misconception: null,
      hintLevel: 2,
      recentMisconceptionNames: [],
    });

    expect(result.source).toBe("fallback");
    expect(result.text.length).toBeGreaterThan(0);
  });

  it("classifyFreeformMisconception is skipped (not attempted) with no API key, never throws", async () => {
    const { classifyFreeformMisconception } = await import("../src/lib/ai/gemini");
    const { generateProblemForMisconception } = await import("../src/lib/domain/problemEngine");
    const { misconceptionsForConcept } = await import("../src/lib/domain/misconceptions");

    const problem = generateProblemForMisconception("CLT_EXPONENT_ADD");
    const result = await classifyFreeformMisconception({
      problem,
      learnerAnswer: "some wrong value",
      shownWork: "I added the exponents together like when you multiply powers",
      candidates: misconceptionsForConcept(problem.conceptId),
    });

    expect(result.attempted).toBe(false);
    expect(result.misconceptionId).toBeNull();
  });

  it("classifyCorrectReasoning is skipped (not attempted) with no API key, never throws", async () => {
    const { classifyCorrectReasoning } = await import("../src/lib/ai/gemini");
    const { generateProblemForMisconception } = await import("../src/lib/domain/problemEngine");
    const { misconceptionsForConcept } = await import("../src/lib/domain/misconceptions");

    const problem = generateProblemForMisconception("CLT_EXPONENT_ADD");
    const result = await classifyCorrectReasoning({
      problem,
      learnerAnswer: problem.correctAnswer,
      shownWork: "I added the coefficients together and kept the exponent the same",
      candidates: misconceptionsForConcept(problem.conceptId),
    });

    expect(result.attempted).toBe(false);
    expect(result.suspectMisconceptionId).toBeNull();
  });

  it("generateCorrectFeedback falls back to a non-empty affirmation", async () => {
    const { generateCorrectFeedback } = await import("../src/lib/ai/gemini");
    const { generateProblem } = await import("../src/lib/domain/problemEngine");

    const problem = generateProblem("combining-like-terms");
    const result = await generateCorrectFeedback(problem);

    expect(result.source).toBe("fallback");
    expect(result.text.length).toBeGreaterThan(0);
  });
});
