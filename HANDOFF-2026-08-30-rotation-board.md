# HANDOFF 2026-08-30 (session 3) — The Rotation Board

**Owner ask:** *"review the documents mag8 rotation indicator spec for context, and mag8 rotation
indicators claude code prompts to code out the next feature of mag8. i want this to be its own
seperate independent feature."*

Source documents, now at `docs/rotation-indicators/`: `mag8-rotation-indicators-spec.md` (the feature
spec, cited below as **S.n**) and `mag8-rotation-indicators-claude-code-prompts.md` (six build
prompts, **P.n**). The approved plan is `docs/rotation-indicators/ARCHITECTURE_PLAN.md`.

**Branch `feat/rotation-board`, cut from `feat/bottleneck-desk`. NOTHING PUSHED.**
It has to branch from there rather than from main: the board reuses `lib/settings-registry.ts` and
`lib/edgar.ts`, both of which are unmerged bottleneck work.

| | |
|---|---|
| `f9c6621` | (1) catalog, dials, two independent price sources |
| `2dedd39` | (2) the engine — pure, history computed not logged |
| `37f8d51` | (3) the board — recomputed from stored bars on read |
| `453236c` | (4) the dashboard and one chart per indicator |
| `d090c7c` | (5) the written note — free by default, unable to invent a figure |
| `70948e2` | (6) disclosure, the evidence base, the operator notes |

**Owner decisions taken (2026-08-30):** deterministic note always on + the spec's model note built
but **default-off** · **recharts**, not the spec's lightweight-charts · manual refresh + headless
script, **no scheduler** · full catalog **A–F**, category G deferred.

---

## 0. What is now true that was not before

A **third product** at `/rotation`, on the same contract the Bottleneck desk established: shares the
database, the design and the curtain, and nothing else. Deterministic, $0, zero draw on the research
plan's window.

```
/rotation                which regime is being favoured — 25 ratios, ranked, filterable
/rotation/<id>           one indicator: chart, score derivation, how it could be wrong
/methodology#rotation    live effective dials from the board's own resolver
/admin                   the dials, plus a refresh button
npm run rotation -- --probe | --refresh [--dry] [--ticker T] | --board [--indicator ID]
                        | --note [--write] | --coverage
```

26 indicators over 31 instruments: breadth (4), style/factor (4), sector (13 — two cross-sector pairs
plus the eleven-sector board), credit (2), geography (2), and the volatility gauge, which is reported
and deliberately never scored.

**Live reading, 2026-08-28:** nothing is in the top tier. The strongest are HYG/IEF at 5.0 (credit
appetite at the 100th percentile of its three-year range, +2.04 deviations) and XLU/SPY at 6.7.
Sector leadership — health care, financials, energy — matches the late-cycle convention at 75%.
Volatility sits in the **3rd percentile** of its own year. The flagship RSP/SPY reads **1.1 / No
Signal** at the **22nd percentile**, which is the calibration finding in §2 below.

---

## 1. Phase 1 — the catalog, the dials, and two price sources

`lib/rotation/catalog.ts` · `lib/rotation-settings.ts` · `lib/rotation/bars.ts` · two tables.

**Built catalog-first, inverting P.1→P.2.** The engine is a pure function over two price series, so
the catalog is data. Adding an indicator is one array entry and no new calculation code — the charts,
score, tiers, state history and note writer all generalise. Custom entries can also live in one
`app_settings` key, validated whole-set-or-nothing.

**22 dials** (`MAG8_ROT_*`) over the shared registry, DB > env > default, plus an env-only kill switch
`MAG8_ROTATION=0`. Adding `["rotation", …]` to the `REGISTRIES` tuple in
`tests/bottleneck/settings.test.ts` inherited the integrity suite; the independence block there now
checks env-var collisions across all three registries rather than one hard-coded pair.

### Three of the spec's Section 6 recommendations did not survive contact

- **The recommended data stack is Python** (`yfinance`, `pandas`, `pandas-datareader`). There is no
  Python here, and the spec concedes the statistics are "a few lines each". No new runtime.
- **The recommended fallback source is dead.** Stooq answers a JavaScript challenge page, not CSV —
  already recorded in CLAUDE.md since 2026-07, re-probed and confirmed. Replaced with
  `api.nasdaq.com/api/quote/<T>/historical`, already proven in the universe screen, genuinely
  independent of the primary, and agreeing with it to the cent on the latest close.
- **The recommended charting library** would have added a dependency, a second charting idiom, and a
  permanent attribution obligation. recharts was already installed.

