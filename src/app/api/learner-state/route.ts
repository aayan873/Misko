import { NextRequest, NextResponse } from "next/server";
import { CONCEPTS } from "@/lib/domain/concepts";
import { getMisconception } from "@/lib/domain/misconceptions";
import {
  getAllMastery,
  getCalibration,
  getCalibrationInsight,
  getMisconceptionHistory,
  frontierConcept,
  getConfirmationStats,
  getConfirmationStatsByConcept,
  getSpotMistakeStats,
  getTimingInsight,
} from "@/lib/learnerModel";
import { nextProblemQuerySchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = nextProblemQuerySchema.safeParse({ learnerId: searchParams.get("learnerId") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or missing learnerId" }, { status: 400 });
  }
  const learnerId = parsed.data.learnerId;

  const masteryRows = getAllMastery(learnerId);
  const masteredSet = new Set(masteryRows.filter((r) => r.mastered === 1).map((r) => r.concept_id));
  const confirmationByConcept = getConfirmationStatsByConcept(learnerId);

  const mastery = masteryRows.map((row) => {
    const concept = CONCEPTS.find((c) => c.id === row.concept_id)!;
    return {
      conceptId: row.concept_id,
      name: concept.name,
      attempts: row.attempts,
      correct: row.correct,
      streak: row.streak,
      mastered: row.mastered === 1,
      accuracy: row.attempts > 0 ? row.correct / row.attempts : null,
      pMastery: row.p_mastery,
      // Locked = prerequisites not yet mastered — drives the concept-path visualization
      // (see ConceptPath.tsx), which was previously invisible: the dashboard showed 5
      // flat stamps with no sense of the real prerequisite chain the mastery gate uses.
      locked: !concept.prerequisites.every((p) => masteredSet.has(p)),
      confirmation: confirmationByConcept[row.concept_id],
    };
  });

  const misconceptionHistory = getMisconceptionHistory(learnerId).map((h) => ({
    misconceptionId: h.misconception_id,
    name: getMisconception(h.misconception_id)?.name ?? h.misconception_id,
    conceptId: h.concept_id,
    occurrences: h.occurrences,
    resolved: h.resolved === 1,
    lastSeen: h.last_seen,
    diagnosisSource: h.diagnosis_source,
  }));

  const calibration = getCalibration(learnerId);
  const calibrationInsight = getCalibrationInsight(learnerId);

  return NextResponse.json({
    mastery,
    misconceptionHistory,
    calibration,
    calibrationInsight,
    frontierConcept: frontierConcept(learnerId),
    confirmationStats: getConfirmationStats(learnerId),
    spotMistakeStats: getSpotMistakeStats(learnerId),
    timingInsight: getTimingInsight(learnerId),
  });
}
