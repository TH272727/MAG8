"use client";

import type { CellState } from "@/lib/hooks/useRunStream";
import type { LensSkill, Verdict } from "@/lib/schemas";

const LENS_TEXT: Record<LensSkill, string> = {
  "stock-scanner": "text-fundamentals",
  "gt-predictor": "text-macro",
  "institutional-forecast": "text-consensus",
};
const LENS_DOT: Record<LensSkill, string> = {
  "stock-scanner": "var(--color-fundamentals)",
  "gt-predictor": "var(--color-macro)",
  "institutional-forecast": "var(--color-consensus)",
};
const GLYPH: Record<Verdict, string> = { bullish: "▲", neutral: "─", bearish: "▼" };

export default function MatrixCell({
  skill,
  cell,
  expanded,
  onToggle,
  label,
}: {
  skill: LensSkill;
  cell: CellState | undefined;
  expanded: boolean;
  onToggle: () => void;
  label: string;
}) {
  const status = cell?.status ?? "queued";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`${label}: ${status}${cell?.cached ? ", cached" : ""}. Toggle details.`}
      className={`flex min-h-12 w-full items-center gap-2 border-b border-hairline px-3 py-2 text-left font-mono text-[12px] transition-colors hover:bg-panel2 ${expanded ? "bg-panel2" : "bg-panel"}`}
    >
      {status === "queued" && <span className="text-dim">· queued</span>}

      {status === "running" && (
        <>
          <span className="live-dot shrink-0" style={{ background: LENS_DOT[skill] }} aria-hidden="true" />
          <span className={`truncate ${LENS_TEXT[skill]}`}>
            {cell?.activity?.length ? cell.activity[cell.activity.length - 1] : "running…"}
          </span>
        </>
      )}

      {status === "done" && (
        <>
          <span className={`shrink-0 ${LENS_TEXT[skill]}`} aria-hidden="true">
            {cell?.verdict ? GLYPH[cell.verdict] : "✓"}
          </span>
          <span className="truncate text-ink/90">{cell?.headline ?? cell?.verdict ?? "done"}</span>
          {cell?.cached && <span className="ml-auto shrink-0 rounded-full border border-hairline px-1.5 py-0.5 text-[10px] text-dim">cached</span>}
        </>
      )}

      {status === "error" && (
        <>
          <span className="shrink-0 text-danger" aria-hidden="true">
            ✕
          </span>
          <span className="truncate text-danger/80">error — tap for detail</span>
        </>
      )}
    </button>
  );
}
