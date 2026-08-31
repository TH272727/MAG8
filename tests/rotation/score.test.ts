import { describe, expect, it } from "vitest";
import { IndicatorSchema, type Indicator } from "../../lib/rotation/catalog";
import { rankReadings, scoreIndicator, tierFor, type ScoreSettings } from "../../lib/rotation/score";

/* ============================================================================
 * The composite score, its tiers, and its direction.
 *
 * Two editorial rules are treated as behaviour here, not decoration:
 *
 *   1. The defaults must reproduce the PUBLISHED method exactly — a plain
 *      average of three components. The fourth component exists so the operator
 *      can disagree with that method later; shipping it weighted above zero
 *      would mean shipping a different method than the one documented.
 *   2. Anything that cannot be computed is null with a reason. A default score,
 *      a neutral fill or a carried-forward value would each turn "we do not
 *      know" into a number a reader would act on.
 * ========================================================================== */

const settings: ScoreSettings = {
  trendFullPct: 3,
  trendUnconfirmedFactor: 50,
  zScale: 3.3,
  rsiDivisor: 5,
  zWindowDays: 252,
  percentileWindowDays: 756,
  weightTrend: 1,
  weightStretch: 1,
  weightMomentum: 1,
  weightPercentile: 0,
  directionDeadbandPct: 0.25,
  strongTierMin: 8,
  buildingTierMin: 5,
  neutralTierMin: 3,
  minBars: 260,
  barsStaleDays: 4,
};

const NOW = new Date("2026-08-30T00:00:00Z");

/** Sessions are consecutive days here; only their order and count matter. */
function sessions(n: number, price: (i: number) => number) {
  const out: { date: string; close: number }[] = [];
  const start = Date.UTC(2021, 0, 4);
  for (let i = 0; i < n; i++) {
    out.push({ date: new Date(start + i * 86_400_000).toISOString().slice(0, 10), close: price(i) });
  }
  return out;
}

const leg = (bars: { date: string; close: number }[], over: Partial<{ source: string; adjusted: boolean }> = {}) => ({
  ticker: "T",
  bars,
  source: "yahoo",
  adjusted: true,
  ...over,
});

const indicator = (over: Partial<Indicator> = {}): Indicator =>
  IndicatorSchema.parse({
    id: "a-b",
    label: "A / B — a test pair",
    category: "breadth",
    kind: "ratio",
    base: "A",
    quote: "B",
    risingMeans: "A is leading B, which is the thing this pair exists to detect.",
    fallingMeans: "B is leading A, which is the other thing this pair exists to detect.",
    favorsBase: "Favors A — the first side",
    favorsQuote: "Favors B — the second side",
    falsification: "Wrong if the ratio crosses back and holds for several weeks.",
    sectorTicker: null,
    builtIn: true,
    ...over,
  });

/** Ratio rises steadily; the denominator is flat so the ratio is the numerator. */
const RISING = 800;
const rising = () =>
  scoreIndicator({
    indicator: indicator(),
    base: leg(sessions(RISING, (i) => 100 * 1.001 ** i)),
    quote: leg(sessions(RISING, () => 100)),
    settings,
    now: NOW,
  });

describe("availability", () => {
  it("refuses to score a series shorter than the operator's floor", () => {
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(50, () => 100)),
      quote: leg(sessions(50, () => 50)),
      settings,
      now: NOW,
    });
    expect(res.reading).toBeNull();
    expect(res.unavailable).toMatch(/below the 260 required/);
  });

  it("names the missing leg rather than failing vaguely", () => {
    const res = scoreIndicator({ indicator: indicator(), base: leg(sessions(400, () => 1)), quote: null, settings, now: NOW });
    expect(res.reading).toBeNull();
    expect(res.unavailable).toContain("B");
  });

  it("refuses when the two legs never traded on the same day", () => {
    const a = sessions(400, () => 100);
    const b = a.map((x) => ({ date: `2019-${x.date.slice(5)}`, close: 50 }));
    const res = scoreIndicator({ indicator: indicator(), base: leg(a), quote: leg(b), settings, now: NOW });
    expect(res.reading).toBeNull();
    expect(res.unavailable).toMatch(/usable session/);
  });
});

