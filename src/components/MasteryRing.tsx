"use client";

interface MasteryRingProps {
  /** 0-1 */
  value: number;
  mastered: boolean;
  label?: string;
  size?: "default" | "small";
}

/** A mastery indicator ring, colored by state (mastered / in-progress / not started). */
export default function MasteryRing({ value, mastered, label, size = "default" }: MasteryRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const started = clamped > 0 || mastered;
  const dims = size === "small" ? "h-[52px] w-[52px] text-[11px]" : "h-[74px] w-[74px] text-[13px]";

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        className={`stamp-ring ${dims} ${mastered ? "done" : started ? "progress" : ""}`}
      >
        {mastered ? "✓" : started ? `${Math.round(clamped * 100)}%` : "—"}
      </div>
      {label && (
        <span className="max-w-[84px] text-center text-[11px] leading-tight text-ink-soft">
          {label}
        </span>
      )}
    </div>
  );
}
