import {
  boolSetting,
  createSettingsRegistry,
  numSetting,
  type SettingSource,
  type SettingSpec,
} from "./settings-registry";

/* ============================================================================
 * The Risk Desk — settings registry & resolver.
 *
 * Same contract as every other desk: nothing is hard-coded, each knob carries
 * its reasoning, /admin and /methodology render the SAME effective values from
 * this one source, and precedence is DB > env > default.
 *
 * These dials matter more than most because almost every figure this desk
 * publishes is a statistic computed over a window, and a window is a choice.
 * Volatility over sixty days and volatility over three years are different
 * numbers about the same company, and neither is wrong. Everything measured
 * here therefore prints the window it was measured over, and moving a dial
 * re-derives the entire board — including every reason a name went unmeasured
 * — without a single fetch, because nothing derived is stored.
 *
 * The benchmark is deliberately NOT a dial. It is SPY, because twenty years of
 * it are already stored as the quote leg of most rotation ratios, so the
 * comparison costs nothing and is on the same basis as everything else here.
 * MAG8_RISK_BENCHMARK overrides it for an experiment; there is no reason to put
 * that on a settings page.
 * ========================================================================== */

/** The benchmark every name and the sleeve are measured against. */
export const DEFAULT_BENCHMARK = "SPY";

export function benchmarkTicker(): string {
  const raw = (process.env.MAG8_RISK_BENCHMARK ?? "").trim().toUpperCase();
  return /^\^?[A-Z][A-Z0-9.-]{0,9}$/.test(raw) ? raw : DEFAULT_BENCHMARK;
}

export type RiskSettingGroupKey = "data" | "measurement" | "sleeve" | "display" | "ops";

export const RISK_SETTING_GROUPS: { key: RiskSettingGroupKey; title: string; note: string }[] = [
  {
    key: "data",
    title: "Price history",
    note:
      "Daily closes for every name the other desks have named, plus the benchmark. Prices are read from what " +
      "the other desks already stored before anything is fetched, so a name the tide or the insider scanner " +
      "has already priced costs nothing to add here.",
  },
  {
    key: "measurement",
    title: "Windows",
    note:
      "Every figure on this desk is a statistic over a window, and a window is a choice rather than a fact. " +
      "Volatility over three months and volatility over three years are both true and are different numbers, " +
      "so each figure prints the window it came from and these dials decide what that window is.",
  },
  {
    key: "sleeve",
    title: "The basket",
    note:
      "The basket is equal-weighted and rebalanced each session, and the desk does not propose weights of its " +
      "own. That is a finding rather than a limitation: fourteen optimising rules tested across seven datasets " +
      "failed to beat equal weight out of sample, because estimating the inputs costs more than optimising " +
      "them gains.",
  },
  {
    key: "display",
    title: "What is shown",
    note:
      "Upper bounds on the tables, so a future desk that names several hundred companies cannot turn this page " +
      "into a dump. Counts of everything found are printed above each table, so a truncated list says so.",
  },
  {
    key: "ops",
    title: "Operational",
    note: "Request pacing for the price feeds. Shared shape with the rotation board, separate queue and dials.",
  },
];

const num = numSetting<RiskSettingGroupKey>;
const bool = boolSetting<RiskSettingGroupKey>;

