# The chart format — engineering notes

The racing-line chart short: expanding axes, a big ticking date, multi-coloured lines, a
badge on every line head. `.claude/skills/viral-chart-protocol/SKILL.md` is the procedure;
this file is what the procedure is built on and why the parts are shaped the way they are.
`FORMULA.md` is the taste and outranks both.

## Files

```
src/charts/
  spec.ts      ChartSpec + ChartData contracts, formatters, frame budgets
  job.ts       how a chart's numbers are obtained (yahoo | fred | inline)
  cmath.ts     PURE geometry — scales, ticks, domains, head placement, standings
  clib.tsx     the components: BrandRow, ChartHead, Plot, BigDate, LiveRail,
               SourceBlock, Standings
  scenes.tsx   C1_Hook · C2_Race · C3_Payoff · C4_Endcard, plus ChartCtx
  jobs.ts      spec + job registry — React-free, so Node scripts can import it
  registry.ts  spec + frozen data + frame budget, for the render side
  specs/       one file per chart
  data/        FROZEN datasets, generated — never edited by hand
scripts/
  chart-fetch.ts    the only thing that touches the network
  chart-verify.ts   the honesty gate
  chart-out.ts      which batch folder a film is filed in (also `npm run chart:made`)
  gen-score-chart.ts
  render-charts.ts  verify-then-render, driven off the registry
out/charts/
  batch-01/ …       25 films per folder — one YouTube drag each
```

`jobs.ts` and `registry.ts` are split on purpose: `chart-fetch` has to run **before** any
dataset exists, so the module it imports cannot reference `data/`.

Modules under `src/charts/` that Node scripts import spell out `.ts` in their import paths
(Node ESM requires it; `allowImportingTsExtensions` is on in tsconfig for this reason).

## Why the numbers are frozen

The dataset is generated into a TypeScript module and committed. Renders never fetch.

- A re-render is byte-identical to the published film, forever.
- The on-screen `PULLED <date>` describes a file that exists rather than a claim.
- 966 frames × N network calls is not a render pipeline.

## The honesty gate, and what it is for

`chart-verify.ts` is not a lint pass; it encodes specific ways this format lies.

**The window.** The most-viewed chart in this genre was fact-checked in public and lost — not
because a number was wrong, but because one series covered fewer periods than the others.
Once the animation ran past its last observation, that line stopped climbing while every
rival kept going, and a line that stops climbing while others rise reads, to every viewer, as
the one that won. Nothing was mis-rendered.

So the window is enforced in three places, none of them cosmetic:
1. `ChartData` gives every series exactly one slot per shared date, so a short series must be
   written as explicit `null`s rather than just being shorter.
2. `chart-fetch` rebases to the first date all series exist and trims to the last date all
   series report, and says how many dates it dropped.
3. `chart-verify` FAILS on any leading or trailing run of nulls, and blocks the render.

**The spike.** A single point that jumps far out of a series' own behaviour and comes back is
a parse artefact far more often than data. FRED marks a gap with `.` in some series and with
*nothing at all* in others; `Number("")` is `0`, so a blank October CPI became a real reading
of zero, which rebased to −100% and drew consumer prices falling off the bottom of the plot.
The parser now requires a numeral and the gate catches the shape regardless of cause.

**The axis.** A log scale is announced on screen or the render is blocked. A linear axis with
a >30× spread warns, because six of the lines will lie flat on the floor saying nothing.

**The copy.** Any number typed into a title, hook or payoff line must be traceable to a final
value, a growth multiple, a year or the principal. Figures on screen are derived; copy is
qualitative.

## Traps already paid for

- **`range=max` silently changes the interval per symbol.** Asking Yahoo for monthly bars
  over "max" returns *quarterly* bars for a symbol listed in 1980 and monthly for one listed
  in 1999 — no error, no field saying so. Aligned against its neighbours the coarsened symbol
  had two holes in every three months (AAPL and MSFT were each missing 114 of 173). The
  fetcher now measures the median gap between returned stamps and refuses a mismatch. **Use
  an explicit range.**
- **Yahoo and FRED want opposite User-Agents.** Yahoo rejects anonymous clients and wants a
  browser string; FRED *hangs* on a spoofed one and answers an honest one. Both are in
  `chart-fetch.ts` and neither should be cargo-culted into the other.
