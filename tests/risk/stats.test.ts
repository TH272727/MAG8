import { describe, expect, it } from "vitest";
import {
  annualisedVol,
  beta,
  correlation,
  covariance,
  downsideDeviation,
  maxDrawdown,
  mean,
  stdDev,
  totalReturnPct,
  TRADING_DAYS,
} from "../../lib/risk/stats";

/* ============================================================================
 * Pure statistics. Every case here is one whose right answer can be worked out
 * by hand, so a failure points at the arithmetic and not at the fixture.
 * ========================================================================== */

describe("mean and standard deviation", () => {
  it("uses the n-1 divisor — these are samples, not populations", () => {
    // Deviations 2,1,0,1,2 -> sum of squares 10, over n-1 = 4 -> sqrt(2.5).
    expect(stdDev([1, 2, 3, 4, 5])).toBeCloseTo(Math.sqrt(2.5), 12);
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it("is null below two observations rather than zero", () => {
    expect(stdDev([1])).toBeNull();
    expect(stdDev([])).toBeNull();
    expect(mean([])).toBeNull();
  });

  it("refuses a series containing a non-finite value", () => {
    expect(stdDev([1, 2, Number.NaN])).toBeNull();
    expect(mean([1, Number.POSITIVE_INFINITY])).toBeNull();
  });
});

describe("annualisedVol", () => {
  it("scales the daily deviation by the square root of the trading year", () => {
    const daily = [0.01, -0.01, 0.01, -0.01, 0.01, -0.01];
    const sd = stdDev(daily)!;
    expect(annualisedVol(daily)).toBeCloseTo(100 * sd * Math.sqrt(TRADING_DAYS), 10);
  });

  it("is zero, not null, for a series that genuinely never moved", () => {
    // Zero volatility is a real reading. Only an unmeasurable one is null.
    expect(annualisedVol([0, 0, 0, 0])).toBe(0);
  });
});

describe("downsideDeviation", () => {
  it("measures losing days from zero, not from the sample mean", () => {
    // Only -0.02 and -0.01 contribute: sqrt((4e-4 + 1e-4)/3) annualised.
    const r = [0.05, -0.02, 0.03, -0.01];
    const expected = 100 * Math.sqrt((0.0004 + 0.0001) / 3) * Math.sqrt(TRADING_DAYS);
    expect(downsideDeviation(r)).toBeCloseTo(expected, 10);
  });

  it("is zero for a series that only ever rose", () => {
    expect(downsideDeviation([0.01, 0.02, 0.03])).toBe(0);
  });
});

describe("correlation", () => {
  it("is 1 for a series against itself and -1 against its negation", () => {
    // Not exact equality: the ratio is computed, so a perfect correlation can
    // land one unit in the last place below 1. It rounds to 1.00 at the
    // precision anything is published to, which is what matters.
    const a = [0.01, -0.02, 0.03, 0.005, -0.01];
    expect(correlation(a, a)).toBeCloseTo(1, 12);
    expect(correlation(a, a.map((x) => -x))).toBeCloseTo(-1, 12);
  });

  it("is exactly zero for two orthogonal patterns", () => {
    const a = [0.01, -0.01, 0.01, -0.01];
    const b = [0.01, 0.01, -0.01, -0.01];
    expect(correlation(a, b)).toBeCloseTo(0, 15);
  });

  it("is null — never zero — when one leg never moved", () => {
    // Reporting 0 here would read as "these are unrelated" when the truth is
    // "one of these did nothing".
    expect(correlation([0.01, -0.01, 0.02], [0, 0, 0])).toBeNull();
  });

  it("is null when the two legs are different lengths", () => {
    expect(correlation([0.01, 0.02], [0.01])).toBeNull();
  });

  it("never returns a value outside [-1, 1]", () => {
    // Floating point can push a perfect correlation a hair past the boundary.
    const a = Array.from({ length: 400 }, (_, i) => Math.sin(i) / 1000);
    const b = a.map((x) => x * 3.7);
    const r = correlation(a, b)!;
    expect(r).toBeLessThanOrEqual(1);
    expect(r).toBeGreaterThanOrEqual(-1);
    expect(r).toBeCloseTo(1, 12);
  });
});

describe("beta", () => {
  it("equals the scaling factor when the asset is a multiple of the benchmark", () => {
    const bench = [0.01, -0.02, 0.015, -0.005, 0.02];
    const asset = bench.map((x) => x * 2.5);
    expect(beta(asset, bench)).toBeCloseTo(2.5, 12);
  });

  it("agrees with rho times the ratio of deviations", () => {
    const bench = [0.01, -0.02, 0.015, -0.005, 0.02, 0.001];
    const asset = [0.03, -0.01, 0.04, -0.02, 0.01, -0.005];
    const viaRho = (correlation(asset, bench)! * stdDev(asset)!) / stdDev(bench)!;
    expect(beta(asset, bench)).toBeCloseTo(viaRho, 12);
  });

  it("is null when the benchmark did not move — not infinity", () => {
    expect(beta([0.01, -0.01], [0, 0])).toBeNull();
  });
});

describe("covariance", () => {
  it("of a series with itself is its variance", () => {
    const a = [0.01, -0.02, 0.03, 0.005];
    const sd = stdDev(a)!;
    expect(covariance(a, a)).toBeCloseTo(sd * sd, 15);
  });
});

describe("maxDrawdown", () => {
  const dates = ["2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"];

  it("finds the worst peak-to-trough fall and when it was regained", () => {
    // Wealth: 1.1, 0.55, 0.66, 0.462, 1.386. Peak 1.1 at index 0, worst
    // trough 0.462 at index 3 -> 0.462/1.1 - 1 = -58%.
    const d = maxDrawdown([0.1, -0.5, 0.2, -0.3, 2.0], dates)!;
    expect(d.depthPct).toBeCloseTo(-58, 10);
    expect(d.peakDate).toBe("2026-01-02");
    expect(d.troughDate).toBe("2026-01-07");
    expect(d.recoveredDate).toBe("2026-01-08");
    expect(d.sessionsToRecover).toBe(1);
    expect(d.underwaterAtEnd).toBe(false);
  });

  it("measures recovery against the peak, when the peak is the window's own start", () => {
    // REGRESSION. A company already falling when the window opened has its
    // high-water mark at the opening level, which no index into the RETURNS
    // array can address. Recomputing that level by compounding returns up to
    // the peak index silently included the first loss, so the recovery target
    // became the TROUGH: this series, which never regains its starting level,
    // reported that it recovered on the very next session.
    const d = maxDrawdown([-0.5, 0.2, -0.1, 0.15], dates.slice(0, 4))!;
    expect(d.depthPct).toBeCloseTo(-50, 10);
    expect(d.troughDate).toBe("2026-01-02");
    expect(d.peakAtWindowStart).toBe(true);
    expect(d.recoveredDate).toBeNull();
    expect(d.sessionsToRecover).toBeNull();
    expect(d.underwaterAtEnd).toBe(true);
  });

  it("recovers only once the peak level is genuinely regained", () => {
    // Same shape, but the final rise clears the opening level.
    const d = maxDrawdown([-0.5, 0.2, -0.1, 1.0], dates.slice(0, 4))!;
    expect(d.peakAtWindowStart).toBe(true);
    expect(d.recoveredDate).toBe("2026-01-07");
    expect(d.sessionsToRecover).toBe(3);
    expect(d.underwaterAtEnd).toBe(false);
  });

  it("marks a peak reached inside the window as not being the start", () => {
    const d = maxDrawdown([0.1, -0.5, 0.2, -0.3, 2.0], dates)!;
    expect(d.peakAtWindowStart).toBe(false);
  });

  it("reports a flat series as no drawdown rather than as unmeasurable", () => {
    const d = maxDrawdown([0, 0, 0], dates.slice(0, 3))!;
    expect(d.depthPct).toBe(0);
    expect(d.underwaterAtEnd).toBe(false);
  });

  it("is null when a return would wipe the series out entirely", () => {
    // -100% takes wealth to zero, and every ratio after it is meaningless.
    expect(maxDrawdown([-1, 0.5], dates.slice(0, 2))).toBeNull();
  });

  it("is null when dates and returns disagree in length", () => {
    expect(maxDrawdown([0.1, 0.2], ["2026-01-02"])).toBeNull();
  });
});

describe("totalReturnPct", () => {
  it("compounds rather than sums", () => {
    // 1.1 * 1.1 = 1.21, not 1.20.
    expect(totalReturnPct([0.1, 0.1])).toBeCloseTo(21, 10);
  });
});
