import type { TideSettings } from "../tide-settings";
import { TIDE_FAMILIES, type TideFamily, type TideHorizon } from "./catalog";
import { round1, type GaugeReading } from "./normalize";

/* ============================================================================
 * From readings to a posture. PURE.
 *
 * No network, no database, no clock. Everything here is a function of the
 * readings handed in and the operator's weights.
 *
 * TWO COMPOSITES, NEVER ONE. This is the central design decision of the desk
 * and the reason it is not a single dial. The valuation readings and the cycle
 * readings answer different questions over different spans, and the live data
 * shows why blending them would destroy the answer: at the time of writing,
 * households hold a near-record share of their financial assets in shares and
 * the market is priced at an extreme against the economy — while the yield
 * curve is normally sloped, unemployment sits at its own floor, jobless claims
 * are low and credit is priced tightly. Averaging those into one number would
 * report a mild reading and hide the only information in the picture, which is
 * that the two horizons disagree.
 *
 *   SLOW   what the next decade is likely to pay. Reported, not acted on.
 *   FAST   how much drawdown risk the next six to twelve months carry.
 *
 * The exposure band is driven overwhelmingly by the fast composite. That is not
 * a preference: a comprehensive out-of-sample test of the standard predictors
 * found that valuation ratios would not have helped an investor time the
 * market, and a desk that let an expensive market drive its allocation would
 * have sat in cash through most of the past three decades.
 *
 * NOTHING IS EVER FILLED IN. A gauge that could not be measured is excluded
 * from its family's weight rather than counted as neutral, a family with no
 * measured member contributes no weight rather than a middling score, and a
 * composite standing on too few readings says so instead of pretending to
 * describe its whole horizon.
 * ========================================================================== */

export type ScoreSettings = Pick<
  TideSettings,
  | "minGaugesPerHorizon"
  | "weightValuation"
  | "weightPositioning"
  | "weightSlowCredit"
  | "weightSlowSentiment"
  | "weightCycle"
  | "weightLabour"
  | "weightTrend"
  | "weightCredit"
  | "weightBreadth"
  | "weightLiquidity"
  | "weightSentiment"
  | "exposureBase"
  | "exposureFastPenalty"
  | "exposureSlowPenalty"
  | "exposureFloor"
  | "exposureCeiling"
  | "exposureBandWidth"
>;

/**
 * The weight of one family ON one horizon.
 *
 * The pair is the key rather than the family alone, because credit and
 * volatility are read on both horizons with opposite meanings: a thin credit
 * spread is a slow warning that risk is priced generously, and a widening one
 * is a fast warning that it has stopped being. A family that does not appear
 * on a horizon weighs nothing there.
 */
export function weightFor(family: TideFamily, horizon: TideHorizon, s: ScoreSettings): number {
  if (horizon === "slow") {
    switch (family) {
      case "valuation":
        return s.weightValuation;
      case "positioning":
        return s.weightPositioning;
      case "credit":
        return s.weightSlowCredit;
      case "sentiment":
        return s.weightSlowSentiment;
      default:
        return 0;
    }
  }
  switch (family) {
    case "cycle":
      return s.weightCycle;
    case "labour":
      return s.weightLabour;
    case "trend":
      return s.weightTrend;
    case "credit":
      return s.weightCredit;
    case "breadth":
      return s.weightBreadth;
    case "liquidity":
      return s.weightLiquidity;
    case "sentiment":
      return s.weightSentiment;
    default:
      return 0;
  }
}

/* ---------------------------------------------------------------------------
 * Families
 * ------------------------------------------------------------------------- */

export interface FamilyAggregate {
  family: TideFamily;
  horizon: TideHorizon;
  /** The operator's weight for this family on this horizon. */
  weight: number;
  /** Equal-weighted mean stress across the family's MEASURED gauges. */
  stress: number | null;
  measured: number;
  total: number;
  readings: GaugeReading[];
  /** Why the family contributes nothing. Null when it does. */
  unavailable: string | null;
}

/**
 * Within a family every gauge counts equally. The judgement about which
 * readings matter more is made once, at the family level, where it is a single
 * published number with a citation — rather than spread across thirty
 * per-gauge weights nobody could audit.
 */
