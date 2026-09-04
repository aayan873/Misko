"use client";

import { useCallback, useEffect, useState } from "react";
import { useLearnerId } from "@/lib/useLearnerId";
import ConceptPath, { ConceptPathEntry } from "@/components/ConceptPath";
import MisconceptionRadar from "@/components/MisconceptionRadar";
import ExportImport from "@/components/ExportImport";

const SHORT_CONCEPT_LABEL: Record<string, string> = {
  "order-of-operations": "Order of Ops",
  "negative-numbers": "Negatives",
  distributing: "Distributing",
  "combining-like-terms": "Like Terms",
  "linear-equations": "Equations",
};

type MasteryEntry = ConceptPathEntry;

interface MisconceptionEntry {
  misconceptionId: string;
  name: string;
  conceptId: string;
  occurrences: number;
  resolved: boolean;
  lastSeen: number;
  diagnosisSource: "rule" | "ai" | "similarity" | null;
}

interface CalibrationPoint {
  confidence_before: number;
  accuracy: number;
  count: number;
}

interface ConfirmationStats {
  confirmed: number;
  caught: number;
  checked: number;
}

interface CalibrationInsight {
  type: "overconfident" | "underconfident";
  accuracy: number;
  count: number;
}

interface SpotMistakeStats {
  attempted: number;
  caught: number;
}

interface LearnerState {
  mastery: MasteryEntry[];
  misconceptionHistory: MisconceptionEntry[];
  calibration: CalibrationPoint[];
  calibrationInsight: CalibrationInsight | null;
  frontierConcept: string | null;
  confirmationStats: ConfirmationStats;
  spotMistakeStats: SpotMistakeStats;
}

