# Mag8 — agent notes, state 2026-08-31. README = user-facing; this file = authoritative. One commit per phase (`git log`).
Four-stage pipeline over `@anthropic-ai/claude-agent-sdk` + live SSE "Mission Control" UI. S0 `lib/universe.ts`
deterministic universe screen ($0, no model; weekly snapshot; NASDAQ+NYSE+AMEX + SEC XBRL fundamentals, every knob
owner-tunable — see universe-settings entry) hands S1 a ~300-name screened pool (top-100 fundamentals-RANKED head
w/ filings digests + rotation, v3 2026-07-16) AND injects per-ticker SEC ground
truth into S2 prompts → S1 `new-gen-stock` discovers N candidates (4–12, default 8; prompt carries the date, the
pool, recent-coverage anti-repetition, optional focus modifier, optional selection-quota block) → deterministic
selection discipline verifies the cohort (ranked-head floor + consensus ceiling, `lib/orchestrator/selection.ts`,
default-off) → S2 `stock-scanner`/`gt-predictor`/
`institutional-forecast` per candidate, independently (3 candidates in flight, ≤9 sessions) → S3 tool-less compiler
applies the Trillion-Dollar Confluence rubric; deterministic TS re-verifies gate/confluence/score and re-sorts. Lenses agreeing IS the product (+10 bonus when
all three bullish). All stages `claude-sonnet-5` (`MAG8_{DISCOVERY,LENS,COMPILER}_MODEL`); effort high/**medium**/medium
— the 2026-07-06 RKLB A/B killed lens-high (blew the then-$1/call cap; medium: 97s, ~$0.69, 18 sources, first-try
handoff). **Per-call USD caps are now UNCAPPED by default (2026-09-04)** — a cap ENDS the call and bins the
research already paid for, so the guards are timeout/maxTurns/watchdog; `MAG8_{DISCOVERY,LENS,COMPILE}_MAX_USD`
arms one only if positive. Lens effort stays medium for the 5-hour WINDOW, not for a dollar ceiling. WHITE-LABEL: nothing user-visible may name
skills/agents/the AI provider; `/admin` is the ONE exception.

## Map (single-source & non-obvious only — the rest is discoverable)
- `lib/schemas.ts` all zod + `ProgressEvent` + `LENS_META` + `sanitizeModifier()`; `lib/config.ts` every knob, `estimateRun()`, `authMode()`, `siteMode()/launchMode()`
- `lib/db.ts` ALL SQL, globalThis handle, boot reconciliation, `getRecentCoverage()` feeds discovery;
  `migrate()` = latest-shape `SCHEMA_SQL` + version-gated column-checked ALTERs (user_version 2: num_turns);
  `getAllTimeBoard('canonical'|'focused')` all-time boards split on params_json `kindClause` (canonical = no
  modifier AND blind!=1; focused = modifier OR blind — a blind run is never canonical) (per-ticker best score,
  real runs only, mock fallback badged SAMPLE, computed on read); `latestCanonicalRun()` pins `/rankings` + home
  preview to canonical runs (a lab/focused/blind run can never displace the weekly board)
- `lib/ranking.ts` rubric constants + `buildRubricText()` → compiler prompt AND /methodology; `lib/citations.ts` 44-work
  registry (universe group feeds /methodology only, NOT skill bibs → adds are gen:bib no-op; homepage chip auto-counts)
  → /methodology References AND all four skills' `references/bibliography.md` (`npm run gen:bib`) — can't drift
- `lib/universe.ts` S0 v2 (2026-07-13): Nasdaq screener JSON (keyless, Mozilla UA; NASDAQ+NYSE both-or-nothing,
  AMEX additive-fail-open, ≥3000-row sanity) → common-stock/ADR normalize (+exchange/industry/ipoyear) →
  screens IN ORDER: band → day-$vol → price floor → pooled-vehicle regex (probe-validated 11/11 CEFs, 0 false
  pos) → listing-age (blank ipoyear passes) → SEC solvency: runway (cash+STI vs FY burn; Finance-sector exempt —
  BDC/asset-mgr OCF is structurally negative), zombie (rev≤$1M AND ocf<0 AND eqy<0), dilution (default OFF —
  share-count YoY is split/M&A-contaminated: PEGA +97%=2:1 split, AVAV +79%=merger; ALWAYS flags delivered
  picks) → RANKED pool v3 (2026-07-16): `rankEligible()` pure fn — fixed-weight composite (rev growth .35 /
  OCF margin .20 / margin trajectory .15 / share discipline .15 / survivability .15; percentile-in-eligible,
  missing datum = neutral 50; margin factors need rev≥$25M — stub-tag guard, probe caught a $5B driller tagged
  $12M rev) orders eligible; top `rankTopN` lead the discovery prompt w/ one-line filings digests, remainder
  stays week-seeded sector-stratified rotation (SEC absent → pure rotation, rankedCount 0; filings rank buries
  pre-revenue burners BY DESIGN — RKLB #1611/2071 — rotation + scout judgment cover that archetype; Finance OCF
  misread mirrors runway-exempt = future knob). `screenUniverse()` = PURE fn(snapshot, settings) computed on
  READ (tuning applies without refetch; weekly determinism intact). `universeScreenFlags` (band ±slack + price/
  runway/zombie/dilution, cause-neutral public wording) join compiler extraGaps→gapsNoted; `lensGroundTruth` →
  prompts.ts "Platform-verified reference data" block in every lens call (price/cap = scale anchors verify-spot-
  live; SEC figures filing-anchored, cite "per SEC filings"; cache-safe — snapshot frozen per week). Weekly cache
  `universe_snapshots` + `extra_json` (fundamentals; pre-v2 rows read fine, extras null → SEC screens skip);
  fail-open null = unscreened run, mock runs skip S0 entirely; MAG8_UNIVERSE=0 kill (env-only, supreme)
- `lib/universe-settings.ts` ALL 24 S0 knobs (groups listing|size|solvency|pool|**selection**|ops): spec registry
  (default/min/max/env/blurb/cites) + resolver **DB(`app_settings`) > env > default** w/ provenance; defaults
  research-backed (citations registry 'universe' group, 11 works, →44 total — homepage chip auto-updates); legacy
  MAG8_UNIVERSE_* env names kept. /admin panel edits (save = diff-vs-baseline; preview cached ~10ms; refresh
  repersists snapshot); /methodology renders LIVE effective values from the same resolver (can't drift). Defaults:
  $1–50B, ≥$2M/day, price ≥$2, age ≥1yr, CEF+runway(1y)+zombie ON, dilution OFF@50%, pool 300 (rankPool ON,
  rankTopN 100), slack 10%; **selection group (C, 2026-07-26): rankedFloor 0 / salienceCap 12 / selectionHardGate
  OFF — all default-NEUTRAL (a no-op until the owner opts in), env MAG8_SELECT_{RANKED_FLOOR,SALIENCE_CAP,HARD_GATE}**
- `lib/salience.ts` model-memory baseline (200 tickers, cold TOOL-LESS Sonnet session 2026-07-16, ordered by
  salience; refresh ~quarterly or on discovery-model change) + `npm run audit:salience` (raw READ-ONLY live-run
  precheck BEFORE lib/db import — reconciliation would kill a live run; audit tags blind runs): per-pick salience
  rank / eligibility / fund-rank / cap-pct / desks vs random-from-eligible expectation. Baseline finding: 59/70
  real pick-slots (84%) sat inside the model's own famous-names prior vs ~6% random (07-07 run 8/8; coverage-
  blocking just slid picks to tier-2 fame) — the measured bias the ranked pool attacks; re-run after every real
  run. `salienceRank()` also powers the selection-quota consensus ceiling (server-only; never client/public)
- `lib/sec.ts` EDGAR (keyless, $0, identifying UA, MAG8_SEC_UA override): CIK map (covers 2118/2120 eligible) +
  XBRL frames ~15-25 reqs ≈6-9s/wk — annual tags ALSO fetch the prior FY same-tag (rev0/ocf0 → growth/trajectory;
  YoY math never mixes tag variants), tag-drift chains (rev ×2, cash ×2, current securities ×3 MAX-not-sum: STI
  tag alone false-killed biotech runway), dei share-frame = instant-period coverage oracle (just-ended quarter
  sparse until 10-Qs land), same-quarter YoY shares, annual CY(y-1)+CY(y-2) merge. Fail-open per frame AND per
  metric — missing data = PASS (IFRS/foreign filers unscreened, disclosed); coverage ~75-85% of band.
  **Transport now delegates to `lib/edgar.ts`** (2026-08-30) — public API byte-identical, frames pass
  `cache:false` so the S0 path never imports db through the client
- `lib/edgar.ts` SHARED EDGAR transport ONLY (no 13F/XBRL knowledge): MAG8_EDGAR_UA>MAG8_SEC_UA>default,
  ONE global ≤10 req/s promise-chain queue every caller serializes into, opt-in SQLite cache (lazily bound via
  `setEdgarCacheAdapter`), 403="your User-Agent"/404/429-backoff. 7 endpoints: resolveTickerToCik ·
  getSubmissions (**field is `reportDate`, NOT periodOfReport**) · getCompanyConcept · getCompanyFacts ·
  fullTextSearch · getFilingIndex (**exhibit filenames VARY — pattern-match, never guess**) · fetchFilingDocument
- `lib/bottleneck/` THE BOTTLENECK DESK — second product, deterministic, $0, ZERO plan-window draw. FEATURE-
  COMPLETE (phases 1–8). See HANDOFF-2026-08-30-bottleneck-desk.md (1–4) + -phases-5-8.md (5–8).
  `playbook.ts` the ONLY sector-specific input (basket + tag chain + versioned/sourced conversion table +
  supply series + owner map + `demand.measure`; built-ins in code, custom in app_settings) — SEVEN themes
  (2026-09-01): ai-infrastructure, ev-battery-supply-chain, homebuilding, **drone-industrial-base,
  robotics-automation, quantum-computing, nuclear-energy**. The first three carry PLACEHOLDER factors and say
  so; the four new ones are RESEARCHED — every factor read from the primary document named in its own `source`
  (Army FY2026 P-1 exhibit, USGS MCS 2026, BLS OEWS May 2025, A3, EIA/Sargent&Lundy, EIA Uranium Marketing).
  `demand.measure` (default "Capital spending") names what the tag chain READ — not every theme's demand is
  capex: homebuilding capitalizes land into INVENTORY (figures can go negative) and quantum leads its chain
  with `ResearchAndDevelopmentExpense`; it rides the demand SNAPSHOT so a stored reading keeps its label, and
  a pre-field row falls back to the PLAYBOOK's measure (falling back to a hardcoded string mislabelled
  homebuilding — the exact thing the field exists to fix). Series ids are REUSED across themes on purpose
  (one fetch, one history) — a shared id must agree on connector/handle/unit, pinned by test;
  `xbrl.ts` de-cumulation (capex is filed fiscal-YTD — naive "latest 10-Q" = 2.8× error; quarters MUST sum to
  the filed FY) + `conceptFromFacts()` (**companyconcept can return `units:{USD:{}}` where companyfacts has
  158 facts** — Ford; fallback fires ONLY when the whole chain is empty); `demand.ts` Module B (**freshest tag
  wins, NOT first populated** — AMZN/NVDA migrated tags and first-match reads 2017 numbers as current; +2
  fragility flags: <50% of gross surviving netting, and YoY >1000% off a near-zero base); `supply.ts` Module C
  connectors (fred/filing-search/manual/stub, one interface one table); `score.ts` PURE gap scoring (compares
  RATES not levels; `easing` is a first-class verdict; unmeasured ranks LAST); `desk.ts` orchestration +
  `priorReading()`; `lib/bottleneck-settings.ts` 12 knobs via the shared `lib/settings-registry.ts` (same
  DB>env>default resolver as the universe screen)
