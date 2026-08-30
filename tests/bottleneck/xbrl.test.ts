import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ConceptFact } from "../../lib/edgar";
import {
  annualSeries,
  change,
  conceptFromFacts,
  priorQuarter,
  priorYearQuarter,
  quarterlySeries,
  ttm,
} from "../../lib/bottleneck/xbrl";

/* ============================================================================
 * The de-cumulation math, against Apple's real capex series.
 *
 * The decisive test is `quarters sum to the fiscal year`: if the differencing
 * is wrong in any direction the sum breaks, and no other assertion is needed to
 * prove it. Everything else guards the shapes around it.
 * ========================================================================== */

const facts: ConceptFact[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "fixtures", "companyconcept-aapl-capex.json"), "utf8"),
).units.USD;

const B = (n: number) => n / 1e9;
const at = (qs: ReturnType<typeof quarterlySeries>, end: string) => qs.find((q) => q.end === end);

describe("quarterlySeries — de-cumulating a fiscal-year-to-date concept", () => {
  const qs = quarterlySeries(facts);

  it("produces a chronological series of quarter-length windows", () => {
    expect(qs.length).toBeGreaterThan(20);
    for (const q of qs) {
      expect(q.days).toBeGreaterThanOrEqual(80);
      expect(q.days).toBeLessThanOrEqual(100);
    }
    const ends = qs.map((q) => q.end);
    expect([...ends].sort()).toEqual(ends);
  });

  it("never emits an annual window as a quarter", () => {
    // The FY2025 total is $12.715B; no single quarter may equal it.
    for (const q of qs) expect(B(q.val)).toBeLessThan(10);
  });

  it("recovers the true FY2026 quarters from cumulative filings", () => {
    // Filed cumulatively as 2.373 / 4.344 / 6.799 — the quarters are the diffs.
    expect(B(at(qs, "2025-12-27")!.val)).toBeCloseTo(2.373, 3);
    expect(B(at(qs, "2026-03-28")!.val)).toBeCloseTo(1.971, 3);
    expect(B(at(qs, "2026-06-27")!.val)).toBeCloseTo(2.455, 3);
  });

  it("labels the first quarter reported and the rest derived", () => {
    expect(at(qs, "2025-12-27")!.basis).toBe("reported");
    expect(at(qs, "2026-03-28")!.basis).toBe("derived");
    expect(at(qs, "2026-06-27")!.basis).toBe("derived");
  });

  it("makes the FY2025 quarters sum to the reported fiscal year", () => {
    // The load-bearing assertion: 2.940 + 3.071 + 3.462 + 3.242 = 12.715.
    const fy2025 = ["2024-12-28", "2025-03-29", "2025-06-28", "2025-09-27"].map((e) => at(qs, e)!.val);
    expect(fy2025.every(Boolean)).toBe(true);
    const annual = annualSeries(facts).find((a) => a.end === "2025-09-27")!;
    expect(B(fy2025.reduce((s, v) => s + v, 0))).toBeCloseTo(B(annual.val), 6);
  });

  it("never reports a cumulative figure as a quarter", () => {
    // The specific 2.8x bug: nine-months $6.799B must not survive as a quarter.
    expect(B(at(qs, "2026-06-27")!.val)).not.toBeCloseTo(6.799, 2);
  });

  it("passes discrete quarterly filers through untouched", () => {
    const discrete: ConceptFact[] = [
      { start: "2026-01-01", end: "2026-03-31", val: 100, form: "10-Q", fp: "Q1" },
      { start: "2026-04-01", end: "2026-06-30", val: 120, form: "10-Q", fp: "Q2" },
    ];
    const out = quarterlySeries(discrete);
    expect(out.map((q) => q.val)).toEqual([100, 120]);
    expect(out.every((q) => q.basis === "reported")).toBe(true);
  });

  it("drops a lone annual window rather than calling it a quarter", () => {
    const annualOnly: ConceptFact[] = [{ start: "2025-01-01", end: "2025-12-31", val: 999, form: "10-K" }];
    expect(quarterlySeries(annualOnly)).toEqual([]);
  });

  it("collapses a fact restated as a comparative in a later filing", () => {
    const restated: ConceptFact[] = [
      { start: "2026-01-01", end: "2026-03-31", val: 100, form: "10-Q", fy: 2026, filed: "2026-04-20" },
      { start: "2026-01-01", end: "2026-03-31", val: 100, form: "10-Q", fy: 2027, filed: "2027-04-20" },
    ];
    const out = quarterlySeries(restated);
    expect(out.length).toBe(1);
    expect(out[0].fy).toBe(2026); // earliest filed instance wins
  });

  it("tolerates an empty series", () => {
    expect(quarterlySeries([])).toEqual([]);
  });
});

