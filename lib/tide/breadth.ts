import {
  deleteTideBars,
  getTideBars,
  latestUniverseSnapshot,
  saveTideBars,
  tideBarTickers,
  type PriceBar,
} from "../db";
import { fetchTicker, toPriceBars } from "../rotation/bars";
import type { TideSettings } from "../tide-settings";
import { screenUniverse } from "../universe";
import { universeSettings } from "../universe-settings";
import type { Dated } from "./normalize";

/* ============================================================================
 * Counted breadth — the one reading here that no public feed sells.
 *
 * Every other gauge on this desk is a number somebody else published. This one
 * is counted, one company at a time, from the screened universe this
 * application already maintains: how many of the largest names are trading
 * above their own long average, and how many are making new one-year highs
 * against new lows. An index can rise for months on a handful of very large
 * companies while most of the market has already turned, and nothing else on
 * this desk would notice.
 *
 * THE UNIVERSE IS READ STRICTLY READ-ONLY. `latestUniverseSnapshot()` and the
 * pure `screenUniverse()`, never `getWeeklyUniverse()` — the same rule the
 * insider scanner established, and for the same reason: a refresh a visitor can
 * press must never be able to trigger a market-wide screener fetch.
 *
 * TWO HONEST LIMITS, both disclosed wherever the reading appears:
 *
 * 1. SURVIVORSHIP. The companies counted are the largest TODAY, and their
 *    prices are read backwards. Today's largest companies are disproportionately
 *    the ones that did well, so historical breadth computed this way is biased
 *    UPWARD, which makes today's reading look worse against its own past than a
 *    properly point-in-time count would. The bias runs against the desk rather
 *    than for it, which is the safer direction, but it is a bias.
 *
 * 2. A SHORTER HISTORY. Keeping thirty years of daily closes for five hundred
 *    companies is millions of rows for one reading, so breadth keeps a few
 *    years. The percentile it is judged against is correspondingly shorter, and
 *    the reading says so.
 * ========================================================================== */

export type BreadthSettings = Pick<
  TideSettings,
  | "breadthUniverseSize"
  | "breadthAverageDays"
  | "breadthMinCompanies"
  | "breadthHistoryYears"
  | "breadthEnabled"
  | "fetchTimeoutMs"
  | "fetchGapMs"
>;

/** The two series this module writes. Both are `manual` in the catalogue: nothing fetches them. */
export const BREADTH_ABOVE_AVERAGE = "breadth-200dma";
export const BREADTH_HIGHS_LOWS = "breadth-highs-lows";

/* ---------------------------------------------------------------------------
 * Which companies
 * ------------------------------------------------------------------------- */

export interface BreadthUniverse {
  tickers: string[];
  /** Names considered before the size cut. */
  eligible: number;
  /** Why there is no list. A sentence. */
  unavailable: string | null;
  /** ISO week of the snapshot the list came from. */
  weekKey: string | null;
}

/**
 * The largest screened companies, by market capitalisation.
 *
 * Reads the stored snapshot and screens it with the pure function, so this
 * costs no network at all and cannot set off a refresh of anything else.
 */
export function breadthUniverse(size: number): BreadthUniverse {
  const snapshot = latestUniverseSnapshot();
  if (!snapshot) {
    return {
      tickers: [],
      eligible: 0,
      weekKey: null,
      unavailable: "no universe snapshot has been stored, so there is no list of companies to count",
    };
  }
  const screened = screenUniverse(snapshot.rows, snapshot.extras, universeSettings());
  const eligible = screened.eligible;
  if (eligible.length === 0) {
    return {
      tickers: [],
      eligible: 0,
      weekKey: snapshot.isoWeek,
      unavailable: "the stored universe snapshot screened down to no eligible companies",
    };
  }
  const tickers = [...eligible]
    .sort((a, b) => b.c - a.c)
    .slice(0, size)
    .map((r) => r.t);
  return { tickers, eligible: eligible.length, weekKey: snapshot.isoWeek, unavailable: null };
}

/* ---------------------------------------------------------------------------
 * Fetching
 * ------------------------------------------------------------------------- */

export interface BreadthFetchReport {
  requested: number;
  ok: number;
  failed: number;
  rebased: number;
  storedBars: number;
  skipped: boolean;
  /** Present when nothing was attempted. */
  note?: string;
}

/**
 * Fetch and store daily closes for the breadth constituents.
 *
 * The price fetcher is the one the rest of this application uses, told that it
 * is being asked about common shares rather than funds — the fallback source
 * answers "Symbol not exists" to a share requested as a fund, which is not an
 * error and produces no series, so a caller that forgets has a silently dead
 * fallback for every company.
 *
 * The board's mixed-basis rule applies and matters here: a company's history
 * that is adjusted for dividends in its early years and not in its recent ones
 * has a discontinuity that reads as a real move, so when the basis changes the
 * stored history is REPLACED rather than merged.
 */
