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
import {spec as owes, job as owesJob} from './specs/what-america-owes.ts';
import {spec as people, job as peopleJob} from './specs/eight-billion.ts';
import {spec as belowZero, job as belowZeroJob} from './specs/below-zero.ts';
import {spec as pizza, job as pizzaJob} from './specs/pizza-day.ts';
import {spec as nikkei, job as nikkeiJob} from './specs/nikkei-1989.ts';
import {spec as covid, job as covidJob} from './specs/covid-crash.ts';
import {spec as wageStopped, job as wageStoppedJob} from './specs/the-wage-that-stopped.ts';
import {spec as oil2020, job as oil2020Job} from './specs/nobody-wanted-oil.ts';
import {spec as nowhereToHide, job as nowhereToHideJob} from './specs/nowhere-to-hide.ts';
import {spec as houses, job as housesJob} from './specs/same-house-eight-cities.ts';
import {spec as athome, job as athomeJob} from './specs/money-left-at-home.ts';
import {spec as working, job as workingJob} from './specs/who-stopped-working.ts';
import {spec as interestBill, job as interestBillJob} from './specs/the-interest-bill.ts';
import {spec as building, job as buildingJob} from './specs/america-stopped-building.ts';
import {spec as blackMonday, job as blackMondayJob} from './specs/black-monday.ts';
import {spec as vanished, job as vanishedJob} from './specs/the-jobs-that-vanished.ts';
import {spec as ownsCountry, job as ownsCountryJob} from './specs/who-owns-the-country.ts';
import {spec as gapClosed, job as gapClosedJob} from './specs/the-gap-that-closed.ts';

export const CHART_SPECS: Record<string, ChartSpec> = {
  [mag7.id]: mag7,
  [wages.id]: wages,
  [money.id]: money,
  [prices.id]: prices,
  [sectors.id]: sectors,
  [work.id]: work,
  [grocery.id]: grocery,
  [world.id]: world,
  [owes.id]: owes,
  [people.id]: people,
  [belowZero.id]: belowZero,
  [pizza.id]: pizza,
  [nikkei.id]: nikkei,
  [covid.id]: covid,
  [wageStopped.id]: wageStopped,
  [oil2020.id]: oil2020,
  [nowhereToHide.id]: nowhereToHide,
  [houses.id]: houses,
  [athome.id]: athome,
  [working.id]: working,
  [interestBill.id]: interestBill,
  [building.id]: building,
  [blackMonday.id]: blackMonday,
  [vanished.id]: vanished,
  [ownsCountry.id]: ownsCountry,
  [gapClosed.id]: gapClosed,

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
  [owes.id]: owesJob,
  [people.id]: peopleJob,
  [belowZero.id]: belowZeroJob,
  [pizza.id]: pizzaJob,
  [nikkei.id]: nikkeiJob,
  [covid.id]: covidJob,
  [wageStopped.id]: wageStoppedJob,
  [oil2020.id]: oil2020Job,
  [nowhereToHide.id]: nowhereToHideJob,
  [houses.id]: housesJob,
  [athome.id]: athomeJob,
  [working.id]: workingJob,
  [interestBill.id]: interestBillJob,
  [building.id]: buildingJob,
  [blackMonday.id]: blackMondayJob,
  [vanished.id]: vanishedJob,
  [ownsCountry.id]: ownsCountryJob,
  [gapClosed.id]: gapClosedJob,

};

export const CHART_IDS = Object.keys(CHART_SPECS);

/** 'mag7-10k' → 'Chart-Mag7-10k'. The composition id used by every render command. */
export const compIdOf = (id: string): string =>
  'Chart-' + id.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('-');
