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
];

export function getMisconception(id: string): Misconception | undefined {
  return MISCONCEPTIONS.find((m) => m.id === id);
}

export function misconceptionsForConcept(conceptId: ConceptId): Misconception[] {
  return MISCONCEPTIONS.filter((m) => m.conceptId === conceptId);
}
