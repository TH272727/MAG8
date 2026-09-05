import { describe, expect, it } from "vitest";
import {
  bandFor,
  computeTideBaseRates,
  forwardChangeAt,
  independentDraws,
  type BaseRateSettings,
  type MonthlyPoint,
} from "../../lib/tide/baserates";

/* ============================================================================
 * The failure mode here is an inflated sample: a conditional figure that looks
 * well supported because the same twelve months of future were counted over
 * and over. This is the module where a flattering anecdote most easily passes
 * for a base rate.
 * ========================================================================== */

const S: BaseRateSettings = {
  baseRateHorizonMonths: 12,
  baseRateMinEpisodes: 3,
  baseRateEpisodeGapMonths: 12,
};

const months = (n: number, from = 2000): string[] =>
  Array.from({ length: n }, (_, i) => {
    const y = from + Math.floor(i / 12);
    const m = (i % 12) + 1;
    return `${y}-${String(m).padStart(2, "0")}`;
  });

const points = (keys: string[], values: number[]): MonthlyPoint[] =>
  keys.map((month, i) => ({ month, value: values[i] }));

describe("independent draws", () => {
  it("spaces every draw a full window from the last", () => {
    // Greedy from the earliest: take one, skip everything inside its window.
    expect(independentDraws([0, 1, 2, 3, 12, 13, 24], 12)).toEqual([0, 12, 24]);
  });

  it("does not merge distant visits into one long stretch", () => {
    // Proximity clustering produced a single "visit" running from February
    // 2022 to January 2025 on live data. Averaging a forward return across
    // three years of scattered months is not one observation.
    const drawn = independentDraws([0, 5, 20, 25, 40], 12);
    expect(drawn).toEqual([0, 20, 40]);
    expect(drawn.length).toBeGreaterThan(1);
  });

  it("keeps nothing when there is nothing", () => {
    expect(independentDraws([], 12)).toEqual([]);
  });
});

describe("forward change", () => {
  it("is null once the window runs past the end of the record", () => {
    // What stops the newest readings from being scored against a future that
    // has not happened yet.
    expect(forwardChangeAt([1, 2, 3], 12, 0)).toBeNull();
    expect(forwardChangeAt([100, 0, 0, 110], 3, 0)).toBeCloseTo(10, 10);
  });

  it("refuses a base at or below zero", () => {
    expect(forwardChangeAt([0, 0, 50], 2, 0)).toBeNull();
  });
});

describe("banding", () => {
  it("puts the scale into deciles and keeps the top one closed", () => {
    expect(bandFor(0).label).toBe("0-10");
    expect(bandFor(59.3).label).toBe("50-60");
    expect(bandFor(100).label).toBe("90-100");
  });
});

describe("the conditional history", () => {
  const keys = months(120);

  it("publishes the plain figure beside the conditional one", () => {
    // Knowing the market rose after readings like today's means nothing
    // without knowing what it did after every reading.
    const stress = keys.map((_, i) => (i % 24 < 12 ? 55 : 20));
    const market = keys.map((_, i) => 100 * 1.005 ** i);
    const out = computeTideBaseRates({
      composite: points(keys, stress),
      market: points(keys, market),
      settings: S,
    });
    expect(out.unconditional).not.toBeNull();
    expect(out.conditional).not.toBeNull();
    expect(out.differencePct).not.toBeNull();
  });

  it("takes the band from TODAY's reading, not from the record as a whole", () => {
    const stress = keys.map((_, i) => (i === keys.length - 1 ? 95 : 20));
    const out = computeTideBaseRates({
      composite: points(keys, stress),
      market: points(keys, keys.map((_, i) => 100 + i)),
      settings: S,
    });
    expect(out.todayStress).toBe(95);
    expect(out.band!.label).toBe("90-100");
  });

  it("reports NOT MEASURED rather than a mean of two visits", () => {
    // Today reads 95, and only two other months ever did — one of which falls
    // inside the other's window, leaving a single draw.
    const stress = keys.map((_, i) => (i === 0 || i === 1 || i === keys.length - 1 ? 95 : 20));
    const out = computeTideBaseRates({
      composite: points(keys, stress),
      market: points(keys, keys.map(() => 100)),
      settings: S,
    });
    expect(out.band!.label).toBe("90-100");
    expect(out.measured).toBe(false);
    expect(out.conditional!.episodes).toBeLessThan(S.baseRateMinEpisodes);
    expect(out.unavailable).toContain("against the 3 required");
    expect(out.differencePct).toBeNull();
  });

  it("counts draws, not qualifying months", () => {
    // Every month in a long run qualifies; only the spaced draws are evidence.
    const stress = keys.map(() => 55);
    const market = keys.map((_, i) => 100 + i);
    const out = computeTideBaseRates({
      composite: points(keys, stress),
      market: points(keys, market),
      settings: S,
    });
    expect(out.conditional!.months).toBeGreaterThan(out.conditional!.episodes * 5);
    expect(out.conditional!.episodes).toBe(Math.ceil((keys.length - 12) / 12));
  });

  it("never lets the operator space draws closer than the forward window", () => {
    // The dial may widen the spacing; narrowing it would count the same
    // future twice and quietly inflate the sample.
    const stress = keys.map(() => 55);
    const market = keys.map((_, i) => 100 + i);
    const narrowed = computeTideBaseRates({
      composite: points(keys, stress),
      market: points(keys, market),
      settings: { ...S, baseRateEpisodeGapMonths: 1 },
    });
    const honest = computeTideBaseRates({
      composite: points(keys, stress),
      market: points(keys, market),
      settings: S,
    });
    expect(narrowed.conditional!.episodes).toBe(honest.conditional!.episodes);
    expect(narrowed.overlappingWindows).toBe(false);
  });

  it("reports how much of its history it spent in this band", () => {
    // A trending reading keeps making new extremes inside its own window, so
    // a band holding most of the record is barely conditional at all.
    const stress = keys.map(() => 55);
    const market = keys.map((_, i) => 100 + i);
    const out = computeTideBaseRates({
      composite: points(keys, stress),
      market: points(keys, market),
      settings: S,
    });
    expect(out.bandSharePct).toBe(100);
  });

  it("drops a month the market has no level for rather than bridging it", () => {
    const out = computeTideBaseRates({
      composite: points(keys, keys.map(() => 55)),
      market: points(keys.slice(0, 30), keys.slice(0, 30).map((_, i) => 100 + i)),
      settings: S,
    });
    expect(out.usableMonths).toBeLessThanOrEqual(30);
  });

  it("says so rather than guessing when the record is shorter than one window", () => {
    const short = months(6);
    const out = computeTideBaseRates({
      composite: points(short, short.map(() => 55)),
      market: points(short, short.map(() => 100)),
      settings: S,
    });
    expect(out.measured).toBe(false);
    expect(out.unavailable).toContain("not");
  });

  it("measures only what followed the qualifying months", () => {
    // The market rises hard for the first half and is flat for the second.
    // Today's reading matches the FLAT half, so the conditional figure must
    // report the flat outcome and must not borrow the earlier rise.
    const stress = keys.map((_, i) => (i < 60 ? 20 : 55));
    const market = keys.map((_, i) => (i < 60 ? 100 + i * 5 : 400));
    const out = computeTideBaseRates({
      composite: points(keys, stress),
      market: points(keys, market),
      settings: S,
    });
    expect(out.band!.label).toBe("50-60");
    expect(out.conditional!.episodeMeanPct).toBeCloseTo(0, 5);
    expect(out.unconditional!.meanPct).toBeGreaterThan(0);
  });
});
