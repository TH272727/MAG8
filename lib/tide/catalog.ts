import { z } from "zod";
import { getAppSettingJson, setAppSettingJson } from "../db";

/* ============================================================================
 * The Tide catalogue — the ONLY market-specific input to the desk.
 *
 * Two kinds of entry, deliberately separated:
 *
 *   SERIES   where a number comes from. A handle on a public feed, its
 *            publisher, its unit, how often it is published, and how long it
 *            may go without a new observation before the desk calls it stale.
 *
 *   GAUGE    what a number MEANS. Which series it reads, how the raw series is
 *            transformed before it is judged, which horizon it speaks to, and
 *            — the load-bearing field — which direction is bad.
 *
 * Separating them is what lets one series feed two gauges. The Baa credit
 * spread is read twice: its LEVEL is a slow gauge, where an unusually low
 * spread means lenders are charging little for risk, and its CHANGE is a fast
 * gauge, where a widening spread means they have started charging more. Those
 * are opposite signs of the same number, and a catalogue that could not say so
 * would have to pick one and be wrong half the time.
 *
 * THE ONE-POLARITY RULE. A gauge has exactly one horizon and one polarity.
 * Where a variable genuinely matters both ways it appears twice, with two
 * transforms and two stated meanings, as above. A gauge whose sign depends on
 * circumstances is not a gauge, it is an argument, and it does not belong in a
 * deterministic desk.
 *
 * That rule cost a gauge during the build. The obvious way to express the
 * best-known recession signal is "the curve un-inverted", because a steepening
 * after an inversion is what has historically preceded a downturn. But a
 * steepening curve that was never inverted is a good reading, so the same
 * arithmetic carries opposite meanings depending on where it started, and no
 * single polarity is honest. What survives is `curve-recent-inversion`: the
 * DEEPEST inversion in the trailing two years, which is unambiguously bad when
 * high, and which carries the same predictive content — the inversion is the
 * signal, and it is the recent past of the curve that matters rather than
 * today's reading of it.
 *
 * Built-ins live in this file so they are reviewable in the diff. An operator
 * may add or override entries through two app_settings keys, which is how a
 * new reading reaches the desk without a deploy.
 *
 * Two things deliberately do NOT live here: the operator's weights and windows
 * (they are in lib/tide-settings.ts, because they are preferences rather than
 * facts about a market) and any computed figure (nothing in this file is a
 * number the desk reports).
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * Series
 * ------------------------------------------------------------------------- */

export const TIDE_CONNECTORS = ["fred", "cboe", "market", "manual"] as const;
export type TideConnector = (typeof TIDE_CONNECTORS)[number];

/**
 * How often a publisher issues a series. This is not decoration: it sets how
 * long silence is normal before the desk calls a series stale, and it decides
 * which leg of a ratio is sampled onto the other's dates.
 */
export const TIDE_FREQUENCIES = ["daily", "weekly", "monthly", "quarterly"] as const;
export type TideFrequency = (typeof TIDE_FREQUENCIES)[number];

/** Observations expected per year, used to size windows stated in years. */
export const PER_YEAR: Record<TideFrequency, number> = {
  daily: 252,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
};

export const SeriesSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase letters, digits and hyphens"),
  label: z.string().min(3),
  connector: z.enum(TIDE_CONNECTORS),
  /** The publisher's own identifier: a FRED series id, a CBOE file, a ticker. */
  handle: z.string().min(1).max(64),
  unit: z.string().min(1),
  frequency: z.enum(TIDE_FREQUENCIES),
  publisher: z.string().min(2),
  sourceUrl: z.string().url().nullable().default(null),
  /**
   * Days without a new observation after which the series is reported stale
   * rather than read as current. Every series needs one: the free-leading-index
   * series this desk was first designed around stopped publishing in February
   * 2020 and answers a fetch perfectly well, so a series that is merely
   * reachable is not a series that is alive.
   */
  staleAfterDays: z.number().int().min(2).max(2000),
  builtIn: z.boolean().default(false),
});
export type TideSeries = z.infer<typeof SeriesSchema>;

const FRED = (
  id: string,
  handle: string,
  label: string,
  unit: string,
  frequency: TideFrequency,
  staleAfterDays: number,
): TideSeries => ({
  id,
  label,
  connector: "fred",
  handle,
  unit,
  frequency,
  publisher: "Federal Reserve Economic Data",
  sourceUrl: `https://fred.stlouisfed.org/series/${handle}`,
  staleAfterDays,
  builtIn: true,
});

/**
 * Staleness budgets, in days a series may go without a new observation.
 *
 * These are NOT derived from publication frequency, and getting that wrong is
 * the trap. A quarterly series is not stale after a hundred days: the national
 * financial accounts date an observation at the START of a quarter and publish
 * it about ten weeks after that quarter ENDS, so the newest available figure is
 * routinely more than two hundred days old and entirely current. Live data
 * caught this — the corporate-equities series sat 247 days old against a budget
 * of 250, three days from declaring the Federal Reserve's own accounts dead.
 *
 * The rule is therefore: frequency PLUS the publisher's lag, plus slack for one
 * missed release. Where the lag exceeds the interval, the budget is nearer a
 * year than a quarter.
 */
