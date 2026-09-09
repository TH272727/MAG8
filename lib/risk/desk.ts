import {
  deleteRiskBars,
  getStoredBars,
  saveRiskBars,
  storedBarSummary,
  type BarStore,
  type PriceBar,
} from "../db";
import { benchmarkTicker, riskEnabled, riskSettings, type RiskSettings } from "../risk-settings";
import { fetchTicker, toPriceBars } from "../rotation/bars";
import { readLedger, type LedgerRow } from "../crossdesk";
import { readTide } from "../tide/desk";
import type { Exposure } from "../tide/score";
import { commonGrid, groupBars, tail, toReturns, type ReturnSeries } from "./returns";
import { atExposure, buildSleeve, type Sleeve } from "./sleeve";
import {
  assessName,
  buildPairs,
  compareNames,
  summarisePairs,
  type NameRisk,
  type Pair,
  type PairSummary,
  type ScoreOptions,
} from "./score";
import { round1 } from "./stats";

/* ============================================================================
 * The Risk Desk — orchestration. The only module here that fetches or persists.
 *
 * Two halves, deliberately separate, exactly as the rotation board and the tide
 * are built:
 *
 *   refreshRisk()  network → store. Manual, admin-triggered, or from the CLI.
 *   readRisk()     store → every number the desk reports. No network, ever.
 *
 * And one rule that is this desk's own: NOTHING DERIVED IS STORED. There is no
 * volatility table, no correlation table and no ranking table. Every figure is
 * re-derived on read from stored closes, which is what makes changing the
 * window a free operation for a visitor rather than a refresh — the same
 * property that lets the insider scanner recompute its whole funnel, including
 * every rejection reason, when a reader picks a different risk tolerance.
 *
 * What this desk does NOT do, and will not be extended to do: propose a trade,
 * suggest a weight, size a position against a balance, or connect to a broker.
 * It reports and it flags. An instrument that starts recommending stops being
 * an instrument.
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * Population
 * -------------------------------------------------------------------------- */

export interface PopulationRow {
  ticker: string;
  companyName: string | null;
  sector: string | null;
  desks: number;
  /** True when more than one desk named it — the default population. */
  crossed: boolean;
}

export interface Population {
  rows: PopulationRow[];
  /** Everything the ledger named, before the cap. */
  totalNamed: number;
  truncated: boolean;
  reason: string | null;
}

/**
 * Which companies this desk measures.
 *
 * The companies more than one desk named, because that is the list a reader is
 * most likely to be holding in their head as a group — and a group is the only
 * thing a correlation is about. The ledger is read, never recomputed: it stores
 * nothing itself and derives on read, so asking it costs one pass over bytes
 * the other desks already wrote.
 */
export function population(s: RiskSettings): Population {
  const ledger = readLedger();
  const pool: LedgerRow[] = s.includeSingleDesk ? [...ledger.crossed, ...ledger.single] : ledger.crossed;
  const rows = pool.map((r) => ({
    ticker: r.ticker,
    companyName: r.companyName,
    sector: r.sector,
    desks: r.desks,
    crossed: r.crossedBy.length > 0,
  }));
  const capped = rows.slice(0, s.maxNames);
  return {
    rows: capped,
    totalNamed: ledger.totalNamed,
    truncated: rows.length > capped.length,
    reason: ledger.disabled
      ? "The cross-desk ledger is switched off, so this desk has no list of companies to measure."
      : rows.length === 0
        ? "No company has been named by more than one desk yet, so there is no basket to measure."
        : null,
  };
}

/* ----------------------------------------------------------------------------
 * Refresh — the network half
 * -------------------------------------------------------------------------- */

export interface TickerReport {
  ticker: string;
  ok: boolean;
  bars: number;
  /** Where the closes came from: an existing desk's store, or a fresh fetch. */
  from: BarStore | "fetched" | null;
  source: string | null;
  adjusted: boolean | null;
  thin: boolean;
  rebased: boolean;
  note?: string;
}

export interface RefreshReport {
  takenAt: string;
  tickers: TickerReport[];
  stored: number;
  ok: number;
  failed: number;
  reused: number;
  disabled: boolean;
  /** True when nothing at all could be read. The board keeps its old figures. */
  readNothing: boolean;
}

