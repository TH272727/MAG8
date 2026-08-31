import { z } from "zod";
import { getAppSettingJson, setAppSettingJson } from "../db";

/* ============================================================================
 * The indicator catalog — the ONLY market-specific input to the board.
 *
 * Every indicator is a pair of tickers and the plain-language meaning of the
 * ratio moving each way. The engine is a pure function over two price series,
 * so adding an indicator is one entry here and no new calculation code: the
 * charts, the score, the tiers, the state history and the written note all
 * generalise automatically.
 *
 * Built-ins live in this file so they are reviewable in the diff. An operator
 * may add or override entries through one app_settings key, which is how a new
 * ratio reaches the board without a deploy.
 *
 * Two things deliberately do NOT live here: the operator's thresholds (they are
 * in lib/rotation-settings.ts, because they are preferences rather than facts
 * about a market) and any computed figure (nothing in this file is a number the
 * board reports).
 * ========================================================================== */

export const ROTATION_CATEGORIES = [
  "breadth",
  "style",
  "sector",
  "credit",
  "geography",
  "volatility",
] as const;
export type RotationCategory = (typeof ROTATION_CATEGORIES)[number];

export const CATEGORY_META: Record<RotationCategory, { title: string; note: string }> = {
  breadth: {
    title: "Breadth and size",
    note:
      "Whether the average listed company is keeping up with the index that contains it. When it is not, a " +
      "handful of very large companies are carrying the whole market.",
  },
  style: {
    title: "Style and factor",
    note:
      "Which kind of company is being rewarded: fast growth or cheap assets, steady balance sheets or high " +
      "volatility, and whether what worked recently is still working.",
  },
  sector: {
    title: "Sector rotation",
    note:
      "Which parts of the economy are leading. Read as a group rather than one at a time — the ranking across " +
      "all eleven sectors carries more information than any single pair.",
  },
  credit: {
    title: "Risk appetite and credit",
    note:
      "What lenders and commodity buyers are willing to pay for risk. These tend to move before equity indices " +
      "do, which is the whole reason for watching them separately.",
  },
  geography: {
    title: "Geography",
    note: "Whether capital is favouring the United States or the rest of the world.",
  },
  volatility: {
    title: "Volatility regime",
    note:
      "Context for everything above rather than a signal of its own. The same ratio reading means different " +
      "things in a calm market and a frightened one.",
  },
};

/** A ratio is scored; a context gauge is reported and never scored. */
export const IndicatorSchema = z.object({
  id: z
    .string()
    .regex(/^[a-z0-9-]+$/, "id must be lowercase letters, digits and hyphens"),
  label: z.string().min(3),
  category: z.enum(ROTATION_CATEGORIES),
  kind: z.enum(["ratio", "context"]).default("ratio"),
  /** Numerator ticker. Exchange-traded funds, plus one index (^VIX). */
  base: z.string().min(1).max(10),
  /** Denominator ticker. Null only for a context gauge, which has no ratio. */
  quote: z.string().min(1).max(10).nullable(),
  /** One or two sentences: what a RISING ratio means. Sent verbatim to the note writer. */
  risingMeans: z.string().min(10),
  fallingMeans: z.string().min(10),
  /** Plain-language direction labels naming the actual assets, never "up"/"down". */
  favorsBase: z.string().min(3),
  favorsQuote: z.string().min(3),
  /** One line stating what would show this reading to be wrong. */
  falsification: z.string().min(10),
  /** Set on the eleven sector-versus-market ratios so they can form the sector board. */
  sectorTicker: z.string().nullable().default(null),
  builtIn: z.boolean().default(false),
});
export type Indicator = z.infer<typeof IndicatorSchema>;

/* ---------------------------------------------------------------------------
 * A. Breadth and size
 * ------------------------------------------------------------------------- */

