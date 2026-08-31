# The Rotation Board — operator notes

Deterministic ratio indicators over daily closing prices. Costs nothing, draws no research
capacity, and never writes to a pipeline table.

```
/rotation              the dashboard: what changed, every indicator, the sector board, volatility
/rotation/<id>         one indicator: its chart, how its score was reached, how it could be wrong
/methodology#rotation  the live effective dials, straight from the board's own resolver
/admin                 the dials themselves, plus a refresh button
```

```bash
npm run rotation -- --probe                      # live price-source smoke test, opens no database
npm run rotation -- --refresh [--dry] [--ticker SYMBOL]
npm run rotation -- --board [--indicator ID]     # score everything from stored bars, no network
npm run rotation -- --note [--write]             # the written note for the current state
npm run rotation -- --coverage                   # what is stored, no network
```

---

## How to add an indicator

The engine is a pure function over two price series, so an indicator is **data, not code**. Nothing
below requires touching the calculation, the charts, the scoring or the note writer.

**In code** — append an entry to the relevant array in `lib/rotation/catalog.ts`:

```ts
{
  id: "xlv-xlp",                       // lowercase, digits and hyphens; becomes the URL
  label: "XLV / XLP — health care versus staples",
  category: "sector",                  // breadth | style | sector | credit | geography | volatility
  kind: "ratio",                       // or "context" for a gauge that is reported, never scored
  base: "XLV",                         // numerator
  quote: "XLP",                        // denominator; null only for a context gauge
  risingMeans: "…",                    // sent verbatim to the note writer
  fallingMeans: "…",
  favorsBase: "Favors XLV — health care",     // must NAME the assets, never "up"/"down"
  favorsQuote: "Favors XLP — staples",
  falsification: "Wrong if …",         // required: one line stating how the reading could be wrong
  sectorTicker: null,                  // set to the fund's ticker ONLY for the eleven-sector board
  builtIn: true,
}
```

Then `npm run rotation -- --refresh` to pull the new tickers, and `--board` to check the numbers.

**Without a deploy** — the same shape saved as a JSON array under the `rotation_indicators` key in
`app_settings`. Built-ins load first and a custom entry with the same `id` replaces one. The whole
set is validated together: if any entry is malformed, nothing is saved, and the errors come back as
field paths.

Two rules the validator enforces, because both have silent consequences:

- a `ratio` needs a denominator, a `context` gauge must not have one;
- `id`s must be unique, since the URL and the note cache key both depend on them.

## How to re-trigger a run

There is no scheduler and none is wanted — the research pipeline this app is built around must never
be restarted mid-run, and a background job is the easiest way to do that by accident.

- **On the board**: the Refresh button, visible only to an unlocked operator.
- **Headless**: `npm run rotation -- --refresh`. About 25 seconds for the full catalog.
- **One ticker**: `npm run rotation -- --refresh --ticker XLE`.
- **Dry run**: add `--dry` to fetch and report without storing anything.

A refresh always re-pulls the **full** history rather than appending recent days, because adjusted
closes are revised backwards every time a distribution is paid. Two things it will not do:

- a ticker that cannot be fetched keeps the history it already has, and says so on the page. A failed
  read never replaces a good reading with an empty one.
- if a series comes back on a different **price basis** — the fallback source stepping in, which
  returns closes *not* adjusted for distributions — that ticker's history is replaced wholesale
  rather than merged. Merging would leave one series adjusted in its early years and not in its
  recent ones, with a join no downstream statistic could distinguish from a real move. Any ratio
  whose two legs still disagree is shown, flagged, and barred from raising a signal.

## How to tune the pivot score

Every dial is on `/admin` under **Rotation board**, and the live values are published on
`/methodology#rotation` so the page and the board cannot drift apart. Precedence is
**DB override > environment variable > default**; saving stores only what differs from the default,
so a value typed back to its default stops being an override.

Because only daily closes are stored and everything else is recomputed on read, **a dial change takes
effect on the next page load with no refetch** — including the whole computed history, so the marks
on every chart move with it.

The composite is a weighted mean of four marks out of ten:

