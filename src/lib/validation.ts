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
  learnerId: learnerIdSchema,
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

export const exportQuerySchema = z.object({
  learnerId: learnerIdSchema,
});

// Import is untrusted uploaded JSON (see /api/import) — schemas here mirror
// the store's row shapes exactly, deliberately strict (bounded strings,
// closed enums, no free-form objects) rather than a loose passthrough.
const conceptIdEnum = z.enum([
  "order-of-operations",
  "negative-numbers",
  "distributing",
  "combining-like-terms",
  "linear-equations",
]);
const diagnosisSourceEnum = z.enum(["rule", "ai", "similarity"]).nullable();
const zeroOrOne = z.union([z.literal(0), z.literal(1)]);

const importConceptMasteryRowSchema = z.object({
  concept_id: conceptIdEnum,
  attempts: z.number().int().min(0).max(1_000_000),
  correct: z.number().int().min(0).max(1_000_000),
  streak: z.number().int().min(0).max(1_000_000),
  p_mastery: z.number().min(0).max(1),
  mastered: zeroOrOne,
  review_interval: z.number().int().min(0).max(100_000),
  due_after_attempts: z.number().int().min(0).max(10_000_000).nullable(),
  updated_at: z.number(),
});

const importMisconceptionEventRowSchema = z.object({
  misconception_id: z.string().min(1).max(100),
  concept_id: conceptIdEnum,
  problem_prompt: z.string().max(300),
  learner_answer: z.string().max(300),
  resolved: zeroOrOne,
  created_at: z.number(),
  diagnosis_source: diagnosisSourceEnum,
});

const importAttemptRowSchema = z.object({
  concept_id: conceptIdEnum,
  misconception_id: z.string().max(100).nullable(),
  outcome: z.string().max(50),
  confidence_before: z.number().int().min(1).max(5),
  hint_level_used: z.number().int().min(1).max(3),
  created_at: z.number(),
  diagnosis_source: diagnosisSourceEnum,
  confirmation_status: z.enum(["none", "pending", "confirmed", "caught"]),
  problem_prompt: z.string().max(300),
});

const importSpotMistakeRowSchema = z.object({
  misconception_id: z.string().min(1).max(100),
  concept_id: conceptIdEnum,
  correct: zeroOrOne,
  created_at: z.number(),
});

export const importDataSchema = z.object({
  learnerId: learnerIdSchema,
  data: z.object({
    conceptMastery: z.array(importConceptMasteryRowSchema).max(10),
    misconceptionEvents: z.array(importMisconceptionEventRowSchema).max(5000),
    spotMistakeAttempts: z.array(importSpotMistakeRowSchema).max(20_000).optional(),
    attempts: z.array(importAttemptRowSchema).max(20_000),
  }),
});
