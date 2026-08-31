import type { RotationSettings } from "../rotation-settings";
import type { Indicator, RotationCategory } from "./catalog";
import {
  alignOnDate,
  lastDefinedIndex,
  percentileRankAt,
  rateOfChangeAt,
  ratioSeries,
  rollingPercentile,
  rollingZScore,
  round1,
  sma,
  wilderRsi,
  type DatedValue,
} from "./math";

/* ============================================================================
 * Scoring — pure. No network, no database, no clock of its own.
 *
 * Given two price series and the operator's settings, produce today's reading
 * and the whole history of readings behind it. The history is computed rather
 * than logged, which is the reason the chart can mark five years of state
 * changes on the day the board first runs, and the reason those marks stay
 * correct when a weight is retuned instead of describing an old weighting.
 *
 * Rules this module keeps:
 *   - Anything that cannot be computed is null with a stated reason. There is
 *     no default score, no neutral fill, no carried-forward value.
 *   - A ratio whose two legs came from different price sources is measured and
 *     displayed but never allowed to raise a signal — see basis, below.
 *   - An easing signal is reported exactly as prominently as a building one.
 * ========================================================================== */

export type Tier = "strong" | "building" | "neutral" | "none";

export const TIER_META: Record<Tier, { label: string; short: string; rank: number }> = {
  strong: { label: "Strong Pivot Signal", short: "STRONG", rank: 3 },
  building: { label: "Building", short: "BUILDING", rank: 2 },
  neutral: { label: "Neutral / Rangebound", short: "RANGEBOUND", rank: 1 },
  none: { label: "No Signal", short: "NO SIGNAL", rank: 0 },
};

export type DirectionKey = "favors-base" | "favors-quote" | "balanced";

/** The published method fixes these; they describe the method, not a preference. */
const SMA_FAST = 50;
const SMA_SLOW = 200;
const RSI_PERIOD = 14;
/** Sessions used to ask whether the fast average is still moving with the gap. */
const CONFIRM_LOOKBACK = 20;
const ROC_1M = 21;
const ROC_3M = 63;
const ROC_6M = 126;
/** A percentile is 0-100 and neutral at 50, so half the range maps onto ten marks. */
const PERCENTILE_DIVISOR = 5;

export type ScoreSettings = Pick<
  RotationSettings,
  | "trendFullPct"
  | "trendUnconfirmedFactor"
  | "zScale"
  | "rsiDivisor"
  | "zWindowDays"
  | "percentileWindowDays"
  | "weightTrend"
  | "weightStretch"
  | "weightMomentum"
  | "weightPercentile"
  | "directionDeadbandPct"
  | "strongTierMin"
  | "buildingTierMin"
  | "neutralTierMin"
  | "minBars"
  | "barsStaleDays"
>;

/** One leg. Deliberately not the database row type: this module imports no storage. */
export interface SeriesInput {
  ticker: string;
  bars: DatedValue[];
  source: string | null;
  adjusted: boolean | null;
}

export interface DailyState {
  date: string;
  score: number | null;
  tier: Tier;
  direction: DirectionKey;
}

export interface Components {
  trend: number | null;
  stretch: number | null;
  momentum: number | null;
  percentile: number | null;
}

export interface Basis {
  source: string | null;
  adjusted: boolean | null;
  /** The two legs disagree about where their prices came from. */
  mixed: boolean;
}

export interface Reading {
  id: string;
  label: string;
  category: RotationCategory;
  kind: Indicator["kind"];
  asOf: string;
  sessions: number;
  /** Today's ratio, or today's level for a context gauge. */
  value: number;
  smaFast: number | null;
  smaSlow: number | null;
  separationPct: number | null;
  confirmed: boolean;
  zScore: number | null;
  percentile: number | null;
  rsi: number | null;
  roc1m: number | null;
  roc3m: number | null;
  roc6m: number | null;
  components: Components;
  score: number | null;
  tier: Tier;
  direction: DirectionKey;
  /** Plain language naming the actual assets, never "up" or "down". */
  directionLabel: string;
  /** What this direction means, taken from the catalog. */
  meaning: string;
  falsification: string;
  /** The level a close through, and held, would turn the reading over. */
  falsificationLevel: number | null;
  basis: Basis;
  stale: boolean;
  /** False when this reading must not raise a signal, whatever it says. */
  signalEligible: boolean;
  flags: string[];
}

