import { NextRequest, NextResponse } from "next/server";
import { analyzeAnswer } from "@/lib/analyzer";
import { getCachedProblem } from "@/lib/problemCache";
import { getMisconception, misconceptionsForConcept } from "@/lib/domain/misconceptions";
import {
  recordAttempt,
  getMisconceptionHistory,
  pendingConfirmation,
  resolvePendingConfirmation,
  lastMisconceptionOnConcept,
} from "@/lib/learnerModel";
import {
  classifyCorrectReasoning,
  classifyFreeformMisconception,
  generateCorrectFeedback,
  generateDiagnosis,
} from "@/lib/ai/gemini";
import { submitAnswerSchema } from "@/lib/validation";
import { ConfirmationStatus, DiagnosisSource } from "@/lib/store";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = submitAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { learnerId, problemId, answer, confidenceBefore, hintLevel, shownWork } = parsed.data;

  const problem = getCachedProblem(problemId);
  if (!problem) {
    return NextResponse.json(
      { error: "Problem expired or not found — request a new one." },
      { status: 404 }
    );
  }

  const analysis = analyzeAnswer(problem, answer);

  // Was this problem specifically served as a silent confirmation-round check on an
  // earlier correct-but-suspect answer? See "Catching the Correct Answer Trap" in
  // ARCHITECTURE.md and learnerModel.ts's pendingConfirmation/decideNextProblem.
  const pendingBefore = pendingConfirmation(learnerId);
  const isConfirmationRound =
    pendingBefore !== null && pendingBefore.misconceptionId === problem.targetMisconceptionId;

  if (analysis.outcome === "correct") {
    let confirmationResolved: "confirmed" | null = null;
    if (isConfirmationRound) {
      resolvePendingConfirmation(learnerId, "confirmed");
      confirmationResolved = "confirmed";
    }

    // Independently, THIS correct answer's own reasoning may raise a new hypothesis —
    // orthogonal to whether it just resolved an older one.
    let newConfirmationStatus: ConfirmationStatus = "none";
    let suspectMisconceptionId: string | null = null;
    let suspicionSource: DiagnosisSource = null;

    // Step 1: deterministic signal, always checked first regardless of shown work
    // or Gemini availability — did the learner's last attempt on this exact
    // concept get caught by the same rule-based distractor match used for wrong
    // answers? Getting it right immediately after doesn't yet prove the mistake
    // was fixed rather than just re-tried until it landed. See
    // lastMisconceptionOnConcept and ARCHITECTURE.md "Catching the Correct Answer
    // Trap" — this keeps the flagship mechanic working even with no GEMINI_API_KEY.
    const recentSlip = lastMisconceptionOnConcept(learnerId, problem.conceptId);
    if (recentSlip) {
      newConfirmationStatus = "pending";
      suspectMisconceptionId = recentSlip;
      suspicionSource = "rule";
    }

    // Step 2 (only reachable when step 1 found nothing): the learner's own written
    // reasoning may raise a hypothesis Gemini can classify — richer, but requires
    // shown work and a live Gemini key.
    if (!suspectMisconceptionId && shownWork && shownWork.trim().length > 0) {
      const candidates = misconceptionsForConcept(problem.conceptId);
      const check = await classifyCorrectReasoning({ problem, learnerAnswer: answer, shownWork, candidates });
      if (check.suspectMisconceptionId) {
        newConfirmationStatus = "pending";
        suspectMisconceptionId = check.suspectMisconceptionId;
        suspicionSource = "ai";
      }
    }

    recordAttempt({
      learnerId,
      conceptId: problem.conceptId,
      // Store the suspected misconception on the attempt row itself when we've
      // raised a hypothesis — pendingConfirmation() reads it back from here to know
      // what to test with the confirmation-round problem. Never shown to the
      // learner in this "correct" response (see steps below).
      misconceptionId: suspectMisconceptionId,
      outcome: "correct",
      confidenceBefore,
      hintLevelUsed: hintLevel,
      problemPrompt: problem.promptText,
      learnerAnswer: answer,
      confirmationStatus: newConfirmationStatus,
      diagnosisSource: suspicionSource,
    });

    const feedback = await generateCorrectFeedback(problem);
    return NextResponse.json({
      outcome: "correct",
      feedbackText: feedback.text,
      source: feedback.source,
      confidenceBefore,
      wasWellCalibrated: confidenceBefore >= 4,
      confirmationResolved,
      steps: [
        "Checked your answer against the known-correct value",
        "Correct",
        ...(confirmationResolved
          ? ["Confirmed — this wasn't a lucky guess, your reasoning holds up"]
          : []),
      ],
    });
  }

  // Wrong answer, and it was specifically the confirmation-round check: the earlier
  // "correct" answer didn't hold up. Resolve it before anything else.
  let caughtOriginalPrompt: string | null = null;
  if (isConfirmationRound) {
    resolvePendingConfirmation(learnerId, "caught");
    caughtOriginalPrompt = pendingBefore!.problemPrompt;
  }

  // Step 1: deterministic rule-based match (always happens first — see ARCHITECTURE.md).
  const steps: string[] = ["Checked your answer against known misconception patterns for this problem"];
  let misconceptionId: string | null =
    analysis.outcome === "matched_misconception" ? analysis.misconceptionId : null;
  let diagnosisSource: DiagnosisSource = misconceptionId ? "rule" : null;

  if (misconceptionId) {
    steps.push(`Matched a known pattern: "${getMisconception(misconceptionId)?.name}"`);
  } else {
    steps.push("No exact match against known wrong-answer patterns");

    // Step 2 (only reachable when step 1 found nothing): classify the learner's own
    // written reasoning against this concept's misconception taxonomy with Gemini.
    // This is real classification work, not just phrasing — see ARCHITECTURE.md.
    if (shownWork && shownWork.trim().length > 0) {
      steps.push("Analyzing your written reasoning with Gemini");
      const candidates = misconceptionsForConcept(problem.conceptId);
      const classification = await classifyFreeformMisconception({
        problem,
        learnerAnswer: answer,
        shownWork,
        candidates,
      });
      if (classification.misconceptionId) {
        misconceptionId = classification.misconceptionId;
        diagnosisSource = "ai";
        steps.push(
          `Gemini classified this as: "${getMisconception(misconceptionId)?.name}" (${classification.confidence} confidence)`
        );
      } else if (classification.attempted) {
        steps.push("Gemini reviewed it but found no clear match to a known pattern");
      } else {
        steps.push("AI classification unavailable (no API key configured) — showing a general hint instead");
      }
    } else {
      steps.push("No written reasoning provided — add how you solved it for a more specific diagnosis");
    }
  }

  if (caughtOriginalPrompt) {
    steps.push(`This double-checks an earlier correct answer to "${caughtOriginalPrompt}" — it didn't hold up`);
  }

  const misconception = misconceptionId ? getMisconception(misconceptionId) ?? null : null;
  const finalOutcome: "matched_misconception" | "unrecognized" = misconception
    ? "matched_misconception"
    : "unrecognized";

  recordAttempt({
    learnerId,
    conceptId: problem.conceptId,
    misconceptionId,
    outcome: finalOutcome,
    confidenceBefore,
    hintLevelUsed: hintLevel,
    problemPrompt: problem.promptText,
    learnerAnswer: answer,
    diagnosisSource,
  });

  // Recent misconception history (any severity, resolved or not — repeated mistakes
  // are a real personalization signal even after being "resolved" once, see
  // RESEARCH/LEARNING_SCIENCE.md #8/#10) gives the diagnosis prompt real context to
  // draw on, and is what makes two learners' hints genuinely diverge (see /compare).
  const recentNames = getMisconceptionHistory(learnerId)
    .filter((h) => h.misconception_id !== misconceptionId)
    .slice(0, 2)
    .map((h) => getMisconception(h.misconception_id)?.name)
    .filter((n): n is string => Boolean(n));

  const diagnosis = await generateDiagnosis({
    problem,
    learnerAnswer: answer,
    misconception,
    hintLevel,
    recentMisconceptionNames: recentNames,
  });

  const revealAnswer = hintLevel >= 3;

  return NextResponse.json({
    outcome: finalOutcome,
    misconceptionName: misconception?.name ?? null,
    diagnosisSource,
    feedbackText: diagnosis.text,
    source: diagnosis.source,
    revealAnswer,
    correctAnswer: revealAnswer ? problem.correctAnswer : undefined,
    confirmationResolved: caughtOriginalPrompt ? "caught" : null,
    caughtOriginalPrompt,
    steps,
  });
}
