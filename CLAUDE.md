# Mag8 — session handoff & working notes for Claude Code

Handoff from the sessions that built this project end-to-end (2026-07-02) and ran the
productization overhaul (2026-07-05/06). Read this before changing anything. `README.md` is the
user-facing doc; this file is agent-facing.

## What this is

Mag8 orchestrates four packaged Claude Skills (in `.claude/skills/`, committed — see invariant 3)
into a three-stage equity-research pipeline via `@anthropic-ai/claude-agent-sdk`, with a live SSE
"Mission Control" UI:

- **Stage 1** `new-gen-stock` discovers N candidates (4–12, default 8); prompt carries the date,
  recent-coverage anti-repetition pressure, and (optionally) an operator focus modifier
- **Stage 2** `stock-scanner` / `gt-predictor` / `institutional-forecast` run per candidate,
  independently, 3 candidates in flight → ≤9 concurrent agent sessions
- **Stage 3** compiler (no tools) applies the Trillion-Dollar Confluence rubric;
  deterministic TS re-verifies gate/confluence/score arithmetic and re-sorts

All three stages default to `claude-sonnet-5`; `MAG8_{DISCOVERY,LENS,COMPILER}_MODEL` restore opus
per stage. Effort defaults: discovery high, **lens medium**, compiler medium — the 2026-07-06 A/B
(RKLB probe) killed lens-high: it exceeded the $1 per-call cap and died mid-research, while medium
completed first-attempt (97s, ~$0.69 notional, 18 source links, full scenario extras). Raise
`MAG8_LENS_EFFORT` and `MAG8_LENS_MAX_USD` together.

Product thesis: independent lenses agreeing IS the signal (+10 confluence bonus when all three
lenses are bullish; gold in the UI exists only where a verdict exists).

**PUBLIC-FACING PRODUCT NOTE:** the site is white-labeled. Nothing user-visible may reveal the
skill/agent machinery or the AI provider (see invariant 11). `/admin` is the ONE exception.

## Session history (one commit per phase on `main`)

| Commit | What |
|---|---|
| 65a3140…7c435ad | original build: scaffold → data layer → orchestrator → API/SSE → pages → polish → README (see git log) |
| 30cc7a6 | overhaul P1: white-label public-view boundary + copy scrub |
| 6657add | P2: date injection, anti-repetition coverage block, focus modifier + /lab |
| a043bf0 | P3: effort/thinking/budget knobs, num_turns telemetry, --lens-probe harness |
| 15360cb | P4: structured lens wire fields (players/scenarios/institutions/horizons) + fixture data |
| 06f9cff | P5: anti-hallucination — Sources contract, grounding flags, cross-lens + external price checks |
| 24df288 | P6: skills editable, verified citations registry, bibliographies, methodology grounding |
| 2f0776b | P7: per-lens instrument charts, PipelineMap, confidence pips |
| (P8) | docs/memory/A-B/release sweep — this commit |

## Architecture map (where things live)

- `lib/schemas.ts` — every zod contract + `ProgressEvent` union + `LENS_META` + `lensHeadline()` +
  `sanitizeModifier()`; lens wire schemas carry OPTIONAL structured extras (scanner
  spotPrice/scenarios, gt players/horizonProbabilities, forecast institutions) per invariant 12
- `lib/config.ts` — models, concurrency, timeouts, maxTurns, effort/thinking/maxBudgetUsd knobs,
  `estimateRun()`, `authMode()` (api-key | subscription | none — invariant 10)
- `lib/db.ts` — ALL SQL lives here; globalThis-cached handle; boot reconciliation on first init;
  `migrate()` per invariant 13 (currently user_version 2: lens_analyses.num_turns);
  `getRecentCoverage(n)` feeds discovery anti-repetition
- `lib/ranking.ts` — rubric constants; `buildRubricText()` (compiler prompt + /methodology, single
  source); `deriveGate/deriveConfluence/computeScore/verifyRankedStock/finalizeRankings`
- `lib/citations.ts` — 32-work verified citation registry (5 groups keyed by public lens code);
  renders /methodology References AND generates each skill's references/bibliography.md via
  `npm run gen:bib` (single source, cannot drift). Rubric numerals only via ranking.ts constants.
- `lib/public-lens.ts` (client-safe codes/types) + `lib/public-view.ts` (server-only sanitizers +
  translators) — invariant 11
