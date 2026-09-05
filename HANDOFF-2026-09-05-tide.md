# The Tide — a market-conditions desk

**2026-09-05 · branch `feat/rotation-board` · four commits · NOT PUSHED**

The owner asked for an exhaustive sweep of the bad readings (over-extension, overvaluation, recession
signals) and the good ones (undervaluation, panic selling, easing conditions, boom set-up), aggregated
into one good-against-bad reading with more weight on the more meaningful indicators, whose output is a
recommended exposure to equities versus cash — explicitly including famous practitioner indicators
(Buffett) alongside micro and macro economics.

A fifth deterministic product at `/tide`. $0, keyless, zero plan-window draw, no model in the critical
path, no foreign key into the pipeline. `user_version` 8.

**Owner decisions taken at the plan stage:** auto-only sources with hand-entry for the rest (no
spreadsheet parsers) · sub-scores lead with an exposure band underneath · breadth computed from Mag8's
own universe · named **The Tide** (checked against the leak grep — `tide` matches neither `\bskills?\b`
nor `\bagents?\b`).

---

## The live reading, and why it decided the architecture

| Near-term (cycle, credit, trend) | 45.9 | Long-horizon (valuation, positioning) | 87.3 |
|---|---|---|---|
| Curve 10y–3m | +0.87, normally sloped | Household equity share | 45.8%, near record |
| Sahm rule, real-time | −0.07, not triggered | Corporate equities ÷ GDP | ≈214% |
| Jobless claims, 4wk | 207,250 | Corporate profits ÷ GDP | 13.2%, a record |
| Financial conditions | −0.56, loose | Baa credit spread | 1.57, thin = complacent |
| VIX / VIX3M | contango, calm | Real 10-year rate | 2.42% |

**Suggested exposure 50–60% in equities, posture neutral.**
`60% base +2.9 from the cycle reading −7.5 from the valuation reading = 55.4%`

Averaging those two into one number would have reported something mild and destroyed the only
information in the picture. That is why the desk publishes two figures and never averages them, and why
consumer sentiment sitting at 55.2 — a level normally seen inside recessions — appears as a *third*
disagreement rather than being smoothed away.

---

## Findings — each produced, or would have produced, a confident wrong number

### From probing every source live, before writing anything

1. **A status code validates nothing.** The economic-data host answers a request for a series that does
   not exist with **HTTP 200 and an HTML page**. A connector trusting `res.ok` stores `<!DOCTYPE html>`
   as a series and reports zero observations, silently. Every response is now checked for the shape it
   claims to have.
2. **Reachable is not alive.** `USSLIND`, the Philly Fed US leading index and the obvious free LEI,
   answers a fetch perfectly and **has published nothing since 2020-02-01**. Also dead:
   `USALOLITONOSTSAM` (OECD US CLI, 2024-01), `MVEONWMVBSNNCB` (2017-10), `WRMFSL` (2021-02), `DRTSPM`
   (2014-10). Every series now carries a staleness budget.
3. **Some series are forecasts.** `NROU`'s most recent row is dated **2036-10-01** — a CBO projection —
   and `GDPNOW` is a nowcast of an unfinished quarter. Rows dated after today are dropped at the
   boundary and counted.
4. **The ICE BofA spread series are licence-capped to a rolling ~3 years** (`BAMLH0A0HYM2` returns 796
   rows from 2023-09-05) and `cosd=1900-01-01` does *not* extend them, so a percentile of twenty-year
   history is impossible on them. Moody's **`BAA10Y`** (1986→, unrestricted) is used instead. `SP500` on
   the same host is capped to ten years for the same reason.
5. **`range=max&interval=1d` returns MONTHLY bars.** Asked for the S&P's full daily history, the price
   source silently ignored the interval and returned **169 monthly points**. A base-rate engine would
   have computed "63-session" forward returns that were really 63 *months*. `range=50y&interval=1d`
   returns 12,603 real daily bars from 1976.
6. **`range=80y` and `range=100y` return ZERO points** — not an error, not a shorter series. Clamped in
   `lib/rotation/bars.ts` so no future desk rediscovers it; `period1`/`period2` also returns nothing
   (needs a crumb), so a named span is the only working way to ask for history.
7. **CBOE publishes VIX itself, keyless and complete** (1990→, and VIX3M from 2009), where the
   general-purpose price host serves `^VIX3M` unreliably. That makes it a primary source rather than a
   summary of one.
