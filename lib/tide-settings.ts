import {
  boolSetting,
  createSettingsRegistry,
  numSetting,
  type SettingSource,
  type SettingSpec,
} from "./settings-registry";

/* ============================================================================
 * The Tide — settings registry & resolver.
 *
 * Same contract as the Stage-0 screen, the Bottleneck desk and the Rotation
 * Board: nothing the desk does is hard-coded, every threshold carries its
 * reasoning, and /admin and /methodology render the SAME effective values from
 * this one source. Precedence is DB > env > default.
 *
 * The desk stores raw observations and computes every percentile, stress
 * score, family aggregate, composite and exposure band on READ. So these knobs
 * are not merely configuration — they re-derive the whole desk, including its
 * history and its base rates, on the next page load, without refetching
 * anything.
 *
 * Which readings exist is NOT here: that is a catalogue of public series and
 * their meanings, and it lives in lib/tide/catalog.ts because it is a set of
 * facts about published data rather than an operator preference.
 *
 * THE WEIGHTS ARE THE ARGUMENT. Everything else on this desk is arithmetic
 * over public numbers, and two people running it would get the same readings.
 * The family weights are where a judgement is made about which readings matter
 * more, so each one states its reasoning and cites the work behind it, and the
 * whole set is published on /methodology at its live effective value. An
 * operator who disagrees can retune them and see the desk change; what they
 * cannot do is find a weight that is not written down.
 * ========================================================================== */

export type TideSettingGroupKey =
  | "data"
  | "normalise"
  | "slowWeights"
  | "fastWeights"
  | "exposure"
  | "baserates"
  | "breadth"
  | "ops";

export const TIDE_SETTING_GROUPS: { key: TideSettingGroupKey; title: string; note: string }[] = [
  {
    key: "data",
    title: "History and freshness",
    note:
      "How much history each series is pulled and kept, and how much of it a reading needs before the desk " +
      "will judge it. Every source here is free and keyless; none is an official market-data feed, so the " +
      "desk is built to degrade visibly rather than to pretend.",
  },
  {
    key: "normalise",
    title: "Turning a reading into a score",
    note:
      "Every gauge is judged against its OWN history rather than against a fixed threshold, because a fixed " +
      "threshold is where an opinion hides: saying that a price/earnings ratio above twenty is expensive is " +
      "an argument, whereas saying it is higher than it has been in ninety per cent of the past twenty years " +
      "is a measurement. These dials set the windows that measurement uses.",
  },
  {
    key: "slowWeights",
    title: "Weights — valuation and positioning",
    note:
      "How much each family counts toward the slow composite, which answers what the next decade is likely " +
      "to pay. Positioning is weighted above valuation on the evidence that how much money is already " +
      "committed has explained long-horizon returns at least as well as price ratios have.",
  },
  {
    key: "fastWeights",
    title: "Weights — cycle, credit and trend",
    note:
      "How much each family counts toward the fast composite, which answers how much drawdown risk the next " +
      "six to twelve months carry. The ordering is deliberate and defended in each dial below; sentiment is " +
      "weighted lightest because it is the family most likely to be loud and wrong.",
  },
  {
    key: "exposure",
    title: "Exposure band",
    note:
      "The published arithmetic that turns the two composites into a suggested share of equities against " +
      "cash. It is stated as a band rather than a figure, because a number carried to the percentage point " +
      "would claim a precision none of the inputs have. The fast composite drives it far harder than the " +
      "slow one, for the reason given on the slow dial.",
  },
  {
    key: "baserates",
    title: "Conditional history",
    note:
      "What the market did next, the last times the composite sat where it sits now. The sample is counted " +
      "in EPISODES, never in days: a one-year forward reading taken on consecutive sessions shares all but " +
      "one of those days with the reading beside it, so a stretch of qualifying days is one observation and " +
      "not two hundred. Below the minimum the desk says so and reports nothing.",
  },
  {
    key: "breadth",
    title: "Counted breadth",
    note:
      "Breadth is counted one company at a time from this application's own screened universe, which is the " +
      "one reading here that no public feed sells. These dials set how many companies are counted and over " +
      "what window.",
  },
  {
    key: "ops",
    title: "Operational",
    note:
      "Fetch budgets and request pacing. Every external source is fail-open: a dead feed degrades one " +
      "reading and is disclosed on the page, never crashes the desk and never overwrites a good observation " +
      "with an empty one.",
  },
];

