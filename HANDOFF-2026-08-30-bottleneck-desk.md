# HANDOFF 2026-08-30 — The Bottleneck Desk (Phases 1–4 of 7)

**Owner ask:** *"i just dropped two documents into the codebase for mag8 'bottleneck research framework', and
'claude code implementation prompts'… i want these built into mag8 as a feature. strategically map it all out,
see where this feature will go best, it should also be its own seperate feature not combined into the current
mag8 stock analysis tool that scans for trillion dollar dna and does game theory."*

Source documents (now committed at repo root): `bottleneck-research-framework.md` (the concept),
`claude-code-implementation-prompts.md` (eight build prompts).
Approved plan: `~/.claude/plans/i-just-dropped-two-logical-rabin.md`.

**Branch `feat/bottleneck-desk`, 4 commits off `bfaff44`. NOTHING PUSHED TO MAIN.**

| | |
|---|---|
| `6cc96d6` | (1) shared EDGAR core |
| `e21708f` | (2) playbooks and knobs |
| `1203331` | (3) demand — capital spending into physical units |
| `e3309f7` | (4) supply and the gap |

---

## 0. What this feature is, in one paragraph

Any growth story implies a physical quantity of *something* — megawatts, gigabytes, square feet, tonnes.
Dollars are elastic; physical quantities are not. The desk reads disclosed capital spending out of SEC
filings, converts it into the physical things that money must buy, and checks each against what the world can
actually produce. It answers one question: **which input is the tightest constraint, and is it getting worse
or better.**

It is a **second product**, not a pipeline stage. Deterministic, $0, no model in the critical path, no draw on
the plan's usage window.

---

## 1. The decisions already made — do not silently re-litigate

Owner answered four questions before any code (2026-08-29):

1. **Placement** — own section in the same Next app. Product-separate, infrastructure-shared.
2. **Name** — **Bottleneck**. Route `/bottleneck`, nav "Bottleneck", tables `bottleneck_*`.
3. **13F posture** — holdings/diff **public**; account-balance sizing **admin-only**.
4. **Testing** — vitest for pure parsers + a live probe script for EDGAR.

### The strategic call that shaped everything

The framework is **Stage-0-shaped, not pipeline-shaped**. Mag8's pipeline is model-driven (26 agents, $8–18,
plan-window bound). This is fetch → parse → arithmetic → compare, exactly the shape of `lib/universe.ts`.
Built that way it costs nothing and can be refreshed all day. **Keep model calls out of the critical path.**
The only sanctioned model use is an optional, tool-less narrative brief, off by default (Phase 8).

This also **inverted the prompts' build order**: Prompt 7 refactors into Playbooks *last*; we built the
Playbook config *first* (Phase 2), so AI-infrastructure is one instance rather than something to dig out later.

### Separation contract — enforce as hard rules

| The desk… | |
|---|---|
| writes to | `edgar_cache`, `bottleneck_*`, `app_settings` keys prefixed `bottleneck_` |
| **never writes to** | `runs`, `candidates`, `lens_analyses`, `rankings`, `progress_events`, `universe_snapshots` |
| **never reads** | lens output, run reports, scores, confluence |
| never affects | the leaderboard, all-time boards, `finalScore`, gate/confluence arithmetic |
| is not | a lens, a stage, a run, or an agent — no `RunParams`, no SSE, no watchdog |

Enforced structurally: none of the five new tables carries a foreign key into a pipeline table (verified).

---

## 2. What shipped

### Phase 1 — `lib/edgar.ts` (519 lines), shared SEC transport

Transport ONLY — knows nothing about 13F or XBRL tag names. One User-Agent, one shared ≤10 req/s promise-chain
queue every caller serializes into, opt-in SQLite caching, explicit error mapping (a 403 says the User-Agent is
wrong, because it always is). Endpoints: `resolveTickerToCik` · `getSubmissions` · `getCompanyConcept` ·
`getCompanyFacts` · `fullTextSearch` · `getFilingIndex` · `fetchFilingDocument`.