| Dial | Default | What it does |
|---|---|---|
| `weightTrend` | 1 | How far the 50-day average sits from the 200-day |
| `weightStretch` | 1 | How far the ratio sits from its own one-year mean, in deviations |
| `weightMomentum` | 1 | How far the ratio's own momentum sits from neutral |
| `weightPercentile` | **0** | How extreme the ratio is against its full three-year range |

At the defaults the composite is the **plain average of the first three**, which is the published
method exactly. The fourth is computed and displayed on every indicator but not scored, because that
method does not score it.

That has a visible consequence worth knowing before you tune anything: **a ratio can sit near a
three-year low and still read as No Signal.** The flagship, RSP/SPY, does exactly that — 22nd
percentile of its three-year range, and a composite of 1.1. All three scored marks are short-horizon
measures; the historical position is the one long-horizon fact on the page and it carries no weight.

Raising `weightPercentile` above zero is the supported way to disagree. `/methodology` reports the
changed weighting alongside the changed scores, so a reader can always see which method produced the
numbers they are looking at.

Other dials worth knowing:

- `trendFullPct` (3%) — the 50/200 separation that earns a full trend mark. A ratio of two broad funds
  moves far less than either fund does alone, so this is a wide gap.
- `directionDeadbandPct` (0.25%) — below this separation the board says *balanced* rather than picking
  a side. Without it a ratio resting on its own trend flips on daily noise, and since a flip is what
  raises a written note, every flip would raise one.
- `minBars` (500 sessions) — below this a series is treated as a broken feed, not as a young fund. A
  short answer from a price source is far more often a fault at their end than a real gap in history.
- `briefModelEnabled` (**off**) — see below.

## The written note

A note is written only when an indicator crosses a tier boundary or flips the side it favours. Never
on a schedule, never per page load, and never once per indicator when several moved on the same
session — they batch into one.

The deterministic writer assembles it from the computed figures at no cost, and is the default. A
model may optionally be allowed to rephrase it (`briefModelEnabled`, or `MAG8_ROT_BRIEF_MODEL=1`);
its model, effort, budget and timeout are all in `CONFIG.rotation` in `lib/config.ts`.

Even switched on, a returned note is re-read and **any figure that cannot be traced back to a
computed input causes the whole note to be discarded** in favour of the deterministic one. So the
worst case of turning the model on is that nothing changes.

Notes are cached on a hash of the state *and* the weighting that produced it: retune a weight and the
board is re-derived, which means a note written under the old weighting describes a state that no
longer exists and will not be served for it.

## Where things live

```
lib/rotation/catalog.ts     the indicators, as data — the only market-specific input
lib/rotation/bars.ts        two independent price sources behind one interface
lib/rotation/math.ts        pure statistics: date-keyed joins, averages, deviations, momentum
lib/rotation/score.ts       pure scoring: the composite, tiers, direction, falsification
lib/rotation/state.ts       pure: what counts as a state change, and the note's cache key
lib/rotation/brief.ts       pure: the deterministic writer, the prompt, and the number guard
lib/rotation/note.ts        wiring the note to the board — the only path that can reach a model
lib/rotation/board.ts       refresh (network) and read (never network)
lib/rotation-settings.ts    the dials
```

`MAG8_ROTATION=0` switches the whole board off: nothing fetches, and the pages report themselves
unavailable rather than rendering an empty board that would look like a market reading.

## Two things worth not re-learning

**Ratios are joined on date, never by position.** The volatility index trades sessions the funds do
not — it printed on 25 May 2026, Memorial Day, when the equity funds were closed. Zipping two arrays
by index would shift one leg against the other from that point backwards, and every average,
deviation and momentum reading computed afterwards would be quietly wrong. `--probe` checks this
against live data on every run.

**The momentum reading is Wilder's smoothing, not a simple average.** The two definitions both circulate
under the name RSI and they give visibly different numbers — 48.1 against 57.5 on the flagship at the
time of writing. This board uses the original.

---

*Not financial advice. This is a research instrument, not a recommendation to buy, sell or hold any
security.*
