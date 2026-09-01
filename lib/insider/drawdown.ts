/* ============================================================================
 * The price setup — pure. No network, no database, no clock of its own.
 *
 * "Beaten down, but recently, and not dead" is the whole shape this looks for,
 * and each of those three words is a separate measurement:
 *
 *   beaten down   how far below its reference high the price sits
 *   recently      how long ago that high was set
 *   not dead      whether the fall has stopped accelerating
 *
 * Every threshold is an argument. None is a constant, and none is a policy:
 * a narrow band asks for a dip in a healthy business, a wide one accepts a
 * company the market has repriced entirely, and this module has no opinion
 * about which of those is the right thing to want. It measures, states which
 * checks passed against the thresholds it was given, and stops there.
 *
 * WINDOWS ARE CALENDAR, NOT SESSION COUNTS. A 52-week high means the highest
 * close in the last 52 weeks, and a 3-year high means three years — those are
 * the terms the figures are quoted in everywhere, and a session count would
 * quietly become something else on a series with gaps. This differs on purpose
 * from the rotation board, whose rolling statistics are defined in sessions.
 * ========================================================================== */

/** One daily close. Deliberately not the database row type: this module imports no storage. */
export interface Close {
  date: string;
  close: number;
}

export interface DrawdownProfile {
  asOf: string;
  sessions: number;
  price: number;

  /** Highest close in the last 52 weeks, and when it happened. */
  high52w: number;
  high52wDate: string;
  pctOff52wHigh: number;
  monthsSinceHigh: number;

  /** Mean close over the last 52 weeks — the steadier reference. */
  avg1y: number;
  pctBelow1yAvg: number;

  high3y: number;
  high3yDate: string;
  pctOff3yHigh: number;
  low3y: number;
  pctAbove3yLow: number;

  /** Return over the last eight weeks, and over the eight before those. */
  return8w: number | null;
  priorReturn8w: number | null;
  /** The fall is decelerating, or the price is not making fresh four-week lows. */
  stabilizing: boolean;
  decelerating: boolean | null;
  aboveFourWeekLow: boolean;
  low4w: number;

  /** Set when the history is too short for a window, which is stated rather than assumed away. */
  flags: string[];
}

const DAY_MS = 86_400_000;

const shift = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);

/** Bars on or after a date, in the order given (chronological in, chronological out). */
const since = (bars: Close[], from: string): Close[] => bars.filter((b) => b.date >= from);

/**
 * The close on a date, or the most recent one before it.
 *
 * Markets are shut on the day eight weeks ago as often as not, so an exact
 * lookup would return nothing for roughly two days in seven and make the
 * stabilisation reading unavailable at random.
 */
export function closeOnOrBefore(bars: Close[], date: string): Close | null {
  let best: Close | null = null;
  for (const b of bars) {
    if (b.date > date) break;
    best = b;
  }
  return best;
}

const pctChange = (from: number, to: number): number | null =>
  from > 0 ? (to - from) / from : null;

/**
 * Measure one price history. Returns null only when there is nothing to measure.
 *
 * Every window is computed against whatever history exists and says so when it
 * is short, rather than refusing. A company listed fourteen months ago has a
 * real 52-week high and no real three-year high, and the honest reading is the
 * first with the second flagged — not silence, and certainly not a three-year
 * high quietly taken from fourteen months of data without saying.
 */