const BUILT_IN_SERIES: TideSeries[] = [
  /* ---- Rates and the curve ---- */
  FRED("t10y3m", "T10Y3M", "10-year minus 3-month Treasury spread", "percentage points", "daily", 10),
  FRED("t10y2y", "T10Y2Y", "10-year minus 2-year Treasury spread", "percentage points", "daily", 10),
  FRED("dgs10", "DGS10", "10-year Treasury yield", "percent", "daily", 10),
  FRED("dfii10", "DFII10", "10-year inflation-indexed Treasury yield", "percent", "daily", 10),
  FRED("dff", "DFF", "Effective federal funds rate", "percent", "daily", 10),
  FRED("t10yie", "T10YIE", "10-year breakeven inflation rate", "percent", "daily", 10),
  FRED("mortgage30us", "MORTGAGE30US", "30-year fixed mortgage rate", "percent", "weekly", 21),

  /* ---- Credit ---- */
  FRED("baa10y", "BAA10Y", "Moody's Baa corporate bond spread over 10-year Treasury", "percentage points", "daily", 10),
  FRED("drccl", "DRCCLACBS", "Credit-card delinquency rate, all commercial banks", "percent", "quarterly", 280),
  FRED("dral", "DRALACBN", "Loan delinquency rate, all commercial banks", "percent", "quarterly", 280),
  FRED("drtscilm", "DRTSCILM", "Banks tightening standards on business loans", "net percent", "quarterly", 200),

  /* ---- Activity and labour ---- */
  FRED("sahm", "SAHMREALTIME", "Sahm recession indicator, real-time", "percentage points", "monthly", 70),
  FRED("unrate", "UNRATE", "Unemployment rate", "percent", "monthly", 70),
  FRED("ic4wsa", "IC4WSA", "Initial jobless claims, four-week average", "claims", "weekly", 21),
  FRED("cfnaima3", "CFNAIMA3", "Chicago Fed national activity index, three-month average", "index", "monthly", 90),
  FRED("cfnaidiff", "CFNAIDIFF", "Chicago Fed national activity diffusion index", "index", "monthly", 90),
  FRED("indpro", "INDPRO", "Industrial production", "index", "monthly", 70),
  FRED("tcu", "TCU", "Capacity utilisation", "percent", "monthly", 70),
  FRED("permit", "PERMIT", "Building permits", "thousands of units", "monthly", 70),
  FRED("houst", "HOUST", "Housing starts", "thousands of units", "monthly", 70),
  FRED("htrucks", "HTRUCKSSAAR", "Heavy truck sales", "millions of units", "monthly", 70),
  FRED("umcsent", "UMCSENT", "University of Michigan consumer sentiment", "index", "monthly", 70),

  /* ---- Financial conditions and liquidity ---- */
  FRED("nfci", "NFCI", "Chicago Fed national financial conditions index", "index", "weekly", 21),
  FRED("stlfsi4", "STLFSI4", "St. Louis Fed financial stress index", "index", "weekly", 21),
  FRED("m2real", "M2REAL", "Real M2 money stock", "billions of 1982-84 dollars", "monthly", 90),
  FRED("totll", "TOTLL", "Bank credit, all commercial banks", "billions of dollars", "weekly", 21),

  /* ---- Valuation and positioning (quarterly national accounts) ---- */
  FRED("gdp", "GDP", "Gross domestic product", "billions of dollars", "quarterly", 280),
  FRED("cp", "CP", "Corporate profits after tax", "billions of dollars", "quarterly", 280),
  FRED("equities", "NCBEILQ027S", "Nonfinancial corporate business, corporate equities outstanding", "millions of dollars", "quarterly", 330),
  FRED("networth", "TNWMVBSNNCB", "Nonfinancial corporate business, net worth at market value", "millions of dollars", "quarterly", 330),
  FRED("hheq", "BOGZ1FL153064486Q", "Household corporate equities as a share of financial assets", "percent", "quarterly", 330),
  FRED("mmf", "MMMFFAQ027S", "Money market fund assets", "millions of dollars", "quarterly", 330),

  /* ---- Recession dating: context only, never scored ---- */
  FRED("usrec", "USREC", "NBER recession indicator", "0 or 1", "monthly", 70),

  /* ---- Market prices ---- */
  {
    id: "spx",
    label: "S&P 500 index",
    connector: "market",
    handle: "^GSPC",
    unit: "index",
    frequency: "daily",
    publisher: "Yahoo Finance",
    sourceUrl: "https://finance.yahoo.com/quote/%5EGSPC",
    staleAfterDays: 7,
    builtIn: true,
  },
  {
    id: "wilshire",
    label: "Wilshire 5000 total market index",
    connector: "market",
    handle: "^W5000",
    unit: "index",
    frequency: "daily",
    publisher: "Yahoo Finance",
    sourceUrl: "https://finance.yahoo.com/quote/%5EW5000",
    staleAfterDays: 7,
    builtIn: true,
  },
  {
    id: "vix",
    label: "CBOE volatility index",
    connector: "cboe",
    handle: "VIX_History.csv",
    unit: "index",
    frequency: "daily",
    publisher: "Cboe Global Markets",
    sourceUrl: "https://www.cboe.com/tradable_products/vix/vix_historical_data/",
    staleAfterDays: 7,
    builtIn: true,
  },
  {
    id: "vix3m",
    label: "CBOE 3-month volatility index",
    connector: "cboe",
    handle: "VIX3M_History.csv",
    unit: "index",
    frequency: "daily",
    publisher: "Cboe Global Markets",
    sourceUrl: "https://www.cboe.com/tradable_products/vix/vix_historical_data/",
    staleAfterDays: 7,
    builtIn: true,
  },

  /* ---- Computed here, from this application's own universe snapshot ---- */
  {
    id: "breadth-200dma",
    label: "Share of large US companies above their own 200-day average",
    connector: "manual",
    handle: "breadth-200dma",
    unit: "percent",
    frequency: "daily",
    publisher: "Computed from this platform's own universe screen",
    sourceUrl: null,
    staleAfterDays: 21,
    builtIn: true,
  },
  {
    id: "breadth-highs-lows",
    label: "New 52-week highs minus new lows, as a share of names measured",
    connector: "manual",
    handle: "breadth-highs-lows",
    unit: "percent",
    frequency: "daily",
    publisher: "Computed from this platform's own universe screen",
    sourceUrl: null,
    staleAfterDays: 21,
    builtIn: true,
  },

  /* ---- Hand-entered: reachable, but not on a machine-readable feed ---- */
  {
    id: "cape",
    label: "Cyclically adjusted price/earnings ratio",
    connector: "manual",
    handle: "cape",
    unit: "ratio",
    frequency: "monthly",
    publisher: "Robert Shiller, Yale (entered by hand)",
    sourceUrl: "https://shillerdata.com/",
    staleAfterDays: 120,
    builtIn: true,
  },
  {
    id: "margin-debt",
    label: "FINRA margin debt outstanding",
    connector: "manual",
    handle: "margin-debt",
    unit: "millions of dollars",
    frequency: "monthly",
    publisher: "FINRA (entered by hand)",
    sourceUrl: "https://www.finra.org/rules-guidance/key-topics/margin-accounts/margin-statistics",
    staleAfterDays: 120,
    builtIn: true,
  },
];

