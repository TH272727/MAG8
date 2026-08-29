import { describe, expect, it } from "vitest";
import type { ConceptFact } from "../../lib/edgar";
import {
  chooseFreshestTag,
  convertToUnits,
  demandFlags,
  findNarrative,
  htmlToText,
  markStale,
  type DemandCompany,
} from "../../lib/bottleneck/demand";
import { quarterlySeries, ttm } from "../../lib/bottleneck/xbrl";
import { BUILT_IN_PLAYBOOKS } from "../../lib/bottleneck/playbook";

/* ============================================================================
 * Module B regressions. Every case here was found running against live SEC
 * data, and every one produced a plausible-looking wrong number rather than an
 * error — which is exactly why they are pinned.
 * ========================================================================== */

const company = (over: Partial<DemandCompany> = {}): DemandCompany => ({
  ticker: "AAA",
  companyName: "AAA Corp",
  cik: 1,
  status: "ok",
  latestQuarterEnd: "2026-06-30",
  latestQuarterUsd: 100,
  ttmUsd: 400,
  ...over,
});

describe("tag drift — reading an abandoned tag reports a decade-old figure", () => {
  const chain = [
    "PaymentsToAcquirePropertyPlantAndEquipment",
    "PaymentsForCapitalImprovements",
    "PaymentsToAcquireProductiveAssets",
  ];

  it("picks the freshest tag, not the first populated one", () => {
    // Amazon's real shape: the chain's FIRST tag stops in 2017, the third is current.
    const pick = chooseFreshestTag(
      [
        { tag: "PaymentsToAcquirePropertyPlantAndEquipment", lastEnd: "2017-03-31" },
        { tag: "PaymentsToAcquireProductiveAssets", lastEnd: "2026-06-30" },
      ],
      chain,
    );
    expect(pick!.tag).toBe("PaymentsToAcquireProductiveAssets");
  });

  it("records the abandoned tag so the migration is disclosed, not hidden", () => {
    const pick = chooseFreshestTag(
      [
        { tag: "PaymentsToAcquirePropertyPlantAndEquipment", lastEnd: "2017-03-31" },
        { tag: "PaymentsToAcquireProductiveAssets", lastEnd: "2026-06-30" },
      ],
      chain,
    );
    expect(pick!.abandoned).toEqual([
      { tag: "PaymentsToAcquirePropertyPlantAndEquipment", lastEnd: "2017-03-31" },
    ]);
  });

  it("breaks a tie on chain order, so playbook preference still decides", () => {
    const pick = chooseFreshestTag(
      [
        { tag: "PaymentsToAcquireProductiveAssets", lastEnd: "2026-06-30" },
        { tag: "PaymentsToAcquirePropertyPlantAndEquipment", lastEnd: "2026-06-30" },
      ],
      chain,
    );
    expect(pick!.tag).toBe("PaymentsToAcquirePropertyPlantAndEquipment");
    expect(pick!.abandoned).toEqual([]);
  });

  it("returns null when no tag carries data", () => {
    expect(chooseFreshestTag([], chain)).toBeNull();
  });
});

describe("double-counted quarters", () => {
  it("keeps one entry when a quarter is filed both directly and cumulatively", () => {
    // Amazon's real shape for 2026-06-30: reported as its own 90-day window AND
    // recoverable by differencing the 3- and 6-month cumulative facts. Both are
    // $54.21B; counting both would inflate every trailing-twelve-month total.
    const facts: ConceptFact[] = [
      { start: "2026-01-01", end: "2026-03-31", val: 44.2, form: "10-Q", fp: "Q1" },
      { start: "2026-01-01", end: "2026-06-30", val: 98.41, form: "10-Q", fp: "Q2" },
      { start: "2026-04-01", end: "2026-06-30", val: 54.21, form: "10-Q", fp: "Q2" },
    ];
    const qs = quarterlySeries(facts);
    expect(qs.filter((q) => q.end === "2026-06-30").length).toBe(1);
    expect(qs.find((q) => q.end === "2026-06-30")!.val).toBeCloseTo(54.21, 2);
  });

  it("prefers the directly reported quarter over the derived one", () => {
    const facts: ConceptFact[] = [
      { start: "2026-01-01", end: "2026-03-31", val: 10, form: "10-Q" },
      { start: "2026-01-01", end: "2026-06-30", val: 25, form: "10-Q" },
      { start: "2026-04-01", end: "2026-06-30", val: 15, form: "10-Q" },
    ];
    expect(quarterlySeries(facts).find((q) => q.end === "2026-06-30")!.basis).toBe("reported");
  });

  it("makes the trailing twelve months match the reported fiscal year", () => {
    // The regression this fixes: before de-duplication, a doubled quarter made
    // Microsoft's TTM read $127.43B against a filed fiscal year of $115.95B.
    const facts: ConceptFact[] = [
      { start: "2025-07-01", end: "2025-09-30", val: 24.2, form: "10-Q" },
      { start: "2025-07-01", end: "2025-12-31", val: 49.27, form: "10-Q" },
      { start: "2025-10-01", end: "2025-12-31", val: 25.07, form: "10-Q" },
      { start: "2025-07-01", end: "2026-03-31", val: 80.15, form: "10-Q" },
      { start: "2025-07-01", end: "2026-06-30", val: 115.95, form: "10-K" },
    ];
    const qs = quarterlySeries(facts);
    expect(qs.length).toBe(4);
    expect(ttm(qs, "2026-06-30")).toBeCloseTo(115.95, 2);
  });
});

