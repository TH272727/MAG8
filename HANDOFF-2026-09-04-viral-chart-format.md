# HANDOFF — 2026-09-04 · The viral chart format

**Ask.** The owner named a creator in the animated-money-chart genre (Instagram
`@yunggeeski_`, ~68k followers, "12M+ views on one chart", featured in Newsweek and
FactCheck.org) and asked to research them and similar creators, work out how to replicate
the format with Claude + Remotion or something better plus free open tooling, **make it
better**, brand everything MAG8 — logo, name, website — and make it runnable on demand as
"the viral chart content protocol". The format was specified precisely: expanding x and y
axes with units increasing over time, time on x, money or percent on y, an enlarged date
under the chart that changes as time passes, a title, multiple coloured lines, and sometimes
an icon at the end of a line showing a face.

**Shipped.** A data-driven chart-film engine in `marketing/video/src/charts/`, four scripts,
a procedure at `.claude/skills/viral-chart-protocol/`, engineering notes at
`marketing/video/CHARTS.md`, FORMULA.md §K + changelog, and two finished films.

---

## 1. Research, and the one finding that changed the design

The creator sells a course (three tiers, $39–$299) around a repeatable workflow: FRED and
Yahoo Finance → CSV with cumulative-percentage logic → an animated chart → MP4 + caption and
pinned-comment templates. The specific software is paywalled, but it does not matter: the
format is fully visible in the output, and the data sources are the same two this repo
already reads for free.

