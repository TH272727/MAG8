import { clusterEpisodes } from "../rotation/baserates";
import type { TideSettings } from "../tide-settings";
import { round1 } from "./normalize";

/* ============================================================================
 * What followed, the last times the desk read like this. PURE.
 *
 * The point of this module is to stop the composite from being an assertion.
 * A number saying "conditions are poor" is an opinion until somebody says what
 * followed the last times it said that, and this is that sentence — computed,
 * not recalled.
 *
 * FOUR RULES, all of them the difference between a base rate and a flattering
 * anecdote:
 *
 * 1. EPISODES, NEVER MONTHS. A twelve-month forward reading taken in March and
 *    again in April shares eleven of its twelve months with itself. Counting
 *    those as two observations inflates the apparent sample precisely when the
 *    real one is small, so a run of qualifying months is ONE visit, and visits
 *    closer together than the operator's tolerance belong to the same visit.
 *
 * 2. THE PLAIN FIGURE IS ALWAYS PUBLISHED BESIDE THE CONDITIONAL ONE. Knowing
 *    that the market rose 9% on average after readings like today's means
 *    nothing without knowing it rose 9% on average after every reading. Only
 *    the difference between the two carries information, and printing the
 *    conditional figure alone would let an ordinary market look like a finding.
 *
 * 3. BELOW THE FLOOR, NOTHING IS PUBLISHED. Not a mean of three visits, not a
 *    zero, not a shrug — NOT MEASURED, with the count that failed.
 *
 * 4. THE HONEST DENOMINATOR IS SAID OUT LOUD. Thirty years of monthly readings
 *    is 360 rows and about three recessions. However the arithmetic is dressed,
 *    the effective sample for anything cycle-shaped is single digits, and the
 *    desk says so rather than letting the row count imply otherwise.
 *
 * A caveat this module cannot fix, and therefore states: the macroeconomic
 * series behind the composite are REVISED. The history is measured on today's
 * vintage, which is not the vintage a reader would have seen at the time, so a
 * conditional figure is mildly flattering to the desk by construction. The
 * market prices are not revised, which is one reason the fast composite leans
 * on them.
 * ========================================================================== */

export type BaseRateSettings = Pick<
  TideSettings,
  "baseRateHorizonMonths" | "baseRateMinEpisodes" | "baseRateEpisodeGapMonths"
>;

export interface MonthlyPoint {
  /** YYYY-MM. */
  month: string;
  value: number;
}

export interface Band {
  lo: number;
  hi: number;
  /** "60-70" — the band as a reader should see it. */
  label: string;
}

export interface Episode {
  startMonth: string;
  endMonth: string;
  months: number;
  meanChangePct: number;
  bestPct: number;
  worstPct: number;
}

export interface Stats {
  /** Qualifying months. Present for scale, NEVER as the sample size. */
  months: number;
  meanPct: number | null;
  medianPct: number | null;
  positiveSharePct: number | null;
}

export interface ConditionalSample extends Stats {
  /** The honest sample size. */
  episodes: number;
  /** Mean of the per-episode means — every visit weighted equally. */
  episodeMeanPct: number | null;
  /** Share of EPISODES whose mean was positive. */
  episodeHitRatePct: number | null;
  list: Episode[];
}

export interface TideBaseRates {
  band: Band | null;
  todayStress: number | null;
  horizonMonths: number;
  usableMonths: number;
  spanStart: string | null;
  spanEnd: string | null;
  conditional: ConditionalSample | null;
  unconditional: Stats | null;
  /** Conditional mean minus plain mean. The only figure that carries information. */
  differencePct: number | null;
  /** Share of usable history spent inside this band. Above 40% the reading is barely conditional. */
  bandSharePct: number | null;
  measured: boolean;
  /** Why there is no reading. A sentence, not a code. */
  unavailable: string | null;
}

/** Deciles of the stress scale, which is already 0-100 and needs no re-ranking. */
export function bandFor(stress: number): Band {
  const lo = Math.min(90, Math.max(0, Math.floor(stress / 10) * 10));
  const hi = lo + 10;
  return { lo, hi, label: `${lo}-${hi}` };
}

