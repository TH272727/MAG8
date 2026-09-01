import type { FinancialYear } from "./fundamentals";

/* ============================================================================
 * Owner earnings, and what they are worth — pure. No network, no database.
 *
 * This asks a different question from the platform's existing reverse discounted
 * cash-flow work. That one asks what the price already assumes and reports
 * whether the assumption is plausible. This one asks what the business appears
 * to be worth on its own numbers, so that the gap between that and the price can
 * be named — a margin of safety, which only means anything because the estimate
 * is wrong. The only question is by how much and in which direction.
 *
 * WHAT THIS IS NOT. Owner earnings here are a simplified, formulaic
 * approximation of the definition Buffett set out in the 1986 Berkshire
 * Hathaway letter: reported earnings plus depreciation and amortisation, less
 * the capital expenditure the business requires to maintain its competitive
 * position and unit volume, less the working capital that growth consumes. He
 * was explicit that the maintenance figure cannot be read off a filing and must
 * be estimated, and that the resulting number is a range rather than a
 * quantity. Nothing here can estimate it, so BOTH bounds are computed and both
 * are shown, and the distance between them is itself the honest reading:
 *
 *   total capital spending      deducts every dollar of capital expenditure,
 *                               overstating the deduction and understating the
 *                               value. Conservative, and the default.
 *
 *   maintenance approximation   treats depreciation as the maintenance figure,
 *                               so spending above it counts as growth and is
 *                               not deducted. Higher, and less conservative.
 *
 * A wide gap between the two means the answer rests almost entirely on a
 * judgement nobody here is making, and the page says so rather than picking one.
 * Every assumption is a named argument with an example default: a different
 * discount rate is exactly how somebody with a different tolerance for risk
 * would use this.
 * ========================================================================== */

export type CapexMethod = "total" | "maintenance";

export interface OwnerEarningsYear {
  end: string;
  /** Null when an input is missing — never zero, which would read as a real figure. */
  value: number | null;
  netIncome: number | null;
  depreciation: number | null;
  capex: number | null;
  /** Increase in working capital over the year, which consumes cash. */
  workingCapitalChange: number | null;
  /** Why this year could not be computed. */
  missing: string[];
}

const num = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n);

const workingCapital = (y: FinancialYear): number | null =>
  num(y.currentAssets) && num(y.currentLiabilities) ? y.currentAssets - y.currentLiabilities : null;

/**
 * Owner earnings for every year that has the inputs, oldest first.
 *
 * The first year is never computable: the change in working capital needs the
 * year before it, and there isn't one. That is reported as a missing input
 * rather than assumed to be zero, because zero is a real number that a reader
 * would take as a measurement.
 */
export function computeOwnerEarnings(
  years: FinancialYear[],
  method: CapexMethod = "total",
): OwnerEarningsYear[] {
  return years.map((y, i) => {
    const prior = i > 0 ? years[i - 1] : null;
    const wcNow = workingCapital(y);
    const wcPrior = prior ? workingCapital(prior) : null;
    const wcChange = wcNow !== null && wcPrior !== null ? wcNow - wcPrior : null;

    const missing: string[] = [];
    if (!num(y.netIncome)) missing.push("net income");
    if (!num(y.depreciation)) missing.push("depreciation and amortisation");
    if (!num(y.capex)) missing.push("capital expenditure");
    if (wcChange === null) {
      missing.push(prior ? "working capital in one of the two years" : "the previous year's working capital");
    }

    let value: number | null = null;
    if (missing.length === 0) {
      // The maintenance approximation deducts only the part of capital spending
      // that depreciation implies is being consumed; anything above that is
      // treated as investment in growth and is not charged against this year.
      const deduction = method === "maintenance" ? Math.min(y.capex!, y.depreciation!) : y.capex!;
      value = y.netIncome! + y.depreciation! - deduction - wcChange!;
    }

    return {
      end: y.end,
      value,
      netIncome: y.netIncome,
      depreciation: y.depreciation,
      capex: y.capex,
      workingCapitalChange: wcChange,
      missing,
    };
  });
}

