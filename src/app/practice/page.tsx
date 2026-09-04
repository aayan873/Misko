"use client";

import { useCallback, useEffect, useState } from "react";
import { useLearnerId } from "@/lib/useLearnerId";
import { useSpeechToText } from "@/lib/useSpeechToText";
import { resizeImageToBase64 } from "@/lib/resizeImage";
import ReasoningTrace from "@/components/ReasoningTrace";
import { StatusIcon } from "@/components/GradeMarks";
import MasteryDelta from "@/components/MasteryDelta";
import MasteredStamp from "@/components/MasteredStamp";

interface ClientProblem {
  id: string;
  conceptId: string;
  promptText: string;
  answerType: "number" | "expression";
}

type ReasonType = "confirmation" | "retarget" | "review" | "spaced-review" | "frontier" | "done";

const REASON_BADGES: Record<ReasonType, { label: string; className: string }> = {
  confirmation: { label: "double-check", className: "border-primary text-primary" },
  retarget: { label: "retry", className: "border-danger text-danger" },
  review: { label: "review", className: "border-neutral text-neutral" },
  "spaced-review": { label: "spaced review", className: "border-success text-success" },
  frontier: { label: "new concept", className: "border-border text-ink-faint" },
  done: { label: "", className: "" },
};

interface SubmitResult {
  outcome: "correct" | "matched_misconception" | "unrecognized";
  feedbackText: string;
  source: "gemini" | "fallback";
  misconceptionName?: string | null;
  diagnosisSource?: "rule" | "ai" | null;
  revealAnswer?: boolean;
  correctAnswer?: string;
  steps: string[];
  /** See ARCHITECTURE.md "Catching the Correct Answer Trap" — set only when this
   *  submission resolved a silent confirmation round from an earlier correct answer. */
  confirmationResolved?: "confirmed" | "caught" | null;
  caughtOriginalPrompt?: string | null;
  conceptName: string;
  pMasteryBefore: number;
  pMasteryAfter: number;
  masteredBefore: boolean;
  masteredNow: boolean;
}

type Phase =
  | "loading"
  | "confidence"
  | "answering"
  | "submitting"
  | "tracing"
  | "result"
  | "done"
  | "error";

