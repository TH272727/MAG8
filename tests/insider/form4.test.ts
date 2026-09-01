import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  dailyIndexUrl,
  filingsForIssuers,
  isOpenMarketSale,
  isQualifyingBuy,
  parseDailyIndex,
  parseForm4,
  parseXmlBool,
  recentDays,
  transactionValueUsd,
} from "../../lib/insider/form4";

/* ============================================================================
 * Form 4 parsing, against four REAL filings pulled from one day of EDGAR
 * (2026-08-28) rather than hand-written XML. Between them they carry every
 * variation that would otherwise produce a plausible wrong number in silence.
 * ========================================================================== */

const fixture = (name: string): string =>
  fs.readFileSync(path.join(__dirname, "..", "fixtures", name), "utf8");

const META = { accession: "0000000000-26-000000", filedDate: "2026-08-28" };

const JOINT = fixture("form4-joint-purchase.xml"); // RSG — two reporting owners, six purchases
const NUMERIC = fixture("form4-numeric-booleans.xml"); // RCG — 1/0 booleans, sparse relationship
const PLANNED = fixture("form4-planned-sale.xml"); // NWPX — aff10b5One = 1, a sale and a gift
const TEXTUAL = fixture("form4-textual-booleans.xml"); // PTCT — true/false AND 1 in one document

describe("parseXmlBool", () => {
  it("accepts both spellings SEC's filing agents actually use", () => {
    expect(parseXmlBool("1")).toBe(true);
    expect(parseXmlBool("true")).toBe(true);
    expect(parseXmlBool("TRUE")).toBe(true);
    expect(parseXmlBool("0")).toBe(false);
    expect(parseXmlBool("false")).toBe(false);
  });

  it("returns null for absent or unrecognized, never a default", () => {
    // The distinction the scanner scores on: "the filer said no" is not the
    // same statement as "the filer said nothing".
    expect(parseXmlBool("")).toBeNull();
    expect(parseXmlBool("   ")).toBeNull();
    expect(parseXmlBool("maybe")).toBeNull();
  });
});

describe("parseForm4 — the issuer and the filing", () => {
  it("reads the issuer straight off the filing", () => {
    const doc = parseForm4(JOINT, META)!;
    expect(doc.ticker).toBe("RSG");
    expect(doc.issuerCik).toBe("0001060391");
    expect(doc.issuerName).toBe("REPUBLIC SERVICES, INC.");
    expect(doc.periodOfReport).toBe("2026-08-26");
    expect(doc.filedDate).toBe("2026-08-28");
  });

  it("accepts the complete submission text file as well as bare XML", () => {
    const wrapped = `<SEC-DOCUMENT>header lines\nACCESSION NUMBER: x\n<XML>\n${NUMERIC}\n</XML>\n`;
    const doc = parseForm4(wrapped, META)!;
    expect(doc.ticker).toBe("RCG");
    expect(doc.transactions).toHaveLength(1);
  });

  it("returns null rather than an empty document when there is no ownership record", () => {
    expect(parseForm4("<SEC-DOCUMENT>nothing useful</SEC-DOCUMENT>", META)).toBeNull();
  });
});

describe("parseForm4 — the pre-arranged-plan affirmation", () => {
  it("reads a numeric 1 as an affirmed plan", () => {
    // The trap: a parser testing `=== "true"` reads this real filing as
    // discretionary, which is the HIGHER-conviction reading. NWPX filed 1.
    expect(parseForm4(PLANNED, META)!.planned).toBe("yes");
  });

  it("reads a numeric 0 as an explicit denial", () => {
    expect(parseForm4(NUMERIC, META)!.planned).toBe("no");
    expect(parseForm4(JOINT, META)!.planned).toBe("no");
  });

  it("handles a filing that mixes numeric and textual booleans", () => {
    // PTCT writes aff10b5One as 1 while writing isDirector as true, in the
    // same document. Both readings have to work at once.
    const doc = parseForm4(TEXTUAL, META)!;
    expect(doc.planned).toBe("yes");
    expect(doc.owners[0].isDirector).toBe(true);
    expect(doc.owners[0].isOfficer).toBe(false);
  });

  it("reports an absent affirmation as unstated, not as discretionary", () => {
    const stripped = TEXTUAL.replace(/<aff10b5One>[^<]*<\/aff10b5One>/, "");
    expect(parseForm4(stripped, META)!.planned).toBe("not-stated");
  });

  it("does not upgrade a footnote mention into an affirmation", () => {
    const stripped = NUMERIC.replace(/<aff10b5One>[^<]*<\/aff10b5One>/, "").replace(
      "<footnotes>",
      '<footnotes><footnote id="F9">Sold under a Rule 10b5-1 trading plan.</footnote>',
    );
    const doc = parseForm4(stripped, META)!;
    expect(doc.planned).toBe("not-stated");
    expect(doc.flags.some((f) => /pre-arranged trading plan/.test(f))).toBe(true);
  });
});