### ⚠ Adjusted versus raw closes — the trap inside the fallback

The primary returns closes **adjusted** for distributions; the fallback returns **raw** closes. Over
three to five years of dividends those series sit at different levels, so a fallback that silently
stepped in for one leg of a ratio would move that ratio's level with nothing to show for it. Handled
structurally, not by hoping:

- every bar records its `source` and `adjusted` flag;
- a source switch **replaces** a ticker's history rather than merging into it, because a merged
  series would be adjusted in its early years and not in its recent ones, with a join no downstream
  statistic could distinguish from a real move;
- a ratio whose two legs still disagree is shown with its numbers, flagged in the open, and **barred
  from raising a signal**.

### Gate

31/31 tickers, **38,906 closes stored**, 0 failed, 0 thin, 23.5 s, single basis throughout. Every
ticker in S.4 verified live as existing, liquid and deep enough before a line of engine code — the
thinnest is CPER at $20.3M/day, and nothing needed substituting.

---

## 2. Phase 2 — the engine

`lib/rotation/math.ts` · `score.ts` · `state.ts`. Pure: no network, no database, no clock of their own.

### The decision worth recording: state history is computed, not logged

A state is (Tier, Direction), and a state change is the only thing that may raise a written note. The
obvious build is a table appended on each refresh. Instead the whole history is **derived from stored
bars on read**, which buys three things: the marks on a chart cover the full stored history the first
time the board runs rather than accumulating from today; they keep describing the weighting currently
in force rather than the one in force when a row was written; and there is no state table to drift.
`/rotation/rsp-spy` carries **110 marked state changes** across five years as a result.

### ⚠ `^VIX` trades a session the funds do not

Every fund returned exactly 1255 sessions; the volatility index returned 1305 rows with 49 nulls, and
after dropping those carries **1256 dates including 2026-05-25** — Memorial Day, when the equity funds
were closed. Zipping two arrays by index would shift one leg against the other from that point
backwards and silently corrupt every average, deviation and momentum reading after it.

**Ratios join on DATE, never by position.** Pinned by a unit test, and re-checked against live data by
`--probe` on every run.

### Three things S.3 leaves open, now pinned

- *"scaled toward 0 otherwise"* — trend scores in proportion to separation, and keeps only
  `trendUnconfirmedFactor` of that when the 50-day is no longer moving in the direction the gap points.
- The published tiers are whole-number bands, leaving 7.5 and 4.5 unassigned. Every boundary is
  inclusive from below, so no score can fall between two tiers.
- **Direction gets a deadband the method does not have.** A ratio resting on its own trend flips on
  daily noise, and since a flip is what raises a note, every flip would raise one. Below
  `directionDeadbandPct` (0.25%) the board says *balanced*, and a change fires only on a transition
  between two decisive directions — possibly through balanced, which a genuine reversal does.

### ⚠ MY OWN NUMBER, CORRECTED

The plan recorded the flagship's momentum reading as **57.5**. That came from a planning probe using a
**simple** 14-period average. RSI means **Wilder's smoothing**, which is what shipped and which reads
**48.1**, so the flagship scores **1.1, not 1.3**. Cross-checked against a second independent
implementation agreeing to four decimals across Wilder's own worked series; the ~0.07 divergence from
commonly published tables in the first few readings, converging afterwards, is the signature of those
tables rounding the seed average before smoothing. `docs/rotation-indicators/ARCHITECTURE_PLAN.md` is
corrected in place rather than left carrying the wrong figure.

### ⚠ CALIBRATION FINDING — reported, not silently fixed

Applied literally, S.3 scores the flagship **1.1 / No Signal** while the ratio sits at the **22nd
percentile of its three-year range**. All three scored components are short-horizon; `percentile` is
computed, displayed, and never enters the score. So the headline number ignores the most striking fact
about the indicator. Same shape as the "sub-50 ceiling is calibration, not arithmetic" finding of
2026-07-12.

**Resolution:** ship the published arithmetic exactly, and add a fourth component whose weight
**defaults to 0**. v1 is byte-identical to the document; the lever is a dial on `/admin`, and
`/methodology` prints a different paragraph the moment the weighting stops being the published one.

---

## 3. Phase 3 — the board

`readBoard()` is a pure function of (stored bars, dials): 25 ratios ranked, the eleven-sector
relative-strength table, its business-cycle reading, the volatility gauge, and the state changes on
the newest session. **95 ms, no network, no writes.** So retuning a weight changes every score, tier,
direction and chart mark on the next page load without refetching anything.