export const RISK_SETTINGS_SPEC: SettingSpec<RiskSettingGroupKey>[] = [
  /* ---- Price history ---- */
  num({
    key: "historyYears",
    label: "Daily history fetched per name",
    group: "data",
    envVar: "MAG8_RISK_HISTORY_YEARS",
    default: 5,
    min: 1,
    max: 20,
    step: 1,
    unit: "years",
    integer: true,
    blurb:
      "How far back each price series is pulled and kept. Five years covers several distinct market regimes " +
      "rather than one, which matters here more than on a price chart: a correlation measured across a single " +
      "calm stretch is the most flattering version of itself. Note that a longer history does not lengthen a " +
      "young company's record — a name listed two years ago has two years however high this is set, and the " +
      "desk says so on its row rather than padding it.",
    cites: ["Longin & Solnik 2001"],
  }),
  num({
    key: "minBars",
    label: "Minimum sessions before a series is trusted",
    group: "data",
    envVar: "MAG8_RISK_MIN_BARS",
    default: 60,
    min: 20,
    max: 500,
    step: 10,
    unit: "sessions",
    integer: true,
    blurb:
      "A price source returning fewer closes than this is treated as a broken feed rather than as a young " +
      "listing, and the name is reported unpriced instead of measured on a handful of days. Set far lower " +
      "than the rotation board's equivalent on purpose: that board reads funds with decades of history, while " +
      "this one reads companies the screen surfaces precisely because they are young.",
    cites: [],
  }),
  num({
    key: "barsStaleDays",
    label: "Age at which stored prices are called stale",
    group: "data",
    envVar: "MAG8_RISK_BARS_STALE_DAYS",
    default: 7,
    min: 1,
    max: 60,
    step: 1,
    unit: "days",
    integer: true,
    blurb:
      "How old the newest stored close may be before the whole board is flagged stale. Seven days clears a " +
      "weekend plus a holiday plus a missed refresh without crying wolf. It is looser than the rotation " +
      "board's four because these figures are windows of months and years — a reading three days behind is " +
      "not a different reading.",
    cites: [],
  }),
  bool({
    key: "fallbackEnabled",
    label: "Use the secondary price source when the primary fails",
    group: "data",
    envVar: "MAG8_RISK_FALLBACK",
    default: true,
    blurb:
      "Falls back to an independent second price source for any name the primary cannot serve. The two differ " +
      "in one way that matters here: the primary adjusts closes for dividends and the fallback does not, so an " +
      "unadjusted series carries each ex-dividend fall as a real one-day loss. That inflates measured " +
      "volatility slightly and adds noise to a correlation on those days, so a pair whose two legs disagree is " +
      "shown with the disagreement named and is never allowed to raise a co-movement warning.",
    cites: [],
  }),

  /* ---- Windows ---- */
  num({
    key: "volWindowDays",
    label: "Sessions in the headline volatility window",
    group: "measurement",
    envVar: "MAG8_RISK_VOL_WINDOW",
    default: 252,
    min: 63,
    max: 1260,
    step: 21,
    unit: "sessions",
    integer: true,
    blurb:
      "The trailing window every published volatility, beta and correlation is measured over. Roughly 252 " +
      "sessions is a year, which is the conventional quote and the one most readers will assume unless told " +
      "otherwise. A shorter window responds faster and is noisier; a longer one is steadier and describes a " +
      "company that may no longer exist in the same form.",
    cites: [],
  }),
  num({
    key: "minSessions",
    label: "Sessions required before any figure is published",
    group: "measurement",
    envVar: "MAG8_RISK_MIN_SESSIONS",
    default: 126,
    min: 21,
    max: 504,
    step: 21,
    unit: "sessions",
    integer: true,
    blurb:
      "Below this a name is NOT MEASURED and ranks last with its reason, rather than being given a figure " +
      "from thin data. Zero risk and zero correlation are both real readings that mean something specific, " +
      "and neither of them means not enough data — printing one where the other belongs is the single most " +
      "dangerous mistake this desk could make.",
    cites: [],
  }),

  /* ---- The basket ---- */
  num({
    key: "sleeveMinSessions",
    label: "Shared history a name needs to join the basket",
    group: "sleeve",
    envVar: "MAG8_RISK_SLEEVE_MIN_SESSIONS",
    default: 252,
    min: 63,
    max: 1260,
    step: 21,
    unit: "sessions",
    integer: true,
    blurb:
      "The basket is one portfolio, so unlike a pairwise correlation it needs a single shared calendar — and " +
      "that is exactly where a young listing can silently truncate everyone else's history down to its own. A " +
      "name with less shared history than this is excluded and NAMED, with the number of sessions it did " +
      "have, so the basket's window is never quietly shortened by a company nobody was looking at.",
    cites: [],
  }),
  num({
    key: "togetherAt",
    label: "Correlation at which two names are read as one position",
    group: "sleeve",
    envVar: "MAG8_RISK_TOGETHER_AT",
    default: 0.75,
    min: 0.5,
    max: 0.95,
    step: 0.05,
    unit: "",
    blurb:
      "Above this, two names are flagged as one position rather than two. There is no natural threshold here " +
      "and this one is a convention, not a result — which is why the full pair table is published with every " +
      "correlation and its sample size, so the line can be drawn somewhere else by anyone who disagrees.",
    cites: ["Longin & Solnik 2001"],
  }),
  num({
    key: "maxNames",
    label: "Most names measured",
    group: "sleeve",
    envVar: "MAG8_RISK_MAX_NAMES",
    default: 40,
    min: 5,
    max: 150,
    step: 5,
    unit: "names",
    integer: true,
    blurb:
      "An upper bound on how many companies are priced and measured in one refresh. The pair table grows with " +
      "the square of this, so it is a bound on work as much as on output.",
    cites: [],
  }),
  bool({
    key: "includeSingleDesk",
    label: "Also measure companies only one desk named",
    group: "sleeve",
    envVar: "MAG8_RISK_INCLUDE_SINGLE",
    default: false,
    blurb:
      "By default this desk measures the companies more than one desk named, because that is the list a " +
      "reader is most likely to be looking at as a group. Turning this on measures every company any desk " +
      "named, which is a much larger basket of names that were never suggested as belonging together — " +
      "informative about the desks, less informative as a portfolio.",
    cites: [],
  }),

  /* ---- What is shown ---- */
  num({
    key: "maxPairs",
    label: "Most pairs listed",
    group: "display",
    envVar: "MAG8_RISK_MAX_PAIRS",
    default: 40,
    min: 10,
    max: 300,
    step: 10,
    unit: "pairs",
    integer: true,
    blurb:
      "The pair table is sorted by correlation before it is cut, so what a truncated table drops is always " +
      "the weakest co-movement and never the strongest.",
    cites: [],
  }),
  num({
    key: "maxRows",
    label: "Most names listed",
    group: "display",
    envVar: "MAG8_RISK_MAX_ROWS",
    default: 60,
    min: 10,
    max: 250,
    step: 10,
    unit: "rows",
    integer: true,
    blurb:
      "An upper bound on the main table. The count of everything measured is always printed above it, so a " +
      "truncated list says it is truncated.",
    cites: [],
  }),

  /* ---- Operational ---- */
  num({
    key: "fetchTimeoutMs",
    label: "Price request timeout",
    group: "ops",
    envVar: "MAG8_RISK_FETCH_TIMEOUT_MS",
    default: 20_000,
    min: 5_000,
    max: 120_000,
    step: 5_000,
    scale: 1000,
    unit: "s",
    integer: true,
    blurb:
      "Per-request budget for one price series. A timeout leaves the previously stored history in place and is " +
      "reported against that name, rather than emptying the series or failing the whole refresh.",
    cites: [],
  }),
  num({
    key: "fetchGapMs",
    label: "Minimum gap between price requests",
    group: "ops",
    envVar: "MAG8_RISK_FETCH_GAP_MS",
    default: 150,
    min: 50,
    max: 2_000,
    step: 50,
    unit: "ms",
    integer: true,
    blurb:
      "Every request is serialized through one queue and paced by this gap. Neither price source publishes a " +
      "rate limit, so the desk sets a conservative one of its own instead of discovering theirs by being " +
      "blocked partway through a refresh.",
    cites: [],
  }),
];

