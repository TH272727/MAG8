import { describe, expect, it } from "vitest";
import { commonGrid, type ReturnSeries } from "../../lib/risk/returns";
import { atExposure, buildSleeve, covarianceMatrix } from "../../lib/risk/sleeve";
import { stdDev } from "../../lib/risk/stats";

/* ============================================================================
 * The basket. The cases here are constructed so the right answer is known in
 * closed form — orthogonal patterns give exactly N effective positions and
 * identical ones give exactly 1, whatever the sample.
 * ========================================================================== */

const DATES = ["2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07"];

const mk = (ticker: string, values: number[], dates = DATES): ReturnSeries => ({
  ticker,
  dates,
  values,
  adjusted: true,
  source: "yahoo",
});

describe("covarianceMatrix", () => {
  it("is symmetric and carries each name's variance on the diagonal", () => {
    const a = [0.01, -0.01, 0.02, -0.02];
    const b = [0.03, 0.01, -0.01, -0.03];
    const grid = commonGrid([mk("AAA", a), mk("BBB", b)], 4);
    const m = covarianceMatrix(["AAA", "BBB"], grid.columns);
    expect(m[0][1]).toBe(m[1][0]);
    expect(m[0][0]).toBeCloseTo(stdDev(a)! ** 2, 15);
    expect(m[1][1]).toBeCloseTo(stdDev(b)! ** 2, 15);
  });
});

describe("effective positions", () => {
  it("equals the member count when the members move independently", () => {
    // Two orthogonal patterns of equal magnitude: zero covariance, equal
    // volatility, so the diversification ratio is sqrt(2) and its square is 2.
    const grid = commonGrid(
      [mk("AAA", [0.01, -0.01, 0.01, -0.01]), mk("BBB", [0.01, 0.01, -0.01, -0.01])],
      4,
    );
    const sleeve = buildSleeve({ grid });
    expect(sleeve.effectivePositions).toBe(2);
  });

  it("collapses to one when every member is the same trade", () => {
    const same = [0.02, -0.01, 0.03, -0.02];
    const grid = commonGrid([mk("AAA", same), mk("BBB", same), mk("CCC", same)], 4);
    const sleeve = buildSleeve({ grid });
    expect(sleeve.tickers).toHaveLength(3);
    expect(sleeve.effectivePositions).toBe(1);
  });

  it("sits between the two when members are positively but imperfectly related", () => {
    const grid = commonGrid(
      [
        mk("AAA", [0.02, -0.01, 0.03, -0.02]),
        mk("BBB", [0.018, -0.012, 0.025, -0.015]),
        mk("CCC", [0.01, 0.005, 0.02, -0.03]),
      ],
      4,
    );
    const sleeve = buildSleeve({ grid });
    expect(sleeve.effectivePositions!).toBeGreaterThan(1);
    expect(sleeve.effectivePositions!).toBeLessThan(3);
  });

  it("can exceed the member count when the members move AGAINST each other", () => {
    // Not a bug, and not clamped. Members that hedge one another leave the
    // basket steadier than the same number of independent bets would, and that
    // is a real reading. It does mean the figure cannot be presented bare as
    // "N of M" without a word of explanation, which is why the desk raises a
    // note when it happens rather than quietly capping the number.
    const grid = commonGrid(
      [
        mk("AAA", [0.02, -0.01, 0.03, -0.02]),
        mk("BBB", [0.018, -0.012, 0.025, -0.015]),
        mk("CCC", [-0.01, 0.02, -0.005, 0.03]),
      ],
      4,
    );
    const sleeve = buildSleeve({ grid });
    expect(sleeve.effectivePositions!).toBeGreaterThan(sleeve.tickers.length);
    expect(sleeve.volPct!).toBeLessThan(sleeve.averageMemberVolPct!);
  });
});

