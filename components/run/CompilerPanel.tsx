"use client";

import Link from "next/link";
import ActivityFeed from "./ActivityFeed";
import type { CompiledReport } from "@/lib/schemas";

export default function CompilerPanel({
  active,
  lines,
  report,
}: {
  active: boolean;
  lines: string[];
  report: CompiledReport | null;
}) {
  const podium = report?.rankings.slice(0, 3) ?? [];

  return (
    <div className={`panel p-5 ${report ? "border-confluence/40" : ""}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold">Compiler</h3>
        {active && !report && (
          <span className="chip">
            <span className="live-dot" aria-hidden="true" />
            SCORING
          </span>
        )}
        {report && <span className="chip border-confluence/50 bg-confluence/10 text-confluence">VERDICT IN</span>}
      </div>

      {!report && (
        <div className="mt-3">
          <ActivityFeed lines={lines} emptyText="Waiting for the analysis matrix to finish…" />
        </div>
      )}

      {report && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
            {podium.map((s) => (
              <Link key={s.ticker} href={`/stocks/${s.ticker}`} className="group bg-panel p-4 transition-colors hover:bg-panel2">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-dim">#{s.rank}</span>
                  <span className="tabular font-mono text-lg font-bold text-confluence">{s.finalScore.toFixed(1)}</span>
                </div>
                <div className="mt-1 font-mono text-xl font-bold tracking-wide group-hover:text-ink">{s.ticker}</div>
                <p className="mt-1 line-clamp-2 text-[12px] text-muted">{s.verdictLine}</p>
              </Link>
            ))}
          </div>

          {report.gapsNoted.length > 0 && (
            <div className="mt-3">
              <p className="eyebrow text-macro">Gaps noted</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 font-mono text-[11px] text-muted">
                {report.gapsNoted.slice(0, 6).map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
                {report.gapsNoted.length > 6 && <li>+{report.gapsNoted.length - 6} more on the rankings page</li>}
              </ul>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/rankings" className="btn btn-primary">
              Full leaderboard
            </Link>
            <Link href="/methodology" className="btn">
              How these scores work
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
