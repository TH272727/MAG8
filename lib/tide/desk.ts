import {
  getTideObservations,
  saveTideObservations,
  tideCoverage,
  type TideObservation,
} from "../db";
import { tideEnabled, tideSettings, type TideSettings } from "../tide-settings";
import {
  BREADTH_ABOVE_AVERAGE,
  BREADTH_HIGHS_LOWS,
  countBreadth,
  loadBreadthBars,
  refreshBreadthBars,
  type BreadthFetchReport,
} from "./breadth";
import {
  allGauges,
  allSeries,
  getSeries,
  requiredSeries,
  type TideGauge,
  type TideHorizon,
  type TideSeries,
} from "./catalog";
import { computeTideBaseRates, type TideBaseRates } from "./baserates";
import { freshnessOf, getConnector, type Freshness } from "./feeds";
import {
  monthlyFrom,
  prepareGauge,
  scoreGauge,
  toMonthly,
  type Dated,
  type GaugeReading,
  type SeriesInput,
} from "./normalize";
import {
  buildComposite,
  computeExposure,
  postureFor,
  rankReadings,
  splitGoodBad,
  weightedComposite,
  type Composite,
  type Exposure,
  type GoodBad,
  type Posture,
} from "./score";

/* ============================================================================
 * The Tide — orchestration.
 *
 * Two halves, deliberately separate:
 *
 *   refreshTide()  network → store. Manual, admin-triggered, or from the CLI.
 *   readTide()     store → every number the desk reports. No network, ever.
 *
 * There is no scheduler and none is wanted: the research pipeline this
 * application is built around must never be restarted mid-run, and a
 * background job is the easiest way to do that by accident. A refresh is
 * something a person or a script does.
 *
 * The read path stores nothing and derives everything, so changing a weight
 * on the settings page re-derives the whole desk — today's reading, the family
 * aggregates, both composites, the exposure band and the entire conditional
 * history — on the next page load, with no fetches and no stored verdict that
 * could outlive the reasoning that produced it.
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * Refresh
 * ------------------------------------------------------------------------- */

export interface SeriesReport {
  seriesId: string;
  label: string;
  ok: boolean;
  observations: number;
  first: string | null;
  latest: string | null;
  /** Rows dated after today, dropped as projections rather than stored. */
  droppedFuture: number;
  stale: boolean;
  note?: string;
}

export interface RefreshReport {
  takenAt: string;
  series: SeriesReport[];
  ok: number;
  failed: number;
  skipped: number;
  stored: number;
  breadth: BreadthFetchReport | null;
  /** True when every source that was asked failed. */
  readNothing: boolean;
  disabled: boolean;
}

/**
 * Fetch every series a gauge needs, and recount breadth.
 *
 * Two rules, both the same rule the other desks follow:
 *
 * 1. A SERIES THAT CANNOT BE FETCHED WRITES NOTHING. A dead network is not a
 *    market fact, and a refresh that read nothing must never be persisted over
 *    a good reading — that mistake blanked a working desk once already.
 *
 * 2. A REFRESH RE-SENDS THE FULL HISTORY rather than appending recent dates,
 *    because statistical agencies revise. The newer value for a date that
 *    already exists is the current official one.
 */
