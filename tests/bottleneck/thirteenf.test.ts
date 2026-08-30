import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildHoldings,
  cloneFlags,
  countInfoTableRows,
  diffHoldings,
  DOLLAR_CONVENTION_FROM,
  latestPerPeriod,
  parseInfoTable,
  pickInfoTableFile,
  REPORTING_THRESHOLD_USD,
  sizeToBalance,
  valueScale,
  type Holding,
  type RawHolding,
  type ThirteenFFiling,
} from "../../lib/bottleneck/thirteenf";
import type { EdgarFiling } from "../../lib/edgar";

/* ============================================================================
 * Ground truth: two frozen real 13F filings from the same manager, one in each
 * XML shape. Every number below was read off the filings by eye and is checked
 * here so a refactor cannot quietly change what the desk reports.
 * ========================================================================== */

const FIXTURES = path.join(__dirname, "..", "fixtures");
const fixture = (name: string) => fs.readFileSync(path.join(FIXTURES, name), "utf8");

const Q2_2026 = fixture("13f-situational-awareness-2026Q2.xml");
const Q3_2025 = fixture("13f-namespaced-2025Q3.xml");

/** Both filings post-date the dollar convention. */
const asDollars = (rows: RawHolding[]) => buildHoldings(rows, 1, new Map());

describe("value convention", () => {
  it("branches on 2023-01-03: thousands before, dollars on and after", () => {
    expect(DOLLAR_CONVENTION_FROM).toBe("2023-01-03");
    expect(valueScale("2022-12-31")).toBe(1000);
    expect(valueScale("2023-01-02")).toBe(1000);
    expect(valueScale("2023-01-03")).toBe(1);
    expect(valueScale("2026-08-14")).toBe(1);
  });

  it("a pre-2023 filing reads 1000x larger than the same numbers read as dollars", () => {
    const rows = parseInfoTable(Q2_2026);
    const dollars = buildHoldings(rows, 1, new Map());
    const thousands = buildHoldings(rows, 1000, new Map());
    expect(thousands.longUsd).toBe(dollars.longUsd * 1000);
  });
});

