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
import {DATA as owesData} from './data/what-america-owes.data.ts';
import {DATA as peopleData} from './data/eight-billion.data.ts';
import {DATA as belowZeroData} from './data/below-zero.data.ts';
import {DATA as pizzaData} from './data/pizza-day.data.ts';
import {DATA as nikkeiData} from './data/nikkei-1989.data.ts';
import {DATA as covidData} from './data/covid-crash.data.ts';
import {DATA as housesData} from './data/same-house-eight-cities.data.ts';
import {DATA as athomeData} from './data/money-left-at-home.data.ts';
import {DATA as workingData} from './data/who-stopped-working.data.ts';
import {DATA as interestBillData} from './data/the-interest-bill.data.ts';
import {DATA as buildingData} from './data/america-stopped-building.data.ts';
import {DATA as blackMondayData} from './data/black-monday.data.ts';
import {DATA as wageStoppedData} from './data/the-wage-that-stopped.data.ts';
import {DATA as oil2020Data} from './data/nobody-wanted-oil.data.ts';
import {DATA as nowhereData} from './data/nowhere-to-hide.data.ts';
import {DATA as vanishedData} from './data/the-jobs-that-vanished.data.ts';
import {DATA as ownsCountryData} from './data/who-owns-the-country.data.ts';
import {DATA as gapClosedData} from './data/the-gap-that-closed.data.ts';

const CHART_DATA: Record<string, ChartData> = {
  'mag7-10k': mag7Data,
  'wages-vs-everything': wagesData,
  'cost-of-money': moneyData,
  'cheaper-or-dearer': pricesData,
  'sector-race-10k': sectorsData,
  'work-in-america': workData,
  'grocery-run': groceryData,
  'world-markets': worldData,
  'what-america-owes': owesData,
  'eight-billion': peopleData,
  'below-zero': belowZeroData,
  'pizza-day': pizzaData,
  'nikkei-1989': nikkeiData,
  'covid-crash': covidData,
  'same-house-eight-cities': housesData,
  'money-left-at-home': athomeData,
  'who-stopped-working': workingData,
  'the-interest-bill': interestBillData,
  'america-stopped-building': buildingData,
  'black-monday': blackMondayData,
  'the-wage-that-stopped': wageStoppedData,
  'nobody-wanted-oil': oil2020Data,
  'nowhere-to-hide': nowhereData,
  'the-jobs-that-vanished': vanishedData,
  'who-owns-the-country': ownsCountryData,
  'the-gap-that-closed': gapClosedData,
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
