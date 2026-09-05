import { ConceptId } from "./concepts";

export type AnswerType = "number" | "expression";

export interface ProblemInstance {
  id: string;
  conceptId: ConceptId;
  targetMisconceptionId: string;
  promptText: string;
  answerType: AnswerType;
  /** Canonical form (see normalizeAnswer) of the correct answer. */
  correctAnswer: string;
  /** Canonical form of the answer a learner with the target misconception would produce. */
  distractorAnswer: string;
  /** Raw generation params, useful for tests/debugging — never shown to the learner. */
  meta: Record<string, number>;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Adaptive difficulty (prompt.md §7's "adaptive difficulty" / "cognitive-load
 * adaptation") — before this, every problem for a given misconception used the
 * exact same fixed number ranges regardless of how well the learner was doing,
 * so a learner three problems from mastering a concept saw the identical kind
 * of numbers as one just starting it. Difficulty is chosen by the caller
 * (learnerModel.ts's decideNextProblem, from the target concept's current
 * p_mastery — see difficultyForMastery) and only ever widens the UPPER bound
 * of each generator's number ranges, never changes the underlying math or
 * problem structure — a "hard" problem is the same kind of mistake, just with
 * numbers that don't fit in working memory as easily.
 */
export type Difficulty = "easy" | "medium" | "hard";

/** Numeric encoding of the difficulty actually used, stashed on meta (never
 *  shown to the learner) so it's inspectable in tests without parsing prompt text. */
const DIFFICULTY_META: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 };

function pick<T>(difficulty: Difficulty, easy: T, medium: T, hard: T): T {
  return difficulty === "easy" ? easy : difficulty === "medium" ? medium : hard;
}

/** Normalizes a learner-submitted or generated answer for comparison. */
export function normalizeAnswer(raw: string, type: AnswerType): string {
  if (type === "number") {
    const n = Number(raw.trim().replace(/\s+/g, ""));
    if (Number.isNaN(n)) return raw.trim();
    // avoid "-0" and float noise
    return String(Object.is(n, -0) ? 0 : Math.round(n * 1e6) / 1e6);
  }
  // expression: strip all whitespace, lowercase, standardize exponent notation
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\*\*/g, "^")
    .replace(/x\^1(?!\d)/g, "x");
}

type Generator = (difficulty: Difficulty) => ProblemInstance;

function mkId(conceptId: ConceptId, misconceptionId: string): string {
  return `${conceptId}:${misconceptionId}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`;
}

// ---------------------------------------------------------------------------
// order-of-operations
// ---------------------------------------------------------------------------

