# Architecture

This describes how a single answer submission actually flows through the code, and
why it's split the way it is. It exists because a bunch of comments across the
codebase say "see ARCHITECTURE.md" and until now there was nothing to see.

## Pipeline for one answer

`POST /api/submit-answer` (`src/app/api/submit-answer/route.ts`) does, in order:

1. **Answer analyzer** (`src/lib/analyzer.ts`) — a pure function, no AI, no
   database. It compares the normalized answer against the problem's known-correct
   value and known-distractor value. This step decides right/wrong, and it never
   goes through the LLM, because correctness can't be allowed to depend on model
   output.
2. **Diagnosis pipeline** (only runs on a wrong answer) — three tiers, tried in
   order, each one only reachable if the one before it found nothing:
   - **Rule-based**: did the wrong answer exactly match a known distractor value
     for this problem? If so, the misconception is already known with certainty —
     no AI involved.
   - **AI (Gemini)**: if the answer didn't match a known distractor but the learner
     wrote out their reasoning, `classifyFreeformMisconception`
     (`src/lib/ai/gemini.ts`) asks Gemini to classify that reasoning against the
     concept's misconception taxonomy. This is real classification work — Gemini
     picks from a candidate list, it doesn't just rephrase a pre-computed result.
   - **Local similarity**: if there's no Gemini key (or the call fails) but there
     is written reasoning, `classifyByTextSimilarity`
     (`src/lib/domain/textSimilarity.ts`) falls back to TF-IDF + cosine similarity
     against each misconception's description. Weaker than an LLM reading the
     explanation, deliberately tuned conservative — see that file for the
     threshold history.
   - If none of the three produce a match, the learner gets a general hint instead
     of a specific one. This is intentional: a wrong guess is worse than no guess.
3. **Correct-answer check** (only runs on a correct answer) — see "Catching the
   Correct Answer Trap" below.
4. **Mastery update** — every graded attempt, right or wrong, feeds Bayesian
   Knowledge Tracing (`src/lib/bkt.ts`) to update the concept's mastery estimate.
5. **Response** — the diagnosis (or lack of one), an escalating hint tied to the
   specific misconception, and the mastery delta this one answer caused.

## Catching the Correct Answer Trap

Recent research (arXiv 2605.23925, 2606.23205 — cited in the README) shows AI
tutors that only check the final answer miss a real failure mode: a learner can
reach the right number through broken reasoning (e.g. two sign errors that cancel
out) and the tutor has no way to notice, because the answer alone looks fine.

Misko never trusts a single correct answer as proof of understanding when there's a
reason to be suspicious of it. Two independent ways a correct answer can raise
suspicion (`src/app/api/submit-answer/route.ts`, the `correct` branch):

- **Rule-based, always on**: `lastMisconceptionOnConcept` (`src/lib/learnerModel.ts`)
  checks whether the learner's *previous* attempt on this same concept was a wrong
  answer matched to a specific misconception. Getting it right immediately after
  doesn't yet prove the mistake was fixed rather than retried until it landed by
  chance. No AI or written reasoning required — this keeps the mechanic working
  even with no `GEMINI_API_KEY` set.
- **AI-based, needs shown work**: `classifyCorrectReasoning` gives Gemini the
  learner's own written reasoning on a correct answer and asks whether it actually
  implies a known misconception despite landing on the right number.

Either path sets `confirmation_status: "pending"` on the attempt
(`src/lib/store.ts`) and nothing is said to the learner yet — no accusation off a
single signal. `decideNextProblem` then serves a silent confirmation-round problem
of the same type. Two outcomes:

- Answered correctly again → `resolvePendingConfirmation(learnerId, "confirmed")`.
  The original answer's reasoning holds up. Still nothing said beyond the normal
  correct-answer feedback.
- Answered wrong → `resolvePendingConfirmation(learnerId, "caught")`. The response
  explicitly says so: `caughtOriginalPrompt` names the earlier problem, and the
  dashboard's confirmed/caught stat updates.

This is the one place in the product where a correct answer doesn't just move the
learner forward — it can also open a question that only a second, independently
graded problem gets to close.

## AI safety / robustness

The product must not depend on Gemini being up, fast, or configured, and must not
let a single wrong AI judgment reach the learner unchecked.

- **No API key at all**: every Gemini call site checks `isGeminiConfigured()`
  first. Diagnosis and hint generation fall back to
  `fallbackDiagnosis`/`fallbackCorrectFeedback` (`src/lib/ai/fallback.ts`) —
  deterministic templates built from the learner's real history (not
  byte-identical text for everyone), so `/compare` still shows two learners
  diverging even with no key configured. Freeform classification
  (`classifyFreeformMisconception`) has no deterministic equivalent — asking an
  LLM to classify reasoning isn't something a template can fake — so without a key
  it's simply skipped (`attempted: false`) and the caller moves to the local
  similarity tier described above.
- **The call fails or times out**: every Gemini call site is wrapped in
  `withTimeout` and a try/catch; a failure logs and falls back exactly like a
  missing key would, never throws through to the learner.
- **Cost and abuse**: `checkRateLimit` (`src/lib/rateLimit.ts`) caps both
  `/api/submit-answer` and `/api/transcribe-work` per-learner and globally — the
  global cap is the one that actually matters, since a per-learner cap alone is
  trivially bypassed by generating new learner ids. `readJsonBody`
  (`src/lib/readJsonBody.ts`) caps request body size at the stream level before
  either route parses JSON, so an oversized payload (a huge base64 image, say)
  never fully buffers into memory.
- **A single AI judgment never reaches the learner unverified** — see "Catching
  the Correct Answer Trap" above; the same discipline applies to a wrong-answer
  diagnosis, which is why the rule-based tier is always tried before the AI tier
  rather than the other way around.

## Future work

Things that are real limitations right now, not oversights hiding as design:

- **No evaluation against real usage data.** The BKT parameters
  (`src/lib/bkt.ts`) are fixed literature-typical defaults (Corbett & Anderson,
  1994), not fit to any Misko-specific data — there isn't any real usage history
  to fit them against yet. Same caveat applies to the TF-IDF similarity
  threshold: it's tuned against a handful of stress-tested examples, not a
  labeled dataset. Both would benefit from real logged attempts once this has
  actual users.
- **Single-instance storage.** `src/lib/store.ts` (JSON file) and
  `src/lib/problemCache.ts` / `src/lib/spotMistakeCache.ts` (in-memory maps) all
  assume one long-running process. Fine for `npm run dev`/`npm start`, not for a
  multi-instance or serverless deployment (see the README's live-demo note) —
  would need a real shared database.
- **The confirmation-round mechanic could be generalized** beyond a single
  pending check per learner, e.g. queuing more than one suspected misconception
  at once, if usage ever showed that mattered.
