import Link from "next/link";
import { CONCEPTS } from "@/lib/domain/concepts";
import { StatusIcon } from "@/components/GradeMarks";

export default function Home() {
  return (
    <div className="mx-auto max-w-[1080px] px-5 pb-32 pt-16 sm:px-8">
      <section className="grid gap-14 lg:grid-cols-[1fr_460px] lg:items-center">
        <div>
          <span className="badge bg-primary-wash text-primary">Algebra I · AI-powered</span>
          <h1 className="mt-5 max-w-[15ch] font-display text-[50px] font-extrabold leading-[1.06] tracking-tight text-ink sm:text-[60px]">
            Most tutors trust a right answer. Misko checks if you earned it.
          </h1>
          <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-ink-soft">
            You can get the right number by luck, a memorized trick, or genuine understanding —
            and a normal quiz can&apos;t tell the difference. Misko can: it quietly double-checks
            shaky-looking correct answers with a follow-up problem, and only says something if
            the understanding doesn&apos;t actually hold up.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/practice" className="btn-primary">
              Start practicing →
            </Link>
            <Link href="/compare" className="btn-secondary">
              See two learners, live
            </Link>
          </div>
        </div>

        {/* A live product screenshot, not a decorative graphic — the actual result view from /practice. */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border-soft bg-border-soft px-5 py-3">
            <span className="text-[12px] font-medium text-ink-soft">Practice · Combining Like Terms</span>
            <span className="text-[11px] text-ink-faint">live from /practice</span>
          </div>
          <div className="p-6">
            <p className="text-[12px] text-ink-faint">Simplify: 6x² + 5x²</p>
            <p className="mt-1.5 font-mono text-[19px] text-ink">= 11x⁴</p>

            <div className="callout danger mt-5 flex gap-3">
              <StatusIcon kind="danger" />
              <div>
                <p className="text-[14px] font-semibold text-ink">Caught — that first one was a guess</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">
                  You answered a similar problem correctly a moment ago — but this one shows the
                  same gap: the exponent doesn&apos;t change when you combine like terms, only the
                  coefficient does.
                </p>
              </div>
            </div>

            <div className="callout success mt-3 flex items-center gap-3">
              <StatusIcon kind="success" />
              <p className="text-[13.5px] font-medium text-ink">
                Earlier: &quot;4x² + 3x² = 7x²&quot; marked correct
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-28">
        <h2 className="max-w-[26ch] font-display text-[28px] font-semibold text-ink">
          Why it&apos;s not another AI tutor
        </h2>
        <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
          Five things that only work because a real learner model sits underneath.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            {
              t: "Catches lucky guesses",
              d: "A correct answer isn't automatically trusted — Misko can quietly re-check shaky reasoning with a follow-up problem before ever telling you anything.",
              icon: (
                <path d="M4 12.5 8 16.5 20 4.5 M4 4.5 8 8.5" strokeLinecap="round" strokeLinejoin="round" />
              ),
              tile: "bg-primary-wash text-primary",
            },
            {
              t: "Diagnosis, not just a score",
              d: "A wrong answer is classified against a curated misconception taxonomy — the hint targets the actual flawed reasoning, not a generic “try again.”",
              icon: <circle cx="11" cy="11" r="7" />,
              icon2: <path d="M16 16 L21 21" strokeLinecap="round" />,
              tile: "bg-danger-wash text-danger",
            },
            {
              t: "Mastery gating",
              d: "You can't advance to the next concept on completion alone — a real retrieval-based mastery check has to pass first (Bloom's 2-sigma, applied).",
              icon: (
                <>
                  <rect x="5" y="11" width="14" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
                </>
              ),
              tile: "bg-success-wash text-success",
            },
            {
              t: "Confidence calibration",
              d: "You predict your confidence before answering. Misko tracks where confidence and accuracy diverge — a documented high-impact metacognitive signal.",
              icon: (
                <>
                  <path d="M4 17a8 8 0 0 1 16 0" strokeLinecap="round" />
                  <path d="M12 17 16 10" strokeLinecap="round" />
                </>
              ),
              tile: "bg-chalk-accent-wash text-chalk-accent",
            },
            {
              t: "Never leaks the answer",
              d: "Hints escalate through a tiered ladder (clarifying question → targeted pointer → worked method) but the final step is always yours to take.",
              icon: (
                <>
                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 4 20 20" strokeLinecap="round" />
                </>
              ),
              tile: "bg-primary-wash text-primary",
            },
          ].map((item) => (
            <div key={item.t} className="card p-5">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tile}`}>
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {item.icon}
                  {item.icon2}
                </svg>
              </span>
              <p className="mt-3.5 font-display text-[17px] font-semibold text-ink">{item.t}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{item.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2 className="font-display text-[28px] font-semibold text-ink">Concepts covered</h2>
        <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
          Deliberately narrow — five Algebra I fundamentals, in the order the mastery gate
          teaches them.
        </p>
        <div className="card mt-6 divide-y divide-border-soft">
          {CONCEPTS.map((c) => (
            <div key={c.id} className="flex flex-col gap-0.5 px-5 py-4 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="font-medium text-ink">{c.name}</span>
              <span className="text-[14px] text-ink-faint">{c.description}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