const BREADTH: Indicator[] = [
  {
    id: "rsp-spy",
    label: "RSP / SPY — mega-cap concentration",
    category: "breadth",
    kind: "ratio",
    base: "RSP",
    quote: "SPY",
    risingMeans:
      "The average S&P 500 company is outperforming the index, so the advance is being carried by the many " +
      "rather than the few. Breadth is improving and diversified exposure is being rewarded.",
    fallingMeans:
      "A handful of the largest companies are carrying the index while the average member lags. Concentration " +
      "is rising, which favours the very largest names — though a persistently narrowing market is also a " +
      "classic late-cycle fragility signal rather than automatically good news for those names.",
    favorsBase: "Favors RSP — the average company, equally weighted",
    favorsQuote: "Favors SPY — the largest companies, by market value",
    falsification:
      "Wrong if the ratio crosses back through its 200-day average and holds there for several weeks while the " +
      "score stays in the bottom tier.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "iwm-spy",
    label: "IWM / SPY — small caps versus large",
    category: "breadth",
    kind: "ratio",
    base: "IWM",
    quote: "SPY",
    risingMeans:
      "Small companies are leading large ones, which has historically clustered in the early part of an " +
      "expansion when credit is loosening and marginal businesses stop being priced for failure.",
    fallingMeans:
      "Large companies are leading, a pattern more common late in a cycle and in defensive markets where size " +
      "and balance-sheet depth are what investors are paying for.",
    favorsBase: "Favors IWM — smaller companies",
    favorsQuote: "Favors SPY — larger companies",
    falsification:
      "Wrong if small-cap leadership resumes while credit spreads are widening, which would break the " +
      "early-cycle reading this ratio is usually given.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "ijh-spy",
    label: "IJH / SPY — mid caps versus large",
    category: "breadth",
    kind: "ratio",
    base: "IJH",
    quote: "SPY",
    risingMeans:
      "Mid-sized companies are outperforming the largest. Mid caps sit between the two size extremes, so this " +
      "often moves before the small-cap ratio does and confirms it afterwards.",
    fallingMeans: "The largest companies are outperforming mid-sized ones.",
    favorsBase: "Favors IJH — mid-sized companies",
    favorsQuote: "Favors SPY — larger companies",
    falsification:
      "Wrong if this ratio and the small-cap ratio point in opposite directions for an extended period, which " +
      "would mean size is not the thing being priced.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "qqqe-qqq",
    label: "QQQE / QQQ — concentration inside the Nasdaq-100",
    category: "breadth",
    kind: "ratio",
    base: "QQQE",
    quote: "QQQ",
    risingMeans:
      "Participation across the Nasdaq-100 is broadening: the average member is beating the index rather " +
      "than a handful of its largest members carrying it.",
    fallingMeans:
      "The largest technology companies are carrying the index. This is a narrower measure than the S&P 500 " +
      "version, because the index it describes is itself already concentrated.",
    favorsBase: "Favors QQQE — the average Nasdaq-100 member",
    favorsQuote: "Favors QQQ — the largest technology companies",
    falsification:
      "Wrong if it diverges persistently from the equal-weight S&P 500 ratio, since both are measuring the " +
      "same underlying question about concentration.",
    sectorTicker: null,
    builtIn: true,
  },
];

/* ---------------------------------------------------------------------------
 * B. Style and factor
 * ------------------------------------------------------------------------- */

