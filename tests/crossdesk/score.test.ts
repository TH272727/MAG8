import { describe, expect, it } from "vitest";

import type { DeskClaim, SectorContext } from "../../lib/crossdesk/claims";
import { buildLedger, compareRows, summarize, type LedgerRow } from "../../lib/crossdesk/score";

/* ============================================================================
 * Ranking the ledger. Pure — claims in, ordered rows out, no database and no
 * network. The failure this guards against is a page that quietly presents
 * hand-maintained list membership as though four desks had independently
 * measured the same company.
 * ========================================================================== */

function claim(over: Partial<DeskClaim> = {}): DeskClaim {
  return {
    desk: "pipeline",
    kind: "measured",
    ticker: "AAA",
    headline: "h",
    detail: null,
    strength: null,
    href: null,
    chip: null,
    group: null,
    constraint: null,
    ...over,
  };
}

function build(claims: DeskClaim[], over: Partial<Parameters<typeof buildLedger>[0]> = {}) {
  return buildLedger({
    claims,
    facts: new Map(),
    eligible: new Set(),
    flags: new Map(),
    contexts: new Map(),
    ...over,
  });
}

describe("buildLedger", () => {
  it("gathers every desk's claims under one company", () => {
    const rows = build([
      claim({ desk: "pipeline", ticker: "AAA" }),
      claim({ desk: "insider", ticker: "AAA" }),
      claim({ desk: "bottleneck", kind: "curated", ticker: "AAA" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].claims).toHaveLength(3);
    expect(rows[0].desks).toBe(3);
    expect(rows[0].measuredDesks).toBe(2);
  });

  it("does not split one company across casings or stray whitespace", () => {
    const rows = build([
      claim({ desk: "pipeline", ticker: "aaa" }),
      claim({ desk: "insider", ticker: " AAA " }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].ticker).toBe("AAA");
    expect(rows[0].desks).toBe(2);
  });

  it("counts one desk once however many claims it makes", () => {
    // The bottleneck desk names a company for every theme and category it
    // supplies. Three claims from one desk is not three desks agreeing.
    const rows = build([
      claim({ desk: "bottleneck", kind: "curated", ticker: "AAA" }),
      claim({ desk: "bottleneck", kind: "curated", ticker: "AAA" }),
      claim({ desk: "bottleneck", kind: "curated", ticker: "AAA" }),
    ]);
    expect(rows[0].desks).toBe(1);
    expect(rows[0].measuredDesks).toBe(0);
    expect(rows[0].claims).toHaveLength(3);
  });

  it("never counts a curated claim as a measurement", () => {
    const rows = build([claim({ desk: "bottleneck", kind: "curated", ticker: "AAA" })]);
    expect(rows[0].measuredDesks).toBe(0);
    expect(rows[0].desks).toBe(1);
  });

  it("takes the company name only from the weekly screen", () => {
    const known = build([claim({ ticker: "AAA" })], {
      facts: new Map([["AAA", { name: "Alpha Inc.", sector: "Technology", cap: 5e9 }]]),
    });
    expect(known[0].companyName).toBe("Alpha Inc.");
    expect(known[0].sector).toBe("Technology");

    const unknown = build([claim({ ticker: "ZZZ" })]);
    expect(unknown[0].companyName).toBeNull();
    expect(unknown[0].sector).toBeNull();
  });

  it("attaches neighbourhood context by sector, and none when the sector maps to nothing", () => {
    const ctx: SectorContext = {
      sector: "Technology",
      etf: "XLK",
      approximate: false,
      reason: null,
      indicatorId: "xlk-spy",
      score: 3,
      tierLabel: "neutral",
      directionLabel: "Favors XLK",
      href: "/rotation/xlk-spy",
    };
    const rows = build([claim({ ticker: "AAA" })], {
      facts: new Map([["AAA", { name: "Alpha", sector: "Technology", cap: 1 }]]),
      contexts: new Map([["Technology", ctx]]),
    });
    expect(rows[0].context?.etf).toBe("XLK");

    const orphan = build([claim({ ticker: "BBB" })], {
      facts: new Map([["BBB", { name: "Beta", sector: "Miscellaneous", cap: 1 }]]),
      contexts: new Map([["Technology", ctx]]),
    });
    expect(orphan[0].context).toBeNull();
  });

  it("carries the weekly screen's cautions without counting them as agreement", () => {
    const rows = build([claim({ ticker: "AAA" })], {
      flags: new Map([["AAA", ["runway is short"]]]),
    });
    expect(rows[0].flags).toEqual(["runway is short"]);
    expect(rows[0].desks).toBe(1);
  });
});

describe("compareRows", () => {
  const row = (over: Partial<LedgerRow>): LedgerRow => ({
    ticker: "AAA",
    companyName: null,
    sector: null,
    marketCapUsd: null,
    eligible: false,
    claims: [],
    measuredDesks: 0,
    desks: 0,
    deskKeys: [],
    groups: [],
    constraints: [],
    crossedBy: [],
    topStrength: null,
    flags: [],
    context: null,
    ...over,
  });

  it("puts measured agreement above merely being named more often", () => {
    const measured = row({ ticker: "AAA", measuredDesks: 2, desks: 2 });
    const named = row({ ticker: "BBB", measuredDesks: 0, desks: 3 });
    expect([named, measured].sort(compareRows)[0].ticker).toBe("AAA");
  });

  it("falls back to desk count, then to the strongest measured figure", () => {
    const many = row({ ticker: "AAA", measuredDesks: 1, desks: 3, topStrength: 10 });
    const few = row({ ticker: "BBB", measuredDesks: 1, desks: 2, topStrength: 90 });
    expect([few, many].sort(compareRows)[0].ticker).toBe("AAA");

    const strong = row({ ticker: "CCC", measuredDesks: 1, desks: 2, topStrength: 90 });
    const weak = row({ ticker: "DDD", measuredDesks: 1, desks: 2, topStrength: 10 });
    expect([weak, strong].sort(compareRows)[0].ticker).toBe("CCC");
  });

  it("is a total order — a row with no strength never outranks one with a figure", () => {
    const none = row({ ticker: "AAA", measuredDesks: 1, desks: 1, topStrength: null });
    const some = row({ ticker: "BBB", measuredDesks: 1, desks: 1, topStrength: 0 });
    expect([none, some].sort(compareRows)[0].ticker).toBe("BBB");
  });
});

describe("summarize", () => {
  const rows = build([
    claim({ desk: "pipeline", ticker: "AAA" }),
    claim({ desk: "bottleneck", kind: "curated", ticker: "AAA" }),
    claim({ desk: "insider", ticker: "BBB" }),
  ]);

  it("splits crossings from single-desk names without discarding either", () => {
    const s = summarize(rows, 2, 2);
    expect(s.crossed.map((r) => r.ticker)).toEqual(["AAA"]);
    expect(s.single.map((r) => r.ticker)).toEqual(["BBB"]);
    expect(s.totalNamed).toBe(2);
  });

  it("reports every desk pair, including the pairs that never agree", () => {
    const s = summarize(rows, 2, 2);
    const pair = s.pairs.find((p) => p.a === "pipeline" && p.b === "insider");
    expect(pair).toBeDefined();
    expect(pair!.shared).toBe(0);
    // Three desks can name a company, so there are three pairs — the rotation
    // board is not among them by design.
    expect(s.pairs).toHaveLength(3);
    expect(s.pairs.some((p) => p.a === "rotation" || p.b === "rotation")).toBe(false);
  });

  it("returns nothing crossed when unanimity is demanded and not met", () => {
    expect(summarize(rows, 3, 9).crossed).toHaveLength(0);
    expect(summarize(rows, 3, 9).single).toHaveLength(2);
  });
});

describe("crossing on themes rather than on desks", () => {
  /** One desk, two of its industries — a power producer that is also a nuclear operator. */
  const twoThemes = build([
    claim({
      desk: "bottleneck",
      kind: "curated",
      ticker: "CEG",
      group: "ai-infrastructure",
      constraint: "mw",
    }),
    claim({
      desk: "bottleneck",
      kind: "curated",
      ticker: "CEG",
      group: "nuclear-energy",
      constraint: "nuclear_mw",
    }),
  ]);

  /** Two industries leaning on the SAME input — one constraint, not two. */
  const sameInput = build([
    claim({
      desk: "bottleneck",
      kind: "curated",
      ticker: "MP",
      group: "drone-industrial-base",
      constraint: "ndpr_kg",
    }),
    claim({
      desk: "bottleneck",
      kind: "curated",
      ticker: "MP",
      group: "robotics-automation",
      constraint: "ndpr_kg",
    }),
  ]);

  it("counts distinct themes and distinct constrained inputs separately", () => {
    expect(twoThemes[0].groups).toEqual(["ai-infrastructure", "nuclear-energy"]);
    expect(twoThemes[0].constraints).toEqual(["mw", "nuclear_mw"]);
    expect(sameInput[0].groups).toHaveLength(2);
    expect(sameInput[0].constraints).toEqual(["ndpr_kg"]);
  });

  it("lists a two-theme company as a crossing, and says that is why", () => {
    const s = summarize(twoThemes, 2, 2);
    expect(s.crossed.map((r) => r.ticker)).toEqual(["CEG"]);
    expect(s.crossed[0].crossedBy).toEqual(["themes"]);
    expect(s.crossed[0].desks).toBe(1);
  });

  it("still counts it as one desk — two themes are not two opinions", () => {
    const s = summarize(twoThemes, 2, 2);
    expect(s.crossed[0].desks).toBe(1);
    expect(s.crossed[0].measuredDesks).toBe(0);
  });

  it("ranks a desk crossing above a theme crossing", () => {
    const mixed = build([
      claim({ desk: "pipeline", ticker: "AAA" }),
      claim({ desk: "insider", ticker: "AAA" }),
      claim({ desk: "bottleneck", kind: "curated", ticker: "CEG", group: "a", constraint: "x" }),
      claim({ desk: "bottleneck", kind: "curated", ticker: "CEG", group: "b", constraint: "y" }),
    ]);
    const s = summarize(mixed, 2, 2);
    expect(s.crossed.map((r) => r.ticker)).toEqual(["AAA", "CEG"]);
  });

  it("separates the same-input case from genuinely different inputs", () => {
    expect(summarize(sameInput, 2, 2).sharedConstraint).toBe(1);
    expect(summarize(twoThemes, 2, 2).sharedConstraint).toBe(0);
    expect(summarize([...sameInput, ...twoThemes], 2, 2).multiTheme).toBe(2);
  });

  it("marks a row that crosses on both axes with both reasons", () => {
    const both = build([
      claim({ desk: "insider", ticker: "VST" }),
      claim({ desk: "bottleneck", kind: "curated", ticker: "VST", group: "a", constraint: "x" }),
      claim({ desk: "bottleneck", kind: "curated", ticker: "VST", group: "b", constraint: "y" }),
    ]);
    expect(summarize(both, 2, 2).crossed[0].crossedBy).toEqual(["desks", "themes"]);
  });

  it("a single theme is never a crossing on its own", () => {
    const one = build([
      claim({ desk: "bottleneck", kind: "curated", ticker: "ZZZ", group: "only", constraint: "x" }),
    ]);
    const s = summarize(one, 2, 2);
    expect(s.crossed).toHaveLength(0);
    expect(s.single[0].crossedBy).toEqual([]);
  });

  it("raising the theme threshold drops the two-theme crossings", () => {
    expect(summarize(twoThemes, 2, 3).crossed).toHaveLength(0);
  });
});