export function aggregateFamily(
  family: TideFamily,
  horizon: TideHorizon,
  readings: GaugeReading[],
  s: ScoreSettings,
): FamilyAggregate {
  const mine = readings.filter(
    (r) => r.gauge.family === family && r.gauge.horizon === horizon && r.gauge.kind === "scored",
  );
  const measured = mine.filter((r) => r.measured && r.stress !== null && !r.stale);
  const weight = weightFor(family, horizon, s);
  const stress =
    measured.length === 0
      ? null
      : round1(measured.reduce((sum, r) => sum + (r.stress as number), 0) / measured.length);
  return {
    family,
    horizon,
    weight,
    stress,
    measured: measured.length,
    total: mine.length,
    readings: rankReadings(mine),
    unavailable:
      mine.length === 0
        ? null
        : measured.length === 0
          ? `none of the ${mine.length} readings in this group could be measured, so it carries no weight`
          : null,
  };
}

/* ---------------------------------------------------------------------------
 * Composites
 * ------------------------------------------------------------------------- */

/**
 * The weighted composite of a set of family readings.
 *
 * Extracted so that today's composite and every month of its history come out
 * of ONE implementation. A second copy of this arithmetic for the chart would
 * be a second chance to disagree with the headline about what the desk says.
 *
 * A family with no measured member contributes NO WEIGHT rather than a middling
 * score, so an absent group redistributes the weight across the groups that
 * were measured instead of quietly dragging the result toward the middle.
 */
export function weightedComposite(
  members: { family: TideFamily; stress: number | null }[],
  horizon: TideHorizon,
  s: ScoreSettings,
): { stress: number | null; usedWeight: number; declaredWeight: number; measured: number } {
  const byFamily = new Map<TideFamily, number[]>();
  let measured = 0;
  for (const m of members) {
    if (m.stress === null) continue;
    measured++;
    const list = byFamily.get(m.family) ?? [];
    list.push(m.stress);
    byFamily.set(m.family, list);
  }

  const families = new Set(members.map((m) => m.family));
  let declaredWeight = 0;
  for (const f of families) declaredWeight += weightFor(f, horizon, s);

  let usedWeight = 0;
  let total = 0;
  for (const [family, values] of byFamily) {
    const weight = weightFor(family, horizon, s);
    if (weight <= 0) continue;
    const familyStress = values.reduce((a, b) => a + b, 0) / values.length;
    total += weight * familyStress;
    usedWeight += weight;
  }

  return {
    stress: usedWeight > 0 ? round1(total / usedWeight) : null,
    usedWeight,
    declaredWeight,
    measured,
  };
}


export interface Composite {
  horizon: TideHorizon;
  /** 0-100, where 100 is maximally bad for an equity owner. */
  stress: number | null;
  families: FamilyAggregate[];
  measuredGauges: number;
  totalGauges: number;
  /** Share of the horizon's declared weight that actually had a reading behind it. */
  weightCoveragePct: number | null;
  /** True when the composite stands on fewer readings than the operator requires. */
  partial: boolean;
  unavailable: string | null;
}

export function buildComposite(
  horizon: TideHorizon,
  readings: GaugeReading[],
  s: ScoreSettings,
): Composite {
  const families = TIDE_FAMILIES.map((f) => aggregateFamily(f, horizon, readings, s)).filter(
    (f) => f.total > 0 && f.weight > 0,
  );

  const measuredGauges = families.reduce((n, f) => n + f.measured, 0);
  const totalGauges = families.reduce((n, f) => n + f.total, 0);

  const declaredWeight = families.reduce((w, f) => w + f.weight, 0);
  const contributing = families.filter((f) => f.stress !== null && f.weight > 0);
  const usedWeight = contributing.reduce((w, f) => w + f.weight, 0);

  const coverage = declaredWeight > 0 ? round1((100 * usedWeight) / declaredWeight) : null;

  if (usedWeight <= 0) {
    return {
      horizon,
      stress: null,
      families,
      measuredGauges,
      totalGauges,
      weightCoveragePct: coverage,
      partial: true,
      unavailable: "none of this horizon's readings could be measured",
    };
  }

  const stress = round1(
    contributing.reduce((sum, f) => sum + f.weight * (f.stress as number), 0) / usedWeight,
  );

  const partial = measuredGauges < s.minGaugesPerHorizon;
  return {
    horizon,
    stress,
    families,
    measuredGauges,
    totalGauges,
    weightCoveragePct: coverage,
    partial,
    unavailable: partial
      ? `this reading stands on ${measuredGauges} measured gauge${measuredGauges === 1 ? "" : "s"}, ` +
        `below the ${s.minGaugesPerHorizon} required before it describes its whole horizon`
      : null,
  };
}

/* ---------------------------------------------------------------------------
 * The good and the bad
 * ------------------------------------------------------------------------- */

export interface WeightedReading {
  reading: GaugeReading;
  /** The gauge's share of the whole desk's used weight, as a percentage. */
  weightPct: number;
}