describe("the basket's own figures", () => {
  it("is never more volatile than the average of its members", () => {
    const grid = commonGrid(
      [mk("AAA", [0.01, -0.02, 0.03, -0.01]), mk("BBB", [-0.005, 0.02, -0.01, 0.015])],
      4,
    );
    const sleeve = buildSleeve({ grid });
    expect(sleeve.volPct!).toBeLessThanOrEqual(sleeve.averageMemberVolPct!);
  });

  it("splits risk into shares that sum to the whole, up to display rounding", () => {
    // The Euler decomposition is a decomposition, not a ranking of separate
    // quantities, so a total far from 100 means the arithmetic is wrong. Each
    // share is rounded to a tenth for display, so a basket of n members can
    // total up to n twentieths away from 100 — which is why the desk never
    // invites a reader to add the column up.
    const grid = commonGrid(
      [
        mk("AAA", [0.02, -0.01, 0.03, -0.02]),
        mk("BBB", [0.005, 0.01, -0.02, 0.001]),
        mk("CCC", [-0.01, 0.02, -0.005, 0.03]),
      ],
      4,
    );
    const sleeve = buildSleeve({ grid });
    const total = sleeve.contributions.reduce((n, c) => n + (c.riskSharePct ?? 0), 0);
    expect(Math.abs(total - 100)).toBeLessThanOrEqual(0.05 * sleeve.tickers.length);
  });

  it("gives a member that moves against the rest less risk than its weight", () => {
    const grid = commonGrid(
      [
        mk("AAA", [0.02, -0.02, 0.02, -0.02]),
        mk("BBB", [0.02, -0.02, 0.02, -0.02]),
        mk("CCC", [-0.02, 0.02, -0.02, 0.02]),
      ],
      4,
    );
    const sleeve = buildSleeve({ grid });
    const ccc = sleeve.contributions.find((c) => c.ticker === "CCC")!;
    expect(ccc.excessPoints!).toBeLessThan(0);
  });

  it("returns an unmeasured basket rather than throwing on an empty grid", () => {
    const sleeve = buildSleeve({ grid: { dates: [], columns: new Map(), excluded: [] } });
    expect(sleeve.volPct).toBeNull();
    expect(sleeve.effectivePositions).toBeNull();
    expect(sleeve.contributions).toEqual([]);
  });
});

describe("the benchmark join", () => {
  const grid = commonGrid(
    [mk("AAA", [0.02, -0.01, 0.03, -0.02]), mk("BBB", [0.01, 0.01, -0.01, -0.01])],
    4,
  );

  it("measures on the sessions the basket and the benchmark share", () => {
    const sleeve = buildSleeve({
      grid,
      benchmark: { ticker: "SPY", dates: DATES, values: [0.005, -0.004, 0.006, -0.003] },
      minBenchmarkSessions: 2,
    });
    expect(sleeve.benchmarkSessions).toBe(4);
    expect(sleeve.beta).not.toBeNull();
  });

  it("still reports a beta when the benchmark's store is a few sessions behind", () => {
    // REGRESSION. The benchmark's prices come from whichever desk stored them,
    // and a desk that refreshed two days ago holds two fewer sessions. An
    // all-or-nothing join treated that lag as a total absence: the basket's
    // beta and market comparison both vanished while every individual company
    // kept its own beta, because those are computed pairwise. Nothing was
    // wrong and nothing said anything.
    const sleeve = buildSleeve({
      grid,
      benchmark: { ticker: "SPY", dates: DATES.slice(0, 2), values: [0.005, -0.004] },
      minBenchmarkSessions: 2,
    });
    expect(sleeve.benchmarkSessions).toBe(2);
    expect(sleeve.beta).not.toBeNull();
    expect(sleeve.benchmarkVolPct).not.toBeNull();
  });

  it("withholds the benchmark entirely below the shared-session floor", () => {
    const sleeve = buildSleeve({
      grid,
      benchmark: { ticker: "SPY", dates: [DATES[0]], values: [0.005] },
      minBenchmarkSessions: 3,
    });
    expect(sleeve.benchmarkSessions).toBeNull();
    expect(sleeve.beta).toBeNull();
    expect(sleeve.benchmarkVolPct).toBeNull();
  });

  it("keeps the basket's own window whatever the benchmark's is", () => {
    const sleeve = buildSleeve({
      grid,
      benchmark: { ticker: "SPY", dates: DATES.slice(0, 2), values: [0.005, -0.004] },
      minBenchmarkSessions: 2,
    });
    expect(sleeve.sessions).toBe(4);
    expect(sleeve.volPct).not.toBeNull();
  });
});

describe("atExposure", () => {
  it("scales the basket's volatility by the share held, cash being riskless", () => {
    expect(atExposure(48.5, 50)).toBeCloseTo(24.3, 10);
    expect(atExposure(48.5, 100)).toBeCloseTo(48.5, 10);
    expect(atExposure(48.5, 0)).toBe(0);
  });

  it("refuses an impossible exposure rather than extrapolating", () => {
    expect(atExposure(48.5, 120)).toBeNull();
    expect(atExposure(48.5, -1)).toBeNull();
    expect(atExposure(null, 50)).toBeNull();
  });
});
