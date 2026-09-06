import type { RotationSettings } from "../rotation-settings";
import { forwardChangeAt, rollingPercentile } from "./math";
import { directionFrom, type DirectionKey } from "./score";

/* ============================================================================
 * Conditional history — pure. No network, no database, no clock of its own.
 *
 * The board says where a ratio sits. This says what happened next, the last
 * times it sat there. It is a description of the past and not a forecast, and
 * three rules keep it from reading like one:
 *
 *   - The sample is counted in EPISODES, never in days. A sixty-three-day
 *     forward reading taken on consecutive sessions shares sixty-two of those
 *     days with the reading beside it, so a run of qualifying sessions is one
 *     observation. Counting the days instead multiplies a handful of visits
 *     into hundreds of "observations" that are almost the same observation.
 *
 *   - Every conditional figure is published beside the plain figure for the
 *     same stretch of history. A conditional average alone says nothing: the
 *     only number that carries information is the difference between them.
 *
 *   - Below the operator's minimum, this reports NOT MEASURED and ranks last.
 *     It never fills in a mean of three overlapping observations, and it never
 *     reports a thin sample as a zero.
 *
 * Nothing here looks forward from a session whose forward window has not
 * finished, and the percentile that defines a session's bucket is trailing —
 * so a reading is only ever compared with sessions that had already happened
 * when it was taken.
 * ========================================================================== */

export type BaseRateSettings = Pick<
  RotationSettings,
  | "percentileWindowDays"
  | "directionDeadbandPct"
  | "baseRateHorizonDays"
  | "baseRateMinEpisodes"
  | "baseRateEpisodeGapDays"
>;

export interface BaseRateInputs {
  /** Sessions, oldest first, one entry per date with a computable ratio. */
  dates: string[];
  values: number[];
  /** The two averages at each session, for the direction refinement. Optional. */
  fast?: (number | null)[];
  slow?: (number | null)[];
  settings: BaseRateSettings;
}

/** One visit to the bucket: a run of qualifying sessions, collapsed. */
export interface Episode {
  startDate: string;
  endDate: string;
  sessions: number;
  /** Mean forward change over the sessions in this episode, percent. */
  meanChangePct: number;
  bestPct: number;
  worstPct: number;
}

