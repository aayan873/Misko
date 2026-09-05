import { ProblemInstance } from "./problemEngine";

export interface WorkedStep {
  text: string;
}

export interface FlawedWalkthrough {
  problemText: string;
  steps: WorkedStep[];
  /** 0-based index of the one step that applies the misconception. */
  flawedStepIndex: number;
}

type Builder = (problem: ProblemInstance) => FlawedWalkthrough;

// ---------------------------------------------------------------------------
// order-of-operations
// ---------------------------------------------------------------------------

const orderLeftToRight: Builder = (p) => {
  const { a, b, c } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a} + ${b} × ${c}` },
      { text: `Add ${a} + ${b} first, left to right: ${a + b}` },
      { text: `Multiply by ${c}: ${a + b} × ${c} = ${(a + b) * c}` },
    ],
    flawedStepIndex: 1,
  };
};

const orderAddBeforeMult: Builder = (p) => {
  const { a, b, c } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a} × ${b} + ${c}` },
      { text: `Add ${b} + ${c} first: ${b + c}` },
      { text: `Multiply by ${a}: ${a} × ${b + c} = ${a * (b + c)}` },
    ],
    flawedStepIndex: 1,
  };
};

const orderExponentLast: Builder = (p) => {
  const { a, b } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a} + ${b}^2` },
      { text: `Add ${a} + ${b} first: ${a + b}` },
      { text: `Square the result: (${a + b})^2 = ${(a + b) * (a + b)}` },
    ],
    flawedStepIndex: 1,
  };
};

// ---------------------------------------------------------------------------
// negative-numbers
// ---------------------------------------------------------------------------

const negSubtractSign: Builder = (p) => {
  const { a, b } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a} - (-${b})` },
      { text: `Subtracting a negative just cancels the sign: ${a} - ${b}` },
      { text: `= ${a - b}` },
    ],
    flawedStepIndex: 1,
  };
};

const negMultSign: Builder = (p) => {
  const { a, b } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `(-${a}) × (-${b})` },
      { text: `Multiply the numbers: ${a} × ${b} = ${a * b}` },
      { text: `Two negatives multiplied stay negative: -${a * b}` },
    ],
    flawedStepIndex: 2,
  };
};

const negAddMagnitude: Builder = (p) => {
  const { a, b } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a} + (-${b})` },
      { text: `Add the magnitudes together: ${a} + ${b}` },
      { text: `= ${a + b}` },
    ],
    flawedStepIndex: 1,
  };
};

// ---------------------------------------------------------------------------
// distributing
// ---------------------------------------------------------------------------

const distNoMultiplySecond: Builder = (p) => {
  const { a, b, c } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a} × (${b} + ${c})` },
      { text: `Multiply ${a} by ${b}: ${a * b}` },
      { text: `Bring down the ${c} unchanged: ${a * b} + ${c} = ${a * b + c}` },
    ],
    flawedStepIndex: 2,
  };
};

const distSignError: Builder = (p) => {
  const { a, b, c } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `-${a} × (${b} - ${c})` },
      { text: `Multiply -${a} by ${b}: ${-a * b}` },
      { text: `Multiply -${a} by -${c}, keeping the sign the same: ${-a * c}` },
      { text: `Add them: ${-a * b} + (${-a * c}) = ${-a * b - a * c}` },
    ],
    flawedStepIndex: 2,
  };
};

const distAddInsteadMultiply: Builder = (p) => {
  const { a, b, c } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a} × (${b} + ${c})` },
      { text: `Distribute by adding ${a} to the sum: ${a} + ${b} + ${c}` },
      { text: `= ${a + b + c}` },
    ],
    flawedStepIndex: 1,
  };
};

// ---------------------------------------------------------------------------
// combining-like-terms
// ---------------------------------------------------------------------------

const cltAddUnlike: Builder = (p) => {
  const { p: pCoef, q } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${pCoef}x + ${q}y` },
      { text: `Combine into one term since they're both variable terms: ${pCoef + q}xy` },
    ],
    flawedStepIndex: 1,
  };
};

const cltExponentAdd: Builder = (p) => {
  const { p: pCoef, q } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${pCoef}x^2 + ${q}x^2` },
      { text: `Add the coefficients: ${pCoef} + ${q} = ${pCoef + q}` },
      { text: `Add the exponents too, like when multiplying powers: 2 + 2 = 4, so ${pCoef + q}x^4` },
    ],
    flawedStepIndex: 2,
  };
};

const cltDropVariable: Builder = (p) => {
  const { p: pCoef, q } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${pCoef}x + ${q}x` },
      { text: `Add the coefficients: ${pCoef} + ${q} = ${pCoef + q}` },
      { text: `Final answer: ${pCoef + q}` },
    ],
    flawedStepIndex: 2,
  };
};

// ---------------------------------------------------------------------------
// linear-equations
// ---------------------------------------------------------------------------

