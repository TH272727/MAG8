/**
 * The chart-video contract — one spec per film, one frozen dataset per spec.
 *
 * WHY TWO FILES PER CHART. The spec (this shape) is taste: title, colors,
 * medallions, copy. The dataset (`ChartData`, written by scripts/chart-fetch.ts
 * into src/charts/data/) is fact: a frozen snapshot of numbers with the URL they
 * came from. Renders never touch the network — a re-render a year from now is
 * byte-identical, and the source line on screen names the file's own provenance
 * rather than a claim typed by hand.
 *
 * THE ONE STRUCTURAL HONESTY RULE. `dates` is shared and every series carries
 * exactly one value per date. A series that ran out of data cannot silently
 * flatline into a fake win (the failure that got the best-known chart in this
 * genre fact-checked in public: a partial term compared against full ones, the
 * short line simply stopping while the others kept climbing). A hole must be
 * written as `null`, and scripts/chart-verify.ts makes you label it.
 */
import {C} from '../theme.ts';

/** The badge riding the head of a line. */
export type Medallion =
  /** Monogram disc — a ticker or initials. No likeness, no license, no risk. */
  | {kind: 'mono'; text: string}
  /** A portrait from public/faces/<file>. See the likeness note in README-CHARTS.md. */
  | {kind: 'image'; file: string};

export type SeriesSpec = {
  /** Must match a key in the frozen dataset. */
  key: string;
  /** Drawn at the line head. Keep it short — it rides next to the medallion. */
  label: string;
  color: string;
  medallion?: Medallion;
  /** Thicker line + brighter glow. At most one or two per chart. */
  emphasis?: boolean;
};

export type Unit =
  /** $1,234 / $1.2M — money, grouped, compacted above six figures. */
  | 'usd'
  /** 12.4% */
  | 'pct'
  /** 1,234 — a plain index or count. */
  | 'index';

export type ChartSpec = {
  id: string;
  /** Headline over the plot. Two lines max at 62px inside the portrait safe width. */
  title: string;
  subtitle?: string;
  /** The 3-second opener (FORMULA §A: big → hold → shrink → chart). */
  hook: {question: string; kicker?: string};
  unit: Unit;
  /**
   * 'linear' is the dramatic read and the default. Use 'log' when the top
   * series outruns the field by more than ~30× and the also-rans would
   * otherwise sit invisibly on the floor — chart-verify.ts then REQUIRES the
   * LOG SCALE chip to be on screen, because a log axis that isn't announced is
   * the second-most common lie in this genre.
   */
  scale: 'linear' | 'log';
  /** Log scale needs a positive floor; ignored when linear. */
  yFloor?: number;
  series: SeriesSpec[];
  /** The turn after the race: what the numbers meant. */
  payoff: {lead: string; lines: string[]};
  /** Small chip on the endcard naming the episode. */
  endcardChip: string;
  dateFormat?: 'month' | 'year';
  /** Frame budgets. Defaults below are the 32s portrait cut. */
  beats?: Partial<Beats>;
};

export type Beats = {hook: number; race: number; payoff: number; endcard: number};

/**
 * Defaults: the whole film IS the chart — 690 frames, 23s, nothing before it and
 * nothing after it.
 *
 * OWNER CALL, 2026-09-04: the 3s question card and the 6s endcard were cut for
 * retention. A scroller meets the chart already drawing and leaves when it
 * stops, and the last frame — every line finished, every value at its head —
 * is also the loop point. The time the two cards used went back into the race
 * rather than out of the runtime, so the chart draws at ~4 frames per data
 * point instead of ~3 and the date is followable.
 *
 * The MAG8 information that used to live on the endcard now rides the header on
 * every single frame instead: mark, wordmark, tagline, address. Casual and
 * constant rather than a card at the end nobody reaches.
 *
 * `hook` and `endcard` are still real beats — set either to a frame count and
 * the scene comes back for that chart. Zero-length beats are dropped from the
 * sequence entirely, so they cost nothing while unused.
 */
export const DEFAULT_BEATS: Beats = {hook: 0, race: 690, payoff: 0, endcard: 0};

export const beatsOf = (spec: ChartSpec): Beats => ({...DEFAULT_BEATS, ...spec.beats});

export const totalFrames = (spec: ChartSpec): number => {
  const b = beatsOf(spec);
  return b.hook + b.race + b.payoff + b.endcard;
};

/* -------------------------------------------------------------------------- */
/*  The frozen dataset — written by scripts/chart-fetch.ts, never by hand      */
/* -------------------------------------------------------------------------- */

export type ChartData = {
  id: string;
  /** ISO day the numbers were pulled. Printed on screen. */
  fetchedAt: string;
  /** Human source, e.g. "Adjusted monthly closes · Yahoo Finance". */
  sourceLabel: string;
  sourceUrl: string;
  /** One line naming the arithmetic done to the raw numbers. Printed on screen. */
  method: string;
  /** Shared x axis. ISO days, ascending, no duplicates. */
  dates: string[];
  /** One entry per SeriesSpec.key; values.length === dates.length. */
  series: {key: string; values: (number | null)[]}[];
  /** Anything the viewer is owed that the method line does not cover. */
  notes?: string[];
};

/** Ordered series colors — the house lens palette first, then spread. */
export const SERIES_COLORS = [
  C.confluence,
  C.discovery,
  C.consensus,
  C.fundamentals,
  C.macro,
  '#e5749b',
  '#6ea8ff',
  '#b7c34a',
] as const;

/* -------------------------------------------------------------------------- */
/*  Formatting — shared by the plot, the readouts and the verifier             */
/* -------------------------------------------------------------------------- */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** '2011-10-01' → 'OCT 2011' / '2011'. Pure string work — no Date, no clock. */
export const formatDate = (iso: string, mode: 'month' | 'year' = 'month'): string => {
  const [y, m] = iso.split('-');
  if (mode === 'year') return y;
  const idx = Number(m) - 1;
  return `${MONTHS[idx] ?? '???'} ${y}`;
};

const group = (n: number): string => {
  const [whole, frac] = n.toFixed(0).split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (frac ? `.${frac}` : '');
};

/**
 * Money below $100 is written WITH CENTS.
 *
 * `group()` rounds to whole units, which is right for a portfolio value and
 * wrong for a shelf price: a pound of coffee at $9.32 printed as "$9", and a
 * chart whose whole subject is what things cost showed every line as a flat
 * integer that changed once a year. The threshold is high enough that no
 * existing film is touched — the smallest value in any of them is $8,000 — and
 * low enough that a portfolio value never grows cents.
 */
const CENTS_BELOW = 100;

/** Full precision — used for the readouts a viewer stares at. */
export const formatValue = (v: number, unit: Unit): string => {
  if (unit === 'pct') return `${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(1)}%`;
  if (unit === 'index') return group(v);
  if (Math.abs(v) < CENTS_BELOW) return `${v < 0 ? '-' : ''}$${Math.abs(v).toFixed(2)}`;
  return `$${group(v)}`;
};

/** Compact — used on axis ticks, where width is scarce. */
export const formatTick = (v: number, unit: Unit): string => {
  if (unit === 'pct') return `${Math.round(v)}%`;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const money = unit === 'usd' ? '$' : '';
  if (abs >= 1e9) return `${sign}${money}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}${money}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${money}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  // Same rule as the readouts: an axis of whole dollars under a chart of shelf
  // prices puts three ticks on "$2" and hides the ones between them.
  if (unit === 'usd' && abs < CENTS_BELOW) return `${sign}${money}${abs.toFixed(2)}`;
  return `${sign}${money}${group(abs)}`;
};
