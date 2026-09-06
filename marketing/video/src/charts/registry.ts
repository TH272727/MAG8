/**
 * Render-side registry: spec + frozen dataset + frame budget, per chart.
 * Root.tsx builds one composition from each entry.
 *
 * Adding a chart: write specs/<id>.ts, add it to jobs.ts, run
 * `npm run chart:fetch <id>`, then add the two lines below. The composition,
 * the score and the verifier all pick it up from there.
 */
import {beatsOf, totalFrames, type Beats, type ChartData, type ChartSpec} from './spec.ts';
import {CHART_IDS, CHART_SPECS, compIdOf} from './jobs.ts';

import {DATA as mag7Data} from './data/mag7-10k.data.ts';
import {DATA as wagesData} from './data/wages-vs-everything.data.ts';
import {DATA as moneyData} from './data/cost-of-money.data.ts';
import {DATA as pricesData} from './data/cheaper-or-dearer.data.ts';
import {DATA as sectorsData} from './data/sector-race-10k.data.ts';
import {DATA as workData} from './data/work-in-america.data.ts';
import {DATA as groceryData} from './data/grocery-run.data.ts';
import {DATA as worldData} from './data/world-markets.data.ts';

const CHART_DATA: Record<string, ChartData> = {
  'mag7-10k': mag7Data,
  'wages-vs-everything': wagesData,
  'cost-of-money': moneyData,
  'cheaper-or-dearer': pricesData,
  'sector-race-10k': sectorsData,
  'work-in-america': workData,
  'grocery-run': groceryData,
  'world-markets': worldData,
};

export type Chart = {id: string; spec: ChartSpec; data: ChartData; beats: Beats; frames: number};

export const chartOf = (id: string): Chart => {
  const spec = CHART_SPECS[id];
  const data = CHART_DATA[id];
  if (!spec) throw new Error(`no spec for chart "${id}"`);
  if (!data) throw new Error(`no frozen data for chart "${id}" — run: npm run chart:fetch ${id}`);
  if (data.id !== id) throw new Error(`dataset "${data.id}" is filed under "${id}"`);
  return {id, spec, data, beats: beatsOf(spec), frames: totalFrames(spec)};
};

export const CHARTS: Chart[] = CHART_IDS.map(chartOf);

/**
 * Scene order is fixed for every chart film — the format IS the structure — but
 * a beat set to zero frames is dropped rather than rendered empty. The default
 * cut is the race alone (owner call, see DEFAULT_BEATS); the other three scenes
 * stay available to any spec that gives them frames.
 */
export const chartScenes = (c: Chart) =>
  [
    {id: 'C1_Hook', frames: c.beats.hook},
    {id: 'C2_Race', frames: c.beats.race},
    {id: 'C3_Payoff', frames: c.beats.payoff},
    {id: 'C4_Endcard', frames: c.beats.endcard},
  ].filter((s) => s.frames > 0);

/** Frame at which a scene starts — the score generator places its hits off this. */
export const chartSceneStart = (c: Chart, id: string): number => {
  let acc = 0;
  for (const s of chartScenes(c)) {
    if (s.id === id) return acc;
    acc += s.frames;
  }
  return acc;
};

export {CHART_IDS, CHART_SPECS, compIdOf};
