import { NextRequest, NextResponse } from "next/server";
import { CONCEPTS } from "@/lib/domain/concepts";
import { misconceptionsForConcept } from "@/lib/domain/misconceptions";
import { generateProblemForMisconception } from "@/lib/domain/problemEngine";
import { buildFlawedWalkthrough, hasFlawedWalkthrough } from "@/lib/domain/flawedWorkedExample";
import { frontierConcept } from "@/lib/learnerModel";
import { cacheRound } from "@/lib/spotMistakeCache";
import { spotMistakeQuerySchema } from "@/lib/validation";

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function GET(req: NextRequest) {
  const parsed = spotMistakeQuerySchema.safeParse({
    learnerId: req.nextUrl.searchParams.get("learnerId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or missing learnerId" }, { status: 400 });
  }
  const { learnerId } = parsed.data;

  // Ground the round in what the learner is actually working on when possible —
  // falls back to any concept once everything is mastered.
  const conceptId = frontierConcept(learnerId) ?? randomChoice(CONCEPTS).id;
  const candidates = misconceptionsForConcept(conceptId).filter((m) => hasFlawedWalkthrough(m.id));
  const misconception = randomChoice(candidates);

  const problem = generateProblemForMisconception(misconception.id);
  const walkthrough = buildFlawedWalkthrough(problem);

  const roundId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  cacheRound(roundId, walkthrough, misconception.id);

  return NextResponse.json({
    roundId,
    conceptId,
    problemText: walkthrough.problemText,
    steps: walkthrough.steps.map((s) => s.text),
  });
}