function inBand(stress: number, band: Band): boolean {
  return band.hi >= 100 ? stress >= band.lo : stress >= band.lo && stress < band.hi;
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

const mean = (xs: number[]): number | null =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

function statsOf(changes: number[]): Stats {
  const m = mean(changes);
  const md = median(changes);
  return {
    months: changes.length,
    meanPct: m === null ? null : round2(m),
    medianPct: md === null ? null : round2(md),
    positiveSharePct:
      changes.length === 0 ? null : round1((100 * changes.filter((c) => c > 0).length) / changes.length),
  };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Percent change of `values` over the `horizon` entries following `index`.
 * Null once the window runs past the end of the series — which is what stops
 * the newest readings from being scored against a future that has not happened.
 */
export function forwardChangeAt(values: number[], horizon: number, index: number): number | null {
  const end = index + horizon;
  if (end >= values.length || index < 0) return null;
  const from = values[index];
  const to = values[end];
  if (!Number.isFinite(from) || !Number.isFinite(to) || from <= 0) return null;
  return ((to - from) / from) * 100;
}

export interface BaseRateInputs {
  /** The composite, monthly. */
  composite: MonthlyPoint[];
  /** The market, monthly, on the same month keys. */
  market: MonthlyPoint[];
  settings: BaseRateSettings;
}

const empty = (reason: string, horizonMonths: number): TideBaseRates => ({
  band: null,
  todayStress: null,
  horizonMonths,
  usableMonths: 0,
  spanStart: null,
  spanEnd: null,
  conditional: null,
  unconditional: null,
  differencePct: null,
  bandSharePct: null,
  measured: false,
  unavailable: reason,
});

/**
 * The conditional history of the composite against what the market did next.
 *
 * Note what is banded and what is measured forward: the CONDITION is the
 * composite's own reading, and the OUTCOME is the market's return. That is a
 * different question from the one the Rotation Board's base rates ask, where
 * the series being banded is also the series being read forward — which is why
 * this is a separate implementation rather than a reuse of that one, and why
 * only the episode clustering is shared between them.
 */
export function computeTideBaseRates(inputs: BaseRateInputs): TideBaseRates {
  const s = inputs.settings;
  const horizon = s.baseRateHorizonMonths;
  if (horizon < 1) return empty("the forward window is set to nothing", horizon);

  // Join on the month key. A month present in one series and not the other is
  // dropped rather than bridged: the composite is only defined where its
  // inputs were published.
  const marketByMonth = new Map(inputs.market.map((p) => [p.month, p.value]));
  const months: string[] = [];
  const stress: number[] = [];
  const market: number[] = [];
  for (const p of inputs.composite) {
    const m = marketByMonth.get(p.month);
    if (m === undefined || !Number.isFinite(m) || m <= 0) continue;
    months.push(p.month);
    stress.push(p.value);
    market.push(m);
  }

  if (months.length === 0) {
    return empty("no month has both a composite reading and a market level stored", horizon);
  }
  if (months.length <= horizon) {
    return empty(
      `the stored history covers ${months.length} month${months.length === 1 ? "" : "s"}, which is not ` +
        `enough to measure even one ${horizon}-month window`,
      horizon,
    );
  }

  const todayStress = stress[stress.length - 1];
  const band = bandFor(todayStress);

  // A month is usable when its forward window has actually finished.
  const usable: number[] = [];
  const changes: (number | null)[] = new Array(months.length).fill(null);
  for (let i = 0; i < months.length; i++) {
    const c = forwardChangeAt(market, horizon, i);
    if (c === null) continue;
    changes[i] = c;
    usable.push(i);
  }

  if (usable.length === 0) {
    return empty("no month in the stored history has a finished forward window", horizon);
  }

  const unconditional = statsOf(usable.map((i) => changes[i] as number));

  const qualifying = usable.filter((i) => inBand(stress[i], band));
  const groups = clusterEpisodes(qualifying, s.baseRateEpisodeGapMonths);

  const list: Episode[] = groups.map((group) => {
    const vals = group.map((i) => changes[i] as number);
    return {
      startMonth: months[group[0]],
      endMonth: months[group[group.length - 1]],
      months: group.length,
      meanChangePct: round2(mean(vals) as number),
      bestPct: round2(Math.max(...vals)),
      worstPct: round2(Math.min(...vals)),
    };
  });

  const episodeMeans = list.map((e) => e.meanChangePct);
  const conditional: ConditionalSample = {
    ...statsOf(qualifying.map((i) => changes[i] as number)),
    episodes: list.length,
    episodeMeanPct: episodeMeans.length === 0 ? null : round2(mean(episodeMeans) as number),
    episodeHitRatePct:
      episodeMeans.length === 0
        ? null
        : round1((100 * episodeMeans.filter((m) => m > 0).length) / episodeMeans.length),
    // Newest visit first: the most recent one is the one a reader wants to check.
    list: [...list].reverse(),
  };

  const measured = conditional.episodes >= s.baseRateMinEpisodes;
  const bandSharePct = round1((100 * conditional.months) / usable.length);

  return {
    band,
    todayStress: round1(todayStress),
    horizonMonths: horizon,
    usableMonths: usable.length,
    spanStart: months[0],
    spanEnd: months[months.length - 1],
    conditional,
    unconditional,
    differencePct:
      measured && conditional.episodeMeanPct !== null && unconditional.meanPct !== null
        ? round2(conditional.episodeMeanPct - unconditional.meanPct)
        : null,
    bandSharePct,
    measured,
    unavailable: measured
      ? null
      : `only ${conditional.episodes} separate ${conditional.episodes === 1 ? "visit" : "visits"} to this ` +
        `band finished inside the stored history, against the ${s.baseRateMinEpisodes} required`,
  };
}
