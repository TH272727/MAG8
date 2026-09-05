import { describe, expect, it } from "vitest";
import { GaugeSchema, type TideFamily, type TideGauge } from "../../lib/tide/catalog";
import type { GaugeReading } from "../../lib/tide/normalize";
import {
  buildComposite,
  computeExposure,
  postureFor,
  rankReadings,
  splitGoodBad,
  weightedComposite,
  weightFor,
  type ScoreSettings,
} from "../../lib/tide/score";

/* ============================================================================
 * The failure mode here is a composite that looks complete and is not: a
 * missing reading counted as neutral, a family weighted twice, or an exposure
 * band that quietly departs from the arithmetic the page prints beside it.
 * ========================================================================== */

const S: ScoreSettings = {
  minGaugesPerHorizon: 5,
  weightValuation: 3,
  weightPositioning: 4,
  weightSlowCredit: 2,
  weightSlowSentiment: 1,
  weightCycle: 4,
  weightLabour: 3.5,
  weightTrend: 3,
  weightCredit: 3,
  weightBreadth: 2.5,
  weightLiquidity: 2,
  weightSentiment: 1,
  exposureBase: 60,
  exposureFastPenalty: 35,
  exposureSlowPenalty: 10,
  exposureFloor: 20,
  exposureCeiling: 90,
  exposureBandWidth: 10,
};

let seq = 0;
const reading = (
  family: TideFamily,
  horizon: "fast" | "slow",
  stress: number | null,
  over: Partial<GaugeReading> = {},
): GaugeReading => {
  const gauge: TideGauge = GaugeSchema.parse({
    id: `g${seq++}`,
    label: `gauge ${seq}`,
    family,
    horizon,
    polarity: "high-is-bad",
    inputs: ["a"],
    transform: { mode: "level" },
    highMeans: "a high reading means this thing",
    lowMeans: "a low reading means this other thing",
    falsification: "this is how it could be misleading",
  });
  return {
    gauge,
    value: 1,
    rawValue: 1,
    asOf: "2026-09-01",
    percentile: stress,
    zScore: 0,
    stress,
    observations: 100,
    window: 100,
    measured: stress !== null,
    unavailable: stress === null ? "not measured" : null,
    stale: false,
    staleReason: null,
    ...over,
  };
};

describe("family weights", () => {
  it("keys on the family AND the horizon, because two families appear on both", () => {
    // The credit spread's level is a slow warning and its change is a fast one.
    // A family-only weight would have to pick one and be wrong half the time.
    expect(weightFor("credit", "slow", S)).toBe(2);
    expect(weightFor("credit", "fast", S)).toBe(3);
    expect(weightFor("sentiment", "slow", S)).toBe(1);
  });

  it("weighs a family nothing on a horizon it does not appear on", () => {
    expect(weightFor("valuation", "fast", S)).toBe(0);
    expect(weightFor("breadth", "slow", S)).toBe(0);
  });
});

describe("composites", () => {
  it("weights families rather than counting readings", () => {
    const readings = [
      reading("cycle", "fast", 100),
      reading("sentiment", "fast", 0),
      reading("sentiment", "fast", 0),
      reading("sentiment", "fast", 0),
    ];
    // Three sentiment readings at zero must not outvote one cycle reading at a
    // hundred: 4 x 100 + 1 x 0, over a total weight of 5.
    const c = buildComposite("fast", readings, S);
    expect(c.stress).toBe(80);
  });

  it("excludes an unmeasured reading rather than counting it as neutral", () => {
    const withGap = buildComposite("fast", [reading("cycle", "fast", 80), reading("cycle", "fast", null)], S);
    const without = buildComposite("fast", [reading("cycle", "fast", 80)], S);
    expect(withGap.stress).toBe(without.stress);
    expect(withGap.measuredGauges).toBe(1);
    expect(withGap.totalGauges).toBe(2);
  });

  it("redistributes an absent family's weight instead of dragging the result to the middle", () => {
    const c = buildComposite("fast", [reading("cycle", "fast", 90), reading("breadth", "fast", null)], S);
    expect(c.stress).toBe(90);
    expect(c.weightCoveragePct).toBeCloseTo((100 * 4) / 6.5, 1);
  });

  it("reports itself partial when it stands on too few readings", () => {
    const c = buildComposite("fast", [reading("cycle", "fast", 50)], S);
    expect(c.partial).toBe(true);
    expect(c.unavailable).toContain("below the 5 required");
  });

  it("excludes a stale reading from every aggregate", () => {
    const c = buildComposite("fast", [reading("cycle", "fast", 90, { stale: true })], S);
    expect(c.stress).toBeNull();
  });

  it("agrees with the shared helper the history is built from", () => {
    // Today's composite and every month of its chart must come from one
    // implementation, or the headline and the chart can disagree.
    const readings = [reading("cycle", "fast", 70), reading("labour", "fast", 30)];
    const direct = weightedComposite(
      readings.map((r) => ({ family: r.gauge.family, stress: r.stress })),
      "fast",
      S,
    );
    expect(buildComposite("fast", readings, S).stress).toBe(direct.stress);
  });
});

