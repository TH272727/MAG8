import {
  boolSetting,
  createSettingsRegistry,
  formatSettingValue,
  type BooleanSettingSpec,
  type NumberSettingSpec,
  type SettingSource,
  type SettingSpec,
  numSetting,
} from "./settings-registry";

/* ============================================================================
 * Stage-0 universe screen — settings registry & resolver.
 *
 * Single source of truth for every screening parameter: nothing in the screen
 * is hard-coded. Each setting carries a research-backed default (cites resolve
 * against lib/citations.ts, the same registry /methodology renders), an env
 * override, and an owner override persisted in the DB (set from /admin).
 * Precedence: DB override > env var > default. The MAG8_UNIVERSE=0 kill switch
 * stays env-only and supreme (lib/universe.ts reads it per call).
 *
 * The resolver machinery itself lives in lib/settings-registry.ts, shared with
 * the Bottleneck desk's own knobs — one precedence rule, one place.
 * ========================================================================== */

export { formatSettingValue };
export type { SettingSource };

export type UniverseSettingGroupKey = "listing" | "size" | "solvency" | "pool" | "selection" | "ops";

export const UNIVERSE_SETTING_GROUPS: { key: UniverseSettingGroupKey; title: string; note: string }[] = [
  {
    key: "listing",
    title: "Listing hygiene",
    note: "What counts as a real, investable operating company on a US primary exchange.",
  },
  {
    key: "size",
    title: "Size & liquidity",
    note: "The discovery band: big enough to screen mechanically, small enough to still 20×, liquid enough to actually trade.",
  },
  {
    key: "solvency",
    title: "Solvency & issuance — SEC filings data",
    note: "Deterministic screens computed from structured SEC filings (XBRL), not from model judgment. A company missing a data point always PASSES the affected screen (fail-open) — absence of data is never treated as evidence.",
  },
  {
    key: "pool",
    title: "Pool, ranking & disclosure",
    note: "How the eligible set becomes the scout's weekly long-list — a fundamentals-ranked head plus a rotating sweep of the rest — and how far outside the band a delivered pick may sit before it is flagged.",
  },
  {
    key: "selection",
    title: "Selection discipline — the anti-familiarity floor",
    note: "How the scout must draw from the ranked pool. A generative model cannot un-know the famous names; these levers cap, measure, and disclose that pull rather than pretend to erase it — a floor on picks taken from the fundamentals-ranked head and a ceiling on how many widely-covered consensus names a cohort may contain. Off by default (a floor of 0 and a ceiling at the full cohort size do nothing); turn them on to bias selection toward data over name recognition.",
  },
  {
    key: "ops",
    title: "Operational",
    note: "Fetch budgets. The screen is fail-open end to end: a slow or dead feed can never fail a run.",
  },
];

export type UniverseSettingSpec = SettingSpec<UniverseSettingGroupKey>;
export type { NumberSettingSpec, BooleanSettingSpec };

const num = numSetting<UniverseSettingGroupKey>;
const bool = boolSetting<UniverseSettingGroupKey>;