describe("parseForm4 — reporting owners", () => {
  it("keeps every owner on a jointly filed report", () => {
    const doc = parseForm4(JOINT, META)!;
    expect(doc.owners.map((o) => o.name)).toEqual([
      "CASCADE INVESTMENT, L.L.C.",
      "GATES WILLIAM H III",
    ]);
    expect(doc.owners.every((o) => o.isTenPercentOwner)).toBe(true);
    expect(doc.owners.every((o) => o.isDirector)).toBe(false);
  });

  it("flags a joint filing so its purchases are never counted per filer", () => {
    const doc = parseForm4(JOINT, META)!;
    expect(doc.flags.some((f) => /counted once, not once per filer/.test(f))).toBe(true);
  });

  it("treats omitted relationship flags as absent rather than crashing", () => {
    // RENN's filer writes only the one flag that is true; the rest are missing.
    const owner = parseForm4(NUMERIC, META)!.owners[0];
    expect(owner.name).toBe("HORIZON KINETICS ASSET MANAGEMENT LLC");
    expect(owner.isTenPercentOwner).toBe(true);
    expect(owner.isDirector).toBe(false);
    expect(owner.isOfficer).toBe(false);
    expect(owner.officerTitle).toBeNull();
  });

  it("reads an officer title when there is one", () => {
    const owner = parseForm4(PLANNED, META)!.owners[0];
    expect(owner.isOfficer).toBe(true);
    expect(owner.officerTitle).toBe("Executive Vice President");
  });
});

