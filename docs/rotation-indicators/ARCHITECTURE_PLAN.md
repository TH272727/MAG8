# The Rotation Board — a third, independent research product inside Mag8

## Context

Two documents were dropped into the repo root: `mag8-rotation-indicators-spec.md` (the feature
spec) and `mag8-rotation-indicators-claude-code-prompts.md` (six build prompts). They describe a
set of deterministic ratio indicators — RSP/SPY, IWM/SPY, XLY/XLP, HYG/IEF and ~15 more — that
flag when the market is favouring one regime over another (mega-cap vs broad, growth vs value,
risk-on vs risk-off), each rendered as its own labelled chart with a 1–10 Pivot Score, a Tier, and
a plain-English Direction naming the actual tickers.

The spec's own priority order is the thing to build to:

> 1. Every number comes from real fetched market data — never invented by an LLM.
> 2. Every score, tier and signal is computed by ordinary code.
> 3. The Claude API is called exactly once per detected state change — never on a schedule, never
>    per page-load.

The ask was for **"its own separate independent feature."** Mag8 has done this once and it worked:
the Bottleneck Desk (`/bottleneck`, `lib/bottleneck/`, `bottleneck_*` tables) is a second product
sharing infrastructure and nothing else. This is the third, built to the same contract.

**Owner decisions taken (2026-08-30):** deterministic template brief always on + the spec's model
brief built but **default-off** and admin-triggered · **recharts**, not lightweight-charts · manual
Refresh + headless script, **no scheduler** · full catalog **A–F**, category G deferred.

*(Section numbers cite the spec as **S.n** and the prompts doc as **P.n**.)*

---

## The strategic call: this is Stage-0-shaped, not pipeline-shaped

The observation that made the Bottleneck Desk cheap, and it applies even more cleanly here. Mag8's
pipeline is model-driven (26 agent sessions, $8–18 notional, capped by a 5-hour plan window). This
feature is `fetch → align → arithmetic → compare` — the exact shape of `lib/universe.ts` Stage 0.

> **The Rotation Board costs $0, spends zero plan window, and can be refreshed all day.**

The spec already agrees: S.8 non-negotiable #1 forbids an LLM anywhere in the data-fetch,
calculation, scoring or state-detection path. The only place a model appears is S.5, writing prose
about an already-computed fact — and even there it is opt-in.

**Two deliberate inversions of the prompts' build order.**

1. **Catalog as config, first.** P.1 builds RSP/SPY alone and P.2 then adds the rest. But the
   engine is a pure function over two price series — the catalog is *data*, not code. Building the
   config registry first (the Playbook lesson from the Bottleneck build, where deferring it to
   Prompt 7 would have wasted a whole pass) makes "add an indicator" one array entry forever.

2. **Store bars, compute on read.** `screenUniverse()` is a pure `fn(snapshot, settings)` computed
   on READ, so tuning a knob applies without refetching. The same trick pays here: persist daily
   bars per ticker, and compute every ratio, average, z-score, tier and direction on read. S.3
   requires the score weights be "configurable, not hardcoded" — with compute-on-read the owner
   retunes weights in `/admin` and every chart updates on the next page load, with no network.

**The consequence that matters most:** because state is a pure function of bars, the *entire state
history* is computable. So S.7's historical state-change markers work on five years of data from
the first refresh, rather than only accumulating from the day the feature ships — and they stay
correct when the weights are retuned. **No persisted state log is needed, and none is built.**

---

## Separation contract

Enforce as hard rules; this is what "its own feature" means in practice.

| The Rotation Board… | |
|---|---|
| writes to | `rotation_bars`, `rotation_briefs`, `app_settings` keys prefixed `rotation_` |
| **never writes to** | `runs`, `candidates`, `lens_analyses`, `rankings`, `progress_events`, `universe_snapshots`, `bottleneck_*` |
| **never reads** | lens output, run reports, scores, confluence |
| never affects | the leaderboard, all-time boards, `finalScore`, gate/confluence arithmetic |
| is not | a lens, a stage, a run, or an agent — no `RunParams`, no SSE, no watchdog |
| shares | nav, layout, design tokens, `lib/auth.ts`, the launch curtain, the SQLite handle, `describeFetchError()`, `createSettingsRegistry()`, Railway deploy |

Zero foreign keys into pipeline tables, structurally enforced — same as the desk. A grep gate in
verification asserts `lib/rotation/**` never imports a pipeline accessor.

