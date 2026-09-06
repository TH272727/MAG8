/**
 * "Which sector won this century?" — the nine original sector funds, one buy.
 *
 * WHY LINEAR, when the other money chart is log. The Magnificent 7 film is a
 * runaway: the leader outruns the field by ~700× and a linear axis would leave
 * seven lines flat on the floor. Here the whole field finishes inside 4.9×, so
 * linear is not only readable, it is the honest read — the gaps on screen are
 * the gaps in the money. Same transform, opposite axis, opposite motion.
 *
 * WHY THIS IS A RACE AND THE OTHER ONE IS A PROCESSION. The lead changes
 * TWENTY-FIVE times: technology out of the dot-com wreckage, healthcare and
 * discretionary trading it through 2004, energy holding the lead for a decade
 * from 2005, and technology taking it back for good in 2023. That is what the
 * format is for.
 *
 * WHY NOT ALL ELEVEN SECTORS. Real estate (2015) and communication services
 * (2018) were carved out of the others long after this window opens, and the
 * fetcher rebases every line to the first date they ALL exist — adding either
 * one would silently shorten the whole film by fourteen or seventeen years.
 * Only the funds that have been trading since 1998 can share this axis. The
 * index fund is the control: it is what not choosing looked like.
 *
 * WHY SEVEN SECTORS AND NOT EIGHT. Consumer staples was cut for fit, not for
 * taste: at nine lines the head badges compress past the point where a label
 * stops printing through the value beneath it — Industrials and the index
 * finish $157 apart and were drawn through each other. Eight lines is the
 * count the format is proven at. Staples finished between utilities and
 * financials, which is to say inside the range the chart already shows.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'yahoo',
  // An explicit range, never 'max' — 'max' makes the source quietly hand back
  // quarterly bars for some symbols and monthly for others.
  range: '25y',
  interval: '1mo',
  transform: 'invested',
  principal: 10000,
  tickers: [
    {key: 'XLK', symbol: 'XLK'},
    {key: 'XLY', symbol: 'XLY'},
    {key: 'XLI', symbol: 'XLI'},
    {key: 'XLV', symbol: 'XLV'},
    {key: 'XLE', symbol: 'XLE'},
    {key: 'XLU', symbol: 'XLU'},
    {key: 'XLF', symbol: 'XLF'},
    {key: 'SPY', symbol: 'SPY'},
  ],
};

export const spec: ChartSpec = {
  id: 'sector-race-10k',
  title: 'Which sector won\nthis century?',
  subtitle: '$10,000 into each on the same day. Never sold.',
  hook: {question: 'Which sector won this century?', kicker: 'Eight funds, one buy, no trading.'},
  unit: 'usd',
  scale: 'linear',
  yFloor: 10000,
  dateFormat: 'month',
  series: [
    {key: 'XLK', label: 'Technology', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'TEC'}},
    {key: 'XLY', label: 'Discretionary', color: C.discovery, medallion: {kind: 'mono', text: 'DIS'}},
    {key: 'XLI', label: 'Industrials', color: C.macro, medallion: {kind: 'mono', text: 'IND'}},
    {key: 'XLV', label: 'Health care', color: C.fundamentals, medallion: {kind: 'mono', text: 'HLT'}},
    {key: 'XLE', label: 'Energy', color: '#e5749b', emphasis: true, medallion: {kind: 'mono', text: 'ENE'}},
    {key: 'XLU', label: 'Utilities', color: '#b7c34a', medallion: {kind: 'mono', text: 'UTL'}},
    {key: 'XLF', label: 'Financials', color: C.consensus, medallion: {kind: 'mono', text: 'FIN'}},
    {key: 'SPY', label: 'S&P 500', color: C.muted, medallion: {kind: 'mono', text: 'SP'}},
  ],
  payoff: {
    lead: 'One sector led for a decade. It is not the one that won.',
    lines: [
      'Four of the seven sectors finished behind the index that contains them.',
      'One buy, held throughout, every distribution reinvested — no trading, no timing.',
    ],
  },
  endcardChip: 'EPISODE · THE SECTOR RACE',
};
