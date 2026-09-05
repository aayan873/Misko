# Screenshots — Misko

**Status: not yet captured.** Per `EVALUATION.md`, browser-rendered screenshots could
not be taken in this sandboxed build environment (Node 18, no compatible headless
browser tool). The pages were verified to build cleanly and return HTTP 200, and the
full interactive loop was verified against the live API with `curl` — but an actual
image has not been generated. Listed below is exactly what to capture and why, so this
is a checklist to execute (ideally while recording `DEMO_SCRIPT.md`), not a set of
claims about images that exist.

## Shots to capture, in priority order

1. **`/practice` — the "Caught" moment.** The single most important shot: the red
   status callout naming the earlier correct problem and explaining that answer might
   have been a lucky guess. This is the strongest, most novel proof point in the
   product — requires a live `GEMINI_API_KEY` and the rehearsed example from
   `DEMO_SCRIPT.md` (fallback mode never raises this hypothesis). Use it as the
   README hero image / Devpost cover image, ahead of everything else.
2. **`/practice` — the quiet "Correct" moment right before it**, ideally paired with
   shot 1 as a before/after: the first answer coming back plainly "Correct," nothing
   suspicious shown, to make the twist in shot 1 land.
3. **`/dashboard` — the "Confirmed mastery" headline stat**, with at least one caught
   answer so the number and the red "didn't hold up" note are both visible.
4. **`/compare` after "Reveal the difference".** Two learner panels, same problem, same
   wrong answer, visibly different diagnosis text with each panel's own history chips
   explaining why — works in fallback mode too (verified live, see `EVALUATION.md`).
5. **`/practice` — reasoning trace mid-reveal.** Catch it while the step-by-step trace
   is animating (checked patterns → matched/classifying → done) — shows the AI's
   process, not just its output.
6. **`/practice` — misconception diagnosis result.** Problem visible, the red status
   callout showing a *named misconception* + Socratic hint (not the answer).
7. **`/dashboard` — concept mastery path + misconception history.** At least one
   resolved misconception (check for the "diagnosed from your reasoning" note if you
   triggered the freeform classification path) and partial concept progress along the
   connected concept path.
8. **`/dashboard` — calibration chart.** The confidence-vs-accuracy bar chart with at
   least 2-3 confidence levels populated.
9. **`/` — landing page hero.** Shows a live product screenshot (the actual
   `/practice` result view) next to the headline — good standalone "what is this"
   context shot too.

## How to capture

```
cd misko
cp .env.example .env   # add a real GEMINI_API_KEY for live (non-fallback) hint text
npm run dev
```
Open `http://localhost:3000` in a real browser, clear `localStorage` (or use a fresh
incognito window) for a clean zero-state learner, then follow `DEMO_SCRIPT.md` step by
step, taking a screenshot at each numbered beat above. Save into `misko/screenshots/`
and reference them from `README.md`'s placeholder image links once captured.
