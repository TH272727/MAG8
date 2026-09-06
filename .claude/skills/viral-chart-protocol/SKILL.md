---
name: viral-chart-protocol
description: Build a MAG8-branded animated chart short — the racing-line format with an expanding x/y axis, a big ticking date under the plot, multi-colour lines and a badge riding each line head. Use whenever the user says "viral fun chart marketing protocol", "viral chart content protocol", "run the chart protocol", "make a chart video/short/reel", "chart this", or asks for an animated data chart for YouTube Shorts / Reels / TikTok. Invoked with no subject it brainstorms three comparisons that have not been made before and asks which to build. Fetches its own free keyless data (Yahoo Finance, FRED), freezes it, verifies the window is honest, and renders locally with Remotion at zero cost. The film is the chart alone — no intro card, no outro — with the MAG8 mark, tagline and website carried quietly in the header of every frame.
---

# The viral chart content protocol

One command's worth of intent — "chart X" — becomes a 23-second, 1080×1920, MAG8-branded
film, rendered locally for $0. This document is the procedure. The engine lives in
`marketing/video/src/charts/`; the taste rules live in `marketing/video/FORMULA.md` and the
render physics in `marketing/video/CLAUDE.md`. **Read FORMULA.md before storyboarding and
again at QA — it is the compounding owner rulebook and it outranks anything here.**

## When the owner invokes this with no subject

"Run the viral fun chart marketing protocol" (or any wording near it) is a **standing brief,
not a blank one**. Do this before anything else, without being asked:

1. **Read what already exists.** `cd marketing/video && npm run chart:made`, and list
   `src/charts/specs/`. Novelty is checked against that list, never recalled.
2. **Brainstorm exactly three comparisons** the format can carry and that none of the made
   films has told. A good candidate has several series on one shared time axis in one unit, a
   lead change or a runaway that is visible in motion, ten years or more of history, and a
   keyless source (Yahoo symbols or FRED series ids) — sanity-probe the ids before proposing,
   because a series that does not exist costs a whole build to discover.
   Vary the *shape*, not just the subject: the two shipped films are "$10k invested, log,
   money" and "since 2000, linear, percent". A third of the same shape is a re-tread.
3. **Put the three to the owner and build the one they pick** (AskUserQuestion — one tap, and
   they can name their own instead). Then run the procedure below.

**If the owner names a count** ("make 3 original videos"), that is an instruction to ship
that many, not to brainstorm that many and build one — skip the question and build all of
them. The brainstorm and the `chart:made` novelty check still come first, and the three have
to be three different SHAPES (levels vs rebased, money vs percent, log vs linear), because
three subjects on one shape is one film made three times.

Two things are settled for every one of these films and need no confirmation: **no intro card
and no outro card** — `chart-verify` FAILS a spec that gives the hook, payoff or endcard beat
any frames — and the film is filed into its **batch folder** by the render driver.

## Where the films go

`out/charts/batch-01/`, `batch-02/`, … **25 films per folder**, because 25 is what YouTube's
upload dialog takes in one drag: a full folder is exactly one drag, with nothing to count out
by hand. The driver picks the folder; a re-render of an existing film returns to its own
folder rather than taking a slot in the current one, and a folder that has already been
dragged is never re-filed. `npm run chart:made` prints the state and marks a FULL folder.

## What the format is

**The film is the chart and nothing else.** 690 frames, 23s, 1080×1920. It opens already
drawing and ends ~1.5s after the last point lands — that held frame is the loop point.

| Beat | Frames | What happens |
|---|---|---|
| `C2_Race` | 690 (23s) | The chart draws. X axis grows with time, Y axis expands and its units climb, the date counts under the plot, a badge rides each line head, a rail re-sorts live. |

The owner cut the question card and the endcard for retention (2026-09-04) and restated it as
a standing rule (2026-09-05): this is meant to read as a cool moving graph for someone
scrolling, not as an ad with a chart in the middle. `C1_Hook`, `C3_Payoff` and `C4_Endcard`
still exist in the engine, but **giving any of them frames is now a `chart-verify` FAIL** — a
card comes back only when the owner asks for one on a specific film.

**The brand promotes by being present.** With no endcard, the header carries it on every
frame: mark + MAG8 top-left, and top-right the tagline over `themag8.com`. Quiet by design —
muted weight, no gold, no ask. `chart-verify` FAILS a cut that has no endcard and no address
in the header, so this can never silently become an unbranded chart.

Every number on screen — heads, rail, standings, the gold figure, the multiple, the date
range — is **read from the frozen dataset at render time**. None of it is typed. A figure in
the film cannot disagree with the file the source line points at.

## The procedure

### 1. Pick the story, then check it can be sourced

The format needs several series that share one time axis and one unit. Two keyless, free
sources are wired in and proven from this network:

- **`yahoo`** — adjusted monthly/weekly/daily closes for any listed symbol. Transforms:
  `invested` (what $N put in on the base date is worth), `pctChange`, `raw`.
- **`fred`** — any FRED series id, `raw` or `pctChange`, with optional `sample` to coarsen
  a mixed-frequency set to quarterly or annual.
- **`inline`** — hand-entered numbers. `sourceUrl` is mandatory; a figure with no origin is
  not publishable.

