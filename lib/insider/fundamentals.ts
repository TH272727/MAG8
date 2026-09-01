import { getCompanyFacts, type ConceptFact } from "../edgar";
import { conceptFromFacts, isAnnualLength } from "../bottleneck/xbrl";

/* ============================================================================
 * Financial statements, and the two published filters that decide whether a
 * beaten-down company is a bargain or simply dying.
 *
 * The formulas are NOT reinvented here. Both are implemented exactly as the
 * platform's own screening reference states them, so the scanner and the
 * fundamentals lens can never give different answers about the same balance
 * sheet: a nine-point fundamental-strength score whose criteria are each worth
 * one point, and a five-ratio bankruptcy model with the author's own zone
 * boundaries.
 *
 * WHERE THE DIFFICULTY ACTUALLY IS. Not the arithmetic — the tags. Companies
 * report the same concept under different names, change the name between years,
 * and leave concepts out entirely. Every concept below is therefore a CHAIN of
 * candidate tags tried in order, and the tag that actually answered is recorded
 * and shown, because "revenue" from one company and "revenue" from another are
 * not always the same measurement.
 *
 * Statements are read from the company-facts endpoint rather than one request
 * per concept. That is thirteen fewer requests per company, and it avoids the
 * documented case where the per-concept endpoint returns an empty object for a
 * tag that company-facts carries 158 values for.
 * ========================================================================== */

export interface FinancialYear {
  /** Fiscal year end, YYYY-MM-DD — the identity of the year. */
  end: string;
  fy: number | null;

  // Income statement (duration concepts).
  netIncome: number | null;
  revenue: number | null;
  costOfRevenue: number | null;
  grossProfit: number | null;
  ebit: number | null;

  // Cash flow (duration concepts).
  ocf: number | null;
  depreciation: number | null;
  capex: number | null;

  // Balance sheet (instant concepts, at the fiscal year end).
  assets: number | null;
  currentAssets: number | null;
  liabilities: number | null;
  currentLiabilities: number | null;
  longTermDebt: number | null;
  equity: number | null;
  retainedEarnings: number | null;
  shares: number | null;
  /** The date the share count was measured on, which is often the cover page's. */
  sharesAsOf: string | null;

  /**
   * Concept → the XBRL tag that supplied it FOR THIS YEAR. Filers migrate tags
   * between years, so this is per-year rather than per-company, and a
   * comparison spanning two different tags is flagged rather than made quietly.
   */
  sources: Record<string, string>;
}

export interface FinancialsResult {
  /** Oldest first. */
  years: FinancialYear[];
  /** Concept → the XBRL tag that actually supplied it. */
  tags: Record<string, string>;
  flags: string[];
}

/* ----------------------------------------------------------------------------
 * Tag chains
 * -------------------------------------------------------------------------- */

/** Duration concepts: a value covering a period. Read from annual windows only. */
const DURATION_CHAINS: Record<string, string[]> = {
  netIncome: ["NetIncomeLoss", "ProfitLoss", "NetIncomeLossAvailableToCommonStockholdersBasic"],
  revenue: [
    "Revenues",
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "RevenueFromContractWithCustomerIncludingAssessedTax",
    "SalesRevenueNet",
    "SalesRevenueGoodsNet",
  ],
  costOfRevenue: ["CostOfRevenue", "CostOfGoodsAndServicesSold", "CostOfGoodsSold", "CostOfServices"],
  grossProfit: ["GrossProfit"],
  ebit: [
    "OperatingIncomeLoss",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
  ],
  ocf: [
    "NetCashProvidedByUsedInOperatingActivities",
    "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
  ],
  depreciation: [
    "DepreciationDepletionAndAmortization",
    "DepreciationAmortizationAndAccretionNet",
    "DepreciationAndAmortization",
    "Depreciation",
  ],
  capex: [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsToAcquireProductiveAssets",
    "PaymentsForCapitalImprovements",
  ],
};