`lib/sec.ts` now delegates its transport here with a **byte-identical public API**. Verified, not assumed: the
CIK map (10,391 entries) and a real XBRL frame (5,727 rows) hash identically through old and new paths, and
the Stage-0 screen reproduced its exact fingerprints on cached week 2026-W32 (2,088 eligible, identical
funnel/ranking/digests).

Caching is lazily bound via `setEdgarCacheAdapter` so the Stage-0 path never imports `lib/db.ts` through the
client (importing it runs boot reconciliation, which would mark a live run interrupted).

### Phase 2 — playbooks and knobs

- **`lib/bottleneck/playbook.ts`** — the ONLY sector-specific input. Demand basket + XBRL tag chain,
  versioned/sourced conversion table, supply series, owner map. Built-ins in code; owner-defined playbooks in
  `app_settings` merged over them by id. `usesPlaceholderFactors()` drives a visible warning.
- **`lib/settings-registry.ts`** — the universe screen's resolver, generalised. One precedence rule
  (**DB > env > default**, with provenance) shared by both registries. All 24 universe settings verified
  resolving byte-identically after the migration.
- **`lib/bottleneck-settings.ts`** — 12 knobs, 6 groups, `MAG8_BN_*` env namespace.
- **`components/admin/SettingsGrid.tsx`** — extracted from the Stage-0 panel (272 → 170 lines); both panels
  render identical provenance badges because there is one grid.

### Phase 3 — `lib/bottleneck/demand.ts` + `xbrl.ts` (Module B)

Reads capital spending for the basket, normalizes to comparable quarters, converts to physical units, extracts
the filer's own explanation, persists a dated snapshot. **Three ways to be confidently wrong were found running
against live SEC — none raised an error.** See §3.

### Phase 4 — `supply.ts` + `score.ts` + `desk.ts` (Module C)

One `SupplyDataSource` interface, four connectors (`fred`, `filing-search`, `manual`, `stub`), all observations
in one table so the scoring layer never learns where a number came from. `score.ts` is **pure** — hand it
stored observations and it produces the ranking, which is what makes the verdict testable.

**Current live reading:**

```
TIGHTENING   MW of critical IT load      demand +85.7%  supply  +3.8%   gap +81.9pp   VST CEG NRG TLN PCG
TIGHTENING   GB of memory/storage        demand +85.7%  supply +17.0%   gap +68.7pp   MU SNDK WDC INTC
NOT MEASURED sq ft of data-center shell
NOT MEASURED MW of gas-turbine capacity
```

Demand $573.72B TTM across MSFT/AMZN/GOOGL/META/ORCL/NVDA, +85.7% YoY, 6 of 6 contributing.
2,026 supply observations stored back to 1967.

---

## 3. Bugs found against live data — all pinned by tests

Every one produced a plausible-looking wrong number rather than an error. **Do not "simplify" these away.**

1. **Cumulative filings.** Capex is a duration concept and most filers report it fiscal-year-to-date. Apple
   FY2026 reads 2.373 / 4.344 / 6.799 — three, six, nine months. Taking "the latest 10-Q value" as a quarter
   reports **$6.799B where the quarter was $2.455B**, a 2.8× error that a playbook then multiplies into every
   physical unit. `quarterlySeries()` differences facts sharing a fiscal-year start and passes discrete filers
   through untouched. *Decisive test: quarters sum to the filed fiscal year.*

2. **Tag drift.** The chain must NOT take the first populated tag. AMZN reported under
   `PaymentsToAcquirePropertyPlantAndEquipment` until 2017 and `PaymentsToAcquireProductiveAssets` after; NVDA
   switched in 2020. Both leave the old tag populated with a decade of history, so first-match read **Amazon's
   2017 capex ($1.86B) against an actual $54.21B**. `chooseFreshestTag()` evaluates every tag, freshest wins,
   chain order breaks ties, migration is disclosed.

