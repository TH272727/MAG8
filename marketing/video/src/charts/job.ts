/**
 * How a chart's numbers are obtained. Kept apart from React so
 * scripts/chart-fetch.ts can import a spec module under Node's type stripping.
 *
 * Every source here is free, keyless and already proven reachable from this
 * network by the product's own data layer (Yahoo v8 in lib/rotation/bars.ts,
 * FRED CSV in lib/bottleneck/supply.ts). Nothing in this pipeline costs money
 * or needs an account — the same constraint the desks are built under.
 */

export type YahooJob = {
  source: 'yahoo';
  /** dataset key ← market symbol. Dots become dashes (BRK.B → BRK-B) on the way out. */
  tickers: {key: string; symbol: string}[];
  /** Yahoo range token: '5y' | '10y' | '15y' | '20y' | 'max'. */
  range: string;
  interval: '1d' | '1wk' | '1mo';
  /**
   * 'invested' — what `principal` dollars put in at the base date is worth at
   *              each later date. Requires every series to have a reading at
   *              the base date; a series that listed later is REFUSED rather
   *              than rebased to its own start (that comparison is the lie).
   * 'pctChange' — cumulative % change from the base date.
   * 'raw'       — adjusted close as filed.
   */
  transform: 'invested' | 'pctChange' | 'raw';
  principal?: number;
  /** ISO day; the first shared date on/after it becomes the base. */
  from?: string;
  /**
   * ISO day the run STOPS on, inclusive. Omit it and the film runs to the last
   * date every series reports, which is the default and the safe case.
   *
   * A WINDOW is the defect this whole format polices, so this option is
   * deliberately narrow: an end date is legitimate only when the window IS the
   * subject — the year a barrel of oil was worth less than nothing, the autumn
   * of a crash — and it is never a way to stop a race on the frame where a
   * favoured line happens to be ahead. The gate cannot tell those two apart by
   * looking at the numbers, so the author has to.
   */
  to?: string;
  /** What the basket does with dividends. See DIVIDEND_CLAUSE. */
  dividends?: Dividends;
  /**
   * Overrides the default "Adjusted closes · Yahoo Finance" credit. A price
   * INDEX has nothing to adjust, and that default sat on screen directly above
   * a method line saying "price only — no dividends".
   */
  sourceLabel?: string;
};

/**
 * Whether the lines in this basket carry dividends — DECLARED, never assumed.
 *
 * The fetcher used to end every rebased method line with "distributions
 * reinvested", which is true of a fund's adjusted closes and FALSE of a price
 * index: the Nikkei, the S&P 500, the FTSE and the Hang Seng are all quoted
 * without dividends, so a chart of the four printed a sentence under itself
 * contradicting its own subtitle. Worse is the mixed basket, where it is true
 * of some lines and not others — a gold FUND against a price INDEX credits one
 * of them with thirty years of income and not the other, which is the same
 * defect as putting a total-return index beside three price ones.
 *
 * A data source cannot answer this: Yahoo returns an `adjclose` field for an
 * index too, it simply equals the price. So the basket's author states what the
 * basket is, and the line printed on screen is that statement. Omit it and the
 * method line makes no claim about dividends at all, which is the only other
 * honest option.
 */
export type Dividends = 'reinvested' | 'excluded';

export const DIVIDEND_CLAUSE: Record<Dividends, string> = {
  reinvested: ', distributions reinvested',
  excluded: ', price only — no dividends',
};

/**
 * Unit conversions, NAMED rather than numeric.
 *
 * A publisher's units are not a detail: the Fed's national accounts file the
 * whole Z.1 in MILLIONS of dollars while FRED's own GDP series is in BILLIONS,
 * and a chart that puts them on one axis is wrong by a factor of a thousand
 * with every value real and no error anywhere. The conversion therefore travels
 * as a name, so the factor and the sentence printed under the chart come from
 * one entry and cannot disagree — a bare `scale: 1e6` invites a spec to multiply
 * by one number and say another.
 */
export type FredScale = 'millionsToDollars' | 'billionsToDollars' | 'thousandsToUnits';

export const FRED_SCALES: Record<FredScale, {factor: number; from: string; to: string}> = {
  millionsToDollars: {factor: 1e6, from: 'millions of dollars', to: 'dollars'},
  billionsToDollars: {factor: 1e9, from: 'billions of dollars', to: 'dollars'},
  thousandsToUnits: {factor: 1e3, from: 'thousands', to: 'whole units'},
};

