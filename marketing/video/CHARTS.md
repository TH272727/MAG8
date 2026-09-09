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

**The headline.** A film whose title is a riddle loses the viewer before any of the above
matters. Every spec declares a `subject` — what the film MEASURES, in plain words a stranger
understands — and the gate FAILS a title that shares no word with it. `the-gap-that-closed`
opened on the words "The gap that closed" with "life expectancy" only in the 31px subtitle,
which is one font size too late: the 62px line is what a scroller reads, and nothing under it
rescues a headline they have already scrolled past. Lead with the subject, then the story.
A machine cannot judge whether a phrase is clear; it can check that the title and the
declared subject are about the same thing, and that is enough to catch the riddle. The same
block measures the title's WIDTH per character rather than counting characters, because
digits and capitals run half again as wide as an `i` — "Eight different cities." is 23
characters and 612px while "$200,000 in 2000." is 17 characters and 534px — calibrated
against two real frames, and deliberately tuned to over-estimate, since the unsafe direction
for a FAIL threshold is the one that lets a wrapping title through.

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
- **A bar is dated in its own exchange's time.** Yahoo stamps each bar at the start of its period
  in LOCAL market time and `toISOString()` then reads it in UTC. New York is unaffected. Tokyo
  moves backwards across midnight: the Nikkei's October 1986 bar arrives as `1986-09-30` and
  month-bucketing files it under September — an entire foreign series shifted one month against
  its peers, for its whole history, every value real. The response carries `meta.gmtoffset`, so
  the fetcher uses it. No already-published film is affected; all of them are US-listed.
- **"Distributions reinvested" was a claim the fetcher had no right to make.** It was appended to
  every rebased method line — true of a fund's adjusted closes, FALSE of a price index. Four
  national indices printed a sentence under themselves contradicting their own subtitle. Worse is
  the mixed basket: a gold FUND beside an equity INDEX credits one line with dividends and not
  the other, which is the DAX-among-price-indices error in a different costume (and it was live in
  the COVID film until the three index legs were swapped for the funds that track them). A source
  cannot answer this — Yahoo returns `adjclose` for an index too, it just equals the price — so
  the basket's author DECLARES `dividends`, and omitting it makes no claim at all. `sourceLabel`
  is overridable on Yahoo jobs for the same reason: "adjusted closes" sat above "price only".
- **The spike gate needed a test that separates a bad parse from a bad month.** Its four
  conditions all fire on a genuine crash — this is the second time (Germany 2011, then the Nikkei
  falling 13% in March 2026 and recovering it in April, corroborated inside the source bars' own
  high/low). The discriminator that works: **is this a value the series visits at other times?** A
  blank field read as zero lands where the line never otherwise goes (−100% on a line living
  between 0 and +96%); a violent month lands somewhere the line has been. Excursions inside the
  rest-of-series range now WARN ("check the source row anyway") instead of blocking. Re-proved by
  injecting the blank-as-zero collapse: still a FAIL.
- **A photograph under the chart, and the licence rule that makes it shippable.** Owner brief,
  2026-09-06: a real image, darkened, behind the plot — "a small thing like this will make the
  video seem less AI generated", which is exactly right, because every other pixel in the frame is
  drawn. `scripts/chart-backdrop.ts` fetches from Wikimedia Commons and accepts **public domain
  and CC0 ONLY**, recording licence, author and source in `public/backdrops/CREDITS.json`. That is
  stricter than "free to use" on purpose: CC BY and CC BY-SA are free too and both oblige an
  attribution ON THE FRAME, and a chart film has one line of receipts which belongs to the data.
  `chart-verify` re-checks the licence at render time, because a rule that only runs at fetch time
  is a rule with a hole in it. Strength is clamped to 0.04–0.25 in code.
- **A backdrop is a SCENE, not a product shot.** The owner's verdict on the first three, and now a
  rule: the Tokyo skyline and the trading floor were "general enough, but relevant enough"; a studio
  close-up of a pizza slice was the weakest and wanted "a more general photo like a pizza delivery
  man". At 15% opacity behind a scrim, a place with people and depth still reads as a photograph
  while an object on a white sweep reads as a smudge — there is nothing for the eye to resolve. Ask
  what the story's WORLD looks like, not what its noun looks like. Also prefer frames without
  legible third-party branding: most signage goes illegible at these strengths, but a logo behind a
  financial film implies an association nobody agreed to. `filetype:bitmap` in a Commons query
  keeps scanned books out of the results — without it, "delivery man carrying boxes" returns twenty
  PDFs of 19th-century novels.
