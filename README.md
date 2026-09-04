# Misko

**Most AI tutors trust a right answer. Misko checks if you earned it.**

Built for the [Prom Virgo Challenge](https://virgo.devpost.com) (Prometheus Virgo
Challenge) — an AI/ML educational tool hackathon.

## The problem

You can get the right answer on a math problem by luck, a half-remembered trick, or
genuine understanding — and a normal quiz can't tell the difference. Most AI tutoring
products (Khanmigo, Quizlet's Q-Chat, generic ChatGPT wrappers) only check *whether* an
answer is correct; if it is, they move on and trust it. 2025-26 research (the "Correct
Answer Trap") shows this is a real, current, unsolved gap — even sophisticated AI tutors
systematically miss flawed reasoning hiding behind a correct final number.

## The solution

Misko is an Algebra I practice tutor that:

1. **Catches lucky guesses.** When a correct answer's reasoning looks shaky, Misko
   silently queues a follow-up problem of the same type — if you get that one wrong too,
   *now* it says something: "that first correct answer might not have been solid." If
   you get it right, nothing is ever said — no false accusations, ever. The detection is
   built to never trust a single AI judgment: a hypothesis only ever queues a real,
   deterministically-graded follow-up problem, never an accusation on its own. The
   dashboard tracks this as a headline stat: **N / M answers confirmed solid**.
2. **Classifies the specific misconception** behind a wrong answer (e.g. "you applied
   strict left-to-right evaluation instead of operator precedence"), not just that it's
   wrong — matched against a curated taxonomy of 15 well-documented misconceptions
   across 5 concepts.
3. **Never states the answer.** A Gemini-powered Socratic hint ladder (3 escalating
   levels) targets the diagnosed misconception with questions, not answers.
4. **Gates progression on real mastery**, not completion — you can't move to the next
   concept until a retrieval-based streak shows you've actually got it (Bloom's 2-sigma
   mastery learning, applied).
5. **Tracks confidence calibration** — you predict your confidence before answering, and
   the dashboard shows where your confidence and actual accuracy diverge.
6. **Makes the learner model visible.** The dashboard isn't a vanity page — it's the
   actual state driving every decision the tutor makes next.
7. **Classifies freeform reasoning, not just final answers.** If your wrong answer
   doesn't match a known distractor, you can optionally write out how you solved it —
   Gemini then classifies the misconception from your own explanation against the full
   taxonomy, genuine reasoning over unstructured input, not just phrasing a
   precomputed result.
8. **Proves the personalization claim live, not just in a demo video.** `/compare`
   seeds two real learner profiles with different histories, has both submit the exact
   same wrong answer to the exact same problem through the real backend, and shows
   their diagnoses diverge — click it yourself instead of taking our word for it.

## Target users

High-school and early college students learning Algebra I fundamentals (order of
operations, negative numbers, the distributive property, combining like terms, solving
linear equations) — deliberately narrow rather than "students in general."

## How it works (architecture)

```
Learner → confidence prediction → Problem Engine (deterministic)
        → Answer Analyzer (deterministic: correct / matches known misconception / unrecognized)
        → [if unrecognized + shown work given] Gemini Freeform Classifier
          (real reasoning over the learner's own explanation; no fallback — honestly
          skipped if AI is unavailable)
        → [if CORRECT + shown work given] Gemini Reasoning Check
          (soft, silent hypothesis only — never shown to the learner; queues a real
          follow-up problem that either confirms it silently or, only if the learner
          also misses THAT one, surfaces "that might have been a lucky guess")
        → Gemini Diagnosis Layer (natural-language diagnosis + Socratic hint;
          falls back to a deterministic template if no API key / API failure —
          the template still varies by the learner's own history)
        → Learner Model (JSON-file store: mastery, misconceptions, calibration,
          confirmed-vs-caught correct-answer stats)
        → Mastery Gate (decides: resolve a pending confirmation / retarget misconception
          / interleave review / advance)
        → Dashboard (the learner model, made visible — headline stat: "N/M confirmed
          solid") · /compare (the personalization claim, made live and clickable with
          two seeded, distinct learners)
```

**Why the AI matters, concretely:** math correctness is never delegated to the LLM —
every problem is generated with a known-correct answer and known "if you got this wrong
value, here's the misconception that produced it" mapping, entirely in deterministic
TypeScript (`src/lib/domain/problemEngine.ts`, `src/lib/analyzer.ts`). The
LLM's job is strictly what only an LLM can do well: turning a classified misconception
into personalized, natural Socratic language that adapts to the learner's recent
history, under a hard rule to never leak the answer.

## Technology

- **Frontend + backend:** Next.js 14 (App Router), TypeScript, Tailwind CSS — one
  deployable app, API routes double as the backend.
- **AI:** Google Gemini API (`gemini-1.5-flash` by default).
- **Persistence:** a dependency-free JSON file store — `better-sqlite3`'s native binding
  segfaulted in testing on this environment's Node 18, a real portability risk, so a
  zero-native-dependency store was chosen instead.
- **Validation:** Zod on every API route input.
- **Tests:** Vitest — 65 tests covering the deterministic core, mastery gate (including
  the Correct-Answer-Trap confirmation mechanism), AI fallback behavior, and input
  validation (`tests/`).

## Setup

```bash
npm install
cp .env.example .env
# Add your Gemini API key to .env (get one at https://aistudio.google.com/apikey)
# The app runs fully without a key too — it falls back to deterministic hint templates.
npm run dev
```

Visit `http://localhost:3000`.

### Run tests

```bash
npm test
```

## Usage

1. Visit `/practice`. A problem appears for your current frontier concept.
2. Predict your confidence (1–5), then answer.
3. If wrong, you get a diagnosis tied to the specific misconception your answer implies
   (or a general nudge if it's an unrecognized error) — never the answer itself. Try
   again with an escalating hint, or after 3 attempts the answer is revealed and you
   move on.
4. If correct, you get specific positive feedback and the next problem — either the
   next frontier concept, a review of a weaker past concept (interleaving), a retry of
   an unresolved misconception, or — if you wrote out your reasoning and it looked
   shaky — a silent confirmation-round problem of the same type. Nothing is said unless
   you also miss that one; if you do, Misko tells you the earlier correct answer might
   have been a lucky guess.
5. Visit `/dashboard` any time to see your actual learner model: the headline
   confirmed-vs-caught stat, mastery per concept, misconception history, and confidence
   calibration.

## Limitations (honest, not hidden)

- **No browser-rendered UI screenshots yet.** This was built in a sandboxed environment
  without a working headless-browser tool — the UI should be manually smoke-tested in a
  real browser before a demo is recorded.
- **Freeform misconception classification only activates when the learner opts in**
  (writes out their work) and the deterministic match already failed — most
  interactions still go through the faster rule-based match, a deliberate reliability
  tradeoff for a math tool. Diagnosing reasoning with *no* freeform hint at all remains
  open future work.
- **The Correct-Answer-Trap catch also only activates when the learner opts in** (same
  shown-work requirement), and the underlying published detection technique is
  genuinely weak on its own (~70-84% recall per arXiv 2606.23205, 2605.23925) — which is exactly
  why Misko never acts on that first AI judgment alone; it's a soft hypothesis that a
  real, deterministically-graded follow-up problem has to independently confirm before
  anything is ever shown to the learner. This makes false positives rare by
  construction, but it also means the catch rate is conservative — it will miss shaky
  reasoning more often than it flags it, which is the correct tradeoff for a learning
  tool but worth being upfront about.
- **JSON-file persistence, single-process problem cache.** Fine for a hackathon-scale,
  single-instance deployment; would need a real datastore for multi-instance production
  use.
- **5 concepts, 15 misconceptions.** Deliberately narrow scope (Algebra I fundamentals)
  rather than broad subject coverage.
- **No real student usage data.**

## Repository structure

```
src/lib/domain/            concepts, misconceptions, problem engine (deterministic core)
src/lib/analyzer.ts        answer classification
src/lib/learnerModel.ts    mastery gate, calibration, misconception history
src/lib/ai/                Gemini integration + deterministic fallback
src/lib/store.ts           JSON-file persistence
src/app/                   Next.js pages + API routes
tests/                     Vitest suite (65 tests)
```
