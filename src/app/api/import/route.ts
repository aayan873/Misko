import { NextRequest, NextResponse } from "next/server";
import { importLearnerData } from "@/lib/learnerModel";
import { importDataSchema } from "@/lib/validation";

/** Restores a previously-exported backup into the CURRENT browser's learner
 * id (not the id it was originally exported from) — a clean replace of that
 * learner id's data, not a merge. See learnerModel.ts's "Export / import"
 * section. Body is untrusted uploaded JSON; importDataSchema is deliberately
 * strict about it. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = importDataSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "That file doesn't look like a valid Misko export." }, { status: 400 });
  }
  importLearnerData(parsed.data.learnerId, parsed.data.data);
  return NextResponse.json({ ok: true });
}
