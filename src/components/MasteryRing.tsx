"use client";

import { motion } from "framer-motion";

interface MasteryRingProps {
  /** 0-1 */
  value: number;
  mastered: boolean;
  label?: string;
  size?: "default" | "small";
}

const COLORS = {
  done: "var(--success)",
  progress: "var(--primary)",
  idle: "var(--border)",
};

/**
 * A mastery indicator ring (prompt_v2.md B3) — an actual SVG progress arc now,
 * not just a bordered circle with a number next to it, and animated between
 * values with framer-motion instead of snapping straight to the new
 * percentage. The "instant, opaque result" problem B3 calls out elsewhere in
 * the app (see ReasoningTrace) applies just as much to a number that jumps
 * with no transition — the animation IS the information that mastery moved.
 */
export default function MasteryRing({ value, mastered, label, size = "default" }: MasteryRingProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const started = clamped > 0 || mastered;
  const dim = size === "small" ? 52 : 74;
  const stroke = size === "small" ? 5 : 6;
  const radius = dim / 2 - stroke;
  const circumference = 2 * Math.PI * radius;
  const fraction = mastered ? 1 : clamped;
  const color = mastered ? COLORS.done : started ? COLORS.progress : COLORS.idle;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle cx={dim / 2} cy={dim / 2} r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          <motion.circle
            cx={dim / 2}
            cy={dim / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={false}
            animate={{ strokeDashoffset: circumference * (1 - fraction) }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          />
        </svg>
        <div
          className="absolute inset-0 flex items-center justify-center font-mono"
          style={{ fontSize: size === "small" ? 11 : 13, color }}
        >
          {mastered ? "✓" : started ? `${Math.round(clamped * 100)}%` : "—"}
        </div>
      </div>
      {label && (
        <span className="max-w-[84px] text-center text-[11px] leading-tight text-ink-soft">{label}</span>
      )}
    </div>
  );
}