export interface ScoreResult {
  indicator: Indicator;
  reading: Reading | null;
  /** One entry per session with a computable score, oldest first. */
  history: DailyState[];
  /** Why there is no reading. Null when there is one. */
  unavailable: string | null;
}

export interface ScoreInputs {
  indicator: Indicator;
  base: SeriesInput | null;
  quote: SeriesInput | null;
  settings: ScoreSettings;
  now?: Date;
}

const clamp10 = (n: number): number => Math.min(10, Math.max(0, n));

export function tierFor(score: number | null, s: ScoreSettings): Tier {
  if (score === null) return "none";
  // Inclusive from below at every boundary, so no score falls between two tiers.
  if (score >= s.strongTierMin) return "strong";
  if (score >= s.buildingTierMin) return "building";
  if (score >= s.neutralTierMin) return "neutral";
  return "none";
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Score one indicator, and every session behind it.
 *
 * Returns a null reading rather than a partial one whenever the inputs cannot
 * support the arithmetic: too little history, no overlapping sessions, or a
 * missing leg. Each of those carries a reason the page prints verbatim.
 */
export function scoreIndicator(inputs: ScoreInputs): ScoreResult {
  const { indicator, base, quote, settings: s } = inputs;
  const now = inputs.now ?? new Date();
  const none = (why: string): ScoreResult => ({ indicator, reading: null, history: [], unavailable: why });

  if (!base || base.bars.length === 0) return none(`no stored price history for ${indicator.base}`);
  if (indicator.kind === "ratio") {
    if (!indicator.quote) return none("this indicator is a ratio but names no denominator");
    if (!quote || quote.bars.length === 0) return none(`no stored price history for ${indicator.quote}`);
  }

  const flags: string[] = [];

  /* -- Build the series the whole reading is derived from. ------------------ */
  let dates: string[];
  let values: (number | null)[];
  let basis: Basis;

  if (indicator.kind === "context") {
    dates = base.bars.map((b) => b.date);
    values = base.bars.map((b) => b.close);
    basis = { source: base.source, adjusted: base.adjusted, mixed: false };
  } else {
    // Joined on DATE. An index prints sessions its funds do not, and zipping by
    // position would shift one leg against the other for the rest of history.
    const aligned = alignOnDate(base.bars, quote!.bars);
    dates = aligned.dates;
    values = ratioSeries(aligned.base, aligned.quote);
    const dropped = Math.max(base.bars.length, quote!.bars.length) - dates.length;
    if (dropped > 0) {
      flags.push(
        `${dropped} session${dropped === 1 ? "" : "s"} appear in one leg but not the other and are excluded.`,
      );
    }
    const mixed = base.source !== quote!.source || base.adjusted !== quote!.adjusted;
    basis = { source: mixed ? null : base.source, adjusted: mixed ? null : base.adjusted, mixed };
    if (mixed) {
      flags.push(
        "The two legs of this ratio came from different price sources, which do not agree on whether closes " +
          "are adjusted for distributions. The level shown is not comparable with its own history, so this " +
          "reading is displayed but is barred from raising a signal.",
      );
    }
  }

  if (dates.length < s.minBars) {
    return none(
      `only ${dates.length} usable session${dates.length === 1 ? "" : "s"}, below the ${s.minBars} required`,
    );
  }

  /* -- Rolling statistics. -------------------------------------------------- */
  const fast = sma(values, SMA_FAST);
  const slow = sma(values, SMA_SLOW);
  const z = rollingZScore(values, s.zWindowDays);
  const rsi = wilderRsi(values, RSI_PERIOD);
  // Quadratic in its window, and weighted zero by default: only pay for the
  // history when the operator has actually asked for it to count.
  const wantPercentileHistory = s.weightPercentile > 0;
  const pctSeries = wantPercentileHistory ? rollingPercentile(values, s.percentileWindowDays) : null;

  const i = lastDefinedIndex(values);
  if (i < 0) return none("no usable closes in the stored history");

  /* -- Context gauges are reported, never scored. --------------------------- */
  if (indicator.kind === "context") {
    const level = values[i]!;
    const asOf = dates[i];
    const reading: Reading = {
      id: indicator.id,
      label: indicator.label,
      category: indicator.category,
      kind: "context",
      asOf,
      sessions: dates.length,
      value: level,
      smaFast: fast[i],
      smaSlow: slow[i],
      separationPct: null,
      confirmed: false,
      zScore: z[i],
      // The published method reads this gauge against its own one-year range.
      percentile: percentileRankAt(values, s.zWindowDays, i),
      rsi: rsi[i],
      roc1m: rateOfChangeAt(values, ROC_1M, i),
      roc3m: rateOfChangeAt(values, ROC_3M, i),
      roc6m: rateOfChangeAt(values, ROC_6M, i),
      components: { trend: null, stretch: null, momentum: null, percentile: null },
      score: null,
      tier: "none",
      direction: "balanced",
      directionLabel:
        fast[i] !== null && level > fast[i]! ? indicator.favorsBase : indicator.favorsQuote,
      meaning: fast[i] !== null && level > fast[i]! ? indicator.risingMeans : indicator.fallingMeans,
      falsification: indicator.falsification,
      falsificationLevel: fast[i],
      basis,
      stale: daysBetween(now, new Date(`${asOf}T00:00:00Z`)) > s.barsStaleDays,
      signalEligible: false,
      flags: [
        ...flags,
        "Context for the ratios above rather than a signal of its own: this gauge carries no score and no tier.",
      ],
    };
    return { indicator, reading, history: [], unavailable: null };
  }

  /* -- Components, per session, so the history comes out of the same code. -- */
  const totalWeight = s.weightTrend + s.weightStretch + s.weightMomentum + s.weightPercentile;
  const history: DailyState[] = [];

  const componentsAt = (k: number): Components => {
    const f = fast[k];
    const sl = slow[k];
    let trend: number | null = null;
    if (f !== null && sl !== null && sl !== 0) {
      const sepPct = (Math.abs(f - sl) / sl) * 100;
      const raw = clamp10((sepPct / s.trendFullPct) * 10);
      const prior = fast[k - CONFIRM_LOOKBACK] ?? null;
      // A gap says where the ratio has been; the fast average still moving the
      // same way says whether it holds. Unconfirmed keeps only a share.
      const confirmed = prior === null ? true : Math.sign(f - sl) === Math.sign(f - prior);
      trend = confirmed ? raw : raw * (s.trendUnconfirmedFactor / 100);
    }
    const zk = z[k];
    const rk = rsi[k];
    const pk = pctSeries ? pctSeries[k] : null;
    return {
      trend,
      stretch: zk === null ? null : clamp10(Math.abs(zk) * s.zScale),
      momentum: rk === null ? null : clamp10(Math.abs(rk - 50) / s.rsiDivisor),
      percentile: pk === null ? null : clamp10(Math.abs(pk - 50) / PERCENTILE_DIVISOR),
    };
  };

  const scoreFrom = (c: Components): number | null => {
    if (totalWeight <= 0) return null;
    let sum = 0;
    // Only a component carrying weight can block the score: the historical
    // position reading is weighted zero by default and must not gate anything.
    const parts: [number, number | null][] = [
      [s.weightTrend, c.trend],
      [s.weightStretch, c.stretch],
      [s.weightMomentum, c.momentum],
      [s.weightPercentile, c.percentile],
    ];
    for (const [w, v] of parts) {
      if (w <= 0) continue;
      if (v === null) return null;
      sum += w * v;
    }
    return round1(sum / totalWeight);
  };

  const directionAt = (k: number): DirectionKey => {
    const f = fast[k];
    const sl = slow[k];
    if (f === null || sl === null || sl === 0) return "balanced";
    const sepPct = (Math.abs(f - sl) / sl) * 100;
    if (sepPct < s.directionDeadbandPct) return "balanced";
    return f > sl ? "favors-base" : "favors-quote";
  };

  for (let k = 0; k < dates.length; k++) {
    if (values[k] === null) continue;
    const c = componentsAt(k);
    const sc = scoreFrom(c);
    if (sc === null && fast[k] === null && slow[k] === null) continue;
    history.push({ date: dates[k], score: sc, tier: tierFor(sc, s), direction: directionAt(k) });
  }

  /* -- Today. --------------------------------------------------------------- */
  const components = componentsAt(i);
  const score = scoreFrom(components);
  const tier = tierFor(score, s);
  const direction = directionAt(i);
  const f = fast[i];
  const sl = slow[i];
  const separationPct = f !== null && sl !== null && sl !== 0 ? (Math.abs(f - sl) / sl) * 100 : null;
  const priorFast = fast[i - CONFIRM_LOOKBACK] ?? null;
  const confirmed =
    f === null || sl === null ? false : priorFast === null ? true : Math.sign(f - sl) === Math.sign(f - priorFast);
  const asOf = dates[i];

  if (score === null && totalWeight <= 0) {
    flags.push("Every scoring weight is set to zero, so no composite can be formed.");
  }
  if (slow[i] === null) {
    flags.push(`Fewer than ${SMA_SLOW} sessions of history, so the long average is not yet defined.`);
  }

  const reading: Reading = {
    id: indicator.id,
    label: indicator.label,
    category: indicator.category,
    kind: "ratio",
    asOf,
    sessions: dates.length,
    value: values[i]!,
    smaFast: f,
    smaSlow: sl,
    separationPct,
    confirmed,
    zScore: z[i],
    percentile: percentileRankAt(values, s.percentileWindowDays, i),
    rsi: rsi[i],
    roc1m: rateOfChangeAt(values, ROC_1M, i),
    roc3m: rateOfChangeAt(values, ROC_3M, i),
    roc6m: rateOfChangeAt(values, ROC_6M, i),
    components,
    score,
    tier,
    direction,
    directionLabel:
      direction === "favors-base"
        ? indicator.favorsBase
        : direction === "favors-quote"
          ? indicator.favorsQuote
          : `Balanced — neither ${indicator.base} nor ${indicator.quote} is clearly leading`,
    meaning:
      direction === "favors-base"
        ? indicator.risingMeans
        : direction === "favors-quote"
          ? indicator.fallingMeans
          : "The two are moving together closely enough that calling a leader would be reading noise.",
    falsification: indicator.falsification,
    falsificationLevel: sl,
    basis,
    stale: daysBetween(now, new Date(`${asOf}T00:00:00Z`)) > s.barsStaleDays,
    signalEligible: !basis.mixed && score !== null,
    flags,
  };

  return { indicator, reading, history, unavailable: null };
}

/**
 * Rank readings for the board: strongest tier first, then score, then label.
 * A reading that could not be scored sorts LAST regardless — an unmeasured
 * indicator must never be able to look like a quiet one.
 */
export function rankReadings(readings: Reading[]): Reading[] {
  return [...readings].sort((a, b) => {
    const aScored = a.score !== null;
    const bScored = b.score !== null;
    if (aScored !== bScored) return aScored ? -1 : 1;
    if (!aScored) return a.label.localeCompare(b.label);
    if (b.score! !== a.score!) return b.score! - a.score!;
    return a.label.localeCompare(b.label);
  });
}
