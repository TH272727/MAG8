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
```
Fixture regression (`npm run seed`): ASTS 90.3 pass+confluence, RKLB 73.9, TMDX 69.5, SYM 51.5, IONQ 47.9,
CRSP 46.7, OKLO 42.7, ACHR 19.3 fail-gated #8; mock count ≥6 errors the CRSP×gt cell (CRSP → 46.4 + gap note);
ASTS×forecast cache-hits after a prior seed/mock. Leak probe (gate for any public-surface change): render `/`,
`/rankings`, `/methodology`, `/lab`, `/bottleneck` (+`?playbook=<id>`), `/bottleneck/clone?cik=<n>`,
`/bottleneck/exposure`, `/rotation`, `/rotation/<id>`, `/insider` (+`?risk=<profile>`), `/insider/<ticker>`,
`/crossdesk` (+`?risk=<profile>`), `/tide`, `/tide/<id>`, `/stocks/ASTS`, `/runs/<id>` + snapshot JSON + SSE, then
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
Memory twin (update BOTH): `~/.claude/projects/C--Users-nocap-Mag8/memory/mag8-project-state.md`.
