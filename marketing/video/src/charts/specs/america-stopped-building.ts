/**
 * "America stopped building houses" — homes started, by region, since 1959.
 *
 * THE STORY, and it is the answer to a question a stranger already has. Rent and
 * house prices are the thing everyone in this country feels, and the usual chart
 * about them is a price line going up. This is the other half of that, and it is
 * the half nobody draws: the country started more homes in 1972 than in any year
 * since — 2.49 million at an annual rate — and it is running at about half that
 * now with roughly a hundred and twenty million more people living here. The
 * chart is what happened in between, and where the building went.
 *
 * WHAT THE DATA SAYS, read out of the series before any copy was written. Two
 * things, both checkable on screen:
 *   1. The national line peaks in January 1972 and has never been back. It
 *      collapses to 478,000 in April 2009 — a fall of more than eighty percent
 *      from the peak, the deepest of any line here — and seventeen years later
 *      it is still below where it was fifty-four years ago.
 *   2. One region now out-builds the other three PUT TOGETHER. The South is
 *      running at about 645,000 against roughly 594,000 for the Northeast, the
 *      Midwest and the West combined. In the early years the four are within
 *      sight of each other; the Northeast finishes at a little over a third of
 *      its own 1972 rate. That divergence is where the country moved.
 *
 * WHY THE TOTAL IS DRAWN HERE, when the federal-debt film next door deliberately
 * refuses to draw one. There the five lines were five separate borrowers and a
 * sum would have invented a quantity nobody publishes. Here the four regions ARE
 * a partition of the country — they add to the national line, that is what the
 * national line IS — so drawing it states a relationship the data already has
 * rather than inventing one. It runs dim and unemphasised: it is the ceiling the
 * story is measured against, not a competitor in the race.
 *
 * WHAT A POINT ON THIS CHART MEANS, stated because it is easy to get wrong and
 * the gate cannot catch a false sentence. These are SEASONALLY ADJUSTED ANNUAL
 * RATES: a reading of 1.24M in a quarter does not mean 1.24 million homes were
 * begun in those three months, it means building ran at a pace which, sustained
 * for a year and stripped of the usual seasonal swing, would start that many.
 * That is the series every housing report quotes, and it is the only one of the
 * two that can be compared across a January and a July. The subtitle says so on
 * screen rather than leaving "homes started" to be read as a count.
 *
 * WHY QUARTERLY. Published monthly, 811 points, which is 0.85 frames per point —
 * under the floor, and the date under the plot would blur. Sampled to the first
 * month of each quarter it is 270 points at 2.6 frames per point, the same
 * density as the shipped metals-era films. Sampling costs one thing and it is
 * named here: a regional peak that falls in a February or a May is not drawn at
 * its true height (the South's own 1984 peak is a February). The two events the
 * film is about both survive — the January 1972 national peak and the April 2009
 * floor are both quarter-start months and are drawn exactly as published.
 *
 * WHY NOT PERMITS OR COMPLETIONS. `COMPUTSA` begins in 1968 and `PERMIT` in
 * 1960, and the fetcher rebases to the first date every series exists, so either
 * would have quietly eaten the start of the run for no gain — starts are also
 * the series that reacts first, which is what makes the 2009 cliff a cliff.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  from: '1959-01-01',
  // Filed in THOUSANDS of units. Converted by name so the axis reads in whole
  // homes — "1.24M" rather than a bare "1,239" that could be read as a count of
  // houses, a count of thousands, or anything else.
  scale: 'thousandsToUnits',
  // Monthly at source; see the note above for why this is sampled to quarters.
  sample: 'quarterly',
  // 36 characters, inside the 42 the receipts line leaves after the pull stamp.
  sourceLabel: 'Census & HUD housing starts via FRED',
  series: [
    {key: 'US', id: 'HOUST'}, // New Privately-Owned Housing Units Started: Total Units
    {key: 'SOUTH', id: 'HOUSTS'}, // ... in the South Census Region
    {key: 'WEST', id: 'HOUSTW'}, // ... in the West Census Region
    {key: 'MIDWEST', id: 'HOUSTMW'}, // ... in the Midwest Census Region
    {key: 'NE', id: 'HOUSTNE'}, // ... in the Northeast Census Region
  ],
};

export const spec: ChartSpec = {
  id: 'america-stopped-building',
  subject: 'houses being built in America - housing starts',
  title: 'America stopped\nbuilding houses',
  // The cadence is named ON SCREEN deliberately. The generated method line under
  // the plot reads "Series as published" for every FRED film, and it says that
  // whether or not the job sampled — a `sample: 'quarterly'` keeps the first
  // month of each quarter and drops the other two, which is a real thing done to
  // the data that the receipts line does not mention. Six shipped films are in
  // the same position. Until that line learns to say it, the subtitle does.
  subtitle: 'New homes started, at a yearly pace, seasonally adjusted. Every quarter since 1959.',
  hook: {
    question: 'Why does a house cost so much?',
    kicker: 'Sixty-seven years of American homebuilding, one quarter at a time.',
  },
  // A house mid-build with its roof trusses open and the crew standing in front
  // of it. The first choice was a NARA aerial of a road being cut for a new
  // development: correct subject, no people, no depth, and at 18% it read as
  // brown noise rather than as a photograph — which is the failure the owner
  // named on the pizza film. Judged on a full-resolution crop, not a contact sheet.
  backdrop: {file: 'america-stopped-building.jpg', strength: 0.18, focus: 'center 55%'},
  unit: 'index',
  scale: 'linear',
  dateFormat: 'year',
  series: [
    {key: 'US', label: 'United States', color: C.dim, medallion: {kind: 'mono', text: 'US'}},
    {key: 'SOUTH', label: 'South', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'S'}},
    {key: 'WEST', label: 'West', color: C.macro, medallion: {kind: 'mono', text: 'W'}},
    {key: 'MIDWEST', label: 'Midwest', color: C.consensus, medallion: {kind: 'mono', text: 'MW'}},
    {key: 'NE', label: 'Northeast', color: C.discovery, emphasis: true, medallion: {kind: 'mono', text: 'NE'}},
  ],
  /**
   * April 2020 reads as a single point down and straight back up, which is the
   * exact signature of a parse artefact — so it was checked against the source
   * rows before it was declared. The monthly series runs 1,581 · 1,549 · 1,266 ·
   * 936 · 1,039 · 1,266 · 1,526: a real three-month collapse and a real
   * three-month recovery when the country shut down. What makes it LOOK like a
   * spike is this film's own quarterly sampling, which keeps January, April and
   * July and drops the five months that show it as a slope. The event is real;
   * the shape of it on screen is a cost of the cadence, and that is worth saying
   * out loud rather than letting the gate report it as unexplained.
   */
  knownExcursions: [
    {
      key: 'US',
      date: '2020-04-01',
      why: 'the shutdown month — monthly source falls 1,266 to 936 to 1,039, a real V that quarterly sampling draws as one point',
    },
  ],
  payoff: {
    lead: 'The country never got back to the year it built the most.',
    lines: [
      'One region now starts more homes than the other three combined.',
      'The four regions add to the national line — that is what the national line is.',
    ],
  },
  endcardChip: 'EPISODE · WHERE AMERICA BUILDS',
};