describe("annualSeries", () => {
  it("finds the fiscal-year totals and nothing shorter", () => {
    const years = annualSeries(facts);
    expect(years.length).toBeGreaterThan(5);
    for (const y of years) {
      expect(y.days).toBeGreaterThanOrEqual(350);
      expect(y.days).toBeLessThanOrEqual(380);
    }
    expect(B(years.find((y) => y.end === "2025-09-27")!.val)).toBeCloseTo(12.715, 3);
    expect(B(years.find((y) => y.end === "2024-09-28")!.val)).toBeCloseTo(9.447, 3);
  });
});

describe("period navigation", () => {
  const qs = quarterlySeries(facts);

  it("finds the immediately preceding quarter", () => {
    expect(priorQuarter(qs, "2026-06-27")!.end).toBe("2026-03-28");
  });

  it("returns null before the start of the series", () => {
    expect(priorQuarter(qs, qs[0].end)).toBeNull();
  });

  it("matches the same fiscal quarter a year earlier despite calendar drift", () => {
    // Apple's Q3 ends in late June; the prior year's is a few days off 365.
    const yoy = priorYearQuarter(qs, "2026-06-27");
    expect(yoy).not.toBeNull();
    expect(yoy!.end).toBe("2025-06-28");
    expect(yoy!.fp).toBe("Q3");
  });

  it("returns null for an unknown period", () => {
    expect(priorYearQuarter(qs, "1999-01-01")).toBeNull();
  });
});

describe("change", () => {
  it("computes absolute and percentage movement", () => {
    expect(change(120, 100)).toEqual({ absolute: 20, pct: 20 });
    expect(change(80, 100)).toEqual({ absolute: -20, pct: -20 });
  });

  it("refuses a percentage off a zero or negative base", () => {
    expect(change(50, 0)).toEqual({ absolute: 50, pct: null });
    expect(change(50, -10)).toEqual({ absolute: 60, pct: null });
  });

  it("returns null when there is no base at all", () => {
    expect(change(50, undefined)).toBeNull();
  });
});

describe("ttm", () => {
  const qs = quarterlySeries(facts);

  it("sums exactly four consecutive quarters", () => {
    const total = ttm(qs, "2025-09-27");
    const annual = annualSeries(facts).find((a) => a.end === "2025-09-27")!;
    expect(B(total!)).toBeCloseTo(B(annual.val), 6);
  });

  it("refuses a partial window rather than understating it", () => {
    expect(ttm(qs, qs[0].end)).toBeNull();
    expect(ttm(qs, qs[2].end)).toBeNull();
  });
});

describe("conceptFromFacts — SEC's two endpoints disagree", () => {
  const withFacts = {
    "us-gaap": {
      PaymentsToAcquireProductiveAssets: {
        units: { USD: [{ start: "2026-01-01", end: "2026-03-31", val: 2_376_000_000 }] },
      },
      EmptyOnPurpose: { units: { USD: {} } },
      OtherUnit: { units: { shares: [{ end: "2026-03-31", val: 4_000_000_000 }] } },
    },
  };

  it("reads a tag that company-facts carries", () => {
    const rows = conceptFromFacts(withFacts, "PaymentsToAcquireProductiveAssets")!;
    expect(rows).toHaveLength(1);
    expect(rows[0].val).toBe(2_376_000_000);
  });

  it("treats the empty-object payload as no data, not as a fact list", () => {
    // Verified live 2026-08-30: SEC's per-concept endpoint returns
    // `units: { USD: {} }` for Ford's capital spending while company-facts
    // carries 158 USD facts for the same tag.
    expect(conceptFromFacts(withFacts, "EmptyOnPurpose")).toBeNull();
  });

  it("returns null for a tag, taxonomy or unit that is not there", () => {
    expect(conceptFromFacts(withFacts, "NoSuchTag")).toBeNull();
    expect(conceptFromFacts(withFacts, "OtherUnit")).toBeNull();
    expect(conceptFromFacts(withFacts, "OtherUnit", { unit: "shares" })).toHaveLength(1);
    expect(conceptFromFacts(withFacts, "PaymentsToAcquireProductiveAssets", { taxonomy: "ifrs-full" })).toBeNull();
    expect(conceptFromFacts(undefined, "PaymentsToAcquireProductiveAssets")).toBeNull();
  });
});
