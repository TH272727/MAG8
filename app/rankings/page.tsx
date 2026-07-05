import type { Metadata } from "next";
import Link from "next/link";
import Leaderboard from "@/components/rankings/Leaderboard";
import type { LensMap } from "@/components/rankings/RankRow";
import { getLensRowsForRun, latestCompleteRun } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { LENS_TO_PUBLIC, toPublicReport } from "@/lib/public-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rankings",
  description: "The current Trillion-Dollar Confluence leaderboard.",
};

export default function RankingsPage() {
  const run = latestCompleteRun();
  // Public-view boundary: reports can be legacy rows with internal phrasing.
  const report = run?.report ? toPublicReport(run.report) : null;

  if (!run || !report || report.rankings.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <p className="eyebrow">Rankings</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">No leaderboard yet.</h1>
        <p className="mt-3 max-w-lg text-muted">
          The board fills when the first pipeline run completes. Trigger one from the admin desk, or
          read how scoring works while you wait.
        </p>
        <div className="mt-6 flex gap-3">
          <Link href="/admin" className="btn btn-primary">
            Open the admin desk
          </Link>
          <Link href="/methodology" className="btn">
            Methodology
          </Link>
        </div>
      </main>
    );
  }

  const lensMap: LensMap = {};
  for (const row of getLensRowsForRun(run.id)) {
    const entry = (lensMap[row.ticker] ??= {});
    entry[LENS_TO_PUBLIC[row.skill]] = row.status === "ok" ? { verdict: row.analysis?.verdict } : { error: true };
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Trillion-Dollar Confluence leaderboard</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Rankings</h1>
          <p className="mt-2 text-sm text-muted">
            Run of {fmtDate(run.finishedAt ?? run.createdAt)} · {report.rankings.length} candidates ·
            cost {fmtMoney(run.totalCostUsd)} ·{" "}
            <Link href={`/runs/${run.id}`} className="underline underline-offset-2 hover:text-ink">
              mission control replay
            </Link>
          </p>
        </div>
        <Link href="/methodology" className="btn">
          How scoring works
        </Link>
      </div>

      <p className="mt-6 max-w-3xl text-sm text-muted">{report.marketOverview}</p>

      <div className="mt-8">
        <Leaderboard report={report} lensMap={lensMap} />
      </div>

      {report.gapsNoted.length > 0 && (
        <div className="panel mt-6 border-macro/30 p-4">
          <p className="eyebrow text-macro">Data gaps in this run</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-[12px] text-muted">
            {report.gapsNoted.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 text-[13px] text-dim">{report.methodologyNote}</p>
    </main>
  );
}
