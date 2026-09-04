"use client";

import { useEffect, useRef, useState } from "react";

interface MasteryDeltaProps {
  conceptName: string;
  /** BKT P(knows), 0-1, before and after this one answer. */
  before: number;
  after: number;
  justMastered: boolean;
}

const SIZE = 56;
const STROKE = 4;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const DURATION_MS = 700;

/**
 * Animates the BKT mastery-probability ring from its value before this answer to
 * its value after, right where the answer happens — the dashboard shows the same
 * number, but only here do you actually watch it move.
 */
export default function MasteryDelta({ conceptName, before, after, justMastered }: MasteryDeltaProps) {
  const [progress, setProgress] = useState(before);
  const [displayPct, setDisplayPct] = useState(Math.round(before * 100));
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    // Defer to the next frame so the browser paints the "before" state first —
    // update synchronously and the ring would just snap straight to "after".
    const kickoff = requestAnimationFrame(() => setProgress(after));

    let frame: number;
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const t = Math.min(1, (ts - startRef.current) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayPct(Math.round((before + (after - before) * eased) * 100));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(kickoff);
      cancelAnimationFrame(frame);
    };
    // Runs once for this answer's before→after pair, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clamped = Math.max(0, Math.min(1, progress));
  const offset = CIRCUMFERENCE * (1 - clamped);
  const rising = after >= before;
  const ringColor = justMastered ? "var(--success)" : rising ? "var(--primary)" : "var(--danger)";

  return (
    <div className="flex items-center gap-3.5">
      <div className="relative flex-none" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--border-soft)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: `stroke-dashoffset ${DURATION_MS}ms ease-out, stroke 300ms ease-out` }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[12px] text-ink">
          {displayPct}%
        </span>
      </div>
      <div>
        <p className="text-[13px] font-medium text-ink">{conceptName}</p>
        <p className="mt-0.5 font-mono text-[12px] text-ink-faint">
          {Math.round(before * 100)}% → {Math.round(after * 100)}%
          {justMastered && <span className="ml-1.5 text-success">mastered</span>}
        </p>
      </div>
    </div>
  );
}
