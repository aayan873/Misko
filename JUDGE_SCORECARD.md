# Judge scorecard (self-assessment)

An honest internal audit against the competition's own four judging
categories (RESEARCH/COMPETITION.md), written the way the brief asks: identify
weaknesses and fix what's fixable before submission, not just list strengths.
The numbers below are **this author's own estimate, not a prediction of what
real judges will actually score** — there's no way to know that in advance,
and presenting a self-guess as if it were a real result would be exactly the
kind of fabrication EVALUATION.md exists to avoid. Treat the numbers as a
rough gut-check, and the bullet points under each as the actual content.

**Revised** after a second build phase (A0–A6 + B1/B3/B4 in the project's own
planning notes) that shipped a second subject, streaming diagnosis text, live
camera capture, an embeddings-based similarity map, Visual Proof diagrams, a
downloadable report card, motion polish, and a synced `/compare` reveal — all
now pushed to `main` and reflected in the live deployment, not sitting on a
side branch a judge would never see.

## Educational Impact — self-estimate: 21/25 (+1)

**What problem does it solve?** A real, specific gap: a learner (or a normal
quiz, or most AI tutors) can't tell a right answer from a right answer
reached by broken reasoning. Misko targets that gap directly with the
confirmation-round mechanic, not just "AI tutor for algebra" in general.

**What evidence supports impact?**
- The mechanic demonstrably works end-to-end (verified live repeatedly, most
  recently while rewriting `DEMO_SCRIPT.md`) — a wrong answer gets a specific
  named diagnosis, a suspicious correct answer gets silently re-checked, and
  a failed re-check surfaces exactly which earlier answer didn't hold up.
- Grounded in real, cited research on the exact phenomenon it targets (arXiv
  2605.23925, 2606.23205), not a vague "personalization" claim.
- BKT mastery gating and spaced review are real implementations of
  established learning-science mechanisms (RESEARCH/LEARNING_SCIENCE.md).
- **New**: the mechanism now demonstrably generalizes past one subject —
  chemistry reuses the identical mastery gate, confirmation mechanic, and
  diagnosis pipeline with no forked code path (RESEARCH/IDEA_SELECTION.md
  "A second subject: chemistry"), which is real evidence the underlying
  approach isn't a one-off fit to Algebra I specifically.

**Why not higher:** No real student has ever used this (EVALUATION.md is
explicit about that). "Educational impact" claims stop at "the mechanism is
sound and demonstrable," not "this measurably helped anyone learn." Scope is
still narrow by design (2 subjects, 7 concepts total) — the right call for
depth over breadth in a hackathon, but it caps how broad an "impact" claim
can honestly be.

## Creative Use of AI/ML — self-estimate: 24/25 (+3)

**What technically meaningful AI/ML capability exists?**
- Three distinct diagnosis techniques used deliberately, not just one LLM
  call: a rule-based distractor match, Gemini classification of freeform
  reasoning, and a local TF-IDF/cosine-similarity fallback with zero API
  calls (ARCHITECTURE.md).
- Bayesian Knowledge Tracing for mastery, not a streak counter.
- **New, and the single biggest change since the last write-up**: text
  embeddings + a hand-rolled 2D similarity layout
  (`scripts/generateMisconceptionEmbeddings.ts`), rendered on `/dashboard` as
  a genuinely different ML technique from every LLM call elsewhere in the
  app — precomputed offline, so it costs nothing live and works even with no
  API key. This was the single most-cited gap in the previous version of
  this scorecard ("no embeddings, vector search... everything here is either
  a well-established classical technique or a well-established use of a
  hosted LLM") and it's now closed with a real, working feature, verified
  live to show a resolved and an unresolved misconception's dots actually
  render differently (`screenshots/06-misconception-map.png`).
- Streaming diagnosis text (token-by-token, not a static block) is a small
  but real polish item that makes the AI feel like it's actually reasoning
  live rather than returning a canned string.
- The confirmation-round mechanic is still the most creative piece: AI-or-
  rule-raised suspicion as a *hypothesis*, independently verified with a
  second graded problem before anything is shown to the learner.

**Why not higher:** The AI-based confirmation trigger and freeform
classification are still gated behind a live Gemini key and real quota — the
rule-based paths keep the product working without AI at all, which is a real
robustness strength but does mean part of the "creative AI" story leans on a
path that isn't strictly AI. This is a smaller gap than it used to be (the
embeddings map runs with zero API dependency and is a real second technique,
not a workaround), which is why the estimate moved from 21 to 24, not to 25.

