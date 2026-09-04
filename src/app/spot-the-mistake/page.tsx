"use client";

import { useCallback, useEffect, useState } from "react";
import { useLearnerId } from "@/lib/useLearnerId";
import { StatusIcon } from "@/components/GradeMarks";

interface Stats {
  attempted: number;
  caught: number;
}

interface Round {
  roundId: string;
  conceptId: string;
  problemText: string;
  steps: string[];
  stats: Stats;
}

interface SubmitResult {
  correct: boolean;
  correctStepIndex: number;
  misconceptionName: string | null;
  explanation: string | null;
  stats: Stats;
}

type Phase = "loading" | "choosing" | "submitting" | "result" | "error";

export default function SpotTheMistakePage() {
  const learnerId = useLearnerId();
  const [phase, setPhase] = useState<Phase>("loading");
  const [round, setRound] = useState<Round | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [stats, setStats] = useState<Stats>({ attempted: 0, caught: 0 });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRound = useCallback(async () => {
    if (!learnerId) return;
    setPhase("loading");
    setResult(null);
    setSelected(null);
    try {
      const res = await fetch(`/api/spot-mistake?learnerId=${learnerId}`);
      if (!res.ok) throw new Error("Failed to load a round");
      const data = await res.json();
      setRound(data);
      setStats(data.stats);
      setPhase("choosing");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, [learnerId]);

  useEffect(() => {
    if (learnerId) loadRound();
  }, [learnerId, loadRound]);

  async function submitGuess(stepIndex: number) {
    if (!round || !learnerId) return;
    setSelected(stepIndex);
    setPhase("submitting");
    try {
      const res = await fetch("/api/spot-mistake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId, roundId: round.roundId, selectedStepIndex: stepIndex }),
      });
      if (!res.ok) throw new Error("Failed to submit");
      const data: SubmitResult = await res.json();
      setResult(data);
      setStats(data.stats);
      setPhase("result");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }

  if (!learnerId || phase === "loading") {
    return (
      <div className="mx-auto max-w-[700px] px-4 sm:px-8 py-24 text-center text-ink-faint">
        Loading a round…
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-[700px] px-4 sm:px-8 py-24 text-center" role="alert">
        <p className="text-danger">{errorMsg}</p>
        <button className="btn-secondary mt-6" onClick={loadRound}>
          Try again
        </button>
      </div>
    );
  }

  if (!round) return null;

  return (
    <div className="mx-auto max-w-[700px] px-4 sm:px-8 py-16">
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-faint">
          Misko solved this one wrong. Find the step where it went off track.
        </p>
        {stats.attempted > 0 && (
          <span className="flex-none font-mono text-[13px] text-ink-faint">
            {stats.caught}/{stats.attempted} caught
          </span>
        )}
      </div>

      <div className="card p-8">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Problem</p>
        <p className="mt-2 font-display text-[26px] leading-snug text-ink">{round.problemText}</p>

        <div className="mt-8 space-y-2.5">
          {round.steps.map((step, i) => {
            const isSelected = selected === i;
            const isFlawed = phase === "result" && result && i === result.correctStepIndex;
            const showAsWrongPick = phase === "result" && isSelected && !result?.correct;

            let rowClass = "border-border hover:border-primary hover:bg-primary-wash";
            if (phase === "result") {
              if (isFlawed) rowClass = "border-danger bg-danger-wash";
              else if (showAsWrongPick) rowClass = "border-border-soft opacity-60";
              else rowClass = "border-border-soft";
            }

            return (
              <button
                key={i}
                disabled={phase === "result" || phase === "submitting"}
                onClick={() => submitGuess(i)}
                className={`flex w-full items-start gap-3 border px-4 py-3 text-left font-mono text-[14px] transition-colors ${rowClass}`}
              >
                <span className="mt-0.5 flex-none text-[12px] text-ink-faint">{i + 1}.</span>
                <span className="text-ink">{step}</span>
                {isFlawed && <StatusIcon kind="danger" />}
              </button>
            );
          })}
        </div>

        {phase === "result" && result && (
          <div
            className="mt-6 animate-[fadeIn_0.35s_ease-out] border-t border-border-soft pt-6"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className={`callout ${result.correct ? "success" : "danger"} flex gap-3`}>
              <StatusIcon kind={result.correct ? "success" : "danger"} />
              <div>
                <p className="text-[14.5px] font-semibold text-ink">
                  {result.correct ? "Caught it" : "Not quite"} — {result.misconceptionName}
                </p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{result.explanation}</p>
              </div>
            </div>
            <button className="btn-primary mt-6" onClick={loadRound}>
              Next round →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
