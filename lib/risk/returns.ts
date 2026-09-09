import type { PriceBar } from "../db";

/* ============================================================================
 * Returns — pure. Bars in, aligned daily returns out. No network, no database.
 *
 * Everything downstream of this file is arithmetic on the arrays it produces,
 * so the two decisions made here govern every number the desk publishes.
 *
 * ONE. Series are joined on DATE, never by position. This is the same rule the
 * rotation board runs on and it was learned the same expensive way: the
 * volatility index prints on a US market holiday when the funds are shut, and a
 * positional zip shifts one series against the other from the first mismatch
 * backwards, with every average and deviation computed afterwards quietly
 * wrong. Here the risk is larger still, because a correlation between two
 * series offset by a day is not merely wrong, it is systematically biased
 * towards zero — which reads as diversification that does not exist.
 *
 * TWO. Returns are SIMPLE, not logarithmic. Log returns are the usual choice
 * for compounding and are slightly better behaved, but a portfolio's simple
 * return is the weighted average of its holdings' simple returns and a
 * portfolio's log return is not the weighted average of anything. Since the
 * whole point of this desk is what a SLEEVE of names does, the arithmetic has
 * to compose, so simple returns it is.
 *
 * A note on price basis, because it matters and the honest answer is not the
 * one the rotation board needed. Bars arrive either dividend-ADJUSTED (the
 * primary source) or RAW (the fallback). On a ratio of levels that difference
 * is severe and cumulative, which is why the board bars a mixed-basis pair
 * outright. On a RETURN series it is neither: an unadjusted series simply shows
 * the ex-dividend fall as a real one-day loss, so a name paying 3% a year in
 * four instalments carries four spurious ~0.75% down-days. That inflates
 * measured volatility a little and adds noise to a correlation on those exact
 * days. So the basis is recorded, the mixed pair is flagged with that mechanism
 * named, and it is never allowed to RAISE a "these two are one position"
 * warning — but it is not discarded, because discarding it would overstate how
 * much of the sleeve had been measured.
 * ========================================================================== */

/** One name's price history as the desk consumes it. */
export interface PriceHistory {
  ticker: string;
  /** Chronological, oldest first, one row per session. */
  bars: { date: string; close: number }[];
  /** True when closes are adjusted for dividends and splits. */
  adjusted: boolean;
  source: PriceBar["source"];
}

/** A name's daily returns, still carrying where the prices came from. */
export interface ReturnSeries {
  ticker: string;
  /** Dates of the RETURNS — one shorter than the bars they came from. */
  dates: string[];
  /** Simple daily returns as fractions: 0.0125 is up 1.25%. */
  values: number[];
  adjusted: boolean;
  source: PriceBar["source"];
}

/**
 * Group raw bars by ticker into histories.
 *
 * Bars are stored with their own basis per row because a ticker's history is
 * REPLACED when its source changes rather than merged. If a stored ticker
 * somehow carries rows of both kinds, that is a fault worth surfacing rather
 * than averaging over, so the history takes the basis of its newest row and the
 * caller is told the ticker is mixed.
 */
export interface GroupedHistory {
  history: PriceHistory;
  /** True when the stored rows for this ticker do not agree on basis or source. */
  mixedWithinTicker: boolean;
}

export function groupBars(bars: PriceBar[]): Map<string, GroupedHistory> {
  const byTicker = new Map<string, PriceBar[]>();
  for (const b of bars) {
    const key = b.ticker.trim().toUpperCase();
    if (key.length === 0) continue;
    const list = byTicker.get(key);
    if (list) list.push(b);
    else byTicker.set(key, [b]);
  }

  const out = new Map<string, GroupedHistory>();
  for (const [ticker, rows] of byTicker) {
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const newest = rows[rows.length - 1];
    const mixed = rows.some((r) => r.adjusted !== newest.adjusted || r.source !== newest.source);
    out.set(ticker, {
      history: {
        ticker,
        bars: rows.map((r) => ({ date: r.date, close: r.close })),
        adjusted: newest.adjusted,
        source: newest.source,
      },
      mixedWithinTicker: mixed,
    });
  }
  return out;
}

/**
 * Bars to daily returns.
 *
 * A non-positive or non-finite close cannot produce a return and ends the run
 * rather than being bridged: a gap in a price series is a gap, and stitching
 * across it invents a single enormous move on the day the data resumes. The
 * date of a return is the date of the LATER close, which is the day the move
 * happened.
 */
