import { describe, it, expect, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

// Isolate the store from real dev data before importing anything that touches it —
// same pattern as every other test file here.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "misko-route-test-"));
process.env.MISKO_DATA_DIR = tmpDir;

const { store } = await import("../src/lib/store");
const { _resetRateLimitsForTests } = await import("../src/lib/rateLimit");
const { POST } = await import("../src/app/api/submit-answer/route");

function submitRequest(learnerId: string, problemId = "nonexistent-problem-id") {
  return POST(
    new NextRequest("http://localhost/api/submit-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learnerId,
        problemId,
        answer: "1",
        confidenceBefore: 3,
        hintLevel: 1,
      }),
    })
  );
}

/**
 * Exercises the ACTUAL route handler, not just the underlying learnerModel
 * functions (every other test file's approach) — the one place a rate-limit
 * or validation regression in the route's own orchestration would actually
 * be caught. Safe to hammer with real requests: deleting GEMINI_API_KEY (same
 * safety pattern as aiFallback.test.ts) guarantees this can never make a real
 * billed Gemini call regardless of what's in the ambient shell environment,
 * and an intentionally-fake problemId means every request short-circuits to
 * a 404 well before reaching any AI call anyway — this is specifically about
 * proving the rate limiter's real integration into the route, not the
 * diagnosis flow itself (that's covered live and in aiFallback.test.ts).
 */
describe("POST /api/submit-answer — rate limiting integration", () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    store._resetForTests();
    _resetRateLimitsForTests();
  });

  it("allows requests up to the per-learner limit, then returns 429", async () => {
    const learnerId = randomUUID();
    const statuses: number[] = [];
    for (let i = 0; i < 61; i++) {
      const res = await submitRequest(learnerId);
      statuses.push(res.status);
    }
    // First 60 never rate-limited (404s, since the problem id is fake — the
    // point here is they're NOT 429s).
    expect(statuses.slice(0, 60).every((s) => s !== 429)).toBe(true);
    expect(statuses[60]).toBe(429);

    const body = await (await submitRequest(learnerId)).json();
    expect(body.error).toMatch(/slow down/i);
  });

  it("scopes the limit per learner — a different learner is unaffected", async () => {
    const learnerA = randomUUID();
    const learnerB = randomUUID();
    for (let i = 0; i < 60; i++) {
      await submitRequest(learnerA);
    }
    expect((await submitRequest(learnerA)).status).toBe(429);
    expect((await submitRequest(learnerB)).status).not.toBe(429);
  });

  it("a genuinely invalid request still returns 400, not swallowed by rate limiting", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId: "not-a-uuid" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
