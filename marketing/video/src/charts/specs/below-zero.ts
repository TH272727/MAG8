/**
 * "When interest rates went below zero" — eight governments' ten-year borrowing
 * cost, monthly, from March 1991.
 *
 * WHY THIS SHAPE, given there is already a rates film. `cost-of-money` draws six
 * AMERICAN rates and every one of them stays above zero for fifty years; the
 * zero line never matters there and is never in play. This chart is built around
 * that line: part of the field dives THROUGH it and stays under for years. FOUR
 * of these eight go negative — Switzerland for 72 months, Germany for 38, Japan
 * for 24, France for 22 — and in August 2019 all four are under the baseline at
 * once while the United States, the United Kingdom, Italy and Spain never are.
 * That split is the film: the linear axis has to open downward, half the lines
 * go with it and half do not, and it is a picture none of the eight films before
 * this one can make.
 *
 * WHY THESE EIGHT. One OECD definition applied to eight countries — the
 * ten-year main government bond yield, monthly, as published — so the lines are
 * comparable by construction rather than by assembly. Nothing is converted,
 * rebased or adjusted: these are the levels as filed.
 *
 * THE WINDOW. Italy's series begins in March 1991 and the run begins there, so
 * every line is measured over exactly the same period. That is also the most
 * dramatic possible opening: Italy and Spain are paying over thirteen percent in
 * that first month while Switzerland pays about six, and the convergence into
 * the euro pulls them together before the whole field falls off a cliff.
 *
 * WHAT THE VIEWER IS OWED. A yield is not a policy rate — it is what buyers of a
 * government's debt accepted in the market that month, which is why one country
 * can go negative while another does not. And these are monthly averages, so the
 * lowest print here is gentler than the lowest day.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  // Italy's series starts 1991-03; on a `raw` chart nothing trims the FRONT of
  // the run, so the shared start is stated here or the other seven lines open
  // with thirty years of holes.
  from: '1991-03-01',
  sourceLabel: 'OECD 10-year bond yields via FRED',
  series: [
    {key: 'USA', id: 'IRLTLT01USM156N'},
    {key: 'GBR', id: 'IRLTLT01GBM156N'},
    {key: 'DEU', id: 'IRLTLT01DEM156N'},
    {key: 'FRA', id: 'IRLTLT01FRM156N'},
    {key: 'ITA', id: 'IRLTLT01ITM156N'},
    {key: 'ESP', id: 'IRLTLT01ESM156N'},
    {key: 'JPN', id: 'IRLTLT01JPM156N'},
    {key: 'CHE', id: 'IRLTLT01CHM156N'},
  ],
};

export const spec: ChartSpec = {
  id: 'below-zero',
  subject: 'government interest rates - ten-year bond yields',
  title: 'When interest rates\nwent below zero',
  subtitle: 'Ten-year government borrowing cost, eight countries.',
  hook: {
    question: 'What happens when interest rates go below zero?',
    kicker: 'Eight governments, one line, thirty-five years.',
  },
  unit: 'pct',
  scale: 'linear',
  // NO yFloor, deliberately, on the film named after the zero line.
  //
  // Pinning the floor at 0 holds the baseline in frame from the first frame —
  // but in 1991 the lowest of these yields is 5.7% and the highest 13.8%, so a
  // window opened down to zero puts the entire field in the upper half of the
  // plot for the first decade, flat and cramped, to keep an empty band on
  // screen that means nothing yet. Left free, the window opens tight around the
  // yields and expands DOWNWARD as they fall, which is both the motion this
  // format exists for and a better telling: the zero line arrives in frame at
  // the point in history when it starts to matter, and (the domain being
  // monotone) never leaves again.
  yFloor: undefined,
  dateFormat: 'month',
  series: [
    {key: 'CHE', label: 'Switzerland', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'CH'}},
    {key: 'ITA', label: 'Italy', color: C.macro, emphasis: true, medallion: {kind: 'mono', text: 'IT'}},
    {key: 'USA', label: 'United States', color: C.consensus, medallion: {kind: 'mono', text: 'US'}},
    {key: 'GBR', label: 'United Kingdom', color: C.fundamentals, medallion: {kind: 'mono', text: 'UK'}},
    {key: 'DEU', label: 'Germany', color: C.discovery, medallion: {kind: 'mono', text: 'DE'}},
    {key: 'FRA', label: 'France', color: '#6ea8ff', medallion: {kind: 'mono', text: 'FR'}},
    {key: 'ESP', label: 'Spain', color: '#b7c34a', medallion: {kind: 'mono', text: 'ES'}},
    {key: 'JPN', label: 'Japan', color: '#e5749b', medallion: {kind: 'mono', text: 'JP'}},
  ],
  payoff: {
    lead: 'For years, lending some governments money cost you money.',
    lines: [
      'Nothing here is rebased or adjusted — these are the yields as published.',
      'A yield is what buyers accepted that month, not what a central bank set.',
    ],
  },
  endcardChip: 'EPISODE · BELOW THE LINE',
};
