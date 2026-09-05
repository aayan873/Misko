# Screenshots — Misko

**Status: partially captured**, using real Playwright browser automation against a
real running dev server (Node 22, installed temporarily for this — see below) —
the first time this project has actually been seen rendered in a browser rather
than verified via `curl`/build output alone. 5 of the 9 originally-listed shots exist
now, saved in `screenshots/`. The rest need a real GEMINI_API_KEY with quota available
(this session's key was already exhausted — 20 free-tier requests/day — so every
shot below shows the deterministic **fallback-template** path, not live Gemini text)
and/or manual `/compare` interaction that wasn't scripted this pass.

Captured, in the repo now:

1. **`00-home.png`** — landing page hero, desktop.
2. **`01-caught-moment.png`** — the flagship "Caught" moment: a wrong answer on a
   confirmation-round problem, with the callout naming the earlier correct problem
   ("Evaluate: 9 × 8 + 3") that didn't hold up. **Notable finding**: this fired
   correctly with a real Gemini key configured but its quota exhausted — the
   rule-based confirmation trigger (`lastMisconceptionOnConcept`,
   ARCHITECTURE.md) doesn't need a live AI call at all, so the flagship mechanic
   demoed here works even in fallback mode. The original checklist below (item 1)
   claimed this "requires a live GEMINI_API_KEY" — that claim was wrong, corrected now
   that it's been actually observed working without one.
3. **`02-correct-before-the-twist.png`** — the quiet correct answer right before the
   twist, paired with shot 1 as the before/after DEMO_SCRIPT.md describes.
4. **`03-dashboard.png`** — dashboard with real data: confirmed-mastery stat, concept
   path, misconception radar, misconception history, calibration chart.
5. **`04-misconception-diagnosis.png`** — a first-time wrong-answer diagnosis, named
   misconception + Socratic hint, mastery ring mid-update.

**A real bug found and fixed via this pass**, only catchable by actually rendering
the UI: `MisconceptionRadar.tsx`'s outer axis labels ("Distributing", "Equations")
were clipping at the SVG's edge for the two most-horizontal axes — SVG clips content
outside its viewBox by default, and the label radius left too little margin at the
old canvas size. Fixed by widening the canvas (`SIZE` 280 → 340); re-verified at both
desktop and 375px mobile widths with real screenshots (`03-dashboard.png` and the
375px pass both confirm all 5 labels now render fully). Every route was also checked
at 375px/768px/1280px for horizontal overflow (none found) and browser console/page
errors (none found) as part of this same pass.

## Still not captured

6. **`/compare` after "Reveal the difference"** — needs manual (or newly-scripted)
   interaction with the compare page's own seed/reveal flow.
7. **`/practice` — reasoning trace mid-reveal** — needs a screenshot timed to the
   staggered reveal animation's middle, not its start or end.
8. **`/dashboard` — calibration chart with 2-3+ confidence levels populated** — the
   captured dashboard shot only has one confidence level's worth of data from the
   scripted flow.
9. Any shot showing **live Gemini text** rather than the fallback template — needs a
   working API key with quota remaining.

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