- `lib/price-sanity.ts` — independent quote cross-check between analysis and compile (invariant 14)
- `lib/fixtures.ts` — 8 deterministic ticker seeds through the REAL ranking arithmetic;
  `demoWeekKey()` = isoWeek + `-demo`; structured extras derived from existing seed numbers
- `lib/orchestrator/` — `agent.ts` (the ONLY `query()` caller), `prompts.ts` (wrapper prompts; date
  line, coverage block, modifier block, Sources requirement, naming discipline),
  `discovery|analysis|compiler.ts`, `index.ts` (executeRun; price-sanity hook), `mock.ts` (zero
  spend, same persist+emit path), `progress.ts`, `limit.ts`, `extract.ts` (PRIMARY parser)
- `lib/run-manager.ts` — single-active-run lock; `lib/hooks/useRunStream.ts` — event-sourced reducer
- `app/api/runs/*` — POST (202/400/401/409/503 with `code`), snapshot GET, SSE stream
- `app/lab/` + `components/lab/LabPanel.tsx` — public focus-run console (execution token-gated)
- `components/confluence/` — ConfluenceLine + paths + `HeroConfluence.tsx` (WebGL hero, `?heroT=<s>`
  freeze hook); `--color-macro` is copper so gold stays verdict-only
- `components/run/` — RunView, PipelineMap (desk schematic, dual layouts), StageRail, DiscoveryFeed,
  CandidateCard, MatrixGrid, MatrixCell (confidence pips), ActivityFeed, CompilerPanel
- `components/stocks/charts/` — chartUtils + ScannerCharts (F meter, Z band, scenario ladder) +
  GtCharts (dial, horizon fan, player map) + ForecastRangeChart; ALL null-safe (old rows render
  the card unchanged; error cells chartless)
- `scripts/` — `setup-skills.ps1` (extract only-if-missing), `seed-fixture.ts`,
  `gen-bibliographies.ts`, `run-pipeline.ts`
  (`--smoke | --full [--count N] [--force] [--mock] [--focus "…"] | --lens-probe TICKER [--effort L]`)

## Load-bearing invariants — do not break these

1. `next.config.ts`: `compress: false` (SSE would gzip-buffer) and
   `serverExternalPackages: ['better-sqlite3', '@anthropic-ai/claude-agent-sdk']`.
2. Progress events: **persist (sync SQLite INSERT) before emit**; `progress_events.rowid` IS the
   SSE id. SSE route subscribes THEN replays in one synchronous block — no `await` between them.
3. **Skills are editable; `.claude/skills/**` folders are the source of truth** (owner lifted the
   old read-only rule). They carry repo-only improvements: methodology grounding, generated
   bibliographies, funnel edits. `setup-skills.ps1` extracts ONLY when a skill folder is missing;
   the `*.skill` zips are vestigial first-install seeds (a re-extract loses the improvements —
   `git restore .claude/skills/<name>` brings them back). Scoping = SDK `skills: [name]` option.
   Do NOT add `'Skill'` to `allowedTools`.
