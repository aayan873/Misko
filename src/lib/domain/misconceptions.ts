import { ConceptId } from "./concepts";

export interface Misconception {
  id: string;
  conceptId: ConceptId;
  name: string;
  /** Plain-language description of the flawed reasoning, used to ground the AI's diagnosis. */
  description: string;
}

/**
 * A curated taxonomy of well-documented Algebra I misconceptions (not exhaustive —
 * scoped deliberately narrow per RESEARCH/IDEA_SELECTION.md). Each is tied to a
 * concept and is used by the problem engine to compute a "distractor" answer that
 * a learner would arrive at if they were reasoning this specific wrong way.
 */
export const MISCONCEPTIONS: Misconception[] = [
  {
    id: "ORDER_LEFT_TO_RIGHT",
    conceptId: "order-of-operations",
    name: "Strict left-to-right evaluation",
    description:
      "Evaluates the expression strictly left to right, ignoring that multiplication/division take precedence over addition/subtraction.",
  },
  {
    id: "ORDER_ADD_BEFORE_MULT",
    conceptId: "order-of-operations",
    name: "Addition-first habit",
    description:
      "Performs the addition or subtraction step before the multiplication/division step, reversing correct precedence.",
  },
  {
    id: "ORDER_EXPONENT_LAST",
    conceptId: "order-of-operations",
    name: "Exponent applied last instead of early",
    description:
      "Treats an exponent as if it applies after addition/multiplication rather than before, per standard precedence.",
  },
  {
    id: "NEG_SUBTRACT_SIGN",
    conceptId: "negative-numbers",
    name: "Double-negative sign error",
    description:
      "Simplifies subtracting a negative (a - (-b)) as if it were a - b, dropping the sign flip.",
  },
  {
    id: "NEG_MULT_SIGN",
    conceptId: "negative-numbers",
    name: "Negative-times-negative sign error",
    description:
      "Believes a negative multiplied by a negative stays negative, instead of becoming positive.",
  },
  {
    id: "NEG_ADD_MAGNITUDE",
    conceptId: "negative-numbers",
    name: "Adds magnitudes with mismatched signs",
    description:
      "When adding a positive and a negative number, adds their magnitudes instead of finding the difference and applying the sign of the larger magnitude.",
  },
  {
    id: "DIST_NO_MULTIPLY_SECOND",
    conceptId: "distributing",
    name: "Only distributes to the first term",
    description:
      "In a(b + c), multiplies a by b but leaves c unmultiplied, e.g. treats a(b+c) as ab + c.",
  },
  {
    id: "DIST_SIGN_ERROR",
    conceptId: "distributing",
    name: "Drops the negative sign during distribution",
    description:
      "In -a(b - c) or a(b - c), fails to correctly propagate the negative sign onto the second term.",
  },
  {
    id: "DIST_ADD_INSTEAD_MULTIPLY",
    conceptId: "distributing",
    name: "Adds instead of multiplying",
    description:
      "In a(b + c), adds a to the sum (b+c) instead of multiplying a by each term.",
  },
  {
    id: "CLT_ADD_UNLIKE",
    conceptId: "combining-like-terms",
    name: "Combines unlike terms",
    description:
      "Adds coefficients of terms with different variables or powers as if they were like terms, e.g. treats 3x + 2y as 5xy or 5.",
  },
  {
    id: "CLT_EXPONENT_ADD",
    conceptId: "combining-like-terms",
    name: "Adds exponents when combining like terms",
    description:
      "When combining like terms such as x^2 + x^2, adds the exponents (as in multiplication rules) instead of adding the coefficients.",
  },
  {
    id: "CLT_DROP_VARIABLE",
    conceptId: "combining-like-terms",
    name: "Drops the variable while combining",
    description:
      "Combines the numeric coefficients correctly but drops the variable from the result.",
  },
  {
    id: "EQ_WRONG_OPERATION",
    conceptId: "linear-equations",
    name: "Uses the same operation instead of its inverse",
    description:
      "To isolate the variable, applies the same operation present in the equation instead of its inverse (e.g. adds b instead of subtracting it).",
  },
  {
    id: "EQ_ONE_SIDE_ONLY",
    conceptId: "linear-equations",
    name: "Operates on one side of the equation only",
    description:
      "Applies an inverse operation to only one side of the equation, breaking the equality.",
  },
  {
    id: "EQ_DIVIDE_PARTIAL",
    conceptId: "linear-equations",
    name: "Divides only part of the expression",
    description:
      "When isolating a variable with a coefficient after an addition/subtraction step, divides only the variable term's coefficient and forgets to divide the constant on the other side, or vice versa.",
  },
  // -------------------------------------------------------------------------
  // chemistry — the second subject (RESEARCH/IDEA_SELECTION.md "A second
  // subject: chemistry"). Same taxonomy shape as algebra: a curated,
  // well-documented set of wrong-reasoning patterns, each mapped to a
  // mechanically-computable distractor value.
  // -------------------------------------------------------------------------
  {
    id: "DIM_INVERTED_FACTOR",
    conceptId: "dimensional-analysis",
    name: "Inverts the conversion factor",
    description:
      "Divides by the conversion factor instead of multiplying (or vice versa), effectively using its reciprocal.",
  },
  {
    id: "DIM_CHAINED_DIRECTION",
    conceptId: "dimensional-analysis",
    name: "Wrong direction on a chained conversion",
    description:
      "When converting through an intermediate unit, multiplies by the first factor but divides by the second instead of also multiplying, reversing the second step's direction.",
  },
  {
    id: "DIM_WRONG_QUANTITY",
    conceptId: "dimensional-analysis",
    name: "Confuses the rate with the total",
    description:
      "Multiplies the total quantity by the per-unit rate instead of dividing by it, confusing which value is the rate and which is the total being converted.",
  },
  {
    id: "MOLE_RATIO_INVERTED",
    conceptId: "mole-ratios",
    name: "Inverts the stoichiometric ratio",
    description:
      "Uses the reciprocal of the balanced equation's mole ratio, e.g. multiplying by (given's coefficient / target's coefficient) instead of (target's coefficient / given's coefficient).",
  },
  {
    id: "MOLE_RATIO_IGNORED",
    conceptId: "mole-ratios",
    name: "Ignores the stoichiometric coefficients",
    description:
      "Treats the mole ratio between two substances as 1:1, carrying the given mole value straight across regardless of the balanced equation's actual coefficients.",
  },
  {
    id: "MOLE_RATIO_PARTIAL",
    conceptId: "mole-ratios",
    name: "Applies only one coefficient",
    description:
      "Divides by the target substance's coefficient but never multiplies by the given substance's coefficient, applying only half of the required ratio.",
  },
];

export function getMisconception(id: string): Misconception | undefined {
  return MISCONCEPTIONS.find((m) => m.id === id);
}

export function misconceptionsForConcept(conceptId: ConceptId): Misconception[] {
  return MISCONCEPTIONS.filter((m) => m.conceptId === conceptId);
}
