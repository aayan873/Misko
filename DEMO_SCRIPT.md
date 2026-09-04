# Demo script (2:00 hard cap)

Timed to the structure the competition asks for. Every line of on-screen text
and every number below is real — copied from an actual local run of the app
while writing this (see the walkthrough note at the end), not written from
memory or imagination. Re-run it yourself before recording to reconfirm exact
numbers, since problems are randomly generated and specific values (like
pMastery percentages) will differ run to run even though the behavior won't.

Record locally (`npm run dev`) with a real `GEMINI_API_KEY` in `.env` if you
want live Gemini text in the demo rather than the fallback templates — both
work, but seeing the "Analyzing your written reasoning with Gemini" step
actually fire is a stronger visual than the deterministic fallback. If you
don't have a working key or hit quota, the fallback text used in this script
is what recording without one will actually show — don't fake having AI text
that isn't there.

---

## 0:00–0:15 — The problem

Open `/`. Read the headline out loud as it's on screen, don't paraphrase it:

> "Most tutors trust a right answer. Misko checks if you earned it."

Follow with the subhead, also verbatim:

> "You can get the right number by luck, a memorized trick, or genuine
> understanding — and a normal quiz can't tell the difference."

That's the entire problem statement in two sentences someone else already
wrote well. Don't add narration on top of it.

## 0:15–0:30 — The big idea

Point at the homepage's live example card (6x² + 5x² = 11x⁴, flagged "Caught
— that first one was a guess"). Say, in your own words, something like:

> "Misko doesn't just grade the answer. When a correct answer looks
> shaky, it quietly gives a second, different problem to check — and only
> says something if the understanding didn't actually hold up."

Click into `/practice`.

## 0:30–1:15 — Live demo of the core mechanic (the wow moment)

This is the confirmation-round mechanic end to end, exactly as it behaves —
walked through live while writing this script:

1. **First problem** (order of operations): *"Evaluate: 2 + 6^2"*.
   Set confidence high, answer **64** (applying `+` before the exponent —
   a real, named misconception, not a random wrong number). Submit.
   Feedback names it specifically: *"It looks like your answer matches a
   common pattern: treats an exponent as if it applies after
   addition/multiplication rather than before, per standard precedence."*
   — say out loud: **this isn't a generic "wrong, try again."**
2. **Next problem**, same concept: *"Evaluate: 5 + 2^2"*. Answer correctly
   (**9**). Normal positive feedback — nothing unusual shown yet.
3. **Next problem** looks completely ordinary but isn't: badge reads
   **"double-check"**, reason: *"Double-checking your last correct answer
   with a similar problem."* — point this out on screen, since it's easy to
   miss and it's the actual mechanic firing silently.
4. Answer this one **wrong too**, the same way (applying the exponent
   last again — e.g. **144** instead of 24 on *"Evaluate: 8 + 4^2"*). The
   response changes: `confirmationResolved: "caught"`, and the feedback
   adds a line naming the exact earlier problem: *"This double-checks an
   earlier correct answer to 'Evaluate: 5 + 2^2' — it didn't hold up."*
   **This is the moment to slow down on camera.** The system just proved,
   with a real second graded problem, that a "correct" answer two steps ago
   wasn't actually understood — not a guess, not a vibe.

Say directly to camera: *"It never accused anything off one answer. It
waited for a second, independently graded problem before saying so."*

## 1:15–1:40 — The personalization mechanism

Switch to `/compare`. It seeds two fictional learners with different recent
histories (Priya: recent negative-number sign errors; Marcus: recent
combining-like-terms exponent confusion) and submits the **exact same wrong
answer** to the **exact same problem** for both, through the real backend —
nothing scripted per-learner. Watch the two feedback panels render
side-by-side. Point out that the diagnosis body is IDENTICAL for both
(the same misconception, correctly matched for both) — but only Priya's
appends a second sentence: *"This connects to something you've also recently
shown: Negative-times-negative sign error."* Marcus doesn't get that
sentence, because that's not his relevant recent history. Say:

> "Same wrong answer, same problem, and the system responds differently —
> because it actually knows something different about each of them."

Then jump to `/dashboard` for whichever learner you were using in the first
segment. Point at: the mastery bar for order of operations moving (not a
locked/unlocked binary — an actual probability), the misconception history
entry for "Exponent applied last instead of early" showing **2 occurrences,
not yet resolved**, and the confirmed/caught headline stat: **1 checked, 1
caught, 0 confirmed** — the exact real numbers from the walkthrough above,
visible as a persistent record, not just a one-time popup.

## 1:40–1:55 — Measurable value

Say plainly, without overclaiming: *"This is Bayesian Knowledge Tracing, not
a streak counter — one slip lowers the estimate instead of needing to
reset a whole progress bar. We measured that directly: it takes a minimum of
3 correct answers to cross mastery at high accuracy, and meaningfully longer
at lower accuracy — real numbers, not a guess, documented in
EVALUATION.md."* Optionally show the `/spot-the-mistake` or `/teacher` view
for five seconds each if time allows, but don't let this section run long —
the wow moment already happened.

## 1:55–2:00 — Final statement

> "Misko doesn't ask whether you got the answer right. It asks whether you'd
> get it right again — and it's the only way to actually tell the difference
> between the two."

---

## Notes on this script

- Every quoted line of app copy above was read directly off a real response
  from the running app (or, for the homepage, directly off `page.tsx`) while
  writing this file — none of it is invented dialogue. Exact numeric values
  (pMastery, specific wrong numbers used) will vary between runs because
  problems are randomly generated each time; the described *behavior*
  (misconception naming, the silent confirmation round, the caught reveal,
  the two-learners-diverge result) is deterministic and will recur exactly.
- If recording without a `GEMINI_API_KEY` (or with one that's hit quota),
  every line above still happens exactly as described — the rule-based
  confirmation trigger and the misconception-matching in this specific
  script don't require Gemini at all (see ARCHITECTURE.md "Catching the
  Correct Answer Trap" — the rule-based path is deliberately AI-independent).
  What changes is `source: "fallback"` vs `source: "gemini"` in the feedback
  text's tone, not whether the mechanic works.
- This script runs close to 2:00 if delivered at a natural pace without
  reading it verbatim on camera — rehearse it once against a stopwatch
  before the real recording, since the competition's stated rule is that
  content past 2:00 isn't reviewed at all (see RESEARCH/COMPETITION.md).
