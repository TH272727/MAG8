import { describe, expect, it } from "vitest";
import {
  buffettQualitySnapshot,
  computeOwnerEarnings,
  intrinsicValuePerShare,
  marginOfSafety,
  projectOwnerEarnings,
  valueCompany,
  valueScore,
} from "../../lib/insider/dcf";
import type { FinancialYear } from "../../lib/insider/fundamentals";

/* ============================================================================
 * The valuation, checked against arithmetic worked out independently rather
 * than against whatever the code happens to produce.
 *
 * Two tiny companies with fabricated but internally consistent statements. The
 * first is flat, so its discounted value can be computed by hand as an annuity
 * plus a perpetuity; the second grows at a known rate, so the haircut and the
 * cap can be checked separately from the discounting.
 * ========================================================================== */

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

/**
 * A flat company. Net income 100, depreciation 50, capital spending 80, and a
 * working capital that never moves, so:
 *
 *   total capital spending   100 + 50 − 80 − 0 =  70
 *   maintenance approximation 100 + 50 − 50 − 0 = 100
 */
const FLAT: FinancialYear[] = [2022, 2023, 2024, 2025].map((y) =>
  year({
    end: `${y}-12-31`,
    fy: y,
    netIncome: 100,
    depreciation: 50,
    capex: 80,
    currentAssets: 300,
    currentLiabilities: 200,
    equity: 500,
    liabilities: 250,
    shares: 10,
  }),
);

const ASSUMPTIONS = {
  years: 10,
  growthHaircut: 0.7,
  maxGrowthRate: 0.15,
  discountRate: 0.09,
  terminalGrowth: 0.025,
};

describe("computeOwnerEarnings", () => {
  it("computes the conservative bound as filed", () => {
    const oe = computeOwnerEarnings(FLAT, "total");
    expect(oe.map((o) => o.value)).toEqual([null, 70, 70, 70]);
  });

  it("computes the maintenance bound higher, as it must be", () => {
    // Only the part of capital spending that depreciation implies is deducted.
    const oe = computeOwnerEarnings(FLAT, "maintenance");
    expect(oe.map((o) => o.value)).toEqual([null, 100, 100, 100]);
  });

  it("leaves the first year uncomputed rather than assuming no working-capital move", () => {
    const first = computeOwnerEarnings(FLAT, "total")[0];
    expect(first.value).toBeNull();
    expect(first.missing).toContain("the previous year's working capital");
  });

  it("charges an increase in working capital against the year", () => {
    const growing = [
      year({ end: "2024-12-31", netIncome: 100, depreciation: 50, capex: 80, currentAssets: 300, currentLiabilities: 200 }),
      year({ end: "2025-12-31", netIncome: 100, depreciation: 50, capex: 80, currentAssets: 340, currentLiabilities: 200 }),
    ];
    // Working capital rose 40, which is cash the business no longer has.
    expect(computeOwnerEarnings(growing, "total")[1].value).toBe(30);
  });

  it("names every missing input rather than returning zero", () => {
    const thin = [year({ end: "2024-12-31", currentAssets: 10, currentLiabilities: 5 }), year({ end: "2025-12-31", currentAssets: 10, currentLiabilities: 5 })];
    const oe = computeOwnerEarnings(thin, "total")[1];
    expect(oe.value).toBeNull();
    expect(oe.missing).toEqual(["net income", "depreciation and amortisation", "capital expenditure"]);
  });

  it("deducts full capital spending when it is below depreciation, under either method", () => {
    const light = [
      year({ end: "2024-12-31", netIncome: 100, depreciation: 50, capex: 20, currentAssets: 300, currentLiabilities: 200 }),
      year({ end: "2025-12-31", netIncome: 100, depreciation: 50, capex: 20, currentAssets: 300, currentLiabilities: 200 }),
    ];
    expect(computeOwnerEarnings(light, "total")[1].value).toBe(130);
    expect(computeOwnerEarnings(light, "maintenance")[1].value).toBe(130);
  });
});

