import { describe, it, expect, beforeEach, vi } from "vitest";
import { checkRateLimit, _resetRateLimitsForTests } from "../src/lib/rateLimit";

beforeEach(() => {
  _resetRateLimitsForTests();
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows calls up to the limit, then blocks", () => {
    const key = "user-a";
    for (let i = 0; i < 3; i++) {
      expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true);
    }
    const blocked = checkRateLimit(key, 3, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    expect(checkRateLimit("user-a", 1, 60_000).allowed).toBe(true);
    expect(checkRateLimit("user-a", 1, 60_000).allowed).toBe(false);
    // A different key isn't affected by user-a's usage.
    expect(checkRateLimit("user-b", 1, 60_000).allowed).toBe(true);
  });

  it("allows calls again once the window has passed", () => {
    vi.useFakeTimers();
    const key = "user-c";
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(true);
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(checkRateLimit(key, 1, 1000).allowed).toBe(true);
    vi.useRealTimers();
  });

  it("a limit of 0 blocks immediately", () => {
    expect(checkRateLimit("user-d", 0, 60_000).allowed).toBe(false);
  });
});
