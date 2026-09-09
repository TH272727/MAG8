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
  /**
   * What this film is ABOUT, in plain words a stranger understands — the thing
   * being measured, not the story about it. "Life expectancy at birth", not
   * "the gap that closed".
   *
   * OWNER RULE (2026-09-07): the first text a viewer reads has to tell them what
   * they are watching. `the-gap-that-closed` opened on the words "The gap that
   * closed" and a viewer had to hunt down to the subtitle to learn the film was
   * about life expectancy — by which point they have already scrolled. So the
   * subject is declared here and `chart-verify` FAILS a spec whose TITLE does
   * not carry a word of it. The field is not rendered; it exists to be checked
   * against the title, which is what viewers actually read.
   */
  subject: string;
  /**
   * Headline over the plot, and the first thing read. Two lines max at 62px
   * inside the portrait safe width — about 30 characters a line, measured off a
   * real frame.
   *
   * LEAD WITH THE SUBJECT, then the story: "Life expectancy: / the gap that
   * closed". The hook survives, it just stops going first.
   */
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
  /**
   * A photograph under the plot — a real picture of the thing the film is about,
   * darkened almost to texture.
   *
   * WHY. A chart drawn entirely out of vector furniture on a flat dark ground
   * reads as generated, because everything in the frame was generated. One
   * photographic surface underneath it is the cheapest possible signal that a
   * person chose the subject, and at these strengths it is felt rather than
   * looked at — you notice the frame has a floor, not what is on it.
   *
   * The file is fetched and frozen by scripts/chart-backdrop.ts, which accepts
   * PUBLIC DOMAIN and CC0 ONLY and records the licence in
   * public/backdrops/CREDITS.json. That rule is not squeamishness: CC BY and
   * CC BY-SA are equally free and both oblige an attribution ON THE FRAME, and
   * a chart film has one line of receipts which belongs to the data.
   * chart-verify refuses to render a backdrop whose licence is not on file.
   */
  backdrop?: {
    /** Filename inside public/backdrops/. */
    file: string;
    /** How much of the photograph survives the scrim. Clamped to 0.04–0.25. */
    strength?: number;
    /** CSS object-position, e.g. 'center 35%'. */
    focus?: string;
  };
  /**
   * A one-day move so violent that the honesty gate cannot tell it from a
   * parse artefact — DECLARED by the author, with the reason, so the gate can
   * report it instead of blocking it.
   *
   * WHY THIS IS A DECLARATION AND NOT A THRESHOLD. The discontinuity check asks
   * whether a spike lands somewhere the line ever otherwise goes, because a
   * blank field read as zero does not and a bad month does. That question has
   * one true exception: a price that goes NEGATIVE for a single session has, by
   * definition, been nowhere near that level before or since. Loosening the
   * threshold to let it through would also let through the blank-field collapse
   * the check exists to catch. So the author names the series, the day and the
   * reason instead, and anything undeclared still FAILS.
   *
   * Declaring an excursion is a claim that the source row was read and the
   * event is real. It is not a way to quiet a gate that is complaining.
   */
  knownExcursions?: {key: string; date: string; why: string}[];
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

/**
 * Above these magnitudes a readout is COMPACTED rather than grouped.
 *
 * `group()` is right up to a few million — "$7,281,108" is a number a viewer
 * reads. It stops being one at national scale: federal debt written out in
 * full is "$34,472,927,000,000", eighteen characters in a 268px line-head
 * column, and a population is "1,463,865,525". Neither is read; both are
 * counted. So money compacts from a billion and a count from a million.
 *
 * Both thresholds sit ABOVE every value in every film published before them —
 * the largest money figure ever drawn here is $7.28M and the largest count is
 * 27,945 — so nothing already published moves. That is the same rule the cents
 * threshold was chosen under.
 *
 * LOWERED $1B → $100M, 2026-09-07, under that same rule. A billion left a gap:
 * a film whose lines START in the hundreds of millions and END in the trillions
 * crosses the threshold mid-run, and below it the readout prints in full.
 * Social Security in 1949 drew as "$690,680,167" — twelve characters through
 * the badge and into the axis, on a chart whose other four heads read "$22.4B"
 * and "$8.0B". Found by reading a still, which is the only thing that finds
 * these.
 *
 * The new threshold was checked the same way the old one was, by scanning every
 * frozen dataset rather than by recalling them: across all 26 charts in the tree
 * the $100M–$1B band contains 15 values and every one of them belongs to the
 * film that prompted this. The largest money value in any OTHER usd film is
 * either $34.47T (already compacted, above the trillion tier) or $69.01M (below
 * the new threshold, still grouped). Nothing published or in flight moves.
 */
const COMPACT_USD_ABOVE = 1e8;
const COMPACT_INDEX_ABOVE = 1e6;

/** Full precision — used for the readouts a viewer stares at. */
export const formatValue = (v: number, unit: Unit): string => {
  if (unit === 'pct') return `${v >= 0 ? '' : '-'}${Math.abs(v).toFixed(1)}%`;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (unit === 'index') {
    if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= COMPACT_INDEX_ABOVE) return `${sign}${(abs / 1e6).toFixed(1)}M`;
    return group(v);
  }
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= COMPACT_USD_ABOVE) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs < CENTS_BELOW) return `${sign}$${abs.toFixed(2)}`;
  return `$${group(v)}`;
};

/** Compact — used on axis ticks, where width is scarce. */
export const formatTick = (v: number, unit: Unit): string => {
  if (unit === 'pct') return `${Math.round(v)}%`;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  const money = unit === 'usd' ? '$' : '';
  // A trillion tier, because a log axis over national accounts walks decades:
  // without it $10T printed as "$10000B" and ate the axis gutter.
  if (abs >= 1e12) return `${sign}${money}${(abs / 1e12).toFixed(abs >= 1e13 ? 0 : 1)}T`;
  if (abs >= 1e9) return `${sign}${money}${(abs / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${sign}${money}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${money}${(abs / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}K`;
  // Same rule as the readouts: an axis of whole dollars under a chart of shelf
  // prices puts three ticks on "$2" and hides the ones between them.
  if (unit === 'usd' && abs < CENTS_BELOW) return `${sign}${money}${abs.toFixed(2)}`;
  return `${sign}${money}${group(abs)}`;
};
