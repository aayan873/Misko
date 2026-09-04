import { describe, it, expect } from "vitest";
import {
  learnerIdSchema,
  submitAnswerSchema,
  nextProblemQuerySchema,
  learnerCreateSchema,
} from "../src/lib/validation";

describe("input validation (API boundary security, prompt.md §19)", () => {
  it("rejects a non-UUID learnerId", () => {
    expect(learnerIdSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(learnerIdSchema.safeParse("'; DROP TABLE learners; --").success).toBe(false);
    expect(learnerIdSchema.safeParse("").success).toBe(false);
  });

  it("accepts a well-formed UUID learnerId", () => {
    expect(learnerIdSchema.safeParse("39cb6a4d-898f-4c44-8458-7efaffef320b").success).toBe(true);
  });

  it("submitAnswerSchema rejects an out-of-range hintLevel", () => {
    const base = {
      learnerId: "39cb6a4d-898f-4c44-8458-7efaffef320b",
      problemId: "p1",
      answer: "12",
      confidenceBefore: 3,
    };
    expect(submitAnswerSchema.safeParse({ ...base, hintLevel: 4 }).success).toBe(false);
    expect(submitAnswerSchema.safeParse({ ...base, hintLevel: 0 }).success).toBe(false);
    expect(submitAnswerSchema.safeParse({ ...base, hintLevel: 1 }).success).toBe(true);
  });

  it("submitAnswerSchema rejects an out-of-range confidenceBefore", () => {
    const base = {
      learnerId: "39cb6a4d-898f-4c44-8458-7efaffef320b",
      problemId: "p1",
      answer: "12",
      hintLevel: 1 as const,
    };
    expect(submitAnswerSchema.safeParse({ ...base, confidenceBefore: 0 }).success).toBe(false);
    expect(submitAnswerSchema.safeParse({ ...base, confidenceBefore: 6 }).success).toBe(false);
    expect(submitAnswerSchema.safeParse({ ...base, confidenceBefore: 3 }).success).toBe(true);
  });

  it("submitAnswerSchema rejects an oversized answer string (crude payload/abuse guard)", () => {
    const base = {
      learnerId: "39cb6a4d-898f-4c44-8458-7efaffef320b",
      problemId: "p1",
      confidenceBefore: 3,
      hintLevel: 1 as const,
    };
    expect(submitAnswerSchema.safeParse({ ...base, answer: "x".repeat(500) }).success).toBe(
      false
    );
  });

  it("submitAnswerSchema accepts a missing timeSpentMs (optional) and rejects an invalid one", () => {
    const base = {
      learnerId: "39cb6a4d-898f-4c44-8458-7efaffef320b",
      problemId: "p1",
      answer: "12",
      confidenceBefore: 3,
      hintLevel: 1 as const,
    };
    expect(submitAnswerSchema.safeParse(base).success).toBe(true);
    expect(submitAnswerSchema.safeParse({ ...base, timeSpentMs: 5000 }).success).toBe(true);
    expect(submitAnswerSchema.safeParse({ ...base, timeSpentMs: 0 }).success).toBe(true);
    expect(submitAnswerSchema.safeParse({ ...base, timeSpentMs: -1 }).success).toBe(false);
    expect(submitAnswerSchema.safeParse({ ...base, timeSpentMs: 1.5 }).success).toBe(false);
    expect(submitAnswerSchema.safeParse({ ...base, timeSpentMs: 7 * 60 * 60 * 1000 }).success).toBe(
      false
    );
  });

  it("nextProblemQuerySchema rejects a missing/null learnerId", () => {
    expect(nextProblemQuerySchema.safeParse({ learnerId: null }).success).toBe(false);
  });

  it("learnerCreateSchema trims/limits displayName and allows omission", () => {
    const id = "39cb6a4d-898f-4c44-8458-7efaffef320b";
    expect(learnerCreateSchema.safeParse({ learnerId: id }).success).toBe(true);
    expect(
      learnerCreateSchema.safeParse({ learnerId: id, displayName: "x".repeat(200) }).success
    ).toBe(false);
  });
});