export interface RiskSettings {
  historyYears: number;
  minBars: number;
  barsStaleDays: number;
  fallbackEnabled: boolean;
  volWindowDays: number;
  minSessions: number;
  sleeveMinSessions: number;
  togetherAt: number;
  maxNames: number;
  includeSingleDesk: boolean;
  maxPairs: number;
  maxRows: number;
  fetchTimeoutMs: number;
  fetchGapMs: number;
}

export type RiskSettingKey = keyof RiskSettings;

const registry = createSettingsRegistry<RiskSettingGroupKey, RiskSettings>({
  spec: RISK_SETTINGS_SPEC,
  storageKey: "risk_settings",
});

export interface EffectiveRiskSettings {
  values: RiskSettings;
  sources: Record<RiskSettingKey, SettingSource>;
}

export const cleanRiskOverrides = registry.clean;
export const effectiveRiskSettings = registry.effective;
export const riskSettings = registry.values;
export const baselineRiskSettings = registry.baseline;
export const saveRiskOverrides = registry.save;
export const saveRiskDiff = registry.saveDiff;

/**
 * Env-only kill switch, checked per call and supreme over every other knob —
 * the same shape as MAG8_ROTATION=0 and MAG8_TIDE=0. With the desk off the page
 * reports itself unavailable rather than rendering an empty table, which here
 * would read as "nothing in this basket moves together".
 */
export function riskEnabled(): boolean {
  return process.env.MAG8_RISK !== "0";
}
