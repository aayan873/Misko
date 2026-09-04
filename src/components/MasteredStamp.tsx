interface MasteredStampProps {
  conceptName: string;
}

/**
 * The payoff moment: shown once, the instant a concept's BKT mastery probability
 * crosses the threshold (see practice/page.tsx's justMastered check). Reuses the
 * same rotated grading-stamp look as a mastered node in ConceptPath, just bigger
 * and animated in — the mastery gate's whole point made into one visible beat.
 */
export default function MasteredStamp({ conceptName }: MasteredStampProps) {
  return (
    <div className="mb-5 flex justify-center">
      <div
        className="animate-[stampDown_0.5s_cubic-bezier(0.34,1.56,0.64,1)] border-4 border-success px-5 py-2.5 text-center"
        style={{ transform: "rotate(-4deg)" }}
      >
        <p className="font-display text-[15px] font-bold uppercase tracking-wider text-success">
          Mastered
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-success">{conceptName}</p>
      </div>
    </div>
  );
}
