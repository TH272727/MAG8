import { describe, expect, it } from "vitest";
import {
  auditExposure,
  exposureFlags,
  mergeDuplicates,
  parseHoldingsCsv,
  type PricedHolding,
} from "../../lib/bottleneck/exposure";
import type { Playbook } from "../../lib/bottleneck/playbook";
import type { BottleneckSnapshot, CategoryScore } from "../../lib/bottleneck/score";

/* ============================================================================
 * Module D is pure: holdings and prices in, exposure and flags out. Every case
 * below is one the audit has to get right for its percentages to mean anything.
 * ========================================================================== */

const playbook = {
  id: "test",
  label: "Test theme",
  blurb: "b",
  demand: { basket: ["X"], capexTags: ["T"], measure: "Capital spending", narrativeKeywords: [] },
  conversions: {
    version: "1",
    asOf: "2026-08",
    factors: [
      { key: "mw", unit: "MW of critical IT load", usdPer: 1, source: "s", asOf: "2026-08" },
      { key: "memory_gb", unit: "GB of memory", usdPer: 1, source: "s", asOf: "2026-08" },
      { key: "sqft", unit: "sq ft of shell", usdPer: 1, source: "s", asOf: "2026-08" },
    ],
  },
  supply: [],
  owners: [
    { category: "mw", label: "Power", tickers: ["VST", "CEG"], foreign: [] },
    { category: "memory_gb", label: "Memory", tickers: ["MU", "WDC"], foreign: [] },
    { category: "sqft", label: "Shells", tickers: ["DLR"], foreign: [] },
  ],
  builtIn: true,
} satisfies Playbook;

const category = (key: string, status: CategoryScore["status"], gapPct: number | null): CategoryScore => ({
  key,
  unit: key,
  demandUnits: 0,
  demandUsd: 0,
  demandGrowthPct: null,
  supplyGrowthPct: null,
  gapPct,
  status,
  gapChangePct: null,
  materialMove: false,
  series: [],
  owners: null,
  readout: "",
});

const bottleneck: BottleneckSnapshot = {
  playbookId: "test",
  playbookLabel: "Test theme",
  takenAt: "2026-08-30T00:00:00.000Z",
  demandTakenAt: "2026-08-30T00:00:00.000Z",
  conversionVersion: "1",
  placeholderFactors: false,
  categories: [
    category("mw", "tightening", 81.9),
    category("memory_gb", "tightening", 68.7),
    category("sqft", "insufficient-data", null),
  ],
  flags: [],
};

const priced = (ticker: string, valueUsd: number | null): PricedHolding => ({
  ticker,
  shares: 100,
  price: valueUsd === null ? null : valueUsd / 100,
  valueUsd,
});

const audit = (holdings: PricedHolding[], concentrationPct = 20) =>
  auditExposure({ playbook, holdings, bottleneck, settings: { concentrationPct } });

