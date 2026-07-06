import type { MetricValue } from "@/lib/schemas";
import { asNum, asObj, asStr, fmtUsd, markFill, pctPos, trackFill, washFill } from "./chartUtils";

/* ============================================================================
 * Fundamentals instruments: F-Score meter, Altman-Z zone band, scenario
 * ladder. Pure HTML/CSS geometry (percent positioning) so labels stay native
 * size at every viewport. Each instrument renders nothing when its inputs are
 * missing — old rows show the card exactly as before.
 * ========================================================================== */

const ACCENT = "--color-fundamentals";

/** Piotroski F 0–9 as a segmented meter; the ≤3 distress-veto boundary is marked. */
function FScoreMeter({ f }: { f: number }) {
  const score = Math.min(9, Math.max(0, Math.round(f)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Piotroski F</span>
        <span className="font-mono text-[13px] text-ink">
          {score}
          <span className="text-dim"> / 9</span>
        </span>
      </div>
      <div
        className="mt-2 flex gap-0.5"
        role="img"
        aria-label={`Piotroski F-Score ${score} of 9${score <= 3 ? " — inside the distress-veto zone" : ""}`}
      >
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className="h-2.5 flex-1 rounded-[2px]"
            style={{ background: i < score ? markFill(ACCENT) : trackFill(ACCENT) }}
          />
        ))}
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10px] text-dim">
        <span className="absolute left-0">0</span>
        <span
          className={`absolute -translate-x-1/2 ${score <= 3 ? "text-danger/80" : ""}`}
          style={{ left: `${(3 / 9) * 100}%` }}
        >
          ≤3 veto
        </span>
        <span className="absolute right-0">9</span>
      </div>
    </div>
  );
}

/** Altman Z on a piecewise scale — distress / grey / safe zones with the 1.81 / 2.99 thresholds. */
function AltmanBand({ z }: { z: number }) {
  // Each zone gets a third of the band; position within a zone is linear.
  const pos =
    z <= 1.81
      ? pctPos(z, 0, 1.81) / 3
      : z <= 2.99
        ? 33.33 + pctPos(z, 1.81, 2.99) / 3
        : 66.67 + pctPos(z, 2.99, 6) / 3;
  const clamped = Math.min(99, Math.max(1, pos));
  const zone = z < 1.81 ? "distress" : z < 2.99 ? "grey" : "safe";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Altman Z</span>
        <span className="font-mono text-[13px] text-ink">
          {Math.round(z * 100) / 100}
          <span className="text-dim"> · {zone}</span>
        </span>
      </div>
      <div className="relative mt-2" role="img" aria-label={`Altman Z ${z} — ${zone} zone`}>
        <div className="flex gap-0.5">
          <span className="h-2.5 rounded-l-[2px]" style={{ width: "33.33%", background: washFill("--color-danger", 26) }} />
          <span className="h-2.5" style={{ width: "33.33%", background: washFill("--color-macro", 24) }} />
          <span className="h-2.5 flex-1 rounded-r-[2px]" style={{ background: washFill(ACCENT, 26) }} />
        </div>
        <span
          className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-ink"
          style={{ left: `${clamped}%` }}
          aria-hidden="true"
        />
        {z > 6 && (
          <span className="absolute -right-3 top-0 font-mono text-[10px] text-dim" aria-hidden="true">
            ▸
          </span>
        )}
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10px] text-dim">
        <span className="absolute -translate-x-1/2" style={{ left: "33.33%" }}>
          1.81
        </span>
        <span className="absolute -translate-x-1/2" style={{ left: "66.67%" }}>
          2.99
        </span>
      </div>
    </div>
  );
}

interface ScenarioRow {
  key: "bear" | "base" | "bull";
  price: number;
  probability: number | null;
}

/** Bear/base/bull targets on one price scale, with the valuation spot as reference. */
function ScenarioLadder({ rows, spot }: { rows: ScenarioRow[]; spot: number | null }) {
  const prices = [...rows.map((r) => r.price), ...(spot !== null ? [spot] : [])];
  const lo = Math.min(...prices) * 0.96;
  const hi = Math.max(...prices) * 1.04;
  const spotPos = spot !== null ? pctPos(spot, lo, hi) : null;
  return (
    <div className="sm:col-span-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="eyebrow">Scenario ladder</span>
        {spot !== null && (
          <span className="font-mono text-[11px] text-dim">
            spot <span className="text-muted">{fmtUsd(spot)}</span>
          </span>
        )}
      </div>
      <div
        className="mt-2 space-y-1.5"
        role="img"
        aria-label={`Scenarios: ${rows.map((r) => `${r.key} ${fmtUsd(r.price)}${r.probability !== null ? ` at ${r.probability}%` : ""}`).join(", ")}`}
      >
        {rows.map((r) => {
          const pos = pctPos(r.price, lo, hi);
          const labelLeft = Math.min(88, Math.max(12, pos));
          return (
            <div key={r.key} className="flex items-center gap-2 font-mono text-[10px]">
              <span className="w-8 shrink-0 uppercase tracking-[0.08em] text-dim">{r.key}</span>
              <span className="relative h-6 min-w-0 flex-1">
                <span className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-hairline" aria-hidden="true" />
                {spotPos !== null && (
                  <span
                    className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-hairline2"
                    style={{ left: `${spotPos}%` }}
                    aria-hidden="true"
                  />
                )}
                <span
                  className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{ left: `${pos}%`, background: markFill(ACCENT), boxShadow: "0 0 0 2px var(--color-panel)" }}
                  aria-hidden="true"
                />
                <span
                  className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-muted"
                  style={pos < 50 ? { left: `calc(${labelLeft}% + 10px)` } : { right: `calc(${100 - labelLeft}% + 10px)` }}
                  aria-hidden="true"
                >
                  {fmtUsd(r.price)}
                </span>
              </span>
              <span className="w-9 shrink-0 text-right text-dim">{r.probability !== null ? `${Math.round(r.probability)}%` : ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScannerCharts({ km }: { km: Record<string, MetricValue> }) {
  const f = asNum(km.piotroskiF);
  const z = asNum(km.altmanZ);
  const zone = asStr(km.altmanZone);
  const spot = asNum(km.spotPrice);

  const scen = asObj(km.scenarios);
  const rows: ScenarioRow[] = [];
  if (scen) {
    for (const key of ["bear", "base", "bull"] as const) {
      const row = asObj(scen[key]);
      const price = row ? asNum(row.price) : null;
      if (price !== null && price > 0) rows.push({ key, price, probability: row ? asNum(row.probability) : null });
    }
  }

  const showZBand = z !== null && zone !== "not-meaningful";
  const showZNote = z === null || zone === "not-meaningful";
  const showLadder = rows.length >= 2;
  if (f === null && !showZBand && !showLadder) return null;

  return (
    <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {f !== null && <FScoreMeter f={f} />}
      {showZBand && z !== null && <AltmanBand z={z} />}
      {f !== null && showZNote && (
        <div>
          <span className="eyebrow">Altman Z</span>
          <p className="mt-2 text-[12px] text-dim">Not meaningful for this balance-sheet profile — the gate falls back to the other checks.</p>
        </div>
      )}
      {showLadder && <ScenarioLadder rows={rows} spot={spot} />}
    </div>
  );
}
