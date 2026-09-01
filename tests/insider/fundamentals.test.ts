import { describe, expect, it } from "vitest";
import {
  altmanZScore,
  extractFinancials,
  financialStrengthGate,
  piotroskiFScore,
  strengthScore,
  Z_DISTRESS,
  Z_SAFE,
  type FinancialYear,
} from "../../lib/insider/fundamentals";

/* ============================================================================
 * The statements, and the two published filters built on them.
 *
 * The scoring tests use hand-built years whose answers were worked out on
 * paper, so they check the formulas rather than the data. The extraction tests
 * use synthetic company-facts payloads shaped like the real ones — including
 * the tag migration that cost Ford a whole fiscal year before it was fixed.
 * ========================================================================== */

/* ----------------------------------------------------------------------------
 * Extraction
 * -------------------------------------------------------------------------- */

type Row = { start?: string; end: string; val: number; fy?: number; filed?: string };

/**
 * Build a company-facts payload in SEC's own shape: taxonomy → tag → units →
 * unit → rows. The `units` level is easy to leave out and is exactly where a
 * parser silently finds nothing.
 */
const facts = (spec: Record<string, Record<string, Record<string, Row[]>>>) =>
  Object.fromEntries(
    Object.entries(spec).map(([taxonomy, taggings]) => [
      taxonomy,
      Object.fromEntries(Object.entries(taggings).map(([tag, units]) => [tag, { units }])),
    ]),
  ) as Record<string, Record<string, unknown>>;

const annual = (year: number, val: number, filed?: string): Row => ({
  start: `${year}-01-01`,
  end: `${year}-12-31`,
  val,
  fy: year,
  filed: filed ?? `${year + 1}-02-15`,
});

const instant = (date: string, val: number, filed?: string): Row => ({
  end: date,
  val,
  filed: filed ?? date,
});

describe("extractFinancials — tag migration", () => {
  // The shape Ford actually files: the old tag stops, a new one takes over, and
  // the overlapping year carries the same number under both.
  const migrated = facts({
    "us-gaap": {
      Revenues: { USD: [annual(2023, 176_191), annual(2024, 184_992)] },
      RevenueFromContractWithCustomerExcludingAssessedTax: {
        USD: [annual(2024, 184_992), annual(2025, 187_267)],
      },
      NetIncomeLoss: { USD: [annual(2023, 4347), annual(2024, 5879)] },
      ProfitLoss: { USD: [annual(2025, -8162)] },
      Assets: { USD: [instant("2023-12-31", 273_310), instant("2024-12-31", 285_196), instant("2025-12-31", 289_160)] },
    },
  });

  it("keeps the most recent year when the company changed tags", () => {
    // First-populated-wins reads 2024 as the latest year and loses 2025 whole.
    const r = extractFinancials(migrated);
    expect(r.years.map((y) => y.end)).toEqual(["2023-12-31", "2024-12-31", "2025-12-31"]);
    expect(r.years[2].revenue).toBe(187_267);
    expect(r.years[2].netIncome).toBe(-8162);
  });

  it("prefers the earlier tag in the chain where both cover a year", () => {
    expect(extractFinancials(migrated).years[1].sources.revenue).toBe("Revenues");
    expect(extractFinancials(migrated).years[2].sources.revenue).toBe(
      "RevenueFromContractWithCustomerExcludingAssessedTax",
    );
  });

  it("says plainly that a comparison spans two labels", () => {
    const r = extractFinancials(migrated);
    expect(r.flags.some((f) => /changed the reporting tag/.test(f))).toBe(true);
    expect(r.flags.find((f) => /changed the reporting tag/.test(f))).toContain("revenue");
  });
});

