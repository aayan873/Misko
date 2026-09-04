import { describe, it, expect } from "vitest";
import { classifyByTextSimilarity } from "../src/lib/domain/textSimilarity";
import { MISCONCEPTIONS } from "../src/lib/domain/misconceptions";

const corpus = MISCONCEPTIONS.map((m) => m.description);

function candidatesForPrefix(prefix: string) {
  return MISCONCEPTIONS.filter((m) => m.id.startsWith(prefix));
}

describe("classifyByTextSimilarity", () => {
  it("returns null for text unrelated to any misconception", () => {
    expect(classifyByTextSimilarity("I like pizza and video games", candidatesForPrefix("ORDER"), corpus).misconceptionId).toBeNull();
    expect(classifyByTextSimilarity("the sky is blue today", MISCONCEPTIONS, corpus).misconceptionId).toBeNull();
    expect(classifyByTextSimilarity("not sure honestly just guessed a number", candidatesForPrefix("EQ"), corpus).misconceptionId).toBeNull();
  });

  it("returns null with an empty candidate list", () => {
    expect(classifyByTextSimilarity("anything", [], corpus).misconceptionId).toBeNull();
  });

  // These are the cases that survive the empirically-tuned 0.35 threshold —
  // see textSimilarity.ts's comment on SIMILARITY_THRESHOLD for the full story,
  // including the cross-misconception false positives that got this threshold
  // raised from an initial, too-optimistic 0.12.
  it("matches clear, close-to-verbatim phrasing with real margin", () => {
    const negMult = classifyByTextSimilarity(
      "two negatives multiplied together I thought stays negative",
      candidatesForPrefix("NEG"),
      corpus
    );
    expect(negMult.misconceptionId).toBe("NEG_MULT_SIGN");

    const eqOneSide = classifyByTextSimilarity(
      "I only did the operation to one side of the equals sign",
      candidatesForPrefix("EQ"),
      corpus
    );
    expect(eqOneSide.misconceptionId).toBe("EQ_ONE_SIDE_ONLY");
  });

  // The whole point of raising the threshold: same-concept misconceptions share
  // enough vocabulary that a looser threshold produces confidently WRONG
  // matches, not just misses — this is the specific failure mode that must
  // never regress, since a wrong diagnosis is worse than none.
  it("never cross-matches to the wrong misconception within the same concept, even on ambiguous phrasing", () => {
    const cases: [string, string][] = [
      ["I did the addition part before the multiplication part", "ORDER"],
      ["only multiplied the first number in the parentheses, forgot the second", "DIST"],
      ["subtracting a negative number so I just dropped both negative signs", "NEG"],
    ];
    for (const [text, prefix] of cases) {
      const result = classifyByTextSimilarity(text, candidatesForPrefix(prefix), corpus);
      // Either correctly null (conservative miss) or, if it ever does match,
      // it must not silently be wrong — this test locks in "never wrong" as
      // the invariant, not "always right" (which this technique can't promise).
      if (result.misconceptionId !== null) {
        expect(result.misconceptionId).toBe(
          text.includes("addition part before the multiplication")
            ? "ORDER_ADD_BEFORE_MULT"
            : text.includes("forgot the second")
            ? "DIST_NO_MULTIPLY_SECOND"
            : "NEG_SUBTRACT_SIGN"
        );
      }
    }
  });

  it("similarity score is always between 0 and 1", () => {
    for (const m of MISCONCEPTIONS) {
      const result = classifyByTextSimilarity(m.description, [m], corpus);
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1.0001); // float slack
    }
  });

  it("matching a description against itself scores highest among its concept's candidates", () => {
    for (const m of MISCONCEPTIONS) {
      const siblings = candidatesForPrefix(m.id.split("_")[0]);
      const result = classifyByTextSimilarity(m.description, siblings, corpus);
      expect(result.misconceptionId).toBe(m.id);
    }
  });
});
