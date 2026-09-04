import { NextRequest, NextResponse } from "next/server";
import { importLearnerData } from "@/lib/learnerModel";
import { importDataSchema } from "@/lib/validation";
import { readJsonBody } from "@/lib/readJsonBody";

// Rough ceiling for a legitimately large, fully-populated export under the
// Zod schema's own array caps (20k attempts + 5k misconception events + 20k
// spot-mistake rows, each a few hundred bytes as JSON) — with real margin,
// not a tight fit.
const MAX_IMPORT_BYTES = 16 * 1024 * 1024;

/** Restores a previously-exported backup into the CURRENT browser's learner
 * id (not the id it was originally exported from) — a clean replace of that
 * learner id's data, not a merge. See learnerModel.ts's "Export / import"
 * section. Body is untrusted uploaded JSON; importDataSchema is deliberately
 * strict about it, and the body is read with a hard size cap before that
 * validation even runs — see readJsonBody.ts for why that step matters too. */
export async function POST(req: NextRequest) {
  const read = await readJsonBody(req, MAX_IMPORT_BYTES);
  if (!read.ok) {
    return NextResponse.json(
      { error: read.reason === "too_large" ? "That file is too large." : "That file doesn't look like a valid Misko export." },
      { status: read.reason === "too_large" ? 413 : 400 }
    );
  }
  const parsed = importDataSchema.safeParse(read.body);
  if (!parsed.success) {
    return NextResponse.json({ error: "That file doesn't look like a valid Misko export." }, { status: 400 });
  }
  importLearnerData(parsed.data.learnerId, parsed.data.data);
  return NextResponse.json({ ok: true });
}
