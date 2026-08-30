import type { SupplyPoint } from "../db";
import type { BottleneckSettings } from "../bottleneck-settings";
import type { DemandSnapshot } from "./demand";
import { ownersFor, seriesFor, type Playbook } from "./playbook";

/* ============================================================================
 * Module C, part 2 — bottleneck scoring. PURE: no network, no database.
 *
 * For each physical unit the demand side computes, compare how fast the money
 * chasing it is growing against how fast the ability to supply it is growing.
 * The gap between those two rates is the score; the widest gap is the tightest
 * constraint.
 *
 * Comparing RATES, not levels, is deliberate and load-bearing. Demand arrives
 * as dollars and supply as an index or a physical quantity, so their levels are
 * not commensurable and never will be. Their rates of change are — and the rate
 * is the question anyway: not "is there enough" but "is the shortfall widening
 * or closing".
 *
 * The framework this implements is emphatic on one point, so the code enforces
 * it: a narrowing gap must be reported exactly as loudly as a widening one. A
 * tool that only ever says "squeeze starting" is a bull horn, not an instrument.
 * `easing` is a first-class verdict here, and the ranking shows both ends.
 * ========================================================================== */

export type ConstraintStatus = "tightening" | "easing" | "balanced" | "insufficient-data";

export interface SeriesReading {
  seriesId: string;
  label: string;
  unit: string;
  connector: string;
  origin: SupplyPoint["origin"] | null;
  observations: number;
  latestDate: string | null;
  latestValue: number | null;
  /** Year-over-year growth, percent. Null when the history cannot support one. */
  growthPct: number | null;
  /** True when the newest observation is older than the freshness window. */
  stale: boolean;
  stub: boolean;
  sourceUrl: string | null;
  /** Why there is no growth rate, when there isn't one. */
  note?: string;
}

export interface CategoryScore {
  key: string;
  unit: string;
  /** Physical units the demand side implies over the trailing twelve months. */
  demandUnits: number;
  demandUsd: number;
  demandGrowthPct: number | null;
  /** Best available supply growth for this unit (the freshest scoring series). */
  supplyGrowthPct: number | null;
  /** demand growth − supply growth, in percentage points. */
  gapPct: number | null;
  status: ConstraintStatus;
  /** Movement in the gap since the previous snapshot, percentage points. */
  gapChangePct: number | null;
  /** True when that movement clears the materiality threshold. */
  materialMove: boolean;
  series: SeriesReading[];
  owners: { label: string; tickers: string[]; foreign: string[] } | null;
  /** Plain-language reading a person can check against the numbers beside it. */
  readout: string;
}

export interface BottleneckSnapshot {
  playbookId: string;
  playbookLabel: string;
  takenAt: string;
  /** Demand snapshot this was scored against. */
  demandTakenAt: string;
  conversionVersion: string;
  placeholderFactors: boolean;
  /** Tightest first; categories without a score sort last. */
  categories: CategoryScore[];
  flags: string[];
}

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;

/* ----------------------------------------------------------------------------
 * Growth
 * -------------------------------------------------------------------------- */

/** Roughly a year apart, allowing for irregular publication. */
const YEAR_MS = 365 * 86_400_000;
const YEAR_TOLERANCE_MS = 60 * 86_400_000;

/**
 * Year-over-year growth from a dated series: the newest observation against the
 * one closest to twelve months before it.
 *
 * A year apart specifically, because most of these series are seasonal —
 * electricity output peaks every summer, so quarter-on-quarter would read
 * weather as a capacity change.
 */
export function yoyGrowth(points: SupplyPoint[]): { pct: number | null; note?: string } {
  if (points.length < 2) return { pct: null, note: "Only one observation stored; a rate needs at least two." };
  const latest = points[points.length - 1];
  const wanted = Date.parse(latest.date) - YEAR_MS;

  let base: SupplyPoint | null = null;
  let bestGap = Infinity;
  for (const p of points) {
    if (p.date >= latest.date) continue;
    const gap = Math.abs(Date.parse(p.date) - wanted);
    if (gap < bestGap && gap <= YEAR_TOLERANCE_MS) {
      base = p;
      bestGap = gap;
    }
  }
  if (!base) {
    return { pct: null, note: "No observation about twelve months before the latest one; history is too short." };
  }
  if (base.value <= 0) return { pct: null, note: "The year-earlier observation is zero or negative." };
  return { pct: ((latest.value - base.value) / base.value) * 100 };
}

