import { describe, expect, it } from "vitest";
import { buildClusters, scoreConviction, type ClusterOptions } from "../../lib/insider/clusters";
import type { InsiderOwner, InsiderTransactionRow } from "../../lib/db";

/* ============================================================================
 * From filed lines to a reading of conviction.
 *
 * The load-bearing test here is the joint filing: a purchase made once by two
 * people is one purchase, and counting it per filer would inflate the headline
 * dollar figure by exactly the factor that makes a cluster look impressive.
 * ========================================================================== */

const NOW = new Date("2026-08-31T00:00:00Z");

const OPTIONS: ClusterOptions = {
  lookbackDays: 60,
  minDollarValue: 100_000,
  minClusterInsiders: 1,
  requireOfficerOrDirector: false,
  discountPlannedPct: 50,
  now: NOW,
};

const owner = (over: Partial<InsiderOwner> = {}): InsiderOwner => ({
  cik: "0000000001",
  name: "SMITH JANE",
  isDirector: false,
  isOfficer: false,
  isTenPercentOwner: false,
  isOther: false,
  officerTitle: null,
  ...over,
});

const line = (over: Partial<InsiderTransactionRow> = {}): InsiderTransactionRow => ({
  accession: "0000000000-26-000001",
  line: 1,
  ticker: "ACME",
  issuerCik: 111,
  issuerName: "Acme Corp",
  period: "2026-08-20",
  filedDate: "2026-08-21",
  transactionDate: "2026-08-20",
  code: "P",
  acquiredDisposed: "A",
  shares: 1000,
  price: 200,
  sharesAfter: 5000,
  ownership: "D",
  planned: "no",
  owners: [owner()],
  flags: [],
  ...over,
});

describe("buildClusters", () => {
  it("totals genuine open-market purchases only", () => {
    const rows = [
      line({ line: 1, shares: 1000, price: 200 }),
      line({ line: 2, code: "A", shares: 500, price: 200 }), // a grant
      line({ line: 3, code: "M", shares: 400, price: 10 }), // an option exercise
      line({ line: 4, code: "S", acquiredDisposed: "D", shares: 300, price: 210 }),
    ];
    const { qualifying } = buildClusters(rows, OPTIONS);
    expect(qualifying).toHaveLength(1);
    expect(qualifying[0].totalBoughtUsd).toBe(200_000);
    expect(qualifying[0].buys).toHaveLength(1);
  });

  it("counts a jointly filed purchase once, not once per filer", () => {
    // The whole point: two reporting owners on one filing bought $200,000
    // between them, not $400,000 each.
    const joint = line({
      shares: 1000,
      price: 200,
      owners: [
        owner({ cik: "1", name: "CASCADE INVESTMENT, L.L.C.", isTenPercentOwner: true }),
        owner({ cik: "2", name: "GATES WILLIAM H III", isTenPercentOwner: true }),
      ],
    });
    const { qualifying } = buildClusters([joint], OPTIONS);
    expect(qualifying[0].totalBoughtUsd).toBe(200_000);
    // But both people did buy, which is a different question.
    expect(qualifying[0].distinctBuyers).toBe(2);
  });

  it("counts distinct buyers across separate filings", () => {
    const rows = [
      line({ accession: "a", owners: [owner({ cik: "1", name: "A" })] }),
      line({ accession: "b", owners: [owner({ cik: "2", name: "B" })] }),
      line({ accession: "c", owners: [owner({ cik: "1", name: "A" })] }),
    ];
    const { qualifying } = buildClusters(rows, OPTIONS);
    expect(qualifying[0].distinctBuyers).toBe(2);
    expect(qualifying[0].filings).toBe(3);
  });

  it("excludes an unpriced purchase from the total and says so", () => {
    const rows = [line({ line: 1 }), line({ line: 2, price: null })];
    const { qualifying } = buildClusters(rows, OPTIONS);
    expect(qualifying[0].totalBoughtUsd).toBe(200_000);
    expect(qualifying[0].unpricedBuys).toBe(1);
    expect(qualifying[0].flags.some((f) => /understates the buying/.test(f))).toBe(true);
  });

  it("records selling in the same window for the falsification check", () => {
    const rows = [
      line({ line: 1 }),
      line({ line: 2, code: "S", acquiredDisposed: "D", shares: 500, price: 210, owners: [owner({ cik: "9", name: "C" })] }),
    ];
    const { qualifying } = buildClusters(rows, OPTIONS);
    expect(qualifying[0].totalSoldUsd).toBe(105_000);
    expect(qualifying[0].distinctSellers).toBe(1);
    expect(qualifying[0].flags.some((f) => /also sold/.test(f))).toBe(true);
  });

  it("reads roles off the filing", () => {
    const rows = [
      line({ owners: [owner({ isOfficer: true, officerTitle: "Chief Financial Officer" })] }),
    ];
    const { qualifying } = buildClusters(rows, OPTIONS);
    expect(qualifying[0].anyOfficerOrDirector).toBe(true);
    expect(qualifying[0].anyChiefOfficer).toBe(true);
    expect(qualifying[0].buys[0].role).toBe("Chief Financial Officer");
  });

  it("separates companies", () => {
    const rows = [line({ ticker: "ACME" }), line({ ticker: "BETA", issuerName: "Beta Inc" })];
    const { qualifying } = buildClusters(rows, OPTIONS);
    expect(qualifying.map((c) => c.ticker).sort()).toEqual(["ACME", "BETA"]);
  });

  it("ignores a company with no purchases at all", () => {
    const rows = [line({ code: "S", acquiredDisposed: "D" })];
    expect(buildClusters(rows, OPTIONS).qualifying).toEqual([]);
    expect(buildClusters(rows, OPTIONS).rejected).toEqual([]);
  });
});