/** Instant concepts: a value at a moment. Read at the fiscal year end. */
const INSTANT_CHAINS: Record<string, string[]> = {
  assets: ["Assets"],
  currentAssets: ["AssetsCurrent"],
  liabilities: ["Liabilities"],
  currentLiabilities: ["LiabilitiesCurrent"],
  longTermDebt: ["LongTermDebtNoncurrent", "LongTermDebt", "LongTermDebtAndCapitalLeaseObligations"],
  equity: [
    "StockholdersEquity",
    "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
  ],
  retainedEarnings: ["RetainedEarningsAccumulatedDeficit"],
};

/** Share counts live in their own unit and under several tags. */
const SHARE_INSTANT_CHAIN = ["CommonStockSharesOutstanding", "CommonStockSharesIssued"];
/** The cover-page count, in SEC's document-entity taxonomy rather than us-gaap. */
const SHARE_COVER_CHAIN = ["EntityCommonStockSharesOutstanding"];
const SHARE_DURATION_CHAIN = [
  "WeightedAverageNumberOfDilutedSharesOutstanding",
  "WeightedAverageNumberOfSharesOutstandingBasic",
];

type Facts = Record<string, Record<string, unknown>>;

/**
 * Every value the chain can supply, newest tag winning where two agree on a
 * period.
 *
 * THIS IS NOT FIRST-POPULATED-WINS, and the difference is a whole missing year.
 * Filers migrate tags: Ford reported FY2024 revenue under `Revenues` and FY2025
 * revenue under `RevenueFromContractWithCustomerExcludingAssessedTax` — the same
 * $184,992,000,000 appears under both for the overlapping year, so the migration
 * is a relabelling rather than a redefinition. Taking the first tag that has any
 * rows at all reads FY2024 as the latest year and loses FY2025 in silence, which
 * is the exact shape of a bug this codebase has already met once, in the desk's
 * demand module, on Amazon and Nvidia.
 *
 * So the chain is MERGED across tags, earlier entries in the chain preferred
 * where two tags cover the same period, and the tag that supplied each period is
 * recorded. A comparison between two years drawn from different tags is then
 * visible to the caller, which matters: `CostOfRevenue` and
 * `CostOfGoodsAndServicesSold` are usually the same measurement and are not
 * guaranteed to be.
 */
function mergeChain(
  facts: Facts,
  chain: string[],
  unit: string,
  read: (rows: ConceptFact[]) => Map<string, { val: number; fy: number | null }>,
  taxonomy = "us-gaap",
): Map<string, { val: number; fy: number | null; tag: string }> {
  const out = new Map<string, { val: number; fy: number | null; tag: string }>();
  for (const tag of chain) {
    const rows = conceptFromFacts(facts, tag, { unit, taxonomy });
    if (!rows || rows.length === 0) continue;
    for (const [end, v] of read(rows)) {
      // Earlier in the chain wins: the chain is ordered by preference.
      if (!out.has(end)) out.set(end, { val: v.val, fy: v.fy, tag });
    }
  }
  return out;
}

const dayCount = (start: string, end: string): number =>
  Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000);

/**
 * Annual values keyed by period end.
 *
 * A concept is reported many times over: in the original filing, again as a
 * comparative in later ones, and sometimes restated. The EARLIEST filed value
 * for a window wins, so the figure is the one the company reported at the time
 * rather than a later revision — the same rule the desk's period arithmetic
 * uses, and the one that keeps a year from changing under the reader.
 */
function annualByEnd(rows: ConceptFact[]): Map<string, { val: number; fy: number | null }> {
  const out = new Map<string, { val: number; fy: number | null; filed: string }>();
  for (const f of rows) {
    if (!f.start || !f.end || typeof f.val !== "number") continue;
    if (!isAnnualLength(dayCount(f.start, f.end))) continue;
    const prev = out.get(f.end);
    const filed = f.filed ?? "";
    if (!prev || filed < prev.filed) out.set(f.end, { val: f.val, fy: f.fy ?? null, filed });
  }
  return new Map([...out].map(([k, v]) => [k, { val: v.val, fy: v.fy }]));
}

