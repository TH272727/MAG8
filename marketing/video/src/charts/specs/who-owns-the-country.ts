/**
 * "Who owns the country?" — four slices of one pie, as the Fed publishes them.
 *
 * WHY THIS SHAPE. Every other chart here draws quantities that are free to move
 * independently: eight share prices, eight payroll counts, eight populations, and
 * if all of them rise at once the chart simply grows. These four cannot. They are
 * shares of one whole and they sum to 100 at every point on the x axis, so a rise
 * anywhere on this plot is a fall somewhere else on the same plot. That constraint
 * is the film: the lines are not racing, they are trading with each other.
 *
 * WHAT THE LINES ACTUALLY DO, checked rather than eyeballed. My first draft of
 * this file said "two of these four cross, once, and do not cross back", which I
 * had inferred from the endpoints: the top 1% starts below the next 9% and ends
 * above it. Walking the series point by point says otherwise — they cross SEVEN
 * times (2014-01, 2020-01, 2020-04, 2022-04, and three times across 2024) and the
 * lead is still changing hands at the end of the run. Every figure on screen was
 * correct while the sentence under it was false, and `chart-verify` reads numerals
 * only, so nothing would have caught it. The copy now says what the data says: one
 * line sat below the other for twenty-four years, and since 2014 they have traded.
 *
 * Because the four shares are exhaustive, whatever they do is not an artefact of
 * which lines were chosen. There is no basket to argue with here; this is the
 * whole pie.
 *
 * THEY SUM TO 100 ONLY TO THE PUBLISHER'S ROUNDING. The four are filed to one
 * decimal place and the worst frame is off by 0.2 (2015-01). The copy says "to the
 * rounding of the published figures" rather than claiming an exact hundred, which
 * would have been the same kind of false sentence.
 *
 * WHY 1989. That is where the Fed's distributional series begin, and the run needs
 * no sampling: 147 quarterly observations is almost exactly the point count the
 * shipped films use, so the pacing is the format's own.
 *
 * WHAT THIS FILM DOES NOT DO. It does not say who ought to own what, it does not
 * name anyone, and it draws no line that is not one of the four published shares.
 * The Fed's own quarterly figures, at their published levels, in their published
 * order. Anything beyond that belongs to the viewer.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  from: '1989-07-01',
  sourceLabel: 'Fed Distributional Accounts via FRED',
  series: [
    {key: 'MID40', id: 'WFRBSN09161'}, // 50th to 90th wealth percentile
    {key: 'NEXT9', id: 'WFRBSN40188'}, // 90th to 99th
    {key: 'TOP1', id: 'WFRBST01134'}, // top 1%
    {key: 'BOT50', id: 'WFRBSB50215'}, // bottom 50%
  ],
};

export const spec: ChartSpec = {
  id: 'who-owns-the-country',
  subject: 'share of US household wealth by group',
  title: 'Who owns America’s\nwealth?',
  subtitle: 'Share of total US household net worth.',
  hook: {question: 'Who owns the country?', kicker: 'Four slices of one pie, since 1989.'},
  unit: 'pct',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  backdrop: {file: 'who-owns-the-country.jpg', strength: 0.18, focus: 'center 45%'},
  series: [
    {key: 'TOP1', label: 'Top 1%', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: '1%'}},
    {key: 'NEXT9', label: 'Next 9%', color: C.macro, emphasis: true, medallion: {kind: 'mono', text: '9%'}},
    {key: 'MID40', label: 'Middle 40%', color: '#6ea8ff', medallion: {kind: 'mono', text: '40%'}},
    {key: 'BOT50', label: 'Bottom half', color: C.consensus, medallion: {kind: 'mono', text: '50%'}},
  ],
  payoff: {
    lead: 'One pie, four slices.',
    lines: [
      'For twenty-four years one of these lines sat below another. Since then they have traded the lead.',
      'The four shares are exhaustive — they sum to one hundred, to the rounding of the published figures.',
    ],
  },
  endcardChip: 'EPISODE · ONE PIE, FOUR SLICES',
};
