/**
 * "How long does a bubble take to undo?" — four markets from December 1989.
 *
 * THE STORY. At the end of 1989 the Japanese stock market was the largest on
 * earth and the land under central Tokyo was said to be worth more than the
 * whole of California. The index peaked that December at 38,915.87, and the
 * base of this chart is that exact monthly close. It did not close a month
 * above it again until February 2024 — thirty-four years — and then slipped
 * back under more than once before holding. Of the 442 months on screen, 418
 * are spent below the line it started on, while three other markets climb away
 * from it.
 *
 * WHY IT IS A PERCENT CHART AND NOT A MONEY ONE. These four indices are quoted
 * in four currencies, so "what $10,000 became" across them would be a claim
 * about exchange rates as much as about markets, and a viewer would have no way
 * to tell which part was which. Rebased, each line measures a market against
 * ITSELF — which is exactly the question the film asks, and the only one this
 * data can answer honestly. The subtitle carries the two things that buys:
 * own currency, and price only. None of these is a total-return index, so
 * dividends are in none of them. The DAX was the obvious fourth market and was
 * CUT for precisely that reason: it is a total-return index, and putting it
 * beside three price indices would hand Germany a free thirty years of
 * reinvested dividends that the others are not credited with.
 *
 * THE WINDOW. December 1989 is the peak month and the base, so every line is
 * measured from the same date; Hong Kong's series is the youngest and reaches
 * back to 1986, comfortably before it.
 *
 * FOUND WHILE BUILDING THIS. Yahoo dates a bar in its own exchange's local
 * time, and reading it as UTC pulls Tokyo's stamps back across midnight — the
 * Nikkei's October bars arrived as 30 September and month-bucketing filed them
 * under September, shifting an entire foreign series one month against its
 * peers for its whole history with every value real. The fetcher now applies
 * the offset the response itself carries.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'yahoo',
  range: '40y',
  interval: '1mo',
  transform: 'pctChange',
  // All four are PRICE indices — declared, so the line printed under the chart
  // says so instead of asserting the fund-shaped default.
  dividends: 'excluded',
  // Not "adjusted closes": there is nothing to adjust in a price index, and
  // that default credit sat directly above a method line saying so.
  sourceLabel: 'Index closes · Yahoo Finance',
  // The month the Japanese market peaked. Every line is rebased here.
  from: '1989-12-01',
  tickers: [
    {key: 'JPN', symbol: '^N225'},
    {key: 'USA', symbol: '^GSPC'},
    {key: 'HKG', symbol: '^HSI'},
    {key: 'GBR', symbol: '^FTSE'},
  ],
};

export const spec: ChartSpec = {
  id: 'nikkei-1989',
  subject: 'stock markets since the 1989 peak',
  title: 'Stock markets since\nthe 1989 bubble',
  subtitle: 'Four of them, share prices only, each in its own currency.',
  hook: {
    question: 'How long does a bubble take to undo?',
    kicker: 'Four markets, measured from the month Japan peaked.',
  },
  unit: 'pct',
  scale: 'linear',
  // No floor: the Japanese line spends decades BELOW its starting level and the
  // axis has to open downward to hold it. A line drawn outside the plot box is
  // a chart hiding something.
  dateFormat: 'year',
  backdrop: {file: 'nikkei-1989.jpg', strength: 0.22, focus: 'center 40%'},
  series: [
    {key: 'JPN', label: 'Japan', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'JPN'}},
    {key: 'USA', label: 'United States', color: C.consensus, emphasis: true, medallion: {kind: 'mono', text: 'USA'}},
    {key: 'HKG', label: 'Hong Kong', color: C.fundamentals, medallion: {kind: 'mono', text: 'HKG'}},
    {key: 'GBR', label: 'United Kingdom', color: C.macro, medallion: {kind: 'mono', text: 'GBR'}},
  ],
  payoff: {
    lead: 'One of these lines spent a working lifetime below where it started.',
    lines: [
      'Each market is measured against itself, in its own money.',
      'Price only — no dividends are counted in any of the four.',
    ],
  },
  endcardChip: 'EPISODE · THE LONG WAY BACK',
};
