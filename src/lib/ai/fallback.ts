import { Misconception } from "../domain/misconceptions";
import { ProblemInstance } from "../domain/problemEngine";

/**
 * Deterministic, template-based diagnosis/hint generation used when GEMINI_API_KEY
 * is missing or the API call fails. Guarantees the product never blocks a learner
 * on an external AI outage (see ARCHITECTURE.md "AI safety / robustness").
 */
export function fallbackDiagnosis(
  misconception: Misconception | null,
  hintLevel: 1 | 2 | 3,
  recentMisconceptionNames: string[] = []
): string {
  // Even in template mode, reference the learner's actual recent history when
  // present — without this, two learners with different histories would see
  // byte-identical fallback text, which would make /compare meaningless
  // whenever no GEMINI_API_KEY is configured. This is still a template, not AI
  // reasoning, but it's built from real per-learner data, not fabricated.
  const historyNote =
    recentMisconceptionNames.length > 0
      ? ` This connects to something you've also recently shown: ${recentMisconceptionNames[0]}.`
      : "";

  if (!misconception) {
    const generic = [
      "That's not quite it — try re-checking each step of your work one at a time.",
      "Something in the process went off track. Which operation did you do first?",
      "Walk back through your steps slowly — one of the operations was applied in the wrong order or to the wrong part.",
    ];
    return generic[hintLevel - 1] + historyNote;
  }

  const templates: Record<number, string> = {
    1: `It looks like your answer matches a common pattern: ${misconception.description.toLowerCase()} What's the very first operation you should apply here, and why?`,
    2: `Your reasoning seems to involve: ${misconception.description.toLowerCase()} Look specifically at the step where that applies in this problem — does it match what you did?`,
    3: `This is a known trip-up: ${misconception.description.toLowerCase()} Try redoing this problem one operation at a time, writing down the result after each single step before moving to the next.`,
  };
  return templates[hintLevel] + historyNote;
}

export function fallbackCorrectFeedback(problem: ProblemInstance): string {
  return `Nice work — "${problem.promptText}" requires applying each step in the right order, and you did.`;
}
