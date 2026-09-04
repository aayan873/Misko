import { NextRequest, NextResponse } from "next/server";
import { transcribeHandwriting } from "@/lib/ai/gemini";
import { transcribeWorkSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/readJsonBody";

// This is the one endpoint in the app that calls a real, billed Gemini vision
// request with essentially no natural throttle (unlike /api/submit-answer,
// which is paced by the practice loop itself). Two layers: a per-learner
// limit for a reasonable individual pace, and a global limit as the actual
// budget backstop — a per-learner limit alone is trivially bypassed by
// generating new learner ids, so it's the global one that's load-bearing.
const PER_LEARNER_LIMIT = 10;
const PER_LEARNER_WINDOW_MS = 5 * 60 * 1000;
const GLOBAL_LIMIT = 40;
const GLOBAL_WINDOW_MS = 5 * 60 * 1000;
const GLOBAL_KEY = "transcribe-work:global";
// The image itself is capped at 4MB base64 by the Zod schema (see
// validation.ts) — this is that plus real margin for the small text fields,
// checked before parsing rather than after (see readJsonBody.ts).
const MAX_TRANSCRIBE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const read = await readJsonBody(req, MAX_TRANSCRIBE_BYTES);
  if (!read.ok) {
    return NextResponse.json(
      { transcript: null, message: read.reason === "too_large" ? "That photo is too large." : "Invalid request." },
      { status: read.reason === "too_large" ? 413 : 400 }
    );
  }
  const parsed = transcribeWorkSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { learnerId, imageBase64, mimeType, problemPromptText } = parsed.data;

  const global = checkRateLimit(GLOBAL_KEY, GLOBAL_LIMIT, GLOBAL_WINDOW_MS);
  if (!global.allowed) {
    return NextResponse.json(
      { transcript: null, message: "Photo reading is busy right now — try again in a few minutes, or type your work instead." },
      { status: 429 }
    );
  }
  const perLearner = checkRateLimit(`transcribe-work:${learnerId}`, PER_LEARNER_LIMIT, PER_LEARNER_WINDOW_MS);
  if (!perLearner.allowed) {
    return NextResponse.json(
      { transcript: null, message: "Too many photo reads in a row — wait a bit, or type your work instead." },
      { status: 429 }
    );
  }

  const result = await transcribeHandwriting({ imageBase64, mimeType, problemPromptText });

  if (!result.attempted) {
    return NextResponse.json(
      { transcript: null, message: "Reading photos needs a Gemini API key — type your work instead, or add a key in .env." },
      { status: 200 }
    );
  }
  if (!result.transcript) {
    return NextResponse.json(
      { transcript: null, message: "Couldn't read that clearly — try a clearer photo, or type it instead." },
      { status: 200 }
    );
  }
  return NextResponse.json({ transcript: result.transcript, message: null });
}
