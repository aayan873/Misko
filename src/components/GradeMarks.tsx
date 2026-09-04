"use client";

/** Standard status icon — check-in-circle or x-in-circle, the ordinary pattern for "here's the outcome of an action." */
export function StatusIcon({ kind }: { kind: "success" | "danger" }) {
  return (
    <span className={`status-icon ${kind}`}>
      {kind === "success" ? (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8.5 L6.5 12 L13 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4 L12 12 M12 4 L4 12" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
    </span>
  );
}
