import { NextResponse } from "next/server";
import { generateProblemForMisconception } from "@/lib/domain/problemEngine";
import { cacheProblem, toClientProblem } from "@/lib/problemCache";

/**
 * Generates ONE shared problem instance for the /compare demo, cached exactly like
 * a real practice problem (so it goes through the real /api/submit-answer path).
 * Unlike the real practice flow, this demo-only route also returns the distractor
 * answer — the whole point of /compare is to auto-submit the same wrong answer for
 * both seeded learners to show their diagnoses diverge, not to test a real user's
 * own reasoning, so exposing it here doesn't compromise the real product's rules.
 */
export async function GET() {
  const problem = generateProblemForMisconception("CLT_EXPONENT_ADD");
  cacheProblem(problem);
  return NextResponse.json({
    problem: toClientProblem(problem),
    demoWrongAnswer: problem.distractorAnswer,
  });
}
