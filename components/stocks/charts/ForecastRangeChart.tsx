import type { MetricValue } from "@/lib/schemas";
import { asArr, asNum, asObj, asStr, fmtUsd, markFill, pctPos, washFill } from "./chartUtils";

/* ============================================================================
 * Street-consensus range strip: verified low–high target band, consensus
 * marker, spot marker, one dot per verified institution. Works on pre-wire
 * rows (low/high/target/spot are original fields); institution dots appear
 * only when the roster exists. Values are labeled selectively — the metric
 * rows above the chart carry the full table.
 * ========================================================================== */

const ACCENT = "--color-consensus";

interface InstDot {
  name: string;
  target: number;
  asOf: string | null;
  stance: string | null;
}

export default function ForecastRangeChart({ km }: { km: Record<string, MetricValue> }) {
  const spot = asNum(km.currentPrice);
  const target = asNum(km.consensusTarget);
  const low = asNum(km.consensusTargetLow);
  const high = asNum(km.consensusTargetHigh);

  const institutions: InstDot[] = [];
  for (const raw of asArr(km.institutions) ?? []) {
    const o = asObj(raw);
    if (!o) continue;
    const name = asStr(o.name);
    const t = asNum(o.target);
    if (name === null || t === null || t <= 0) continue;
    institutions.push({ name, target: t, asOf: asStr(o.asOf), stance: asStr(o.stance) });
  }

  const anchors = [spot, target, low, high, ...institutions.map((i) => i.target)].filter(
    (v): v is number => v !== null && v > 0,
  );
  const min = Math.min(...anchors);
  const max = Math.max(...anchors);
  // A strip needs an actual spread of at least two distinct values to mean anything.
  if (anchors.length < 2 || max - min < max * 0.001) return null;

  const lo = min * 0.97;
  const hi = max * 1.03;
  const rangeLeft = low !== null && high !== null && high > low ? pctPos(low, lo, hi) : null;
  const rangeWidth = rangeLeft !== null && low !== null && high !== null ? pctPos(high, lo, hi) - rangeLeft : null;
  const clampLabel = (p: number) => Math.min(88, Math.max(12, p));

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Target range</span>
        {institutions.length > 0 && (
          <span className="font-mono text-[11px] text-dim">{institutions.length} verified desk{institutions.length === 1 ? "" : "s"}</span>
        )}
      </div>
      <div
        className="relative mb-6 mt-7"
        role="img"
        aria-label={`Verified target range${low !== null && high !== null ? ` ${fmtUsd(low)} to ${fmtUsd(high)}` : ""}${
          target !== null ? `, consensus ${fmtUsd(target)}` : ""
        }${spot !== null ? `, spot ${fmtUsd(spot)}` : ""}${
          institutions.length ? `, ${institutions.length} institution targets plotted` : ""
        }`}
      >
        {/* track + verified range wash */}
        <div className="h-3 rounded-full" style={{ background: washFill(ACCENT, 10) }} />
        {rangeLeft !== null && rangeWidth !== null && (
          <span
            className="absolute top-0 h-3 rounded-full"
            style={{ left: `${rangeLeft}%`, width: `${Math.max(rangeWidth, 1.5)}%`, background: washFill(ACCENT, 34) }}
            aria-hidden="true"
          />
        )}

        {/* one dot per verified institution target */}
        {institutions.map((inst, i) => (
          <span
            key={`${inst.name}-${i}`}
            className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${pctPos(inst.target, lo, hi)}%`,
              background: markFill(ACCENT),
              boxShadow: "0 0 0 2px var(--color-panel)",
            }}
            title={`${inst.name}: ${fmtUsd(inst.target)}${inst.asOf ? ` (${inst.asOf})` : ""}${inst.stance ? ` — ${inst.stance}` : ""}`}
          />
        ))}

        {/* consensus marker — labeled above */}
        {target !== null && (
          <>
            <span
              className="absolute -top-1 h-5 w-1 -translate-x-1/2 rounded-full"
              style={{ left: `${pctPos(target, lo, hi)}%`, background: `var(${ACCENT})` }}
              aria-hidden="true"
            />
            <span
              className="absolute -top-6 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-muted"
              style={{ left: `${clampLabel(pctPos(target, lo, hi))}%` }}
              aria-hidden="true"
            >
              consensus <span className="text-ink">{fmtUsd(target)}</span>
            </span>
          </>
        )}

        {/* spot marker — labeled below */}
        {spot !== null && (
          <>
            <span
              className="absolute -top-1 h-5 w-0.5 -translate-x-1/2 rounded-full bg-ink"
              style={{ left: `${pctPos(spot, lo, hi)}%` }}
              aria-hidden="true"
            />
            <span
              className="absolute top-4 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] text-dim"
              style={{ left: `${clampLabel(pctPos(spot, lo, hi))}%` }}
              aria-hidden="true"
            >
              spot <span className="text-muted">{fmtUsd(spot)}</span>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
