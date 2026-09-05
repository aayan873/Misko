import { describe, it, expect, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "misko-stream-feedback-test-"));
process.env.MISKO_DATA_DIR = tmpDir;

const { _resetRateLimitsForTests } = await import("../src/lib/rateLimit");
const { cacheProblem } = await import("../src/lib/problemCache");
const { generateProblem, generateProblemForMisconception } = await import("../src/lib/domain/problemEngine");
const { fallbackDiagnosis, fallbackCorrectFeedback } = await import("../src/lib/ai/fallback");
const { getMisconception } = await import("../src/lib/domain/misconceptions");
const { POST } = await import("../src/app/api/stream-feedback/route");

/**
 * Route-level tests for /api/stream-feedback (prompt_v2.md A1) — the other
 * half of a submission's AI text, split out of /api/submit-answer so it can
 * stream. GEMINI_API_KEY deleted (same safety pattern as every other AI-route
 * test file here) means every call here exercises the deterministic fallback
 * path exclusively, never a real billed Gemini request — but that's exactly
 * the path streamDiagnosis/streamCorrectFeedback guarantee byte-for-byte
 * matches generateDiagnosis/generateCorrectFeedback's existing fallback text
 * (see gemini.ts), so reading the full streamed body and comparing it against
 * that same fallback function directly is a real, meaningful assertion, not
 * just "it returned something."
 */
async function readFullStream(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text;
}

function streamRequest(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/stream-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/stream-feedback", () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    _resetRateLimitsForTests();
  });

  it("streams the exact fallback diagnosis text for a matched misconception", async () => {
    const learnerId = randomUUID();
    const problem = generateProblemForMisconception("NEG_MULT_SIGN");
    cacheProblem(problem);
    const misconception = getMisconception("NEG_MULT_SIGN")!;

    const res = await streamRequest({
      learnerId,
      problemId: problem.id,
      answer: problem.distractorAnswer,
      outcome: "matched_misconception",
      misconceptionId: "NEG_MULT_SIGN",
      hintLevel: 1,
      recentMisconceptionNames: [],
    });
    expect(res.status).toBe(200);
    const text = await readFullStream(res);
    expect(text).toBe(fallbackDiagnosis(misconception, 1, []));
    expect(text.length).toBeGreaterThan(0);
  });

  it("streams the exact fallback correct-feedback text for a correct outcome", async () => {
    const learnerId = randomUUID();
    const problem = generateProblem("order-of-operations");
    cacheProblem(problem);

    const res = await streamRequest({
      learnerId,
      problemId: problem.id,
      answer: problem.correctAnswer,
      outcome: "correct",
      misconceptionId: null,
      hintLevel: 1,
    });
    expect(res.status).toBe(200);
    const text = await readFullStream(res);
    expect(text).toBe(fallbackCorrectFeedback(problem));
  });

  it("streams the generic (no-misconception) fallback for an unrecognized outcome", async () => {
    const learnerId = randomUUID();
    const problem = generateProblem("linear-equations");
    cacheProblem(problem);

    const res = await streamRequest({
      learnerId,
      problemId: problem.id,
      answer: "not-a-real-answer",
      outcome: "unrecognized",
      misconceptionId: null,
      hintLevel: 2,
    });
    expect(res.status).toBe(200);
    const text = await readFullStream(res);
    expect(text).toBe(fallbackDiagnosis(null, 2, []));
  });

  it("includes recentMisconceptionNames context in the streamed text, same as the non-streaming path", async () => {
    const learnerId = randomUUID();
    const problem = generateProblemForMisconception("DIST_SIGN_ERROR");
    cacheProblem(problem);
    const misconception = getMisconception("DIST_SIGN_ERROR")!;

    const res = await streamRequest({
      learnerId,
      problemId: problem.id,
      answer: problem.distractorAnswer,
      outcome: "matched_misconception",
      misconceptionId: "DIST_SIGN_ERROR",
      hintLevel: 1,
      recentMisconceptionNames: ["Negative-times-negative sign error"],
    });
    const text = await readFullStream(res);
    expect(text).toBe(fallbackDiagnosis(misconception, 1, ["Negative-times-negative sign error"]));
    expect(text).toContain("Negative-times-negative sign error");
  });

  it("404s for an expired or unknown problemId, without ever starting a stream", async () => {
    const res = await streamRequest({
      learnerId: randomUUID(),
      problemId: "nonexistent-problem-id",
      answer: "1",
      outcome: "unrecognized",
      misconceptionId: null,
      hintLevel: 1,
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/expired|not found/i);
  });

  it("400s on an invalid request body", async () => {
    expect((await streamRequest({})).status).toBe(400);
    expect(
      (
        await streamRequest({
          learnerId: "not-a-uuid",
          problemId: "x",
          answer: "1",
          outcome: "correct",
          hintLevel: 1,
        })
      ).status
    ).toBe(400);
    expect(
      (
        await streamRequest({
          learnerId: randomUUID(),
          problemId: "x",
          answer: "1",
          outcome: "not-a-real-outcome",
          hintLevel: 1,
        })
      ).status
    ).toBe(400);
  });

  it("enforces the per-learner rate limit, same budget as submit-answer", async () => {
    const learnerId = randomUUID();
    const problem = generateProblem("order-of-operations");
    cacheProblem(problem);
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      const res = await streamRequest({
        learnerId,
        problemId: problem.id,
        answer: problem.correctAnswer,
        outcome: "correct",
        misconceptionId: null,
        hintLevel: 1,
      });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 60).every((s) => s !== 429)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it("enforces a global cap across learners, not just per-learner", async () => {
    const problem = generateProblem("order-of-operations");
    cacheProblem(problem);
    const learners = Array.from({ length: 6 }, () => randomUUID());
    const statuses: number[] = [];
    for (let round = 0; round < 50; round++) {
      for (const learnerId of learners) {
        const res = await streamRequest({
          learnerId,
          problemId: problem.id,
          answer: problem.correctAnswer,
          outcome: "correct",
          misconceptionId: null,
          hintLevel: 1,
        });
        statuses.push(res.status);
      }
    }
    expect(statuses).toHaveLength(300);
    expect(statuses.every((s) => s !== 429)).toBe(true);

    const freshLearner = randomUUID();
    const res = await streamRequest({
      learnerId: freshLearner,
      problemId: problem.id,
      answer: problem.correctAnswer,
      outcome: "correct",
      misconceptionId: null,
      hintLevel: 1,
    });
    expect(res.status).toBe(429);
  });
});