---

## Ground truth — verified live, 2026-08-30

Probed **before** planning, because three of the spec's S.6 recommendations do not survive contact
with this repo and this machine. Each would have cost a debugging session.

### 1. The recommended data stack is Python; Mag8 is TypeScript

S.6 recommends `yfinance` + `pandas`/`pandas-ta` + `pandas-datareader`. There is no Python here.
SMA, z-score, percentile and RSI are a few lines each in TypeScript — the spec concedes as much.
**No Python, no new runtime, no new charting dependency.**

### 2. The recommended fallback source is dead

S.6 names Stooq the "genuinely independent pipeline… worth having as a real second source."
CLAUDE.md already records it dead since 2026-07. Re-probed today:

```
GET https://stooq.com/q/d/l/?s=rsp.us&i=d   → 200, 796 bytes, a JavaScript challenge page, not CSV
```

**Replacement found and verified: `api.nasdaq.com`** — already proven in `lib/universe.ts` and
genuinely independent of Yahoo:

```
GET https://api.nasdaq.com/api/quote/RSP/historical?assetclass=etf&fromdate=…&todate=…
→ 200, 81 KB, 3.4 s, 752 trading days, close 220.69 — matches Yahoo's 220.69 exactly
```

⚠️ **Nasdaq returns raw close; Yahoo returns adjusted close.** Over 3–5 years of dividends these
diverge, so a fallback that silently swapped sources would shift a ratio's level — the exact
silent-wrong-number class this project has been bitten by six times. Handled below under *Mixed
price basis*.

### 3. Primary source is healthy — the full catalog is verified

Yahoo v8 chart, keyless, `Mozilla/5.0` UA — the endpoint `lib/price-sanity.ts:38` already calls,
which takes `range` and `interval` as query params:

```
GET .../v8/finance/chart/RSP?range=5y&interval=1d
→ 200, 139 KB, 278 ms, 1255 rows, 0 nulls, adjclose present
```

All **31 catalog tickers fetched, 0 failures**, 1255 rows each, every inception ≥ 2018 so all clear
the 3-year requirement. Thinnest by 3-month average dollar volume: CPER $20.3M/day, QQQE $24.2M/day,
SPHB $48.1M/day — ample for a signal (nothing is traded). **S.4's "verify every ticker exists, is
liquid, and has adequate history" is done, and no ticker needs substituting.**

### 4. `^VIX` is on a different trading calendar — positional zip is a real bug

The one genuine trap. Every ETF returned exactly 1255 rows; `^VIX` returned **1305 rows with 49
nulls**, and after dropping nulls carries **1256 dates including 2026-05-25** — Memorial Day, when
US equities were closed. Zipping two series by array index would shift the entire history by one
day from that point backward and silently corrupt every downstream statistic.

> **Ratios join on DATE, never by position**, and compute only on dates where both legs have a
> value. Pinned by a unit test.

Also: `^VIX` fails the ticker regex at `price-sanity.ts:36` (`^[A-Za-z]…` rejects a leading caret),
and `api.nasdaq.com` has no index endpoint — so VIX has **no fallback source**, which is fine and
gets disclosed rather than hidden.

### 5. The flagship indicator, computed end to end (what P.1 asks to see)

Live, joined on date, 1255 trading days 2021-08-30 → 2026-08-28:

| | |
|---|---|
| Ratio RSP/SPY today | **0.28685** (5y ago 0.34033) |
| SMA50 / SMA200 | 0.28680 / 0.28535 — separation **0.51%** |
| z-score (252d) | +0.351 |
| percentile (3y) | **22** |
| RSI(14) of the ratio | 48.1 *(corrected: see note)* |
| ROC 1mo / 3mo / 6mo | −1.22% / +4.05% / −3.72% |
| components | trend 1.7 · stretch 1.2 · momentum 0.4 |
| **Pivot Score** | **1.1** → Tier **No Signal** |
| Direction | Favors RSP / broad equal-weight |

Down 15.7% over five years — the spec's premise of sustained mega-cap dominance (S.2) holds.

> **Corrected after implementation.** The momentum figure above was 57.5 when this plan was
> written, from a planning probe that used a *simple* 14-period average. RSI means Wilder's
> smoothing, which is what shipped, and which reads 48.1 — cross-checked against a second
> independent implementation agreeing to four decimals on Wilder's own worked series. The score
> is therefore 1.1 rather than 1.3. Still No Signal, still the 22nd percentile.