export async function refreshTide(
  opts: { seriesIds?: string[]; dryRun?: boolean; onProgress?: (msg: string) => void } = {},
): Promise<RefreshReport> {
  const takenAt = new Date().toISOString();
  if (!tideEnabled()) {
    return {
      takenAt,
      series: [],
      ok: 0,
      failed: 0,
      skipped: 0,
      stored: 0,
      breadth: null,
      readNothing: true,
      disabled: true,
    };
  }

  const s = tideSettings();
  const wanted = requiredSeries().filter((x) => !opts.seriesIds || opts.seriesIds.includes(x.id));
  const reports: SeriesReport[] = [];
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let stored = 0;

  for (const series of wanted) {
    const connector = getConnector(series.connector);
    if (!connector) {
      reports.push(blankReport(series, `no connector named "${series.connector}"`));
      failed++;
      continue;
    }
    opts.onProgress?.(`${series.id} — ${series.label}`);

    // A locally computed or hand-entered series is written by its own path and
    // must be left exactly as it is; it is not a failure that nothing fetched it.
    if (series.connector === "manual") {
      const stock = getTideObservations(series.id);
      reports.push({
        seriesId: series.id,
        label: series.label,
        ok: stock.length > 0,
        observations: stock.length,
        first: stock[0]?.date ?? null,
        latest: stock[stock.length - 1]?.date ?? null,
        droppedFuture: 0,
        stale: false,
        note: "not fetched — computed locally or entered by hand",
      });
      skipped++;
      continue;
    }

    const result = await connector.fetch(series, {
      years: s.historyYears,
      timeoutMs: s.fetchTimeoutMs,
      gapMs: s.fetchGapMs,
    });

    if (result.observations.length === 0) {
      reports.push(blankReport(series, result.note ?? "the source returned nothing"));
      failed++;
      continue;
    }

    const trimmed = trimToYears(result.observations, s.historyYears);
    if (!opts.dryRun) {
      stored += saveTideObservations(
        trimmed.map((o) => ({ seriesId: series.id, date: o.date, value: o.value })),
      );
    }
    ok++;
    const latest = trimmed[trimmed.length - 1]?.date ?? null;
    reports.push({
      seriesId: series.id,
      label: series.label,
      ok: true,
      observations: trimmed.length,
      first: trimmed[0]?.date ?? null,
      latest,
      droppedFuture: result.droppedFuture,
      stale: freshnessOf(series, latest, new Date(), s.staleGracePct).stale,
      note:
        result.droppedFuture > 0
          ? `${result.droppedFuture} row${result.droppedFuture === 1 ? "" : "s"} dated in the future were ` +
            "dropped as projections rather than stored as observations"
          : undefined,
    });
  }

  /* Breadth: hundreds of individual requests, then one count over all of them. */
  let breadth: BreadthFetchReport | null = null;
  if (!opts.seriesIds) {
    opts.onProgress?.("counting breadth across the screened universe");
    breadth = await refreshBreadthBars(s, {
      dryRun: opts.dryRun,
      onProgress: (done, total) => {
        if (done % 50 === 0 || done === total) opts.onProgress?.(`breadth ${done}/${total}`);
      },
    });
    if (!opts.dryRun && breadth.ok > 0) {
      const counted = countBreadth(s, loadBreadthBars(s.breadthHistoryYears * 252 + 252));
      if (!counted.unavailable) {
        stored += saveTideObservations(toRows(BREADTH_ABOVE_AVERAGE, counted.aboveAverage));
        stored += saveTideObservations(toRows(BREADTH_HIGHS_LOWS, counted.highsLows));
      }
    }
  }

  return {
    takenAt,
    series: reports,
    ok,
    failed,
    skipped,
    stored,
    breadth,
    readNothing: ok === 0 && failed > 0,
    disabled: false,
  };
}

const toRows = (seriesId: string, rows: Dated[]): TideObservation[] =>
  rows.map((r) => ({ seriesId, date: r.date, value: r.value }));

function blankReport(series: TideSeries, note: string): SeriesReport {
  return {
    seriesId: series.id,
    label: series.label,
    ok: false,
    observations: 0,
    first: null,
    latest: null,
    droppedFuture: 0,
    stale: true,
    note,
  };
}

/** Keep the most recent `years` of a chronological series. */
function trimToYears(rows: Dated[], years: number): Dated[] {
  if (rows.length === 0) return rows;
  const cutoff = new Date();
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  const iso = cutoff.toISOString().slice(0, 10);
  return rows.filter((r) => r.date >= iso);
}

/* ---------------------------------------------------------------------------
 * Read
 * ------------------------------------------------------------------------- */

export interface TideBoard {
  asOf: string | null;
  fast: Composite;
  slow: Composite;
  goodBad: GoodBad;
  exposure: Exposure;
  posture: Posture;
  /** Reported, never scored — recession dating and the level of rates. */
  context: GaugeReading[];
  /** Every scored reading, most stressed first, unmeasured last. */
  readings: GaugeReading[];
  /** Readings with no number and the reason there is none. */
  unavailable: { id: string; label: string; reason: string }[];
  /** Series that answered but have stopped being published. */
  stale: { id: string; label: string; reason: string }[];
  baseRates: TideBaseRates | null;
  /** Desk-level cautions, printed verbatim. */
  flags: string[];
  disabled: boolean;
  empty: boolean;
}

export interface ReadOptions {
  now?: Date;
  gauges?: TideGauge[];
  /** Conditional history of the fast composite. Roughly doubles the work. */
  withBaseRates?: boolean;
  /** Per-gauge stress history, for charts. */
  withHistory?: boolean;
}

