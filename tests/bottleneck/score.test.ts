import { describe, expect, it } from "vitest";
import type { SupplyPoint } from "../../lib/db";
import type { DemandSnapshot } from "../../lib/bottleneck/demand";
import { scoreBottlenecks, yoyGrowth, type BottleneckSnapshot } from "../../lib/bottleneck/score";
import { extractQuantity, parseFredCsv } from "../../lib/bottleneck/supply";
import { PlaybookSchema, type Playbook } from "../../lib/bottleneck/playbook";

/* ============================================================================
 * Module C. The scoring layer is pure, so the verdict a reader acts on —
 * tightening, easing, or not measurable — is fully testable without a network.
 *
 * The framework this implements insists that an EASING constraint be reported
 * as loudly as a tightening one; a tool that only ever says "squeeze starting"
 * is a bull horn. That symmetry is asserted here.
 * ========================================================================== */

const settings = {
  supplyMinPoints: 4,
  supplyStaleDays: 75,
  gapMaterialPct: 10,
  backlogSignal: true,
};

/** Monthly observations ending at `end`, growing `growthPct` a year. */
function monthly(seriesId: string, end: string, months: number, latest: number, growthPct: number): SupplyPoint[] {
  const out: SupplyPoint[] = [];
  const endDate = new Date(`${end}T00:00:00Z`);
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setUTCMonth(d.getUTCMonth() - i);
    // Compound backwards so the newest-vs-12-months-earlier ratio is exact.
    const value = latest / (1 + growthPct / 100) ** (i / 12);
    out.push({
      seriesId,
      date: d.toISOString().slice(0, 10),
      value,
      unit: "index",
      sourceUrl: null,
      origin: "api",
    });
  }
  return out;
}

const playbook: Playbook = PlaybookSchema.parse({
  id: "test",
  label: "Test theme",
  blurb: "A theme for testing.",
  demand: { basket: ["AAA"], capexTags: ["Tag"], narrativeKeywords: [] },
  conversions: {
    version: "t1",
    asOf: "2026-08",
    factors: [
      { key: "power", unit: "MW of power", usdPer: 1_000_000, source: "test", asOf: "2026-08" },
      { key: "memory", unit: "GB of memory", usdPer: 5, source: "test", asOf: "2026-08" },
    ],
  },
  supply: [
    { seriesId: "power-cap", label: "Power capacity", unit: "index", constrains: "power", connector: "fred" },
    { seriesId: "memory-cap", label: "Memory capacity", unit: "index", constrains: "memory", connector: "fred" },
  ],
  owners: [{ category: "power", label: "Power producers", tickers: ["VST"], foreign: [] }],
});

function demandWith(growthPct: number | null): DemandSnapshot {
  return {
    playbookId: "test",
    playbookLabel: "Test theme",
    takenAt: "2026-08-01T00:00:00.000Z",
    conversionVersion: "t1",
    conversionAsOf: "2026-08",
    placeholderFactors: false,
    companies: [],
    units: playbook.conversions.factors.map((f) => ({
      key: f.key,
      unit: f.unit,
      usdPer: f.usdPer,
      source: f.source,
      asOf: f.asOf,
      contributions: [],
      totalUsd: 1_000_000_000,
      totalUnits: 1000,
      growthPct,
    })),
    aggregate: { contributing: 1, basketSize: 1, latestQuarterUsd: 1e9, ttmUsd: 4e9, yoyPct: growthPct },
    flags: [],
  };
}

const NOW = new Date("2026-08-15T00:00:00Z");

const score = (demandGrowth: number | null, points: Record<string, SupplyPoint[]>, previous?: BottleneckSnapshot) =>
  scoreBottlenecks({
    playbook,
    demand: demandWith(demandGrowth),
    seriesPoints: points,
    settings,
    previous,
    now: NOW,
  });

describe("yoyGrowth", () => {
  it("measures the newest observation against one twelve months earlier", () => {
    const pts = monthly("s", "2026-07-01", 24, 110, 10);
    expect(yoyGrowth(pts).pct).toBeCloseTo(10, 6);
  });

  it("refuses a rate when history is shorter than a year", () => {
    const pts = monthly("s", "2026-07-01", 5, 110, 10);
    const r = yoyGrowth(pts);
    expect(r.pct).toBeNull();
    expect(r.note).toMatch(/twelve months/);
  });

  it("refuses a rate from a single observation", () => {
    expect(yoyGrowth(monthly("s", "2026-07-01", 1, 100, 0)).pct).toBeNull();
  });

  it("refuses a percentage off a zero base", () => {
    const pts: SupplyPoint[] = [
      { seriesId: "s", date: "2025-07-01", value: 0, unit: "i", sourceUrl: null, origin: "api" },
      { seriesId: "s", date: "2026-07-01", value: 50, unit: "i", sourceUrl: null, origin: "api" },
    ];
    expect(yoyGrowth(pts).pct).toBeNull();
  });
});