/** Sessions in a calendar year, for turning a years setting into a row count. */
const SESSIONS_PER_YEAR = 252;

/**
 * Price every company in the population, reusing what other desks already hold.
 *
 * The reuse test is deliberately strict about what "already have it" means: a
 * store qualifies only if it holds enough rows for the configured window AND
 * its newest close is inside the staleness budget. A store with four years of
 * history that stopped updating in March is worse than useless here, because
 * every figure computed from it would be a figure about March presented as a
 * figure about today.
 *
 * A ticker that cannot be fetched writes NOTHING, so its previously stored
 * history stays exactly as it was — a failed refresh degrades freshness and
 * says so, and never replaces a good series with an empty one. And a series
 * arriving on a different basis REPLACES the stored one rather than merging
 * with it, for the reason the rotation board learned: a series whose early
 * years are dividend-adjusted and whose recent ones are not has a step change
 * at the join that no downstream statistic can tell from a real move.
 */
export async function refreshRisk(
  opts: { tickers?: string[]; dryRun?: boolean; force?: boolean } = {},
): Promise<RefreshReport> {
  const takenAt = new Date().toISOString();
  const base: RefreshReport = {
    takenAt,
    tickers: [],
    stored: 0,
    ok: 0,
    failed: 0,
    reused: 0,
    disabled: false,
    readNothing: true,
  };
  if (!riskEnabled()) return { ...base, disabled: true };

  const s = riskSettings();
  const wanted = opts.tickers ?? [...population(s).rows.map((r) => r.ticker), benchmarkTicker()];
  const unique = [...new Set(wanted.map((t) => t.trim().toUpperCase()).filter(Boolean))];

  const needRows = Math.max(s.minSessions, Math.min(s.volWindowDays, s.historyYears * SESSIONS_PER_YEAR));
  const staleBefore = new Date(Date.now() - s.barsStaleDays * 86_400_000).toISOString().slice(0, 10);

  const reports: TickerReport[] = [];
  let stored = 0;
  let reused = 0;

  for (const ticker of unique) {
    const inventory = storedBarSummary(ticker);

    if (!opts.force) {
      const usable = inventory.find((i) => i.rows >= needRows && i.newest >= staleBefore);
      if (usable) {
        const sample = getStoredBars(usable.store, ticker, 1);
        reused++;
        reports.push({
          ticker,
          ok: true,
          bars: usable.rows,
          from: usable.store,
          source: sample[0]?.source ?? null,
          adjusted: sample[0]?.adjusted ?? null,
          thin: false,
          rebased: false,
          note: `already held by the ${usable.store} store, through ${usable.newest}`,
        });
        continue;
      }
    }

    const result = await fetchTicker(ticker, {
      years: s.historyYears,
      timeoutMs: s.fetchTimeoutMs,
      gapMs: s.fetchGapMs,
      minBars: s.minBars,
      fallbackEnabled: s.fallbackEnabled,
      // Everything this desk measures is a common share. The fallback source
      // answers "Symbol not exists" for a company asked for as a fund, which is
      // a silent empty answer rather than an error.
      assetClass: ticker.startsWith("^") ? "etf" : "stocks",
    });

    if (!result.series) {
      const last = result.attempts[result.attempts.length - 1];
      reports.push({
        ticker,
        ok: false,
        bars: 0,
        from: null,
        source: null,
        adjusted: null,
        thin: result.thin,
        rebased: false,
        note: last?.note ?? "no source answered",
      });
      continue;
    }

    const series = result.series;
    const ownStore = inventory.find((i) => i.store === "risk");
    let rebased = false;
    if (ownStore) {
      const sample = getStoredBars("risk", ticker, 1);
      rebased = sample.length > 0 && (sample[0].source !== series.source || sample[0].adjusted !== series.adjusted);
    }

    if (!opts.dryRun) {
      if (rebased) deleteRiskBars(ticker);
      stored += saveRiskBars(toPriceBars(series));
    }

    reports.push({
      ticker,
      ok: true,
      bars: series.bars.length,
      from: "fetched",
      source: series.source,
      adjusted: series.adjusted,
      thin: false,
      rebased,
    });
  }

  const ok = reports.filter((r) => r.ok).length;
  return {
    takenAt,
    tickers: reports,
    stored,
    ok,
    failed: reports.length - ok,
    reused,
    disabled: false,
    readNothing: ok === 0,
  };
}