/* ----------------------------------------------------------------------------
 * Scoring
 * -------------------------------------------------------------------------- */

/** A gap inside this band reads as balanced rather than as a real divergence. */
const BALANCED_BAND_PCT = 5;

function statusFor(gapPct: number | null): ConstraintStatus {
  if (gapPct === null) return "insufficient-data";
  if (gapPct > BALANCED_BAND_PCT) return "tightening";
  if (gapPct < -BALANCED_BAND_PCT) return "easing";
  return "balanced";
}

function readoutFor(
  status: ConstraintStatus,
  unit: string,
  demandGrowthPct: number | null,
  supplyGrowthPct: number | null,
  gapPct: number | null,
): string {
  const d = demandGrowthPct === null ? null : `${demandGrowthPct >= 0 ? "+" : ""}${round(demandGrowthPct)}%`;
  const s = supplyGrowthPct === null ? null : `${supplyGrowthPct >= 0 ? "+" : ""}${round(supplyGrowthPct)}%`;
  switch (status) {
    case "tightening":
      return `Spending on ${unit} is growing ${d} a year while the ability to supply it grows ${s} — a gap of ${round(gapPct!)} points, and widening demand against a slower-moving supply base is what a real constraint looks like.`;
    case "easing":
      return `Supply of ${unit} is growing ${s} against demand at ${d} — supply is outpacing the money chasing it by ${round(Math.abs(gapPct!))} points. Any scarcity premium here is at risk.`;
    case "balanced":
      return `Demand for ${unit} (${d}) and the capacity to supply it (${s}) are growing at close to the same rate. Nothing here says constrained.`;
    case "insufficient-data":
      return `There is not enough supply history to say whether ${unit} is constrained. The demand side is measured; the supply side is not.`;
  }
}

export interface ScoreInputs {
  playbook: Playbook;
  demand: DemandSnapshot;
  /** Stored observations by series id. */
  seriesPoints: Record<string, SupplyPoint[]>;
  settings: Pick<BottleneckSettings, "supplyMinPoints" | "supplyStaleDays" | "gapMaterialPct" | "backlogSignal">;
  /** The previous bottleneck snapshot, for the tightening/easing delta. */
  previous?: BottleneckSnapshot | null;
  now?: Date;
}

/**
 * Score every physical unit in the playbook. Pure — hand it stored observations
 * and it produces the ranking, which is what makes the verdict testable.
 */