const STYLE: Indicator[] = [
  {
    id: "vug-vtv",
    label: "VUG / VTV — growth versus value",
    category: "style",
    kind: "ratio",
    base: "VUG",
    quote: "VTV",
    risingMeans:
      "Companies priced for future growth are outperforming those priced cheaply against current assets and " +
      "earnings. Long-duration expectations are being rewarded.",
    fallingMeans:
      "Cheaply valued companies are outperforming growth. Historically this has tended to accompany rising " +
      "discount rates, which reduce the present value of distant earnings the most.",
    favorsBase: "Favors VUG — growth",
    favorsQuote: "Favors VTV — value",
    falsification:
      "Wrong if the move is driven by one or two very large index members rather than by the style as a whole; " +
      "check it against the concentration ratios before trusting it.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "mtum-spy",
    label: "MTUM / SPY — is momentum working",
    category: "style",
    kind: "ratio",
    base: "MTUM",
    quote: "SPY",
    risingMeans:
      "Buying what has already been going up is beating the index — trends are persisting rather than " +
      "reversing.",
    fallingMeans:
      "Momentum is lagging the index. These periods are historically infrequent but sharp, and they have " +
      "tended to arrive at turning points rather than during them.",
    favorsBase: "Favors MTUM — recent winners",
    favorsQuote: "Favors SPY — the broad index",
    falsification:
      "Wrong as a regime read if the fund has just rebalanced, which changes what it holds without anything " +
      "changing in the market.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "sphb-splv",
    label: "SPHB / SPLV — high beta versus low volatility",
    category: "style",
    kind: "ratio",
    base: "SPHB",
    quote: "SPLV",
    risingMeans:
      "The most volatile members of the index are beating the calmest. This is one of the cleanest available " +
      "readings on appetite for risk, because both funds are drawn from the same index.",
    fallingMeans:
      "The calmest members are winning: defensive positioning, and often an early sign of it, since this pair " +
      "tends to turn before headline indices do.",
    favorsBase: "Favors SPHB — high volatility, risk appetite",
    favorsQuote: "Favors SPLV — low volatility, defensive",
    falsification:
      "Wrong if it disagrees with the credit ratio for an extended period; two independent risk-appetite " +
      "measures pointing opposite ways means at least one is measuring something else.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "qual-spy",
    label: "QUAL / SPY — is balance-sheet quality rewarded",
    category: "style",
    kind: "ratio",
    base: "QUAL",
    quote: "SPY",
    risingMeans:
      "Profitable companies with low debt and stable earnings are beating the index. Quality outperforming is " +
      "usually a defensive tell rather than an aggressive one.",
    fallingMeans:
      "Quality is lagging the index, which typically means weaker and more indebted companies are leading — " +
      "the pattern often described as a junk rally.",
    favorsBase: "Favors QUAL — profitable, low-debt companies",
    favorsQuote: "Favors SPY — the broad index",
    falsification:
      "Wrong if the fund's definition of quality has changed at a rebalance, since the label is a rules-based " +
      "screen rather than a fixed idea.",
    sectorTicker: null,
    builtIn: true,
  },
];

/* ---------------------------------------------------------------------------
 * C. Sector rotation — two cross-sector pairs, then the eleven-sector board.
 * ------------------------------------------------------------------------- */

const SECTOR_PAIRS: Indicator[] = [
  {
    id: "xly-xlp",
    label: "XLY / XLP — discretionary versus staples",
    category: "sector",
    kind: "ratio",
    base: "XLY",
    quote: "XLP",
    risingMeans:
      "Spending on things people want is beating spending on things people need. Read as a market-implied " +
      "measure of household confidence.",
    fallingMeans:
      "Consumers are pulling back toward essentials. A sustained decline here is one of the better-known " +
      "early warnings of a slowing economy.",
    favorsBase: "Favors XLY — discretionary spending, risk-on",
    favorsQuote: "Favors XLP — staples, defensive",
    falsification:
      "Wrong if the move traces to one or two very large members of either sector rather than to the sector " +
      "broadly, which both of these funds are concentrated enough to allow.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "xlk-xlp",
    label: "XLK / XLP — technology versus staples",
    category: "sector",
    kind: "ratio",
    base: "XLK",
    quote: "XLP",
    risingMeans: "Growth is being favoured over defensiveness at the sector level.",
    fallingMeans:
      "A defensive rotation is underway, with investors paying up for predictable demand over future growth.",
    favorsBase: "Favors XLK — technology, growth",
    favorsQuote: "Favors XLP — staples, defensive",
    falsification:
      "Wrong as a growth-versus-defence read if technology is moving on sector-specific news, in which case " +
      "the style ratios should not confirm it.",
    sectorTicker: null,
    builtIn: true,
  },
];