describe("parseForm4 — transaction lines", () => {
  it("reads values out of their nested value element", () => {
    const t = parseForm4(NUMERIC, META)!.transactions[0];
    expect(t.line).toBe(1);
    expect(t.securityTitle).toBe("Common Stock");
    expect(t.transactionDate).toBe("2026-08-27");
    expect(t.code).toBe("P");
    expect(t.acquiredDisposed).toBe("A");
    expect(t.shares).toBe(756);
    expect(t.pricePerShare).toBe(2.94);
    expect(t.sharesAfter).toBe(959_124);
    expect(t.ownership).toBe("D");
  });

  it("reads every line of a multi-line filing in order", () => {
    const ts = parseForm4(JOINT, META)!.transactions;
    expect(ts).toHaveLength(6);
    expect(ts.map((t) => t.line)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(ts[0].shares).toBe(12_334);
    expect(ts[5].shares).toBe(1_067);
    expect(ts.every((t) => t.code === "P" && t.acquiredDisposed === "A")).toBe(true);
  });

  it("survives a footnote reference sitting beside the value", () => {
    // sharesOwnedFollowingTransaction on the RENN filing carries a footnoteId
    // sibling; reading the wrong depth returns the footnote id or nothing.
    expect(parseForm4(NUMERIC, META)!.transactions[0].sharesAfter).toBe(959_124);
  });

  it("returns null, never zero, for a missing share count or price", () => {
    const stripped = NUMERIC.replace(
      /<transactionPricePerShare>[\s\S]*?<\/transactionPricePerShare>/,
      "",
    );
    const t = parseForm4(stripped, META)!.transactions[0];
    expect(t.pricePerShare).toBeNull();
    expect(t.flags.some((f) => /without a readable price/.test(f))).toBe(true);
  });

  it("keeps a genuinely zero price, which a gift really has", () => {
    const gift = parseForm4(PLANNED, META)!.transactions[1];
    expect(gift.code).toBe("G");
    expect(gift.pricePerShare).toBe(0);
    expect(gift.flags).toEqual([]);
  });

  it("ignores derivative activity entirely", () => {
    const withDerivative =
      NUMERIC.replace(
        "</nonDerivativeTable>",
        "</nonDerivativeTable><derivativeTable><derivativeTransaction>" +
          "<transactionCoding><transactionCode>P</transactionCode></transactionCoding>" +
          "<transactionAmounts><transactionShares><value>999999</value></transactionShares></transactionAmounts>" +
          "</derivativeTransaction></derivativeTable>",
      );
    expect(parseForm4(withDerivative, META)!.transactions).toHaveLength(1);
  });
});

describe("what counts as a buy", () => {
  const line = (code: string, acquiredDisposed: string, shares: number | null = 100) => ({
    code,
    acquiredDisposed,
    shares,
  });

  it("accepts only an open-market purchase", () => {
    expect(isQualifyingBuy(line("P", "A"))).toBe(true);
  });

  it("rejects every other way shares arrive", () => {
    // Each of these is something that happened TO the insider, not a decision
    // to spend money at the going price.
    expect(isQualifyingBuy(line("A", "A"))).toBe(false); // grant from the company
    expect(isQualifyingBuy(line("M", "A"))).toBe(false); // option exercise
    expect(isQualifyingBuy(line("G", "A"))).toBe(false); // gift received
    expect(isQualifyingBuy(line("F", "D"))).toBe(false); // shares withheld for tax
    expect(isQualifyingBuy(line("S", "D"))).toBe(false); // sale
    expect(isQualifyingBuy(line("C", "A"))).toBe(false); // conversion
  });

  it("rejects a purchase code paired with a disposal", () => {
    expect(isQualifyingBuy(line("P", "D"))).toBe(false);
  });

  it("rejects a line with no readable share count", () => {
    expect(isQualifyingBuy(line("P", "A", null))).toBe(false);
    expect(isQualifyingBuy(line("P", "A", 0))).toBe(false);
  });

  it("identifies open-market sales for the falsification check", () => {
    expect(isOpenMarketSale(line("S", "D"))).toBe(true);
    expect(isOpenMarketSale(line("F", "D"))).toBe(false); // tax withholding is not a decision
    expect(isOpenMarketSale(line("G", "D"))).toBe(false); // nor is a gift
  });

  it("finds the real purchases across the fixtures", () => {
    expect(parseForm4(JOINT, META)!.transactions.filter(isQualifyingBuy)).toHaveLength(6);
    expect(parseForm4(NUMERIC, META)!.transactions.filter(isQualifyingBuy)).toHaveLength(1);
    expect(parseForm4(PLANNED, META)!.transactions.filter(isQualifyingBuy)).toHaveLength(0);
    expect(parseForm4(TEXTUAL, META)!.transactions.filter(isQualifyingBuy)).toHaveLength(0);
  });
});

describe("transactionValueUsd", () => {
  it("multiplies shares by price", () => {
    expect(transactionValueUsd({ shares: 756, price: 2.94 })).toBeCloseTo(2222.64, 6);
  });

  it("is null when the filing did not say, rather than zero", () => {
    expect(transactionValueUsd({ shares: 756, price: null })).toBeNull();
    expect(transactionValueUsd({ shares: null, price: 2.94 })).toBeNull();
  });

  it("totals a real joint purchase", () => {
    const doc = parseForm4(JOINT, META)!;
    const total = doc.transactions
      .filter(isQualifyingBuy)
      .reduce((s, t) => s + (transactionValueUsd({ shares: t.shares, price: t.pricePerShare }) ?? 0), 0);
    // 560,100 shares of Republic Services across two days, verified against the
    // filing line by line.
    expect(total).toBeCloseTo(123_511_812.773, 2);
    expect(doc.transactions.reduce((s, t) => s + (t.shares ?? 0), 0)).toBe(560_100);
  });
});

/* ----------------------------------------------------------------------------
 * The daily index
 * -------------------------------------------------------------------------- */

const INDEX_SAMPLE = [
  "Description:           Daily Index of EDGAR Dissemination Feed by Form Type",
  "Form Type   Company Name                                                  CIK         Date Filed  File Name",
  "---------------------------------------------------------------------------------------------------------",
  "1-A              Global Interchange, Inc.                                      2083128     20260828    edgar/data/2083128/0001096906-26-001322.txt",
  "4                10x Genomics, Inc.                                            1770787     20260828    edgar/data/1770787/0001610717-26-000393.txt",
  "4                ABERNETHY JAMES S                                             1244172     20260828    edgar/data/1244172/0001654954-26-007957.txt",
  "4                ACCEL-KKR CAPITAL PARTNERS CV III, LP                         1781975     20260828    edgar/data/1781975/0001193125-26-374899.txt",
  "4                ACCEL-KKR GROWTH CAPITAL PARTNERS III, LP                     1747133     20260828    edgar/data/1747133/0001193125-26-374899.txt",
  "8-K              Some Company Inc.                                             111111      20260828    edgar/data/111111/0000000000-26-000001.txt",
].join("\n");

describe("parseDailyIndex", () => {
  it("keeps only the requested form type", () => {
    const rows = parseDailyIndex(INDEX_SAMPLE, "4");
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.form === "4")).toBe(true);
  });

  it("reads company names containing spaces, commas and periods", () => {
    const rows = parseDailyIndex(INDEX_SAMPLE, "4");
    expect(rows[0].companyName).toBe("10x Genomics, Inc.");
    expect(rows[2].companyName).toBe("ACCEL-KKR CAPITAL PARTNERS CV III, LP");
  });

  it("reads the CIK, the accession and the filing date", () => {
    const row = parseDailyIndex(INDEX_SAMPLE, "4")[0];
    expect(row.cik).toBe(1_770_787);
    expect(row.accession).toBe("0001610717-26-000393");
    expect(row.filedDate).toBe("2026-08-28");
    expect(row.path).toBe("edgar/data/1770787/0001610717-26-000393.txt");
  });

  it("ignores the header and rule lines", () => {
    expect(parseDailyIndex(INDEX_SAMPLE, "1-A")).toHaveLength(1);
    expect(parseDailyIndex("", "4")).toEqual([]);
  });
});