/* ----------------------------------------------------------------------------
 * Projection
 * -------------------------------------------------------------------------- */

export interface ProjectionAssumptions {
  years: number;
  /** Share of the historical rate carried forward, 0-1. */
  growthHaircut: number;
  /** Hard ceiling on the projected rate, as a fraction. */
  maxGrowthRate: number;
}

export interface Projection {
  /** One value per projected year, or null when no projection is possible. */
  values: number[] | null;
  /** The compound rate actually applied, after the haircut and the cap. */
  growthRate: number | null;
  /** The rate observed in the history, before either was applied. */
  historicalRate: number | null;
  base: number | null;
  notes: string[];
}

/**
 * Project owner earnings forward from their own history.
 *
 * Growth rates decay towards the average far faster than extrapolation assumes,
 * which is the single most common way a discounted cash-flow model talks itself
 * into a number. So the observed rate is cut by a haircut and then capped, and
 * both the observed and the applied rate are returned so a reader can see how
 * much of the history was thrown away.
 *
 * A company whose most recent owner earnings are negative gets NO projection.
 * Compounding a negative base produces a confident, meaningless valuation, and
 * refusing is the only honest answer available.
 */
export function projectOwnerEarnings(
  history: OwnerEarningsYear[],
  a: ProjectionAssumptions,
): Projection {
  const notes: string[] = [];
  const usable = history.filter((h) => h.value !== null) as (OwnerEarningsYear & { value: number })[];

  if (usable.length === 0) {
    return { values: null, growthRate: null, historicalRate: null, base: null, notes: ["No year of owner earnings could be computed."] };
  }

  const base = usable[usable.length - 1].value;
  if (base <= 0) {
    return {
      values: null,
      growthRate: null,
      historicalRate: null,
      base,
      notes: [
        "The most recent year of owner earnings is negative, so there is nothing to compound and no value " +
          "is estimated. A business can be worth a great deal while consuming cash; this method simply " +
          "cannot say so.",
      ],
    };
  }

  const first = usable[0];
  const spans = usable.length - 1;
  let historicalRate: number | null = null;
  if (spans >= 1 && first.value > 0) {
    historicalRate = (base / first.value) ** (1 / spans) - 1;
  } else if (spans >= 1) {
    notes.push(
      "The earliest year of owner earnings was not positive, so a compound rate cannot be taken from this " +
        "history and no growth is assumed.",
    );
  } else {
    notes.push("Only one year of owner earnings could be computed, so no growth is assumed.");
  }

  const haircut = historicalRate === null ? 0 : historicalRate * a.growthHaircut;
  const growthRate = Math.min(haircut, a.maxGrowthRate);
  if (historicalRate !== null && haircut > a.maxGrowthRate) {
    notes.push(
      `The rate implied by this history is ${(historicalRate * 100).toFixed(1)}% a year, which the cap ` +
        `reduces to ${(a.maxGrowthRate * 100).toFixed(1)}%.`,
    );
  }

  const values: number[] = [];
  let v = base;
  for (let i = 0; i < a.years; i++) {
    v = v * (1 + growthRate);
    values.push(v);
  }
  return { values, growthRate, historicalRate, base, notes };
}

/* ----------------------------------------------------------------------------
 * Valuation
 * -------------------------------------------------------------------------- */

export interface ValuationAssumptions {
  discountRate: number;
  terminalGrowth: number;
  sharesOutstanding: number | null;
}

export interface Valuation {
  /** Present value of the whole business. */
  enterpriseValue: number | null;
  perShare: number | null;
  /** How much of the answer comes from the terminal value rather than the projection. */
  terminalShare: number | null;
  notes: string[];
}

/**
 * A two-stage discounted cash-flow: an explicit projection, then a perpetuity.
 *
 * The terminal value usually dominates, which is worth showing rather than
 * hiding — a valuation that is 80% perpetuity is a statement about the far
 * future wearing the clothes of an analysis of the near one, and the share is
 * returned so the page can say that.
 */