/** Instant values keyed by the date they were measured on. */
function instantByEnd(rows: ConceptFact[]): Map<string, { val: number; fy: number | null }> {
  const out = new Map<string, { val: number; fy: number | null; filed: string }>();
  for (const f of rows) {
    // An instant concept has no period start; a duration one is not a balance.
    if (f.start || !f.end || typeof f.val !== "number") continue;
    const prev = out.get(f.end);
    const filed = f.filed ?? "";
    if (!prev || filed < prev.filed) out.set(f.end, { val: f.val, fy: f.fy ?? null, filed });
  }
  return new Map([...out].map(([k, v]) => [k, { val: v.val, fy: v.fy }]));
}

/**
 * The share count belonging to a fiscal year end.
 *
 * Share counts are usually NOT measured on the balance-sheet date. They are
 * stated on the cover of the annual report, dated whenever it was prepared —
 * six weeks after year end is typical — so an exact date match finds nothing
 * for most large filers, and the dilution criterion silently goes unscored for
 * exactly the companies whose filings are most complete. Republic Services and
 * Ford both behave this way.
 *
 * So the nearest measurement within a quarter of the year end is used,
 * preferring one taken ON or AFTER it, and the date actually used is recorded
 * and shown rather than presented as the year-end count.
 */
const SHARE_MATCH_DAYS = 100;

function shareCountFor(
  byDate: Map<string, { val: number; fy: number | null; tag: string }>,
  fiscalEnd: string,
): { val: number; asOf: string; tag: string } | null {
  let best: { val: number; asOf: string; tag: string; rank: [number, number] } | null = null;
  for (const [date, v] of byDate) {
    const offset = Math.round((Date.parse(date) - Date.parse(fiscalEnd)) / 86_400_000);
    if (Math.abs(offset) > SHARE_MATCH_DAYS) continue;
    // On-or-after first, then closest.
    const rank: [number, number] = [offset < 0 ? 1 : 0, Math.abs(offset)];
    if (!best || rank[0] < best.rank[0] || (rank[0] === best.rank[0] && rank[1] < best.rank[1])) {
      best = { val: v.val, asOf: date, tag: v.tag, rank };
    }
  }
  return best ? { val: best.val, asOf: best.asOf, tag: best.tag } : null;
}

/* ----------------------------------------------------------------------------
 * Extraction
 * -------------------------------------------------------------------------- */

/**
 * Turn a company-facts payload into fiscal years.
 *
 * Fiscal years are identified by the END DATE of an annual income-statement
 * window, and the balance sheet for that year is whatever was measured on the
 * same date. That is exact rather than approximate: the balance-sheet date IS
 * the fiscal year end, so no tolerance window or fiscal-label matching is
 * needed, and a company whose year ends in late June is handled the same as one
 * ending in December. Share counts are the one exception, and say so.
 */
