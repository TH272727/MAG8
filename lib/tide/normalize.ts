import { percentileRankAt, rollingPercentile, rollingZScore, sma } from "../rotation/math";
import type { TideSettings } from "../tide-settings";
import { PER_YEAR, type TideFrequency, type TideGauge, type TideSeries, type TideTransform } from "./catalog";

/* ============================================================================
 * Turning a published number into a judged one. PURE.
 *
 * No network, no database, no clock of its own. Everything here is a function
 * of the observations handed to it and the operator's dials.
 *
 * THE RULE THAT SHAPES THE WHOLE MODULE: a gauge is judged against its OWN
 * history, never against a fixed threshold. Saying that a price/earnings ratio
 * above twenty is expensive is an argument; saying it is higher than it has
 * been in ninety per cent of the past twenty years is a measurement. A desk
 * built on absolute thresholds is a desk full of hidden opinions, and it also
 * silently rots, because a threshold set against one era stops meaning what it
 * meant when the world moves.
 *
 * Anything that cannot be computed is null with a stated reason. There is no
 * default score, no neutral fill and no carried-forward value. A gauge nobody
 * can judge is NOT the same as a gauge sitting in the middle of its range, and
 * scoring the first as fifty would quietly pull every composite toward the
 * middle while looking like a complete reading.
 * ========================================================================== */

export interface Dated {
  /** YYYY-MM-DD. */
  date: string;
  value: number;
}

export type NormaliseSettings = Pick<
  TideSettings,
  "percentileWindowYears" | "zBlendPct" | "minObservations"
>;

/* ---------------------------------------------------------------------------
 * Combining two series
 * ------------------------------------------------------------------------- */

/**
 * Read `source` at each of `dates`, taking its most recent observation ON OR
 * BEFORE each one.
 *
 * This is sampling, not carrying forward. The distinction matters and is the
 * reason a ratio of two series is always evaluated on the dates of the LOWER
 * frequency leg: the total value of the stock market is published every day and
 * the size of the economy is published every quarter, so a daily "market value
 * against the economy" would be a daily numerator over a denominator invented
 * for the days between publications. Evaluated quarterly, both legs are real
 * numbers that were genuinely published, and the reading is simply less
 * frequent — which is the truth about it.
 *
 * `maxLagDays` stops a dead leg from being sampled forever: if the most recent
 * observation on or before a date is older than that, the result is null.
 */
export function sampleOnto(source: Dated[], dates: string[], maxLagDays: number): (number | null)[] {
  const out: (number | null)[] = new Array(dates.length).fill(null);
  if (source.length === 0) return out;
  let cursor = 0;
  let held: Dated | null = null;
  for (let i = 0; i < dates.length; i++) {
    const target = dates[i];
    while (cursor < source.length && source[cursor].date <= target) {
      held = source[cursor];
      cursor++;
    }
    if (!held) continue;
    const lag = dayGap(held.date, target);
    if (lag === null || lag > maxLagDays) continue;
    out[i] = held.value;
  }
  return out;
}

const DAY_MS = 86_400_000;

/** Whole days from `from` to `to`, both ISO dates. Null if either is unreadable. */
export function dayGap(from: string, to: string): number | null {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) / DAY_MS);
}

/** How stale a sampled leg may be, by the frequency of the leg being sampled onto. */
export function maxLagFor(frequency: TideFrequency): number {
  return frequency === "daily" ? 7 : frequency === "weekly" ? 21 : frequency === "monthly" ? 62 : 200;
}

/* ---------------------------------------------------------------------------
 * Transforms
 * ------------------------------------------------------------------------- */

/**
 * Apply a gauge's transform to a series. The output has the same length as the
 * input, with nulls wherever the window is not yet full or an input was
 * missing. Nothing is filled in and nothing is bridged across a gap.
 */