/* ---------------------------------------------------------------------------
 * Gauges
 * ------------------------------------------------------------------------- */

export const TIDE_HORIZONS = ["slow", "fast"] as const;
export type TideHorizon = (typeof TIDE_HORIZONS)[number];

export const HORIZON_META: Record<TideHorizon, { title: string; question: string; note: string }> = {
  slow: {
    title: "Valuation and positioning",
    question: "What are the next ten years likely to pay?",
    note:
      "What you are paying for a claim on company earnings, and how much of the public's money is already " +
      "committed to that claim. These readings have historically said something about long-horizon returns " +
      "and almost nothing about the coming year, so they set expectations rather than timing.",
  },
  fast: {
    title: "Cycle, credit and trend",
    question: "How much drawdown risk is there over the next six to twelve months?",
    note:
      "Whether the economy is turning, whether lenders have started charging more for risk, and whether the " +
      "market's own price behaviour has broken down. These are the readings that have historically moved " +
      "before a decline rather than after it.",
  },
};

export const TIDE_FAMILIES = [
  "valuation",
  "positioning",
  "cycle",
  "labour",
  "credit",
  "liquidity",
  "trend",
  "breadth",
  "sentiment",
] as const;
export type TideFamily = (typeof TIDE_FAMILIES)[number];

/**
 * A family's display name and what it covers. Deliberately carries NO horizon:
 * credit and sentiment are read on both, with different transforms and
 * opposite meanings, so a family-to-horizon field here would contradict the
 * gauges themselves. A gauge's own `horizon` is the only answer to that
 * question, and lib/tide/score.ts weights on the pair.
 */
export const FAMILY_META: Record<TideFamily, { title: string; note: string }> = {
  valuation: {
    title: "Valuation",
    note: "What a claim on corporate earnings costs, measured against the economy that produces them.",
  },
  positioning: {
    title: "Positioning",
    note:
      "How much of the public's money is already in equities. This is the mirror of valuation rather than a " +
      "second opinion on it: when the average household holds an unusually large share in shares, there is " +
      "less money left to become a buyer.",
  },
  cycle: {
    title: "Economic cycle",
    note: "Whether output, orders and construction are still expanding.",
  },
  labour: {
    title: "Labour market",
    note:
      "The slowest thing to turn and the hardest to argue with. Employment deteriorating is the single " +
      "reading that has most reliably arrived alongside a recession rather than being debated during one.",
  },
  credit: {
    title: "Credit and lending",
    note: "What lenders charge for risk, and whether they have started refusing it.",
  },
  liquidity: {
    title: "Financial conditions",
    note: "How easy money is to raise, priced by the funding markets rather than announced by anyone.",
  },
  trend: {
    title: "Price trend",
    note:
      "What the market's own price is doing. Included because the evidence says a trend rule captures " +
      "something the economic series do not, not because a chart is a reason.",
  },
  breadth: {
    title: "Market breadth",
    note:
      "How many companies are participating, counted one company at a time rather than inferred from an " +
      "index. An index can rise on a handful of names while most of the market is already falling.",
  },
  sentiment: {
    title: "Sentiment and volatility",
    note:
      "What people say and what they pay for protection. Weighted lightest on purpose: sentiment is a lead " +
      "rather than evidence, and it is the family most likely to be loud and wrong.",
  },
};

/**
 * How a raw series becomes the quantity that is judged.
 *
 * Every mode produces a series in the same shape as its input, with nulls
 * wherever the window is not yet full. Nothing is carried forward and nothing
 * is filled in.
 */
export const TransformSchema = z.discriminatedUnion("mode", [
  /** The published number, judged as it stands. */
  z.object({ mode: z.literal("level") }),
  /** Percent change over `periods` observations. */
  z.object({ mode: z.literal("changePct"), periods: z.number().int().min(1).max(2000) }),
  /** Arithmetic change over `periods` observations, in the series' own unit. */
  z.object({ mode: z.literal("change"), periods: z.number().int().min(1).max(2000) }),
  /** Percent distance from the series' own trailing simple average. */
  z.object({ mode: z.literal("gapVsAveragePct"), window: z.number().int().min(2).max(4000) }),
  /** Value minus its own lowest reading over the window — the Sahm shape. */
  z.object({ mode: z.literal("riseFromTrailingLow"), window: z.number().int().min(2).max(4000) }),
  /** Negated lowest reading over the window: high when the series went deeply negative. */
  z.object({ mode: z.literal("depthOfTrailingLow"), window: z.number().int().min(2).max(4000) }),
]);
export type TideTransform = z.infer<typeof TransformSchema>;