## Technical Execution — self-estimate: 24/25 (+2)

**What engineering is impressive?**
- 336 automated tests (up from 166 at the last write-up) across unit,
  route-level HTTP, and full-session integration tests.
- Real safety engineering: rate limiting, request body size capping,
  strict Zod validation, deterministic fallbacks for every AI call site.
- Backward-compatible schema evolution, verified by dedicated tests.
- **New**: real screenshots now exist for every shipped feature (10 of 13
  planned shots, `SCREENSHOTS.md`), captured via actual browser automation
  against the real running app — not claimed, observed.
- **New**: `main`/`origin/main` and the live Vercel deployment are now caught
  up to the actual state of the project. A judge cloning the repo or
  visiting the live link today sees the real, current product, not a stale
  11-commits-behind version — this was previously the single biggest gap
  between "built" and "visible," and it's now closed.
- Checked one specific concern from the last write-up: `package-lock.json`'s
  `@playwright/test` references are Next.js's own optional peer-dependency
  metadata, not a leftover artifact from this project's own temporary
  Playwright installs — false alarm, nothing to clean up there.

**Does everything actually work?** Locally, yes — every feature has been
exercised against a real running dev server repeatedly, not just unit
tested in isolation.

**Why not higher:**
- The live Vercel deployment is still explicitly a UI preview — the
  JSON-file store needs one persistent process, which serverless functions
  don't provide, so nothing typed there actually persists. This is honestly
  disclosed in-app (`DeploymentNotice.tsx`) and in the README, and migrating
  to a hosted database was a deliberate, explicit trade-off **not** taken
  this cycle (time-boxing risk near the deadline over a rushed migration) —
  a real, acknowledged gap, not an oversight.
- Single-instance in-memory caches (`problemCache.ts`, `spotMistakeCache.ts`)
  share the same limitation.
- No live camera capture screenshot exists — attempting one with a faked
  video device produced only a synthetic test pattern, judged not worth
  publishing over honestly leaving it uncaptured (see `SCREENSHOTS.md`).

## Pitch & Demo — self-estimate: still pending, not scored

**Can the idea be understood in 2 minutes?** `DEMO_SCRIPT.md` has been
rewritten to include the new material (the subject switch and the
embeddings map, the two highest-leverage additions) while keeping the
existing core-mechanic segment — still the strongest beat — completely
untouched. The script now covers seven distinct beats in 2:00: the problem
statement, the confirmation-round mechanic, `/compare`'s synced reveal, a
live subject switch, and the dashboard's mastery/confirmation/embeddings-map
story.

**Why this still isn't scored:** Nobody has actually recorded and watched
the video yet — this remains true, and remains the actual gating item. A
script being well-written and a video being well-executed are different
things: pacing, screen legibility, and whether the narration fits inside
2:00 spoken at a natural pace are all unverified until it's recorded. **The
highest-priority remaining task for this whole project is still recording
DEMO_SCRIPT.md and watching it back** — everything else that was fixable
without a live human recording session has now been fixed.

## What to actually fix before submitting, in priority order

1. **Record the demo video** and time it against a stopwatch — this is the
   only item left on this list that isn't already done.
2. Everything else — the mechanic, the tests, the docs, the screenshots,
   `main` being caught up with the live deploy — is in a genuinely
   submittable state as of this write-up.