export function scoreBottlenecks(inputs: ScoreInputs): BottleneckSnapshot {
  const { playbook: pb, demand, seriesPoints, settings } = inputs;
  const now = inputs.now ?? new Date();
  const prevByKey = new Map((inputs.previous?.categories ?? []).map((c) => [c.key, c]));

  const categories: CategoryScore[] = pb.conversions.factors.map((factor) => {
    const unitDemand = demand.units.find((u) => u.key === factor.key);
    const declared = seriesFor(pb, factor.key);

    const readings: SeriesReading[] = declared.map((s) => {
      const points = seriesPoints[s.seriesId] ?? [];
      const latest = points[points.length - 1] ?? null;
      const staleDays = latest ? (now.getTime() - Date.parse(latest.date)) / 86_400_000 : Infinity;
      const enough = points.length >= settings.supplyMinPoints;
      const growth = enough
        ? yoyGrowth(points)
        : {
            pct: null,
            note: s.stub
              ? `No automated feed for this source yet — ${points.length} observation(s) stored.`
              : `Needs at least ${settings.supplyMinPoints} observations to compute a rate; ${points.length} stored.`,
          };
      return {
        seriesId: s.seriesId,
        label: s.label,
        unit: s.unit,
        connector: s.connector,
        origin: latest?.origin ?? null,
        observations: points.length,
        latestDate: latest?.date ?? null,
        latestValue: latest?.value ?? null,
        growthPct: growth.pct === null ? null : round(growth.pct, 2),
        stale: Number.isFinite(staleDays) && staleDays > settings.supplyStaleDays,
        stub: Boolean(s.stub),
        sourceUrl: latest?.sourceUrl ?? s.sourceUrl ?? null,
        ...(growth.note ? { note: growth.note } : {}),
      };
    });

    // The freshest series that actually produced a rate speaks for this unit.
    const scoring = readings
      .filter((r) => r.growthPct !== null && !r.stale)
      .sort((a, b) => (b.latestDate ?? "").localeCompare(a.latestDate ?? ""));
    const supplyGrowthPct = scoring[0]?.growthPct ?? null;
    const demandGrowthPct = unitDemand?.growthPct ?? null;
    const gapPct =
      demandGrowthPct === null || supplyGrowthPct === null ? null : round(demandGrowthPct - supplyGrowthPct, 2);

    const prev = prevByKey.get(factor.key);
    const gapChangePct =
      gapPct !== null && prev?.gapPct !== null && prev?.gapPct !== undefined ? round(gapPct - prev.gapPct, 2) : null;

    const status = statusFor(gapPct);
    return {
      key: factor.key,
      unit: factor.unit,
      demandUnits: unitDemand?.totalUnits ?? 0,
      demandUsd: unitDemand?.totalUsd ?? 0,
      demandGrowthPct,
      supplyGrowthPct,
      gapPct,
      status,
      gapChangePct,
      materialMove: gapChangePct !== null && Math.abs(gapChangePct) >= settings.gapMaterialPct,
      series: readings,
      owners: ownersFor(pb, factor.key)
        ? {
            label: ownersFor(pb, factor.key)!.label,
            tickers: ownersFor(pb, factor.key)!.tickers,
            foreign: ownersFor(pb, factor.key)!.foreign,
          }
        : null,
      readout: readoutFor(status, factor.unit, demandGrowthPct, supplyGrowthPct, gapPct),
    };
  });

  // Tightest first; unscored categories last, so a missing measurement can
  // never masquerade as a relaxed constraint.
  categories.sort((a, b) => {
    if (a.gapPct === null && b.gapPct === null) return a.key.localeCompare(b.key);
    if (a.gapPct === null) return 1;
    if (b.gapPct === null) return -1;
    return b.gapPct - a.gapPct;
  });

  return {
    playbookId: pb.id,
    playbookLabel: pb.label,
    takenAt: now.toISOString(),
    demandTakenAt: demand.takenAt,
    conversionVersion: demand.conversionVersion,
    placeholderFactors: demand.placeholderFactors,
    categories,
    flags: scoreFlags(categories, demand, Boolean(inputs.previous)),
  };
}

/** Pure: what a reader needs in order to weigh this ranking. */
export function scoreFlags(categories: CategoryScore[], demand: DemandSnapshot, hasPrevious: boolean): string[] {
  const flags: string[] = [];

  const unscored = categories.filter((c) => c.gapPct === null);
  if (unscored.length > 0) {
    flags.push(
      `${unscored.length} of ${categories.length} constrained inputs have no supply measurement yet ` +
        `(${unscored.map((c) => c.unit).join("; ")}). They are ranked last and marked as unmeasured — ` +
        `absence of a supply series is not evidence that an input is unconstrained.`,
    );
  }

  const stale = categories.flatMap((c) => c.series.filter((s) => s.stale && s.observations > 0));
  if (stale.length > 0) {
    flags.push(
      `${stale.length} supply series have not published recently and are excluded from scoring ` +
        `(${stale.map((s) => `${s.label}, latest ${s.latestDate}`).join("; ")}).`,
    );
  }

  const stubs = categories.flatMap((c) => c.series.filter((s) => s.stub));
  if (stubs.length > 0) {
    flags.push(
      `${stubs.length} named supply sources have no automated feed yet ` +
        `(${stubs.map((s) => s.label).join("; ")}). They are listed so the gap is visible rather than omitted, ` +
        `and dated observations can be entered by hand.`,
    );
  }

  const indexed = categories.flatMap((c) => c.series.filter((s) => /index/i.test(s.unit)));
  if (indexed.length > 0) {
    flags.push(
      `Supply is measured as an index of productive capacity, not an absolute quantity, so only the RATES of ` +
        `change are compared — never the levels. A gap in percentage points says how fast the two sides are ` +
        `diverging, not how much of anything is missing.`,
    );
  }

  if (!hasPrevious) {
    flags.push(
      `This is the first reading for this theme, so nothing can be said yet about whether these constraints are ` +
        `tightening or easing. That comparison needs a second snapshot.`,
    );
  }

  if (demand.placeholderFactors) {
    flags.push(
      `The physical-unit totals come from seeded placeholder conversion factors. The growth rates and the gap ` +
        `ranking do not depend on those factors — a rate is unaffected by the constant it is divided by — but the ` +
        `absolute quantities are order-of-magnitude arithmetic.`,
    );
  }

  return flags;
}