⚠️ **Calibration observation, reported not silently "fixed."** Applied literally, the S.3 formula
scores the flagship **1.3 / No Signal** while the ratio sits at the **22nd percentile of its 3-year
range**. All three scored components are *short-horizon*; `percentile` is computed, displayed, and
then never enters the score — so the headline number ignores the most striking fact about the
indicator. This mirrors the "sub-50 ceiling is calibration, not arithmetic" finding of 2026-07-12.
**Resolution: ship the spec's arithmetic exactly, and add a fourth component `weightPercentile`
whose default is 0.** v1 is byte-identical to the spec; the lever is a knob on `/admin`, reachable
without a code change, and `/methodology` shows its live value.

---

## Architecture

### Files

```
lib/rotation/
  catalog.ts   zod schemas + the A–F catalog as DATA (built-ins in code, custom in app_settings)
  bars.ts      price-bar sources: yahoo (primary) | nasdaq (fallback); queue, retry, sanity gate
  math.ts      PURE primitives: alignOnDate · ratioSeries · sma · rollingZ · percentileRank
               · wilderRsi · roc — all O(n) rolling, no domain knowledge
  score.ts     PURE: scoreIndicator() → IndicatorState; tier, direction+deadband, falsification
  state.ts     PURE: stateHistory() over bars · detectChanges(prev,next) · stateHash()
  brief.ts     templateBrief() ($0, always on) · modelBrief() (default OFF) · verifyBriefNumbers()
  board.ts     orchestration: refreshBars() · readBoard() (compute-on-read) · sectorBoard()
  format.ts    shared presentation helpers
lib/rotation-settings.ts        22 knobs over the shared registry, env MAG8_ROT_*
app/rotation/page.tsx           dashboard · VIX strip · sector board · current brief
app/rotation/[id]/page.tsx      one indicator: full chart + falsification + disclaimer
app/rotation/actions.ts         "use server" — refresh, generate brief (both admin)
components/rotation/            RotationChart · RotationTable · RotationControls
components/admin/RotationSettingsPanel.tsx    reuses SettingsGrid + toPanelSettings
scripts/rotation.ts             --probe · --refresh · --board · --indicator ID
tests/rotation/                 math · score · state · catalog · bars · brief
docs/rotation-indicators/       the two source docs (moved from root) + ARCHITECTURE_PLAN + README
```

Reuse, don't rebuild: `describeFetchError()` from `lib/edgar.ts:198` (host-agnostic, unwraps
undici's `cause`), `createSettingsRegistry()` from `lib/settings-registry.ts`, `SettingsGrid` +
`toPanelSettings` from the admin panels, `tokenMatches`/`ADMIN_COOKIE` from `lib/auth.ts`,
`launchMode()` from `lib/config.ts`, `sanitizeMarkdown()` from `lib/public-view.ts`.

### Database — `migrate()` step `v < 5`

Two tables appended to `SCHEMA_SQL` behind their own banner comment, following the
`bottleneck_supply` shape (composite natural PK, upsert, `CHECK` enums, ISO timestamps). No
column is added to an existing table, so `migrate()` only records the version:
`if (v < 5) { db.pragma("user_version = 5"); }`.

```sql
CREATE TABLE IF NOT EXISTS rotation_bars (
  ticker TEXT NOT NULL, date TEXT NOT NULL, close REAL NOT NULL,
  adjusted INTEGER NOT NULL,                       -- 1 = dividend-adjusted, 0 = raw close
  source TEXT NOT NULL CHECK (source IN ('yahoo','nasdaq')),
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_rot_bars ON rotation_bars (ticker, date DESC);

CREATE TABLE IF NOT EXISTS rotation_briefs (
  state_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  origin TEXT NOT NULL CHECK (origin IN ('template','model')),
  as_of TEXT NOT NULL, changed_json TEXT NOT NULL, body TEXT NOT NULL
);
```

Accessors in `lib/db.ts` follow the house `Raw*` → `to*()` → exported-fn triple: `saveBars`,
`getBars(ticker, limit)`, `barCoverage()`, `getBrief(hash)`, `saveBrief`, `latestBrief()`.
~31 tickers × 1255 rows ≈ 39k rows, a few MB against a 75 MB database.

### The scoring formulas, pinned

S.3 leaves three things undefined. Written down here so the numbers are reproducible and
`/methodology` can state them:

```
sep        = |SMA50 − SMA200| / SMA200
confirmed  = sign(SMA50 − SMA200) === sign(SMA50_today − SMA50_20d_ago)
trend      = min(10, sep / trendFullPct × 10) × (confirmed ? 1 : trendUnconfirmedFactor)
stretch    = min(10, |z| × zScale)
momentum   = min(10, |RSI − 50| / rsiDivisor)
percentile = min(10, |pct − 50| / 5)                      -- weight defaults to 0
score      = round(Σ(wᵢ · componentᵢ) / Σwᵢ, 1)
```

Defaults `trendFullPct 3% · trendUnconfirmedFactor 0.5 · zScale 3.3 · rsiDivisor 5 · wT=wS=wM=1 ·
wP=0` reproduce the spec's plain average exactly. Tiers are `>=` thresholds (`8` Strong Pivot
Signal, `5` Building, `3` Neutral/Rangebound, else No Signal) — the spec's table has gaps at 7.5
and below 1, which `>=` closes.

**Direction gets a deadband the spec omits.** Direction is `sign(SMA50 − SMA200)`, but a
dead-flat ratio would flip on noise and — since a Direction flip is a state change, and a state
change is the *only* AI trigger — spam briefs. So direction is three-valued internally:
`|sep| < directionDeadbandPct` (default 0.25%) → `balanced`, and a state change only fires on a
transition between `favors-a` and `favors-b`. Public copy still reads "Favors: RSP / broad
equal-weight", naming real tickers per S.3.

