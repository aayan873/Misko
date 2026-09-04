"use client";

import { useEffect, useState } from "react";

interface RosterEntry {
  learnerId: string;
  displayName: string | null;
  totalAttempts: number;
  conceptsMastered: number;
}

interface MisconceptionEntry {
  misconceptionId: string;
  name: string;
  conceptId: string;
  conceptName: string;
  totalOccurrences: number;
  distinctLearners: number;
}

interface AtRiskEntry {
  learnerId: string;
  displayName: string | null;
  reason: "overconfident" | "underconfident" | "stuck";
  detail: string;
}

interface TeacherSummary {
  learnerCount: number;
  roster: RosterEntry[];
  misconceptions: MisconceptionEntry[];
  atRisk: AtRiskEntry[];
}

const REASON_LABEL: Record<AtRiskEntry["reason"], { label: string; className: string }> = {
  overconfident: { label: "overconfident", className: "border-danger text-danger" },
  underconfident: { label: "underselling", className: "border-primary text-primary" },
  stuck: { label: "stuck", className: "border-danger text-danger" },
};

function shortId(id: string): string {
  return id.slice(0, 8);
}

export default function TeacherPage() {
  const [state, setState] = useState<TeacherSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher-summary")
      .then((r) => r.json())
      .then(setState)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-[940px] px-5 sm:px-8 py-24 text-center text-ink-faint">Loading…</div>;
  }

  if (!state || state.learnerCount === 0) {
    return (
      <div className="mx-auto max-w-[940px] px-5 sm:px-8 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">No learners yet</h1>
        <p className="mt-3 text-ink-soft">
          This fills in once someone has practiced on this instance — nothing recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[940px] px-5 sm:px-8 py-14">
      <h1 className="font-display text-2xl font-semibold text-ink">Class view</h1>
      <p className="mt-2.5 max-w-[64ch] text-[15px] leading-relaxed text-ink-soft">
        Every learner this instance has recorded activity for — {state.learnerCount} so far. No
        accounts or rosters here (see the README): this is an honest hackathon-scale demonstration
        of a teacher-facing view, aggregating the same per-learner model the dashboard already
        shows, not a claim of classroom-ready multi-tenant software.
      </p>

      <section className="mt-10">
        <h2 className="section-title">Needs a look</h2>
        <p className="mt-2.5 mb-5 max-w-[64ch] text-[15px] leading-relaxed text-ink-soft">
          Flagged with a specific reason, not just a score — a stuck learner and an overconfident
          one need different responses.
        </p>
        {state.atRisk.length === 0 ? (
          <p className="text-[14px] text-ink-faint">Nobody flagged right now.</p>
        ) : (
          <div className="space-y-2.5">
            {state.atRisk.map((entry) => (
              <div key={entry.learnerId} className="card flex items-start gap-3 p-5">
                <span
                  className={`mt-0.5 flex-none border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${REASON_LABEL[entry.reason].className}`}
                >
                  {REASON_LABEL[entry.reason].label}
                </span>
                <div>
                  <p className="text-[14px] font-medium text-ink">
                    {entry.displayName ?? `Learner ${shortId(entry.learnerId)}`}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-soft">{entry.detail}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Common mistakes, class-wide</h2>
        <p className="mt-2.5 mb-5 max-w-[64ch] text-[15px] leading-relaxed text-ink-soft">
          Ranked by how many different learners hit each one — not just raw count, so one learner
          retrying the same problem can&apos;t dominate the ranking.
        </p>
        {state.misconceptions.length === 0 ? (
          <p className="text-[14px] text-ink-faint">No misconceptions recorded yet.</p>
        ) : (
          <div className="card divide-y divide-border-soft p-0">
            {state.misconceptions.slice(0, 10).map((m) => (
              <div key={m.misconceptionId} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-[14px] font-medium text-ink">{m.name}</p>
                  <p className="mt-0.5 text-[12px] text-ink-faint">{m.conceptName}</p>
                </div>
                <div className="flex-none text-right">
                  <p className="font-mono text-[14px] text-ink">
                    {m.distinctLearners} learner{m.distinctLearners === 1 ? "" : "s"}
                  </p>
                  <p className="font-mono text-[12px] text-ink-faint">{m.totalOccurrences} times total</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 mb-10">
        <h2 className="section-title">Roster</h2>
        <div className="card divide-y divide-border-soft p-0">
          {state.roster.map((r) => (
            <div key={r.learnerId} className="flex items-center justify-between gap-4 p-4">
              <p className="text-[14px] text-ink">{r.displayName ?? `Learner ${shortId(r.learnerId)}`}</p>
              <p className="font-mono text-[13px] text-ink-faint">
                {r.totalAttempts} attempts · {r.conceptsMastered}/5 concepts mastered
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