export function extractFinancials(facts: Facts | undefined, opts: { years?: number } = {}): FinancialsResult {
  const want = opts.years ?? 6;
  const flags: string[] = [];
  const tags: Record<string, string> = {};

  if (!facts || Object.keys(facts).length === 0) {
    return { years: [], tags, flags: ["No structured financial statements are filed for this company."] };
  }

  const merged = new Map<string, Map<string, { val: number; fy: number | null; tag: string }>>();
  for (const [concept, chain] of Object.entries(DURATION_CHAINS)) {
    const m = mergeChain(facts, chain, "USD", annualByEnd);
    if (m.size > 0) merged.set(concept, m);
  }
  for (const [concept, chain] of Object.entries(INSTANT_CHAINS)) {
    const m = mergeChain(facts, chain, "USD", instantByEnd);
    if (m.size > 0) merged.set(concept, m);
  }

  /*
   * Shares are gathered from every source at once rather than from the first
   * one that has anything, because a filer can keep an old tag alive for early
   * years and move to another for recent ones. Ford's `CommonStockSharesIssued`
   * stops before the years this scan cares about, so a first-source-wins rule
   * finds a populated map, never consults the cover page, and leaves the most
   * recent years — the only ones the dilution criterion compares — empty.
   *
   * Order of preference on a date collision: the balance-sheet count, then the
   * cover-page count from the document-entity taxonomy, then the weighted
   * average from the income statement.
   */
  const shareByDate = new Map<string, { val: number; fy: number | null; tag: string }>();
  for (const [chain, taxonomy, read] of [
    [SHARE_INSTANT_CHAIN, "us-gaap", instantByEnd],
    [SHARE_COVER_CHAIN, "dei", instantByEnd],
    [SHARE_DURATION_CHAIN, "us-gaap", annualByEnd],
  ] as [string[], string, typeof instantByEnd][]) {
    for (const [date, v] of mergeChain(facts, chain, "shares", read, taxonomy)) {
      if (!shareByDate.has(date)) {
        shareByDate.set(date, { ...v, tag: taxonomy === "dei" ? `dei:${v.tag}` : v.tag });
      }
    }
  }

  // The set of fiscal year ends, taken from whichever income-statement concepts
  // the filer reports.
  const ends = new Set<string>();
  for (const key of ["revenue", "netIncome", "ocf", "ebit"]) {
    for (const end of merged.get(key)?.keys() ?? []) ends.add(end);
  }
  if (ends.size === 0) {
    return {
      years: [],
      tags,
      flags: ["No annual income-statement figures could be read from this company's filings."],
    };
  }

  const kept = [...ends].sort().slice(-want);

  const years: FinancialYear[] = kept.map((end) => {
    const sources: Record<string, string> = {};
    const get = (concept: string): number | null => {
      const hit = merged.get(concept)?.get(end);
      if (!hit) return null;
      sources[concept] = hit.tag;
      tags[concept] ??= hit.tag;
      return hit.val;
    };

    const revenue = get("revenue");
    const costOfRevenue = get("costOfRevenue");
    const grossFiled = get("grossProfit");
    // Gross profit is often not tagged; revenue minus cost of revenue is the
    // same figure and is used only when the filer did not state it.
    const grossProfit =
      grossFiled ?? (revenue !== null && costOfRevenue !== null ? revenue - costOfRevenue : null);
    if (grossFiled === null && grossProfit !== null) sources.grossProfit = "revenue − cost of revenue";

    const assets = get("assets");
    const equity = get("equity");
    const liabilitiesFiled = get("liabilities");
    // Total liabilities is frequently omitted; assets minus equity is exact by
    // the accounting identity, not an approximation.
    const liabilities = liabilitiesFiled ?? (assets !== null && equity !== null ? assets - equity : null);
    if (liabilitiesFiled === null && liabilities !== null) sources.liabilities = "assets − equity";

    const share = shareCountFor(shareByDate, end);
    if (share) {
      sources.shares = share.tag;
      tags.shares ??= share.tag;
    }

    return {
      end,
      fy: merged.get("revenue")?.get(end)?.fy ?? merged.get("netIncome")?.get(end)?.fy ?? null,
      netIncome: get("netIncome"),
      revenue,
      costOfRevenue,
      grossProfit,
      ebit: get("ebit"),
      ocf: get("ocf"),
      depreciation: get("depreciation"),
      capex: get("capex"),
      assets,
      currentAssets: get("currentAssets"),
      liabilities,
      currentLiabilities: get("currentLiabilities"),
      longTermDebt: get("longTermDebt"),
      equity,
      retainedEarnings: get("retainedEarnings"),
      shares: share?.val ?? null,
      sharesAsOf: share?.asOf ?? null,
      sources,
    };
  });

  // Tag migrations inside the retained window, stated once rather than per year.
  const migrated = new Set<string>();
  for (let i = 1; i < years.length; i++) {
    for (const concept of Object.keys(years[i].sources)) {
      const now = years[i].sources[concept];
      const before = years[i - 1].sources[concept];
      if (before && now && before !== now) migrated.add(concept);
    }
  }
  if (migrated.size > 0) {
    flags.push(
      `This company changed the reporting tag it uses for ${[...migrated].join(", ")} during the years shown. ` +
        "The figures are as filed, but a year-on-year comparison of those items spans two different labels.",
    );
  }

  if (years.length < 2) {
    flags.push(
      `Only ${years.length} fiscal year${years.length === 1 ? "" : "s"} of statements could be read, and both ` +
        "published filters compare a year against the one before it, so neither can be computed.",
    );
  }
  if (!tags.grossProfit && !tags.costOfRevenue) {
    flags.push(
      "This company does not report a gross profit or a cost of revenue, so the two criteria that rest on " +
        "gross margin cannot be scored and are counted as unmet.",
    );
  }
  if (!tags.shares) {
    flags.push("No share count is tagged in this company's filings, so the dilution criterion is unmet.");
  }

  return { years, tags, flags };
}

