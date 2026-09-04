import { describe, it, expect, beforeEach } from "vitest";
import os from "os";
import path from "path";
import fs from "fs";
import { NextRequest } from "next/server";
import { randomUUID } from "crypto";

// Same isolation pattern as every other route test file here.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "misko-import-export-route-test-"));
process.env.MISKO_DATA_DIR = tmpDir;

const { store } = await import("../src/lib/store");
const { recordAttempt, recordSpotMistakeAttempt } = await import("../src/lib/learnerModel");
const { GET: exportGET } = await import("../src/app/api/export/route");
const { POST: importPOST } = await import("../src/app/api/import/route");

/**
 * Route-level tests for /api/export and /api/import — the learnerModel-level
 * round-trip (exportLearnerData/importLearnerData called directly) is already
 * covered by integration.test.ts, but nothing before this exercised the actual
 * HTTP handlers: exportQuerySchema, importDataSchema's strictness against
 * real exported JSON, the readJsonBody size-cap wiring, or the exact
 * request/response shape the frontend (ExportImport.tsx) actually depends on.
 */

function exportRequest(learnerId: string) {
  return exportGET(new NextRequest(`http://localhost/api/export?learnerId=${learnerId}`));
}

// Mirrors exactly what ExportImport.tsx sends on restore: the flat export
// blob's four array fields wrapped under { learnerId, data }.
function importRequestBody(targetLearnerId: string, exported: Record<string, unknown>) {
  return {
    learnerId: targetLearnerId,
    data: {
      conceptMastery: exported.conceptMastery ?? [],
      misconceptionEvents: exported.misconceptionEvents ?? [],
      attempts: exported.attempts ?? [],
      spotMistakeAttempts: exported.spotMistakeAttempts ?? [],
    },
  };
}

function importRequest(body: unknown, headers?: Record<string, string>) {
  return importPOST(
    new NextRequest("http://localhost/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    })
  );
}

function seedRealisticLearner(learnerId: string) {
  recordAttempt({
    learnerId,
    conceptId: "order-of-operations",
    misconceptionId: "ORDER_ADD_BEFORE_MULT",
    outcome: "matched_misconception",
    confidenceBefore: 4,
    hintLevelUsed: 1,
    problemPrompt: "3 + 4 * 2",
    learnerAnswer: "14",
    diagnosisSource: "rule",
  });
  recordAttempt({
    learnerId,
    conceptId: "order-of-operations",
    misconceptionId: null,
    outcome: "correct",
    confidenceBefore: 3,
    hintLevelUsed: 1,
    problemPrompt: "5 + 2 * 3",
    learnerAnswer: "11",
  });
  recordSpotMistakeAttempt({
    learnerId,
    misconceptionId: "NEG_MULT_SIGN",
    conceptId: "negative-numbers",
    correct: true,
  });
}

describe("GET /api/export", () => {
  beforeEach(() => {
    store._resetForTests();
  });

  it("returns the exact shape ExportImport.tsx depends on for a real learner", async () => {
    const learnerId = randomUUID();
    seedRealisticLearner(learnerId);

    const res = await exportRequest(learnerId);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.learnerId).toBe(learnerId);
    expect(typeof body.exportedAt).toBe("number");
    expect(body.conceptMastery).toHaveLength(1);
    expect(body.attempts).toHaveLength(2);
    expect(body.misconceptionEvents).toHaveLength(1);
    expect(body.spotMistakeAttempts).toHaveLength(1);
    // Internal ids/learner_id are stripped from the row-level exports — only
    // conceptMastery (which the schema keeps learner_id-free but id-free too
    // in practice) needs checking here for the fields that must never leak.
    expect(body.attempts[0]).not.toHaveProperty("id");
    expect(body.attempts[0]).not.toHaveProperty("learner_id");
  });

  it("400s on a missing or invalid learnerId", async () => {
    expect((await exportGET(new NextRequest("http://localhost/api/export"))).status).toBe(400);
    expect(
      (await exportGET(new NextRequest("http://localhost/api/export?learnerId=not-a-uuid"))).status
    ).toBe(400);
  });

  it("returns empty arrays, not an error, for a learner with no data at all", async () => {
    const res = await exportRequest(randomUUID());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conceptMastery).toEqual([]);
    expect(body.attempts).toEqual([]);
    expect(body.misconceptionEvents).toEqual([]);
    expect(body.spotMistakeAttempts).toEqual([]);
  });
});