describe("extractFinancials — reading the statements", () => {
  const company = facts({
    "us-gaap": {
      Revenues: { USD: [annual(2024, 500), annual(2025, 700)] },
      CostOfRevenue: { USD: [annual(2024, 300), annual(2025, 400)] },
      NetIncomeLoss: { USD: [annual(2024, 40), annual(2025, 90)] },
      Assets: { USD: [instant("2024-12-31", 1000), instant("2025-12-31", 1200)] },
      StockholdersEquity: { USD: [instant("2024-12-31", 600), instant("2025-12-31", 700)] },
      CommonStockSharesOutstanding: {
        // Cover-page dated, six weeks after the year end — as most large filers do.
        shares: [instant("2025-02-14", 100), instant("2026-02-13", 101)],
      },
    },
  });

  it("derives gross profit when the filer does not tag it", () => {
    const y = extractFinancials(company).years;
    expect(y[1].grossProfit).toBe(300);
    expect(y[1].sources.grossProfit).toBe("revenue − cost of revenue");
  });

  it("derives total liabilities from the accounting identity", () => {
    const y = extractFinancials(company).years;
    expect(y[1].liabilities).toBe(500);
    expect(y[1].sources.liabilities).toBe("assets − equity");
  });

  it("matches a cover-page share count to the year it belongs to", () => {
    // An exact date match finds nothing here, which is the normal case.
    const y = extractFinancials(company).years;
    expect(y[0].shares).toBe(100);
    expect(y[0].sharesAsOf).toBe("2025-02-14");
    expect(y[1].shares).toBe(101);
  });

  it("takes the earliest filed value for a period, not a later restatement", () => {
    const restated = facts({
      "us-gaap": {
        Revenues: {
          USD: [annual(2025, 700, "2026-02-15"), { ...annual(2025, 650), filed: "2026-11-01" }],
        },
        Assets: { USD: [instant("2025-12-31", 1000)] },
      },
    });
    expect(extractFinancials(restated).years[0].revenue).toBe(700);
  });

  it("ignores quarterly windows when building fiscal years", () => {
    const quarterly = facts({
      "us-gaap": {
        Revenues: {
          USD: [
            { start: "2025-01-01", end: "2025-03-31", val: 150, filed: "2025-05-01" },
            annual(2025, 700),
          ],
        },
      },
    });
    const r = extractFinancials(quarterly);
    expect(r.years).toHaveLength(1);
    expect(r.years[0].revenue).toBe(700);
  });

  it("reports an empty payload rather than inventing a company", () => {
    expect(extractFinancials(undefined).years).toEqual([]);
    expect(extractFinancials({}).flags[0]).toMatch(/No structured financial statements/);
    expect(extractFinancials(facts({ "us-gaap": { Assets: { USD: [instant("2025-12-31", 5)] } } })).flags[0]).toMatch(
      /No annual income-statement figures/,
    );
  });

  it("says when there is only one year, and why that matters", () => {
    const oneYear = facts({ "us-gaap": { Revenues: { USD: [annual(2025, 700)] } } });
    expect(extractFinancials(oneYear).flags.some((f) => /compare a year against the one before/.test(f))).toBe(true);
  });
});

/* ----------------------------------------------------------------------------
 * The nine-point score
 * -------------------------------------------------------------------------- */

const year = (over: Partial<FinancialYear>): FinancialYear => ({
  end: "2025-12-31",
  fy: 2025,
  netIncome: null,
  revenue: null,
  costOfRevenue: null,
  grossProfit: null,
  ebit: null,
  ocf: null,
  depreciation: null,
  capex: null,
  assets: null,
  currentAssets: null,
  liabilities: null,
  currentLiabilities: null,
  longTermDebt: null,
  equity: null,
  retainedEarnings: null,
  shares: null,
  sharesAsOf: null,
  sources: {},
  ...over,
});

// Worked out on paper: every one of the nine criteria is met.
const EARLIER = year({ end: "2023-12-31", assets: 800 });
const PRIOR = year({
  end: "2024-12-31",
  assets: 1000,
  netIncome: 40,
  ocf: 50,
  longTermDebt: 300,
  currentAssets: 300,
  currentLiabilities: 200,
  shares: 100,
  revenue: 500,
  grossProfit: 200,
});
const CURRENT = year({
  end: "2025-12-31",
  assets: 1200,
  netIncome: 90,
  ocf: 120,
  longTermDebt: 300,
  currentAssets: 400,
  currentLiabilities: 200,
  shares: 100,
  revenue: 700,
  grossProfit: 300,
});