describe("parsing the information table", () => {
  it("reads the unprefixed shape: 26 rows, 23 long, 3 options", () => {
    const rows = parseInfoTable(Q2_2026);
    expect(rows).toHaveLength(26);
    expect(countInfoTableRows(Q2_2026)).toBe(26);
    const { long, options } = asDollars(rows);
    expect(long).toHaveLength(23);
    expect(options).toHaveLength(3);
  });

  it("reads the ns1-prefixed shape from the same filer with the same parser", () => {
    const rows = parseInfoTable(Q3_2025);
    expect(rows).toHaveLength(28);
    const { long, options } = asDollars(rows);
    expect(long).toHaveLength(19);
    expect(options).toHaveLength(9);
  });

  it("a prefix-blind parser would report zero holdings, silently", () => {
    // The failure this guards against: matching `<infoTable` literally.
    expect(Q3_2025.match(/<infoTable[\s>]/g)).toBeNull();
    expect(parseInfoTable(Q3_2025).length).toBeGreaterThan(0);
  });

  it("totals the disclosed book exactly as filed", () => {
    const { longUsd, optionsUsd } = asDollars(parseInfoTable(Q2_2026));
    expect(longUsd).toBe(20_169_035_068);
    expect(optionsUsd).toBe(73_257_160);
  });

  it("weights each long position against the long book only", () => {
    const { long } = asDollars(parseInfoTable(Q2_2026));
    const pct = (name: string) => long.find((h) => h.nameOfIssuer.startsWith(name))!.pctOfLong!;
    expect(pct("SANDISK")).toBeCloseTo(28.13, 2);
    expect(pct("MICRON")).toBeCloseTo(27.64, 2);
    expect(pct("BLOOM")).toBeCloseTo(9.41, 2);
    expect(pct("TAIWAN")).toBeCloseTo(6.27, 2);
    expect(pct("NEBIUS")).toBeCloseTo(6.11, 2);
    expect(long.reduce((s, h) => s + (h.pctOfLong ?? 0), 0)).toBeCloseTo(100, 6);
  });

  it("sorts holdings by value, largest first", () => {
    const { long } = asDollars(parseInfoTable(Q2_2026));
    expect(long[0].nameOfIssuer).toContain("SANDISK");
    for (let i = 1; i < long.length; i++) expect(long[i - 1].valueUsd).toBeGreaterThanOrEqual(long[i].valueUsd);
  });

  it("keeps options visible and out of the long weights", () => {
    const { options, long } = asDollars(parseInfoTable(Q2_2026));
    expect(options.map((o) => o.putCall)).toEqual(["Call", "Call", "Put"]);
    expect(options.every((o) => o.pctOfLong === null)).toBe(true);
    // Bloom Energy is held BOTH ways; the long line must not absorb the call.
    const bloomLong = long.find((h) => h.nameOfIssuer.startsWith("BLOOM"))!;
    expect(bloomLong.valueUsd).toBe(1_898_778_982);
    expect(options.find((o) => o.nameOfIssuer.startsWith("BLOOM"))!.valueUsd).toBe(44_133_660);
  });

  it("reads putCall as title case and treats plain stock as absent, not blank", () => {
    const rows = parseInfoTable(Q2_2026);
    expect(rows.filter((r) => r.putCall === null)).toHaveLength(23);
    expect(new Set(rows.map((r) => r.putCall))).toEqual(new Set([null, "Put", "Call"]));
  });

  it("trims the padding filers leave on titleOfClass", () => {
    expect(Q3_2025).toContain("COM NEW </ns1:titleOfClass>"); // padded at the source
    expect(parseInfoTable(Q3_2025).every((r) => r.titleOfClass === r.titleOfClass.trim())).toBe(true);
    expect(parseInfoTable(Q3_2025)[0].titleOfClass).toBe("COM NEW");
  });

  it("decodes XML entities in issuer names", () => {
    const rows = parseInfoTable(Q2_2026);
    expect(rows.some((r) => r.nameOfIssuer === "BABCOCK & WILCOX ENTERPRISES")).toBe(true);
  });

  it("reads share counts, type and voting authority", () => {
    const apld = parseInfoTable(Q2_2026).find((r) => r.cusip === "038169207")!;
    expect(apld.shares).toBe(15_384_616);
    expect(apld.shareType).toBe("SH");
    expect(apld.voting).toEqual({ sole: 15_384_616, shared: 0, none: 0 });
    expect(apld.investmentDiscretion).toBe("SOLE");
  });

  it("treats a literal otherManager of 0 as no other manager", () => {
    expect(Q3_2025).toContain("<ns1:otherManager>0</ns1:otherManager>");
    expect(parseInfoTable(Q3_2025).every((r) => r.otherManager === null)).toBe(true);
  });

  it("carries no FIGI column in either filing, so CUSIP resolution is required", () => {
    expect(parseInfoTable(Q2_2026).every((r) => r.figi === undefined)).toBe(true);
    expect(parseInfoTable(Q3_2025).every((r) => r.figi === undefined)).toBe(true);
  });

  it("returns nothing rather than throwing on a document that is not an information table", () => {
    expect(parseInfoTable("<html><body>not a filing</body></html>")).toEqual([]);
  });
});