describe("reading pasted holdings", () => {
  it("reads a header row in any column order", () => {
    const { holdings, rejected } = parseHoldingsCsv("Shares,Symbol,Cost Basis\n120,MU,4000\n50,VST,900");
    expect(rejected).toEqual([]);
    expect(holdings).toEqual([
      { ticker: "MU", shares: 120, costBasis: 4000 },
      { ticker: "VST", shares: 50, costBasis: 900 },
    ]);
  });

  it("reads bare ticker/shares lines with no header at all", () => {
    expect(parseHoldingsCsv("MU, 120\nVST, 50").holdings).toEqual([
      { ticker: "MU", shares: 120 },
      { ticker: "VST", shares: 50 },
    ]);
  });

  it("accepts tabs and semicolons, and strips currency formatting", () => {
    const { holdings } = parseHoldingsCsv("ticker\tshares\tcost\nMU\t1,200\t$48,000.50");
    expect(holdings).toEqual([{ ticker: "MU", shares: 1200, costBasis: 48000.5 }]);
  });

  it("refuses a comma line that came apart on a thousands separator", () => {
    // A headerless comma line is TICKER, SHARES, COST — so "MU,1,200" is a
    // legitimate three-column row and cannot be second-guessed. What IS
    // detectable is a row wider than the format allows, and that is refused
    // rather than read as one share.
    const { holdings, rejected } = parseHoldingsCsv("MU,1,200,48000");
    expect(holdings).toEqual([]);
    expect(rejected[0].reason).toContain("put quotes around any number containing a comma");
  });

  it("reads a quoted thousands separator correctly", () => {
    expect(parseHoldingsCsv('MU,"1,200"').holdings).toEqual([{ ticker: "MU", shares: 1200 }]);
    expect(parseHoldingsCsv('Symbol,Shares\nMU,"1,200"').holdings).toEqual([{ ticker: "MU", shares: 1200 }]);
  });

  it("reports an unreadable line instead of dropping it", () => {
    // A portfolio silently missing its largest position produces confidently
    // wrong percentages, which is worse than refusing the line.
    const { holdings, rejected } = parseHoldingsCsv("MU,120\ntotal,,\nVST,not-a-number");
    expect(holdings).toHaveLength(1);
    expect(rejected.map((r) => r.reason)).toEqual(["no positive share count", "no positive share count"]);
  });

  it("merges two lots of the same name into one position", () => {
    const { holdings } = parseHoldingsCsv("MU,100,1000\nMU,50,700");
    expect(holdings).toEqual([{ ticker: "MU", shares: 150, costBasis: 1700 }]);
  });

  it("keeps a cost basis optional", () => {
    expect(mergeDuplicates([{ ticker: "MU", shares: 10 }])).toEqual([{ ticker: "MU", shares: 10 }]);
  });

  it("returns nothing for empty input", () => {
    expect(parseHoldingsCsv("   \n\n")).toEqual({ holdings: [], rejected: [] });
  });
});

describe("exposure by constrained input", () => {
  const report = audit([priced("MU", 30_000), priced("VST", 20_000), priced("AAPL", 50_000)]);

  it("totals the portfolio from priced positions only", () => {
    expect(report.portfolioValueUsd).toBe(100_000);
  });

  it("sums each category's holdings and weights them against the portfolio", () => {
    const mw = report.categories.find((c) => c.key === "mw")!;
    expect(mw.valueUsd).toBe(20_000);
    expect(mw.pctOfPortfolio).toBe(20);
    expect(mw.held.map((h) => h.ticker)).toEqual(["VST"]);
    expect(mw.notHeld).toEqual(["CEG"]);
  });

  it("orders categories by the desk's own ranking, not by exposure", () => {
    // MW is the tightest constraint even though memory is the larger position.
    expect(report.categories.map((c) => c.key)).toEqual(["mw", "memory_gb", "sqft"]);
  });

  it("reports what sits in nothing the desk tracks", () => {
    expect(report.unmappedUsd).toBe(50_000);
    expect(report.unmappedPct).toBe(50);
  });

  it("still lists a category the desk could not measure", () => {
    const sqft = report.categories.find((c) => c.key === "sqft")!;
    expect(sqft.status).toBe("insufficient-data");
    expect(sqft.pctOfPortfolio).toBe(0);
  });

  it("excludes an unpriced position from every percentage and names it", () => {
    const withUnpriced = audit([priced("MU", 50_000), priced("VST", 50_000), priced("XYZ", null)]);
    expect(withUnpriced.portfolioValueUsd).toBe(100_000);
    expect(withUnpriced.unpriced).toEqual(["XYZ"]);
    expect(withUnpriced.positions).toBe(3);
    expect(withUnpriced.flags.some((f) => /could not be priced/.test(f))).toBe(true);
  });

  it("does not divide by zero on an empty portfolio", () => {
    const empty = audit([]);
    expect(empty.portfolioValueUsd).toBe(0);
    expect(empty.categories.every((c) => c.pctOfPortfolio === 0)).toBe(true);
  });
});

