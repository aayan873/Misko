export type Subject = "algebra" | "chemistry";

export type ConceptId =
  | "order-of-operations"
  | "negative-numbers"
  | "distributing"
  | "combining-like-terms"
  | "linear-equations"
  | "dimensional-analysis"
  | "mole-ratios";

export interface Concept {
  id: ConceptId;
  subject: Subject;
  name: string;
  description: string;
  /** Concepts that should be mastered before this one is introduced. Always
   *  within the same subject — subjects are independent frontiers on purpose
   *  (see RESEARCH/IDEA_SELECTION.md "A second subject: chemistry"), not a
   *  single chain a learner must finish algebra to even start chemistry. */
  prerequisites: ConceptId[];
}

/**
 * Ordered so that index position roughly follows a teachable sequence within
 * each subject; `prerequisites` is what the mastery gate actually enforces.
 * Two subjects exist to prove the concept/misconception/problem-generator
 * pattern below is a genuine architecture, not something specific to algebra
 * — see RESEARCH/IDEA_SELECTION.md. Adding chemistry required zero changes to
 * analyzer.ts, bkt.ts, or the Gemini layer; it did require making the
 * concept-selection functions in learnerModel.ts subject-aware (frontierConcept,
 * dueForReview, weakestReviewableConcept, decideNextProblem, and the
 * pending-confirmation/active-misconception lookups) rather than implicitly
 * assuming "every concept the learner has ever touched" was one undifferentiated
 * pool — a real, documented refactor, not a false "it just worked" claim.
 */
export const CONCEPTS: Concept[] = [
  {
    id: "order-of-operations",
    subject: "algebra",
    name: "Order of Operations",
    description: "Evaluating expressions with +, -, *, / and exponents in the correct precedence.",
    prerequisites: [],
  },
  {
    id: "negative-numbers",
    subject: "algebra",
    name: "Negative Number Operations",
    description: "Adding, subtracting, and multiplying with negative numbers.",
    prerequisites: ["order-of-operations"],
  },
  {
    id: "distributing",
    subject: "algebra",
    name: "The Distributive Property",
    description: "Expanding a(b + c) correctly, including sign handling.",
    prerequisites: ["negative-numbers"],
  },
  {
    id: "combining-like-terms",
    subject: "algebra",
    name: "Combining Like Terms",
    description: "Simplifying expressions by combining terms with matching variables/powers.",
    prerequisites: ["distributing"],
  },
  {
    id: "linear-equations",
    subject: "algebra",
    name: "Solving Linear Equations",
    description: "Isolating the variable in equations like ax + b = c using inverse operations.",
    prerequisites: ["combining-like-terms"],
  },
  {
    id: "dimensional-analysis",
    subject: "chemistry",
    name: "Dimensional Analysis",
    description: "Converting between units using a known conversion factor, including chained conversions.",
    prerequisites: [],
  },
  {
    id: "mole-ratios",
    subject: "chemistry",
    name: "Mole Ratios (Stoichiometry)",
    description: "Using a balanced equation's coefficients to convert moles of one substance to another.",
    prerequisites: ["dimensional-analysis"],
  },
];

export const SUBJECTS: { id: Subject; name: string }[] = [
  { id: "algebra", name: "Algebra I" },
  { id: "chemistry", name: "Chemistry" },
];

export function getConcept(id: ConceptId): Concept {
  const c = CONCEPTS.find((c) => c.id === id);
  if (!c) throw new Error(`Unknown concept: ${id}`);
  return c;
}

export function conceptsForSubject(subject: Subject): Concept[] {
  return CONCEPTS.filter((c) => c.subject === subject);
}
