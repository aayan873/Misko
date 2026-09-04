"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "misko_session_start";

/**
 * "This session" means "since this tab opened" — sessionStorage, not
 * localStorage, so it resets naturally on a fresh tab/window rather than
 * needing any explicit "end session" action from the learner. No backend
 * concept of a session exists; this timestamp is just passed to
 * /api/session-summary to window already-existing data after the fact.
 */
export function useSessionStart(): number | null {
  const [start, setStart] = useState<number | null>(null);

  useEffect(() => {
    try {
      const existing = window.sessionStorage.getItem(STORAGE_KEY);
      if (existing) {
        setStart(Number(existing));
      } else {
        const now = Date.now();
        window.sessionStorage.setItem(STORAGE_KEY, String(now));
        setStart(now);
      }
    } catch {
      // sessionStorage unavailable — fall back to "this page load only".
      setStart(Date.now());
    }
  }, []);

  return start;
}