describe("projectOwnerEarnings", () => {
  it("carries a flat history forward flat", () => {
    const p = projectOwnerEarnings(computeOwnerEarnings(FLAT, "total"), ASSUMPTIONS);
    expect(p.historicalRate).toBeCloseTo(0, 10);
    expect(p.growthRate).toBeCloseTo(0, 10);
    expect(p.values).toHaveLength(10);
    expect(p.values!.every((v) => Math.abs(v - 70) < 1e-9)).toBe(true);
  });

  it("applies the haircut to an observed rate", () => {
    // 48.2253 → 100 over four steps is 20% a year; 70% of that is 14%.
    const history = [48.2253, 57.87036, 69.444432, 83.3333184, 100].map((v, i) => ({
      end: `${2021 + i}-12-31`,
      value: v,
      netIncome: null,
      depreciation: null,
      capex: null,
      workingCapitalChange: null,
      missing: [],
    }));
    const p = projectOwnerEarnings(history, ASSUMPTIONS);
    expect(p.historicalRate).toBeCloseTo(0.2, 4);
    expect(p.growthRate).toBeCloseTo(0.14, 4);
    // The base stays the most recent year: a genuinely growing business should
    // not be anchored at where it was three years ago.
    expect(p.base).toBeCloseTo(100, 6);
    expect(p.values![0]).toBeCloseTo(114, 4);
  });

  it("caps a rate the haircut leaves too high, and says it capped it", () => {
    const explosive = [10, 100].map((v, i) => ({
      end: `${2024 + i}-12-31`,
      value: v,
      netIncome: null,
      depreciation: null,
      capex: null,
      workingCapitalChange: null,
      missing: [],
    }));
    const p = projectOwnerEarnings(explosive, ASSUMPTIONS);
    // 900% a year, cut to 630%, then capped at 15%.
    expect(p.historicalRate).toBeCloseTo(9, 6);
    expect(p.growthRate).toBeCloseTo(0.15, 10);
    expect(p.notes.some((n) => /the cap/.test(n))).toBe(true);
  });

  it("refuses to compound a negative base", () => {
    const losing = [{ end: "2025-12-31", value: -40, netIncome: null, depreciation: null, capex: null, workingCapitalChange: null, missing: [] }];
    const p = projectOwnerEarnings(losing, ASSUMPTIONS);
    expect(p.values).toBeNull();
    expect(p.notes[0]).toMatch(/nothing to compound/);
  });

  it("falls back to the middle year when working capital decided the last one", () => {
    // Harley-Davidson's shape: four positive years, then current liabilities
    // fall by nearly a billion and owner earnings read −$1,132M — a movement
    // larger than the whole operating result of $357M. Anchored on that year
    // there is no valuation at all; the middle year gives one, and says so.
    const hog = [
      { v: 1351, ni: 650, da: 165, capex: 120, wc: -656 },
      { v: 732, ni: 741, da: 152, capex: 152, wc: 9 },
      { v: 95, ni: 707, da: 158, capex: 207, wc: 563 },
      { v: 760, ni: 455, da: 161, capex: 197, wc: -341 },
      { v: -1132, ni: 339, da: 172, capex: 154, wc: 1489 },
    ].map((r, i) => ({
      end: `${2021 + i}-12-31`,
      value: r.v,
      netIncome: r.ni,
      depreciation: r.da,
      capex: r.capex,
      workingCapitalChange: r.wc,
      missing: [],
    }));

    const p = projectOwnerEarnings(hog, ASSUMPTIONS);
    expect(p.latest).toBe(-1132);
    expect(p.base).toBe(732);
    expect(p.values).not.toBeNull();
    expect(p.notes.some((n) => /decided by a movement in working capital/.test(n))).toBe(true);
    // And nothing became NaN on the way: a negative endpoint raised to a
    // fractional power would flow out the other side as a NaN price.
    expect(p.values!.every((x) => Number.isFinite(x))).toBe(true);
    expect(p.growthRate).toBe(0);
  });

  it("keeps the latest year when the business, not the balance sheet, produced it", () => {
    // Somnigroup's shape: rising owner earnings, with the working-capital term
    // smaller than the operating result throughout. Using a median here would
    // value a growing company at roughly half what it earns.
    const rising = [
      { v: 447, ni: 625, da: 175, capex: 123, wc: 230 },
      { v: 338, ni: 456, da: 180, capex: 307, wc: -9 },
      { v: 385, ni: 368, da: 183, capex: 185, wc: -19 },
      { v: 578, ni: 384, da: 202, capex: 97, wc: -89 },
      { v: 884, ni: 384, da: 291, capex: 167, wc: -376 },
    ].map((r, i) => ({
      end: `${2021 + i}-12-31`,
      value: r.v,
      netIncome: r.ni,
      depreciation: r.da,
      capex: r.capex,
      workingCapitalChange: r.wc,
      missing: [],
    }));
    const p = projectOwnerEarnings(rising, ASSUMPTIONS);
    expect(p.base).toBe(884);
    expect(p.notes.some((n) => /decided by a movement in working capital/.test(n))).toBe(false);
  });

  it("still refuses when the base year itself is negative", () => {
    const losing = [-60, -100].map((v, i) => ({
      end: `${2024 + i}-12-31`,
      value: v,
      netIncome: null,
      depreciation: null,
      capex: null,
      workingCapitalChange: null,
      missing: [],
    }));
    expect(projectOwnerEarnings(losing, ASSUMPTIONS).values).toBeNull();
  });

  it("assumes no growth rather than inventing one from a negative first year", () => {
    const history = [-20, 100].map((v, i) => ({
      end: `${2024 + i}-12-31`,
      value: v,
      netIncome: null,
      depreciation: null,
      capex: null,
      workingCapitalChange: null,
      missing: [],
    }));
    const p = projectOwnerEarnings(history, ASSUMPTIONS);
    expect(p.growthRate).toBe(0);
    expect(p.notes.some((n) => /cannot be taken from this history/.test(n))).toBe(true);
  });
});