describe("choosing the information-table document", () => {
  const index = JSON.parse(fixture("13f-filing-index.json")) as {
    directory: { item: { name: string; size: string | number }[] };
  };
  const files = index.directory.item.map((i) => ({ name: i.name, size: Number(i.size) || 0 }));

  it("finds the real filename, which is not the one the docs suggest", () => {
    expect(pickInfoTableFile(files)).toBe("form13fInfoTable.xml");
  });

  it("never falls back to primary_doc.xml, which on a 13F is an XSL cover page", () => {
    expect(pickInfoTableFile([{ name: "primary_doc.xml", size: 2115 }])).toBeNull();
    expect(
      pickInfoTableFile([
        { name: "primary_doc.xml", size: 2115 },
        { name: "xslForm13F_X02/primary_doc.xml", size: 900 },
      ]),
    ).toBeNull();
  });

  it("matches other agents' naming rather than one hardcoded filename", () => {
    expect(pickInfoTableFile([{ name: "SALP13FinfotableQ3.xml", size: 40_000 }])).toBe("SALP13FinfotableQ3.xml");
    expect(pickInfoTableFile([{ name: "information_table.xml", size: 40_000 }])).toBe("information_table.xml");
  });

  it("takes the bulky XML when nothing is named like an information table", () => {
    expect(
      pickInfoTableFile([
        { name: "primary_doc.xml", size: 2115 },
        { name: "holdings.xml", size: 88_000 },
        { name: "cover.xml", size: 400 },
      ]),
    ).toBe("holdings.xml");
  });
});

describe("picking which filings to read", () => {
  const f = (form: string, filingDate: string, reportDate: string, accessionNumber: string): EdgarFiling => ({
    form,
    filingDate,
    reportDate,
    accessionNumber,
    primaryDocument: "xslForm13F_X02/primary_doc.xml",
  });

  it("keeps one filing per period, newest period first", () => {
    const picked = latestPerPeriod([
      f("13F-HR", "2026-08-14", "2026-06-30", "a"),
      f("13F-HR", "2026-05-18", "2026-03-31", "b"),
      f("13F-HR", "2026-02-11", "2025-12-31", "c"),
    ]);
    expect(picked.map((x) => x.reportDate)).toEqual(["2026-06-30", "2026-03-31", "2025-12-31"]);
  });

  it("prefers an amendment over the original it supersedes", () => {
    const picked = latestPerPeriod([
      f("13F-HR/A", "2026-09-02", "2026-06-30", "amended"),
      f("13F-HR", "2026-08-14", "2026-06-30", "original"),
    ]);
    expect(picked).toHaveLength(1);
    expect(picked[0].accessionNumber).toBe("amended");
  });

  it("ignores 13F-NT, which is a notice carrying no holdings", () => {
    expect(latestPerPeriod([f("13F-NT", "2026-08-14", "2026-06-30", "n")])).toEqual([]);
  });

  it("ignores other forms and filings with no period", () => {
    expect(
      latestPerPeriod([f("SCHEDULE 13D", "2026-08-28", "", "d"), f("N-PX", "2026-08-28", "2026-06-30", "p")]),
    ).toEqual([]);
  });
});

describe("position changes between periods", () => {
  const hold = (cusip: string, shares: number, valueUsd: number, ticker: string | null = null): Holding => ({
    nameOfIssuer: `ISSUER ${cusip}`,
    titleOfClass: "COM",
    cusip,
    valueAsFiled: valueUsd,
    valueUsd,
    shares,
    shareType: "SH",
    putCall: null,
    investmentDiscretion: "SOLE",
    otherManager: null,
    voting: { sole: shares, shared: 0, none: 0 },
    ticker,
    resolvedBy: "openfigi",
    pctOfLong: null,
  });

  const diff = diffHoldings(
    [hold("A", 100, 1000), hold("B", 50, 500), hold("C", 10, 100), hold("D", 10, 250)],
    [hold("B", 80, 700), hold("C", 10, 90), hold("D", 10, 100), hold("E", 5, 60)],
  );
  const of = (cusip: string) => diff.find((d) => d.cusip === cusip)!;

  it("classifies each name by what actually traded", () => {
    expect(of("A").change).toBe("new");
    expect(of("B").change).toBe("decreased");
    expect(of("C").change).toBe("unchanged");
    expect(of("E").change).toBe("closed");
  });

  it("does not call a price move a trade", () => {
    // D held 10 shares in both periods; only its market value moved.
    expect(of("D").change).toBe("unchanged");
    expect(of("D").valueUsdNow).toBe(250);
    expect(of("D").valueUsdBefore).toBe(100);
  });

  it("reports the share delta and its percentage", () => {
    expect(of("B").sharesDelta).toBe(-30);
    expect(of("B").sharesDeltaPct).toBeCloseTo(-37.5, 6);
    expect(of("A").sharesDeltaPct).toBeNull();
    expect(of("E").sharesDeltaPct).toBeNull();
  });

  it("keeps a closed position visible rather than dropping it", () => {
    expect(of("E").sharesNow).toBe(0);
    expect(of("E").valueUsdBefore).toBe(60);
  });

  it("sums split lots of one issuer into a single line", () => {
    const merged = diffHoldings([hold("A", 60, 600), hold("A", 40, 400)], [hold("A", 100, 900)]);
    expect(merged).toHaveLength(1);
    expect(merged[0].sharesNow).toBe(100);
    expect(merged[0].change).toBe("unchanged");
  });

  it("orders new positions first and unchanged last", () => {
    expect(diff[0].change).toBe("new");
    expect(diff[diff.length - 1].change).toBe("unchanged");
  });
});