- **Two scrims stacked make a photograph into noise.** The first cut put a top-and-bottom gradient
  AND a plot-band wash over the image, leaving it at about 0.06 effective — which does not read as
  a photograph, it reads as sensor noise, the opposite of the point. The clear window is now wide
  (plot and big date, where the eye rests) and the plot wash is lighter. Judge this by cropping a
  still at full resolution: at contact-sheet size a backdrop looks fine at every strength.
- **A publisher's units are not a detail, and two FRED series can disagree.** The Fed files the
  whole Z.1 in MILLIONS of dollars while FRED's own GDP series is in BILLIONS; on one axis that
  is wrong by a factor of a thousand with every value real and nothing to see. GDP was cut from
  the debt basket for that reason, and the conversion travels as a NAME (`scale:
  'millionsToDollars'`, `FRED_SCALES` in `job.ts`) so the factor and the sentence printed under
  the chart come from one entry and cannot drift apart.
- **A series can change its own publishing frequency mid-history.** The Z.1 accounts are ANNUAL
  before 1952 and quarterly after — one series id, two regimes, no field saying so. Points are
  placed by INDEX, so drawn as filed the first six years animated at four times the speed of the
  following seventy, with year labels sitting at quarterly spacing to match: the axis whose
  entire job is to represent time misstating its own step, which is the window defect wearing a
  different hat. `chart-verify` now measures the date grid — a RUN of three or more irregular
  steps FAILS (start the run after the regime change with `from`), while an isolated odd gap
  WARNS, because that is a publisher's hole rather than a regime and three published films carry
  one (BLS skipped October 2025). Proved by re-injecting the 1945 start: 1 FAIL, exit 1.
- **The receipts line has a hard character budget and wrapping is invisible in a contact sheet.**
  21px mono at 0.12em inside the 960px safe width holds about 62 characters including the
  20-character pull stamp. "Federal Reserve Z.1 Financial Accounts via FRED" made 67 and dropped
  an orphan "09-06" under the credit — a finished frame with broken furniture on it, and at
  contact-sheet size it looks like a second line of text rather than a bug. Now arithmetic in
  `chart-verify` rather than an eye: over budget is a FAIL naming the character count.
- **The head badges had no clearance from the year labels.** The de-overlap floor was `PLOT_B +
  4`, which is the badge CENTRE — its value line lands at `PLOT_B + 35`, inside the axis label
  band that starts at `PLOT_B + 23`. Any chart whose slowest lines sit near the floor early in
  the run hits it; the population film opened with six of eight countries down there and drew
  "47.1M" straight through "1962". The floor now stops half a badge short of the label row.
- **`yFloor` costs the opening.** Zero is the obvious floor for a chart named after the zero
  line — and pinning it there put the entire 1991 field (5.7% to 13.8%) in the upper half of the
  plot for a decade to keep an empty band on screen that meant nothing yet. Left free, the window
  opens tight and expands DOWNWARD as the data falls, so the baseline arrives in frame exactly
  when it starts to matter and (the domain being monotone) never leaves. A floor is worth setting
  when the data sits near it; on a series that starts far above it, it only wastes the plot.
- **Money below $100 needs cents.** `group()` rounds to whole units, which is right for a
  portfolio value and wrong for a shelf price: every grocery line printed as a flat integer that
  changed once a year. `formatValue`/`formatTick` now show cents under $100 — above every value
  in every film made before, so nothing already published moves.
- **The programmatic renderer defaults to port 3000** — the app's own dev server. With that
  up, it loads the website, finds no compositions and reports "not a valid Remotion project".
  `scripts/stills.ts` pins 3335.
