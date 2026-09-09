/**
 * "The gap that closed" — life expectancy at birth, eight countries, as published.
 *
 * WHY THIS SHAPE. Every fan in this set OPENS. Money invested spreads apart,
 * prices spread apart, payrolls spread apart — the format is built to show a
 * field separating, and a winner pulling away is the picture it draws best. This
 * one starts at its widest and closes: the spread between the highest and lowest
 * line at the left edge is more than thirty years, and at the right edge it is a
 * few. It is the only convergence in the set, and it runs the format backwards on
 * purpose.
 *
 * WHY NO yFloor. The values live between the low thirties and the mid eighties,
 * and pinning the axis to zero would hold an empty band under the whole field and
 * squash every line into the top of the plot — the mistake `below-zero` made on
 * the film named after its own baseline. Left free, the window opens tight around
 * what has been revealed and widens as the field climbs.
 *
 * WHY ANNUAL, AND THE PACING. The World Bank publishes these once a year; 65
 * points is the same count the shipped `eight-billion` runs at, so the frames per
 * point are a precedent rather than a new claim.
 *
 * WHAT IS NOT CLAIMED. These are period life expectancies at birth — what a birth
 * cohort would live to IF the death rates of that single year held for its whole
 * life. That is not a forecast for anybody actually born, and the film says
 * nothing about why any line moves. It draws the distance between them.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  from: '1960-01-01',
  sourceLabel: 'World Bank via FRED',
  series: [
    {key: 'JPN', id: 'SPDYNLE00INJPN'},
    {key: 'ITA', id: 'SPDYNLE00INITA'},
    {key: 'KOR', id: 'SPDYNLE00INKOR'},
    {key: 'FRA', id: 'SPDYNLE00INFRA'},
    {key: 'GBR', id: 'SPDYNLE00INGBR'},
    {key: 'DEU', id: 'SPDYNLE00INDEU'},
    {key: 'USA', id: 'SPDYNLE00INUSA'},
    {key: 'CHN', id: 'SPDYNLE00INCHN'},
  ],
};

export const spec: ChartSpec = {
  id: 'the-gap-that-closed',
  subject: 'life expectancy at birth',
  title: 'Life expectancy:\nthe gap that closed',
  subtitle: 'At birth, in years. Eight countries since 1960.',
  hook: {question: 'How long will a child live?', kicker: 'Eight countries, sixty-five years.'},
  unit: 'index',
  scale: 'linear',
  dateFormat: 'year',
  backdrop: {file: 'the-gap-that-closed.jpg', strength: 0.18, focus: 'center 45%'},
  series: [
    {key: 'CHN', label: 'China', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'CN'}},
    {key: 'KOR', label: 'South Korea', color: '#b7c34a', medallion: {kind: 'mono', text: 'KR'}},
    {key: 'JPN', label: 'Japan', color: '#e5749b', medallion: {kind: 'mono', text: 'JP'}},
    {key: 'ITA', label: 'Italy', color: C.discovery, medallion: {kind: 'mono', text: 'IT'}},
    {key: 'FRA', label: 'France', color: '#6ea8ff', medallion: {kind: 'mono', text: 'FR'}},
    {key: 'GBR', label: 'UK', color: C.fundamentals, medallion: {kind: 'mono', text: 'UK'}},
    {key: 'DEU', label: 'Germany', color: C.consensus, medallion: {kind: 'mono', text: 'DE'}},
    {key: 'USA', label: 'United States', color: C.macro, emphasis: true, medallion: {kind: 'mono', text: 'US'}},
  ],
  payoff: {
    lead: 'The distance closed.',
    lines: [
      'The widest gap on this chart is at the beginning, not the end.',
      'Period life expectancy at birth, as published — the rates of one year, held for a lifetime.',
    ],
  },
  endcardChip: 'EPISODE · THE GAP THAT CLOSED',
};