8. **Wilshire 5000 is gone from the economic-data host** but `^W5000` is live on the price source, so
   the Buffett Indicator survives on a real total-market numerator.

### From reading real output, which no test would have caught

9. **THE BIG ONE — the conditional history was sensitive to a parameter I had set arbitrarily.**
   Same band, same data:

   | episode gap | visits | difference | positive |
   |---|---|---|---|
   | 1 month | 49 | +6.2% | 90% |
   | 3 months | 21 | +7.7% | 95% |
   | 6 months | 11 | +8.0% | **100%** |
   | 12 months | 6 | — | NOT MEASURED |

   A 100% hit rate is what an overfitted result looks like from the inside. Worse, **merging by
   proximity produced nonsense at every setting**: at three months the desk reported a single "visit"
   running 2022-02 → 2025-01, and at twelve a single visit running 2018-03 → 2025-08. Averaging a
   forward return across seven years of scattered months and calling it one observation is not a sample
   size.

   Episode clustering was replaced with **greedy non-overlapping selection** — take the earliest
   qualifying month, skip everything inside its forward window, take the next. Every draw is one month
   with one forward return, and no two share a month of outcome. Result: **19 real draws from 1996 to
   2025 including the losses** (−14.9% from 2007-06, −9.2% from 2022-02), +14.4% conditional against a
   +9.2% plain rate, difference +5.2%, 84% positive. The spacing can only ever be *widened* by the
   operator, never narrowed below the horizon.

   The episode floor moved 8 → 5 for a stated reason rather than to produce output: with independent
   annual windows, thirty years holds at most thirty observations, so a band covering a fifth of history
   can expect about six. A floor that can never be met is not a safeguard.

10. **A sentence true of the arithmetic and false about the market.** With the S&P near a record the
    write-up called *"the index is below its ten-month average"* a favourable reading. The prose was
    selected by **stress**, but on a gauge where high is good a low stress means a **high** reading.
    Prose is now selected by the percentile (`meaningFor`), so it describes the market rather than the
    score.

11. **A staleness budget set from publication FREQUENCY is wrong.** The corporate-equities series sat
    **247 days old against a 250-day budget** — three days from declaring the Federal Reserve's own
    accounts dead — because a quarterly series dated at the quarter *start* and published ten weeks
    after it *ends* is routinely older than its own interval. Budgets are now frequency **plus lag**.

12. **Two catalogued series were read by no gauge**, so they were never fetched and looked catalogued
    while being invisible (`houst`, `drccl` — both became real gauges). A test now enforces it, and
    caught a third (`anfci`, removed).

13. **"Never published here" and "published for years then stopped" were both reading as stale.** Only
    one of them is news, so they are now separate states — the same three-states-not-two rule the
    evidence layer already follows.

---

## Design decisions worth keeping

**One polarity per gauge.** A gauge whose sign depends on circumstances is not a gauge, it is an
argument. Where a variable matters both ways it appears twice: the credit spread's *level* is a slow
warning that risk is priced generously, its *change* is a fast warning that it has stopped being.

This rule cost a reading. The famous form of the best-known recession signal is "the curve un-inverted",
but a steepening curve that was never inverted is a *good* reading, so the same arithmetic carries
opposite meanings depending on where it started. What survives is `curve-recent-inversion` — the deepest
inversion of the trailing two years, unambiguously bad when high, carrying the same content.

**No absolute thresholds anywhere.** "Above twenty is expensive" is an argument; "higher than in ninety
per cent of the past twenty years" is a measurement. Absolute thresholds are where opinions hide, and
they rot quietly as the world moves.

**Everything is monthly, including today's reading.** Most inputs are published monthly or quarterly, so
a daily composite would invent precision between publications. It also means the number on the board is
literally the last point of the chart beneath it — one code path, no drift.

**Nothing derived is stored.** Two tables hold only what a publisher published. Changing a weight
re-derives the whole desk, both composites, the exposure band and the entire conditional history on the
next page load, with zero fetches — which is what makes the weights safe to publish and tune.

**The weights are the argument, and they are the only one.** Everything else is arithmetic over public
numbers. So every weight states its reasoning, cites the work behind it, and is published at its live
effective value on `/methodology`.

---

## Files