export async function refreshBreadthBars(
  s: BreadthSettings,
  opts: { dryRun?: boolean; onProgress?: (done: number, total: number) => void } = {},
): Promise<BreadthFetchReport> {
  if (!s.breadthEnabled) {
    return { requested: 0, ok: 0, failed: 0, rebased: 0, storedBars: 0, skipped: true, note: "breadth counting is switched off" };
  }
  const universe = breadthUniverse(s.breadthUniverseSize);
  if (universe.unavailable) {
    return { requested: 0, ok: 0, failed: 0, rebased: 0, storedBars: 0, skipped: true, note: universe.unavailable };
  }

  let ok = 0;
  let failed = 0;
  let rebased = 0;
  let storedBars = 0;

  for (let i = 0; i < universe.tickers.length; i++) {
    const ticker = universe.tickers[i];
    const out = await fetchTicker(ticker, {
      years: s.breadthHistoryYears,
      timeoutMs: s.fetchTimeoutMs,
      gapMs: s.fetchGapMs,
      minBars: Math.min(200, s.breadthAverageDays),
      fallbackEnabled: true,
      assetClass: "stocks",
    });
    opts.onProgress?.(i + 1, universe.tickers.length);
    if (!out.series) {
      failed++;
      continue;
    }
    ok++;
    if (opts.dryRun) continue;
    const existing = getTideBars(ticker, 1);
    if (existing.length > 0 && (existing[0].source !== out.series.source || existing[0].adjusted !== out.series.adjusted)) {
      deleteTideBars(ticker);
      rebased++;
    }
    storedBars += saveTideBars(toPriceBars(out.series));
  }

  return { requested: universe.tickers.length, ok, failed, rebased, storedBars, skipped: false };
}

/* ---------------------------------------------------------------------------
 * Counting
 * ------------------------------------------------------------------------- */

export interface BreadthResult {
  aboveAverage: Dated[];
  highsLows: Dated[];
  companies: number;
  asOf: string | null;
  unavailable: string | null;
}

/**
 * Count breadth across every stored date, from bars alone.
 *
 * Computing the whole history rather than only today is what makes the reading
 * scoreable: a percentage above a moving average means nothing without knowing
 * where that percentage usually sits, and the desk judges every gauge against
 * its own past.
 *
 * A date is counted only if enough companies have a usable reading on it, so
 * the early edge of the window — where most series have not yet accumulated
 * their own average — produces no observation rather than a percentage of the
 * handful that had.
 */
export function countBreadth(s: BreadthSettings, bars: Map<string, PriceBar[]>): BreadthResult {
  if (bars.size === 0) {
    return {
      aboveAverage: [],
      highsLows: [],
      companies: 0,
      asOf: null,
      unavailable: "no company price history has been stored, so breadth cannot be counted",
    };
  }

  const window = s.breadthAverageDays;
  const yearWindow = 252;

  // date -> [above, total, highs, lows]
  const tally = new Map<string, [number, number, number, number]>();

  for (const series of bars.values()) {
    if (series.length < window) continue;
    let sum = 0;
    for (let i = 0; i < series.length; i++) {
      sum += series[i].close;
      if (i >= window) sum -= series[i - window].close;
      if (i < window - 1) continue;
      const average = sum / window;
      const close = series[i].close;

      // A 52-week extreme needs a full year behind it; before that the
      // question cannot be asked, so it is not answered.
      let high = 0;
      let low = 0;
      if (i >= yearWindow - 1) {
        let max = -Infinity;
        let min = Infinity;
        for (let k = i - yearWindow + 1; k <= i; k++) {
          const c = series[k].close;
          if (c > max) max = c;
          if (c < min) min = c;
        }
        if (close >= max) high = 1;
        if (close <= min) low = 1;
      }

      const date = series[i].date;
      const row = tally.get(date) ?? [0, 0, 0, 0];
      if (close > average) row[0] += 1;
      row[1] += 1;
      row[2] += high;
      row[3] += low;
      tally.set(date, row);
    }
  }

  const dates = [...tally.keys()].sort();
  const aboveAverage: Dated[] = [];
  const highsLows: Dated[] = [];
  let companies = 0;

  for (const date of dates) {
    const [above, total, highs, lows] = tally.get(date)!;
    if (total < s.breadthMinCompanies) continue;
    companies = Math.max(companies, total);
    aboveAverage.push({ date, value: (100 * above) / total });
    highsLows.push({ date, value: (100 * (highs - lows)) / total });
  }

  if (aboveAverage.length === 0) {
    return {
      aboveAverage: [],
      highsLows: [],
      companies: 0,
      asOf: null,
      unavailable:
        `no date had price history for the ${s.breadthMinCompanies} companies required before a share of ` +
        "the market is worth quoting",
    };
  }

  return {
    aboveAverage,
    highsLows,
    companies,
    asOf: aboveAverage[aboveAverage.length - 1].date,
    unavailable: null,
  };
}

/** Load every stored breadth series. One query per company; used only on refresh. */
export function loadBreadthBars(limit: number): Map<string, PriceBar[]> {
  const out = new Map<string, PriceBar[]>();
  for (const ticker of tideBarTickers()) {
    const bars = getTideBars(ticker, limit);
    if (bars.length > 0) out.set(ticker, bars);
  }
  return out;
}