/** The eleven sector funds, each against the index. Ordered as the board ranks them. */
const SECTOR_BOARD_SOURCE: { ticker: string; id: string; name: string; rising: string; falling: string }[] = [
  {
    ticker: "XLK",
    id: "xlk-spy",
    name: "Technology",
    rising: "Technology is leading the market, the usual signature of a mid-cycle expansion.",
    falling: "Technology is lagging the market.",
  },
  {
    ticker: "XLF",
    id: "xlf-spy",
    name: "Financials",
    rising:
      "Financials are leading, which usually means the rate and credit backdrop is seen as favourable for " +
      "lending margins.",
    falling: "Financials are lagging, which can signal credit stress or a drag from falling rates.",
  },
  {
    ticker: "XLV",
    id: "xlv-spy",
    name: "Health Care",
    rising: "Health care is leading — defensive demand being favoured over cyclical demand.",
    falling: "Health care is lagging the market.",
  },
  {
    ticker: "XLY",
    id: "xly-spy",
    name: "Consumer Discretionary",
    rising: "Discretionary spending is leading, an early-cycle pattern.",
    falling: "Discretionary spending is lagging the market.",
  },
  {
    ticker: "XLP",
    id: "xlp-spy",
    name: "Consumer Staples",
    rising: "Staples are leading, which is what defensive rotation looks like at the sector level.",
    falling: "Staples are lagging, consistent with appetite for risk.",
  },
  {
    ticker: "XLI",
    id: "xli-spy",
    name: "Industrials",
    rising: "Industrials are leading, typically an early- to mid-cycle pattern.",
    falling: "Industrials are lagging the market.",
  },
  {
    ticker: "XLE",
    id: "xle-spy",
    name: "Energy",
    rising: "Energy is leading, usually when the commodity and inflation cycle is heating up.",
    falling: "Energy is lagging, consistent with a disinflationary or soft-demand backdrop.",
  },
  {
    ticker: "XLB",
    id: "xlb-spy",
    name: "Materials",
    rising: "Materials are leading, often alongside energy late in a cycle.",
    falling: "Materials are lagging the market.",
  },
  {
    ticker: "XLU",
    id: "xlu-spy",
    name: "Utilities",
    rising:
      "Utilities are leading. Historically the most defensive sector of all, though recent power demand has " +
      "given it a growth character it did not previously have.",
    falling: "Utilities are lagging the market.",
  },
  {
    ticker: "XLRE",
    id: "xlre-spy",
    name: "Real Estate",
    rising: "Real estate is leading, which is rate-sensitive and usually an early-cycle pattern.",
    falling: "Real estate is lagging the market.",
  },
  {
    ticker: "XLC",
    id: "xlc-spy",
    name: "Communication Services",
    rising: "Communication services are leading the market.",
    falling: "Communication services are lagging the market.",
  },
];

const SECTOR_BOARD: Indicator[] = SECTOR_BOARD_SOURCE.map((s) => ({
  id: s.id,
  label: `${s.ticker} / SPY — ${s.name.toLowerCase()} versus the market`,
  category: "sector" as const,
  kind: "ratio" as const,
  base: s.ticker,
  quote: "SPY",
  risingMeans: s.rising,
  fallingMeans: s.falling,
  favorsBase: `Favors ${s.ticker} — ${s.name.toLowerCase()}`,
  favorsQuote: "Favors SPY — the broad market",
  falsification:
    "Wrong if the sector fund's largest members explain the move on their own, since each of these funds is " +
    "weighted by market value and several are dominated by a few companies.",
  sectorTicker: s.ticker,
  builtIn: true,
}));

/* ---------------------------------------------------------------------------
 * D. Risk appetite and credit  ·  E. Geography  ·  F. Volatility
 * ------------------------------------------------------------------------- */