const eqWrongOperation: Builder = (p) => {
  const { b, c } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `x + ${b} = ${c}` },
      { text: `To isolate x, add ${b} to both sides: x = ${c} + ${b}` },
      { text: `= ${c + b}` },
    ],
    flawedStepIndex: 1,
  };
};

const eqOneSideOnly: Builder = (p) => {
  const { b, c } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `x + ${b} = ${c}` },
      { text: `Subtract ${b} from the left side: x = ${c}` },
    ],
    flawedStepIndex: 1,
  };
};

const eqDividePartial: Builder = (p) => {
  const { a, c, d } = p.meta;
  const k = c / a;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a}x = ${c} + ${d}` },
      { text: `Divide the ${c} term by ${a}: ${c} ÷ ${a} = ${k}` },
      { text: `Add the ${d} without dividing it: ${k} + ${d} = ${k + d}` },
    ],
    flawedStepIndex: 2,
  };
};

// ---------------------------------------------------------------------------
// chemistry
//
// Unlike every algebra distractor above (all clean integers by construction),
// several of these involve division and aren't guaranteed integers (e.g. a/k).
// Using p.distractorAnswer directly for the final displayed value — rather
// than recomputing the division here and risking a floating-point-formatting
// mismatch against normalizeAnswer's rounded string — guarantees the
// walkthrough's last step matches exactly what the app would actually grade
// as the distractor, which is what flawedWorkedExample.test.ts checks.
// ---------------------------------------------------------------------------

const dimInvertedFactor: Builder = (p) => {
  const { a, k } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${a} × (conversion factor ${k})` },
      { text: `Divide by the conversion factor instead of multiplying: ${a} ÷ ${k} = ${p.distractorAnswer}` },
    ],
    flawedStepIndex: 1,
  };
};

const dimChainedDirection: Builder = (p) => {
  const { a, k1, k2 } = p.meta;
  const afterFirst = a * k1;
  return {
    problemText: p.promptText,
    steps: [
      { text: `First conversion: ${a} × ${k1} = ${afterFirst}` },
      { text: `Divide by the second factor instead of multiplying: ${afterFirst} ÷ ${k2} = ${p.distractorAnswer}` },
    ],
    flawedStepIndex: 1,
  };
};

const dimWrongQuantity: Builder = (p) => {
  const { r, t } = p.meta;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${t} grams total, ${r} grams per liter` },
      { text: `Multiply the total by the rate instead of dividing by it: ${t} × ${r} = ${p.distractorAnswer}` },
    ],
    flawedStepIndex: 1,
  };
};

const moleRatioInverted: Builder = (p) => {
  const { a, b, k } = p.meta;
  const n = a * k;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${n} moles of X` },
      { text: `Use the ratio ${a}/${b} instead of ${b}/${a}: ${n} × (${a}/${b}) = ${p.distractorAnswer}` },
    ],
    flawedStepIndex: 1,
  };
};

const moleRatioIgnored: Builder = (p) => {
  const { a, k } = p.meta;
  const n = a * k;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${n} moles of X` },
      { text: `Treat the mole ratio as 1:1: ${p.distractorAnswer} moles of Y needed` },
    ],
    flawedStepIndex: 1,
  };
};

const moleRatioPartial: Builder = (p) => {
  const { a, b, k } = p.meta;
  const n = a * k;
  return {
    problemText: p.promptText,
    steps: [
      { text: `${n} moles of X` },
      { text: `Divide by Y's coefficient only, without multiplying by X's: ${n} ÷ ${b} = ${p.distractorAnswer}` },
    ],
    flawedStepIndex: 1,
  };
};

// ---------------------------------------------------------------------------

const BUILDERS_BY_MISCONCEPTION: Record<string, Builder> = {
  ORDER_LEFT_TO_RIGHT: orderLeftToRight,
  ORDER_ADD_BEFORE_MULT: orderAddBeforeMult,
  ORDER_EXPONENT_LAST: orderExponentLast,
  NEG_SUBTRACT_SIGN: negSubtractSign,
  NEG_MULT_SIGN: negMultSign,
  NEG_ADD_MAGNITUDE: negAddMagnitude,
  DIST_NO_MULTIPLY_SECOND: distNoMultiplySecond,
  DIST_SIGN_ERROR: distSignError,
  DIST_ADD_INSTEAD_MULTIPLY: distAddInsteadMultiply,
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

/** Builds a flawed step-by-step walkthrough that arrives at the problem's known
 * distractor answer, for the "spot the mistake" exercise mode. */
export function buildFlawedWalkthrough(problem: ProblemInstance): FlawedWalkthrough {
  const builder = BUILDERS_BY_MISCONCEPTION[problem.targetMisconceptionId];
  if (!builder) {
    throw new Error(`No flawed-walkthrough builder for misconception: ${problem.targetMisconceptionId}`);
  }
  return builder(problem);
}

export function hasFlawedWalkthrough(misconceptionId: string): boolean {
  return misconceptionId in BUILDERS_BY_MISCONCEPTION;
}