export const GaugeSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be lowercase letters, digits and hyphens"),
  label: z.string().min(3),
  family: z.enum(TIDE_FAMILIES),
  horizon: z.enum(TIDE_HORIZONS),
  /** A scored gauge moves the composite; a context gauge is reported and never scored. */
  kind: z.enum(["scored", "context"]).default("scored"),
  /**
   * Which way is bad for equity owners. The single most important field here,
   * and the reason the one-polarity rule exists: a gauge whose direction is
   * arguable has to become two gauges before it can be scored at all.
   */
  polarity: z.enum(["high-is-bad", "high-is-good"]),
  /** Series id, or two ids to be combined before the transform is applied. */
  inputs: z.array(z.string().min(1)).min(1).max(2),
  /** How two inputs combine. `single` requires exactly one input. */
  combine: z.enum(["single", "ratio", "difference"]).default("single"),
  /** Multiplier applied after combining, purely so a ratio reads in familiar units. */
  scale: z.number().default(1),
  transform: TransformSchema,
  /** One or two sentences: what a HIGH reading means. Rendered verbatim. */
  highMeans: z.string().min(10),
  lowMeans: z.string().min(10),
  /** One line stating what would show this reading to be misleading. */
  falsification: z.string().min(10),
  /** Named originator, where the reading is a specific person's construction. */
  attribution: z.string().nullable().default(null),
  builtIn: z.boolean().default(false),
});
export type TideGauge = z.infer<typeof GaugeSchema>;

const g = (x: Omit<TideGauge, "kind" | "combine" | "scale" | "attribution" | "builtIn"> &
  Partial<Pick<TideGauge, "kind" | "combine" | "scale" | "attribution">>): TideGauge => ({
  kind: "scored",
  combine: "single",
  scale: 1,
  attribution: null,
  builtIn: true,
  ...x,
});

/* Window sizes, in observations of the series being transformed. */
const Q = PER_YEAR.quarterly;
const M = PER_YEAR.monthly;
const D = PER_YEAR.daily;

const SLOW_GAUGES: TideGauge[] = [
  g({
    id: "buffett-indicator",
    label: "Total US market value against the economy",
    family: "valuation",
    horizon: "slow",
    polarity: "high-is-bad",
    inputs: ["wilshire", "gdp"],
    combine: "ratio",
    transform: { mode: "level" },
    attribution: "Warren Buffett",
    highMeans:
      "The whole listed market is priced high relative to the size of the economy whose output it ultimately " +
      "claims. Historically this has come with weaker returns over the following decade.",
    lowMeans: "The listed market is priced low against the economy behind it.",
    falsification:
      "The listed market's share of the economy is not fixed: companies earn more of their profit abroad " +
      "than they used to, and more of the economy is listed than in earlier decades, so a level that was " +
      "extreme in 1990 need not be extreme now.",
  }),
  g({
    id: "equities-to-gdp",
    label: "Corporate equities outstanding against the economy",
    family: "valuation",
    horizon: "slow",
    polarity: "high-is-bad",
    inputs: ["equities", "gdp"],
    combine: "ratio",
    scale: 0.001,
    transform: { mode: "level" },
    highMeans:
      "The value of corporate equity claims is large against national output. This is the same question the " +
      "reading above asks, taken from the national financial accounts rather than from an index.",
    lowMeans: "Corporate equity claims are small against national output.",
    falsification:
      "This measures only nonfinancial corporate business, and it is filed with a quarter's delay, so it " +
      "describes where the market was rather than where it closed yesterday.",
  }),
  g({
    id: "tobins-q",
    label: "Market value against replacement value",
    family: "valuation",
    horizon: "slow",
    polarity: "high-is-bad",
    inputs: ["equities", "networth"],
    combine: "ratio",
    transform: { mode: "level" },
    attribution: "James Tobin",
    highMeans:
      "Companies are valued well above what their assets would cost to rebuild. When that has been true, " +
      "building new capacity has been cheaper than buying it, and the gap has historically closed.",
    lowMeans: "Companies are valued at or below the cost of rebuilding their assets.",
    falsification:
      "Balance sheets record buildings and machines far better than they record software, brands and " +
      "research, so a modern economy can carry a permanently higher ratio without being expensive.",
  }),
  g({
    id: "profit-share",
    label: "Corporate profits as a share of the economy",
    family: "valuation",
    horizon: "slow",
    polarity: "high-is-bad",
    inputs: ["cp", "gdp"],
    combine: "ratio",
    scale: 100,
    transform: { mode: "level" },
    highMeans:
      "Profits are taking an unusually large share of national income. A high starting share is a poor base " +
      "to grow from, because the share has historically returned toward its average.",
    lowMeans: "Profits are taking a small share of national income, which has historically been a better base.",
    falsification:
      "The share has trended upward for decades rather than oscillating around a fixed level, so treating its " +
      "long average as a destination assumes a reversion that may not be coming.",
  }),
  g({
    id: "household-equity-share",
    label: "Household money already committed to equities",
    family: "positioning",
    horizon: "slow",
    polarity: "high-is-bad",
    inputs: ["hheq"],
    transform: { mode: "level" },
    highMeans:
      "Households already hold an unusually large share of their financial assets in shares. There is less " +
      "money left on the sidelines to become a future buyer.",
    lowMeans:
      "Households hold an unusually small share in shares, leaving more money that could become a buyer.",
    falsification:
      "The share rises simply because share prices rise, so an extreme reading can be an effect of the market " +
      "having gone up rather than a cause of what happens next.",
  }),
  g({
    id: "cash-on-sidelines",
    label: "Money-fund assets against the value of the market",
    family: "positioning",
    horizon: "slow",
    polarity: "high-is-good",
    inputs: ["mmf", "equities"],
    combine: "ratio",
    scale: 100,
    transform: { mode: "level" },
    highMeans: "A large pool of cash is parked in money funds relative to the size of the equity market.",
    lowMeans: "Little cash is parked relative to the size of the market.",
    falsification:
      "Cash is held for reasons other than waiting to buy shares, and it pays interest: a high balance when " +
      "short rates are high may simply be people being paid to hold it.",
  }),
  g({
    id: "credit-spread-level",
    label: "What lenders charge for corporate risk",
    family: "credit",
    horizon: "slow",
    polarity: "high-is-good",
    inputs: ["baa10y"],
    transform: { mode: "level" },
    highMeans:
      "Lenders are demanding a lot to hold corporate credit. Risk is being priced generously, which has " +
      "historically been a better moment to take it.",
    lowMeans:
      "Lenders are charging very little for corporate risk. Compensation for risk is thin, which leaves " +
      "little cushion if conditions change.",
    falsification:
      "A spread is a price of credit rather than of shares, and the two can stay apart for years; a thin " +
      "spread has often stayed thin for a long time.",
  }),
  g({
    id: "real-long-rate",
    label: "The real return available without taking equity risk",
    family: "valuation",
    horizon: "slow",
    polarity: "high-is-bad",
    inputs: ["dfii10"],
    transform: { mode: "level" },
    highMeans:
      "Inflation-protected government debt pays a high real return, which is the alternative equities are " +
      "competing against.",
    lowMeans: "Safe real returns are low, which leaves equities with less to beat.",
    falsification:
      "A high real rate can reflect expected growth rather than tight policy, and in that case it is not the " +
      "headwind for shares that it looks like.",
  }),
  g({
    id: "vix-complacency",
    label: "The standing price of protection",
    family: "sentiment",
    horizon: "slow",
    polarity: "high-is-good",
    inputs: ["vix"],
    transform: { mode: "level" },
    highMeans:
      "Protection against a fall is expensive, which happens when people are already frightened. Historically " +
      "that has been a better moment to buy than a calm one.",
    lowMeans:
      "Protection is cheap and few people want it. Calm is the normal state of the market rather than a " +
      "warning, but sustained extreme calm has often preceded the end of a run.",
    falsification:
      "Volatility can stay low for years while the market rises, so a low reading dates nothing; it describes " +
      "the mood rather than the setup.",
  }),
  g({
    id: "cape",
    label: "Cyclically adjusted price/earnings ratio",
    family: "valuation",
    horizon: "slow",
    polarity: "high-is-bad",
    inputs: ["cape"],
    transform: { mode: "level" },
    attribution: "Robert Shiller",
    highMeans:
      "Shares are expensive against ten years of inflation-adjusted earnings, which smooths out where in the " +
      "cycle profits happen to be.",
    lowMeans: "Shares are cheap against a decade of smoothed earnings.",
    falsification:
      "Accounting rules for earnings have changed over the ratio's long history, so the modern series is not " +
      "measured quite the same way as the one whose extremes it is being compared against.",
  }),
  g({
    id: "margin-debt-growth",
    label: "Borrowing against shares, year on year",
    family: "positioning",
    horizon: "slow",
    polarity: "high-is-bad",
    inputs: ["margin-debt"],
    transform: { mode: "changePct", periods: M },
    highMeans: "Investors are rapidly increasing the money they have borrowed against their holdings.",
    lowMeans: "Borrowing against holdings is shrinking, which has usually already happened by the time a fall ends.",
    falsification:
      "Borrowing rises because prices rise, so this largely follows the market rather than leading it; it " +
      "describes how a fall would be amplified, not when one starts.",
  }),
];

