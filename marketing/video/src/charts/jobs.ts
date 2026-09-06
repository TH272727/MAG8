/**
 * Specs + fetch jobs, and NOTHING that imports React — scripts/chart-fetch.ts
 * and scripts/chart-verify.ts both import this under Node's type stripping, and
 * chart-fetch has to run before any dataset exists. registry.ts is the render
 * side and pulls the frozen data in on top of this.
 *
 * Adding a chart is two lines here and one file in specs/.
 */
import type {ChartSpec} from './spec.ts';
import type {FetchJob} from './job.ts';

import {spec as mag7, job as mag7Job} from './specs/mag7-10k.ts';
import {spec as wages, job as wagesJob} from './specs/wages-vs-everything.ts';
import {spec as money, job as moneyJob} from './specs/cost-of-money.ts';
import {spec as prices, job as pricesJob} from './specs/cheaper-or-dearer.ts';
import {spec as sectors, job as sectorsJob} from './specs/sector-race-10k.ts';
import {spec as work, job as workJob} from './specs/work-in-america.ts';
import {spec as grocery, job as groceryJob} from './specs/grocery-run.ts';
import {spec as world, job as worldJob} from './specs/world-markets.ts';

export const CHART_SPECS: Record<string, ChartSpec> = {
  [mag7.id]: mag7,
  [wages.id]: wages,
  [money.id]: money,
  [prices.id]: prices,
  [sectors.id]: sectors,
  [work.id]: work,
  [grocery.id]: grocery,
  [world.id]: world,
};

export const CHART_JOBS: Record<string, FetchJob> = {
  [mag7.id]: mag7Job,
  [wages.id]: wagesJob,
  [money.id]: moneyJob,
  [prices.id]: pricesJob,
  [sectors.id]: sectorsJob,
  [work.id]: workJob,
  [grocery.id]: groceryJob,
  [world.id]: worldJob,
};

export const CHART_IDS = Object.keys(CHART_SPECS);

/** 'mag7-10k' → 'Chart-Mag7-10k'. The composition id used by every render command. */
export const compIdOf = (id: string): string =>
  'Chart-' + id.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
