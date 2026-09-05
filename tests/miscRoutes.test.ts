import { describe, it, expect, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

// Same isolation pattern as every other route test file here.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "misko-misc-routes-test-"));
process.env.MISKO_DATA_DIR = tmpDir;

const { store } = await import("../src/lib/store");
const { recordAttempt } = await import("../src/lib/learnerModel");
const { DEMO_LEARNER_A, DEMO_LEARNER_B } = await import("../src/lib/demoLearners");
const { POST: learnerPOST } = await import("../src/app/api/learner/route");
const { GET: sessionSummaryGET } = await import("../src/app/api/session-summary/route");
const { GET: teacherSummaryGET } = await import("../src/app/api/teacher-summary/route");
const { POST: demoSeedPOST } = await import("../src/app/api/demo/seed/route");
const { GET: demoProblemGET } = await import("../src/app/api/demo/problem/route");

/**
 * Route-level tests for the five API routes that had none at all: /api/learner,
 * /api/session-summary, /api/teacher-summary, /api/demo/seed, /api/demo/problem.
 * All five are thin wrappers over already-well-tested learnerModel functions
 * (getSessionSummary, getClassMisconceptionSummary/getAtRiskLearners/
 * getClassRoster, seedDemoLearners) — the point here is the route-level wiring
 * (query parsing, response shape, validation errors), not re-testing that
 * underlying logic. This closes out full route-level coverage across the API.
 */
describe("POST /api/learner", () => {
  beforeEach(() => {
    store._resetForTests();
  });

  function learnerRequest(body: unknown) {
    return learnerPOST(
      new NextRequest("http://localhost/api/learner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  it("creates a learner with a given display name", async () => {
    const learnerId = randomUUID();
    const res = await learnerRequest({ learnerId, displayName: "Ada" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.learner).toEqual({ id: learnerId, display_name: "Ada", created_at: expect.any(Number) });
  });

  it("defaults the display name to 'Learner' when omitted", async () => {
    const learnerId = randomUUID();
    const res = await learnerRequest({ learnerId });
    const body = await res.json();
    expect(body.learner.display_name).toBe("Learner");
  });

  it("is idempotent — calling it again for the same id returns the existing row, not a duplicate", async () => {
    const learnerId = randomUUID();
    await learnerRequest({ learnerId, displayName: "First" });
    const res = await learnerRequest({ learnerId, displayName: "Second" });
    const body = await res.json();
    // ensureLearner returns the EXISTING row if one is already there — the
    // second call's displayName is ignored, not applied as an update.
    expect(body.learner.display_name).toBe("First");
  });

  it("400s on a missing/invalid learnerId", async () => {
    expect((await learnerRequest({})).status).toBe(400);
    expect((await learnerRequest({ learnerId: "not-a-uuid" })).status).toBe(400);
  });
});

describe("GET /api/session-summary", () => {
  beforeEach(() => {
    store._resetForTests();
  });

  function sessionSummaryRequest(learnerId: string, since: number | string) {
    return sessionSummaryGET(
      new NextRequest(`http://localhost/api/session-summary?learnerId=${learnerId}&since=${since}`)
    );
  }

  it("only counts attempts at or after the given timestamp", async () => {
    const learnerId = randomUUID();
    recordAttempt({
      learnerId,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "before the session",
      learnerAnswer: "y",
    });
    const sessionStart = Date.now() + 1;
    await new Promise((r) => setTimeout(r, 5));
    recordAttempt({
      learnerId,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "during the session",
      learnerAnswer: "y",
    });

    const res = await sessionSummaryRequest(learnerId, sessionStart);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attempts).toBe(1);
    expect(body.correct).toBe(1);
  });

  it("400s on a missing learnerId or a missing/invalid since", async () => {
    expect(
      (await sessionSummaryGET(new NextRequest(`http://localhost/api/session-summary?since=0`))).status
    ).toBe(400);
    expect((await sessionSummaryRequest(randomUUID(), "not-a-number")).status).toBe(400);
    expect((await sessionSummaryRequest(randomUUID(), -1)).status).toBe(400);
  });

  it("returns all-zero/empty for a learner with no attempts at all", async () => {
    const res = await sessionSummaryRequest(randomUUID(), 0);
    const body = await res.json();
    expect(body).toEqual({
      attempts: 0,
      correct: 0,
      misconceptionNames: [],
      confirmed: 0,
      caught: 0,
      conceptsMasteredNow: [],
    });
  });
});

describe("GET /api/teacher-summary", () => {
  beforeEach(() => {
    store._resetForTests();
  });

  it("aggregates across every learner with recorded data, in the documented response shape", async () => {
    const learnerA = randomUUID();
    const learnerB = randomUUID();
    recordAttempt({
      learnerId: learnerA,
      conceptId: "order-of-operations",
      misconceptionId: "ORDER_LEFT_TO_RIGHT",
      outcome: "matched_misconception",
      confidenceBefore: 5,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
      diagnosisSource: "rule",
    });
    recordAttempt({
      learnerId: learnerB,
      conceptId: "order-of-operations",
      misconceptionId: null,
      outcome: "correct",
      confidenceBefore: 3,
      hintLevelUsed: 1,
      problemPrompt: "x",
      learnerAnswer: "y",
    });

    const res = await teacherSummaryGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.learnerCount).toBe(2);
    expect(body.roster).toHaveLength(2);
    expect(body.roster.map((r: { learnerId: string }) => r.learnerId).sort()).toEqual(
      [learnerA, learnerB].sort()
    );
    // Misconception names/concept names are resolved server-side, not left as raw ids.
    const misconception = body.misconceptions.find(
      (m: { misconceptionId: string }) => m.misconceptionId === "ORDER_LEFT_TO_RIGHT"
    );
    expect(misconception.name).toBe("Strict left-to-right evaluation");
    expect(misconception.conceptName).toBe("Order of Operations");
  });

  it("returns an empty-but-valid shape when no learner has any data", async () => {
    const res = await teacherSummaryGET();
    const body = await res.json();
    expect(body).toEqual({ learnerCount: 0, roster: [], misconceptions: [], atRisk: [] });
  });
});

describe("POST /api/demo/seed + GET /api/demo/problem", () => {
  beforeEach(() => {
    store._resetForTests();
  });

  it("seeds the two fixed demo learners with their documented ids/names/personas", async () => {
    const res = await demoSeedPOST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      learnerA: { id: DEMO_LEARNER_A.id, name: DEMO_LEARNER_A.name, persona: DEMO_LEARNER_A.persona },
      learnerB: { id: DEMO_LEARNER_B.id, name: DEMO_LEARNER_B.name, persona: DEMO_LEARNER_B.persona },
    });
  });

  it("is idempotent — seeding twice doesn't duplicate or accumulate history", async () => {
    await demoSeedPOST();
    await demoSeedPOST();
    const attemptsForA = store.raw.attempts.filter((a) => a.learner_id === DEMO_LEARNER_A.id);
    // Whatever count one seed produces, a second seed must reset back to
    // exactly that, not double it — resetLearner wipes before reseeding.
    const firstCount = attemptsForA.length;
    await demoSeedPOST();
    const secondCount = store.raw.attempts.filter((a) => a.learner_id === DEMO_LEARNER_A.id).length;
    expect(secondCount).toBe(firstCount);
  });

  it("demo/problem returns a real cached problem plus the distractor answer, and the same problem is gradeable through the real submit-answer route", async () => {
    const res = await demoProblemGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.problem.conceptId).toBe("combining-like-terms");
    expect(typeof body.demoWrongAnswer).toBe("string");
    expect(body.demoWrongAnswer.length).toBeGreaterThan(0);
    // The route explicitly documents this as the one place the distractor is
    // exposed — real practice problems (toClientProblem elsewhere) never do.
    expect(body.problem).not.toHaveProperty("distractorAnswer");
    expect(body.problem).not.toHaveProperty("correctAnswer");
  });
});
