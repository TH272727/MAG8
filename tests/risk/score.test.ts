import { describe, expect, it } from "vitest";
import type { ReturnSeries } from "../../lib/risk/returns";
import {
  assessName,
  buildPairs,
  compareNames,
  summarisePairs,
  type NameRisk,
  type ScoreOptions,
} from "../../lib/risk/score";

/* ============================================================================
 * Per-name risk and the pair table.
 * ========================================================================== */

const DATES = Array.from({ length: 30 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);

const mk = (
  ticker: string,
  values: number[],
  adjusted = true,
  dates = DATES.slice(0, values.length),
): ReturnSeries => ({ ticker, dates, values, adjusted, source: adjusted ? "yahoo" : "nasdaq" });

const wave = (n: number, amp: number, phase = 0) =>
  Array.from({ length: n }, (_, i) => amp * Math.sin(i + phase));

const OPTS: ScoreOptions = { minSessions: 10, togetherAt: 0.75, maxPairs: 50 };

const shell = (over: Partial<NameRisk>): NameRisk => ({
  ticker: "AAA",
  volPct: null,
  downsideVolPct: null,
  beta: null,
  drawdown: null,
  totalReturnPct: null,
  sessions: 0,
  from: null,
  to: null,
  adjusted: true,
  source: "yahoo",
  measured: false,
  reason: null,
  riskSharePct: null,
  inSleeve: false,
  ...over,
});

describe("assessName", () => {
  it("measures a name with enough history", () => {
    const n = assessName(mk("AAA", wave(30, 0.02)), null, OPTS);
    expect(n.measured).toBe(true);
    expect(n.reason).toBeNull();
    expect(n.volPct).toBeGreaterThan(0);
    expect(n.sessions).toBe(30);
    expect(n.from).toBe(DATES[0]);
  });

  it("says NOT MEASURED with a reason rather than reporting zero risk", () => {
    // Zero volatility is a real reading that means something else entirely, so
    // it must never be what "not enough data" looks like.
    expect(assessName(mk("AAA", []), null, OPTS).reason).toBe("no-history");
    expect(assessName(mk("AAA", wave(5, 0.02)), null, OPTS).reason).toBe("too-short");
    expect(assessName(mk("AAA", new Array(30).fill(0)), null, OPTS).reason).toBe("no-variation");
    for (const r of ["no-history", "too-short", "no-variation"] as const) {
      const n =
        r === "no-history"
          ? assessName(mk("AAA", []), null, OPTS)
          : r === "too-short"
            ? assessName(mk("AAA", wave(5, 0.02)), null, OPTS)
            : assessName(mk("AAA", new Array(30).fill(0)), null, OPTS);
      expect(n.volPct).toBeNull();
      expect(n.measured).toBe(false);
    }
  });

  it("computes beta on the pair's own overlap with the benchmark", () => {
    const bench = mk("SPY", wave(30, 0.01));
    // Only twenty of the name's sessions coincide with the benchmark's.
    const name: ReturnSeries = {
      ...mk("AAA", wave(20, 0.03)),
      dates: DATES.slice(0, 20),
    };
    const n = assessName(name, bench, OPTS);
    expect(n.beta).not.toBeNull();
  });

  it("leaves beta null when too little of the benchmark overlaps", () => {
    const bench = mk("SPY", wave(5, 0.01), true, DATES.slice(25, 30));
    const n = assessName(mk("AAA", wave(30, 0.02)), bench, OPTS);
    expect(n.measured).toBe(true);
    expect(n.beta).toBeNull();
  });
});

describe("buildPairs", () => {
  it("measures each pair on its own overlap and reports the count", () => {
    const a = mk("AAA", wave(30, 0.02));
    const b: ReturnSeries = { ...mk("BBB", wave(20, 0.02)), dates: DATES.slice(10, 30) };
    const [p] = buildPairs([a, b], OPTS);
    expect(p.sessions).toBe(20);
    expect(p.from).toBe(DATES[10]);
    expect(p.to).toBe(DATES[29]);
  });

  it("orders by correlation and cuts the weakest when capped", () => {
    const base = wave(30, 0.02);
    const pairs = buildPairs(
      [
        mk("AAA", base),
        mk("BBB", base.map((x) => x * 1.01)),
        mk("CCC", wave(30, 0.02, 1.7)),
      ],
      { ...OPTS, maxPairs: 1 },
    );
    expect(pairs).toHaveLength(1);
    expect([pairs[0].a, pairs[0].b].sort()).toEqual(["AAA", "BBB"]);
  });

  it("never lets a mixed-basis pair raise the one-position flag", () => {
    // An unadjusted leg carries each ex-dividend fall as a real one-day loss.
    // That is noise, and this flag should not be built on it.
    const base = wave(30, 0.02);
    const [p] = buildPairs([mk("AAA", base, true), mk("BBB", base, false)], OPTS);
    expect(p.r).toBeCloseTo(1, 6);
    expect(p.mixedBasis).toBe(true);
    expect(p.together).toBe(false);
  });

  it("raises the flag for the same pair once both legs share a basis", () => {
    const base = wave(30, 0.02);
    const [p] = buildPairs([mk("AAA", base, true), mk("BBB", base, true)], OPTS);
    expect(p.together).toBe(true);
  });

  it("skips a pair whose overlap is below the floor rather than reporting it thin", () => {
    const a = mk("AAA", wave(30, 0.02));
    const b: ReturnSeries = { ...mk("BBB", wave(4, 0.02)), dates: DATES.slice(26, 30) };
    expect(buildPairs([a, b], OPTS)).toEqual([]);
  });
});

describe("summarisePairs", () => {
  it("counts the companies involved, not the pairs, and reports suppressions", () => {
    const base = wave(30, 0.02);
    const pairs = buildPairs(
      [
        mk("AAA", base),
        mk("BBB", base.map((x) => x * 1.005)),
        mk("CCC", base.map((x) => x * 0.995), false),
      ],
      OPTS,
    );
    const s = summarisePairs(pairs);
    expect(s.namesInvolved).toBe(2);
    expect(s.together).toBe(1);
    expect(s.mixedBasisSuppressed).toBe(2);
  });
});

describe("compareNames", () => {
  it("ranks basket members first, then measured names, then unmeasured", () => {
    const rows = [
      shell({ ticker: "UNMEASURED", measured: false, reason: "too-short" }),
      shell({ ticker: "MEASURED", measured: true, volPct: 30 }),
      shell({ ticker: "INBASKET", measured: true, volPct: 10, inSleeve: true, riskSharePct: 5 }),
    ];
    expect([...rows].sort(compareNames).map((r) => r.ticker)).toEqual([
      "INBASKET",
      "MEASURED",
      "UNMEASURED",
    ]);
  });

  it("never lets an unmeasured name outrank a measured one on a missing figure", () => {
    const rows = [
      shell({ ticker: "NOTHING", measured: false, reason: "no-history" }),
      shell({ ticker: "QUIET", measured: true, volPct: 0.1 }),
    ];
    expect([...rows].sort(compareNames)[0].ticker).toBe("QUIET");
  });
});