describe("the reader's buying thresholds", () => {
  const small = [line({ shares: 100, price: 200 })]; // $20,000

  it("rejects buying below the dollar floor, with the figures", () => {
    const { qualifying, rejected } = buildClusters(small, OPTIONS);
    expect(qualifying).toEqual([]);
    expect(rejected[0].reasons[0]).toContain("$20,000");
    expect(rejected[0].reasons[0]).toContain("$100,000");
  });

  it("accepts the same buying when the floor is lowered", () => {
    const { qualifying } = buildClusters(small, { ...OPTIONS, minDollarValue: 10_000 });
    expect(qualifying).toHaveLength(1);
  });

  it("can require a cluster rather than a single buyer", () => {
    const one = [line()];
    expect(buildClusters(one, OPTIONS).qualifying).toHaveLength(1);
    const strict = buildClusters(one, { ...OPTIONS, minClusterInsiders: 2 });
    expect(strict.qualifying).toEqual([]);
    expect(strict.rejected[0].reasons[0]).toMatch(/1 insider bought, below the 2 required/);
  });

  it("can require an officer or a director among the buyers", () => {
    const holder = [line({ owners: [owner({ isTenPercentOwner: true })] })];
    expect(buildClusters(holder, OPTIONS).qualifying).toHaveLength(1);
    const strict = buildClusters(holder, { ...OPTIONS, requireOfficerOrDirector: true });
    expect(strict.qualifying).toEqual([]);
    expect(strict.rejected[0].reasons[0]).toMatch(/No officer or director/);
  });
});

describe("scoreConviction", () => {
  const base = (over: Record<string, unknown> = {}) =>
    buildClusters([line({ ...(over as Partial<InsiderTransactionRow>) })], OPTIONS).qualifying[0] ??
    buildClusters([line({ ...(over as Partial<InsiderTransactionRow>) })], { ...OPTIONS, minDollarValue: 1 })
      .qualifying[0];

  it("rewards more dollars, with diminishing returns", () => {
    const small = base({ shares: 1000, price: 200 }); // 2x the floor
    const large = base({ shares: 10_000, price: 200 }); // 20x
    const huge = base({ shares: 100_000, price: 200 }); // 200x
    expect(large.convictionParts.dollars).toBeGreaterThan(small.convictionParts.dollars);
    // Ten times the threshold already reaches full marks, so a hundred times
    // cannot buy a higher reading.
    expect(huge.convictionParts.dollars).toBe(40);
    expect(large.convictionParts.dollars).toBe(40);
  });

  it("rewards a cluster more steeply than a single large buyer", () => {
    const solo = base({ shares: 10_000, price: 200 });
    const four = buildClusters(
      [1, 2, 3, 4].map((i) =>
        line({ accession: `a${i}`, shares: 250, price: 200, owners: [owner({ cik: String(i), name: `P${i}` })] }),
      ),
      OPTIONS,
    ).qualifying[0];
    expect(solo.convictionParts.cluster).toBe(10);
    expect(four.convictionParts.cluster).toBe(30);
  });

  it("discounts buying that was arranged in advance", () => {
    const discretionary = base({ shares: 1000, price: 200, planned: "no" });
    const planned = base({ shares: 1000, price: 200, planned: "yes" });
    expect(planned.convictionParts.dollars).toBeLessThan(discretionary.convictionParts.dollars);
    expect(planned.flags.some((f) => /pre-arranged trading plan/.test(f))).toBe(true);
  });

  it("does not discount a purchase with no affirmation either way", () => {
    // Absent is not a denial, but it is not an admission either.
    const unstated = base({ shares: 1000, price: 200, planned: "not-stated" });
    const denied = base({ shares: 1000, price: 200, planned: "no" });
    expect(unstated.convictionParts.dollars).toBe(denied.convictionParts.dollars);
  });

  it("rewards a recent purchase over an old one", () => {
    const fresh = base({ transactionDate: "2026-08-30" });
    const stale = base({ transactionDate: "2026-07-05" });
    expect(fresh.convictionParts.recency).toBeGreaterThan(stale.convictionParts.recency);
  });

  it("stays inside 0 to 100", () => {
    const maxed = buildClusters(
      [1, 2, 3, 4, 5].map((i) =>
        line({
          accession: `a${i}`,
          shares: 100_000,
          price: 500,
          transactionDate: "2026-08-31",
          owners: [owner({ cik: String(i), name: `P${i}`, isOfficer: true, officerTitle: "Chief Executive Officer" })],
        }),
      ),
      OPTIONS,
    ).qualifying[0];
    expect(maxed.conviction).toBeLessThanOrEqual(100);
    expect(maxed.conviction).toBeGreaterThan(90);
  });

  it("never returns a negative reading", () => {
    const bare = scoreConviction(
      {
        ticker: "X",
        issuerCik: 1,
        issuerName: "X",
        buys: [],
        totalBoughtUsd: 0,
        plannedBoughtUsd: 0,
        unpricedBuys: 0,
        distinctBuyers: 0,
        buyerNames: [],
        anyOfficerOrDirector: false,
        anyChiefOfficer: false,
        anyTenPercentOwner: false,
        firstBuy: "2026-01-01",
        lastBuy: "2026-01-01",
        filings: 0,
        totalSoldUsd: 0,
        distinctSellers: 0,
        flags: [],
      },
      OPTIONS,
      60,
    );
    expect(bare.conviction).toBeGreaterThanOrEqual(0);
  });
});
