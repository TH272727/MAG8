import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AllTimeBoard from "@/components/rankings/AllTimeBoard";
import Leaderboard from "@/components/rankings/Leaderboard";
import type { LensMap } from "@/components/rankings/RankRow";
import { launchMode } from "@/lib/config";
import { getAllTimeBoard, getLensRowsForRun, latestCanonicalRun } from "@/lib/db";
import { fmtDate, fmtMoney } from "@/lib/format";
import { LENS_TO_PUBLIC, toPublicBoard, toPublicReport } from "@/lib/public-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rankings",
  description: "The current Trillion-Dollar Confluence leaderboard and the all-time boards.",
};

export default function RankingsPage() {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  // Weekly section pins to the latest CANONICAL run — a focused lab run never
  // displaces the weekly board; it lands on the lab board below instead.
  const run = latestCanonicalRun();
  // Public-view boundary: reports can be legacy rows with internal phrasing.
  const report = run?.report ? toPublicReport(run.report) : null;
  const canonicalBoard = toPublicBoard(getAllTimeBoard("canonical"));
  const labBoard = toPublicBoard(getAllTimeBoard("focused"));

  const hasWeekly = Boolean(run && report && report.rankings.length > 0);
  const hasBoards = canonicalBoard.entries.length > 0 || labBoard.entries.length > 0;

  if (!hasWeekly && !hasBoards) {
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
  if (run && hasWeekly) {
    for (const row of getLensRowsForRun(run.id)) {
      const entry = (lensMap[row.ticker] ??= {});
      entry[LENS_TO_PUBLIC[row.skill]] = row.status === "ok" ? { verdict: row.analysis?.verdict } : { error: true };
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Trillion-Dollar Confluence leaderboard</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Rankings</h1>
          {hasWeekly && run && report ? (
            <p className="mt-2 text-sm text-muted">
              Run of {fmtDate(run.finishedAt ?? run.createdAt)} · {report.rankings.length} candidates ·
              cost {fmtMoney(run.totalCostUsd)} ·{" "}
              <Link href={`/runs/${run.id}`} className="underline underline-offset-2 hover:text-ink">
                mission control replay
              </Link>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">No canonical weekly run yet — the all-time boards below carry the record so far.</p>
          )}
        </div>
        <Link href="/methodology" className="btn">
          How scoring works
        </Link>
      </div>

      {hasWeekly && report ? (
        <>
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
        </>
      ) : (
        <div className="panel mt-8 p-5">
          <p className="text-sm text-muted">
            The weekly board fills when the next untouched pipeline run completes.
          </p>
          <Link href="/admin" className="btn mt-4">
            Open the admin desk
          </Link>
        </div>
      )}

      <section className="mt-14" aria-labelledby="alltime-h">
        <p className="eyebrow" id="alltime-h">
          All-time boards
        </p>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          The pipeline runs two ways, so the record keeps two boards. The canonical board moves only
          when an untouched weekly run completes; the lab board moves only when a focus-directed run
          does. Every row is that stock&rsquo;s best score to date on runs of that kind.
        </p>
        <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
          <AllTimeBoard board={canonicalBoard} />
          <AllTimeBoard board={labBoard} />
        </div>
      </section>
    </main>
  );
}
