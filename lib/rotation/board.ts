import { barCoverage, deleteBars, getBars, saveBars, type PriceBar } from "../db";
import { rotationEnabled, rotationSettings } from "../rotation-settings";
import { allIndicators, catalogTickers, type Indicator } from "./catalog";
import { fetchTicker, toPriceBars } from "./bars";

/* ============================================================================
 * Board orchestration — the only module here that both fetches and persists.
 *
 * Two halves, deliberately separate:
 *
 *   refreshBars()  network → store. Manual, admin-triggered, or from the CLI.
 *   readBoard()    store → every number the board reports. No network, ever.
 *
 * There is no scheduler and none is wanted: the pipeline this app is built
 * around must never be restarted mid-run, and a background job is the easiest
 * way to do that by accident. A refresh is something a person or a script does.
 * ========================================================================== */

export interface TickerReport {
  ticker: string;
  ok: boolean;
  bars: number;
  source: string | null;
  adjusted: boolean | null;
  /** The source answered, but with too little history to be believable. */
  thin: boolean;
  /** Set when this ticker's stored history was replaced wholesale — see below. */
  rebased: boolean;
  note?: string;
}

export interface RefreshReport {
  takenAt: string;
  tickers: TickerReport[];
  stored: number;
  ok: number;
  failed: number;
  thin: number;
  /** True when nothing at all was read — the refresh is then withheld entirely. */
  readNothing: boolean;
  disabled: boolean;
}

/**
 * Fetch every catalog ticker and store its daily closes.
 *
 * Two rules earn their place here:
 *
 * 1. A ticker that cannot be fetched writes NOTHING, so its previously stored
 *    history stays exactly as it was. A failed refresh degrades the board's
 *    freshness and says so; it never replaces a good reading with an empty one.
 *
 * 2. If a series arrives on a different basis than the one already stored —
 *    the fallback source stepping in for the primary, say, which means
 *    unadjusted closes replacing adjusted ones — the ticker's history is
 *    REPLACED rather than merged. Merging would leave one series whose early
 *    years are adjusted and whose recent ones are not, with a discontinuity at
 *    the join that no downstream statistic could distinguish from a real move.
 */
export async function refreshBars(
  opts: { tickers?: string[]; dryRun?: boolean } = {},
): Promise<RefreshReport> {
  const takenAt = new Date().toISOString();
  if (!rotationEnabled()) {
    return { takenAt, tickers: [], stored: 0, ok: 0, failed: 0, thin: 0, readNothing: true, disabled: true };
  }

  const s = rotationSettings();
  const wanted = opts.tickers ?? catalogTickers();
  const existing = new Map(barCoverage().map((c) => [c.ticker, c]));
  const reports: TickerReport[] = [];
  let stored = 0;

  for (const ticker of wanted) {
    const result = await fetchTicker(ticker, {
      years: s.historyYears,
      timeoutMs: s.fetchTimeoutMs,
      gapMs: s.fetchGapMs,
      minBars: s.minBars,
      fallbackEnabled: s.fallbackEnabled,
    });

    if (!result.series) {
      const last = result.attempts[result.attempts.length - 1];
      reports.push({
        ticker,
        ok: false,
        bars: 0,
        source: null,
        adjusted: null,
        thin: result.thin,
        rebased: false,
        note: last?.note ?? "no source answered",
      });
      continue;
    }

    const series = result.series;
    const prior = existing.get(ticker);
    const basisChanged = Boolean(prior) && (prior!.source !== series.source || prior!.adjusted !== series.adjusted);

    if (!opts.dryRun) {
      if (basisChanged) deleteBars(ticker);
      stored += saveBars(toPriceBars(series));
    }

    reports.push({
      ticker,
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
    });
  }

  const ok = reports.filter((r) => r.ok).length;
  return {
    takenAt,
    tickers: reports,
    stored,
    ok,
    failed: reports.filter((r) => !r.ok).length,
    thin: reports.filter((r) => r.thin).length,
    readNothing: ok === 0,
    disabled: false,
  };
}

/* ----------------------------------------------------------------------------
 * Reading stored bars back out.
 * -------------------------------------------------------------------------- */

export interface StoredSeries {
  ticker: string;
  bars: PriceBar[];
  source: PriceBar["source"] | null;
  adjusted: boolean | null;
}

/** Load one ticker. An absent or empty series comes back with null metadata, never a guess. */
export function loadSeries(ticker: string, limit = 3000): StoredSeries {
  const bars = getBars(ticker, limit);
  if (bars.length === 0) return { ticker, bars, source: null, adjusted: null };
  const last = bars[bars.length - 1];
  return { ticker, bars, source: last.source, adjusted: last.adjusted };
}

/** Every ticker an indicator set needs, loaded once and shared across ratios. */
export function loadSeriesFor(indicators: Indicator[] = allIndicators()): Map<string, StoredSeries> {
  const out = new Map<string, StoredSeries>();
  for (const ticker of catalogTickers(indicators)) out.set(ticker, loadSeries(ticker));
  return out;
}