**The finding that mattered is a failure, not a feature.** Their most-viral chart —
"Inflation by Presidency", scored to dramatic music, reposted to Truth Social — was
[fact-checked by FactCheck.org](https://www.factcheck.org/2026/08/trump-uses-deceptive-chart-in-false-inflation-boast/)
and lost. Not because a number was wrong. Because a **window** was: the chart animated
cumulative inflation to month 48 for ten presidential terms, but one of those terms was only
18 months old. Past month 18 that line simply stopped growing while every other line kept
climbing — so it finished lowest and read, to every viewer, as the winner.

Nothing in that chart was mis-rendered. The rendering was honest and the chart was not.

That is the exact defect a general-purpose chart animator will reproduce by default, and it
is the reason the MAG8 version is built around a window contract rather than around styling.

**Tooling verdict.** Every no-code tool in this space fails on export or on cost: Flourish
does not offer video export outside an enterprise contract (~$5k/yr); PlotSet watermarks and
day-limits its free tier; AECharts starts at $19/mo for MP4. Remotion renders unlimited
1080×1920 locally, on the house design tokens, with the brand and the waitlist ask baked in,
for nothing — and it can fetch its own data, which none of them do. The project already had
Remotion working with vendored fonts, a procedural score generator, a leak gate and a stills
pipeline, so the marginal cost of this format was the format itself.

## 2. What was built

```
marketing/video/src/charts/
  spec.ts       ChartSpec + ChartData contracts, formatters, frame budgets
  job.ts        yahoo | fred | inline
  cmath.ts      PURE geometry (scales, ticks, domains, head placement, standings)
  clib.tsx      BrandRow · ChartHead · Plot · BigDate · LiveRail · SourceBlock · Standings
  scenes.tsx    C1_Hook · C2_Race · C3_Payoff · C4_Endcard + ChartCtx
  jobs.ts       registry, React-free (scripts import it before any data exists)
  registry.ts   spec + frozen data + frames, render side
  specs/        one file per chart
  data/         FROZEN datasets, generated
marketing/video/scripts/
  chart-fetch.ts · chart-verify.ts · gen-score-chart.ts · render-charts.ts
```

Beats: 3s hook / 18s race / 5s payoff / 6s endcard = **32.2s, 966 frames, 1080×1920**.

**Nothing on screen is a typed figure.** Head values, the live rail, the final standings, the
gold winner's number, the growth multiple and the date range are all read from the frozen
dataset at render time; `payoff.lines` is qualitative copy and the verifier warns on any
number in copy that is not a final value, a growth multiple, a year or the principal.

**Renders never fetch.** `chart-fetch` is the only thing that touches the network; it writes
a committed TS module. A re-render next year is byte-identical and the on-screen
`PULLED <date>` describes a file rather than a claim.

## 3. The honesty gate

`npm run chart:verify` — a FAIL blocks the render, and `render-charts.ts` runs it first.

- **Leading or trailing nulls in any series** → FAIL, with the reason written out. This is the
  FactCheck defect. It is defended three times: the `ChartData` shape (one slot per shared
  date, so a short run must be explicit nulls), the fetcher (rebases to the first date all
  series exist, trims to the last date they all report, reports how many it dropped), and the
  gate.
- **A one-point spike that returns** → FAIL. Parse artefacts look exactly like this.
- **Log axis without the LOG SCALE chip on screen** → FAIL.
- **Linear axis with >30× spread** → WARN (the slow lines will lie flat).
- **Interior holes** → WARN (the line draws a chord).
- **Untraceable numbers in copy** → WARN.
- **Pacing** against FORMULA §C.

Proven, not assumed: nulling SPY's final 20 months produced

```
FAIL  series "SPY" has no reading for its final 20 date(s): its line would stop climbing
      while the others continue, which reads as a result rather than as missing data.
```

and restoring the file came back clean.

## 4. Seven findings, each a confident wrong number

1. **`range=max` silently changes the interval per symbol.** Yahoo returned *quarterly* bars
   for AAPL (listed 1980) and MSFT (1986) and monthly for the other six, from the identical
   `interval=1mo` request — no error, no field saying so. Aligned on date they were each
   missing **114 of 173 months** and drew long straight chords through a field of curves. The
   fetcher now measures the median gap between returned stamps and refuses a mismatch; specs
   use an explicit range.
2. **FRED marks a gap with `.` in some series and with nothing at all in others.**
   `Number(".")` is NaN and gets skipped; **`Number("")` is `0`** and passes
   `Number.isFinite`. CPIAUCSL ships `2025-10-01,` — that index was never published — and read
   as zero it rebased to **−100%**, drawing consumer prices falling off the bottom of the
   plot. Found by reading a still.
3. **The same bug was live in the product**, in `lib/bottleneck/supply.ts` `parseFredCsv`,
   whose comment asserts `"." = no observation` and does not consider the empty field. On a
   supply series a phantom zero is not a missing month, it is a collapse: it drags the rate
   down and shows up on the desk as a constraint **tightening that never happened**. Fixed and
   pinned (`771` tests, was 770).
4. **My own `deOverlap` bug.** The per-item clamp undid the spacing it had just done: eight
   badges needed 588px of a 554px column, the block was shifted up to clear the bottom, and
   the top badge was then clamped back down **onto its neighbour** — the leader and the
   runner-up printed through each other. It now shrinks the gap before placing anything and
   compresses the stack proportionally when it genuinely does not fit; every badge also draws
   a dot at its true point with a dashed connector, so a nudged label never misstates a value.
5. **`overflow: hidden` on a label is a silent lie.** "Median home sold" printed as "Median
   home so" and reads as a shorter phrase, not as a bug. Head labels are `nowrap` and
   unclipped so a stills sweep catches it.
6. **`spawnSync('npx.cmd', …)` on Windows returns status 0 having rendered nothing.** A
   silent success that produces no file. The driver uses `shell: true` and then checks the
   file exists.
7. **The programmatic renderer defaults to port 3000** — the app's own dev server. With that
   up it loads the *website*, finds no compositions and reports "not a valid Remotion
   project". `scripts/stills.ts` now pins 3335, which helps every existing film too.

Also corrected in passing: the payoff bars used a linear scale under a log chart, which
collapsed six genuinely climbing lines to a dot; they now use the plot's own scale.

## 5. The two films

`out/chart-mag7-10k.mp4` — 8 lines, log axis, "$10,000 in the Magnificent 7", one buy on
2012-06-01 held with distributions reinvested:

| | | |
|---|---|---|
| NVDA | $7,281,108 | 728× |
| TSLA | $1,697,411 | 170× |
| GOOGL | $235,378 | 24× |
| AMZN | $226,416 | 23× |
| MSFT | $207,172 | 21× |
| META | $200,060 | 20× |
| AAPL | $183,183 | 18× |
| S&P 500 | $72,148 | 7× |

`out/chart-wages-vs-everything.mp4` — 4 federal series, linear, cumulative change since
January 2000: home prices +233.1%, median home sold +148.5%, hourly wages +134.6%, CPI
+96.3%. Quarterly-sampled so two quarterly publishers and two monthly ones share a date axis
with no holes; the run stops at 2026-04-01, the last quarter every series reports.

## 6. Owner decisions recorded

- **The website is on screen now.** `themag8.com` sits in the brand row of every chart frame
  and on the endcard above the waitlist ask. This discharges the FORMULA §G hold ("no URL on
  endcards until the public domain is live") for the chart format.
- **Real-name safe framing now covers people.** §A already bars scoring, vetoing or attaching
  a negative claim to a real company. The "X's net worth vs Y's" shape the owner mentioned is
  now explicitly an **owner decision, never a default** — MAG8 is a live financial product
  with a waitlist, and a chart about a named individual's money or conduct is a different risk
  class from a chart of tickers. Line-head badges default to monogram discs: no likeness, no
  licence, no risk. The `image` medallion path exists and is unused.

## 7. Gates

tsc clean (video project and app) · `npm run test` 771 passed · `npm run check:leak` 0 hits
over 73 files · `npm run chart:verify` 0 FAIL · stills read at every beat and at the encode
path · both renders exit 0, ffprobe confirms 1080×1920 / 966 frames / 32.256s.

## 8. Open

- Portrait only. A landscape variant for YouTube long-form is not built.
- The `image` medallion path is built and unused, pending the likeness call above.
- No chart has been posted to any platform yet; the cross-post mechanics from the 07-10
  handoffs apply unchanged (note the colr-atom remux for synthetic uploads to X/TikTok).
- Chart ideas are currently hand-written specs. A next step, if wanted, is sourcing chart
  subjects from the desks' own measured output — the bottleneck desk's demand baskets and the
  rotation board's ratio history are already deterministic, free, and MAG8-proprietary.
