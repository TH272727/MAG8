"use client";

import type { CellState } from "@/lib/hooks/useRunStream";
import type { PublicLens } from "@/lib/public-lens";
import type { Verdict } from "@/lib/schemas";

const LENS_TEXT: Record<PublicLens, string> = {
  fundamentals: "text-fundamentals",
  macro: "text-macro",
  consensus: "text-consensus",
};
const LENS_DOT: Record<PublicLens, string> = {
  fundamentals: "var(--color-fundamentals)",
  macro: "var(--color-macro)",
  consensus: "var(--color-consensus)",
};
const GLYPH: Record<Verdict, string> = { bullish: "▲", neutral: "─", bearish: "▼" };

const CONF_PIPS: Record<string, number> = { low: 1, medium: 2, high: 3 };

/** Micro-indicator: three 4px pips, filled count = the lens's own confidence. */
function ConfidencePips({ lens, confidence }: { lens: PublicLens; confidence: string }) {
  const filled = CONF_PIPS[confidence] ?? 0;
  if (filled === 0) return null;
  return (
    <span
      className="flex shrink-0 items-center gap-[3px]"
      role="img"
      aria-label={`confidence ${confidence}`}
      title={`confidence ${confidence}`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-1 rounded-full"
          style={{ background: i < filled ? LENS_DOT[lens] : "var(--color-hairline2)" }}
        />
      ))}
    </span>
  );
}

export default function MatrixCell({
  lens,
  cell,
  expanded,
  onToggle,
  label,
}: {
  lens: PublicLens;
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
          <span className="live-dot shrink-0" style={{ background: LENS_DOT[lens] }} aria-hidden="true" />
          <span className={`truncate ${LENS_TEXT[lens]}`}>
            {cell?.activity?.length ? cell.activity[cell.activity.length - 1] : "running…"}
          </span>
        </>
      )}

      {status === "done" && (
        <>
          <span className={`shrink-0 ${LENS_TEXT[lens]}`} aria-hidden="true">
            {cell?.verdict ? GLYPH[cell.verdict] : "✓"}
          </span>
          <span className="truncate text-ink/90">{cell?.headline ?? cell?.verdict ?? "done"}</span>
          <span className="ml-auto flex shrink-0 items-center gap-2">
            {cell?.confidence && <ConfidencePips lens={lens} confidence={cell.confidence} />}
            {cell?.cached && <span className="rounded-full border border-hairline px-1.5 py-0.5 text-[10px] text-dim">cached</span>}
          </span>
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
