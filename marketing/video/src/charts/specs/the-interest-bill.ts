/**
 * "The interest bill passed the military" — five federal spending lines, 1947→.
 *
 * THE STORY, and it is a story rather than a comparison: a country borrows, and
 * every year it pays interest on what it borrowed. Nobody campaigns on that
 * line, nobody votes for it, and for most of living memory it sat near the
 * bottom of the budget where nobody looked. It is now the second-largest thing
 * on this chart and it has just gone past what the country spends on its entire
 * military. The chart is the answer to "when did that happen, and did anyone
 * notice?" — and the answer, visible in the motion, is that it happened twice.
 *
 * WHAT THE DATA ACTUALLY SAYS — read out of the series before a word of copy was
 * written, because the story I expected was not the one the file tells. The
 * interest line does not climb steadily into the lead. It reaches the TOP of
 * this field for a single quarter in early 1998 (interest $368B against Social
 * Security $367B and defense $357B), and then it FALLS for five years — the only
 * line here that falls, and it falls while every rival rises. It bottoms in
 * 2003, spends two decades in the middle of the pack, and only passes defense
 * for good in the first quarter of 2024 ($1,071B against $1,040B). A line that
 * retreats for a decade and comes back is a better piece of motion than a line
 * that only ever goes up, and it is what the numbers do.
 *
 * WHY LINEAR, when the sibling film on federal debt (`what-america-owes`) is
 * log. That one draws five borrowers whose SIZES differ by three orders of
 * magnitude, so a linear axis would flatten four of them. These five finish
 * within 5× of each other ($1,645B down to $322B), and the whole subject is
 * which line is above which — the crossings ARE the film. On a log axis a
 * crossing between two lines of similar size is a barely visible kink; on a
 * linear axis it is the event. The axis still climbs from tens of billions in
 * 1947 into trillions, which is the motion this format exists to show.
 *
 * WHY THESE FIVE AND NOT SIX. They are one publication (the national income
 * accounts), one units convention (billions of dollars, converted by NAME in
 * job.ts), one quarterly grid from 1947, and — the part that took the checking —
 * they do not overlap. Defense and civilian government are the two halves of
 * federal consumption and investment; Social Security and veterans' benefits are
 * two distinct transfer programmes; interest is interest. Nothing here is inside
 * anything else here, so a viewer comparing two lines is comparing two different
 * dollars. Medicare and Medicaid were the obvious sixth and seventh lines and
 * were CUT: both series begin in 1966, and the fetcher rebases to the first date
 * every series exists, so adding either would have silently deleted the first
 * nineteen years of the film — including the stretch where the interest line is
 * small enough for its return journey to mean anything.
 *
 * WHAT THE VIEWER IS OWED. These are five separate spending lines, not five
 * slices of one budget, and the chart never totals them — the federal government
 * spends on many things that are not drawn here. The labels say what each line
 * is, and the film shows no sum and no share.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  // The national accounts file these in BILLIONS of dollars. The conversion
  // travels as a name (see FRED_SCALES) so the factor and the sentence printed
  // under the chart come from one entry — the Z.1 film next door is in MILLIONS
  // and mixing the two conventions on one axis is wrong by a thousand with every
  // value real and no error anywhere.
  from: '1947-01-01',
  scale: 'billionsToDollars',
  // 29 characters. The receipts line has a 62-character budget of which the pull
  // stamp takes 20, so this has to stay under 42 or the credit wraps.
  sourceLabel: 'US national accounts via FRED',
  series: [
    {key: 'INT', id: 'A091RC1Q027SBEA'}, // Federal government current expenditures: Interest payments
    {key: 'SS', id: 'W823RC1Q027SBEA'}, // Government social benefits to persons: Social security
    {key: 'DEF', id: 'FDEFX'}, // Federal Government: National Defense Consumption Expenditures and Gross Investment
    {key: 'CIV', id: 'FNDEFX'}, // Federal Government: Nondefense Consumption Expenditures and Gross Investment
    {key: 'VET', id: 'W826RC1Q027SBEA'}, // Government social benefits to persons: Veterans' benefits
  ],
};

export const spec: ChartSpec = {
  id: 'the-interest-bill',
  subject: 'US federal spending, including the interest bill',
  title: 'The US interest bill\npassed the military',
  subtitle: 'Five things Washington pays for, every quarter since 1947.',
  hook: {
    question: 'What does a country pay to borrow?',
    kicker: 'Eighty years of the federal budget, one line at a time.',
  },
  backdrop: {file: 'the-interest-bill.jpg', strength: 0.2, focus: 'center 50%'},
  unit: 'usd',
  scale: 'linear',
  dateFormat: 'year',
  series: [
    {key: 'INT', label: 'Interest on debt', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'INT'}},
    {key: 'SS', label: 'Social Security', color: C.consensus, medallion: {kind: 'mono', text: 'SS'}},
    {key: 'DEF', label: 'Defense', color: C.macro, emphasis: true, medallion: {kind: 'mono', text: 'DEF'}},
    {key: 'CIV', label: 'Civilian govt', color: C.discovery, medallion: {kind: 'mono', text: 'CIV'}},
    {key: 'VET', label: 'Veterans', color: C.fundamentals, medallion: {kind: 'mono', text: 'VET'}},
  ],
  payoff: {
    lead: 'Nobody votes for the interest bill.',
    lines: [
      'It reached the top of this chart once before, then fell for five years.',
      'Five separate spending lines, never added together — the chart shows no total.',
    ],
  },
  endcardChip: 'EPISODE · THE INTEREST BILL',
};