const FAST_GAUGES: TideGauge[] = [
  g({
    id: "curve-level",
    label: "The Treasury yield curve",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["t10y3m"],
    transform: { mode: "level" },
    attribution: "Arturo Estrella and Frederic Mishkin",
    highMeans: "Long borrowing costs more than short borrowing, which is the ordinary state of a growing economy.",
    lowMeans:
      "Long borrowing costs less than short borrowing. Every US recession of the past half century has been " +
      "preceded by this, though not every occurrence has been followed by one.",
    falsification:
      "The curve can be pushed around by central-bank bond holdings rather than by expectations, in which " +
      "case its shape says less about growth than it used to.",
  }),
  g({
    id: "curve-recent-inversion",
    label: "The deepest curve inversion of the past two years",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["t10y3m"],
    transform: { mode: "depthOfTrailingLow", window: 2 * D },
    attribution: "Arturo Estrella and Frederic Mishkin",
    highMeans:
      "The curve was deeply inverted at some point in the past two years. The recession signal is the " +
      "inversion itself, and it has historically arrived a year or more before the downturn, so the recent " +
      "past of the curve matters more than today's reading of it.",
    lowMeans: "The curve has not been meaningfully inverted in the past two years.",
    falsification:
      "The lag between inversion and recession has been long and variable, and on at least one occasion there " +
      "was no recession at all; a deep past inversion dates nothing precisely.",
  }),
  g({
    id: "curve-2y",
    label: "10-year minus 2-year Treasury spread",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["t10y2y"],
    transform: { mode: "level" },
    highMeans: "The longer curve is normally sloped.",
    lowMeans: "The longer curve is flat or inverted.",
    falsification: "It measures the same thing as the reading above and should not be read as independent confirmation.",
  }),
  g({
    id: "sahm-rule",
    label: "Unemployment rising off its own floor",
    family: "labour",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["sahm"],
    transform: { mode: "level" },
    attribution: "Claudia Sahm",
    highMeans:
      "The three-month average unemployment rate has risen appreciably above its low of the previous year. " +
      "Half a percentage point is the level at which this has historically coincided with a recession " +
      "already being underway.",
    lowMeans: "Unemployment is at or near its own recent floor.",
    falsification:
      "The rule was built to identify a recession that has already started, not to forecast one, and it can " +
      "be triggered by more people entering the workforce rather than by anyone losing a job.",
  }),
  g({
    id: "unemployment-rise",
    label: "Unemployment against its own 12-month low",
    family: "labour",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["unrate"],
    transform: { mode: "riseFromTrailingLow", window: 12 },
    highMeans: "The unemployment rate has risen well off its floor of the past year.",
    lowMeans: "The unemployment rate is at its floor of the past year.",
    falsification: "This is the raw material of the rule above and moves with it; it is not a second opinion.",
  }),
  g({
    id: "jobless-claims",
    label: "Initial jobless claims, four-week average",
    family: "labour",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["ic4wsa"],
    transform: { mode: "level" },
    highMeans: "More people are filing for unemployment insurance each week.",
    lowMeans: "Few people are filing, which is what a tight labour market looks like.",
    falsification:
      "The level drifts with the size of the workforce over decades, so a count that was low in 1980 is not " +
      "comparable to the same count today.",
  }),
  g({
    id: "national-activity",
    label: "Broad national economic activity",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["cfnaima3"],
    transform: { mode: "level" },
    highMeans: "Economic activity across output, employment, consumption and sales is running above trend.",
    lowMeans:
      "Activity is running below trend. Sustained readings well below zero have historically accompanied " +
      "recessions.",
    falsification:
      "It is an average of eighty-five series and is revised as those series are revised, so today's reading " +
      "is not necessarily the one that will end up in the record.",
  }),
  g({
    id: "activity-diffusion",
    label: "How broadly activity is expanding",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["cfnaidiff"],
    transform: { mode: "level" },
    highMeans: "Most of the underlying measures are contributing positively rather than a few carrying the rest.",
    lowMeans: "Weakness is broad rather than confined to one part of the economy.",
    falsification: "It shares its inputs with the reading above and is revised with them.",
  }),
  g({
    id: "industrial-production",
    label: "Industrial production, year on year",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["indpro"],
    transform: { mode: "changePct", periods: M },
    highMeans: "Factories, mines and utilities are producing more than a year ago.",
    lowMeans: "Physical output is shrinking against a year ago.",
    falsification: "Manufacturing is a small and shrinking share of the economy, so it can contract without the rest following.",
  }),
  g({
    id: "capacity-utilisation",
    label: "Capacity utilisation",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["tcu"],
    transform: { mode: "level" },
    highMeans: "Existing industrial capacity is being used intensively.",
    lowMeans: "Capacity is sitting idle.",
    falsification: "It has trended down for decades as the economy shifted away from heavy industry.",
  }),
  g({
    id: "building-permits",
    label: "Building permits, year on year",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["permit"],
    transform: { mode: "changePct", periods: M },
    highMeans: "More new housing is being authorised than a year ago. Construction commits money well ahead of activity.",
    lowMeans: "Housing authorisations are falling, which has historically led downturns by a wide margin.",
    falsification:
      "Permits are volatile month to month and are strongly driven by mortgage rates, so a fall can reflect " +
      "the cost of borrowing rather than any judgement about the economy.",
  }),
  g({
    id: "heavy-truck-sales",
    label: "Heavy truck sales, year on year",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["htrucks"],
    transform: { mode: "changePct", periods: M },
    highMeans: "Freight operators are committing to new equipment, which they do when they expect goods to move.",
    lowMeans: "Orders for heavy equipment are falling.",
    falsification: "A small, lumpy series that can swing on emissions rules and order backlogs rather than demand.",
  }),
  g({
    id: "housing-starts",
    label: "Housing starts, year on year",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["houst"],
    transform: { mode: "changePct", periods: M },
    highMeans: "More homes are being started than a year ago. Housebuilding commits money and labour well ahead of the activity it produces.",
    lowMeans: "Housebuilding is contracting, which has led general downturns by a wide margin in most post-war cycles.",
    falsification:
      "Starts follow the permits reading above by a month or two and are driven hard by mortgage rates, so " +
      "the two should be read as one signal rather than as agreement between two.",
  }),
  g({
    id: "card-delinquencies",
    label: "Change in credit-card delinquencies",
    family: "credit",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["drccl"],
    transform: { mode: "change", periods: Q },
    highMeans: "Households are falling behind on card balances at a rising rate — the part of credit that turns first when budgets tighten.",
    lowMeans: "Household card delinquency is falling.",
    falsification:
      "Card delinquency rises as lenders extend credit to weaker borrowers as well as when existing " +
      "borrowers weaken, so a rise can reflect who was lent to rather than what happened to them.",
  }),
  g({
    id: "credit-spread-change",
    label: "Change in the cost of corporate credit",
    family: "credit",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["baa10y"],
    transform: { mode: "change", periods: 63 },
    highMeans:
      "Lenders have raised what they charge for corporate risk over the past quarter. Credit has historically " +
      "repriced before equities did.",
    lowMeans: "The cost of corporate credit has fallen over the past quarter.",
    falsification:
      "A spread widens when Treasury yields fall as well as when corporate yields rise, so a flight into " +
      "government bonds can widen it without any deterioration in company credit.",
  }),
  g({
    id: "lending-standards",
    label: "Banks tightening standards on business loans",
    family: "credit",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["drtscilm"],
    transform: { mode: "level" },
    highMeans: "A net majority of banks report making it harder for companies to borrow.",
    lowMeans: "Banks are easing the terms on which companies can borrow.",
    falsification:
      "It is a survey of what loan officers say they are doing, collected quarterly, so it is both an opinion " +
      "and old by the time it is published.",
  }),
  g({
    id: "loan-delinquencies",
    label: "Change in bank loan delinquencies",
    family: "credit",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["dral"],
    transform: { mode: "change", periods: Q },
    highMeans: "Borrowers are falling behind on bank loans at a rising rate.",
    lowMeans: "Delinquency rates are falling.",
    falsification: "Delinquency is confirmation rather than a lead: it rises once trouble has already arrived.",
  }),
  g({
    id: "financial-conditions",
    label: "National financial conditions",
    family: "liquidity",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["nfci"],
    transform: { mode: "level" },
    highMeans: "Money and credit markets are tighter than average, on a measure that pools over a hundred indicators.",
    lowMeans: "Financial conditions are looser than average.",
    falsification:
      "It is built largely from the same credit and volatility prices scored elsewhere on this desk, so it " +
      "is partly a restatement of them rather than independent evidence.",
  }),
  g({
    id: "financial-stress",
    label: "Financial stress",
    family: "liquidity",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["stlfsi4"],
    transform: { mode: "level" },
    highMeans: "Funding markets are showing strain.",
    lowMeans: "Funding markets are calm.",
    falsification: "It overlaps heavily with the conditions index above and with the volatility readings.",
  }),
  g({
    id: "real-money-growth",
    label: "Real money supply, year on year",
    family: "liquidity",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["m2real"],
    transform: { mode: "changePct", periods: M },
    highMeans: "The money supply is growing faster than prices, which loosens the constraint on activity.",
    lowMeans: "The real money supply is shrinking.",
    falsification:
      "The relationship between money growth and either activity or asset prices has been unstable for " +
      "decades, and money can be created without anybody spending it.",
  }),
  g({
    id: "bank-credit",
    label: "Bank credit outstanding, year on year",
    family: "liquidity",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["totll"],
    transform: { mode: "changePct", periods: 52 },
    highMeans: "Banks are extending more credit than a year ago.",
    lowMeans: "Bank credit is contracting.",
    falsification: "Totals move with bank mergers and accounting reclassifications as well as with lending.",
  }),
  g({
    id: "policy-stance",
    label: "The policy rate against expected inflation",
    family: "liquidity",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["dff", "t10yie"],
    combine: "difference",
    transform: { mode: "level" },
    highMeans: "The policy rate sits well above expected inflation, which is a restrictive setting.",
    lowMeans: "The policy rate is at or below expected inflation, which is an accommodating setting.",
    falsification:
      "The rate that restrains an economy is not a fixed number and moves with productivity and demographics, " +
      "so the same gap can be restrictive in one decade and neutral in another.",
  }),
  g({
    id: "trend-10-month",
    label: "The market against its own ten-month average",
    family: "trend",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["spx"],
    transform: { mode: "gapVsAveragePct", window: 210 },
    attribution: "Meb Faber",
    highMeans:
      "The index is above its own ten-month average. A published rule that holds equities only while this is " +
      "true has historically produced similar returns to holding throughout, with materially smaller declines.",
    lowMeans: "The index is below its ten-month average, which is the condition in which that rule steps aside.",
    falsification:
      "A trend rule trades a smaller decline for many false alarms, and it is guaranteed to sell after a fall " +
      "has begun and buy back after a recovery has begun; it has also underperformed for long stretches.",
  }),
  g({
    id: "trend-12-month",
    label: "The market against a year ago",
    family: "trend",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["spx"],
    transform: { mode: "changePct", periods: D },
    highMeans: "The index is higher than a year ago.",
    lowMeans: "The index is lower than a year ago.",
    falsification: "It measures the same trend as the reading above, more crudely, and is not confirmation of it.",
  }),
  g({
    id: "breadth-above-average",
    label: "How many large companies are above their own 200-day average",
    family: "breadth",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["breadth-200dma"],
    transform: { mode: "level" },
    highMeans: "Most large companies are in their own uptrends; participation is broad.",
    lowMeans:
      "Few companies are above their own trend. When an index holds up while this reading is low, a small " +
      "number of very large companies are carrying it.",
    falsification:
      "It is counted over this platform's own screened universe rather than over an official index, so its " +
      "membership changes as that screen changes and it is not comparable to a published breadth statistic.",
  }),
  g({
    id: "breadth-highs-lows",
    label: "New 52-week highs against new lows",
    family: "breadth",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["breadth-highs-lows"],
    transform: { mode: "level" },
    highMeans: "More companies are making new one-year highs than new lows.",
    lowMeans: "More companies are making new lows than new highs, which happens well before an index reflects it.",
    falsification: "The same universe caveat as the reading above, and the measure is noisy day to day.",
  }),
  g({
    id: "vix-term-structure",
    label: "Near-term fear against three-month fear",
    family: "sentiment",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["vix", "vix3m"],
    combine: "ratio",
    transform: { mode: "level" },
    highMeans:
      "Protection for the next month costs more than protection for the next quarter. That inversion happens " +
      "when something is being feared now rather than in general.",
    lowMeans: "Near-term protection is cheaper than longer-dated protection, which is the ordinary arrangement.",
    falsification:
      "The inversion arrives with the fall rather than before it, so it identifies stress that is already " +
      "happening; it is not an early warning.",
  }),
  g({
    id: "consumer-sentiment",
    label: "Consumer sentiment",
    family: "sentiment",
    horizon: "fast",
    polarity: "high-is-good",
    inputs: ["umcsent"],
    transform: { mode: "level" },
    highMeans: "Households report feeling good about their finances and the economy.",
    lowMeans:
      "Households report feeling badly. Read carefully: extreme lows have historically been followed by " +
      "better-than-average returns, so this reading is scored lightly and against its own history.",
    falsification:
      "Sentiment has decoupled from what households actually spend for several years running, and answers " +
      "now track political affiliation closely enough that the series may not mean what it used to.",
  }),
  g({
    id: "mortgage-rate-change",
    label: "Change in the 30-year mortgage rate",
    family: "credit",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["mortgage30us"],
    transform: { mode: "change", periods: 26 },
    highMeans: "Household borrowing costs have risen over the past half year.",
    lowMeans: "Household borrowing costs have fallen, which loosens the largest constraint on household spending.",
    falsification: "Mortgage rates follow long Treasury yields, which are already scored elsewhere on this desk.",
  }),
];