/**
 * Fetch and extract one company's statements.
 *
 * Returns null when SEC has nothing structured for the company at all, which is
 * ordinary for a foreign private issuer filing under a different regime and is
 * reported rather than treated as a failure.
 */
export async function loadFinancials(
  cik: number,
  opts: { timeoutMs?: number; years?: number } = {},
): Promise<(FinancialsResult & { entityName: string }) | null> {
  const payload = await getCompanyFacts(cik, { timeoutMs: opts.timeoutMs });
  if (!payload) return null;
  const result = extractFinancials(payload.facts as Facts, { years: opts.years });
  return { ...result, entityName: payload.entityName };
}

/* ----------------------------------------------------------------------------
 * The nine-point fundamental-strength score
 * -------------------------------------------------------------------------- */

export interface FScoreCriterion {
  key: string;
  label: string;
  /** One point, or none. A criterion that cannot be computed scores none. */
  point: 0 | 1;
  /** Whether the inputs existed at all — a nine-point score built on six is disclosed. */
  measured: boolean;
  detail: string;
}

export interface FScoreResult {
  score: number;
  /** How many of the nine criteria had the data to be judged. */
  measured: number;
  criteria: FScoreCriterion[];
  flags: string[];
}

const num = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

const ratio = (a: number | null, b: number | null): number | null =>
  num(a) && num(b) && b !== 0 ? a / b : null;

/**
 * Piotroski's nine criteria, one point each.
 *
 * Two implementation choices worth stating rather than burying:
 *
 * 1. Return on assets uses BEGINNING-of-year total assets, which is the
 *    definition in the original paper. It needs the prior year's balance sheet,
 *    and where a third year is unavailable the change in return on assets falls
 *    back to end-of-year assets on both sides — flagged, because that is a
 *    slightly different measurement rather than the same one.
 *
 * 2. An unmeasurable criterion scores ZERO rather than being dropped. The score
 *    keeps its nine-point scale, so it stays comparable with the published
 *    threshold, and the count of criteria that could actually be judged is
 *    returned alongside it. Erring towards a lower score errs towards rejecting
 *    a company, which is the safe direction for a filter whose failure mode is
 *    keeping a dying business on a list.
 */
