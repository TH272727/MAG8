/**
 * "Someone kept their savings as cash, at home, and never moved it."
 *
 * WHY THE INVERSE PAIRS. Yahoo quotes most currencies as USDXXX — units of the
 * local money per dollar — which is the price of a DOLLAR, and a chart of that
 * RISES as the saver loses. The saver's own position is the reciprocal, and
 * Yahoo publishes it directly as XXXUSD=X, so this film reads the pair that
 * matches the story rather than inverting one that does not.
 *
 * WHY LOG. The field finishes about 375x apart. On a linear axis seven of the
 * eight would lie flat on the floor and only the yen would be legible, which
 * would say nothing true about the film's actual subject.
 *
 * WHY "CASH" AND NOT "A SAVINGS ACCOUNT" — the honesty of this one. Several of
 * these countries paid very high nominal deposit rates across this window, and
 * a saver who put the money in a BANK would have earned interest offsetting
 * part of what the chart shows. So the film claims only the smaller, checkable
 * thing — money held as cash — and the subtitle says so on every frame. The
 * window discipline gets stricter on a story film, not looser: the same rule
 * that made pizza-day start months after pizza day.
 *
 * THE BASE IS MARCH 2006 — not a date chosen for drama. February 2005 is where
 * the lira's history begins, but the fetcher rebases to the first month EVERY
 * leg reports without a hole, and that is 2006-03. It is the shorter window and
 * the only honest one: a line rebased to its own first date is the comparison
 * that gets charts fact-checked.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'yahoo',
  range: '30y',
  interval: '1mo',
  transform: 'invested',
  principal: 1000,
  from: '2005-01-01',
  // Not "adjusted closes": an exchange rate has nothing to adjust, and the
  // default credit would have sat on screen over a method line about cash.
  sourceLabel: 'Monthly exchange rates · Yahoo Finance',
  tickers: [
    {key: 'JPY', symbol: 'JPYUSD=X'},
    {key: 'MXN', symbol: 'MXNUSD=X'},
    {key: 'BRL', symbol: 'BRLUSD=X'},
    {key: 'INR', symbol: 'INRUSD=X'},
    {key: 'ZAR', symbol: 'ZARUSD=X'},
    {key: 'NGN', symbol: 'NGNUSD=X'},
    {key: 'TRY', symbol: 'TRYUSD=X'},
    {key: 'ARS', symbol: 'ARSUSD=X'},
  ],
};

export const spec: ChartSpec = {
  id: 'money-left-at-home',
  subject: '$1,000 held as cash in eight countries',
  title: '$1,000 in cash,\nin eight countries.',
  subtitle: 'Converted once, then held as cash — no interest earned.',
  hook: {
    question: 'What if you never moved your money?',
    kicker: 'Eight currencies, one drawer, twenty years.',
  },
  unit: 'usd',
  scale: 'log',
  // A street in Buenos Aires — people, vendors, depth — and the country whose
  // line falls furthest in this film.
  //
  // REJECTED FIRST: a money-changer shopfront, which was thematically exact and
  // wrong on every other count — a real business named in legible gold letters
  // above the door, two manufacturers' logos, and a phone's burnt-in watermark.
  // A named company behind a film about currencies losing value implies an
  // association nobody agreed to, and a storefront is a product shot, not a
  // scene. Caught by opening the file at full size, which is the only way it
  // ever is. The political poster in this frame sits at the far left edge and a
  // centred cover-crop excludes it.
  backdrop: {file: 'money-left-at-home.jpg', strength: 0.16, focus: 'center 55%'},
  // yFloor is the floor the axis PREFERS, and the gate refuses a log axis without a
  // positive one. Set to 2 rather than 1: the lowest value the film ever reaches is the
  // peso at $2.04, so a floor of 1 bought an entire extra decade of empty plot under
  // the lowest line for the whole run.
  yFloor: 2,
  dateFormat: 'month',
  series: [
    {key: 'JPY', label: 'Japanese yen', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'JPY'}},
    {key: 'MXN', label: 'Mexican peso', color: C.consensus, medallion: {kind: 'mono', text: 'MXN'}},
    {key: 'BRL', label: 'Brazilian real', color: C.discovery, medallion: {kind: 'mono', text: 'BRL'}},
    {key: 'INR', label: 'Indian rupee', color: C.macro, medallion: {kind: 'mono', text: 'INR'}},
    {key: 'ZAR', label: 'S. African rand', color: '#6ea8ff', medallion: {kind: 'mono', text: 'ZAR'}},
    {key: 'NGN', label: 'Nigerian naira', color: '#b7c34a', medallion: {kind: 'mono', text: 'NGN'}},
    {key: 'TRY', label: 'Turkish lira', color: '#e5749b', medallion: {kind: 'mono', text: 'TRY'}},
    {key: 'ARS', label: 'Argentine peso', color: C.fundamentals, emphasis: true, medallion: {kind: 'mono', text: 'ARS'}},
  ],
  payoff: {
    lead: 'Doing nothing is not the same as risking nothing.',
    lines: [
      'All eight ended below where they started. Nobody was robbed and nobody traded.',
      'The only things that happened to this money were time, and the country it sat in.',
    ],
  },
  endcardChip: 'EPISODE · MONEY LEFT AT HOME',
};
