/**
 * "Who borrows the most in America?" — five sectors of one economy, 80 years.
 *
 * WHY THIS SHAPE. Eight films in, this is the first LOG axis over published
 * levels. The one log film before it draws a rebased race (what $10,000 became,
 * every line from the same start), which is a fundamentally easier picture: the
 * lines begin together. These begin decades apart in size — state and local
 * borrowing opens three orders of magnitude below where federal borrowing ends —
 * and a linear axis would put four of the five flat on the floor for sixty of
 * the eighty years. The axis climbing through billions into trillions IS the
 * story, which is exactly the motion this format was built to show.
 *
 * WHY THESE FIVE. They are one publication, one units convention and one grid:
 * the Fed's Z.1 financial accounts, quarterly from 1952 (see the job below),
 * every sector filed as "debt securities and loans, liability level". Nothing is
 * mixed in from elsewhere. FRED's own GDP series was the obvious sixth line and
 * was CUT for exactly that reason: GDP is published in BILLIONS while the whole
 * Z.1 is in MILLIONS, and drawing them on one axis is wrong by a factor of a
 * thousand with every value real and no error anywhere. That is why the
 * conversion in job.ts travels as a name rather than a number.
 *
 * WHAT THE VIEWER IS OWED. These are five separate borrowers, not five slices of
 * one pie, and the chart never totals them — which matters most for the banks
 * and lenders line, since a financial firm's borrowing is largely how it funds
 * its lending to the other four. The line labels say who owes, and the film
 * shows no sum.
 *
 * THE RACE, as the numbers actually run — checked against the file, because the
 * story I expected was not the story the data tells. The lead changes hands
 * three times: the federal government leads until 1963, households from 1963,
 * the financial sector from 1993, and the federal government takes it back for
 * good in 2020. The best thing on screen is what happens to the banks-and-
 * lenders line either side of that: it peaks at $21.98T in July 2008, FALLS to
 * $16.89T by 2013, and does not get back above its 2008 level until late 2021 —
 * thirteen years flat on a chart where everything else is climbing — while
 * federal borrowing multiplies almost fivefold over the same stretch. A line
 * that stalls while its rivals rise is the most visible event this format has.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  // The Z.1 is filed in millions of dollars.
  //
  // THE START DATE IS NOT COSMETIC. These series reach back to 1945, but the
  // accounts are ANNUAL before 1952 and quarterly after — one series, two
  // publishing regimes, nothing in the data saying so. Points here are placed by
  // index, so drawn as filed the first six years ran at four times the speed of
  // the following seventy and the year labels sat at quarterly spacing. The run
  // therefore begins at the first quarter of the quarterly era. chart-verify
  // fails this shape now, so it cannot come back silently.
  from: '1952-01-01',
  scale: 'millionsToDollars',
  sourceLabel: 'Federal Reserve Z.1 accounts via FRED',
  series: [
    {key: 'GOV', id: 'FGSDODNS'}, // Federal Government; Debt Securities and Loans; Liability, Level
    {key: 'FIN', id: 'DODFS'}, // Domestic Financial Sectors; Debt Securities and Loans; Liability, Level
    {key: 'HH', id: 'CMDEBT'}, // Households and Nonprofit Organizations; ditto
    {key: 'CORP', id: 'BCNSDODNS'}, // Nonfinancial Corporate Business; ditto
    {key: 'SL', id: 'SLGSDODNS'}, // State and Local Governments; ditto
  ],
};

export const spec: ChartSpec = {
  id: 'what-america-owes',
  subject: 'who borrows the most in America - debt by sector',
  title: 'Who borrows the most\nin America?',
  subtitle: 'What each part of the economy owes, every quarter.',
  hook: {
    question: 'Who borrows the most in America?',
    kicker: 'Eighty years of the national accounts, on one axis.',
  },
  unit: 'usd',
  scale: 'log',
  // A preference, not a floor: the axis opens tight around what has been
  // revealed and yields to anything genuinely smaller.
  yFloor: 1e10,
  dateFormat: 'year',
  series: [
    {key: 'GOV', label: 'US government', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'GOV'}},
    {key: 'FIN', label: 'Banks & lenders', color: C.macro, medallion: {kind: 'mono', text: 'FIN'}},
    {key: 'HH', label: 'Households', color: C.consensus, emphasis: true, medallion: {kind: 'mono', text: 'HH'}},
    {key: 'CORP', label: 'Corporations', color: C.fundamentals, medallion: {kind: 'mono', text: 'CO'}},
    {key: 'SL', label: 'States & cities', color: C.discovery, medallion: {kind: 'mono', text: 'S&L'}},
  ],
  payoff: {
    lead: 'The biggest borrower in America has changed hands three times.',
    lines: [
      'One line peaks in 2008, falls for five years, and only regains that level in 2021.',
      'Five separate borrowers, never added together — the chart shows no total.',
    ],
  },
  endcardChip: 'EPISODE · WHO OWES WHAT',
};
