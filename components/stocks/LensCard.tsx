import CollapsibleMarkdown from "./CollapsibleMarkdown";
import { PUBLIC_LENS_META, type PublicLens, type PublicLensRow } from "@/lib/public-lens";
import type { MetricValue, Verdict } from "@/lib/schemas";

const ACCENT: Record<PublicLens, { border: string; text: string }> = {
  fundamentals: { border: "border-t-fundamentals/70", text: "text-fundamentals" },
  macro: { border: "border-t-macro/70", text: "text-macro" },
  consensus: { border: "border-t-consensus/70", text: "text-consensus" },
};

const GLYPH: Record<Verdict, string> = { bullish: "▲ bullish", neutral: "─ neutral", bearish: "▼ bearish" };

const str = (v: MetricValue | undefined, fallback = "—"): string => {
  if (v === null || v === undefined || v === "") return fallback;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "object") return fallback; // structured metrics render as charts, not rows
  return String(v);
};
const money = (v: MetricValue | undefined): string => (typeof v === "number" ? `$${v}` : str(v));
const pct = (v: MetricValue | undefined): string =>
  typeof v === "number" ? `${v >= 0 ? "+" : ""}${Math.round(v * 10) / 10}%` : str(v);

function metricRows(lens: PublicLens, km: Record<string, MetricValue>): [string, string][] {
  switch (lens) {
    case "fundamentals":
      return [
        ["Piotroski F", str(km.piotroskiF, "n/m")],
        ["Altman Z", `${str(km.altmanZ, "n/m")} (${str(km.altmanZone)})`],
        ["Reverse-DCF", str(km.reverseDcfVerdict)],
        ["Reward / risk", str(km.rewardRisk)],
        ["Composite", str(km.composite)],
        ["Scanner verdict", str(km.scannerVerdict)],
        ["Value trap", str(km.valueTrap)],
      ];
    case "macro":
      return [
        ["Asymmetry", `${str(km.asymmetryScore)} / 10`],
        ["Entry window", str(km.entryWindow)],
        ["Base rate", str(km.baseRate)],
        ["Adjusted probability", str(km.adjustedProbability)],
        ["Gap vs market", str(km.gapVsMarket)],
      ];
    case "consensus":
      return [
        ["Spot price", money(km.currentPrice)],
        ["Consensus target", `${money(km.consensusTarget)}  (${money(km.consensusTargetLow)} – ${money(km.consensusTargetHigh)})`],
        ["Implied upside", pct(km.impliedUpsidePct)],
        ["Stance", str(km.stance)],
        ["Coverage", typeof km.bankCount === "number" ? `${km.bankCount} of 8 desks verified` : str(km.bankCount)],
        ["Spread", str(km.spread)],
        ["Freshness", str(km.freshness)],
      ];
  }
}

export default function LensCard({ row }: { row: PublicLensRow }) {
  const meta = PUBLIC_LENS_META[row.lens];
  const accent = ACCENT[row.lens];

  if (row.status === "error" || !row.analysis) {
    return (
      <section className="panel border-t-2 border-t-danger/60 p-5" aria-label={`${meta.label} lens — errored`}>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-base font-semibold text-danger">{meta.label}</h3>
          <span className="font-mono text-[11px] text-dim">{meta.short}</span>
        </div>
        <p className="mt-2 text-sm text-muted">
          This lens errored during the run and scored neutral in the rubric.
        </p>
        {row.error && <p className="mt-2 font-mono text-[12px] text-danger/80">{row.error}</p>}
      </section>
    );
  }

  const a = row.analysis;
  return (
    <section className={`panel border-t-2 p-5 ${accent.border}`} aria-label={`${meta.label} lens`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className={`font-display text-base font-semibold ${accent.text}`}>{meta.label}</h3>
        <div className="flex items-center gap-2">
          {row.cachedFromId !== null && <span className="chip">CACHED · THIS WEEK</span>}
          <span className={`chip ${accent.text}`}>{GLYPH[a.verdict]}</span>
          <span className="chip">conf {a.confidence}</span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink/90">{a.summary}</p>

      <dl className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2">
        {metricRows(row.lens, a.keyMetrics).map(([k, v]) => (
          <div key={k} className="bg-panel2 px-3 py-2">
            <dt className="eyebrow">{k}</dt>
            <dd className="tabular mt-0.5 break-words font-mono text-[13px] text-ink">{v}</dd>
          </div>
        ))}
      </dl>

      {a.riskFlags.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow">Risk flags / falsifiers</p>
          <ul className="mt-1.5 space-y-1 text-[13px] text-muted">
            {a.riskFlags.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="text-danger/70">✗</span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CollapsibleMarkdown markdown={a.fullAnalysisMarkdown} label="full write-up" />
    </section>
  );
}
