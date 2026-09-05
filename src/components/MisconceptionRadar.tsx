interface RadarAxis {
  label: string;
  value: number;
}

interface MisconceptionRadarProps {
  axes: RadarAxis[];
}

// SIZE has real margin beyond MAX_RADIUS + the label offset below — a real,
// live-browser-caught bug (never visible in this project before actual
// screenshots existed): at the old SIZE (280), the two axes nearest
// horizontal (Negatives, Distributing on the right / Equations on the left)
// placed their label's anchor point close enough to the SVG edge that
// "Distributing"/"Equations"-length labels clipped, since SVG clips content
// outside its viewBox by default. The chart's actual plotted radius
// (MAX_RADIUS) is unchanged — only the canvas around it grew.
const SIZE = 340;
const CENTER = SIZE / 2;
const MAX_RADIUS = 96;
const RINGS = 4;

function pointOnAxis(index: number, count: number, radius: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return [CENTER + radius * Math.cos(angle), CENTER + radius * Math.sin(angle)];
}

/**
 * A 5-axis (one per concept) radar of where a learner's wrong answers cluster —
 * a shape, not a flat list, same "make the learner model visible" idea as the
 * mastery rings and calibration chart. Deliberately one axis per CONCEPT rather
 * than per misconception (15 axes would be unreadable) — see dashboard's
 * "Misconception history" section below this for the per-misconception detail.
 */
export default function MisconceptionRadar({ axes }: MisconceptionRadarProps) {
  const maxValue = Math.max(1, ...axes.map((a) => a.value));
  const count = axes.length;

  const dataPoints = axes.map((a, i) => pointOnAxis(i, count, (a.value / maxValue) * MAX_RADIUS));
  const dataPath = dataPoints.map((p) => p.join(",")).join(" ");

  const summary = axes
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value)
    .map((a) => `${a.label}: ${a.value}`)
    .join(", ");

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label={summary ? `Mistake distribution by concept: ${summary}` : "No mistakes recorded yet"}
    >
      {Array.from({ length: RINGS }, (_, ringIndex) => {
        const r = (MAX_RADIUS * (ringIndex + 1)) / RINGS;
        const ringPoints = axes.map((_, i) => pointOnAxis(i, count, r).join(",")).join(" ");
        return <polygon key={ringIndex} points={ringPoints} fill="none" stroke="var(--border-soft)" strokeWidth={1} />;
      })}

      {axes.map((_, i) => {
        const [x, y] = pointOnAxis(i, count, MAX_RADIUS);
        return <line key={i} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="var(--border-soft)" strokeWidth={1} />;
      })}

      <polygon points={dataPath} fill="var(--primary)" fillOpacity={0.18} stroke="var(--primary)" strokeWidth={2} />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="var(--primary)" />
      ))}

      {axes.map((a, i) => {
        const [x, y] = pointOnAxis(i, count, MAX_RADIUS + 22);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={11}
            fontFamily="var(--font-mono), ui-monospace, monospace"
            fill="var(--ink-faint)"
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}
