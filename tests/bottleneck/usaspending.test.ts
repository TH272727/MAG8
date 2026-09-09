import { describe, expect, it } from "vitest";
import {
  coverage,
  fiscalYearOf,
  fiscalYearWindow,
  linkRecipients,
  obligationTrend,
  type ObligationSeries,
  type Recipient,
} from "../../lib/bottleneck/usaspending";
import { getPlaybook } from "../../lib/bottleneck/playbook";

/* ============================================================================
 * Federal award records — the pure half. Nothing here touches the network.
 * ========================================================================== */

describe("fiscal years", () => {
  it("names a federal year for the year it ENDS in", () => {
    // October 2025 is already FY2026. A reader comparing a federal figure with
    // a calendar-year one without being told is comparing different periods.
    expect(fiscalYearOf(new Date("2025-10-01T00:00:00Z"))).toBe(2026);
    expect(fiscalYearOf(new Date("2025-09-30T00:00:00Z"))).toBe(2025);
    expect(fiscalYearOf(new Date("2026-09-07T00:00:00Z"))).toBe(2026);
    expect(fiscalYearOf(new Date("2026-10-01T00:00:00Z"))).toBe(2027);
  });

  it("builds an October-to-September window", () => {
    expect(fiscalYearWindow(2026)).toEqual({ start_date: "2025-10-01", end_date: "2026-09-30" });
  });
});

describe("linkRecipients", () => {
  const rows: Recipient[] = [
    { name: "AEROVIRONMENT, INC", amountUsd: 75_840_000, uei: null },
    { name: "KRATOS UNMANNED AERIAL SYSTEMS, INC", amountUsd: 164_000_000, uei: null },
    { name: "GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.", amountUsd: 745_750_000, uei: null },
  ];

  it("matches a curated alias through punctuation and case", () => {
    const linked = linkRecipients(rows, [{ ticker: "avav", awardNames: ["Aerovironment Inc."] }]);
    expect(linked.find((r) => r.name.startsWith("AEROVIRONMENT"))!.ticker).toBe("AVAV");
  });

  it("matches an operating SUBSIDIARY, which a parent-name match cannot", () => {
    // The finding that forced curation: Kratos Defense & Security Solutions
    // appears in the award records only as its unmanned-systems subsidiary, so
    // a normalised match on the listed parent name returns nothing and would
    // report no federal awards for a company holding $164M of them.
    const byParent = linkRecipients(rows, [
      { ticker: "KTOS", awardNames: ["Kratos Defense & Security Solutions Inc."] },
    ]);
    expect(byParent.find((r) => r.name.startsWith("KRATOS"))!.ticker).toBeNull();

    const bySubsidiary = linkRecipients(rows, [
      { ticker: "KTOS", awardNames: ["KRATOS UNMANNED AERIAL SYSTEMS, INC"] },
    ]);
    expect(bySubsidiary.find((r) => r.name.startsWith("KRATOS"))!.ticker).toBe("KTOS");
  });

  it("leaves an unmatched recipient named rather than dropping it", () => {
    const linked = linkRecipients(rows, []);
    expect(linked).toHaveLength(3);
    expect(linked.every((r) => r.ticker === null)).toBe(true);
    expect(linked[2].name).toBe("GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.");
  });

  it("never infers a match from a shared word", () => {
    // "AEROVIRONMENT" and "GENERAL ATOMICS AERONAUTICAL" share a prefix under a
    // loose matcher. Curated means exact, normalised, and nothing else.
    const linked = linkRecipients(rows, [{ ticker: "AVAV", awardNames: ["Aero"] }]);
    expect(linked.every((r) => r.ticker === null)).toBe(true);
  });
});

