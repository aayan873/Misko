# Misko — Devpost submission copy

Draft copy for the actual Devpost submission form. Same content as README, just
organized the way Devpost's own submission fields expect it.

## Inspiration

Most AI tutors check one thing: is the final answer right? If it is, they move
on. But you can get a right answer by luck, a half-remembered trick, or two
mistakes that happen to cancel out — and a normal quiz, or a chatbot that only
looks at the number, can't tell the difference. Recent research on this exact
failure mode (the "Correct Answer Trap" — arXiv 2605.23925, 2606.23205) shows
even capable AI tutors miss flawed reasoning hiding behind a correct number.
That gap — not "AI tutor for algebra" in general — is what Misko is built
around.

## What we built

Misko is a misconception-diagnosing tutor that never trusts a single correct
answer as proof of understanding. If a correct answer's reasoning looks shaky,
it quietly gives a second, different problem to check — and only says
something if the understanding doesn't actually hold up on that second,
independently graded problem. Wrong answers get diagnosed against a curated
taxonomy of named misconceptions, not just marked wrong. Mastery is a live
Bayesian probability estimate, not a streak counter, and problem difficulty
scales with it — easier numbers early, harder ones as mastery climbs, hardest
once a concept is due for spaced review.

Algebra I was the pilot domain (order of operations, negative numbers, the
distributive property, combining like terms, linear equations — 15
misconceptions), not the ceiling: the same architecture now also covers
chemistry (dimensional analysis and mole ratios/stoichiometry, 6 more
misconceptions), switchable mid-session on `/practice`, with zero changes to
the diagnosis, mastery, or AI layers to add it — see RESEARCH/IDEA_SELECTION.md
"A second subject: chemistry" for exactly what did and didn't need to change.

## How it works

1. A problem is generated deterministically from a fixed taxonomy — every
   problem has a known-correct answer and a known wrong answer mapped to a
   specific misconception, computed the same way every time.
2. A wrong answer gets diagnosed through three tiers, tried in order: a
   rule-based exact match against the known wrong answer, Gemini classifying
   the learner's own written reasoning if they provided any, or a local
   TF-IDF/cosine-similarity match if there's no Gemini key. Each tier only
   runs if the one before it found nothing.
3. A correct answer can still raise a quiet suspicion — either a rule (did the
   learner just slip on this same concept last time?) or Gemini reading their
   written reasoning. Either way, nothing is said yet: a follow-up problem of
   the same type is served next, and only its result decides confirmed vs.
   caught.
4. Every graded attempt updates a Bayesian Knowledge Tracing estimate for that
   concept, which gates progression, spaced review timing, and problem
   difficulty.

## Why AI matters here

AI isn't decorative — remove it and two specific things stop working: Gemini
reading a learner's own written reasoning to classify a misconception that
doesn't match a known wrong-answer pattern, and Gemini raising a suspicion
about a correct answer's reasoning from the same written text. Both of those
have no answer-checking role — checking correctness is deliberately plain
deterministic code, on purpose, so correctness never depends on a model's
output. What's AI is judgment about reasoning quality, which is exactly the
part a fixed answer-key can't do. When there's no Gemini key at all, the
product still works: a deterministic fallback path (a local TF-IDF classifier,
plus a rule-based version of the reasoning-suspicion trigger) keeps the core
mechanic functioning without any API call, which was a deliberate design
choice, not an afterthought bolted on for robustness points.

## Educational impact

The confirmation-round mechanic directly targets a documented, real gap in
existing AI tutors, not a made-up problem. Mastery gating via BKT means one
slip doesn't erase progress the way a streak counter would — measured
directly (EVALUATION.md): it takes a minimum of 3 correct answers to cross
mastery at high accuracy, and meaningfully longer at lower accuracy, with the
underlying estimate (not the "Mastered" badge itself, which is deliberately
sticky once earned) genuinely dropping on a single slip. No real student has
used this yet, so "impact" here means "the mechanism is sound and
demonstrable," not "this measurably helped someone learn" — that second claim
would need a real study this project doesn't have.

## Technical implementation

Next.js 14 App Router, TypeScript, Tailwind, Zod validation on every route,
Gemini for the two AI-dependent steps above, a plain JSON file as the
datastore. 273 automated tests (unit, real HTTP route handlers, and
full-session integration) as of this write-up. Real safety engineering: rate
limiting on both billed endpoints (per-learner and global), stream-level
request body size capping before JSON parsing, and a deterministic fallback
at every AI call site so a missing key or an API outage never blocks a
learner mid-problem.

## Challenges

- Tuning the local TF-IDF fallback classifier: an early threshold looked fine
  on easy cases but produced confidently wrong matches between misconceptions
  that share vocabulary — it now only fires on close-to-verbatim phrasing,
  found by deliberately stress-testing it rather than assuming it worked.
- Getting the confirmation-round mechanic's edge cases right — a learner can
  be mid-confirmation-check on one misconception while a completely different
  wrong answer happens on another concept, and the state machine has to
  resolve both correctly without cross-contaminating.
- Backward-compatible schema evolution: three separate fields were added to
  the data model over the course of building this (`mastered_at`,
  `time_spent_ms`, and the confirmation-status machinery), each requiring
  old exported backups to still import cleanly rather than breaking anyone
  who'd already downloaded one.
- Catching a real mistake in this project's own evaluation docs before it
  shipped: an earlier write-up of the "mastery isn't sticky" claim conflated
  the underlying probability estimate (which genuinely drops on a slip) with
  the persisted "Mastered" badge (which is deliberately sticky by design) —
  caught on a re-read and corrected rather than left in place.

## What's next

No real user has tried this yet — that's the single biggest gap. The BKT
parameters and the TF-IDF threshold are both literature-typical defaults or
stress-test-tuned, not fit to any real Misko usage data, because none exists.
The live deployment's storage is single-instance-only (a JSON file), so a
real hosted database would be needed before this could hold real, persistent
multi-user data on a serverless host. Recording an actual demo video
(DEMO_SCRIPT.md is written, but nobody has recorded and watched it back yet)
is the most concrete immediate next step.
