/**
 * "What does America do for a living?" — eight payroll counts, as published.
 *
 * WHY THIS SHAPE. Every chart made before this one draws money or a percentage.
 * This one draws PEOPLE: raw headcounts on the `index` unit, nothing rebased,
 * nothing compounded, and the only chart in the set whose y axis is a count of
 * human beings. It also has the cleanest narrative shape of any of them — not a
 * scramble but three eras, each with one leader: manufacturing, then government,
 * then education and health, which passes everything and never gives it back.
 *
 * WHY 1970. The series run to 1939, but a run that long puts a war economy at
 * the left edge and compresses the whole modern story into the right third.
 * Fifty-six years is already the longest window in the set.
 *
 * NB the figures are in THOUSANDS of workers, which is how BLS publishes them
 * and how the subtitle says it. They are not converted, because converting a
 * published figure to make a nicer axis is exactly the kind of quiet arithmetic
 * this format refuses to do.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  from: '1970-01-01',
  sample: 'quarterly',
  sourceLabel: 'BLS Current Employment Statistics via FRED',
  series: [
    {key: 'EDHE', id: 'USEHS'}, // private education and health services
    {key: 'GOVT', id: 'USGOVT'}, // government
    {key: 'PROF', id: 'USPBS'}, // professional and business services
    {key: 'LEIS', id: 'USLAH'}, // leisure and hospitality
    {key: 'RETL', id: 'USTRADE'}, // retail trade
    {key: 'MANU', id: 'MANEMP'}, // manufacturing
    {key: 'CONS', id: 'USCONS'}, // construction
    {key: 'INFO', id: 'USINFO'}, // information
  ],
};

export const spec: ChartSpec = {
  id: 'work-in-america',
  subject: 'what America does for a living - payroll jobs by industry',
  title: 'What does America\ndo for a living?',
  subtitle: 'Workers on US payrolls, in thousands.',
  hook: {question: 'What does America do for a living?', kicker: 'Eight industries, fifty-six years.'},
  unit: 'index',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  series: [
    {key: 'EDHE', label: 'Health, schools', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'EDH'}},
    {key: 'GOVT', label: 'Government', color: '#6ea8ff', medallion: {kind: 'mono', text: 'GOV'}},
    {key: 'PROF', label: 'Prof./business', color: C.discovery, medallion: {kind: 'mono', text: 'PRO'}},
    {key: 'LEIS', label: 'Leisure, hotels', color: '#e5749b', medallion: {kind: 'mono', text: 'LEI'}},
    {key: 'RETL', label: 'Retail trade', color: C.fundamentals, medallion: {kind: 'mono', text: 'RTL'}},
    {key: 'MANU', label: 'Manufacturing', color: C.macro, emphasis: true, medallion: {kind: 'mono', text: 'MFG'}},
    {key: 'CONS', label: 'Construction', color: '#b7c34a', medallion: {kind: 'mono', text: 'CON'}},
    {key: 'INFO', label: 'Information', color: C.consensus, medallion: {kind: 'mono', text: 'INF'}},
  ],
  payoff: {
    lead: 'The country changed jobs.',
    lines: [
      'The industry that led at the start of this chart is not in the top three at the end.',
      'Eight federal series at their published levels — no index, no rebasing, no adjustment.',
    ],
  },
  endcardChip: 'EPISODE · WHAT AMERICA DOES',
};