export default function PracticePage() {
  const learnerId = useLearnerId();
  const [phase, setPhase] = useState<Phase>("loading");
  const [problem, setProblem] = useState<ClientProblem | null>(null);
  const [reason, setReason] = useState<string>("");
  const [reasonType, setReasonType] = useState<ReasonType>("frontier");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [shownWork, setShownWork] = useState("");
  const [showWorkField, setShowWorkField] = useState(false);
  const [hintLevel, setHintLevel] = useState<1 | 2 | 3>(1);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  const speech = useSpeechToText((transcript) => {
    setShownWork((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
  });

  const loadNextProblem = useCallback(async () => {
    if (!learnerId) return;
    setPhase("loading");
    setResult(null);
    setConfidence(null);
    setAnswer("");
    setShownWork("");
    setShowWorkField(false);
    setHintLevel(1);
    setTranscribeError(null);
    try {
      const res = await fetch(`/api/next-problem?learnerId=${learnerId}`);
      if (!res.ok) throw new Error("Failed to load problem");
      const data = await res.json();
      if (data.done) {
        setPhase("done");
        setReason(data.reason ?? "");
        return;
      }
      setProblem(data.problem);
      setReason(data.reason ?? "");
      setReasonType((data.reasonType as ReasonType) ?? "frontier");
      setPhase("confidence");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }, [learnerId]);

  useEffect(() => {
    if (learnerId) loadNextProblem();
  }, [learnerId, loadNextProblem]);

  async function submitAnswer() {
    if (!learnerId || !problem || confidence === null || !answer.trim()) return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learnerId,
          problemId: problem.id,
          answer,
          confidenceBefore: confidence,
          hintLevel,
          shownWork: shownWork.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to submit answer");
      const data: SubmitResult = await res.json();
      setResult(data);
      setStreak((s) => (data.outcome === "correct" ? s + 1 : 0));
      setPhase("tracing");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Something went wrong");
      setPhase("error");
    }
  }

  async function handlePhotoSelected(file: File) {
    if (!problem) return;
    setTranscribeError(null);
    setTranscribing(true);
    try {
      const { base64, mimeType } = await resizeImageToBase64(file);
      const res = await fetch("/api/transcribe-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType, problemPromptText: problem.promptText }),
      });
      if (!res.ok) throw new Error("Failed to read photo");
      const data: { transcript: string | null; message: string | null } = await res.json();
      if (data.transcript) {
        setShownWork((prev) => (prev.trim() ? `${prev.trim()} ${data.transcript}` : data.transcript!));
      } else {
        setTranscribeError(data.message ?? "Couldn't read that photo.");
      }
    } catch {
      setTranscribeError("Couldn't read that photo — try again or type your work instead.");
    } finally {
      setTranscribing(false);
    }
  }

  function tryAgainSameProblem() {
    setAnswer("");
    setShownWork("");
    setHintLevel((h) => (h < 3 ? ((h + 1) as 1 | 2 | 3) : 3));
    setResult(null);
    setPhase("answering");
  }

  if (!learnerId || phase === "loading") {
    return (
      <div className="mx-auto max-w-[700px] px-4 sm:px-8 py-24 text-center text-ink-faint">
        Loading your session…
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="mx-auto max-w-[700px] px-4 sm:px-8 py-24 text-center">
        <p className="text-danger">{errorMsg}</p>
        <button className="btn-secondary mt-6" onClick={loadNextProblem}>
          Try again
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="mx-auto max-w-[700px] px-4 sm:px-8 py-24 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">All concepts mastered</h1>
        <p className="mt-3 text-ink-soft">{reason}</p>
        <a href="/dashboard" className="btn-primary mt-8 inline-flex">
          View your learning model
        </a>
      </div>
    );
  }

  if (!problem) return null;

  return (
    <div className="mx-auto max-w-[700px] px-4 sm:px-8 py-16">
      <div className="mb-6 flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5">
          {REASON_BADGES[reasonType].label && (
            <span
              className={`flex-none border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${REASON_BADGES[reasonType].className}`}
            >
              {REASON_BADGES[reasonType].label}
            </span>
          )}
          <span className="truncate text-[13px] text-ink-faint">{reason}</span>
        </span>
        {streak > 0 && <span className="flex-none font-mono text-[13px] text-danger">{streak} in a row</span>}
      </div>

      <div className="card p-8">
        <p className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">Problem</p>
        <p className="mt-2 font-display text-[26px] leading-snug text-ink">{problem.promptText}</p>

        {phase === "confidence" && (
          <div className="mt-10">
            <p className="mb-5 text-[15px] text-ink-soft">
              Before you solve it — how confident are you that you&apos;ll get this right?
            </p>
            <div className="flex items-end gap-2.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setConfidence(n);
                    setPhase("answering");
                  }}
                  className="group flex-1"
                >
                  <div className="h-1.5 w-full bg-border-soft transition-colors group-hover:bg-primary" />
                  <span className="mt-3 block text-center font-mono text-[12px] text-ink-faint transition-colors group-hover:text-primary">
                    {n}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[11px] text-ink-faint">
              <span>not confident</span>
              <span>very confident</span>
            </div>
          </div>
        )}

        {(phase === "answering" || phase === "submitting") && confidence !== null && (
          <div className="mt-10">
            {hintLevel > 1 && (
              <p className="mb-4 font-mono text-[13px] text-danger">Hint level {hintLevel} — try again.</p>
            )}
            <input
              autoFocus
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !showWorkField && submitAnswer()}
              placeholder={problem.answerType === "expression" ? "e.g. 7x" : "e.g. 12"}
              className="w-full border border-border bg-surface px-4 py-3.5 font-mono text-lg text-ink outline-none focus:border-primary"
            />

            {!showWorkField ? (
              <button
                type="button"
                onClick={() => setShowWorkField(true)}
                className="mt-4 flex w-full items-start gap-3 border border-primary bg-primary-wash px-4 py-3.5 text-left transition-opacity hover:opacity-80"
              >
                <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center border border-primary text-[11px] text-primary">
                  +
                </span>
                <span>
                  <span className="block text-[14px] font-medium text-ink">Show your work</span>
                  <span className="block text-[13px] text-ink-faint">
                    Optional — the more specific Misko&apos;s diagnosis can be, on both wrong
                    answers and correct ones worth double-checking.
                  </span>
                </span>
              </button>
            ) : (
              <div className="mt-4">
                <p className="mb-2 text-[13px] font-medium text-ink-soft">
                  How did you solve it? <span className="text-ink-faint">(optional)</span>
                </p>
                <textarea
                  autoFocus
                  value={shownWork}
                  onChange={(e) => setShownWork(e.target.value)}
                  placeholder="e.g. I added the exponents together since both terms had x^2..."
                  rows={2}
                  maxLength={600}
                  className="w-full border border-border bg-surface px-4 py-3 text-[14px] text-ink outline-none focus:border-primary"
                />

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {speech.supported && (
                    <button
                      type="button"
                      onClick={() => (speech.listening ? speech.stop() : speech.start())}
                      className={`flex items-center gap-1.5 border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        speech.listening
                          ? "border-danger bg-danger-wash text-danger"
                          : "border-border text-ink-soft hover:border-primary hover:text-primary"
                      }`}
                    >
                      <span aria-hidden="true">{speech.listening ? "●" : "🎤"}</span>
                      {speech.listening ? "Listening…" : "Speak it instead"}
                    </button>
                  )}

                  <label className="flex cursor-pointer items-center gap-1.5 border border-border px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary">
                    <span aria-hidden="true">📷</span>
                    {transcribing ? "Reading…" : "Photo of your work"}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      disabled={transcribing}
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) handlePhotoSelected(file);
                      }}
                    />
                  </label>
                </div>
                {transcribeError && <p className="mt-1.5 text-[12px] text-danger">{transcribeError}</p>}
              </div>
            )}

            <button
              className="btn-primary mt-6"
              disabled={!answer.trim() || phase === "submitting"}
              onClick={submitAnswer}
            >
              {phase === "submitting" ? "Checking…" : "Submit"}
            </button>
          </div>
        )}

        {phase === "tracing" && result && (
          <div className="mt-8 border-t border-border-soft pt-7">
            <ReasoningTrace steps={result.steps} onComplete={() => setPhase("result")} />
          </div>
        )}

        {phase === "result" && result && (
          <div className="mt-8 animate-[fadeIn_0.35s_ease-out] border-t border-border-soft pt-7">
            {result.masteredNow && !result.masteredBefore && (
              <MasteredStamp conceptName={result.conceptName} />
            )}
            {result.outcome === "correct" ? (
              <div className="callout success flex gap-3">
                <StatusIcon kind="success" />
                <div>
                  <p className="text-[14.5px] font-semibold text-ink">Correct — {answer}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{result.feedbackText}</p>
                  {result.confirmationResolved === "confirmed" && (
                    <p className="mt-2 text-[13px] font-medium text-success">
                      This confirms your last answer wasn&apos;t a lucky guess.
                    </p>
                  )}
                </div>
              </div>
            ) : result.confirmationResolved === "caught" && result.caughtOriginalPrompt ? (
              <div className="callout danger flex gap-3">
                <StatusIcon kind="danger" />
                <div>
                  <p className="text-[14.5px] font-semibold text-ink">
                    Caught — that earlier &quot;correct&quot; answer was a guess
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
                    &quot;{result.caughtOriginalPrompt}&quot; was marked correct — but this
                    same-type problem (you answered <span className="font-mono">{answer}</span>)
                    reveals it might have been a lucky guess, not full understanding.
                  </p>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{result.feedbackText}</p>
                  {result.revealAnswer && (
                    <p className="mt-2 font-mono text-[13px] text-ink-soft">
                      Correct answer: <span className="text-ink">{result.correctAnswer}</span>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="callout danger flex gap-3">
                <StatusIcon kind="danger" />
                <div>
                  <p className="text-[14.5px] font-semibold text-ink">
                    {result.misconceptionName ? result.misconceptionName : "Not quite"} —{" "}
                    <span className="font-mono font-normal">{answer}</span>
                  </p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">{result.feedbackText}</p>
                  {result.diagnosisSource === "ai" && (
                    <p className="mt-2 text-[13px] font-medium text-primary">
                      Diagnosed from your own reasoning.
                    </p>
                  )}
                  {result.revealAnswer && (
                    <p className="mt-2 font-mono text-[13px] text-ink-soft">
                      Correct answer: <span className="text-ink">{result.correctAnswer}</span>
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 border-t border-border-soft pt-5">
              <MasteryDelta
                conceptName={result.conceptName}
                before={result.pMasteryBefore}
                after={result.pMasteryAfter}
                justMastered={result.masteredNow && !result.masteredBefore}
              />
            </div>

            <div className="mt-6 flex gap-3">
              {result.outcome !== "correct" && !result.revealAnswer && (
                <button className="btn-secondary" onClick={tryAgainSameProblem}>
                  Try again
                </button>
              )}
              <button className="btn-primary" onClick={loadNextProblem}>
                Next problem →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
