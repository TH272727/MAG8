/**
 * "Which country's stock market won?" — eight national markets, one currency.
 *
 * WHY THIS SHAPE. The two money films in the set both animate DOLLARS: what a
 * lump sum became. This one animates the percentage, which is the right unit
 * when the question is "which market", not "how much money" — and it is the
 * first chart here that leaves the United States.
 *
 * WHY IT IS A RACE. Brazil leads for a solid DECADE out of the gate, loses it,
 * and the lead then changes hands eleven more times in five years before the
 * United States settles into it — and Taiwan takes it at the very end. Sixteen
 * lead changes over twenty-two years.
 *
 * THE ONE THING A VIEWER IS OWED: every line is a US-dollar total return, so a
 * currency move is inside it. A Japanese fund can fall in dollars in a year the
 * Tokyo index rose, and that is not an error — it is what the money did for
 * someone holding dollars. The subtitle says "in US dollars" for that reason.
 *
 * The window is set by the youngest fund (the China fund, November 2004) and
 * every line is rebased to that month, so nobody is measured over a shorter
 * run than anybody else.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'yahoo',
  // Explicit, never 'max' — 'max' makes the source hand back quarterly bars for
  // some symbols and monthly for others, silently.
  range: '25y',
  interval: '1mo',
  transform: 'pctChange',
  tickers: [
    {key: 'TWN', symbol: 'EWT'},
    {key: 'USA', symbol: 'SPY'},
    {key: 'CAN', symbol: 'EWC'},
    {key: 'BRA', symbol: 'EWZ'},
    {key: 'GER', symbol: 'EWG'},
    {key: 'JPN', symbol: 'EWJ'},
    {key: 'GBR', symbol: 'EWU'},
    {key: 'CHN', symbol: 'FXI'},
  ],
};

export const spec: ChartSpec = {
  id: 'world-markets',
  title: "Which country's stock\nmarket won?",
  subtitle: 'Total return in US dollars, from one shared month.',
  hook: {question: "Which country's stock market won?", kicker: 'Eight markets, one currency, one start date.'},
  unit: 'pct',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  series: [
    {key: 'TWN', label: 'Taiwan', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'TWN'}},
    {key: 'USA', label: 'United States', color: C.consensus, emphasis: true, medallion: {kind: 'mono', text: 'USA'}},
    {key: 'CAN', label: 'Canada', color: C.fundamentals, medallion: {kind: 'mono', text: 'CAN'}},
    {key: 'BRA', label: 'Brazil', color: '#b7c34a', medallion: {kind: 'mono', text: 'BRA'}},
    {key: 'GER', label: 'Germany', color: C.macro, medallion: {kind: 'mono', text: 'GER'}},
    {key: 'JPN', label: 'Japan', color: '#e5749b', medallion: {kind: 'mono', text: 'JPN'}},
    {key: 'GBR', label: 'United Kingdom', color: '#6ea8ff', medallion: {kind: 'mono', text: 'GBR'}},
    {key: 'CHN', label: 'China', color: C.discovery, medallion: {kind: 'mono', text: 'CHN'}},
  ],
  payoff: {
    lead: 'The market that led for a decade finished in the bottom half.',
    lines: [
      'The lead changed hands more often in five years than in the fifteen before them.',
      'Every line is measured in dollars, so the currency is part of the result.',
    ],
  },
  endcardChip: 'EPISODE · THE WORLD RACE',
};