export function piotroskiFScore(
  current: FinancialYear,
  prior: FinancialYear,
  earlier?: FinancialYear,
): FScoreResult {
  const criteria: FScoreCriterion[] = [];
  const flags: string[] = [];

  const add = (
    key: string,
    label: string,
    verdict: boolean | null,
    detail: string,
  ): void => {
    criteria.push({
      key,
      label,
      point: verdict === true ? 1 : 0,
      measured: verdict !== null,
      detail: verdict === null ? `${detail} — not reported, so no point is awarded.` : detail,
    });
  };

  const fmt = (n: number | null, dp = 2): string => (num(n) ? n.toFixed(dp) : "not reported");
  const pct = (n: number | null): string => (num(n) ? `${(n * 100).toFixed(1)}%` : "not reported");

  /* -- Profitability, four points ------------------------------------------- */
  const roaNow = ratio(current.netIncome, prior.assets);
  const roaPrior = earlier ? ratio(prior.netIncome, earlier.assets) : ratio(prior.netIncome, prior.assets);
  if (!earlier && roaPrior !== null) {
    flags.push(
      "Only two years of balance sheets are available, so the prior year's return on assets is measured " +
        "against its own closing assets rather than its opening ones.",
    );
  }

  add(
    "roa-positive",
    "Return on assets is positive",
    roaNow === null ? null : roaNow > 0,
    `Return on assets ${pct(roaNow)}.`,
  );
  add(
    "cfo-positive",
    "Operating cash flow is positive",
    num(current.ocf) ? current.ocf > 0 : null,
    `Operating cash flow ${fmt(current.ocf, 0)}.`,
  );
  add(
    "roa-improving",
    "Return on assets improved",
    roaNow === null || roaPrior === null ? null : roaNow > roaPrior,
    `Return on assets ${pct(roaNow)} against ${pct(roaPrior)} the year before.`,
  );
  add(
    "accruals",
    "Earnings are backed by cash",
    num(current.ocf) && num(current.netIncome) ? current.ocf > current.netIncome : null,
    `Operating cash flow ${fmt(current.ocf, 0)} against net income ${fmt(current.netIncome, 0)}.`,
  );

  /* -- Leverage, liquidity and funding, three points ------------------------ */
  const ltdNow = ratio(current.longTermDebt, current.assets);
  const ltdPrior = ratio(prior.longTermDebt, prior.assets);
  add(
    "leverage",
    "Long-term debt fell as a share of assets",
    ltdNow === null || ltdPrior === null ? null : ltdNow < ltdPrior,
    `Long-term debt is ${pct(ltdNow)} of assets, against ${pct(ltdPrior)} the year before.`,
  );

  const currentRatioNow = ratio(current.currentAssets, current.currentLiabilities);
  const currentRatioPrior = ratio(prior.currentAssets, prior.currentLiabilities);
  add(
    "liquidity",
    "The current ratio improved",
    currentRatioNow === null || currentRatioPrior === null ? null : currentRatioNow > currentRatioPrior,
    `Current ratio ${fmt(currentRatioNow)} against ${fmt(currentRatioPrior)} the year before.`,
  );

  /*
   * Dilution. Share counts are contaminated by corporate actions: a two-for-one
   * split doubles the count without a share being sold, and a merger can add
   * most of a company overnight. This screen's own universe check found a 97%
   * jump that was a split and a 79% one that was a merger.
   *
   * The criterion is scored as filed — a large increase loses the point — and a
   * change big enough to be far more often a corporate action than an issuance
   * is FLAGGED, so a reader can see why the point went. Losing a point wrongly
   * makes the gate more likely to reject, which is the safe direction, but it
   * is only defensible while the reason is visible.
   */
  const sharesGrew =
    num(current.shares) && num(prior.shares) && prior.shares > 0
      ? current.shares / prior.shares - 1
      : null;
  add(
    "dilution",
    "No new shares were issued",
    sharesGrew === null ? null : sharesGrew <= 0,
    sharesGrew === null
      ? "Shares outstanding not reported."
      : `Shares outstanding changed ${pct(sharesGrew)}` +
        (current.sharesAsOf && current.sharesAsOf !== current.end
          ? `, counted as of ${current.sharesAsOf} rather than the year end.`
          : "."),
  );
  if (sharesGrew !== null && sharesGrew > 0.25) {
    flags.push(
      `The share count rose ${(sharesGrew * 100).toFixed(0)}% year on year. A rise that large is more often a ` +
        "split or an acquisition than a sale of new shares, and this criterion cannot tell them apart, so the " +
        "point may have been lost to a corporate action rather than to dilution.",
    );
  }

  /* -- Operating efficiency, two points ------------------------------------- */
  const marginNow = ratio(current.grossProfit, current.revenue);
  const marginPrior = ratio(prior.grossProfit, prior.revenue);
  add(
    "margin",
    "Gross margin improved",
    marginNow === null || marginPrior === null ? null : marginNow > marginPrior,
    `Gross margin ${pct(marginNow)} against ${pct(marginPrior)} the year before.`,
  );

  const turnoverNow = ratio(current.revenue, prior.assets);
  const turnoverPrior = earlier ? ratio(prior.revenue, earlier.assets) : ratio(prior.revenue, prior.assets);
  add(
    "turnover",
    "Asset turnover improved",
    turnoverNow === null || turnoverPrior === null ? null : turnoverNow > turnoverPrior,
    `Asset turnover ${fmt(turnoverNow)} against ${fmt(turnoverPrior)} the year before.`,
  );

  /*
   * Six of the nine criteria compare one year against the year before it. If
   * the company relabelled the concept between those years — which filers do —
   * the comparison spans two tags, and while that is usually a relabelling it
   * is not guaranteed to be the same measurement. Said once, plainly, rather
   * than either hidden or used as an excuse to withhold the score.
   */
  const comparative: [string, string][] = [
    ["revenue", "the revenue figure"],
    ["costOfRevenue", "the cost-of-revenue figure"],
    ["grossProfit", "the gross-profit figure"],
    ["netIncome", "the net-income figure"],
    ["longTermDebt", "the long-term-debt figure"],
    ["assets", "the total-assets figure"],
  ];
  const spanned = comparative
    .filter(([k]) => current.sources[k] && prior.sources[k] && current.sources[k] !== prior.sources[k])
    .map(([, label]) => label);
  if (spanned.length > 0) {
    flags.push(
      `The company changed how it labels ${spanned.join(", ")} between these two years, so the criteria ` +
        "comparing them are measured across two different reporting tags.",
    );
  }

  const score = criteria.reduce((s, c) => s + c.point, 0);
  const measured = criteria.filter((c) => c.measured).length;
  if (measured < 9) {
    flags.push(
      `${9 - measured} of the nine criteria could not be judged from this company's filings and scored no ` +
        "point, so the score understates rather than guesses.",
    );
  }
  return { score, measured, criteria, flags };
}

