/**
 * "Did wages keep up?" — four lines, one base year, no opinion.
 *
 * Everything here is a federal statistical series, quarterly-sampled so the two
 * quarterly publishers and the two monthly ones land on the same dates without
 * a single hole. Linear axis: the spread is roughly 2× between fastest and
 * slowest, which is exactly the range a linear axis reads well.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'pctChange',
  from: '2000-01-01',
  sample: 'quarterly',
  sourceLabel: 'BLS + Census + S&P via FRED',
  series: [
    {key: 'WAGES', id: 'AHETPI'}, // average hourly earnings, production + nonsupervisory
    {key: 'CPI', id: 'CPIAUCSL'}, // consumer price index, all urban consumers
    {key: 'HOMEIDX', id: 'CSUSHPINSA'}, // S&P CoreLogic Case-Shiller national home price index
    {key: 'HOMEPRICE', id: 'MSPUS'}, // median sales price of houses sold
  ],
};

export const spec: ChartSpec = {
  id: 'wages-vs-everything',
  subject: 'wages against house prices and inflation',
  title: 'Did wages keep up\nwith houses?',
  subtitle: 'How much each has risen since January 2000.',
  hook: {question: 'Did wages keep up?', kicker: 'Twenty-six years of federal data.'},
  unit: 'pct',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  series: [
    {key: 'HOMEIDX', label: 'Home prices', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'HP'}},
    {key: 'HOMEPRICE', label: 'Median home', color: C.macro, medallion: {kind: 'mono', text: 'MED'}},
    {key: 'WAGES', label: 'Wages', color: C.consensus, emphasis: true, medallion: {kind: 'mono', text: 'WG'}},
    {key: 'CPI', label: 'Prices (CPI)', color: C.discovery, medallion: {kind: 'mono', text: 'CPI'}},
  ],
  payoff: {
    lead: 'Wages beat prices. Houses beat wages.',
    lines: [
      'The gap between the gold line and the teal one is the whole housing argument.',
      'Nothing here is adjusted, spun, or annualised — it is four federal series from one start date.',
    ],
  },
  endcardChip: 'EPISODE · DID WAGES KEEP UP',
};
