import { ConceptId } from "@/lib/domain/concepts";
import { AnswerType } from "@/lib/domain/problemEngine";

/** Structural subset of ProblemInstance — enough to draw the diagram, matching
 *  exactly what the API is willing to reveal post-answer (see submit-answer/route.ts
 *  visualProofPayload); intentionally not the full ProblemInstance type, which also
 *  carries an `id` this component has no use for. */
export interface VisualProofData {
  conceptId: ConceptId;
  targetMisconceptionId: string;
  promptText: string;
  answerType: AnswerType;
  correctAnswer: string;
  distractorAnswer: string;
  meta: Record<string, number>;
}

interface VisualProofProps {
  problem: VisualProofData;
}

/**
 * prompt_v2.md A4: a deterministic, per-misconception diagram generated
 * directly from the problem's own verified generation params (`problem.meta`
 * — real numbers used to build this exact instance, see problemEngine.ts),
 * never from a model. Deliberately non-AI, unlike A1–A3: dual-coding /
 * concrete-representational-abstract research says pairing the correct
 * *symbolic* steps (already shown as text elsewhere) with a *visual* one
 * reinforces the same idea two ways, and it's honest to label this as the
 * "no AI involved, just verified math" piece of the app, in contrast with
 * the diagnosis/embeddings pieces that are explicitly AI/ML.
 *
 * Every misconception has a real generator with real meta fields (see
 * problemEngine.ts) — this switches on conceptId/targetMisconceptionId to
 * pick which of four diagram families applies, then draws the CORRECT
 * derivation only (never the distractor's), computed straight from meta so
 * it can never drift out of sync with correctAnswer.
 */
export default function VisualProof({ problem }: VisualProofProps) {
  switch (problem.conceptId) {
    case "negative-numbers":
      return <NegativeNumberLine problem={problem} />;
    case "linear-equations":
      return <BalanceScale problem={problem} />;
    case "order-of-operations":
    case "distributing":
    case "combining-like-terms":
      return <ExpressionSteps problem={problem} />;
    case "dimensional-analysis":
    case "mole-ratios":
      return <UnitChain problem={problem} />;
    default:
      return null;
  }
}

const W = 420;

