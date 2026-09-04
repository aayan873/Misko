export type ConceptId =
  | "order-of-operations"
  | "negative-numbers"
  | "distributing"
  | "combining-like-terms"
  | "linear-equations";

export interface Concept {
  id: ConceptId;
  name: string;
  description: string;
  /** Concepts that should be mastered before this one is introduced. */
  prerequisites: ConceptId[];
}

/**
 * Ordered so that index position roughly follows a teachable sequence;
 * `prerequisites` is what the mastery gate actually enforces.
 */
export const CONCEPTS: Concept[] = [
  {
    id: "order-of-operations",
    name: "Order of Operations",
    description: "Evaluating expressions with +, -, *, / and exponents in the correct precedence.",
    prerequisites: [],
  },
  {
    id: "negative-numbers",
    name: "Negative Number Operations",
    description: "Adding, subtracting, and multiplying with negative numbers.",
    prerequisites: ["order-of-operations"],
  },
  {
    id: "distributing",
    name: "The Distributive Property",
    description: "Expanding a(b + c) correctly, including sign handling.",
    prerequisites: ["negative-numbers"],
  },
  {
    id: "combining-like-terms",
    name: "Combining Like Terms",
    description: "Simplifying expressions by combining terms with matching variables/powers.",
    prerequisites: ["distributing"],
  },
  {
    id: "linear-equations",
    name: "Solving Linear Equations",
    description: "Isolating the variable in equations like ax + b = c using inverse operations.",
    prerequisites: ["combining-like-terms"],
  },
];

export function getConcept(id: ConceptId): Concept {
  const c = CONCEPTS.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown concept: ${id}`);
  return c;
}
