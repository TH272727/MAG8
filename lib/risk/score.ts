import { overlap, type ReturnSeries } from "./returns";
import {
  annualisedVol,
  beta,
  correlation,
  downsideDeviation,
  maxDrawdown,
  round1,
  round2,
  totalReturnPct,
  TRADING_DAYS,
  type Drawdown,
} from "./stats";

/* ============================================================================
 * Per-name risk and the pair table — pure. Return series in, ordered rows out.
 *
 * Two rules govern everything below, and both are the house rules rather than
 * anything specific to risk.
 *
 * A name the desk could not measure is NOT MEASURED. It is never given a zero
 * volatility, never given a zero correlation, and it ranks BELOW every name
 * that was measured — the same treatment the insider scanner gives an unscored
 * component and the tide gives an unmeasured gauge. Zero risk is a claim, and
 * it is the single most dangerous claim this desk could make by accident.
 *
 * And the pair table is computed on each pair's OWN overlap rather than on one
 * shared calendar. Two names that have both traded for a decade should not have
 * their correlation measured over the eleven months since the newest listing in
 * an unrelated part of the table came public. Every pair carries the number of
 * sessions it was actually computed from, and a thin pair says so instead of
 * being quietly averaged in with a thick one.
 * ========================================================================== */

/** Why a name could not be measured. Never rendered as a rejection. */
export type UnmeasuredReason = "no-history" | "too-short" | "no-variation";

export interface NameRisk {
  ticker: string;
  /** Annualised volatility, percent. Null when not measured. */
  volPct: number | null;
  downsideVolPct: number | null;
  /** Beta against the benchmark, on the pair's own overlap. */
  beta: number | null;
  drawdown: Drawdown | null;
  totalReturnPct: number | null;
  /** Sessions the figures were computed from. */
  sessions: number;
  from: string | null;
  to: string | null;
  /** False when this name's closes are not dividend-adjusted. */
  adjusted: boolean;
  source: string;
  measured: boolean;
  reason: UnmeasuredReason | null;
  /** Share of the sleeve's risk, when this name is in the sleeve. */
  riskSharePct: number | null;
  inSleeve: boolean;
}

export interface Pair {
  a: string;
  b: string;
  /** Pearson correlation of daily returns over the pair's own overlap. */
  r: number;
  sessions: number;
  from: string;
  to: string;
  /** True when the two legs' closes are on different bases. */
  mixedBasis: boolean;
  /**
   * True when this pair is close enough to be read as one position. A
   * mixed-basis pair is never allowed to raise this, however high its
   * correlation: an unadjusted leg carries its ex-dividend falls as real
   * one-day losses, which is noise this flag should not be built on.
   */
  together: boolean;
}

export interface ScoreOptions {
  /** Sessions required before a figure is published at all. */
  minSessions: number;
  /** Correlation at or above which two names are read as one position. */
  togetherAt: number;
  daysPerYear?: number;
  /** Most pairs to return, highest correlation first. */
  maxPairs: number;
}

/** Measure one name on its own, over whatever history it has. */
export function assessName(
  series: ReturnSeries,
  benchmark: ReturnSeries | null,
  opts: ScoreOptions,
): NameRisk {
  const daysPerYear = opts.daysPerYear ?? TRADING_DAYS;
  const base: NameRisk = {
    ticker: series.ticker,
    volPct: null,
    downsideVolPct: null,
    beta: null,
    drawdown: null,
    totalReturnPct: null,
    sessions: series.values.length,
    from: series.dates[0] ?? null,
    to: series.dates[series.dates.length - 1] ?? null,
    adjusted: series.adjusted,
    source: series.source,
    measured: false,
    reason: null,
    riskSharePct: null,
    inSleeve: false,
  };

  if (series.values.length === 0) return { ...base, reason: "no-history" };
  if (series.values.length < opts.minSessions) return { ...base, reason: "too-short" };

  const vol = annualisedVol(series.values, daysPerYear);
  if (vol === null || vol === 0) return { ...base, reason: "no-variation" };

  let betaValue: number | null = null;
  if (benchmark) {
    const o = overlap(series, benchmark);
    if (o.a.length >= opts.minSessions) {
      const b = beta(o.a, o.b);
      betaValue = b === null ? null : round2(b);
    }
  }

  const down = downsideDeviation(series.values, daysPerYear);
  const total = totalReturnPct(series.values);

  return {
    ...base,
    volPct: round1(vol),
    downsideVolPct: down === null ? null : round1(down),
    beta: betaValue,
    drawdown: maxDrawdown(series.values, series.dates),
    totalReturnPct: total === null ? null : round1(total),
    measured: true,
    reason: null,
  };
}

/**
 * Every pair worth reporting, strongest co-movement first.
 *
 * Quadratic in the number of names, which is fine at the scale this desk works
 * at — the cross-desk ledger names a few dozen companies — and the cap keeps a
 * future desk that names hundreds from turning this into a dump. The cap is
 * applied AFTER sorting, so what is dropped is always the weakest.
 */
export function buildPairs(series: ReturnSeries[], opts: ScoreOptions): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const o = overlap(series[i], series[j]);
      if (o.a.length < opts.minSessions) continue;
      const r = correlation(o.a, o.b);
      if (r === null) continue;
      const mixedBasis = series[i].adjusted !== series[j].adjusted;
      pairs.push({
        a: series[i].ticker,
        b: series[j].ticker,
        r: round2(r),
        sessions: o.a.length,
        from: o.dates[0],
        to: o.dates[o.dates.length - 1],
        mixedBasis,
        together: !mixedBasis && r >= opts.togetherAt,
      });
    }
  }
  pairs.sort((x, y) => y.r - x.r);
  return pairs.slice(0, opts.maxPairs);
}

/**
 * Order the names for the board.
 *
 * Risk share leads, because a name's contribution to the sleeve already
 * combines how much it moves with how much of that movement is shared — which
 * is the whole question. A measured name that is not in the sleeve is ordered
 * on its own volatility below those, and an unmeasured name ranks last with its
 * reason, never at zero.
 */
export function compareNames(a: NameRisk, b: NameRisk): number {
  const rank = (n: NameRisk) => (n.inSleeve && n.riskSharePct !== null ? 0 : n.measured ? 1 : 2);
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return (b.riskSharePct ?? 0) - (a.riskSharePct ?? 0);
  if (ra === 1) return (b.volPct ?? 0) - (a.volPct ?? 0);
  return a.ticker.localeCompare(b.ticker);
}

export interface PairSummary {
  /** Pairs at or above the threshold, excluding mixed-basis pairs. */
  together: number;
  /** Distinct names appearing in at least one of those pairs. */
  namesInvolved: number;
  /** Pairs suppressed because their two legs are on different price bases. */
  mixedBasisSuppressed: number;
  strongest: Pair | null;
}

export function summarisePairs(pairs: Pair[]): PairSummary {
  const together = pairs.filter((p) => p.together);
  const names = new Set<string>();
  for (const p of together) {
    names.add(p.a);
    names.add(p.b);
  }
  return {
    together: together.length,
    namesInvolved: names.size,
    mixedBasisSuppressed: pairs.filter((p) => p.mixedBasis).length,
    strongest: pairs[0] ?? null,
  };
}
