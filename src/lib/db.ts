import { store, LearnerRow } from "./store";

export type { LearnerRow };

export function ensureLearner(id: string, displayName: string): LearnerRow {
  const existing = store.raw.learners.find((l) => l.id === id);
  if (existing) return existing;
  const row: LearnerRow = { id, display_name: displayName, created_at: Date.now() };
  store.raw.learners.push(row);
  store.save();
  return row;
}
