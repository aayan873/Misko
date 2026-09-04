import { describe, it, expect, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

// Same isolation pattern as every other route test file here — a fresh, private
// data dir per test file so this can never touch real dev data.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "misko-spot-mistake-route-test-"));
process.env.MISKO_DATA_DIR = tmpDir;

const { store } = await import("../src/lib/store");
const { GET } = await import("../src/app/api/spot-mistake/route");
const { POST } = await import("../src/app/api/spot-mistake/submit/route");

/**
 * Route-level tests for /api/spot-mistake and /api/spot-mistake/submit — the
 * "Spot the Mistake" feature's two endpoints, which (unlike submit-answer and
 * transcribe-work) had zero route-level coverage: only the underlying
 * buildFlawedWalkthrough logic was tested (flawedWorkedExample.test.ts), never
 * the actual HTTP handlers, their validation, or the roundId cache lifecycle.
 */
describe("GET /api/spot-mistake", () => {
  beforeEach(() => {
    store._resetForTests();
  });

  function spotMistakeRequest(learnerId: string) {
    return GET(new NextRequest(`http://localhost/api/spot-mistake?learnerId=${learnerId}`));
  }

  it("returns a fresh round with a problem, steps, and zeroed stats for a new learner", async () => {
    const learnerId = randomUUID();
    const res = await spotMistakeRequest(learnerId);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(typeof body.roundId).toBe("string");
    expect(body.roundId.length).toBeGreaterThan(0);
    expect(typeof body.conceptId).toBe("string");
    expect(typeof body.problemText).toBe("string");
    expect(body.problemText.length).toBeGreaterThan(0);
    expect(Array.isArray(body.steps)).toBe(true);
    expect(body.steps.length).toBeGreaterThan(1);
    // The flawed step index must never be exposed to the client — that's the
    // entire point of the exercise.
    expect(body).not.toHaveProperty("flawedStepIndex");
    expect(body.stats).toEqual({ attempted: 0, caught: 0 });
  });

  it("rejects a missing or non-UUID learnerId with 400", async () => {
    const res1 = await GET(new NextRequest("http://localhost/api/spot-mistake"));
    expect(res1.status).toBe(400);

    const res2 = await GET(new NextRequest("http://localhost/api/spot-mistake?learnerId=not-a-uuid"));
    expect(res2.status).toBe(400);
  });

  it("generates a different roundId on each request", async () => {
    const learnerId = randomUUID();
    const first = await (await spotMistakeRequest(learnerId)).json();
    const second = await (await spotMistakeRequest(learnerId)).json();
    expect(first.roundId).not.toBe(second.roundId);
  });
});

describe("POST /api/spot-mistake/submit", () => {
  beforeEach(() => {
    store._resetForTests();
  });

  function submitRequest(body: unknown) {
    return POST(
      new NextRequest("http://localhost/api/spot-mistake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  it("identifies exactly one correct step index per round, consistently, and updates stats", async () => {
    const learnerId = randomUUID();
    const round = await (
      await GET(new NextRequest(`http://localhost/api/spot-mistake?learnerId=${learnerId}`))
    ).json();

    // The server never tells the client which step is flawed, so the only way
    // to find it from this side (as a real client would over several guesses)
    // is to try each index and see which one comes back correct. Every step
    // count in this domain is small (a handful of steps), so trying them all
    // is cheap and exhaustive.
    const results: { index: number; correct: boolean; correctStepIndex: number }[] = [];
    for (let i = 0; i < round.steps.length; i++) {
      const res = await submitRequest({ learnerId, roundId: round.roundId, selectedStepIndex: i });
      expect(res.status).toBe(200);
      const body = await res.json();
      results.push({ index: i, correct: body.correct, correctStepIndex: body.correctStepIndex });
    }

    const correctOnes = results.filter((r) => r.correct);
    expect(correctOnes).toHaveLength(1);
    // correctStepIndex is stable across submissions to the same round, and
    // matches the one index that actually scored as correct.
    const uniqueCorrectStepIndices = new Set(results.map((r) => r.correctStepIndex));
    expect(uniqueCorrectStepIndices.size).toBe(1);
    expect(correctOnes[0].index).toBe(correctOnes[0].correctStepIndex);

    // Every one of the submissions above was recorded — attempted should equal
    // the number of steps tried, and caught should equal the single correct one.
    const stats = await (
      await GET(new NextRequest(`http://localhost/api/spot-mistake?learnerId=${learnerId}`))
    ).json();
    expect(stats.stats.attempted).toBe(round.steps.length);
    expect(stats.stats.caught).toBe(1);
  });

  it("always returns the misconception name and explanation, correct or not", async () => {
    const learnerId = randomUUID();
    const round = await (
      await GET(new NextRequest(`http://localhost/api/spot-mistake?learnerId=${learnerId}`))
    ).json();

    const res = await submitRequest({ learnerId, roundId: round.roundId, selectedStepIndex: 0 });
    const body = await res.json();
    expect(typeof body.misconceptionName).toBe("string");
    expect(typeof body.explanation).toBe("string");
  });

  it("returns 404 for an expired or unknown roundId, without recording an attempt", async () => {
    const learnerId = randomUUID();
    const res = await submitRequest({ learnerId, roundId: "nonexistent-round-id", selectedStepIndex: 0 });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/expired|not found/i);

    const stats = await (
      await GET(new NextRequest(`http://localhost/api/spot-mistake?learnerId=${learnerId}`))
    ).json();
    expect(stats.stats.attempted).toBe(0);
  });

  it("rejects an invalid request body with 400", async () => {
    const res1 = await submitRequest({ learnerId: "not-a-uuid", roundId: "x", selectedStepIndex: 0 });
    expect(res1.status).toBe(400);

    const res2 = await submitRequest({ learnerId: randomUUID(), roundId: "x" });
    expect(res2.status).toBe(400);

    const res3 = await submitRequest({ learnerId: randomUUID(), roundId: "x", selectedStepIndex: -1 });
    expect(res3.status).toBe(400);
  });
});