4. `permissionMode: 'bypassPermissions'` requires `allowDangerouslySkipPermissions: true`.
5. Structured handoff — REALITY: CLI 2.1.198 treats `outputFormat: json_schema` as ADVISORY (fails
   open). The load-bearing contract is prompt-pinned at all three stages: final message = markdown
   analysis + trailing ```json fence with compact wire fields (lens schemas EXCLUDE
   `fullAnalysisMarkdown`; narrative stitched from message text). `agent.ts` prefers
   `.structured_output` when present, else `extractJsonLoose()`. Wire schemas normalize drift.
   Exactly ONE corrective retry resumes the session carrying the ACTUAL zod issues + schema.
   Agent sessions run `strictMcpConfig: true` + a `disallowedTools` list (else they inherit the
   machine's claude.ai MCP connectors — observed: Gmail/Shopify instructions inside lens sessions).
6. Fixture/mock lens rows use `demoWeekKey()` (`YYYY-Www-demo`) so demo data can NEVER satisfy a
   real run's cache lookup.
7. A lens-cell failure becomes an error cell (neutral 50 + gap note) — never a run failure.
   All-cells-failed aborts before compile; FATAL_AGENT_ERROR (plan limit/auth) fast-aborts the run.
   Run watchdog 45 min; per-call timeouts + maxBudgetUsd caps in config.
8. Gold (`--color-confluence`) is reserved for final verdicts only (score chips, braid, confluence
   badges, PipelineMap verdict node). Don't use it for anything else.
9. Every responsive grid needs an explicit base column (`grid-cols-1`); implicit auto columns break
   the 375px no-horizontal-scroll contract. Flex chip groups need `flex-wrap` (a nowrap chip row's
   min-content can exceed 375 — bit us in LensCard).
10. Mock runs: dev always; production only with `MAG8_ALLOW_MOCK=1`. Real runs require
    `CONFIG.authMode() !== "none"`: `api-key` (`ANTHROPIC_API_KEY`) or `subscription`
    (`CLAUDE_CODE_OAUTH_TOKEN` / logged-in CLI credentials; `MAG8_AUTH_MODE=subscription` asserts,
    `=disabled` blocks). Subscription runs bill NOTHING to an API account — plan usage; SDK
    `total_cost_usd` is then notional. Admin: no `ADMIN_TOKEN` → open in dev, locked in prod;
    constant-time compare in `lib/auth.ts`. **Owner's standing constraint: ZERO API spend —
    subscription only.**
11. **Public-view boundary** — no client payload (SSE frame, snapshot JSON, RSC prop into a client
    component) may bypass `lib/public-view.ts`. Three boundaries: SSE `send()`, snapshot GET, and
    the server pages (`app/runs/[runId]`, `app/stocks/[ticker]`, `app/rankings`). Client code keys
    everything by `PublicLens` (`fundamentals | macro | consensus`) from `lib/public-lens.ts`;
    `lens_status` reaches the browser with `lens`, never `skill`. Compiler reports are generated
    ALREADY-public (public lens keys + `sanitizeError` at source in compiler.ts). Model-authored
    text: all three stage prompts pin public report titles and forbid tool/skill/platform mentions.
    Internal ids stay in DB/persisted events/prompts; historical rows translate on the way out.
    Leak probe (below) must stay at zero hits; only `/admin` may name Claude/env specifics.
12. **Retry-proof wire extension pattern** — any new keyMetrics field must be
    `.optional().catch(undefined)` + tolerant preprocess; arrays slice-capped in preprocess
    (`capArray(n)`), NEVER `.max()` rejection. Malformed optional fields drop without triggering
    the corrective retry. GT player m/e/c are 1–10 (the skill's own rubric — pinning 1–5 recreated
    retry storms). Compiler prompt strips display-only rosters (players/institutions); scenarios +
    horizonProbabilities stay (they inform scoring).
13. **Migration pattern** — `migrate()` in `lib/db.ts`: `SCHEMA_SQL` always carries the LATEST
    shape; version-gated, column-check-guarded ALTERs upgrade existing files (currently
    `user_version = 2`).
14. **Modifier semantics** — `RunParams.modifier` (≤280, `sanitizeModifier()` strips
    fences/backticks/control chars) scopes **discovery only**; the lens stage is modifier-blind BY
    DESIGN (keeps the weekly lens cache valid); compiler gets it echoed for `marketOverview`. Rides
    `runs.params_json` — no DDL. Injected as a subordinate block that re-asserts
    universe/count/contract supremacy.
15. **Grounding checks are disclosed, not silent** — lens prompts require a trailing `## Sources`
    section (real URLs only); `analysis.ts` flags <3 links (fresh AND cached cells);
    `compiler.ts` flags scanner-spot vs forecast-spot divergence >20%; `lib/price-sanity.ts`
    cross-checks each forecast spot against an independent quote (>15% → flag; 3s timeout;
    fail-silent; `MAG8_PRICE_CHECK=0` kills it; **Yahoo v8 chart endpoint with a Mozilla/5.0 UA —
    Stooq's CSV API is dead** as of 2026-07: /q/l/ 404s, /q/d/l/ serves a JS challenge). All flags
    join the compiler prompt's Known gaps AND the report's gapsNoted deterministically. Honesty
    stance (also on /methodology): sampling can't be seeded; determinism lives in TS re-verify +
    weekly cache + these checks. Flag strings use PUBLIC lens labels only.

## Environment quirks discovered (this Windows machine)

- **Headless Edge lies about small viewports** (`--window-size=375` renders ~476px). Use the
  iframe-probe: a temp client page embedding the route in a `width:375px` same-origin iframe,
  measuring `scrollWidth` + per-element `right` (skip nodes inside overflow-x scrollers — nav and
  md-body tables legitimately exceed 375 inside their own clips). **App-router folders starting
  with `_` are private (404)** — name the temp page `app/probe375/`, and DELETE it + its
  `.next/types` stub afterwards.
- **Headless Edge freezes rAF** → framer entrance animations stuck mid-play AND recharts
  `ResponsiveContainer` never draws in plain `--screenshot`. Add `--virtual-time-budget=12000
  --run-all-compositor-stages-before-draw` (and `--enable-unsafe-swiftshader` for WebGL) to unfreeze
  for stills. Mid-run SSE pages may screenshot as "CONNECTING" — headless throttles EventSource;
  verify live states logically (the reducer drives terminal renders through the same code).
- `--virtual-time-budget` fast-forwards timers: mock runs complete before mid-run captures. For a
  mid-flight shot use a plain `--timeout=…` screenshot instead (no virtual time).
- `next build` while `next dev` shares `.next` → dev serves 404 CSS; delete `.next` and restart.
- Git prints LF/CRLF warnings on every commit — noise; `git -c core.safecrlf=false commit` calms it.
- `Expand-Archive` refuses non-.zip extensions; `setup-skills.ps1` uses .NET `ZipFile`.
- tsx doesn't auto-load env files → `run-pipeline.ts` calls `process.loadEnvFile()`.
- **Multi-line `npx tsx -e '…'` (single-quoted) prints nothing** in Git-Bash-on-Windows — write a
  temp probe file (`scripts/__*-probe.ts`), run, delete. Short double-quoted one-liners work.
- **Git-Bash mangles PowerShell `$_`** in inline commands (expands to junk) — use the PowerShell
  tool/host for pipelines like the port-3000 kill:
  `Get-NetTCPConnection -LocalPort 3000 -State Listen | … Stop-Process`.
- The Write tool once mangled control-char regex escapes into literal bytes — prefer `\x`-escapes
  and verify with `grep -c`.
- **Debug agent sessions from transcripts**: every SDK session (cwd = Mag8) writes
  `C:\Users\nocap\.claude\projects\C--Users-nocap-Mag8\<sessionId>.jsonl` — replaying final texts
  through extraction+zod reproduces cell outcomes EXACTLY. Corrective retries append to the SAME
  session file.
- SQLite is WAL — a read-only side connection is safe during a live run. NEVER import `lib/db.ts`
  from a side process while a run is active (boot reconciliation marks running runs interrupted).

## Commands

```bash
npm run dev / build / start
npm run setup:skills            # extract *.skill archives ONLY for missing skill folders
npm run seed                    # (re)seed fixture-demo-run — 8 candidates, 24 cells, event log
npm run gen:bib                 # regenerate references/bibliography.md ×4 from lib/citations.ts
npm run pipeline -- --smoke     # go/no-go probe (~$0.30 notional on subscription)
npm run pipeline -- --full --mock --count 8      # zero-spend e2e (MAG8_MOCK_SPEED=0.12 for fast)
npm run pipeline -- --full --count 4 --focus "…" # real focus-scoped run
npm run pipeline -- --lens-probe RKLB --effort medium   # one-cell A/B comparator
```

Fixture regression (`npm run seed`): ASTS 90.3 pass+confluence, RKLB 73.9, TMDX 69.5, SYM 51.5,
IONQ 47.9, CRSP 46.7, OKLO 42.7, ACHR 19.3 fail-gated #8. Mock runs count ≥6 error the
CRSP×gt-predictor cell (CRSP → 46.4 + gap note); ASTS×institutional-forecast cache-hits after a
seed/prior mock.

Leak probe (gate for public-surface changes): capture rendered HTML of `/`, `/rankings`,
`/methodology`, `/lab`, `/stocks/ASTS`, `/runs/<id>` + snapshot JSON + `--max-time 20` SSE, then
`grep -rniE "stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b"`
→ **zero hits** (exception: `/admin`).

## Open items

1. **W28 real run** — the 2026-07-06 count=4 focus run is the first clean-config live run (see
   README/session notes for outcome). If it hit the 5-hour window, re-run after reset: this week's
   ok cells cache-hit, only unfinished ones re-run.
2. **Email capture stores but never sends** — `email_signups` fills; no sender wired.
3. Deploy target undecided — needs a long-lived single instance (SSE bus + SQLite). Postgres port =
   rewrite `lib/db.ts` only; multi-instance SSE needs a shared bus.
4. Old error runs in /admin history can be deleted (cosmetic).

## Memory

A condensed twin of this file lives at
`C:\Users\nocap\.claude\projects\C--Users-nocap-Mag8\memory\mag8-project-state.md`.
Update BOTH when load-bearing decisions change.