- **A Commons file TITLE is not evidence of what a photograph shows.** `File:Suburban
  neighborhood (Unsplash).jpg` is CC0, 4628×3085, and is not a suburban neighbourhood: it is a
  tilt-shift aerial of an Eastern European city street, Cyrillic shopfronts and a legible bank
  sign included. It was one render away from sitting under a film about eight AMERICAN metro
  housing markets — a quiet geographic lie, at an opacity low enough that nobody could ever
  challenge it. `--find` returns TITLES. Open the JPG at full size before you spec it; the gate
  checks the LICENCE and the strength range and has no idea what is in the picture.
- **A storefront is a product shot.** The first backdrop taken for the currency film was a
  money-changer's shop — thematically exact, and wrong on every other count: a real business
  named in legible gold letters over the door, two manufacturers' logos on the air conditioners,
  and a phone's burnt-in `REDMI NOTE 13 PRO` watermark across the frame. A named company behind
  a film about currencies losing value implies an association nobody agreed to. Replaced with a
  street: people, vendors, depth. The owner's rule holds — ask what the story's WORLD looks
  like, not what its noun looks like.
- **`yFloor` on a LOG axis is the below-zero defect wearing a different hat.** A floor of 1 on a
  film whose lowest value is $2.04 held the axis open across an entire extra decade from the
  first frame, so for most of the run every line sat squeezed into the top third of an empty
  plot. Set the floor just under the lowest value the film actually reaches. Note the gate
  REFUSES a log axis with no floor at all, so the fix is a tight floor, not no floor.
- **The gate cannot see a false SENTENCE, only a false NUMERAL.** `chart-verify` checks digits
  in copy against the data and has no opinion on a quantity spelled as a word, or on a claim
  about method. Two payoff lines were false and passed everything: "more than a decade below
  where it started" when the real figure was 85 months, and "nothing here is adjusted" written
  over six LNS-prefixed series, which ARE seasonally adjusted — the fetcher's own "Series as
  published, no adjustment" means no arithmetic by US, which is a different claim from the
  publisher's. Re-read every payoff line against the frozen file, not against your memory of
  the probe.
- **`registry.ts` builds `CHARTS` EAGERLY for every id in `jobs.ts`,** so a spec registered
  without a frozen dataset is not a staged edit — it is a hard failure for every render and
  every stills sweep in the project, including the shipped films. The trap is that `chart-fetch`
  and `chart-verify` import `jobs.ts` deliberately without React or data, so your own fetch and
  verify pass while every render is broken. REGISTER AND FETCH IN THE SAME BREATH; if you must
  pause mid-wiring, comment the spec out of `jobs.ts`.
- **`sourceLabel` has a 42-character budget.** The on-screen source line is 62 including the
  pull stamp, and going over is a FAIL, not a warning.

### Added 2026-09-07 (a five-session parallel run)

- **A window can now be cut, and the gate makes you say so.** `to` on the Yahoo/FRED/Mixed
  jobs is an inclusive end cutoff, the mirror of `from`. It exists because a film about a
  single year was impossible without it — the fetcher only ever trimmed to the last date every
  series reports, so a 2020 film ran to today and the collapse became a notch inside a
  six-year recovery. It is also the most dangerous option in the engine, because an
  author-chosen end date is the shortest path to the exact defect this format was built
  around: stop a race on the frame where a favoured line leads and every value on screen is
  still true. So `chart-verify` FAILS any spec whose `to` names a period the film's own title,
  subtitle or hook does not mention, and WARNS when it passes. The viewer is always told which
  window they are looking at. Proved by injection.
- **A one-day excursion can be DECLARED.** The discontinuity check blocks a spike to a level a
  series never otherwise visits, because that is what a blank field read as zero looks like. A
  price that settles NEGATIVE for one session can never pass that test — nothing else in the
  series is near it — and loosening the threshold would re-admit the collapse the check exists
  for. `spec.knownExcursions` takes the series, the day and the reason; the gate then reports
  it with that reason instead of blocking. Anything undeclared still FAILS. Used once, for US
  crude at −$36.98 on 2020-04-20, the only negative reading in 10,236 observations since 1986.