describe("intrinsicValuePerShare", () => {
  it("matches an independently calculated two-stage discounting", () => {
    // Ten years of 70 discounted at 9%          = 449.2360390811
    // Perpetuity 70 × 1.025 / (0.09 − 0.025)    = 1103.8461538462
    //   discounted back ten years                = 466.2765445349
    // Enterprise value                           = 915.5125836160
    const v = intrinsicValuePerShare(Array(10).fill(70), {
      discountRate: 0.09,
      terminalGrowth: 0.025,
      sharesOutstanding: 10,
    });
    expect(v.enterpriseValue).toBeCloseTo(915.5125836, 6);
    expect(v.perShare).toBeCloseTo(91.55125836, 7);
    expect(v.terminalShare).toBeCloseTo(0.5093065381, 8);
  });

  it("refuses a perpetuity that does not converge", () => {
    const v = intrinsicValuePerShare([70], { discountRate: 0.02, terminalGrowth: 0.025, sharesOutstanding: 10 });
    expect(v.enterpriseValue).toBeNull();
    expect(v.notes[0]).toMatch(/does not converge/);
  });

  it("gives a whole-business value when the share count is unknown", () => {
    const v = intrinsicValuePerShare(Array(10).fill(70), {
      discountRate: 0.09,
      terminalGrowth: 0.025,
      sharesOutstanding: null,
    });
    expect(v.enterpriseValue).toBeCloseTo(915.5125836, 6);
    expect(v.perShare).toBeNull();
    expect(v.notes[0]).toMatch(/cannot be expressed per share/);
  });

  it("moves the answer the way a different discount rate should", () => {
    const cheap = intrinsicValuePerShare(Array(10).fill(70), { discountRate: 0.07, terminalGrowth: 0.025, sharesOutstanding: 10 });
    const dear = intrinsicValuePerShare(Array(10).fill(70), { discountRate: 0.12, terminalGrowth: 0.025, sharesOutstanding: 10 });
    expect(cheap.perShare!).toBeGreaterThan(dear.perShare!);
  });
});