describe("the two flags the audit exists to raise", () => {
  it("says when the tightest constraints have no exposure", () => {
    const flag = audit([priced("AAPL", 100_000)]).flags.find((f) => /No meaningful exposure/.test(f))!;
    expect(flag).toContain("MW of critical IT load");
    expect(flag).toContain("GB of memory");
    expect(flag).toContain("not a recommendation to change it");
  });

  it("stays quiet about a constraint that is covered", () => {
    const report = audit([priced("VST", 60_000), priced("MU", 40_000)]);
    expect(report.flags.some((f) => /No meaningful exposure/.test(f))).toBe(false);
  });

  it("flags concentration in one input's producers at the configured threshold", () => {
    const report = audit([priced("MU", 25_000), priced("AAPL", 75_000)], 20);
    const flag = report.flags.find((f) => /sits in producers of one input/.test(f))!;
    expect(flag).toContain("25%");
    expect(flag).toContain("MU");
  });

  it("respects a threshold change rather than hardcoding 20%", () => {
    expect(audit([priced("MU", 25_000), priced("AAPL", 75_000)], 30).flags.some((f) => /one input/.test(f))).toBe(
      false,
    );
  });

  it("always states the counter-evidence, whatever the exposure", () => {
    for (const holdings of [[], [priced("MU", 100_000)], [priced("AAPL", 100_000)]]) {
      expect(audit(holdings).flags.some((f) => /WORSE subsequent returns/.test(f))).toBe(true);
    }
  });

  it("is a pure function of its inputs", () => {
    expect(exposureFlags([], [], 20)).toHaveLength(1);
  });
});

describe("comparison against a cloned manager", () => {
  const report = auditExposure({
    playbook,
    holdings: [priced("MU", 40_000), priced("VST", 30_000), priced("AAPL", 30_000)],
    bottleneck,
    settings: { concentrationPct: 20 },
    manager: {
      filerName: "Situational Awareness LP",
      period: "2026-06-30",
      long: [
        { ticker: "MU", pctOfLong: 27.64 },
        { ticker: "SNDK", pctOfLong: 28.13 },
        { ticker: null, pctOfLong: 1.2 },
      ],
    },
  });

  it("splits into overlap and both directions of divergence", () => {
    expect(report.comparison!.both.map((r) => r.ticker)).toEqual(["MU"]);
    expect(report.comparison!.theirsOnly.map((r) => r.ticker)).toEqual(["SNDK"]);
    expect(report.comparison!.minesOnly.map((r) => r.ticker)).toEqual(["VST", "AAPL"]);
  });

  it("shows both weights side by side where they overlap", () => {
    expect(report.comparison!.both[0]).toEqual({ ticker: "MU", minePct: 40, theirsPct: 27.64 });
  });

  it("ignores the manager's unresolved rows rather than inventing a ticker for them", () => {
    const all = [...report.comparison!.both, ...report.comparison!.theirsOnly];
    expect(all.every((r) => r.ticker !== null && r.ticker !== "")).toBe(true);
  });

  it("omits the comparison entirely when no manager has been cloned", () => {
    expect(audit([priced("MU", 100)]).comparison).toBeNull();
  });
});

describe("with no reading from the desk yet", () => {
  it("still reports exposure, ranking the unmeasured categories by name order", () => {
    const report = auditExposure({
      playbook,
      holdings: [priced("MU", 100_000)],
      bottleneck: null,
      settings: { concentrationPct: 20 },
    });
    expect(report.portfolioValueUsd).toBe(100_000);
    expect(report.categories.every((c) => c.status === "insufficient-data")).toBe(true);
    // Nothing is "tightening", so the missing-exposure flag cannot fire.
    expect(report.flags.some((f) => /No meaningful exposure/.test(f))).toBe(false);
  });
});