describe("filingsForIssuers", () => {
  const rows = parseDailyIndex(INDEX_SAMPLE, "4");

  it("keeps only filings naming a company we care about", () => {
    const kept = filingsForIssuers(rows, new Set([1_770_787]));
    expect(kept).toHaveLength(1);
    expect(kept[0].accession).toBe("0001610717-26-000393");
  });

  it("collapses the index's per-filer rows into one entry per filing", () => {
    // 0001193125-26-374899 appears twice, once under each of two filers.
    const kept = filingsForIssuers(rows, new Set([1_781_975, 1_747_133]));
    expect(kept).toHaveLength(1);
  });

  it("drops everything else without ever opening it", () => {
    expect(filingsForIssuers(rows, new Set([999_999]))).toEqual([]);
  });
});

describe("dailyIndexUrl", () => {
  it("puts a date in the right quarter directory", () => {
    expect(dailyIndexUrl("2026-08-28")).toContain("/2026/QTR3/form.20260828.idx");
    expect(dailyIndexUrl("2026-01-02")).toContain("/2026/QTR1/form.20260102.idx");
    expect(dailyIndexUrl("2026-03-31")).toContain("/2026/QTR1/form.20260331.idx");
    expect(dailyIndexUrl("2026-04-01")).toContain("/2026/QTR2/form.20260401.idx");
    expect(dailyIndexUrl("2026-12-31")).toContain("/2026/QTR4/form.20261231.idx");
  });
});

describe("recentDays", () => {
  it("counts back from today inclusive, newest first", () => {
    const days = recentDays(3, new Date("2026-08-31T12:00:00Z"));
    expect(days).toEqual(["2026-08-31", "2026-08-30", "2026-08-29"]);
  });

  it("crosses a month boundary correctly", () => {
    expect(recentDays(2, new Date("2026-03-01T00:00:00Z"))).toEqual(["2026-03-01", "2026-02-28"]);
  });
});
