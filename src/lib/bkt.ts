/**
 * Bayesian Knowledge Tracing — replaces a naive "N correct in a row" mastery gate
 * with a real probabilistic estimate of P(learner knows this concept), updated after
 * every attempt via Bayes' rule. Standard technique from Corbett & Anderson (1994);
 * parameters below are fixed literature-typical defaults, not fit to data (there
 * isn't any real usage data yet — see ARCHITECTURE.md "Future work").
 */

export interface BKTParams {
  /** P(L0) — prior probability the learner already knows the concept before any attempt. */
  pInit: number;
  /** P(T) — probability of moving from "doesn't know" to "knows" after one attempt. */
  pTransit: number;
  /** P(G) — probability of a correct answer despite not knowing the concept. */
  pGuess: number;
  /** P(S) — probability of a wrong answer despite knowing the concept. */
  pSlip: number;
}

export const DEFAULT_BKT_PARAMS: BKTParams = {
  pInit: 0.3,
  pTransit: 0.1,
  pGuess: 0.2,
  pSlip: 0.1,
};

/** P(knows) at or above this counts as mastered. */
export const BKT_MASTERY_THRESHOLD = 0.95;

export function initialMastery(params: BKTParams = DEFAULT_BKT_PARAMS): number {
  return params.pInit;
}

/**
 * One BKT step: given P(knows) going into this attempt and whether it was answered
 * correctly, returns P(knows) after the Bayesian evidence update and the learning
 * transition. A single wrong answer lowers the estimate but doesn't zero it out the
 * way a streak counter would — that's the actual improvement over the old gate.
 */
export function updateMastery(
  pKnown: number,
  correct: boolean,
  params: BKTParams = DEFAULT_BKT_PARAMS
): number {
  const { pTransit, pGuess, pSlip } = params;
  const clamped = Math.max(0, Math.min(1, pKnown));

  const pEvidence = correct
    ? (clamped * (1 - pSlip)) / (clamped * (1 - pSlip) + (1 - clamped) * pGuess)
    : (clamped * pSlip) / (clamped * pSlip + (1 - clamped) * (1 - pGuess));

  return pEvidence + (1 - pEvidence) * pTransit;
}