describe("the composite", () => {
  it("scores a strong, confirmed uptrend near the top of the trend component", () => {
    const r = rising().reading!;
    expect(r.components.trend).toBe(10);
    expect(r.confirmed).toBe(true);
    expect(r.direction).toBe("favors-base");
  });

  it("reproduces the published plain average of three components", () => {
    // This is the contract: at default weights the composite is (t+s+m)/3.
    const r = rising().reading!;
    const { trend, stretch, momentum } = r.components;
    const expected = Math.round(((trend! + stretch! + momentum!) / 3) * 10) / 10;
    expect(r.score).toBe(expected);
  });

  it("leaves the fourth component computed but unweighted by default", () => {
    const r = rising().reading!;
    // Present and reported...
    expect(r.percentile).not.toBeNull();
    // ...but contributing nothing, because the published method does not score it.
    expect(settings.weightPercentile).toBe(0);
    expect(r.components.percentile).toBeNull();
  });

  it("lets the operator weight the historical position in without a code change", () => {
    const withPct: ScoreSettings = { ...settings, weightPercentile: 1 };
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(RISING, (i) => 100 * 1.001 ** i)),
      quote: leg(sessions(RISING, () => 100)),
      settings: withPct,
      now: NOW,
    });
    const r = res.reading!;
    expect(r.components.percentile).not.toBeNull();
    const { trend, stretch, momentum, percentile } = r.components;
    expect(r.score).toBe(Math.round(((trend! + stretch! + momentum! + percentile!) / 4) * 10) / 10);
  });

  it("holds every component inside nought to ten", () => {
    const r = rising().reading!;
    for (const [name, v] of Object.entries(r.components)) {
      if (v === null) continue;
      expect(v, name).toBeGreaterThanOrEqual(0);
      expect(v, name).toBeLessThanOrEqual(10);
    }
  });

  it("scores a flat ratio at the bottom", () => {
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(400, () => 100)),
      quote: leg(sessions(400, () => 50)),
      settings,
      now: NOW,
    });
    const r = res.reading!;
    expect(r.components.trend).toBe(0);
    // A perfectly flat ratio has no dispersion, so there is no standard score
    // and therefore no composite — reported as such rather than as zero.
    expect(r.score).toBeNull();
  });

  it("returns no score when every weight has been set to zero", () => {
    const zeroed: ScoreSettings = {
      ...settings,
      weightTrend: 0,
      weightStretch: 0,
      weightMomentum: 0,
      weightPercentile: 0,
    };
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(RISING, (i) => 100 * 1.001 ** i)),
      quote: leg(sessions(RISING, () => 100)),
      settings: zeroed,
      now: NOW,
    });
    expect(res.reading!.score).toBeNull();
    expect(res.reading!.flags.join(" ")).toMatch(/every scoring weight/i);
  });
});

describe("tiers", () => {
  it("assigns each published band", () => {
    expect(tierFor(9, settings)).toBe("strong");
    expect(tierFor(8, settings)).toBe("strong");
    expect(tierFor(6, settings)).toBe("building");
    expect(tierFor(5, settings)).toBe("building");
    expect(tierFor(3, settings)).toBe("neutral");
    expect(tierFor(1, settings)).toBe("none");
  });

  it("closes the gaps the published bands leave open", () => {
    // The published tiers are whole-number bands, which leaves 7.5 and 4.5
    // unassigned. Every boundary is inclusive from below so nothing falls out.
    expect(tierFor(7.5, settings)).toBe("building");
    expect(tierFor(4.5, settings)).toBe("neutral");
    expect(tierFor(2.9, settings)).toBe("none");
    expect(tierFor(0, settings)).toBe("none");
  });

  it("treats an unscorable reading as no signal rather than a low one", () => {
    expect(tierFor(null, settings)).toBe("none");
  });
});

describe("direction", () => {
  it("names the actual assets rather than saying up or down", () => {
    const r = rising().reading!;
    expect(r.directionLabel).toBe("Favors A — the first side");
    expect(r.meaning).toMatch(/A is leading B/);
  });

  it("reports the other side when the ratio declines", () => {
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(RISING, (i) => 100 * 0.999 ** i)),
      quote: leg(sessions(RISING, () => 100)),
      settings,
      now: NOW,
    });
    expect(res.reading!.direction).toBe("favors-quote");
    expect(res.reading!.directionLabel).toBe("Favors B — the second side");
  });

  it("says balanced instead of picking a side on noise", () => {
    // A ratio resting on its own trend. Without the deadband this flips daily,
    // and since a flip is what raises a note, it would raise one nearly daily.
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(400, (i) => 100 + Math.sin(i / 3) * 0.02)),
      quote: leg(sessions(400, () => 100)),
      settings,
      now: NOW,
    });
    expect(res.reading!.direction).toBe("balanced");
    expect(res.reading!.directionLabel).toMatch(/Balanced/);
  });

  it("keeps a direction once the separation clears the deadband", () => {
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(400, (i) => 100 + i * 0.05)),
      quote: leg(sessions(400, () => 100)),
      settings,
      now: NOW,
    });
    expect(res.reading!.direction).toBe("favors-base");
  });
});