Two rankings put the unmeasured **last** — an indicator that could not be scored, and a sector with no
reading. Neither may look like a quiet one.

The business-cycle mapping is labelled a convention from practitioner research rather than a law, and
reports its match strength, so a weak match reads as weak.

---

## 4. Phase 4 — the UI

Dashboard, one chart page per indicator, a sortable and filterable table, the sector board, the
volatility strip, and the note. recharts throughout, matching the existing lens-chart house style
(fixed-height wrapper, CSS-var strokes, `isAnimationActive={false}`, custom `.panel-raised` tooltip,
`role="img"` with a narrated label, `return null` when the data cannot support a chart).

**The shaded bands are ranges in TIME, not a channel around the line.** The deviation is measured
against a rolling window, so its boundary moves with the data; drawing a fixed envelope would imply a
constant the statistic does not have. What S.7 describes is *when* the ratio was stretched.

Sorting the table by score ascending must not float the unmeasured indicators to the top as though
they were the quietest on the board, so an unscorable row sinks whichever way the reader sorts.

Gold is used nowhere: a rotation reading is an observation, not a verdict.

---

## 5. Phase 5 — the written note

A note is written only when an indicator crosses a tier boundary or flips the side it favours — never
on a schedule, never per page load, and never once per indicator when several moved on the same
session.

The split that makes that a property of the code rather than a promise: `noteForBoard()` is free and
read-only and is what pages call; `ensureNote()` is the writing half and is reachable only from the
admin refresh. Every import the model path needs sits **inside the switched-off-by-default branch**,
so a page render cannot pull the research engine in.

**`verifyBriefNumbers()` is the part that does not depend on being obeyed.** The prompt forbids
introducing a figure; the guard then re-reads the returned text and discards the whole note if any
numeral cannot be traced back to a computed input, publishing the deterministic one instead. The worst
case of switching the model on is that nothing changes.

### ⚠ A bug in my own guard, caught by its test

Exact string matching was wrong in both directions. `0.28685` is held in binary a hair below itself,
so rounding it to four places gives `0.2868` while any writer working from the decimal writes
`0.2869` — the guard would have thrown away good notes over a representation detail, and would just as
happily have accepted a fabricated figure that collided with a formatting artefact. It now accepts a
numeral within **half a unit of the last place it was written to**, which is what "the same figure,
rendered differently" actually means.

Notes are cached on a hash of the state **and** the weighting that produced it. Verified live: 4
changed indicators, deterministic note written, second run regenerated nothing.

---

## 6. Phase 6 — disclosure and the evidence base

`/methodology#rotation` renders the live effective dials, and prints a *different paragraph* when the
weighting is no longer the published one. `/admin` gains the dials and a refresh button.

Seven works in a new `rotation` citation group, **each verified against its primary source this
session** rather than recalled. Two of them argue against the product and are included for that
reason:

- **Sullivan, Timmermann & White 1999** — a bootstrap pricing in the whole universe of rules a
  researcher could have tried, over a century of daily index data. The best rule survived inside the
  sample and then failed over the following ten years out of sample. A board computing 25 ratios
  across four tiers is exactly that setting, and it now says so on its own page.
- **Daniel & Moskowitz 2016** — momentum crashes cluster in panic states, when volatility is high.
  Which is the argument for the volatility gauge sitting beside the ratios as context.

Wilder 1978 is cited specifically because two definitions circulate under the name RSI and they give
visibly different numbers; this board uses the original, and says so.

**Homepage chip auto-counts 51 → 58 works cited. Public copy — flagged.**

---

## 7. Gates — all green this session

```
npx tsc --noEmit                     clean
npm run test                         375 passing (was 231; +144 across 6 rotation files)
npm run seed                         EXACT: ASTS 90.3 · RKLB 73.9 · TMDX 69.5 · SYM 51.5 ·
                                     IONQ 47.9 · CRSP 46.7 · OKLO 42.7 · ACHR 19.3 #8
npm run gen:bib                      4x unchanged (no-op — the rotation group maps to no playbook)
npm run build                        clean; /rotation + /rotation/[id] registered
npm run rotation -- --probe          ALL CHECKS PASSED
npm run rotation -- --refresh        31/31 tickers, 38,906 closes, 0 failed, 0 thin
npm run rotation -- --board          25 ratios + 1 context + 0 unmeasured, 95ms
```

- **Leak probe** across 13 public surfaces plus a snapshot JSON: **2 hits, both the approved homepage
  "26 AGENTS" exception. Zero on all four rotation surfaces and zero on /methodology.**
