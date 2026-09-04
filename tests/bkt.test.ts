import { describe, it, expect } from "vitest";
import { DEFAULT_BKT_PARAMS, BKT_MASTERY_THRESHOLD, initialMastery, updateMastery } from "../src/lib/bkt";

describe("bkt", () => {
  it("initialMastery returns the prior P(L0)", () => {
    expect(initialMastery()).toBe(DEFAULT_BKT_PARAMS.pInit);
  });

  it("a correct answer increases P(knows)", () => {
    const p0 = initialMastery();
    const p1 = updateMastery(p0, true);
    expect(p1).toBeGreaterThan(p0);
  });

  it("a wrong answer decreases P(knows)", () => {
    const p0 = initialMastery();
    const p1 = updateMastery(p0, false);
    expect(p1).toBeLessThan(p0);
  });

  it("stays within [0, 1] over many updates in either direction", () => {
    let p = initialMastery();
    for (let i = 0; i < 50; i++) p = updateMastery(p, true);
    expect(p).toBeLessThanOrEqual(1);
    expect(p).toBeGreaterThanOrEqual(0);

    p = initialMastery();
    for (let i = 0; i < 50; i++) p = updateMastery(p, false);
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(1);
  });

  it("crosses the mastery threshold within a handful of consecutive correct answers", () => {
    let p = initialMastery();
    let steps = 0;
    while (p < BKT_MASTERY_THRESHOLD && steps < 20) {
      p = updateMastery(p, true);
      steps++;
    }
    expect(p).toBeGreaterThanOrEqual(BKT_MASTERY_THRESHOLD);
    expect(steps).toBeLessThanOrEqual(5);
  });

  it("a single slip after reaching mastery drops the estimate but not to zero", () => {
    let p = initialMastery();
    while (p < BKT_MASTERY_THRESHOLD) p = updateMastery(p, true);
    const afterSlip = updateMastery(p, false);
    expect(afterSlip).toBeLessThan(p);
    expect(afterSlip).toBeGreaterThan(0.5);
  });

  it("repeated wrong answers keep pushing the estimate down, never negative", () => {
    let p = initialMastery();
    for (let i = 0; i < 10; i++) {
      const next = updateMastery(p, false);
      expect(next).toBeLessThanOrEqual(p + 1e-9);
      p = next;
    }
    expect(p).toBeGreaterThanOrEqual(0);
  });
});