describe("POST /api/import", () => {
  beforeEach(() => {
    store._resetForTests();
  });

  it("round-trips real exported data into a different learner id via the actual HTTP routes", async () => {
    const source = randomUUID();
    seedRealisticLearner(source);

    const exported = await (await exportRequest(source)).json();
    const target = randomUUID();
    const res = await importRequest(importRequestBody(target, exported));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const restored = await (await exportRequest(target)).json();
    // conceptMastery rows carry their own learner_id (unlike attempts/
    // misconceptionEvents/spotMistakeAttempts, which are learner_id-free) —
    // that field is SUPPOSED to differ, and differing correctly (rewritten to
    // the new target id, not left pointing at the source) is worth asserting
    // explicitly rather than just normalizing it away.
    expect(restored.conceptMastery.every((r: { learner_id: string }) => r.learner_id === target)).toBe(
      true
    );
    const stripLearnerId = (rows: { learner_id?: string }[]) => rows.map(({ learner_id, ...rest }) => rest);
    expect({
      ...restored,
      learnerId: undefined,
      exportedAt: undefined,
      conceptMastery: stripLearnerId(restored.conceptMastery),
    }).toEqual({
      ...exported,
      learnerId: undefined,
      exportedAt: undefined,
      conceptMastery: stripLearnerId(exported.conceptMastery),
    });
  });

  it("is a clean replace, not a merge, for a learner that already had different data", async () => {
    const target = randomUUID();
    seedRealisticLearner(target);
    expect((await (await exportRequest(target)).json()).attempts).toHaveLength(2);

    const emptyBackup = { conceptMastery: [], misconceptionEvents: [], attempts: [], spotMistakeAttempts: [] };
    const res = await importRequest({ learnerId: target, data: emptyBackup });
    expect(res.status).toBe(200);

    const after = await (await exportRequest(target)).json();
    expect(after.attempts).toEqual([]);
    expect(after.conceptMastery).toEqual([]);
  });

  it("accepts a backup missing spotMistakeAttempts (a field that didn't always exist)", async () => {
    const target = randomUUID();
    const res = await importRequest({
      learnerId: target,
      data: {
        conceptMastery: [],
        misconceptionEvents: [],
        attempts: [
          {
            concept_id: "order-of-operations",
            misconception_id: null,
            outcome: "correct",
            confidence_before: 3,
            hint_level_used: 1,
            created_at: Date.now(),
            diagnosis_source: null,
            confirmation_status: "none",
            problem_prompt: "old backup, no spotMistakeAttempts field at all",
          },
        ],
        // spotMistakeAttempts deliberately omitted
      },
    });
    expect(res.status).toBe(200);
    const after = await (await exportRequest(target)).json();
    expect(after.attempts).toHaveLength(1);
    expect(after.spotMistakeAttempts).toEqual([]);
  });

  it("accepts a conceptMastery row missing mastered_at (pre-dates that field)", async () => {
    const target = randomUUID();
    const res = await importRequest({
      learnerId: target,
      data: {
        conceptMastery: [
          {
            concept_id: "order-of-operations",
            attempts: 5,
            correct: 4,
            streak: 2,
            p_mastery: 0.9,
            mastered: 0,
            // mastered_at omitted on purpose
            review_interval: 4,
            due_after_attempts: null,
            updated_at: Date.now(),
          },
        ],
        misconceptionEvents: [],
        attempts: [],
        spotMistakeAttempts: [],
      },
    });
    expect(res.status).toBe(200);
    const after = await (await exportRequest(target)).json();
    expect(after.conceptMastery).toHaveLength(1);
    expect(after.conceptMastery[0].mastered_at).toBeNull();
  });

  it("400s on structurally invalid JSON that doesn't match the schema at all", async () => {
    expect((await importRequest({ not: "a valid import" })).status).toBe(400);
    expect((await importRequest({ learnerId: "not-a-uuid", data: {} })).status).toBe(400);
  });

  it("rejects a row with an out-of-enum concept_id rather than silently accepting it", async () => {
    const res = await importRequest({
      learnerId: randomUUID(),
      data: {
        conceptMastery: [],
        misconceptionEvents: [],
        attempts: [
          {
            concept_id: "not-a-real-concept",
            misconception_id: null,
            outcome: "correct",
            confidence_before: 3,
            hint_level_used: 1,
            created_at: Date.now(),
            diagnosis_source: null,
            confirmation_status: "none",
            problem_prompt: "x",
          },
        ],
        spotMistakeAttempts: [],
      },
    });
    expect(res.status).toBe(400);
  });

  it("413s a request whose declared Content-Length exceeds the size cap, without buffering it", async () => {
    // Same technique as readJsonBody.test.ts's Content-Length test: a huge
    // declared length with a tiny real body, so this stays fast and doesn't
    // actually allocate a 16MB+ string just to prove the cap is wired up.
    const smallBody = JSON.stringify({ learnerId: randomUUID(), data: {} });
    const res = await importPOST(
      new NextRequest("http://localhost/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": String(20 * 1024 * 1024) },
        body: smallBody,
      })
    );
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toMatch(/too large/i);
  });
});
