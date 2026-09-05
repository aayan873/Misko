"use client";

import { useEffect, useState } from "react";
import { Subject } from "./domain/concepts";

const STORAGE_KEY = "misko_subject";
const DEFAULT_SUBJECT: Subject = "algebra";

/**
 * Which subject's practice session is currently active — persisted per browser
 * so switching subjects and coming back later resumes where you left off,
 * same localStorage-backed pattern as useLearnerId.ts. Unlike the learner id,
 * this is meant to change: the subject switcher (see /practice) calls the
 * returned setter directly.
 */
export function useSubject(): [Subject, (s: Subject) => void] {
  const [subject, setSubjectState] = useState<Subject>(DEFAULT_SUBJECT);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "algebra" || stored === "chemistry") setSubjectState(stored);
    } catch {
      // localStorage unavailable — stay on the in-memory default.
    }
  }, []);

  function setSubject(s: Subject) {
    setSubjectState(s);
    try {
      window.localStorage.setItem(STORAGE_KEY, s);
    } catch {
      // Non-fatal — the choice just won't persist across reloads this time.
    }
  }

  return [subject, setSubject];
}
