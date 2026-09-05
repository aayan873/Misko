/**
 * One-time (well, re-run-when-the-taxonomy-changes) precompute script for
 * prompt_v2.md's A3: a genuinely different ML technique from every other
 * AI/ML piece in this app (LLM prompting, Bayesian Knowledge Tracing) —
 * embeddings + a 2D similarity layout, rendered on /dashboard so a learner's
 * actual mistakes visibly cluster by conceptual similarity, even across
 * different concepts and subjects.
 *
 * Deliberately NOT a live per-request call (prompt_v2.md is explicit that
 * this "doesn't need to run live per-request") — the misconception taxonomy
 * is static, so its embeddings and their 2D layout are static too. Run this
 * script once (or again, whenever misconceptions.ts changes) with a real
 * GEMINI_API_KEY, and commit the resulting JSON. /dashboard just reads that
 * file at build/render time — no API key, quota, or network call needed for
 * any learner viewing the map, including on the live Vercel demo.
 *
 * Usage: npm run generate-embeddings  (needs GEMINI_API_KEY in .env)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { MISCONCEPTIONS } from "../src/lib/domain/misconceptions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, "../src/lib/domain/misconceptionMap.json");
const EMBEDDING_MODEL = "gemini-embedding-001";

// Minimal .env loader — this script runs standalone via tsx, not through
// Next.js's own env loading, and Node 18 (this project's baseline, see
// ARCHITECTURE.md) has no built-in --env-file flag (that's Node 20+).
function loadDotEnv() {
  const envPath = path.join(__dirname, "../.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    magA = 0,
    magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Deterministic PRNG (mulberry32) so re-running this script without changing
// any embeddings reproduces the exact same layout, not a new random one —
// the point positions shouldn't visibly jump around every time this reruns.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Simple stress-majorization-style 2D layout: iteratively nudges each point
 * so its actual 2D distance to every other point approaches a target
 * distance derived from embedding similarity (similar misconceptions get a
 * small target distance, dissimilar ones a large one). Hand-rolled per
 * prompt_v2.md ("no need for a heavy graph library") — this is the same
 * family of technique as classical/metric MDS, just as a direct gradient
 * loop instead of an eigendecomposition, which is simpler to reason about
 * and plenty accurate for ~20 points.
 */
function layout2D(similarity: number[][]): { x: number; y: number }[] {
  const n = similarity.length;
  const rand = mulberry32(42);
  const positions = Array.from({ length: n }, () => ({
    x: (rand() - 0.5) * 2,
    y: (rand() - 0.5) * 2,
  }));

  // Target distance: identical (similarity 1) -> 0; maximally dissimilar
  // (similarity -1, though cosine sim on real text embeddings rarely goes
  // negative) -> 2. A gentle nonlinearity (squaring) pulls close matches
  // notably closer without collapsing everything to the center.
  const target = similarity.map((row) => row.map((s) => Math.pow(Math.max(0, 1 - s), 1.5)));

  const ITERATIONS = 600;
  const LEARNING_RATE = 0.02;
  for (let iter = 0; iter < ITERATIONS; iter++) {
    const forces = positions.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const dx = positions[j].x - positions[i].x;
        const dy = positions[j].y - positions[i].y;
        const dist = Math.max(0.01, Math.sqrt(dx * dx + dy * dy));
        const diff = dist - target[i][j];
        // Move i toward j if too far apart, away if too close.
        forces[i].x += (diff / dist) * dx * LEARNING_RATE;
        forces[i].y += (diff / dist) * dy * LEARNING_RATE;
      }
    }
    for (let i = 0; i < n; i++) {
      positions[i].x += forces[i].x;
      positions[i].y += forces[i].y;
    }
  }

  // Normalize to a [-1, 1] box, centered, so the renderer doesn't need to
  // know anything about the raw coordinate scale this loop happened to settle on.
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = Math.max(1e-6, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2;
  return positions.map((p) => ({
    x: (p.x - cx) / scale,
    y: (p.y - cy) / scale,
  }));
}

async function main() {
  loadDotEnv();
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY not set (checked process.env and .env) — cannot generate real embeddings.");
    process.exit(1);
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  console.log(`Embedding ${MISCONCEPTIONS.length} misconceptions with ${EMBEDDING_MODEL}...`);
  const embeddings: number[][] = [];
  for (const m of MISCONCEPTIONS) {
    const result = await model.embedContent(m.description);
    embeddings.push(result.embedding.values);
    process.stdout.write(".");
  }
  console.log("\nDone embedding. Computing pairwise similarity + 2D layout...");

  const n = MISCONCEPTIONS.length;
  const similarity: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      similarity[i][j] = i === j ? 1 : cosineSimilarity(embeddings[i], embeddings[j]);
    }
  }

  const positions = layout2D(similarity);

  const output = MISCONCEPTIONS.map((m, i) => ({
    id: m.id,
    conceptId: m.conceptId,
    x: Math.round(positions[i].x * 1000) / 1000,
    y: Math.round(positions[i].y * 1000) / 1000,
  }));

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${output.length} positions to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("Failed to generate embeddings:", err);
  process.exit(1);
});