- **The x axis said nothing on a short film.** It only ever emitted YEAR labels, so on a film
  inside one calendar year every point carried the same four digits and the axis drew a single
  label at the left edge — the axis whose whole job is time, describing none of it. This could
  not happen before `to` existed, because every film ran to today and therefore spanned years.
  Runs under three years now get MONTH labels, January labelled with its year so a run crossing
  New Year says so. NOTE the obvious corollary is FALSE and is corrected two bullets down: a film
  whose dataset spans more than 36 months does NOT skip this path, because the mode is chosen
  from the REVEALED span and every film opens under three years.
- **A repeated LABEL is a duplicate React key, and in the encode path that is a ghost word.**
  The x-axis labels were keyed on the label text. Year labels are unique by construction, so it
  never mattered — until month labels arrived, where a window wider than twelve months prints
  "Mar" twice. Two children with one key orphans one of them, and because the encode path reuses
  a single DOM across sequential frames the orphan never unmounts: it prints through the label
  underneath it for the rest of the film. Fixed by keying on the datum index (`key={t.i}`), which
  is unique in both modes and changes no layout. This is the ghost-word class in the project
  CLAUDE.md arriving through a duplicate key rather than a stuck blur.
- **The axis mode is chosen from the REVEALED span, not the dataset span.** `lastIdx` comes from
  the growing `span`, so EVERY film — however many decades it covers — opens under three years and
  therefore opens in month mode. A claim that "long films are untouched because their span exceeds
  36 months" is wrong, and it was made here: the opening seconds of a fifty-year film are exactly
  where the duplicate keys were minted, and the ghost then survives to the final frame.
- **An encode-path sweep that starts at frame 300 cannot see a bug minted at frame 20.** The
  ghost is created during the opening, while the axis is still in month mode, and then persists.
  Sweep the OPENING frames, not only a comfortable window in the middle — and the surest check of
  all is to extract frames from the FINISHED mp4, because a fresh-DOM still is structurally
  incapable of reproducing this class.
- **Which films can actually mint it:** decided by a film's TOTAL SPAN, not by its revealed
  window — that distinction is the whole finding, and getting it backwards produced a wrong
  accusation about a peer's film. A film inside a single calendar year can never mint one, its
  month names cannot repeat; nor can one whose data is annual, because every non-January stamp
  finds no index and is skipped. MEASURED, and the rule is set by something that is not in the axis code at all: **`xSpan`
  floors the axis window at 8% of the dataset** (`Math.max(idx, (n-1) * 0.08)`), so a film's
  axis NEVER opens narrower than 8% of its whole span, however few points have been revealed.
  Month mode therefore depends on the film's total length, not on the frame:

  - **A film spanning more than ~37 years never enters month mode at all.** 8% of its span is
    already 3 years or more at frame 0. A 147-point quarterly film covering 1990-2026 opens with
    a 3.0-year window and prints `[1990, 1991, 1992]` — plain years, at every frame, verified
    both from the shipped mp4 and from a fresh still of the same frame under current code.
  - **A film spanning ~13 to ~37 years is the exposed set.** Its opening window is 13-35 months,
    which is month mode with a step of 1-6, and any step under 12 repeats a month name once the
    window passes twelve months: a 2005-2026 monthly film opens on a 20-month window at step 4
    and emits `[Jan, May, Sep, Jan, May]`; a 2000-2026 film opens on 25 months at step 6 and
    emits `[Jan, Jul, Jan, Jul, Jan]`. Those are the two films that actually ghosted.
  - **A step of 12 cannot duplicate** — every stamp lands on a January, and January renders as
    its year. This is why a long film in month mode still looks like a year axis.
  - **A single calendar year cannot duplicate** either: twelve months, twelve distinct names.
    Annual data cannot either, because every non-January stamp finds no index and is skipped.

  A WORKED ERROR, kept because it is the trap: predicting the label set from the REVEALED index
  gives the wrong answer every time, because the axis window leads the data. Doing exactly that
  produced a confident claim that a film emitted `[1990, Apr, Jul, Oct, 1991, Apr]` at frame 30,
  when the artifact — and a fresh still of the same frame — both read `[1990, 1991, 1992]`. The
  big date under the plot said APR 1991, so the reveal maths was right and the axis maths was
  the part being guessed. Read `xSpan` before predicting an axis.
