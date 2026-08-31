/* ============================================================================
 * A pivot score, and the side it favours, as one unit.
 *
 * Never render the number without this. The score is magnitude-only — trend,
 * stretch and momentum are all absolute values — so on its own it reads as a
 * recommendation when it is nothing of the kind: the highest score on the board
 * can be a strong move AGAINST the asset it is filed under.
 *
 * A plain server component with no state, so it can be dropped into the table,
 * the cards, the sector board and the indicator page and they cannot drift.
 * ========================================================================== */

export interface ScoreDirectionProps {
  scoreLabel: string;
  /** Emphasis by tier — monochrome, so colour is free to carry direction. */
  tierAccent: string;
  glyph: string;
  ticker: string | null;
  /** Spoken form, e.g. "favours SPY". */
  directionLabel: string;
  dirAccent: string;
  size?: "sm" | "md" | "lg";
}

const SIZES = {
  sm: { score: "text-[15px]", mark: "text-[11px]" },
  md: { score: "text-lg", mark: "text-[12px]" },
  lg: { score: "text-2xl", mark: "text-[13px]" },
} as const;

export default function ScoreWithDirection({
  scoreLabel,
  tierAccent,
  glyph,
  ticker,
  directionLabel,
  dirAccent,
  size = "sm",
}: ScoreDirectionProps) {
  const s = SIZES[size];
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={`tabular font-mono font-bold ${s.score} ${tierAccent}`}>{scoreLabel}</span>
      <span className={`font-mono ${s.mark} ${dirAccent}`} title={directionLabel}>
        <span aria-hidden="true">{glyph}</span>
        {ticker && <span className="ml-0.5">{ticker}</span>}
        <span className="sr-only"> {directionLabel}</span>
      </span>
    </span>
  );
}
