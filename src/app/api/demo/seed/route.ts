import { NextResponse } from "next/server";
import { seedDemoLearners, DEMO_LEARNER_A, DEMO_LEARNER_B } from "@/lib/demoLearners";

/**
 * Resets and re-seeds the two fixed demo learner profiles used by /compare. Not
 * part of the real product flow — exists only to make the "two learners, two
 * experiences" claim (prompt.md §9/§14) demonstrable live against the real
 * backend rather than asserted in a video voiceover.
 */
export async function POST() {
  seedDemoLearners();
  return NextResponse.json({
    learnerA: { id: DEMO_LEARNER_A.id, name: DEMO_LEARNER_A.name, persona: DEMO_LEARNER_A.persona },
    learnerB: { id: DEMO_LEARNER_B.id, name: DEMO_LEARNER_B.name, persona: DEMO_LEARNER_B.persona },
  });
}