/* ----------------------------------------------------------------------------
 * Read — never networks
 * -------------------------------------------------------------------------- */

export interface BoardName extends NameRisk {
  companyName: string | null;
  sector: string | null;
  desks: number;
  /** Which stored series answered for this company. */
  store: BarStore | null;
}

export interface RiskBoard {
  asOf: string | null;
  settings: RiskSettings;
  benchmark: string;
  names: BoardName[];
  /** Truncated to the row cap; the full count is `names.length`. */
  shown: BoardName[];
  truncated: boolean;
  pairs: Pair[];
  pairSummary: PairSummary;
  sleeve: Sleeve;
  /** Names excluded from the basket for too little shared history. */
  sleeveExcluded: { ticker: string; sessions: number }[];
  /** The Tide's published equity band, when it has one. */
  exposure: Exposure | null;
  /** Sleeve volatility scaled to each end of that band. */
  atBand: { low: number | null; high: number | null } | null;
  totalNamed: number;
  measured: number;
  unmeasured: number;
  stale: boolean;
  flags: string[];
  disabled: boolean;
  empty: boolean;
}

export interface ReadOptions {
  now?: Date;
  /** Skip the tide read. Used by tests and by the coverage report. */
  withExposure?: boolean;
}

/**
 * Load the best stored series for each company, one store per ticker.
 *
 * Never networks, and never merges two stores for the same company. The store
 * with the longest history answers; the caller is told which one, so a figure
 * can always be traced back to the desk whose refresh produced the prices.
 */
export function loadHistories(tickers: string[], limit: number): Map<string, { bars: PriceBar[]; store: BarStore }> {
  const out = new Map<string, { bars: PriceBar[]; store: BarStore }>();
  for (const ticker of tickers) {
    const inventory = storedBarSummary(ticker);
    if (inventory.length === 0) continue;
    const best = inventory[0];
    const bars = getStoredBars(best.store, ticker, limit);
    if (bars.length > 0) out.set(ticker.toUpperCase(), { bars, store: best.store });
  }
  return out;
}

