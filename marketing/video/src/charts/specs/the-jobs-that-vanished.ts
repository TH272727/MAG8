/**
 * "The jobs that vanished" — seven trades that stopped being jobs, as published.
 *
 * WHY THIS SHAPE. Every one of the films made before this one draws a field that
 * rises, fans out, or oscillates. Not one of them falls for its whole run. This
 * is the first chart here whose field CONTRACTS: seven lines walking down and
 * crowding into the floor of the plot, which is a different thing to watch and a
 * different thing to feel. The subject and the motion are the same fact.
 *
 * WHY THESE SEVEN, AND WHY NOT THE EIGHTH. Computer and electronic products
 * (CES3133400001) halved over the same window and was the obvious eighth line —
 * it is left out for two reasons. It starts at 1,940 thousand, which against
 * coal mining's 38 thousand puts a 51x spread on a linear axis: the verifier
 * warns above 30x precisely because the small lines then lie flat and the
 * collapse this film is about becomes invisible in the very lines that collapsed
 * hardest. Without it the spread is about 25x and every line stays readable.
 * It is also a different story — high-technology offshoring, not a trade
 * disappearing — and a film that means one thing is worth more than a film with
 * one more line in it.
 *
 * WHY 1990. Every leg of this basket begins 1990-01. Two neighbours that belong
 * to this story do NOT: department-store employment (CES4245210001) stops being
 * published in 2017-12 and leather and footwear (CES3231600001) in 2016-11. Both
 * are real series that answer normally — they are simply discontinued, and since
 * the fetcher trims the run to the last date EVERY series reports, either one in
 * this basket would silently end the film nine or ten years ago with every value
 * on screen correct and nothing anywhere reporting an error. They are excluded on
 * purpose, and this note is here so nobody adds them back.
 *
 * NB the figures are in THOUSANDS of workers, which is how BLS publishes them and
 * what the subtitle says. Nothing is converted, indexed or rebased: the whole
 * point is that these are the counts as filed.
 *
 * THESE SERIES ARE SEASONALLY ADJUSTED, and the copy therefore makes no claim
 * that they are not. `CES...` is the adjusted BLS series and `CEU...` the raw one;
 * FRED's page for either does not say so anywhere a scrape can reach, so this was
 * settled by fetching both twins and comparing them — they differ every month
 * (Jan 2025: 81.8 against 80.8). The first draft of the payoff here said "no
 * index, no rebasing, no adjustment", which would have been a false sentence with
 * every number on screen correct, and the verifier only reads numerals.
 */
import type {ChartSpec} from '../spec.ts';
import type {FetchJob} from '../job.ts';
import {C} from '../../theme.ts';

export const job: FetchJob = {
  source: 'fred',
  transform: 'raw',
  from: '1990-01-01',
  sample: 'quarterly',
  sourceLabel: 'BLS Current Employment Statistics via FRED',
  series: [
    {key: 'APPA', id: 'CES3231500001'}, // apparel manufacturing
    {key: 'PRNT', id: 'CES3232300001'}, // printing and related support
    {key: 'METL', id: 'CES3133100001'}, // primary metals
    {key: 'PAPR', id: 'CES3232200001'}, // paper manufacturing
    {key: 'FURN', id: 'CES3133700001'}, // furniture and related products
    {key: 'TEXT', id: 'CES3231300001'}, // textile mills
    {key: 'COAL', id: 'CES1021210001'}, // coal mining
  ],
};

export const spec: ChartSpec = {
  id: 'the-jobs-that-vanished',
  subject: 'American payroll jobs in shrinking industries',
  title: 'The American jobs\nthat vanished',
  subtitle: 'Workers on US payrolls, in thousands.',
  hook: {question: 'What happened to the work?', kicker: 'Seven trades, thirty-six years.'},
  unit: 'index',
  scale: 'linear',
  yFloor: 0,
  dateFormat: 'month',
  backdrop: {file: 'the-jobs-that-vanished.jpg', strength: 0.18, focus: 'center 45%'},
  series: [
    {key: 'APPA', label: 'Apparel', color: C.confluence, emphasis: true, medallion: {kind: 'mono', text: 'APP'}},
    {key: 'PRNT', label: 'Printing', color: '#6ea8ff', medallion: {kind: 'mono', text: 'PRN'}},
    {key: 'METL', label: 'Primary metals', color: C.fundamentals, medallion: {kind: 'mono', text: 'MTL'}},
    {key: 'PAPR', label: 'Paper', color: C.discovery, medallion: {kind: 'mono', text: 'PAP'}},
    {key: 'FURN', label: 'Furniture', color: '#b7c34a', medallion: {kind: 'mono', text: 'FUR'}},
    {key: 'TEXT', label: 'Textile mills', color: C.macro, emphasis: true, medallion: {kind: 'mono', text: 'TEX'}},
    {key: 'COAL', label: 'Coal mining', color: '#e5749b', medallion: {kind: 'mono', text: 'COA'}},
  ],
  payoff: {
    lead: 'Nobody announced it.',
    lines: [
      'There was no single day any of these ended. Every series on this chart is still being published.',
      'Seven federal payroll counts at their published levels — nothing here is rebased or indexed.',
    ],
  },
  endcardChip: 'EPISODE · THE WORK THAT WENT',
};
