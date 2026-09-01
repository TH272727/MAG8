import { describeFetchError } from "../edgar";
import type { PriceBar } from "../db";

/* ============================================================================
 * Price bars — two independent sources behind one interface.
 *
 * One interface, many sources: the calculation layer never learns where a
 * number came from, and a source that stops working degrades one ticker rather
 * than the board. Every connector is fail-open — it returns a null series and a
 * reason, and never throws.
 *
 * The two sources are genuinely independent pipelines rather than mirrors of
 * each other, which is the only reason a fallback is worth having. They differ
 * in one way that matters enormously and silently:
 *
 *     the primary returns closes ADJUSTED for dividends; the fallback does not.
 *
 * Over three to five years of distributions those two series drift apart, so a
 * ratio built from one of each sits at a different LEVEL than a ratio built
 * from two of either. Every bar therefore records which source produced it and
 * whether it is adjusted, and lib/rotation/score.ts refuses to raise a signal
 * from a pair whose legs disagree. Silently swapping one for the other is the
 * exact failure this project has repeatedly found and repeatedly regretted.
 *
 * A refresh always re-fetches the FULL history rather than appending recent
 * days. Adjusted closes are revised backwards every time a distribution is
 * paid, so an append-only series would slowly diverge from the truth in a way
 * nothing would ever surface.
 * ========================================================================== */

export type PriceSourceId = "yahoo" | "nasdaq";

/** One daily close. Dates are ISO YYYY-MM-DD; series are chronological. */
export interface Bar {
  date: string;
  close: number;
}

export interface BarSeries {
  ticker: string;
  bars: Bar[];
  source: PriceSourceId;
  /** True when closes are adjusted for dividends and splits. */
  adjusted: boolean;
}

export interface FetchResult {
  series: BarSeries | null;
  /** Why the source could not answer. Present whenever `series` is null. */
  note?: string;
}

export interface PriceSource {
  id: PriceSourceId;
  label: string;
  adjusted: boolean;
  /**
   * MUST NOT throw: an unreachable source returns a null series and a reason,
   * and the board discloses the gap rather than failing the refresh.
   */
  fetch(ticker: string, opts: { years: number; timeoutMs: number; assetClass?: AssetClass }): Promise<FetchResult>;
}

/**
 * Which instrument a symbol is, for sources that need telling.
 *
 * The rotation board reads funds, so `etf` is the default and its behaviour is
 * unchanged. The insider scanner reads individual companies, and the fallback
 * source returns nothing at all for a common share asked for as a fund — a
 * silent empty answer, not an error.
 */
export type AssetClass = "etf" | "stocks";

/** Funds and one index. A leading caret is legal here and is rejected elsewhere in the app. */
const TICKER_RE = /^\^?[A-Za-z][A-Za-z0-9.-]{0,9}$/;

export const isValidTicker = (t: string): boolean => TICKER_RE.test(t);

/** True for index symbols, which the fallback source does not carry at all. */
export const isIndexSymbol = (t: string): boolean => t.startsWith("^");

/* ----------------------------------------------------------------------------
 * Rate limiter — one promise chain, global to the process.
 *
 * Modelled on lib/edgar.ts but deliberately a SEPARATE queue: these are
 * different hosts with different (undocumented) limits, and sharing one gate
 * would make a slow price fetch throttle SEC traffic for no reason.
 * -------------------------------------------------------------------------- */

type GlobalWithGate = typeof globalThis & { __mag8_rotation_gate?: { chain: Promise<void>; last: number } };