- **`deOverlap`'s per-item clamp used to undo its own spacing.** Eight badges needed 588px of
  a 554px column; the block got shifted up to clear the bottom and the top badge was then
  clamped back down onto its neighbour — the leader and the runner-up printed through each
  other. It now shrinks the gap first, and compresses the whole stack proportionally when it
  genuinely does not fit. Each badge also draws a dot at its true point with a dashed
  connector, so a nudged label never misstates a value.
- **`overflow: hidden` on a label is a silent lie.** "Median home sold" printed as "Median
  home so" and read as a shorter phrase, not as a bug. Head labels are `nowrap` and *not*
  clipped, so a stills sweep catches it.
- **`spawnSync('npx.cmd', …)` on Windows returns status 0 having done nothing.** The render
  driver uses `shell: true` and then checks the file exists.
- **A y window wider than the data crushes the chart.** The log axis used to open on a full
  decade regardless of what was revealed, so for the first third of a run every line sat
  inside ~25px of a 610px plot — and because head badges must not overlap, de-overlap fanned
  eight nearly-identical values across the whole column into what read as a floating legend.
  The window now opens tight around the revealed data and widens from there. Both bounds are
  monotone by construction, so the axis still never rewinds.
- **A log axis under about a decade cannot be labelled with decades.** Early in a race the
  whole field sits between $8K and $14K and the decade walk yields exactly one tick. Below a
  12× spread the tick generator uses nice round steps positioned on the log scale.
- **`yFloor` is a preference, not a floor.** Pinned hard it clipped a real series: the
  median-home line dips to −1.27% in 2000 and was drawn below the baseline, outside the plot
  box. Data below the preferred floor wins and the axis opens downward.
- **Yahoo appends a LIVE bar on top of the current month's bar.** Asked for monthly bars it
  returns `2026-09-01` *and* `2026-09-04` — the month twice, three days apart. On the x axis
  those two readings are one month-step apart like every other pair, so the last segment of
  the film draws three days of movement across a month of width: the axis whose whole job is
  to represent time passing misstates its own final step, silently, with every value real and
  every line carrying the same extra point. `oneRowPerMonth()` keeps the freshest reading and
  stamps it at the month start — which is what the on-screen note already promised. The two
  films published before this was found still carry the extra point in their frozen data; it
  was left alone rather than re-fetched, because a published film's numbers do not move.
- **The spike check cannot judge a rebased percent series by its local level.** Every line in
  a `pctChange` chart starts at zero by construction, so for the first year or two the
  denominator is a couple of percentage points and ordinary published noise is enormous next
  to it: the toys line was FAILED for moving 118.4 → 117.5 → 118.3 on a 118-point index. The
  excursion is now judged against the series' own full range as well, and both tests must
  fire. Proven by re-injecting the blank-field collapse the check exists for — still a FAIL.
- **A cap written in a comment is not a cap.** `xAxisYears` promised "at most six" and its
  ladder stopped at a five-year step, so a fifty-year run asked for eleven labels at 78px
  apart — four digits of 25px mono need about that much on their own. The ladder now widens
  through round steps until the count is inside the cap.
- **The live rail assumed ticker-length labels.** Four fixed columns give each label about ten
  characters of 25px mono; "10-yr Treasury" is fourteen, and the rail printed each one
  straight through its neighbour, `nowrap` and unclipped. Type floors forbid shrinking the
  text, so the grid gives way instead: the column count is a preference that is only ever
  reduced, and rows compress to the fixed band above the source block rather than printing
  over the receipts.
- **The axis chip was a guess dressed as a fact.** It read `unit === 'pct' ? 'CUMULATIVE %' :
  'PORTFOLIO VALUE'`, which is true of a rebased chart and false of one drawing levels — the
  interest-rate film is six published rates, nothing cumulative and nothing rebased, and the
  chip sat over it saying CUMULATIVE %. A chip is a claim about the arithmetic, so it is read
  from the line that records the arithmetic.
- **Eight lines is the format's ceiling, not a style preference.** At nine, the head badges
  compress past the point where a label stops printing through the value beneath it — two
  sector funds that finish $157 apart were drawn through each other. Drop a line rather than
  let a badge collide.