describe("staleness", () => {
  it("excludes a company whose latest quarter is years behind the basket", () => {
    const rows = markStale([
      company({ ticker: "NEW", latestQuarterEnd: "2026-06-30" }),
      company({ ticker: "OLD", latestQuarterEnd: "2017-03-31" }),
    ]);
    expect(rows.find((r) => r.ticker === "NEW")!.stale).toBeUndefined();
    expect(rows.find((r) => r.ticker === "OLD")!.stale).toBe(true);
    expect(rows.find((r) => r.ticker === "OLD")!.note).toMatch(/behind the rest of the basket/);
  });

  it("tolerates genuinely different fiscal calendars", () => {
    // Apple, Microsoft and Nvidia legitimately close quarters weeks apart.
    const rows = markStale([
      company({ ticker: "A", latestQuarterEnd: "2026-07-26" }),
      company({ ticker: "B", latestQuarterEnd: "2026-06-30" }),
      company({ ticker: "C", latestQuarterEnd: "2026-05-31" }),
    ]);
    expect(rows.every((r) => !r.stale)).toBe(true);
  });

  it("keeps a stale company out of the totals and out of the conversions", () => {
    const pb = BUILT_IN_PLAYBOOKS[0];
    const rows = markStale([
      company({ ticker: "NEW", latestQuarterEnd: "2026-06-30", ttmUsd: 400 }),
      company({ ticker: "OLD", latestQuarterEnd: "2017-03-31", ttmUsd: 999_999 }),
    ]);
    const units = convertToUnits(pb, rows);
    expect(units[0].contributions.map((c) => c.ticker)).toEqual(["NEW"]);
    expect(units[0].totalUsd).toBe(400);
  });
});

describe("conversions show their working", () => {
  const pb = BUILT_IN_PLAYBOOKS[0];

  it("divides dollars by the factor and reports both sides", () => {
    const units = convertToUnits(pb, [company({ ticker: "X", ttmUsd: 9_500_000 * 3 })]);
    const mw = units.find((u) => u.key === "mw")!;
    expect(mw.totalUnits).toBeCloseTo(3, 6);
    expect(mw.totalUsd).toBe(28_500_000);
    expect(mw.usdPer).toBe(9_500_000);
    expect(mw.source).toBeTruthy();
    expect(mw.asOf).toBeTruthy();
    expect(mw.contributions).toEqual([{ ticker: "X", usd: 28_500_000, units: 3 }]);
  });

  it("produces a unit total for every factor in the playbook", () => {
    const units = convertToUnits(pb, [company()]);
    expect(units.map((u) => u.key).sort()).toEqual(pb.conversions.factors.map((f) => f.key).sort());
  });

  it("excludes a company with no trailing-twelve-month figure", () => {
    const units = convertToUnits(pb, [company({ ticker: "A" }), company({ ticker: "B", ttmUsd: undefined })]);
    expect(units[0].contributions.map((c) => c.ticker)).toEqual(["A"]);
  });
});

describe("flags — a missing company is never a silent zero", () => {
  const pb = BUILT_IN_PLAYBOOKS[0];

  it("names companies that contributed nothing", () => {
    const flags = demandFlags(pb, [
      company({ ticker: "GOOD" }),
      company({ ticker: "GONE", status: "no-tag" }),
    ]);
    expect(flags.join(" ")).toMatch(/GONE/);
    expect(flags.join(" ")).toMatch(/rather than counted as zero/);
  });

  it("discloses a tag migration", () => {
    const flags = demandFlags(pb, [
      company({ ticker: "AMZN", abandonedTags: [{ tag: "OldTag", lastEnd: "2017-03-31" }], tagUsed: "NewTag" }),
    ]);
    expect(flags.join(" ")).toMatch(/changed the filing tag/);
    expect(flags.join(" ")).toMatch(/OldTag/);
  });

  it("always discloses placeholder conversion factors", () => {
    expect(demandFlags(pb, [company()]).join(" ")).toMatch(/seeded placeholder/);
  });

  it("discloses mismatched fiscal period ends", () => {
    const flags = demandFlags(pb, [
      company({ ticker: "A", latestQuarterEnd: "2026-06-30" }),
      company({ ticker: "B", latestQuarterEnd: "2026-07-26" }),
    ]);
    expect(flags.join(" ")).toMatch(/Fiscal calendars differ/);
  });
});

describe("narrative extraction", () => {
  it("strips markup and entities down to prose", () => {
    const html = "<div><style>x{}</style><p>Capital&nbsp;expenditures rose to $10&amp;nbsp;billion.</p></div>";
    expect(htmlToText(html)).toContain("Capital expenditures rose to");
    expect(htmlToText(html)).not.toContain("<");
  });

  it("prefers sentences carrying both a keyword and a figure", () => {
    const text =
      "We discuss data center topics generally in this filing without any specific quantities mentioned here. " +
      "Capital expenditures for our data center capacity increased to $12.4 billion this quarter driven by servers. " +
      "Unrelated commentary about the weather and other matters that has nothing to do with the subject at all.";
    const found = findNarrative(text, ["capital expenditure", "data center"], 1);
    expect(found.length).toBe(1);
    expect(found[0]).toMatch(/\$12\.4 billion/);
  });

  it("returns nothing rather than guessing when no keyword matches", () => {
    expect(findNarrative("A sentence about something else entirely that is long enough to qualify here.", ["capex"])).toEqual([]);
    expect(findNarrative("anything", [])).toEqual([]);
  });
});