describe("constraint verdicts", () => {
  it("calls a constraint TIGHTENING when demand outruns supply", () => {
    const snap = score(85.7, {
      "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 3.8),
      "memory-cap": monthly("memory-cap", "2026-08-01", 24, 254, 17),
    });
    const power = snap.categories.find((c) => c.key === "power")!;
    expect(power.status).toBe("tightening");
    expect(power.gapPct).toBeCloseTo(81.9, 0);
    expect(power.readout).toMatch(/what a real constraint looks like/);
  });

  it("calls a constraint EASING when supply outruns demand", () => {
    // The lithium case the framework uses: demand slows, new supply lands.
    const snap = score(5, { "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 40) });
    const power = snap.categories.find((c) => c.key === "power")!;
    expect(power.status).toBe("easing");
    expect(power.gapPct).toBeLessThan(0);
    expect(power.readout).toMatch(/scarcity premium here is at risk/);
  });

  it("calls it BALANCED when the two rates track each other", () => {
    const snap = score(12, { "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 10) });
    expect(snap.categories.find((c) => c.key === "power")!.status).toBe("balanced");
  });

  it("says INSUFFICIENT-DATA rather than guessing", () => {
    const snap = score(85, {});
    for (const c of snap.categories) {
      expect(c.status).toBe("insufficient-data");
      expect(c.gapPct).toBeNull();
      expect(c.readout).toMatch(/not enough supply history/);
    }
  });

  it("refuses to score a series with too few observations", () => {
    const snap = score(85, { "power-cap": monthly("power-cap", "2026-08-01", 3, 160, 5) });
    const power = snap.categories.find((c) => c.key === "power")!;
    expect(power.status).toBe("insufficient-data");
    expect(power.series[0].note).toMatch(/at least 4 observations/);
  });

  it("excludes a stale series from scoring and says so", () => {
    // Latest observation over a year old, well past the 75-day window.
    const snap = score(85, { "power-cap": monthly("power-cap", "2025-01-01", 24, 160, 5) });
    const power = snap.categories.find((c) => c.key === "power")!;
    expect(power.series[0].stale).toBe(true);
    expect(power.supplyGrowthPct).toBeNull();
    expect(power.status).toBe("insufficient-data");
  });
});

describe("ranking", () => {
  it("puts the tightest constraint first", () => {
    const snap = score(85.7, {
      "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 3.8),
      "memory-cap": monthly("memory-cap", "2026-08-01", 24, 254, 17),
    });
    expect(snap.categories.map((c) => c.key)).toEqual(["power", "memory"]);
    expect(snap.categories[0].gapPct!).toBeGreaterThan(snap.categories[1].gapPct!);
  });

  it("sorts unmeasured categories last so a gap never reads as relaxed", () => {
    const snap = score(85, { "memory-cap": monthly("memory-cap", "2026-08-01", 24, 254, 17) });
    expect(snap.categories[0].key).toBe("memory");
    expect(snap.categories[snap.categories.length - 1].status).toBe("insufficient-data");
  });

  it("attaches the companies that own each constrained input", () => {
    const snap = score(85, { "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 3.8) });
    expect(snap.categories.find((c) => c.key === "power")!.owners?.tickers).toEqual(["VST"]);
    expect(snap.categories.find((c) => c.key === "memory")!.owners).toBeNull();
  });
});

describe("movement against the previous reading", () => {
  const prior = () =>
    score(50, { "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 10) }); // gap +40

  it("reports the change in the gap since last time", () => {
    const snap = score(85.7, { "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 3.8) }, prior());
    const power = snap.categories.find((c) => c.key === "power")!;
    expect(power.gapChangePct).toBeCloseTo(81.9 - 40, 0);
    expect(power.materialMove).toBe(true);
  });

  it("does not call a small move material", () => {
    const base = score(50, { "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 10) });
    const snap = score(52, { "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 10) }, base);
    const power = snap.categories.find((c) => c.key === "power")!;
    expect(Math.abs(power.gapChangePct!)).toBeLessThan(settings.gapMaterialPct);
    expect(power.materialMove).toBe(false);
  });

  it("says plainly that a first reading cannot show a trend", () => {
    expect(score(85, {}).flags.join(" ")).toMatch(/first reading/);
  });
});

describe("disclosures", () => {
  it("names unmeasured inputs rather than dropping them", () => {
    const flags = score(85, {}).flags.join(" ");
    expect(flags).toMatch(/no supply measurement yet/);
    expect(flags).toMatch(/not evidence that an input is unconstrained/);
  });

  it("explains that indices compare rates, never levels", () => {
    const snap = score(85, { "power-cap": monthly("power-cap", "2026-08-01", 24, 160, 3.8) });
    expect(snap.flags.join(" ")).toMatch(/RATES of change are compared/);
  });
});

describe("supply parsing", () => {
  it("reads a FRED csv and skips missing months", () => {
    const csv = "observation_date,CAPG3344S\n2026-05-01,250.0\n2026-06-01,.\n2026-07-01,254.5833\n";
    const obs = parseFredCsv(csv, "index", "https://example.test");
    expect(obs.map((o) => o.date)).toEqual(["2026-05-01", "2026-07-01"]);
    expect(obs[1].value).toBeCloseTo(254.5833, 4);
    expect(obs[0].sourceUrl).toBe("https://example.test");
  });

  it("rejects a payload that is not a FRED csv", () => {
    expect(parseFredCsv("<!DOCTYPE html><html></html>", "index", null)).toEqual([]);
    expect(parseFredCsv("", "index", null)).toEqual([]);
  });

  it("extracts a backlog quantity stated before or after the word", () => {
    expect(extractQuantity("total backlog reached 116 GW at quarter end", /GW|gigawatts?/i)?.value).toBe(116);
    expect(extractQuantity("a 116 GW order backlog", /GW|gigawatts?/i)?.value).toBe(116);
    expect(extractQuantity("backlog of 1,250.5 gigawatts", /GW|gigawatts?/i)?.value).toBeCloseTo(1250.5);
  });

  it("returns nothing rather than the wrong number when no unit is attached", () => {
    // Filings are full of unrelated figures; a loose match is worse than a gap.
    expect(extractQuantity("backlog increased substantially during the period", /GW|gigawatts?/i)).toBeNull();
    expect(extractQuantity("revenue of 116 million dollars", /GW|gigawatts?/i)).toBeNull();
  });
});
