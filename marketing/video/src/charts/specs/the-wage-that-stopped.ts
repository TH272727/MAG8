/**
 * "The wage that stopped" — the federal minimum wage against the states that
 * stopped waiting for it.
 *
 * THE STORY. On 24 July 2009 the federal minimum wage went to $7.25 an hour.
 * It has not moved since. That is the longest stretch without a raise since
 * the wage was created in 1938, and it is now long enough that someone born
 * the year it last changed is old enough to earn it. Nothing in this film is
 * an opinion about that; the film just draws the law.
 *
 * WHY THIS SHAPE — a staircase, not a curve. Every other film in this format
 * animates something that moves continuously: prices, closes, yields, counts.
 * A minimum wage does none of that. It sits at exactly one number for years
 * and then steps, because a person signed something. So this is the first
 * chart here whose lines are step functions, and the whole picture is one
 * line that stops stepping in 2009 while six others keep climbing away from
 * it. The drama is a line NOT moving, which is a shape this format has never
 * used and which no rebasing or compounding could have produced.
 *
 * WHY THESE SEVEN. The federal series is monthly back to 1938; the state
 * series are annual, dated 1 January, and the six chosen here are the ones
 * that reach back to 1968, so the run starts where all seven exist rather
 * than where the youngest one does. Florida (2006) and Arizona (2007) would
 * each have cut nearly forty years off the window to add a line, which is the
 * wrong trade in a format whose signature is a long axis.
 *
 * DELIBERATELY OMITTED: the states that never set their own wage. Texas and
 * Georgia are published at the federal figure, so their lines would be drawn
 * exactly on top of the federal line, and two badges fighting for one pixel
 * column is a rendering problem masquerading as a fact. The federal line
 * already says what they do.
 *
 * Levels as published — nothing rebased, nothing adjusted for inflation. A
 * real-terms version of this chart is a different film and would need to say
 * so in its own subtitle.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  // The state series are annual on 1 January; the federal one is monthly.
  // Sampling annually lands all seven on exactly the same dates with no holes.
  from: '1968-01-01',
  sample: 'annual',
  sourceLabel: 'Labor Dept. + state agencies via FRED',
  series: [
    {key: 'US', id: 'FEDMINNFRWG'}, // federal minimum hourly wage, nonfarm workers
    {key: 'WA', id: 'STTMINWGWA'},
    {key: 'CA', id: 'STTMINWGCA'},
    {key: 'NY', id: 'STTMINWGNY'},
    {key: 'MA', id: 'STTMINWGMA'},
    {key: 'CO', id: 'STTMINWGCO'},
    {key: 'OR', id: 'STTMINWGOR'},
  ],
};

export const spec: ChartSpec = {
  id: 'the-wage-that-stopped',
  subject: 'the US federal minimum wage',
  title: 'The minimum wage\nthat stopped',
  subtitle: 'Federal, against six states that stopped waiting. Dollars an hour, as set in law.',
  hook: {question: 'When did the minimum wage last go up?', kicker: 'The answer is not a recent year.'},
  unit: 'usd',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'year',
  series: [
    {key: 'US', label: 'Federal', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'US'}},
    {key: 'WA', label: 'Washington', color: C.consensus, medallion: {kind: 'mono', text: 'WA'}},
    {key: 'CA', label: 'California', color: C.discovery, medallion: {kind: 'mono', text: 'CA'}},
    {key: 'NY', label: 'New York', color: C.fundamentals, medallion: {kind: 'mono', text: 'NY'}},
    {key: 'MA', label: 'Massachusetts', color: '#6ea8ff', medallion: {kind: 'mono', text: 'MA'}},
    {key: 'CO', label: 'Colorado', color: C.macro, medallion: {kind: 'mono', text: 'CO'}},
    {key: 'OR', label: 'Oregon', color: '#c98bdb', medallion: {kind: 'mono', text: 'OR'}},
  ],
  backdrop: {file: 'the-wage-that-stopped.jpg', strength: 0.18, focus: 'center 45%'},
  payoff: {
    lead: 'One line stops. The others keep going.',
    lines: [
      'A minimum wage does not drift — it sits still until somebody signs something.',
      'Levels as written into law, not adjusted for what the money buys.',
    ],
  },
  endcardChip: 'EPISODE · THE WAGE THAT STOPPED',
};