describe("piotroskiFScore", () => {
  it("scores nine out of nine when every criterion is met", () => {
    const f = piotroskiFScore(CURRENT, PRIOR, EARLIER);
    expect(f.score).toBe(9);
    expect(f.measured).toBe(9);
    expect(f.criteria.filter((c) => c.point === 0)).toEqual([]);
  });

  it("measures return on assets against opening assets, as the paper defines it", () => {
    // 90 / 1000 (the prior year's closing balance) = 9%, not 90 / 1200 = 7.5%.
    const roa = piotroskiFScore(CURRENT, PRIOR, EARLIER).criteria.find((c) => c.key === "roa-positive")!;
    expect(roa.detail).toContain("9.0%");
  });

  it("scores zero when every criterion is missed", () => {
    const worse = year({
      end: "2025-12-31",
      assets: 1200,
      netIncome: -50,
      ocf: -80,
      longTermDebt: 600,
      currentAssets: 200,
      currentLiabilities: 400,
      shares: 130,
      revenue: 300,
      grossProfit: 60,
    });
    const f = piotroskiFScore(worse, PRIOR, EARLIER);
    expect(f.score).toBe(0);
    expect(f.measured).toBe(9);
  });

  it("scores an unmeasurable criterion as no point, and counts it as unmeasured", () => {
    const noCash = year({ ...CURRENT, ocf: null });
    const f = piotroskiFScore(noCash, PRIOR, EARLIER);
    // Two criteria rest on operating cash flow.
    expect(f.score).toBe(7);
    expect(f.measured).toBe(7);
    expect(f.criteria.find((c) => c.key === "cfo-positive")!.detail).toMatch(/not reported/);
    expect(f.flags.some((flag) => /understates rather than guesses/.test(flag))).toBe(true);
  });

  it("keeps the nine-point scale even when data is missing", () => {
    const f = piotroskiFScore(year({ end: "2025-12-31" }), year({ end: "2024-12-31" }));
    expect(f.criteria).toHaveLength(9);
    expect(f.score).toBe(0);
    expect(f.measured).toBe(0);
  });

  it("falls back on closing assets for the prior year, and says so", () => {
    const f = piotroskiFScore(CURRENT, PRIOR);
    expect(f.flags.some((flag) => /against its own closing assets/.test(flag))).toBe(true);
  });

  it("warns when a share-count jump looks like a corporate action", () => {
    // A two-for-one split doubles the count without a share being sold. The
    // criterion cannot tell them apart, so it loses the point and says why.
    const split = year({ ...CURRENT, shares: 200 });
    const f = piotroskiFScore(split, PRIOR, EARLIER);
    expect(f.criteria.find((c) => c.key === "dilution")!.point).toBe(0);
    expect(f.flags.some((flag) => /split or an acquisition/.test(flag))).toBe(true);
  });

  it("does not warn about ordinary dilution", () => {
    const drip = year({ ...CURRENT, shares: 103 });
    const f = piotroskiFScore(drip, PRIOR, EARLIER);
    expect(f.criteria.find((c) => c.key === "dilution")!.point).toBe(0);
    expect(f.flags.some((flag) => /split or an acquisition/.test(flag))).toBe(false);
  });

  it("notes when the share count was taken on a different date", () => {
    const covered = year({ ...CURRENT, sharesAsOf: "2026-02-13" });
    const detail = piotroskiFScore(covered, PRIOR, EARLIER).criteria.find((c) => c.key === "dilution")!.detail;
    expect(detail).toContain("2026-02-13");
  });
});

/* ----------------------------------------------------------------------------
 * The bankruptcy model
 * -------------------------------------------------------------------------- */