const orderLeftToRight: Generator = (difficulty) => {
  const max = pick(difficulty, 9, 14, 20);
  const a = randInt(2, max);
  const b = randInt(2, max);
  const c = randInt(2, max);
  const correct = a + b * c;
  const distractor = (a + b) * c;
  return {
    id: mkId("order-of-operations", "ORDER_LEFT_TO_RIGHT"),
    conceptId: "order-of-operations",
    targetMisconceptionId: "ORDER_LEFT_TO_RIGHT",
    promptText: `Evaluate: ${a} + ${b} × ${c}`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, c, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const orderAddBeforeMult: Generator = (difficulty) => {
  const max = pick(difficulty, 9, 14, 20);
  const a = randInt(2, max);
  const b = randInt(2, max);
  const c = randInt(2, max);
  const correct = a * b + c;
  const distractor = a * (b + c);
  return {
    id: mkId("order-of-operations", "ORDER_ADD_BEFORE_MULT"),
    conceptId: "order-of-operations",
    targetMisconceptionId: "ORDER_ADD_BEFORE_MULT",
    promptText: `Evaluate: ${a} × ${b} + ${c}`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, c, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const orderExponentLast: Generator = (difficulty) => {
  const aMax = pick(difficulty, 9, 14, 20);
  // The exponent base gets a gentler scale-up than a plain addend would —
  // b^2 grows quadratically, so even a modest widening here keeps "hard"
  // squares in mental-math-with-scratch-paper range instead of absurd.
  const bMax = pick(difficulty, 6, 8, 10);
  const a = randInt(2, aMax);
  const b = randInt(2, bMax);
  const correct = a + b * b;
  const distractor = (a + b) * (a + b);
  return {
    id: mkId("order-of-operations", "ORDER_EXPONENT_LAST"),
    conceptId: "order-of-operations",
    targetMisconceptionId: "ORDER_EXPONENT_LAST",
    promptText: `Evaluate: ${a} + ${b}^2`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, difficulty: DIFFICULTY_META[difficulty] },
  };
};

// ---------------------------------------------------------------------------
// negative-numbers
// ---------------------------------------------------------------------------

const negSubtractSign: Generator = (difficulty) => {
  const max = pick(difficulty, 12, 20, 30);
  const a = randInt(1, max);
  const b = randInt(1, max);
  const correct = a + b;
  const distractor = a - b;
  return {
    id: mkId("negative-numbers", "NEG_SUBTRACT_SIGN"),
    conceptId: "negative-numbers",
    targetMisconceptionId: "NEG_SUBTRACT_SIGN",
    promptText: `Evaluate: ${a} - (-${b})`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const negMultSign: Generator = (difficulty) => {
  const max = pick(difficulty, 12, 18, 25);
  const a = randInt(1, max);
  const b = randInt(1, max);
  const correct = a * b;
  const distractor = -(a * b);
  return {
    id: mkId("negative-numbers", "NEG_MULT_SIGN"),
    conceptId: "negative-numbers",
    targetMisconceptionId: "NEG_MULT_SIGN",
    promptText: `Evaluate: (-${a}) × (-${b})`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const negAddMagnitude: Generator = (difficulty) => {
  const max = pick(difficulty, 15, 22, 30);
  const a = randInt(1, max);
  const b = randInt(1, max);
  const correct = a - b;
  const distractor = a + b;
  return {
    id: mkId("negative-numbers", "NEG_ADD_MAGNITUDE"),
    conceptId: "negative-numbers",
    targetMisconceptionId: "NEG_ADD_MAGNITUDE",
    promptText: `Evaluate: ${a} + (-${b})`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, difficulty: DIFFICULTY_META[difficulty] },
  };
};

// ---------------------------------------------------------------------------
// distributing (arithmetic form of the distributive property)
// ---------------------------------------------------------------------------

const distNoMultiplySecond: Generator = (difficulty) => {
  const aMax = pick(difficulty, 9, 12, 15);
  const bcMax = pick(difficulty, 9, 12, 15);
  const a = randInt(2, aMax);
  const b = randInt(1, bcMax);
  const c = randInt(1, bcMax);
  const correct = a * b + a * c;
  const distractor = a * b + c;
  return {
    id: mkId("distributing", "DIST_NO_MULTIPLY_SECOND"),
    conceptId: "distributing",
    targetMisconceptionId: "DIST_NO_MULTIPLY_SECOND",
    promptText: `Evaluate: ${a} × (${b} + ${c})`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, c, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const distAddInsteadMultiply: Generator = (difficulty) => {
  // b, c start at 2 (not 1) at every difficulty: a=2,b=1,c=1 is the only
  // integer case where a*b+a*c coincides with a+b+c, which would collide
  // correct with distractor — widening only the max keeps that safe.
  const max = pick(difficulty, 9, 12, 15);
  const a = randInt(2, max);
  const b = randInt(2, max);
  const c = randInt(2, max);
  const correct = a * b + a * c;
  const distractor = a + b + c;
  return {
    id: mkId("distributing", "DIST_ADD_INSTEAD_MULTIPLY"),
    conceptId: "distributing",
    targetMisconceptionId: "DIST_ADD_INSTEAD_MULTIPLY",
    promptText: `Evaluate: ${a} × (${b} + ${c})`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, c, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const distSignError: Generator = (difficulty) => {
  const max = pick(difficulty, 9, 12, 15);
  const a = randInt(2, max);
  const b = randInt(2, max);
  // c's range depends on b (must stay below it) — scales safely along with
  // b's own wider max above, no separate tuning needed.
  const c = randInt(1, b - 1 >= 1 ? b - 1 : 1);
  const correct = -a * b + a * c;
  const distractor = -a * b - a * c;
  return {
    id: mkId("distributing", "DIST_SIGN_ERROR"),
    conceptId: "distributing",
    targetMisconceptionId: "DIST_SIGN_ERROR",
    promptText: `Evaluate: -${a} × (${b} - ${c})`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, c, difficulty: DIFFICULTY_META[difficulty] },
  };
};

// ---------------------------------------------------------------------------
// combining-like-terms (symbolic/expression answers)
// ---------------------------------------------------------------------------

const cltAddUnlike: Generator = (difficulty) => {
  const max = pick(difficulty, 9, 15, 25);
  const p = randInt(2, max);
  const q = randInt(2, max);
  return {
    id: mkId("combining-like-terms", "CLT_ADD_UNLIKE"),
    conceptId: "combining-like-terms",
    targetMisconceptionId: "CLT_ADD_UNLIKE",
    promptText: `Simplify: ${p}x + ${q}y`,
    answerType: "expression",
    correctAnswer: normalizeAnswer(`${p}x+${q}y`, "expression"),
    distractorAnswer: normalizeAnswer(`${p + q}xy`, "expression"),
    meta: { p, q, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const cltExponentAdd: Generator = (difficulty) => {
  const max = pick(difficulty, 9, 15, 25);
  const p = randInt(2, max);
  const q = randInt(2, max);
  return {
    id: mkId("combining-like-terms", "CLT_EXPONENT_ADD"),
    conceptId: "combining-like-terms",
    targetMisconceptionId: "CLT_EXPONENT_ADD",
    promptText: `Simplify: ${p}x^2 + ${q}x^2`,
    answerType: "expression",
    correctAnswer: normalizeAnswer(`${p + q}x^2`, "expression"),
    distractorAnswer: normalizeAnswer(`${p + q}x^4`, "expression"),
    meta: { p, q, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const cltDropVariable: Generator = (difficulty) => {
  const max = pick(difficulty, 9, 15, 25);
  const p = randInt(2, max);
  const q = randInt(2, max);
  return {
    id: mkId("combining-like-terms", "CLT_DROP_VARIABLE"),
    conceptId: "combining-like-terms",
    targetMisconceptionId: "CLT_DROP_VARIABLE",
    promptText: `Simplify: ${p}x + ${q}x`,
    answerType: "expression",
    correctAnswer: normalizeAnswer(`${p + q}x`, "expression"),
    distractorAnswer: normalizeAnswer(`${p + q}`, "expression"),
    meta: { p, q, difficulty: DIFFICULTY_META[difficulty] },
  };
};

// ---------------------------------------------------------------------------
// linear-equations
// ---------------------------------------------------------------------------

const eqWrongOperation: Generator = (difficulty) => {
  const bMax = pick(difficulty, 12, 18, 25);
  const cMax = pick(difficulty, 20, 30, 45);
  const b = randInt(2, bMax);
  const c = randInt(1, cMax);
  const correct = c - b;
  const distractor = c + b;
  return {
    id: mkId("linear-equations", "EQ_WRONG_OPERATION"),
    conceptId: "linear-equations",
    targetMisconceptionId: "EQ_WRONG_OPERATION",
    promptText: `Solve for x: x + ${b} = ${c}`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { b, c, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const eqOneSideOnly: Generator = (difficulty) => {
  const bMax = pick(difficulty, 12, 18, 25);
  const cMax = pick(difficulty, 20, 30, 45);
  const b = randInt(2, bMax);
  const c = randInt(1, cMax);
  const correct = c - b;
  const distractor = c;
  return {
    id: mkId("linear-equations", "EQ_ONE_SIDE_ONLY"),
    conceptId: "linear-equations",
    targetMisconceptionId: "EQ_ONE_SIDE_ONLY",
    promptText: `Solve for x: x + ${b} = ${c}`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { b, c, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const eqDividePartial: Generator = (difficulty) => {
  const aMax = pick(difficulty, 6, 8, 10);
  const kMax = pick(difficulty, 6, 9, 12);
  const xMax = pick(difficulty, 9, 14, 18);
  let a: number, k: number, xTrue: number, d: number;
  let attempts = 0;
  do {
    a = randInt(2, aMax);
    k = randInt(1, kMax);
    xTrue = randInt(1, xMax);
    d = a * xTrue - a * k;
    attempts++;
  } while ((d <= 0 || k === xTrue) && attempts < 50);
  const c = a * k;
  const correct = xTrue;
  const distractor = k + d;
  return {
    id: mkId("linear-equations", "EQ_DIVIDE_PARTIAL"),
    conceptId: "linear-equations",
    targetMisconceptionId: "EQ_DIVIDE_PARTIAL",
    promptText: `Solve for x: ${a}x = ${c} + ${d}`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, c, d, difficulty: DIFFICULTY_META[difficulty] },
  };
};

// ---------------------------------------------------------------------------
// chemistry — the second subject (RESEARCH/IDEA_SELECTION.md "A second
// subject: chemistry"). Same generator pattern as every algebra concept
// above: a known-correct answer and a known distractor computed the same
// way every time, difficulty-scaled the same way. Real conversion factors
// (60 min/hr, 1000 g/kg, etc.), not made-up numbers, since these are actual
// physical constants, not something to randomize.
// ---------------------------------------------------------------------------

const UNIT_PAIRS = [
  { from: "hours", to: "minutes", k: 60 },
  { from: "minutes", to: "seconds", k: 60 },
  { from: "meters", to: "centimeters", k: 100 },
  { from: "kilograms", to: "grams", k: 1000 },
  { from: "liters", to: "milliliters", k: 1000 },
];

const CHAIN_TRIPLES = [
  { u1: "hours", u2: "minutes", u3: "seconds", k1: 60, k2: 60 },
  { u1: "kilometers", u2: "meters", u3: "centimeters", k1: 1000, k2: 100 },
  { u1: "kilograms", u2: "grams", u3: "milligrams", k1: 1000, k2: 1000 },
];

function pickOne<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

const dimInvertedFactor: Generator = (difficulty) => {
  const { from, to, k } = pickOne(UNIT_PAIRS);
  const aMax = pick(difficulty, 9, 20, 40);
  const a = randInt(2, aMax);
  const correct = a * k;
  const distractor = a / k;
  return {
    id: mkId("dimensional-analysis", "DIM_INVERTED_FACTOR"),
    conceptId: "dimensional-analysis",
    targetMisconceptionId: "DIM_INVERTED_FACTOR",
    promptText: `Convert ${a} ${from} to ${to} (1 ${from.slice(0, -1)} = ${k} ${to}).`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, k, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const dimChainedDirection: Generator = (difficulty) => {
  const { u1, u2, u3, k1, k2 } = pickOne(CHAIN_TRIPLES);
  const aMax = pick(difficulty, 9, 20, 40);
  const a = randInt(2, aMax);
  const correct = a * k1 * k2;
  const distractor = (a * k1) / k2;
  return {
    id: mkId("dimensional-analysis", "DIM_CHAINED_DIRECTION"),
    conceptId: "dimensional-analysis",
    targetMisconceptionId: "DIM_CHAINED_DIRECTION",
    promptText: `Convert ${a} ${u1} to ${u3} (1 ${u1.slice(0, -1)} = ${k1} ${u2}, 1 ${u2.slice(0, -1)} = ${k2} ${u3}).`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, k1, k2, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const dimWrongQuantity: Generator = (difficulty) => {
  const rMax = pick(difficulty, 5, 8, 12);
  const mMax = pick(difficulty, 8, 14, 20);
  const r = randInt(2, rMax); // grams of solute per liter
  const m = randInt(2, mMax);
  const t = r * m; // total grams
  const correct = m; // t / r, guaranteed clean by construction
  const distractor = t * r;
  return {
    id: mkId("dimensional-analysis", "DIM_WRONG_QUANTITY"),
    conceptId: "dimensional-analysis",
    targetMisconceptionId: "DIM_WRONG_QUANTITY",
    promptText: `A solution has a concentration of ${r} grams of solute per liter. How many liters contain ${t} grams of solute total?`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { r, t, difficulty: DIFFICULTY_META[difficulty] },
  };
};

function moleRatioSetup(aMax: number, kMax: number): { a: number; b: number; c: number; k: number } {
  let a: number, b: number;
  do {
    a = randInt(2, aMax);
    b = randInt(2, aMax);
  } while (a === b || a === b * b); // a===b collides correct with two distractors; a===b*b collides the "partial" one
  const c = randInt(2, aMax);
  const k = randInt(2, kMax);
  return { a, b, c, k };
}

const moleRatioInverted: Generator = (difficulty) => {
  const aMax = pick(difficulty, 4, 6, 9);
  const kMax = pick(difficulty, 6, 9, 12);
  const { a, b, c, k } = moleRatioSetup(aMax, kMax);
  const n = a * k;
  const correct = b * k;
  const distractor = (a * a * k) / b;
  return {
    id: mkId("mole-ratios", "MOLE_RATIO_INVERTED"),
    conceptId: "mole-ratios",
    targetMisconceptionId: "MOLE_RATIO_INVERTED",
    promptText: `In the reaction ${a}X + ${b}Y → ${c}Z, you have ${n} moles of X. How many moles of Y are needed to react completely?`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, c, k, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const moleRatioIgnored: Generator = (difficulty) => {
  const aMax = pick(difficulty, 4, 6, 9);
  const kMax = pick(difficulty, 6, 9, 12);
  const { a, b, c, k } = moleRatioSetup(aMax, kMax);
  const n = a * k;
  const correct = b * k;
  const distractor = n;
  return {
    id: mkId("mole-ratios", "MOLE_RATIO_IGNORED"),
    conceptId: "mole-ratios",
    targetMisconceptionId: "MOLE_RATIO_IGNORED",
    promptText: `In the reaction ${a}X + ${b}Y → ${c}Z, you have ${n} moles of X. How many moles of Y are needed to react completely?`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, c, k, difficulty: DIFFICULTY_META[difficulty] },
  };
};

const moleRatioPartial: Generator = (difficulty) => {
  const aMax = pick(difficulty, 4, 6, 9);
  const kMax = pick(difficulty, 6, 9, 12);
  const { a, b, c, k } = moleRatioSetup(aMax, kMax);
  const n = a * k;
  const correct = b * k;
  const distractor = n / b;
  return {
    id: mkId("mole-ratios", "MOLE_RATIO_PARTIAL"),
    conceptId: "mole-ratios",
    targetMisconceptionId: "MOLE_RATIO_PARTIAL",
    promptText: `In the reaction ${a}X + ${b}Y → ${c}Z, you have ${n} moles of X. How many moles of Y are needed to react completely?`,
    answerType: "number",
    correctAnswer: normalizeAnswer(String(correct), "number"),
    distractorAnswer: normalizeAnswer(String(distractor), "number"),
    meta: { a, b, c, k, difficulty: DIFFICULTY_META[difficulty] },
  };
};

// ---------------------------------------------------------------------------

const GENERATORS_BY_CONCEPT: Record<ConceptId, Generator[]> = {
  "order-of-operations": [orderLeftToRight, orderAddBeforeMult, orderExponentLast],
  "negative-numbers": [negSubtractSign, negMultSign, negAddMagnitude],
  distributing: [distNoMultiplySecond, distAddInsteadMultiply, distSignError],
  "combining-like-terms": [cltAddUnlike, cltExponentAdd, cltDropVariable],
  "linear-equations": [eqWrongOperation, eqOneSideOnly, eqDividePartial],
  "dimensional-analysis": [dimInvertedFactor, dimChainedDirection, dimWrongQuantity],
  "mole-ratios": [moleRatioInverted, moleRatioIgnored, moleRatioPartial],
};

export const GENERATORS_BY_MISCONCEPTION: Record<string, Generator> = {
  ORDER_LEFT_TO_RIGHT: orderLeftToRight,
  ORDER_ADD_BEFORE_MULT: orderAddBeforeMult,
  ORDER_EXPONENT_LAST: orderExponentLast,
  NEG_SUBTRACT_SIGN: negSubtractSign,
  NEG_MULT_SIGN: negMultSign,
  NEG_ADD_MAGNITUDE: negAddMagnitude,
  DIST_NO_MULTIPLY_SECOND: distNoMultiplySecond,
  DIST_ADD_INSTEAD_MULTIPLY: distAddInsteadMultiply,
  DIST_SIGN_ERROR: distSignError,
  CLT_ADD_UNLIKE: cltAddUnlike,
  CLT_EXPONENT_ADD: cltExponentAdd,
  CLT_DROP_VARIABLE: cltDropVariable,
  EQ_WRONG_OPERATION: eqWrongOperation,
  EQ_ONE_SIDE_ONLY: eqOneSideOnly,
  EQ_DIVIDE_PARTIAL: eqDividePartial,
  DIM_INVERTED_FACTOR: dimInvertedFactor,
  DIM_CHAINED_DIRECTION: dimChainedDirection,
  DIM_WRONG_QUANTITY: dimWrongQuantity,
  MOLE_RATIO_INVERTED: moleRatioInverted,
  MOLE_RATIO_IGNORED: moleRatioIgnored,
  MOLE_RATIO_PARTIAL: moleRatioPartial,
};

/** Generates a random problem instance for the given concept, at the given
 *  difficulty (defaults to "medium" for callers that don't have a mastery
 *  estimate to adapt from — e.g. tests, or contexts where difficulty isn't
 *  the point, like Spot the Mistake's flawed walkthroughs). */
export function generateProblem(conceptId: ConceptId, difficulty: Difficulty = "medium"): ProblemInstance {
  const generators = GENERATORS_BY_CONCEPT[conceptId];
  const generator = generators[randInt(0, generators.length - 1)];
  return generator(difficulty);
}

/** Generates a problem instance specifically targeting a given misconception. */
export function generateProblemForMisconception(
  misconceptionId: string,
  difficulty: Difficulty = "medium"
): ProblemInstance {
  const generator = GENERATORS_BY_MISCONCEPTION[misconceptionId];
  if (!generator) throw new Error(`No generator for misconception: ${misconceptionId}`);
  return generator(difficulty);
}