export interface GoodBad {
  good: WeightedReading[];
  bad: WeightedReading[];
  neutral: WeightedReading[];
  /** Share of measured weight currently reading BETTER than this gauge's own middle. */
  goodWeightPct: number | null;
  badWeightPct: number | null;
  neutralWeightPct: number | null;
  measured: number;
  unmeasured: number;
}

/**
 * Split every measured reading into the good and the bad — by what it says
 * TODAY, never by what kind of reading it is.
 *
 * This is the part the desk was asked for, and the honest form of it is a
 * weight share rather than a count. Ten sentiment readings agreeing is not more
 * evidence than one yield curve; asking how much of the desk's weight currently
 * sits on each side answers "how much good against how much bad" in the units
 * the weights are actually expressed in.
 *
 * A gauge sitting exactly at the middle of its own history is neither, and is
 * reported as such rather than being rounded onto one side.
 */
export function splitGoodBad(composites: Composite[]): GoodBad {
  const weighted: WeightedReading[] = [];
  let unmeasured = 0;
  let totalWeight = 0;

  for (const composite of composites) {
    for (const family of composite.families) {
      const measured = family.readings.filter((r) => r.measured && r.stress !== null && !r.stale);
      unmeasured += family.readings.length - measured.length;
      if (measured.length === 0 || family.weight <= 0) continue;
      // A family's weight is shared equally among the members that could be
      // measured, so an absent reading redistributes rather than dilutes.
      const each = family.weight / measured.length;
      for (const reading of measured) {
        weighted.push({ reading, weightPct: each });
        totalWeight += each;
      }
    }
  }

  if (totalWeight <= 0) {
    return {
      good: [],
      bad: [],
      neutral: [],
      goodWeightPct: null,
      badWeightPct: null,
      neutralWeightPct: null,
      measured: 0,
      unmeasured,
    };
  }

  const scaled = weighted.map((w) => ({ ...w, weightPct: round1((100 * w.weightPct) / totalWeight) }));
  const share = (rows: WeightedReading[]): number =>
    round1(rows.reduce((sum, r) => sum + r.weightPct, 0));

  const bad = scaled
    .filter((w) => (w.reading.stress as number) > 50)
    .sort((a, b) => (b.reading.stress as number) - (a.reading.stress as number));
  const good = scaled
    .filter((w) => (w.reading.stress as number) < 50)
    .sort((a, b) => (a.reading.stress as number) - (b.reading.stress as number));
  const neutral = scaled.filter((w) => (w.reading.stress as number) === 50);

  return {
    good,
    bad,
    neutral,
    goodWeightPct: share(good),
    badWeightPct: share(bad),
    neutralWeightPct: share(neutral),
    measured: scaled.length,
    unmeasured,
  };
}

/* ---------------------------------------------------------------------------
 * The exposure band
 * ------------------------------------------------------------------------- */

export interface Exposure {
  /** Midpoint of the band, as a percentage of a portfolio held in equities. */
  centre: number;
  low: number;
  high: number;
  /** Points the fast composite moved the band, signed. */
  fastPoints: number | null;
  slowPoints: number | null;
  /** Set when the arithmetic ran past a limit and was held there. */
  clampedAt: "floor" | "ceiling" | null;
  /** True when a composite was missing and its term was left out. */
  partial: boolean;
  /** The arithmetic, ready to print. Every input visible. */
  workings: string;
  notes: string[];
}

/**
 * Turn the two composites into a suggested share of equities against cash.
 *
 * The formula is published, is one line, and every input to it is on the page:
 *
 *     equity% = base
 *             - fastPenalty x (fastStress - 50) / 50
 *             - slowPenalty x (slowStress - 50) / 50
 *
 * A composite at the middle of its own history moves nothing. At its worst it
 * subtracts the whole penalty; at its best it adds it.
 *
 * The result is a BAND rather than a figure. A single percentage carried to the
 * point would claim a precision that revised macroeconomic data, a sample of
 * about seven recessions and a set of hand-chosen weights cannot support, and
 * the band is the honest width of the answer rather than decoration on it.
 *
 * The floor and ceiling are not rounding. The band never reaches nought or a
 * hundred because the worst readings here have been followed by good years
 * often enough to matter, and an instrument this uncertain should not be able
 * to tell anybody to leave the market entirely.
 */