describe("the good against the bad", () => {
  it("splits by what a reading says today, not by what kind of reading it is", () => {
    const fast = buildComposite("fast", [reading("cycle", "fast", 80), reading("labour", "fast", 20)], S);
    const slow = buildComposite("slow", [], S);
    const gb = splitGoodBad([fast, slow]);
    expect(gb.bad).toHaveLength(1);
    expect(gb.good).toHaveLength(1);
    expect((gb.goodWeightPct ?? 0) + (gb.badWeightPct ?? 0)).toBeCloseTo(100, 1);
  });

  it("shares a family's weight among the readings that could be measured", () => {
    const fast = buildComposite(
      "fast",
      [reading("cycle", "fast", 80), reading("cycle", "fast", 80), reading("labour", "fast", 20)],
      S,
    );
    const gb = splitGoodBad([fast, buildComposite("slow", [], S)]);
    // Cycle carries 4 across two readings; labour carries 3.5 across one.
    // Each share is published to one decimal, so the sum carries that rounding.
    const cycleShare = gb.bad.reduce((n, w) => n + w.weightPct, 0);
    expect(cycleShare).toBeCloseTo((100 * 4) / 7.5, 0);
  });

  it("calls a reading exactly at its own middle neither good nor bad", () => {
    const fast = buildComposite("fast", [reading("cycle", "fast", 50)], S);
    const gb = splitGoodBad([fast, buildComposite("slow", [], S)]);
    expect(gb.good).toHaveLength(0);
    expect(gb.bad).toHaveLength(0);
    expect(gb.neutral).toHaveLength(1);
  });

  it("counts what it could not measure", () => {
    const fast = buildComposite("fast", [reading("cycle", "fast", 60), reading("cycle", "fast", null)], S);
    const gb = splitGoodBad([fast, buildComposite("slow", [], S)]);
    expect(gb.unmeasured).toBe(1);
    expect(gb.measured).toBe(1);
  });
});

describe("the exposure band", () => {
  const composite = (horizon: "fast" | "slow", stress: number | null) =>
    buildComposite(
      horizon,
      stress === null
        ? []
        : [
            reading(horizon === "fast" ? "cycle" : "valuation", horizon, stress),
            reading(horizon === "fast" ? "labour" : "positioning", horizon, stress),
            reading(horizon === "fast" ? "trend" : "credit", horizon, stress),
            reading(horizon === "fast" ? "credit" : "sentiment", horizon, stress),
            reading(horizon === "fast" ? "breadth" : "valuation", horizon, stress),
          ],
      S,
    );

  it("reproduces the published arithmetic exactly", () => {
    const e = computeExposure(composite("fast", 70), composite("slow", 60), S);
    // 60 - 35 x (70-50)/50 - 10 x (60-50)/50 = 60 - 14 - 2 = 44
    expect(e.fastPoints).toBe(-14);
    expect(e.slowPoints).toBe(-2);
    expect(e.centre).toBe(44);
    expect(e.low).toBe(39);
    expect(e.high).toBe(49);
  });

  it("moves nothing when both readings sit at their own middle", () => {
    const e = computeExposure(composite("fast", 50), composite("slow", 50), S);
    expect(e.centre).toBe(S.exposureBase);
  });

  it("lets the near-term reading dominate the long-horizon one", () => {
    // The whole point: valuation says little about the coming year, so an
    // expensive market must not be able to drive the allocation on its own.
    const valuationOnly = computeExposure(composite("fast", 50), composite("slow", 100), S);
    const cycleOnly = computeExposure(composite("fast", 100), composite("slow", 50), S);
    expect(Math.abs(cycleOnly.centre - 60)).toBeGreaterThan(Math.abs(valuationOnly.centre - 60) * 3);
  });

  it("never reaches zero, and says it was held", () => {
    const e = computeExposure(composite("fast", 100), composite("slow", 100), S);
    expect(e.centre).toBe(S.exposureFloor);
    expect(e.clampedAt).toBe("floor");
    expect(e.notes.join(" ")).toContain("does not go to zero");
  });

  it("never reaches a hundred", () => {
    const e = computeExposure(composite("fast", 0), composite("slow", 0), S);
    expect(e.centre).toBe(S.exposureCeiling);
    expect(e.clampedAt).toBe("ceiling");
  });

  it("treats a missing composite as a gap in measurement, not as a calm market", () => {
    const e = computeExposure(composite("fast", null), composite("slow", 60), S);
    expect(e.fastPoints).toBeNull();
    expect(e.partial).toBe(true);
    expect(e.notes.join(" ")).toContain("not a calm market");
  });

  it("prints every input to its own arithmetic", () => {
    const e = computeExposure(composite("fast", 70), composite("slow", 60), S);
    expect(e.workings).toContain("60% base");
    expect(e.workings).toContain("-14");
    expect(e.workings).toContain("-2");
  });
});

describe("posture", () => {
  it("comes from the same number the band does", () => {
    expect(postureFor(buildComposite("fast", [reading("cycle", "fast", 75)], S))).toBe("defensive");
    expect(postureFor(buildComposite("fast", [reading("cycle", "fast", 50)], S))).toBe("neutral");
    expect(postureFor(buildComposite("fast", [reading("cycle", "fast", 10)], S))).toBe("risk-on");
  });

  it("says so rather than guessing when there is no reading", () => {
    expect(postureFor(buildComposite("fast", [], S))).toBe("unmeasured");
  });
});

describe("ordering", () => {
  it("sorts an unmeasured reading last however calm it looks", () => {
    const rows = rankReadings([reading("cycle", "fast", null), reading("cycle", "fast", 5)]);
    expect(rows[0].stress).toBe(5);
    expect(rows[1].stress).toBeNull();
  });

  it("sorts a stale reading last too", () => {
    const rows = rankReadings([reading("cycle", "fast", 99, { stale: true }), reading("cycle", "fast", 5)]);
    expect(rows[0].stress).toBe(5);
  });
});
