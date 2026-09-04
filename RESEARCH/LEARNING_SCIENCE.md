# Learning science this is built on

A list of the actual learning-science ideas Misko applies, and where each one lives
in the code. Numbered because a few comments elsewhere reference specific items
here directly (e.g. "see #8", "see #10") — the numbering is meant to stay stable.

1. **Retrieval practice.** Learners answer real graded problems from the start —
   there's no lesson-then-quiz split. `src/lib/domain/problemEngine.ts` generates a
   fresh problem per attempt rather than reusing a fixed bank, so practice is
   actual retrieval, not memorizing a specific problem's answer.
2. **Immediate, specific feedback.** A wrong answer gets a hint tied to the exact
   misconception it matched, not a generic "incorrect." Generic feedback ("try
   again") doesn't tell a learner what to actually fix; feedback needs to name the
   error to be useful.
3. **Mastery as a probability, not a streak.** `src/lib/bkt.ts` implements Bayesian
   Knowledge Tracing (Corbett & Anderson, 1994) instead of a naive "N correct in a
   row" gate. One slip lowers the estimate; it doesn't reset it to zero. A streak
   counter punishes a single mistake far more than the evidence in that mistake
   actually justifies.
4. **Distractor-based problem design.** Every generated problem
   (`src/lib/domain/problemEngine.ts`) has a specific wrong answer that corresponds
   to a specific misconception, not just "any answer that isn't correct." This is
   what makes rule-based diagnosis possible at all — the wrong answer itself is
   diagnostic, not just a signal that something went wrong.
5. **Learning from flawed worked examples.** `/spot-the-mistake`
   (`src/lib/domain/flawedWorkedExample.ts`) has learners find the error in someone
   else's step-by-step solution instead of solving the problem themselves. Spotting
   an error in someone else's reasoning and avoiding that error in your own
   reasoning are related but distinct skills — this is deliberately tracked as a
   separate stat from concept mastery rather than folded into it.
6. **The Correct Answer Trap.** A right final answer isn't proof of correct
   reasoning — a learner can land on the right number through broken logic (two
   sign errors that cancel, for instance), and a tutor that only checks the answer
   has no way to catch that. See ARCHITECTURE.md "Catching the Correct Answer
   Trap" for how Misko handles this (arXiv 2605.23925, 2606.23205).
7. **Spaced repetition.** Mastered concepts come back for review later
   (`dueForReview`, `src/lib/learnerModel.ts`), spaced by number of problems
   answered since, not calendar time. The literature's spacing effect is normally
   studied and applied over days or weeks; counting interactions instead of days is
   a legitimate reading of the same mechanism (what matters is spacing between
   repetitions, not that the spacing be wall-clock time) and has the practical
   benefit of being demoable inside a single sitting instead of requiring a learner
   to come back tomorrow.
8. **Interleaving.** `INTERLEAVE_PROBABILITY` (`src/lib/learnerModel.ts`) has
   `decideNextProblem` serve a review problem from a weaker, previously-seen
   concept some of the time instead of always pushing forward on the current
   frontier concept. Blocked practice (all of concept A, then all of concept B)
   produces faster-feeling but shallower learning than mixing concepts together;
   interleaving is slower-feeling in the moment but produces better long-term
   retention and transfer.
9. **Confidence elicitation.** Learners predict their confidence (1-5) before
   seeing whether they're right, not after. Asking after the fact just measures
   how the outcome changed their story about their own confidence — asking before
   is what actually captures calibration.
10. **Metacognitive calibration feedback.** `getCalibrationInsight`
    (`src/lib/learnerModel.ts`) turns the confidence-vs-accuracy data from #9 into
    a direct callout — "you're consistently confident but wrong" or "consistently
    unsure but right" — instead of leaving the learner to notice the pattern
    themselves in a chart. Overconfidence is flagged before underconfidence
    because unearned confidence skipping a double-check is the more consequential
    failure mode of the two.
