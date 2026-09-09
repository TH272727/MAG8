/**
 * "The pizzas that cost ten thousand bitcoin" — what $41 became, five ways.
 *
 * THE STORY. In May 2010 someone paid ten thousand bitcoin for two delivered
 * pizzas. It is the first known purchase of a real-world good with the currency,
 * and the two pizzas were worth about forty-one dollars. Nobody is named here
 * and nobody is going to be: FORMULA §K makes a chart about a named
 * individual's money an owner decision rather than a default, and the story
 * needs no name to land.
 *
 * THE HONEST WINDOW, which is the whole design problem with this film.
 * Bitcoin had NO MARKET PRICE on the day of the pizzas. blockchain.com's series
 * runs from January 2009 and reads 0.00 every single day until 2010-08-18,
 * because until then there was nowhere to sell one. Those zeros are the
 * blank-field trap in its purest form — rebase against a zero and you get an
 * infinity; rebase to one and you get minus a hundred percent — so the fetcher
 * drops them, and the run can only begin in the first month a price existed.
 * The subtitle says so. What the film therefore shows is $41 put in that month,
 * NOT the ten thousand coins, which by August were already worth many times it.
 * The number on the bitcoin line at the end is smaller than the number in the
 * headlines about those coins, and that is the correct, checkable figure for
 * the claim this chart actually makes.
 *
 * WHY LOG, AND WHY THE OTHERS LOOK FLAT. The winning line ends more than a
 * million times where it started while the runners-up manage single digits, so
 * six decades of axis is the only way all five fit — and the four flat lines at
 * the bottom are not a failure of the chart, they ARE the story. Cash is drawn
 * for the same reason: a line that never moves is the honest floor under a race
 * this lopsided, and it costs nothing to look at.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'mixed',
  // Yahoo for the market legs, blockchain.com for bitcoin — whose history
  // starts four years before Yahoo's BTC-USD does, which is the entire reason
  // the mixed job exists. Explicit range: 'max' coarsens the cadence per symbol.
  range: '20y',
  interval: '1mo',
  transform: 'invested',
  principal: 41,
  dividends: 'reinvested',
  sourceLabel: 'Yahoo Finance + blockchain.com',
  sourceUrl: 'https://www.blockchain.com/explorer/charts/market-price',
  legs: [
    {key: 'BTC', from: 'bitcoin'},
    {key: 'AAPL', from: 'yahoo', symbol: 'AAPL'},
    {key: 'SPX', from: 'yahoo', symbol: 'SPY'},
    {key: 'GOLD', from: 'yahoo', symbol: 'GLD'},
    {key: 'CASH', from: 'constant'},
  ],
};

export const spec: ChartSpec = {
  id: 'pizza-day',
  subject: 'bitcoin\'s price, and what $41 became',
  title: 'The pizzas that cost\nten thousand bitcoin',
  subtitle: 'What $41 became, from bitcoin’s first priced month.',
  hook: {
    question: 'What did the most famous pizzas in finance really cost?',
    kicker: 'Two pizzas, paid for in bitcoin, in May 2010.',
  },
  unit: 'usd',
  scale: 'log',
  yFloor: 40,
  dateFormat: 'year',
  // A delivery rider in a busy street, not a studio slice. Owner note, 2026-09-06:
  // the close-up food shot was the weakest of the three backdrops, and a SCENE —
  // a place with people working in it — is what the other two got right.
  backdrop: {file: 'pizza-day.jpg', strength: 0.20, focus: 'center 55%'},
  series: [
    {key: 'BTC', label: 'Bitcoin', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'BTC'}},
    {key: 'AAPL', label: 'Apple', color: C.consensus, medallion: {kind: 'mono', text: 'AA'}},
    {key: 'SPX', label: 'The S&P 500', color: C.fundamentals, medallion: {kind: 'mono', text: 'SPX'}},
    {key: 'GOLD', label: 'Gold', color: C.macro, medallion: {kind: 'mono', text: 'AU'}},
    {key: 'CASH', label: 'Cash in a drawer', color: C.discovery, medallion: {kind: 'mono', text: '$'}},
  ],
  payoff: {
    lead: 'The pizzas were the cheap part.',
    lines: [
      'The same money, on the same day, in four other things.',
      'The run starts in the first month bitcoin had a market price at all.',
    ],
  },
  endcardChip: 'EPISODE · PIZZA DAY',
};
