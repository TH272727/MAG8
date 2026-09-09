import type { CommonGrid } from "./returns";
import {
  annualisedVol,
  covariance,
  maxDrawdown,
  round1,
  round2,
  stdDev,
  totalReturnPct,
  TRADING_DAYS,
  type Drawdown,
} from "./stats";

/* ============================================================================
 * The sleeve — pure. What a basket of these names does when held together.
 *
 * This is the arithmetic that makes the desk more than a table of volatilities.
 * Twelve names is not twelve positions if six of them are the same trade, and
 * the row count is the one number on a watchlist that always looks reassuring.
 *
 * TWO CONVENTIONS ARE ASSUMED HERE AND BOTH ARE PUBLISHED ON THE PAGE.
 *
 * Weights are EQUAL and the sleeve is rebalanced every session. Equal weight is
 * deliberate, not lazy: DeMiguel, Garlappi and Uppal (2009) tested fourteen
 * optimising rules across seven datasets and none of them reliably beat 1/N out
 * of sample, because estimating the inputs costs more than the optimisation
 * gains. A desk that published optimised weights would be claiming an accuracy
 * the literature says it does not have. Daily rebalancing is the convention
 * that makes "equal weight" mean one specific thing; a real holding drifts away
 * from it between rebalances, and the page says so.
 *
 * And the honest limit on all of it: these are historical co-movements. The
 * reason diversification is wanted is the reason it tends to be least available
 * — correlations rise together in falling markets, so the measured figure is a
 * calm-weather reading and understates how much of this moves as one thing on
 * the day it matters. That sentence is on the page too, and it is not a
 * disclaimer, it is a result.
 * ========================================================================== */

export interface SleeveInput {
  grid: CommonGrid;
  /**
   * The benchmark's own dated returns. Joined to the basket's calendar HERE
   * rather than by the caller, on the sessions the two share.
   *
   * It is joined rather than required to match, and that distinction was worth
   * a bug. The benchmark's prices come from whichever desk stored them, and a
   * desk that refreshed two days ago holds two fewer sessions than one that
   * refreshed today. An all-or-nothing join treats that two-day lag as a total
   * absence: the basket's beta and its market comparison both disappeared while
   * every individual company kept its own beta, because those are computed
   * pairwise. Nothing was wrong, nothing said anything, and one line of the
   * board was simply gone.
   */
  benchmark?: { ticker: string; dates: string[]; values: number[] } | null;
  /** Shared sessions required before a benchmark figure is published at all. */
  minBenchmarkSessions?: number;
  daysPerYear?: number;
}

export interface RiskContribution {
  ticker: string;
  /** Weight in the sleeve, as a fraction. */
  weight: number;
  /** This name's own annualised volatility, percent. */
  ownVolPct: number | null;
  /**
   * Share of the sleeve's total risk this name carries, percent of the whole.
   * These sum to 100 by construction — it is a decomposition, not a ranking of
   * separate quantities.
   */
  riskSharePct: number | null;
  /** riskSharePct minus weight, in points. Positive means it punches above its size. */
  excessPoints: number | null;
}

export interface Sleeve {
  tickers: string[];
  sessions: number;
  from: string | null;
  to: string | null;
  /** Annualised volatility of the equal-weight sleeve, percent. */
  volPct: number | null;
  /** The weighted average of the members' own volatilities, percent. */
  averageMemberVolPct: number | null;
  /**
   * How many independent positions this really is.
   *
   * The square of Choueifaty and Coignard's diversification ratio: the
   * weighted-average member volatility over the sleeve's own volatility, all
   * squared. Perfectly correlated names give 1 however many there are; N names
   * that move independently give N. It answers the question the row count
   * cannot.
   */
  effectivePositions: number | null;
  totalReturnPct: number | null;
  drawdown: Drawdown | null;
  /** Sleeve beta against the benchmark, when one was supplied and aligned. */
  beta: number | null;
  benchmarkVolPct: number | null;
  benchmarkTicker: string | null;
  /**
   * Sessions the benchmark figures were measured over. Below `sessions` when
   * the benchmark's stored history does not reach as far forward as the
   * basket's — which is stated rather than silently ignored.
   */
  benchmarkSessions: number | null;
  contributions: RiskContribution[];
  /** Daily sleeve returns, kept so the caller can chart or recompute. */
  returns: number[];
  dates: string[];
}

