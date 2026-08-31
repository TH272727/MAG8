import { describe, expect, it } from "vitest";
import {
  alignOnDate,
  lastDefinedIndex,
  percentileRankAt,
  rateOfChangeAt,
  ratioSeries,
  rollingPercentile,
  rollingZScore,
  round1,
  sma,
  wilderRsi,
} from "../../lib/rotation/math";

/* ============================================================================
 * The statistical primitives, against series whose answers are known in
 * advance. Every failure mode guarded here produces a plausible number rather
 * than an error, which is why they are worth pinning:
 *
 *   - joining two series by position instead of by date
 *   - averaging a partial window and calling it a full one
 *   - filling a gap with the previous value
 *   - a momentum reading that is not actually the published one
 * ========================================================================== */

const dv = (pairs: [string, number][]) => pairs.map(([date, close]) => ({ date, close }));

describe("alignOnDate", () => {
  it("keeps only sessions both series traded", () => {
    const a = dv([
      ["2026-05-22", 10],
      ["2026-05-25", 11],
      ["2026-05-26", 12],
    ]);
    const b = dv([
      ["2026-05-22", 5],
      ["2026-05-26", 6],
    ]);
    const out = alignOnDate(a, b);
    expect(out.dates).toEqual(["2026-05-22", "2026-05-26"]);
    expect(out.base).toEqual([10, 12]);
    expect(out.quote).toEqual([5, 6]);
  });

  it("does not shift one series against the other when a holiday differs", () => {
    // The real case: the volatility index prints on 2026-05-25 (Memorial Day)
    // and the funds do not. Zipping by position would pair the index's holiday
    // value with the fund's next session and every value after it, and no
    // downstream statistic could tell that from a real move.
    const index = dv([
      ["2026-05-21", 100],
      ["2026-05-22", 101],
      ["2026-05-25", 999],
      ["2026-05-26", 102],
      ["2026-05-27", 103],
    ]);
    const fund = dv([
      ["2026-05-21", 10],
      ["2026-05-22", 11],
      ["2026-05-26", 12],
      ["2026-05-27", 13],
    ]);
    const out = alignOnDate(index, fund);
    expect(out.dates).toEqual(["2026-05-21", "2026-05-22", "2026-05-26", "2026-05-27"]);
    expect(out.base).toEqual([100, 101, 102, 103]);
    expect(out.quote).toEqual([10, 11, 12, 13]);
    // The positional answer would have been [100,101,999,102] against [10,11,12,13].
    expect(out.base).not.toContain(999);
  });

  it("returns nothing when the two series never overlap", () => {
    const out = alignOnDate(dv([["2020-01-02", 1]]), dv([["2026-01-02", 1]]));
    expect(out.dates).toHaveLength(0);
  });
});

describe("ratioSeries", () => {
  it("divides element-wise", () => {
    expect(ratioSeries([10, 20, 30], [5, 5, 10])).toEqual([2, 4, 3]);
  });

  it("returns nothing rather than infinity for a zero denominator", () => {
    expect(ratioSeries([10], [0])).toEqual([null]);
  });
});