export function computeExposure(fast: Composite, slow: Composite, s: ScoreSettings): Exposure {
  const notes: string[] = [];
  const term = (composite: Composite, penalty: number): number | null => {
    if (composite.stress === null) return null;
    return -(penalty * (composite.stress - 50)) / 50;
  };

  const fastPoints = term(fast, s.exposureFastPenalty);
  const slowPoints = term(slow, s.exposureSlowPenalty);

  if (fastPoints === null) {
    notes.push(
      "The cycle reading could not be computed, so it moved the band by nothing. That is a gap in the " +
        "measurement, not a calm market.",
    );
  }
  if (slowPoints === null) {
    notes.push(
      "The valuation reading could not be computed, so it moved the band by nothing. That is a gap in the " +
        "measurement, not a fairly priced market.",
    );
  }
  if (fast.partial && fast.stress !== null) {
    notes.push("The cycle reading stands on fewer gauges than usual, so the band rests on a narrower base than it normally would.");
  }
  if (slow.partial && slow.stress !== null) {
    notes.push("The valuation reading stands on fewer gauges than usual.");
  }

  const rawCentre = s.exposureBase + (fastPoints ?? 0) + (slowPoints ?? 0);

  let clampedAt: Exposure["clampedAt"] = null;
  let centre = rawCentre;
  if (centre < s.exposureFloor) {
    centre = s.exposureFloor;
    clampedAt = "floor";
  } else if (centre > s.exposureCeiling) {
    centre = s.exposureCeiling;
    clampedAt = "ceiling";
  }

  const half = s.exposureBandWidth / 2;
  const low = Math.max(s.exposureFloor, round1(centre - half));
  const high = Math.min(s.exposureCeiling, round1(centre + half));

  if (clampedAt === "floor") {
    notes.push(
      `The arithmetic reached ${round1(rawCentre)}% and was held at the ${s.exposureFloor}% floor. The band ` +
        "does not go to zero: readings this poor have still been followed by good years.",
    );
  }
  if (clampedAt === "ceiling") {
    notes.push(
      `The arithmetic reached ${round1(rawCentre)}% and was held at the ${s.exposureCeiling}% ceiling.`,
    );
  }

  const fmt = (n: number | null): string => (n === null ? "not measured" : `${n >= 0 ? "+" : ""}${round1(n)}`);
  const workings =
    `${s.exposureBase}% base ${fmt(fastPoints)} from the cycle reading ${fmt(slowPoints)} from the ` +
    `valuation reading = ${round1(rawCentre)}%` +
    (clampedAt ? `, held at ${round1(centre)}%` : "");

  return {
    centre: round1(centre),
    low,
    high,
    fastPoints: fastPoints === null ? null : round1(fastPoints),
    slowPoints: slowPoints === null ? null : round1(slowPoints),
    clampedAt,
    partial: fastPoints === null || slowPoints === null || fast.partial || slow.partial,
    workings,
    notes,
  };
}

/* ---------------------------------------------------------------------------
 * Posture
 * ------------------------------------------------------------------------- */

export type Posture = "defensive" | "cautious" | "neutral" | "constructive" | "risk-on" | "unmeasured";

export const POSTURE_META: Record<Posture, { label: string; short: string; rank: number }> = {
  defensive: { label: "Defensive", short: "DEFENSIVE", rank: 0 },
  cautious: { label: "Cautious", short: "CAUTIOUS", rank: 1 },
  neutral: { label: "Neutral", short: "NEUTRAL", rank: 2 },
  constructive: { label: "Constructive", short: "CONSTRUCTIVE", rank: 3 },
  "risk-on": { label: "Risk-on", short: "RISK-ON", rank: 4 },
  unmeasured: { label: "Not measured", short: "NOT MEASURED", rank: -1 },
};

/**
 * A word for the fast composite. Derived from the SAME number the band is,
 * with inclusive boundaries from below so no reading falls between two labels
 * — a posture that disagreed with the percentage beside it would be a second
 * opinion nobody asked for.
 */
export function postureFor(fast: Composite): Posture {
  if (fast.stress === null) return "unmeasured";
  if (fast.stress >= 70) return "defensive";
  if (fast.stress >= 58) return "cautious";
  if (fast.stress >= 42) return "neutral";
  if (fast.stress >= 30) return "constructive";
  return "risk-on";
}

/* ---------------------------------------------------------------------------
 * Ordering
 * ------------------------------------------------------------------------- */

/**
 * Rank readings for display: most stressed first, then by label.
 *
 * A reading that could not be measured sorts LAST regardless of anything else.
 * An unmeasured gauge must never be able to look like a calm one.
 */
export function rankReadings(readings: GaugeReading[]): GaugeReading[] {
  return [...readings].sort((a, b) => {
    const am = a.measured && a.stress !== null && !a.stale;
    const bm = b.measured && b.stress !== null && !b.stale;
    if (am !== bm) return am ? -1 : 1;
    if (am && bm) {
      const d = (b.stress as number) - (a.stress as number);
      if (Math.abs(d) > 1e-9) return d;
    }
    return a.gauge.label.localeCompare(b.gauge.label);
  });
}