/** Every stored observation for the series a gauge set needs. NEVER networks. */
export function loadSeriesData(gauges: TideGauge[] = allGauges()): Map<string, SeriesInput> {
  const out = new Map<string, SeriesInput>();
  for (const series of requiredSeries(gauges, allSeries())) {
    const rows = getTideObservations(series.id);
    if (rows.length === 0) continue;
    out.set(series.id, { series, observations: rows.map((r) => ({ date: r.date, value: r.value })) });
  }
  return out;
}

/**
 * Read the whole desk. No network, ever.
 *
 * Every gauge is scored on the monthly grid, including its current reading, so
 * the number on the board is literally the last point of the chart beneath it.
 */
export function readTide(opts: ReadOptions = {}): TideBoard {
  const now = opts.now ?? new Date();
  const s = tideSettings();
  const gauges = opts.gauges ?? allGauges();

  const blank: TideBoard = {
    asOf: null,
    fast: emptyComposite("fast"),
    slow: emptyComposite("slow"),
    goodBad: {
      good: [],
      bad: [],
      neutral: [],
      goodWeightPct: null,
      badWeightPct: null,
      neutralWeightPct: null,
      measured: 0,
      unmeasured: 0,
    },
    exposure: computeExposure(emptyComposite("fast"), emptyComposite("slow"), s),
    posture: "unmeasured",
    context: [],
    readings: [],
    unavailable: [],
    stale: [],
    baseRates: null,
    flags: [],
    disabled: false,
    empty: false,
  };

  if (!tideEnabled()) return { ...blank, disabled: true, empty: true };

  const inputs = loadSeriesData(gauges);
  if (inputs.size === 0) return { ...blank, empty: true };

  const prepared = gauges.map((gauge) => toMonthly(prepareGauge(gauge, inputs)));
  const readings = prepared.map((p) =>
    applyFreshness(scoreGauge(p, { settings: s, withHistory: opts.withHistory }), inputs, now, s),
  );

  const scored = readings.filter((r) => r.gauge.kind === "scored");
  const context = readings.filter((r) => r.gauge.kind === "context");

  const fast = buildComposite("fast", scored, s);
  const slow = buildComposite("slow", scored, s);
  const goodBad = splitGoodBad([fast, slow]);
  const exposure = computeExposure(fast, slow, s);

  const asOf = scored
    .map((r) => r.asOf)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop() ?? null;

  const baseRates = opts.withBaseRates ? fastBaseRates(prepared, inputs, s) : null;

  return {
    asOf,
    fast,
    slow,
    goodBad,
    exposure,
    posture: postureFor(fast),
    context,
    readings: rankReadings(scored),
    unavailable: readings
      .filter((r) => r.unavailable && !r.stale)
      .map((r) => ({ id: r.gauge.id, label: r.gauge.label, reason: r.unavailable as string })),
    stale: readings
      .filter((r) => r.stale && r.staleReason)
      .map((r) => ({ id: r.gauge.id, label: r.gauge.label, reason: r.staleReason as string })),
    baseRates,
    flags: deskFlags(fast, slow, goodBad, readings),
    disabled: false,
    empty: false,
  };
}

function emptyComposite(horizon: TideHorizon): Composite {
  return {
    horizon,
    stress: null,
    families: [],
    measuredGauges: 0,
    totalGauges: 0,
    weightCoveragePct: null,
    partial: true,
    unavailable: "nothing has been stored for this horizon yet",
  };
}

/**
 * A reading whose newest input has stopped being published is marked stale and
 * excluded from every aggregate.
 *
 * The freshest of a gauge's inputs is not the right test — a ratio is only as
 * current as its OLDEST leg, since that is the last date on which both legs
 * were genuinely published.
 */
function applyFreshness(
  reading: GaugeReading,
  inputs: Map<string, SeriesInput>,
  now: Date,
  s: TideSettings,
): GaugeReading {
  const checks: Freshness[] = [];
  for (const id of reading.gauge.inputs) {
    const input = inputs.get(id);
    const series = input?.series ?? getSeries(id);
    if (!series) continue;
    const latest = input?.observations[input.observations.length - 1]?.date ?? null;
    checks.push(freshnessOf(series, latest, now, s.staleGracePct));
  }
  // A dead source is reported as dead; a source that has never published here
  // is reported as unmeasured. Both are excluded from every aggregate, but
  // only one of them is news.
  const dead = checks.find((c) => c.stale);
  if (dead) {
    return {
      ...reading,
      stale: true,
      staleReason: dead.reason,
      measured: false,
      unavailable: reading.unavailable ?? dead.reason,
    };
  }
  const absent = checks.find((c) => c.never);
  if (absent) {
    return { ...reading, measured: false, unavailable: reading.unavailable ?? absent.reason };
  }
  return reading;
}