/**
 * The most history the desk will ever fetch or keep, in years.
 *
 * Fifty rather than a round hundred because that is the actual ceiling of the
 * price source: asked for eighty or a hundred years of daily bars it returns
 * ZERO rows — not an error and not a shorter series — so a limit above what the
 * source will serve would produce an empty answer that reads as "no history".
 *
 * Exported for the same reason the Rotation Board exports its own: reading
 * observations back must never be capped BELOW what could have been stored, or
 * the oldest years would be silently dropped while every page carried on
 * describing the full span.
 */
export const MAX_TIDE_HISTORY_YEARS = 50;

const num = numSetting<TideSettingGroupKey>;
const bool = boolSetting<TideSettingGroupKey>;

export const TIDE_SETTINGS_SPEC: SettingSpec<TideSettingGroupKey>[] = [
  /* ---------------------------------------------------------------- data -- */
  num({
    key: "historyYears",
    label: "History fetched per series",
    group: "data",
    envVar: "MAG8_TIDE_HISTORY_YEARS",
    default: 30,
    min: 10,
    max: MAX_TIDE_HISTORY_YEARS,
    step: 5,
    unit: "years",
    integer: true,
    blurb:
      "How far back each series is pulled and kept. Thirty years is the default because the conditional " +
      "history below is counted in visits to a condition rather than in days, and a shorter span simply does " +
      "not contain enough separate visits to describe. It is worth being blunt about what more history does " +
      "and does not buy: fifty years of daily observations still contains only about seven recessions, so " +
      "the effective sample for anything cycle-related is single digits however many rows are stored.",
    cites: ["Sullivan, Timmermann & White 1999"],
  }),
  num({
    key: "minObservations",
    label: "Minimum observations before a gauge is judged",
    group: "data",
    envVar: "MAG8_TIDE_MIN_OBS",
    default: 40,
    min: 12,
    max: 500,
    step: 4,
    unit: "observations",
    integer: true,
    blurb:
      "A reading needs this many past observations of its own before the desk will place it in its history. " +
      "Below it the gauge reports NOT MEASURED and is excluded from its family's weight entirely, rather " +
      "than being counted as neutral — a gauge nobody can judge is not the same as a gauge sitting in the " +
      "middle of its range, and scoring it as fifty would quietly pull every composite toward the middle.",
    cites: [],
  }),
  num({
    key: "staleGracePct",
    label: "Tolerance on a series' own staleness budget",
    group: "data",
    envVar: "MAG8_TIDE_STALE_GRACE_PCT",
    default: 100,
    min: 50,
    max: 400,
    step: 25,
    unit: "%",
    integer: true,
    blurb:
      "Each series in the catalogue declares how long it may go without a new observation before it is " +
      "reported stale; this scales all of those at once. It exists because a series that is merely reachable " +
      "is not a series that is alive: the obvious free leading-economic-index series answers a request " +
      "perfectly well and has published nothing since February 2020, and without a freshness gate the desk " +
      "would have reported a six-year-old number as today's reading indefinitely.",
    cites: [],
  }),

  /* ----------------------------------------------------------- normalise -- */
  num({
    key: "percentileWindowYears",
    label: "Window a reading is judged against",
    group: "normalise",
    envVar: "MAG8_TIDE_PCT_WINDOW_YEARS",
    default: 20,
    min: 5,
    max: MAX_TIDE_HISTORY_YEARS,
    step: 5,
    unit: "years",
    integer: true,
    blurb:
      "How much of a gauge's own past it is ranked against. Twenty years is long enough to contain more than " +
      "one cycle and short enough that structural drift does not dominate — several of the valuation " +
      "readings here have trended for decades rather than oscillating, so ranking them against a century " +
      "would say little more than that the world has changed.",
    cites: [],
  }),
  num({
    key: "zBlendPct",
    label: "Share of a score taken from the standard score",
    group: "normalise",
    envVar: "MAG8_TIDE_Z_BLEND_PCT",
    default: 0,
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    integer: true,
    blurb:
      "The stress score is a percentile of the gauge's own history by default, which assumes nothing about " +
      "the shape of its distribution. A standard score is computed and displayed alongside, and this dial " +
      "blends it in. It ships at zero deliberately: several of these series are strongly skewed, and a " +
      "standard score treats a distribution with a long tail as though it were symmetrical.",
    cites: [],
  }),
  num({
    key: "minGaugesPerHorizon",
    label: "Gauges required before a composite is published",
    group: "normalise",
    envVar: "MAG8_TIDE_MIN_GAUGES",
    default: 5,
    min: 2,
    max: 20,
    step: 1,
    unit: "gauges",
    integer: true,
    blurb:
      "A composite built from too few surviving readings is reported as partial rather than presented as a " +
      "reading of the whole horizon. The whole case for aggregating at all is that a combination is more " +
      "robust than its members; a combination of three is not that.",
    cites: ["Bates & Granger 1969", "Rapach, Strauss & Zhou 2010"],
  }),

  /* --------------------------------------------------------- slowWeights -- */
  num({
    key: "weightValuation",
    label: "Valuation",
    group: "slowWeights",
    envVar: "MAG8_TIDE_W_VALUATION",
    default: 3,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "Price ratios against the economy, against replacement cost and against smoothed earnings. Weighted " +
      "substantially on the long horizon, where the evidence for them is real, and deliberately given almost " +
      "no influence over the exposure band, where it is not.",
    cites: ["Campbell & Shiller 1998", "Goyal & Welch 2008"],
  }),
  num({
    key: "weightPositioning",
    label: "Positioning",
    group: "slowWeights",
    envVar: "MAG8_TIDE_W_POSITIONING",
    default: 4,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "How much of the public's money is already committed to equities. Weighted above valuation because " +
      "the share of household financial assets held in shares has explained subsequent long-horizon returns " +
      "at least as well as price ratios have, and because it is harder to argue away: a price ratio can be " +
      "defended by an accounting change, but the money is either already in or it is not.",
    cites: ["Campbell & Shiller 1998"],
  }),
  num({
    key: "weightSlowCredit",
    label: "Credit pricing",
    group: "slowWeights",
    envVar: "MAG8_TIDE_W_SLOW_CREDIT",
    default: 2,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "What lenders charge for corporate risk, read as a level. A thin spread means risk is being priced " +
      "generously by the people whose job is to price it. Weighted below the two above because a credit " +
      "spread is a price of debt rather than of shares, and the two have stayed apart for years at a time.",
    cites: ["Gilchrist & Zakrajšek 2012"],
  }),
  num({
    key: "weightSlowSentiment",
    label: "Standing volatility",
    group: "slowWeights",
    envVar: "MAG8_TIDE_W_SLOW_SENTIMENT",
    default: 1,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "The standing price of protection, read as a level rather than as a spike. Weighted lightest on this " +
      "horizon because sustained calm can persist for years while a market rises, so it dates nothing.",
    cites: [],
  }),

  /* --------------------------------------------------------- fastWeights -- */
  num({
    key: "weightCycle",
    label: "Economic cycle and the yield curve",
    group: "fastWeights",
    envVar: "MAG8_TIDE_W_CYCLE",
    default: 4,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "The heaviest family on this horizon, on the strength of the yield curve specifically: tested against " +
      "the alternatives on out-of-sample data, the term spread was the single best financial predictor of US " +
      "recessions at horizons beyond a quarter. The rest of the family — activity, production, permits, " +
      "freight — is included because a curve on its own has been wrong before.",
    cites: ["Estrella & Mishkin 1998"],
  }),
  num({
    key: "weightLabour",
    label: "Labour market",
    group: "fastWeights",
    envVar: "MAG8_TIDE_W_LABOUR",
    default: 3.5,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "Employment turning is the reading that has most reliably arrived alongside a recession rather than " +
      "being argued about during one. Weighted just below the curve rather than above it because the rule " +
      "used here was built to identify a downturn that has already started, not to see one coming.",
    cites: ["Sahm 2019"],
  }),
  num({
    key: "weightTrend",
    label: "Price trend",
    group: "fastWeights",
    envVar: "MAG8_TIDE_W_TREND",
    default: 3,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "Whether the market is above its own long average. Weighted this highly on evidence rather than on " +
      "chart-reading: a published rule holding equities only while the index sits above its ten-month " +
      "average produced broadly equity-like returns with materially smaller declines, and technical readings " +
      "have been shown to carry information that the economic series do not already contain.",
    cites: ["Faber 2007", "Neely, Rapach, Tu & Zhou 2014"],
  }),
  num({
    key: "weightCredit",
    label: "Credit and lending",
    group: "fastWeights",
    envVar: "MAG8_TIDE_W_CREDIT",
    default: 3,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "What lenders charge for risk and whether they have started refusing it, read as a change rather than " +
      "a level. Credit repricing has led equity declines often enough to be worth watching separately from " +
      "the equity market itself.",
    cites: ["Gilchrist & Zakrajšek 2012"],
  }),
  num({
    key: "weightBreadth",
    label: "Counted breadth",
    group: "fastWeights",
    envVar: "MAG8_TIDE_W_BREADTH",
    default: 2.5,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "How many companies are actually participating, counted one at a time. Weighted meaningfully because " +
      "an index can rise on a handful of very large names while most of the market has already turned, and " +
      "no other reading here would notice. Weighted below the cycle and labour families because it is " +
      "measured over this platform's own screened universe rather than an official index.",
    cites: ["Plyakha, Uppal & Vilkov 2012"],
  }),
  num({
    key: "weightLiquidity",
    label: "Financial conditions",
    group: "fastWeights",
    envVar: "MAG8_TIDE_W_LIQUIDITY",
    default: 2,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "How easily money can be raised, priced by funding markets. Weighted moderately and knowingly " +
      "discounted: the published conditions indices are themselves built largely from the credit and " +
      "volatility prices scored elsewhere on this desk, so counting them at full weight would count the " +
      "same evidence twice.",
    cites: [],
  }),
  num({
    key: "weightSentiment",
    label: "Sentiment and volatility",
    group: "fastWeights",
    envVar: "MAG8_TIDE_W_SENTIMENT",
    default: 1,
    min: 0,
    max: 10,
    step: 0.5,
    blurb:
      "Survey answers and the price of near-term protection. Weighted lightest of all on purpose. Sentiment " +
      "is a lead rather than evidence by this platform's own standard, its relationship to what households " +
      "actually do has broken down in recent years, and the volatility term structure inverts as a fall " +
      "happens rather than before it.",
    cites: ["Barber & Odean 2008"],
  }),

  /* ------------------------------------------------------------ exposure -- */
  num({
    key: "exposureBase",
    label: "Starting equity share",
    group: "exposure",
    envVar: "MAG8_TIDE_EXP_BASE",
    default: 60,
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    integer: true,
    blurb:
      "What the band reads when both composites sit exactly at the middle of their own histories. This is a " +
      "starting point rather than a recommendation, and it is the single most consequential number on the " +
      "desk: everything else only moves the reading away from it.",
    cites: [],
  }),
  num({
    key: "exposureFastPenalty",
    label: "How far the fast composite can move the band",
    group: "exposure",
    envVar: "MAG8_TIDE_EXP_FAST_PENALTY",
    default: 35,
    min: 0,
    max: 100,
    step: 5,
    unit: "points",
    integer: true,
    blurb:
      "A fast composite at its worst possible reading subtracts this much from the equity share, and at its " +
      "best adds it. It dominates the band because the cycle, credit and trend readings are the ones with " +
      "any historical claim to saying something about the coming year.",
    cites: ["Estrella & Mishkin 1998", "Faber 2007"],
  }),
  num({
    key: "exposureSlowPenalty",
    label: "How far the slow composite can move the band",
    group: "exposure",
    envVar: "MAG8_TIDE_EXP_SLOW_PENALTY",
    default: 10,
    min: 0,
    max: 100,
    step: 5,
    unit: "points",
    integer: true,
    blurb:
      "Deliberately small, and the most important defensible choice here. Valuation says a great deal about " +
      "what a decade pays and very little about what a year does; a comprehensive out-of-sample test of the " +
      "standard predictors found that most of them, valuation ratios included, would not have helped an " +
      "investor time the market at all. Letting an expensive market drive the band hard would have meant " +
      "sitting in cash for most of the past thirty years. The slow composite is reported as an expected " +
      "return, not used as a timing lever.",
    cites: ["Goyal & Welch 2008", "Goyal, Welch & Zafirov 2021"],
  }),
  num({
    key: "exposureFloor",
    label: "Lowest equity share the band will show",
    group: "exposure",
    envVar: "MAG8_TIDE_EXP_FLOOR",
    default: 20,
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    integer: true,
    blurb:
      "The band never reaches zero. Every reading on this desk is a probability rather than a forecast, the " +
      "worst readings have been followed by good years often enough to matter, and a measure that can tell " +
      "somebody to leave the market entirely on arithmetic this uncertain should not exist.",
    cites: [],
  }),
  num({
    key: "exposureCeiling",
    label: "Highest equity share the band will show",
    group: "exposure",
    envVar: "MAG8_TIDE_EXP_CEILING",
    default: 90,
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    integer: true,
    blurb:
      "The band never reaches a hundred either, for the mirror of the reason above: the best readings have " +
      "been followed by bad years, and a cash holding is not only a market call.",
    cites: [],
  }),
  num({
    key: "exposureBandWidth",
    label: "Width of the published band",
    group: "exposure",
    envVar: "MAG8_TIDE_EXP_BAND_WIDTH",
    default: 10,
    min: 0,
    max: 40,
    step: 2,
    unit: "points",
    integer: true,
    blurb:
      "The result is published as a range this wide rather than as a single percentage. A figure carried to " +
      "the point would claim a precision that revised macroeconomic data, a single-digit sample of " +
      "recessions and a set of hand-chosen weights cannot support.",
    cites: [],
  }),

  /* ----------------------------------------------------------- baserates -- */
  num({
    key: "baseRateHorizonMonths",
    label: "How far forward the conditional history looks",
    group: "baserates",
    envVar: "MAG8_TIDE_BR_HORIZON_MONTHS",
    default: 12,
    min: 1,
    max: 60,
    step: 1,
    unit: "months",
    integer: true,
    blurb:
      "The forward window measured after each past visit to today's condition. Twelve months matches the " +
      "horizon the fast composite claims to speak to. Counted in months rather than sessions because the " +
      "composite itself is monthly: most of what feeds it is published monthly or quarterly, and a daily " +
      "composite drawn from quarterly national accounts would be inventing precision between publications. " +
      "Note what a longer window costs — forward windows taken on overlapping stretches are near-perfectly " +
      "correlated with one another, which makes a long-horizon result look far better supported than it is.",
    cites: ["Boudoukh, Richardson & Whitelaw 2008"],
  }),
  num({
    key: "baseRateMinEpisodes",
    label: "Visits required before a conditional figure is published",
    group: "baserates",
    envVar: "MAG8_TIDE_BR_MIN_EPISODES",
    default: 8,
    min: 3,
    max: 50,
    step: 1,
    unit: "episodes",
    integer: true,
    blurb:
      "Below this the desk reports NOT MEASURED and publishes nothing rather than a mean of two visits " +
      "dressed as a base rate. With dozens of readings each searched against its own history, a rule like " +
      "this is the only thing standing between a desk and finding whatever pattern it went looking for.",
    cites: ["Sullivan, Timmermann & White 1999"],
  }),
  num({
    key: "baseRateEpisodeGapMonths",
    label: "Gap that separates one visit from the next",
    group: "baserates",
    envVar: "MAG8_TIDE_BR_EPISODE_GAP_MONTHS",
    default: 3,
    min: 1,
    max: 24,
    step: 1,
    unit: "months",
    integer: true,
    blurb:
      "Two qualifying sessions closer together than this belong to the same visit. Without the tolerance a " +
      "condition that flickers across one stretch of market is counted as many separate visits, which " +
      "inflates the apparent sample at exactly the moment the real one is shrinking.",
    cites: [],
  }),

  /* ------------------------------------------------------------- breadth -- */
  num({
    key: "breadthUniverseSize",
    label: "Companies counted for breadth",
    group: "breadth",
    envVar: "MAG8_TIDE_BREADTH_SIZE",
    default: 500,
    min: 50,
    max: 1500,
    step: 50,
    unit: "companies",
    integer: true,
    blurb:
      "How many of the largest screened companies are counted. Five hundred is a compromise between " +
      "resembling the large-company market and the time a refresh takes, since each company is one request " +
      "to a free price source. This is a count over this platform's own screened universe, not over any " +
      "published index, and the desk says so wherever the reading appears.",
    cites: [],
  }),
  num({
    key: "breadthAverageDays",
    label: "Average each company is measured against",
    group: "breadth",
    envVar: "MAG8_TIDE_BREADTH_AVG_DAYS",
    default: 200,
    min: 20,
    max: 400,
    step: 10,
    unit: "sessions",
    integer: true,
    blurb:
      "The trailing simple average a company must be above to count as participating. Two hundred sessions " +
      "is the convention in every published breadth statistic, which is the only reason to prefer it — " +
      "there is nothing special about the number itself.",
    cites: ["Levy 1967"],
  }),
  num({
    key: "breadthHistoryYears",
    label: "History fetched per breadth company",
    group: "breadth",
    envVar: "MAG8_TIDE_BREADTH_YEARS",
    default: 5,
    min: 2,
    max: 20,
    step: 1,
    unit: "years",
    integer: true,
    blurb:
      "How much daily history is kept for each company breadth is counted over. Far shorter than the macro " +
      "series, and deliberately so: this is hundreds of separate requests to a free source, and thirty years " +
      "of it would be millions of rows for one reading. The consequence is stated wherever breadth appears " +
      "— the two breadth gauges are ranked against a much shorter history than everything else here, so an " +
      "extreme breadth reading is extreme against five years rather than against thirty.",
    cites: [],
  }),
  num({
    key: "breadthMinCompanies",
    label: "Companies required before breadth is reported",
    group: "breadth",
    envVar: "MAG8_TIDE_BREADTH_MIN",
    default: 100,
    min: 20,
    max: 1000,
    step: 10,
    unit: "companies",
    integer: true,
    blurb:
      "If fewer than this many companies returned usable price history, breadth reports NOT MEASURED rather " +
      "than a percentage of whatever happened to arrive. A share computed over a handful of names that a " +
      "free source felt like answering for is not a measure of the market.",
    cites: [],
  }),
  bool({
    key: "breadthEnabled",
    label: "Count breadth during a refresh",
    group: "breadth",
    envVar: "MAG8_TIDE_BREADTH",
    default: true,
    blurb:
      "Breadth is the slowest part of a refresh by a wide margin, because it is hundreds of individual price " +
      "requests where every other reading is one. Turning it off leaves the rest of the desk working and " +
      "reports the two breadth gauges as NOT MEASURED, with the reason given.",
    cites: [],
  }),

  /* ------------------------------------------------------------------ ops -- */
  num({
    key: "fetchTimeoutMs",
    label: "Request timeout",
    group: "ops",
    envVar: "MAG8_TIDE_FETCH_TIMEOUT_MS",
    default: 25_000,
    min: 5_000,
    max: 120_000,
    step: 5_000,
    scale: 1000,
    unit: "s",
    integer: true,
    blurb:
      "Per-request budget for one series. A source that does not answer inside it degrades one reading and " +
      "is disclosed; it never fails the refresh and never overwrites what is already stored.",
    cites: [],
  }),
  num({
    key: "fetchGapMs",
    label: "Pause between requests",
    group: "ops",
    envVar: "MAG8_TIDE_FETCH_GAP_MS",
    default: 150,
    min: 0,
    max: 5_000,
    step: 50,
    unit: "ms",
    integer: true,
    blurb:
      "Minimum spacing between outbound requests. These are free public services with undocumented limits " +
      "and no contract; pacing is the rent.",
    cites: [],
  }),
];