/** Reported, never scored. Recession dating is the ruler, not a reading. */
const CONTEXT_GAUGES: TideGauge[] = [
  g({
    id: "nber-recession",
    label: "NBER recession dating",
    family: "cycle",
    horizon: "fast",
    kind: "context",
    polarity: "high-is-bad",
    inputs: ["usrec"],
    transform: { mode: "level" },
    highMeans:
      "The National Bureau of Economic Research has dated this month as part of a recession. This is the " +
      "ruler the desk's history is measured against and it is never scored: recessions are dated long after " +
      "they begin, so treating it as a live reading would be reading the answer off the back of the paper.",
    lowMeans: "This month is not dated as part of a recession.",
    falsification:
      "The dating is announced many months late and is revised, so the most recent months are always " +
      "provisional and may be redated.",
  }),
  g({
    id: "long-rate",
    label: "10-year Treasury yield",
    family: "liquidity",
    horizon: "fast",
    kind: "context",
    polarity: "high-is-bad",
    inputs: ["dgs10"],
    transform: { mode: "level" },
    highMeans: "Long-term government borrowing costs are high.",
    lowMeans: "Long-term government borrowing costs are low.",
    falsification:
      "Reported as context because the level of rates alone has no reliable sign for equities: shares have " +
      "risen and fallen in both high-rate and low-rate decades.",
  }),
];

