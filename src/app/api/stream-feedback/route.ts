import { NextRequest, NextResponse } from "next/server";
import { getCachedProblem } from "@/lib/problemCache";
import { getMisconception } from "@/lib/domain/misconceptions";
import { streamCorrectFeedback, streamDiagnosis } from "@/lib/ai/gemini";
import { streamFeedbackSchema } from "@/lib/validation";
import { checkRateLimit } from "@/lib/rateLimit";

/**
 * The other half of a submission's AI text (prompt_v2.md A1): /api/submit-answer
 * does the analysis, mastery update, and misconception matching synchronously
 * as before, then the CLIENT calls this route separately for the actual
 * hint/feedback text, streamed token-by-token via Gemini's generateContentStream
 * instead of resolving once with the full string. Same rate-limit budget as
 * submit-answer, under its own keys — this replaces AI-cost work that used to
 * happen inline in that route, not additional work on top of it.
 */
const PER_LEARNER_LIMIT = 60;
const PER_LEARNER_WINDOW_MS = 5 * 60 * 1000;
const GLOBAL_LIMIT = 300;
const GLOBAL_WINDOW_MS = 5 * 60 * 1000;
const GLOBAL_KEY = "stream-feedback:global";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = streamFeedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { learnerId, problemId, answer, outcome, misconceptionId, hintLevel, recentMisconceptionNames } =
    parsed.data;

  const global = checkRateLimit(GLOBAL_KEY, GLOBAL_LIMIT, GLOBAL_WINDOW_MS);
  if (!global.allowed) {
    return NextResponse.json({ error: "Busy right now — try again in a few minutes." }, { status: 429 });
  }
  const perLearner = checkRateLimit(`stream-feedback:${learnerId}`, PER_LEARNER_LIMIT, PER_LEARNER_WINDOW_MS);
  if (!perLearner.allowed) {
    return NextResponse.json({ error: "Too many submissions in a row — slow down a little." }, { status: 429 });
  }

  const problem = getCachedProblem(problemId);
  if (!problem) {
    return NextResponse.json({ error: "Problem expired or not found — request a new one." }, { status: 404 });
  }

  const misconception = misconceptionId ? getMisconception(misconceptionId) ?? null : null;
  const generator =
    outcome === "correct"
      ? streamCorrectFeedback(problem)
      : streamDiagnosis({
          problem,
          learnerAnswer: answer,
          misconception,
          hintLevel,
          recentMisconceptionNames: recentMisconceptionNames ?? [],
        });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        // streamDiagnosis/streamCorrectFeedback already fall back internally on
        // any Gemini error — reaching here means something broke in the reading
        // loop itself, not the AI call. Nothing sensible to recover into mid-stream,
        // so just end it; the client is left with whatever text arrived so far.
        console.error("[stream-feedback] stream reading loop failed:", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
