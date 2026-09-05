/**
 * A local, dependency-free TF-IDF + cosine-similarity text classifier — a
 * genuinely different technique from every other AI/ML piece in this app
 * (Gemini prompting, Bayesian Knowledge Tracing). Unlike those, this needs no
 * API call and no key, so it can serve as a real fallback for
 * classifyFreeformMisconception (src/lib/ai/gemini.ts), which otherwise has
 * none — "genuine reasoning over unstructured input has no deterministic
 * fallback" was true when written; this is a legitimate middle ground between
 * "skip entirely" and "guess": weaker than an LLM actually reading the
 * explanation, but a real information-retrieval technique, not a coin flip.
 *
 * Deliberately conservative in the same spirit as the AI classifier's own
 * system prompt ("do not force-fit a low-confidence match") — see
 * SIMILARITY_THRESHOLD below.
 */

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "of", "to", "in", "on", "at", "as", "by", "for", "with", "and", "or",
  "it", "its", "this", "that", "these", "those", "i", "you", "your",
  "so", "then", "than", "just", "not", "do", "does", "did", "but",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// .forEach() throughout this file, not for...of — Map/Set iteration via
// for...of requires downlevelIteration or an es2015+ target, neither of which
// this project's tsconfig sets (see next build's real type-check, stricter
// than Vitest's more lenient esbuild transform here).
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  tokens.forEach((t) => tf.set(t, (tf.get(t) ?? 0) + 1));
  // Normalize by document length so short/long texts are comparable.
  tf.forEach((v, k) => tf.set(k, v / tokens.length));
  return tf;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  a.forEach((weightA, term) => {
    const weightB = b.get(term);
    if (weightB) dot += weightA * weightB;
  });
  let magA = 0;
  a.forEach((v) => (magA += v * v));
  let magB = 0;
  b.forEach((v) => (magB += v * v));
  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

export interface SimilarityCandidate {
  id: string;
  description: string;
}

export interface SimilarityResult {
  misconceptionId: string | null;
  similarity: number;
}

// Empirically tuned, not guessed — see tests/textSimilarity.test.ts for the
// full data this is based on. An initial pass at 0.12 looked reasonable on
// straightforward paraphrases, but a harder stress test (misconceptions
// within the *same* concept, which share far more vocabulary with each other
// than with an unrelated concept) exposed real, confidently-WRONG
// cross-misconception matches as low as ~0.21-0.33 similarity — e.g. "I did
// the addition part before the multiplication part" (textbook
// ORDER_ADD_BEFORE_MULT) scored higher against ORDER_EXPONENT_LAST. That's a
// materially worse failure mode than returning no match at all — it's this
// app's own stated principle (see the AI classifier's system prompt: "a
// missed check is far better than falsely doubting a student") applied to
// this technique too.
//
// Raised again, from 0.35 to 0.38, when adding the chemistry misconceptions
// (RESEARCH/IDEA_SELECTION.md): IDF is computed from the WHOLE taxonomy
// corpus (see classifyByTextSimilarity's doc comment), so adding 6 new
// descriptions shifted term weights for every existing misconception too —
// "subtracting a negative number so I just dropped both negative signs"
// (textbook NEG_SUBTRACT_SIGN) scored 0.3329 against the wrong candidate
// (NEG_MULT_SIGN) even in the original 15-misconception corpus, already
// dangerously close under the old 0.35 threshold; the chemistry corpus
// addition nudged it to 0.3548, over the line. This wasn't a fluke of one
// change — it's the underlying fragility of a fixed threshold against a
// growing, shared corpus, so the fix is a threshold with real margin against
// BOTH the current worst-known false-positive (0.3548) and the weakest
// currently-required true positive (NEG_MULT_SIGN's own dedicated test case,
// 0.4085) — 0.38 sits roughly at the midpoint, ~0.025 of margin on each side.
// The tradeoff is unchanged: this only catches clear-cut, close-to-verbatim
// phrasing, not genuine paraphrase understanding — the honest ceiling of
// bag-of-words similarity on single-sentence text with one example per
// class, not a bug to fix later. Whoever adds an 8th subject should expect
// to re-run this same check, not assume today's margin is permanent.
const SIMILARITY_THRESHOLD = 0.38;

/**
 * Classifies student-written text against a small set of misconception
 * descriptions using TF-IDF weighted by the whole candidate set (so a word
 * common across all 15 misconceptions in the full taxonomy is downweighted
 * even though only a handful of candidates are compared here) plus the
 * cosine similarity to the closest match.
 */
export function classifyByTextSimilarity(
  studentText: string,
  candidates: SimilarityCandidate[],
  corpusDescriptions: string[]
): SimilarityResult {
  if (candidates.length === 0) return { misconceptionId: null, similarity: 0 };

  // IDF computed from the full taxonomy corpus, not just this concept's
  // candidates — a handful of candidates would make every term look equally
  // rare and defeat the point of weighting by informativeness.
  const corpusTokenSets = corpusDescriptions.map((d) => new Set(tokenize(d)));
  const docCount = corpusTokenSets.length;
  const idf = new Map<string, number>();
  corpusTokenSets.forEach((tokens) => {
    tokens.forEach((term) => idf.set(term, (idf.get(term) ?? 0) + 1));
  });
  idf.forEach((docFreq, term) => {
    idf.set(term, Math.log((docCount + 1) / (docFreq + 1)) + 1);
  });

  function tfidfVector(text: string): Map<string, number> {
    const tf = termFrequency(tokenize(text));
    const vec = new Map<string, number>();
    tf.forEach((freq, term) => {
      vec.set(term, freq * (idf.get(term) ?? Math.log(docCount + 1) + 1));
    });
    return vec;
  }

  const studentVec = tfidfVector(studentText);

  let best: SimilarityResult = { misconceptionId: null, similarity: 0 };
  for (const candidate of candidates) {
    const candidateVec = tfidfVector(candidate.description);
    const similarity = cosineSimilarity(studentVec, candidateVec);
    if (similarity > best.similarity) {
      best = { misconceptionId: candidate.id, similarity };
    }
  }

  if (best.similarity < SIMILARITY_THRESHOLD) {
    return { misconceptionId: null, similarity: best.similarity };
  }
  return best;
}
