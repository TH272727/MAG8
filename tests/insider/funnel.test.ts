import { describe, expect, it } from "vitest";
import { buildClusters } from "../../lib/insider/clusters";
import { applyProfile, describeProfile, profileByKey, RISK_PROFILES } from "../../lib/insider/profiles";
import { composite, rankByComposite, WEIGHTING_PRESETS, weightsFrom } from "../../lib/insider/score";
import { assessCandidate, type AssessContext } from "../../lib/insider/scanner";
import { baselineInsiderSettings, type InsiderSettings } from "../../lib/insider-settings";
import type { FinancialYear } from "../../lib/insider/fundamentals";
import type { InsiderOwner, InsiderTransactionRow } from "../../lib/db";

/* ============================================================================
 * The whole funnel, end to end, on five synthetic companies whose fate is known
 * in advance — and then the same five run again under a different risk
 * tolerance, asserting that the surviving set actually changes.
 *
 * That second half is the point. Every individual threshold is already proven
 * to be a real argument by its own module's tests; this proves the tunability
 * survives being wired together, which is where it would quietly stop being
 * true.
 *
 * No database and no network: the assessment is a pure function of what it is
 * given, so the whole pipeline can be driven from fixtures.
 * ========================================================================== */

const AS_OF = "2026-08-28";
const DAY_MS = 86_400_000;

/* -- price shapes ----------------------------------------------------------- */

