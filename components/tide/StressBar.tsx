/* ============================================================================
 * A stress score as a bar.
 *
 * Filled from the left, so a longer bar always means a worse reading whichever
 * gauge it belongs to. That is the whole reason the score is oriented in the
 * first place: a good reading and a bad one are the same arithmetic pointed two
 * ways, and the bar has to make that visible without a legend.
 *
 * No gold anywhere. That colour marks the leaderboard's final verdict about a
 * company, and nothing on this desk is a verdict about anything.
 * ========================================================================== */

export default function StressBar({ stress }: { stress: number | null }) {
  if (stress === null) {
    return (
      <div className="mt-3 h-2 w-full rounded-full border border-hairline" aria-hidden>
        <div className="h-full w-0" />
      </div>
    );
  }
  const colour =
    stress >= 66
      ? "var(--color-macro)"
      : stress >= 40
        ? "var(--color-dim)"
        : "var(--color-consensus)";
  return (
    <div
      className="mt-3 h-2 w-full overflow-hidden rounded-full border border-hairline"
      role="img"
      aria-label={`${stress.toFixed(1)} out of 100, where 100 is the worst reading`}
    >
      <div
        className="h-full transition-[width]"
        style={{ width: `${Math.max(0, Math.min(100, stress))}%`, backgroundColor: colour }}
      />
    </div>
  );
}
