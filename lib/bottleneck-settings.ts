import {
  boolSetting,
  createSettingsRegistry,
  numSetting,
  type SettingSource,
  type SettingSpec,
} from "./settings-registry";

/* ============================================================================
 * Bottleneck desk — settings registry & resolver.
 *
 * Same contract as the Stage-0 screen: nothing the desk does is hard-coded,
 * every threshold carries its reasoning, and /admin and /methodology render the
 * SAME effective values from this one source. Precedence is DB > env > default.
 *
 * Sector-specific inputs (tickers, XBRL tags, conversion factors, supply
 * connectors, owner maps) deliberately do NOT live here — they live in
 * lib/bottleneck/playbook.ts, because they change per theme rather than per
 * operator preference. These knobs are the operator's dials.
 * ========================================================================== */

export type BottleneckSettingGroupKey = "filings" | "demand" | "supply" | "scoring" | "exposure" | "ops";

export const BOTTLENECK_SETTING_GROUPS: { key: BottleneckSettingGroupKey; title: string; note: string }[] = [
  {
    key: "filings",
    title: "Institutional filings (13F)",
    note:
      "How a manager's disclosed book is read and displayed. Every 13F is a snapshot of the past: the rule " +
      "allows up to 45 days between the quarter it describes and the day it appears, so nothing here is ever " +
      "a live position.",
  },
  {
    key: "demand",
    title: "Demand — dollars into physical units",
    note:
      "Reading disclosed capital spending out of SEC filings and converting it into the physical things that " +
      "money must buy. The conversion factors themselves live with each playbook, versioned and sourced, " +
      "because they are estimates rather than facts.",
  },
  {
    key: "supply",
    title: "Supply — what can actually be produced",
    note:
      "How much evidence a supply series needs before the desk will compute a growth rate from it, and when a " +
      "series has gone stale enough to say so rather than quietly keep using it.",
  },
  {
    key: "scoring",
    title: "Bottleneck scoring",
    note:
      "Turning demand growth and supply growth into a ranked gap. A widening gap means the constraint is " +
      "tightening; a narrowing one means new supply is catching up and any scarcity premium is at risk. The " +
      "desk is required to report both.",
  },
  {
    key: "exposure",
    title: "Portfolio exposure",
    note:
      "Cross-referencing holdings against the companies that control each constrained input. Informational " +
      "only — the desk reports exposure and never proposes a trade.",
  },
  {
    key: "ops",
    title: "Operational",
    note: "Fetch budgets and cache horizons. Every external source is fail-open: a dead feed degrades the desk, never breaks it.",
  },
];

const num = numSetting<BottleneckSettingGroupKey>;
const bool = boolSetting<BottleneckSettingGroupKey>;