export function applyTransform(values: (number | null)[], t: TideTransform): (number | null)[] {
  const n = values.length;
  const out: (number | null)[] = new Array(n).fill(null);

  switch (t.mode) {
    case "level":
      return values.slice();

    case "changePct": {
      for (let i = t.periods; i < n; i++) {
        const now = values[i];
        const then = values[i - t.periods];
        // A percent change off a base at or below zero has no meaning; a series
        // that crosses zero must be scored with `change`, not `changePct`.
        if (now === null || then === null || then <= 0) continue;
        out[i] = ((now - then) / then) * 100;
      }
      return out;
    }

    case "change": {
      for (let i = t.periods; i < n; i++) {
        const now = values[i];
        const then = values[i - t.periods];
        if (now === null || then === null) continue;
        out[i] = now - then;
      }
      return out;
    }

    case "gapVsAveragePct": {
      const avg = sma(values, t.window);
      for (let i = 0; i < n; i++) {
        const now = values[i];
        const a = avg[i];
        if (now === null || a === null || a === 0) continue;
        out[i] = ((now - a) / a) * 100;
      }
      return out;
    }

    case "riseFromTrailingLow": {
      for (let i = t.window - 1; i < n; i++) {
        const now = values[i];
        if (now === null) continue;
        const low = windowExtreme(values, i, t.window, "min");
        if (low === null) continue;
        out[i] = now - low;
      }
      return out;
    }

    case "depthOfTrailingLow": {
      for (let i = t.window - 1; i < n; i++) {
        const low = windowExtreme(values, i, t.window, "min");
        if (low === null) continue;
        // Negated so the gauge reads HIGH when the series went deeply negative,
        // which is what lets it carry a single, unarguable polarity.
        out[i] = -low;
      }
      return out;
    }
  }
}

/**
 * The extreme of a trailing window. Null when the window is not fully
 * populated: a minimum taken over half a window is a different statistic, and
 * on a rising series it is systematically the wrong one.
 */
function windowExtreme(
  values: (number | null)[],
  index: number,
  window: number,
  which: "min" | "max",
): number | null {
  const start = index - window + 1;
  if (start < 0) return null;
  let best: number | null = null;
  for (let k = start; k <= index; k++) {
    const v = values[k];
    if (v === null) return null;
    if (best === null) best = v;
    else best = which === "min" ? Math.min(best, v) : Math.max(best, v);
  }
  return best;
}

/* ---------------------------------------------------------------------------
 * Preparing a gauge
 * ------------------------------------------------------------------------- */

export interface SeriesInput {
  series: TideSeries;
  observations: Dated[];
}

export interface PreparedGauge {
  gauge: TideGauge;
  /** Dates of the evaluated series — the lower-frequency leg where two combine. */
  dates: string[];
  /** The combined reading before the transform, in its own units. */
  raw: (number | null)[];
  /** What is actually judged. */
  values: (number | null)[];
  /** The effective frequency after combining. */
  frequency: TideFrequency;
  /** Set when the gauge cannot be built at all. A sentence, not a code. */
  unavailable: string | null;
}

const FREQ_RANK: Record<TideFrequency, number> = { daily: 3, weekly: 2, monthly: 1, quarterly: 0 };

/**
 * Assemble a gauge's evaluated series from the observations of its inputs.
 *
 * Never throws and never invents: a missing input, an unknown combine mode or
 * a series too short to transform all produce an `unavailable` sentence, which
 * is printed as-is rather than mapped to an error code nobody can read.
 */
export function prepareGauge(gauge: TideGauge, inputs: Map<string, SeriesInput>): PreparedGauge {
  const nothing = (why: string): PreparedGauge => ({
    gauge,
    dates: [],
    raw: [],
    values: [],
    frequency: "daily",
    unavailable: why,
  });

  const legs = gauge.inputs.map((id) => inputs.get(id));
  const missing = gauge.inputs.filter((id) => !inputs.get(id) || inputs.get(id)!.observations.length === 0);
  if (missing.length > 0) {
    return nothing(
      missing.length === gauge.inputs.length
        ? "no observations have been stored for this reading"
        : `no observations have been stored for ${missing.join(" and ")}`,
    );
  }

  const a = legs[0]!;
  if (gauge.combine === "single") {
    if (legs.length !== 1) return nothing("this reading names more than one series but does not say how to combine them");
    const dates = a.observations.map((o) => o.date);
    const raw = a.observations.map((o) => o.value * gauge.scale);
    return finish(gauge, dates, raw, a.series.frequency);
  }

  const b = legs[1];
  if (!b) return nothing("this reading combines two series but only one was given");

  // Evaluate on the lower-frequency leg's dates — see sampleOnto above.
  const aIsLower = FREQ_RANK[a.series.frequency] <= FREQ_RANK[b.series.frequency];
  const base = aIsLower ? a : b;
  const other = aIsLower ? b : a;
  const dates = base.observations.map((o) => o.date);
  const baseValues = base.observations.map((o) => o.value);
  const sampled = sampleOnto(other.observations, dates, maxLagFor(base.series.frequency));

  const raw: (number | null)[] = new Array(dates.length).fill(null);
  for (let i = 0; i < dates.length; i++) {
    const s = sampled[i];
    if (s === null) continue;
    // Restore the catalogue's own numerator/denominator order, whichever leg
    // ended up being the one sampled.
    const numerator = aIsLower ? baseValues[i] : s;
    const denominator = aIsLower ? s : baseValues[i];
    if (gauge.combine === "ratio") {
      if (denominator === 0) continue;
      raw[i] = (numerator / denominator) * gauge.scale;
    } else {
      raw[i] = (numerator - denominator) * gauge.scale;
    }
  }
  return finish(gauge, dates, raw, base.series.frequency);
}