/**
 * The conditional history of the FAST composite against what the market did
 * next. The slow composite deliberately does not get one: a ten-year claim
 * measured over thirty years of history is three non-overlapping observations,
 * and dressing that up in overlapping windows is precisely the error the
 * literature on long-horizon predictability describes.
 */
function fastBaseRates(
  prepared: (ReturnType<typeof toMonthly>)[],
  inputs: Map<string, SeriesInput>,
  s: TideSettings,
): TideBaseRates | null {
  const market = inputs.get("spx");
  if (!market) return null;

  // gauge id -> month -> stress, from the SAME history the charts show.
  const byMonth = new Map<string, { family: TideGauge["family"]; stress: number }[]>();
  for (const p of prepared) {
    if (p.gauge.kind !== "scored" || p.gauge.horizon !== "fast") continue;
    const scored = scoreGauge(p, { settings: s, withHistory: true });
    for (const point of scored.history ?? []) {
      const month = point.date.slice(0, 7);
      const list = byMonth.get(month) ?? [];
      list.push({ family: p.gauge.family, stress: point.stress });
      byMonth.set(month, list);
    }
  }

  const composite = [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, members]) => ({
      month,
      value: weightedComposite(
        members.map((m) => ({ family: m.family, stress: m.stress })),
        "fast",
        s,
      ).stress,
    }))
    .filter((p): p is { month: string; value: number } => p.value !== null);

  if (composite.length === 0) return null;

  return computeTideBaseRates({
    composite,
    market: monthlyFrom(market.observations),
    settings: s,
  });
}

/**
 * Cautions about the desk as a whole, as opposed to about one reading. Each is
 * a full sentence because each is printed exactly as it stands.
 */
function deskFlags(fast: Composite, slow: Composite, goodBad: GoodBad, readings: GaugeReading[]): string[] {
  const flags: string[] = [];

  if (fast.stress !== null && slow.stress !== null && Math.abs(fast.stress - slow.stress) >= 25) {
    const dearer = slow.stress > fast.stress;
    flags.push(
      dearer
        ? "The two horizons disagree sharply: the market is priced expensively against its own history while " +
          "the cycle readings are benign. That combination is normal rather than contradictory — expensive " +
          "markets can stay expensive for years — and it is the reason this desk publishes two figures " +
          "instead of averaging them into one."
        : "The two horizons disagree sharply: the cycle readings are poor while the market is not " +
          "expensively priced. Cheapness is not a floor, and the near-term reading is the one with any " +
          "historical claim to describing the coming year.",
    );
  }

  if (goodBad.unmeasured > 0) {
    flags.push(
      `${goodBad.unmeasured} reading${goodBad.unmeasured === 1 ? "" : "s"} could not be measured and ` +
        "contributed nothing rather than being counted as neutral, so the weights above were shared out " +
        "among the readings that could.",
    );
  }

  const breadth = readings.filter((r) => r.gauge.family === "breadth" && r.measured);
  if (breadth.length > 0) {
    flags.push(
      "Breadth is counted over this platform's own screened universe rather than a published index, using " +
        "the companies that are largest today. Reading today's constituents backwards flatters the past, so " +
        "the historical comparison is mildly unkind to the present reading.",
    );
  }

  flags.push(
    "The macroeconomic series here are revised after publication, and the desk reads today's vintage " +
      "rather than the one a reader would have seen at the time. Market prices are not revised, which is " +
      "one reason the near-term reading leans on them.",
  );

  return flags;
}

/* ---------------------------------------------------------------------------
 * Coverage
 * ------------------------------------------------------------------------- */

export interface CoverageRow {
  seriesId: string;
  label: string;
  connector: string;
  observations: number;
  first: string | null;
  latest: string | null;
  stale: boolean;
  reason: string | null;
}

/** What is stored, without loading a single series. NEVER networks. */
export function tideCoverageReport(now: Date = new Date()): CoverageRow[] {
  const s = tideSettings();
  const stored = new Map(tideCoverage().map((c) => [c.seriesId, c]));
  return requiredSeries().map((series) => {
    const row = stored.get(series.id);
    const fresh = freshnessOf(series, row?.latest ?? null, now, s.staleGracePct);
    return {
      seriesId: series.id,
      label: series.label,
      connector: series.connector,
      observations: row?.observations ?? 0,
      first: row?.first ?? null,
      latest: row?.latest ?? null,
      stale: fresh.stale,
      reason: fresh.reason,
    };
  });
}
