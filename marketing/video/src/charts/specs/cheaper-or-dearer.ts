/**
 * "What got cheaper? What got dearer?" — eight consumer categories, one base
 * month, and the first MAG8 chart whose lines go both ways.
 *
 * WHY THIS SHAPE. The wages film is a fan that opens upward: four series, all
 * rising, argued about by how fast. This one opens in BOTH directions from
 * zero — hospital care and tuition run away above the line while toys fall
 * through it — so the zero rule is the drama rather than the axis floor. The
 * preferred floor is zero and real data below it wins, which is exactly the
 * behaviour a line ending under −70% needs.
 *
 * WHY 1990. Every one of the eight publishes by January 1990 (airline fares,
 * the youngest, starts in 1989), and thirty-six years is long enough for the
 * divergence to be a shape rather than a wobble.
 *
 * WHY NOT COMPUTERS OR TELEVISIONS, the obvious deflation lines: the CPI
 * computer series does not begin until 2005 and would have dragged the whole
 * chart's start date forward by fifteen years, and FRED publishes no
 * televisions series at all — probed, not assumed.
 *
 * NB every one of these eight skips October 2025 (the index was not published
 * that month), so no line has a hole the others do not: the quarter is simply
 * absent from the shared axis for all eight alike.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'pctChange',
  from: '1990-01-01',
  sample: 'quarterly',
  sourceLabel: 'BLS Consumer Price Index via FRED',
  series: [
    {key: 'HOSP', id: 'CUSR0000SEMD'}, // hospital and related services
    {key: 'TUIT', id: 'CUSR0000SEEB'}, // tuition, other school fees, and childcare
    {key: 'RENT', id: 'CUSR0000SEHA'}, // rent of primary residence
    {key: 'ELEC', id: 'CUSR0000SEHF01'}, // electricity
    {key: 'FOOD', id: 'CUSR0000SAF11'}, // food at home
    {key: 'AIR', id: 'CUSR0000SETG01'}, // airline fares
    {key: 'APP', id: 'CPIAPPSL'}, // apparel
    {key: 'TOYS', id: 'CUSR0000SERE01'}, // toys
  ],
};

export const spec: ChartSpec = {
  id: 'cheaper-or-dearer',
  title: 'What got cheaper?\nWhat got dearer?',
  subtitle: 'Eight things Americans buy, priced against one January.',
  hook: {question: 'What actually got cheaper?', kicker: 'Eight categories, one base month.'},
  unit: 'pct',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  series: [
    {key: 'HOSP', label: 'Hospital care', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'HOS'}},
    {key: 'TUIT', label: 'Tuition & care', color: C.macro, medallion: {kind: 'mono', text: 'TUI'}},
    {key: 'RENT', label: 'Rent', color: '#e5749b', medallion: {kind: 'mono', text: 'RNT'}},
    {key: 'ELEC', label: 'Electricity', color: '#b7c34a', medallion: {kind: 'mono', text: 'ELE'}},
    {key: 'FOOD', label: 'Food at home', color: C.fundamentals, medallion: {kind: 'mono', text: 'FD'}},
    {key: 'AIR', label: 'Airline fares', color: '#6ea8ff', medallion: {kind: 'mono', text: 'AIR'}},
    {key: 'APP', label: 'Apparel', color: C.discovery, medallion: {kind: 'mono', text: 'APP'}},
    {key: 'TOYS', label: 'Toys', color: C.consensus, emphasis: true, medallion: {kind: 'mono', text: 'TOY'}},
  ],
  payoff: {
    lead: 'The things you must buy went up. The things you choose to buy went down.',
    lines: [
      'One line spends the whole chart below the day it started.',
      'Same government index, same base month, no adjustment — only the category changes.',
    ],
  },
  endcardChip: 'EPISODE · CHEAPER OR DEARER',
};
