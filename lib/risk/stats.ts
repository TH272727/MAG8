/* ============================================================================
 * Risk statistics — pure. Numbers in, numbers out. No domain knowledge here.
 *
 * The rules, which are the same rules every other pure module in this project
 * follows:
 *
 *   - A statistic that cannot be computed is null, never zero. Zero volatility
 *     and zero correlation are both real readings that mean something specific,
 *     and neither of them means "not enough data".
 *   - Every estimate is computed in two passes over the sample rather than from
 *     running sums. The shortcut is a genuine hazard on the rotation board's
 *     near-constant ratios; here it is merely unnecessary, since these samples
 *     are a few thousand numbers and the direct form costs nothing.
 *   - Sample statistics use the n-1 divisor throughout. These are samples of a
 *     process, not populations.
 * ========================================================================== */

/** Sessions in a year, for annualising a daily figure. */
export const TRADING_DAYS = 252;

const finite = (xs: number[]): boolean => xs.every((x) => Number.isFinite(x));

export function mean(xs: number[]): number | null {
  if (xs.length === 0 || !finite(xs)) return null;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/** Sample standard deviation, n-1 divisor. Null below two observations. */
export function stdDev(xs: number[]): number | null {
  if (xs.length < 2 || !finite(xs)) return null;
  const m = mean(xs);
  if (m === null) return null;
  let ss = 0;
  for (const x of xs) ss += (x - m) ** 2;
  return Math.sqrt(ss / (xs.length - 1));
}

/**
 * Annualised volatility from daily returns, as a percentage.
 *
 * The square-root-of-time scaling assumes returns are independent across days.
 * They are not, quite — volatility clusters, and a name in a drawdown will
 * usually be more volatile tomorrow because it was volatile today. The figure
 * is still the standard one and is comparable across names, which is what it
 * is used for here; it is not a forecast, and the desk never presents it as
 * one.
 */
export function annualisedVol(returns: number[], daysPerYear = TRADING_DAYS): number | null {
  const sd = stdDev(returns);
  if (sd === null) return null;
  return 100 * sd * Math.sqrt(daysPerYear);
}

/**
 * Downside deviation — the same arithmetic, over losing days only.
 *
 * Deviations are measured from zero rather than from the sample mean, so this
 * answers "how big are the down days" rather than "how far below average". A
 * name that only ever rose has no downside deviation, which is 0 and not null:
 * that is a real, if unusual, reading.
 */
export function downsideDeviation(returns: number[], daysPerYear = TRADING_DAYS): number | null {
  if (returns.length < 2 || !finite(returns)) return null;
  let ss = 0;
  for (const r of returns) if (r < 0) ss += r * r;
  return 100 * Math.sqrt(ss / (returns.length - 1)) * Math.sqrt(daysPerYear);
}

/** Sample covariance of two equal-length series. Null below two pairs. */
export function covariance(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length < 2 || !finite(a) || !finite(b)) return null;
  const ma = mean(a);
  const mb = mean(b);
  if (ma === null || mb === null) return null;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += (a[i] - ma) * (b[i] - mb);
  return sum / (a.length - 1);
}

/**
 * Pearson correlation.
 *
 * Null when either leg has no dispersion at all — a series that never moved has
 * no correlation with anything, and reporting 0 there would read as "these are
 * unrelated" when the truth is "one of these did nothing".
 */
export function correlation(a: number[], b: number[]): number | null {
  const cov = covariance(a, b);
  const sa = stdDev(a);
  const sb = stdDev(b);
  if (cov === null || sa === null || sb === null) return null;
  if (sa === 0 || sb === 0) return null;
  const r = cov / (sa * sb);
  // Floating-point arithmetic can push a perfect correlation a hair outside
  // the legal range; clamping is honest, letting 1.0000000002 through is not.
  return Math.max(-1, Math.min(1, r));
}

/**
 * Beta against a benchmark: how much of the name's movement the market
 * explains, in units of the market's own movement.
 *
 * Null when the benchmark did not move, because dividing by zero variance is
 * not an infinite beta, it is an unanswerable question.
 */
export function beta(asset: number[], benchmark: number[]): number | null {
  const cov = covariance(asset, benchmark);
  const sb = stdDev(benchmark);
  if (cov === null || sb === null || sb === 0) return null;
  return cov / (sb * sb);
}

/* ----------------------------------------------------------------------------
 * Drawdown
 * -------------------------------------------------------------------------- */

