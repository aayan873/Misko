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

type Generator = () => ProblemInstance;

function mkId(conceptId: ConceptId, misconceptionId: string): string {
  return `${conceptId}:${misconceptionId}:${Date.now()}:${Math.floor(Math.random() * 1e6)}`;
}

// ---------------------------------------------------------------------------
// order-of-operations
// ---------------------------------------------------------------------------

const orderLeftToRight: Generator = () => {
  const a = randInt(2, 9);
  const b = randInt(2, 9);
  const c = randInt(2, 9);
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
    meta: { a, b, c },
  };
};

const orderAddBeforeMult: Generator = () => {
  const a = randInt(2, 9);
  const b = randInt(2, 9);
  const c = randInt(2, 9);
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
    meta: { a, b, c },
  };
};

const orderExponentLast: Generator = () => {
  const a = randInt(2, 9);
  const b = randInt(2, 6);
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
    meta: { a, b },
  };
};

// ---------------------------------------------------------------------------
// negative-numbers
// ---------------------------------------------------------------------------

const negSubtractSign: Generator = () => {
  const a = randInt(1, 12);
  const b = randInt(1, 12);
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
    meta: { a, b },
  };
};

const negMultSign: Generator = () => {
  const a = randInt(1, 12);
  const b = randInt(1, 12);
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
    meta: { a, b },
  };
};

const negAddMagnitude: Generator = () => {
  const a = randInt(1, 15);
  let b = randInt(1, 15);
  if (a === 0) b = randInt(1, 15);
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
    meta: { a, b },
  };
};

// ---------------------------------------------------------------------------
// distributing (arithmetic form of the distributive property)
// ---------------------------------------------------------------------------

const distNoMultiplySecond: Generator = () => {
  const a = randInt(2, 9);
  const b = randInt(1, 9);
  const c = randInt(1, 9);
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
    meta: { a, b, c },
  };
};

const distAddInsteadMultiply: Generator = () => {
  // b, c start at 2 (not 1): a=2,b=1,c=1 is the only integer case where
  // a*b+a*c coincides with a+b+c, which would collide correct with distractor.
  const a = randInt(2, 9);
  const b = randInt(2, 9);
  const c = randInt(2, 9);
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
    meta: { a, b, c },
  };
};

const distSignError: Generator = () => {
  const a = randInt(2, 9);
  const b = randInt(2, 9);
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
    meta: { a, b, c },
  };
};

// ---------------------------------------------------------------------------
// combining-like-terms (symbolic/expression answers)
// ---------------------------------------------------------------------------

const cltAddUnlike: Generator = () => {
  const p = randInt(2, 9);
  const q = randInt(2, 9);
  return {
    id: mkId("combining-like-terms", "CLT_ADD_UNLIKE"),
    conceptId: "combining-like-terms",
    targetMisconceptionId: "CLT_ADD_UNLIKE",
    promptText: `Simplify: ${p}x + ${q}y`,
    answerType: "expression",
    correctAnswer: normalizeAnswer(`${p}x+${q}y`, "expression"),
    distractorAnswer: normalizeAnswer(`${p + q}xy`, "expression"),
    meta: { p, q },
  };
};

const cltExponentAdd: Generator = () => {
  const p = randInt(2, 9);
  const q = randInt(2, 9);
  return {
    id: mkId("combining-like-terms", "CLT_EXPONENT_ADD"),
    conceptId: "combining-like-terms",
    targetMisconceptionId: "CLT_EXPONENT_ADD",
    promptText: `Simplify: ${p}x^2 + ${q}x^2`,
    answerType: "expression",
    correctAnswer: normalizeAnswer(`${p + q}x^2`, "expression"),
    distractorAnswer: normalizeAnswer(`${p + q}x^4`, "expression"),
    meta: { p, q },
  };
};

const cltDropVariable: Generator = () => {
  const p = randInt(2, 9);
  const q = randInt(2, 9);
  return {
    id: mkId("combining-like-terms", "CLT_DROP_VARIABLE"),
    conceptId: "combining-like-terms",
    targetMisconceptionId: "CLT_DROP_VARIABLE",
    promptText: `Simplify: ${p}x + ${q}x`,
    answerType: "expression",
    correctAnswer: normalizeAnswer(`${p + q}x`, "expression"),
    distractorAnswer: normalizeAnswer(`${p + q}`, "expression"),
    meta: { p, q },
  };
};

// ---------------------------------------------------------------------------
// linear-equations
// ---------------------------------------------------------------------------

const eqWrongOperation: Generator = () => {
  const b = randInt(2, 12);
  const c = randInt(1, 20);
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
    meta: { b, c },
  };
};

const eqOneSideOnly: Generator = () => {
  const b = randInt(2, 12);
  const c = randInt(1, 20);
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
    meta: { b, c },
  };
};

const eqDividePartial: Generator = () => {
  let a: number, k: number, xTrue: number, d: number;
  let attempts = 0;
  do {
    a = randInt(2, 6);
    k = randInt(1, 6);
    xTrue = randInt(1, 9);
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
    meta: { a, c, d },
  };
};

// ---------------------------------------------------------------------------

const GENERATORS_BY_CONCEPT: Record<ConceptId, Generator[]> = {
  "order-of-operations": [orderLeftToRight, orderAddBeforeMult, orderExponentLast],
  "negative-numbers": [negSubtractSign, negMultSign, negAddMagnitude],
  distributing: [distNoMultiplySecond, distAddInsteadMultiply, distSignError],
  "combining-like-terms": [cltAddUnlike, cltExponentAdd, cltDropVariable],
  "linear-equations": [eqWrongOperation, eqOneSideOnly, eqDividePartial],
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
};

/** Generates a random problem instance for the given concept. */
export function generateProblem(conceptId: ConceptId): ProblemInstance {
  const generators = GENERATORS_BY_CONCEPT[conceptId];
  const generator = generators[randInt(0, generators.length - 1)];
  return generator();
}

/** Generates a problem instance specifically targeting a given misconception. */
export function generateProblemForMisconception(misconceptionId: string): ProblemInstance {
  const generator = GENERATORS_BY_MISCONCEPTION[misconceptionId];
  if (!generator) throw new Error(`No generator for misconception: ${misconceptionId}`);
  return generator();
}