export function computeDrawdownProfile(bars: Close[]): DrawdownProfile | null {
  const clean = bars
    .filter((b) => Number.isFinite(b.close) && b.close > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (clean.length === 0) return null;

  const flags: string[] = [];
  const last = clean[clean.length - 1];
  const asOf = last.date;
  const price = last.close;

  const from52w = shift(asOf, 364);
  const from3y = shift(asOf, 3 * 365);
  const window52 = since(clean, from52w);
  const window3y = since(clean, from3y);

  if (clean[0].date > from52w) {
    flags.push(
      `Only ${clean.length} sessions of history are stored, starting ${clean[0].date}, so the one-year ` +
        "figures below are measured over a shorter period than a year.",
    );
  }
  if (clean[0].date > from3y) {
    flags.push(
      `The stored history does not reach back three years, so the three-year high and low — and the ` +
        "fallen-angel check that rests on them — describe a shorter period.",
    );
  }

  let high52 = window52[0];
  for (const b of window52) if (b.close > high52.close) high52 = b;
  let high3 = window3y[0];
  for (const b of window3y) if (b.close > high3.close) high3 = b;
  let low3 = window3y[0];
  for (const b of window3y) if (b.close < low3.close) low3 = b;

  const avg1y = window52.reduce((s, b) => s + b.close, 0) / window52.length;

  const monthsSinceHigh = (Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${high52.date}T00:00:00Z`)) / (DAY_MS * 30.437);

  // Eight weeks, and the eight before those. Deceleration is the substantive
  // half of the stabilisation reading.
  const p0 = closeOnOrBefore(clean, shift(asOf, 56));
  const p1 = closeOnOrBefore(clean, shift(asOf, 112));
  const return8w = p0 ? pctChange(p0.close, price) : null;
  const priorReturn8w = p0 && p1 ? pctChange(p1.close, p0.close) : null;
  const decelerating = return8w !== null && priorReturn8w !== null ? return8w > priorReturn8w : null;
  if (return8w === null || priorReturn8w === null) {
    flags.push(
      "There is not enough history to compare the last eight weeks with the eight before them, so whether " +
        "the decline is slowing cannot be measured.",
    );
  }

  const window4w = since(clean, shift(asOf, 28));
  const low4w = window4w.reduce((m, b) => Math.min(m, b.close), window4w[0].close);
  // Weak by construction: this fails exactly when today IS the four-week low.
  // It is a "not making fresh lows" check, and the deceleration test above is
  // the one carrying the weight.
  const aboveFourWeekLow = price > low4w;

  return {
    asOf,
    sessions: clean.length,
    price,
    high52w: high52.close,
    high52wDate: high52.date,
    pctOff52wHigh: high52.close > 0 ? ((high52.close - price) / high52.close) * 100 : 0,
    monthsSinceHigh,
    avg1y,
    pctBelow1yAvg: avg1y > 0 ? ((avg1y - price) / avg1y) * 100 : 0,
    high3y: high3.close,
    high3yDate: high3.date,
    pctOff3yHigh: high3.close > 0 ? ((high3.close - price) / high3.close) * 100 : 0,
    low3y: low3.close,
    pctAbove3yLow: low3.close > 0 ? ((price - low3.close) / low3.close) * 100 : 0,
    return8w,
    priorReturn8w,
    stabilizing: decelerating === true || aboveFourWeekLow,
    decelerating,
    aboveFourWeekLow,
    low4w,
    flags,
  };
}

/* ----------------------------------------------------------------------------
 * The filter
 * -------------------------------------------------------------------------- */

export interface PriceThresholds {
  minDrawdownPct: number;
  maxDrawdownPct: number;
  /** True measures the band against the 52-week high; false against the one-year average. */
  measureAgainst52WeekHigh: boolean;
  maxMonthsSinceHigh: number;
  /** Zero switches the fallen-angel guard off entirely. */
  fallenAngelGuardPct: number;
  requireStabilizing: boolean;
}

export interface PriceCheck {
  key: "band" | "recency" | "fallen-angel" | "stabilizing";
  label: string;
  ok: boolean;
  /** Plain-language statement of what was measured against what. */
  detail: string;
}

export interface PriceFilterResult {
  pass: boolean;
  checks: PriceCheck[];
  /** The number the band was applied to, whichever reference was chosen. */
  drawdownPct: number;
  referenceLabel: string;
}

const pct = (n: number): string => `${n.toFixed(1)}%`;

/**
 * Apply somebody's risk tolerance to a measured profile.
 *
 * Returns every check with its own verdict rather than a bare boolean, because
 * the page has to be able to tell a visitor exactly which of THEIR OWN
 * thresholds a company failed. A rejection with no reason attached is the same
 * thing as an opinion.
 */
export function passesTurnaroundPriceFilter(
  profile: DrawdownProfile,
  t: PriceThresholds,
): PriceFilterResult {
  const drawdownPct = t.measureAgainst52WeekHigh ? profile.pctOff52wHigh : profile.pctBelow1yAvg;
  const referenceLabel = t.measureAgainst52WeekHigh
    ? "its highest close of the last year"
    : "its average close of the last year";

  const checks: PriceCheck[] = [];

  checks.push({
    key: "band",
    label: "Inside the drawdown band",
    ok: drawdownPct >= t.minDrawdownPct && drawdownPct <= t.maxDrawdownPct,
    detail:
      `${pct(drawdownPct)} below ${referenceLabel}, against a band of ` +
      `${pct(t.minDrawdownPct)} to ${pct(t.maxDrawdownPct)}.`,
  });

  checks.push({
    key: "recency",
    label: "The high is recent",
    ok: profile.monthsSinceHigh <= t.maxMonthsSinceHigh,
    detail:
      `The highest close of the last year was ${profile.monthsSinceHigh.toFixed(1)} months ago, against a ` +
      `limit of ${t.maxMonthsSinceHigh}.`,
  });

  if (t.fallenAngelGuardPct > 0) {
    checks.push({
      key: "fallen-angel",
      label: "Not a multi-year decline",
      ok: profile.pctOff3yHigh <= t.fallenAngelGuardPct,
      detail:
        `${pct(profile.pctOff3yHigh)} below its highest close of the last three years, against a guard at ` +
        `${pct(t.fallenAngelGuardPct)}.`,
    });
  }

  if (t.requireStabilizing) {
    checks.push({
      key: "stabilizing",
      label: "The fall has steadied",
      ok: profile.stabilizing,
      detail:
        profile.decelerating === null
          ? "There is not enough history to compare the last eight weeks with the eight before them."
          : profile.decelerating
            ? `The last eight weeks (${pct((profile.return8w ?? 0) * 100)}) fell less than the eight before ` +
              `them (${pct((profile.priorReturn8w ?? 0) * 100)}).`
            : profile.aboveFourWeekLow
              ? `The decline has not slowed, but the price is above its four-week low of ${profile.low4w.toFixed(2)}.`
              : `The decline has not slowed and the price is at its own four-week low of ${profile.low4w.toFixed(2)}.`,
    });
  }

  return { pass: checks.every((c) => c.ok), checks, drawdownPct, referenceLabel };
}

/**
 * How good the setup looks, 0-100, for the composite ranking.
 *
 * Rewards sitting in the middle of the chosen band over either edge: a name
 * barely down has not been repriced, and one at the far edge is as likely to
 * be a business in trouble as a bargain. Recency and a steadied fall each add
 * their own share. A company failing the filter has no setup score at all
 * rather than a low one — it was excluded, not ranked last.
 */
export function setupScore(profile: DrawdownProfile, t: PriceThresholds): number {
  const drawdownPct = t.measureAgainst52WeekHigh ? profile.pctOff52wHigh : profile.pctBelow1yAvg;
  const span = t.maxDrawdownPct - t.minDrawdownPct;
  // Distance from the middle of the band, as a share of half its width.
  const mid = t.minDrawdownPct + span / 2;
  const offCentre = span > 0 ? Math.min(1, Math.abs(drawdownPct - mid) / (span / 2)) : 1;
  const position = (1 - offCentre) * 60;

  const recency =
    t.maxMonthsSinceHigh > 0
      ? Math.max(0, 1 - profile.monthsSinceHigh / t.maxMonthsSinceHigh) * 20
      : 0;

  const steadied = (profile.decelerating === true ? 15 : 0) + (profile.aboveFourWeekLow ? 5 : 0);

  return Math.round(Math.min(100, Math.max(0, position + recency + steadied)) * 10) / 10;
}
