/**
 * "What did $10,000 become?" — the compounding race, eight lines, one buy.
 *
 * WHY LOG. The leader outruns the field by roughly 700×. On a linear axis seven
 * of the eight lines would sit flat on the floor and the chart would say
 * nothing true about any of them except the winner. The axis is announced on
 * screen (chart-verify.ts refuses to pass a log chart without the chip) — an
 * unlabelled log axis is the second-oldest lie in this genre.
 *
 * The index line is the control: it is what NOT choosing looked like.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'yahoo',
  range: '15y',
  interval: '1mo',
  transform: 'invested',
  principal: 10000,
  // Clipped, then rebased to the first month EVERY line exists — the youngest
  // listing sets the start for all of them. Nobody gets a head start.
  from: '2012-01-01',
  tickers: [
    {key: 'NVDA', symbol: 'NVDA'},
    {key: 'TSLA', symbol: 'TSLA'},
    {key: 'AAPL', symbol: 'AAPL'},
    {key: 'MSFT', symbol: 'MSFT'},
    {key: 'AMZN', symbol: 'AMZN'},
    {key: 'META', symbol: 'META'},
    {key: 'GOOGL', symbol: 'GOOGL'},
    {key: 'SPY', symbol: 'SPY'},
  ],
};

export const spec: ChartSpec = {
  id: 'mag7-10k',
  subject: '$10,000 invested in the Magnificent 7',
  title: '$10,000 in the\nMagnificent 7',
  subtitle: 'One buy. Never sold. Every dividend back in.',
  hook: {question: 'What did $10,000 become?', kicker: 'Seven giants and the index that held them.'},
  unit: 'usd',
  scale: 'log',
  yFloor: 10000,
  dateFormat: 'month',
  series: [
    {key: 'NVDA', label: 'NVDA', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'NV'}},
    {key: 'TSLA', label: 'TSLA', color: '#e5749b', medallion: {kind: 'mono', text: 'TS'}},
    {key: 'AAPL', label: 'AAPL', color: C.consensus, medallion: {kind: 'mono', text: 'AA'}},
    {key: 'MSFT', label: 'MSFT', color: C.discovery, medallion: {kind: 'mono', text: 'MS'}},
    {key: 'AMZN', label: 'AMZN', color: C.macro, medallion: {kind: 'mono', text: 'AM'}},
    {key: 'META', label: 'META', color: '#6ea8ff', medallion: {kind: 'mono', text: 'ME'}},
    {key: 'GOOGL', label: 'GOOGL', color: C.fundamentals, medallion: {kind: 'mono', text: 'GO'}},
    {key: 'SPY', label: 'S&P 500', color: C.dim, medallion: {kind: 'mono', text: 'SP'}},
  ],
  payoff: {
    lead: 'Every one of them beat the index.',
    lines: [
      'One of them beat the index by two orders of magnitude.',
      'All eight were already famous when this chart starts.',
    ],
  },
  endcardChip: 'EPISODE · TEN THOUSAND DOLLARS',
};
