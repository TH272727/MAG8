import { describe, expect, it } from "vitest";
import {
  closeOnOrBefore,
  computeDrawdownProfile,
  passesTurnaroundPriceFilter,
  setupScore,
  type Close,
  type PriceThresholds,
} from "../../lib/insider/drawdown";

/* ============================================================================
 * The price setup, against synthetic histories with known shapes — no live
 * calls, so these assert the arithmetic rather than the market.
 *
 * The four shapes are the ones the build document names: a clean qualifying
 * drawdown, a name that has barely moved, a multi-year fallen angel that looks
 * only moderately down against its own depressed range, and a stock still in
 * freefall. The last test in each group is the one that matters most: the same
 * history passing or failing purely because the THRESHOLDS changed, which is
 * the proof that these are somebody's risk tolerance and not this module's
 * opinion.
 * ========================================================================== */

const AS_OF = "2026-08-28";
const DAY_MS = 86_400_000;

/**
 * Build a weekday close series from anchor points given as (days before AS_OF,
 * price), linearly interpolated between them.
 */
function series(anchors: [number, number][], days = 3 * 365): Close[] {
  const sorted = [...anchors].sort((a, b) => b[0] - a[0]); // oldest first
  const priceAt = (t: number): number => {
    if (t >= sorted[0][0]) return sorted[0][1];
    if (t <= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
    for (let i = 0; i < sorted.length - 1; i++) {
      const [t0, p0] = sorted[i];
      const [t1, p1] = sorted[i + 1];
      if (t <= t0 && t >= t1) return p0 + ((p1 - p0) * (t0 - t)) / (t0 - t1);
    }
    return sorted[sorted.length - 1][1];
  };

  const end = Date.parse(`${AS_OF}T00:00:00Z`);
  const out: Close[] = [];
  for (let t = days; t >= 0; t--) {
    const d = new Date(end - t * DAY_MS);
    const dow = d.getUTCDay();
    if (dow === 0 || dow === 6) continue; // markets shut
    out.push({ date: d.toISOString().slice(0, 10), close: Number(priceAt(t).toFixed(4)) });
  }
  return out;
}

const THRESHOLDS: PriceThresholds = {
  minDrawdownPct: 2,
  maxDrawdownPct: 60,
  measureAgainst52WeekHigh: true,
  maxMonthsSinceHigh: 12,
  fallenAngelGuardPct: 80,
  requireStabilizing: true,
};

const failed = (r: ReturnType<typeof passesTurnaroundPriceFilter>): string[] =>
  r.checks.filter((c) => !c.ok).map((c) => c.key);

/* -- (a) a clean qualifying drawdown ---------------------------------------- */
// Rose to 100 four months ago, fell to 66, dipped to 63 and recovered to 65.
const CLEAN = series([
  [1095, 40],
  [121, 100],
  [120, 100],
  [20, 66],
  [10, 63],
  [0, 65],
]);

/* -- (b) barely moved ------------------------------------------------------- */
const BARELY = series([
  [1095, 60],
  [30, 100],
  [0, 99],
]);

/* -- (c) a multi-year fallen angel ------------------------------------------ */
// 100 three years ago, collapsed to 10, and inside its own last year it is only
// 20% off — the trap a one-year window cannot see.
const FALLEN_ANGEL = series([
  [1095, 100],
  [900, 100],
  [400, 10],
  [300, 10],
  [60, 8],
  [0, 8],
]);

/* -- (d) still in freefall -------------------------------------------------- */
const FREEFALL = series([
  [1095, 40],
  [120, 100],
  [112, 90],
  [56, 75],
  [0, 50],
]);

describe("computeDrawdownProfile", () => {
  it("measures a clean drawdown against both references", () => {
    const p = computeDrawdownProfile(CLEAN)!;
    expect(p.asOf).toBe(AS_OF);
    expect(p.price).toBeCloseTo(65, 1);
    expect(p.high52w).toBeCloseTo(100, 1);
    expect(p.pctOff52wHigh).toBeCloseTo(35, 0);
    expect(p.monthsSinceHigh).toBeCloseTo(4, 0);
    // The average of the last year sits between the high and today, so the
    // fall measured against it is smaller. Both are always computed.
    expect(p.pctBelow1yAvg).toBeGreaterThan(0);
    expect(p.pctBelow1yAvg).toBeLessThan(p.pctOff52wHigh);
  });

  it("finds the three-year high and low as well as the one-year ones", () => {
    const p = computeDrawdownProfile(FALLEN_ANGEL)!;
    expect(p.high3y).toBeCloseTo(100, 0);
    expect(p.high52w).toBeCloseTo(10, 0);
    // 20% off its own recent range, 92% off its three-year high.
    expect(p.pctOff52wHigh).toBeCloseTo(20, 0);
    expect(p.pctOff3yHigh).toBeCloseTo(92, 0);
  });

  it("reads a decelerating decline as steadying", () => {
    const p = computeDrawdownProfile(CLEAN)!;
    expect(p.return8w).not.toBeNull();
    expect(p.priorReturn8w).not.toBeNull();
    expect(p.decelerating).toBe(true);
    expect(p.stabilizing).toBe(true);
  });

  it("reads an accelerating decline as not steadying", () => {
    const p = computeDrawdownProfile(FREEFALL)!;
    expect(p.decelerating).toBe(false);
    // Lower every week, so today is also the four-week low — the weak half of
    // the check fails too, and only then is the stock called unsteady.
    expect(p.aboveFourWeekLow).toBe(false);
    expect(p.stabilizing).toBe(false);
  });

  it("states a short history rather than quietly measuring a shorter window", () => {
    const short = series([[200, 50], [0, 40]], 200);
    const p = computeDrawdownProfile(short)!;
    expect(p.flags.some((f) => /does not reach back three years/.test(f))).toBe(true);
    // The one-year figures are real on 200 days of history, so they are given.
    expect(p.pctOff52wHigh).toBeCloseTo(20, 0);
  });

  it("says so when the decline cannot be assessed at all", () => {
    const tiny = series([[30, 50], [0, 45]], 30);
    const p = computeDrawdownProfile(tiny)!;
    expect(p.decelerating).toBeNull();
    expect(p.flags.some((f) => /whether\s+the decline is slowing cannot be measured/.test(f))).toBe(true);
  });

  it("returns null only when there is nothing to measure", () => {
    expect(computeDrawdownProfile([])).toBeNull();
    expect(computeDrawdownProfile([{ date: "2026-01-01", close: 0 }])).toBeNull();
    expect(computeDrawdownProfile([{ date: "2026-01-01", close: Number.NaN }])).toBeNull();
  });
});

describe("closeOnOrBefore", () => {
  const bars: Close[] = [
    { date: "2026-08-24", close: 10 },
    { date: "2026-08-25", close: 11 },
    { date: "2026-08-28", close: 12 },
  ];

  it("finds the most recent close at or before a date", () => {
    expect(closeOnOrBefore(bars, "2026-08-25")!.close).toBe(11);
    // Markets were shut; the reading has to fall back rather than vanish.
    expect(closeOnOrBefore(bars, "2026-08-27")!.close).toBe(11);
    expect(closeOnOrBefore(bars, "2026-09-01")!.close).toBe(12);
  });

  it("is null before the series begins", () => {
    expect(closeOnOrBefore(bars, "2026-08-01")).toBeNull();
  });
});

describe("passesTurnaroundPriceFilter", () => {
  it("(a) passes a clean, recent, steadying drawdown", () => {
    const r = passesTurnaroundPriceFilter(computeDrawdownProfile(CLEAN)!, THRESHOLDS);
    expect(r.pass).toBe(true);
    expect(failed(r)).toEqual([]);
  });

  it("(b) fails a stock that has barely moved", () => {
    const r = passesTurnaroundPriceFilter(computeDrawdownProfile(BARELY)!, THRESHOLDS);
    expect(r.pass).toBe(false);
    expect(failed(r)).toContain("band");
  });

  it("(c) fails a multi-year fallen angel on the guard alone", () => {
    const r = passesTurnaroundPriceFilter(computeDrawdownProfile(FALLEN_ANGEL)!, THRESHOLDS);
    expect(r.pass).toBe(false);
    // The point of the case: everything a one-year window can see looks fine.
    expect(failed(r)).toEqual(["fallen-angel"]);
  });

  it("(d) fails a stock still in freefall on stabilisation alone", () => {
    const r = passesTurnaroundPriceFilter(computeDrawdownProfile(FREEFALL)!, THRESHOLDS);
    expect(r.pass).toBe(false);
    expect(failed(r)).toEqual(["stabilizing"]);
  });

  it("says which threshold each check was measured against", () => {
    const r = passesTurnaroundPriceFilter(computeDrawdownProfile(BARELY)!, THRESHOLDS);
    const band = r.checks.find((c) => c.key === "band")!;
    expect(band.detail).toContain("below its highest close of the last year");
    expect(band.detail).toContain("2.0% to 60.0%");
  });
});

describe("the thresholds are the reader's, not the module's", () => {
  const profile = computeDrawdownProfile(CLEAN)!;

  it("a tighter ceiling rejects the very same history", () => {
    // 35% off, so a band ending at 30% excludes it and one ending at 60% does not.
    expect(passesTurnaroundPriceFilter(profile, THRESHOLDS).pass).toBe(true);
    expect(passesTurnaroundPriceFilter(profile, { ...THRESHOLDS, maxDrawdownPct: 30 }).pass).toBe(false);
  });

  it("a higher floor rejects it too", () => {
    expect(passesTurnaroundPriceFilter(profile, { ...THRESHOLDS, minDrawdownPct: 40 }).pass).toBe(false);
  });

  it("switching the guard off removes the check entirely", () => {
    const angel = computeDrawdownProfile(FALLEN_ANGEL)!;
    expect(passesTurnaroundPriceFilter(angel, THRESHOLDS).pass).toBe(false);
    const off = passesTurnaroundPriceFilter(angel, { ...THRESHOLDS, fallenAngelGuardPct: 0 });
    expect(off.pass).toBe(true);
    expect(off.checks.some((c) => c.key === "fallen-angel")).toBe(false);
  });

  it("somebody who wants falling knives can have them", () => {
    const knife = computeDrawdownProfile(FREEFALL)!;
    expect(passesTurnaroundPriceFilter(knife, THRESHOLDS).pass).toBe(false);
    expect(passesTurnaroundPriceFilter(knife, { ...THRESHOLDS, requireStabilizing: false }).pass).toBe(true);
  });

  it("changing the reference changes what the band is applied to", () => {
    const off52 = passesTurnaroundPriceFilter(profile, { ...THRESHOLDS, minDrawdownPct: 30 });
    const offAvg = passesTurnaroundPriceFilter(profile, {
      ...THRESHOLDS,
      minDrawdownPct: 30,
      measureAgainst52WeekHigh: false,
    });
    // 35% below the high but much less below the year's average, so a 30%
    // floor keeps it under one reference and excludes it under the other.
    expect(off52.pass).toBe(true);
    expect(offAvg.pass).toBe(false);
    expect(offAvg.referenceLabel).toContain("average close");
  });

  it("a shorter recency window rejects a four-month-old high", () => {
    expect(passesTurnaroundPriceFilter(profile, { ...THRESHOLDS, maxMonthsSinceHigh: 2 }).pass).toBe(false);
  });
});

describe("setupScore", () => {
  it("rewards the middle of the band over either edge", () => {
    const mid = computeDrawdownProfile(series([[1095, 40], [121, 100], [20, 69], [0, 69]]))!;
    const edge = computeDrawdownProfile(series([[1095, 40], [121, 100], [20, 97], [0, 97]]))!;
    // 31% off sits near the centre of a 2-60 band; 3% off sits at its floor.
    expect(setupScore(mid, THRESHOLDS)).toBeGreaterThan(setupScore(edge, THRESHOLDS));
  });

  it("rewards a recent high over an old one", () => {
    const recent = computeDrawdownProfile(series([[1095, 40], [60, 100], [0, 69]]))!;
    const old = computeDrawdownProfile(series([[1095, 40], [340, 100], [0, 69]]))!;
    expect(setupScore(recent, THRESHOLDS)).toBeGreaterThan(setupScore(old, THRESHOLDS));
  });

  it("rewards a decline that has steadied", () => {
    expect(setupScore(computeDrawdownProfile(CLEAN)!, THRESHOLDS)).toBeGreaterThan(
      setupScore(computeDrawdownProfile(FREEFALL)!, THRESHOLDS),
    );
  });

  it("stays inside 0 to 100 whatever the shape", () => {
    for (const s of [CLEAN, BARELY, FALLEN_ANGEL, FREEFALL]) {
      const v = setupScore(computeDrawdownProfile(s)!, THRESHOLDS);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
