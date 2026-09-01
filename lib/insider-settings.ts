import {
  boolSetting,
  createSettingsRegistry,
  numSetting,
  type SettingSource,
  type SettingSpec,
} from "./settings-registry";

/* ============================================================================
 * The Insider Turnaround Scanner — settings registry & resolver.
 *
 * Same contract as the Stage-0 screen, the Bottleneck desk and the Rotation
 * board: nothing is hard-coded at its use site, every threshold carries the
 * reasoning for its default, and /admin and /methodology render the SAME
 * effective values from this one source. Precedence is DB > env > default.
 *
 * These knobs are different in kind from the other three products' knobs, and
 * the difference is the whole point of this scanner. Most of them are not
 * measurement choices at all — they are statements of how much risk the person
 * reading is willing to carry. How far off its highs a stock may be, how
 * convinced the insider buying has to look, how much cushion a valuation must
 * leave: there is no correct answer to any of those, only somebody's answer.
 *
 * So the defaults below are EXAMPLES, not recommendations, and the scanner is
 * built to make that true rather than merely to say it. Every figure is
 * recomputed on read, so a different risk tolerance re-derives the whole
 * candidate list — including the reasons each rejected name failed — without
 * refetching anything. lib/insider/profiles.ts turns that into three named
 * settings a visitor can switch between on the page.
 * ========================================================================== */

export type InsiderSettingGroupKey = "signal" | "drawdown" | "strength" | "valuation" | "scoring" | "ops";

export const INSIDER_SETTING_GROUPS: { key: InsiderSettingGroupKey; title: string; note: string }[] = [
  {
    key: "signal",
    title: "The insider buying",
    note:
      "What counts as a buy worth paying attention to. Only genuine open-market purchases are counted — an " +
      "option exercise, a grant, a gift and a tax withholding are all excluded, because none of them is " +
      "somebody choosing to spend their own money at the going price.",
  },
  {
    key: "drawdown",
    title: "The price setup",
    note:
      "How far down, how recently, and whether the fall has stopped. These are the risk-tolerance dials in the " +
      "plainest sense: a narrow band asks for a dip, a wide one accepts a collapse, and neither is more correct " +
      "than the other. Every threshold is applied on read, so changing one re-sorts the whole board instantly.",
  },
  {
    key: "strength",
    title: "The financial-strength gate",
    note:
      "The published value-trap filters — a nine-point fundamental-strength score and a five-ratio bankruptcy " +
      "model — kept at the same thresholds the rest of this platform uses, so two products can never disagree " +
      "about whether the same balance sheet is alive.",
  },
  {
    key: "valuation",
    title: "Owner-earnings valuation",
    note:
      "A two-stage discounted cash-flow run on owner earnings rather than reported profit. The discount rate, " +
      "the terminal growth rate and the required cushion are the conservatism dials; nothing here is a forecast, " +
      "and a valuation is only ever as good as the assumptions printed beside it.",
  },
  {
    key: "scoring",
    title: "Composite weighting",
    note:
      "How the four measured dimensions combine into one ranking. Equal weight by default, because there is no " +
      "evidence for any particular blend and pretending otherwise would be false precision.",
  },
  {
    key: "ops",
    title: "Operational",
    note:
      "Fetch budgets and work limits. Every external source is fail-open: a dead feed degrades the scan and is " +
      "disclosed on the page, never crashes it and never overwrites good data with an empty reading.",
  },
];

const num = numSetting<InsiderSettingGroupKey>;
const bool = boolSetting<InsiderSettingGroupKey>;