export type FredJob = {
  source: 'fred';
  series: {key: string; id: string}[];
  /** Convert every observation out of the publisher's units. See FRED_SCALES. */
  scale?: FredScale;
  /**
   * 'raw'       — the series as published.
   * 'pctChange' — cumulative % from the base date.
   * 'invested'  — what `principal` placed at the base date is worth at each
   *               later date, tracked by the index.
   *
   * The third exists because a federal index is often the ONLY record of a
   * price a person actually paid — a metro house price index is published as
   * an index level, and "your $200,000 became $612,000" is the same
   * arithmetic `invested` already does for a ticker. Rebasing is refused
   * unless every series has a reading on one shared date, exactly as it is
   * for Yahoo: a line rebased to its own first date is the comparison that
   * gets charts fact-checked.
   */
  transform: 'raw' | 'pctChange' | 'invested';
  /** Only read when transform is 'invested'. Defaults to 10,000. */
  principal?: number;
  from?: string;
  /**
   * ISO day the run STOPS on, inclusive. Omit it and the film runs to the last
   * date every series reports, which is the default and the safe case.
   *
   * A WINDOW is the defect this whole format polices, so this option is
   * deliberately narrow: an end date is legitimate only when the window IS the
   * subject — the year a barrel of oil was worth less than nothing, the autumn
   * of a crash — and it is never a way to stop a race on the frame where a
   * favoured line happens to be ahead. The gate cannot tell those two apart by
   * looking at the numbers, so the author has to.
   */
  to?: string;
  /**
   * Coarsen the shared date axis to the frequency the SLOWEST publisher uses.
   * Mixing a monthly series with a quarterly one otherwise leaves the quarterly
   * line full of holes, and a chart with holes in one line and not another is a
   * chart that will be read as a difference in the data.
   */
  sample?: 'monthly' | 'quarterly' | 'annual';
  sourceLabel?: string;
};

/**
 * One race, more than one source.
 *
 * WHY THIS EXISTS. Bitcoin's price history does not live where market prices
 * live: Yahoo's BTC-USD begins in September 2014, four years after the story
 * this format wanted to tell. blockchain.com publishes the daily market price
 * back to the first day one existed, keyless — but a chart needs it on the same
 * axis as ordinary tickers, and every job type here was single-source.
 *
 * The legs are joined the way the rest of this codebase joins anything: on
 * DATE, after each leg has been reduced to the same grid. A daily series
 * arriving next to monthly bars keeps its LAST reading of each month, stamped
 * at the month start — which is exactly what a monthly bar is, so the two mean
 * the same thing before they are compared.
 *
 * `constant` is a leg with no source at all: a flat line that rebases to the
 * principal and stays there. It is how "and this is what the cash would have
 * done" gets drawn without pretending cash is a security.
 */
export type MixedLeg =
  | {key: string; from: 'yahoo'; symbol: string}
  | {key: string; from: 'bitcoin'}
  | {key: string; from: 'constant'};

export type MixedJob = {
  source: 'mixed';
  legs: MixedLeg[];
  /** Yahoo range token for the market legs. Never 'max' — it coarsens per symbol. */
  range: string;
  interval: '1d' | '1mo';
  transform: 'invested' | 'pctChange' | 'raw';
  principal?: number;
  from?: string;
  /**
   * ISO day the run STOPS on, inclusive. Omit it and the film runs to the last
   * date every series reports, which is the default and the safe case.
   *
   * A WINDOW is the defect this whole format polices, so this option is
   * deliberately narrow: an end date is legitimate only when the window IS the
   * subject — the year a barrel of oil was worth less than nothing, the autumn
   * of a crash — and it is never a way to stop a race on the frame where a
   * favoured line happens to be ahead. The gate cannot tell those two apart by
   * looking at the numbers, so the author has to.
   */
  to?: string;
  /** What the basket does with dividends. See DIVIDEND_CLAUSE. */
  dividends?: Dividends;
  sourceLabel: string;
  sourceUrl: string;
};

/** Hand-entered numbers. `sourceUrl` is mandatory: a figure with no origin is not publishable. */
export type InlineJob = {
  source: 'inline';
  sourceLabel: string;
  sourceUrl: string;
  method: string;
  dates: string[];
  values: {key: string; values: (number | null)[]}[];
  notes?: string[];
};

export type FetchJob = YahooJob | FredJob | MixedJob | InlineJob;
