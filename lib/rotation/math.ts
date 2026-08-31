/* ============================================================================
 * Statistical primitives — pure, no domain knowledge, no network, no database.
 *
 * Everything here takes numbers and returns numbers. The rules it follows:
 *
 *   - A value that cannot be computed is null, never zero and never carried
 *     forward from the previous day. A rolling average has no value until its
 *     window is full, and saying so is the whole point: a 200-day average
 *     computed from 30 days is not a 200-day average.
 *   - Two series are joined on DATE, never by position.
 *   - Series are chronological, oldest first, throughout.
 * ========================================================================== */

export interface DatedValue {
  date: string;
  close: number;
}

export interface AlignedSeries {
  dates: string[];
  base: number[];
  quote: number[];
}

/**
 * Join two price series on their dates.
 *
 * This is the load-bearing function in the whole module. The volatility index
 * trades sessions the funds do not — a US market holiday on which the index
 * still prints — so the two arrays are not the same length and are not offset
 * by a constant either. Zipping them by index would shift one series against
 * the other from the first mismatch backwards, and every average, deviation and
 * momentum reading computed afterwards would be quietly wrong with nothing
 * anywhere to indicate it. Only dates present in BOTH series survive.
 */
export function alignOnDate(base: DatedValue[], quote: DatedValue[]): AlignedSeries {
  const byDate = new Map<string, number>();
  for (const q of quote) byDate.set(q.date, q.close);
  const dates: string[] = [];
  const a: number[] = [];
  const b: number[] = [];
  for (const p of base) {
    const other = byDate.get(p.date);
    if (other === undefined) continue;
    dates.push(p.date);
    a.push(p.close);
    b.push(other);
  }
  return { dates, base: a, quote: b };
}

/** Element-wise ratio. A non-positive or non-finite denominator yields null. */
export function ratioSeries(base: number[], quote: number[]): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < base.length; i++) {
    const d = quote[i];
    const n = base[i];
    out.push(Number.isFinite(n) && Number.isFinite(d) && d > 0 ? n / d : null);
  }
  return out;
}

/** Simple moving average. Null until the window is full, and null across any gap. */
export function sma(values: (number | null)[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (window <= 0) return out;
  let sum = 0;
  let filled = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v !== null) {
      sum += v;
      filled++;
    }
    if (i >= window) {
      const drop = values[i - window];
      if (drop !== null) {
        sum -= drop;
        filled--;
      }
    }
    // Require a complete window: a partial one is a different statistic.
    if (i >= window - 1 && filled === window) out[i] = sum / window;
  }
  return out;
}

/**
 * Rolling standard score over a trailing window.
 *
 * Deliberately computed directly rather than from running sums. These ratios sit
 * near a constant (RSP/SPY lives around 0.287) with a very small variance, and
 * the running-sum shortcut computes the variance as the difference of two nearly
 * equal large numbers — which loses most of the significant digits exactly where
 * this series lives. The direct form costs a few milliseconds across the whole
 * board and is correct.
 */
export function rollingZScore(values: (number | null)[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (window < 2) return out;
  for (let i = window - 1; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    let n = 0;
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const x = values[j];
      if (x === null) continue;
      sum += x;
      n++;
    }
    if (n < window) continue;
    const mean = sum / n;
    let ss = 0;
    for (let j = i - window + 1; j <= i; j++) {
      const x = values[j];
      if (x === null) continue;
      ss += (x - mean) ** 2;
    }
    const sd = Math.sqrt(ss / (n - 1));
    // A window with no dispersion has no meaningful standard score.
    out[i] = sd > 0 ? (v - mean) / sd : null;
  }
  return out;
}

/** Share of a trailing window at or below the value at that index, 0-100. */
export function percentileRankAt(values: (number | null)[], window: number, index: number): number | null {
  const v = values[index];
  if (v === null || index < 0 || index >= values.length) return null;
  const start = Math.max(0, index - window + 1);
  let n = 0;
  let atOrBelow = 0;
  for (let j = start; j <= index; j++) {
    const x = values[j];
    if (x === null) continue;
    n++;
    if (x <= v) atOrBelow++;
  }
  if (n === 0) return null;
  return (100 * atOrBelow) / n;
}

/**
 * Percentile rank across the whole series.
 *
 * The expensive one — quadratic in the window — so callers that do not need the
 * history should ask for a single point instead. The board only computes this
 * series when the operator has given the reading a non-zero weight.
 */
export function rollingPercentile(values: (number | null)[], window: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) out[i] = percentileRankAt(values, window, i);
  return out;
}

/**
 * Relative strength index, Wilder's original smoothing.
 *
 * Applied here to the RATIO rather than to a price, which is the same idea
 * behind relative-rotation charts: the momentum of relative strength, not of the
 * instrument. The first average is a simple mean of the first `period` changes;
 * every subsequent one is smoothed. A window with no losses is 100 by
 * definition, which is a real reading rather than a division error.
 */
export function wilderRsi(values: (number | null)[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (period < 1 || values.length <= period) return out;

  let avgGain: number | null = null;
  let avgLoss: number | null = null;
  let seeded = 0;
  let seedGain = 0;
  let seedLoss = 0;

  for (let i = 1; i < values.length; i++) {
    const cur = values[i];
    const prev = values[i - 1];
    if (cur === null || prev === null) {
      // A gap breaks the smoothing chain; restart rather than bridge it.
      avgGain = null;
      avgLoss = null;
      seeded = 0;
      seedGain = 0;
      seedLoss = 0;
      continue;
    }
    const change = cur - prev;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (avgGain === null || avgLoss === null) {
      seedGain += gain;
      seedLoss += loss;
      seeded++;
      if (seeded === period) {
        avgGain = seedGain / period;
        avgLoss = seedLoss / period;
        out[i] = rsiFrom(avgGain, avgLoss);
      }
      continue;
    }
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFrom(avgGain, avgLoss);
  }
  return out;
}

function rsiFrom(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Percentage change over `lookback` sessions, as a percentage. */
export function rateOfChangeAt(values: (number | null)[], lookback: number, index: number): number | null {
  const then = values[index - lookback];
  const now = values[index];
  if (then === null || then === undefined || now === null || then === 0) return null;
  return 100 * (now / then - 1);
}

/** Index of the last non-null entry, or -1. */
export function lastDefinedIndex(values: (number | null)[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
  return -1;
}

/** Round to one decimal place, the precision the published tiers are stated in. */
export const round1 = (n: number): number => Math.round(n * 10) / 10;
