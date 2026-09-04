import { NextRequest, NextResponse } from "next/server";
import { getSessionSummary } from "@/lib/learnerModel";
import { sessionSummaryQuerySchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = sessionSummaryQuerySchema.safeParse({
    learnerId: searchParams.get("learnerId"),
    since: searchParams.get("since"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  return NextResponse.json(getSessionSummary(parsed.data.learnerId, parsed.data.since));
}
