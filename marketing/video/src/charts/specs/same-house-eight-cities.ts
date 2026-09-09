/**
 * "Eight buyers, same $200,000, different city."
 *
 * WHY MONEY AND NOT PERCENT. The percent version of this chart already exists
 * in this folder — wages-vs-everything runs a national home index against wages
 * since 2000. What has never been drawn here is the sum itself: nobody owns a
 * percentage, they own a house, and "your $200,000 became this over there and
 * that over here" is the sentence the percentage stands in front of. That is
 * why FredJob learned `invested`; see the note on the transform in job.ts.
 *
 * WHY LINEAR. The field finishes inside about 3x, which is the range a linear
 * axis reads well. On a log axis the boom-and-bust arc that is the whole story
 * flattens into a gentle bend.
 *
 * WHAT THE INDEX LEAVES OUT, and why the subtitle says it on every frame: this
 * is the price of the house and nothing else — no mortgage, no interest, no
 * property tax, no upkeep, no commission. A repeat-sale index tracks what
 * resold for, which is the honest half of the question and not the whole of it.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'invested',
  principal: 200000,
  // Dallas begins exactly 2000-01, so it sets the shared base for all eight.
  // Nobody is rebased to their own first month.
  from: '2000-01-01',
  sourceLabel: 'Case-Shiller metro indices · FRED',
  series: [
    {key: 'MIA', id: 'MIXRSA'}, // Miami
    {key: 'SF', id: 'SFXRSA'}, // San Francisco
    {key: 'SEA', id: 'SEXRSA'}, // Seattle
    {key: 'PHX', id: 'PHXRSA'}, // Phoenix
    {key: 'LV', id: 'LVXRSA'}, // Las Vegas
    {key: 'DAL', id: 'DAXRSA'}, // Dallas
    {key: 'CHI', id: 'CHXRSA'}, // Chicago
    {key: 'DET', id: 'DEXRSA'}, // Detroit
  ],
};

export const spec: ChartSpec = {
  id: 'same-house-eight-cities',
  subject: 'house prices in eight US cities',
  title: 'A $200,000 house,\neight cities.',
  subtitle: 'The price of the house only — no mortgage, taxes or upkeep.',
  hook: {
    question: 'Same money. Same month. Different city.',
    kicker: 'Twenty-six years of repeat-sale prices.',
  },
  unit: 'usd',
  scale: 'linear',
  // A CC0 aerial of a South Los Angeles subdivision: the world the story happens
  // in, not a photograph of a house. Rows of near-identical roofs is the picture
  // of "eight buyers, same money" before a line is drawn.
  //
  // REJECTED FIRST, and the reason generalises: Commons file
  // "Suburban neighborhood (Unsplash).jpg" is CC0, large, and is NOT a suburban
  // neighbourhood. It is a tilt-shift aerial of an Eastern European city street,
  // Cyrillic shopfronts and a legible bank sign included. A FILE TITLE IS NOT
  // EVIDENCE OF WHAT A PHOTOGRAPH SHOWS — the search returns titles, and only
  // opening the image at full size tells you what you actually fetched. Under a
  // film about eight AMERICAN metro housing markets it would have been a quiet
  // geographic lie, at an opacity low enough that nobody could challenge it.
  backdrop: {file: 'same-house-eight-cities.jpg', strength: 0.18, focus: 'center 50%'},
  dateFormat: 'month',
  series: [
    {key: 'MIA', label: 'Miami', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'MIA'}},
    {key: 'SF', label: 'San Francisco', color: C.consensus, medallion: {kind: 'mono', text: 'SF'}},
    {key: 'SEA', label: 'Seattle', color: C.discovery, medallion: {kind: 'mono', text: 'SEA'}},
    {key: 'PHX', label: 'Phoenix', color: C.macro, medallion: {kind: 'mono', text: 'PHX'}},
    {key: 'LV', label: 'Las Vegas', color: '#e5749b', medallion: {kind: 'mono', text: 'LV'}},
    {key: 'DAL', label: 'Dallas', color: '#6ea8ff', medallion: {kind: 'mono', text: 'DAL'}},
    {key: 'CHI', label: 'Chicago', color: '#b7c34a', medallion: {kind: 'mono', text: 'CHI'}},
    {key: 'DET', label: 'Detroit', color: C.fundamentals, emphasis: true, medallion: {kind: 'mono', text: 'DET'}},
  ],
  // VERIFIED AGAINST THE FROZEN FILE, not remembered:
  //   Phoenix  peak 2.27x (2006-05) -> $197,856 (2011-08), BELOW the $200,000 start
  //   Las Vegas peak 2.35x (2006-04) -> $180,321 (2012-01), 28 months below start
  //   Detroit  85 months below start (2008-02 -> 2015-02) = seven years, and its
  //            final value is also its maximum, so "now at a record" holds.
  payoff: {
    lead: 'Same money. The city decided the rest.',
    lines: [
      'Two of them more than doubled, gave all of it back, and then did it again.',
      'One spent seven years below the price it started at, and is now at a record.',
    ],
  },
  endcardChip: 'EPISODE · EIGHT CITIES',
};