export function toReturns(history: PriceHistory): ReturnSeries {
  const dates: string[] = [];
  const values: number[] = [];
  for (let i = 1; i < history.bars.length; i++) {
    const prev = history.bars[i - 1].close;
    const cur = history.bars[i].close;
    // BOTH closes must be real prices. Guarding only the denominator lets a
    // zero close through as a -100% return — a total wipe-out, on a company
    // that merely had a missing reading. This project has met the same trap
    // three times now, each time as a blank field parsed as a number: an empty
    // string is 0 to Number(), and 0 is a perfectly finite price.
    if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev <= 0 || cur <= 0) continue;
    dates.push(history.bars[i].date);
    values.push(cur / prev - 1);
  }
  return {
    ticker: history.ticker,
    dates,
    values,
    adjusted: history.adjusted,
    source: history.source,
  };
}

/**
 * The overlap of two return series, on dates present in both.
 *
 * Pairwise, deliberately. Intersecting every name at once would let the
 * youngest listing in the set dictate the window for all of them — the exact
 * defect that got the most-viewed chart in this genre fact-checked and
 * discredited, where one series had eighteen months against everyone else's
 * forty-eight. Each pair gets its own overlap and reports its own length, so a
 * correlation computed over sixty days is never presented as one computed over
 * a thousand.
 */
export interface PairOverlap {
  dates: string[];
  a: number[];
  b: number[];
}

export function overlap(a: ReturnSeries, b: ReturnSeries): PairOverlap {
  const byDate = new Map<string, number>();
  for (let i = 0; i < b.dates.length; i++) byDate.set(b.dates[i], b.values[i]);
  const dates: string[] = [];
  const x: number[] = [];
  const y: number[] = [];
  for (let i = 0; i < a.dates.length; i++) {
    const other = byDate.get(a.dates[i]);
    if (other === undefined) continue;
    dates.push(a.dates[i]);
    x.push(a.values[i]);
    y.push(other);
  }
  return { dates, a: x, b: y };
}

/**
 * The last `days` entries of a return series, by COUNT of sessions.
 *
 * Sessions, not calendar days — a volatility quoted as "one year" means the
 * last 252 trading sessions, and a name that stopped trading for a month should
 * not have its window silently extended to cover the same 252 sessions from
 * further back without saying so. The caller compares `dates[0]` against the
 * expected span to notice that.
 */
export function tail(series: ReturnSeries, days: number): ReturnSeries {
  if (days <= 0 || series.values.length <= days) return series;
  const start = series.values.length - days;
  return {
    ...series,
    dates: series.dates.slice(start),
    values: series.values.slice(start),
  };
}

/**
 * A common grid across several names, for the sleeve.
 *
 * The sleeve is a single portfolio, so unlike a correlation it genuinely needs
 * one shared calendar. The rule that keeps that honest: a name whose overlap
 * with the common window is shorter than `minDays` is EXCLUDED and named, never
 * silently truncating everyone else to its length. The returned window is the
 * window of the names that survived, and the caller publishes both ends of it.
 */
export interface CommonGrid {
  dates: string[];
  /** Ticker → returns on `dates`, same length and order. */
  columns: Map<string, number[]>;
  /** Names dropped for too little overlap, with the count they did have. */
  excluded: { ticker: string; sessions: number }[];
}

export function commonGrid(series: ReturnSeries[], minDays: number): CommonGrid {
  const usable = series.filter((s) => s.values.length >= minDays);
  const excluded = series
    .filter((s) => s.values.length < minDays)
    .map((s) => ({ ticker: s.ticker, sessions: s.values.length }));

  if (usable.length === 0) return { dates: [], columns: new Map(), excluded };

  // Count how many series carry each date, then keep the dates every survivor
  // has. Building the intersection by counting is O(total rows) rather than
  // O(names x rows) and, more usefully, makes the near-misses inspectable.
  const seen = new Map<string, number>();
  for (const s of usable) {
    for (const d of s.dates) seen.set(d, (seen.get(d) ?? 0) + 1);
  }
  const dates: string[] = [];
  for (const [date, n] of seen) if (n === usable.length) dates.push(date);
  dates.sort();

  const index = new Map<string, number>();
  for (let i = 0; i < dates.length; i++) index.set(dates[i], i);

  const columns = new Map<string, number[]>();
  const survivors: ReturnSeries[] = [];
  for (const s of usable) {
    const col = new Array<number>(dates.length).fill(0);
    let filled = 0;
    for (let i = 0; i < s.dates.length; i++) {
      const at = index.get(s.dates[i]);
      if (at === undefined) continue;
      col[at] = s.values[i];
      filled++;
    }
    if (filled !== dates.length) continue;
    columns.set(s.ticker, col);
    survivors.push(s);
  }

  // A name can clear minDays on its own history and still fall short once the
  // shared calendar is applied. That is the same finding, so it is reported the
  // same way rather than dropped in silence.
  if (dates.length < minDays) {
    return {
      dates: [],
      columns: new Map(),
      excluded: [
        ...excluded,
        ...survivors.map((s) => ({ ticker: s.ticker, sessions: dates.length })),
      ],
    };
  }
  return { dates, columns, excluded };
}
