# Mag8 — agent notes, state 2026-07-09. README = user-facing; this file = authoritative. One commit per phase (`git log`).
Three-stage pipeline over `@anthropic-ai/claude-agent-sdk` + live SSE "Mission Control" UI. S1 `new-gen-stock`
discovers N candidates (4–12, default 8; prompt carries the date, recent-coverage anti-repetition, optional
focus modifier) → S2 `stock-scanner`/`gt-predictor`/`institutional-forecast` per candidate, independently
(3 candidates in flight, ≤9 sessions) → S3 tool-less compiler applies the Trillion-Dollar Confluence rubric;
deterministic TS re-verifies gate/confluence/score and re-sorts. Lenses agreeing IS the product (+10 bonus when
all three bullish). All stages `claude-sonnet-5` (`MAG8_{DISCOVERY,LENS,COMPILER}_MODEL`); effort high/**medium**/medium
— the 2026-07-06 RKLB A/B killed lens-high (blew the $1/call cap; medium: 97s, ~$0.69, 18 sources, first-try
handoff; raise `MAG8_LENS_EFFORT` + `MAG8_LENS_MAX_USD` together). WHITE-LABEL: nothing user-visible may name
skills/agents/the AI provider; `/admin` is the ONE exception.

## Map (single-source & non-obvious only — the rest is discoverable)
- `lib/schemas.ts` all zod + `ProgressEvent` + `LENS_META` + `sanitizeModifier()`; `lib/config.ts` every knob, `estimateRun()`, `authMode()`, `siteMode()/launchMode()`
- `lib/db.ts` ALL SQL, globalThis handle, boot reconciliation, `getRecentCoverage()` feeds discovery;
  `migrate()` = latest-shape `SCHEMA_SQL` + version-gated column-checked ALTERs (user_version 2: num_turns);
  `getAllTimeBoard('canonical'|'focused')` all-time boards split on params_json modifier presence (per-ticker
  best score, real runs only, mock fallback badged SAMPLE, computed on read); `latestCanonicalRun()` pins
  `/rankings` + home preview to no-focus runs (a lab run can never displace the weekly board)
- `lib/ranking.ts` rubric constants + `buildRubricText()` → compiler prompt AND /methodology; `lib/citations.ts` 32-work
  registry → /methodology References AND all four skills' `references/bibliography.md` (`npm run gen:bib`) — can't drift
- `lib/orchestrator/`: `agent.ts` is the ONLY `query()` caller; `prompts.ts` stage wrappers (date, coverage,
  modifier, Sources, naming discipline); `extract.ts` PRIMARY parser; `mock.ts` zero-spend through the same
  persist+emit path; `index.ts` executeRun + `lib/price-sanity.ts` hook; `lib/fixtures.ts` seeds run REAL math
- `lib/run-manager.ts` single-active-run lock; `useRunStream` event-sourced reducer; `app/api/runs/*` POST
  (202/400/401/409/503 + `code`), snapshot GET, SSE; `app/lab` token-gated public focus console
- `components/`: lens charts ALL null-safe (old rows render unchanged; error cells chartless); `HeroConfluence` WebGL (`?heroT=<s>` freeze)
- Brand: `npm run gen:logo` regenerates `public/brand/*` + `app/{icon,apple-icon}.png` from `marketing/logo-source.png`
  (favicons = black mark on light badge; `components/logo.tsx` + `.mark-glow` ink rim — never gold — carries it on
  nav/footer/hero/404/admin); `app/opengraph-image.png` re-shoot = headless-Edge (`--headless=new`) over scratch HTML
  with the vendored woff2 (satori/sharp can't render them); `metadataBase` ← `MAG8_SITE_URL`

## Invariants — do not break
1. SSE plumbing: `next.config.ts` keeps `compress:false` (gzip would buffer SSE) + `serverExternalPackages`
   `['better-sqlite3','@anthropic-ai/claude-agent-sdk']`. Persist progress events (sync INSERT) BEFORE emit;
   `progress_events.rowid` IS the SSE id; SSE route subscribes THEN replays synchronously — no `await` between.
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
   pre-compile; FATAL_AGENT_ERROR (plan limit/auth) fast-aborts; watchdog 45 min; per-call timeout + `maxBudgetUsd` caps in config.
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
- `next build` during `next dev` shares `.next` → dev serves 404 CSS (delete `.next`, restart). CRLF commit warnings
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
npm run pipeline -- --full [--count N] [--force] [--mock] [--focus "…"]   # --mock=$0; MAG8_MOCK_SPEED=0.12 fast
npm run pipeline -- --lens-probe TICKER [--effort L]    # one-cell A/B comparator
```
Fixture regression (`npm run seed`): ASTS 90.3 pass+confluence, RKLB 73.9, TMDX 69.5, SYM 51.5, IONQ 47.9,
CRSP 46.7, OKLO 42.7, ACHR 19.3 fail-gated #8; mock count ≥6 errors the CRSP×gt cell (CRSP → 46.4 + gap note);
ASTS×forecast cache-hits after a prior seed/mock. Leak probe (gate for any public-surface change): render `/`,
`/rankings`, `/methodology`, `/lab`, `/stocks/ASTS`, `/runs/<id>` + snapshot JSON + SSE, then
`grep -rniE "stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b"`
→ ZERO hits (`/admin` exempt; ONE owner-approved `agents?` exception since 2026-07-09: the homepage
"26 agents" / "26 AGENTS PER RUN" disclosure copy — everywhere else, incl. all run payloads, still zero).

## State & open items (deep detail: `HANDOFF-*.md`; video rulebook: `marketing/video/CLAUDE.md`;
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
Open: (1) signups store, nothing sends; (2) Railway trial → Hobby before the credit runs out.
Memory twin (update BOTH): `~/.claude/projects/C--Users-nocap-Mag8/memory/mag8-project-state.md`.
