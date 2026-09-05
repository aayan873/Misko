# Judge scorecard (self-assessment)

An honest internal audit against the competition's own four judging
categories (RESEARCH/COMPETITION.md), written the way the brief asks: identify
weaknesses and fix what's fixable before submission, not just list strengths.
The numbers below are **this author's own estimate, not a prediction of what
real judges will actually score** — there's no way to know that in advance,
and presenting a self-guess as if it were a real result would be exactly the
kind of fabrication EVALUATION.md exists to avoid. Treat the numbers as a
rough gut-check, and the bullet points under each as the actual content.

## Educational Impact — self-estimate: 20/25

**What problem does it solve?** A real, specific gap: a learner (or a normal
quiz, or most AI tutors) can't tell a right answer from a right answer
reached by broken reasoning. Misko targets that gap directly with the
confirmation-round mechanic, not just "AI tutor for algebra" in general.

**What evidence supports impact?**
- The mechanic demonstrably works end-to-end (verified live repeatedly this
  session, most recently for DEMO_SCRIPT.md) — a wrong answer gets a specific
  named diagnosis, a suspicious correct answer gets silently re-checked, and
  a failed re-check surfaces exactly which earlier answer didn't hold up.
- Grounded in real, cited research on the exact phenomenon it targets (arXiv
  2605.23925, 2606.23205), not a vague "personalization" claim.
- BKT mastery gating and spaced review are real implementations of
  established learning-science mechanisms (RESEARCH/LEARNING_SCIENCE.md),
  not just named in passing.

**Why not higher:** No real student has ever used this (EVALUATION.md is
explicit about that). "Educational impact" claims stop at "the mechanism is
sound and demonstrable," not "this measurably helped anyone learn," because
that second claim isn't available to make honestly. Scope is also narrow by
design (5 concepts, Algebra I only, RESEARCH/IDEA_SELECTION.md) — the right
call for depth over breadth in a hackathon, but it caps how broad an "impact"
claim can honestly be.

## Creative Use of AI/ML — self-estimate: 21/25

**What technically meaningful AI capability exists?**
- Three distinct diagnosis techniques used deliberately, not just one LLM
  call: a rule-based distractor match, Gemini classification of freeform
  reasoning, and a local TF-IDF/cosine-similarity fallback with zero API
  calls — genuinely different techniques for the same problem, not the same
  technique renamed three times (ARCHITECTURE.md).
- Bayesian Knowledge Tracing for mastery, not a streak counter — a real,
  literature-grounded probabilistic model, not decoration.