- **A stills sweep started seconds after an edit can bundle the OLD module.** The final frame
  of a film came back with the axis fix missing while frames from the same sweep had it. It was
  not a bug in the fix and half an hour went into hunting it. Re-shoot before believing a still
  that disagrees with its neighbours.
- **The registry is evaluated EAGERLY, so a half-wired chart stops everyone.**
  `CHARTS = CHART_IDS.map(chartOf)` throws when a spec sits in jobs.ts with no dataset in
  registry.ts, and the whole bundle then fails to evaluate: no stills, no renders, not even for
  the films that were already shipped. It happened twice in five minutes here. The rule is wire
  jobs.ts, FETCH IMMEDIATELY, wire registry.ts — and if you must pause, comment the spec out of
  jobs.ts. The trap is that `chart-fetch` and `chart-verify` import jobs.ts deliberately without
  React or data, so your own fetch and your own gate pass while every render is broken.
- **A Commons file title is not a photograph.** "Pangburn's Cafeteria" is public domain, 2300px
  wide, and is a printed POSTCARD: white border, a caption burnt into the image and a real
  business named in it. At backdrop opacity it would have read as a grubby rectangle with text
  in it, under a film about wages. The `--find` results are titles and licences; only opening
  the file says what you fetched.
- **`--find` returns almost nothing usable on an ordinary scene query** — PD and CC0 only, and
  a plain "diner counter interior people" gave 8 results, 0 usable. Bias the query at
  government and institutional photography, which is public domain by default: naming an agency
  or programme (Strategic Petroleum Reserve, DOCUMERICA, NARA, Library of Congress, NASA, NOAA)
  turned a 0-usable search into 11 of 11.

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

## Music

The films carry the owner's licensed music, muxed on after the render by
`scripts/chart-music.ts`. Two stages, deliberately separate:

    node scripts/chart-music.ts --extract    # build the library from music/sources/
    npm run chart:music                      # score every chart film
    npm run chart:music -- mag7-10k          # just this one
    npm run chart:music -- --list            # who got what
    npm run chart:music -- --reroll pizza-day

`render-charts.ts` runs the scoring step itself after each successful render, because the
composition is silent and a film that skipped it would be posted in silence next to
twenty-six that are not — a failure invisible to every still and every frame check this
project runs.

**The composition is silent on purpose.** Chart films used to carry the procedural score from
`gen-score-chart.ts`, like every other film here. It is unwired in `Root.tsx` (2026-09-07) so
that there is exactly one source of sound; the generator is kept for a film that wants the
synthetic bed back.

**The picture is never re-encoded.** The mux maps `0:v` and the new `1:a` and stream-copies the
video, so a scored film is bit-for-bit the file the renderer produced — verified by comparing
the video stream's MD5 before and after, not assumed. Mapping only those two streams is also
what discards whatever audio the film arrived with, which makes the operation safe to repeat.

**Assignment is random once, then fixed.** `music/assignments.json` is committed; a film that
has a track keeps it, and new films take the least-used track so 26 films over 8 tracks sit at
3–4 each. A film that has been posted has to keep sounding like itself.

`music/sources/` and the extracted `.m4a` files are gitignored — large, and licensed material.
`library.json` and `assignments.json` are committed, and are what make the scoring
reproducible.

### Three traps paid for here

**`execFileSync` returns stdout ALONE, and ffmpeg writes every measurement to stderr.** The
window picker scans a track for its loudest passage with `volumedetect`; reading only stdout
gave it an empty string every time, the regex matched nothing, and all eight tracks reported
their loudest passage at exactly 0s. Eight identical answers is what a broken measurement
looks like, not a coincidence — `spawnSync` is used purely to get both streams.

**`-of csv=p=0` emits a trailing field separator.** A 23-second film probes as the string
`"23.000000,"`, `Number()` of that is `NaN`, and the NaN travelled into ffmpeg as `-t NaN` and
surfaced three steps away as loudnorm "reporting nothing measurable for source-06". Numbers are
parsed out of the reading now rather than cast from its shape.

**The container's duration is the LONGER of picture and sound.** A film rendered with the old
score is 23.000s of video under 23.061s of audio, and `format=duration` reports 23.061 — which
put the music's fade-out 0.06s past the last frame, still fading when the picture stopped. The
video stream is the film; measure that.