function finish(
  gauge: TideGauge,
  dates: string[],
  raw: (number | null)[],
  frequency: TideFrequency,
): PreparedGauge {
  const values = applyTransform(raw, gauge.transform);
  return { gauge, dates, raw, values, frequency, unavailable: null };
}

/* ---------------------------------------------------------------------------
 * Stress
 * ------------------------------------------------------------------------- */

/**
 * Where a standard score sits on the nought-to-a-hundred scale.
 *
 * Three standard deviations reaches an end of the scale. This is a stated
 * convention rather than a distributional claim, and it is the reason the
 * standard score carries no weight by default: several of these series are
 * strongly skewed, and treating a distribution with one long tail as though it
 * were symmetrical puts an ordinary reading at an extreme.
 */
export const zToScale = (z: number): number => clamp0to100(50 + (50 * z) / 3);

const clamp0to100 = (n: number): number => Math.max(0, Math.min(100, n));

/**
 * Percentile and standard score in, stress out.
 *
 * Stress runs from 0 to 100 where 100 is maximally BAD for an equity owner.
 * The orientation is the gauge's `polarity` and nothing else, which is what
 * makes a good reading and a bad one the same arithmetic pointed two ways.
 */
export function stressFrom(
  percentile: number | null,
  zScore: number | null,
  polarity: TideGauge["polarity"],
  zBlendPct: number,
): number | null {
  if (percentile === null) return null;
  const blend = Math.max(0, Math.min(100, zBlendPct)) / 100;
  let position = percentile;
  if (blend > 0) {
    if (zScore === null) return null;
    position = percentile * (1 - blend) + zToScale(zScore) * blend;
  }
  return round1(polarity === "high-is-bad" ? position : 100 - position);
}

export const round1 = (n: number): number => Math.round(n * 10) / 10;

export interface GaugeReading {
  gauge: TideGauge;
  /** The reading in its own units, after combining and transforming. */
  value: number | null;
  /** The reading before the transform, in the series' published units. */
  rawValue: number | null;
  /** Date of the most recent usable observation. */
  asOf: string | null;
  percentile: number | null;
  zScore: number | null;
  /** 0-100, where 100 is maximally bad for an equity owner. Null when unmeasured. */
  stress: number | null;
  /** Usable observations behind the percentile. */
  observations: number;
  /** The window the percentile was taken over, in observations. */
  window: number;
  measured: boolean;
  /** Why there is no reading. A sentence, printed as-is. */
  unavailable: string | null;
  /** Set by the caller from the series' own freshness budget. */
  stale: boolean;
  staleReason: string | null;
  /** Present only when the caller asked for it — quadratic in the window. */
  history?: { date: string; value: number; stress: number }[];
}

export interface ScoreGaugeOptions {
  settings: NormaliseSettings;
  /** Whole-series stress, for a chart. Costs a rolling percentile; ask only when needed. */
  withHistory?: boolean;
}

/**
 * Score one prepared gauge.
 *
 * The window is stated in years by the operator and converted here using the
 * gauge's own effective frequency, so "twenty years" means twenty years whether
 * the series is published daily or quarterly. A window longer than the stored
 * history is narrowed to what exists and the observation count says so — the
 * alternative, refusing to read a gauge until two decades have accumulated,
 * would leave the desk blank for years over a distinction the reader can see.
 */