function series(anchors: [number, number][], days = 3 * 365) {
  const sorted = [...anchors].sort((a, b) => b[0] - a[0]);
  const priceAt = (t: number): number => {
    if (t >= sorted[0][0]) return sorted[0][1];
    if (t <= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
    for (let i = 0; i < sorted.length - 1; i++) {
      const [t0, p0] = sorted[i];
      const [t1, p1] = sorted[i + 1];
      if (t <= t0 && t >= t1) return p0 + ((p1 - p0) * (t0 - t)) / (t0 - t1);
    }
    return sorted[sorted.length - 1][1];
  };
  const end = Date.parse(`${AS_OF}T00:00:00Z`);
  const out: { date: string; close: number }[] = [];
  for (let t = days; t >= 0; t--) {
    const d = new Date(end - t * DAY_MS);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    out.push({ date: d.toISOString().slice(0, 10), close: Number(priceAt(t).toFixed(4)) });
  }
  return out;
}

/** Down 35% from a high four months ago, steadied. */
const CLEAN = series([[1095, 40], [121, 100], [120, 100], [20, 66], [10, 63], [0, 65]]);
/** Down 1% — barely moved, and steadied, so only the band can reject it. */
const FLAT = series([[1095, 60], [40, 100], [15, 98], [0, 99]]);
/** Down 92% over three years, only 20% inside its own year. */
const ANGEL = series([[1095, 100], [900, 100], [400, 10], [300, 10], [60, 8], [0, 8]]);
/** Still falling, faster. */
const KNIFE = series([[1095, 40], [120, 100], [112, 90], [56, 75], [0, 50]]);

/* -- statement shapes ------------------------------------------------------- */

const fy = (over: Partial<FinancialYear>): FinancialYear => ({
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

/** A sound, improving, cash-generating business. */
const SOUND: FinancialYear[] = [2022, 2023, 2024, 2025].map((y, i) =>
  fy({
    end: `${y}-12-31`,
    fy: y,
    netIncome: 60 + i * 25,
    revenue: 500 + i * 120,
    grossProfit: 200 + i * 60,
    costOfRevenue: 300 + i * 60,
    ebit: 90 + i * 30,
    ocf: 110 + i * 30,
    depreciation: 40,
    capex: 45,
    assets: 900 + i * 60,
    currentAssets: 300 + i * 40,
    currentLiabilities: 180,
    liabilities: 350,
    longTermDebt: 200 - i * 15,
    equity: 560 + i * 60,
    retainedEarnings: 260 + i * 60,
    shares: 10,
  }),
);

/** Losing money, heavily indebted, shrinking — a value trap. */
const TRAP: FinancialYear[] = [2022, 2023, 2024, 2025].map((y, i) =>
  fy({
    end: `${y}-12-31`,
    fy: y,
    netIncome: -40 - i * 20,
    revenue: 400 - i * 60,
    grossProfit: 80 - i * 20,
    costOfRevenue: 320 - i * 40,
    ebit: -50 - i * 20,
    ocf: -30 - i * 10,
    depreciation: 30,
    capex: 40,
    assets: 700,
    currentAssets: 120,
    currentLiabilities: 300 + i * 30,
    liabilities: 640 + i * 20,
    longTermDebt: 400 + i * 20,
    equity: 60 - i * 20,
    retainedEarnings: -300 - i * 40,
    shares: 10 + i * 3,
  }),
);

/* -- insider buying --------------------------------------------------------- */

const owner = (over: Partial<InsiderOwner> = {}): InsiderOwner => ({
  cik: "1",
  name: "BUYER ONE",
  isDirector: false,
  isOfficer: false,
  isTenPercentOwner: false,
  isOther: false,
  officerTitle: null,
  ...over,
});

const buy = (
  ticker: string,
  over: Partial<InsiderTransactionRow> = {},
): InsiderTransactionRow => ({
  accession: `${ticker}-1`,
  line: 1,
  ticker,
  issuerCik: 1,
  issuerName: `${ticker} Inc`,
  period: "2026-08-20",
  filedDate: "2026-08-21",
  transactionDate: "2026-08-20",
  code: "P",
  acquiredDisposed: "A",
  shares: 5000,
  price: 60,
  sharesAfter: 50_000,
  ownership: "D",
  planned: "no",
  owners: [owner({ isDirector: true })],
  flags: [],
  ...over,
});

/**
 * Five companies, each designed to stop at a known point:
 *
 *   GOOD   clean drawdown, sound business, cheap        → ranked
 *   MEH    barely fell                                  → fails the price band
 *   ANGEL  down 92% over three years                    → fails the fallen-angel guard
 *   KNIFE  still falling                                → fails stabilisation
 *   TRAP   right shape, dying business                  → fails the strength gate
 *   TINY   right shape, but only one small purchase     → never reaches the funnel
 */
const ROWS: InsiderTransactionRow[] = [
  buy("GOOD", { shares: 5000, price: 65, owners: [owner({ cik: "1", name: "A", isOfficer: true, officerTitle: "Chief Executive Officer" })] }),
  buy("GOOD", { accession: "GOOD-2", shares: 4000, price: 64, owners: [owner({ cik: "2", name: "B", isDirector: true })] }),
  buy("MEH", { shares: 4000, price: 99 }),
  buy("ANGEL", { shares: 40_000, price: 8 }),
  buy("KNIFE", { shares: 8000, price: 50 }),
  buy("TRAP", { shares: 5000, price: 65 }),
  buy("TINY", { shares: 100, price: 65 }),
];

const context = (): AssessContext => ({
  caps: new Map([
    ["GOOD", 900],
    ["MEH", 900],
    ["ANGEL", 80],
    ["KNIFE", 500],
    ["TRAP", 90],
    ["TINY", 900],
  ]),
  coverage: new Map(),
  financials: new Map([
    ["GOOD", { years: SOUND, entityName: "Good Corp", flags: [] }],
    ["MEH", { years: SOUND, entityName: "Meh Corp", flags: [] }],
    ["ANGEL", { years: SOUND, entityName: "Angel Corp", flags: [] }],
    ["KNIFE", { years: SOUND, entityName: "Knife Corp", flags: [] }],
    ["TRAP", { years: TRAP, entityName: "Trap Corp", flags: [] }],
    ["TINY", { years: SOUND, entityName: "Tiny Corp", flags: [] }],
  ]),
  closes: new Map([
    ["GOOD", { closes: CLEAN, mixedBasis: false }],
    ["MEH", { closes: FLAT, mixedBasis: false }],
    ["ANGEL", { closes: ANGEL, mixedBasis: false }],
    ["KNIFE", { closes: KNIFE, mixedBasis: false }],
    ["TRAP", { closes: CLEAN, mixedBasis: false }],
    ["TINY", { closes: CLEAN, mixedBasis: false }],
  ]),
});

function run(settings: InsiderSettings) {
  const { qualifying, rejected } = buildClusters(ROWS, {
    lookbackDays: settings.lookbackDays,
    minDollarValue: settings.minDollarValue,
    minClusterInsiders: settings.minClusterInsiders,
    requireOfficerOrDirector: settings.requireOfficerOrDirector,
    discountPlannedPct: settings.discountPlannedPct,
    now: new Date("2026-08-31T00:00:00Z"),
  });
  const ctx = context();
  const assessed = qualifying.map((c) => assessCandidate(c, settings, ctx));
  return {
    ranked: rankByComposite(assessed.filter((c) => c.stage === "ranked")),
    stopped: assessed.filter((c) => c.stage !== "ranked"),
    belowThreshold: rejected.map((r) => r.cluster.ticker),
    byTicker: new Map(assessed.map((c) => [c.ticker, c])),
  };
}

const BALANCED = applyProfile(baselineInsiderSettings(), profileByKey("balanced"));

describe("the funnel, under the balanced settings", () => {
  const r = run(BALANCED);

  it("passes exactly the company designed to pass", () => {
    expect(r.ranked.map((c) => c.ticker)).toEqual(["GOOD"]);
  });

  it("stops each of the others at the stage it was built to fail", () => {
    expect(r.byTicker.get("MEH")!.stage).toBe("price");
    expect(r.byTicker.get("ANGEL")!.stage).toBe("price");
    expect(r.byTicker.get("KNIFE")!.stage).toBe("price");
    expect(r.byTicker.get("TRAP")!.stage).toBe("strength");
  });

  it("never reaches the funnel with buying below the reader's floor", () => {
    // $6,500 against a $100,000 floor.
    expect(r.belowThreshold).toContain("TINY");
    expect(r.byTicker.has("TINY")).toBe(false);
  });

  it("names the specific check each company failed", () => {
    expect(r.byTicker.get("MEH")!.stopped.join(" ")).toMatch(/drawdown band/);
    expect(r.byTicker.get("ANGEL")!.stopped.join(" ")).toMatch(/three years/);
    expect(r.byTicker.get("KNIFE")!.stopped.join(" ")).toMatch(/steadied/);
    expect(r.byTicker.get("TRAP")!.stopped.join(" ")).toMatch(/distress zone|below the floor/);
  });

  it("carries every intermediate figure through, not just the score", () => {
    const good = r.ranked[0];
    expect(good.drawdown!.pctOff52wHigh).toBeCloseTo(35, 0);
    expect(good.fScore!.criteria).toHaveLength(9);
    expect(good.altman!.zone).toBe("safe");
    expect(good.dcf!.perShareLow).not.toBeNull();
    expect(good.cluster.distinctBuyers).toBe(2);
    expect(good.quality!.yearsMeasured).toBe(3);
  });

  it("scores the survivor on all four components", () => {
    const good = r.ranked[0];
    expect(good.composite.complete).toBe(true);
    expect(good.composite.measured).toBe(4);
    expect(good.composite.score).toBeGreaterThan(0);
    expect(good.composite.score).toBeLessThanOrEqual(100);
  });
});

describe("the same five companies, under a different risk tolerance", () => {
  it("admits falling knives when the reader asks for them", () => {
    const aggressive = applyProfile(baselineInsiderSettings(), profileByKey("aggressive"));
    const r = run(aggressive);
    // The guard is off and stabilisation is not required, so the two the
    // balanced settings excluded on those grounds now come through.
    expect(r.ranked.map((c) => c.ticker)).toContain("KNIFE");
    expect(r.ranked.map((c) => c.ticker)).toContain("ANGEL");
  });

  it("narrows to almost nothing when the reader is conservative", () => {
    const conservative = applyProfile(baselineInsiderSettings(), profileByKey("conservative"));
    const r = run(conservative);
    // A 5-25% band excludes a 35% fall, so even the sound company goes.
    expect(r.ranked).toEqual([]);
    expect(r.byTicker.get("GOOD")!.stage).toBe("price");
  });

  it("produces a genuinely different surviving set, not just a different order", () => {
    const balanced = new Set(run(BALANCED).ranked.map((c) => c.ticker));
    const aggressive = new Set(
      run(applyProfile(baselineInsiderSettings(), profileByKey("aggressive"))).ranked.map((c) => c.ticker),
    );
    expect(aggressive).not.toEqual(balanced);
    expect(aggressive.size).toBeGreaterThan(balanced.size);
  });

  it("changes the reasons, not only the verdicts", () => {
    const tight = run({ ...BALANCED, maxDrawdownPct: 30 });
    expect(tight.byTicker.get("GOOD")!.stage).toBe("price");
    expect(tight.byTicker.get("GOOD")!.stopped.join(" ")).toContain("2.0% to 30.0%");
  });

  it("re-values the same company when the discount rate moves", () => {
    const cheapMoney = run({ ...BALANCED, discountRatePct: 6 });
    const dearMoney = run({ ...BALANCED, discountRatePct: 14 });
    const a = cheapMoney.byTicker.get("GOOD")!.dcf!.perShareLow!;
    const b = dearMoney.byTicker.get("GOOD")!.dcf!.perShareLow!;
    expect(a).toBeGreaterThan(b);
  });

  it("changes what counts as a big enough cushion", () => {
    const lenient = run({ ...BALANCED, minMarginOfSafetyPct: 5 });
    const strict = run({ ...BALANCED, minMarginOfSafetyPct: 60 });
    const a = lenient.byTicker.get("GOOD")!.composite.contributions.value!;
    const b = strict.byTicker.get("GOOD")!.composite.contributions.value!;
    expect(a).toBeGreaterThan(b);
  });
});

describe("the composite", () => {
  const weights = weightsFrom(BALANCED);

  it("averages the components it can measure", () => {
    const r = composite({ insider: 80, setup: 60, strength: 40, value: 20 }, weights);
    expect(r.score).toBe(50);
    expect(r.complete).toBe(true);
  });

  it("renormalises rather than treating a missing component as zero", () => {
    const r = composite({ insider: 80, setup: 60, strength: null, value: null }, weights);
    expect(r.score).toBe(70);
    expect(r.measured).toBe(2);
    expect(r.missing).toEqual(["strength", "value"]);
    expect(r.complete).toBe(false);
  });

  it("does not count a component the reader switched off as missing", () => {
    const r = composite({ insider: 80, setup: 60, strength: 40, value: null }, { ...weights, value: 0 });
    expect(r.complete).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.score).toBe(60);
  });

  it("applies a preset weighting", () => {
    const insiderLed = composite({ insider: 100, setup: 0, strength: 0, value: 0 }, WEIGHTING_PRESETS["insider-weighted"]);
    const valueLed = composite({ insider: 100, setup: 0, strength: 0, value: 0 }, WEIGHTING_PRESETS["value-weighted"]);
    expect(insiderLed.score!).toBeGreaterThan(valueLed.score!);
  });

  it("ranks every partly measured company below every complete one", () => {
    // Otherwise a company scored on two components outranks one scored on four
    // purely by having fewer ways to disappoint.
    const rows = [
      { ticker: "PARTIAL", composite: composite({ insider: 99, setup: 99, strength: null, value: null }, weights) },
      { ticker: "WHOLE", composite: composite({ insider: 50, setup: 50, strength: 50, value: 50 }, weights) },
    ];
    expect(rankByComposite(rows).map((r) => r.ticker)).toEqual(["WHOLE", "PARTIAL"]);
  });
});

describe("risk profiles", () => {
  it("offers the house setting plus three named departures", () => {
    expect(RISK_PROFILES.map((p) => p.key)).toEqual(["house", "conservative", "balanced", "aggressive"]);
  });

  it("leaves the house setting exactly as configured", () => {
    const house = baselineInsiderSettings();
    expect(applyProfile(house, profileByKey("house"))).toEqual(house);
  });

  it("falls back to the house setting for an unknown name", () => {
    expect(profileByKey("nonsense").key).toBe("house");
    expect(profileByKey(null).key).toBe("house");
  });

  it("never touches an operational knob", () => {
    const operational = ["maxCandidates", "priceHistoryYears", "fetchTimeoutMs", "lookbackDays"];
    for (const p of RISK_PROFILES) {
      for (const key of operational) expect(p.overrides).not.toHaveProperty(key);
    }
  });

  it("can say what it changed, so nothing is applied silently", () => {
    const changes = describeProfile(baselineInsiderSettings(), profileByKey("conservative"));
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.join(" ")).toMatch(/maxDrawdownPct: 60 → 25/);
  });
});