3. **Double-counted quarters.** Filers tag the same quarter twice — directly, and inside the year-to-date run
   that gets differenced. AMZN 2026-06-30 appears both ways at $54.21B. Keeping both inflated every TTM:
   **MSFT read $127.43B; after `dedupeByEnd` it reads $115.95B — exactly its filed fiscal year.**

4. **Namespace-prefixed 13F tables** (found by the Phase 1 probe on its first run). The *same filer* ships both
   `<infoTable>` and `<ns1:infoTable>` depending on filing agent. A prefix-blind parser returns **zero holdings
   silently**. Both shapes are frozen as fixtures — this matters for Phase 5.

5. **Trend compared against itself.** A refresh writes its own snapshot before the comparison loads "the
   latest" one, so every constraint read as unchanged. `priorReading()` now defines a prior reading as one
   built on *different demand data*.

### One correction to my own work

I diagnosed FRED as unreachable from Node (connection resets across every TLS/ALPN combination while curl
fetched it in 0.66s) and built a **curl fallback** on that reading. **The diagnosis was wrong** — FRED hangs on
a spoofed `Mozilla/5.0` and on undici's default agent, and answers an honest UA in 269ms. The fallback and its
child-process surface were removed. If FRED ever looks dead again, check the User-Agent first.

---

## 4. Corrections to `claude-code-implementation-prompts.md`

The prompts are wrong in five places. Verified against live SEC 2026-08-29.

| Prompt says | Reality |
|---|---|
| `filings.recent.periodOfReport` | **No such field.** It is `reportDate`. |
| info table is `information_table.xml` / `infotable.xml` | Real names vary: `form13fInfoTable.xml`, `SALP13FinfotableQ3.xml`. **Read `index.json`, pattern-match.** |
| "fall back to the primary document" | Trap. `primaryDocument` on a 13F is `xslForm13F_X02/primary_doc.xml`, an XSL viewer path for the cover page — never the holdings. |
| `PUT` / `CALL` | Title case `Put` / `Call`, and the element is **absent** on plain stock, not blank. |
| FIGI column may be present | Not in the 2026 filing probed → CUSIP resolution is required, not optional. |

**Also:** the framework doc claims the reference fund runs "a very large options overlay (multi-billion-dollar
notional)". The actual Q2 2026 filing is **23 long positions at $20.169B and 3 options rows at $73.26M** —
0.36% of the book. (An earlier quarter, 2025-Q3, has 9 option rows of 28.) **Do not encode the document's
characterisation anywhere.** The parser reports what the filing says.

---

## 5. Frozen fixtures (tests/fixtures/)

```
13f-situational-awareness-2026Q2.xml   CIK 2045724 · acc 0000935836-26-000418 · period 2026-06-30 · filed 2026-08-14
                                       26 rows -> 23 long ($20,169,035,068) + 3 options ($73,257,160)
                                       SNDK 28.13% · MU 27.64% · BE 9.41% · TSM 6.27% · NBIS 6.11%
                                       implied $/sh: APLD $30.49 · BE $302.70 · MU $1,154.29  (DOLLARS, not thousands)
13f-namespaced-2025Q3.xml              same filer, ns1:-prefixed, 28 rows, 9 option rows
13f-filing-index.json                  the index.json proving filenames must be pattern-matched
submissions-2045724.json               columnar envelope; proves reportDate
companyconcept-aapl-capex.json         105 USD facts; the cumulative-vs-quarterly trap
```

---

## 6. Gates — run all of these every phase

```bash
npx tsc --noEmit                          # clean
npm run test                              # vitest, 120 tests, offline
npm run seed                              # MUST stay EXACT:
                                          #   ASTS 90.3 · RKLB 73.9 · TMDX 69.5 · SYM 51.5
                                          #   IONQ 47.9 · CRSP 46.7 · OKLO 42.7 · ACHR 19.3 #8
npm run gen:bib                           # 4x "unchanged" (no-op)
npm run build                             # clean
npm run bottleneck -- --probe             # live EDGAR smoke, all PASS, exit 0
npm run bottleneck -- --refresh [--dry] [--reuse-demand]
```