export function scoreGauge(prepared: PreparedGauge, opts: ScoreGaugeOptions): GaugeReading {
  const { gauge } = prepared;
  const s = opts.settings;

  const blank = (why: string): GaugeReading => ({
    gauge,
    value: null,
    rawValue: null,
    asOf: null,
    percentile: null,
    zScore: null,
    stress: null,
    observations: 0,
    window: 0,
    measured: false,
    unavailable: why,
    stale: true,
    staleReason: null,
  });

  if (prepared.unavailable) return blank(prepared.unavailable);

  const idx = lastDefined(prepared.values);
  if (idx < 0) {
    return blank(
      "the stored history is too short for this reading's own definition — " +
        "it needs a full window before it produces a first value",
    );
  }

  const usable = prepared.values.filter((v) => v !== null).length;
  if (usable < s.minObservations) {
    return blank(
      `only ${usable} usable observation${usable === 1 ? "" : "s"} of this reading exist, against the ` +
        `${s.minObservations} needed before it can be placed in its own history`,
    );
  }

  const perYear = PER_YEAR[prepared.frequency];
  const window = Math.max(s.minObservations, Math.min(usable, s.percentileWindowYears * perYear));

  const percentile = percentileRankAt(prepared.values, window, idx);
  const zScore = rollingZScore(prepared.values, window)[idx] ?? null;
  const stress = stressFrom(percentile, zScore, gauge.polarity, s.zBlendPct);

  const reading: GaugeReading = {
    gauge,
    value: prepared.values[idx],
    rawValue: prepared.raw[idx] ?? null,
    asOf: prepared.dates[idx] ?? null,
    percentile: percentile === null ? null : round1(percentile),
    zScore: zScore === null ? null : round1(zScore * 100) / 100,
    stress,
    observations: usable,
    window,
    measured: stress !== null,
    unavailable:
      stress === null ? "the reading exists but could not be placed in its own history" : null,
    stale: false,
    staleReason: null,
  };

  if (opts.withHistory) {
    const pct = rollingPercentile(prepared.values, window);
    const z = s.zBlendPct > 0 ? rollingZScore(prepared.values, window) : null;
    const history: { date: string; value: number; stress: number }[] = [];
    for (let i = 0; i < prepared.values.length; i++) {
      const v = prepared.values[i];
      const p = pct[i];
      if (v === null || p === null) continue;
      const st = stressFrom(p, z ? z[i] : null, gauge.polarity, s.zBlendPct);
      if (st === null) continue;
      history.push({ date: prepared.dates[i], value: v, stress: st });
    }
    reading.history = history;
  }

  return reading;
}

function lastDefined(values: (number | null)[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return i;
  return -1;
}

/* ---------------------------------------------------------------------------
 * The monthly grid
 * ------------------------------------------------------------------------- */

/**
 * The last index of each calendar month in a chronological date list.
 *
 * The composite is evaluated monthly, not daily. Most of what feeds it is
 * published monthly or quarterly, so a daily composite would be a handful of
 * daily series moving against a much larger set of numbers that had not
 * changed — precision invented between publications. Monthly also makes the
 * conditional history tractable: a rolling percentile is quadratic in its
 * window, and a monthly grid is about twenty times smaller than a daily one.
 */
export function monthEndIndices(dates: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < dates.length; i++) {
    const nextMonth = i + 1 < dates.length ? dates[i + 1].slice(0, 7) : null;
    if (nextMonth === null || nextMonth !== dates[i].slice(0, 7)) out.push(i);
  }
  return out;
}

/** Every month between two ISO dates inclusive, as YYYY-MM. */
export function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  let y = Number(first.slice(0, 4));
  let m = Number(first.slice(5, 7));
  const endY = Number(last.slice(0, 4));
  const endM = Number(last.slice(5, 7));
  if (!Number.isFinite(y) || !Number.isFinite(m)) return out;
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 12 * (MAX_MONTH_SPAN_YEARS + 1)) break;
  }
  return out;
}

const MAX_MONTH_SPAN_YEARS = 60;