- **A spike check that only looks at the two neighbours is a sample of one.** A volatile line
  that falls hard and recovers inside two months is indistinguishable, by that test, from a bad
  parse: the German market fell 13% in September 2011 and bounced 16% in October — the eurozone
  crisis, checked against the source closes — and was FAILED for it. The excursion is now
  compared with the series' own TYPICAL step (its median absolute month-to-month move) as well,
  which is what the check's own comment always claimed it did. A blank field read as zero is
  hundreds of times the typical step; a bad month is three or four. Re-proved by injection.
- **Sampling can manufacture the artefact the gate looks for.** Keeping one month in three can
  land on a peak: eggs genuinely went $1.53 → $2.02 → $1.64 in the spring of 2020, and sampled
  quarterly the middle reading is a lone excursion with nothing either side to explain it. The
  same series at monthly resolution passes, because at monthly resolution it is what it actually
  was. If a chart's subject is a price that moves in weeks, do not sample it in quarters.
- **A publisher's gaps are not evenly spread, so a basket has to be chosen around them.** BLS
  stopped collecting coffee for 2008–09 and again for 2018–19, and rice for 2000–02. Drawn, that
  is a straight chord across two years — a picture of a price that did not move, across the
  exact period it moved most. Both were cut from the grocery basket for that reason alone.
- **Money below $100 needs cents.** `group()` rounds to whole units, which is right for a
  portfolio value and wrong for a shelf price: every grocery line printed as a flat integer that
  changed once a year. `formatValue`/`formatTick` now show cents under $100 — above every value
  in every film made before, so nothing already published moves.
- **The programmatic renderer defaults to port 3000** — the app's own dev server. With that
  up, it loads the website, finds no compositions and reports "not a valid Remotion project".
  `scripts/stills.ts` pins 3335.

## The cut

Default is **the race and nothing else** — 690 frames, 23s, 1080×1920. The owner cut the
question card and the endcard for retention (2026-09-04): a scroller meets the chart already
drawing and leaves when it stops, and the held final frame is the loop point. `DEFAULT_BEATS`
sets `hook`/`payoff`/`endcard` to 0 and `chartScenes` drops any zero-length beat, so those
scenes cost nothing while unused.

The owner restated this as a standing rule on 2026-09-05, so it is no longer only a default:
**`chart-verify` FAILS any spec that gives one of those three beats frames.** The scenes stay
in the engine — a card is a thing the owner can ask for on a particular film — but a spec
cannot quietly reintroduce one. Reverting means removing the gate deliberately, which is the
right amount of friction for a rule that has now been given twice.

With no endcard, the header is the only place the brand speaks, so it carries all of it on
every frame: mark + MAG8 left, tagline over `themag8.com` right. `chart-verify` FAILS a cut
that has no endcard AND no address in the header — this format cannot silently become an
unbranded chart.

## Layout (1080×1920, all inside SAFE.portrait)

```
 146  brand row — mark + MAG8  ·  tagline over themag8.com (right)
 228  title (62px display, ≤2 lines)
 386  subtitle (31px body)
 440  axis chips — LOG SCALE / unit
 516  plot top ┐
              │ 610px, x 176→960
1126  plot bottom ┘  + year labels at 1168
1206  BIG DATE (118px) + progress rail
1396  live rail — running order, re-sorts every frame
1548  method line + source + pull date
```

## Where the films are filed

Chart films do not sit in `out/` with the hand-authored ones. They go to
`out/charts/batch-NN/chart-<id>.mp4`, **25 to a folder** — YouTube's upload dialog takes 25
files in one drag, so a full folder is exactly one drag and there is never a batch to count
out by hand (owner, 2026-09-05).

`scripts/chart-out.ts` owns the rule and `render-charts.ts` resolves the path *before* it
renders, so the log says where the file is going rather than where it went. Two behaviours
matter more than they look:

- **A re-render is not a new film.** If `chart-<id>.mp4` already exists in any batch it
  re-renders in place. Otherwise fixing a typo in an old chart would burn a slot in the
  current folder and leave two copies of one film to upload.
- **Nothing is ever re-filed.** A folder that has already been dragged into YouTube must keep
  meaning what it meant that day, so batches only ever gain films until they are full.

`npm run chart:made` prints every film by folder, marks a FULL folder, and is the novelty
check the protocol runs before brainstorming a new chart.

## Cost

Zero. Both data sources are keyless and free, the score is synthesised from scratch, the
fonts are vendored, and the render is local. No model runs anywhere in this pipeline.