export const BUILT_IN_GAUGES: TideGauge[] = [...SLOW_GAUGES, ...FAST_GAUGES, ...CONTEXT_GAUGES];

/* ---------------------------------------------------------------------------
 * Overrides and lookup
 * ------------------------------------------------------------------------- */

const SERIES_KEY = "tide_series";
const GAUGES_KEY = "tide_gauges";

function customFrom<T extends { id: string }>(key: string, schema: z.ZodType<T>): T[] {
  const raw = getAppSettingJson(key);
  if (!Array.isArray(raw)) return [];
  const out: T[] = [];
  for (const entry of raw) {
    const parsed = schema.safeParse(entry);
    if (parsed.success) out.push({ ...parsed.data, builtIn: false });
  }
  return out;
}

/** Operator-defined series. A malformed entry is dropped, never thrown. */
export const customSeries = (): TideSeries[] => customFrom(SERIES_KEY, SeriesSchema);
export const customGauges = (): TideGauge[] => customFrom(GAUGES_KEY, GaugeSchema);

function merge<T extends { id: string }>(builtIns: T[], custom: T[]): T[] {
  const byId = new Map(builtIns.map((x) => [x.id, x]));
  for (const c of custom) byId.set(c.id, c);
  return [...byId.values()];
}

/** Built-ins first; a custom entry with the same id replaces the built-in. */
export const allSeries = (): TideSeries[] => merge(BUILT_IN_SERIES, customSeries());
export const allGauges = (): TideGauge[] => merge(BUILT_IN_GAUGES, customGauges());