`lib/tide/{catalog,feeds,normalize,score,baserates,breadth,desk,report,format}.ts` ·
`lib/tide-settings.ts` (33 knobs, `MAG8_TIDE_*`, kill switch `MAG8_TIDE=0`) ·
`app/tide/{page,actions}.tsx` + `app/tide/[id]/page.tsx` · `components/tide/*` ·
`components/admin/TideSettingsPanel.tsx` · `scripts/tide.ts` · `tests/tide/*` (130 tests) ·
two additive tables in `lib/db.ts`.

**40 gauges** (38 scored, 2 context) over **39 series**. `USREC` is context-only and can never be
scored — recessions are dated long after they begin, so scoring the dating would be reading the answer
off the back of the paper.

```bash
npm run tide -- --probe                       # live source smoke; ALL PASS, exit 0
npm run tide -- --refresh [--dry] [--series ID]
npm run tide -- --board [--baserates]
npm run tide -- --gauge ID | --baserates | --coverage | --report [--write]
```

---

## Citations

New `tide` group, **11 works**, each verified against its primary source this session. Homepage chip
auto-counts **64 → 75 ACADEMIC WORKS CITED** — public copy, flagged. `gen:bib` stays a no-op (a
deterministic desk has no playbook, so the group renders on `/methodology` only).

Three argue against the desk and are **built into the arithmetic rather than footnoted under it**:

- **Goyal & Welch 2008** + **Goyal, Welch & Zafirov 2021** — the standard predictors, valuation ratios
  included, would not have helped an investor time the market. *This is why the long-horizon score is
  capped at a small fraction of the exposure band's movement.*
- **Boudoukh, Richardson & Whitelaw 2008** — long-horizon predictability is largely an artefact of
  overlapping observations, analytically 99% correlated between the one- and two-year horizons under the
  null. *This is why the conditional history counts non-overlapping draws, and why the long-horizon
  score gets no conditional history at all.*

---

## Gates

`tsc` clean · **908 vitest** (was 771) · `npm run seed` EXACT (ASTS 90.3 … ACHR 19.3 #8) · `gen:bib`
no-op · `next build` clean with both routes registered · `--probe` ALL PASS · **leak probe ZERO
architecture hits across 15 surfaces** (9 pages + 6 gauge pages; only the two approved homepage
`26 AGENTS` exceptions, and every response verified >20KB so no recompile shell greps clean falsely) ·
curtain 404s `/tide` and `/tide/<id>` **with a valid admin cookie**, homepage carries no link ·
admin gating verified with a real `ADMIN_TOKEN` on both a locked and an unlocked payload ·
separation contract holds (no pipeline imports, no SQL outside `lib/db.ts`, **0 foreign keys**,
`user_version` 8).

---

## Open

- **CAPE and margin debt are hand-entry only** (owner decision). Shiller's `ie_data.xls` is legacy
  OLE2/BIFF8 and realistically needs a binary spreadsheet parser; FINRA's `margin-statistics.xlsx` is a
  real ZIP, 20 KB, verified live and refreshed 2026-08-14, and would need ~200 lines of zip+XML with no
  new dependency. Both gauges currently report NOT MEASURED with the reason. **There is no entry form
  yet** — the series accept hand-entered rows but nothing in the UI writes them, so today they are
  simply absent. Building either the form or the xlsx reader is the highest-value item left.
- **Breadth keeps 5 years of history where the macro series keep 30**, so the two breadth gauges are
  ranked against a much shorter record. Disclosed on the page and in the knob's own blurb.
- **Breadth is survivorship-biased** — today's largest companies, prices read backwards. The bias runs
  *against* the present reading rather than for it, which is the safer direction, but it is a bias and
  the page says so.
- **The composite's membership changes through history** (breadth only exists for the last five years),
  so a 2005 composite and a 2026 one are not quite the same measurement. Weight redistribution handles
  it arithmetically; it is not yet stated on the page.
- **The valuation family saturates.** Five of six slow gauges read 95–100 because those series have
  *trended* for thirty years rather than oscillating. That is a real property of the data, not a bug,
  but it means the slow composite will sit near 90 for years. Worth an owner decision about whether a
  detrended variant belongs beside it.
- **Never seen at 375px** — headless browsers return an empty DOM in this environment, so the mobile
  check was structural (`grid-cols-1` bases, `flex-wrap` chip rows, `overflow-x-auto` on the one wide
  table) rather than pixel-level.
- **Orphan rows for `anfci`** remain stored after that series was removed from the catalogue. Harmless
  — nothing reads them — and left in place deliberately, on the same rule that says lowering a fetch
  setting must not appear to rewrite stored history.
