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
};

export type FredJob = {
  source: 'fred';
  series: {key: string; id: string}[];
  /** 'raw' — the series as published. 'pctChange' — cumulative % from the base date. */
  transform: 'raw' | 'pctChange';
  from?: string;
  /**
   * Coarsen the shared date axis to the frequency the SLOWEST publisher uses.
   * Mixing a monthly series with a quarterly one otherwise leaves the quarterly
   * line full of holes, and a chart with holes in one line and not another is a
   * chart that will be read as a difference in the data.
   */
  sample?: 'monthly' | 'quarterly' | 'annual';
  sourceLabel?: string;
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

export type FetchJob = YahooJob | FredJob | InlineJob;