- **Curtain matrix** (`MAG8_SITE_MODE=launch`): `/rotation` and `/rotation/<id>` both 404, and the
  launch homepage carries no link to either.
- **Admin gating** with a real `ADMIN_TOKEN`: the locked payload carries neither the controls nor the
  refresh action, a wrong cookie stays locked, and the board still renders publicly.
- **Separation contract**: no imports from pipeline modules, no SQL outside `lib/db.ts`, and the two
  `rotation_*` tables carry no foreign key.
- **Responsive structural check** (headless browsers still return an empty DOM here): every grid
  declares an explicit `grid-cols-1` base, all three tables sit in an `overflow-x-auto` container,
  chip rows carry `flex-wrap`.

---

## 8. Environment notes to add to the pile

- **Git-Bash heredocs are unreliable in this harness.** `cat > file <<'EOF'` failed twice with
  ``unexpected EOF while looking for matching `'`` on content containing nothing unusual. Writing a
  Python script to a file and running it works; so does the Write tool. Multi-line `git commit -F -`
  heredocs *do* work.
- `api.nasdaq.com/api/quote/<T>/historical?assetclass=etf&fromdate=&todate=&limit=` works keylessly
  with a Mozilla UA, returns newest-first `MM/DD/YYYY` dates and `$`-prefixed closes, and carries **no
  index symbols** — `^VIX` therefore has no fallback, which is disclosed rather than hidden.
- Yahoo's chart endpoint takes `range=5y&interval=1d` on the URL `lib/price-sanity.ts` already calls;
  the daily series is `timestamp[]` + `indicators.adjclose[0].adjclose[]`, which nothing in the repo
  parsed before. Its ticker regex rejects a leading caret, so the board has its own validator.
- 31 sequential fetches at a 120–150 ms gap drew no rate-limiting from either host.

---

## 9. Open items

1. **Nothing is pushed.** Branch `feat/rotation-board` off `feat/bottleneck-desk`, itself unmerged.
   Railway auto-deploys `main` and a redeploy restarts any live run.
2. **The chart has not been seen rendering in a browser.** recharts' `ResponsiveContainer` measures
   client-side, so SSR HTML carries the container and not the SVG — expected, and the same for the
   existing lens charts. The data reaching the client was verified instead (1255 points, 110 markers,
   final value matching to the digit), plus the structural check. Headless Chrome and Edge both return
   an empty DOM in this environment, so this needs a real browser: **worth one look before shipping.**
3. **The model note has never actually run.** It is off by default and the owner spends nothing on
   API, so only the deterministic path has executed end to end. The guard, the prompt and the cache
   are unit-tested; the SDK call itself is not exercised. Turning `briefModelEnabled` on for one
   refresh would close that.
4. **The calibration lever is untouched.** `weightPercentile` ships at 0, reproducing the published
   method. Whether the flagship *should* read No Signal at the 22nd percentile of its range is an
   owner call, and the dial is on `/admin`.
5. **Category G is deferred**, as S.4 itself instructs — the Mag8-native basket (an equal-weighted
   current Mag 7, or the live discovery shortlist, against SPY) is the one proprietary indicator and
   wants the public-ETF board stable first. So is the RRG quadrant chart (S.7: "don't build this
   first").
6. **Deliberately not built:** a scheduler, alerts, and the optional `rotation-check` companion.

---

## 10. Inventory added this session

**New:**
```
lib/rotation/{catalog,bars,math,score,state,brief,note,board,format}.ts
lib/rotation-settings.ts
app/rotation/{page.tsx,actions.ts}  ·  app/rotation/[id]/page.tsx
components/rotation/{RotationChart,RotationTable,RotationControls}.tsx
components/admin/RotationSettingsPanel.tsx
scripts/rotation.ts
tests/rotation/{catalog,bars,math,score,state,brief}.test.ts
docs/rotation-indicators/{README.md,ARCHITECTURE_PLAN.md,+ the two source docs}
```

**Modified:** `lib/db.ts` (two tables, accessors, `user_version = 5`) · `lib/citations.ts` (the
`rotation` group, key union) · `lib/config.ts` (`CONFIG.rotation`) · `app/methodology/page.tsx`
(`RotationSection`) · `app/admin/page.tsx` · `components/nav.tsx` · `package.json` ·
`tests/bottleneck/settings.test.ts` (third registry).

**Schema:** `user_version` 4 → 5. Two additive tables, no column patched, nothing touching a pipeline
table.
