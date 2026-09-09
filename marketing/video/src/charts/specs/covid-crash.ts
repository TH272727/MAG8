/**
 * "What $10,000 at the very top became" — the worst possible week to buy.
 *
 * THE STORY. The American market's all-time high was set on 19 February 2020,
 * and the fastest crash in its history began the next session: about a third of
 * the index gone in thirty-three days. This film buys at that top — the exact
 * week, the worst week available to a buyer — and holds through everything
 * since. The counterfactual is the point: the crash that felt like the end of
 * the world is, six years on, a notch on the way up for some of these lines and
 * a hole that never closed for others.
 *
 * WHY WEEKLY. Every film in this format so far has run on months or quarters
 * over decades. A crash that took thirty-three days does not exist at monthly
 * resolution — it is one bar — so the grid has to be finer than the event, and
 * a weekly grid over six years lands inside the pacing budget where a daily one
 * (about fifteen hundred points) would blur the date past reading.
 *
 * WHY THESE SIX, AND WHY ALL OF THEM ARE FUNDS. They are asset classes rather
 * than companies, so nothing here scores or vetoes a real business (FORMULA
 * §A): American large caps, the Nasdaq 100, American small caps, gold, long
 * government bonds and bitcoin. Long bonds are in deliberately — they are the
 * line most people assume is the safe one.
 *
 * The three equity legs were originally the price INDICES, and that was wrong
 * in a way that flattered nothing evenly: a gold fund's adjusted closes carry
 * its distributions while the S&P index carries none, so three lines would have
 * been quietly docked six years of dividends against their neighbours. Tracking
 * funds instead means every line on the axis treats income the same way, and
 * the method line can say so truthfully.
 *
 * THE WINDOW. Bitcoin trades every day of the week and the equities do not, so
 * the two disagree about the final, partial week; the run is trimmed to the
 * last week every line reports, which is what that trim exists for.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'yahoo',
  range: '10y',
  interval: '1wk',
  transform: 'invested',
  principal: 10000,
  dividends: 'reinvested',
  // The week containing 19 February 2020, the pre-crash high.
  from: '2020-02-17',
  tickers: [
    {key: 'BTC', symbol: 'BTC-USD'},
    {key: 'NDQ', symbol: 'QQQ'},
    {key: 'SPX', symbol: 'SPY'},
    {key: 'GOLD', symbol: 'GLD'},
    {key: 'SML', symbol: 'IWM'},
    {key: 'BOND', symbol: 'TLT'},
  ],
};

export const spec: ChartSpec = {
  id: 'covid-crash',
  subject: '$10,000 invested at the February 2020 market peak',
  title: '$10,000 invested at\nthe very top',
  subtitle: 'Bought the week the market peaked, February 2020.',
  hook: {
    question: 'What if you bought at the worst possible moment?',
    kicker: 'The week before the fastest crash in market history.',
  },
  unit: 'usd',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  backdrop: {file: 'covid-crash.jpg', strength: 0.16, focus: 'center 45%'},
  series: [
    {key: 'BTC', label: 'Bitcoin', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'BTC'}},
    {key: 'NDQ', label: 'The Nasdaq 100', color: C.consensus, medallion: {kind: 'mono', text: 'NDQ'}},
    {key: 'SPX', label: 'The S&P 500', color: C.fundamentals, emphasis: true, medallion: {kind: 'mono', text: 'SPX'}},
    {key: 'GOLD', label: 'Gold', color: C.macro, medallion: {kind: 'mono', text: 'AU'}},
    {key: 'SML', label: 'Small caps', color: C.discovery, medallion: {kind: 'mono', text: 'SML'}},
    {key: 'BOND', label: 'Long bonds', color: '#6ea8ff', medallion: {kind: 'mono', text: 'GOV'}},
  ],
  payoff: {
    lead: 'The worst week to buy was still a decent week to buy.',
    lines: [
      'Every line starts on the same week, at the top, at the same money.',
      'The one that never came back is the one that is supposed to be safe.',
    ],
  },
  endcardChip: 'EPISODE · THE WORST WEEK',
};
