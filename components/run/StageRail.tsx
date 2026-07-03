export type StageStatus = "pending" | "active" | "done" | "error";

const STAGES: { key: "discovery" | "analysis" | "compile"; n: string; name: string }[] = [
  { key: "discovery", n: "01", name: "Discovery" },
  { key: "analysis", n: "02", name: "Analysis matrix" },
  { key: "compile", n: "03", name: "Compile & verify" },
];

function Glyph({ status }: { status: StageStatus }) {
  if (status === "active") return <span className="live-dot" aria-hidden="true" />;
  if (status === "done") return <span className="font-mono text-[13px] text-fundamentals" aria-hidden="true">✓</span>;
  if (status === "error") return <span className="font-mono text-[13px] text-danger" aria-hidden="true">✕</span>;
  return <span className="inline-block h-[7px] w-[7px] rounded-full border border-hairline2" aria-hidden="true" />;
}

const STATUS_WORD: Record<StageStatus, string> = {
  pending: "pending",
  active: "in progress",
  done: "complete",
  error: "errored",
};

export default function StageRail({ statuses }: { statuses: Record<"discovery" | "analysis" | "compile", StageStatus> }) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3" aria-label="Pipeline stages">
      {STAGES.map((s) => {
        const status = statuses[s.key];
        return (
          <li
            key={s.key}
            className={`flex items-center gap-3 px-4 py-3 ${status === "active" ? "bg-panel2" : "bg-panel"}`}
            aria-label={`Stage ${s.n} ${s.name}: ${STATUS_WORD[status]}`}
          >
            <span className={`font-mono text-[11px] tracking-[0.14em] ${status === "pending" ? "text-dim" : "text-muted"}`}>
              {s.n}
            </span>
            <span className={`flex-1 font-display text-sm font-semibold ${status === "pending" ? "text-dim" : "text-ink"}`}>
              {s.name}
            </span>
            <Glyph status={status} />
          </li>
        );
      })}
    </ol>
  );
}
