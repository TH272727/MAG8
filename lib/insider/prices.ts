import { deleteInsiderBars, getInsiderBars, insiderBarCoverage, saveInsiderBars, type PriceBar } from "../db";
import { fetchTicker, toPriceBars } from "../rotation/bars";
import type { Close } from "./drawdown";

/* ============================================================================
 * Price history for scanner candidates.
 *
 * The fetching is the rotation board's, unchanged: two independent sources
 * behind one fail-open interface, a primary that adjusts closes for dividends
 * and an independent fallback that does not. Reusing it means a source that
 * stops working degrades one company rather than the whole scan, and it means
 * there is one place in this codebase that knows how to ask for a price.
 *
 * One thing had to be added for company shares. The fallback source is told
 * which kind of instrument it is being asked about, and the board — which reads
 * only funds — had that pinned to funds. Asked for a common share as a fund it
 * answers "Symbol not exists", which is not an error and produces no series:
 * the fallback was silently unavailable for every company this scanner looks
 * at. It is now told the truth about what it is being asked for.
 *
 * MIXED PRICE BASIS, the board's rule, and it matters more here. A drawdown is
 * a percentage between two prices, so a series whose early years are adjusted
 * for dividends and whose recent ones are not has a discontinuity that reads as
 * a real move. When the basis changes, a company's stored history is REPLACED
 * rather than merged, and a company still carrying a mixed basis is reported.
 * ========================================================================== */

export interface PriceFetchOutcome {
  ticker: string;
  ok: boolean;
  bars: number;
  source: PriceBar["source"] | null;
  adjusted: boolean | null;
  /** The source answered with too little history to be believable. */
  thin: boolean;
  /** The stored history was replaced because the price basis changed. */
  rebased: boolean;
  note?: string;
}

export interface PriceFetchOptions {
  years: number;
  timeoutMs: number;
  gapMs?: number;
  minBars?: number;
  fallbackEnabled?: boolean;
  dryRun?: boolean;
}

/**
 * A short answer from a price source is far more often a fault at their end
 * than a real gap in market history. But a genuinely young company also has a
 * short history, and this scanner reads companies rather than decade-old funds,
 * so the floor is set at roughly one trading year rather than the board's two —
 * enough to compute the 52-week figures the whole filter rests on, and low
 * enough not to throw away a recent listing an insider is buying.
 */
const MIN_BARS = 240;
const GAP_MS = 150;

/**
 * Fetch one company's closes and store them.
 *
 * A company that cannot be fetched writes NOTHING, so its previously stored
 * history stays exactly as it was. A failed fetch degrades the scan's freshness
 * and says so; it never replaces a good history with an empty one.
 */
export async function refreshPrices(ticker: string, opts: PriceFetchOptions): Promise<PriceFetchOutcome> {
  const symbol = ticker.toUpperCase();
  const existing = insiderBarCoverage().find((c) => c.ticker === symbol);

  const result = await fetchTicker(symbol, {
    years: opts.years,
    timeoutMs: opts.timeoutMs,
    gapMs: opts.gapMs ?? GAP_MS,
    minBars: opts.minBars ?? MIN_BARS,
    fallbackEnabled: opts.fallbackEnabled ?? true,
    assetClass: "stocks",
  });

  if (!result.series) {
    const last = result.attempts[result.attempts.length - 1];
    return {
      ticker: symbol,
      ok: false,
      bars: 0,
      source: null,
      adjusted: null,
      thin: result.thin,
      rebased: false,
      note: last?.note ?? "no source answered",
    };
  }

  const series = result.series;
  const basisChanged =
    existing !== undefined && (existing.source !== series.source || existing.adjusted !== series.adjusted);

  if (!opts.dryRun) {
    if (basisChanged) deleteInsiderBars(symbol);
    saveInsiderBars(toPriceBars(series));
  }

  return {
    ticker: symbol,
    ok: true,
    bars: series.bars.length,
    source: series.source,
    adjusted: series.adjusted,
    thin: false,
    rebased: basisChanged,
    note: basisChanged
      ? `history replaced: price basis changed to ${series.source}, ` +
        `${series.adjusted ? "adjusted" : "not adjusted"} for distributions`
      : undefined,
  };
}

export interface StoredPrices {
  ticker: string;
  closes: Close[];
  source: PriceBar["source"] | null;
  adjusted: boolean | null;
  /** More than one source or adjustment basis in this company's stored history. */
  mixedBasis: boolean;
}

/** Load one company's stored closes. Absent history returns null metadata, never a guess. */
export function loadPrices(ticker: string, coverage?: Map<string, { mixed: boolean }>): StoredPrices {
  const symbol = ticker.toUpperCase();
  const bars = getInsiderBars(symbol);
  if (bars.length === 0) {
    return { ticker: symbol, closes: [], source: null, adjusted: null, mixedBasis: false };
  }
  const last = bars[bars.length - 1];
  return {
    ticker: symbol,
    closes: bars.map((b) => ({ date: b.date, close: b.close })),
    source: last.source,
    adjusted: last.adjusted,
    mixedBasis: coverage?.get(symbol)?.mixed ?? false,
  };
}

/** Coverage keyed by ticker, so a whole board read costs one query. */
export function priceCoverage(): Map<string, { mixed: boolean; bars: number; latest: string }> {
  return new Map(
    insiderBarCoverage().map((c) => [c.ticker, { mixed: c.mixed, bars: c.bars, latest: c.latest }]),
  );
}
