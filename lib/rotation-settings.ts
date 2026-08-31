import {
  boolSetting,
  createSettingsRegistry,
  numSetting,
  type SettingSource,
  type SettingSpec,
} from "./settings-registry";

/* ============================================================================
 * The Rotation Board — settings registry & resolver.
 *
 * Same contract as the Stage-0 screen and the Bottleneck desk: nothing the
 * board does is hard-coded, every threshold carries its reasoning, and /admin
 * and /methodology render the SAME effective values from this one source.
 * Precedence is DB > env > default.
 *
 * The board stores raw daily bars and computes every ratio, average, z-score,
 * tier and direction on READ. So these knobs are not merely configuration —
 * they re-derive the whole board, including its history, on the next page load,
 * without refetching anything.
 *
 * Which indicators exist is NOT here: that is a catalog of ticker pairs and
 * lives in lib/rotation/catalog.ts, because it changes per market question
 * rather than per operator preference. These knobs are the operator's dials.
 * ========================================================================== */

export type RotationSettingGroupKey = "data" | "scoring" | "signals" | "brief" | "ops";

export const ROTATION_SETTING_GROUPS: { key: RotationSettingGroupKey; title: string; note: string }[] = [
  {
    key: "data",
    title: "Price history",
    note:
      "How much daily history each leg of a ratio needs, and when a stored series has gone stale enough to " +
      "say so rather than quietly keep serving it. Both price sources are free and keyless; neither is an " +
      "official market-data feed, so the board is built to degrade visibly rather than to pretend.",
  },
  {
    key: "scoring",
    title: "Pivot score",
    note:
      "The composite that turns a ratio into a 1-10 reading. Three components are scored by default — how far " +
      "the 50-day average sits from the 200-day, how stretched the ratio is against its own year, and how far " +
      "the momentum of the ratio itself is from neutral. A fourth, how extreme the ratio is against its full " +
      "multi-year range, is available but weighted zero, because the published method does not score it.",
  },
  {
    key: "signals",
    title: "Tiers and direction",
    note:
      "Where the score boundaries sit, and how much separation between the two averages is required before " +
      "the board will say a ratio favours one side. A ratio sitting almost exactly on its own trend has no " +
      "direction worth reporting, and saying otherwise manufactures a signal out of rounding.",
  },
  {
    key: "brief",
    title: "Written note",
    note:
      "A short plain-English note is written whenever an indicator actually changes state. The deterministic " +
      "version costs nothing and always runs. The model-written version is off unless switched on here, and " +
      "even then it only ever rephrases figures that were already computed — it is never asked to work one out.",
  },
  {
    key: "ops",
    title: "Operational",
    note:
      "Fetch budgets and request pacing. Every external source is fail-open: a dead feed degrades the board " +
      "and is disclosed on the page, never crashes it and never overwrites a good reading with an empty one.",
  },
];

const num = numSetting<RotationSettingGroupKey>;
const bool = boolSetting<RotationSettingGroupKey>;