export const UNIVERSE_SETTINGS_SPEC: UniverseSettingSpec[] = [
  /* ---- Listing hygiene ---- */
  bool({
    key: "includeAmex",
    label: "Include NYSE American (AMEX) listings",
    group: "listing",
    envVar: "MAG8_UNIVERSE_AMEX",
    default: true,
    blurb:
      "Adds the third US primary exchange (~300 listings, mostly small-cap resources and industrials) to NYSE + Nasdaq. NYSE and Nasdaq are all-or-nothing — a half universe would bias the screen — while AMEX is additive: if only its feed fails, the run proceeds without it and says so.",
    cites: [],
  }),
  bool({
    key: "fundVehicleScreen",
    label: "Exclude pooled investment vehicles",
    group: "listing",
    envVar: "MAG8_UNIVERSE_FUND_SCREEN",
    default: true,
    blurb:
      "Closed-end funds and similar pooled vehicles (income/allocation/term trusts) are baskets of other assets, not operating companies — they cannot express trillion-dollar DNA. Matched by fund-naming conventions; operating REITs and banks are deliberately not matched.",
    cites: ["Bessembinder 2018"],
  }),
  num({
    key: "priceMinUsd",
    label: "Minimum share price",
    group: "listing",
    envVar: "MAG8_UNIVERSE_PRICE_MIN",
    default: 2,
    min: 0,
    max: 25,
    step: 0.5,
    unit: "USD",
    blurb:
      "Very low-priced shares trade like lottery tickets — gambling-driven flow, negative average excess returns — and a $1bn+ company priced under $2 usually got there through distress or serial dilution. The exchanges' own continued-listing floor is $1; the default holds a buffer above it. Set 0 to disable.",
    cites: ["Kumar 2009", "Bali, Cakici & Whitelaw 2011"],
  }),
  num({
    key: "minListingYears",
    label: "Minimum listing age",
    group: "listing",
    envVar: "MAG8_UNIVERSE_MIN_LISTING_YEARS",
    default: 1,
    min: 0,
    max: 5,
    step: 1,
    unit: "calendar years",
    integer: true,
    blurb:
      "New listings arrive expensive on average and underperform seasoned matches for years; one full reporting cycle also gives the solvency screens real filings to read. Measured in calendar years from the listing year (feed granularity); unknown listing years pass. The scout may still nominate a hot new listing off-pool with an explicit justification. Set 0 to disable.",
    cites: ["Ritter 1991"],
  }),

  /* ---- Size & liquidity ---- */
  num({
    key: "mcapMinUsd",
    label: "Market-cap floor",
    group: "size",
    envVar: "MAG8_UNIVERSE_MCAP_MIN",
    default: 1_000_000_000,
    min: 100_000_000,
    max: 20_000_000_000,
    step: 100_000_000,
    scale: 1e9,
    unit: "$B",
    blurb:
      "The size premium is real but concentrates in the smallest firms alongside illiquidity, manipulation risk, and unreliable data — below the floor, mechanical screens stop being trustworthy and the lottery zone begins.",
    cites: ["Banz 1981", "Kumar 2009"],
  }),
  num({
    key: "mcapMaxUsd",
    label: "Market-cap ceiling",
    group: "size",
    envVar: "MAG8_UNIVERSE_MCAP_MAX",
    default: 50_000_000_000,
    min: 1_000_000_000,
    max: 500_000_000_000,
    step: 1_000_000_000,
    scale: 1e9,
    unit: "$B",
    blurb:
      "The mandate is finding the winners while they are still small: a name at the ceiling still has a 20× path to a trillion. Wealth creation concentrates in a ~4% sliver of companies — the point is catching them before they are obvious, not re-ranking today's giants.",
    cites: ["Bessembinder 2018"],
  }),
  num({
    key: "minDollarVolumeUsd",
    label: "Day traded value floor",
    group: "size",
    envVar: "MAG8_UNIVERSE_MIN_DVOL",
    default: 2_000_000,
    min: 0,
    max: 100_000_000,
    step: 500_000,
    scale: 1e6,
    unit: "$M/day",
    blurb:
      "Illiquid names carry structural discounts and price-impact costs that make quoted prices unactionable for readers. Measured as latest-day share volume × last sale (a snapshot, not an average — disclosed as such).",
    cites: ["Amihud 2002"],
  }),

  /* ---- Solvency & issuance ---- */
  bool({
    key: "secEnrich",
    label: "Enrich with SEC filings data (XBRL)",
    group: "solvency",
    envVar: "MAG8_SEC",
    default: true,
    blurb:
      "Joins the exchange feed to structured SEC filings — cash & short-term investments, operating cash flow, revenue, stockholders' equity, share counts — the deterministic ground truth the solvency screens and the per-pick disclosures run on. Covers roughly three-quarters of the eligible set (foreign filers reporting under IFRS are the main gap and simply pass unscreened). Disabling this disables every screen below.",
    cites: [],
  }),
  bool({
    key: "runwayScreen",
    label: "Cash-runway screen",
    group: "solvency",
    envVar: "MAG8_UNIVERSE_RUNWAY_SCREEN",
    default: true,
    blurb:
      "Excludes cash-burning companies whose liquid assets (cash + short-term investments per latest filings) cannot cover their trailing-year operating cash burn for the horizon below. Distress is not compensated — the market pays worst exactly where solvency math fails.",
    cites: ["Campbell, Hilscher & Szilagyi 2008"],
  }),
  num({
    key: "runwayMinYears",
    label: "Minimum cash runway",
    group: "solvency",
    envVar: "MAG8_UNIVERSE_RUNWAY_MIN_YEARS",
    default: 1,
    min: 0.25,
    max: 3,
    step: 0.25,
    unit: "years",
    blurb:
      "The default mirrors US GAAP's own going-concern window: management must evaluate solvency one year out every reporting period. A company below it needs new money within the screen's horizon.",
    cites: ["FASB 2014", "Campbell, Hilscher & Szilagyi 2008"],
  }),
  bool({
    key: "runwayExemptFinance",
    label: "Exempt Finance sector from the runway screen",
    group: "solvency",
    envVar: "MAG8_UNIVERSE_RUNWAY_EXEMPT_FIN",
    default: true,
    blurb:
      "Lenders, BDCs, and asset managers report negative operating cash flow structurally (originating loans and funding deals is an operating outflow) — cash-burn arithmetic misreads them as distressed. Their solvency is capital-structure math, which the fundamentals lens handles downstream.",
    cites: [],
  }),
  bool({
    key: "zombieScreen",
    label: "Shell / zombie screen",
    group: "solvency",
    envVar: "MAG8_UNIVERSE_ZOMBIE_SCREEN",
    default: true,
    blurb:
      "Excludes the accounting signature of a shell: essentially no revenue AND negative operating cash flow AND negative stockholders' equity, all at once. Pre-revenue moonshots with real balance sheets pass — all three conditions must hold together.",
    cites: ["Campbell, Hilscher & Szilagyi 2008"],
  }),
  num({
    key: "zombieMaxRevenueUsd",
    label: "Shell screen: revenue ceiling",
    group: "solvency",
    envVar: "MAG8_UNIVERSE_ZOMBIE_MAX_REV",
    default: 1_000_000,
    min: 0,
    max: 100_000_000,
    step: 500_000,
    scale: 1e6,
    unit: "$M",
    blurb: "Trailing-year revenue below this counts as 'essentially no revenue' for the shell composite above.",
    cites: [],
  }),
  bool({
    key: "dilutionScreen",
    label: "Share-issuance screen",
    group: "solvency",
    envVar: "MAG8_UNIVERSE_DILUTION_SCREEN",
    default: false,
    blurb:
      "Heavy net share issuance predicts poor returns — but raw filing-to-filing share counts cannot tell dilution from a stock split or a stock-funded acquisition, so as a hard filter this false-kills real companies. Default OFF as a screen; heavy issuance on a DELIVERED pick is always disclosed as a flag either way.",
    cites: ["Pontiff & Woodgate 2008"],
  }),
  num({
    key: "maxDilutionPct",
    label: "Share-count growth threshold",
    group: "solvency",
    envVar: "MAG8_UNIVERSE_MAX_DILUTION_PCT",
    default: 50,
    min: 10,
    max: 200,
    step: 5,
    unit: "% YoY",
    blurb:
      "Year-over-year share-count growth (SEC cover-page counts, same fiscal quarter) above this triggers the issuance screen when enabled, and the per-pick disclosure flag always. Growth-stage names financing via equity commonly run 20–40%; the default targets serial extreme issuers.",
    cites: ["Pontiff & Woodgate 2008"],
  }),

  /* ---- Pool & disclosure ---- */
  num({
    key: "poolSize",
    label: "Weekly pool size",
    group: "pool",
    envVar: "MAG8_UNIVERSE_POOL",
    default: 300,
    min: 50,
    max: 1000,
    step: 25,
    unit: "names",
    integer: true,
    blurb:
      "The total weekly long-list injected into the discovery prompt: the fundamentals-ranked segment plus a sector-stratified, week-seeded rotation of the rest of the eligible set. Breadth multiplies edge — the fundamental law of active management — while the rotation sweeps the whole eligible set over successive runs.",
    cites: ["Grinold 1989"],
  }),
  bool({
    key: "rankPool",
    label: "Rank the pool by filings fundamentals",
    group: "pool",
    envVar: "MAG8_UNIVERSE_RANK",
    default: true,
    blurb:
      "Orders the eligible set by a deterministic composite computed from structured SEC filings — revenue growth (35%), operating-cash-flow margin (20%) and its year-over-year trajectory (15%), share-count discipline (15%), cash survivability (15%) — each factor a percentile within the eligible set, missing data scoring neutral. The top of the ranking leads the pool with one-line filings digests, so filings-derived selection evidence sits in front of the scout before name familiarity can act. The ranking orders the reading list; it does not pick winners — growth persistence is rare, and the literature says so.",
    cites: ["Novy-Marx 2013", "Sloan 1996", "Chan, Karceski & Lakonishok 2003", "Pontiff & Woodgate 2008"],
  }),
  num({
    key: "rankTopN",
    label: "Ranked segment size",
    group: "pool",
    envVar: "MAG8_UNIVERSE_RANK_TOP",
    default: 100,
    min: 25,
    max: 500,
    step: 25,
    unit: "names",
    integer: true,
    blurb:
      "How many top-ranked names lead the weekly pool with filings digests (capped by the pool size). The remaining slots stay a sector-stratified weekly rotation of the rest of the eligible set, so full-universe sweep is preserved underneath the ranking.",
    cites: ["Grinold 1989"],
  }),
  num({
    key: "bandSlackPct",
    label: "Band-flag slack",
    group: "pool",
    envVar: "MAG8_UNIVERSE_BAND_SLACK",
    default: 10,
    min: 0,
    max: 50,
    step: 5,
    unit: "%",
    blurb:
      "How far outside the market-cap band a delivered pick may sit before the run discloses it as an out-of-band exception. Slack keeps honest borderline picks unflagged; the flag is a disclosure, never a veto.",
    cites: [],
  }),

  /* ---- Selection discipline (anti-familiarity) ---- */
  num({
    key: "rankedFloor",
    label: "Ranked-head selection floor",
    group: "selection",
    envVar: "MAG8_SELECT_RANKED_FLOOR",
    default: 0,
    min: 0,
    max: 12,
    step: 1,
    unit: "picks",
    integer: true,
    blurb:
      "The minimum number of the delivered cohort that must come from the fundamentals-ranked head of the pool — the deterministic counterweight to name familiarity, checked after discovery on the actual picks. 0 disables the floor (the scout draws freely, as before). When the hard gate below is on, a shortfall is corrected by substituting top-ranked names; otherwise it is disclosed as a gap note. Never applies when the ranked head is unavailable (SEC data down) — the run simply proceeds unscreened.",
    cites: ["Grinold 1989", "Bessembinder 2018"],
  }),
  num({
    key: "salienceCap",
    label: "Consensus-name ceiling",
    group: "selection",
    envVar: "MAG8_SELECT_SALIENCE_CAP",
    default: 12,
    min: 0,
    max: 12,
    step: 1,
    unit: "picks",
    integer: true,
    blurb:
      "The maximum number of delivered picks that may be widely-covered, consensus-crowded 'next-mega-cap' names — the ones that headline financial media and retail feeds. Measured against a fixed reference list of the most salient such names, checked after discovery. At the default (the full cohort size) it never binds; lower it to force the scout toward under-covered names, where the asymmetry more often hides. A generative model cannot forget these names, so the ceiling caps and discloses their share rather than pretending to zero it.",
    cites: ["Barber & Odean 2008", "Bessembinder 2018"],
  }),
  bool({
    key: "selectionHardGate",
    label: "Enforce selection discipline (reject & replace)",
    group: "selection",
    envVar: "MAG8_SELECT_HARD_GATE",
    default: false,
    blurb:
      "When on, a cohort that misses the floor or exceeds the consensus ceiling is not just flagged — the platform deterministically substitutes names from the fundamentals-ranked head to bring it into line, and discloses each substitution in the gap notes (judgment proposes, code enforces). When off (the default), a miss is disclosed only, and the scout's picks stand. The floor and ceiling still bound how aggressively selection can be corrected; the scout keeps the rest of the cohort.",
    cites: [],
  }),

  /* ---- Operational ---- */
  num({
    key: "fetchTimeoutMs",
    label: "Exchange feed timeout",
    group: "ops",
    envVar: "MAG8_UNIVERSE_TIMEOUT_MS",
    default: 25_000,
    min: 5_000,
    max: 120_000,
    step: 5_000,
    scale: 1000,
    unit: "s",
    integer: true,
    blurb: "Per-exchange fetch budget. On timeout the screen falls back to the most recent cached week, disclosed as stale.",
    cites: [],
  }),
  num({
    key: "secTimeoutMs",
    label: "SEC data timeout",
    group: "ops",
    envVar: "MAG8_SEC_TIMEOUT_MS",
    default: 20_000,
    min: 5_000,
    max: 120_000,
    step: 5_000,
    scale: 1000,
    unit: "s",
    integer: true,
    blurb: "Per-request budget for SEC filings data. Failures degrade gracefully: affected screens are skipped and disclosed.",
    cites: [],
  }),
];