const CREDIT: Indicator[] = [
  {
    id: "hyg-ief",
    label: "HYG / IEF — high yield versus Treasuries",
    category: "credit",
    kind: "ratio",
    base: "HYG",
    quote: "IEF",
    risingMeans:
      "Lenders are being paid less to hold riskier corporate debt relative to government debt: credit appetite " +
      "is rising.",
    fallingMeans:
      "Credit stress is building. Of everything on this board this is the reading most tightly connected to " +
      "equities, and it has more often moved first than followed.",
    favorsBase: "Favors HYG — credit risk appetite",
    favorsQuote: "Favors IEF — safety, Treasuries",
    falsification:
      "Wrong as a credit read when the move is driven by the interest-rate sensitivity the two funds do not " +
      "share, rather than by the spread between them.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "cper-gld",
    label: "CPER / GLD — copper versus gold",
    category: "credit",
    kind: "ratio",
    base: "CPER",
    quote: "GLD",
    risingMeans:
      "The industrial metal is beating the monetary one: demand for things that get built is outrunning " +
      "demand for a store of value. Read as growth optimism.",
    fallingMeans: "Capital is moving toward safety rather than toward construction and manufacturing.",
    favorsBase: "Favors CPER — copper, growth optimism",
    favorsQuote: "Favors GLD — gold, caution",
    falsification:
      "Wrong when either leg is moving on supply news of its own — a mine outage or a central-bank buying " +
      "programme — rather than on demand.",
    sectorTicker: null,
    builtIn: true,
  },
];

const GEOGRAPHY: Indicator[] = [
  {
    id: "vxus-vti",
    label: "VXUS / VTI — the rest of the world versus the United States",
    category: "geography",
    kind: "ratio",
    base: "VXUS",
    quote: "VTI",
    risingMeans: "Markets outside the United States are leading.",
    fallingMeans:
      "United States exceptionalism: domestic markets are outperforming everything else, which has been the " +
      "prevailing condition for most of the last decade.",
    favorsBase: "Favors VXUS — international markets",
    favorsQuote: "Favors VTI — the United States",
    falsification:
      "Wrong if the move is currency rather than equity: an unhedged international fund carries the dollar " +
      "inside it, so a pure exchange-rate move shows up here as a change in leadership.",
    sectorTicker: null,
    builtIn: true,
  },
  {
    id: "eem-spy",
    label: "EEM / SPY — emerging markets versus the United States",
    category: "geography",
    kind: "ratio",
    base: "EEM",
    quote: "SPY",
    risingMeans: "Emerging markets are leading, generally a risk-seeking condition.",
    fallingMeans: "Capital is flowing toward the United States and developed markets.",
    favorsBase: "Favors EEM — emerging markets",
    favorsQuote: "Favors SPY — the United States",
    falsification:
      "Wrong if it is really a single-country story, since the emerging-market index is dominated by a handful " +
      "of large economies.",
    sectorTicker: null,
    builtIn: true,
  },
];

const VOLATILITY: Indicator[] = [
  {
    id: "vix",
    label: "VIX — volatility regime",
    category: "volatility",
    kind: "context",
    base: "^VIX",
    quote: null,
    risingMeans:
      "Options on the index have become more expensive, meaning larger moves are being priced in over the " +
      "coming month. Read as context for every ratio above, not as a signal of its own.",
    fallingMeans: "Expected volatility is falling and the market is pricing a calmer month ahead.",
    favorsBase: "Elevated volatility",
    favorsQuote: "Subdued volatility",
    falsification:
      "This gauge is never a pivot signal on its own; treating a level as a buy or sell trigger is the " +
      "documented way to misread it.",
    sectorTicker: null,
    builtIn: true,
  },
];

export const BUILT_IN_INDICATORS: Indicator[] = [
  ...BREADTH,
  ...STYLE,
  ...SECTOR_PAIRS,
  ...SECTOR_BOARD,
  ...CREDIT,
  ...GEOGRAPHY,
  ...VOLATILITY,
];

/* ---------------------------------------------------------------------------
 * The business-cycle reading of the sector board.
 *
 * A convention with a long history in practitioner research, NOT a law: which
 * sectors lead in which phase is a summary of past cycles, and the funds
 * themselves drift (today's technology sector is not the technology sector of
 * 1998). The board reports which phase current leadership most resembles and
 * says plainly that the mapping is a heuristic.
 * ------------------------------------------------------------------------- */

