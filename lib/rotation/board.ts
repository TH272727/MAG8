import { barCoverage, deleteBars, getBars, saveBars, type PriceBar } from "../db";
import { rotationEnabled, rotationSettings } from "../rotation-settings";
import { allIndicators, catalogTickers, CYCLE_PHASES, type Indicator } from "./catalog";
import { fetchTicker, toPriceBars } from "./bars";
import { rankReadings, scoreIndicator, type Reading, type ScoreResult } from "./score";
import { changesOn, daysSinceChange, detectChanges, type StateChange } from "./state";

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

/* ----------------------------------------------------------------------------
 * readBoard — stored bars in, every number the board reports out.
 *
 * No network and no writes. This is what both pages call, and it is why
 * retuning a weight in /admin changes the whole board, including the marks on
 * every chart, on the next page load and without refetching anything.
 * -------------------------------------------------------------------------- */

export interface BoardEntry {
  result: ScoreResult;
  changes: StateChange[];
  /** Calendar days since the last state change; null when it has never changed. */
  daysSince: number | null;
}

export interface SectorRow {
  ticker: string;
  indicatorId: string;
  label: string;
  /** Both legs, so the page can name the side the score favours. */
  base: string;
  quote: string | null;
  /** Three-month rate of change of the sector's ratio to the market. */
  relative3m: number | null;
  score: number | null;
  tier: Reading["tier"];
  direction: Reading["direction"];
}

export interface CycleReading {
  key: string;
  label: string;
  note: string;
  /** How many of the phase's historical leaders are in the current top four. */
  matched: string[];
  /** 0-1. Reported so a weak match reads as a weak match. */
  strength: number;
}

export interface Board {
  asOf: string | null;
  entries: BoardEntry[];
  /** Scored ratios, strongest first; unscorable ones sort last. */
  readings: Reading[];
  /** Context gauges, which carry no score by design. */
  context: Reading[];
  sectors: SectorRow[];
  cycle: CycleReading | null;
  /** State changes on the newest session — the only thing that may raise a note. */
  changesToday: StateChange[];
  unavailable: { id: string; label: string; reason: string }[];
  stale: boolean;
  disabled: boolean;
  flags: string[];
}

const SECTOR_LEADERS_CONSIDERED = 4;

export function readBoard(opts: { now?: Date; indicators?: Indicator[] } = {}): Board {
  const now = opts.now ?? new Date();
  const empty: Board = {
    asOf: null,
    entries: [],
    readings: [],
    context: [],
    sectors: [],
    cycle: null,
    changesToday: [],
    unavailable: [],
    stale: false,
    disabled: false,
    flags: [],
  };
  if (!rotationEnabled()) return { ...empty, disabled: true };

  const s = rotationSettings();
  const indicators = opts.indicators ?? allIndicators();
  const series = loadSeriesFor(indicators);

  const entries: BoardEntry[] = [];
  for (const indicator of indicators) {
    const result = scoreIndicator({
      indicator,
      base: series.get(indicator.base) ?? null,
      quote: indicator.quote ? (series.get(indicator.quote) ?? null) : null,
      settings: s,
      now,
    });
    const changes = detectChanges(indicator.id, result.history);
    entries.push({
      result,
      changes,
      daysSince: result.reading ? daysSinceChange(changes, result.reading.asOf) : null,
    });
  }

  const readings = entries
    .map((e) => e.result.reading)
    .filter((r): r is Reading => r !== null && r.kind === "ratio");
  const context = entries
    .map((e) => e.result.reading)
    .filter((r): r is Reading => r !== null && r.kind === "context");

  // The newest session any indicator could be computed to.
  const asOf = [...readings, ...context].map((r) => r.asOf).sort().pop() ?? null;

  const changesToday = asOf
    ? entries.flatMap((e) =>
        // A reading barred from raising a signal cannot contribute a change.
        e.result.reading?.signalEligible ? changesOn(e.changes, asOf) : [],
      )
    : [];

  const sectors = buildSectorRows(entries);
  const cycle = readCycle(sectors);

  const flags: string[] = [];
  const mixed = readings.filter((r) => r.basis.mixed);
  if (mixed.length > 0) {
    flags.push(
      `${mixed.length} ratio${mixed.length === 1 ? "" : "s"} combine legs from different price sources and ` +
        "cannot raise a signal until both legs come from the same one.",
    );
  }

  return {
    asOf,
    entries,
    readings: rankReadings(readings),
    context,
    sectors,
    cycle,
    changesToday,
    unavailable: entries
      .filter((e) => e.result.unavailable !== null)
      .map((e) => ({
        id: e.result.indicator.id,
        label: e.result.indicator.label,
        reason: e.result.unavailable!,
      })),
    stale: [...readings, ...context].some((r) => r.stale),
    disabled: false,
    flags,
  };
}

/** The eleven sector ratios, ranked by three-month relative strength. */
function buildSectorRows(entries: BoardEntry[]): SectorRow[] {
  const rows: SectorRow[] = [];
  for (const e of entries) {
    const ticker = e.result.indicator.sectorTicker;
    const r = e.result.reading;
    if (!ticker || !r) continue;
    rows.push({
      ticker,
      indicatorId: r.id,
      label: e.result.indicator.label,
      base: r.base,
      quote: r.quote,
      relative3m: r.roc3m,
      score: r.score,
      tier: r.tier,
      direction: r.direction,
    });
  }
  // Unmeasured sorts last: a sector with no reading must never look like a laggard.
  return rows.sort((a, b) => {
    if (a.relative3m === null || b.relative3m === null) {
      if (a.relative3m === b.relative3m) return a.ticker.localeCompare(b.ticker);
      return a.relative3m === null ? 1 : -1;
    }
    return b.relative3m - a.relative3m;
  });
}

/**
 * Which business-cycle phase current leadership most resembles.
 *
 * A convention from practitioner research, not a law, and reported with the
 * strength of the match so a weak one reads as weak. Sector composition also
 * drifts — the technology sector of today is not the one the convention was
 * originally described against — which the page states alongside this.
 */
function readCycle(sectors: SectorRow[]): CycleReading | null {
  const ranked = sectors.filter((s) => s.relative3m !== null);
  if (ranked.length < SECTOR_LEADERS_CONSIDERED) return null;
  const leaders = new Set(ranked.slice(0, SECTOR_LEADERS_CONSIDERED).map((s) => s.ticker));

  let best: CycleReading | null = null;
  for (const phase of CYCLE_PHASES) {
    const matched = phase.leaders.filter((t) => leaders.has(t));
    const strength = matched.length / Math.min(SECTOR_LEADERS_CONSIDERED, phase.leaders.length);
    if (!best || strength > best.strength) {
      best = { key: phase.key, label: phase.label, note: phase.note, matched, strength };
    }
  }
  return best && best.strength > 0 ? best : null;
}