function gate(): { chain: Promise<void>; last: number } {
  const g = globalThis as GlobalWithGate;
  if (!g.__mag8_rotation_gate) g.__mag8_rotation_gate = { chain: Promise.resolve(), last: 0 };
  return g.__mag8_rotation_gate;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function takeSlot(gapMs: number): Promise<void> {
  const g = gate();
  const next = g.chain.then(async () => {
    const wait = g.last + gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    g.last = Date.now();
  });
  // Keep the chain alive even if a caller rejects downstream.
  g.chain = next.catch(() => undefined);
  return next;
}

const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/** Fetch with pacing and backoff. Throws; every caller wraps it. */
async function paced(url: string, timeoutMs: number, gapMs: number, retries = 2): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(1000 * 2 ** (attempt - 1)); // 1s, 2s
    await takeSlot(gapMs);
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        // Both hosts rate-limit or reject anonymous clients. This is the opposite
        // of the FRED rule in lib/bottleneck/supply.ts, which wants an honest UA;
        // do not cargo-cult one into the other.
        headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
      });
      if (RETRYABLE.has(res.status)) {
        lastErr = new Error(`HTTP ${res.status} (transient)`);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      // A definitive HTTP answer is not worth retrying.
      if (err instanceof Error && /^HTTP \d+$/.test(err.message)) throw err;
    }
  }
  throw new Error(describeFetchError(lastErr));
}

/** Unix seconds → YYYY-MM-DD. Daily bars are stamped at the exchange open, so UTC is correct. */
const isoDate = (unixSeconds: number): string => new Date(unixSeconds * 1000).toISOString().slice(0, 10);

const ymd = (d: Date): string => d.toISOString().slice(0, 10);

/* ----------------------------------------------------------------------------
 * Primary — adjusted daily closes.
 * -------------------------------------------------------------------------- */

interface YahooChart {
  chart?: {
    result?: {
      timestamp?: number[];
      indicators?: {
        adjclose?: { adjclose?: (number | null)[] }[];
        quote?: { close?: (number | null)[] }[];
      };
    }[];
    error?: { description?: string } | null;
  };
}

function makeYahoo(gapMs: number): PriceSource {
  return {
    id: "yahoo",
    label: "Primary daily closes, adjusted for distributions",
    adjusted: true,
    async fetch(ticker, { years, timeoutMs }) {
      if (!isValidTicker(ticker)) return { series: null, note: `"${ticker}" is not a usable symbol` };
      // BRK.B is BRK-B here; a caret is passed through as an index symbol.
      const symbol = ticker.toUpperCase().replace(/\./g, "-");
      const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?range=${years}y&interval=1d`;
      try {
        const body = await paced(url, timeoutMs, gapMs);
        const parsed = JSON.parse(body) as YahooChart;
        const res = parsed.chart?.result?.[0];
        if (!res) {
          const why = parsed.chart?.error?.description ?? "no result in the response";
          return { series: null, note: why };
        }
        const stamps = res.timestamp ?? [];
        // Adjusted closes are what we want; the raw close is a labelled last resort.
        const adj = res.indicators?.adjclose?.[0]?.adjclose;
        const raw = res.indicators?.quote?.[0]?.close;
        const values = adj ?? raw;
        const adjusted = Boolean(adj);
        if (!values || values.length !== stamps.length) {
          return { series: null, note: "price array did not line up with the date array" };
        }
        const bars: Bar[] = [];
        for (let i = 0; i < stamps.length; i++) {
          const v = values[i];
          // Padded rows are real: an index carries sessions its funds do not.
          if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
          bars.push({ date: isoDate(stamps[i]), close: v });
        }
        if (bars.length === 0) return { series: null, note: "no usable closes in the response" };
        return { series: { ticker, bars, source: "yahoo", adjusted } };
      } catch (err) {
        return { series: null, note: describeFetchError(err) };
      }
    },
  };
}

/* ----------------------------------------------------------------------------
 * Fallback — an independent pipeline, unadjusted closes.
 * -------------------------------------------------------------------------- */

interface NasdaqHistorical {
  data?: {
    tradesTable?: { rows?: { date?: string; close?: string }[] } | null;
  } | null;
  status?: { rCode?: number; bCodeMessage?: { errorMessage?: string }[] | null };
}

/** "$220.69" / "1,234.50" → 220.69 / 1234.5; anything else → null. */
export function parseMoney(raw: string | undefined): number | null {
  if (typeof raw !== "string") return null;
  const n = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "08/28/2026" → "2026-08-28"; anything else → null. */
export function parseUsDate(raw: string | undefined): string | null {
  if (typeof raw !== "string") return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

function makeNasdaq(gapMs: number): PriceSource {
  return {
    id: "nasdaq",
    label: "Independent daily closes, not adjusted for distributions",
    adjusted: false,
    async fetch(ticker, { years, timeoutMs, assetClass }) {
      if (!isValidTicker(ticker)) return { series: null, note: `"${ticker}" is not a usable symbol` };
      if (isIndexSymbol(ticker)) {
        return { series: null, note: "this source carries funds and shares, not index levels" };
      }
      const to = new Date();
      const from = new Date(to);
      from.setUTCFullYear(from.getUTCFullYear() - years);
      // This source needs telling what it is looking at: asked for a common
      // share as a fund it returns an empty table rather than an error.
      const url =
        `https://api.nasdaq.com/api/quote/${encodeURIComponent(ticker.toUpperCase())}/historical` +
        `?assetclass=${assetClass ?? "etf"}&fromdate=${ymd(from)}&todate=${ymd(to)}&limit=9999`;
      try {
        const body = await paced(url, timeoutMs, gapMs);
        const parsed = JSON.parse(body) as NasdaqHistorical;
        const rows = parsed.data?.tradesTable?.rows;
        if (!Array.isArray(rows) || rows.length === 0) {
          const why = parsed.status?.bCodeMessage?.[0]?.errorMessage ?? "no rows in the response";
          return { series: null, note: why };
        }
        const bars: Bar[] = [];
        for (const r of rows) {
          const date = parseUsDate(r.date);
          const close = parseMoney(r.close);
          if (date && close !== null) bars.push({ date, close });
        }
        if (bars.length === 0) return { series: null, note: "no usable closes in the response" };
        // This source answers newest-first; everything downstream wants chronological.
        bars.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        return { series: { ticker, bars, source: "nasdaq", adjusted: false } };
      } catch (err) {
        return { series: null, note: describeFetchError(err) };
      }
    },
  };
}

