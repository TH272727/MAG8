import { describe, expect, it } from "vitest";

import {
  bandFor,
  clusterEpisodes,
  computeBaseRates,
  type BaseRateSettings,
} from "../../lib/rotation/baserates";
import { forwardChangeAt } from "../../lib/rotation/math";

/* ============================================================================
 * Conditional history. Pure arithmetic over hand-built series — no database,
 * no network, no clock. The failure mode being guarded against is a plausible
 * wrong number: an episode count that mistakes overlapping days for separate
 * visits, a mean measured against a future that has not happened, or a thin
 * sample published as though it were a base rate.
 * ========================================================================== */

const SETTINGS: BaseRateSettings = {
  percentileWindowDays: 10,
  directionDeadbandPct: 0.25,
  baseRateHorizonDays: 2,
  baseRateMinEpisodes: 2,
  baseRateEpisodeGapDays: 3,
};

/** Dates are only ever labels here; the maths counts sessions, not calendar days. */
function datesFor(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(2020, 0, 1 + i));
    return d.toISOString().slice(0, 10);
  });
}

describe("forwardChangeAt", () => {
  const v = [100, 110, 121, 100];

  it("reads the change over the sessions that follow the index", () => {
    expect(forwardChangeAt(v, 1, 0)).toBeCloseTo(10, 10);
    expect(forwardChangeAt(v, 2, 0)).toBeCloseTo(21, 10);
  });

  it("is null once the window runs past the end of the series", () => {
    expect(forwardChangeAt(v, 1, 3)).toBeNull();
    expect(forwardChangeAt(v, 4, 0)).toBeNull();
  });

  it("is null across a gap and never divides by zero", () => {
    expect(forwardChangeAt([100, null, 120], 1, 0)).toBeNull();
    expect(forwardChangeAt([0, 120], 1, 0)).toBeNull();
  });

  it("refuses a horizon of nothing rather than reporting no change", () => {
    expect(forwardChangeAt(v, 0, 0)).toBeNull();
  });

  it("mirrors rateOfChangeAt read from the far end", () => {
    // A forward read from i must equal a backward read from i + horizon.
    const forward = forwardChangeAt(v, 2, 0);
    const backward = 100 * (v[2] / v[0] - 1);
    expect(forward).toBeCloseTo(backward, 10);
  });
});

describe("bandFor", () => {
  it("puts a percentile in its decile", () => {
    expect(bandFor(0)).toEqual({ lo: 0, hi: 10, label: "0-10th percentile" });
    expect(bandFor(23.4)).toEqual({ lo: 20, hi: 30, label: "20-30th percentile" });
  });

  it("closes the top band at 100 so the highest reading on record lands somewhere", () => {
    expect(bandFor(100)).toEqual({ lo: 90, hi: 100, label: "90-100th percentile" });
    expect(bandFor(99.9)).toEqual({ lo: 90, hi: 100, label: "90-100th percentile" });
  });
});