export function intrinsicValuePerShare(projected: number[], a: ValuationAssumptions): Valuation {
  const notes: string[] = [];
  if (projected.length === 0) return { enterpriseValue: null, perShare: null, terminalShare: null, notes: ["No projection to discount."] };

  if (a.discountRate <= a.terminalGrowth) {
    // Otherwise the perpetuity is negative or infinite, and either way the
    // arithmetic has stopped describing a business.
    return {
      enterpriseValue: null,
      perShare: null,
      terminalShare: null,
      notes: [
        "The terminal growth rate is not below the discount rate, so the perpetuity does not converge and no " +
          "value can be computed.",
      ],
    };
  }

  let pv = 0;
  for (let i = 0; i < projected.length; i++) {
    pv += projected[i] / (1 + a.discountRate) ** (i + 1);
  }
  const last = projected[projected.length - 1];
  const terminal = (last * (1 + a.terminalGrowth)) / (a.discountRate - a.terminalGrowth);
  const terminalPv = terminal / (1 + a.discountRate) ** projected.length;
  const enterpriseValue = pv + terminalPv;

  if (!num(a.sharesOutstanding) || a.sharesOutstanding <= 0) {
    notes.push("No share count is available, so the estimate cannot be expressed per share.");
    return { enterpriseValue, perShare: null, terminalShare: terminalPv / enterpriseValue, notes };
  }

  return {
    enterpriseValue,
    perShare: enterpriseValue / a.sharesOutstanding,
    terminalShare: terminalPv / enterpriseValue,
    notes,
  };
}

/** How far below the estimate the price sits, as a fraction of the estimate. */
export function marginOfSafety(intrinsicValue: number | null, price: number | null): number | null {
  if (!num(intrinsicValue) || intrinsicValue <= 0 || !num(price)) return null;
  return (intrinsicValue - price) / intrinsicValue;
}

/* ----------------------------------------------------------------------------
 * One company, both bounds
 * -------------------------------------------------------------------------- */

export interface DcfAssumptions extends ProjectionAssumptions, Omit<ValuationAssumptions, "sharesOutstanding"> {}

export interface DcfBound {
  method: CapexMethod;
  history: OwnerEarningsYear[];
  projection: Projection;
  valuation: Valuation;
  marginOfSafety: number | null;
}

export interface DcfResult {
  total: DcfBound;
  maintenance: DcfBound;
  /** The conservative bound, which is what the ranking uses. */
  perShareLow: number | null;
  perShareHigh: number | null;
  marginOfSafetyLow: number | null;
  marginOfSafetyHigh: number | null;
  /** How far apart the two capital-spending assumptions leave the answer. */
  spreadPct: number | null;
  flags: string[];
}

/**
 * Value one company under both capital-spending assumptions.
 *
 * The ranking uses the conservative bound. The other is shown beside it, and a
 * wide gap between them is flagged, because that gap is the part of the answer
 * that rests on a judgement this method cannot make.
 */