export interface Drawdown {
  /** Depth of the worst peak-to-trough fall, as a negative percentage. */
  depthPct: number;
  peakDate: string;
  troughDate: string;
  /**
   * True when the high-water mark was the level the window opened at, rather
   * than a high reached inside it. `peakDate` is then the first session of the
   * window and the fall began before the window did.
   */
  peakAtWindowStart: boolean;
  /** Date the previous peak was regained, or null if it never was. */
  recoveredDate: string | null;
  /** Sessions from trough to recovery. Null while still below the peak. */
  sessionsToRecover: number | null;
  /** True when the series ends below its own high-water mark. */
  underwaterAtEnd: boolean;
}

/**
 * The worst peak-to-trough fall in a return series, and whether it came back.
 *
 * Computed by compounding the returns into a wealth index rather than by
 * reading prices, so the window is exactly the window the volatility was
 * measured over and the two figures describe the same stretch of history. A
 * drawdown quoted over one span beside a volatility quoted over another is the
 * kind of pairing that reads as a contradiction when it is only a mismatch.
 *
 * Recovery is measured from the WORST trough specifically. A series can regain
 * a later, shallower low long before it regains this one, and reporting that as
 * the recovery would badly understate how long the hole lasted.
 */
export function maxDrawdown(returns: number[], dates: string[]): Drawdown | null {
  if (returns.length === 0 || returns.length !== dates.length || !finite(returns)) return null;

  // The wealth series is built ONCE, with a leading 1 for the level the window
  // opened at, and everything below is read off it. That leading element is the
  // whole reason this is not a running computation: the high-water mark is very
  // often the opening level itself — a company already falling when the window
  // began — and an index into the RETURNS array cannot address it. Recomputing
  // the peak's level by compounding returns[0..peakIdx] silently included the
  // first loss, which made the recovery target the trough rather than the peak,
  // and a series that never came back reported that it had.
  const wealth: number[] = new Array(returns.length + 1);
  wealth[0] = 1;
  for (let i = 0; i < returns.length; i++) {
    const next = wealth[i] * (1 + returns[i]);
    if (!Number.isFinite(next) || next <= 0) return null;
    wealth[i + 1] = next;
  }

  // wealth[k] for k > 0 is the level after the session dated dates[k-1].
  const dateAt = (k: number): string => (k === 0 ? dates[0] : dates[k - 1]);

  let peak = wealth[0];
  let peakIdx = 0;
  let worst = 0;
  let worstPeakIdx = 0;
  let worstTroughIdx = 0;

  for (let k = 1; k < wealth.length; k++) {
    if (wealth[k] > peak) {
      peak = wealth[k];
      peakIdx = k;
      continue;
    }
    const dd = wealth[k] / peak - 1;
    if (dd < worst) {
      worst = dd;
      worstPeakIdx = peakIdx;
      worstTroughIdx = k;
    }
  }

  const high = Math.max(...wealth);
  const underwaterAtEnd = wealth[wealth.length - 1] < high;

  if (worst === 0) {
    return {
      depthPct: 0,
      peakDate: dates[0],
      troughDate: dates[0],
      peakAtWindowStart: true,
      recoveredDate: dates[0],
      sessionsToRecover: 0,
      underwaterAtEnd: false,
    };
  }

  // Recovery is measured from the WORST trough specifically. A series can
  // regain a later, shallower low long before it regains this one, and calling
  // that the recovery would badly understate how long the hole lasted.
  const target = wealth[worstPeakIdx];
  let recoveredDate: string | null = null;
  let sessionsToRecover: number | null = null;
  for (let k = worstTroughIdx + 1; k < wealth.length; k++) {
    if (wealth[k] >= target) {
      recoveredDate = dateAt(k);
      sessionsToRecover = k - worstTroughIdx;
      break;
    }
  }

  return {
    depthPct: 100 * worst,
    peakDate: dateAt(worstPeakIdx),
    troughDate: dateAt(worstTroughIdx),
    peakAtWindowStart: worstPeakIdx === 0,
    recoveredDate,
    sessionsToRecover,
    underwaterAtEnd,
  };
}

/** Compound a return series into a total return over the window, percent. */
export function totalReturnPct(returns: number[]): number | null {
  if (returns.length === 0 || !finite(returns)) return null;
  let wealth = 1;
  for (const r of returns) {
    wealth *= 1 + r;
    if (!Number.isFinite(wealth)) return null;
  }
  return 100 * (wealth - 1);
}

/** Round to one decimal place — the precision every published figure uses. */
export const round1 = (n: number): number => Math.round(n * 10) / 10;
/** Round to two decimal places, for correlations and betas. */
export const round2 = (n: number): number => Math.round(n * 100) / 100;
