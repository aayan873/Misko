# Screenshots — Misko

**Status: 10 of 13 shots captured**, using real Playwright browser automation against
a real running dev server (Node 22, installed temporarily for this — see below), driven
against real seeded/scripted app state, never fabricated. All 6 of A0–A6's new features
(chemistry/subject switch, the embeddings similarity map, the downloadable report card,
Visual Proof diagrams, and `/compare`'s synced reveal) are now captured alongside the 4
original shots.

Captured, in the repo now:

1. **`00-home.png`** — landing page hero, desktop.
2. **`01-caught-moment.png`** — the flagship "Caught" moment: a wrong answer on a
   confirmation-round problem, with the callout naming the earlier correct problem
   ("Evaluate: 9 × 8 + 3") that didn't hold up. **Notable finding**: this fired
   correctly with a real Gemini key configured but its quota exhausted — the
   rule-based confirmation trigger (`lastMisconceptionOnConcept`,
   ARCHITECTURE.md) doesn't need a live AI call at all, so the flagship mechanic
   demoed here works even in fallback mode.
3. **`02-correct-before-the-twist.png`** — the quiet correct answer right before the
   twist, paired with shot 1 as the before/after DEMO_SCRIPT.md describes.
4. **`03-dashboard.png`** — dashboard with real data: confirmed-mastery stat, concept
   path, misconception radar, misconception history, calibration chart.
5. **`04-misconception-diagnosis.png`** — a first-time wrong-answer diagnosis, named
   misconception + Socratic hint, mastery ring mid-update.
6. **`05-chemistry-subject-switch.png`** — the subject switcher on `/practice`, mid-
   switch to Chemistry, showing a real dimensional-analysis problem render.
7. **`06-misconception-map.png`** — the embeddings-based similarity map on
   `/dashboard`, with real misconception history from a learner who'd made 3 mistakes
   across 2 concepts (2 resolved, 1 not) — shows both the faded/filled/ring states.
8. **`07-report-card.png`** — the downloadable report card, using the exact same
   learner as shot 6, so the numbers (2/3 misconceptions resolved) visibly match.
9. **`08-visual-proof.png`** — a Visual Proof diagram (order-of-operations) shown
   after a correct answer, computed from the problem's real generation params.
10. **`09-compare-synced-reveal.png`** — `/compare` after "Reveal the difference,"
    both panels' diagnoses landing in the same beat — captured with a real,
    unexhausted Gemini key, so this one genuinely shows **live Gemini response** text,
    not the fallback template (visible in the "live Gemini response" caption on both
    panels).

**A real bug found and fixed via this pass** (from the original B1 capture cycle),
only catchable by actually rendering the UI: `MisconceptionRadar.tsx`'s outer axis
labels ("Distributing", "Equations") were clipping at the SVG's edge for the two
most-horizontal axes. Fixed by widening the canvas (`SIZE` 280 → 340).

**One synthetic artifact deliberately NOT kept**: an attempt to screenshot the live
camera capture modal using Chromium's `--use-fake-device-for-media-stream` produced
only a fake green test-pattern feed (a clock overlay on a solid color), which would
read as a broken/fake camera preview if published. The real hero shot of holding
actual handwritten work up to a live webcam is left to a real recording, not a
synthetic stand-in — see `DEMO_SCRIPT.md`.

## Still not captured

11. **`/practice` — reasoning trace mid-reveal** — needs a screenshot timed to the
    staggered reveal animation's middle, not its start or end.
12. **`/dashboard` — calibration chart with 2-3+ confidence levels populated** — every
    captured dashboard shot only has one confidence level's worth of data from the
    scripted flow so far.
13. **A real photo of handwritten work read by live camera capture** — needs the
    user's own photo and their own recording, not something to fabricate (see above).

## How to capture more

```bash
cd misko
source ~/.nvm/nvm.sh && nvm install 20 && nvm use 20   # Playwright needs Node 20+
npm install -D playwright && npx playwright install chromium
npm run dev
```

Then drive `page.goto`/`page.fill`/`page.click` against `http://localhost:3000` and
`page.screenshot()` at each `DEMO_SCRIPT.md` beat — see this session's approach (real
browser automation, not manual clicking, so it's exactly reproducible) rather than
requiring a human at a keyboard. `npm uninstall playwright` afterward if it's not
staying in the project as a permanent dependency — it wasn't kept as one here
(large browser binaries, no ongoing use in the shipped app), so `package.json` doesn't
carry it.