describe("price basis", () => {
  it("bars a ratio whose legs came from different sources from raising a signal", () => {
    // The silent failure this prevents: one leg adjusted for distributions and
    // the other not, which shifts the ratio's LEVEL against its own history.
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(RISING, (i) => 100 * 1.001 ** i)),
      quote: leg(sessions(RISING, () => 100), { source: "nasdaq", adjusted: false }),
      settings,
      now: NOW,
    });
    const r = res.reading!;
    expect(r.basis.mixed).toBe(true);
    expect(r.signalEligible).toBe(false);
    expect(r.flags.join(" ")).toMatch(/different price sources/);
    // It is still shown, with its numbers — hiding it would be its own problem.
    expect(r.score).not.toBeNull();
  });

  it("lets a matched pair raise a signal", () => {
    const r = rising().reading!;
    expect(r.basis.mixed).toBe(false);
    expect(r.signalEligible).toBe(true);
  });
});

describe("staleness", () => {
  it("flags a series whose newest session is older than the operator's window", () => {
    const res = scoreIndicator({
      indicator: indicator(),
      base: leg(sessions(RISING, (i) => 100 * 1.001 ** i)),
      quote: leg(sessions(RISING, () => 100)),
      settings,
      now: new Date("2030-01-01T00:00:00Z"),
    });
    expect(res.reading!.stale).toBe(true);
  });
});

describe("context gauges", () => {
  const vix = indicator({ id: "vix", kind: "context", base: "^VIX", quote: null, category: "volatility" });

  it("reports a level without inventing a score or a tier", () => {
    const res = scoreIndicator({
      indicator: vix,
      base: leg(sessions(400, (i) => 15 + Math.sin(i / 20))),
      quote: null,
      settings,
      now: NOW,
    });
    const r = res.reading!;
    expect(r.kind).toBe("context");
    expect(r.score).toBeNull();
    expect(r.tier).toBe("none");
    expect(r.signalEligible).toBe(false);
    expect(r.percentile).not.toBeNull();
    expect(r.flags.join(" ")).toMatch(/no score and no tier/);
  });
});

describe("history", () => {
  it("computes one entry per session it could score", () => {
    const res = rising();
    expect(res.history.length).toBeGreaterThan(0);
    expect(res.history.length).toBeLessThanOrEqual(RISING);
    expect(res.history.at(-1)!.date).toBe(res.reading!.asOf);
  });

  it("ends on the same state the reading reports", () => {
    // The chart marks come from this history; if it disagreed with the headline
    // the page would contradict itself.
    const res = rising();
    const last = res.history.at(-1)!;
    expect(last.tier).toBe(res.reading!.tier);
    expect(last.direction).toBe(res.reading!.direction);
    expect(last.score).toBe(res.reading!.score);
  });

  it("stays in chronological order", () => {
    const h = rising().history;
    expect(h.every((d, i) => i === 0 || h[i - 1].date < d.date)).toBe(true);
  });
});

describe("rankReadings", () => {
  it("puts an unscorable reading last, never among the quiet ones", () => {
    const scored = rising().reading!;
    const unscored = { ...scored, id: "x", label: "Z unscored", score: null };
    const low = { ...scored, id: "y", label: "Y low", score: 1.1 };
    const order = rankReadings([unscored, low, scored]).map((r) => r.id);
    expect(order.at(-1)).toBe("x");
  });

  it("ranks by score, strongest first", () => {
    const base = rising().reading!;
    const order = rankReadings([
      { ...base, id: "lo", score: 2 },
      { ...base, id: "hi", score: 9 },
      { ...base, id: "mid", score: 5 },
    ]).map((r) => r.id);
    expect(order).toEqual(["hi", "mid", "lo"]);
  });
});