**Never assume a series id exists — probe it.** A FRED capacity series this repo needed
simply did not exist, and the cost of finding out late is a whole build.

### 2. Write the spec

`marketing/video/src/charts/specs/<id>.ts` exports `spec` (taste) and `job` (where the
numbers come from). Copy `mag7-10k.ts` (log, money) or `wages-vs-everything.ts` (linear,
percent) — between them they cover most of the space.

Register it in `src/charts/jobs.ts` (two lines) and `src/charts/registry.ts` (two lines).

Copy rules, all binding:
- Title ≤ 2 lines at 62px; use `\n` to break it yourself rather than letting it wrap.
- Labels ride the line head in a 268px column. **Keep them under ~16 characters.**
- Real companies appear in safe framings only — famous winners referenced neutrally or
  flatteringly. A real company is never scored, vetoed or attached to a negative claim
  (FORMULA §A). **This extends to real people: a chart about a named individual's money or
  conduct is an owner decision, not a default — see "Faces" below.**
- `payoff.lines` is qualitative. Do not type figures into copy; the scene derives them.

### 3. Fetch and freeze

```bash
cd marketing/video
npm run chart:fetch -- <id>          # add --dry to look before writing
```

Writes `src/charts/data/<id>.data.ts`. **Renders never touch the network**, so a re-render
next year is byte-identical and the on-screen "PULLED <date>" is true.

The fetcher enforces three things that cannot be styled around:
- every series is **rebased to the first date they all exist** — nobody gets a head start;
- the run is **trimmed to the last date every series reports** (see the gate below);
- the returned cadence is **measured, not trusted** — ask for monthly bars over a long range
  and some symbols come back quarterly with no error and no field saying so.

### 4. Run the honesty gate

```bash
npm run chart:verify -- <id>
```

A FAIL blocks the render. What it checks and why:

- **A series that runs out of data before the others.** This is the defect that put the
  best-known chart in this genre in front of a fact-checker: a partial term was animated
  against full ones, so the short line simply stopped climbing while its rivals kept going,
  and a line that stops climbing while the others rise reads to every viewer as the winner.
  Nothing was mis-rendered. The window was wrong.
- **A one-point spike that returns.** Parse artefacts look exactly like this. A blank field
  in a federal CSV was read as a zero here and drew consumer prices collapsing 100%.
- **A log axis without the LOG SCALE chip on screen.**
- **A linear axis with a >30× spread** (warn — the slow lines will lie flat; consider log).
- **Any number typed into copy that is not a final value, a growth multiple, a year or the
  principal.**
- **A card in a cut that should be the race alone** — the hook, payoff or endcard beat given
  any frames at all (owner rule, 2026-09-05).
- **Pacing** against FORMULA §C — frames per point across the race beat.
- **An unbranded cut**: no endcard AND no address in the header.

### 5. Score, stills, read them

```bash
npm run gen:score:chart -- <id>      # procedural, deterministic, no samples, no spend
npm run stills -- Chart-<Id>         # 12 evenly spaced
npm run stills -- Chart-<Id> seq 300-340   # encode path, catches DOM-reuse bugs
```

**Open the PNGs and look at them.** Every fit bug this engine has had was found by reading a
still, never by a test: badges printing through each other, a label silently clipped from
"Median home sold" to "Median home so", a chip row sitting on the subtitle, a purple line
falling off the bottom of the plot.

### 6. Leak gate, then render

```bash
npm run check:leak                   # must be 0 hits
npm run render:charts -- <id>        # re-runs the honesty gate first, then renders
```

Output: `marketing/video/out/charts/batch-NN/chart-<id>.mp4` — the driver picks the folder and
prints it, and says when a folder has filled and is ready to drag into YouTube.

## Faces on the line heads

`medallion: {kind: 'mono', text: 'NV'}` draws a monogram disc — no likeness, no licence, no
risk, and it is the default. `{kind: 'image', file: 'x.png'}` reads `public/faces/x.png`.

Before using a real person's face, get an explicit owner decision. MAG8 is a real financial
product with a live waitlist; a chart pairing a named individual with money or misconduct is
a different risk class from a chart of ticker symbols, whatever the engagement looks like.
If the answer is yes, the image must be one the owner has the right to use.

## What this replaces, and why it is built rather than bought

The no-code tools in this space either cannot export video without an enterprise contract,
or watermark and meter the free tier. This renders unlimited 1080×1920 MP4s locally, on the
house design system, with the brand, the domain and the waitlist ask on every film, for
nothing — and it can pull its own data, which none of them do.

## Adding a chart, end to end

0. `npm run chart:made` — read what has already been made; the story has to be a new one
1. `src/charts/specs/<id>.ts` — spec + job (leave `beats` alone: race only)
2. `src/charts/jobs.ts` — two lines
3. `src/charts/registry.ts` — two lines
4. `npm run chart:fetch -- <id>` → `npm run chart:verify -- <id>`
5. `npm run gen:score:chart -- <id>` → `npm run stills -- Chart-<Id>` → **read them**
6. `npm run check:leak` → `npm run render:charts -- <id>`
7. Append any new owner note to `marketing/video/FORMULA.md`'s changelog the day it lands.
