"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ReasoningTraceProps {
  /** Each string is a step that ACTUALLY happened server-side, in order — this reveals
   *  the real pipeline (see ARCHITECTURE.md), it's not decorative fake "thinking" text. */
  steps: string[];
  stepDelayMs?: number;
  onComplete?: () => void;
}

/**
 * Reveals the deterministic-then-AI diagnosis pipeline step by step, so the AI's
 * decision process is visible rather than an instant opaque result (per hackathon
 * UI research: judges scoring "Creative AI/ML Use" want to see the reasoning trail).
 */
export default function ReasoningTrace({ steps, stepDelayMs = 480, onComplete }: ReasoningTraceProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setVisibleCount(0);
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    steps.forEach((_, i) => {
      timeouts.push(
        setTimeout(() => setVisibleCount(i + 1), stepDelayMs * i + stepDelayMs)
      );
    });
    timeouts.push(
      setTimeout(() => onCompleteRef.current?.(), stepDelayMs * steps.length + stepDelayMs * 0.6)
    );
    return () => timeouts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps.join("|"), stepDelayMs]);

  return (
    <ul className="flex list-none flex-col gap-2.5 p-0">
      <AnimatePresence initial={false}>
        {steps.map((step, i) => {
          const isVisible = i < visibleCount;
          const isActive = i === visibleCount;
          if (!isVisible && !isActive) return null;
          return (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: isVisible ? 1 : 0.7, x: 0 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex gap-2.5 text-[13.5px]"
            >
              <span className={`trace-mk ${isVisible ? "" : "pending"}`}>{isVisible ? "✓" : ""}</span>
              <span className={isVisible ? "font-medium text-ink" : "text-ink-soft"}>{step}</span>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
