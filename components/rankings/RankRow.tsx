import Link from "next/link";
import ConfluenceLine from "@/components/confluence/ConfluenceLine";
import type { ThreadState } from "@/components/confluence/ConfluenceLine";
import { LENS_SKILLS, type LensSkill, type RankedStock, type Verdict } from "@/lib/schemas";

export interface LensCellInfo {
  verdict?: Verdict;
  error?: boolean;
}
export type LensMap = Record<string, Partial<Record<LensSkill, LensCellInfo>>>;

const GLYPH: Record<Verdict, string> = { bullish: "▲", neutral: "─", bearish: "▼" };
const LENS_TEXT: Record<LensSkill, string> = {
  "stock-scanner": "text-fundamentals",
  "gt-predictor": "text-macro",
  "institutional-forecast": "text-consensus",
};
const LENS_NAME: Record<LensSkill, string> = {
  "stock-scanner": "Fundamentals",
  "gt-predictor": "Macro Asymmetry",
  "institutional-forecast": "Street Consensus",
};

function gateChip(gate: RankedStock["gate"]) {
  const cls = gate === "pass" ? "gate-pass" : gate === "caution" ? "gate-caution" : "gate-fail";
  return <span className={`chip ${cls}`}>GATE {gate.toUpperCase()}</span>;
}

export default function RankRow({ stock, lenses }: { stock: RankedStock; lenses?: Partial<Record<LensSkill, LensCellInfo>> }) {
  const threads: Partial<Record<"discovery" | LensSkill, ThreadState>> = { discovery: "done" };
  for (const s of LENS_SKILLS) {
    threads[s] = lenses?.[s]?.error ? "error" : "done";
  }

  return (
    <Link
      href={`/stocks/${stock.ticker}`}
      className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-4 gap-y-2 bg-panel px-4 py-4 transition-colors hover:bg-panel2 sm:grid-cols-[3rem_minmax(0,1.6fr)_minmax(0,1fr)_auto_11rem] sm:px-5"
    >
      <div className="tabular font-mono text-lg font-bold text-dim group-hover:text-muted">
        {String(stock.rank).padStart(2, "0")}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-mono text-xl font-bold tracking-wide">{stock.ticker}</span>
          <span className="truncate text-sm text-muted">{stock.companyName}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {gateChip(stock.gate)}
          {stock.confluence && <span className="chip border-confluence/50 bg-confluence/10 text-confluence">CONFLUENCE</span>}
          <span className="flex items-center gap-1.5 font-mono text-[13px]" aria-label="Lens verdicts">
            {LENS_SKILLS.map((s) => {
              const v = lenses?.[s];
              return (
                <span
                  key={s}
                  className={v?.error ? "text-danger" : LENS_TEXT[s]}
                  title={`${LENS_NAME[s]}: ${v?.error ? "errored" : (v?.verdict ?? "n/a")}`}
                >
                  {v?.error ? "✕" : v?.verdict ? GLYPH[v.verdict] : "·"}
                </span>
              );
            })}
          </span>
        </div>
      </div>

      <p className="col-span-3 min-w-0 text-[13px] leading-snug text-muted sm:col-span-1 sm:line-clamp-2">
        {stock.verdictLine}
      </p>

      <div className="tabular hidden text-right font-mono text-2xl font-bold text-confluence sm:block">
        {stock.finalScore.toFixed(1)}
      </div>

      <div className="hidden sm:block" aria-hidden="true">
        <ConfluenceLine mode="static" compact threads={threads} score={stock.finalScore} className="w-full" />
      </div>
    </Link>
  );
}
