import { describe, expect, it } from "vitest";
import type { ConceptFact } from "../../lib/edgar";
import {
  chooseFreshestTag,
  convertToUnits,
  demandFlags,
  findNarrative,
  htmlToText,
  markStale,
  readNothing,
  type DemandCompany,
  type DemandSnapshot,
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

describe("flags — a fragile total is labelled as one", () => {
  const pb = BUILT_IN_PLAYBOOKS[0];

  it("says so when opposing flows nearly cancel", () => {
    // Homebuilders' demand is an inventory build, and members routinely report
    // NEGATIVE twelve-month figures. A total that is a small difference between
    // large opposing flows must not read as confidently as a robust one.
    const flags = demandFlags(pb, [
      company({ ticker: "AAA", ttmUsd: 500 }),
      company({ ticker: "BBB", ttmUsd: -400 }),
      company({ ticker: "CCC", ttmUsd: 100 }),
    ]);
    const flag = flags.find((f) => /survives netting/.test(f))!;
    expect(flag).toContain("20%");
    expect(flag).toContain("1 of 3 companies report a NEGATIVE");
  });

  it("stays quiet when every company pulls the same way", () => {
    const flags = demandFlags(pb, [company({ ticker: "AAA", ttmUsd: 500 }), company({ ticker: "BBB", ttmUsd: 400 })]);
    expect(flags.some((f) => /survives netting/.test(f))).toBe(false);
  });

  it("names a growth rate computed off a near-zero base", () => {
    const flags = demandFlags(pb, [
      company({ ticker: "TOL", yoy: { absolute: 300, pct: 15012.3 } }),
      company({ ticker: "AAA", yoy: { absolute: 10, pct: 12.5 } }),
    ]);
    const flag = flags.find((f) => /near-zero base/.test(f))!;
    expect(flag).toContain("TOL (+15012%)");
    expect(flag).not.toContain("AAA");
    expect(flag).toContain("does not distort the aggregate");
  });

  it("leaves an ordinary growth rate alone", () => {
    const flags = demandFlags(pb, [company({ yoy: { absolute: 50, pct: 85.7 } })]);
    expect(flags.some((f) => /near-zero base/.test(f))).toBe(false);
  });
});

describe("the playbook abstraction holds for more than one sector", () => {
  it("ships seven built-in themes, each self-contained", () => {
    expect(BUILT_IN_PLAYBOOKS.map((p) => p.id)).toEqual([
      "ai-infrastructure",
      "ev-battery-supply-chain",
      "homebuilding",
      "drone-industrial-base",
      "robotics-automation",
      "quantum-computing",
      "nuclear-energy",
    ]);
    for (const pb of BUILT_IN_PLAYBOOKS) {
      expect(pb.demand.basket.length).toBeGreaterThan(0);
      expect(pb.demand.capexTags.length).toBeGreaterThan(0);
      expect(pb.conversions.factors.length).toBeGreaterThan(0);
      // Every conversion factor must be constrained by something, and every
      // owner group must name a factor that exists — a playbook that maps to
      // nothing would score and display as silently empty.
      const keys = new Set(pb.conversions.factors.map((f) => f.key));
      for (const s of pb.supply) expect(keys.has(s.constrains)).toBe(true);
      for (const o of pb.owners) expect(keys.has(o.category)).toBe(true);
    }
  });

  it("keeps every factor honest about being a placeholder", () => {
    for (const pb of BUILT_IN_PLAYBOOKS) {
      for (const f of pb.conversions.factors) {
        expect(f.source.length).toBeGreaterThan(10);
        expect(f.asOf).toMatch(/^\d{4}-\d{2}/);
      }
    }
  });
});

describe("a refresh that read nothing is not a reading", () => {
  /*
   * Found the hard way: a transient transport failure against SEC produced
   * three consecutive 0-of-6 snapshots, each of which replaced a complete
   * $573.72B reading and blanked the desk. The predicate below is the rule;
   * its two call sites are buildDemandSnapshot (does not store) and refreshDesk
   * (does not store the score either, and sweeps old ones). Those touch the
   * database, so they are exercised by the live probe rather than here.
   */
  const snapshot = (contributing: number, basketSize = 6): DemandSnapshot => ({
    playbookId: "test",
    playbookLabel: "Test",
    takenAt: "2026-08-30T18:46:10.357Z",
    conversionVersion: "1",
    conversionAsOf: "2026-08",
    placeholderFactors: false,
    companies: [],
    units: [],
    aggregate: { contributing, basketSize, latestQuarterUsd: 0, ttmUsd: 0, yoyPct: null },
    flags: [],
  });

  it("recognizes a reading in which nothing was read", () => {
    expect(readNothing(snapshot(0))).toBe(true);
  });

  it("does not condemn a partial reading — those are flagged, not withheld", () => {
    expect(readNothing(snapshot(1))).toBe(false);
    expect(readNothing(snapshot(6))).toBe(false);
  });

  it("treats an empty basket as nothing read", () => {
    expect(readNothing(snapshot(0, 0))).toBe(true);
  });
});