export interface TideSettings {
  historyYears: number;
  minObservations: number;
  staleGracePct: number;
  percentileWindowYears: number;
  zBlendPct: number;
  minGaugesPerHorizon: number;
  weightValuation: number;
  weightPositioning: number;
  weightSlowCredit: number;
  weightSlowSentiment: number;
  weightCycle: number;
  weightLabour: number;
  weightTrend: number;
  weightCredit: number;
  weightBreadth: number;
  weightLiquidity: number;
  weightSentiment: number;
  exposureBase: number;
  exposureFastPenalty: number;
  exposureSlowPenalty: number;
  exposureFloor: number;
  exposureCeiling: number;
  exposureBandWidth: number;
  baseRateHorizonMonths: number;
  baseRateMinEpisodes: number;
  baseRateEpisodeGapMonths: number;
  breadthUniverseSize: number;
  breadthHistoryYears: number;
  breadthAverageDays: number;
  breadthMinCompanies: number;
  breadthEnabled: boolean;
  fetchTimeoutMs: number;
  fetchGapMs: number;
}

export type TideSettingKey = keyof TideSettings;

const registry = createSettingsRegistry<TideSettingGroupKey, TideSettings>({
  spec: TIDE_SETTINGS_SPEC,
  storageKey: "tide_settings",
});

export interface EffectiveTideSettings {
  values: TideSettings;
  sources: Record<TideSettingKey, SettingSource>;
}

export const cleanTideOverrides = registry.clean;
export const effectiveTideSettings = registry.effective;
export const tideSettings = registry.values;
export const baselineTideSettings = registry.baseline;
export const saveTideOverrides = registry.save;
export const saveTideDiff = registry.saveDiff;

/**
 * Env-only kill switch, checked per call and supreme over every other knob —
 * the same shape as MAG8_ROTATION=0 and MAG8_CROSSDESK=0. With the desk off the
 * page reports itself unavailable rather than rendering an empty band, which
 * would read as a recommendation to hold no equities at all.
 */
export function tideEnabled(): boolean {
  return process.env.MAG8_TIDE !== "0";
}
