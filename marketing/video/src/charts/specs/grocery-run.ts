/**
 * "What does a grocery run cost?" — eight staples at their actual shelf price.
 *
 * WHY THIS SHAPE. The other price film in the set (cheaper-or-dearer) draws
 * INDEX changes: everything starts at zero and the story is who ran away from
 * whom. This one draws the price itself, in dollars, at the scale a person
 * actually meets it — a pound of ground beef going from $1.90 to nearly $7. Same
 * subject area, opposite arithmetic: nothing is rebased and nothing is a
 * percentage, so the y axis reads like a receipt.
 *
 * WHY NO GASOLINE, the obvious ninth line: the pump series was published in
 * October 2025 and the grocery series were not, so adding it would have put a
 * hole in eight lines and not in the ninth — and a hole in one line and not
 * another reads as a difference in the world rather than in the publisher.
 * With gasoline out, all eight skip that month together and it is simply
 * absent from the shared axis.
 *
 * WHY NO COFFEE, which was the best line in the first cut of this chart at
 * $3.21 to $9.32: BLS stopped collecting it for 2008–09 and again for 2018–19.
 * Drawn, that is a straight chord across two years — including across the 2008
 * commodity spike — which is a picture of a price that did not move. Rice is
 * out for the same reason (no readings 2000–02).
 *
 * WHY MONTHLY AND NOT QUARTERLY. Sampling one month in three can land on a
 * peak and turn a real short spike into what looks like a parse artefact: eggs
 * genuinely went $1.53 → $2.02 → $1.64 in the spring of 2020, and quarterly the
 * middle reading is a lone excursion that the honesty gate FAILED. At monthly
 * resolution it is what it actually was — a climb and a fall with the months in
 * between still on the chart.
 *
 * UNITS ARE NOT ALL THE SAME and the chart says so twice: the subtitle names
 * all three, and every label carries its own — six per pound, eggs per dozen,
 * milk per gallon. A viewer comparing the egg line to the bacon line is
 * comparing a dozen to a pound, and the only place that can be said is on the
 * line itself.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  from: '2000-01-01',
  sourceLabel: 'BLS average price data via FRED',
  series: [
    {key: 'BACN', id: 'APU0000704111'}, // bacon, sliced, per lb
    {key: 'BEEF', id: 'APU0000703112'}, // ground beef, 100% beef, per lb
    {key: 'MILK', id: 'APU0000709112'}, // milk, whole, fortified, per gallon
    {key: 'EGGS', id: 'APU0000708111'}, // eggs, grade A large, per dozen
    {key: 'CHKN', id: 'APU0000706111'}, // chicken, fresh, whole, per lb
    {key: 'BRED', id: 'APU0000702111'}, // bread, white, pan, per lb
    {key: 'SUGR', id: 'APU0000715211'}, // sugar, white, per lb
    {key: 'BANA', id: 'APU0000711211'}, // bananas, per lb
  ],
};

export const spec: ChartSpec = {
  id: 'grocery-run',
  subject: 'US average grocery prices',
  title: 'What does a\ngrocery run cost?',
  subtitle: 'Average US city price — per pound, dozen or gallon.',
  hook: {question: 'What does a grocery run cost?', kicker: 'Eight staples at the shelf price.'},
  unit: 'usd',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  series: [
    {key: 'BACN', label: 'Bacon, lb', color: '#e5749b', emphasis: true, medallion: {kind: 'mono', text: 'BAC'}},
    {key: 'BEEF', label: 'Ground beef, lb', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'BEF'}},
    {key: 'MILK', label: 'Milk, gallon', color: '#6ea8ff', medallion: {kind: 'mono', text: 'MLK'}},
    {key: 'EGGS', label: 'Eggs, dozen', color: C.macro, medallion: {kind: 'mono', text: 'EGG'}},
    {key: 'CHKN', label: 'Chicken, lb', color: C.fundamentals, medallion: {kind: 'mono', text: 'CHK'}},
    {key: 'BRED', label: 'Bread, lb', color: C.consensus, medallion: {kind: 'mono', text: 'BRD'}},
    {key: 'SUGR', label: 'Sugar, lb', color: C.discovery, medallion: {kind: 'mono', text: 'SUG'}},
    {key: 'BANA', label: 'Bananas, lb', color: '#b7c34a', medallion: {kind: 'mono', text: 'BAN'}},
  ],
  payoff: {
    lead: 'Not everything on the receipt moved together.',
    lines: [
      'One of these costs barely more than it did when the chart starts.',
      'These are collected prices, not an index — what the item actually rang up at.',
    ],
  },
  endcardChip: 'EPISODE · THE GROCERY RUN',
};