export const CYCLE_PHASES: { key: string; label: string; leaders: string[]; note: string }[] = [
  {
    key: "early",
    label: "Early cycle",
    leaders: ["XLY", "XLF", "XLRE", "XLI"],
    note: "Recovery: credit loosens, rate-sensitive and consumer-facing sectors have historically led.",
  },
  {
    key: "mid",
    label: "Mid cycle",
    leaders: ["XLK", "XLI", "XLC"],
    note: "Expansion: growth is broad, and capital-goods and technology leadership has been the usual pattern.",
  },
  {
    key: "late",
    label: "Late cycle",
    leaders: ["XLE", "XLB", "XLV", "XLU"],
    note: "Peak: inflation pressure builds and real-asset and defensive sectors have tended to take over.",
  },
  {
    key: "recession",
    label: "Contraction",
    leaders: ["XLP", "XLV", "XLU"],
    note: "Contraction: demand that does not vary with the cycle has historically been what holds up.",
  },
];

/* ---------------------------------------------------------------------------
 * Resolver — built-ins in code, operator additions in one app_settings key.
 * ------------------------------------------------------------------------- */

const CUSTOM_KEY = "rotation_indicators";

/** Operator-defined indicators. A malformed entry is dropped, never thrown. */
export function customIndicators(): Indicator[] {
  const raw = getAppSettingJson(CUSTOM_KEY);
  if (!Array.isArray(raw)) return [];
  const out: Indicator[] = [];
  for (const entry of raw) {
    const parsed = IndicatorSchema.safeParse(entry);
    if (parsed.success) out.push({ ...parsed.data, builtIn: false });
  }
  return out;
}

/** Built-ins first; a custom entry with the same id replaces the built-in. */
export function allIndicators(): Indicator[] {
  const custom = customIndicators();
  const byId = new Map(BUILT_IN_INDICATORS.map((i) => [i.id, i]));
  for (const c of custom) byId.set(c.id, c);
  return [...byId.values()];
}

export function getIndicator(id: string): Indicator | null {
  return allIndicators().find((i) => i.id === id) ?? null;
}

/**
 * Replace the whole custom set. Errors come back as field paths so the operator
 * can see which entry is wrong; nothing is saved unless every entry validates,
 * because a partial save would leave the board in a state nobody chose.
 */
export function saveCustomIndicators(input: unknown): { saved: number; errors: string[] } {
  if (!Array.isArray(input)) return { saved: 0, errors: ["expected an array of indicators"] };
  const errors: string[] = [];
  const parsed: Indicator[] = [];
  const seen = new Set<string>();
  input.forEach((entry, idx) => {
    const res = IndicatorSchema.safeParse(entry);
    if (!res.success) {
      for (const issue of res.error.issues) {
        errors.push(`[${idx}] ${issue.path.join(".") || "(root)"}: ${issue.message}`);
      }
      return;
    }
    if (seen.has(res.data.id)) {
      errors.push(`[${idx}] id: "${res.data.id}" appears more than once`);
      return;
    }
    if (res.data.kind === "ratio" && !res.data.quote) {
      errors.push(`[${idx}] quote: a ratio needs a denominator ticker`);
      return;
    }
    seen.add(res.data.id);
    parsed.push({ ...res.data, builtIn: false });
  });
  if (errors.length > 0) return { saved: 0, errors };
  setAppSettingJson(CUSTOM_KEY, parsed);
  return { saved: parsed.length, errors: [] };
}

/** Every distinct ticker the catalog needs, so a refresh fetches each exactly once. */
export function catalogTickers(indicators: Indicator[] = allIndicators()): string[] {
  const set = new Set<string>();
  for (const i of indicators) {
    set.add(i.base);
    if (i.quote) set.add(i.quote);
  }
  return [...set].sort();
}

/** The eleven sector-versus-market ratios, in catalog order. */
export function sectorBoardIndicators(indicators: Indicator[] = allIndicators()): Indicator[] {
  return indicators.filter((i) => i.sectorTicker !== null);
}

export function indicatorsByCategory(
  indicators: Indicator[] = allIndicators(),
): { category: RotationCategory; indicators: Indicator[] }[] {
  return ROTATION_CATEGORIES.map((category) => ({
    category,
    indicators: indicators.filter((i) => i.category === category),
  })).filter((g) => g.indicators.length > 0);
}
