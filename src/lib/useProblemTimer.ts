"use client";

import { useEffect, useRef } from "react";

/**
 * Measures wall-clock time between a problem being shown and the learner
 * submitting an answer for it — one of the signals prompt.md's personalization
 * section calls out ("time spent") that nothing in this app tracked at all
 * before this. Client-measured (not server-timestamped) since the clock that
 * matters is "how long did the learner actually look at this," not request
 * latency; a ref rather than state on purpose, since re-rendering every
 * second to show a live timer isn't the point here (there's no visible
 * countdown), only reading the elapsed time once, at submit.
 */
export function useProblemTimer(problemId: string | null) {
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    shownAtRef.current = problemId ? Date.now() : null;
  }, [problemId]);

  function elapsedMs(): number | null {
    return shownAtRef.current === null ? null : Date.now() - shownAtRef.current;
  }

  return { elapsedMs };
}
