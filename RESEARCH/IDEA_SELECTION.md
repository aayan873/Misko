# Why this scope

Why Misko started as 5 concepts and 15 misconceptions instead of a general math
tutor, why Algebra I specifically, and (later) why a second subject was added
rather than more algebra. Referenced from `src/lib/domain/misconceptions.ts`.

## Why a narrow domain instead of "all of math"

A tutor that diagnoses a specific misconception needs, for every problem it can
generate, a known-correct answer *and* a known set of wrong answers mapped to
specific flawed reasoning. That mapping has to be built by hand for it to be
trustworthy — there's no shortcut where a general model just "knows" the
distractor answer for an arbitrary problem the way it knows the correct one. Every
concept added is real, bounded authoring work (a problem template, its correct
answer, and each misconception's distractor answer, verified consistent), not a
config toggle. Covering "all of math" honestly would mean either doing that work
across a huge number of topics badly, or a handful of topics well. This picks the
second option deliberately.

## Why Algebra I

Algebra I is the first place a lot of these misconceptions actually appear, they
recur across everything built on top of it (equations, functions, later algebra),
and they're well-documented in math-education research, so building a taxonomy
against real literature was possible instead of guessing at what students get
wrong.

## The five concepts

Order of operations, negative number operations, the distributive property,
combining like terms, and solving linear equations
(`src/lib/domain/concepts.ts`). These were picked as a connected sequence rather
than five unrelated topics: each one is a prerequisite that shows up again inside
the next (a linear-equation problem routinely requires distributing and combining
like terms correctly to solve), so mastery on an earlier concept is genuinely
exercised again, not just checked once and forgotten. That connectedness is also
what makes interleaving (RESEARCH/LEARNING_SCIENCE.md #8) and spaced review
(RESEARCH/LEARNING_SCIENCE.md #7) meaningful instead of arbitrary — reviewing
"order of operations" while learning "linear equations" is reviewing something
that problem actually depends on, not a random unrelated fact.

## Fifteen misconceptions, not more

Three misconceptions per concept, each one a documented, specific flawed method
(e.g. left-to-right evaluation ignoring precedence, sign errors when subtracting
a negative, forgetting to distribute to every term) rather than a vague "made an
arithmetic error" bucket. A misconception has to be specific enough that a
distractor answer can be mechanically computed from it for an arbitrary generated
problem — "sometimes makes mistakes" isn't a taxonomy entry, it's the absence of
one. Fifteen is what a single person can author, verify (each one stress-tested
with 200 randomized problem generations to confirm the distractor arithmetic is
actually consistent — see `tests/flawedWorkedExample.test.ts`), and keep straight
without the taxonomy itself becoming the unreliable part of the product.

## What was deliberately left out

- **Word problems.** Diagnosing a misconception requires knowing the correct
  operation sequence precisely enough to compute a distractor from it; word
  problems add a translation-from-English step that's a different (and much
  harder) diagnostic problem on top of the math itself.
- **Multi-step problems mixing several concepts in one question.** Each generated
  problem targets exactly one concept and one candidate misconception, so a wrong
  answer can be attributed to something specific. A problem mixing concepts would
  make a wrong answer ambiguous about which step actually failed.
- **Geometry, statistics, or a third+ subject.** Not because they don't have
  their own well-documented misconceptions — they do — but because covering
  them well means repeating all of the authoring and verification work above
  again per topic, and narrow-but-real stays the priority over broad-but-shallow.
  Two subjects (below) was enough to prove the architecture generalizes; a third
  would mostly repeat that proof, not add new evidence of it.

## A second subject: chemistry

Added later, once the core mechanic (confirmation-round catching, misconception
diagnosis, BKT mastery) was solid, to answer a real risk: "Algebra I, 5 concepts"
stated on its own sounds like a narrow study app, not proof of a general
architecture. The fix wasn't "add more algebra" — that would still just be a
bigger algebra app — it was picking a second, visibly different subject and
seeing whether the *same* concept/misconception/problem-generator pattern
(`src/lib/domain/`) held up without being rebuilt for it.

**Chemistry (dimensional analysis + mole ratios/stoichiometry)** over the other
candidate considered, physics kinematics: dimensional analysis has a small,
well-documented, well-known misconception set (inverting a conversion factor,
losing track of a chained conversion's direction, confusing a rate with a total)
that maps directly onto the same "known-wrong-value ⇐ known-misconception"
structure algebra already uses, with real, fixed physical constants (unit
conversion factors) rather than invented numbers.

**What this actually tested, and what it found:** adding `dimensional-analysis`
and `mole-ratios` (`src/lib/domain/concepts.ts`) required zero changes to
`analyzer.ts`, `bkt.ts`, or the Gemini layer — the diagnosis/mastery pipeline
genuinely doesn't know or care what subject a concept belongs to. It did require
a real, honest refactor: `learnerModel.ts`'s concept-*selection* functions
(`frontierConcept`, `dueForReview`, `weakestReviewableConcept`,
`decideNextProblem`, and the pending-confirmation/active-misconception lookups)
previously assumed "every concept this learner has ever touched" was one
undifferentiated pool — fine when there was only one subject, silently wrong
once a second one existed (a chemistry confirmation-round check could otherwise
have surfaced while the learner was practicing algebra). Making those functions
subject-aware, with subjects as fully independent frontiers — mastering all of
algebra is never a prerequisite for starting chemistry, or vice versa — is a
real, bounded, subject-scoping change, not a rewrite of the core mechanic. That
distinction (what stayed generic vs. what genuinely needed to change) is the
honest version of "prove it's an architecture," not a blanket "no changes
needed" claim that wouldn't have survived a second subject actually being built.

Two chemistry concepts, three misconceptions each — the same 3-per-concept shape
as every algebra concept, for the same reason: enough to be a real taxonomy, not
so many that authoring/verification quality slips. A subject switcher on
`/practice` lets a learner move between algebra and chemistry in the same
session, which is also the actual demo moment this unlocks: solve an algebra
problem, catch a misconception, switch subjects, solve a chemistry problem, catch
a different misconception — same engine, same UI, same AI layer, no code path
forked for the new subject.