**Falsification** (S.3, S.8 #4): each catalog entry carries a qualitative one-liner, and `score.ts`
computes the concrete level — the ratio value at which the direction would flip — so the note reads
"this reading is wrong if the ratio closes below 0.28535 and holds."

**VIX is not scored.** S.4-F calls it "regime context, not its own pivot signal", so the catalog
tags it `kind: "context"` and it renders as a strip (level, 1-year percentile, trend) with no
score and no tier.

**The 11-sector board** is 11 ordinary `XLx/SPY` catalog entries (so each gets its own chart) plus
a derived ranked view mapping current leadership to the classic early/mid/late/recession model.
That mapping is a labelled *heuristic* with a citation, not a claim, and says so — sector
composition drifts (today's XLK is not 1998's).

### Mixed price basis — the rule that prevents the next silent wrong number

Every bar records its `source` and `adjusted` flag. **A ratio is scored only when both legs share
the same basis.** If the fallback fires for one leg only, the indicator renders its chart, shows
its numbers, is flagged `degraded — mixed price basis` in the open, **and is excluded from
state-change detection** so an artefact can never trigger a brief. Same family as "a missing
company is flagged, never a zero" and "unmeasured ranks LAST".

### Settings — `lib/rotation-settings.ts`, env `MAG8_ROT_*`

22 knobs in five groups over `createSettingsRegistry({ spec, storageKey: "rotation_settings" })`,
DB > env > default with provenance, rendered on `/admin` and live on `/methodology`:

- **data** — `historyYears 5` · `minBars 500` · `barsStaleDays 4` · `fallbackEnabled true`
- **scoring** — `trendFullPct 3` · `trendUnconfirmedFactor 50%` · `zScale 3.3` · `rsiDivisor 5` ·
  `weightTrend/Stretch/Momentum 1` · **`weightPercentile 0`** · `zWindowDays 252` ·
  `percentileWindowDays 756`
- **signals** — `directionDeadbandPct 0.25` · `strongTierMin 8` · `buildingTierMin 5` ·
  `neutralTierMin 3`
- **brief** — **`briefModelEnabled false`** · `briefMaxIndicators 12`
- **ops** — `fetchTimeoutMs 20000` · `fetchGapMs 150`

Plus an env-only supreme kill switch `MAG8_ROTATION=0`, mirroring `MAG8_UNIVERSE=0` /
`MAG8_PRICE_CHECK=0`. Adding `["rotation", ROTATION_SETTINGS_SPEC, ROTATION_SETTING_GROUPS]` to the
`REGISTRIES` tuple in `tests/bottleneck/settings.test.ts:12` inherits ~13 integrity assertions free.

### The AI layer — $0 by default, model opt-in, and unable to invent a number

Both halves, per the owner decision:

- **`templateBrief()`** — pure, deterministic, always on. Writes the Rotation Brief from the
  computed state changes. $0, no network, cannot hallucinate, and the page is never empty.
- **`modelBrief()`** — the spec's S.5 layer. Fires **only** when `briefModelEnabled` is on, an
  admin triggers a refresh, **and** the change detector returns a non-empty diff. One batched call
  for *all* changed indicators (never N calls), routed through `lib/orchestrator/agent.ts` — the
  only `query()` caller — tool-less, on the subscription path, with `strictMcpConfig: true` +
  `disallowedTools` per invariant 3. Result cached in `rotation_briefs` keyed on the state hash, so
  an unchanged state never regenerates. Model name lives in `lib/config.ts` as
  `MAG8_ROTATION_MODEL` (default `claude-sonnet-5`) beside the existing three — P.4's "one clearly
  named place".
- **`verifyBriefNumbers()`** — a deterministic guard the spec doesn't ask for and should have. The
  prompt carries only computed numbers and forbids inventing any; then TS re-scans the returned
  text and asserts every numeral traces to an input value or a date. **A brief that fails
  verification is discarded and the template brief is published instead.** Model output also passes
  `sanitizeMarkdown()` (invariant 8) and carries the standard disclaimer.

### UI

`/rotation` — the dashboard (S.7): a sortable/filterable table of every indicator (category, label,
score, tier, direction, days since last state change) linking to each chart, the VIX context strip,
the ranked sector board, and the current Rotation Brief with a "no active signal — last note from
[date]" fallback.

`/rotation/[id]` — the ratio line, SMA50/SMA200 overlays, shaded bands over the date ranges where
the rolling z-score exceeds ±2 (contiguous runs as `ReferenceArea`s — the envelope is rolling, so
this is a band in *time*, which is what S.7 describes), and `ReferenceDot` markers at historical
state changes whose tooltip names the date and what changed.

recharts, matching the `GtCharts.tsx:79-113` house style exactly: `"use client"`, eyebrow +
mono readout header, fixed-height wrapper around `ResponsiveContainer`, CSS-var strokes only,
`isAnimationActive={false}` (headless Edge freezes rAF), a custom `.panel-raised` tooltip,
`role="img"` with a narrated `aria-label`, and `return null` when the data cannot support a chart.
**Gold `--color-confluence` is not used** — a rotation reading is not a final verdict (invariant 6).
Grids get an explicit `grid-cols-1` base, chip rows `flex-wrap`, wide tables `overflow-x-auto`.

`if (launchMode()) notFound();` is the first statement of both pages; `app/rotation/actions.ts`
carries the two-gate model (`publicOpen()` = curtain; `adminAuthorized()` = curtain + token, where
the token does **not** bypass the curtain). One `{!launch && <Link href="/rotation">Rotation</Link>}`
in `components/nav.tsx`. Disclaimer visible on every page in the section (S.7).

---

## Phases — one commit each, each independently shippable

**1 · Catalog, settings, data layer.** `lib/rotation-settings.ts` · `lib/rotation/catalog.ts`
(zod + the full A–F catalog) · `lib/rotation/bars.ts` (Yahoo primary + Nasdaq fallback behind one
connector interface, `globalThis`-anchored ≤150 ms queue modelled on `edgar.ts:55-74`, 2 retries
on 429/5xx, `minBars` sanity gate, own ticker validator allowing `^VIX`) · both tables + accessors
+ `user_version = 5` · move the source docs to `docs/rotation-indicators/`.
*Gate:* every one of the 31 tickers fetched and stored, per-ticker rows/source/span reported, thin
or failed tickers **flagged not dropped** (P.2).

**2 · The pure engine.** `math.ts` · `score.ts` · `state.ts`. *Gate:* RSP/SPY reproduces §5 of this
plan (as corrected), and `tests/rotation/` covers — a strictly rising ratio scores high on trend; the
Memorial-Day calendar case; RSI(14) against Wilder's published worked example; a flat ratio does
not flip direction; `weightPercentile 0` reproduces the spec's plain average.

**3 · Full catalog end to end + CLI.** `board.ts` · `scripts/rotation.ts` (`--probe --refresh
--board --indicator ID`, `process.exitCode` not `process.exit()` because of the Windows keep-alive
libuv assertion) + the package.json entry. *Gate:* the whole board printed grouped by category for
owner sanity-check before any UI exists — exactly what P.2 asks for.

**4 · UI.** Both pages, the three components, the actions, the nav link. *Gate:* curtain 404s,
leak probe, 375px structural check.

**5 · The brief, both halves.** `brief.ts` + `MAG8_ROTATION_MODEL` in `lib/config.ts`. *Gate:* a
state change produces a template brief with zero network and zero spend; the model path stays
inert until the knob is on and an admin triggers it; a brief containing an untraceable number is
rejected in favour of the template.

**6 · Disclosure, evidence, docs.** `/methodology#rotation` rendering live effective settings
(modelled on `BottleneckSection()` at `methodology/page.tsx:167-240`) · a `rotation` citation group
· `docs/rotation-indicators/README.md` (how to add an indicator, how to re-trigger a run, how to
tune the weights — P.5) · handoff doc.

**Citations** — candidates, each to be **verified against the primary source before it ships**, and
dropped if it does not check out: Levy 1967 (relative strength), Wilder 1978 (RSI's origin, since
we apply it), Jegadeesh & Titman 1993 (momentum), Moskowitz & Grinblatt 1999 (industry momentum),
Plyakha/Uppal/Vilkov (equal vs value weighting — the RSP/SPY question), Daniel & Moskowitz 2016
(momentum crashes). And the **inconvenient one**, which this feature needs more than most:
**Sullivan, Timmermann & White 1999**, *Data-Snooping, Technical Trading Rule Performance, and the
Bootstrap* — a board computing 19 ratio signals across 4 tiers is exactly the setting where
spurious winners appear, and the page should say so in plain words. Adding `"rotation"` to the
`CitationGroup["key"]` union auto-updates the homepage chip (51 → 51+N); `gen:bib` ignores groups
with no skill mapping, so it stays a no-op.

---

## Verification

```bash
npx tsc --noEmit                          # clean
npm run test                              # 231 → ~275; tests/rotation/* offline, no DB, no network
npm run seed                              # EXACT: ASTS 90.3 · RKLB 73.9 · … · ACHR 19.3 #8
npm run gen:bib                           # 4x unchanged (no-op)
npm run build                             # /rotation + /rotation/[id] registered
npm run rotation -- --probe               # live Yahoo + Nasdaq smoke, ALL PASS, exit 0
npm run rotation -- --refresh && --board  # 31 tickers stored, full board printed
```

Plus, as gates rather than spot-checks:

- **Leak probe** over `/rotation` and `/rotation/<id>` added to the existing 10-surface list →
  zero architecture hits. Note the grep bans the bare English words too: rotation copy must not
  write "skill" (easy to reach for in technical-analysis prose — "skill vs luck") or "agents".
  Check `wc -c` before trusting a 0, per CLAUDE.md.
- **Curtain matrix**: `MAG8_SITE_MODE=launch` → both routes 404 and the nav carries no link; build
  and run in the same mode.
- **Admin gating** with a real `ADMIN_TOKEN`: the locked RSC payload carries neither the Refresh
  controls nor the model-brief button, and both actions re-check the cookie server-side.
- **Separation grep**: `lib/rotation/**` imports no pipeline accessor, and `rotation_*` tables
  carry no foreign key into pipeline tables.
- **Zero-spend proof**: the whole board refreshes and renders with `briefModelEnabled false` and
  no auth configured at all.

---

## Risks and deliberate scope calls

1. **Yahoo is an unofficial endpoint** and will eventually rate-limit or change shape. Mitigated by
   the Nasdaq fallback, cached bars (a failed refresh keeps the last good board), a visible "data
   as of [date]" staleness flag, and the `MAG8_ROTATION=0` kill switch. A failed refresh must never
   overwrite a good reading — the rule learned the hard way on the desk two commits ago.
2. **Adjusted vs raw close** is the live silent-wrong-number risk; handled by the mixed-basis rule
   above rather than by hoping the sources agree.
3. **Score calibration** — shipped exactly as specified, with `weightPercentile` default 0 as the
   documented lever. Flagged, not silently changed.
4. **Data snooping** — 19 indicators × 4 tiers will always produce something that looks like a
   signal. The evidence base carries the paper that says so, and the UI states it.
5. **The sector→cycle mapping is a heuristic**, labelled as one.
6. **Not built, deliberately:** category G (the Mag8-native Mag7-basket ratio — the spec itself
   sequences it after the public-ETF catalog is stable), the RRG quadrant chart (S.7 "don't build
   this first"), a scheduler, alerts/notifications, and the optional `rotation-check` companion
   skill. Each is a clean follow-on once the board has been live for a while.