describe("marginOfSafety", () => {
  it("is the gap as a share of the estimate", () => {
    expect(marginOfSafety(100, 75)).toBeCloseTo(0.25, 10);
    expect(marginOfSafety(91.55125836, 50)).toBeCloseTo(0.4538578618, 8);
  });

  it("is negative when the price is above the estimate", () => {
    expect(marginOfSafety(100, 120)).toBeCloseTo(-0.2, 10);
  });

  it("is null rather than misleading when there is no estimate", () => {
    expect(marginOfSafety(null, 50)).toBeNull();
    expect(marginOfSafety(0, 50)).toBeNull();
    expect(marginOfSafety(100, null)).toBeNull();
  });
});

describe("valueCompany", () => {
  it("returns both bounds, with the conservative one lower", () => {
    const r = valueCompany(FLAT, 50, 10, ASSUMPTIONS);
    expect(r.perShareLow).toBeCloseTo(91.55125836, 6);
    expect(r.perShareHigh!).toBeGreaterThan(r.perShareLow!);
    // 100/70 of the conservative figure.
    expect(r.perShareHigh).toBeCloseTo(91.55125836 * (100 / 70), 6);
  });

  it("ranks on the conservative bound", () => {
    const r = valueCompany(FLAT, 50, 10, ASSUMPTIONS);
    expect(r.marginOfSafetyLow).toBeCloseTo(0.4538578618, 8);
    expect(r.marginOfSafetyHigh!).toBeGreaterThan(r.marginOfSafetyLow!);
  });

  it("flags a wide gap between the two capital-spending assumptions", () => {
    // Capital spending far above depreciation: nearly all of the value then
    // depends on how much of it is maintaining the business.
    const heavy = FLAT.map((y) => ({ ...y, capex: 145 }));
    const r = valueCompany(heavy, 50, 10, ASSUMPTIONS);
    expect(r.spreadPct!).toBeGreaterThan(100);
    expect(r.flags.some((f) => /apart/.test(f))).toBe(true);
  });

  it("flags a valuation that is mostly perpetuity", () => {
    const r = valueCompany(FLAT, 50, 10, { ...ASSUMPTIONS, years: 5, terminalGrowth: 0.04 });
    expect(r.flags.some((f) => /sits in the perpetuity/.test(f))).toBe(true);
  });

  it("gives no value at all for a business consuming cash, and says why", () => {
    const losing = FLAT.map((y) => ({ ...y, netIncome: -200 }));
    const r = valueCompany(losing, 50, 10, ASSUMPTIONS);
    expect(r.perShareLow).toBeNull();
    expect(r.marginOfSafetyLow).toBeNull();
    expect(r.flags.some((f) => /nothing to compound/.test(f))).toBe(true);
  });
});

describe("buffettQualitySnapshot", () => {
  it("summarises the history behind the estimate", () => {
    const q = buffettQualitySnapshot(FLAT, computeOwnerEarnings(FLAT, "total"));
    expect(q.yearsMeasured).toBe(3);
    expect(q.positiveShare).toBe(1);
    expect(q.growingShare).toBe(0); // flat, so nothing grew
    expect(q.averageRoe).toBeCloseTo(0.2, 10); // 100 / 500
    expect(q.leverage).toBeCloseTo(0.5, 10); // 250 / 500
  });

  it("reports nothing rather than zero when it cannot be computed", () => {
    const q = buffettQualitySnapshot([year({})], computeOwnerEarnings([year({})], "total"));
    expect(q.yearsMeasured).toBe(0);
    expect(q.positiveShare).toBeNull();
    expect(q.averageRoe).toBeNull();
    expect(q.leverage).toBeNull();
  });
});

describe("valueScore", () => {
  it("scores meeting the required cushion at seventy", () => {
    expect(valueScore(0.25, 0.25)).toBe(70);
  });

  it("scores a price above the estimate at zero, not below it", () => {
    expect(valueScore(-0.5, 0.25)).toBe(0);
  });

  it("caps at a hundred", () => {
    expect(valueScore(5, 0.25)).toBe(100);
  });

  it("is null, not zero, for a company that could not be valued", () => {
    expect(valueScore(null, 0.25)).toBeNull();
  });

  it("moves with the reader's own requirement", () => {
    // The same 25% cushion is worth more to somebody who only asked for 10%.
    expect(valueScore(0.25, 0.1)!).toBeGreaterThan(valueScore(0.25, 0.4)!);
  });
});
