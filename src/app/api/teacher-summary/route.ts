import { NextResponse } from "next/server";
import { getMisconception } from "@/lib/domain/misconceptions";
import { getConcept } from "@/lib/domain/concepts";
import { getClassMisconceptionSummary, getAtRiskLearners, getClassRoster } from "@/lib/learnerModel";

/**
 * Aggregates across every learner this instance has recorded data for — see the
 * "Class-wide (teacher-facing) aggregation" section in learnerModel.ts for the
 * honest scoping note (no real auth/roster, this is "everyone this server has
 * seen," which is an honest hackathon-scale demonstration, not a claim of
 * classroom-deployment-ready multi-tenant software).
 */
export async function GET() {
  const roster = getClassRoster();

  const misconceptions = getClassMisconceptionSummary().map((m) => ({
    ...m,
    name: getMisconception(m.misconceptionId)?.name ?? m.misconceptionId,
    conceptName: getConcept(m.conceptId).name,
  }));

  const atRisk = getAtRiskLearners();

  return NextResponse.json({
    learnerCount: roster.length,
    roster,
    misconceptions,
    atRisk,
  });
}