function Frame({ height, children }: { height: number; children: React.ReactNode }) {
  return (
    <svg width={W} height={height} viewBox={`0 0 ${W} ${height}`} className="mx-auto max-w-full" role="img">
      <rect x={0} y={0} width={W} height={height} fill="none" />
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// negative-numbers: a number line hop for the two additive misconceptions,
// a sign-cancellation card for the multiplicative one (a hop diagram doesn't
// mean anything for "(-a) × (-b)" — there's no single-axis motion to show).
// ---------------------------------------------------------------------------
function NegativeNumberLine({ problem }: { problem: VisualProofData }) {
  const { a, b } = problem.meta as { a: number; b: number };

  if (problem.targetMisconceptionId === "NEG_MULT_SIGN") {
    return (
      <Frame height={110}>
        <text x={W / 2} y={30} textAnchor="middle" className="fill-ink" style={{ font: "600 15px sans-serif" }}>
          (−{a}) × (−{b})
        </text>
        <text x={W / 2} y={58} textAnchor="middle" className="fill-ink-faint" style={{ font: "13px sans-serif" }}>
          two negatives cancel — the minus signs pair off
        </text>
        <text x={W / 2} y={88} textAnchor="middle" className="fill-success" style={{ font: "700 18px sans-serif" }}>
          = +{a * b}
        </text>
      </Frame>
    );
  }

  // NEG_SUBTRACT_SIGN: a - (-b) = a + b -> hop right by b
  // NEG_ADD_MAGNITUDE: a + (-b) = a - b -> hop left by b
  const hopRight = problem.targetMisconceptionId === "NEG_SUBTRACT_SIGN";
  const end = hopRight ? a + b : a - b;
  const lo = Math.min(a, end) - 1;
  const hi = Math.max(a, end) + 1;
  const span = hi - lo;
  const x = (v: number) => 20 + ((v - lo) / span) * (W - 40);
  const startX = x(a);
  const endX = x(end);
  const midY = 55;

  return (
    <Frame height={110}>
      <line x1={20} y1={midY} x2={W - 20} y2={midY} stroke="currentColor" className="text-ink-faint" strokeWidth={1.5} />
      {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={midY - 5} x2={x(v)} y2={midY + 5} stroke="currentColor" className="text-ink-faint" />
          <text x={x(v)} y={midY + 20} textAnchor="middle" className="fill-ink-faint" style={{ font: "11px sans-serif" }}>
            {v}
          </text>
        </g>
      ))}
      <path
        d={`M ${startX} ${midY - 10} A ${Math.abs(endX - startX) / 2} 22 0 0 ${hopRight ? 1 : 0} ${endX} ${midY - 10}`}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        markerEnd="url(#arrow)"
      />
      <defs>
        <marker id="arrow" markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#3b82f6" />
        </marker>
      </defs>
      <circle cx={startX} cy={midY} r={4} fill="#3b82f6" />
      <circle cx={endX} cy={midY} r={4} fill="#10b981" />
      <text x={(startX + endX) / 2} y={midY - 26} textAnchor="middle" className="fill-primary" style={{ font: "600 12px sans-serif" }}>
        {hopRight ? `+${b}` : `−${b}`}
      </text>
      <text x={W / 2} y={98} textAnchor="middle" className="fill-success" style={{ font: "700 16px sans-serif" }}>
        = {end}
      </text>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// linear-equations: a two-pan balance, the same inverse operation applied to
// both sides simultaneously — the concrete image behind "whatever you do to
// one side, do to the other."
// ---------------------------------------------------------------------------
function BalanceScale({ problem }: { problem: VisualProofData }) {
  const isDivide = problem.targetMisconceptionId === "EQ_DIVIDE_PARTIAL";
  const meta = problem.meta as { a?: number; b?: number; c?: number; d?: number };

  const before = isDivide ? `${meta.a}x` : `x + ${meta.b}`;
  const beforeRight = isDivide ? `${meta.c} + ${meta.d}` : `${meta.c}`;
  const opLabel = isDivide ? `÷ ${meta.a}` : `− ${meta.b}`;
  const after = "x";
  const afterRight = problem.correctAnswer;

  return (
    <Frame height={150}>
      {[0, 1].map((row) => {
        const y = row === 0 ? 30 : 110;
        const left = row === 0 ? before : after;
        const right = row === 0 ? beforeRight : afterRight;
        return (
          <g key={row}>
            <line x1={70} y1={y + 20} x2={W - 70} y2={y + 20} stroke="currentColor" className="text-ink-faint" strokeWidth={2} />
            <line x1={70} y1={y + 20} x2={70} y2={y} stroke="currentColor" className="text-ink-faint" />
            <line x1={W - 70} y1={y + 20} x2={W - 70} y2={y} stroke="currentColor" className="text-ink-faint" />
            <rect x={35} y={y - 14} width={70} height={26} rx={5} fill="none" stroke="currentColor" className="text-primary" />
            <text x={70} y={y + 4} textAnchor="middle" className="fill-ink" style={{ font: "600 14px sans-serif" }}>
              {left}
            </text>
            <rect x={W - 105} y={y - 14} width={70} height={26} rx={5} fill="none" stroke="currentColor" className="text-primary" />
            <text x={W - 70} y={y + 4} textAnchor="middle" className="fill-ink" style={{ font: "600 14px sans-serif" }}>
              {right}
            </text>
          </g>
        );
      })}
      <text x={W / 2} y={72} textAnchor="middle" className="fill-primary" style={{ font: "700 13px sans-serif" }}>
        {opLabel} both sides ↓
      </text>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// order-of-operations / distributing / combining-like-terms: the expression
// as written, with the correct first-step highlighted and a plain-language
// "why" — the shared idea across all three concepts is "which piece resolves
// first," just applied to arithmetic precedence, distribution, or term
// matching respectively.
// ---------------------------------------------------------------------------
function ExpressionSteps({ problem }: { problem: VisualProofData }) {
  const id = problem.targetMisconceptionId;
  const meta = problem.meta as Record<string, number>;
  let expr = "";
  let step1Label = "";
  let step2Label = "";

  switch (id) {
    case "ORDER_LEFT_TO_RIGHT":
      expr = `${meta.a} + ${meta.b} × ${meta.c}`;
      step1Label = `multiply first: ${meta.b}×${meta.c} = ${meta.b * meta.c}`;
      step2Label = `then add: ${meta.a} + ${meta.b * meta.c} = ${problem.correctAnswer}`;
      break;
    case "ORDER_ADD_BEFORE_MULT":
      expr = `${meta.a} × ${meta.b} + ${meta.c}`;
      step1Label = `multiply first: ${meta.a}×${meta.b} = ${meta.a * meta.b}`;
      step2Label = `then add: ${meta.a * meta.b} + ${meta.c} = ${problem.correctAnswer}`;
      break;
    case "ORDER_EXPONENT_LAST":
      expr = `${meta.a} + ${meta.b}^2`;
      step1Label = `exponent first: ${meta.b}^2 = ${meta.b * meta.b}`;
      step2Label = `then add: ${meta.a} + ${meta.b * meta.b} = ${problem.correctAnswer}`;
      break;
    case "DIST_NO_MULTIPLY_SECOND":
    case "DIST_ADD_INSTEAD_MULTIPLY":
      expr = `${meta.a} × (${meta.b} + ${meta.c})`;
      step1Label = `distribute to both terms: ${meta.a}×${meta.b} and ${meta.a}×${meta.c}`;
      step2Label = `add: ${meta.a * meta.b} + ${meta.a * meta.c} = ${problem.correctAnswer}`;
      break;
    case "DIST_SIGN_ERROR":
      expr = `−${meta.a} × (${meta.b} − ${meta.c})`;
      step1Label = `distribute the sign too: −${meta.a}×${meta.b} and −${meta.a}×(−${meta.c})`;
      step2Label = `add: −${meta.a * meta.b} + ${meta.a * meta.c} = ${problem.correctAnswer}`;
      break;
    case "CLT_ADD_UNLIKE":
      expr = `${meta.p}x + ${meta.q}y`;
      step1Label = `x-terms and y-terms are different — they can't combine`;
      step2Label = `stays as: ${meta.p}x + ${meta.q}y`;
      break;
    case "CLT_EXPONENT_ADD":
      expr = `${meta.p}x^2 + ${meta.q}x^2`;
      step1Label = `same base and exponent — only the coefficients add`;
      step2Label = `= ${meta.p + meta.q}x^2  (exponent stays 2)`;
      break;
    case "CLT_DROP_VARIABLE":
      expr = `${meta.p}x + ${meta.q}x`;
      step1Label = `same variable — coefficients add, variable stays`;
      step2Label = `= ${meta.p + meta.q}x`;
      break;
  }

  return (
    <Frame height={130}>
      <text x={W / 2} y={30} textAnchor="middle" className="fill-ink" style={{ font: "600 17px sans-serif" }}>
        {expr}
      </text>
      <line x1={30} y1={44} x2={W - 30} y2={44} stroke="currentColor" className="text-border-soft" />
      <text x={W / 2} y={68} textAnchor="middle" className="fill-primary" style={{ font: "13px sans-serif" }}>
        1. {step1Label}
      </text>
      <text x={W / 2} y={94} textAnchor="middle" className="fill-success" style={{ font: "600 13px sans-serif" }}>
        2. {step2Label}
      </text>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// dimensional-analysis / mole-ratios: given quantity × conversion factor(s),
// unit (or substance) labels canceling diagonally down to the answer — the
// one diagram family that's genuinely shared, unmodified, across both
// subjects (prompt_v2.md's A0 point made visual).
// ---------------------------------------------------------------------------
function UnitChain({ problem }: { problem: VisualProofData }) {
  const id = problem.targetMisconceptionId;
  const meta = problem.meta as Record<string, number>;
  let given = "";
  let factors: string[] = [];

  switch (id) {
    case "DIM_INVERTED_FACTOR":
      given = `${meta.a}`;
      factors = [`× ${meta.k} (unit factor)`];
      break;
    case "DIM_CHAINED_DIRECTION":
      given = `${meta.a}`;
      factors = [`× ${meta.k1}`, `× ${meta.k2}`];
      break;
    case "DIM_WRONG_QUANTITY":
      given = `${meta.t} g`;
      factors = [`÷ ${meta.r} g/L`];
      break;
    case "MOLE_RATIO_INVERTED":
    case "MOLE_RATIO_IGNORED":
    case "MOLE_RATIO_PARTIAL":
      given = `${meta.a * meta.k} mol X`;
      factors = [`× (${meta.b} mol Y / ${meta.a} mol X)`];
      break;
  }

  return (
    <Frame height={110}>
      <text x={20} y={55} className="fill-ink" style={{ font: "600 15px sans-serif" }}>
        {given}
      </text>
      {factors.map((f, i) => (
        <g key={i}>
          <text x={90 + i * 130} y={55} className="fill-primary" style={{ font: "13px sans-serif" }}>
            {f}
          </text>
        </g>
      ))}
      <text x={W - 20} y={55} textAnchor="end" className="fill-success" style={{ font: "700 16px sans-serif" }}>
        = {problem.correctAnswer}
      </text>
      <line x1={20} y1={68} x2={W - 20} y2={68} stroke="currentColor" className="text-border-soft" />
      <text x={W / 2} y={90} textAnchor="middle" className="fill-ink-faint" style={{ font: "12px sans-serif" }}>
        matching units/substances cancel — the factor&apos;s direction is set by what cancels
      </text>
    </Frame>
  );
}
