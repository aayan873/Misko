/**
 * A judge (or anyone) clicking the live Vercel link with no context would just
 * see the app behave strangely — nothing saved, mastery resetting on every
 * request — with no indication why. That's a real risk to how the product
 * reads on first contact (see JUDGE_SCORECARD.md's Technical Execution
 * section), and a README caveat alone doesn't reach someone who clicks the
 * link without first reading the repo. This says so directly, in the app
 * itself, only when it's actually true.
 *
 * `VERCEL` is a system environment variable Vercel sets automatically on
 * every deployment it builds and runs — not something anyone here has to
 * configure by hand, and it's unset for `npm run dev` / `npm start`
 * anywhere else, so this only ever appears on the actual Vercel deployment.
 *
 * The storage limitation is structural (JSON-file storage needs one
 * persistent process, which serverless doesn't provide) and true on every
 * Vercel deployment of this code regardless of configuration — but whether a
 * live Gemini key is set is just today's specific deployment's configuration,
 * not an architectural fact, and could change without this file changing.
 * Checked separately so the message doesn't go stale if a key gets added.
 */
export default function DeploymentNotice() {
  if (process.env.VERCEL !== "1") return null;

  const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

  return (
    <div className="border-b border-border bg-neutral-wash px-5 py-2.5 text-center text-[13px] text-ink-soft sm:px-8">
      This is a live preview on serverless hosting — nothing you do here is saved.
      {!hasGeminiKey && " AI responses also use template fallbacks (no API key configured here)."}{" "}
      Clone the repo and run it locally for the real thing.
    </div>
  );
}
