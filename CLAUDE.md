# Mag8 — session handoff & working notes for Claude Code

This file is the handoff from the session that built this project end-to-end (2026-07-02).
Read this before changing anything. `README.md` is the user-facing doc; this file is agent-facing.

## What this is

Mag8 orchestrates four packaged Claude Skills (in `.claude/skills/`, committed, unpacked from the
`*.skill` zips in the repo root) into a three-stage equity-research pipeline via
`@anthropic-ai/claude-agent-sdk`, with a live SSE "Mission Control" UI:

- **Stage 1** `new-gen-stock` (opus) discovers N candidates (4–12, default 8)
- **Stage 2** `stock-scanner` / `gt-predictor` / `institutional-forecast` (sonnet) run per candidate,
  independently, 3 candidates in flight → ≤9 concurrent agent sessions
- **Stage 3** compiler (opus, no tools) applies the Trillion-Dollar Confluence rubric;
  deterministic TS re-verifies gate/confluence/score arithmetic and re-sorts

Product thesis: independent lenses agreeing IS the signal (+10 confluence bonus when all three
lenses are bullish; gold in the UI exists only where a verdict exists).

## Session history (all committed on `main`, one commit per phase)

| Commit | Phase | State |
|---|---|---|
| 65a3140 | 0 scaffold | next@15.5.20, agent-sdk@0.3.198, zod@4.4.3, better-sqlite3@12.11.1, tailwind v4 CSS-first |
| e947059 | 1 data layer | schemas, config, db, ranking, fixtures + seed (13 gate checks passed) |
| 5d326e9 | 2 orchestrator | agent core, 3 stages, run manager, mock, CLI; **smoke test PASSED live** |
| d195190 | 3 API + SSE | routes, stream, useRunStream; replay/live/409/resume all asserted |
| 65d888a | 5 pages | all 7 routes render on fixture data |
| 4fe99ce | 6 polish | measured 375px pass, terminal-run motion fix, nav/chip overflow |
| 7c435ad | 7 README + prod verification | build+start, auth ladder, interrupted reconciliation |

Everything is verified on the **zero-spend path** (fixture + mock). The only unverified thing is a
full real run (needs `ANTHROPIC_API_KEY`); the `--smoke` probe DID pass live via the logged-in CLI
(~$0.19): skills filter showed exactly `[stock-scanner]`, structured output round-tripped,
`bypassPermissions` ran Bash unattended, and the corrective resume-retry fired once and worked.

## Architecture map (where things live)

- `lib/schemas.ts` — every zod contract + `ProgressEvent` union + `LENS_META` labels + `lensHeadline()`
- `lib/config.ts` — models, concurrency, timeouts, maxTurns, `estimateRun()`, `authMode()`
  (api-key | subscription | none — see invariant 10), env knobs
- `lib/db.ts` — **ALL SQL lives here**; no raw handle escapes (node:sqlite swap = this one file);
  globalThis-cached handle; boot reconciliation (stale pending/running → interrupted + synthetic
  run_error event) runs on first init
