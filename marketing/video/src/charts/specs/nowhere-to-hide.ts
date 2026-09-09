/**
 * "Nowhere to hide" — $10,000 into seven different things on the first trading
 * day of 2022, and a race in which most of the runners finish behind the
 * starting line.
 *
 * THE STORY. The oldest piece of advice in personal finance is to keep some of
 * your money in something boring, because when the exciting half falls the
 * boring half is supposed to hold you up. For most of the last forty years
 * that worked. In 2022 it did not: shares fell, and government bonds — the
 * boring half, the thing people buy precisely because it is dull — fell
 * further than shares did. Someone who had done everything right, who had
 * spread their money across shares, bonds and property still ended the year
 * with less than they started with. Two of the seven finished above the
 * stake: commodities, which almost nobody's retirement plan owns, and gold,
 * which ended within a hair of where it began. Every other line — shares, big
 * technology, long government bonds, the whole bond market, property —
 * finished the year below $10,000. CHECKED AGAINST THE FROZEN FILE, not
 * against the memory of a probe: SPY 8,338 · QQQ 7,062 · TLT 7,163 · AGG
 * 8,821 · VNQ 7,706 · GLD 10,113 · DBC 11,676.
 *
 * WHY THIS SHAPE — the first race here that goes DOWN. Every money race in
 * this format so far climbs: $10,000 grows into something. This one is a
 * $10,000 stake watched for twelve months in which five of the seven lines
 * finish below where they began, most of them spending the whole film there,
 * and the axis has to expand DOWNWARD to follow them. A viewer who has only ever seen the up-and-to-the-right
 * version of this genre has not seen the same picture inverted.
 *
 * WHY WEEKLY AND WHY IT STOPS AT NEW YEAR. Twelve months of daily closes packs
 * 250 points into 23 seconds and the date under the plot becomes a blur; a
 * weekly close gives one point per week of the year, which is the pace a
 * person can actually read. And the film ends on the last week of 2022 because
 * THE YEAR IS THE SUBJECT — 2022 is the event, the way 1987 or 2020 is an
 * event. Running on into the recovery answers a different question.
 *
 * WHY THESE SEVEN. They are all funds, so every line is a thing a person could
 * actually have bought with the same $10,000 on the same morning, and adjusted
 * closes mean distributions are counted rather than quietly dropped. Mixing in
 * a price INDEX — the S&P index rather than a fund tracking it — would credit
 * some lines with income and not others, which is the defect this engine's
 * `dividends` declaration exists to prevent.
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
  from: '2022-01-03', // first trading week of 2022
  to: '2022-12-31', // the year is the subject — see the header note
  dividends: 'reinvested',
  tickers: [
    {key: 'SPY', symbol: 'SPY'}, // US large companies
    {key: 'QQQ', symbol: 'QQQ'}, // the largest technology names
    {key: 'TLT', symbol: 'TLT'}, // long-dated US government bonds
    {key: 'AGG', symbol: 'AGG'}, // the whole US bond market
    {key: 'GLD', symbol: 'GLD'}, // gold
    {key: 'VNQ', symbol: 'VNQ'}, // US property
    {key: 'DBC', symbol: 'DBC'}, // commodities
  ],
};

export const spec: ChartSpec = {
  id: 'nowhere-to-hide',
  subject: '$10,000 invested across seven markets in 2022',
  title: '$10,000 invested in 2022:\nnowhere to hide',
  subtitle: 'Seven different things, bought on the first trading day and watched every week.',
  hook: {question: 'What happens when the safe half falls too?', kicker: 'The year the boring money lost more than the risky money.'},
  unit: 'usd',
  scale: 'linear',
  dateFormat: 'month',
  series: [
    {key: 'DBC', label: 'Commodities', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'CM'}},
    {key: 'GLD', label: 'Gold', color: C.macro, medallion: {kind: 'mono', text: 'AU'}},
    {key: 'AGG', label: 'US bonds', color: C.consensus, medallion: {kind: 'mono', text: 'BND'}},
    {key: 'SPY', label: 'S&P 500', color: C.fundamentals, medallion: {kind: 'mono', text: 'SPY'}},
    {key: 'VNQ', label: 'US property', color: '#6ea8ff', medallion: {kind: 'mono', text: 'REI'}},
    {key: 'QQQ', label: 'Big tech', color: '#c98bdb', medallion: {kind: 'mono', text: 'QQQ'}},
    {key: 'TLT', label: 'Long Treasuries', color: C.discovery, emphasis: true, medallion: {kind: 'mono', text: 'TLT'}},
  ],
  backdrop: {file: 'nowhere-to-hide.jpg', strength: 0.18, focus: 'center 45%'},
  payoff: {
    lead: 'The safe half did not save anybody.',
    lines: [
      'Government bonds are held precisely for the year the shares fall. This was that year, and they fell further.',
      'Seven funds, one stake, one morning — adjusted closes, so distributions are counted.',
    ],
  },
  endcardChip: 'EPISODE · NOWHERE TO HIDE',
};
