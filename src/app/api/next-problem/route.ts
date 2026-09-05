import { NextRequest, NextResponse } from "next/server";
import { decideNextProblem } from "@/lib/learnerModel";
import { cacheProblem, toClientProblem } from "@/lib/problemCache";
import { nextProblemQuerySchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = nextProblemQuerySchema.safeParse({
    learnerId: searchParams.get("learnerId"),
    subject: searchParams.get("subject") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = decideNextProblem(parsed.data.learnerId, parsed.data.subject);
  if (result.done || !result.problem) {
    return NextResponse.json({ done: true, reason: result.reason, reasonType: result.reasonType });
  }

  cacheProblem(result.problem);

  return NextResponse.json({
    done: false,
    reason: result.reason,
    reasonType: result.reasonType,
    problem: toClientProblem(result.problem),
  });
}