export const ROTATION_SETTINGS_SPEC: SettingSpec<RotationSettingGroupKey>[] = [
  /* ---- Price history ---- */
  num({
    key: "historyYears",
    label: "Daily history fetched per ticker",
    group: "data",
    envVar: "MAG8_ROT_HISTORY_YEARS",
    default: 5,
    min: 3,
    max: 10,
    step: 1,
    unit: "years",
    integer: true,
    blurb:
      "How far back each price series is pulled and kept. Three years is the floor because the historical " +
      "position reading is defined against a three-year window; five is the default so that window is fully " +
      "populated from the first day rather than filling in over the following two years.",
    cites: [],
  }),
  num({
    key: "minBars",
    label: "Minimum sessions before a series is trusted",
    group: "data",
    envVar: "MAG8_ROT_MIN_BARS",
    default: 500,
    min: 250,
    max: 1500,
    step: 50,
    unit: "sessions",
    integer: true,
    blurb:
      "A series returning fewer daily closes than this is treated as a broken feed rather than as a young " +
      "fund, and the indicator is reported unavailable instead of being scored on thin data. A short answer " +
      "from a price source is far more often a fault at their end than a real gap in market history.",
    cites: [],
  }),
  num({
    key: "barsStaleDays",
    label: "Age at which stored prices are called stale",
    group: "data",
    envVar: "MAG8_ROT_BARS_STALE_DAYS",
    default: 4,
    min: 1,
    max: 30,
    step: 1,
    unit: "days",
    integer: true,
    blurb:
      "How old the newest stored close may be before every reading is flagged stale on the page. Four days " +
      "clears a normal weekend plus a public holiday without crying wolf, while still catching a refresh " +
      "that has quietly stopped working.",
    cites: [],
  }),
  bool({
    key: "fallbackEnabled",
    label: "Use the secondary price source when the primary fails",
    group: "data",
    envVar: "MAG8_ROT_FALLBACK",
    default: true,
    blurb:
      "Falls back to an independent second price source for any ticker the primary cannot serve. The two " +
      "disagree in one important way: the primary adjusts closes for dividends and the fallback does not, so " +
      "a ratio whose two legs came from different sources is flagged and barred from raising a signal.",
    cites: [],
  }),

  /* ---- Pivot score ---- */
  num({
    key: "trendFullPct",
    label: "Average separation that scores a full trend mark",
    group: "scoring",
    envVar: "MAG8_ROT_TREND_FULL_PCT",
    default: 3,
    min: 0.5,
    max: 10,
    step: 0.5,
    unit: "%",
    blurb:
      "How far the 50-day average must sit from the 200-day, as a share of the 200-day, to score the maximum " +
      "trend mark; anything less scores in proportion. Three percent is the published threshold and is a wide " +
      "gap for a ratio of two broad funds, which moves far less than either fund does alone.",
    cites: [],
  }),
  num({
    key: "trendUnconfirmedFactor",
    label: "Trend mark retained when the short average disagrees",
    group: "scoring",
    envVar: "MAG8_ROT_TREND_UNCONFIRMED",
    default: 50,
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    blurb:
      "A gap between the two averages says where the ratio has been; the direction the shorter average is " +
      "currently moving says whether it still holds. When those disagree the trend mark is cut to this share, " +
      "so a wide but decaying gap scores below a wide and widening one rather than identically.",
    cites: [],
  }),
  num({
    key: "zScale",
    label: "Multiplier turning a standard score into a stretch mark",
    group: "scoring",
    envVar: "MAG8_ROT_Z_SCALE",
    default: 3.3,
    min: 1,
    max: 10,
    step: 0.1,
    blurb:
      "Scales how far the ratio sits from its own one-year mean, in standard deviations, onto the ten-point " +
      "stretch mark. At the default, three standard deviations reaches full marks, which is deliberately hard " +
      "to reach: most of the time a ratio is not stretched, and the board should be willing to say so.",
    cites: [],
  }),
  num({
    key: "rsiDivisor",
    label: "Divisor turning momentum distance into a mark",
    group: "scoring",
    envVar: "MAG8_ROT_RSI_DIVISOR",
    default: 5,
    min: 1,
    max: 25,
    step: 0.5,
    blurb:
      "The momentum reading of the ratio runs 0-100 and is neutral at 50. Its distance from neutral is divided " +
      "by this to produce the ten-point momentum mark, so the default puts a fully committed reading of 0 or " +
      "100 at full marks and a directionless 50 at zero.",
    cites: [],
  }),
  num({
    key: "zWindowDays",
    label: "Lookback for the stretch reading",
    group: "scoring",
    envVar: "MAG8_ROT_Z_WINDOW",
    default: 252,
    min: 63,
    max: 756,
    step: 21,
    unit: "sessions",
    integer: true,
    blurb:
      "The trailing window whose mean and spread the ratio is measured against. 252 sessions is one trading " +
      "year, which keeps the comparison inside a single macro regime; a much longer window would call a ratio " +
      "normal simply because it once spent years somewhere else.",
    cites: [],
  }),
  num({
    key: "percentileWindowDays",
    label: "Lookback for the historical-position reading",
    group: "scoring",
    envVar: "MAG8_ROT_PCT_WINDOW",
    default: 756,
    min: 252,
    max: 2520,
    step: 21,
    unit: "sessions",
    integer: true,
    blurb:
      "The window against which today's ratio is ranked to say where it sits historically. 756 sessions is " +
      "three trading years, long enough to contain both a risk-on and a risk-off stretch in most modern " +
      "market history.",
    cites: [],
  }),
  num({
    key: "weightTrend",
    label: "Weight on the trend mark",
    group: "scoring",
    envVar: "MAG8_ROT_W_TREND",
    default: 1,
    min: 0,
    max: 5,
    step: 0.1,
    blurb:
      "Relative weight of the trend mark in the composite. All three published components default to equal " +
      "weight, which reproduces the plain average the method specifies; changing one changes the balance " +
      "without any code change, and the live values are published on the methodology page.",
    cites: [],
  }),
  num({
    key: "weightStretch",
    label: "Weight on the stretch mark",
    group: "scoring",
    envVar: "MAG8_ROT_W_STRETCH",
    default: 1,
    min: 0,
    max: 5,
    step: 0.1,
    blurb:
      "Relative weight of the stretch mark in the composite. Raising it makes the board more interested in how " +
      "far a ratio has travelled from its own recent normal, and correspondingly less interested in how " +
      "persistent that travel has been.",
    cites: [],
  }),
  num({
    key: "weightMomentum",
    label: "Weight on the momentum mark",
    group: "scoring",
    envVar: "MAG8_ROT_W_MOMENTUM",
    default: 1,
    min: 0,
    max: 5,
    step: 0.1,
    blurb:
      "Relative weight of the momentum mark in the composite. This is the fastest-moving of the three and the " +
      "quickest to reverse, so raising it produces a board that changes its mind more often — a choice about " +
      "temperament rather than about accuracy.",
    cites: [],
  }),
  num({
    key: "weightPercentile",
    label: "Weight on the historical-position mark",
    group: "scoring",
    envVar: "MAG8_ROT_W_PERCENTILE",
    default: 0,
    min: 0,
    max: 5,
    step: 0.1,
    blurb:
      "Weight on how extreme today's ratio is against its full multi-year range. Zero by default, because the " +
      "published method computes this figure and displays it but does not score it — which means a ratio can " +
      "sit near a three-year low and still read as no signal. Raising this above zero is the supported way to " +
      "disagree with that, and the board shows the changed weighting alongside the changed score.",
    cites: [],
  }),

  /* ---- Tiers and direction ---- */
  num({
    key: "directionDeadbandPct",
    label: "Separation required before a ratio favours a side",
    group: "signals",
    envVar: "MAG8_ROT_DEADBAND_PCT",
    default: 0.25,
    min: 0,
    max: 2,
    step: 0.05,
    unit: "%",
    blurb:
      "Below this separation between the two averages the board reports the ratio as balanced rather than " +
      "picking a side. Without it, a ratio resting on its own trend would flip direction on daily noise, and " +
      "since a direction flip is what triggers a written note, every flip would raise one.",
    cites: [],
  }),
  num({
    key: "strongTierMin",
    label: "Score at which a reading is a strong signal",
    group: "signals",
    envVar: "MAG8_ROT_TIER_STRONG",
    default: 8,
    min: 5,
    max: 10,
    step: 0.5,
    blurb:
      "Lower bound of the top tier. The published tiers are quoted as whole-number bands, which leaves the " +
      "half-points between them unassigned; the board treats every boundary as inclusive from below so that " +
      "no score can fall between two tiers.",
    cites: [],
  }),
  num({
    key: "buildingTierMin",
    label: "Score at which a reading is building",
    group: "signals",
    envVar: "MAG8_ROT_TIER_BUILDING",
    default: 5,
    min: 2,
    max: 9,
    step: 0.5,
    blurb:
      "Lower bound of the middle tier, where a reading is developing but has not yet earned the top band. " +
      "Crossing this line in either direction is a state change, and a state change is one of only two things " +
      "that can raise a written note.",
    cites: [],
  }),
  num({
    key: "neutralTierMin",
    label: "Score at which a reading stops being nothing",
    group: "signals",
    envVar: "MAG8_ROT_TIER_NEUTRAL",
    default: 3,
    min: 0.5,
    max: 8,
    step: 0.5,
    blurb:
      "Lower bound of the rangebound tier; below it the board reports no signal at all. Most ratios sit here " +
      "most of the time, and a board that rarely says nothing is a board that has been tuned until it always " +
      "has something to say.",
    cites: [],
  }),

  /* ---- Written note ---- */
  bool({
    key: "briefModelEnabled",
    label: "Let a language model write the note",
    group: "brief",
    envVar: "MAG8_ROT_BRIEF_MODEL",
    default: false,
    blurb:
      "Off by default, and the board is fully usable that way: the deterministic note is written from the same " +
      "computed figures at no cost. Switching this on adds a single batched request when — and only when — an " +
      "indicator actually changes state, and any note containing a figure that cannot be traced back to the " +
      "computed inputs is discarded in favour of the deterministic one.",
    cites: [],
  }),
  num({
    key: "briefMaxIndicators",
    label: "Most changed indicators covered in one note",
    group: "brief",
    envVar: "MAG8_ROT_BRIEF_MAX",
    default: 12,
    min: 1,
    max: 30,
    step: 1,
    unit: "indicators",
    integer: true,
    blurb:
      "Caps how many changed indicators are described in a single note, highest-scoring first. A day on which " +
      "most of the board changes at once is more often a data problem than a market event, and the cap keeps " +
      "that from becoming an unreadable wall of text.",
    cites: [],
  }),

  /* ---- Operational ---- */
  num({
    key: "fetchTimeoutMs",
    label: "Price request timeout",
    group: "ops",
    envVar: "MAG8_ROT_FETCH_TIMEOUT_MS",
    default: 20_000,
    min: 5_000,
    max: 120_000,
    step: 5_000,
    scale: 1000,
    unit: "s",
    integer: true,
    blurb:
      "Per-request budget for one price series. A timeout leaves the previously stored history in place and is " +
      "reported against that ticker, rather than emptying the series or failing the whole refresh.",
    cites: [],
  }),
  num({
    key: "fetchGapMs",
    label: "Minimum gap between price requests",
    group: "ops",
    envVar: "MAG8_ROT_FETCH_GAP_MS",
    default: 150,
    min: 50,
    max: 2_000,
    step: 50,
    unit: "ms",
    integer: true,
    blurb:
      "Every request is serialized through one queue and paced by this gap. Neither price source publishes a " +
      "rate limit, so the board sets a conservative one of its own instead of discovering theirs by being " +
      "blocked partway through a refresh.",
    cites: [],
  }),
];