export const INSIDER_SETTINGS_SPEC: SettingSpec<InsiderSettingGroupKey>[] = [
  /* ---- The insider buying ---- */
  num({
    key: "lookbackDays",
    label: "Filing window searched for buys",
    group: "signal",
    envVar: "MAG8_INSIDER_LOOKBACK_DAYS",
    default: 60,
    min: 14,
    max: 180,
    step: 1,
    unit: "days",
    integer: true,
    blurb:
      "How far back the scan reads insider filings. Insiders must report an open-market trade within two " +
      "business days, so a window this long is about the persistence of a conviction rather than about " +
      "reporting lag: sixty days covers roughly one earnings cycle, which is when a buying window opens.",
    cites: ["Lakonishok & Lee 2001"],
  }),
  num({
    key: "minDollarValue",
    label: "Aggregate open-market buying required",
    group: "signal",
    envVar: "MAG8_INSIDER_MIN_DOLLAR",
    default: 100_000,
    min: 10_000,
    max: 5_000_000,
    step: 10_000,
    scale: 1000,
    unit: "$k",
    integer: true,
    blurb:
      "Total dollars of genuine open-market purchases, summed across every insider, before a company is " +
      "considered at all. A figure meaningful for a chief executive is trivial for a fund and enormous for a " +
      "junior director, so this is a blunt instrument and is applied as one.",
    cites: [],
  }),
  num({
    key: "minClusterInsiders",
    label: "Distinct insiders required",
    group: "signal",
    envVar: "MAG8_INSIDER_MIN_CLUSTER",
    default: 1,
    min: 1,
    max: 5,
    step: 1,
    unit: "insiders",
    integer: true,
    blurb:
      "How many different people must have bought. One is the permissive setting; two or more asks for a " +
      "cluster, which is the configuration the research treats as carrying more information than any single " +
      "purchase — several people acting on the same view at the same time is harder to explain away.",
    cites: ["Lakonishok & Lee 2001"],
  }),
  num({
    key: "discountPlannedPct",
    label: "Discount applied to pre-planned buys",
    group: "signal",
    envVar: "MAG8_INSIDER_PLAN_DISCOUNT",
    default: 50,
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    blurb:
      "A purchase the filer affirms was made under a pre-arranged trading plan was scheduled in advance, so it " +
      "cannot be a reaction to anything known today. Such buys are kept and shown, never dropped, but their " +
      "contribution to the conviction reading is cut by this share — routine trades carry little signal, and " +
      "only opportunistic ones have been found to predict anything.",
    cites: ["Cohen, Malloy & Pomorski 2012"],
  }),
  bool({
    key: "requireOfficerOrDirector",
    label: "Require at least one officer or director among the buyers",
    group: "signal",
    envVar: "MAG8_INSIDER_REQUIRE_INSIDER_ROLE",
    default: false,
    blurb:
      "Off by default, so a large-holder purchase still qualifies. Switching it on restricts the scan to buying " +
      "by people who actually run the business, on the view that an outside holder crossing five percent is " +
      "making a portfolio decision rather than reporting on the company's own prospects.",
    cites: [],
  }),

  /* ---- The price setup ---- */
  num({
    key: "minDrawdownPct",
    label: "Minimum fall from the reference high",
    group: "drawdown",
    envVar: "MAG8_INSIDER_MIN_DRAWDOWN",
    default: 2,
    min: 0,
    max: 50,
    step: 1,
    unit: "%",
    blurb:
      "The floor of the drawdown band. A name that has barely moved is not a turnaround, whatever else is true " +
      "about it, and this is what excludes a stock at its own high where an insider simply likes the business.",
    cites: [],
  }),
  num({
    key: "maxDrawdownPct",
    label: "Maximum fall from the reference high",
    group: "drawdown",
    envVar: "MAG8_INSIDER_MAX_DRAWDOWN",
    default: 60,
    min: 5,
    max: 95,
    step: 1,
    unit: "%",
    blurb:
      "The ceiling of the band, and the single most consequential dial here. A narrow band asks for a dip in a " +
      "healthy name; a wide one accepts a business the market has repriced entirely. Neither setting is more " +
      "correct — they are different bets, and the scan has no opinion about which is right.",
    cites: [],
  }),
  bool({
    key: "measureAgainst52WeekHigh",
    label: "Measure the fall against the 52-week high",
    group: "drawdown",
    envVar: "MAG8_INSIDER_DRAWDOWN_REF",
    default: true,
    blurb:
      "On, the band is measured from the highest close of the last year; off, from the average close of the " +
      "last year. The high is the sharper reference and the one insiders themselves tend to anchor on; the " +
      "average is the steadier one and is much harder for a single spike to distort. Both are always computed " +
      "and both are shown — this only chooses which the band is applied to.",
    cites: ["George & Hwang 2004"],
  }),
  num({
    key: "maxMonthsSinceHigh",
    label: "Age limit on the reference high",
    group: "drawdown",
    envVar: "MAG8_INSIDER_MAX_MONTHS_SINCE_HIGH",
    default: 12,
    min: 1,
    max: 36,
    step: 1,
    unit: "months",
    integer: true,
    blurb:
      "How long ago the high may have been set. This is what makes the decline recent rather than ancient: a " +
      "stock whose best price was three years ago is not recovering from a setback, it is where it lives now.",
    cites: [],
  }),
  num({
    key: "fallenAngelGuardPct",
    label: "Reject below this fall from the three-year high",
    group: "drawdown",
    envVar: "MAG8_INSIDER_FALLEN_ANGEL_GUARD",
    default: 80,
    min: 0,
    max: 99,
    step: 1,
    unit: "%",
    blurb:
      "Set to zero to switch the guard off entirely. It catches the trap the one-year window cannot see: a " +
      "company already down ninety percent over three years looks only moderately fallen against its own " +
      "depressed recent range, because that range already sits on the floor.",
    cites: [],
  }),
  bool({
    key: "requireStabilizing",
    label: "Require the decline to have stopped accelerating",
    group: "drawdown",
    envVar: "MAG8_INSIDER_REQUIRE_STABILIZING",
    default: true,
    blurb:
      "A light check that the fall is decelerating, or that the price is at least above its own recent low. " +
      "Switching it off deliberately admits names still falling — some people want exactly that, and the scan " +
      "should let them have it rather than quietly refusing.",
    cites: [],
  }),

  /* ---- The financial-strength gate ---- */
  num({
    key: "fScoreFloor",
    label: "Fundamental-strength score below which a name fails",
    group: "strength",
    envVar: "MAG8_INSIDER_F_FLOOR",
    default: 4,
    min: 0,
    max: 9,
    step: 1,
    unit: "points",
    integer: true,
    blurb:
      "The nine-point score runs from zero to nine, and the published reading treats three or below as a likely " +
      "value trap. The default therefore fails anything under four, which is the same veto the rest of this " +
      "platform applies — deliberately not the higher bar of six, which is what an attractive name scores " +
      "rather than what a survivable one does.",
    cites: ["Piotroski 2000"],
  }),
  bool({
    key: "allowGreyZone",
    label: "Accept a balance sheet in the grey zone",
    group: "strength",
    envVar: "MAG8_INSIDER_ALLOW_GREY",
    default: true,
    blurb:
      "The bankruptcy model splits companies into safe, grey and distress zones. On, only the distress zone " +
      "fails; off, a name must be clearly safe. The grey zone is where a great many perfectly solvent " +
      "beaten-down companies sit, so switching this off is a real tightening, not a formality.",
    cites: ["Altman 1968"],
  }),
  bool({
    key: "strengthGateRejects",
    label: "Let the strength gate reject rather than flag",
    group: "strength",
    envVar: "MAG8_INSIDER_STRENGTH_GATE",
    default: true,
    blurb:
      "On, a company failing the gate is removed from the ranking and shown with the reason. Off, it is ranked " +
      "anyway and carries a prominent flag — which is how a heavily reinvesting growth business, whose scores " +
      "these models were never designed for, can still be looked at with its eyes open.",
    cites: [],
  }),

  /* ---- Owner-earnings valuation ---- */
  num({
    key: "discountRatePct",
    label: "Discount rate",
    group: "valuation",
    envVar: "MAG8_INSIDER_DISCOUNT_RATE",
    default: 9,
    min: 4,
    max: 20,
    step: 0.5,
    unit: "%",
    blurb:
      "The rate future owner earnings are discounted at. This is a statement about how much return is demanded " +
      "for the risk, not a market observation, and it moves the answer more than almost anything else here — " +
      "which is why it is a dial rather than a constant.",
    cites: [],
  }),
  num({
    key: "terminalGrowthPct",
    label: "Terminal growth rate",
    group: "valuation",
    envVar: "MAG8_INSIDER_TERMINAL_GROWTH",
    default: 2.5,
    min: 0,
    max: 5,
    step: 0.1,
    unit: "%",
    blurb:
      "The rate the business is assumed to grow at forever after the projection ends. It must stay well below " +
      "the discount rate or the arithmetic diverges, and a rate above long-run economic growth implies a company " +
      "that eventually becomes the whole economy.",
    cites: [],
  }),
  num({
    key: "projectionYears",
    label: "Years projected before the terminal value",
    group: "valuation",
    envVar: "MAG8_INSIDER_PROJECTION_YEARS",
    default: 10,
    min: 5,
    max: 15,
    step: 1,
    unit: "years",
    integer: true,
    blurb:
      "How long the explicit projection runs. Longer is not more accurate — it simply moves more of the answer " +
      "into years nobody can see, and shifts weight away from the terminal value that would otherwise carry it.",
    cites: [],
  }),
  num({
    key: "growthHaircutPct",
    label: "Share of past growth carried forward",
    group: "valuation",
    envVar: "MAG8_INSIDER_GROWTH_HAIRCUT",
    default: 70,
    min: 0,
    max: 100,
    step: 5,
    unit: "%",
    blurb:
      "Historical growth is multiplied by this before being projected. Growth rates decay towards the average " +
      "far faster than extrapolation assumes, so carrying the full past rate forward is the most common way a " +
      "cash-flow valuation talks itself into a number.",
    cites: ["Chan, Karceski & Lakonishok 2003"],
  }),
  num({
    key: "maxGrowthRatePct",
    label: "Cap on the projected growth rate",
    group: "valuation",
    envVar: "MAG8_INSIDER_MAX_GROWTH",
    default: 15,
    min: 0,
    max: 40,
    step: 1,
    unit: "%",
    blurb:
      "A hard ceiling applied after the haircut. Without it, one unusually good year in a short history produces " +
      "a compound rate no business sustains, and the valuation inherits it for a decade.",
    cites: [],
  }),
  num({
    key: "minMarginOfSafetyPct",
    label: "Cushion required below the estimated value",
    group: "valuation",
    envVar: "MAG8_INSIDER_MIN_MARGIN",
    default: 25,
    min: 0,
    max: 70,
    step: 1,
    unit: "%",
    blurb:
      "How far below the estimated intrinsic value the price must sit to count as meeting the bar. The cushion " +
      "exists because the estimate is wrong — the only question is by how much and in which direction — so this " +
      "is a measure of humility about the arithmetic rather than of expected return.",
    cites: [],
  }),

  /* ---- Composite weighting ---- */
  num({
    key: "weightInsider",
    label: "Weight on the insider-conviction reading",
    group: "scoring",
    envVar: "MAG8_INSIDER_W_INSIDER",
    default: 1,
    min: 0,
    max: 5,
    step: 0.1,
    blurb:
      "Relative weight of how convincing the buying looks. All four components default to equal weight, which " +
      "is a plain average; there is no evidence supporting any particular blend, and the live weighting is " +
      "published alongside the scores it produced.",
    cites: [],
  }),
  num({
    key: "weightSetup",
    label: "Weight on the turnaround setup",
    group: "scoring",
    envVar: "MAG8_INSIDER_W_SETUP",
    default: 1,
    min: 0,
    max: 5,
    step: 0.1,
    blurb:
      "Relative weight of the price setup — how well the drawdown sits inside the chosen band and whether the " +
      "fall has steadied. Raising it favours the shape of the chart over the strength of the business.",
    cites: [],
  }),
  num({
    key: "weightStrength",
    label: "Weight on financial strength",
    group: "scoring",
    envVar: "MAG8_INSIDER_W_STRENGTH",
    default: 1,
    min: 0,
    max: 5,
    step: 0.1,
    blurb:
      "Relative weight of the fundamental-strength and solvency readings. Raising it pushes the ranking towards " +
      "sturdier balance sheets, which in a list of beaten-down companies is a meaningful tilt.",
    cites: [],
  }),
  num({
    key: "weightValue",
    label: "Weight on the margin of safety",
    group: "scoring",
    envVar: "MAG8_INSIDER_W_VALUE",
    default: 1,
    min: 0,
    max: 5,
    step: 0.1,
    blurb:
      "Relative weight of the gap between price and estimated value. This is the component resting on the most " +
      "assumptions, so weighting it heavily means trusting the discounted cash-flow arithmetic more than the " +
      "three things that were measured rather than modelled.",
    cites: [],
  }),

  /* ---- Operational ---- */
  num({
    key: "maxCandidates",
    label: "Companies taken through the full workup per refresh",
    group: "ops",
    envVar: "MAG8_INSIDER_MAX_CANDIDATES",
    default: 60,
    min: 5,
    max: 300,
    step: 5,
    unit: "companies",
    integer: true,
    blurb:
      "After the buying signal is measured, this many companies — the most convincing first — have their price " +
      "history and financial statements fetched. Everything below the cut is still listed with its buying " +
      "figures, and is marked as not yet worked up rather than as failing anything.",
    cites: [],
  }),
  num({
    key: "priceHistoryYears",
    label: "Daily price history fetched per company",
    group: "ops",
    envVar: "MAG8_INSIDER_PRICE_YEARS",
    default: 5,
    min: 3,
    max: 10,
    step: 1,
    unit: "years",
    integer: true,
    blurb:
      "Three years is the floor because the fallen-angel guard is defined against a three-year high; five is the " +
      "default so that window is fully populated from the first day rather than filling in over two years.",
    cites: [],
  }),
  num({
    key: "fetchTimeoutMs",
    label: "Per-request timeout",
    group: "ops",
    envVar: "MAG8_INSIDER_FETCH_TIMEOUT_MS",
    default: 20_000,
    min: 5_000,
    max: 120_000,
    step: 5_000,
    scale: 1000,
    unit: "s",
    integer: true,
    blurb:
      "Budget for one filing, price series or set of financial statements. A timeout leaves whatever was already " +
      "stored in place and is reported against that company, rather than emptying it or failing the whole scan.",
    cites: [],
  }),
];

