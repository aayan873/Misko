import { NextRequest, NextResponse } from "next/server";
import { getMisconception } from "@/lib/domain/misconceptions";
import { getCachedRound } from "@/lib/spotMistakeCache";
import { spotMistakeSubmitSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = spotMistakeSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { roundId, selectedStepIndex } = parsed.data;

  const round = getCachedRound(roundId);
  if (!round) {
    return NextResponse.json(
      { error: "Round expired or not found — request a new one." },
      { status: 404 }
    );
  }

  const misconception = getMisconception(round.misconceptionId);
  const correct = selectedStepIndex === round.walkthrough.flawedStepIndex;

  return NextResponse.json({
    correct,
    correctStepIndex: round.walkthrough.flawedStepIndex,
    misconceptionName: misconception?.name ?? null,
    explanation: misconception?.description ?? null,
  });
}
