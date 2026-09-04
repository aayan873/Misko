import { describe, it, expect, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "misko-transcribe-route-test-"));
process.env.MISKO_DATA_DIR = tmpDir;

const { _resetRateLimitsForTests } = await import("../src/lib/rateLimit");
const { POST } = await import("../src/app/api/transcribe-work/route");

// A tiny valid 1x1 PNG (well under the schema's size cap) — content doesn't
// matter here since GEMINI_API_KEY is deleted below, so transcribeHandwriting
// returns { attempted: false } immediately without ever calling Gemini.
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function transcribeRequest(learnerId: string) {
  return POST(
    new NextRequest("http://localhost/api/transcribe-work", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learnerId,
        imageBase64: TINY_PNG,
        mimeType: "image/png",
        problemPromptText: "test",
      }),
    })
  );
}

/** Same rationale as submitAnswerRoute.test.ts: exercises the real handler,
 * safe from any billed call because GEMINI_API_KEY is deleted (transcribeHandwriting
 * short-circuits to { attempted: false } before ever reaching the network). */
describe("POST /api/transcribe-work — rate limiting integration", () => {
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    _resetRateLimitsForTests();
  });

  it("allows requests up to the per-learner limit, then returns 429", async () => {
    const learnerId = randomUUID();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await transcribeRequest(learnerId)).status);
    }
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  // Same reasoning as the equivalent submit-answer test: the global limit is
  // what actually matters (a per-learner cap is trivially bypassed by
  // generating new learner ids) and had never been verified before now.
  // 40 total across 5 learners (8 each, under the 10/learner cap).
  it("enforces a global cap across learners, not just per-learner", async () => {
    const learners = Array.from({ length: 5 }, () => randomUUID());
    const statuses: number[] = [];
    for (let round = 0; round < 8; round++) {
      for (const learnerId of learners) {
        statuses.push((await transcribeRequest(learnerId)).status);
      }
    }
    expect(statuses).toHaveLength(40);
    expect(statuses.every((s) => s !== 429)).toBe(true);

    const freshLearner = randomUUID();
    const res = await transcribeRequest(freshLearner);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.message).toMatch(/busy/i);
  });
});
