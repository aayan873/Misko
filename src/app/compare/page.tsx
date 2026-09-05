"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import ReasoningTrace from "@/components/ReasoningTrace";
import MasteryRing from "@/components/MasteryRing";
import { StatusIcon } from "@/components/GradeMarks";

interface LearnerInfo {
  id: string;
  name: string;
  persona: string;
}

interface ClientProblem {
  id: string;
  conceptId: string;
  promptText: string;
  answerType: "number" | "expression";
}

interface LearnerState {
  mastery: { conceptId: string; name: string; accuracy: number | null; mastered: boolean }[];
  misconceptionHistory: { name: string; resolved: boolean }[];
}

interface DiagnosisResult {
  feedbackText: string;
  misconceptionName: string | null;
  source: "gemini" | "fallback";
  steps: string[];
}

type Phase = "seeding" | "ready" | "diagnosing" | "done" | "error";

export default function ComparePage() {
  const [phase, setPhase] = useState<Phase>("seeding");
  const [learnerA, setLearnerA] = useState<LearnerInfo | null>(null);
  const [learnerB, setLearnerB] = useState<LearnerInfo | null>(null);
  const [stateA, setStateA] = useState<LearnerState | null>(null);
  const [stateB, setStateB] = useState<LearnerState | null>(null);
  const [problem, setProblem] = useState<ClientProblem | null>(null);
  const [wrongAnswer, setWrongAnswer] = useState<string>("");
  const [resultA, setResultA] = useState<DiagnosisResult | null>(null);
  const [resultB, setResultB] = useState<DiagnosisResult | null>(null);
  const [revealA, setRevealA] = useState(false);
  const [revealB, setRevealB] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setup = useCallback(async () => {
    setPhase("seeding");
    setResultA(null);
    setResultB(null);
    setRevealA(false);
    setRevealB(false);
    try {
      const seedRes = await fetch("/api/demo/seed", { method: "POST" });
      if (!seedRes.ok) throw new Error("Failed to seed demo learners");
      const seed = await seedRes.json();
      setLearnerA(seed.learnerA);
      setLearnerB(seed.learnerB);

      const [probRes, aState, bState] = await Promise.all([
        fetch("/api/demo/problem"),
        fetch(`/api/learner-state?learnerId=${seed.learnerA.id}`),
        fetch(`/api/learner-state?learnerId=${seed.learnerB.id}`),
      ]);
      if (!probRes.ok) throw new Error("Failed to load demo problem");
      const prob = await probRes.json();
      setProblem(prob.problem);
      setWrongAnswer(prob.demoWrongAnswer);
      setStateA(await aState.json());
      setStateB(await bState.json());
      setPhase("ready");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    setup();
  }, [setup]);

  async function revealDifference() {
    if (!problem || !learnerA || !learnerB) return;
    setPhase("diagnosing");
    try {
      const submit = (learnerId: string) =>
        fetch("/api/submit-answer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            learnerId,
            problemId: problem.id,
            answer: wrongAnswer,
            confidenceBefore: 3,
            hintLevel: 1,
          }),
        }).then((r) => r.json());

      const [a, b] = await Promise.all([submit(learnerA.id), submit(learnerB.id)]);
      setResultA(a);
      setResultB(b);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }

  useEffect(() => {
    if (resultA && resultB) setPhase("done");
  }, [resultA, resultB]);

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-[640px] px-5 sm:px-8 py-24 text-center">
        <p className="text-danger">{errorMsg}</p>
        <button className="btn-secondary mt-6" onClick={setup}>
          Retry
        </button>
      </div>
    );
  }

  if (phase === "seeding" || !problem || !learnerA || !learnerB) {
    return (
      <div className="mx-auto max-w-[640px] px-5 sm:px-8 py-24 text-center text-ink-faint">
        Setting up two learner profiles…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[940px] px-5 sm:px-8 pb-36 pt-16">
      <h1 className="max-w-[26ch] text-balance font-display text-[34px] font-semibold text-ink sm:text-[38px]">
        Same problem. Same wrong answer. Two different students.
      </h1>
      <p className="mt-5 max-w-[60ch] text-[16px] leading-relaxed text-ink-soft">
        Both learners below are about to submit the exact same mistake on the exact same
        problem — live, against the real backend, not scripted. What Misko says next depends
        entirely on what it already knows about each of them.
      </p>

      <div className="card mt-10 px-8 py-9 text-center">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Shared problem</p>
        <p className="mt-3 font-display text-[26px] text-ink">{problem.promptText}</p>
        <p className="mt-3 font-mono text-[13px] text-ink-faint">
          both submit <span className="text-danger">{wrongAnswer}</span>
        </p>
        {phase === "ready" && (
          <button className="btn-primary mt-6" onClick={revealDifference}>
            Reveal the difference →
          </button>
        )}
        {phase === "diagnosing" && (
          <p className="mt-6 text-[13px] text-ink-faint">Submitting for both learners…</p>
        )}
        {phase === "done" && (
          <button className="btn-secondary mt-6" onClick={setup}>
            ↺ Reset &amp; replay
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <LearnerPanel
          which="a"
          info={learnerA}
          state={stateA}
          result={resultA}
          // prompt_v2.md A6: both panels only flip from "thinking" to "revealed"
          // together, on whichever trace finishes last — a synced beat instead
          // of each panel instantly swapping the moment its own (possibly
          // shorter) reasoning trace finishes.
          revealed={revealA && revealB}
          submittedAnswer={wrongAnswer}
          onTraceComplete={() => setRevealA(true)}
        />
        <LearnerPanel
          which="b"
          info={learnerB}
          state={stateB}
          result={resultB}
          revealed={revealA && revealB}
          submittedAnswer={wrongAnswer}
          onTraceComplete={() => setRevealB(true)}
        />
      </div>
    </div>
  );
}

function LearnerPanel({
  which,
  info,
  state,
  result,
  revealed,
  submittedAnswer,
  onTraceComplete,
}: {
  which: "a" | "b";
  info: LearnerInfo;
  state: LearnerState | null;
  result: DiagnosisResult | null;
  revealed: boolean;
  submittedAnswer: string;
  onTraceComplete: () => void;
}) {
  const identityBg = which === "a" ? "bg-primary" : "bg-neutral";
  const chipClass = which === "a" ? "bg-primary-wash text-primary" : "bg-neutral-wash text-neutral";

  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <div className={`stamp-mini text-white ${identityBg}`}>{info.name[0]}</div>
        <div>
          <p className="font-medium text-ink">{info.name}</p>
          <p className="text-xs text-ink-faint">{info.persona}</p>
        </div>
      </div>

      {state && (
        <div className="mt-6 flex flex-wrap gap-4">
          {state.mastery
            .filter((m) => m.accuracy !== null)
            .map((m) => (
              <MasteryRing
                key={m.conceptId}
                value={m.accuracy ?? 0}
                mastered={m.mastered}
                size="small"
                label={m.name.split(" ")[0]}
              />
            ))}
        </div>
      )}

      {state && state.misconceptionHistory.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {state.misconceptionHistory.map((h) => (
            <span key={h.name} className={`badge ${chipClass}`}>
              {h.name}
            </span>
          ))}
        </div>
      )}

      {result && (
        <div className="mt-6 border-t border-border-soft pt-6">
          {!revealed ? (
            <ReasoningTrace steps={result.steps} onComplete={onTraceComplete} />
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="callout danger flex gap-3"
            >
              <StatusIcon kind="danger" />
              <div>
                <p className="text-[13.5px] font-semibold text-ink">
                  {result.misconceptionName ? result.misconceptionName : "Not quite"} —{" "}
                  <span className="font-mono font-normal">{submittedAnswer}</span>
                </p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{result.feedbackText}</p>
                <p className="mt-2 text-[11.5px] text-ink-faint">
                  {result.source === "fallback" ? "fallback template" : "live Gemini response"}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