## Cost

Zero. Both data sources are keyless and free, the score is synthesised from scratch, the
fonts are vendored, and the render is local. No model runs anywhere in this pipeline.

## Added 2026-09-07 (Agent Three of the five-session run)

**A FRED series can be ALIVE and DISCONTINUED, and the honesty gate cannot see it.** The gate
catches a series that runs SHORT at the start; this is the same defect entering through the
END. `USNUM` (number of US commercial banks, 14,400 → 4,375) answers normally and stops
publishing in 2020-07; `CES4245210001` (department stores) stops 2017-12; `CES3231600001`
(leather and footwear) stops 2016-11. Because the fetcher trims the run to the last date EVERY
series reports, one of these in a basket silently ends the whole film six or ten years ago with
every value on screen correct and nothing anywhere reporting an error. **Check the LAST date of
every leg, not just the first.** It killed a bank film that was otherwise ready to build.

**Guessed CES industry codes fail more often than they work — 7 of 15 here.** The sector prefix
is the trap: durable goods are `31`, nondurable `32`, and the same industry under the wrong
prefix answers HTTP 200 with an HTML page, exactly like an id that never existed. Dead in this
session: CES5051110001 and CES5051111001 (newspapers), CES5051710001 (wired telecom),
CES3131300001, CES3132300001, CES3233700001, CES3233100001.

**CES payroll series are SEASONALLY ADJUSTED, and the on-screen method line says otherwise.**
`chart-fetch` writes "Series as published, no adjustment" under every FRED chart. That is true
of what the FETCHER did and false about what the DATA is, for this family. FRED's own page will
not tell you: the title, the units line and the meta description are all silent. It is settled
by **fetching the `CES` and `CEU` twins and diffing them** — they differ every month (apparel,
Jan 2025: 81.8 against 80.8). The line is shared engine copy sitting under eleven published
films, so it is flagged to the owner rather than reworded mid-run. mag8-57 checked its own two
FRED films and the sentence is true there (statutory rates, daily spot prices), so this is the
payroll family specifically, not every FRED chart.

**The verifier reads NUMERALS, so a sentence is unguarded.** Two of the three payoff lines
written for `who-owns-the-country` were false and passed every gate. "Two of these lines cross,
once, and never cross back" was inferred from the endpoints; walking the series says they cross
SEVEN times and are still trading the lead at the end. "The four shares sum to one hundred at
every point" is off by 0.2 at its worst frame, because the Fed files them to one decimal.
**Walk the series before you describe its shape** — the picture cannot correct the caption.

**Two of three archival backdrops needed CROPPING before use.** Both were raw scans that include
the film itself: a negative's sprocket holes on one, a slide mount with a burnt-in frame number
on the other. A landscape source fills a portrait frame by HEIGHT, so those borders land on the
finished frame as black bands. `ffmpeg -vf crop=…` on a public-domain scan changes nothing about
its provenance and CREDITS.json still records the original. **Look at the EDGES of an archival
image, not only the middle.**

