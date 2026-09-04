import { NextRequest, NextResponse } from "next/server";
import { exportLearnerData } from "@/lib/learnerModel";
import { exportQuerySchema } from "@/lib/validation";

/** A learner's own progress, in their own hands — see the "Export / import"
 * section in learnerModel.ts for why this exists (no accounts, so no other
 * recovery path if localStorage is lost). */
export async function GET(req: NextRequest) {
  const parsed = exportQuerySchema.safeParse({
    learnerId: req.nextUrl.searchParams.get("learnerId"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid or missing learnerId" }, { status: 400 });
  }
  return NextResponse.json(exportLearnerData(parsed.data.learnerId));
}
