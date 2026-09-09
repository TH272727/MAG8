/**
 * "The worst day the market ever had" — $10,000 in six countries, 1987-88.
 *
 * THE STORY. On a Monday in October 1987 the American stock market fell by a
 * fifth in a single session — the worst day it has ever had, before or since —
 * and there was no war, no bank failure, no announcement that morning that
 * anyone could point at. The story is not the day, though. It is what the day
 * did to six countries that had bought into the same boom, and how completely
 * differently it treated them afterwards. Someone put ten thousand dollars into
 * each of them that August. The chart is what happened next.
 *
 * WHAT THE DATA SAYS, all of it read out of the series before any copy was
 * written, and all of it visible on screen:
 *   · The worst single session is not the same day everywhere. New York falls
 *     20.5% on Monday the 19th. London falls 12.2% and Tokyo 14.9% on the 20th,
 *     because their Monday was mostly over before New York opened. Sydney falls
 *     25.0% on the 20th. Hong Kong simply SHUT — for four days — and when it
 *     reopened on the 26th it fell 33.3% in one session, the worst mark on this
 *     chart by a distance.
 *   · The film ends on 1988-12-28 — the last session every one of the six was
 *     open, which is where the fetcher trims to — and the ten thousand dollars
 *     is worth $8,725 in the United States, $8,700 on the Nasdaq, $7,673 in
 *     Hong Kong, $7,658 in Britain, $7,213 in Australia, and $12,318 in Japan,
 *     which was back above its August 1987 level by FEBRUARY 1988 — four months
 *     after the crash — and kept going. (These are the figures the last frame
 *     draws. An earlier draft of this comment quoted the 30 December readings,
 *     two sessions the film does not contain, which is exactly the kind of
 *     disagreement between a file and its own film that nothing would catch.)
 *   · The far end of the recovery is the part nobody remembers: America needed
 *     until May 1989 to get back to where it started, Britain until August 1989,
 *     Hong Kong until July 1990, and Australia had not managed it by the end of
 *     1990 — three years on.
 *
 * WHY THE FILM STOPS AT THE END OF 1988 and not at each market's recovery. The
 * honest reason is that a window chosen so every line finishes somewhere
 * flattering is the exact defect this format exists to prevent, and a window
 * chosen to end on Japan's high would be that. The end of 1988 is a calendar
 * boundary, not a chart-shaped one: it sits about fourteen months after the
 * crash, gives every market time to show what it did, and leaves five of the six
 * still under water — which is the true state of things on that date. The
 * recovery dates above are what the film does NOT show, and they are written
 * here so the next person can see the choice rather than infer it.
 *
 * WHY JAPAN'S RUN IS NOT A HAPPY ENDING, and why the film does not say it is: it
 * is the same market whose peak two years later opens `nikkei-1989`, the film
 * about a country that took thirty-four years to get back to where it started.
 * The line that recovers first here is the one with the worst decade ahead of
 * it. That is left as a fact about the window rather than a prediction on
 * screen.
 *
 * WHY DAILY, and what it costs. Every other film in this format runs on months,
 * quarters or years; this one is the first on a DAY grid, because a crash
 * measured in months is not a crash — the entire subject happens inside three
 * sessions and a monthly chart would draw it as a single step. The cost is that
 * six exchanges keep six holiday calendars, so 3–6% of the points in each line
 * fall on days that market was shut (Tokyo has the most, 21 of 369) and the line
 * draws a straight chord across them. That is the ordinary meaning of a closed
 * market rather than missing data, and it is disclosed here because the gate
 * will report every one of them.
 *
 * WHY THESE ARE PRICE INDICES AND NOTHING IS "ADJUSTED". A national index is
 * quoted without dividends, so the basket is declared `excluded` and the line
 * under the plot says price only. Nothing here is currency-converted either:
 * each line is what a local buyer's money did in local money, which is the
 * comparison the story is about. A dollar investor in Tokyo in 1987 would have
 * had a different and better number, because the yen rose — that is a real
 * effect this chart does not show, and it runs in FAVOUR of the line that
 * already wins, which is the direction an undisclosed effect is least welcome.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'yahoo',
  // 40y reaches September 1986 with TRUE daily bars — checked, median gap one
  // day, not silently coarsened. `from`/`to` then clip to the window.
  range: '40y',
  interval: '1d',
  transform: 'invested',
  principal: 10000,
  from: '1987-08-03',
  // An end cutoff is legitimate only when the window IS the subject. It is here:
  // the film is about a crash and the year after it. See the note above for why
  // this date and not a date at which some line happens to lead.
  to: '1988-12-30',
  dividends: 'excluded',
  // 30 characters. Not "adjusted closes" — an index has nothing to adjust.
  sourceLabel: 'National price indices · Yahoo',
  tickers: [
    {key: 'SPX', symbol: '^GSPC'},
    {key: 'NDQ', symbol: '^IXIC'},
    {key: 'JP', symbol: '^N225'},
    {key: 'UK', symbol: '^FTSE'},
    {key: 'HK', symbol: '^HSI'},
    {key: 'AU', symbol: '^AORD'},
  ],
};

export const spec: ChartSpec = {
  id: 'black-monday',
  subject: 'stock markets around the 1987 crash',
  title: 'The worst day stock\nmarkets ever had',
  // The window is NAMED here because the job sets an end date, and the gate is
  // right to insist: a race stopped on an unstated frame can be flattering with
  // every value on screen still true. Both ends are on the subtitle.
  subtitle: '$10,000 in six countries, August 1987 to December 1988.',
  hook: {
    question: 'What does a crash actually look like?',
    kicker: 'One Monday, six countries, and the year that followed.',
  },
  backdrop: {file: 'black-monday.jpg', strength: 0.16, focus: 'center 55%'},
  unit: 'usd',
  scale: 'linear',
  // The window is fourteen months, so the axis labels months and marks January
  // with its year — a year-only axis would print the same four digits under
  // every point and say nothing for the length of the run.
  dateFormat: 'month',
  series: [
    {key: 'SPX', label: 'S&P 500', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'SPX'}},
    {key: 'JP', label: 'Japan', color: C.consensus, emphasis: true, medallion: {kind: 'mono', text: 'JP'}},
    {key: 'NDQ', label: 'Nasdaq', color: C.discovery, medallion: {kind: 'mono', text: 'NDQ'}},
    {key: 'UK', label: 'Britain', color: C.macro, medallion: {kind: 'mono', text: 'UK'}},
    {key: 'HK', label: 'Hong Kong', color: C.fundamentals, medallion: {kind: 'mono', text: 'HK'}},
    {key: 'AU', label: 'Australia', color: C.dim, medallion: {kind: 'mono', text: 'AU'}},
  ],
  payoff: {
    lead: 'Nobody could say what had happened that morning.',
    lines: [
      'One market shut for four days and fell by a third the day it reopened.',
      'The one that came back first was the one with the worst decade ahead of it.',
    ],
  },
  endcardChip: 'EPISODE · THE WORST DAY',
};