describe("altmanZScore", () => {
  const safe = year({
    assets: 1000,
    currentAssets: 400,
    currentLiabilities: 200,
    retainedEarnings: 300,
    ebit: 150,
    liabilities: 500,
    revenue: 900,
  });

  it("reproduces a hand-computed score", () => {
    // 1.2(0.2) + 1.4(0.3) + 3.3(0.15) + 0.6(2.4) + 1.0(0.9)
    //   = 0.24 + 0.42 + 0.495 + 1.44 + 0.9 = 3.495
    const z = altmanZScore(safe, 1200);
    expect(z.z).toBeCloseTo(3.495, 3);
    expect(z.zone).toBe("safe");
  });

  it("uses the author's own zone boundaries", () => {
    expect(Z_SAFE).toBe(2.99);
    expect(Z_DISTRESS).toBe(1.81);

    const grey = year({
      assets: 1000,
      currentAssets: 350,
      currentLiabilities: 200,
      retainedEarnings: 200,
      ebit: 80,
      liabilities: 600,
      revenue: 800,
    });
    // 0.18 + 0.28 + 0.264 + 0.9 + 0.8 = 2.424
    expect(altmanZScore(grey, 900).z).toBeCloseTo(2.424, 3);
    expect(altmanZScore(grey, 900).zone).toBe("grey");

    const broke = year({
      assets: 1000,
      currentAssets: 100,
      currentLiabilities: 400,
      retainedEarnings: -200,
      ebit: -50,
      liabilities: 900,
      revenue: 300,
    });
    // -0.36 - 0.28 - 0.165 + 0.0667 + 0.3 = -0.4383
    expect(altmanZScore(broke, 100).z).toBeCloseTo(-0.438, 2);
    expect(altmanZScore(broke, 100).zone).toBe("distress");
  });

  it("refuses a partial score rather than putting one on the same scale", () => {
    const z = altmanZScore(year({ ...safe, retainedEarnings: null }), 1200);
    expect(z.z).toBeNull();
    expect(z.zone).toBe("unmeasured");
    expect(z.flags[0]).toMatch(/could not be computed/);
  });

  it("needs a market value to compute the fourth ratio", () => {
    expect(altmanZScore(safe, null).zone).toBe("unmeasured");
  });
});

/* ----------------------------------------------------------------------------
 * The gate
 * -------------------------------------------------------------------------- */

describe("financialStrengthGate", () => {
  const thresholds = { fScoreFloor: 4, allowGreyZone: true, strengthGateRejects: true };
  const f = (score: number) => ({ score, measured: 9, criteria: [], flags: [] });
  const z = (zone: "safe" | "grey" | "distress") => ({
    z: 3,
    zone,
    parts: {
      workingCapitalToAssets: 0,
      retainedEarningsToAssets: 0,
      ebitToAssets: 0,
      equityValueToLiabilities: 0,
      salesToAssets: 0,
    },
    flags: [],
  });

  it("passes a solid balance sheet", () => {
    expect(financialStrengthGate(f(7), z("safe"), thresholds).pass).toBe(true);
  });

  it("fails a weak score", () => {
    const r = financialStrengthGate(f(3), z("safe"), thresholds);
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => /below the floor of 4/.test(x))).toBe(true);
  });

  it("fails the distress zone whatever the score", () => {
    expect(financialStrengthGate(f(9), z("distress"), thresholds).pass).toBe(false);
  });

  it("accepts the grey zone by default and rejects it when asked to", () => {
    expect(financialStrengthGate(f(7), z("grey"), thresholds).pass).toBe(true);
    expect(financialStrengthGate(f(7), z("grey"), { ...thresholds, allowGreyZone: false }).pass).toBe(false);
  });

  it("can flag instead of reject", () => {
    const r = financialStrengthGate(f(2), z("distress"), { ...thresholds, strengthGateRejects: false });
    expect(r.pass).toBe(true);
    expect(r.flaggedOnly).toBe(true);
  });

  it("does not treat unreadable statements as evidence of distress", () => {
    // A filer whose statements cannot be read has not been shown to be in
    // trouble; excluding them would quietly drop every foreign private issuer.
    const r = financialStrengthGate(null, null, thresholds);
    expect(r.pass).toBe(true);
    expect(r.reasons.every((x) => /did not run/.test(x))).toBe(true);
  });
});

describe("strengthScore", () => {
  const f = (score: number) => ({ score, measured: 9, criteria: [], flags: [] });
  const z = (zone: "safe" | "grey" | "distress") => ({
    z: 3,
    zone,
    parts: {
      workingCapitalToAssets: 0,
      retainedEarningsToAssets: 0,
      ebitToAssets: 0,
      equityValueToLiabilities: 0,
      salesToAssets: 0,
    },
    flags: [],
  });

  it("rises with the score and with solvency", () => {
    expect(strengthScore(f(9), z("safe"))).toBe(100);
    expect(strengthScore(f(0), z("distress"))).toBe(0);
    expect(strengthScore(f(6), z("safe"))!).toBeGreaterThan(strengthScore(f(6), z("grey"))!);
  });

  it("is null, not zero, when nothing could be measured", () => {
    // An unmeasured company must never be able to look like a weak one.
    expect(strengthScore(null, z("safe"))).toBeNull();
  });
});