**A licence check is not a judgement check.** `--find` will happily return, all correctly
licensed: twenty architectural survey plates of houses with no people in them (the "product shot,
not a scene" the owner rejected), and — for "hospital ward patients" — mostly wartime and
Japanese-American internment-camp hospitals, which would have put a history the film never earned
behind a chart about life expectancy. A crowd of identifiable men in business dress under the
title "Who owns the country?" reads as a claim about THOSE men; it was replaced with a town.
Aim at the story's PLACE, not its noun, and then look at what came back.

**`scripts/stills.ts` now reads `MAG8_STILLS_PORT` (default 3335, unchanged).** A hard-coded port
serialises every session on the machine, so with several people working the port itself becomes
the queue. Note there are TWO ports, which is easy to get wrong: stills use 3335 (the
programmatic API does not read `remotion.config.ts`), renders use 3333 (the CLI does). Holding
"the port" holds one of them. A stills sweep and a render can therefore run at the same time.

## Added 2026-09-07 (mag8-49, Agent Four) — three films, two source defects, one formatter gap

Films: `the-interest-bill` (FRED quarterly, linear published billions, 1947→),
`america-stopped-building` (FRED quarterly, linear counts, 1959→),
`black-monday` (Yahoo DAILY, invested, six countries, Aug 1987 → Dec 1988).

### Yahoo's MONTHLY series for a futures symbol OMITS whole months, and the rule is the calendar
`GC=F` returns 267 monthly bars where `^GSPC` returns 313 over the same span. The 46 missing
months are not null closes — the timestamps are absent from the response. `SI=F` and `HG=F` are
missing the IDENTICAL months, `PL=F` 59, `PA=F` 51, the index none. **Every dropped month is one
whose 1st falls on a weekend** (2000-10, 2001-04, 2001-07, 2002-09, 2002-12, 2004-02 … all
Sundays), which is why it is about 1.7 a year, every year, forever. The DAILY bars for those
months are complete — 2000-10 returns 20 sessions — so this is Yahoo's monthly aggregation and
not the market.

Why it matters more than a missing point: the same months are missing from every metal at once,
so the holes correlate across lines and look exactly like a market event. A `YahooJob` cannot
fetch daily and reduce (only `FredJob` has `sample`), so **there is no fix inside a spec**. A
planned metals film was DROPPED and fully un-wired rather than shipped with 46 chords per line.
Before trusting any `interval: '1mo'` basket containing a `=F` symbol, count its bars against a
non-futures line over the same window.

### The receipts line says "Series as published" even when the job SAMPLED
`sample: 'quarterly'` keeps January, April, July, October and drops the other two months of every
quarter — a real operation on the data — and the generated method line does not mention it.
`cost-of-money`'s frozen dataset reads "Series as published, no adjustment." while dropping two
thirds of its observations, and seven other films are in the same position. NOT fixed here: five
sessions were live in this file and it would rewrite the method string of every FRED film on its
next re-fetch. `america-stopped-building` discloses the cadence in its own subtitle instead. The
general point is the one that keeps recurring: **the gate checks NUMERALS and cannot see a false
SENTENCE.**

### `COMPACT_USD_ABOVE` lowered $1B → $100M
A billion left a gap. A film whose lines start in the hundreds of millions and end in the
trillions crosses the threshold mid-run, and below it the readout prints in full: Social Security
in 1949 drew as **"$690,680,167"**, twelve characters through the badge and into the axis, on a
chart whose other four heads read "$22.4B" and "$8.0B". Found by reading a still.

Checked the way the original threshold was: by scanning every frozen dataset rather than recalling
them. Across all 26 charts the $100M–$1B band holds 15 values and every one belongs to the film
that prompted the change; the largest money value in any other usd film is $34.47T (already above
the trillion tier) or $69.01M (below the new threshold, still grouped). Nothing published moves.

### Smaller things paid for
- **A daily multi-country film has correlated holes and they are honest.** Six exchanges keep six
  holiday calendars: 10–19 interior holes per line over 367 points, plus 73 irregular date steps
  (weekends drawn at the width of a normal step). That is the ordinary meaning of a closed market.
  Disclosed in the spec; it is the price of the only cadence on which a crash is a crash.
- **Quarterly sampling can manufacture a spike out of a real slope.** Housing starts fall
  1,266 → 936 → 1,039 across three months in 2020; sampled to quarters that is one point down and
  straight back up, which is the exact signature of a parse artefact. Declared via
  `knownExcursions` with the monthly rows in the reason, rather than left for the gate to report
  as unexplained.
- **A spec comment can disagree with its own film.** The `black-monday` doc quoted the 30 December
  readings; the film trims to 28 December, the last session all six markets were open. Caught by
  extracting the final frame from the mp4 and comparing it with the file.
- `range=40y&interval=1d` on Yahoo returns TRUE daily bars back to September 1986 — median gap one
  day, not silently coarsened. Pre-1992 there is no `^DJI`, no `^FCHI` and no `^BVSP` (HTTP 400,
  not a short series), and `^GDAXI` starts 1987-12-30, after the crash. `^GSPC` and `^IXIC` are
  the only US indices that reach.
- **The two sources refuse differently.** Yahoo answers HTTP 400 for a range it does not have;
  FRED answers HTTP 200 with an HTML body for an id that does not exist. Neither check catches the
  other's failure, so a probe needs both.
