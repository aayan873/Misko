import { GoogleGenerativeAI } from "@google/generative-ai";
import { Misconception } from "../domain/misconceptions";
import { ProblemInstance } from "../domain/problemEngine";
import {
  buildClassificationPrompt,
  buildCorrectFeedbackPrompt,
  buildDiagnosisPrompt,
  buildReasoningCheckPrompt,
  CLASSIFICATION_SYSTEM_INSTRUCTIONS,
  REASONING_CHECK_SYSTEM_INSTRUCTIONS,
  SYSTEM_INSTRUCTIONS,
} from "./prompts";
import { fallbackCorrectFeedback, fallbackDiagnosis } from "./fallback";

const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-1.5-flash";

function getClient(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

export interface DiagnosisResponse {
  text: string;
  source: "gemini" | "fallback";
}

const TIMEOUT_MS = 8000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI request timed out")), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

export async function generateDiagnosis(params: {
  problem: ProblemInstance;
  learnerAnswer: string;
  misconception: Misconception | null;
  hintLevel: 1 | 2 | 3;
  recentMisconceptionNames: string[];
}): Promise<DiagnosisResponse> {
  const client = getClient();
  if (!client) {
    return {
      text: fallbackDiagnosis(params.misconception, params.hintLevel, params.recentMisconceptionNames),
      source: "fallback",
    };
  }

  try {
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTIONS,
    });
    const prompt = buildDiagnosisPrompt(params);
    const result = await withTimeout(model.generateContent(prompt), TIMEOUT_MS);
    const text = result.response.text().trim();
    if (!text) throw new Error("Empty response from Gemini");
    return { text, source: "gemini" };
  } catch (err) {
    console.error("[gemini] diagnosis generation failed, using fallback:", err);
    return {
      text: fallbackDiagnosis(params.misconception, params.hintLevel, params.recentMisconceptionNames),
      source: "fallback",
    };
  }
}

export async function generateCorrectFeedback(problem: ProblemInstance): Promise<DiagnosisResponse> {
  const client = getClient();
  if (!client) {
    return { text: fallbackCorrectFeedback(problem), source: "fallback" };
  }

  try {
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: SYSTEM_INSTRUCTIONS,
    });
    const prompt = buildCorrectFeedbackPrompt(problem);
    const result = await withTimeout(model.generateContent(prompt), TIMEOUT_MS);
    const text = result.response.text().trim();
    if (!text) throw new Error("Empty response from Gemini");
    return { text, source: "gemini" };
  } catch (err) {
    console.error("[gemini] correct-feedback generation failed, using fallback:", err);
    return { text: fallbackCorrectFeedback(problem), source: "fallback" };
  }
}

export interface ClassificationResult {
  misconceptionId: string | null;
  confidence: "low" | "medium" | "high" | null;
  /** false when Gemini wasn't configured/failed — caller should not treat this as a real classification attempt. */
  attempted: boolean;
}

/**
 * Classifies a learner's own written reasoning against a concept's misconception
 * taxonomy — used when the answer alone doesn't match a known distractor value
 * (see ARCHITECTURE.md "Future work"). Unlike generateDiagnosis, this genuinely
 * asks the model to reason/classify, not just phrase a pre-computed result — so
 * it has no deterministic fallback: if Gemini is unavailable, classification is
 * simply skipped (attempted: false) and the caller falls back to generic feedback.
 */
export async function classifyFreeformMisconception(params: {
  problem: ProblemInstance;
  learnerAnswer: string;
  shownWork: string;
  candidates: Misconception[];
}): Promise<ClassificationResult> {
  const client = getClient();
  if (!client) return { misconceptionId: null, confidence: null, attempted: false };

  try {
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: CLASSIFICATION_SYSTEM_INSTRUCTIONS,
      generationConfig: { responseMimeType: "application/json" },
    });
    const prompt = buildClassificationPrompt(params);
    const result = await withTimeout(model.generateContent(prompt), TIMEOUT_MS);
    const raw = result.response.text().trim();
    const parsed = JSON.parse(raw) as { misconceptionId?: unknown; confidence?: unknown };

    const validIds = new Set(params.candidates.map((c) => c.id));
    const id =
      typeof parsed.misconceptionId === "string" && validIds.has(parsed.misconceptionId)
        ? parsed.misconceptionId
        : null;
    const confidence =
      parsed.confidence === "low" || parsed.confidence === "medium" || parsed.confidence === "high"
        ? parsed.confidence
        : null;

    return { misconceptionId: id, confidence: id ? confidence : null, attempted: true };
  } catch (err) {
    console.error("[gemini] freeform classification failed:", err);
    return { misconceptionId: null, confidence: null, attempted: true };
  }
}

export interface ReasoningCheckResult {
  suspectMisconceptionId: string | null;
  confidence: "low" | "medium" | "high" | null;
  attempted: boolean;
}

/**
 * Raises a SOFT, SILENT hypothesis that a correct answer's reasoning may not hold
 * up ("the Correct Answer Trap" — see buildReasoningCheckPrompt for citations and
 * the accuracy caveats). This function's output is NEVER shown to the learner
 * directly — the caller (see decideNextProblem's pending-confirmation logic in
 * learnerModel.ts) always re-checks the hypothesis with a real, deterministically-
 * graded follow-up problem before anything is ever surfaced. "low" confidence
 * hypotheses are discarded here, not just downstream, to keep the false-positive
 * rate as low as possible going into that check.
 */
export async function classifyCorrectReasoning(params: {
  problem: ProblemInstance;
  learnerAnswer: string;
  shownWork: string;
  candidates: Misconception[];
}): Promise<ReasoningCheckResult> {
  const client = getClient();
  if (!client) return { suspectMisconceptionId: null, confidence: null, attempted: false };

  try {
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: REASONING_CHECK_SYSTEM_INSTRUCTIONS,
      generationConfig: { responseMimeType: "application/json" },
    });
    const prompt = buildReasoningCheckPrompt(params);
    const result = await withTimeout(model.generateContent(prompt), TIMEOUT_MS);
    const raw = result.response.text().trim();
    const parsed = JSON.parse(raw) as { suspectMisconceptionId?: unknown; confidence?: unknown };

    const validIds = new Set(params.candidates.map((c) => c.id));
    const id =
      typeof parsed.suspectMisconceptionId === "string" && validIds.has(parsed.suspectMisconceptionId)
        ? parsed.suspectMisconceptionId
        : null;
    const confidence =
      parsed.confidence === "low" || parsed.confidence === "medium" || parsed.confidence === "high"
        ? parsed.confidence
        : null;

    // Discard low-confidence hypotheses outright — see function doc.
    if (confidence === "low") {
      return { suspectMisconceptionId: null, confidence: null, attempted: true };
    }

    return { suspectMisconceptionId: id, confidence: id ? confidence : null, attempted: true };
  } catch (err) {
    console.error("[gemini] reasoning check failed:", err);
    return { suspectMisconceptionId: null, confidence: null, attempted: true };
  }
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
