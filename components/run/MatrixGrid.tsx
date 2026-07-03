"use client";

import Link from "next/link";
import ActivityFeed from "./ActivityFeed";
import MatrixCell from "./MatrixCell";
import type { CellState } from "@/lib/hooks/useRunStream";
import { LENS_META, LENS_SKILLS, cellKey, type DiscoveryCandidate, type LensSkill } from "@/lib/schemas";

const HEAD_TEXT: Record<LensSkill, string> = {
  "stock-scanner": "text-fundamentals",
  "gt-predictor": "text-macro",
  "institutional-forecast": "text-consensus",
};

export default function MatrixGrid({
  candidates,
  cells,
  expandedKey,
  onToggle,
  terminal,
}: {
  candidates: DiscoveryCandidate[];
  cells: Record<string, CellState>;
  expandedKey: string | null;
  onToggle: (key: string) => void;
  terminal: boolean;
}) {
  const expandedCell = expandedKey ? cells[expandedKey] : undefined;
  const [expandedTicker, expandedSkill] = (expandedKey?.split(":") ?? [null, null]) as [string | null, LensSkill | null];

  return (
    <div className="overflow-x-auto rounded-md border border-hairline">
      <div className="min-w-[720px]">
        {/* header */}
        <div className="grid grid-cols-[92px_repeat(3,minmax(0,1fr))] border-b border-hairline bg-panel2">
          <div className="eyebrow sticky left-0 z-10 border-r border-hairline bg-panel2 px-3 py-2.5">Ticker</div>
          {LENS_SKILLS.map((s) => (
            <div key={s} className={`eyebrow px-3 py-2.5 ${HEAD_TEXT[s]}`}>
              {LENS_META[s].label}
            </div>
          ))}
        </div>

        {/* rows */}
        {candidates.map((c) => {
          const rowExpanded = expandedTicker === c.ticker && expandedSkill !== null;
          return (
            <div key={c.ticker}>
              <div className="grid grid-cols-[92px_repeat(3,minmax(0,1fr))]">
                <div className="sticky left-0 z-10 flex items-center border-b border-r border-hairline bg-panel px-3 py-2 font-mono text-sm font-bold tracking-wide">
                  {c.ticker}
                </div>
                {LENS_SKILLS.map((s) => {
                  const key = cellKey(c.ticker, s);
                  return (
                    <MatrixCell
                      key={key}
                      skill={s}
                      cell={cells[key]}
                      expanded={expandedKey === key}
                      onToggle={() => onToggle(key)}
                      label={`${c.ticker} × ${LENS_META[s].label}`}
                    />
                  );
                })}
              </div>

              {rowExpanded && expandedSkill && (
                <div className="border-b border-hairline bg-void/60 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className={`eyebrow ${HEAD_TEXT[expandedSkill]}`}>
                      {c.ticker} × {LENS_META[expandedSkill].label}
                      {expandedCell?.cached ? " · cached" : ""}
                    </p>
                    {terminal && expandedCell?.status === "done" && (
                      <Link
                        href={`/stocks/${c.ticker}`}
                        className="font-mono text-[11px] text-muted underline underline-offset-2 hover:text-ink"
                      >
                        open dossier →
                      </Link>
                    )}
                  </div>
                  <div className="mt-2">
                    {expandedCell?.status === "error" ? (
                      <p className="font-mono text-[12px] text-danger/90">{expandedCell.error ?? "This cell errored."}</p>
                    ) : expandedCell?.activity.length ? (
                      <ActivityFeed lines={expandedCell.activity} maxHeightClass="max-h-36" />
                    ) : expandedCell?.status === "done" ? (
                      <p className="font-mono text-[12px] text-muted">
                        {expandedCell.verdict ?? ""} {expandedCell.headline ?? ""} — activity log not retained after the run
                        {expandedCell.cached ? " (cache hit, no live activity)" : ""}.
                      </p>
                    ) : (
                      <p className="font-mono text-[12px] text-dim">Queued — waiting for a concurrency slot.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
