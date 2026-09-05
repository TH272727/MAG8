import { describe, expect, it } from "vitest";
import { GaugeSchema, type TideGauge, type TideSeries } from "../../lib/tide/catalog";
import {
  applyTransform,
  meaningFor,
  monthEndIndices,
  prepareGauge,
  sampleOnto,
  scoreGauge,
  stressFrom,
  toMonthly,
  type Dated,
  type NormaliseSettings,
  type SeriesInput,
} from "../../lib/tide/normalize";

/* ============================================================================
 * The failure mode here is a number that is arithmetically correct and means
 * the opposite of what the page says it means. Nothing touches the network or
 * the database.
 * ========================================================================== */

const SETTINGS: NormaliseSettings = {
  percentileWindowYears: 20,
  zBlendPct: 0,
  minObservations: 12,
};

const gauge = (over: Partial<TideGauge> = {}): TideGauge =>
  GaugeSchema.parse({
    id: "g",
    label: "A gauge",
    family: "cycle",
    horizon: "fast",
    polarity: "high-is-bad",
    inputs: ["a"],
    transform: { mode: "level" },
    highMeans: "the reading is high and that is what high means",
    lowMeans: "the reading is low and that is what low means",
    falsification: "it could be misleading for this stated reason",
    ...over,
  });

const monthly = (start: string, values: number[]): Dated[] => {
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7));
  return values.map((value) => {
    const date = `${y}-${String(m).padStart(2, "0")}-01`;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    return { date, value };
  });
};

const series = (over: Partial<TideSeries> = {}): TideSeries => ({
  id: "a",
  label: "A",
  connector: "fred",
  handle: "A",
  unit: "percent",
  frequency: "monthly",
  publisher: "P",
  sourceUrl: null,
  staleAfterDays: 70,
  builtIn: true,
  ...over,
});

const input = (id: string, obs: Dated[], over: Partial<TideSeries> = {}): [string, SeriesInput] => [
  id,
  { series: series({ id, ...over }), observations: obs },
];

describe("sampling one series onto another's dates", () => {
  it("takes the most recent observation on or before each date", () => {
    const source: Dated[] = [
      { date: "2026-01-01", value: 10 },
      { date: "2026-04-01", value: 20 },
    ];
    expect(sampleOnto(source, ["2026-03-15", "2026-04-01", "2026-05-01"], 200)).toEqual([10, 20, 20]);
  });

  it("never reads forward", () => {
    const source: Dated[] = [{ date: "2026-06-01", value: 99 }];
    expect(sampleOnto(source, ["2026-01-01"], 200)).toEqual([null]);
  });

  it("stops sampling a leg that has gone quiet", () => {
    // Otherwise a dead series is carried forward for ever and every ratio
    // built on it keeps reporting a number.
    const source: Dated[] = [{ date: "2020-01-01", value: 5 }];
    expect(sampleOnto(source, ["2026-01-01"], 200)).toEqual([null]);
  });
});

describe("transforms", () => {
  const v = (xs: (number | null)[]) => xs;

  it("refuses a percent change off a base at or below zero", () => {
    // A series that crosses zero has no meaningful percent change, and the
    // number it would produce looks perfectly ordinary.
    const out = applyTransform(v([-1, 2, 4]), { mode: "changePct", periods: 1 });
    expect(out).toEqual([null, null, 100]);
  });

  it("computes an arithmetic change for a series that may go negative", () => {
    expect(applyTransform(v([-1, 2]), { mode: "change", periods: 1 })).toEqual([null, 3]);
  });

  it("measures the rise off a trailing low", () => {
    const out = applyTransform(v([4, 3.5, 3.6, 4.2]), { mode: "riseFromTrailingLow", window: 3 });
    expect(out[0]).toBeNull();
    expect(out[1]).toBeNull();
    expect(out[2]).toBeCloseTo(0.1, 10);
    expect(out[3]).toBeCloseTo(0.7, 10);
  });

  it("reports the depth of a trailing low as a positive number", () => {
    // This is what lets an inversion carry a single unarguable polarity: the
    // gauge reads HIGH when the underlying series went deeply negative.
    const out = applyTransform(v([1, -0.5, 0.8]), { mode: "depthOfTrailingLow", window: 3 });
    expect(out[2]).toBeCloseTo(0.5, 10);
  });

  it("returns null until a window is fully populated", () => {
    // A minimum over half a window is a different statistic, and on a rising
    // series it is systematically the wrong one.
    const out = applyTransform(v([1, 2, 3]), { mode: "riseFromTrailingLow", window: 5 });
    expect(out.every((x) => x === null)).toBe(true);
  });

  it("does not bridge a gap", () => {
    const out = applyTransform(v([1, null, 3]), { mode: "change", periods: 1 });
    expect(out).toEqual([null, null, null]);
  });
});

