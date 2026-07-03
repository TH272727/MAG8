import type { CompiledReport } from "@/lib/schemas";
import RankRow, { type LensMap } from "./RankRow";

export default function Leaderboard({ report, lensMap }: { report: CompiledReport; lensMap: LensMap }) {
  return (
    <div>
      <div className="hidden grid-cols-[3rem_minmax(0,1.6fr)_minmax(0,1fr)_auto_11rem] gap-x-4 px-5 pb-2 sm:grid">
        <span className="eyebrow">#</span>
        <span className="eyebrow">Company</span>
        <span className="eyebrow">Verdict</span>
        <span className="eyebrow text-right">Score</span>
        <span className="eyebrow text-right">Confluence</span>
      </div>
      <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline">
        {report.rankings.map((s) => (
          <li key={s.ticker} className="contents">
            <RankRow stock={s} lenses={lensMap[s.ticker]} />
          </li>
        ))}
      </ol>
    </div>
  );
}
