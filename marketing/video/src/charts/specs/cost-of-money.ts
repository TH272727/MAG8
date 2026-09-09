/**
 * "What has it cost to borrow money?" — six US interest rates, as published.
 *
 * WHY THIS SHAPE. The two films before this one both animate a rebased race:
 * every line starts together at one value and climbs. This one draws LEVELS —
 * nothing is rebased, nothing compounds, and the lines fall as often as they
 * rise. The prime rate opens above 20% in 1981, the whole field slides for
 * forty years to nearly nothing, and then snaps back. That is a different
 * motion from a compounding race and it is the reason this chart exists.
 *
 * WHY THESE SIX. They all publish MONTHLY on the first of the month, so a
 * quarterly sample lands every line on exactly the same dates with no holes.
 * The consumer rates that would be more relatable — the 30-year mortgage and
 * the credit-card APR — could not join them honestly: the mortgage series is
 * WEEKLY (Thursdays, which never coincide with a first-of-month reading) and
 * the credit-card series is quarterly on the Feb/May/Aug/Nov grid, so both
 * would have arrived as a line full of holes drawing straight chords between
 * quarters. A hole in one line and not another reads as a difference in the
 * world rather than a difference in the publisher.
 *
 * The start date is set by the youngest series: the 2-year Treasury constant
 * maturity begins in June 1976, so the run begins at the first quarter every
 * one of the six reports.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  // GS2 starts 1976-06; this is the first quarter on which all six report.
  from: '1976-07-01',
  sample: 'quarterly',
  sourceLabel: 'Federal Reserve H.15 + Moody’s via FRED',
  series: [
    {key: 'PRIME', id: 'MPRIME'}, // bank prime loan rate
    {key: 'BAA', id: 'BAA'}, // Moody's seasoned Baa corporate bond yield
    {key: 'AAA', id: 'AAA'}, // Moody's seasoned Aaa corporate bond yield
    {key: 'GS10', id: 'GS10'}, // 10-year Treasury constant maturity
    {key: 'GS2', id: 'GS2'}, // 2-year Treasury constant maturity
    {key: 'FF', id: 'FEDFUNDS'}, // effective federal funds rate
  ],
};

export const spec: ChartSpec = {
  id: 'cost-of-money',
  subject: 'US interest rates - what it costs to borrow money',
  title: 'What has it cost\nto borrow money?',
  subtitle: 'Six US interest rates, every quarter, as published.',
  hook: {question: 'What has it cost to borrow money?', kicker: 'Fifty years of American interest rates.'},
  unit: 'pct',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  series: [
    {key: 'PRIME', label: 'Prime rate', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'PR'}},
    {key: 'BAA', label: 'Mid-rated firms', color: C.macro, medallion: {kind: 'mono', text: 'BAA'}},
    {key: 'AAA', label: 'Top-rated firms', color: C.fundamentals, medallion: {kind: 'mono', text: 'AAA'}},
    {key: 'GS10', label: '10-yr Treasury', color: C.consensus, medallion: {kind: 'mono', text: '10Y'}},
    {key: 'GS2', label: '2-yr Treasury', color: '#6ea8ff', medallion: {kind: 'mono', text: '2Y'}},
    {key: 'FF', label: 'Fed funds', color: C.discovery, emphasis: true, medallion: {kind: 'mono', text: 'FF'}},
  ],
  payoff: {
    lead: 'The price of money is not a constant.',
    lines: [
      'Everything a household pays is priced off these lines.',
      'Nothing here is rebased or adjusted — it is six federal series at their published levels.',
    ],
  },
  endcardChip: 'EPISODE · THE PRICE OF MONEY',
};