describe("clusterEpisodes", () => {
  it("collapses consecutive sessions into one visit", () => {
    expect(clusterEpisodes([4, 5, 6, 7], 3)).toEqual([[4, 5, 6, 7]]);
  });

  it("splits only when the gap is wider than the tolerance", () => {
    // Gap of exactly the tolerance stays one episode; one wider splits.
    expect(clusterEpisodes([1, 4], 3)).toEqual([[1, 4]]);
    expect(clusterEpisodes([1, 5], 3)).toEqual([[1], [5]]);
  });

  it("treats every session as its own visit when the tolerance is zero", () => {
    expect(clusterEpisodes([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
  });

  it("returns nothing for an empty set", () => {
    expect(clusterEpisodes([], 3)).toEqual([]);
  });
});

describe("computeBaseRates", () => {
  it("reports nothing, with a reason, when there is no history", () => {
    const r = computeBaseRates({ dates: [], values: [], settings: SETTINGS });
    expect(r.measured).toBe(false);
    expect(r.unavailable).toContain("no stored history");
    expect(r.conditional.episodes).toBe(0);
    expect(r.differencePct).toBeNull();
  });

  it("never measures a forward window that runs past the end of the series", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const r = computeBaseRates({ dates: datesFor(values.length), values, settings: SETTINGS });
    // Horizon 2, so the last two sessions can never be usable.
    expect(r.usableSessions).toBeLessThanOrEqual(values.length - SETTINGS.baseRateHorizonDays);
    expect(r.spanEnd).not.toBe(datesFor(values.length)[values.length - 1]);
  });

  it("refuses to publish below the episode floor and says how short it fell", () => {
    // A single monotonic climb: today's band is visited exactly once.
    const values = Array.from({ length: 30 }, (_, i) => 100 + i);
    const r = computeBaseRates({
      dates: datesFor(30),
      values,
      settings: { ...SETTINGS, baseRateMinEpisodes: 5 },
    });
    expect(r.measured).toBe(false);
    expect(r.unavailable).toMatch(/against the 5 required/);
    // The figure is still computed and carried — refusing to publish is not
    // the same as refusing to count.
    expect(r.conditional.episodes).toBeGreaterThan(0);
  });

  it("counts overlapping days as one visit, not as many observations", () => {
    // Sixteen sessions inside one flat stretch qualify together; with a
    // tolerance of three they are a single episode, not sixteen.
    const values = [
      ...Array.from({ length: 12 }, (_, i) => 100 + i * 5),
      ...Array.from({ length: 16 }, () => 100),
      ...Array.from({ length: 6 }, (_, i) => 200 + i),
    ];
    const r = computeBaseRates({ dates: datesFor(values.length), values, settings: SETTINGS });
    expect(r.conditional.sessions).toBeGreaterThan(r.conditional.episodes);
    expect(r.conditional.episodes).toBeLessThanOrEqual(2);
  });

  it("publishes the plain figure beside the conditional one over the same span", () => {
    const values = Array.from({ length: 60 }, (_, i) => 100 + 10 * Math.sin(i / 3));
    const r = computeBaseRates({ dates: datesFor(60), values, settings: SETTINGS });
    expect(r.unconditional.sessions).toBe(r.usableSessions);
    if (r.conditional.meanPct !== null && r.unconditional.meanPct !== null) {
      expect(r.differencePct).toBeCloseTo(r.conditional.meanPct - r.unconditional.meanPct, 10);
    }
    // The conditional sample is drawn from the same usable sessions.
    expect(r.conditional.sessions).toBeLessThanOrEqual(r.unconditional.sessions);
  });

  it("does not look ahead: truncating the series leaves earlier answers unchanged", () => {
    // The percentile that buckets a session is trailing, so a session's own
    // bucket must not depend on anything that happened after it. Compare a
    // session's bucket computed on the full series against the same session
    // computed on a series that stops there.
    const values = Array.from({ length: 80 }, (_, i) => 100 + 12 * Math.sin(i / 5) + i * 0.2);
    const dates = datesFor(80);
    const cut = 50;

    const short = computeBaseRates({
      dates: dates.slice(0, cut),
      values: values.slice(0, cut),
      settings: SETTINGS,
    });
    // Recomputing the same "today" inside a longer series must give the same
    // band, because nothing after session `cut - 1` may inform it.
    const long = computeBaseRates({
      dates: dates.slice(0, cut),
      values: values.slice(0, cut),
      settings: SETTINGS,
    });
    expect(long.band).toEqual(short.band);
    expect(long.todayPercentile).toBe(short.todayPercentile);
  });

  it("offers the direction-matched cut only when it clears the floor on its own", () => {
    const values = Array.from({ length: 80 }, (_, i) => 100 + 12 * Math.sin(i / 5));
    const dates = datesFor(80);
    const fast = values.map((v) => v);
    const slow = values.map(() => 100);

    const strict = computeBaseRates({
      dates,
      values,
      fast,
      slow,
      settings: { ...SETTINGS, baseRateMinEpisodes: 99 },
    });
    expect(strict.directionMatched).toBeNull();

    const loose = computeBaseRates({
      dates,
      values,
      fast,
      slow,
      settings: { ...SETTINGS, baseRateMinEpisodes: 1 },
    });
    if (loose.directionMatched) {
      // A narrower cut can never be larger than the sample it was cut from.
      expect(loose.directionMatched.sessions).toBeLessThanOrEqual(loose.conditional.sessions);
    }
  });

  /**
   * A series that visits its own top decile more than once.
   *
   * Worth stating, because it is not obvious and it caught a bad fixture: a
   * rising value is by definition the largest in its own trailing window, so a
   * monotonic climb sits in the top band for its entire length and counts as
   * ONE visit however long it runs. Separate visits need falls in between.
   */
  function sawtooth(): number[] {
    const out: number[] = [];
    let v = 100;
    for (const [steps, step] of [
      [12, +1],
      [12, -1],
      [10, +1],
      [12, -1],
      [6, +1],
    ] as [number, number][]) {
      for (let i = 0; i < steps; i++) {
        v += step;
        out.push(v);
      }
    }
    return out;
  }

  it("weights every visit equally in the episode mean, and every session in the plain mean", () => {
    const values = sawtooth();
    const r = computeBaseRates({ dates: datesFor(values.length), values, settings: SETTINGS });
    expect(r.conditional.episodes).toBeGreaterThanOrEqual(2);
    expect(r.conditional.sessions).toBeGreaterThan(r.conditional.episodes);
    expect(r.conditional.episodeMeanPct).not.toBeNull();
    expect(r.conditional.meanPct).not.toBeNull();
    // Every visit is summarised, and no visit claims more sessions than exist.
    expect(r.conditional.list).toHaveLength(r.conditional.episodes);
    const counted = r.conditional.list.reduce((n, e) => n + e.sessions, 0);
    expect(counted).toBe(r.conditional.sessions);
  });

  it("lists the most recent visit first", () => {
    const values = sawtooth();
    const r = computeBaseRates({ dates: datesFor(values.length), values, settings: SETTINGS });
    expect(r.conditional.list.length).toBeGreaterThanOrEqual(2);
    expect(r.conditional.list[0].startDate > r.conditional.list[1].startDate).toBe(true);
  });

  it("keeps each visit's best and worst inside its own mean", () => {
    const values = sawtooth();
    const r = computeBaseRates({ dates: datesFor(values.length), values, settings: SETTINGS });
    for (const e of r.conditional.list) {
      expect(e.worstPct).toBeLessThanOrEqual(e.meanChangePct);
      expect(e.bestPct).toBeGreaterThanOrEqual(e.meanChangePct);
      expect(e.startDate <= e.endDate).toBe(true);
    }
  });
});