/**
 * Build the covariance matrix of the grid's columns, in DAILY units.
 *
 * Order is the order of `tickers`, and the matrix is symmetric by construction
 * rather than by assumption — each off-diagonal entry is computed once and
 * written to both cells, so a bug that produced an asymmetric matrix would have
 * to be in the computation itself and not in the indexing.
 */
export function covarianceMatrix(
  tickers: string[],
  columns: Map<string, number[]>,
): (number | null)[][] {
  const n = tickers.length;
  const m: (number | null)[][] = Array.from({ length: n }, () => new Array<number | null>(n).fill(null));
  for (let i = 0; i < n; i++) {
    const a = columns.get(tickers[i]);
    if (!a) continue;
    const sd = stdDev(a);
    m[i][i] = sd === null ? null : sd * sd;
    for (let j = i + 1; j < n; j++) {
      const b = columns.get(tickers[j]);
      if (!b) continue;
      const cov = covariance(a, b);
      m[i][j] = cov;
      m[j][i] = cov;
    }
  }
  return m;
}

/**
 * The equal-weight sleeve.
 *
 * Returns null-ish figures rather than throwing when the grid is empty, because
 * an empty sleeve is a legitimate state — it happens whenever fewer than two
 * names have enough shared history — and the page reports it as not measured.
 */