export interface RotationSettings {
  historyYears: number;
  minBars: number;
  barsStaleDays: number;
  fallbackEnabled: boolean;
  trendFullPct: number;
  trendUnconfirmedFactor: number;
  zScale: number;
  rsiDivisor: number;
  zWindowDays: number;
  percentileWindowDays: number;
  weightTrend: number;
  weightStretch: number;
  weightMomentum: number;
  weightPercentile: number;
  directionDeadbandPct: number;
  strongTierMin: number;
  buildingTierMin: number;
  neutralTierMin: number;
  briefModelEnabled: boolean;
  briefMaxIndicators: number;
  fetchTimeoutMs: number;
  fetchGapMs: number;
}

export type RotationSettingKey = keyof RotationSettings;

const registry = createSettingsRegistry<RotationSettingGroupKey, RotationSettings>({
  spec: ROTATION_SETTINGS_SPEC,
  storageKey: "rotation_settings",
});

export interface EffectiveRotationSettings {
  values: RotationSettings;
  sources: Record<RotationSettingKey, SettingSource>;
}

export const cleanRotationOverrides = registry.clean;
export const effectiveRotationSettings = registry.effective;
export const rotationSettings = registry.values;
export const baselineRotationSettings = registry.baseline;
export const saveRotationOverrides = registry.save;
export const saveRotationDiff = registry.saveDiff;

/**
 * Env-only kill switch, checked per call and supreme over every other knob —
 * the same shape as MAG8_UNIVERSE=0 and MAG8_PRICE_CHECK=0. With the board off
 * nothing fetches, and the pages report themselves unavailable rather than
 * rendering an empty board that looks like a market reading.
 */
export function rotationEnabled(): boolean {
  return process.env.MAG8_ROTATION !== "0";
}