**Leak grep** (mandatory for any public-surface change) over `/`, `/rankings`, `/methodology`, `/lab`,
`/bottleneck`, `/stocks/ASTS`:

```
grep -riE "stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b"
```
→ **expect exactly 2 hits, both on the homepage** ("26 AGENTS PER RUN" / "26 agents") — the owner-approved
exception since 2026-07-09. `/bottleneck` must be **0**.

**Curtain matrix:** with `MAG8_SITE_MODE=launch`, `/bottleneck` 404s and the nav carries no link (verified).
Build and run in the SAME mode.

---

## 7. Environment gotchas hit this session (beyond CLAUDE.md's list)

- **Headless browsers return an empty DOM here.** Chrome *and* Edge, `--dump-dom`, via both Git-Bash and
  PowerShell, with and without a temp profile. The 375px iframe probe could not be run. Responsive checking
  fell back to verifying invariant 6's three structural requirements in the rendered markup (`grid-cols-1`
  base, wrapped chip rows, wide tables inside `overflow-x-auto`). **Pixel measurement is still unverified.**
- **Long heredocs fail** in this shell (`unexpected EOF looking for matching '`) above roughly 150 lines. Use
  the Write/Edit tools for source files; heredocs are fine for short scripts.
- **Windows Python cannot read Git-Bash `/tmp` paths.** Write to a relative path when a Python heredoc will
  read the file.
- **`process.exit()` with open keep-alive sockets** trips a libuv assertion and returns **127 on success**.
  `scripts/bottleneck.ts` sets `process.exitCode` instead — do not "tidy" that back.
- **Stale dev servers**: check ports 3000 *and* 3001 before trusting a 500.
- `npx tsx` scripts cannot use **top-level await** (cjs output) — wrap in `async function main()`.

---

## 8. Next session — start here

### Phase 5 — Module A, the 13F clone (next)

`lib/bottleneck/thirteenf.ts` + `lib/bottleneck/cusip.ts`.

- Manager search by name (`fullTextSearch` with `entityName`) or direct CIK.
- Latest 13F-HR + the prior period; prefer the newest **13F-HR/A** amendment per period.
- Index-driven info-table discovery — **namespace-agnostic parser** (`/<(?:\w+:)?infoTable[\s>]/`), trim
  `titleOfClass` whitespace.
- **The 2023-01-03 dollar-convention branch as a named constant.** Values are in DOLLARS on/after that date,
  THOUSANDS before. Assert both sides against the fixture.
- Long/options split, options kept **visible** (never silently discarded), % of book, New/Increased/Decreased/
  Closed/Unchanged diff, 45-day-lag banner everywhere.
- CUSIP → ticker: **OpenFIGI works keyless** (verified, POST `/v3/mapping` → 200). Foreign CINS fails with
  `exchCode:"US"` (e.g. `G11448100` Bitdeer) → retry without `exchCode`, then fall back to **issuer-name match
  against the weekly universe snapshot** (7,100 US listings already in SQLite). Unresolved rows stay visible
  and flagged. Cache in `bottleneck_cusips`.
- Public: holdings, %, diff. **Admin-gated** (cookie check as in `components/ResumeRunButton.tsx`, re-checked
  server-side): the balance box and suggested shares/$ — labelled a proposal, **never wired to any broker**.
- Wire `npm run bottleneck -- --13f CIK` (currently exits 2 with "Phase 5").
- **Gate:** the frozen fixture reproduces 26 rows / $20.169B / 28.13% top position exactly.

### Phase 6 — Module D, exposure audit

`lib/bottleneck/exposure.ts`. Holdings (CSV paste + manual entry, admin-only, one `app_settings` key — no
accounts, no new table) × the owner map → $ and % per category, sorted; flags for (a) tightest categories with
~0% exposure and (b) concentration above `concentrationPct` (default 20). Overlap/divergence vs a cloned filer.
Informational only — no trade suggestions, no rebalancing.

