import { NextRequest } from "next/server";

/**
 * Every POST route here calls req.json() and only bounds the payload
 * afterward, via Zod's per-field max() checks — but that validation runs
 * AFTER the full body is already buffered and parsed. Next.js App Router
 * route handlers (the Web Fetch Request API) impose no size limit of their
 * own; on a self-hosted `next start` deployment (the only kind that actually
 * works for this app — see README "Limitations" on Vercel) there's no
 * platform cap either. A very large request body would still get fully
 * read into memory before any Zod check has a chance to reject it.
 *
 * This reads the body as a stream with a hard cap enforced WHILE reading —
 * not by trusting the Content-Length header alone, which can be absent or
 * wrong (chunked transfer encoding, or just a caller lying about it).
 */
export async function readJsonBody(
  req: NextRequest,
  maxBytes: number
): Promise<{ ok: true; body: unknown } | { ok: false; reason: "too_large" | "invalid_json" | "no_body" }> {
  const declaredLength = req.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  const reader = req.body?.getReader();
  if (!reader) return { ok: false, reason: "no_body" };

  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too_large" };
    }
    chunks.push(value);
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  try {
    const text = new TextDecoder().decode(combined);
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
}
