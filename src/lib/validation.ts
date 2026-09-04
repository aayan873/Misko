import { z } from "zod";

// Learner ids are client-generated UUIDs (crypto.randomUUID()) — no auth/PII collected,
// see prompt.md §19 (avoid unnecessary personal data collection).
export const learnerIdSchema = z.string().uuid();

export const submitAnswerSchema = z.object({
  learnerId: learnerIdSchema,
  problemId: z.string().min(1).max(200),
  answer: z.string().min(1).max(200),
  confidenceBefore: z.number().int().min(1).max(5),
  hintLevel: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  // Optional freeform "show your work" — when the numeric/expression answer doesn't
  // match a known distractor, this lets Gemini classify the misconception from
  // reasoning instead of falling back to a generic message. Untrusted student input.
  shownWork: z.string().max(600).optional(),
});

export const nextProblemQuerySchema = z.object({
  learnerId: learnerIdSchema,
});

export const learnerCreateSchema = z.object({
  learnerId: learnerIdSchema,
  displayName: z.string().trim().min(1).max(60).optional(),
});

export const spotMistakeQuerySchema = z.object({
  learnerId: learnerIdSchema,
});

export const spotMistakeSubmitSchema = z.object({
  roundId: z.string().min(1).max(200),
  selectedStepIndex: z.number().int().min(0).max(20),
});

// Client resizes images before upload (see resizeImage.ts) — this cap is a
// backstop against abuse, not the primary size control. ~4MB of base64 covers a
// generously-sized resized photo with real margin under typical serverless
// request-body limits.
export const transcribeWorkSchema = z.object({
  imageBase64: z.string().min(1).max(4_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  problemPromptText: z.string().min(1).max(300),
});
