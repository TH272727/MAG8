import { describe, expect, it } from "vitest";
import { commonGrid, groupBars, overlap, tail, toReturns } from "../../lib/risk/returns";
import type { PriceBar } from "../../lib/db";

/* ============================================================================
 * Returns and alignment. The load-bearing rule under test throughout: series
 * are joined on DATE and never by position.
 * ========================================================================== */

const bar = (ticker: string, date: string, close: number, adjusted = true, source: "yahoo" | "nasdaq" = "yahoo"): PriceBar => ({
  ticker,
  date,
  close,
  adjusted,
  source,
});

const series = (ticker: string, dates: string[], values: number[], adjusted = true) => ({
  ticker,
  dates,
  values,
  adjusted,
  source: "yahoo" as const,
});

describe("groupBars", () => {
  it("sorts each ticker chronologically whatever order the rows arrive in", () => {
    const g = groupBars([
      bar("AAA", "2026-01-06", 12),
      bar("AAA", "2026-01-02", 10),
      bar("AAA", "2026-01-05", 11),
    ]).get("AAA")!;
    expect(g.history.bars.map((b) => b.date)).toEqual(["2026-01-02", "2026-01-05", "2026-01-06"]);
  });

  it("takes the newest row's basis and reports a ticker whose rows disagree", () => {
    const g = groupBars([
      bar("AAA", "2026-01-02", 10, true, "yahoo"),
      bar("AAA", "2026-01-05", 11, false, "nasdaq"),
    ]).get("AAA")!;
    expect(g.history.adjusted).toBe(false);
    expect(g.history.source).toBe("nasdaq");
    expect(g.mixedWithinTicker).toBe(true);
  });

  it("upper-cases the key so one company cannot become two rows", () => {
    const g = groupBars([bar("aaa", "2026-01-02", 10), bar("AAA", "2026-01-05", 11)]);
    expect([...g.keys()]).toEqual(["AAA"]);
    expect(g.get("AAA")!.history.bars).toHaveLength(2);
  });
});

describe("toReturns", () => {
  it("dates a return by the LATER close — the day the move happened", () => {
    const r = toReturns({
      ticker: "AAA",
      bars: [
        { date: "2026-01-02", close: 100 },
        { date: "2026-01-05", close: 110 },
      ],
      adjusted: true,
      source: "yahoo",
    });
    expect(r.dates).toEqual(["2026-01-05"]);
    expect(r.values[0]).toBeCloseTo(0.1, 12);
  });

  it("skips a non-positive close rather than bridging across it", () => {
    // Stitching across a hole invents one enormous move on the day data resumes.
    const r = toReturns({
      ticker: "AAA",
      bars: [
        { date: "2026-01-02", close: 100 },
        { date: "2026-01-05", close: 0 },
        { date: "2026-01-06", close: 110 },
      ],
      adjusted: true,
      source: "yahoo",
    });
    expect(r.dates).toEqual([]);
    expect(r.values).toEqual([]);
  });
});

describe("overlap", () => {
  it("joins on date, so a session one series lacks shifts nothing", () => {
    // The failure this prevents: the volatility index prints on a US market
    // holiday when the funds are shut, and a positional zip would offset one
    // series against the other from that day backwards.
    const a = series("AAA", ["2026-01-02", "2026-01-05", "2026-01-06"], [0.01, 0.02, 0.03]);
    const b = series("BBB", ["2026-01-02", "2026-01-06"], [0.1, 0.3]);
    const o = overlap(a, b);
    expect(o.dates).toEqual(["2026-01-02", "2026-01-06"]);
    expect(o.a).toEqual([0.01, 0.03]);
    expect(o.b).toEqual([0.1, 0.3]);
  });

  it("returns nothing when the two series share no dates at all", () => {
    const a = series("AAA", ["2026-01-02"], [0.01]);
    const b = series("BBB", ["2026-02-02"], [0.01]);
    expect(overlap(a, b).dates).toEqual([]);
  });
});

describe("tail", () => {
  it("keeps the most recent sessions and leaves a short series alone", () => {
    const a = series("AAA", ["d1", "d2", "d3", "d4"], [1, 2, 3, 4]);
    expect(tail(a, 2).values).toEqual([3, 4]);
    expect(tail(a, 10).values).toEqual([1, 2, 3, 4]);
  });
});

describe("commonGrid", () => {
  const dates = ["2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"];

  it("excludes a short name rather than truncating everyone to its length", () => {
    // This is the defect that got the most-viewed chart in the racing-line
    // genre fact-checked and discredited: one series had eighteen months
    // against everyone else's forty-eight, and nothing said so.
    const long1 = series("AAA", dates, [0.01, 0.02, 0.03, 0.04]);
    const long2 = series("BBB", dates, [0.02, 0.01, 0.02, 0.01]);
    const short = series("CCC", dates.slice(2), [0.05, 0.06]);

    const grid = commonGrid([long1, long2, short], 4);
    expect([...grid.columns.keys()].sort()).toEqual(["AAA", "BBB"]);
    expect(grid.dates).toEqual(dates);
    expect(grid.excluded).toEqual([{ ticker: "CCC", sessions: 2 }]);
  });

  it("names a company that clears the floor alone but not on the shared calendar", () => {
    // AAA and BBB each have four sessions, but only two in common. Both clear
    // the floor on their own record and neither survives the intersection.
    const a = series("AAA", ["d1", "d2", "d3", "d4"], [1, 2, 3, 4]);
    const b = series("BBB", ["d3", "d4", "d5", "d6"], [1, 2, 3, 4]);
    const grid = commonGrid([a, b], 4);
    expect(grid.dates).toEqual([]);
    expect(grid.columns.size).toBe(0);
    expect(grid.excluded.map((e) => e.ticker).sort()).toEqual(["AAA", "BBB"]);
    expect(grid.excluded.every((e) => e.sessions === 2)).toBe(true);
  });

  it("returns columns in the grid's own date order, not the input's", () => {
    const a = series("AAA", ["2026-01-06", "2026-01-02", "2026-01-05"], [0.03, 0.01, 0.02]);
    const b = series("BBB", ["2026-01-02", "2026-01-05", "2026-01-06"], [0.1, 0.2, 0.3]);
    const grid = commonGrid([a, b], 3);
    expect(grid.dates).toEqual(["2026-01-02", "2026-01-05", "2026-01-06"]);
    expect(grid.columns.get("AAA")).toEqual([0.01, 0.02, 0.03]);
    expect(grid.columns.get("BBB")).toEqual([0.1, 0.2, 0.3]);
  });

  it("is empty, not partial, when nothing clears the floor", () => {
    const grid = commonGrid([series("AAA", ["d1"], [1])], 5);
    expect(grid.dates).toEqual([]);
    expect(grid.excluded).toEqual([{ ticker: "AAA", sessions: 1 }]);
  });
});