export function readRisk(opts: ReadOptions = {}): RiskBoard {
  const s = riskSettings();
  const benchmark = benchmarkTicker();

  const emptySleeve: Sleeve = {
    tickers: [],
    sessions: 0,
    from: null,
    to: null,
    volPct: null,
    averageMemberVolPct: null,
    effectivePositions: null,
    totalReturnPct: null,
    drawdown: null,
    beta: null,
    benchmarkVolPct: null,
    benchmarkTicker: benchmark,
    benchmarkSessions: null,
    contributions: [],
    returns: [],
    dates: [],
  };
  const empty: RiskBoard = {
    asOf: null,
    settings: s,
    benchmark,
    names: [],
    shown: [],
    truncated: false,
    pairs: [],
    pairSummary: { together: 0, namesInvolved: 0, mixedBasisSuppressed: 0, strongest: null },
    sleeve: emptySleeve,
    sleeveExcluded: [],
    exposure: null,
    atBand: null,
    totalNamed: 0,
    measured: 0,
    unmeasured: 0,
    stale: false,
    flags: [],
    disabled: false,
    empty: true,
  };
  if (!riskEnabled()) return { ...empty, disabled: true };

  const pop = population(s);
  const flags: string[] = [];
  if (pop.reason) flags.push(pop.reason);
  if (pop.truncated) {
    flags.push(
      `More companies are named than this desk measures in one pass, so it measured the first ${s.maxNames} of ` +
        `them. The rest are listed by the cross-desk ledger and are not missing, only unmeasured here.`,
    );
  }
  if (pop.rows.length === 0) return { ...empty, totalNamed: pop.totalNamed, flags };

  // Read enough rows to fill the window with room to spare: a return series is
  // one shorter than the bars it came from, and asking for exactly the window
  // would leave it one session short.
  const limit = Math.max(s.volWindowDays + 2, s.sleeveMinSessions + 2, s.minSessions + 2);
  const tickers = pop.rows.map((r) => r.ticker);
  const histories = loadHistories([...tickers, benchmark], limit);

  const benchHistory = histories.get(benchmark);
  const benchReturns = benchHistory
    ? tail(toReturns(groupBars(benchHistory.bars).get(benchmark)?.history ?? {
        ticker: benchmark,
        bars: [],
        adjusted: true,
        source: "yahoo",
      }), s.volWindowDays)
    : null;
  if (!benchHistory) {
    flags.push(
      `No stored price history for ${benchmark}, so nothing on this page is measured against the market. ` +
        `Every other figure still stands on its own.`,
    );
  }

  const scoreOpts: ScoreOptions = {
    minSessions: s.minSessions,
    togetherAt: s.togetherAt,
    maxPairs: s.maxPairs,
  };

  const seriesByTicker = new Map<string, ReturnSeries>();
  const meta = new Map(pop.rows.map((r) => [r.ticker, r]));
  const names: BoardName[] = [];
  let newest: string | null = null;
  const mixedWithin: string[] = [];

  for (const ticker of tickers) {
    const held = histories.get(ticker);
    const info = meta.get(ticker);
    const shell: BoardName = {
      ticker,
      companyName: info?.companyName ?? null,
      sector: info?.sector ?? null,
      desks: info?.desks ?? 0,
      store: held?.store ?? null,
      volPct: null,
      downsideVolPct: null,
      beta: null,
      drawdown: null,
      totalReturnPct: null,
      sessions: 0,
      from: null,
      to: null,
      adjusted: true,
      source: "yahoo",
      measured: false,
      reason: "no-history",
      riskSharePct: null,
      inSleeve: false,
    };
    if (!held) {
      names.push(shell);
      continue;
    }

    const grouped = groupBars(held.bars).get(ticker);
    if (!grouped) {
      names.push(shell);
      continue;
    }
    if (grouped.mixedWithinTicker) mixedWithin.push(ticker);

    const full = toReturns(grouped.history);
    const windowed = tail(full, s.volWindowDays);
    seriesByTicker.set(ticker, windowed);

    const assessed = assessName(windowed, benchReturns, scoreOpts);
    const last = grouped.history.bars[grouped.history.bars.length - 1]?.date ?? null;
    if (last && (newest === null || last > newest)) newest = last;

    names.push({
      ...assessed,
      companyName: info?.companyName ?? null,
      sector: info?.sector ?? null,
      desks: info?.desks ?? 0,
      store: held.store,
    });
  }

  const measurable = [...seriesByTicker.values()].filter(
    (x) => names.find((n) => n.ticker === x.ticker)?.measured,
  );
  const pairs = buildPairs(measurable, scoreOpts);

  const grid = commonGrid(measurable, s.sleeveMinSessions);
  const sleeve = buildSleeve({
    grid,
    benchmark: benchReturns
      ? { ticker: benchmark, dates: benchReturns.dates, values: benchReturns.values }
      : null,
    minBenchmarkSessions: s.minSessions,
  });

  const shareByTicker = new Map(sleeve.contributions.map((c) => [c.ticker, c.riskSharePct]));
  for (const n of names) {
    if (grid.columns.has(n.ticker)) {
      n.inSleeve = true;
      n.riskSharePct = shareByTicker.get(n.ticker) ?? null;
    }
  }
  names.sort(compareNames);

  let exposure: Exposure | null = null;
  let atBand: RiskBoard["atBand"] = null;
  if (opts.withExposure !== false) {
    try {
      const tide = readTide({ now: opts.now });
      if (!tide.disabled && !tide.empty) {
        exposure = tide.exposure;
        atBand = {
          low: atExposure(sleeve.volPct, tide.exposure.low),
          high: atExposure(sleeve.volPct, tide.exposure.high),
        };
      }
    } catch {
      // The tide is a separate desk with its own store and its own kill switch.
      // If it cannot answer, this page loses one row and keeps every other.
      exposure = null;
    }
  }

  if (mixedWithin.length > 0) {
    flags.push(
      `Stored closes for ${mixedWithin.join(", ")} do not all come from the same source. The most recent basis ` +
        `was used and the older rows should be replaced by a forced refresh.`,
    );
  }
  if (grid.excluded.length > 0) {
    flags.push(
      `${grid.excluded.length} of the companies measured here have too little shared history to join the basket ` +
        `and were left out of it rather than shortening everyone else's window to theirs.`,
    );
  }
  if (sleeve.tickers.length < 2) {
    flags.push(
      "Fewer than two companies have enough shared history for a basket, so the co-movement figures below are " +
        "not measured. That is a statement about the price records, not about the companies.",
    );
  }
  if (sleeve.effectivePositions !== null && sleeve.effectivePositions > sleeve.tickers.length) {
    // Real, and deliberately not clamped. Members that moved against one
    // another leave the basket steadier than the same number of independent
    // bets would — but "more effective positions than positions" needs a
    // sentence, or it reads as an arithmetic error.
    flags.push(
      `The basket has more effective positions than it has members, which happens when its companies have ` +
        `moved against each other rather than merely apart. It is steadier than the same number of ` +
        `independent holdings would be, over this window.`,
    );
  }
  if (sleeve.benchmarkSessions !== null && sleeve.benchmarkSessions < sleeve.sessions) {
    flags.push(
      `${benchmark} is stored by another desk and its history reaches ${sleeve.sessions - sleeve.benchmarkSessions} ` +
        `session(s) less far forward than the basket's, so the market comparison is measured over ` +
        `${sleeve.benchmarkSessions} of the basket's ${sleeve.sessions} sessions. Refreshing that desk closes ` +
        `the gap.`,
    );
  }
  if (benchHistory && sleeve.tickers.length >= 2 && sleeve.benchmarkSessions === null) {
    flags.push(
      `${benchmark} has stored prices but too few of them overlap the basket's window, so nothing here is ` +
        `measured against the market.`,
    );
  }

  const staleBefore = new Date((opts.now ?? new Date()).getTime() - s.barsStaleDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const stale = newest !== null && newest < staleBefore;
  if (stale) {
    flags.push(
      `The newest stored close is from ${newest}, older than the ${s.barsStaleDays}-day budget. Every figure ` +
        `here describes the market as of that date.`,
    );
  }

  const measured = names.filter((n) => n.measured).length;

  return {
    asOf: newest,
    settings: s,
    benchmark,
    names,
    shown: names.slice(0, s.maxRows),
    truncated: names.length > s.maxRows,
    pairs,
    pairSummary: summarisePairs(pairs),
    sleeve,
    sleeveExcluded: grid.excluded,
    exposure,
    atBand,
    totalNamed: pop.totalNamed,
    measured,
    unmeasured: names.length - measured,
    stale,
    flags,
    disabled: false,
    empty: names.length === 0,
  };
}

/* ----------------------------------------------------------------------------
 * Coverage — what is stored, for the CLI and /admin
 * -------------------------------------------------------------------------- */

export interface CoverageRow {
  ticker: string;
  store: BarStore | null;
  rows: number;
  oldest: string | null;
  newest: string | null;
  stores: number;
}

export function riskCoverage(): CoverageRow[] {
  const s = riskSettings();
  const rows = [...population(s).rows.map((r) => r.ticker), benchmarkTicker()];
  const out: CoverageRow[] = [];
  for (const ticker of [...new Set(rows)]) {
    const inv = storedBarSummary(ticker);
    const best = inv[0];
    out.push({
      ticker,
      store: best?.store ?? null,
      rows: best?.rows ?? 0,
      oldest: best?.oldest ?? null,
      newest: best?.newest ?? null,
      stores: inv.length,
    });
  }
  return out.sort((a, b) => b.rows - a.rows);
}

/** One-line summary of the basket, for a CLI header. Percentages, one decimal. */
export function sleeveHeadline(board: RiskBoard): string {
  const { sleeve } = board;
  if (sleeve.volPct === null) return "basket not measured";
  const eff =
    sleeve.effectivePositions === null
      ? "not measured"
      : `${round1(sleeve.effectivePositions)} of ${sleeve.tickers.length}`;
  return `${sleeve.volPct}% volatility, ${eff} effective positions, ${sleeve.sessions} sessions`;
}