/* ----------------------------------------------------------------------------
 * The bankruptcy model
 * -------------------------------------------------------------------------- */

export type AltmanZone = "safe" | "grey" | "distress" | "unmeasured";

export interface AltmanResult {
  z: number | null;
  zone: AltmanZone;
  parts: {
    workingCapitalToAssets: number | null;
    retainedEarningsToAssets: number | null;
    ebitToAssets: number | null;
    equityValueToLiabilities: number | null;
    salesToAssets: number | null;
  };
  flags: string[];
}

/** The author's own boundaries. */
export const Z_SAFE = 2.99;
export const Z_DISTRESS = 1.81;

/**
 * Altman's original five-ratio model.
 *
 * The market value of equity is the fourth ratio's numerator, and it is taken
 * from the weekly screen's snapshot rather than a live quote, so that every
 * company in one scan is valued as of the same moment. A score built from a
 * price fetched at a different time than its neighbour's is not comparable with
 * it, and the comparison is the entire purpose.
 *
 * The model was fitted on manufacturers. Its own caution — that the trend
 * matters more than the level, and that a heavily reinvesting company can score
 * low without being anywhere near insolvent — is carried through to the page
 * rather than left in the literature.
 */
export function altmanZScore(y: FinancialYear, marketCapUsd: number | null): AltmanResult {
  const flags: string[] = [];
  const assets = y.assets;
  const workingCapital =
    num(y.currentAssets) && num(y.currentLiabilities) ? y.currentAssets - y.currentLiabilities : null;

  const parts = {
    workingCapitalToAssets: ratio(workingCapital, assets),
    retainedEarningsToAssets: ratio(y.retainedEarnings, assets),
    ebitToAssets: ratio(y.ebit, assets),
    equityValueToLiabilities: ratio(marketCapUsd, y.liabilities),
    salesToAssets: ratio(y.revenue, assets),
  };

  const missing = Object.entries(parts)
    .filter(([, v]) => v === null)
    .map(([k]) => k);
  if (missing.length > 0) {
    // Every term carries a weight; dropping one silently would change the scale
    // and produce a number that looks like a Z-score and is not one.
    flags.push(
      `${missing.length} of the five ratios could not be computed from this company's filings, so no score ` +
        "is given. A partial score would sit on the same scale as a complete one and could not be told apart.",
    );
    return { z: null, zone: "unmeasured", parts, flags };
  }

  const z =
    1.2 * parts.workingCapitalToAssets! +
    1.4 * parts.retainedEarningsToAssets! +
    3.3 * parts.ebitToAssets! +
    0.6 * parts.equityValueToLiabilities! +
    1.0 * parts.salesToAssets!;

  const zone: AltmanZone = z > Z_SAFE ? "safe" : z < Z_DISTRESS ? "distress" : "grey";
  return { z: Math.round(z * 1000) / 1000, zone, parts, flags };
}

