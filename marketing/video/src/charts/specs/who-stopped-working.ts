/**
 * "In 1948 nine in ten men had a job and one in three women did."
 *
 * THE SHAPE THAT IS NEW HERE IS THE MOTION. Every other film in this folder is
 * a fan: lines that start together and spread apart. This one CONVERGES and
 * SWAPS. Two crossings carry it, and both are in the published data rather than
 * in the framing:
 *
 *   - men 86.7 -> 66.8 against women 32.0 -> 56.4: a gap of nearly fifty-five
 *     points closing to about ten. They converge but they never cross.
 *   - teenagers 53.2 -> 34.9 against the over-55s 43.0 -> 36.9, which START the
 *     run ten points apart in one order and END it in the other. This is the
 *     only actual crossing, and the copy says one crossing, not two.
 *
 * WHY QUARTERLY. The underlying series are monthly and run from January 1948,
 * which is 944 points against a 690-frame race — 0.73 frames per point, and the
 * date under the plot would blur into a smear. Sampled to quarters it is about
 * 2.2 frames per point, the same density as what-america-owes.
 *
 * WHY THE BANDS ARE THE ONES THEY ARE. The finer non-overlapping bands a chart
 * like this would prefer (25-34, 35-44, 45-54, 65+) DO NOT EXIST under the ids
 * they are usually guessed at; FRED answered every one of them with an HTML
 * page and HTTP 200. These six are the ones that resolved, with their published
 * titles read back before use.
 *
 * The prime-age and young-adult lines are context rather than argument: they
 * are what did NOT change much, which is what makes the other four legible.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  from: '1948-01-01',
  sample: 'quarterly',
  sourceLabel: 'Bureau of Labor Statistics via FRED',
  series: [
    {key: 'PRIME', id: 'LNS11300060'}, // Participation Rate - 25-54 Yrs.
    {key: 'YOUNG', id: 'LNS11300036'}, // Participation Rate - 20-24 Yrs.
    {key: 'MEN', id: 'LNS11300001'}, // Participation Rate - Men
    {key: 'WOMEN', id: 'LNS11300002'}, // Participation Rate - Women
    {key: 'TEENS', id: 'LNS11300012'}, // Participation Rate - 16-19 Yrs.
    {key: 'OLDER', id: 'LNS11324230'}, // Participation Rate - 55 Yrs. & over
  ],
};

export const spec: ChartSpec = {
  id: 'who-stopped-working',
  subject: 'who has a job - share of each group in the workforce',
  title: 'In 1948, one in three\nwomen had a job.',
  subtitle: 'Share of each group in the workforce, seasonally adjusted.',
  hook: {
    question: 'Who works in America?',
    kicker: 'Seventy-eight years of the same federal survey.',
  },
  unit: 'pct',
  scale: 'linear',
  // A wartime assembly floor: the room the women's line is about to walk into,
  // photographed a few years before this chart starts. A place with people and
  // depth, which is what survives being darkened to texture.
  backdrop: {file: 'who-stopped-working.jpg', strength: 0.18, focus: 'center 45%'},
  dateFormat: 'month',
  series: [
    {key: 'MEN', label: 'Men', color: C.consensus, emphasis: true, medallion: {kind: 'mono', text: 'M'}},
    {key: 'WOMEN', label: 'Women', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'W'}},
    {key: 'PRIME', label: 'Ages 25-54', color: C.fundamentals, medallion: {kind: 'mono', text: '25'}},
    {key: 'YOUNG', label: 'Ages 20-24', color: '#6ea8ff', medallion: {kind: 'mono', text: '20'}},
    {key: 'TEENS', label: 'Ages 16-19', color: C.macro, medallion: {kind: 'mono', text: '16'}},
    {key: 'OLDER', label: 'Ages 55+', color: C.discovery, medallion: {kind: 'mono', text: '55'}},
  ],
  payoff: {
    lead: 'The workforce did not grow. It changed who it was made of.',
    lines: [
      'One pair of lines crosses. The other spends seventy years closing a gap.',
      'Six readings from one federal survey, seasonally adjusted, and nothing else.',
    ],
  },
  endcardChip: 'EPISODE · WHO STOPPED WORKING',
};
