import Link from "next/link";
import ResumeRunButton from "@/components/ResumeRunButton";
import type { RunRow, RunTally } from "@/lib/db";
import { fmtDateTime, fmtDuration, fmtMoney } from "@/lib/format";
import { LENS_SKILLS } from "@/lib/schemas";

function statusChip(status: RunRow["status"]) {
  switch (status) {
    case "complete":
      return <span className="chip gate-pass">COMPLETE</span>;
    case "running":
    case "pending":
      return (
        <span className="chip border-fundamentals/40 text-fundamentals">
          <span className="live-dot" aria-hidden="true" />
          LIVE
        </span>
      );
    case "error":
      return <span className="chip gate-fail">ERROR</span>;
    case "interrupted":
      return <span className="chip gate-caution">INTERRUPTED</span>;
  }
}

/**
 * A stopped real run with a delivered cohort can be finished in place. Mirrors
 * planResume()'s gate without loading a single lens payload — the API re-checks
 * the real thing before anything spends.
 */
function resumable(run: RunRow, tally: RunTally | undefined): tally is RunTally {
  return (
    !run.params.mock &&
    (run.status === "error" || run.status === "interrupted") &&
    (tally?.cohort ?? 0) > 0
  );
}

export default function RunHistoryTable({
  runs,
  tallies = {},
}: {
  runs: RunRow[];
  /** Per-run cohort/banked counts (lib/db runTallies) — drives the resume affordance. */
  tallies?: Record<string, RunTally>;
}) {
  if (runs.length === 0) {
    return (
      <p className="panel p-5 text-sm text-muted">
        No runs yet. The first row appears the moment you trigger one above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-hairline">
      <table className="w-full min-w-[640px] border-collapse text-left">
        <thead>
          <tr className="bg-panel2">
            <th className="eyebrow px-4 py-2.5 font-medium">Run</th>
            <th className="eyebrow px-4 py-2.5 font-medium">Started</th>
            <th className="eyebrow px-4 py-2.5 font-medium">Duration</th>
            <th className="eyebrow px-4 py-2.5 font-medium">Status</th>
            <th className="eyebrow px-4 py-2.5 text-right font-medium">N</th>
            <th className="eyebrow px-4 py-2.5 font-medium">Mode</th>
            <th className="eyebrow px-4 py-2.5 font-medium">Focus</th>
            <th className="eyebrow px-4 py-2.5 text-right font-medium">Cost</th>
            <th className="eyebrow px-4 py-2.5 font-medium">Finish</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-hairline bg-panel transition-colors hover:bg-panel2">
              <td className="px-4 py-2.5">
                <Link href={`/runs/${r.id}`} className="font-mono text-[12px] text-ink underline underline-offset-2 hover:text-white">
                  {r.id.slice(0, 8)}…
                </Link>
              </td>
              <td className="tabular px-4 py-2.5 font-mono text-[12px] text-muted">{fmtDateTime(r.createdAt)}</td>
              <td className="tabular px-4 py-2.5 font-mono text-[12px] text-muted">{fmtDuration(r.createdAt, r.finishedAt)}</td>
              <td className="px-4 py-2.5">{statusChip(r.status)}</td>
              <td className="tabular px-4 py-2.5 text-right font-mono text-[12px] text-muted">{r.params.count}</td>
              <td className="px-4 py-2.5 font-mono text-[12px] text-muted">
                {r.params.mock
                  ? "mock"
                  : (() => {
                      const tags = [r.params.force ? "force" : null, r.params.blind ? "blind" : null].filter(Boolean);
                      return tags.length > 0 ? `real · ${tags.join(" · ")}` : "real";
                    })()}
              </td>
              <td className="max-w-40 truncate px-4 py-2.5 font-mono text-[12px] text-muted" title={r.params.modifier ?? undefined}>
                {r.params.modifier ?? "—"}
              </td>
              <td className="tabular px-4 py-2.5 text-right font-mono text-[12px] text-muted">{fmtMoney(r.totalCostUsd)}</td>
              <td className="px-4 py-2.5">
                {(() => {
                  const tally = tallies[r.id];
                  if (!resumable(r, tally)) return <span className="font-mono text-[12px] text-dim">—</span>;
                  const total = tally.cohort * LENS_SKILLS.length;
                  return (
                    <ResumeRunButton
                      runId={r.id}
                      remaining={total - tally.banked}
                      total={total}
                      navigate
                      className="btn px-2.5 py-1 text-[12px]"
                    />
                  );
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