/* ----------------------------------------------------------------------------
 * The gate
 * -------------------------------------------------------------------------- */

export interface StrengthGateResult {
  pass: boolean;
  /** Set when the gate failed but is configured to flag rather than reject. */
  flaggedOnly: boolean;
  reasons: string[];
}

export interface StrengthThresholds {
  /** A score below this fails. */
  fScoreFloor: number;
  /** True accepts the grey zone; false requires the safe one. */
  allowGreyZone: boolean;
  /** True removes a failing company from the ranking; false ranks it with a flag. */
  strengthGateRejects: boolean;
}

/**
 * The value-trap veto.
 *
 * A company can fail on either half. The unmeasured case is deliberately NOT a
 * failure: a filer whose statements cannot be read has not been shown to be
 * distressed, and treating absent data as evidence of trouble would quietly
 * exclude every foreign private issuer from the scan. It is reported instead.
 */
export function financialStrengthGate(
  f: FScoreResult | null,
  z: AltmanResult | null,
  t: StrengthThresholds,
): StrengthGateResult {
  const reasons: string[] = [];
  let failed = false;

  if (!f) {
    reasons.push("The fundamental-strength score could not be computed, so this filter did not run.");
  } else if (f.score < t.fScoreFloor) {
    failed = true;
    reasons.push(
      `The fundamental-strength score is ${f.score} of nine, below the floor of ${t.fScoreFloor}.`,
    );
  } else {
    reasons.push(`The fundamental-strength score is ${f.score} of nine.`);
  }

  if (!z || z.zone === "unmeasured") {
    reasons.push("The bankruptcy model could not be computed, so this filter did not run.");
  } else if (z.zone === "distress") {
    failed = true;
    reasons.push(`The bankruptcy model puts the balance sheet in its distress zone at ${z.z}.`);
  } else if (z.zone === "grey" && !t.allowGreyZone) {
    failed = true;
    reasons.push(
      `The bankruptcy model puts the balance sheet in its middle zone at ${z.z}, and this scan requires the ` +
        "safe zone.",
    );
  } else {
    reasons.push(`The bankruptcy model puts the balance sheet in its ${z.zone} zone at ${z.z}.`);
  }

  return {
    pass: !failed || !t.strengthGateRejects,
    flaggedOnly: failed && !t.strengthGateRejects,
    reasons,
  };
}

/**
 * Financial strength as a 0-100 component of the composite.
 *
 * The nine-point score carries most of it and the solvency zone adjusts it. A
 * company whose statements could not be read scores null rather than zero: it
 * was not measured, and an unmeasured company must never be able to look like a
 * weak one.
 */
export function strengthScore(f: FScoreResult | null, z: AltmanResult | null): number | null {
  if (!f) return null;
  const base = (f.score / 9) * 80;
  const solvency = z === null || z.zone === "unmeasured" ? 10 : z.zone === "safe" ? 20 : z.zone === "grey" ? 10 : 0;
  return Math.round((base + solvency) * 10) / 10;
}