describe("sma", () => {
  it("is null until the window is actually full", () => {
    // A 200-day average computed from 30 days is not a 200-day average.
    const out = sma([1, 2, 3, 4, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    expect(out[2]).toBeCloseTo(2, 10);
    expect(out[4]).toBeCloseTo(4, 10);
  });

  it("refuses to average across a gap rather than bridging it", () => {
    const out = sma([1, 2, null, 4, 5, 6], 3);
    expect(out[2]).toBeNull();
    expect(out[3]).toBeNull();
    expect(out[4]).toBeNull();
    expect(out[5]).toBeCloseTo(5, 10);
  });

  it("tracks a constant series exactly", () => {
    expect(sma(new Array(10).fill(7), 5).at(-1)).toBeCloseTo(7, 10);
  });
});

describe("rollingZScore", () => {
  it("is zero at the mean and one at one sample deviation above it", () => {
    // [1..5] has mean 3 and sample deviation sqrt(2.5).
    const out = rollingZScore([1, 2, 3, 4, 5], 5);
    expect(out[4]!).toBeCloseTo((5 - 3) / Math.sqrt(2.5), 10);
  });

  it("returns nothing for a window with no dispersion", () => {
    // Every value identical: there is no standard score, and zero would be a lie.
    expect(rollingZScore([4, 4, 4, 4, 4], 5)[4]).toBeNull();
  });

  it("keeps its precision on a series that sits near a constant", () => {
    // Ratios of two broad funds live near a constant with a tiny variance, which
    // is exactly where the running-sum shortcut loses its significant digits.
    const base = 0.287;
    const values = [base, base + 1e-6, base - 1e-6, base + 2e-6, base - 2e-6, base + 3e-6];
    const out = rollingZScore(values, 6);
    expect(out[5]).not.toBeNull();
    expect(Number.isFinite(out[5]!)).toBe(true);
    expect(Math.abs(out[5]!)).toBeLessThan(5);
  });

  it("is null before the window fills", () => {
    expect(rollingZScore([1, 2, 3], 5)).toEqual([null, null, null]);
  });
});

describe("percentile", () => {
  it("puts the largest value at the top of its window", () => {
    expect(percentileRankAt([1, 2, 3, 4, 5], 5, 4)).toBe(100);
  });

  it("puts the smallest at the bottom of its window", () => {
    expect(percentileRankAt([1, 2, 3, 4, 5], 5, 0)).toBe(100); // window of one
    expect(percentileRankAt([5, 4, 3, 2, 1], 5, 4)).toBe(20);
  });

  it("ranks against the TRAILING window, not the whole series", () => {
    // The window ends at the index being ranked, so a value can sit at the top
    // of its own history and still be exceeded later. On a steadily rising
    // series every point is therefore the highest it has yet been.
    const values = Array.from({ length: 100 }, (_, i) => i);
    expect(percentileRankAt(values, 100, 49)).toBe(100);
    expect(percentileRankAt(values, 100, 99)).toBe(100);
  });

  it("reads fifty when half the window sits below the value", () => {
    const values = [1, 2, 3, 4, 6, 7, 8, 9, 10, 5];
    expect(percentileRankAt(values, 10, 9)).toBe(50);
  });

  it("computes the same value across the series as it does at a point", () => {
    const values = [3, 1, 4, 1, 5, 9, 2, 6];
    const series = rollingPercentile(values, 4);
    for (let i = 0; i < values.length; i++) {
      expect(series[i]).toBe(percentileRankAt(values, 4, i));
    }
  });
});

describe("wilderRsi", () => {
  // Wilder's original smoothing, cross-checked against a second, independent
  // implementation of the same algorithm carried at full precision. Published
  // tables round the seed average before smoothing and so run a few hundredths
  // apart in the first readings, converging afterwards.
  const CLOSES = [
    44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0,
    46.03, 46.41, 46.22, 45.64, 46.21, 46.25, 45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57, 43.42,
    42.66, 43.13,
  ];

  it("reproduces the classic worked series", () => {
    const out = wilderRsi(CLOSES, 14);
    expect(out[14]!).toBeCloseTo(70.4641, 3);
    expect(out[15]!).toBeCloseTo(66.2496, 3);
    expect(out[19]!).toBeCloseTo(57.915, 3);
    expect(out[26]!).toBeCloseTo(40.0194, 3);
    expect(out[32]!).toBeCloseTo(37.7888, 3);
  });

  it("stays inside its published range everywhere", () => {
    for (const v of wilderRsi(CLOSES, 14)) {
      if (v === null) continue;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it("is undefined until the seeding window closes", () => {
    const out = wilderRsi(CLOSES, 14);
    expect(out.slice(0, 14).every((v) => v === null)).toBe(true);
    expect(out[14]).not.toBeNull();
  });

  it("reads 100 on an unbroken advance and 0 on an unbroken decline", () => {
    const up = Array.from({ length: 20 }, (_, i) => 1 + i);
    const down = Array.from({ length: 20 }, (_, i) => 20 - i);
    expect(wilderRsi(up, 14).at(-1)).toBe(100);
    expect(wilderRsi(down, 14).at(-1)).toBe(0);
  });

  it("reads neutral on a flat series rather than dividing by zero", () => {
    expect(wilderRsi(new Array(20).fill(5), 14).at(-1)).toBe(50);
  });

  it("restarts the smoothing chain at a gap instead of bridging it", () => {
    const withGap = [...CLOSES.slice(0, 10), null, ...CLOSES.slice(11)];
    const out = wilderRsi(withGap, 14);
    // The seed must re-form after the gap, so the first reading arrives later.
    expect(out[14]).toBeNull();
    expect(out.some((v) => v !== null)).toBe(true);
  });
});

describe("rateOfChange", () => {
  it("reports a percentage move over the lookback", () => {
    expect(rateOfChangeAt([100, 0, 0, 110], 3, 3)).toBeCloseTo(10, 10);
  });

  it("returns nothing when the lookback runs off the start", () => {
    expect(rateOfChangeAt([100, 110], 5, 1)).toBeNull();
  });
});

describe("helpers", () => {
  it("finds the last computed value", () => {
    expect(lastDefinedIndex([1, 2, null])).toBe(1);
    expect(lastDefinedIndex([null, null])).toBe(-1);
  });

  it("rounds to the precision the published tiers are stated in", () => {
    expect(round1(1.25)).toBe(1.3);
    expect(round1(7.999)).toBe(8);
  });
});