export function priceSources(gapMs: number): PriceSource[] {
  return [makeYahoo(gapMs), makeNasdaq(gapMs)];
}

/* ----------------------------------------------------------------------------
 * One ticker, primary then fallback.
 * -------------------------------------------------------------------------- */

export interface TickerFetch {
  ticker: string;
  series: BarSeries | null;
  /** Every source tried, in order, with what it said. Rendered on the desk. */
  attempts: { source: PriceSourceId; ok: boolean; bars: number; note?: string }[];
  /** Set when a series came back but was too short to be believable. */
  thin: boolean;
}

export interface FetchOptions {
  years: number;
  timeoutMs: number;
  gapMs: number;
  minBars: number;
  fallbackEnabled: boolean;
  /** Defaults to `etf` — the rotation board's whole catalog. */
  assetClass?: AssetClass;
}

/**
 * A short answer from a price source is far more often a fault at their end
 * than a real gap in market history, so a thin series is REPORTED rather than
 * quietly accepted — the same rule as the universe screen's implausibly-small
 * feed check. It is also not silently dropped: the caller sees the count.
 */
export async function fetchTicker(ticker: string, opts: FetchOptions): Promise<TickerFetch> {
  const sources = priceSources(opts.gapMs);
  const attempts: TickerFetch["attempts"] = [];
  let thin = false;

  for (const source of sources) {
    if (source.id !== "yahoo" && !opts.fallbackEnabled) break;
    const { series, note } = await source.fetch(ticker, {
      years: opts.years,
      timeoutMs: opts.timeoutMs,
      assetClass: opts.assetClass,
    });
    if (!series) {
      attempts.push({ source: source.id, ok: false, bars: 0, note });
      continue;
    }
    if (series.bars.length < opts.minBars) {
      thin = true;
      attempts.push({
        source: source.id,
        ok: false,
        bars: series.bars.length,
        note: `only ${series.bars.length} sessions returned, below the ${opts.minBars} required`,
      });
      continue;
    }
    attempts.push({ source: source.id, ok: true, bars: series.bars.length });
    return { ticker, series, attempts, thin: false };
  }
  return { ticker, series: null, attempts, thin };
}

/** A fetched series as rows ready for the store. */
export function toPriceBars(series: BarSeries): PriceBar[] {
  return series.bars.map((b) => ({
    ticker: series.ticker,
    date: b.date,
    close: b.close,
    adjusted: series.adjusted,
    source: series.source,
  }));
}