### Phase 7 — disclosure, evidence base, gates

- `/methodology#bottleneck` rendering **live effective settings** from the resolver (cannot drift).
- New `bottleneck` group in `lib/citations.ts`, each work **verified against the primary source** per that
  file's own rule, stating what it actually found *including the inconvenient parts*. Candidates:
  Frank/Poterba/Shackelford/Shoven 2004 (copycat funds) · Griffin & Xu 2009 (13F skill is limited) ·
  SEC Rule 13f-1 (the 45-day lag is regulation) · **Titman, Wei & Xie 2004 and Cooper, Gulen & Schill 2008 —
  heavy capex and asset growth predict *worse* returns for the spender**, the honest counterweight to a
  demand-driven story · Carvalho & Tahbaz-Salehi 2019 (production networks) · Jacks 2019 (supply responses take
  a decade).
- ⚠️ Adding N works moves the homepage's `{WORKS_CITED} ACADEMIC WORKS CITED` chip (`app/page.tsx:14`) —
  a public-copy change. Confirm the count with the owner.
- Add `/bottleneck*` routes to the permanent leak-probe list. HANDOFF + CLAUDE.md + memory twin.

### Phase 8 — optional, owner re-decides

Playbooks 2–3 (`ev-battery-supply-chain`, `homebuilding`; stubbed connectors acceptable) · no-code Playbook
form on `/admin` · the tool-less narrative brief (off by default) · the "send owners to the Lab" seam (a
button that pre-fills the Lab focus directive with a category's owner tickers — **a button, not a data
dependency**).

---

## 9. Open items the owner should decide

1. **Conversion factors are placeholders.** All four AI-infra factors are seeded order-of-magnitude anchors
   with `source: "Placeholder seed — replace…"`. They do **not** affect the ranking (a growth rate is
   unaffected by the constant you divide by, and the page says so), but "60,392 MW" is arithmetic on a made-up
   $9.5M/MW. **This is research, not code, and it is the highest-value thing left.** Replace with sourced
   benchmarks + as-of dates, bump `conversions.version`, and the placeholder warning disappears on its own.
2. **Two categories are unmeasured** — data-center shell (sqft) and gas-turbine capacity. Census C30
   construction-put-in-place is named as a stub for the former; the turbine backlog has exactly 1 filing-derived
   observation and needs either more filings swept or manual entry.
3. **Pixel-level responsive verification** never ran (headless browsers dead in this environment). Worth a
   manual 375px look on a real browser before launch.
4. **Nothing is pushed.** Railway auto-deploys `main` and a redeploy restarts any live run. Prod also defaults
   to `launch` mode, so `/bottleneck` 404s there until `MAG8_SITE_MODE=full`.

---

## 10. Inventory

New: `lib/edgar.ts` (519) · `lib/settings-registry.ts` (185) · `lib/bottleneck-settings.ts` (303) ·
`lib/bottleneck/{playbook 332, demand 514, score 324, supply 274, xbrl 218, desk 99, format 56}` ·
`app/bottleneck/{page.tsx, actions.ts}` · `components/admin/{SettingsGrid, BottleneckSettingsPanel}.tsx` ·
`scripts/bottleneck.ts` (304) · `vitest.config.ts` · 6 test files (1,204 lines, 120 tests) · 5 fixtures.

Modified: `lib/sec.ts` (delegates transport) · `lib/db.ts` (5 tables, `user_version 4`, accessors) ·
`lib/universe-settings.ts` (onto shared registry) · `app/actions.ts` · `app/admin/page.tsx` ·
`components/admin/UniverseSettingsPanel.tsx` · `components/nav.tsx` · `.env.example` (`MAG8_EDGAR_UA`) ·
`package.json` (vitest, `test`, `bottleneck` scripts).

DB at `user_version 4`: `edgar_cache`, `bottleneck_filings`, `bottleneck_snapshots`, `bottleneck_supply`,
`bottleneck_cusips` — zero foreign keys into pipeline tables.