export interface Stats {
  /** Qualifying sessions. Present for scale, never as the sample size. */
  sessions: number;
  meanPct: number | null;
  medianPct: number | null;
  /** Share of qualifying SESSIONS whose forward change was positive. */
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

export interface Band {
  lo: number;
  hi: number;
  /** "20-30th percentile" — the band as a reader should see it. */
  label: string;
}

export interface BaseRateResult {
  /** The decile of its own trailing range the ratio sits in today. */
  band: Band | null;
  todayPercentile: number | null;
  todayDirection: DirectionKey;
  horizonSessions: number;
  percentileWindowDays: number;
  /** Sessions that had both a trailing percentile and a finished forward window. */
  usableSessions: number;
  spanStart: string | null;
  spanEnd: string | null;
  conditional: ConditionalSample;
  /** Every usable session, the yardstick the conditional figure is read against. */
  unconditional: Stats;
  /** Conditional mean minus unconditional mean, percentage points. */
  differencePct: number | null;
  /**
   * Share of the usable window this ratio spent in today's band.
   *
   * The honesty check on the whole reading. A ratio in a long trend keeps
   * making new extremes inside its own trailing window, so it can sit in its
   * "top decile" for most of its measurable life — and a conditional average
   * over most of the sample is barely conditional on anything.
   */
  bandSharePct: number | null;
  /**
   * The same bucket narrowed to sessions that also favoured the side it favours
   * today. Null unless that narrower sample clears the episode floor on its own.
   */
  directionMatched: ConditionalSample | null;
  /** True only when the conditional sample cleared the operator's floor. */
  measured: boolean;
  /** Why there is no published figure. Null when there is one. */
  unavailable: string | null;
}

/* -- Small statistics, kept local so nothing here rounds before it is shown. -- */

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function positiveShare(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return (100 * xs.filter((x) => x > 0).length) / xs.length;
}

function statsOf(xs: number[]): Stats {
  return {
    sessions: xs.length,
    meanPct: mean(xs),
    medianPct: median(xs),
    positiveSharePct: positiveShare(xs),
  };
}

const EMPTY_SAMPLE: ConditionalSample = {
  sessions: 0,
  meanPct: null,
  medianPct: null,
  positiveSharePct: null,
  episodes: 0,
  episodeMeanPct: null,
  episodeHitRatePct: null,
  list: [],
};

/**
 * The decile a percentile falls in. The top band closes at 100 inclusive, so a
 * ratio at its own highest reading on record lands in a band rather than in
 * nothing.
 */
export function bandFor(percentile: number): Band {
  const lo = Math.min(90, Math.floor(percentile / 10) * 10);
  const hi = lo + 10;
  return { lo, hi, label: `${lo}-${hi}th percentile` };
}

function inBand(percentile: number, band: Band): boolean {
  return band.hi >= 100 ? percentile >= band.lo : percentile >= band.lo && percentile < band.hi;
}

/**
 * Collapse qualifying session indices into episodes.
 *
 * Two qualifying sessions closer together than the gap belong to the same
 * visit. Without the tolerance, a condition that flickers across one stretch of
 * market is counted as many separate visits — which inflates the apparent
 * sample at the exact moment the real one is shrinking.
 */
export function clusterEpisodes(indices: number[], gapSessions: number): number[][] {
  const out: number[][] = [];
  let current: number[] = [];
  let previous = Number.NEGATIVE_INFINITY;
  for (const i of indices) {
    if (i - previous > gapSessions) {
      if (current.length > 0) out.push(current);
      current = [];
    }
    current.push(i);
    previous = i;
  }
  if (current.length > 0) out.push(current);
  return out;
}

function buildSample(
  indices: number[],
  changes: (number | null)[],
  dates: string[],
  gapSessions: number,
): ConditionalSample {
  const groups = clusterEpisodes(indices, gapSessions);
  const list: Episode[] = [];
  const allChanges: number[] = [];

  for (const g of groups) {
    const xs: number[] = [];
    for (const i of g) {
      const c = changes[i];
      if (c !== null && c !== undefined) xs.push(c);
    }
    if (xs.length === 0) continue;
    allChanges.push(...xs);
    list.push({
      startDate: dates[g[0]],
      endDate: dates[g[g.length - 1]],
      sessions: xs.length,
      meanChangePct: mean(xs)!,
      bestPct: Math.max(...xs),
      worstPct: Math.min(...xs),
    });
  }

  const episodeMeans = list.map((e) => e.meanChangePct);
  return {
    ...statsOf(allChanges),
    episodes: list.length,
    episodeMeanPct: mean(episodeMeans),
    episodeHitRatePct: positiveShare(episodeMeans),
    // Newest visit first: the reader wants the most recent precedent at the top.
    list: [...list].reverse(),
  };
}

/**
 * What happened next, the last times this ratio sat where it sits now.
 */
export function computeBaseRates(inputs: BaseRateInputs): BaseRateResult {
  const { dates, values, settings: s } = inputs;
  const horizon = s.baseRateHorizonDays;
  const n = values.length;

  const empty = (reason: string): BaseRateResult => ({
    band: null,
    todayPercentile: null,
    todayDirection: "balanced",
    horizonSessions: horizon,
    percentileWindowDays: s.percentileWindowDays,
    usableSessions: 0,
    spanStart: n > 0 ? dates[0] : null,
    spanEnd: n > 0 ? dates[n - 1] : null,
    conditional: EMPTY_SAMPLE,
    unconditional: statsOf([]),
    differencePct: null,
    bandSharePct: null,
    directionMatched: null,
    measured: false,
    unavailable: reason,
  });

  if (n === 0) return empty("There is no stored history for this indicator.");
  if (horizon < 1) return empty("The forward window is set to nothing, so there is no change to measure.");

  const pct = rollingPercentile(values, s.percentileWindowDays);
  const changes: (number | null)[] = new Array(n).fill(null);
  for (let i = 0; i < n; i++) changes[i] = forwardChangeAt(values, horizon, i);

  const today = n - 1;
  const todayPercentile = pct[today];
  const fast = inputs.fast ?? [];
  const slow = inputs.slow ?? [];
  const todayDirection = directionFrom(fast[today] ?? null, slow[today] ?? null, s.directionDeadbandPct);

  // A session is usable only when it has a trailing percentile AND its forward
  // window has finished inside the stored history. The second condition is what
  // stops the newest sessions — the ones a reader cares most about — from being
  // counted against a future that has not happened.
  const usable: number[] = [];
  for (let i = 0; i < n; i++) {
    if (pct[i] === null) continue;
    if (changes[i] === null) continue;
    usable.push(i);
  }

  const unconditional = statsOf(usable.map((i) => changes[i]!));

  if (todayPercentile === null) {
    return {
      ...empty(
        `The historical-position reading needs ${s.percentileWindowDays} sessions of history and this series has ${n}.`,
      ),
      unconditional,
      usableSessions: usable.length,
      spanStart: dates[0],
      spanEnd: dates[n - 1],
    };
  }

  const band = bandFor(todayPercentile);
  const qualifying = usable.filter((i) => inBand(pct[i]!, band));
  const conditional = buildSample(qualifying, changes, dates, s.baseRateEpisodeGapDays);

  const measured = conditional.episodes >= s.baseRateMinEpisodes;

  // The narrower cut is offered only when it stands on its own feet. Reporting a
  // direction-matched average from three visits beside a measured one would
  // invite the reader to prefer the smaller number for being more specific.
  const matchedIdx = qualifying.filter(
    (i) => directionFrom(fast[i] ?? null, slow[i] ?? null, s.directionDeadbandPct) === todayDirection,
  );
  const matched = buildSample(matchedIdx, changes, dates, s.baseRateEpisodeGapDays);
  const directionMatched = matched.episodes >= s.baseRateMinEpisodes ? matched : null;

  const differencePct =
    conditional.meanPct !== null && unconditional.meanPct !== null
      ? conditional.meanPct - unconditional.meanPct
      : null;

  return {
    band,
    todayPercentile,
    todayDirection,
    horizonSessions: horizon,
    percentileWindowDays: s.percentileWindowDays,
    usableSessions: usable.length,
    spanStart: usable.length > 0 ? dates[usable[0]] : dates[0],
    spanEnd: usable.length > 0 ? dates[usable[usable.length - 1]] : dates[n - 1],
    conditional,
    unconditional,
    differencePct,
    bandSharePct: usable.length > 0 ? (100 * conditional.sessions) / usable.length : null,
    directionMatched,
    measured,
    unavailable: measured
      ? null
      : `Only ${conditional.episodes} separate ${conditional.episodes === 1 ? "visit" : "visits"} to this band ` +
        `finished inside the stored history, against the ${s.baseRateMinEpisodes} required.`,
  };
}