export function getGauge(id: string, gauges: TideGauge[] = allGauges()): TideGauge | null {
  return gauges.find((x) => x.id === id) ?? null;
}

export function getSeries(id: string, series: TideSeries[] = allSeries()): TideSeries | null {
  return series.find((x) => x.id === id) ?? null;
}

/** Every distinct series a set of gauges needs, so a refresh fetches each exactly once. */
export function requiredSeries(
  gauges: TideGauge[] = allGauges(),
  series: TideSeries[] = allSeries(),
): TideSeries[] {
  const wanted = new Set(gauges.flatMap((x) => x.inputs));
  return series.filter((s) => wanted.has(s.id));
}

export function gaugesByFamily(gauges: TideGauge[] = allGauges()): { family: TideFamily; gauges: TideGauge[] }[] {
  return TIDE_FAMILIES.map((family) => ({ family, gauges: gauges.filter((x) => x.family === family) })).filter(
    (x) => x.gauges.length > 0,
  );
}

/* ---------------------------------------------------------------------------
 * Saving overrides
 * ------------------------------------------------------------------------- */

interface SaveResult {
  saved: number;
  errors: string[];
}

/**
 * Replace a whole custom set. Errors come back as field paths so the operator
 * can see which entry is wrong; nothing is saved unless every entry validates,
 * because a partial save would leave the desk in a state nobody chose.
 */
function saveSet<T extends { id: string }>(
  key: string,
  schema: z.ZodType<T>,
  input: unknown,
  extra?: (entries: T[]) => string[],
): SaveResult {
  if (!Array.isArray(input)) return { saved: 0, errors: ["expected a list of entries"] };
  const errors: string[] = [];
  const parsed: T[] = [];
  const seen = new Set<string>();
  input.forEach((entry, idx) => {
    const res = schema.safeParse(entry);
    if (!res.success) {
      for (const issue of res.error.issues) {
        errors.push(`[${idx}] ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      return;
    }
    if (seen.has(res.data.id)) errors.push(`[${idx}] id: "${res.data.id}" appears more than once`);
    seen.add(res.data.id);
    parsed.push(res.data);
  });
  if (errors.length === 0 && extra) errors.push(...extra(parsed));
  if (errors.length > 0) return { saved: 0, errors };
  setAppSettingJson(key, parsed);
  return { saved: parsed.length, errors: [] };
}

export function saveCustomSeries(input: unknown): SaveResult {
  return saveSet(SERIES_KEY, SeriesSchema, input);
}

export function saveCustomGauges(input: unknown): SaveResult {
  return saveSet(GAUGES_KEY, GaugeSchema, input, (entries) => {
    const errors: string[] = [];
    const known = new Set(allSeries().map((s) => s.id));
    entries.forEach((gauge, idx) => {
      if (gauge.combine === "single" && gauge.inputs.length !== 1) {
        errors.push(`[${idx}] inputs: a single-input gauge needs exactly one series`);
      }
      if (gauge.combine !== "single" && gauge.inputs.length !== 2) {
        errors.push(`[${idx}] inputs: a ${gauge.combine} needs exactly two series`);
      }
      for (const input of gauge.inputs) {
        if (!known.has(input)) errors.push(`[${idx}] inputs: no series named "${input}"`);
      }
    });
    return errors;
  });
}