- `lib/ranking.ts` — rubric constants; `buildRubricText()` (rendered into BOTH the compiler prompt
  and /methodology — single source, cannot drift); `deriveGate()` (from scanner's own labels),
  `deriveConfluence()`, `computeScore()`, `verifyRankedStock()`, `finalizeRankings()` (re-sort,
  fail-not-in-top-half via floor(n/2) exclusion zone)
- `lib/fixtures.ts` — 8 deterministic ticker seeds; report built through the REAL ranking arithmetic;
  `demoWeekKey()` = isoWeek + `-demo`
- `lib/orchestrator/` — `agent.ts` (the ONLY place that calls `query()`), `prompts.ts` (wrapper
  prompts; SKILL.md files never edited), `discovery|analysis|compiler.ts`, `index.ts` (executeRun,
  never rejects), `mock.ts` (same persist+emit path, zero spend), `progress.ts` (bus + `toActivity()`),
  `limit.ts`, `extract.ts` (fenced-block fallback parser, currently dormant)
- `lib/run-manager.ts` — single-active-run lock (globalThis + DB belt-and-braces), detached execute
- `lib/hooks/useRunStream.ts` — event-sourced reducer; `snapshotToStreamState()` for terminal runs
- `app/api/runs/*` — POST (202/400/401/409/503 with `code` field), snapshot GET, SSE stream
- `components/confluence/` — the signature ConfluenceLine (ambient/live/static + compact) + paths.ts;
  `HeroConfluence.tsx` (2026-07-03) — homepage-only WebGL shader hero (simplex flow lines, analytic
  bloom, irregular packet timing; hero-graded palette; `.hero-field` CSS in globals). Falls back to
  ConfluenceLine when WebGL is unavailable; `?heroT=<s>` freezes one frame (screenshots/tuning).
  `--color-macro` shifted amber→copper `#e0854a` so gold stays unique to verdicts.
- `components/run/` — RunView (client orchestrator) + StageRail/DiscoveryFeed/CandidateCard/
  MatrixGrid/MatrixCell/ActivityFeed/CompilerPanel
- `scripts/` — `setup-skills.ps1`, `seed-fixture.ts`, `run-pipeline.ts` (`--smoke | --full [--count N] [--force] [--mock]`)

## Load-bearing invariants — do not break these

1. `next.config.ts`: `compress: false` (SSE would gzip-buffer under `next start`) and
   `serverExternalPackages: ['better-sqlite3', '@anthropic-ai/claude-agent-sdk']`.
2. Progress events: **persist (sync SQLite INSERT) before emit**; `progress_events.rowid` IS the SSE
   id (Last-Event-ID resume is free). SSE route subscribes THEN replays in one synchronous block —
   no `await` between them, that's what makes it gap-free.
3. `.claude/skills/**` is read-only by policy. Scoping = SDK `skills: [name]` option (context
   filter). Do NOT add `'Skill'` to `allowedTools` — deprecated in SDK 0.3.198; the `skills` option
   auto-enables it.
4. `permissionMode: 'bypassPermissions'` requires `allowDangerouslySkipPermissions: true` (SDK option).
5. Structured output arrives on result message `subtype === 'success'` as `.structured_output`;
   failure subtype `error_max_structured_output_retries`. zod re-validates; exactly ONE corrective
   retry resumes the session (`resume: sessionId`).
6. Fixture/mock lens rows use `demoWeekKey()` (`YYYY-Www-demo`) so demo data can NEVER satisfy a
   real run's cache lookup (`getCachedLens` uses plain `isoWeekKey()`).
7. A lens-cell failure becomes an error cell (neutral 50 in scoring + gap note) — never a run failure.
   All-cells-failed aborts before compile. Run watchdog 45 min; per-call timeouts in config.
8. Gold (`--color-confluence`) is reserved for final verdicts only (score chips, braid, confluence
   badges). Don't use it for anything else.
9. Every responsive grid needs an explicit base column (`grid-cols-1` = `minmax(0,1fr)`); implicit
   auto columns refuse to shrink below min-content and break the 375px no-horizontal-scroll contract.
10. Mock runs: dev always; production only with `MAG8_ALLOW_MOCK=1`. Real runs require
    `CONFIG.authMode() !== "none"` (503 `no_auth` otherwise): `api-key` (`ANTHROPIC_API_KEY`) or
    `subscription` (`CLAUDE_CODE_OAUTH_TOKEN`, or auto-detected `~/.claude/.credentials.json` /
    `$CLAUDE_CONFIG_DIR/.credentials.json` from a logged-in CLI; `MAG8_AUTH_MODE=subscription`
    asserts it e.g. for macOS Keychain, `=disabled` hard-blocks). Subscription runs bill NOTHING to
    an API account — they draw on the plan's usage limits; `total_cost_usd` from the SDK is then
    notional. Admin: no `ADMIN_TOKEN` → open in dev, locked in prod; constant-time compare in
    `lib/auth.ts`.

## Environment quirks discovered (this Windows machine)

- **Headless Edge lies about viewport**: `--window-size=375` actually rendered a ~476px viewport.
  To test mobile for real, use the iframe-probe technique: a temp client page embedding the target
  route in a `width:375px` same-origin iframe, measuring `scrollWidth` + per-element `right` inside
  it (see Phase-6 commit message). Delete the probe page afterwards AND its stale `.next/types` stub.
- **Headless Edge freezes rAF** (background throttling): framer-motion entrance animations appear
  stuck mid-play in screenshots. Not a product bug — verify motion states logically or accept it.
- `--virtual-time-budget` fast-forwards timers, so mock runs complete before mid-run captures; for a
  mid-flight screenshot use `MAG8_MOCK_SPEED=3` (slower) and `--timeout=8000` instead.
- Git prints LF/CRLF warnings on every commit — noise, ignore. Commit with
  `git -c core.safecrlf=false commit` to reduce it.
- **Headless-Edge WebGL stills need**: `--enable-unsafe-swiftshader --virtual-time-budget=12000
  --run-all-compositor-stages-before-draw` plus the app's `?heroT=<s>` frozen-frame hook — without
  the virtual-time + compositor flags the canvas often never composites (frozen rAF), and whether a
  plain `--screenshot` shows it is a race. Also: `next build` while `next dev` shares `.next` →
  dev serves 404 CSS; delete `.next` and restart dev.
- `Expand-Archive` refuses non-.zip extensions; `setup-skills.ps1` uses .NET `ZipFile` instead.
- tsx doesn't auto-load env files → `run-pipeline.ts` calls `process.loadEnvFile()` for `.env.local`/`.env`.
- Killing port 3000: `powershell Get-NetTCPConnection -LocalPort 3000 … Stop-Process`.

## Commands

```bash
npm run dev / build / start
npm run setup:skills            # re-unpack *.skill archives (Windows PS; unzip manually elsewhere)
npm run seed                    # (re)seed fixture-demo-run — 8 candidates, 24 cells, event log
npm run pipeline -- --smoke     # go/no-go probe (~$0.20)
npm run pipeline -- --full --mock --count 8   # headless zero-spend e2e (MAG8_MOCK_SPEED=0.12 for fast)
```

Fixture regression expectation (`npm run seed` output): ASTS 90.3 pass+confluence, RKLB 73.9,
TMDX 69.5, SYM 51.5, IONQ 47.9, CRSP 46.7, OKLO 42.7, ACHR 19.3 fail-gated at #8.
Mock runs with count ≥ 6 deliberately error the CRSP×gt-predictor cell (CRSP rescores to 46.4 with
a gap note); the ASTS×institutional-forecast cell cache-hits after a seed/prior mock.

## Deliberate spec deviations (all flagged in README)

Native structured outputs primary (fenced fallback pre-built in `extract.ts`, activate only if a
real run shows native+skills misbehaving); additive `discovery_activity` + `compile_activity` event
variants; compiler prompt omits `fullAnalysisMarkdown`; email capture is a server action; deps added
(`react-markdown`, `remark-gfm`, `tsx`); deterministic re-verify; discovery gets `Read` (to read its
skill's references/ files — see below); `MAG8_ALLOW_MOCK` staging escape hatch.

## Open items (the actual next work)

1. **First full real run** — subscription auth (2026-07-03) means NO API key is needed: the user's
   logged-in CLI is auto-detected and `/admin` shows `CLAUDE SUBSCRIPTION AUTH` (user explicitly
   prefers this — zero API spend pre-marketing). Start with N=4 from `/admin` (~14 calls). Watch
   for: native structured output × skills interplay at scale, lens keyMetrics schema fit on real
   data (nullable fields), discovery returning exactly N, and plan rate limits mid-run (rate-limited
   cells degrade to error cells, neutral 50 + gap note; if that bites, lower
   `MAG8_MAX_CONCURRENT_STOCKS` or run in a fresh 5-hour window).
2. **`new-gen-stock` references — RESOLVED 2026-07-03.** The real `references/playbook.md` +
   `references/megacap-dna.md` (user-supplied; the package's SKILL.md was byte-identical to the
   installed one) are committed under `.claude/skills/new-gen-stock/references/`; every references/
   path across all four skills now resolves. Residual caveat: the gitignored `new-gen-stock (1).skill`
   archive is still the stub and `setup-skills.ps1` deletes + re-extracts each skill folder, so
   re-running `npm run setup:skills` removes the two files — restore with
   `git restore .claude/skills/new-gen-stock` (or repack the archive to make setup idempotent).
   The wrapper prompt's don't-stall-on-missing-files line stays as harmless resilience.
3. **Email capture stores but never sends** — `email_signups` table fills; no sender wired. Landing
   copy is honest about this.
4. Deploy target undecided — needs a long-lived single instance (SSE + in-process bus + SQLite).
   Postgres port = rewrite `lib/db.ts` only; multi-instance SSE needs a shared bus.

## Memory

A persistent memory file exists at
`C:\Users\nocap\.claude\projects\C--Users-nocap-Mag8\memory\mag8-project-state.md` (same facts,
condensed). Update BOTH it and this file if load-bearing decisions change.