- The confirmation-round mechanic is the most creative piece: it doesn't ask
  an LLM to just judge correctness, it uses AI-or-rule-raised suspicion as a
  *hypothesis* that's independently verified with a second graded problem
  before anything is shown to the learner — a real system built around the
  model, not `User → LLM → Answer` (prompt.md's own anti-pattern to avoid).

**Why not higher:** The AI-based confirmation trigger and freeform
classification are gated behind a live Gemini key and real quota — this
session hit quota limits during testing more than once, and the live Vercel
demo has no key configured at all (README, ARCHITECTURE.md). The rule-based
paths keep the product's flagship mechanic working without any AI at all,
which is a real strength for robustness but also means the "creative AI"
story leans partly on a path that isn't strictly AI. Also: no embeddings,
vector search, or a genuinely novel model architecture — everything here is
either a well-established classical technique (BKT, TF-IDF) or a
well-established use of a hosted LLM, applied thoughtfully rather than
inventing something new at the ML-technique level.

## Technical Execution — self-estimate: 22/25

**What engineering is impressive?**
- 166 automated tests (as of this write-up) across unit, route-level HTTP,
  and full-session integration tests — not just "it compiles."
- Real safety engineering: rate limiting (per-learner and global) on every
  billed endpoint, stream-level request body size capping before JSON
  parsing (not after), strict Zod validation on every input including
  untrusted uploaded import files, deterministic fallbacks for every AI call
  site so an outage or missing key never blocks a learner.
- Backward-compatible schema evolution handled correctly (old exports
  missing fields added later still import cleanly), verified by dedicated
  tests, not just assumed.
- A documented, self-corrected mistake earlier in EVALUATION.md's own
  history (the mastery-flag stickiness conflation) — evidence the process
  catches its own errors rather than just producing confident-sounding docs.

**Does everything actually work?** Locally, yes — every feature in this
document has been exercised against a real running dev server, not just unit
tested in isolation, repeatedly through this session's commit history.

**Why not higher:**
- The live Vercel deployment (misko-theta.vercel.app) is explicitly a UI
  preview only — the JSON-file store needs one persistent process, which
  serverless functions don't provide, so nothing typed there actually
  persists (README, ARCHITECTURE.md "Future work"). A judge clicking the
  live link without reading that caveat first could reasonably think the app
  is broken. Partially mitigated since this was first written: the app now
  shows an honest in-app notice on the actual Vercel deployment itself
  (`DeploymentNotice.tsx`, detected via Vercel's own `VERCEL` system env
  var) — so a judge doesn't have to have read the README first to know why
  nothing saves. That's a real improvement, but it's still a workaround, not
  a fix: the underlying limitation (no real persistence on this deployment)
  is unchanged, and swapping to a real hosted database is still the only way
  to remove it rather than just disclose it — worth prioritizing if time
  allows before the deadline.
- No screenshots exist yet (README's own Limitations section says so) —
  SCREENSHOTS.md doesn't exist either as of this write-up.
- Single-instance in-memory caches (`problemCache.ts`, `spotMistakeCache.ts`)
  share the same limitation.

## Pitch & Demo — self-estimate: 18/25 (the most uncertain estimate here)

**Can the idea be understood in 2 minutes?** DEMO_SCRIPT.md lays out a script
that fits the required structure and is grounded in a real recorded
walkthrough (not invented dialogue) — the mechanic itself demos well because
it's genuinely visual: a badge changes, then feedback names an exact earlier
problem by its prompt text. A `/teacher` class-wide view existed at one point
in this project's history and was deliberately removed rather than kept —
prompt.md is explicit about targeting one clear user, not everyone, and a
second persona competing for attention in a 2-minute pitch would have worked
against exactly this category. Worth naming as a positive decision, not just
an absence: cutting a working, tested feature to protect the pitch's focus is
a harder call than adding one, and it's the kind of restraint this category
actually rewards.

**Why this is the lowest, most uncertain estimate:** Nobody has actually
recorded and watched the video yet. A script being well-written and a video
being well-executed are different things — pacing, screen legibility, and
whether the narration actually fits inside 2:00 when spoken at a natural
pace are all unverified until someone records it. This category is honestly
the hardest to self-grade before the video exists, which is itself the main
weakness: **the highest-priority remaining task for this whole project is
recording DEMO_SCRIPT.md and watching it back**, not writing more code.

## What to actually fix before submitting, in priority order

1. **Record the demo video** and time it against a stopwatch — nothing else
   in this document can be verified as "done" until this exists.
2. **Decide what to do about the live Vercel deployment's storage
   limitation** — either accept the "UI preview only" framing permanently in
   the README (already honest, already done), or spend real time swapping
   to a hosted database before the deadline if a fully-live demo matters more
   than the time cost.
3. **Take real screenshots** and write SCREENSHOTS.md — quick, low-risk, and
   explicitly requested by the brief.
4. **Resolve the RESEARCH/COMPETITION.md date flag** — confirm directly on
   the live Devpost page (or with organizers) whether the August 17-29
   coding-window note is real or stale template copy, since it's the one
   piece of research in this repo that couldn't be resolved with confidence.
5. Everything else in this repo (the mechanic, the tests, the docs) is
   already in a genuinely submittable state as of this write-up.
