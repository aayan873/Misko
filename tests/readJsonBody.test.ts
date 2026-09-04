import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { readJsonBody } from "../src/lib/readJsonBody";

function makeRequest(body: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("readJsonBody", () => {
  it("parses a normal-sized JSON body", async () => {
    const req = makeRequest(JSON.stringify({ a: 1, b: "two" }));
    const result = await readJsonBody(req, 1000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.body).toEqual({ a: 1, b: "two" });
  });

  it("rejects a body larger than the cap, enforced during streaming not just via Content-Length", async () => {
    const bigString = "x".repeat(10_000);
    const req = makeRequest(JSON.stringify({ data: bigString }));
    const result = await readJsonBody(req, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too_large");
  });

  it("rejects up front via a declared Content-Length that exceeds the cap", async () => {
    const bigString = "x".repeat(10_000);
    const body = JSON.stringify({ data: bigString });
    const req = makeRequest(body, { "Content-Length": String(body.length) });
    const result = await readJsonBody(req, 100);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too_large");
  });

  it("rejects invalid JSON within the size cap", async () => {
    const req = makeRequest("{not valid json");
    const result = await readJsonBody(req, 1000);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid_json");
  });

  it("accepts a body right at the cap boundary", async () => {
    const body = JSON.stringify({ a: "x".repeat(90) });
    const req = makeRequest(body);
    const result = await readJsonBody(req, body.length);
    expect(result.ok).toBe(true);
  });
});
