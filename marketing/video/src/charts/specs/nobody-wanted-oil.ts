/**
 * "The day nobody wanted oil" — seven energy prices through 2020, and the
 * afternoon a barrel of American crude was worth less than nothing.
 *
 * THE STORY. In the spring of 2020 the world kept pumping oil into a world
 * that had stopped driving, and the tanks at Cushing, Oklahoma filled up. On
 * 20 April 2020 the price of West Texas Intermediate settled at MINUS $36.98:
 * for one day, a seller would pay you to take a barrel off their hands,
 * because there was nowhere left to put it. Everything else in the energy
 * complex fell hard that spring. Only one of them fell through the floor.
 *
 * WHY THIS SHAPE — the first daily film here, and the first line to go past
 * losing everything. Every other chart in this format moves monthly, weekly or
 * annually, because the stories were long ones. This story is one calendar
 * year long — 258 trading days — so the axis ticks day by day. And because each line is measured from
 * the first trading day of 2020, the WTI line does something no line in this
 * format has done: it crosses −100%. A hundred per cent down is everything you
 * had. This goes past it, which is the whole point, and is only possible
 * because the price itself went negative.
 *
 * WHY PER CENT AND NOT DOLLARS. The seven series are quoted in three different
 * units — crude in dollars per barrel, refined products in dollars per gallon,
 * natural gas in dollars per million BTU. Putting three units on one axis in a
 * money chart would be wrong however real each number is, so every line is
 * measured from its own New Year's Day price and the axis is a percentage,
 * which is unit-free and true of all seven.
 *
 * WHY IT ENDS AT NEW YEAR. The window IS the subject: this is the year, not a
 * race stopped early on a flattering frame. Run it to today and the collapse
 * becomes a small notch inside a six-year recovery, which is a different film
 * and a lesser one.
 *
 * THE DECLARED SPIKE. The honesty gate blocks a one-day excursion to a level a
 * series never otherwise reaches, because that is what a blank field read as
 * zero looks like. A negative oil price can never pass that test — nothing
 * else in the series is near it. So the day is declared in `knownExcursions`
 * with its reason, the gate reports it instead of blocking it, and anything
 * undeclared still fails. The source row was read: FRED DCOILWTICO,
 * 2020-04-20 = -36.98, the only negative reading in 10,236 observations going
 * back to 1986.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'pctChange',
  from: '2020-01-02', // first trading day of 2020
  to: '2020-12-31', // the window is the subject — see the header note
  sourceLabel: 'US Energy Info. Administration via FRED',
  series: [
    {key: 'WTI', id: 'DCOILWTICO'}, // West Texas Intermediate, $/barrel
    {key: 'BRENT', id: 'DCOILBRENTEU'}, // Brent, $/barrel
    {key: 'GAS', id: 'DGASUSGULF'}, // conventional gasoline, Gulf Coast, $/gal
    {key: 'JET', id: 'DJFUELUSGULF'}, // jet fuel, Gulf Coast, $/gal
    {key: 'HEAT', id: 'DHOILNYH'}, // heating oil, New York Harbor, $/gal
    {key: 'PROP', id: 'DPROPANEMBTX'}, // propane, Mont Belvieu, $/gal
    {key: 'NG', id: 'DHHNGSP'}, // natural gas, Henry Hub, $/MMBtu
  ],
};

export const spec: ChartSpec = {
  id: 'nobody-wanted-oil',
  subject: 'oil and energy prices through 2020',
  title: 'The day nobody\nwanted oil',
  subtitle: 'Seven energy prices through 2020, each measured from the year’s first trading day.',
  hook: {question: 'What is a barrel of oil worth when there is nowhere to put it?', kicker: 'One day in April 2020, less than nothing.'},
  unit: 'pct',
  scale: 'linear',
  dateFormat: 'month',
  series: [
    {key: 'WTI', label: 'US crude', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'WTI'}},
    {key: 'BRENT', label: 'Brent crude', color: C.macro, emphasis: true, medallion: {kind: 'mono', text: 'BR'}},
    {key: 'GAS', label: 'Gasoline', color: C.consensus, medallion: {kind: 'mono', text: 'GAS'}},
    {key: 'JET', label: 'Jet fuel', color: C.discovery, medallion: {kind: 'mono', text: 'JET'}},
    {key: 'HEAT', label: 'Heating oil', color: C.fundamentals, medallion: {kind: 'mono', text: 'HO'}},
    {key: 'PROP', label: 'Propane', color: '#6ea8ff', medallion: {kind: 'mono', text: 'PR'}},
    {key: 'NG', label: 'Natural gas', color: '#c98bdb', medallion: {kind: 'mono', text: 'NG'}},
  ],
  knownExcursions: [
    {
      key: 'WTI',
      date: '2020-04-20',
      why:
        'US crude settled NEGATIVE that day — storage at Cushing was full, so sellers paid to hand ' +
        'barrels over. The only negative reading in the series since 1986, and the subject of the film.',
    },
  ],
  backdrop: {file: 'nobody-wanted-oil.jpg', strength: 0.18, focus: 'center 50%'},
  payoff: {
    lead: 'Everything fell. One of them fell through the floor.',
    lines: [
      'A line below the baseline is a price below zero — the seller paying the buyer.',
      'Three different units, so every line is measured from its own first trading day of the year.',
    ],
  },
  endcardChip: 'EPISODE · THE DAY NOBODY WANTED OIL',
};