describe("coverage", () => {
  const linked = linkRecipients(
    [
      { name: "AEROVIRONMENT, INC", amountUsd: 75_840_000, uei: null },
      { name: "KRATOS UNMANNED AERIAL SYSTEMS, INC", amountUsd: 164_000_000, uei: null },
      { name: "GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.", amountUsd: 745_750_000, uei: null },
      { name: "NORTHROP GRUMMAN SYSTEMS CORPORATION", amountUsd: 308_500_000, uei: null },
    ],
    [
      { ticker: "AVAV", awardNames: ["AEROVIRONMENT, INC"] },
      { ticker: "KTOS", awardNames: ["KRATOS UNMANNED AERIAL SYSTEMS, INC"] },
    ],
  );

  it("measures the share of listed dollars reaching a named company", () => {
    const c = coverage(linked, ["AVAV", "KTOS", "RCAT", "ONDS"]);
    expect(c.linkedUsd).toBe(239_840_000);
    expect(c.linkedSharePct!).toBeCloseTo((100 * 239_840_000) / 1_294_090_000, 6);
    expect(c.tickers).toEqual(["AVAV", "KTOS"]);
  });

  it("names the curated companies with no award among those listed", () => {
    const c = coverage(linked, ["AVAV", "KTOS", "RCAT", "ONDS"]);
    expect(c.absentTickers).toEqual(["ONDS", "RCAT"]);
  });

  it("surfaces the largest recipients the theme does not name", () => {
    const c = coverage(linked, ["AVAV", "KTOS"]);
    expect(c.unlinkedLeaders.map((r) => r.name)).toEqual([
      "GENERAL ATOMICS AERONAUTICAL SYSTEMS, INC.",
      "NORTHROP GRUMMAN SYSTEMS CORPORATION",
    ]);
  });

  it("returns a null share rather than zero when nothing was listed", () => {
    const c = coverage([], ["AVAV"]);
    expect(c.linkedSharePct).toBeNull();
    expect(c.linkedUsd).toBe(0);
  });
});

describe("obligationTrend", () => {
  const series = (years: [number, number, boolean][]): ObligationSeries => ({
    years: years.map(([fiscalYear, amountUsd, partial]) => ({ fiscalYear, amountUsd, partial })),
    unavailable: null,
  });

  it("compares the two most recent COMPLETE years", () => {
    // A fiscal year eleven months old always looks like a collapse against a
    // finished one, so it is excluded while any complete pair exists.
    const t = obligationTrend(
      series([
        [2024, 2_206_000_000, false],
        [2025, 1_944_000_000, false],
        [2026, 1_555_000_000, true],
      ]),
    )!;
    expect(t.latest.fiscalYear).toBe(2025);
    expect(t.prior.fiscalYear).toBe(2024);
    expect(t.changePct).toBeCloseTo(-11.876, 2);
    expect(t.partial).toBe(false);
  });

  it("falls back to the running year only when it must, and says so", () => {
    const t = obligationTrend(
      series([
        [2025, 1_944_000_000, false],
        [2026, 1_555_000_000, true],
      ]),
    )!;
    expect(t.latest.fiscalYear).toBe(2026);
    expect(t.partial).toBe(true);
  });

  it("is null rather than infinite when the prior year was zero", () => {
    const t = obligationTrend(
      series([
        [2024, 0, false],
        [2025, 500_000, false],
      ]),
    );
    expect(t).toBeNull();
  });

  it("is null below two years", () => {
    expect(obligationTrend(series([[2025, 1, false]]))).toBeNull();
    expect(obligationTrend({ years: [], unavailable: "unreachable" })).toBeNull();
  });
});

describe("the drone theme's declared codes", () => {
  const pb = getPlaybook("drone-industrial-base")!;

  it("declares exactly the code whose recipients ARE this theme's market", () => {
    // Eight neighbouring codes were probed live and rejected on their recipient
    // lists rather than their titles: "Nuclear reactors" is naval propulsion
    // and "R&D general science" is overwhelmingly biomedical.
    expect(pb.procurement).toBeDefined();
    expect(pb.procurement!.codes).toHaveLength(1);
    expect(pb.procurement!.codes[0].path).toEqual(["Product", "15", "1550"]);
  });

  it("points its codes at a category the owner map actually covers", () => {
    const categories = pb.owners.map((o) => o.category);
    expect(categories).toContain(pb.procurement!.category);
  });

  it("only aliases tickers the owner map names for that category", () => {
    const owned = new Set(
      pb.owners.filter((o) => o.category === pb.procurement!.category).flatMap((o) => o.tickers),
    );
    for (const a of pb.procurement!.aliases) {
      expect(owned.has(a.ticker), `alias ${a.ticker} is not in the owner map`).toBe(true);
    }
  });

  it("states what the codes exclude, not only what they cover", () => {
    expect(pb.procurement!.note).toMatch(/exclude/i);
  });
});

describe("themes without procurement codes", () => {
  it("leaves the field undefined rather than declaring an empty one", () => {
    // Most themes have no federal buyer, and an empty codes array would make
    // the desk fetch nothing and render a block saying nothing.
    for (const id of ["ai-infrastructure", "homebuilding", "robotics-automation"]) {
      const pb = getPlaybook(id);
      expect(pb, id).toBeDefined();
      expect(pb!.procurement, id).toBeUndefined();
    }
  });
});