export function buildSleeve(input: SleeveInput): Sleeve {
  const daysPerYear = input.daysPerYear ?? TRADING_DAYS;
  const tickers = [...input.grid.columns.keys()].sort();
  const n = tickers.length;
  const dates = input.grid.dates;

  const empty: Sleeve = {
    tickers,
    sessions: dates.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    volPct: null,
    averageMemberVolPct: null,
    effectivePositions: null,
    totalReturnPct: null,
    drawdown: null,
    beta: null,
    benchmarkVolPct: null,
    benchmarkTicker: input.benchmark?.ticker ?? null,
    benchmarkSessions: null,
    contributions: [],
    returns: [],
    dates,
  };
  if (n === 0 || dates.length < 2) return empty;

  const weight = 1 / n;

  // The sleeve's own return on each session. A portfolio's simple return is the
  // weighted average of its holdings' simple returns, which is exactly why this
  // module works in simple returns and not log ones.
  const sleeveReturns: number[] = new Array(dates.length).fill(0);
  for (const t of tickers) {
    const col = input.grid.columns.get(t);
    if (!col) continue;
    for (let i = 0; i < dates.length; i++) sleeveReturns[i] += weight * col[i];
  }

  const cov = covarianceMatrix(tickers, input.grid.columns);

  // Portfolio variance from the matrix, w' S w. Computed from the matrix rather
  // than from the sleeve return series so that the risk decomposition below is
  // guaranteed to sum to the same total the page prints.
  let portVar = 0;
  let complete = true;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const c = cov[i][j];
      if (c === null) {
        complete = false;
        continue;
      }
      portVar += weight * weight * c;
    }
  }
  const portSd = complete && portVar > 0 ? Math.sqrt(portVar) : null;
  const volPct = portSd === null ? null : round1(100 * portSd * Math.sqrt(daysPerYear));

  // Weighted average of the members' own volatilities — the denominator-free
  // half of the diversification ratio.
  let avgVolDaily = 0;
  let avgOk = true;
  const ownSd: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const v = cov[i][i];
    const sd = v === null || v < 0 ? null : Math.sqrt(v);
    ownSd.push(sd);
    if (sd === null) avgOk = false;
    else avgVolDaily += weight * sd;
  }
  const averageMemberVolPct = avgOk ? round1(100 * avgVolDaily * Math.sqrt(daysPerYear)) : null;

  const effectivePositions =
    portSd !== null && avgOk && portSd > 0 ? round1((avgVolDaily / portSd) ** 2) : null;

  // Euler decomposition: each name's share of total risk is its weight times
  // its covariance with the sleeve, over portfolio variance. These sum to 1.
  const contributions: RiskContribution[] = tickers.map((ticker, i) => {
    const ownVolPct = ownSd[i] === null ? null : round1(100 * (ownSd[i] as number) * Math.sqrt(daysPerYear));
    if (portSd === null || portVar <= 0) {
      return { ticker, weight, ownVolPct, riskSharePct: null, excessPoints: null };
    }
    let covWithSleeve = 0;
    let ok = true;
    for (let j = 0; j < n; j++) {
      const c = cov[i][j];
      if (c === null) {
        ok = false;
        break;
      }
      covWithSleeve += weight * c;
    }
    if (!ok) return { ticker, weight, ownVolPct, riskSharePct: null, excessPoints: null };
    const share = 100 * ((weight * covWithSleeve) / portVar);
    return {
      ticker,
      weight,
      ownVolPct,
      riskSharePct: round1(share),
      excessPoints: round1(share - 100 * weight),
    };
  });

  // Benchmark figures, on the sessions the basket and the benchmark share.
  let betaValue: number | null = null;
  let benchmarkVolPct: number | null = null;
  let benchmarkSessions: number | null = null;
  if (input.benchmark) {
    const byDate = new Map<string, number>();
    for (let i = 0; i < input.benchmark.dates.length; i++) {
      byDate.set(input.benchmark.dates[i], input.benchmark.values[i]);
    }
    const bench: number[] = [];
    const mine: number[] = [];
    for (let i = 0; i < dates.length; i++) {
      const v = byDate.get(dates[i]);
      if (v === undefined) continue;
      bench.push(v);
      mine.push(sleeveReturns[i]);
    }
    const floor = input.minBenchmarkSessions ?? 2;
    if (bench.length >= floor) {
      benchmarkSessions = bench.length;
      const bcov = covariance(mine, bench);
      const bsd = stdDev(bench);
      if (bcov !== null && bsd !== null && bsd > 0) betaValue = round2(bcov / (bsd * bsd));
      const bv = annualisedVol(bench, daysPerYear);
      benchmarkVolPct = bv === null ? null : round1(bv);
    }
  }

  const total = totalReturnPct(sleeveReturns);

  return {
    tickers,
    sessions: dates.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    volPct,
    averageMemberVolPct,
    effectivePositions,
    totalReturnPct: total === null ? null : round1(total),
    drawdown: maxDrawdown(sleeveReturns, dates),
    beta: betaValue,
    benchmarkVolPct,
    benchmarkTicker: input.benchmark?.ticker ?? null,
    benchmarkSessions,
    contributions: contributions.sort((a, b) => (b.riskSharePct ?? -1) - (a.riskSharePct ?? -1)),
    returns: sleeveReturns,
    dates,
  };
}

/**
 * What the sleeve implies for a whole portfolio at a given equity exposure.
 *
 * The Tide already publishes how much of a portfolio to hold in equities at
 * all. This is the other half of the same sentence: holding THIS sleeve at THAT
 * exposure, with the rest in cash, carries this much volatility. Cash is taken
 * as riskless and uncorrelated, which is the standard simplification and is
 * true enough at these horizons that stating it is the whole correction.
 */
export function atExposure(sleeveVolPct: number | null, exposurePct: number): number | null {
  if (sleeveVolPct === null || !Number.isFinite(exposurePct)) return null;
  if (exposurePct < 0 || exposurePct > 100) return null;
  return round1((sleeveVolPct * exposurePct) / 100);
}
