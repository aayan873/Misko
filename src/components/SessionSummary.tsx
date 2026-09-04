"use client";

import { useEffect, useState } from "react";

interface Summary {
  attempts: number;
  correct: number;
  misconceptionNames: string[];
  confirmed: number;
  caught: number;
  conceptsMasteredNow: string[];
}

interface SessionSummaryProps {
  learnerId: string;
  sessionStart: number;
}

/** The closing-loop moment: "here's what just happened," using data that
 * already exists everywhere else on the dashboard, just windowed to this
 * browser tab's session. Renders nothing if there's been no activity yet —
 * this isn't a permanent fixture, just a recap when there's something to
 * recap. See useSessionStart.ts for what "this session" means. */
export default function SessionSummary({ learnerId, sessionStart }: SessionSummaryProps) {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch(`/api/session-summary?learnerId=${learnerId}&since=${sessionStart}`)
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => {});
  }, [learnerId, sessionStart]);

  if (!summary || summary.attempts === 0) return null;

  return (
    <section className="card mt-6 p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">This session</p>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        <span className="font-semibold text-ink">
          {summary.correct}/{summary.attempts}
        </span>{" "}
        correct
        {summary.confirmed + summary.caught > 0 && (
          <>
            , {summary.confirmed} confirmed{summary.caught > 0 && <>, {summary.caught} caught</>}
          </>
        )}
        {summary.conceptsMasteredNow.length > 0 && (
          <>
            . Mastered:{" "}
            <span className="font-medium text-success">{summary.conceptsMasteredNow.join(", ")}</span>
          </>
        )}
        {summary.misconceptionNames.length > 0 && (
          <>
            . Worked through:{" "}
            {summary.misconceptionNames.slice(0, 3).join(", ")}
            {summary.misconceptionNames.length > 3 && ` +${summary.misconceptionNames.length - 3} more`}
          </>
        )}
      </p>
    </section>
  );
}