export function valueCompany(
  years: FinancialYear[],
  price: number | null,
  shares: number | null,
  a: DcfAssumptions,
): DcfResult {
  const bound = (method: CapexMethod): DcfBound => {
    const history = computeOwnerEarnings(years, method);
    const projection = projectOwnerEarnings(history, a);
    const valuation = projection.values
      ? intrinsicValuePerShare(projection.values, { ...a, sharesOutstanding: shares })
      : { enterpriseValue: null, perShare: null, terminalShare: null, notes: projection.notes };
    return { method, history, projection, valuation, marginOfSafety: marginOfSafety(valuation.perShare, price) };
  };

  const total = bound("total");
  const maintenance = bound("maintenance");
  const flags: string[] = [];

  const low = total.valuation.perShare;
  const high = maintenance.valuation.perShare;
  let spreadPct: number | null = null;
  if (num(low) && num(high) && low > 0) {
    spreadPct = ((high - low) / low) * 100;
    if (spreadPct > 100) {
      flags.push(
        `The two capital-spending assumptions leave the estimate ${spreadPct.toFixed(0)}% apart. Most of this ` +
          "company's value therefore depends on how much of its capital spending is maintaining the business " +
          "rather than growing it, which is a judgement these figures cannot settle.",
      );
    }
  }

  const terminalShare = total.valuation.terminalShare;
  if (num(terminalShare) && terminalShare > 0.75) {
    flags.push(
      `${(terminalShare * 100).toFixed(0)}% of the estimated value sits in the perpetuity beyond the ` +
        "projection, so it rests on assumptions about the distant future rather than on the years modelled.",
    );
  }
  for (const n of total.projection.notes) flags.push(n);

  return {
    total,
    maintenance,
    perShareLow: low,
    perShareHigh: high,
    marginOfSafetyLow: total.marginOfSafety,
    marginOfSafetyHigh: maintenance.marginOfSafety,
    spreadPct,
    flags,
  };
}

/* ----------------------------------------------------------------------------
 * Supporting colour
 * -------------------------------------------------------------------------- */

export interface QualitySnapshot {
  yearsMeasured: number;
  /** Share of measured years with positive owner earnings, 0-1. */
  positiveShare: number | null;
  /** Share of year-on-year steps that grew, 0-1. */
  growingShare: number | null;
  /** Mean return on equity across the years that could be computed. */
  averageRoe: number | null;
  /** Total liabilities against equity at the latest year end. */
  leverage: number | null;
}

/**
 * Context, never a gate.
 *
 * A checklist of the qualities the method's originator described looking for —
 * earnings that are consistently positive, growing, and produced without heavy
 * borrowing. None of it filters anything; it sits beside the valuation so a
 * reader can see whether the history behind the estimate is steady or lumpy.
 */
export function buffettQualitySnapshot(
  years: FinancialYear[],
  history: OwnerEarningsYear[],
): QualitySnapshot {
  const measured = history.filter((h) => h.value !== null) as (OwnerEarningsYear & { value: number })[];
  const positives = measured.filter((h) => h.value > 0).length;

  let growing = 0;
  let steps = 0;
  for (let i = 1; i < measured.length; i++) {
    steps++;
    if (measured[i].value > measured[i - 1].value) growing++;
  }

  const roes = years
    .map((y) => (num(y.netIncome) && num(y.equity) && y.equity > 0 ? y.netIncome / y.equity : null))
    .filter((r): r is number => r !== null);

  const latest = years[years.length - 1];
  const leverage =
    latest && num(latest.liabilities) && num(latest.equity) && latest.equity > 0
      ? latest.liabilities / latest.equity
      : null;

  return {
    yearsMeasured: measured.length,
    positiveShare: measured.length > 0 ? positives / measured.length : null,
    growingShare: steps > 0 ? growing / steps : null,
    averageRoe: roes.length > 0 ? roes.reduce((s, r) => s + r, 0) / roes.length : null,
    leverage,
  };
}

/**
 * The margin of safety as a 0-100 component of the composite.
 *
 * Scaled so that meeting the reader's own required cushion scores 70 and twice
 * it scores full marks; a price above the estimate scores zero rather than a
 * negative number. A company that could not be valued scores null, not zero —
 * an unvalued business must never be able to look like an expensive one.
 */
export function valueScore(marginOfSafetyFraction: number | null, requiredFraction: number): number | null {
  if (marginOfSafetyFraction === null) return null;
  if (marginOfSafetyFraction <= 0) return 0;
  if (requiredFraction <= 0) return Math.round(Math.min(100, marginOfSafetyFraction * 200) * 10) / 10;
  const scaled = (marginOfSafetyFraction / requiredFraction) * 70;
  return Math.round(Math.min(100, scaled) * 10) / 10;
}