/* ----------------------------------------------------------------------------
 * Resolution: default → env → DB override
 * -------------------------------------------------------------------------- */

export interface UniverseSettings {
  includeAmex: boolean;
  fundVehicleScreen: boolean;
  priceMinUsd: number;
  minListingYears: number;
  mcapMinUsd: number;
  mcapMaxUsd: number;
  minDollarVolumeUsd: number;
  secEnrich: boolean;
  runwayScreen: boolean;
  runwayMinYears: number;
  runwayExemptFinance: boolean;
  zombieScreen: boolean;
  zombieMaxRevenueUsd: number;
  dilutionScreen: boolean;
  maxDilutionPct: number;
  poolSize: number;
  rankPool: boolean;
  rankTopN: number;
  bandSlackPct: number;
  rankedFloor: number;
  salienceCap: number;
  selectionHardGate: boolean;
  fetchTimeoutMs: number;
  secTimeoutMs: number;
}

export type UniverseSettingKey = keyof UniverseSettings;

const registry = createSettingsRegistry<UniverseSettingGroupKey, UniverseSettings>({
  spec: UNIVERSE_SETTINGS_SPEC,
  storageKey: "universe_settings",
});

export interface EffectiveUniverseSettings {
  values: UniverseSettings;
  sources: Record<UniverseSettingKey, SettingSource>;
}

/** Overrides validator: unknown keys dropped, numbers clamped to the spec range. */
export const cleanOverrides = registry.clean;

/** Effective settings with per-key provenance. Reads the DB overrides each call — cheap, and /admin edits apply to the very next run. */
export const effectiveUniverseSettings = registry.effective;

export const universeSettings = registry.values;

/** Defaults + env only (no DB overrides) — what /admin diffs against when persisting, so a value typed back to its baseline reverts to default/env provenance. */
export const baselineUniverseSettings = registry.baseline;

/** Persist the owner's overrides (replaces the stored set; pass {} to reset everything to defaults/env). */
export const saveUniverseOverrides = registry.save;

/** Store only the values differing from the default/env baseline — the shape /admin saves. */
export const saveUniverseDiff = registry.saveDiff;
