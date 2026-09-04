"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "misko_learner_id";

/**
 * A per-browser anonymous learner id, generated client-side and stored in
 * localStorage. No account/PII is collected (prompt.md §19) — this is enough to
 * maintain a persistent learner model across visits from the same browser.
 */
export function useLearnerId(): string | null {
  const [id, setId] = useState<string | null>(null);

  useEffect(() => {
    try {
      let existing = window.localStorage.getItem(STORAGE_KEY);
      if (!existing) {
        existing = crypto.randomUUID();
        window.localStorage.setItem(STORAGE_KEY, existing);
      }
      setId(existing);
      fetch("/api/learner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learnerId: existing }),
      }).catch(() => {
        // If this fails, subsequent API calls will still work; the learner row
        // is created lazily where needed. Non-fatal.
      });
    } catch {
      // localStorage unavailable (e.g. private mode edge cases) — fall back to
      // an in-memory id for this session only.
      setId(crypto.randomUUID());
    }
  }, []);

  return id;
}