describe("sizing a book to a balance", () => {
  const long: Holding[] = [
    { pct: 50, ticker: "AAA" },
    { pct: 30, ticker: "BBB" },
    { pct: 20, ticker: null },
  ].map(({ pct, ticker }, i) => ({
    nameOfIssuer: `ISSUER ${i}`,
    titleOfClass: "COM",
    cusip: `C${i}`,
    valueAsFiled: pct,
    valueUsd: pct,
    shares: pct,
    shareType: "SH",
    putCall: null,
    investmentDiscretion: "SOLE",
    otherManager: null,
    voting: { sole: 0, shared: 0, none: 0 },
    ticker,
    resolvedBy: ticker ? "openfigi" : "unresolved",
    pctOfLong: pct,
  }));

  it("applies each weight to the balance", () => {
    const orders = sizeToBalance(long, 100_000, new Map([["AAA", 25]]));
    expect(orders[0].suggestedUsd).toBe(50_000);
    expect(orders[0].suggestedShares).toBe(2000);
    expect(orders.reduce((s, o) => s + o.suggestedUsd, 0)).toBeCloseTo(100_000, 6);
  });

  it("rounds share counts down — a proposal never over-buys", () => {
    expect(sizeToBalance(long, 1000, new Map([["AAA", 33]]))[0].suggestedShares).toBe(15); // 500/33 = 15.15
  });

  it("still proposes a dollar amount when no price is available", () => {
    const orders = sizeToBalance(long, 100_000, new Map());
    expect(orders[0].price).toBeNull();
    expect(orders[0].suggestedShares).toBeNull();
    expect(orders[0].suggestedUsd).toBe(50_000);
  });

  it("keeps an unresolved row in the proposal rather than silently skipping it", () => {
    const orders = sizeToBalance(long, 100_000, new Map());
    expect(orders).toHaveLength(3);
    expect(orders[2].ticker).toBeNull();
    expect(orders[2].suggestedUsd).toBe(20_000);
  });

  it("honours a minimum position size", () => {
    // Weights are 50 / 30 / 20; a 25% floor drops only the last.
    expect(sizeToBalance(long, 100_000, new Map(), 25).map((o) => o.pctOfLong)).toEqual([50, 30]);
    expect(sizeToBalance(long, 100_000, new Map(), 0)).toHaveLength(3);
  });

  it("never proposes shares of a symbol that is not US-listed", () => {
    const foreign: Holding[] = [{ ...long[0], ticker: "1B2", resolvedBy: "openfigi-foreign" }];
    const orders = sizeToBalance(foreign, 100_000, new Map([["1B2", 10]]));
    expect(orders[0].usListed).toBe(false);
    expect(orders[0].suggestedShares).toBeNull();
    expect(orders[0].price).toBeNull();
    // The weight is still real; only the order ticket is withheld.
    expect(orders[0].suggestedUsd).toBe(50_000);
  });
});