export interface InsiderSettings {
  lookbackDays: number;
  minDollarValue: number;
  minClusterInsiders: number;
  discountPlannedPct: number;
  requireOfficerOrDirector: boolean;
  minDrawdownPct: number;
  maxDrawdownPct: number;
  measureAgainst52WeekHigh: boolean;
  maxMonthsSinceHigh: number;
  fallenAngelGuardPct: number;
  requireStabilizing: boolean;
  fScoreFloor: number;
  allowGreyZone: boolean;
  strengthGateRejects: boolean;
  discountRatePct: number;
  terminalGrowthPct: number;
  projectionYears: number;
  growthHaircutPct: number;
  maxGrowthRatePct: number;
  minMarginOfSafetyPct: number;
  weightInsider: number;
  weightSetup: number;
  weightStrength: number;
  weightValue: number;
  maxCandidates: number;
  priceHistoryYears: number;
  fetchTimeoutMs: number;
}

export type InsiderSettingKey = keyof InsiderSettings;

const registry = createSettingsRegistry<InsiderSettingGroupKey, InsiderSettings>({
  spec: INSIDER_SETTINGS_SPEC,
  storageKey: "insider_settings",
});

export interface EffectiveInsiderSettings {
  values: InsiderSettings;
  sources: Record<InsiderSettingKey, SettingSource>;
}

export const cleanInsiderOverrides = registry.clean;
export const effectiveInsiderSettings = registry.effective;
export const insiderSettings = registry.values;
export const baselineInsiderSettings = registry.baseline;
export const saveInsiderOverrides = registry.save;
export const saveInsiderDiff = registry.saveDiff;

/**
 * Env-only kill switch, checked per call and supreme over every other knob —
 * the same shape as MAG8_UNIVERSE=0 and MAG8_ROTATION=0. With the scanner off
 * nothing fetches, and the pages report themselves unavailable rather than
 * rendering an empty list that would read as "no insider is buying anything".
 */
export function insiderEnabled(): boolean {
  return process.env.MAG8_INSIDER !== "0";
}
