import Link from "next/link";
import type { RunRow } from "@/lib/db";
import { fmtDateTime, fmtDuration, fmtMoney } from "@/lib/format";

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

export default function RunHistoryTable({ runs }: { runs: RunRow[] }) {
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
              <td className="px-4 py-2.5 font-mono text-[12px] text-muted">{r.params.mock ? "mock" : r.params.force ? "real · force" : "real"}</td>
              <td className="max-w-40 truncate px-4 py-2.5 font-mono text-[12px] text-muted" title={r.params.modifier ?? undefined}>
                {r.params.modifier ?? "—"}
              </td>
              <td className="tabular px-4 py-2.5 text-right font-mono text-[12px] text-muted">{fmtMoney(r.totalCostUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
