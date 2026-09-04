# Evaluation

There's no real student usage data behind this yet — no user study, no
classroom pilot. Everything below is one of two things, and each section says
which: a **deterministic property of the code**, verified by the automated
test suite (154 tests as of this writing), or a **simulated evaluation** run
against the actual backend and labeled as simulated. Nothing here is a real
human-user result.

## Time to mastery (simulated)

How many attempts does BKT (`src/lib/bkt.ts`) take to mark a concept mastered
(`p_mastery >= 0.95`, gated by `MASTERY_MIN_ATTEMPTS = 3`) at a fixed,
sustained accuracy rate? Simulated by feeding `updateMastery` an i.i.d.
correct/wrong outcome at a given probability, independent of the running
estimate — this deliberately does NOT model a learner actually improving
over the session, it isolates how the mastery gate itself responds to a
fixed skill level. 10 runs per accuracy level, different seed each run:

| Sustained accuracy | Median attempts to mastery | Range across 10 runs |
| ------------------: | --------------------------: | :-------------------- |
| 100% | 3 | 3–3 |
| 90% | 3 | 3–5 |
| 80% | 3 | 3–10 |
| 70% | 5 | 3–10 |
| 60% | 6 | 3–18 |
| 50% | 9 | 3–36 |
| 40% | 19 | 3–122 |

At 100%, 90%, and often 80% accuracy, `MASTERY_MIN_ATTEMPTS` (the floor added
specifically to stop a freak early streak from granting mastery) is the
actual binding constraint, not the BKT threshold itself — confirmed as a
permanent deterministic test in `tests/evaluation.test.ts`. Below that, the
number of attempts needed grows the way it should: markedly slower for a
learner who's actually still getting things wrong roughly a third to half the
time.

**A caveat worth being explicit about, not glossing over:** `pTransit = 0.1`
gives every attempt (right or wrong) a small constant nudge upward — the
standard BKT formulation's built-in assumption that some learning can happen
on any given trial. Because that nudge doesn't depend on the outcome, a
sustained-but-nonzero accuracy rate will, given enough attempts, eventually
cross the mastery threshold even without the learner's true understanding
improving — a known property of standard BKT, not something specific to this
implementation. In the simulation above this took a minimum of 19 attempts
even at 40% accuracy, and grew fast as accuracy dropped further — far more
attempts than a real practice session in this app's scope produces (a
realistic session is more like 10-30 problems total across five concepts),
but it's a genuine long-horizon limit of the model, not a claim that mastery
can never be gamed with infinite patience.

## Resilience: mastery isn't sticky (deterministic)

The whole point of using BKT instead of a streak counter is that one slip
should cost something real, not just require a few make-up correct answers to
paper over. Measured directly: reach mastery through the minimum
3 correct answers (`p = 0.9828`), then answer once wrong. Result:
`p = 0.8893` — back below the 0.95 threshold, so `mastered` flips to `false`
again. One wrong answer, one dropped mastery flag. Locked in as a permanent
test (`tests/evaluation.test.ts`).

## The Correct Answer Trap: catch mechanism (deterministic, rule-based path)

The rule-based confirmation trigger (`lastMisconceptionOnConcept`,
ARCHITECTURE.md "Catching the Correct Answer Trap") fires under one specific,
narrow, and fully deterministic condition: the learner's immediately
preceding attempt on this exact concept was a wrong answer matched to a known
misconception. Under that condition it fires with 100% reliability by
construction — it's a lookup, not a classifier, so there's no recall/precision
tradeoff to measure for this path specifically. This is verified end-to-end
in `tests/integration.test.ts` (a learner slips, answers correctly, gets
served a silent confirmation-round problem before anything else, and the
outcome of that problem is what determines confirmed vs. caught) and was also
independently verified live against a real running server during
development (see the commit history on `overnight-experiments`).

The AI-based trigger (`classifyCorrectReasoning`, used when the rule-based
path finds nothing but the learner wrote out their reasoning) is a real
classifier, not a lookup, and its accuracy is bounded by what the published
research on this exact task reports (arXiv 2605.23925, 2606.23205 — cited in
the README and RESEARCH/COMPETITORS.md): roughly 57-84% detection accuracy
depending on model capability. Misko did not independently re-measure this
figure — it's an external citation, not something this project benchmarked
itself, and it's the direct reason nothing is ever shown to the learner off a
single AI judgment: the confirmation-round problem is what actually decides
it, every time, regardless of which trigger (rule or AI) raised the initial
suspicion.

## Misconception diagnosis: deterministic tiers (verified by test suite)

The rule-based tier (an answer matching a problem's known distractor value)
is 100% accurate by construction — the distractor answer for a given
misconception is computed the same way the taxonomy defines it, verified for
all 15 misconceptions across 200 randomized problem generations each
(`tests/flawedWorkedExample.test.ts`, `tests/problemEngine.test.ts`). The
local TF-IDF similarity fallback (used only when there's no Gemini key and
the rule-based tier found nothing) is deliberately conservative — see
`src/lib/domain/textSimilarity.ts` for the threshold-tuning history and
`tests/textSimilarity.test.ts` for its accuracy on the stress-test set used
to pick that threshold. The Gemini-based tier's accuracy depends on the live
model and isn't something this evaluation can benchmark without spending real
API quota against a labeled dataset that doesn't exist yet — see
ARCHITECTURE.md "Future work."

## What this evaluation deliberately does not claim

- No claim that this improves real learning outcomes for real students —
  that requires a real study with real students, which hasn't happened.
- No claim about the AI-based Correct Answer Trap detection rate beyond what
  the cited external research already established for this exact task.
- No claim that the BKT parameters are optimal — they're fixed
  literature-typical defaults (Corbett & Anderson, 1994), not fit to any
  Misko-specific data, because there isn't any yet.
- The 154-test suite verifies the code does what it's supposed to
  deterministically and that the simulations above are reproducible — it is
  not a substitute for evidence that the product works pedagogically for a
  real person.
