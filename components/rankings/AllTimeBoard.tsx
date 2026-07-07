import Link from "next/link";
import { fmtDate } from "@/lib/format";
import type { PublicBoard, PublicBoardEntry } from "@/lib/public-lens";

/* All-time board: one run kind's best-ever scores, one compact column.
 * Rendered server-side from a toPublicBoard() payload only. */

const COPY: Record<
  PublicBoard["kind"],
  { title: string; blurb: string; empty: string; cta: { href: string; label: string } }
> = {
  canonical: {
    title: "Canonical board",
    blurb:
      "What the weekly pipeline surfaces on its own — no focus directive, same universe and rubric every run. Each row is that stock's best score to date.",
    empty: "No untouched weekly runs yet. This board fills when the first one completes.",
    cta: { href: "/admin", label: "Open the admin desk" },
  },
  focused: {
    title: "Lab board",
    blurb:
      "The best scores posted by focus-directed runs, each with the directive that surfaced it. Same lenses, same arithmetic — only the hunt was scoped.",
    empty: "No focused runs yet. Point the pipeline at your corner of the market to start this board.",
    cta: { href: "/lab", label: "Open the lab" },
  },
};

function gateChip(gate: PublicBoardEntry["gate"]) {
  const cls = gate === "pass" ? "gate-pass" : gate === "caution" ? "gate-caution" : "gate-fail";
  return <span className={`chip ${cls}`}>GATE {gate.toUpperCase()}</span>;
}

function BoardRow({ entry }: { entry: PublicBoardEntry }) {
  return (
    <Link
      href={`/stocks/${entry.ticker}`}
      className="group grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-3 bg-panel px-4 py-3 transition-colors hover:bg-panel2"
    >
      <div className="tabular font-mono text-base font-bold text-dim group-hover:text-muted">
        {String(entry.rank).padStart(2, "0")}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-mono text-lg font-bold tracking-wide">{entry.ticker}</span>
          <span className="truncate text-[13px] text-muted">{entry.companyName}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {gateChip(entry.gate)}
          {entry.confluence && (
            <span className="chip border-confluence/50 bg-confluence/10 text-confluence">CONFLUENCE</span>
          )}
          <span className="font-mono text-[11px] text-dim">
            {entry.appearances > 1 ? `seen in ${entry.appearances} runs` : "seen in 1 run"} · best{" "}
            {fmtDate(entry.bestRunAt)}
          </span>
        </div>
        {entry.focus && (
          <p className="mt-1 truncate font-mono text-[11px] text-dim" title={entry.focus}>
            FOCUS · &ldquo;{entry.focus}&rdquo;
          </p>
        )}
      </div>

      <div className="tabular text-right font-mono text-xl font-bold text-confluence">
        {entry.finalScore.toFixed(1)}
      </div>
    </Link>
  );
}

export default function AllTimeBoard({ board }: { board: PublicBoard }) {
  const copy = COPY[board.kind];

  return (
    <section aria-label={copy.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="flex flex-wrap items-center gap-2 font-display text-xl font-semibold">
          {copy.title}
          {board.demo && (
            <span
              className="chip"
              title="Built from demo runs — replaced the moment a real run of this kind completes."
            >
              SAMPLE DATA
            </span>
          )}
        </h3>
        {board.entries.length > 0 && (
          <span className="font-mono text-[11px] text-dim">
            {board.runCount} {board.runCount === 1 ? "run" : "runs"} · updated {fmtDate(board.updatedAt)}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">{copy.blurb}</p>

      {board.entries.length === 0 ? (
        <div className="panel mt-4 p-5">
          <p className="text-sm text-muted">{copy.empty}</p>
          <Link href={copy.cta.href} className="btn mt-4">
            {copy.cta.label}
          </Link>
        </div>
      ) : (
        <ol className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
          {board.entries.map((e) => (
            <li key={e.ticker} className="contents">
              <BoardRow entry={e} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
