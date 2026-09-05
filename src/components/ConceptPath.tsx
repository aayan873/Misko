"use client";

interface ConfirmationStats {
  confirmed: number;
  caught: number;
  checked: number;
}

export interface ConceptPathEntry {
  conceptId: string;
  name: string;
  attempts: number;
  correct: number;
  streak: number;
  mastered: boolean;
  accuracy: number | null;
  /** Bayesian Knowledge Tracing estimate of P(learner knows this concept), 0-1. */
  pMastery: number;
  locked: boolean;
  confirmation: ConfirmationStats;
}

interface ConceptPathProps {
  concepts: ConceptPathEntry[];
  frontierConceptId: string | null;
}

/**
 * Renders the mastery gate's real prerequisite chain as a connected sequence —
 * previously invisible: the dashboard showed 5 unconnected stamps (no sense that
 * order-of-operations unlocks negative-numbers unlocks distributing, etc.) plus a
 * second list repeating the same 5 names. One visualization, sequence-aware,
 * inspired by how Duolingo's path encodes sequence via position and status via
 * fill/border on the same node — adapted into the worksheet visual language
 * (a ruled connecting line, grading-stamp nodes) rather than copied wholesale.
 */
export default function ConceptPath({ concepts, frontierConceptId }: ConceptPathProps) {
  return (
    <div className="relative">
      {/* connecting border — horizontal from sm up, vertical below sm */}
      <div className="absolute left-[31px] top-0 bottom-0 w-px bg-border sm:left-0 sm:right-0 sm:top-[31px] sm:bottom-auto sm:h-px sm:w-auto" />

      <div className="relative flex flex-col gap-9 sm:flex-row sm:justify-between sm:gap-3">
        {concepts.map((c) => {
          const isFrontier = c.conceptId === frontierConceptId;
          const started = (c.accuracy ?? 0) > 0 || c.mastered;

          let stampClass = "border-dashed border-border text-ink-faint bg-bg";
          let content = "–";
          if (c.mastered) {
            stampClass = "border-success text-success bg-surface";
            content = "✓";
          } else if (!c.locked && started) {
            stampClass = "border-primary text-primary bg-surface";
            content = `${Math.round(c.pMastery * 100)}%`;
          } else if (!c.locked) {
            stampClass = "border-border text-ink-faint bg-surface";
            content = "—";
          }

          return (
            <div key={c.conceptId} className="relative z-10 flex items-center gap-4 sm:flex-col sm:items-center sm:gap-3">
              <div className="relative flex-none">
                <div
                  className={`flex h-16 w-16 items-center justify-center border-2 font-mono text-[14px] transition-colors ${stampClass} ${
                    c.mastered ? "rotate-[-4deg]" : ""
                  }`}
                >
                  {content}
                </div>
                {isFrontier && !c.mastered && (
                  <span className="absolute -right-1 -top-1 h-3 w-3 animate-pulse rounded-full bg-primary" />
                )}
                {(c.confirmation.confirmed > 0 || c.confirmation.caught > 0) && (
                  <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-1">
                    {c.confirmation.confirmed > 0 && (
                      <span className="h-2 w-2 rounded-full border border-bg bg-success" title="confirmed correct answers" />
                    )}
                    {c.confirmation.caught > 0 && (
                      <span className="h-2 w-2 rounded-full border border-bg bg-danger" title="caught lucky guesses" />
                    )}
                  </div>
                )}
              </div>

              <div className="sm:text-center">
                <p
                  className={`text-[12.5px] leading-tight ${
                    isFrontier ? "font-medium text-primary" : c.locked ? "text-ink-faint" : "text-ink-soft"
                  } sm:max-w-[90px]`}
                >
                  {c.name}
                </p>
                <p className="mt-1 font-mono text-[10.5px] text-ink-faint">
                  {c.locked
                    ? "locked"
                    : c.attempts > 0
                    ? `${c.correct}/${c.attempts}`
                    : c.mastered
                    ? "mastered"
                    : "not started"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