export default function DashboardPage() {
  const learnerId = useLearnerId();
  const [state, setState] = useState<LearnerState | null>(null);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(() => {
    if (!learnerId) return;
    setLoading(true);
    fetch(`/api/learner-state?learnerId=${learnerId}`)
      .then((r) => r.json())
      .then(setState)
      .finally(() => setLoading(false));
  }, [learnerId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  if (!learnerId || loading) {
    return <div className="mx-auto max-w-[940px] px-5 sm:px-8 py-24 text-center text-ink-faint">Loading…</div>;
  }

  if (!state || state.mastery.every((m) => m.attempts === 0)) {
    return (
      <div className="mx-auto max-w-[940px] px-5 sm:px-8 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">No data yet</h1>
        <p className="mt-3 text-ink-soft">
          Your learning model builds up as you practice — nothing to show yet. Switched
          browsers or lost your data? Restore a backup below instead of starting over.
        </p>
        <a href="/practice" className="btn-primary mt-8 inline-flex">
          Start practicing →
        </a>
        <div className="mt-6 flex justify-center">
          <ExportImport learnerId={learnerId} onImported={loadState} />
        </div>
      </div>
    );
  }

  const radarAxes = state.mastery.map((m) => ({
    label: SHORT_CONCEPT_LABEL[m.conceptId] ?? m.conceptId,
    value: state.misconceptionHistory
      .filter((h) => h.conceptId === m.conceptId)
      .reduce((sum, h) => sum + h.occurrences, 0),
  }));
  const hasAnyMisconceptions = radarAxes.some((a) => a.value > 0);

  return (
    <div className="mx-auto max-w-[940px] px-5 sm:px-8 pb-36 pt-16">
      <h1 className="max-w-[22ch] font-display text-[36px] font-semibold text-ink">
        What Misko actually knows about you
      </h1>
      <p className="mt-3 max-w-[56ch] text-[16px] leading-relaxed text-ink-soft">
        Not a black box — this is the exact state that decides every hint you get. Five
        concepts, graded like returned work.
      </p>

      <div className="mt-6">
        <ExportImport learnerId={learnerId} onImported={loadState} />
      </div>

      <section className="card mt-10 p-7">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Confirmed mastery</p>
        {state.confirmationStats.checked === 0 ? (
          <p className="mt-3 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
            When you write out your reasoning on a correct answer, Misko occasionally
            double-checks it with a follow-up problem — to catch answers that were right by
            luck, not understanding. Nothing checked yet.
          </p>
        ) : (
          <>
            <p className="mt-2 font-display text-[36px] text-ink">
              {state.confirmationStats.confirmed}{" "}
              <span className="text-ink-faint">/ {state.confirmationStats.checked}</span>{" "}
              <span className="text-[19px] text-ink-soft">confirmed solid</span>
            </p>
            <p className="mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
              These are correct answers Misko independently re-checked with a follow-up
              problem — not just trusted at face value.
              {state.confirmationStats.caught > 0 && (
                <>
                  {" "}
                  <span className="text-danger">
                    {state.confirmationStats.caught} looked right the first time but didn&apos;t
                    hold up
                  </span>{" "}
                  — the illusion-of-fluency case: a lucky guess that felt like understanding.
                </>
              )}
            </p>
          </>
        )}
      </section>

      {state.spotMistakeStats.attempted > 0 && (
        <section className="card mt-10 p-7">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Spot the Mistake</p>
          <p className="mt-2 font-display text-[36px] text-ink">
            {state.spotMistakeStats.caught}{" "}
            <span className="text-ink-faint">/ {state.spotMistakeStats.attempted}</span>{" "}
            <span className="text-[19px] text-ink-soft">mistakes caught</span>
          </p>
          <p className="mt-2.5 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
            From the reverse exercise — spotting the flawed step in a worked solution that
            got it wrong on purpose, rather than solving it yourself.
          </p>
        </section>
      )}

      <section className="mt-10">
        <h2 className="section-title">Concept mastery</h2>
        <p className="mt-2.5 mb-8 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
          The real prerequisite chain the mastery gate uses — you can&apos;t reach a later
          concept until the ones before it are mastered. The percentage on each concept
          is a live estimate of how likely you are to actually know it (Bayesian
          Knowledge Tracing), not just your raw hit rate — one wrong answer lowers it,
          it doesn&apos;t reset it to zero.
        </p>
        <div className="card p-7">
          <ConceptPath concepts={state.mastery} frontierConceptId={state.frontierConcept} />
          {state.mastery.some((m) => m.confirmation.confirmed > 0 || m.confirmation.caught > 0) && (
            <div className="mt-10 flex flex-wrap gap-x-5 gap-y-1.5 text-[12px] text-ink-faint">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-success" /> has confirmed answers
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-danger" /> has a caught lucky guess
              </span>
            </div>
          )}
        </div>
      </section>

      {hasAnyMisconceptions && (
        <section className="mt-10">
          <h2 className="section-title">Where your mistakes cluster</h2>
          <p className="mt-2.5 mb-6 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
            A shape, not a list — how your wrong answers spread across the 5 concepts, weighted
            by how often each misconception has come up.
          </p>
          <div className="card flex justify-center p-7">
            <MisconceptionRadar axes={radarAxes} />
          </div>
        </section>
      )}

      <section className="mt-10">
        <h2 className="section-title">Misconception history</h2>
        {state.misconceptionHistory.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-faint">None detected yet — keep practicing.</p>
        ) : (
          <div className="card mt-4 divide-y divide-border-soft">
            {state.misconceptionHistory.map((h) => (
              <div key={h.misconceptionId} className="flex items-center justify-between gap-4 px-6 py-[18px]">
                <div>
                  <p className="font-medium text-ink">{h.name}</p>
                  <p className="mt-1 text-[13px] text-ink-faint">
                    seen {h.occurrences}× · {h.conceptId}
                    {h.diagnosisSource === "ai" && (
                      <span className="text-primary"> · diagnosed from your reasoning</span>
                    )}
                    {h.diagnosisSource === "similarity" && (
                      <span className="text-primary"> · matched from your wording (no AI key)</span>
                    )}
                  </p>
                </div>
                <span
                  className={`badge flex-none ${
                    h.resolved ? "bg-success-wash text-success" : "bg-danger-wash text-danger"
                  }`}
                >
                  {h.resolved ? "Resolved" : "Active"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 mb-10">
        <h2 className="section-title">Confidence calibration</h2>
        <p className="mt-2.5 mb-6 max-w-[56ch] text-[15px] leading-relaxed text-ink-soft">
          Predicted confidence (1–5) vs. actual accuracy. A well-calibrated learner sees this
          trend upward and to the right.
        </p>
        {state.calibrationInsight && (
          <div className={`callout ${state.calibrationInsight.type === "overconfident" ? "danger" : "success"} mb-5`}>
            <p className="text-[14px] leading-relaxed text-ink-soft">
              {state.calibrationInsight.type === "overconfident" ? (
                <>
                  You&apos;ve rated yourself confident on the last {state.calibrationInsight.count} of
                  these, but only got{" "}
                  <span className="font-semibold text-ink">
                    {Math.round(state.calibrationInsight.accuracy * 100)}%
                  </span>{" "}
                  right. Worth double-checking your steps before submitting, even when it feels
                  obvious.
                </>
              ) : (
                <>
                  You&apos;ve rated yourself unsure on the last {state.calibrationInsight.count} of
                  these, but got{" "}
                  <span className="font-semibold text-ink">
                    {Math.round(state.calibrationInsight.accuracy * 100)}%
                  </span>{" "}
                  right anyway. You know this better than you think.
                </>
              )}
            </p>
          </div>
        )}
        {state.calibration.length === 0 ? (
          <p className="text-[14px] text-ink-faint">Not enough data yet.</p>
        ) : (
          <div className="card flex items-end gap-5 p-7" style={{ height: 200 }}>
            {[1, 2, 3, 4, 5].map((level) => {
              const point = state.calibration.find((c) => c.confidence_before === level);
              const heightPct = point ? Math.round(point.accuracy * 100) : 0;
              return (
                <div key={level} className="flex flex-1 flex-col items-center justify-end gap-2.5">
                  <span className="font-mono text-[12px] text-ink-faint">
                    {point ? `${heightPct}%` : "—"}
                  </span>
                  <div
                    className="w-full rounded-t-md bg-primary transition-[height] duration-700 ease-out"
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                  />
                  <span className="font-mono text-[12px] text-ink-faint">{level}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
