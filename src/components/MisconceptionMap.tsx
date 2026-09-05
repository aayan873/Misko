"use client";

import misconceptionMap from "@/lib/domain/misconceptionMap.json";

interface MisconceptionMapProps {
  history: { misconceptionId: string; occurrences: number; resolved: boolean }[];
}

const CONCEPT_COLORS: Record<string, string> = {
  "order-of-operations": "#f59e0b",
  "negative-numbers": "#ef4444",
  distributing: "#8b5cf6",
  "combining-like-terms": "#3b82f6",
  "linear-equations": "#10b981",
  "dimensional-analysis": "#06b6d4",
  "mole-ratios": "#ec4899",
};

const SIZE = 340;
const PAD = 34;

function toPixels(x: number, y: number) {
  // Stored coordinates are in [-1, 1] with +y up (natural math convention);
  // SVG y grows downward, so flip it here rather than in the precompute
  // script, keeping the stored data itself convention-agnostic.
  return {
    px: PAD + ((x + 1) / 2) * (SIZE - 2 * PAD),
    py: PAD + ((1 - y) / 2) * (SIZE - 2 * PAD),
  };
}

/**
 * prompt_v2.md A3: a second, genuinely different ML technique from the LLM
 * prompting (diagnosis/hints) and the Bayesian Knowledge Tracing (mastery)
 * used everywhere else in this app — text embeddings + a hand-rolled 2D
 * similarity layout (see scripts/generateMisconceptionEmbeddings.ts), so a
 * learner can see that "distributing a negative sign wrong" really does sit
 * near "subtracting a negative wrong," not because anyone hand-tagged that
 * relationship, but because a language model's embedding space places their
 * descriptions close together — then cosine similarity and a stress-style
 * layout turn that into actual (x, y) positions.
 *
 * The map itself is fixed (computed once, offline, from all 21 misconceptions
 * — see that script) since prompt_v2.md is explicit this shouldn't need a
 * live API call; what's personalized per learner is only which dots light up
 * and how big they are, driven by this learner's own misconceptionHistory.
 */
export default function MisconceptionMap({ history }: MisconceptionMapProps) {
  const seen = new Map(history.map((h) => [h.misconceptionId, h]));
  const maxOccurrences = Math.max(1, ...history.map((h) => h.occurrences));

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label="Misconception similarity map">
      {misconceptionMap.map((point) => {
        const hit = seen.get(point.id);
        const { px, py } = toPixels(point.x, point.y);
        const color = CONCEPT_COLORS[point.conceptId] ?? "#9ca3af";
        const radius = hit ? 5 + (hit.occurrences / maxOccurrences) * 9 : 3;
        return (
          <g key={point.id}>
            <circle
              cx={px}
              cy={py}
              r={radius}
              fill={hit ? color : "none"}
              stroke={color}
              strokeWidth={hit ? 0 : 1.5}
              opacity={hit ? (hit.resolved ? 0.55 : 0.95) : 0.35}
            />
            {hit && (
              <circle
                cx={px}
                cy={py}
                r={radius + 3}
                fill="none"
                stroke={color}
                strokeWidth={hit.resolved ? 0 : 1.5}
                opacity={hit.resolved ? 0 : 0.4}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
