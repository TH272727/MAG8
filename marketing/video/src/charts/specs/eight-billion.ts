/**
 * "Which country has the most people?" — eight countries, every year since 1960.
 *
 * WHY THIS SHAPE. Every film before this one runs on a monthly or quarterly
 * grid and ticks a month under the plot. This one is ANNUAL: sixty-six readings,
 * one per year, and the big date counts years rather than months. That changes
 * the feel of the whole cut — roughly a third of a second per point instead of a
 * tenth — and it is the right grid for the subject, because a national
 * population is estimated once a year and pretending otherwise would be drawing
 * eleven readings nobody took.
 *
 * WHY IT IS A RACE. It is the slowest, most certain race there is, and it ends
 * with a lead change: on these estimates China is the most populous country on
 * earth for sixty-one of the sixty-six years on screen, and India passes it in
 * the last five. Nigeria starts last of the eight and finishes sixth, passing
 * Bangladesh and Brazil on the way. Nothing here is volatile, which is the point
 * — the lines cross because the growth RATES differ, not because any single year
 * was dramatic.
 *
 * WHOSE ESTIMATE. The crossing year is the World Bank's, and other bodies date
 * it differently — the UN's own estimate puts it later. That is why the film
 * names the estimator in the subtitle and carries the pull date: it is showing
 * one publisher's series, not adjudicating between them.
 *
 * WHAT THE VIEWER IS OWED. These are estimates, not counts: the World Bank's
 * mid-year figures, which are what a census gives you between censuses. They are
 * revised backwards from time to time, which is why the pull date on screen is
 * part of the claim.
 *
 * WHY THESE EIGHT. The eight largest at the end of the run, which keeps the
 * final spread inside about eight to one — a linear axis is honest at that
 * spread and a log one would flatten the very crossings the film exists to show.
 * Eight is also the format's hard ceiling: at nine lines the head badges compress
 * to where one label prints through the value beneath it.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  // All eight are annual, stamped 1 January, 1960 through the latest estimate —
  // one shared grid with no holes, so no `from` and no sampling.
  sourceLabel: 'World Bank population estimates via FRED',
  series: [
    {key: 'IND', id: 'POPTOTINA647NWDB'},
    {key: 'CHN', id: 'POPTOTCNA647NWDB'},
    {key: 'USA', id: 'POPTOTUSA647NWDB'},
    {key: 'IDN', id: 'POPTOTIDA647NWDB'},
    {key: 'PAK', id: 'POPTOTPKA647NWDB'},
    {key: 'NGA', id: 'POPTOTNGA647NWDB'},
    {key: 'BRA', id: 'POPTOTBRA647NWDB'},
    {key: 'BGD', id: 'POPTOTBDA647NWDB'},
  ],
};

export const spec: ChartSpec = {
  id: 'eight-billion',
  subject: 'how many people each country has - population',
  title: 'Which country has\nthe most people?',
  subtitle: 'Population, every year, as estimated by the World Bank.',
  hook: {
    question: 'Which country has the most people?',
    kicker: 'One reading a year, and a lead change at the very end.',
  },
  unit: 'index',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'year',
  series: [
    {key: 'IND', label: 'India', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'IND'}},
    {key: 'CHN', label: 'China', color: C.discovery, emphasis: true, medallion: {kind: 'mono', text: 'CHN'}},
    {key: 'USA', label: 'United States', color: C.consensus, medallion: {kind: 'mono', text: 'USA'}},
    {key: 'IDN', label: 'Indonesia', color: C.fundamentals, medallion: {kind: 'mono', text: 'IDN'}},
    {key: 'PAK', label: 'Pakistan', color: C.macro, medallion: {kind: 'mono', text: 'PAK'}},
    {key: 'NGA', label: 'Nigeria', color: '#b7c34a', medallion: {kind: 'mono', text: 'NGA'}},
    {key: 'BRA', label: 'Brazil', color: '#e5749b', medallion: {kind: 'mono', text: 'BRA'}},
    {key: 'BGD', label: 'Bangladesh', color: '#6ea8ff', medallion: {kind: 'mono', text: 'BGD'}},
  ],
  payoff: {
    lead: 'The lead in the oldest race on earth changed hands at the very end.',
    lines: [
      'Nothing here moves fast. The lines cross because the growth rates differ.',
      'Estimates from one publisher, revised backwards at times — hence the pull date.',
    ],
  },
  endcardChip: 'EPISODE · THE OLDEST RACE',
};