- `lib/bottleneck/thirteenf.ts` Module A — 13F clone, namespace-agnostic (`<(?:\w+:)?infoTable>`; a
  prefix-blind parser returns ZERO rows silently). `DOLLAR_CONVENTION_FROM='2023-01-03'` branches on FILING
  date (dollars on/after, THOUSANDS before — SEC's own FAQ, now cited); `REPORTING_THRESHOLD_USD` = a free
  independent check on that (a filed book under $100M was read in the wrong units). Info-table filename is
  index-discovered, NEVER `primaryDocument` (an XSL cover page). Diff classifies by SHARE COUNT not value (a
  price move is not a trade). Options kept visible, never folded in. Holdings/diff PUBLIC, sizing ADMIN-ONLY
  (server-decided + action re-checks), never wired to a broker.
- `lib/bottleneck/cusip.ts` identifier resolution, ORDER IS THE FIX: OpenFIGI `exchCode:"US"` → universe-
  snapshot name match → OpenFIGI unrestricted (labelled `openfigi-foreign`) → unresolved-but-visible. Ranking
  the unrestricted lookup higher returned **`1B2`, a Frankfurt symbol, for Nasdaq-listed Bitfarms**.
  `isUsListing()` gates consequences — a foreign-only row gets a $ weight and NO share count. **Id type is
  decided by identifier SHAPE: leading letter = `ID_CINS` (G11448100→BTDR), digit = `ID_CUSIP`** — a retry
  without exchCode does NOT rescue a CINS, and the reverse is "Invalid idValue format". Keyless: 25 req/min,
  10 ids/req. Failures cached ONLY when the service actually answered; an unknown cached `source` = re-resolve
- `lib/bottleneck/exposure.ts` Module D — ADMIN-ONLY, holdings in ONE `app_settings` key (no accounts, no
  table, no broker). CSV/paste parser REPORTS unreadable lines rather than dropping them; comma is both
  delimiter and thousands separator (quote it, or use tabs). Categories ordered by the DESK's ranking, not by
  exposure. Flags absence-from-tightest + concentration; ALWAYS states the counter-evidence (heavy capex
  historically predicts WORSE returns). Reports and flags — never proposes a trade
- `lib/rotation/` THE ROTATION BOARD — third product, deterministic, $0, ZERO plan-window draw.
  See HANDOFF-2026-08-30-rotation-board.md. Ratios of traded funds (RSP/SPY etc): 26 indicators over
  31 instruments, breadth/style/sector/credit/geography + VIX context (reported, NEVER scored).
  `catalog.ts` the ONLY market-specific input (built-ins in code, custom in app_settings
  `rotation_indicators`); **`baserates.ts` CONDITIONAL HISTORY (2026-09-03)** — pure; what followed
  the last times a ratio sat in today's decile of its trailing range. Sample counted in **EPISODES not
  days** (a 63-session forward reading on consecutive sessions shares 62 of 63 days with its neighbour)
  w/ a merge tolerance (a flickering condition fragments into fake independent visits: 316d/12ep became
  86d/**20ep** with a slope filter); the PLAIN figure is always published beside the conditional one
  (only the difference informs); under `baseRateMinEpisodes` → NOT MEASURED, ranks last, never a zero;
  `bandSharePct` = share of usable history spent in that band (**xlk-spy 49%** — a trending ratio keeps
  making new extremes inside its own trailing window, so >40% prints BARELY CONDITIONAL). `math.ts`
  gained `forwardChangeAt` (mirror of `rateOfChangeAt`, the only forward-reading fn); `score.ts`
  EXPORTS `directionFrom` so board + base rates share ONE deadband rule. **`historyYears` max 10→20
  (`MAX_HISTORY_YEARS`)** — 5y was statistically empty (439 usable days, RSP/SPY in its own bottom
  decile on 316 of them = 12 episodes, and the 63d mean **FLIPS SIGN** −1.21%→+0.24% at 20y). NB
  `loadSeries` had a hard-coded `limit=3000` and `getBars` returns the NEWEST rows → 20y would have
  silently dropped the oldest 8 years; `barReadLimit()` is sized to MAX_HISTORY_YEARS, deliberately NOT
  to the current knob (lowering the fetch setting must not appear to rewrite stored history);
  `bars.ts` two INDEPENDENT sources behind one fail-open interface — yahoo
  v8 (**adjusted** closes) primary, api.nasdaq.com (**RAW** closes, no index symbols) fallback, own
  globalThis queue (NOT edgar's — different hosts); `math.ts` pure stats — **alignOnDate joins on
  DATE, never by position** (^VIX prints Memorial Day 2026-05-25 when funds are shut; a positional
  zip shifts 5y of history), rollingZScore computed directly not from running sums (these ratios sit
  near a constant with tiny variance — the shortcut loses the digits), `wilderRsi` = **Wilder's
  smoothing, NOT a simple average** (48.1 vs 57.5 on the flagship; two-implementation cross-check);
  `score.ts` PURE composite + tiers (`>=` boundaries close the published bands' 7.5/4.5 gaps) +
  direction WITH A DEADBAND the spec lacks (a flat ratio would flip daily and every flip raises a
  note); `state.ts` state history is **COMPUTED from bars, never logged** (5y of chart marks on day
  one, and they re-derive when weights change — so no state table exists to drift); `brief.ts` pure
  template writer + `verifyBriefNumbers` (rejects any numeral not traceable to an input; tolerance is
  **half a unit of the last place WRITTEN** — exact matching rejects 0.2869 for 0.28685); `note.ts`
  the ONLY path to a model, every import inside the off-by-default branch; `board.ts` refreshBars
  (network) + readBoard (NEVER network, 95ms); `lib/rotation-settings.ts` 22 knobs `MAG8_ROT_*` over
  the shared registry + `MAG8_ROTATION=0` kill. **MIXED PRICE BASIS RULE**: bars record source+
  adjusted; a source switch REPLACES a ticker's history (never merges); a ratio whose legs disagree
  is shown+flagged but BARRED from raising a signal. **CALIBRATION, owner call**: percentile is
  computed+displayed but weight defaults 0 (= the published plain average), so the flagship reads
  1.1/No Signal at the 22nd percentile of its 3y range — the lever is `weightPercentile` on /admin.
- `lib/orchestrator/`: `agent.ts` is the ONLY `query()` caller; `prompts.ts` stage wrappers (date, coverage,
  modifier, selection-quota, blind select/research, shared `discoveryOutputContract`, naming discipline);
  `extract.ts` PRIMARY parser; `mock.ts` zero-spend through the same persist+emit path; `index.ts` executeRun
  (branches blind vs normal discovery) + executeResume, both over ONE shared `analyzeAndCompile` (stages 2–3 —
  matrix, grounding checks, compile, persist — so fresh and resumed runs can't drift) + `lib/price-sanity.ts`
  hook; `lib/fixtures.ts` seeds run REAL math.
  **`resume.ts` (E, 2026-07-28)** `planResume(runId)` — read-only, spends nothing, single source of truth for
  "can this be finished?" (blocks: not_found/run_active/mock_run/already_complete/no_cohort) and for what's left:
  the persisted cohort (Stage 1 NEVER repeats → a resume can't drift to other names) + every `ok` lens row of
  THAT run rebuilt as banked `CellOutcome`s (costUsd 0 — already in the row's total; grounding flags recomputed).
  `runAnalysisMatrix(…, {banked})` carries them through un-run/un-billed (a fully banked candidate takes no
  concurrency slot) and only the gaps call out; remaining=0 is legal = re-compile only. Resume forces
  `getWeeklyUniverse(false)` whatever the run's own force flag says (one cohort, one frozen ground truth);
  marketContext is recovered from the run's own `discovery_complete` event (`getRunMarketContext`) so the compiler
  reads what Stage 1 actually said; selection flags recomputed FLAG-ONLY (hardGate forced off — the cohort is
  fixed); banked cells from an older ISO week → explicit gapsNoted disclosure. `reopenRun()` clears
  status/error/finished_at in place; cost ACCUMULATES onto the existing row.
  **`selection.ts` (C)** pure `applySelectionQuota(candidates,pool,quota)` — ranked-head floor + salience ceiling;
  soft=flag-only, hard-gate=reject&replace from ranked head (synthetic digest-derived thesis), length-preserving,
  flags→compiler extraGaps→gapsNoted; imports salience (server-only). **`blind.ts` (D)** `runBlindDiscovery` —
  S1a tool-less pick from anonymized cards (deck=ranked head ≤60, week-seeded shuffle, id→row unblind map, size
  bucketed) → S1b skill+web researches the un-blinded shortlist (≤count·1.75); fail-open→`runDiscovery` when no
  ranked pool; enforces final⊆shortlist; same `{discovery,costUsd,selectionFlags}` return shape
- `lib/run-manager.ts` single-active-run lock (`startRun` + `resumeRun` — resume locks an id that already
  exists); `useRunStream` event-sourced reducer; `app/api/runs/*` POST (202/400/401/409/503 + `code`),
  snapshot GET, SSE, `[runId]/resume` POST (admin-gated + curtained like every run route); `app/lab`
  token-gated public focus console. RESUME BUTTON is admin-only and server-decided: `/admin` history gets a
  Finish column (`runTallies()` = 2 grouped counts, no payload loads) and `/runs/<id>`'s error banner gets one
  when the desk cookie checks out (`runTally()`), both via `components/ResumeRunButton.tsx` — a visitor's RSC
  payload never carries it and the API re-checks the token anyway
- `components/`: lens charts ALL null-safe (old rows render unchanged; error cells chartless); `HeroConfluence` WebGL (`?heroT=<s>` freeze)
- Brand: `npm run gen:logo` regenerates `public/brand/*` + `app/{icon,apple-icon}.png` from `marketing/logo-source.png`
  (favicons = black mark on light badge; `components/logo.tsx` + `.mark-glow` ink rim — never gold — carries it on
  nav/footer/hero/404/admin); `app/opengraph-image.png` re-shoot = headless-Edge (`--headless=new`) over scratch HTML
  with the vendored woff2 (satori/sharp can't render them); `metadataBase` ← `MAG8_SITE_URL`

- `lib/insider/` THE INSIDER TURNAROUND SCANNER — fourth product, deterministic, $0, ZERO plan-window draw.
  See HANDOFF-2026-08-31-insider-turnaround.md. Starts at the RARE EVENT (a Form 4 open-market
  purchase), then price setup → strength gate → owner-earnings DCF → composite.
  `form4.ts` daily-index walk + parsing — **an absent daily index answers 403, NOT 404** (weekends,
  holidays, today pre-publication), so a refusal is an absence per-day while a window of NOTHING BUT
  refusals is a fault, never "no filings"; booleans arrive `1/0` AND `true/false` from different
  agents in the same day (`=== "true"` reads a planned buy as discretionary = higher conviction);
  `reportingOwnerRelationship` OMITS false flags; one filing can name several owners and its buys
  were made ONCE by the group (per-owner rows multiply the dollars); index emits one row PER FILER —
  811 rows = 382 filings, **381 reachable via a listed-issuer row**, so the company is known before a
  doc is opened (~192/day worth fetching vs 382). Neither feed is edgar-cached: parsed rows + walked
  days ARE the persistence.
  `ingest.ts` universe resolution is **STRICTLY READ-ONLY** (`latestUniverseSnapshot()` + pure
  `screenUniverse()`, NEVER `getWeeklyUniverse()` — a public refresh button must not trigger a
  market-wide screener fetch); `prices.ts` reuses rotation's fetcher (+`assetClass` — it was pinned
  to `etf` and a common share answers "Symbol not exists", so the fallback was silently DEAD for
  every candidate); `drawdown.ts` PURE, windows are **CALENDAR not session counts** (deliberate
  difference from the board — Yahoo has real holes, e.g. every ticker null on 2026-08-28);
  `fundamentals.ts` Piotroski/Altman exactly as `.claude/skills/stock-scanner/references/
  screening-thresholds.md` §3–4 states them + **MERGED tag chains w/ per-year provenance** (first-
  populated-wins loses a whole FY — Ford FY2025 revenue migrated tags; before the fix Ford looked
  unfiled, after it: −$8.16B net income, Z 0.794 DISTRESS) + share counts matched to the nearest
  instant within 100d **preferring on-or-after** (cover-page dated, so exact match found nothing for
  the most complete filers); `dcf.ts` PURE owner earnings, BOTH capex bounds published (the 1986
  letter says (c) "must be a guess"), refuses to compound a negative base or a non-converging
  perpetuity; **projection base = the LATEST year UNLESS that year's working-capital movement exceeded
  its whole operating result** (then the median of `ownerEarningsBaseYears`, stated with both figures)
  — anchoring on the latest year alone let ONE balance-sheet reclassification decide a valuation (HOG
  −$1,132M after 4 positive years → no estimate; DKS $77M vs a $563M middle year → estimate collapsed),
  while a plain median silently HALVED a genuinely growing business (SGI 447→884); a negative endpoint
  raised to a fractional power is NaN and flowed out as a NaN price; `clusters.ts` conviction (dollars log-saturating at 10× the floor / cluster / role /
  recency, planned buys discounted); `score.ts` composite — an unmeasured component is NOT zero, the
  company is scored on what exists, marked partial, and ranks BELOW every complete one;
  `profiles.ts` conservative|balanced|aggressive applied ON READ; `scanner.ts` refreshScan (network)
  + readScan (NEVER network, 50ms) + pure exported `assessCandidate`; `report.ts` deterministic
  markdown + `verifyReportNumbers` (rotation's half-a-unit-of-the-last-place-WRITTEN rule);
  `lib/insider-settings.ts` 27 knobs `MAG8_INSIDER_*` + `MAG8_INSIDER=0` kill.
  **NOTHING DERIVED IS STORED** — no candidates/scores/rankings table — so a risk-tolerance change
  re-derives the whole list INCLUDING each rejection reason, with zero fetches. That is what makes
  the public preset picker free. Two financial filters are NOT risk preferences and no profile moves
  them. Solvency correctly REFUSES to score banks/REITs (no classified balance sheet → no working
  capital) and shows NOT MEASURED rather than 0.
- `lib/xml.ts` shared namespace-agnostic XML helpers, extracted from the 13F parser (which still
  reproduces byte-identically) + `stripCdata`/`attrValue` (2026-09-02, additive — feeds need both,
  filings need neither). NB the Bash-tool heredoc path EATS backslashes — write files
  containing regex escapes with the Write/Edit tools, never a heredoc.

- `lib/source-standard.ts` THE SOURCE STANDARD — what counts as evidence, one place. Tier A =
  primary-source statement (the entity's own dated words, the ARTIFACT not a summary) OR practitioner
  material citing specifics a casual observer could not produce, judged on CONTENT never on platform
  or credential; Tier B = sentiment/hype = a lead, never evidence, alone moves no verdict/score/
  probability/target. Same single-source pattern as `buildRubricText`: `buildSourceStandardText()`
  (compact, **311 tokens** — injected into EVERY discovery + lens prompt, which is what actually
  BINDS since a reference file can go unread) and `buildSourceStandardDoc()` (full → each playbook's
  `references/source-standard.md` via `gen:bib`, and /methodology verbatim). Cites only works ALREADY
  in the registry (Barber&Odean 2008 · Cohen/Malloy/Pomorski 2012 · Green 2005 — the last is the
  inconvenient one: unaided experts were no better than novices, which is WHY the practitioner tier
  is content-judged) → homepage chip stays 64. Tests pin the token ceiling AND run the text through
  the leak grep itself (it governs PUBLISHED prose).
- `lib/reach/` THE EVIDENCE LAYER — not a product, a layer UNDER the pipeline. Deterministic, keyless,
  $0, ZERO plan-window draw. See HANDOFF-2026-09-02-reach-evidence.md + `docs/agent-reach/README.md`
  (why the Agent Reach CLI was rejected: the leak grep bans `\bagents?\b` and `agent-reach` MATCHES
  it; the lens cell's own ceilings — then $1/30-turn/8-min, now uncapped/60-turn/15-min; CLI text carries no URLs so it would PUSH cells into the <3-link
  thin-sourcing flag; Railway container; bypassPermissions + a 3rd-party installer).
  `filings.ts` over the existing `getSubmissions` — **~100% coverage**, 1 cached request/candidate,
  form matched by PREFIX not an exact set (424B3/B5/B7, `/A` of anything); **S-8 is NOT an offering**
  (employee comp — ASTS's only S-form in 180d IS an S-8, counting it turns a true zero into a false
  raise); Forms 3/4/5/144 left to the insider scanner; empty-with-no-reason = filed nothing,
  empty-WITH-reason = could not read, two different fields. `feeds.ts`+`catalog.ts` Fed/ECB/EIA/
  BLS×2 — dialect **SNIFFED not declared** (BLS release feeds are ATOM served from `.rss`), Fed
  CDATA-wraps every link+date, charset read from the declaration (`Response.text()` always assumes
  UTF-8), **cap is PER SOURCE** (a global newest-first cap starves the MONTHLY publishers — jobs
  report + CPI are always the oldest items; window 35d so a monthly cycle fits), and a URL left
  hanging on an unfilled parameter is REFUSED (EIA ships `detail.php?id=` with the id missing from
  its own XML). `github.ts` **~15% coverage on this universe, reported not hidden**; resolution
  CURATED never guessed (17 verified handles; C3.ai left unresolved); **an empty org is NOT MEASURED
  never a zero** (SYM/ACHR/RKLB/S all hold a registered handle publishing nothing) — three states:
  no handle → nothing reported / handle+empty → NOT MEASURED+reason / handle+real → figures; forks
  excluded (23 of Rigetti's 64); org totals separate from the 100-repo SAMPLE; a rate-limited request
  says so rather than falling through as zero. `snapshot.ts` pure merge (extracted so a test can
  reach it WITHOUT importing lib/db); `index.ts` `refreshReach` (network) / `readReach` (NEVER).
  **FROZEN PER ISO WEEK** — a lens cell is cached on (ticker,skill,week), so evidence that moved
  mid-week would mean a cached cell and a fresh one describe different worlds. Merge is ADDITIVE;
  **force re-reads what you ASK for and never discards what you did not mention** (it once deleted
  a whole week), and `normalizeTickers` shape-checks so no caller bug can put junk in shared state.
  Wired into `analyzeAndCompile` (the ONE path fresh + resume share) AFTER discovery, inside the
  EXISTING groundBlock — one block, one vocabulary; releases go to gt-predictor ONLY. Fail-open,
  pinned byte-for-byte; mock/fixture runs return before it. `lib/reach-settings.ts` 8 knobs
  `MAG8_REACH_*` + `MAG8_REACH=0`; optional free `MAG8_GITHUB_TOKEN` (60→5000 req/hr).

- `lib/crossdesk/` THE CROSS-DESK LEDGER (`/crossdesk`, 2026-09-03) — where the desks name the same
  company. Deterministic, $0, ZERO plan-window draw, and **STORES NOTHING**: no table, no migration,
  user_version stays 7; every row derived on read from what four desks already hold, so it cannot drift
  and a visitor's own `?risk=` re-derives the whole page free. See
  HANDOFF-2026-09-03-crossdesk-baserates.md. NOT `/convergence` — the pipeline owns "Confluence" and
  `--color-confluence` gold marks its final verdicts, so **no gold on this page**.
  **Every claim carries its KIND**: `measured` (a desk computed a figure about THIS company — board
  finalScore, insider composite+dollars) · `curated` (a hand-kept list — bottleneck `owners[].tickers`
  + `demand.basket` — carrying the MEASURED state of what it's attached to; the page prints both
  halves) · `context` (the NEIGHBOURHOOD, never the company). **The universe screen is NOT a desk**
  (eligibility is the price of entry to two desks, not evidence — it would hand every name a free
  point); it contributes size/price/solvency/dilution CAUTIONS only (`universeScreenFlags` widened to
  `Pick<UniverseResult,"rows"|"extras"|"settings">` so a stored snapshot needs no live screen).
  **The rotation board never counts toward agreement** — it trades funds; absent from `DESK_ORDER`,
  pinned by test. `sectors.ts` bridge = universe snapshot's `s` (exchange scheme, **13 clean values**),
  NEVER `candidates.sector` (model free text, **88 distinct values across 55 rows**); 10 map, Telecom→XLC
  labelled approximate, Miscellaneous/Other→nothing; a test asserts every mapped fund has a real board
  indicator. **SECOND CROSSING AXIS (owner-asked): a company named by ≥`minThemes` BOTTLENECK THEMES
  crosses too** (CEG = AI-infra power +81.9pp AND nuclear +86.5pp) — `DeskClaim.group` (playbook id) +
  `.constraint` (category key); ranked BELOW every desk crossing on purpose (one desk's method applied
  twice ≠ two desks agreeing) and `crossedBy: ("desks"|"themes")[]` says which on every row. **Two themes
  over the SAME `constraint` = ONE constraint in two industries, not two** (MP/USAR, both `ndpr_kg`) —
  counted as `sharedConstraint` and stated on the row. 7 companies in 2+ themes: BWXT CEG GEV MP TLN USAR
  VST. `lib/crossdesk-settings.ts` 5 knobs + `MAG8_CROSSDESK=0`. Live: 13 crossings of 244 named;
  **board ∩ insider = 0** (structurally disjoint populations — say it, don't hide it), board ∩
  bottleneck 5, insider ∩ bottleneck 2. NB the canonical board excludes focused/blind runs, so AVAV and
  RCAT (focused-run only) are correctly absent — a raw `rankings` count says 7 and is wrong.

- `lib/tide/` THE TIDE (`/tide`, 2026-09-05) — fifth product, the only one about the MARKET not a
  company: how much to own vs cash. Deterministic, $0, keyless, ZERO plan-window draw, user_version 8,
  two additive tables, 0 FKs. See HANDOFF-2026-09-05-tide.md. **40 gauges / 39 series.**
  `catalog.ts` the ONLY market-specific input, split SERIES (where a number comes from + a staleness
  budget) from GAUGE (what it MEANS) so one series feeds two gauges. **ONE POLARITY PER GAUGE** — a
  gauge whose sign depends on circumstances is an argument, not a gauge; a variable that matters both
  ways appears TWICE (baa10y level = slow/complacency high-is-good; baa10y change = fast/stress
  high-is-bad). That rule KILLED "the curve un-inverted" (steepening from normal is good, from inverted
  is bad) → replaced by `curve-recent-inversion` = depth of worst inversion in 2y, single-signed, same
  content. **NO ABSOLUTE THRESHOLDS** — every gauge is a percentile of its OWN history (a fixed
  threshold is where an opinion hides, and it rots as the world moves).
  `normalize.ts` PURE heart: sampleOnto (a ratio is evaluated on the LOWER-frequency leg's dates —
  sampling, not carry-forward) + 6 transforms + stress 0-100 (100 = worst) oriented by polarity +
  **`meaningFor()` picks prose by PERCENTILE never by stress** (a low stress on a high-is-good gauge
  means a HIGH reading — the build wrote "the index is below its ten-month average" as favourable with
  the S&P at a record) + `toMonthly` (EVERYTHING incl. today is scored on the monthly grid, so the
  board number IS the last point of its own chart — one code path, no drift).
  `score.ts` PURE: `weightFor(family,horizon)` — the PAIR is the key; family aggregates equal-weighted
  within, family weights across; **an unmeasured gauge is EXCLUDED, never 50** (a family with no
  measured member contributes no weight and redistributes); good/bad split by TODAY's reading, reported
  as a share of WEIGHT not count; exposure band = one published line, `base − fastPenalty·(fast−50)/50
  − slowPenalty·(slow−50)/50`, clamped 20–90 (never 0 or 100), published as a BAND.
  **TWO COMPOSITES, NEVER AVERAGED** — live: fast 45.9 benign, slow 87.3 extreme, sentiment 55.2
  contradicting both; one blended number would report "mild" and destroy the only information.
  Slow is REPORTED not acted on (Goyal-Welch: valuation would not have helped time the market).
  `baserates.ts` **greedy NON-OVERLAPPING draws, NOT episode clustering** — clustering by proximity
  produced a single "visit" 2022-02→2025-01 at gap 3 and 2018-03→2025-08 at gap 12; and the result
  swung 49 visits/+6.2% (gap 1) → 21/+7.7% (3) → 11/+8.0%/**100% positive** (6) → NOT MEASURED (12).
  Spacing can only be WIDENED, never below the horizon. Live: 19 draws 1996-2025 incl. −14.9% (2007-06)
  and −9.2% (2022-02), +14.4% vs +9.2% plain. minEpisodes 5 because 30y of independent annual windows
  holds ≤30 observations total (a floor that can never be met is not a safeguard).
  `feeds.ts` fail-open connectors fred|cboe|market|manual. **HTTP 200 + HTML for a nonexistent FRED id
  — a status code validates NOTHING**; **freshness gate: `USSLIND` (the obvious free LEI) answers fine
  and died 2020-02** (also dead: USALOLITONOSTSAM 2024-01, MVEONWMVBSNNCB 2017-10, WRMFSL 2021-02,
  DRTSPM 2014-10); **future-dated rows are PROJECTIONS** (`NROU` last obs **2036-10-01**, GDPNOW is a
  nowcast) and are dropped+counted; FRED wants an HONEST UA (opposite of the price rule — do not
  cargo-cult). **Staleness budgets are frequency PLUS LAG, not frequency** — Z.1 `equities` sat 247d
  against a 250d budget, 3 days from declaring the Fed's own accounts dead (Z.1 → 330, GDP/CP/delinq →
  280). Three freshness states: never-published ≠ stopped-publishing ≠ current.
  **ICE BofA OAS (BAMLH0A0HYM2) is licence-capped to a rolling ~3y and `cosd` does NOT extend it** → use
  Moody's `BAA10Y` (1986→); FRED `SP500` capped to 10y → use `^GSPC`; Wilshire gone from FRED → `^W5000`
  on Yahoo; **CBOE publishes VIX/VIX3M itself keyless and complete** (1990/2009→) where `^VIX3M` is
  unreliable. `breadth.ts` counted from the universe snapshot **STRICTLY READ-ONLY**
  (`latestUniverseSnapshot()` + pure `screenUniverse()`, NEVER `getWeeklyUniverse()`) + rotation's
  `fetchTicker` w/ `assetClass:"stocks"`; 496/500 companies, 604k closes; survivorship-biased (today's
  largest, read backwards) — bias runs AGAINST the present reading, and is disclosed. `desk.ts`
  refreshTide (network) / readTide (**NEVER** network, ~120ms). `lib/tide-settings.ts` 33 knobs
  `MAG8_TIDE_*` + `MAG8_TIDE=0`. **A series no gauge reads is never fetched and looks catalogued while
  being invisible** — pinned by test (caught `anfci`; `houst`/`drccl` became real gauges).

- `lib/risk/` THE RISK DESK (`/risk`, 2026-09-07) — sixth product, the AutoHedge answer: the other
  desks say what is interesting, this says how much it MOVES and how much of that is the SAME move.
  Deterministic, $0, keyless, ZERO plan-window draw, user_version 9, one additive table, 0 FKs. See
  HANDOFF-2026-09-07-risk-desk.md. **It reports and it flags** — nothing here proposes a trade,
  suggests a weight, sizes against a balance or reaches a broker (same sentence bottleneck/exposure
  opens with). Population = `readLedger()` crossings (13 live). `returns.ts` PURE — bars → SIMPLE
  daily returns (a portfolio's simple return IS the weighted average of its members', log returns
  compose into nothing), pairwise `overlap()` + `commonGrid()`; **BOTH closes checked, not just the
  denominator** — a 0 close became a −100% return, the 4th blank-as-zero in this repo. `stats.ts`
  PURE vol/downside/cov/corr/beta/drawdown, two-pass not running sums; **`maxDrawdown` builds the
  wealth series ONCE with a leading element for the window's opening level** — the high-water mark is
  often the level the window OPENED at, which no index into the RETURNS array can address, and
  recomputing it by compounding returns[0..peakIdx] made the recovery target the TROUGH so a series
  that never came back reported that it had (`peakAtWindowStart` so the prose says "from the level it
  opened at"). `sleeve.ts` PURE equal-weight basket + **effectivePositions = (avg member vol /
  basket vol)²** (Choueifaty-Coignard DR², named in code, NOT in the citations registry — the primary
  source would not extract) + Euler risk decomposition summing to 100; **CAN exceed the member count**
  when members move AGAINST each other — real, deliberately NOT clamped, raises a note. `score.ts`
  per-name + the pair table on **each pair's OWN overlap** (a recent listing never shortens anyone
  else's record); a mixed-basis pair is shown but BARRED from raising the one-position flag (an
  unadjusted leg carries each ex-dividend fall as a real one-day loss). `report.ts` deterministic
  markdown, **SIGN-AWARE** verification (a −40% fall written as +40% is the opposite claim, not a
  rounding) with **dates and company names MASKED then dates checked separately** — a sign-aware
  reader tokenises 2026-04-15 as 2026/−4/−15 and admitting those would admit a fabricated "−4%"
  anywhere. `desk.ts` refreshRisk (network) / readRisk (**NEVER**, ~1.3s of which ~0.9s is readLedger
  + 0.17s readTide). **NOTHING DERIVED IS STORED** — only closes — so a window change re-derives the
  whole board incl. every unmeasured reason, free. **Reads the other three bar stores before
  fetching** (7 of 14 live tickers already held by tide/rotation); ONE store per ticker, never a
  merge. `lib/risk-settings.ts` 14 knobs `MAG8_RISK_*` + `MAG8_RISK=0`; benchmark SPY is env-only
  (`MAG8_RISK_BENCHMARK`), deliberately not a settings-page dial. **The benchmark join is an OVERLAP
  not all-or-nothing** — SPY's store was 2 sessions behind and the basket's beta + market comparison
  both vanished silently while every per-name beta survived (those are pairwise). Live: basket vol
  48.5% vs members' 71.2%, **2.2 effective positions of 13**, beta 2.47, worst −40.4% unrecovered;
  tide band 50.4-60.4% → 24.4-29.3% portfolio vol; 3 pairs across 5 names read as one position.
  +2 citations, BOTH arguing against the desk and built into the arithmetic (DeMiguel/Garlappi/Uppal
  2009 = why equal weight and no optimisation; Longin & Solnik 2001 = why co-movement is a
  calm-weather figure) → **homepage chip 75 → 77**.
- `lib/number-verify.ts` ONE traceability rule, extracted 2026-09-07 from THREE divergent copies
  (insider was sign-AWARE, rotation and tide sign-BLIND — a fourth copy would have meant picking a
  variant silently). Half-a-unit-of-the-last-place-WRITTEN tolerance; `signed` is an explicit
  parameter because the two demand different allowed lists and cannot be swapped. All three migrated,
  their 55 existing tests unchanged.
- `lib/bottleneck/usaspending.ts` + `procurement.ts` FEDERAL AWARD RECORDS (2026-09-07), keyless.
  **BESIDE the gap, never INTO it** — an obligation is a DEMAND quantity, so a supply slot would
  compare the government's spending against the suppliers' and print the difference as a physical
  constraint: every figure real, the conclusion meaningless. Answers the one thing the desk could
  not: whether `owners[].tickers` (the `curated` claim on /crossdesk) is RIGHT. **Linkage CURATED,
  never guessed** — a normalised name match found 1 of 6, because the government contracts with
  operating SUBSIDIARIES (Kratos Defense appears only as "KRATOS UNMANNED AERIAL SYSTEMS, INC", so a
  parent match reports no awards for $164M of them). **A code's TITLE is not evidence**: 9 probed, 7
  rejected on their recipient lists — PSC 4470 "Nuclear reactors" is NAVAL PROPULSION (Fluor Marine,
  Electric Boat), PSC AN11/AN12 "R&D general science" is BIOMEDICAL (Leidos Biomedical, Sanofi
  Vaccines). Only PSC 1550 survived → **drone theme only**, `procurement` optional on the playbook.
  Obligations can be NEGATIVE (de-obligations). Fiscal years run Oct-Sep, named for the year they
  END in; the current year is marked STILL RUNNING not dropped, and the trend compares the two most
  recent COMPLETE years. Stored in ONE `app_settings` key per theme — no table, no migration. Live:
  $1.94B FY2025 **−11.8%** while the theme's demand reads **+62.4%**; AVAV+KTOS hold **12.3%** of the
  code's dollars, the rest going to primes and private companies.

## Invariants — do not break
1. SSE plumbing: `next.config.ts` keeps `compress:false` (gzip would buffer SSE) + `serverExternalPackages`
   `['better-sqlite3','@anthropic-ai/claude-agent-sdk']`. Persist progress events (sync INSERT) BEFORE emit;
   `progress_events.rowid` IS the SSE id; SSE route subscribes THEN replays synchronously — no `await` between.
   A RESUMED run's log carries its earlier attempt's terminal event MID-log, so neither end may treat a terminal
   frame as the end unconditionally: the route suppresses cleanup for terminal frames seen while `replaying &&
   liveOnConnect`, and `useRunStream` closes on `onerror` only when the LAST frame was terminal (else it lets
   EventSource retry with Last-Event-ID — a blip must never strand a live run). Reducer: `stage_start` clears
   `error`/`terminal` (re-entering a stage means the run is live again).
2. Skills are EDITABLE; `.claude/skills/**` is source of truth (grounding edits + generated bibliographies live
   there). `*.skill` zips are vestigial seeds; `setup-skills.ps1` extracts only-if-missing (a re-extract loses
   edits; `git restore` recovers). Scope via SDK `skills:[name]`; never add `'Skill'` to `allowedTools`.
3. Sessions: `bypassPermissions` requires `allowDangerouslySkipPermissions:true`; set `strictMcpConfig:true` + `disallowedTools`
   or sessions inherit claude.ai MCP connectors (seen: Gmail/Shopify in lens sessions). CLI 2.1.198 treats `outputFormat:
   json_schema` as ADVISORY → the contract is prompt-pinned at all 3 stages: final message = markdown + trailing ```json
   fence (lens schemas EXCLUDE `fullAnalysisMarkdown`; narrative stitched from message text); `agent.ts` prefers
   `.structured_output` else `extractJsonLoose()`; exactly ONE corrective retry resumes the session with the actual zod issues.
4. Fixture/mock lens rows key on `demoWeekKey()` (`YYYY-Www-demo`) — demo can never satisfy a real cache lookup.
5. A lens-cell failure becomes an error cell (neutral 50 + gap note), NEVER a run failure; all-cells-failed aborts
   pre-compile; FATAL_AGENT_ERROR (plan limit/auth) fast-aborts; watchdog 90 min (was 45; a 15-min lens cell x3
   batches + discovery + compile = 63 worst case); per-call timeout (lens 15 min) + maxTurns (lens 60) bound a
   call. `maxBudgetUsd` is OPTIONAL and OFF by default — it is the one guard that destroys what it stops (the SDK
   ends the query `error_max_budget_usd`, the cell persists as an error with cost 0 and the spend is already gone).
6. UI: gold (`--color-confluence`) marks FINAL VERDICTS only (`--color-macro` is copper for this reason);
   grids need an explicit `grid-cols-1` base and chip rows need `flex-wrap` (375px no-horizontal-scroll).
7. Mock runs: dev always, prod needs `MAG8_ALLOW_MOCK=1`. Real runs need `authMode() !== 'none'`: api-key or
   subscription (`CLAUDE_CODE_OAUTH_TOKEN`/CLI login; `MAG8_AUTH_MODE` asserts/blocks); subscription bills the
   PLAN, not the API — `total_cost_usd` is notional. **Owner: ZERO API spend, subscription only.** Admin: no
   `ADMIN_TOKEN` → open in dev, locked in prod; constant-time compare in `lib/auth.ts`.
8. PUBLIC-VIEW BOUNDARY: no client payload (SSE frame, snapshot JSON, RSC prop) bypasses `lib/public-view.ts` — chokepoints:
   SSE `send()`, snapshot GET, server pages. Client speaks `PublicLens` (`fundamentals|macro|consensus`, `lib/public-lens.ts`);
   `lens_status` ships `lens`, never `skill`; compiler output is born public (`sanitizeError` at source); stage prompts pin
   public report titles and ban tool/skill/platform mentions; internal ids stay in DB/events/prompts, old rows translate out.
9. Wire extension is retry-proof: new keyMetrics fields are `.optional().catch(undefined)` + tolerant
   preprocess; arrays `capArray(n)`-sliced, NEVER `.max()` (malformed optionals drop, no retry). GT player
   m/e/c stay 1–10 (pinning 1–5 recreated retry storms). Compiler strips display-only rosters
   (players/institutions); scenarios + horizonProbabilities stay — they inform scoring.
10. Modifier (≤280 chars, `sanitizeModifier()`) scopes DISCOVERY ONLY — lenses are modifier-blind BY DESIGN
    (keeps the weekly cache valid); compiler sees it for `marketOverview`; rides `runs.params_json` (no DDL);
    injected as a subordinate block that re-asserts universe/count/contract supremacy.
11. Grounding is disclosed, never silent: lens `## Sources` (real URLs) required — <3 links flags fresh AND
    cached cells; scanner-vs-forecast spot divergence >20% flags; `price-sanity.ts` external quote >15% flags
    (3s, fail-silent, `MAG8_PRICE_CHECK=0` off; Yahoo v8 chart + Mozilla/5.0 UA — Stooq CSV is DEAD since
    2026-07). Flags join compiler Known-gaps AND report `gapsNoted` deterministically, PUBLIC lens labels only.
    Stance (also on /methodology): sampling can't be seeded; determinism = TS re-verify + weekly cache + checks.
12. LAUNCH CURTAIN: `launchMode()` (`MAG8_SITE_MODE=launch|full`; prod defaults launch, dev full) 404s every
    page/API except `/`, the waitlist action, and token-gated `GET /api/waitlist` — the ONE launch-exempt API
    (owner signup readout: `x-admin-token` header OR `?token=` for phone browsers; missing/wrong token → 404
    NOT 401 so it stays invisible; no ADMIN_TOKEN in prod = locked closed). Guard sits at the TOP of each
    hidden page (incl. /methodology) and all 3 run API routes (admin token does NOT bypass; flip to full to
    operate), and every link branch (nav + footer carry no page links; 404 → Home only). Launch homepage is
    DB-FREE and link-free: static MOCKUP LEADERBOARD ($-redact ticker bars, fictional scores) replaces the
    real top-3 — real tickers/dates/links render only in full mode. Any NEW public page or API must add the
    guard (launch-exempt additions are owner-call-only). Build and run with the SAME mode (`not-found.tsx`
    bakes its variant at build; the rest checks per request). DEPLOY.md = runbook (Railway: 1 replica,
    sleeping off, no mid-run pushes).

## Windows/env quirks (each cost real time)
- Headless Edge renders `--window-size=375` at ~476px — use the iframe probe: temp page `app/probe375/`
  (`_`-prefixed app dirs 404) embeds the route in a 375px iframe; measure scrollWidth + per-element `right`,
  skipping nodes inside overflow-x clips. Delete the page + its `.next/types` stub afterwards.
- Headless Edge freezes rAF (framer stuck, recharts blank): add `--virtual-time-budget=12000
  --run-all-compositor-stages-before-draw` (+ `--enable-unsafe-swiftshader` for WebGL). Virtual time
  fast-forwards timers — mid-flight shots need plain `--timeout`; throttled EventSource shows CONNECTING.
- **The dev server EXHAUSTS ITS V8 HEAP after compiling ~10-15 routes and wedges** (2026-09-03): 100% CPU,
  ~6.4GB private, answers NOTHING — with 27GB of machine RAM still free, so it is the default ~4GB old-space
  ceiling, not the box. Symptom is indistinguishable from a hang in whichever page it died on (it blamed
  /methodology once and /crossdesk once; both render in <2s alone). Fix: run any full-surface sweep with
  `NODE_OPTIONS=--max-old-space-size=12288`, warm routes ONE at a time, and `Stop-Process` when it spins.
  Corollary: the leak probe must use **curl, not node's fetch** — `scripts/__leak-curl.sh` (gitignored, like
  every `scripts/__*`) prints byte sizes and flags anything <20KB, since a mid-recompile reply is a ~3KB
  Next shell that greps clean.
- **`next build` while `next dev` is running shares `.next` and CORRUPTS the running dev server.** Symptoms range
  from 404 CSS to a hard 500 on every route with `Cannot find module './611.js'` / `Require stack: .next/server/
  webpack-runtime.js` and NO UI at all (hit 2026-08-30 — the build overwrote chunks the dev server had already
  resolved). Fix: STOP every dev server, `rm -rf .next`, restart dev. Prevention: never run `npm run build` with a
  dev server up — kill it first (`Get-NetTCPConnection -LocalPort 3000 …`), build, then restart. CRLF commit warnings
  are noise (`git -c core.safecrlf=false`). `Expand-Archive` refuses `.skill` (use .NET ZipFile). tsx skips env files
  (`run-pipeline.ts` calls `process.loadEnvFile()`). Write tool once mangled control-char escapes — `\x`-escape + verify.
- Git-Bash: multi-line `npx tsx -e '…'` prints NOTHING (write `scripts/__*-probe.ts`, run, delete); it mangles
  PowerShell `$_` — use the PowerShell tool (port-3000 kill via `Get-NetTCPConnection … Stop-Process`).
- This network intermittently blackholes DNS for google hosts (fonts.googleapis.com dead even via 1.1.1.1;
  2026-07-07) → fonts are VENDORED `app/fonts/*.woff2` via next/font/local (OFL latin subsets, weight ranges
  pinned in `app/layout.tsx`) so `next build` needs no font network. Fetching from google infra: curl needs
  `--ssl-revoke-best-effort` (schannel CRYPT_E_REVOCATION_OFFLINE) + `--resolve <host>:443:<v4-IP>`.
- Remotion (`marketing/video/`): system Chrome + `chrome-for-testing` + rendererPort≠3000 (Edge headless renders hollow here; headless-shell download lives on blackholed storage.googleapis).
- SDK transcripts `~/.claude/projects/C--Users-nocap-Mag8/<sessionId>.jsonl`: replaying final text through extract+zod
  reproduces cell outcomes EXACTLY; corrective retries append to the same file. SQLite is WAL — read-only side
  connections are safe mid-run, but NEVER import `lib/db.ts` from a side process during a live run (boot reconciliation
  marks running runs interrupted).

## Commands & gates
```bash
npm run pipeline -- --smoke                             # go/no-go probe (~$0.30 notional)
npm run pipeline -- --full [--count N] [--force] [--mock] [--focus "…"] [--blind]   # --mock=$0; --blind=D two-phase
npm run pipeline -- --resume RUN_ID                     # finish a stopped run IN PLACE (headless twin of the button)
npm run pipeline -- --lens-probe TICKER [--effort L]    # one-cell A/B comparator
npm run audit:salience                                  # fame-bias readout over all real runs ($0; between runs only)
npm run test                                            # vitest, offline, 639 tests (the deterministic half)
npm run bottleneck -- --probe                           # live EDGAR + OpenFIGI smoke; all PASS, exit 0
npm run bottleneck -- --13f CIK|NAME [--offline] [--force] [--balance USD]   # clone a filer's book + diff
npm run bottleneck -- --refresh [PLAYBOOK] [--dry] [--reuse-demand]          # demand + supply, score the gaps
npm run rotation -- --probe                             # live price-source smoke; ALL PASS, exit 0
npm run rotation -- --refresh [--dry] [--ticker T]      # 31 tickers, ~39k closes, ~24s
npm run rotation -- --board [--indicator ID] | --note [--write] | --coverage
npm run rotation -- --baserates [--indicator ID]        # what followed, the last times a ratio sat here
npm run crossdesk -- --board [--risk PROFILE] | --ticker T   # where the desks name the same company ($0, read-only)
npm run tide -- --probe                                 # live source smoke; ALL PASS, exit 0
npm run tide -- --refresh [--dry] [--series ID]         # 39 series + breadth over ~500 companies
npm run tide -- --board [--baserates] | --gauge ID | --baserates | --coverage | --report [--write]
npm run insider -- --probe                              # live feed smoke; ALL PASS, exit 0
npm run insider -- --refresh [--dry] [--days N] [--force] [--workup-only]   # incremental; days already read are skipped
npm run insider -- --board [--risk conservative|balanced|aggressive] | --stock TICKER | --report [--write] | --coverage
npm run reach -- --probe                                # live source smoke; ALL PASS, exit 0
npm run reach -- --refresh [TICKER,…] [--dry] [--force]  # no ticker = official-release feeds only
npm run reach -- --board [--ticker T]                   # what is stored, no network
npm run risk -- --probe                                 # live price-source smoke; ALL PASS, exit 0
npm run risk -- --refresh [--dry] [--force] [--ticker T] # reuses closes another desk already holds
npm run risk -- --board | --pairs | --stock T | --coverage | --report [--write]
npm run check:voice [-- --strict] [-- --house]          # AI writing tells in hand-written copy
```
Fixture regression (`npm run seed`): ASTS 90.3 pass+confluence, RKLB 73.9, TMDX 69.5, SYM 51.5, IONQ 47.9,
CRSP 46.7, OKLO 42.7, ACHR 19.3 fail-gated #8; mock count ≥6 errors the CRSP×gt cell (CRSP → 46.4 + gap note);
ASTS×forecast cache-hits after a prior seed/mock. Leak probe (gate for any public-surface change): render `/`,
`/rankings`, `/methodology`, `/lab`, `/bottleneck` (+`?playbook=<id>`), `/bottleneck/clone?cik=<n>`,
`/bottleneck/exposure`, `/rotation`, `/rotation/<id>`, `/insider` (+`?risk=<profile>`), `/insider/<ticker>`,
`/crossdesk` (+`?risk=<profile>`), `/tide`, `/tide/<id>`, **`/risk`**, `/stocks/ASTS`, `/runs/<id>` + snapshot JSON + SSE, then
`grep -rniE "stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b"`
→ ZERO hits (`/admin` exempt; ONE owner-approved `agents?` exception since 2026-07-09: the homepage
"26 agents" / "26 AGENTS PER RUN" disclosure copy — everywhere else, incl. all run payloads, still zero).
NB the grep bans the bare ENGLISH words too — public copy must write around skill/agent vocabulary,
and it is exactly why the Agent Reach CLI could never be named in a prompt or shelled out to:
`agent-reach` MATCHES the agents? word pattern (a hyphen is a word boundary), and Mission Control renders every
Bash call verbatim as `Running: <command>` (progress.ts:59). The native layer is `lib/reach/` — "reach" alone does not match.
(Grinold citation reworded "skill"→"edge" 2026-07-13; Griffin&Xu cite reworded "not skill"→"not proof of an
edge" 2026-08-30; blurbs on /admin are exempt, /methodology is not). Curl a dev page mid-recompile and you get
a ~3KB Next shell that greps clean — check `wc -c` before trusting a 0.

## State & open items (deep detail: `HANDOFF-*.md`; video rulebook: `marketing/video/CLAUDE.md`;
chart-format engine: `marketing/video/CHARTS.md` + `.claude/skills/viral-chart-protocol`;
video OWNER FORMULA: `marketing/video/FORMULA.md` — every owner video request, compounding:
consult before any film work, APPEND every new owner note to its changelog)
W28 live clean: 2026-07-06 count=4 focus run (defense/dual-use autonomy; $8.70 notional, 10 min) + post-reset
count=8 full run 2026-07-07 ($17.87, 13 min — VRT #1 at 49.1, zero confluence, 3 caution / 5 fail gates); two
count=8 attempts died at the 5-hour plan limit (resets 9:30pm America/Denver; fast-abort worked as designed).
2026-07-07: all-time boards on `/rankings` (canonical vs lab); fonts VENDORED after the DNS break; brand mark
(black four-blade X) across all public surfaces + favicon/manifest/OG.
Films (07-07→08, `marketing/video/` — standalone Remotion project, NOT part of the app; four handoffs
HANDOFF-2026-07-08-*.md): master `out/the-signal.mp4` (122s 1080p30; real site shots `public/shots/`
reshoot-after-UI-changes), three lens shorts `out/short-{fundamentals,macro,consensus}.mp4`, EIGHT fun meme
shorts `out/fun-{eightball,groupchat,gate,redflags,naturedoc,speedrun,replay,coldcase}.mp4` (~30s 1080×1920) —
real mega-cap cashtags in safe framings ONLY (candidates stay $-redacted; real names NEVER scored/vetoed);
WaitlistCta on every endcard; BigQuestion intro + graded type pass on all 8; Kinetic ghost-word clamp in ui.tsx
(DOM-reuse bugs only surface in encode-path frames — `npm run stills` seq mode catches them); `npm run
check:leak` = video white-label gate; remotion-best-practices skill installed (`skills-lock.json` at root).
2026-07-08: GT lens RENAMED "Game Theory" (display-only: LENS_META/PUBLIC_LENS_META labels + taglines; ids/
keys/copper/`GT` unchanged; public-view EXACT_TOKENS retro-translates 3 case variants of "Macro Asymmetry" so
cached rows render renamed) + two-engine explainers: home panels → `/methodology#discovery-dna` + `#game-theory`
(Bessembinder premise, 6-step GT cell anatomy, Tetlock/Green graded-not-trusted note).
2026-07-09 DEPLOY (HANDOFF-2026-07-09-railway-launch.md): launch curtain per invariant 12; homepage disclosure
chips 26 AGENTS PER RUN / 3 LENSES FULLY BLIND / 32 ACADEMIC WORKS CITED (computed from CITATION_GROUPS,
matches `estimateRun`'s 1+3N+1); waitlist E2E-verified on a prod build (stores; NOTHING SENDS yet); root
tsconfig EXCLUDES `marketing/` (its .ts-extension imports fail root tsc/next build); `outputFileTracingRoot`
pinned. LIVE on Railway free trial (owner pick; $5 one-time credit, ~$2–4/mo burn → upgrade to Hobby):
1 replica, App Sleeping OFF, never push main mid-run (auto-deploy restart interrupts it); SSE proxy caps
(15 min + 5 idle) absorbed by 15s heartbeats + Last-Event-ID replay; on-server full-mode runs = the
board-update path. Volume `/data` + `MAG8_DB_PATH` instructed but UNVERIFIED — confirm before ANY push to
main (a redeploy wipes un-volumed signups). Same day: token-gated `GET /api/waitlist` SHIPPED (launch-exempt
owner readout per invariant 12; `countSignups()`/`listSignups()` in lib/db.ts; `{count,signups[]}` newest
first, `?count=1` count-only; verified: launch matrix, both modes, locked-closed no-token prod, JSON leak
probe 0-hit). Owner confirmed 2026-07-09: volume `/data` + `MAG8_DB_PATH` attached AND ADMIN_TOKEN set on
Railway → pushed; phone-check `https://<domain>.up.railway.app/api/waitlist?token=<ADMIN_TOKEN>`.
2026-07-09 later: VIDEO trillion-DNA pass, all 12 films (owner: "scout" must always carry the
trillion-DNA framing + no overflow/low-contrast text) — S05/V02/V03 copy, braid labels
TRILLION-DNA SCOUT / TRILLION-DNA, S13 wire two-line rows + "trillion-DNA screen"; ~35 dim→muted
readable-copy bumps (state-dims kept), S16 white-chapter footnote → whiteMuted; overflow fixes
(S14 pills, S17/VF4/redflags nowrap, redflags stamps → empty band, VM2/VC3/VF4 footers shortened
to the ≤52-char mono rule). Rules + canon copy now in marketing/video/CLAUDE.md; timelines
untouched (scores valid); all 12 re-rendered. `public/shots/run.png` still pre-rename ("MACRO
ASYMMETRY") — site reshoot pending. Same session: `marketing/video/FORMULA.md` CREATED (all
owner video requests from 6 sessions, provenance-tagged, compounding changelog) + this pass's
HANDOFF-2026-07-09-video-trillion-dna.md.
2026-07-09 latest: FOUR ENGINE SPECIALS (HANDOFF-2026-07-09-engine-specials.md) — owner asked for
4 films on the two flagship engines w/ creative freedom ("no need to stick to the same colors/
designs/visuals"): fun-{dnatest,yearbook} = trillion-DNA scout (genome-lab helix w/ 6 trait genes +
Bessembinder 4%; halftone yearbook "most likely to…" → Class of 2026 marker circle), fun-{poker,
forecast} = Game Theory (felt table M×E×C/pot-committed/62-28-10 tree/falsifier; Channel-8 weather
map H-L players/horizon cone/severe-asymmetry banner). Per-episode palettes (return to house dark
at desk/endcard, coldcase precedent); OFL accents VENDORED via jsdelivr/fontsource (F.serif Libre
Baskerville + F.hand Caveat — google hosts still dead); FORMULA §B/§H + `[07-09 engines]` appended;
gen-score-fun.ts gained argv filter; `render:engines` script; 16 films total, 12→16 in render:fun.
QA: 48 stills read (3 fit bugs fixed: Y1 cover wrap, PK2 label column, DN2 gene-band min-span),
4 encode-path seq windows clean, leak gate 62 files 0 hits, 4 renders exit 0 + ffprobe exact.
2026-07-10 (Cowork, HANDOFF-2026-07-10-youtube-uploads.md): YOUTUBE LIVE — TheMAG8 channel
(UCksCjqUEx1-FFOnXqEjpFdg): the-signal PUBLIC (youtu.be/OSAv2laZ6XM, Education/English/24 tags) +
all 15 shorts SCHEDULED 2-day cadence Jul 12→Aug 9 @ 12:00PM local, story-arc order (dnatest opens,
lens explainers woven between memes). Metadata pack marketing/youtube-upload-plan-2026-07-10.md
(titles/descs/tags + video-ID link table; themag8.com = line 1 of EVERY description; white-label
held — scout/lenses/engines/gates vocab, "Game Theory", safe cashtags, Bessembinder 4% only).
Mechanics: chrome-extension file_upload caps 10MB/call → owner bulk-dragged the 16 mp4s once; then
per-video automated loop via filtered Studio URLs + typed dates ("Jul 14, 2026"+Return commits) —
full coordinate recipe in the handoff. Channel carries old PRIVATE shorts + one unlisted video
(untouched; consider deleting for brand hygiene).
2026-07-10 later (Cowork session 2, same handoff, "SAME-DAY SETTINGS PASS" section): MAX-REACH
channel optimization SHIPPED — 15 shorts bulk-fixed Entertainment(12)/Education(3 lens)+English
(filter Visibility: Has-schedule FIRST; bare select-all grabs the old private shorts); channel
keywords replaced ("sad music/lofi/viral shorts" leftovers → 19 finance terms incl. next nvidia /
trillion dollar stocks / game theory investing); upload defaults fixed (default Category was MUSIC —
the-signal's wrong auto-guess explained — → Entertainment + English + themag8.com default desc);
themag8.com added to channel Links; watermark End-of-video → Entire video; 3 public playlists w/
scheduled videos pre-added (Three Lenses 4 / Engine Files 4 / MAG8 Memes 8; Studio bug: after
Add-videos→Done a stale dialog re-renders — click CANCEL, a second Done duplicates); Home tab was
OFF → ON + published (trailer=the-signal, playlist sections); waitlist comment POSTED on the-signal
(owner-approved) — PIN blocked: pinning needs the one-time verification too. White-label: every new
public string (keywords/playlists/comment) uses board vocab only, 0 leaks.
2026-07-10 latest (Cowork session 3, owner AFK, HANDOFF-2026-07-10-crosspost.md): CROSS-POST LIVE —
X the-signal (x.com/TheMAG8Stocks/status/2075715096454762550), IG Reel fun-dnatest
(instagram.com/themag8stocks/reel/DaoUc_2gjzj/), FB Reel the-signal (facebook.com/reel/1863010218417309);
pack captions, all verified rendering, leak-check clean. IG switched to BUSINESS (News & media website,
contact info withheld) → native 75-day scheduler unlocked; FB default audience → Public (FB is a PROFILE,
no Page = no scheduling); X free tier = post-now only (no scheduler; 140s cap fits the-signal). TIKTOK
BLOCKED: Studio upload hard-requires a real OS file-pick (clean-probe-verified; synthetic input/drop
feeds start the pipeline but never advance; account-type switch = mobile-app-only) → owner drags an mp4
into tiktok.com/tiktokstudio/upload, then any session finishes (caption staged in handoff). KEY TECH
(reusable): (a) Remotion/Chrome renders carry a malformed colr atom that HANGS TikTok's AND X's client
mp4 parsers — fix = `-c copy -movflags +faststart` remux + moov colr→free rename (byte-lossless;
`.uploads-tmp/r3-*.mp4`; r3-treat all 16 before future TikTok/X uploads); (b) extension 10MB attach cap
falls to chunk-feed: split -b 9437184 → file_upload per call into a collector input on a STATIC
same-origin page (robots.txt — SPA pages parse the chunks and lock) → JS reassembly → SHA-256 verify →
IndexedDB handoff → inject into the app page's input (74–106MB OK on X/IG/FB). `.uploads-tmp/` (~600MB)
owner-deletable; keep r3-*.
Same evening: TIKTOK LIVE too — owner dragged fun-groupchat.mp4, session automated caption/settings/
post (tiktok.com/@themag8stocks/video/7661107427600846093, Everyone, review cleared ~1 min); TikTok
web Studio has native Now/Schedule for this account (NO Business switch needed; 10-day window) —
future drags can be scheduled; NEVER touch the Location field (suggests owner's town); real file-pick
uploads need NO colr treatment (bug only hits synthetic-feed client parsers on TikTok/X).
2026-07-10 night (Cowork session 4, same handoff, "TIKTOK SCHEDULING PASS" section): TIKTOK SLATE
STARTED — owner's 5-file drag yielded only 3 web-side (**multi-drag is LOSSY — drag ONE at a time,
wait for Uploaded ✓**); fun-redflags SCHEDULED Jul 12 + fun-speedrun Jul 16 (12:00 PM, Everyone, HQ,
pack captions + hook lines, leak-clean, verified on /tiktokstudio/content); fun-gate LOST mid-pass —
TikTok's cleanup PURGED remaining IndexedDB temp drafts (`web_creation_draft`) when the other flows
completed → **process ALL pending "Continue editing" drafts before posting ANY; dump local_draft rows
first if >1 pending**; schedule consent dialog (first time) → Allow, remembered; time picker needs JS
scrollIntoView+pointer events (wheel hits the page). Owner-picked refill: dnatest Jul 14 / poker
Jul 18 / gate Jul 20 (captions staged in handoff) — drag didn't land before close, ANY session finishes.
2026-07-11: the-signal THUMBNAIL SET (marketing/youtube-thumbs/: a-4pct giant-4%+DNA-helix /
b-one-signal lens-braid→gold-90.3-node / c-next-one dimmed-winners→$-redacted-board-w/-gold-PASS;
720p uploads 240–340KB + @2x masters) + 3 alt titles appended to the upload plan (§the-signal).
Pipeline = scratch HTML (data-URI vendored app/fonts + brand/mark-ink) → headless Edge DSF2 →
ffmpeg lanczos — the OG-image recipe generalized; FORMULA §J is now the packaging contract (one
focal element ≤6 giant words, film laws bind, duration-badge corner clear, READ the PNGs, 3-up =
Test & compare). Setting them is blocked on open (3).
2026-07-11 later (Cowork session 5, crosspost handoff "DAILY CROSS-POST PASS"): one video per platform —
X fun-dnatest LIVE (x.com/TheMAG8Stocks/status/2076012772731900093; **X synthetic injection: use the
/compose/post MODAL — the inline home composer accepts the file but never starts APPENDMULTI**), FB
fun-dnatest auto-Reel Public (facebook.com/reel/1410937844199702), IG fun-groupchat Reel
(instagram.com/themag8stocks/reel/DaqcEVMJ41y), TikTok fun-dnatest (owner drag) SCHEDULED Jul 14
12:00 PM → slate redflags 12 / dnatest 14 / speedrun 16; poker 18 + gate 20 still need drags. YouTube
skipped (slate full). Extension file_upload's 10MB cap pre-validates a whole browser_batch (aborts before
ANY chunk lands) — chunk-feed = standalone calls only; gc.00-02 (groupchat) added to .uploads-tmp;
TikTok time picker takes plain clicks when target values are visible (JS pointer path only for off-screen).
2026-07-13 (Code): S0 v2 SHIPPED (HANDOFF-2026-07-13-universe-v2.md) — owner asked: more stocks free, dirty-data
audit, max deterministic filtering off the scout/lenses (trust SEC over model recall), everything website-tunable
w/ research-backed defaults. Audit: feed FRESH (12/12 quotes <1.4% vs Yahoo), but 11 CEFs + 48 same-yr IPOs +
5 sub-$2 in the old pool, AMEX absent. Shipped: AMEX (+293), SEC XBRL enrichment, 5 new screens, 19-knob settings
system (db>env>default, /admin panel + /methodology live disclosure), lens ground-truth blocks, extended pick
flags, +8 citations (→40). Default funnel: 7,106 → 2,030 eligible (SEC data 1,840/2,067). Fixture cohort survives
all defaults; IONQ +50.6% share growth grazes the 50% dilution knob = why that screen defaults OFF (flag-only).
W29 snapshot cached. Verified: tsc, seed EXACT, gen:bib no-op, build, live E2E (7.4s/8ms cache, deterministic,
override round-trip), leak probe 0-hit, Edge screenshots. NOT yet through a real run — Open (5).
2026-07-12 (Code): STAGE 0 UNIVERSE SCREEN SHIPPED — audit first (owner asked): discovery was a ~24–40-name
web-narrative hunt (prompt min(40,3N) + playbook 2–3×), and the sub-50 real-run ceiling is CALIBRATION, not
arithmetic (recompute audit: 24/24 real rows match on gate+confluence, scores within 0.1 = inside the ±1
drift tolerance; the scanner issued ZERO Buy across 24 real cells → no pass gate, no confluence ever; best
real base 65.5×0.75=49.1=VRT exactly; fixture ASTS 90.3 proves the scale's top works). S0 fixes sourcing:
~6.8k listings → 2,191 eligible → 300-name weekly pool into the S1 prompt (~4.9k-token prompt total); band
flags retro-probed on the W28 cohort disclosed VRT $122.5B above / SERV $458M below (real runs had delivered
$56–122B names into the $1–50B mandate unflagged). Verified: tsc, seed regression exact, next build, live
probe (fetch 3.5s → cache 6ms, deterministic slice); W28 snapshot cached. NOT yet through a real discovery
call — see Open (5). Rubric calibration levers (caution ×0.75, growth-stage gate metrics) deliberately
untouched = owner decision.
2026-07-28 (Code): RESUME (E) SHIPPED + W31 RUN FINISHED OFF THE FLOOR — owner: "finish run faaa8ffe, I ran
out of tokens, and add a resume button for admin testing on my subscription". Run faaa8ffe (2026-07-27, the
FIRST post-S0v3/C+D real run, count=8 force) had died at the 5-hour plan limit with discovery complete + 8/24
lens cells banked and $7.80 spent — no report, no rankings, and no way to continue: the only path was a fresh
run that would re-spend Stage 1 and re-do finished cells. SHIPPED `lib/orchestrator/resume.ts` + `executeResume`
(see Map) + admin-only button on /admin AND the run page's error banner + `POST /api/runs/[runId]/resume` +
`npm run pipeline -- --resume RUN_ID`. Stages 2–3 were EXTRACTED into one shared `analyzeAndCompile` so fresh
and resumed runs can't drift. Resume is idempotent and re-entrant BY DESIGN — proven the hard way: attempt 2
banked 6 more cells (8→14, $12.88) before the window died again, attempt 3 picked up at 14/24 with zero
re-spend. THE ROLLING WINDOW RECOVERS CONTINUOUSLY: a limit-abort is worth retrying within the hour, not only
after the stated reset time. SSE had to be fixed for this to work at all: a resumed run's log carries its
earlier attempt's terminal event MID-log and both ends treated it as end-of-stream (see invariant 1) — verified
live, 98 frames streamed past the historical run_error that previously truncated the feed. WHITE-LABEL FIX
found by the mandated leak probe (PRE-EXISTING, not from this change): lens write-ups cite their own
instructions as "the skill" ("per the skill's pre-profit edge case" — FIG/SEI/SITM) and `sanitizeMarkdown`'s
narrow pass never caught the bare word → 4 self-reference tokens added to EXACT_TOKENS (capitalized variants
first, so sentence case survives) + the lens prompt's naming discipline now bans GENERIC self-reference, not
just names. Deliberately NOT scrubbed: the same words as SUBJECT MATTER ("agentic AI", "AI agents", a source
URL containing `ai-agents`) — that is the market talking, and rewriting it would falsify analysis prose and
break real links. CONSEQUENCE: the leak grep as literally written still flags those; the gate now means ZERO
ARCHITECTURE hits, with market-topic matches an owner-call false-positive class (§ open item 7).
Gates: tsc clean, seed EXACT (ASTS 90.3 … ACHR 19.3 #8), gen:bib no-op, next build clean (route
`/api/runs/[runId]/resume` registered), leak probe 0 architecture hits on /,/rankings,/methodology,/lab,
/stocks/ASTS,/runs + snapshot + SSE.
Open: (1) signups store, nothing sends; (2) Railway trial → Hobby before the credit runs out;
(3) YouTube one-time channel verification = the ONE unlock left (desc+channel links clickable,
custom thumbnails, AND pin the posted comment) → then set the ready thumb set (marketing/
youtube-thumbs/, 3-up Test & compare) + pin; (4) cross-post: all four platforms at 2+ videos
live/scheduled (07-11 pass); remaining ≈12-13 shorts per platform + scheduling slate (IG business
scheduler ready 75d; TikTok drag-then-schedule 10d — poker Jul 18 / gate Jul 20 drags next; X manual)
still open; (5) first post-S0v3 real run: verify the scout draws from the RANKED head (else tighten poolBlock
discipline), marketContext carries the screen-scale + ranked-long-list line, the funnel `discovery_activity`
line renders in Mission Control, lens write-ups cite "per SEC filings" (now incl. rev growth) from the ground
blocks, delivered-pick flags land in gapsNoted — then `npm run audit:salience` for the before/after delta
(target: baseline overlap falling from 84%, fund-ranks strengthening; both honest either way).
(6) C+D shipped but UNRUN live (owner: zero API spend): after the first post-B real run, if salience overlap
stays high, turn ON the selection knobs (start ~rankedFloor 3–4 / salienceCap 3–4 via /admin, hard gate once
soft flags look right) and/or run a `--blind` lab run — then `audit:salience` for the blind-vs-sighted delta on
the SAME week (§7 of the 07-16 handoff). Note: blind mode does NOT also apply the selection quota (blind is the
stronger discipline); Finance-sector OCF still misreads the ranked head (future exemption knob, same as runway).
(7) LEAK-GATE FALSE POSITIVES — owner call: the grep bans the bare English words, but real 2026 market prose
legitimately says "AI agents"/"agentic AI" and cites source URLs containing `ai-agents`. Architecture
self-reference IS now scrubbed (2026-07-28); subject-matter uses are NOT. Pick one: (a) keep as-is and read
the gate as "zero ARCHITECTURE hits" (current), (b) whitelist `agentic|AI agents|https?://\S+` in the grep
before matching, or (c) scrub market prose too — rejected here: it falsifies analysis and would rewrite the
real source links invariant 11 requires.
2026-07-16 (Code): RANKED POOL + SALIENCE AUDIT (HANDOFF-2026-07-16-ranked-pool-salience.md) — owner concern
"discovery just picks article-famous names" VALIDATED with data, root cause = TRAINING-PRIOR salience, not
runtime articles (disabling search would worsen it; coverage-blocking just slid picks down the same fame list).
Instrument: cold tool-less Sonnet listed its own 200 "next mega-cap" names → 84% of 70 real pick-slots inside
it vs ~6% random draw. Shipped: (B) S0 v3 — sec.ts annual() keeps prior-FY same-tag pairs, rankEligible()
composite orders eligible, top-100 digest head in the prompt (~6.7k tok), rotation + off-pool escape intact,
knobs rankPool/rankTopN (→21), citations +Sloan1996 +Chan-Karceski-Lakonishok2003 (→42), lens ground block
gains rev-growth, playbook Step 2 inverted pool-first, /methodology + describeScreen disclose; (A) lib/
salience.ts + npm run audit:salience. Gates: tsc, W29 re-probed (rev0 on 3,416; determinism IDENTICAL; VAL
stub-rev artifact → $25M margin floor), seed EXACT, build ×2, leak 0-hit (homepage 26-AGENTS exception only).
(Memory twin synced 2026-07-16.)
2026-07-26 (Code): SELECTION DISCIPLINE (C) + BLIND LAB (D) shipped — the two ladder rungs the owner deferred
in §6 of the 07-16 handoff (HANDOFF-2026-07-26-selection-blind.md). BOTH knob-gated & DEFAULT-NEUTRAL (zero
behavior change until opted in — so all regressions held). (C) 3 selection knobs (rankedFloor 0 / salienceCap
12 / selectionHardGate off) → `lib/orchestrator/selection.ts` `applySelectionQuota()`: ranked-head FLOOR +
consensus CEILING (measured vs `salienceRank`), soft=flag-only / hard-gate=deterministic reject&replace from the
ranked head (synthetic digest-derived thesis, length-preserved); `selectionQuotaBlock` in the discovery prompt
(qualitative — the salience list is NEVER shown to the model, anti-gaming + white-label); flags→extraGaps→
gapsNoted; probe-verified 8 scenarios (floor/ceiling/both/no-pool/no-dupes). (D) `blind` RunParams flag →
`lib/orchestrator/blind.ts` `runBlindDiscovery`: S1a tool-less picks a shortlist from ANONYMIZED cards (no
ticker/name — deck=ranked head ≤60, week-seeded shuffle, size-bucketed, id→row unblind map) → S1b skill+web
researches the un-blinded shortlist (⊆shortlist enforced); fail-open→normal discovery w/o a ranked pool; lab
toggle + BLIND chip (RunView/history) + `kindClause` excludes blind from canonical (never displaces the weekly
board) + audit tags blind runs. Disclosure: selection group on /admin+/methodology (auto), lab-page copy, +1
citation Barber&Odean2008 (universe group, gen:bib no-op, chip→44). Gates: tsc clean, gen:bib no-op, seed EXACT
(ASTS 90.3…ACHR 19.3 #8), next build clean, leak probe 0-hit across /,/rankings,/methodology,/lab,/stocks/ASTS,
/runs + snapshot + SSE (only the 26-AGENTS homepage exception). NOT yet through a real run — Open (6).
2026-08-30 (Code): BOTTLENECK DESK Phases 1–4 of 7 — a SECOND PRODUCT, not a pipeline stage
(HANDOFF-2026-08-30-bottleneck-desk.md; plan `~/.claude/plans/i-just-dropped-two-logical-rabin.md`; source docs
`bottleneck-research-framework.md` + `claude-code-implementation-prompts.md` at root). Owner: "built into mag8
as a feature… its own separate feature not combined into the current mag8 stock analysis tool". Owner decisions:
same app / named **Bottleneck** (`/bottleneck`, `bottleneck_*`) / 13F holdings public but sizing admin-only /
vitest + live probe. KEY CALL: the framework is **Stage-0-shaped, not pipeline-shaped** (fetch→parse→arithmetic),
so it costs $0 and draws ZERO plan window — keep models out of the critical path. Build order INVERTED vs the
prompts: playbook config FIRST, so AI-infra is one instance not a later refactor. SEPARATION CONTRACT: desk
writes only `edgar_cache`/`bottleneck_*`/`bottleneck_` app_settings, NEVER runs/candidates/lens_analyses/
rankings/progress_events/universe_snapshots, never touches the leaderboard — enforced structurally (zero FKs
into pipeline tables). Shipped: `lib/edgar.ts` shared transport (sec.ts delegates, byte-identical — CIK map
10,391 + a 5,727-row frame hash identically, W32 screen fingerprints unchanged); shared
`lib/settings-registry.ts` (all 24 universe settings verified identical after migration) + 12 desk knobs +
/admin panel; Module B demand ($573.72B TTM across MSFT/AMZN/GOOGL/META/ORCL/NVDA, +85.7% YoY); Module C supply
+ scoring — **live reading: MW of critical IT load TIGHTENING at +81.9pp gap (demand +85.7% vs supply +3.8%),
memory second at +68.7pp**, two categories honestly NOT MEASURED. FOUR live-data bugs found, all pinned by
tests, all of which produced plausible WRONG NUMBERS with no error: (1) capex filed fiscal-YTD → naive latest-
10-Q = 2.8× overstatement (Apple $6.799B vs a real $2.455B quarter); (2) TAG DRIFT — AMZN/NVDA migrated tags,
first-populated-wins read Amazon's 2017 capex $1.86B against an actual $54.21B; (3) same quarter tagged twice
(direct + inside the YTD run) inflated TTM — MSFT $127.43B → $115.95B = exactly its filed FY; (4) 13F info
tables come BOTH unprefixed and `ns1:`-prefixed from the SAME filer, and a prefix-blind parser returns ZERO
holdings silently. Also: 5 errors in the source prompts corrected (`reportDate` not `periodOfReport`; exhibit
filenames vary; `primaryDocument` on a 13F is an XSL cover-page path; `Put`/`Call` title case and ABSENT on
stock; no FIGI column) and the framework doc's claim about the reference fund's "multi-billion options overlay"
is NOT what the filing says (23 long $20.169B vs 3 options $73.26M) — never encode a doc's characterisation.
MY OWN MISDIAGNOSIS, corrected: FRED looked unreachable from Node (resets across every TLS/ALPN combo, curl fine)
and I built a curl fallback on it — wrong, FRED just hangs on spoofed `Mozilla/5.0` and undici's default UA and
answers an honest one in 269ms; fallback removed. Gates: tsc, 120 vitest, seed EXACT, gen:bib no-op, build,
probe, leak 0-hit on /bottleneck (only the 2 homepage 26-AGENTS exceptions), curtain 404 verified.
NOT PUSHED — branch `feat/bottleneck-desk`. OPEN: all 4 conversion factors
are seeded PLACEHOLDERS (they don't affect the ranking — a rate is unaffected by its divisor — but absolute
units are order-of-magnitude only; replacing them is research, not code, and is the highest-value item left);
2 categories unmeasured; pixel-level 375px never verified (headless Chrome AND Edge return an EMPTY DOM in this
environment — new quirk, structural check used instead).
2026-08-30 later (Code): BOTTLENECK PHASES 5–8 — the desk is FEATURE-COMPLETE against the source prompts
(HANDOFF-2026-08-30-bottleneck-phases-5-8.md). Owner: "resume working through all left over phases". (5) Module A
13F clone — fixture reproduces EXACTLY (26 rows → 23 long $20,169,035,068 + 3 options $73,257,160, SNDK 28.13%);
holdings/diff PUBLIC, sizing ADMIN-ONLY, never broker-wired; diff classifies by SHARE COUNT (a price move is not
a trade). MY OWN WRONG NUMBER, caught live and fixed: the resolution ladder ranked an unrestricted OpenFIGI
lookup above the local snapshot and returned **`1B2`, a Frankfurt symbol, for Nasdaq-listed Bitfarms** — US
sources now outrank it and a foreign-only row gets a $ weight but NO share count. Also better than the plan:
a foreign CINS needs **idType `ID_CINS`**, not a retry without exchCode (which fails identically). (6) Module D
exposure — admin-only, one app_settings key, orders categories by the DESK's ranking, ALWAYS states the
counter-evidence. (7) /methodology#bottleneck renders LIVE effective settings; +7 citations in a new `bottleneck`
group, each verified against the primary source this session — incl. Titman/Wei/Xie 2004 and Cooper/Gulen/Schill
2008, the inconvenient ones (heavy capex → WORSE returns). **Homepage chip 44 → 51 ACADEMIC WORKS CITED** (auto-
computed; public copy — flagged). Jacks 2019 is cited for long-lived deviations from trend, NOT the plan's
"supply takes a decade" — the paper does not say that. (8) THREE themes (ai-infrastructure, ev-battery-supply-
chain, homebuilding — the last deliberately does NOT fit the capex shape and says so); no-code playbook editor
on /admin (validates whole-set or saves nothing); Lab seam = a URL and nothing else. Two general Module B wins
from building them: `conceptFromFacts()` fallback (**companyconcept returns `units:{USD:{}}` where companyfacts
has 158 facts** — Ford invisible; now $2.376B/$9.37B TTM) + 2 fragility flags (netting, near-zero-base YoY).
FLAGSHIP REGRESSION HELD byte-identical: $573.72B TTM, +85.7%, 6/6, MW +81.9pp, memory +68.7pp. NOT DONE, needs
the owner: the optional tool-less narrative brief (it puts a model into a deliberately model-free product).
Asked "is all the work done?" I re-read the plan instead of recalling it and found TWO committed-scope misses,
both now closed in `components/bottleneck/DeskControls.tsx` (server-gated, actions re-check the token): a manual
**Refresh** on the desk (the plan forbids a scheduler and mandates "snapshot-on-read + a manual Refresh on the
desk + a headless script" — only the script existed, so prod would have shown the last CLI run forever), and
**hand-entered supply observations** — which made PUBLIC COPY UNTRUE, since the desk's own flags say "dated
observations can be entered by hand" and there was no way to. Verified then cleaned up: a stub series at 0 obs
went insufficient-data → TIGHTENING (supply +20%, gap +65.7pp) on 5 hand points, and back on delete; no invented
data left in the DB. Unit comes from the playbook's series def, never the form. Still out of scope PER THE PLAN:
cron/scheduler, push alerts, brokerage, accounts. Deviation: no tracked-filer list — /bottleneck/clone reaches
any filer by search or ?cik=. OWNER-REPORTED BUG, fixed: clicking Refresh during a transient SEC transport outage read 0/6 and BLANKED THE
DESK — the failed snapshot was persisted over a good $573.72B one. Three fixes, all general: (a) `describeFetchError()`
unwraps undici's `cause` ("fetch failed" alone made DNS/refused/TLS/timeout indistinguishable); (b) **a reading in
which NOTHING was read is never stored** — same rule as "a missing company is flagged, never a zero", applied to the
basket; `buildDemandSnapshot` AND `refreshDesk` both withhold, and the action reports the transport reason not "0 of
6"; (c) `priorReading` SKIPS dead readings — a gap measured against zero demand moves by the whole gap and reads as a
fictional tightening that can trip the materiality flag. `latestDemand` also skips them on READ (un-blanks a desk with
no refresh); `refreshDesk` sweeps them via `pruneUnusableReadings()`. 7 junk rows pruned. NB `_`-prefixed app dirs 404
— a temp diagnostic route must NOT be named `__diag`. Gates: tsc, 231 vitest (was 120), seed EXACT, gen:bib 4× no-op,
build, probe ALL PASS, leak 2-hit (homepage exception only) across 10 surfaces + snapshot JSON, curtain 404 on all
three desk routes, admin gating verified with a real ADMIN_TOKEN (locked payload carries neither sizing nor controls).
2026-08-30 (session 3, Code): THE ROTATION BOARD — a THIRD product, feature-complete against its
source spec + all six prompts (HANDOFF-2026-08-30-rotation-board.md; plan
`docs/rotation-indicators/ARCHITECTURE_PLAN.md`; source docs moved to `docs/rotation-indicators/`).
Owner: "code out the next feature... its own seperate independent feature". Owner decisions: the
deterministic note always on + the spec's model note built but DEFAULT-OFF / recharts not the spec's
lightweight-charts / manual refresh + CLI, NO scheduler / full catalog A-F, category G deferred.
Same Stage-0 shape as the desk: $0, zero plan window, no model in the critical path. Branch
`feat/rotation-board` (off feat/bottleneck-desk, which is itself unmerged) — NOT PUSHED. Live
reading 2026-08-28: nothing in the top tier; HYG/IEF 5.0 (credit appetite at the 100th percentile,
z +2.04), XLU/SPY 6.7, sector leadership late-cycle at 75% match, VIX in its 3rd percentile.
THREE of the spec's Section 6 recommendations did not survive: its Python stack (no Python here),
its fallback source (Stooq now answers a JS challenge page → replaced with api.nasdaq.com, already
proven in the universe screen), its charting library (recharts already installed, no attribution
obligation). FIVE findings, each of which produces a plausible WRONG NUMBER silently: (1) ^VIX
trades sessions the funds do not — it printed Memorial Day 2026-05-25 — so a positional zip shifts
five years of history; ratios join on DATE, checked live by --probe every run. (2) the fallback
returns RAW closes where the primary returns ADJUSTED, so a silent source swap moves a ratio's
level → bars record their basis, a source switch REPLACES a ticker's history, and a mixed-leg ratio
is shown+flagged but barred from raising a signal. (3) MY OWN planning figure was wrong: RSI means
Wilder's smoothing, not the simple average my probe used — 48.1 not 57.5, so the flagship scores
1.1 not 1.3; cross-checked against a second independent implementation to four decimals, and the
architecture plan is corrected in place. (4) MY OWN guard was wrong: exact string matching rejects
0.2869 for a computed 0.28685 (binary holds it a hair low), so verifyBriefNumbers now tolerates half
a unit of the last place WRITTEN. (5) the spec has no direction deadband, so a flat ratio would flip
daily and — since a flip is the note trigger — raise a note nearly every day. CALIBRATION FINDING,
reported not silently fixed: the published formula scores the flagship 1.1/No Signal while it sits
at the 22nd percentile of its 3y range, because all three scored marks are short-horizon and
percentile is computed, displayed and never scored → shipped exactly as published, with a fourth
component whose weight DEFAULTS TO 0 as the documented lever (/admin, and /methodology prints a
different paragraph the moment the weighting stops being the published one). State history is
COMPUTED from bars rather than logged — 110 chart marks on the flagship from day one, correct after
a retune, and no state table to drift. 7 citations, each verified against its primary source this
session, incl. the two that argue AGAINST the product (Sullivan/Timmermann/White 1999 on data
snooping — 25 ratios x 4 tiers is exactly that setting, and the page says so; Daniel & Moskowitz
2016 on momentum crashes clustering when volatility is high — why the VIX gauge is context, never a
signal). Homepage chip auto-counts 51 -> 58 works cited (public copy, flagged). Gates: tsc, 375
vitest (was 231), seed EXACT, gen:bib 4x no-op, build, probe ALL PASS, leak 2 hits across 13
surfaces + snapshot (homepage exception only; ZERO on all four rotation surfaces and on
/methodology), curtain 404s both routes, admin gating verified with a real ADMIN_TOKEN, separation
contract verified (no pipeline imports, no SQL outside lib/db.ts, no FKs). NOT DONE: the chart has
never been seen in a real browser (recharts measures client-side; headless returns an empty DOM
here — one look before shipping), and the model note has never actually run (off by default, owner
spends nothing on API). Env note: git-bash heredocs are unreliable in this harness — write a Python
script and run it.
2026-08-31 (Code): THE INSIDER TURNAROUND SCANNER — a FOURTH product, feature-complete against
its source document's eight phases (HANDOFF-2026-08-31-insider-turnaround.md; plan
`~/.claude/plans/ive-uploaded-a-insider-melodic-truffle.md`; source doc
`mag8-insider-turnaround-scanner-build-plan.md` at root). Owner: "code this feature as a new
feature for MAG8". Owner decisions: sweep restricted to the Stage-0 eligible universe (~2,069
names) / public risk presets recomputed on read PLUS admin knobs / public page with admin-only
controls / product model-free with a separate playbook wrapper. Same Stage-0 shape as the desk
and the board: $0, zero plan window. Branch `feat/rotation-board` — NOT PUSHED. FOUR of the
document's stack choices did not survive (no Python here; lib/edgar.ts already is the SEC
client; Stooq is dead so rotation's two-source fetcher stands in; the settings registry beats a
config.yaml). THE ONE UPGRADE beyond the document: **nothing derived is stored** — no
candidates/scores/rankings table — so changing the drawdown band, discount rate or required
cushion re-derives the whole list INCLUDING each rejection reason with zero fetches, which is
what turns "every threshold is a real parameter" into a control a VISITOR can use. Live: house
3 ranked, aggressive 4, one company's estimate moving $142.17→$185.75 with the discount rate.
TEN findings, each of which produced or would have produced a confident wrong number: (1)
`aff10b5One` arrives `1/0` AND `true/false` from different agents the same day — `=== "true"`
reads a planned buy as discretionary, the HIGHER-conviction reading; (2)
`reportingOwnerRelationship` omits false flags; (3) one filing can name several owners and its
buys were made ONCE by the group; (4) a purchase can be filed with no price — flagged, never
summed as zero; (5) **SEC answers an absent daily index with 403, NOT 404** (every weekend,
holiday, and today pre-publication) so the shared client's "403 = bad User-Agent" rule would
declare a broken config 17× over ordinary weekends — a refusal is now an absence per-day while
a window of NOTHING BUT refusals is a fault, never "no filings"; (6) **MY OWN BUG, the one this
repo had already met**: first-populated-wins on an XBRL tag chain loses a whole fiscal year —
Ford migrated FY2025 revenue to a new tag and looked unfiled; after merging the chain, FY2025 is
−$8.16B net income and Z 0.794 DISTRESS (same shape as the AMZN/NVDA demand-module bug); (7)
share counts are cover-page dated, not year-end, so an exact match found nothing for the MOST
complete filers (RSG 7/9 on 8 criteria → 8/9 on 9); (8) rotation's fallback price source was
pinned to `assetclass=etf` and a common share answers "Symbol not exists" — silently dead for
every candidate; (9) three generated sentences true of the arithmetic and false about the stock
(a +49.6% 8-week return called "the fall has slowed"; a price 8.6× the estimate called a
"-759.5% cushion below it"); (10) **MY OWN WRONG CITATION ASSUMPTION**: I expected Brochet 2010
to show the 2-day filing rule eroded Form 4 returns — it shows the OPPOSITE, purchase filings
became MORE informative; and Seyhun's outsider-after-costs conclusion could not be verified from
any reachable primary source so it is NOT claimed. 6 citations, each verified this session,
including the two that argue AGAINST the product (Lakonishok & Lee: the effect is concentrated
in SMALL companies, which this pool excludes — said on the board and on /methodology; Cohen,
Malloy & Pomorski: routine insider trading predicts essentially nothing). Homepage chip
auto-counts 58 → 64 ACADEMIC WORKS CITED (public copy — flagged). Solvency correctly REFUSES to
score banks and REITs (no classified balance sheet) and shows NOT MEASURED rather than 0. Gates:
tsc, 592 vitest (was 381), seed EXACT, gen:bib idempotent, build clean w/ both routes, probe ALL
PASS, leak probe ZERO architecture hits across 14 PRODUCTION surfaces + snapshot JSON incl. every insider view and
/methodology (only the 2 homepage exceptions), curtain 404s both routes w/ the homepage
link-free, admin gating verified with a real ADMIN_TOKEN on a prod build, separation contract
holds (read-only universe access, no FKs). FULL 60-DAY RUN DONE: 41,110 filings listed → 9,594 read from
screened companies, ZERO failures, 24.7 min; funnel 197 with insider buying → 136 meeting thresholds →
58 worked up → 39 through the band → 25 through the strength gate. DKS is the reading to remember:
$2.70/sh conservative vs $320.70 maintenance, **11,796% apart**, disclosed — which is what publishing
two bounds is FOR. OPEN: only the top `maxCandidates` (60) of 136 are worked up per refresh, the rest
listed as not-worked-up; never seen at 375px (headless
browsers return an empty DOM here); and the universe restriction is the real open question about
the PRODUCT — widen the sweep (a knob, ~4× the fetching) or leave it and keep saying so.
NB the Bash-tool heredoc path EATS backslashes: write files containing regex escapes with the
Write/Edit tools.
2026-09-01 (Code): BOTTLENECK — FOUR RESEARCHED THEMES (HANDOFF-2026-09-01-bottleneck-four-themes.md).
Owner: "adding onto the bottleneck feature i want to add a few big major industries… the same quality of
research… government filings, official company reports, the most accurate, validated, reliable, reputable
information: drones, robotics, quantum, nuclear energy." Desk 3 themes → 7. NO new routes/tables/settings —
a theme is data, which is what the abstraction was for. Every conversion factor read from the PRIMARY
document this session: Army FY2026 Aircraft Procurement justification P-1 Line 5 ($250.141M / 951 systems =
$263,029/sUAS); USGS MCS 2026 Rare Earths (NdPr oxide $69/kg) + Helium ($330/Mcf Grade-A); BLS OEWS May 2025
(aircraft assemblers $71,420 · mechatronics techs $76,420, **15,520 in the whole US** · physicists $171,180,
**20,430**); A3 full-year 2025 (36,766 robots / $2.25B = $61,198); EIA/Sargent&Lundy Jan-2024 Table 1-2 Case 9
(AP1000 brownfield $7,861/kW 2023$, SMR $8,936/kW); EIA Uranium Marketing Annual rel. 2026-07-29 ($58.46/lb
U3O8e · $108.70/SWU, 13M SWU from FOUR sellers). LIVE readings persisted: drones 6/6 $190.2M +62.4%
(assembly labour +61.7pp tightest), robotics 6/6 $1.07B +36.6% (robots +36.5pp; spending implies 13,959
technician-years against 15,520 technicians nationally), quantum 4/4 **$630.5M of R&D** +60.8% (physicist-years
+60.2pp; 3,683 implied against 20,430 physicists), nuclear 6/6 $4.60B +90.2% (U3O8 +89.4pp; **SWU correctly
insufficient-data**, ranked last, disclosed). FLAGSHIP HELD byte-identical ($573.72B, +85.7%, MW +81.9pp,
memory +68.7pp) after shared series ids gained writers. TEN findings, each a confident wrong number: (1) a web
summary divided the SAME Army line $34.368M÷265 = $129,681 — the page buys 265 SRR **and 500 PBAS**, ~3× wrong;
the figure used is the whole line over the whole quantity, cross-checked by three sub-lines summing to the
stated total; (2) **RCAT = the THIRD tag-migration case** (after Ford, AMZN/NVDA): PPE stops 2019-07-31 at
$3,000, ProductiveAssets runs to 2026-06-30 at $18.6M — freshest-wins caught it on a basket it was never
designed against; (3) THREE government hosts, THREE opposite UA rules — asafm.army.mil 403s an honest UA AND
WebFetch, needs FULL browser headers (Accept/Accept-Language/Referer/Sec-Fetch-*); comptroller.war.gov serves
to an honest UA; FRED HANGS on a spoofed one (its /series/ pages too, not just the CSV); (4) **Census
international-trade API now requires a key** ("Missing Key") — kills the HS 8806 / HS 8479.50 unit-value route
(value AND quantity, the ideal $/drone and $/robot); named as stubs; (5) **DOE publishes NO He-3 price** —
isotopes.gov is a quote form; the quoted $600/$1,000 per litre is a magazine, so He-3 is a supply STUB not a
factor (USGS's helium chapter is the citation that names quantum computing); (6) **CAPG3364S does not exist** —
FRED has aerospace OUTPUT, no aerospace CAPACITY (also absent: CAPG3345S, CAPG3251S, CES6054170001) — probed,
never assumed; (7) SYM stopped tagging capex after 2024-12-28 across ALL 8 of its Payments* tags → kept OUT of
the basket (permanent staleness flag, no contribution), put in the owner map; (8) **MY OWN fallback bug, caught
by RENDERING not by a test**: `measure ?? "Capital spending"` mislabelled homebuilding's existing snapshot —
the exact inaccuracy the field was added to remove; falls back to the PLAYBOOK's measure now; (9) the CLI
printed `$58` for a $58.46 factor in the working shown beside it — `usd()` keeps cents under $1,000 (the web
page was already right); (10) ATS = CIK 1394832, verified SIC 3569 / NYSE / 6-K = the Canadian automation
company, not the defunct US IT-services firm — all 42 tickers resolved against SEC before shipping. NOT
claimed: robotics' unit price is A3's, not a government statistic (no agency publishes one; the gated Census
route would be); NOTHING added to `lib/citations.ts` (it is a registry of ACADEMIC WORKS — a budget book and a
commodity summary are primary data; homepage chip stays 64). /methodology now says "4 of 7 themes have had that
work done" and names them, so the placeholder note can't be read as covering the desk. Gates: tsc, 639 vitest
(was 592), seed EXACT, gen:bib no-op, build, probe ALL PASS, leak 0 architecture hits across 18 surfaces incl.
all 7 theme pages + /methodology (only the 2 homepage exceptions), curtain unchanged (themes are query params
on the already-guarded page). OPEN: the 3 ORIGINAL themes still carry placeholders (same job, one at a time —
homebuilding's trade wage is now easy, BLS OEWS is proven parsed); SWU has no automated feed (hand entry only);
never seen at 375px.
2026-09-02 (Code): THE SOURCE STANDARD + THE EVIDENCE LAYER (HANDOFF-2026-09-02-reach-evidence.md;
review + rejected design in `docs/agent-reach/README.md`, source doc moved there). Owner: "review the
mag8 agent reach integration prompts… ensure agent reach can be built smoothly into mag8… then
integrate it to improve the quality of the outputs", noting the prompts were written without codebase
access and the method was my call. VERDICT: idea right, mechanism wrong. SIX structural reasons the
CLI path fails here, all verified — the leak gate fails PROVABLY (`agent-reach` matches the banned
agents? pattern AND every Bash call is rendered verbatim into Mission Control); $1/30-turn/8-min lens
cap that has already killed a cell; CLI text carries no URLs so it would PUSH cells INTO the <3-link
thin-sourcing flag; the Railway container; bypassPermissions + a 3rd-party installer. NINE factual
errors in the doc (new-gen-stock/SKILL.md is an 8-LINE STUB and all five of its Prompt-3 targets live
in references/playbook.md, which it never names; institutional-forecast DOES have references/;
gt-predictor has no "Step 2A" heading; "load all five" breaks on a new row; stock-scanner Step 2 is
Broad-Scan-ONLY; bibliographies are GENERATED; no shared/ dir, no project-brief; a .sh is the wrong
shape). MEASURED coverage decided the build: SEC filings ~100% (and ALREADY half-built in lib/edgar.ts,
never called by the pipeline) · official releases per-thesis · GitHub ~15% · issuer IR RSS brittle,
skipped · **Jina Reader, Reach's flagship zero-config channel, is DEAD from this network** (401
"blocked from performing anonymous queries due to bad network reputation (AS7922)") · Reddit/X/FB/IG/
XHS = NOWHERE (owner decision: cannot run headless, ban risk on a real account, and Tier B by the
doc's own standard). Owner decisions: native equivalent only / all three channels / social nowhere.
Shipped `lib/source-standard.ts` (311-token block in EVERY discovery+lens prompt, generated into 4
playbooks, verbatim on /methodology) + `lib/reach/` + 8 knobs + /admin panel w/ two catalogue editors
+ /methodology section + `npm run reach`. ELEVEN findings, each a confident wrong number: S-8 is NOT
a capital raise (ASTS's ONLY S-form in 180d IS one — counting it turns a true zero into a false
raise); form PREFIXES not an exact set; the Fed CDATA-wraps every link+date; **BLS release feeds are
ATOM served from `.rss`** so the dialect is sniffed never declared; charset read not assumed; **the
cap had to be PER SOURCE** — a global newest-first cap silently excluded BOTH monthly BLS releases,
the jobs report and CPI, visible only by READING the output; EIA ships a dead link (`detail.php?id=`
with the id missing from its own XML); an empty org is NOT MEASURED never a zero (SYM/ACHR/RKLB/S all
hold a registered handle publishing nothing); resolution curated never guessed; and MY OWN
destructive CLI bug caught live TWICE (`--refresh --force` read "--force" as a ticker and replaced 8
real companies with an entry named "--FORCE"; then force itself deleted a whole week). Gates: tsc,
721 vitest (was 639), seed EXACT, gen:bib idempotent, build, probe ALL PASS, 13F+Form4 byte-identical
after the xml.ts additions, leak 0 hits across 13 surfaces, curtain 404s even with a valid token,
admin gating verified on a prod build, separation holds (user_version 7, one additive table, zero
FKs). OPEN: never run live — the ONE plan-window step is the owner's, `npm run pipeline --
--lens-probe IONQ` before/after (+376 tokens for a normal lens, +786 for gt-predictor; expect source
links to go UP); the handle map is 17 names and extending it is research; no prior week yet so trends
start next week; never seen at 375px.
2026-09-03 (Code): THE CROSS-DESK LEDGER + ROTATION CONDITIONAL BASE RATES
(HANDOFF-2026-09-03-crossdesk-baserates.md). Owner asked to brainstorm whether **MiroFish** (open-source
multi-persona social simulator, OASIS/CAMEL-AI, AGPL-3.0, NO published accuracy validation) could improve
Mag8, then said to build the two ideas that survived — **neither of which needs MiroFish**. Why it was
rejected, on file: Mag8's OWN source standard kills it (sentiment is Tier B, a lead never evidence; a
simulated crowd is SYNTHETIC Tier B and can move no score); it wants an OpenAI-compatible endpoint and the
Agent SDK is not one, so a shim would put a simulation in competition with the 5-hour window that already
killed faaa8ffe twice; the box is an RTX 5070/12GB = the offline fork's MINIMUM not its recommended tier;
"multi-agent swarm" is the agent-reach leak trap verbatim; AGPL network copyleft would arguably oblige
publishing Mag8's source. Shipped instead: (A) `/crossdesk` + `lib/crossdesk/` + 4 knobs + CLI + /admin
panel + /methodology section; (B) `lib/rotation/baserates.ts` + 3 knobs + a `baserates` settings group +
detail-page section + board column + `--baserates` CLI + /methodology prose. **NO new table, user_version
stays 7, nothing derived is stored in either.** SIX findings, each a confident wrong number: (1) five years
of closes could not support a base rate AND would have published the WRONG SIGN — 439 usable days, RSP/SPY
in its own bottom decile on 316 of them = 12 episodes, and the 63-day mean flips −1.21%→+0.24% at 20y;
(2) **MY OWN plan figure was wrong and the code is stricter than I was** — I predicted 7 board∩bottleneck
crossings from raw `rankings`; the ledger says 5 and is RIGHT, because the canonical board excludes
focused runs and AVAV+RCAT appear ONLY in one (verified in the DB); (3) `loadSeries` had a hard-coded
`limit=3000` while `getBars` returns the NEWEST rows, so 20y would have silently dropped the oldest 8 years
with every page still describing the full span; (4) episodes need a MERGE TOLERANCE — a flickering
condition fragments 316d/12ep into 86d/**20ep**, inflating apparent n exactly as the real sample shrinks;
(5) `bandSharePct`, added only after READING real output: xlk-spy sits in its own "top decile" for **49%**
of its measurable history, so >40% now prints BARELY CONDITIONAL; (6) two copy bugs from case-folding
author-written labels ("us-listed", "its the build in land and homes under construction is part of…") —
labels are now interpolated whole. Live: 20y stored (31 ok/0 failed/0 thin/140,970 closes/20.7s, no basis
switches); all 25 ratios clear the 8-episode floor, xlu-spy +1.75pp over 32 visits at 72%, xli-spy +1.54pp
at 80%, flagship rsp-spy **−0.35pp** (low breadth has NOT historically been followed by breadth
recovering); ledger 7 crossings of 244 named, **board ∩ insider = 0** (disjoint by construction, said on
the page). readBoard 95ms→279ms at 4× bars. Same session, owner follow-up: **a company in MULTIPLE bottleneck themes now crosses on its own axis**
(their example, CEG, was exactly right) — 7 → 13 crossings; VST crosses on BOTH axes. The distinction that
earned its keep: MP and USAR are in two themes over the SAME input (`ndpr_kg`), which is one constraint in
two industries, so the row says so rather than counting it as two. Gates: tsc, **770 vitest** (was 721),
seed EXACT, gen:bib no-op, build clean w/ /crossdesk registered, **leak probe 0 HITS across 17 surfaces**,
curtain 404s /crossdesk WITH a valid admin cookie and the homepage carries no link. NO citation added (nothing verified
against a primary source this session) → **homepage chip stays 64**. OPEN: `historyYears` still defaults 5
(20y is stored and read regardless — set the knob on /admin so a future refresh keeps it); the insider
desk's ledger contribution is thin because only 60 of 136 are worked up per refresh (NVR/VST read "no
price history fetched", a limit not a finding); never seen at 375px.
2026-09-04 (Code): PER-CALL USD CAPS OFF BY DEFAULT — owner: "dont cap the budget at all i want these cells
to finish their work… it reaches the budget and can't continue meaning the credits already put into the cell just
go to waste." Exactly right, and the DB shows it: run 945fa0e4 (2026-09-04, count=8 force) has VG × all three
lenses dead on `Reached maximum budget ($1)` and persisted with **cost_usd 0** — the window was drawn on, the
research was thrown away, and the row does not even record what it cost. The cap was never a spend control here:
on subscription auth `total_cost_usd` is NOTIONAL, the real ceiling is the 5-hour window, and the tokens are
charged to that window whether or not the SDK stops the call. It is also the ONLY guard that destroys what it
stops — a timeout, maxTurns or the watchdog end a call with its work intact. `optionalCapUsd()` in lib/config.ts
now returns `number | undefined` (positive env value arms a cap; unset/0/junk = uncapped) and all three stage
defaults are UNSET; agent.ts omits the SDK option unless it is > 0. Prose that asserted a "hard per-call budget"
(prompts.ts, source-standard.ts, reach/filings.ts, reach-settings blurb) reworded to "turn and time budget",
which is what actually bounds a cell now. Rotation's optional note keeps its $0.50 cap DELIBERATELY: it is a
4-turn tool-less call in a model-free product, off by default, and a small budget is part of that design.
Lens effort stays "medium" — the reason is the 5-hour window, no longer a dollar ceiling. Gates: tsc clean,
770 vitest pass. (No `next build` — a dev server was up on 3000 and building over it corrupts `.next`; no
routes or JSX changed.) SECOND HALF, owner-approved in the same breath: the dollar cap was not the only ceiling
that ends a cell destructively, so lens timeout 8 → **15 min**, lens maxTurns 30 → **60**, and — because they
would otherwise just relocate the death — the run watchdog 45 → **90 min** (worst case count=8 is discovery 12
+ 3 batches x 15 + compile 6 = 63). A longer watchdog is cheap precisely because resume banks finished cells.
The 21 unfinished cells of 945fa0e4 (18 session-limit + 3 budget) are still resumable in place, owner deferred
the resume: `npm run pipeline -- --resume 945fa0e4-811e-465f-a509-1dc1b7f59c59`.
2026-09-04 (Code): THE VIRAL CHART FORMAT — a fifth content line, in `marketing/video/`, not in the app
(HANDOFF-2026-09-04-viral-chart-format.md; engine notes `marketing/video/CHARTS.md`; procedure
`.claude/skills/viral-chart-protocol`). Owner: researched a creator in the animated-money-chart genre and asked
to replicate and beat the format — expanding x/y axes, time on x, money/percent on y, a big ticking date under
the plot, several coloured lines, an icon riding each line head — branded MAG8 with the logo, the name and the
website, runnable on demand as "the viral chart content protocol". RESEARCH VERDICT that shaped the build: the
genre's most-viewed chart (12M views, reposted at presidential level) was FACT-CHECKED AND LOST — not because a
number was wrong but because a WINDOW was: one series had 18 months against everyone else's 48, so once the
animation passed its last observation its line stopped climbing while the rivals kept going, and a line that
stops climbing while others rise reads to every viewer as the winner. Nothing was mis-rendered. So the honesty
machinery is the product here, not a footnote: `ChartData` gives every series one slot per SHARED date (a short
run must be explicit nulls), `chart-fetch` rebases to the first date all series exist AND trims to the last date
they all report, and `chart-verify` FAILS the render on any leading/trailing null run. Proven by injecting the
defect — nulling SPY's last 20 months produced the exact FAIL and the restore came back clean. Tooling verdict:
every no-code tool in this space either needs an enterprise contract to export video (~$5k/yr) or watermarks and
meters the free tier; Remotion renders unlimited 1080×1920 locally on the house tokens for $0 and can pull its
own data, which none of them do. Both sources are keyless and already proven in the product's own data layer —
Yahoo v8 and FRED CSV, which want OPPOSITE User-Agents. SEVEN findings, each a confident wrong number: (1)
**`range=max` silently changes the interval PER SYMBOL** — asking Yahoo for monthly bars over "max" returned
QUARTERLY for AAPL/MSFT (listed 1980/1986) and monthly for the rest, no error, no field saying so; aligned on
date they were each missing 114 of 173 months and drew long straight chords through a field of curves. The
fetcher now measures the median stamp gap and refuses a mismatch. (2) **FRED marks a gap with "." in some series
and with NOTHING in others** — `Number(".")` is NaN and gets skipped but **`Number("")` is 0 and passes
`Number.isFinite`**: CPIAUCSL ships `2025-10-01,` (the index was never published) and it rebased to −100%,
drawing consumer prices falling off the bottom of the plot. **THE SAME BUG WAS LIVE IN `lib/bottleneck/supply.ts`
`parseFredCsv`** — on a supply series a phantom zero is a collapse, i.e. a fake TIGHTENING on the desk; fixed +
pinned (771 tests, was 770). (3) MY OWN `deOverlap` bug: the per-item clamp UNDID the spacing it had just done —
8 badges needed 588px of a 554px column, the block shifted up to clear the bottom and the top badge was clamped
back down ONTO its neighbour, so the leader and runner-up printed through each other; it now shrinks the gap
first and compresses proportionally, and every badge draws a dot at its TRUE point with a dashed connector so a
nudged label never misstates a value. (4) `overflow:hidden` on a label is a silent lie — "Median home sold"
printed as "Median home so" and reads as a shorter phrase, not as a bug; head labels are nowrap and unclipped so
the stills sweep catches it. (5) **`spawnSync('npx.cmd', …)` on Windows returns status 0 having rendered
NOTHING** — the driver uses `shell: true` and then checks the file exists. (6) the programmatic renderer defaults
to **port 3000**, which is the app's dev server: it loads the WEBSITE, finds no compositions and reports "not a
valid Remotion project"; `scripts/stills.ts` pins 3335 (helps every existing film too). (7) a log axis carries a
LOG SCALE chip or the render is blocked, and the payoff bars use the SAME scale as the plot (linear bars under a
log chart collapse six real climbers to a dot). NOTHING ON SCREEN IS A TYPED FIGURE: heads, live rail, standings,
the gold winner's number, the multiple and the date range are all read from the frozen dataset at render time,
and the verifier warns on any number in copy that is not a final value / multiple / year / principal. Renders
never fetch — data is frozen into a committed TS module, so a re-render is byte-identical and the on-screen
"PULLED <date>" is true. **RECUT SAME DAY on owner review** ("remove the intro and the outro... straight into the charts and
end when the charts are done... more subtle, casual... mostly just a cool fun interesting moving graph
video for the average scroller"): the film is now the RACE ALONE — 690f / 23s, no question card, no
endcard, and the 276 frames the two cards used went back INTO the race rather than out of the runtime
(~4 frames per data point, not ~3). **This SUPERSEDES FORMULA §G for the chart format only** — no
endcard means no WaitlistCta, the one sanctioned exception to "never drop the CTA". The brand now
promotes by BEING PRESENT: the header carries mark + MAG8 left and the tagline "The next
trillion-dollar leaderboard." over themag8.com right, on every frame, muted and with no ask; the
verifier FAILS a cut that has no endcard AND no address in the header, so it can never silently become
an unbranded chart. Beats are data — `chartScenes` drops any zero-length beat, so hook/payoff/endcard
cost nothing while unused and return for any spec that gives them frames. Recut surfaced THREE more
findings, all from reading stills: (8) with no hook card, **frame 0 IS the cover frame**, and at idx 0
every series is worth the same, so de-overlap fanned eight identical heads into an 84px-spaced column
that read as a floating legend of eight different values — head furniture now emerges with the lines;
(9) **a y window wider than the data crushes the chart** — the log axis opened on a full decade
regardless of what was revealed, so for the first third of the run every line sat inside ~25px of a
610px plot; it now opens TIGHT around the revealed data and widens (both bounds monotone, so the axis
still never rewinds), which is also the move the format is FOR, and a log axis under ~12× spread now
takes nice round ticks because the decade walk yielded exactly ONE tick; (10) **`yFloor` was a hard
floor and clipped a real series** — the median-home line dips to −1.27% in 2000 and was drawn below
the baseline, OUTSIDE the plot box; a preferred floor now yields to real data below it. TWO FILMS
SHIPPED, both 1080×1920 / 690f / 23.1s: `out/chart-mag7-10k.mp4` (8 lines,
log, $10,000 from 2012-06 → NVDA $7,281,108 = 728×, SPY $72,148) and `out/chart-wages-vs-everything.mp4` (4
federal series, linear, since 2000 → home prices +233.1%, median home +148.5%, wages +134.6%, CPI +96.3%).
FORMULA.md §K added + changelog appended (twice — build, then recut); **the §G "no URL until the domain is
live" hold is DISCHARGED for charts** — themag8.com is in the brand row of every frame, per the owner's
branding ask. NEW
OWNER RULE recorded in §K: real-name safe framing now covers PEOPLE — the "X's net worth vs Y's" shape common in
this genre is an OWNER DECISION, never a default (MAG8 is a live financial product; badges default to monogram
discs, no likeness, no licence). Gates: tsc clean (video + app), 771 vitest, `check:leak` 0 hits over 73 files,
chart-verify 0 FAIL, stills read at every beat, encode-path seq clean, both renders exit 0 w/ ffprobe exact.
OPEN: portrait only (no landscape variant); the `image` medallion path is built but unused pending the owner's
likeness call; no chart has been posted to any platform yet.
2026-09-05 (Code): CHART PROTOCOL — STANDING BRIEF + BATCH FOLDERS. Owner: "whenever i say run the
'viral fun chart marketing protocol'… automatically brainstorm 3 ideas for what we can chart to compare,
and that is content that we havent made before, ensure there is no intro/outro but only the interesting
chart moving… also automatically put the chart marketing videos in a different folder specific for chart
videos, make multiple chart folders… each folder stores a maximum of 25 videos… this makes things easier
for posting on youtube where i can drag and drop 25 videos into youtube at once." THREE changes, two of
them enforced in code rather than written down: (1) the skill's trigger list now carries the owner's own
wording ("viral fun chart marketing protocol") and an unqualified invocation is a STANDING BRIEF — read
`npm run chart:made` + `specs/` first so novelty is CHECKED not recalled, brainstorm exactly three
comparisons that vary the SHAPE (the two shipped films are "$10k invested, log, money" and "since 2000,
linear, percent"; a third of either shape is a re-tread), probe the series ids, then AskUserQuestion and
build the pick. (2) NO INTRO/OUTRO IS NOW A GATE, not a default: `chart-verify` FAILS any spec giving the
hook, payoff or endcard beat frames — the scenes stay in the engine for an owner-asked exception, but a
spec can no longer quietly reintroduce a card (proved by injecting `beats:{endcard:150}` → 1 FAIL, exit 1,
reverted). (3) `scripts/chart-out.ts` files chart films into `out/charts/batch-NN/`, **25 per folder = one
YouTube drag**; `render-charts.ts` resolves the path BEFORE rendering so the log says where the file is
going. Two rules that are the whole point: **a re-render is not a new film** (an existing `chart-<id>.mp4`
re-renders in its own folder, else fixing a typo in an old chart burns a slot in the current one and leaves
two copies to upload) and **nothing is ever re-filed** (a folder already dragged into YouTube must keep
meaning what it meant that day). `npm run chart:made` prints the state, marks a FULL folder, and is the
novelty check. The two existing films moved to `out/charts/batch-01/` (out/ is gitignored). Verified:
rollover probe (re-render → slot 1 of batch-01; 26th film → batch-02), live end-to-end re-render of
wages-vs-everything landing in batch-01 at 2/25 with no stray file at `out/` root, chart-verify 0 FAIL,
tsc clean, check:leak 0 hits over 73 files. Docs: FORMULA §K + changelog (the compounding rulebook),
CHARTS.md (files, the cut, a new "Where the films are filed"), marketing/video/CLAUDE.md gates, SKILL.md.
2026-09-05 later (Code): CHART PROTOCOL RUN — THREE FILMS. Owner: "execute the viral chart protocol and
make 3 original videos" — an explicit count means BUILD ALL THREE, not brainstorm three and build one (§K +
SKILL.md now say so). Novelty checked with `chart:made`, then three deliberately different SHAPES, because
three subjects on one shape is one film made three times: `chart-cost-of-money` (six US interest rates 1976→,
FRED `raw` — LEVELS, nothing rebased, lines that fall as often as they rise; prime rate above 20% in 1981),
`chart-cheaper-or-dearer` (eight CPI categories since 1990, a fan that crosses ZERO — hospital care +613.9%
against toys −74.7%), `chart-sector-race-10k` ($10k into eight sector funds since 2001, LINEAR because the
field finishes inside 4.9× — 25 lead changes, energy leading for a decade, technology $236,043 and four of
seven sectors behind the index). All 690f/23.06s/1080×1920, filed batch-01 (5/25). Series ids were PROBED
before proposing (FRED publishes no televisions series; the CPI computer series starts 2005 and would have
eaten fifteen years of the window; the credit-card and mortgage rates could not join the rate film honestly —
one is weekly and one is quarterly on the Feb/May/Aug/Nov grid, so both would have been a line full of holes).
SIX findings, each a confident wrong number or a false statement on screen, all in CHARTS.md: (1) **Yahoo
appends a LIVE bar on top of the current month's bar** — `2026-09-01` AND `2026-09-04`, the month twice, so
the final segment draws three days of movement across a month of x-axis width; the axis whose whole job is
time misstates its own last step, silently, with every value real. `oneRowPerMonth()` keeps the freshest
reading at the month start; the two ALREADY-PUBLISHED films still carry the extra point and were deliberately
NOT re-fetched (a published film's numbers do not move). (2) the spike check FAILED real data — a rebased
percent series starts at zero, so early noise is enormous against its own level (toys, 118.4→117.5→118.3 on a
118-point index); the excursion must now also exceed 5% of the series' OWN range, proven by re-injecting the
blank-field collapse the check exists for. (3) a cap written in a comment is not a cap: `xAxisYears` promised
six labels and delivered eleven over fifty years. (4) the live rail assumed ticker-length labels — four fixed
columns printed "10-yr Treasury" through its neighbour; type floors forbid shrinking text, so the GRID gives
way (columns only ever reduced, rows compressed to the fixed band above the receipts). (5) the axis chip was a
guess dressed as a fact — `unit === 'pct' ? 'CUMULATIVE %'` sat over a chart of published levels; it now reads
the dataset's own method line. (6) **eight lines is the format's ceiling** — at nine the head badges compress
past the point where a label stops printing through the value beneath it (two funds finishing $157 apart drew
through each other), so consumer staples was cut and the spec says why. Gates: tsc clean (video), chart:verify
0 FAIL across all 5 charts, stills read at every beat + encode-path seq on all three, check:leak 0 hits over 79
files, three renders exit 0 with ffprobe exact.
2026-09-05 (3rd pass, Code): CHART PROTOCOL RUN AGAIN — THREE MORE FILMS, batch-01 now 8/25. Owner: "run
the protocol again, create 3 more original videos". Three UNUSED shapes, not three new subjects:
`chart-work-in-america` (eight payroll counts 1970→, the first chart on the **`index` unit** — raw headcounts,
nothing rebased; manufacturing peaks and falls while education+health passes everything to 27,945k),
`chart-grocery-run` (eight BLS average prices 2000→ monthly, **dollars at shelf scale** — ground beef $6.88 to
bananas $0.65), `chart-world-markets` (eight national markets, **Yahoo `pctChange`** — Brazil led for a DECADE,
16 lead changes, Taiwan +1037.4% at the wire, and every line is a US-dollar return so the currency is in it).
FOUR findings: (1) **a spike check that only looks at the two neighbours is a sample of one** — the German
market fell 13% in Sep 2011 and bounced 16% in Oct (the eurozone crisis, verified against the source closes)
and was FAILED as a parse artefact; the excursion is now also compared with the series' own TYPICAL step (median
absolute move), which is what the check's comment always claimed, and the injected blank-as-zero collapse still
FAILS. (2) **sampling can manufacture the very artefact the gate looks for** — one month in three landed on the
April 2020 egg peak ($1.53→$2.02→$1.64) and made a real spike look like a lone excursion; the same series
monthly passes, so a price that moves in weeks is never sampled in quarters. (3) a publisher's gaps are not
evenly spread — BLS stopped collecting COFFEE for 2008–09 and 2018–19 and RICE for 2000–02, which draws a
straight chord across two years (a picture of a price that did not move, over exactly the period it moved
most); both were cut from the basket rather than drawn. (4) money below $100 needs CENTS — `group()` rounds to
whole units, so every grocery line printed as a flat integer; the threshold sits above every value in every
earlier film, so nothing published moves. Gates: tsc clean, chart:verify 0 FAIL across all 8 charts, stills
read + encode-path seq on all three, check:leak 0 hits over 85 files, three renders exit 0, ffprobe exact
(1080×1920, 690f, 23.06s).
2026-09-06 (Code): CHART PROTOCOL RUN — THREE MORE FILMS, batch-01 now 11/25. Owner: "run the viral chart
marketing protocol and make 3 original videos". Three unused SHAPES: `chart-what-america-owes` (the first LOG
axis over PUBLISHED LEVELS — five borrowing sectors of the Fed's Z.1, 1952→2026 quarterly, $11.8B to $34.47T;
the lead changes hands three times and the banks line peaks in Jul 2008, falls to $16.89T by 2013 and does not
regain 2008 until late 2021 while federal borrowing multiplies ~5×), `chart-eight-billion` (the first ANNUAL
grid + year-ticking date — eight populations 1960→2025, India passes China at the wire), `chart-below-zero`
(eight OECD 10-yr government yields 1991-03→, a field that dives THROUGH the baseline: CHE 72 months negative,
DEU 38, JPN 24, FRA 22, while US/UK/ITA/ESP never are). FIVE findings, each a silent wrong number or a broken
frame: (1) **FRED series disagree on units** — the whole Z.1 is MILLIONS while FRED's own GDP is BILLIONS, so
the obvious sixth line would have been wrong by 1000× with every value real; GDP cut, and conversions now
travel as NAMES (`FRED_SCALES`, `scale: 'millionsToDollars'`) so the factor and the printed sentence come from
one entry; (2) **a series can change its own publishing frequency mid-history** — Z.1 is ANNUAL before 1952 and
quarterly after, one id, no field saying so, and since points are placed by INDEX the first six years animated
at 4× the speed of the following seventy with year labels at quarterly spacing → `chart-verify` now measures the
date grid, FAILS a RUN of ≥3 irregular steps (proved by re-injecting the 1945 start) and WARNS on an isolated
publisher's hole, which is what three published films carry (BLS skipped Oct 2025); (3) the receipts line has a
**62-character budget** and 67 dropped an orphan "09-06" under the credit — invisible at contact-sheet size, so
it is arithmetic in the gate now, not an eye; (4) **the head badges had no clearance from the year labels** (the
de-overlap floor was the badge CENTRE at PLOT_B+4, its value line landing at +35 inside the label band that
starts at +23) — the population film drew "47.1M" through "1962"; hits any chart whose slow lines sit near the
floor early; (5) **`yFloor: 0` cost the opening** on the film named after the zero line — it held an empty band
on screen and pushed the whole 1991 field (5.7–13.8%) into the top half for a decade; left free the window opens
tight and expands DOWNWARD, so the baseline arrives when it starts to matter. Also: two formatter tiers added
(usd ≥$1T → "$34.47T", index ≥1M → "1.46B"), both thresholds ABOVE every value in every published film ($7.28M /
27,945), verified by probe, so nothing already published moves. Gates: tsc clean, chart:verify 0 FAIL across all
11 charts, stills read at every beat + encode-path seq on all three, check:leak 0 hits over 91 files, three
renders exit 0, ffprobe exact (1080×1920, 690f, 23.06s). NOT COMMITTED — owner has not asked.
2026-09-06 (Code, session 2): CHART STORY FILMS + THE BACKDROP LAYER — batch-01 now 14/25. Owner: "create
three more viral chart marketing videos, focusing on an interesting story related to finance, like the buying
pizza with bitcoin story and comparing how much the guy could've had if he kept his bitcoin. also try taking an
image from the internet related to the story, darkening the image, and putting it subtlely into the background
of the chart video. a small thing like this will make the video seem less AI generated." Three STORY films:
`chart-pizza-day` (log/mixed-source — what $41 became from bitcoin's first priced month: BTC $46.76M vs Apple
$1,804, S&P $398, gold $137, cash $41), `chart-nikkei-1989` (four markets from the Dec-1989 peak, price only,
own currency — Japan spends 418 of 442 months BELOW its own starting line, min −80.6%, first monthly close back
above in Feb 2024), `chart-covid-crash` (weekly, $10,000 at the exact pre-COVID top — bitcoin $80,431, Nasdaq
$32,434, gold $26,294, S&P $25,337, small caps $19,186, long bonds $6,782 and still under water). NO PERSON IS
NAMED in any of them — FORMULA §K makes a chart about a named individual an owner decision, and the pizza story
lands without one. SIX findings/additions, each a silent wrong number or a broken claim: (1) **a bar is dated in
its own exchange's time** — Yahoo stamps at local period start and toISOString reads UTC, so the Nikkei's
October 1986 bar arrives as 1986-09-30 and month-bucketing files it under September: an entire foreign series
shifted ONE MONTH against its peers for its whole history, every value real; fixed via `meta.gmtoffset`, and no
published film is affected (all US-listed); (2) **"distributions reinvested" was a claim the fetcher had no
right to make** — true of a fund's adjusted closes, FALSE of a price index, and in a MIXED basket it credits
some lines with dividends and not others (it was live in the COVID film until its three index legs were swapped
for the tracking funds); a source cannot answer it (Yahoo returns adjclose for an index too, it just equals the
price) so the basket now DECLARES `dividends`, and `sourceLabel` became overridable because "ADJUSTED CLOSES"
sat directly above "price only — no dividends"; (3) **the spike gate fired on a real crash for the second time**
(Germany 2011, now the Nikkei −13% in Mar 2026 and back in Apr, corroborated inside the source bars' own
high/low) — the discriminator that actually works is *is this a value the series visits at other times?* (a
blank-as-zero lands where the line never otherwise goes), so in-range excursions now WARN and out-of-range still
FAIL, re-proved by injection; (4) **bitcoin has no price on pizza day** — blockchain.com reads 0.00 every day
until 2010-08-18 because there was nowhere to sell one, the purest form of the blank-as-zero trap, so the zeros
are dropped, the run starts at the first priced month, and the film shows what $41 became rather than what the
ten thousand coins became (a smaller number than the headlines, and the one it can stand behind); (5) **the
backdrop needed a licence rule, not just a download** — `scripts/chart-backdrop.ts` fetches from Wikimedia
Commons and accepts PUBLIC DOMAIN and CC0 ONLY, recording licence/author/source in
`public/backdrops/CREDITS.json`, because CC BY and CC BY-SA are equally free and both oblige an attribution ON
THE FRAME while a chart film's one line of receipts belongs to the data; `chart-verify` re-checks at render
time and clamps strength to 0.04–0.25; (6) **two stacked scrims turn a photograph into noise** — the first cut
left the image at ~0.06 effective, which reads as sensor noise (the opposite of the point) and looks fine at
contact-sheet size: it has to be judged on a full-resolution crop. New engine surface: `MixedJob` (yahoo +
blockchain.com + a `constant` leg for the flat cash line) so bitcoin's pre-2014 history can share an axis with
tickers. Gates: tsc clean, chart:verify 0 FAIL across all 14 charts, stills read at every beat + encode-path seq
on all three, check:leak 0 hits over 97 files, three renders exit 0, ffprobe exact (1080×1920, 690f, 23.06s).
NOT COMMITTED — owner has not asked.
2026-09-06 (Code, session 3): STORY-FIRST IS NOW THE RULE + BACKDROP TASTE. Owner, after reviewing the three
story films: "add it into the protocol permanently that i want videos to always include some type of interesting
story to captivate viewers attentions better rather than something only finance bros would care about. i also
like the background images a lot, the pizza one i liked the least, i think it would have done better with a more
general photo like a pizza delivery man, besides that i like how the other two backgrounds look, general enough,
but relevant enough." TWO STANDING RULES, written into FORMULA §K (+ provenance tag `[09-06 story]`), the
`viral-chart-protocol` skill's standing brief, CHARTS.md and the fetch script's own header — so they bind on
every future invocation rather than living in one session's memory: (1) **a STORY is a REQUIREMENT of every
chart film and the first test an idea has to pass** — a comparison is NOT a story, and an idea describable only
as "X versus Y over time" is not ready to propose; the chart is the ANSWER to the story and the money
counterfactual is usually the answer's shape; the person is never named, and the window discipline gets
STRICTER on a story film because a good story is what creates pressure to reach for the headline number;
(2) **the backdrop is a SCENE, not a product shot** — ask what the story's WORLD looks like (a street, a floor,
a skyline, a queue), not what its noun looks like, because at ~15% opacity behind a scrim a place with people
and depth still reads as a photograph while an object on a white sweep has nothing for the eye to resolve.
`chart-pizza-day` re-shot accordingly: the studio slice replaced with a CC0 delivery rider in a busy street
(brand signage illegible at these strengths — and prefer frames without it, since a logo behind a financial film
implies an association nobody agreed to), then re-rendered INTO ITS OWN SLOT (9/25, folder still 14 films),
which is the "a re-render is not a new film" rule working as designed. Search note: `filetype:bitmap` is
required on Commons queries or "delivery man carrying boxes" returns twenty scanned 19th-century PDFs. Gates:
tsc clean, chart:verify 0 FAIL across all 14, stills read, check:leak 0 hits over 97 files, re-render exit 0 +
ffprobe exact. NOT COMMITTED — owner has not asked.
2026-09-05 (Code): THE TIDE — a FIFTH product, the only one about the market rather than a company
(HANDOFF-2026-09-05-tide.md). Owner: "exhaustively research all the indicators for when the markets are
over-extended… and all the indicators for when the markets are undervalued, being panic sold… create an
aggregate reading of the good and the bad, with more weighting allocated to more meaningful readings…
mostly just to see how much exposure is recommended to the markets or to cash", explicitly inviting
famous practitioner indicators (Buffett) alongside micro and macro. Owner decisions at plan stage:
auto-only sources w/ hand-entry for the rest (no spreadsheet parsers) / sub-scores lead + band under /
breadth computed from Mag8's own universe / named **The Tide** (checked against the leak grep). 40
gauges, 39 series, 33 knobs, 130 tests. LIVE: fast 45.9, slow 87.3, **50–60% equities, neutral** —
`60% base +2.9 cycle −7.5 valuation = 55.4%`. THE DESIGN DECISION, forced by the live data: the slow
side is at a historic extreme (household equity share 45.8%, equities/GDP ≈214%, profits/GDP 13.2%)
while the fast side is benign (curve +0.87 un-inverted, Sahm −0.07, claims 207k, credit tight) and
sentiment 55.2 contradicts both — one blended number would report "mild" and destroy the only
information, so TWO composites, never averaged, and the band is driven by the FAST one because
Goyal-Welch says valuation would not have helped time the market. THIRTEEN findings, each a confident
wrong number: (1) **FRED answers a nonexistent series id with HTTP 200 + an HTML page** — a status code
validates nothing; (2) **`USSLIND`, the obvious free LEI, answers fine and has published nothing since
2020-02** (+4 more dead series) → every series carries a staleness budget; (3) **`NROU`'s newest row is
dated 2036** (CBO projection) and GDPNOW is a nowcast → future-dated rows dropped+counted; (4) ICE BofA
OAS licence-capped to a rolling 3y and `cosd` does not extend it → Moody's BAA10Y instead; (5)
**`range=max&interval=1d` on ^GSPC returns 169 MONTHLY points**, interval silently ignored — a base-rate
engine would compute "63-session" returns that are 63 MONTHS; (6) `range=80y`/`100y` return ZERO points,
not an error → clamped in the SHARED bars.ts so no future desk rediscovers it; (7) CBOE publishes
VIX/VIX3M itself, keyless and complete, where ^VIX3M is unreliable; (8) **THE BIG ONE — the conditional
history swung 49 visits/+6.2% (gap 1) → 21/+7.7% (3) → 11/+8.0%/100% POSITIVE (6) → NOT MEASURED (12) on
a parameter I had set arbitrarily**, and proximity clustering produced a single "visit" spanning
2018-03→2025-08; replaced with greedy NON-OVERLAPPING draws (19 real draws incl. −14.9% and −9.2%,
+14.4% vs +9.2% plain), spacing can only widen, minEpisodes 8→5 because 30y of independent annual
windows holds ≤30 observations and a floor that can never be met is not a safeguard; (9) **a sentence
true of the arithmetic and false about the market** — with the S&P at a record the write-up called "the
index is below its ten-month average" favourable, because prose was picked by STRESS and on a
high-is-good gauge low stress means a HIGH reading → `meaningFor()` picks by percentile; (10) **a
staleness budget set from FREQUENCY is wrong** — Z.1 `equities` sat 247d against 250d, three days from
declaring the Fed's own accounts dead, because a quarterly series dated at the quarter START and
published 10 weeks after it ENDS is routinely older than its own interval; (11) two catalogued series
were read by NO gauge so were never fetched and looked catalogued while invisible (now a test; it caught
a third); (12) never-published ≠ stopped-publishing, two states not one; (13) the one-polarity rule
KILLED "the curve un-inverted" (steepening from normal is good, from inverted is bad) → replaced by the
depth of the worst 2y inversion. +11 citations, each verified against its primary source this session,
THREE of them arguing against the desk and built into the arithmetic rather than footnoted (Goyal &
Welch 2008 + Goyal/Welch/Zafirov 2021 = why the slow score barely moves the band; Boudoukh/Richardson/
Whitelaw 2008 = why draws are non-overlapping and the slow score gets NO conditional history).
**Homepage chip auto-counts 64 → 75 ACADEMIC WORKS CITED** (public copy — flagged). Gates: tsc, **908
vitest** (was 771), seed EXACT, gen:bib no-op, build clean w/ both routes, probe ALL PASS, **leak probe
ZERO architecture hits across 15 surfaces** (all responses >20KB-verified; only the 2 homepage
exceptions), curtain 404s /tide and /tide/<id> WITH a valid admin cookie and the homepage carries no
link, admin gating verified locked+unlocked with a real ADMIN_TOKEN, separation holds (no pipeline
imports, no SQL outside lib/db.ts, 0 FKs, user_version 8). Also closed a pre-existing gap: the shared
registry-integrity table covered 3 of 7 registries — all 7 now run, plus a new assertion that every
settings citation resolves. OPEN: CAPE + margin debt are hand-entry only and **there is no entry form
yet**, so both currently read NOT MEASURED (Shiller's file is legacy OLE2/BIFF8; FINRA's is a real
20KB ZIP xlsx, verified live, ~200 lines of zip+XML with no new dependency — the highest-value item
left); breadth keeps 5y where macro keeps 30, so its percentile is against a shorter record; the
composite's MEMBERSHIP changes through history (breadth exists only for the last 5y) — handled
arithmetically by weight redistribution but not yet stated on the page; **the valuation family
saturates** (5 of 6 slow gauges read 95–100 because those series have TRENDED for 30y rather than
oscillating — real, not a bug, but the slow composite will sit near 90 for years: owner call whether a
detrended variant belongs beside it); never seen at 375px (headless returns an empty DOM here — checked
structurally instead); orphan `anfci` rows left stored deliberately.
2026-09-07 (Code): FIVE OPEN-SOURCE REPOS REVIEWED → FOUR BUILDS (HANDOFF-2026-09-07-risk-desk.md;
plan `~/.claude/plans/i-have-5-open-serialized-wadler.md`). Owner brought autohedge / public-apis /
marketingskills / manim / humanizer in their own priority order and asked: verify each, verify it is
free and open source, verify it can and SHOULD be integrated, then use them to maximum. All five real,
all MIT, all maintained — and only one is usable as CODE. **(1) AutoHedge REJECTED, its shape taken:**
`workers.py`/`prompts.py` contain NO deterministic math at all — `volatility`, `probability_score`,
VaR, support/resistance and "recommended position size" are all asked of an LLM, which is the exact
pattern every desk here exists to avoid; plus OPENAI_API_KEY (owner: zero API spend), a Solana wallet
private key (never broker-wired), Python-on-`swarms`, and "swarm intelligence and AI agents" matching
the banned leak pattern. But the gap was real — `grep correlat|covarianc` over lib/ returned only
citation text — so THE RISK DESK was built instead (see Map). **(2) public-apis = a directory, not a
dependency:** its own Finance section holds 6 keyless entries and Mag8 already used the best (EDGAR);
Econdb, the strongest-looking addition, returns a **Cloudflare 403 from this network** (the Jina
Reader pattern again) and PatentsView is now key-gated. Owner picked ONE of four probed candidates:
USAspending → the bottleneck desk (see Map). Also probed and reachable but NOT wired, on the owner's
call: Federal Register / openFDA / ClinicalTrials.gov / World Bank / IMF / OECD SDMX / Treasury
FiscalData, all 200 keyless. defense.gov 403s an honest UA (the asafm.army.mil class).
**(3) marketingskills ADOPTED as a subset** — 12 of 50 SKILL.md files + their 31 `references/` copied
into `.claude/skills/` and hashed into `skills-lock.json`; the upstream **`AGENTS.md` deliberately NOT
installed** (it instructs a session to fetch VERSIONS.md from GitHub once per session, and its tools
registry points at GA4/Stripe/Mailchimp/Composio). Skipped everything assuming a live SaaS funnel —
the waitlist stores and NOTHING SENDS. **(4) manim ADOPTED as ManimCE 0.19, NOT 3b1b/manim** (owner
call after being shown the tradeoff: ManimGL's own README warns older code may not re-render, and "a
re-render is not a new film" is already a rule here) in `marketing/manim/`, its own venv, **asset
generator only** — transparent frames Remotion composites, never a second pipeline. Python 3.13.15 and
ffmpeg were already on the box; LaTeX is NOT needed (Text() renders through Pango). **THE
TRANSPARENCY TRAP, measured:** `manim -t --format=webm` writes `yuv420p` with corner alpha 255 — no
alpha, no warning, composites as a SOLID RECTANGLE; `--format=mov` carries real alpha in qtrle, which
no browser decodes; transcoding to VP9 or VP8 WebM ALSO yields `yuv420p` because both encoders LIST
`yuva420p` and neither writes the BlockAdditions track. `--format=png` gives real `rgba`. `render.py`
verifies the format, the corner alpha on THREE frames, and that something was actually DRAWN — an
empty scene passes a transparency check trivially. **`check-leak.ts` extended to walk `../manim/scenes`
and match `.py`** — a scene puts captions straight on a frame and the gate could not see them; proved
by injection. **(5) humanizer ADOPTED as a skill AND turned into a gate:** `npm run check:voice`
(`scripts/check-voice.ts`) applies the mechanically checkable half of its 25 patterns to hand-written
copy in app/components/lib/marketing/video/src — reports, never rewrites, and stays OUT of the runtime
path (the deterministic writers verify numerals, and a rewrite that changes what a sentence claims
while keeping its digits would pass that check and still be false). House voice behind `--house`: the
em dash alone is **801 hits** in authored copy, so on by default the gate would have been useless on
day one. Its curly-quote rule was REMOVED after producing nothing but false positives (correct
typography in film captions; a curly quote in real code is a tsc error). Authored copy: **0 hits over
271 files**. Proved by injection both ways. Precedence written into FORMULA.md **§L**: this file
outranks every imported skill, everything they produce is public copy that must clear the leak gate,
and nothing auto-updates. Gates across all four phases: tsc clean · **1009 vitest** (was 908) · seed
EXACT · gen:bib no-op · build clean w/ `/risk` registered · **leak probe 0 architecture hits across 16
surfaces on BOTH the dev server and a production build**, every response >20KB · curtain 404s `/risk`
WITH a valid admin cookie and the launch homepage carries no link · admin gating verified locked and
unlocked with a real ADMIN_TOKEN on a prod build · flagship bottleneck reading held byte-identical
($573.72B, +85.7%, MW +81.9pp, memory +68.7pp) · video leak gate clean at 98 files. NOT PUSHED.
OPEN: `readRisk` ~1.3s (mostly readLedger, not this desk's code); the risk population is the ledger's
13 crossings and `includeSingleDesk` widens it; only the drone theme has procurement codes and finding
one whose recipients ARE the civil-nuclear or quantum market is research; the 4 bar tables could be
consolidated behind one shared `price_bars` (deferred as a pure cleanup); never seen at 375px.

2026-09-07 (Code, FIVE PARALLEL SESSIONS): VIRAL CHART PROTOCOL x5 — the owner ran the protocol in five
Claude Code sessions at once on this one repo, each told to claim three original films and to de-conflict
with the others FIRST in a chat room called "Marketing Meeting". There is no chat-room tool, so the room
became `MARKETING-MEETING.md` at the repo root (untracked, append-only) plus cross-session SendMessage.
TWELVE FILMS SHIPPED — batch-01 went 14 -> FULL at 25 (one YouTube drag) and batch-02 opened.
mag8-57: `the-wage-that-stopped` (the first STAIRCASE — the federal minimum wage pinned at $7.25 since 2009
against six states, published dollars, so the lines step rather than curve) · `nobody-wanted-oil` (the first
DAILY film — the day US crude settled at MINUS $36.98, the only negative reading in 10,236 observations since
1986) · `nowhere-to-hide` (the first race that goes DOWN — $10,000 into seven funds on the first trading day
of 2022, five finishing below the stake, long Treasuries below the S&P).
mag8-10: `same-house-eight-cities` (money at house scale — eight buyers, same $200,000, different city; Miami
$896,486 against Detroit $402,383, and Phoenix and Las Vegas each more than doubled, gave ALL of it back below
the start, and did it again) · `money-left-at-home` (LOG money in a fan that FALLS, a shape nothing in the
folder had used — $1,000 of cash in eight currencies, all eight ending below where they started, yen $763 down
to the peso at $2.04) · `who-stopped-working` (percent levels that CONVERGE and SWAP — men 86.7 to 66.8
against women 32.0 to 56.4, never crossing, while teenagers and the over-55s start ten points apart in one
order and end in the other).
mag8-4f: `the-jobs-that-vanished` (the first CONTRACTING field — seven trades walking down into the floor,
apparel 938,600 workers to 72,000; all 14 earlier films rise, fan or oscillate) · `who-owns-the-country` (the
first COMPOSITION chart — four shares of one pie that must total 100, so a rise anywhere is a fall somewhere
else) · `the-gap-that-closed` (the first CONVERGENCE — eight countries' life expectancy starting 37 years
apart and finishing 6; the format run backwards).
mag8-49: `the-interest-bill` (linear published dollar LEVELS with lead changes, five federal spending lines,
1947-2026 — the interest a country pays on what it borrowed has just passed what it spends on its whole
military; and the line does NOT climb steadily into the lead, it tops the field for a single quarter in 1998,
falls for five years while every rival rises, and only passes defense for good in 2024-Q1, found by walking
the ranking quarter by quarter rather than inferring from the endpoints) · `america-stopped-building` (linear
raw COUNTS that boom and bust — housing starts by census region, 1959-2026, four regions summing exactly to
the national line; America started more homes in 1972 than in any year since and runs at about half that now
with roughly 120 million more people) · `black-monday` (the first DAILY-cadence film and the one that opened
batch-02 — $10,000 into six national indices, Aug 1987 to Dec 1988, where the reveal is the RECOVERY rather
than the crash: Japan is back above its August 1987 level by February 1988 and finishes at $12,318 while the
other five are still under water — the same market whose 1989 peak opens the earlier `nikkei-1989`).
A fourth idea, `things-you-can-hold`, was DROPPED and fully un-wired (see finding 11).
FINDINGS, each of which produced or would have produced a confident wrong result:
(1) **A spec registered in `jobs.ts` without its dataset is a HARD STOP FOR EVERY SESSION, not a staged edit**
— `registry.ts` maps `chartOf` over every id EAGERLY at module load, so one unfetched id throws for everybody
and NO chart in the project renders, including the 14 already shipped. Register and fetch IN THE SAME BREATH.
It blocked all five of us twice in ten minutes.
(2) **A FRED series can be ALIVE and DISCONTINUED** — `USNUM` (US commercial banks, 14,400 -> 4,375) stops
2020-07, `CES4245210001` 2017-12, `CES3231600001` 2016-11. The fetcher trims to the last date EVERY leg
reports, so one stale leg silently ends a whole film years early with every value correct and no error
anywhere: the exact window defect the honesty gate exists for, entering through the END instead of the start.
Killed a bank film. Check the LAST date of every leg, not just the first.
(3) **The gate reads NUMERALS, so a SENTENCE is unguarded** — `chart-verify` checks digits in copy against the
data and has no opinion on a quantity spelled as a word or on a claim about method. Four payoff lines shipped
false through every gate before being checked: "more than a decade below where it started" (the real figure was
85 months), "nothing here is adjusted" over six seasonally-adjusted series, "the four shares sum to one hundred
at every point" (off by 0.2 — the Fed files them to one decimal), and "two of these lines cross, once, and
never cross back", which was INFERRED FROM THE ENDPOINTS while the series actually crosses SEVEN times. The
last is the hardest class: every plotted value correct, the SHAPE wrong in the middle, and no gate can catch it.
(4) **A duplicate React key ghosts a label for the rest of a film, and STILLS CANNOT SEE IT** — x-axis month
labels were keyed on the label TEXT, and month labels are month NAMES, so a month-mode window wider than twelve
months prints "Mar" twice; two children with one key orphans one, and the encode path reuses a single DOM so
the orphan never unmounts. Fixed (`key={t.i}`). THE REACH: the axis mode is chosen from the REVEALED span, not
the dataset span, so "my film spans fifty years so this cannot touch it" is false. AT RISK is only a film whose
revealed window passes through 13-35 months WITH points in the repeated months; a single-CALENDAR-YEAR film
cannot mint it (twelve months, twelve distinct names) and annual data is safe, because a non-January stamp
finds no index. **THE EXPOSED SET IS DECIDED BY THE FILM'S TOTAL SPAN, NOT BY THE REVEALED WINDOW** — and
getting that wrong cost three rounds of correction between two sessions, each of us confidently wrong in turn.
The axis never opens narrower than 8% of the whole run (`xSpan = Math.max(idx, (n-1) * 0.08)` in `cmath.ts`,
so the first three points do not stretch across the plot), which means the opening window of a LONG film is
already wide: a 1990-2026 quarterly film opens at index 12 = 1993-01, `years` is 3, and month mode never
triggers at any point in the film. So **a film spanning more than about 37 years can never enter month mode**,
and the exposed set is films spanning roughly 13-37 years, whose opening window lands at 13-35 months: a
2005-2026 monthly film opens `[Jan, May, Sep, Jan, May]` and a 2000-2026 one opens `[Jan, Jul, Jan, Jul,
Jan]` — exactly the two that ghosted, with exactly the repeated names they showed. A step of 12 cannot
duplicate, because every stamp is a January and January prints as its year, which is why a long film in month
mode can still LOOK like a year axis. Predicting the axis from the revealed index is the trap; it ignores the
floor and gives the wrong answer every time. Two shipped films carried it. Every fresh-DOM still was clean, as was `chart-verify` and an
encode-path window at frames 300-312 — it was caught only by extracting frames from a SHIPPED mp4, so
`marketing/video/CLAUDE.md` gained workflow gate 6: **verify the ARTIFACT, not the still** — and pull frames
BY INDEX (`-vf "select=eq(n\,30)"`) rather than by timestamp whenever a claim rests on one frame, since a
timestamp seek lands on a neighbouring frame and two sessions comparing "the same moment" are then comparing
different ones. Sample the
OPENING as well as the end. NB a doubled digit on the big date ticker early in a film is the date ROLL
mid-transition, not a ghost — it is absent from the final frame; do not re-render over an animation.
(5) **CES payroll series are SEASONALLY ADJUSTED while the shared on-screen method line says "Series as
published, no adjustment"** — FRED will not tell you (title, units line and meta description are all silent);
it is settled by fetching the `CES` and `CEU` twins and DIFFING them (apparel, Jan 2025: 81.8 against 80.8).
True of what the fetcher did, false about what the data is. **OWNER CALL, deliberately NOT reworded** — shared
engine copy sitting under eleven published films with four sessions mid-render. mag8-57 checked its own FRED
films and the sentence is true there (statutory rates, daily spot prices), so this is the payroll family only.
(6) **There are TWO renderer ports and holding "the port" holds one of them** — renders take 3333 (CLI, from
`remotion.config.ts`), stills take 3335 (the programmatic API, which does not read that config). A stills sweep
and a render CAN run together; two renders cannot. Announce a render WINDOW, not a port. `scripts/stills.ts`
now honours `MAG8_STILLS_PORT` (**default unchanged at 3335**) because a hard-coded port makes the port itself
the queue when sessions share a machine.
(7) **A licence check is not a judgement check, and a file TITLE is not evidence of what a photograph shows** —
`--find` returned, all correctly public domain or CC0: twenty architectural plates with no people in them (the
"product shot not a scene" the owner rejected), wartime and Japanese-American internment-camp hospitals for a
life-expectancy film, a crowd of identifiable men in business dress which under the title "Who owns the
country?" reads as a claim about THOSE men, a CC0 file called "Suburban neighborhood" that is an Eastern
European street with Cyrillic shopfronts and a legible bank sign, and a money-changer's storefront carrying a
real named business, two manufacturer logos and a burnt-in phone watermark. Also **archival scans include the
film itself** — a negative's sprocket holes, a slide mount — and a landscape source fills a portrait frame by
HEIGHT, so those borders land on the frame as black bands; `ffmpeg -vf crop` changes nothing about provenance
and CREDITS.json still records the original.
(8) **An idempotence check keyed on the IMPORT ALIAS cannot see a peer's identical wiring under a different
alias** — two sessions correctly wiring the same film as `metalsData` and `thingsData` produced a duplicate key
(tsc TS1117). Key such checks on the file path or the map key.
(9) Coordination: **a whole-file read-modify-write clobbers a concurrent edit** — the room's own claims table
lost a row that way within seconds, so the log is append-only (`cat >>`) and the tables at its head are a
convenience only; and TWO SESSIONS BOTH BELIEVED THEY WERE AGENT ONE, so agents were addressed by session id
thereafter.
(10) Two smaller ones: **`yFloor` on a LOG axis is the below-zero defect in another hat** (a floor of 1 under a
film whose lowest value is $2.04 holds an empty decade open from frame one — and the gate REFUSES a log axis
with no floor, so the fix is a TIGHT floor, not none); and **`check:leak` bans the bare English word "agent"
inside CODE COMMENTS too**, not only on-screen copy ("no property tax, no upkeep, no agent" failed the whole
project). `sourceLabel` has a 42-character budget and over it is a FAIL.
(11) **Yahoo's MONTHLY series for a futures symbol silently omits whole months, and the rule is the calendar**
— `GC=F` returns 267 monthly bars against `^GSPC`'s 313, the missing timestamps simply absent from the
response and the SAME months missing from every metal. Every dropped month is one whose 1st falls on a
WEEKEND, about 1.7 a year forever. The daily bars for those months are complete, so it is the aggregation and
not the market — and because it correlates across lines it looks exactly like a market event. A `YahooJob`
cannot fetch daily and reduce, so there is no fix inside a spec; it cost a whole film, which is why
`things-you-can-hold` was dropped and un-wired rather than shipped.
(12) **The receipts line says "Series as published" even when the job SAMPLED** — `sample: 'quarterly'` drops
two of every three months and the method line does not mention it, so `cost-of-money` reads "no adjustment"
while dropping two thirds of its observations, and seven other films are in the same position. NOT fixed, for
the same reason as the adjustment line: it rewrites the method string of every FRED film on its next
re-fetch. Another owner decision; the affected film disclosed its cadence in its own subtitle instead.
(13) `COMPACT_USD_ABOVE` in `src/charts/spec.ts` lowered $1B -> $100M — Social Security in 1949 drew as
"$690,680,167", twelve characters through the badge and into the axis. Proved inert by scanning all 26 frozen
datasets: the $100M-$1B band holds 15 values and every one belongs to the film that needed the change.
ENGINE (all additive, all default-preserving, every existing job on the byte-identical path): `to` (an
inclusive end cutoff, with `chart-verify` FAILING a spec whose `to` names a period the film's own copy does not
mention — an honour-system comment turned into a check) · `knownExcursions` (a price that settles negative for
one session can never pass "does the series visit this level elsewhere", and loosening the threshold would
re-admit the blank-field collapse the check exists for, so the author declares day and reason and undeclared
spikes still FAIL) · `transform: 'invested'` + `principal` on `FredJob` (it was raw|pctChange only, so "what
$200,000 became" was impossible from a federal index for no reason but the type; the method line reads
"tracked ... by the index as published" rather than "invested ... held", because you do not hold an index and a
house is not a security) · month labels on the x axis for runs under three years · the stills-port override.
Gates: 0 FAIL / 0 WARN on every chart, `check:leak` clean, tsc clean, all twelve renders ffprobe-exact
(1080x1920 / 690f / 30fps / 23.061s). `CHARTS.md` and `FORMULA.md` appended by each session.
A CONSEQUENCE WORTH ITS OWN LINE: `clib.tsx` changed under already-shipped films during the run, so **for the
two films that carried the ghost a re-render is no longer byte-identical to the file it replaces** — it would
be corrected, which is the point, but it is still a different artifact from the one on disk. The repo rule
that a re-render returns to its own folder holds; the assumption underneath it, that re-rendering an old film
reproduces it, does not while the engine is moving. Re-render deliberately, and verify the artifact after.
Verified for the three films of this session: frame 30 pulled BY INDEX out of the shipped mp4 is identical to
the same frame rendered fresh under current code, so those three would re-render unchanged.
OPEN: batch-01 is FULL at 25 and ready to drag into YouTube, batch-02 holds one film;
the "no adjustment" method line is the owner's decision and is still on screen under eleven films; a
house-against-wage film was DROPPED after checking the arithmetic (nominal house prices and wages have both
grown five to sevenfold since 1979 and run nearly parallel, so the honest chart undersells its own story — the
affordability story lives in rates and a ratio, and the engine cannot divide).

2026-09-07 (Code): CHART FILMS GET THE OWNER'S MUSIC. Owner dropped eight mp4s into the repo root:
"extract just the background music of each video and randomly assign music to the viral chart marketing
videos. this is the only sound/music i want in the videos, cut all sound that is currently in these videos
that isnt these songs." Owner confirmed the tracks are licensed or royalty-free (asked before muxing — the
films go to four platforms that all run Content ID, and an unlicensed track fails there, days later, as a
claim, not at any gate here). MY FIRST STATEMENT WAS WRONG and I corrected it mid-task: I grepped
`src/charts/` for an Audio component, found none and told the owner the chart films were silent — they were
not. The `<Audio>` lives in `src/Root.tsx` and every chart film carried the procedural score from
`gen-score-chart.ts`; ffprobe on the actual mp4 showed the audio stream. That score is exactly the sound the
owner asked to cut, so the chart `<Audio>` is now UNWIRED in Root.tsx (the generator is kept for the other
product lines) and the composition is silent — one source of sound, not two. Shipped
`marketing/video/scripts/chart-music.ts` + `npm run chart:music`: `--extract` pulls the audio out of
`music/sources/` (stream-copied, so the only generation loss in the chain is the single encode the mux
does) and finds each track's LOUDEST 23s window (a track's opening is usually its quietest part, and a 23s
film starting there spends a third of its runtime on the least interesting bar); the default run assigns a
track at RANDOM ONCE, records it in the committed `music/assignments.json`, and muxes at -14 LUFS two-pass.
**The assignment is fixed forever after the first run** — a posted film must keep sounding like itself, and
new films take the least-used track so 26 over 8 sits at 3-4 each; `--reroll <id>` is the deliberate
override. **The picture is never re-encoded** (`-c:v copy`, map `0:v`+`1:a`) — verified by comparing the
video stream's MD5 before and after, not assumed; mapping only those two streams is also what discards the
old score, which makes the operation safe to repeat. Wired into `render-charts.ts` because a film that
skipped scoring would ship silent beside 26 that are not, and NOTHING in a stills sweep or a frame check can
see a missing sound track. THREE FINDINGS, each of which produced a confident wrong result: (1)
**`execFileSync` returns stdout ALONE and ffmpeg writes every measurement to stderr** — the window picker
read an empty string every time and all eight tracks reported their loudest passage at exactly 0s; eight
identical answers is what a broken measurement looks like, not a coincidence (spawnSync now); (2) **`-of
csv=p=0` emits a trailing field separator** so a 23-second film probes as `"23.000000,"`, `Number()` of that
is NaN, and the NaN travelled into ffmpeg as `-t NaN` and surfaced three steps away as loudnorm "reporting
nothing measurable for source-06" — numbers are parsed out of the reading now, never cast from its shape;
(3) **a container's duration is the LONGER of picture and sound** (23.000s video under 23.061s audio), so
measuring the film that way put the fade-out past the last frame, still fading when the picture stopped.
All 26 films scored in 33s; sweep confirms every film has exactly ONE audio stream whose duration equals its
video's, films sharing a track have byte-identical audio and films on different tracks do not.
`music/sources/` + `*.m4a` gitignored (large, licensed); `library.json` + `assignments.json` committed —
they are what make the scoring reproducible. Docs: FORMULA §K Music + changelog row (the compounding owner
rulebook), CHARTS.md (usage + the three traps), marketing/video/CLAUDE.md, and the protocol skill's step 5
now says DO NOT run `gen:score:chart`. Gates: tsc clean (video), check:leak 0 hits over 122 files,
chart:verify 0 FAIL across all 26. NOT COMMITTED — owner has not asked.


2026-09-08 (Code): SAY WHAT IT IS — the chart headline rule, finished and made permanent. Owner:
"i had a claude session running last night that was fixing the complicated language in all the chart
videos… resume its work, if not review all videos one more time and ensure that there is no big
complicated language when trying to communicate the subject of the video." FOUND IT — session
20579157-…, killed by the 5-hour window at 22:50 mid-edit; its brief was "make sure the subject of
every chart video is crystal clear… the first piece of text they read is 'the gap that closed' which
can be confusing… i need the viewer to know right away what theyre watching, dont make anything more
complex than it has to be… and permanently make this a big rule for the whole protocol." WHAT IT HAD
FINISHED: a required `subject` on `ChartSpec` (what the film MEASURES, in plain words — "life
expectancy at birth", not "the gap that closed"), a `chart-verify` FAIL when the TITLE shares no word
with it (proved by re-injecting the owner's own example), a per-character WIDTH estimate for the 62px
band calibrated against two real frames (a character COUNT is not the test — "Eight different
cities." is 23 chars and 612px, "$200,000 in 2000." is 17 chars and 534px), 26 titles rewritten, 11
films re-rendered. **WHAT THE LIMIT LEFT BROKEN, and this is the finding: it edited four subtitles
AFTER re-rendering those four films.** `nikkei-1989`, `nowhere-to-hide`, `the-wage-that-stopped` and
`the-gap-that-closed` sat on disk with the OLD subtitle baked in and the new one only in source —
renders 22:41–22:48, edits 22:50, and the mtimes are the whole story. **Copy is baked into every
frame, so a spec edit is invisible until the film is re-rendered, and NOTHING here detects the
disagreement**: `chart-verify` reads specs, a stills sweep reads a fresh render, and only the mp4 is
wrong. An mtime comparison is a heuristic and OVER-reports (the dead session's own script added the
non-rendered `subject` field to all 26 specs, so eight untouched films look stale) — the check that
actually works is the house rule, reading the title band back out of the finished mp4 by frame INDEX.
THIS SESSION, on top: one more title (`sector-race-10k` "Which sector won this century?" → "Which
part of the / stock market won?" — "sector" is the trade's word and never said a sector OF WHAT);
seven subtitles de-jargoned ("cumulative change" → "how much each has risen"; "seasonally adjusted
annual rate" → "at a yearly pace, seasonally adjusted"; "total return… from one shared month" →
"dividends included… from the same starting month"; "priced against one January"; "price only");
labels where the word was undecodable rather than merely technical — Moody's `Aaa`/`Baa` → "Top-rated
firms"/"Mid-rated firms" (a rating code cannot be decoded at all, and both land at 15 chars so the
live rail keeps 3 columns: 78 + 16·w ≤ 320), and the clipped agency names `Educ. & health`/`Leisure &
hosp` → "Health, schools"/"Leisure, hotels" ("hosp" beside a health category reads as *hospital*);
and the y-axis chip "CUMULATIVE %" → "TOTAL % CHANGE" (5 films). DELIBERATELY NOT CHANGED, and said
rather than silently kept: `Prof./business`, where every plain alternative loses real meaning, and
the disclosures that are load-bearing — the fix for a jargon term that carries a claim is to keep it
and cut the words around it, not to drop it. Twelve films re-rendered into their own slots — seventeen render passes, five of them twice
because the axis-chip change landed after their first pass — each re-scored with its own assigned
track (picture stream copied, per the 09-07 music rule); all 26 films verified 1080x1920 / 690f /
30fps with exactly ONE audio stream at 23.000s. The rule is
now in the four places that bind, which is the half the dead session never reached: FORMULA §K "Say
what it is" + changelog row, CHARTS.md's honesty-gate section ("The headline"), marketing/video/
CLAUDE.md's gate paragraph, and the protocol skill's step-2 copy rules + step-4 gate list. Gates: tsc
clean, chart:verify 0 FAIL across 26 (29 WARN, all pre-existing data notes — holes, declared
excursions, deliberate cuts), check:leak 0 hits over 122 files, check:voice 0 hits over 283, title
bands read BY FRAME INDEX out of the finished mp4s. NOT COMMITTED — owner has not asked. OPEN: there
is still no record of what copy an mp4 was rendered with, so the stale-artifact class this session
fixed by hand can recur — a manifest written by `render-charts.ts` would close it, deferred as
unasked scope; and dragging a folder into YouTube pre-fills each title from the FILENAME, so
`chart-the-gap-that-closed.mp4` arrives as exactly the riddle the owner objected to (ids are
deliberately stable — music assignments and the re-render-to-its-own-folder rule both key on them —
so titles must be set at upload).


2026-09-08 (Code, same day): PLATFORM METADATA FOR THE CHART FILMS. Owner: "youtube prefills each
title from the filename, it also prefills the descriptions of these videos too, ive seen it
automatically advertise mag8, i want you to optimize the title and description of all video, research
effective tags for the title and description and add them, even add emojis if possible, and keeping
the language simple and easy to understand, i want a captivating title and description directly
related to the subject of the video." The flagged-but-unbuilt item from the morning, now built.
`scripts/chart-platform.ts` + `npm run chart:platform` → `marketing/youtube-chart-upload-plan-
2026-09-08.md`: 26 titles, descriptions, hashtags and tags. **GENERATED, NOT WRITTEN** — a
description is mostly figures and a retyped figure is the defect this repo keeps catching, so every
number is interpolated from the SAME frozen dataset the film renders from (`f.usd('NVDA')` cannot
disagree with the chart) and anything not in the data — a date, a historical fact, a span in years —
must be declared in that film's `claims` with its source, exactly like `knownExcursions` in a spec.
The generator REFUSES any other loose numeral; proved by injecting a false "$8,400,000" into the
Magnificent 7 entry and watching it FAIL. It also enforces the platform's limits (title 100,
description 5000, >15 hashtags makes YouTube ignore ALL of them, 500 characters of tags at 30 each)
and runs the leak pattern over every title, description and tag before writing. RESEARCH decided the
shape, not taste: a Shorts title is judged on its first ~40 characters and does better DECLARATIVE
than interrogative — so the on-screen headline stays a question ("What has it cost to borrow
money?") while the platform title states the payoff ("US Interest Rates Since 1976: Prime Hit 20.4%
💵"); the first ~100 characters of the description sit above the fold; hashtags go in the
DESCRIPTION (4 each), never the title; the tag box is worth about five minutes. THREE COPY BUGS THE
GENERATOR SURFACED, none of which a proofread would have caught: stripping a trailing zero made ONE
sentence carry two precisions — "$1.25 trillion against $1.2 trillion" — which reads as sloppiness
and understates a $49B gap; `num()` rounding to whole years turned Japan 84.04 and Italy 83.95 into
"84" and "84", a tie that does not exist in the one film whose whole subject is the ordering; and a
signed formatter printed participation RATES as "+56.4%", which reads as a rise rather than a share.
The traceability gate ALSO caught its own blind spot — it failed on "S&P 500", "Nasdaq 100" and
"10-yr Treasury", because a series LABEL is dataset copy too and several carry digits. Rule written
into FORMULA §J + changelog, marketing/video/CLAUDE.md, and the protocol skill as step 6b (a new film
with no entry FAILS the generator, deliberately). Gates: tsc clean, chart:platform 0 FAIL / 0 WARN
across 26, ZERO leak hits in the pack, longest title 58 chars. NOT COMMITTED — owner has not asked.
OPEN: the pack is written for YouTube; TikTok/IG/FB captions can be derived from the same generator
but were not asked for. The 16 older films keep their own pack
(`marketing/youtube-upload-plan-2026-07-10.md`) and are already live — untouched.


Memory twin (update BOTH): `~/.claude/projects/C--Users-nocap-Mag8/memory/mag8-project-state.md`.
