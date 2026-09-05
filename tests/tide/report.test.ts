import { describe, expect, it } from "vitest";
import { GaugeSchema, type TideFamily, type TideGauge } from "../../lib/tide/catalog";
import type { GaugeReading } from "../../lib/tide/normalize";
import { allowedNumbers, tideReport, verifyReportNumbers } from "../../lib/tide/report";
import { buildComposite, computeExposure, postureFor, splitGoodBad, type ScoreSettings } from "../../lib/tide/score";
import type { TideBoard } from "../../lib/tide/desk";

/* ============================================================================
 * A write-up is the one place a wrong number is invisible. A chart with a bad
 * point looks wrong; a sentence saying the market rose nine per cent reads
 * exactly like a sentence saying it rose seven.
 *
 * So the deterministic writer is held to its own guard here — if the thing that
 * generates the prose cannot satisfy the checker that reads it, the checker is
 * decoration.
 * ========================================================================== */

const S: ScoreSettings = {
  minGaugesPerHorizon: 2,
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
const reading = (family: TideFamily, horizon: "fast" | "slow", stress: number | null): GaugeReading => {
  const gauge: TideGauge = GaugeSchema.parse({
    id: `g${seq++}`,
    label: `Gauge ${seq}`,
    family,
    horizon,
    polarity: "high-is-bad",
    inputs: ["a"],
    transform: { mode: "level" },
    highMeans: "A high reading means the thing this gauge measures is elevated.",
    lowMeans: "A low reading means the thing this gauge measures is subdued.",
    falsification: "It could mislead because the series behind it is revised after publication.",
  });
  return {
    gauge,
    value: stress === null ? null : stress / 3,
    rawValue: stress,
    asOf: "2026-09-04",
    percentile: stress,
    zScore: 0.42,
    stress,
    observations: 349,
    window: 240,
    measured: stress !== null,
    unavailable: stress === null ? "no observations have been stored for this reading" : null,
    stale: false,
    staleReason: null,
  };
};

function board(over: Partial<TideBoard> = {}): TideBoard {
  const scored = [
    reading("cycle", "fast", 57.2),
    reading("labour", "fast", 24.4),
    reading("credit", "fast", 59.6),
    reading("trend", "fast", 25.2),
    reading("valuation", "slow", 97.7),
    reading("positioning", "slow", 79.7),
    reading("credit", "slow", 93.8),
  ];
  const fast = buildComposite("fast", scored, S);
  const slow = buildComposite("slow", scored, S);
  return {
    asOf: "2026-09-04",
    fast,
    slow,
    goodBad: splitGoodBad([fast, slow]),
    exposure: computeExposure(fast, slow, S),
    posture: postureFor(fast),
    context: [],
    readings: scored,
    unavailable: [],
    stale: [],
    baseRates: null,
    flags: ["The macroeconomic series here are revised after publication."],
    disabled: false,
    empty: false,
    ...over,
  };
}

describe("the deterministic write-up", () => {
  it("passes its own number guard", () => {
    // The point of the whole exercise. If the writer cannot satisfy the
    // checker, the checker proves nothing about anything else.
    const b = board();
    const text = tideReport(b);
    const verdict = verifyReportNumbers(text, allowedNumbers(b));
    expect(verdict.offenders).toEqual([]);
    expect(verdict.ok).toBe(true);
  });

  it("publishes both horizons and says they are not averaged", () => {
    const b = board();
    const text = tideReport(b);
    expect(text).toContain("never averaged");
    expect(text).toContain(String(b.fast.stress));
    expect(text).toContain(String(b.slow.stress));
    // And the two must genuinely differ here, or the assertion proves nothing.
    expect(b.fast.stress).not.toBe(b.slow.stress);
  });

  it("prints the exposure arithmetic in full", () => {
    const text = tideReport(board());
    expect(text).toContain("The arithmetic, in full:");
    expect(text).toContain("base");
  });

  it("always carries the disclaimer, including when there is nothing to report", () => {
    expect(tideReport(board({ empty: true }))).toContain("Not financial advice");
    expect(tideReport(board({ disabled: true }))).toContain("Not financial advice");
    expect(tideReport(board())).toContain("Not financial advice");
  });

  it("says what it could not measure rather than quietly omitting it", () => {
    const b = board({
      unavailable: [{ id: "cape", label: "A reading", reason: "nothing has been stored" }],
      stale: [{ id: "old", label: "Another", reason: "stopped publishing in 2020" }],
    });
    const text = tideReport(b);
    expect(text).toContain("not measured at all");
    expect(text).toContain("stopped");
  });
});

describe("the number guard", () => {
  const allowed = [58.19, 0.28685, 349];

  it("accepts a figure written to a coarser precision than it was computed to", () => {
    expect(verifyReportNumbers("58.2 and 58", allowed).ok).toBe(true);
  });

  it("accepts an exactly half-way figure rendered either way", () => {
    // 0.28685 is held in binary a hair BELOW itself, so rounding it to four
    // places gives 0.2868 while any writer working from the decimal writes
    // 0.2869. Both must trace back.
    expect(verifyReportNumbers("0.2868", allowed).ok).toBe(true);
    expect(verifyReportNumbers("0.2869", allowed).ok).toBe(true);
  });

  it("rejects a number that traces back to nothing", () => {
    const out = verifyReportNumbers("the market returned 412.60 per cent", allowed);
    expect(out.ok).toBe(false);
    expect(out.offenders).toContain("412.60");
  });

  it("reads a thousands separator as part of the number", () => {
    expect(verifyReportNumbers("1,349", [1349]).ok).toBe(true);
  });

  it("catches an invented figure inside a real write-up", () => {
    // Proving the guard actually bites on the text the writer produces.
    const b = board();
    const tampered = tideReport(b).replace("### The good against the bad", "### The good against the bad 7734.91");
    const verdict = verifyReportNumbers(tampered, allowedNumbers(b));
    expect(verdict.ok).toBe(false);
    expect(verdict.offenders).toContain("7734.91");
  });
});