describe("what the clone discloses", () => {
  const filing = (over: Partial<ThirteenFFiling> = {}): ThirteenFFiling => ({
    cik: 2045724,
    filerName: "Situational Awareness LP",
    period: "2026-06-30",
    filedAt: "2026-08-14",
    accession: "0000935836-26-000418",
    form: "13F-HR",
    infoTableFile: "form13fInfoTable.xml",
    valueScale: 1,
    lagDays: 45,
    long: [],
    options: [],
    totals: {
      longUsd: 20_169_035_068,
      optionsUsd: 73_257_160,
      positions: 26,
      longPositions: 23,
      optionPositions: 3,
      unresolved: 0,
      foreignOnly: 0,
    },
    sourceUrl: "https://www.sec.gov/Archives/edgar/data/2045724/000093583626000418/form13fInfoTable.xml",
    ...over,
  });

  it("states the measured lag, not an assumed one", () => {
    const flags = cloneFlags(filing(), null);
    expect(flags[0]).toContain("2026-06-30");
    expect(flags[0]).toContain("45 days later");
  });

  it("always says a 13F is long US equity only", () => {
    expect(cloneFlags(filing(), null).some((f) => /Short positions, cash, bonds/.test(f))).toBe(true);
  });

  it("discloses the options overlay as a share of the book", () => {
    const flag = cloneFlags(filing(), null).find((f) => /option position/.test(f))!;
    expect(flag).toContain("3 option position(s)");
    expect(flag).toContain("0.36%"); // 73.26M against a 20.24B book
  });

  it("says nothing about options when the filing reports none", () => {
    const noOptions = filing({
      totals: { ...filing().totals, optionsUsd: 0, optionPositions: 0 },
    });
    expect(cloneFlags(noOptions, null).some((f) => /option position/.test(f))).toBe(false);
  });

  it("flags unresolved rows and says they still count", () => {
    const flag = cloneFlags(filing({ totals: { ...filing().totals, unresolved: 2 } }), null).find((f) =>
      /could not be matched/.test(f),
    )!;
    expect(flag).toContain("2 of 26");
    expect(flag).toContain("still counted in the totals");
  });

  it("says plainly when a row resolved only to a foreign venue", () => {
    const flag = cloneFlags(filing({ totals: { ...filing().totals, foreignOnly: 1 } }), null).find((f) =>
      /foreign venue symbol/.test(f),
    )!;
    expect(flag).toContain("not something to buy on a US exchange");
    expect(cloneFlags(filing(), null).some((f) => /foreign venue symbol/.test(f))).toBe(false);
  });

  it("names an amendment as superseding the original", () => {
    expect(cloneFlags(filing({ form: "13F-HR/A" }), null).some((f) => /amendment/.test(f))).toBe(true);
  });

  it("explains the thousands convention when it applied", () => {
    expect(cloneFlags(filing({ valueScale: 1000 }), null).some((f) => /thousands of dollars/.test(f))).toBe(true);
  });

  it("uses the $100M filing threshold to catch a book read in the wrong units", () => {
    const misread = filing({
      totals: { ...filing().totals, longUsd: 20_169_035, optionsUsd: 73_257 },
    });
    expect(REPORTING_THRESHOLD_USD).toBe(100_000_000);
    expect(cloneFlags(misread, null).some((f) => /wrong unit convention/.test(f))).toBe(true);
    // The real filing is three orders of magnitude clear of the threshold.
    expect(cloneFlags(filing(), null).some((f) => /wrong unit convention/.test(f))).toBe(false);
  });

  it("warns when two compared periods were filed under different conventions", () => {
    const flags = cloneFlags(filing(), filing({ valueScale: 1000, period: "2022-12-31" }));
    expect(flags.some((f) => /different value conventions/.test(f))).toBe(true);
  });
});