export const BOTTLENECK_SETTINGS_SPEC: SettingSpec<BottleneckSettingGroupKey>[] = [
  /* ---- Institutional filings ---- */
  num({
    key: "filingLagDays",
    label: "Disclosed filing-lag window",
    group: "filings",
    envVar: "MAG8_BN_FILING_LAG_DAYS",
    default: 45,
    min: 0,
    max: 120,
    step: 5,
    unit: "days",
    integer: true,
    blurb:
      "The maximum age a holdings disclosure can have by rule, shown wherever those holdings appear. Managers " +
      "must file within 45 days of quarter end, so a book on screen may describe positions a month and a half " +
      "old — long enough for the prices behind it to have moved materially. This is a disclosure, never a filter.",
    cites: [],
  }),
  num({
    key: "holdingsMinPct",
    label: "Minimum position size shown",
    group: "filings",
    envVar: "MAG8_BN_HOLDINGS_MIN_PCT",
    default: 0,
    min: 0,
    max: 5,
    step: 0.1,
    unit: "% of book",
    blurb:
      "Hides positions below this share of the manager's disclosed long book, to keep a long tail of token " +
      "holdings from burying the real ones. Defaults to 0 — showing everything — because a small position is " +
      "still a real disclosure and hiding it is an editorial act.",
    cites: [],
  }),
  bool({
    key: "showOptionsOverlay",
    label: "Show the options overlay alongside long stock",
    group: "filings",
    envVar: "MAG8_BN_SHOW_OPTIONS",
    default: true,
    blurb:
      "A 13F reports puts and calls next to plain shares. Cloning only the stock is a common simplification, " +
      "but silently discarding the derivatives understates how a manager is actually positioned — sometimes " +
      "dramatically. The desk computes both and labels them separately.",
    cites: [],
  }),

  /* ---- Demand ---- */
  num({
    key: "demandStaleDays",
    label: "Demand snapshot freshness window",
    group: "demand",
    envVar: "MAG8_BN_DEMAND_STALE_DAYS",
    default: 30,
    min: 1,
    max: 180,
    step: 1,
    unit: "days",
    integer: true,
    blurb:
      "How old a stored demand snapshot may be before the desk labels it stale. Capital-spending disclosures " +
      "only move on each company's earnings cadence, so refreshing faster than this buys nothing but requests.",
    cites: [],
  }),
  num({
    key: "demandBasketMax",
    label: "Maximum companies per demand basket",
    group: "demand",
    envVar: "MAG8_BN_BASKET_MAX",
    default: 12,
    min: 1,
    max: 40,
    step: 1,
    unit: "companies",
    integer: true,
    blurb:
      "Upper bound on how many companies one playbook may aggregate. A basket wide enough to include marginal " +
      "spenders dilutes the signal from the handful of operators who actually set the demand.",
    cites: [],
  }),

  /* ---- Supply ---- */
  num({
    key: "supplyMinPoints",
    label: "Minimum observations before trusting a growth rate",
    group: "supply",
    envVar: "MAG8_BN_SUPPLY_MIN_POINTS",
    default: 4,
    min: 2,
    max: 24,
    step: 1,
    unit: "observations",
    integer: true,
    blurb:
      "A supply series with fewer points than this is shown but not scored. Two observations always define a " +
      "trend line and almost never define a trend; refusing to compute is more honest than publishing a growth " +
      "rate built on noise.",
    cites: [],
  }),
  num({
    key: "supplyStaleDays",
    label: "Supply series freshness window",
    group: "supply",
    envVar: "MAG8_BN_SUPPLY_STALE_DAYS",
    default: 75,
    min: 15,
    max: 400,
    step: 5,
    unit: "days",
    integer: true,
    blurb:
      "A monthly series whose latest observation is older than this is flagged as stale on the desk. The default " +
      "allows a missed publication plus normal reporting lag before crying wolf.",
    cites: [],
  }),

  /* ---- Scoring ---- */
  num({
    key: "gapMaterialPct",
    label: "Materiality threshold for a gap move",
    group: "scoring",
    envVar: "MAG8_BN_GAP_MATERIAL_PCT",
    default: 10,
    min: 1,
    max: 100,
    step: 1,
    unit: "percentage points",
    blurb:
      "How far a category's demand-minus-supply gap must move between snapshots before the desk calls it a real " +
      "change rather than measurement noise. Applies symmetrically: a constraint easing past this threshold is " +
      "reported exactly as loudly as one tightening.",
    cites: [],
  }),
  bool({
    key: "backlogSignal",
    label: "Treat an extending backlog as a constraint signal",
    group: "scoring",
    envVar: "MAG8_BN_BACKLOG_SIGNAL",
    default: true,
    blurb:
      "Some constraints have no clean production series but do have a disclosed order book. When delivery slots " +
      "keep moving further into the future release after release, that is direct evidence of a binding limit — " +
      "so the desk scores it even without a supply time series to difference.",
    cites: [],
  }),

  /* ---- Exposure ---- */
  num({
    key: "concentrationPct",
    label: "Concentration flag threshold",
    group: "exposure",
    envVar: "MAG8_BN_CONCENTRATION_PCT",
    default: 20,
    min: 5,
    max: 100,
    step: 5,
    unit: "% of portfolio",
    blurb:
      "Flags when this share or more of a portfolio sits in companies supplying a single constrained input. The " +
      "flag notes the concentration; whether that is conviction or an accident is the reader's call.",
    cites: [],
  }),

  /* ---- Operational ---- */
  num({
    key: "edgarTimeoutMs",
    label: "SEC request timeout",
    group: "ops",
    envVar: "MAG8_BN_EDGAR_TIMEOUT_MS",
    default: 20_000,
    min: 5_000,
    max: 120_000,
    step: 5_000,
    scale: 1000,
    unit: "s",
    integer: true,
    blurb: "Per-request budget for SEC filings data. A timeout degrades the affected panel and is disclosed there.",
    cites: [],
  }),
  num({
    key: "edgarCacheDays",
    label: "Cached filing retention",
    group: "ops",
    envVar: "MAG8_BN_EDGAR_CACHE_DAYS",
    default: 90,
    min: 1,
    max: 365,
    step: 1,
    unit: "days",
    integer: true,
    blurb:
      "How long fetched SEC responses are kept on disk before the cache is swept. Filings are immutable once " +
      "accepted, so this is a storage bound rather than a correctness one.",
    cites: [],
  }),
];

export interface BottleneckSettings {
  filingLagDays: number;
  holdingsMinPct: number;
  showOptionsOverlay: boolean;
  demandStaleDays: number;
  demandBasketMax: number;
  supplyMinPoints: number;
  supplyStaleDays: number;
  gapMaterialPct: number;
  backlogSignal: boolean;
  concentrationPct: number;
  edgarTimeoutMs: number;
  edgarCacheDays: number;
}

export type BottleneckSettingKey = keyof BottleneckSettings;

const registry = createSettingsRegistry<BottleneckSettingGroupKey, BottleneckSettings>({
  spec: BOTTLENECK_SETTINGS_SPEC,
  storageKey: "bottleneck_settings",
});

export interface EffectiveBottleneckSettings {
  values: BottleneckSettings;
  sources: Record<BottleneckSettingKey, SettingSource>;
}

export const cleanBottleneckOverrides = registry.clean;
export const effectiveBottleneckSettings = registry.effective;
export const bottleneckSettings = registry.values;
export const baselineBottleneckSettings = registry.baseline;
export const saveBottleneckOverrides = registry.save;
export const saveBottleneckDiff = registry.saveDiff;
