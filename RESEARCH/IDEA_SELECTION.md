# Why this scope

Why Misko is 5 concepts and 15 misconceptions instead of a general math tutor, and
why Algebra I specifically. Referenced from `src/lib/domain/misconceptions.ts`.

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
- **Geometry, statistics, or anything past Algebra I.** Not because they don't
  have their own well-documented misconceptions — they do — but because covering
  them well would mean repeating all of the authoring and verification work above
  again per topic, and narrow-but-real was the priority over broad-but-shallow
  for a hackathon-scoped submission.