describe("combining two series", () => {
  it("evaluates a ratio on the LOWER frequency leg's dates", () => {
    // A daily numerator over a quarterly denominator would invent a
    // denominator for every day between publications.
    const daily: Dated[] = Array.from({ length: 120 }, (_, i) => ({
      date: `2026-0${1 + Math.floor(i / 40)}-${String((i % 28) + 1).padStart(2, "0")}`,
      value: 100 + i,
    }));
    const quarterly: Dated[] = [{ date: "2026-01-01", value: 50 }];
    const prepared = prepareGauge(
      gauge({ inputs: ["fast", "slow"], combine: "ratio" }),
      new Map([
        input("fast", daily, { frequency: "daily" }),
        input("slow", quarterly, { frequency: "quarterly" }),
      ]),
    );
    expect(prepared.frequency).toBe("quarterly");
    expect(prepared.dates).toEqual(["2026-01-01"]);
  });

  it("keeps the catalogue's numerator and denominator order whichever leg is sampled", () => {
    const prepared = prepareGauge(
      gauge({ inputs: ["num", "den"], combine: "ratio" }),
      new Map([
        input("num", monthly("2026-01", [10, 20]), { frequency: "monthly" }),
        input("den", monthly("2026-01", [2, 4]), { frequency: "monthly" }),
      ]),
    );
    expect(prepared.raw).toEqual([5, 5]);
  });

  it("says which input is missing rather than reporting nothing", () => {
    const prepared = prepareGauge(
      gauge({ inputs: ["a", "b"], combine: "ratio" }),
      new Map([input("a", monthly("2026-01", [1, 2]))]),
    );
    expect(prepared.unavailable).toContain("b");
  });
});

describe("stress", () => {
  it("points the same percentile two ways by polarity", () => {
    expect(stressFrom(90, null, "high-is-bad", 0)).toBe(90);
    expect(stressFrom(90, null, "high-is-good", 0)).toBe(10);
  });

  it("is null when the reading could not be placed in its history", () => {
    // Never zero, never fifty: an unplaceable reading is not a middling one.
    expect(stressFrom(null, 1, "high-is-bad", 0)).toBeNull();
  });

  it("refuses to blend a standard score it does not have", () => {
    expect(stressFrom(90, null, "high-is-bad", 50)).toBeNull();
  });
});

describe("scoring a gauge", () => {
  const prepare = (values: number[], over: Partial<TideGauge> = {}) =>
    toMonthly(prepareGauge(gauge(over), new Map([input("a", monthly("2000-01", values))])));

  it("scores the newest reading against its own past", () => {
    const rising = Array.from({ length: 60 }, (_, i) => i);
    const r = scoreGauge(prepare(rising), { settings: SETTINGS });
    expect(r.measured).toBe(true);
    expect(r.percentile).toBe(100);
    expect(r.stress).toBe(100);
    expect(r.asOf).toBe("2004-12-01");
  });

  it("refuses to judge a reading with too little history of its own", () => {
    const r = scoreGauge(prepare([1, 2, 3]), { settings: SETTINGS });
    expect(r.measured).toBe(false);
    expect(r.stress).toBeNull();
    expect(r.unavailable).toContain("3 usable observation");
  });

  it("narrows the window to the history that exists rather than refusing", () => {
    const r = scoreGauge(prepare(Array.from({ length: 30 }, (_, i) => i)), { settings: SETTINGS });
    expect(r.measured).toBe(true);
    expect(r.window).toBe(30);
    expect(r.observations).toBe(30);
  });

  it("produces a history whose last point is the reading on the board", () => {
    // One code path. If today's score were windowed differently from its own
    // chart the two could disagree and nobody would ever track it down.
    const r = scoreGauge(prepare(Array.from({ length: 60 }, (_, i) => (i * 7) % 23)), {
      settings: SETTINGS,
      withHistory: true,
    });
    const last = r.history![r.history!.length - 1];
    expect(last.stress).toBe(r.stress);
    expect(last.date).toBe(r.asOf);
  });
});

describe("the sentence beside the number", () => {
  it("describes the market, not the score", () => {
    // The build wrote "the index is below its ten-month average" as a
    // favourable reading while the market sat near a record, because the prose
    // was chosen by stress and a reassuring 25 looked low. On a gauge where
    // high is good, low stress means a HIGH reading.
    const good = gauge({ polarity: "high-is-good" });
    expect(meaningFor({ gauge: good, percentile: 90 })).toBe(good.highMeans);
    expect(stressFrom(90, null, "high-is-good", 0)).toBe(10);
    expect(meaningFor({ gauge: good, percentile: 10 })).toBe(good.lowMeans);
  });

  it("falls back to the high reading when there is no percentile", () => {
    const g = gauge();
    expect(meaningFor({ gauge: g, percentile: null })).toBe(g.highMeans);
  });
});

describe("the monthly grid", () => {
  it("keeps the last observation of each month", () => {
    expect(monthEndIndices(["2026-01-02", "2026-01-30", "2026-02-01"])).toEqual([1, 2]);
  });

  it("keeps the real observation date rather than a month end", () => {
    const prepared = toMonthly(
      prepareGauge(
        gauge(),
        new Map([
          input("a", [
            { date: "2026-01-03", value: 1 },
            { date: "2026-02-03", value: 2 },
          ]),
        ]),
      ),
    );
    expect(prepared.dates).toEqual(["2026-01-03", "2026-02-03"]);
    expect(prepared.frequency).toBe("monthly");
  });
});
