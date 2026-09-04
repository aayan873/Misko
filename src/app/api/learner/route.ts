import { NextRequest, NextResponse } from "next/server";
import { ensureLearner } from "@/lib/db";
import { learnerCreateSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = learnerCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const { learnerId, displayName } = parsed.data;
  const learner = ensureLearner(learnerId, displayName || "Learner");
  return NextResponse.json({ learner });
}
