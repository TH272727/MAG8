# Mag8

**Four independent research lenses hunt the next trillion-dollar stocks. Agreement is the signal.**

Mag8 is a Next.js app that orchestrates four existing Claude Skills (via `@anthropic-ai/claude-agent-sdk`) into a three-stage equity-research pipeline with a live multi-agent Mission Control:

1. **Discovery** — a scout agent runs the `new-gen-stock` skill: heavy web research nominating small/mid-cap candidates that match the traits today's mega-caps had before they were big.
2. **Analysis matrix** — every candidate is analyzed by three agents that never see each other's work: `stock-scanner` (fundamentals: Piotroski F, Altman Z, reverse-DCF, value-trap gates), `gt-predictor` (game-theory macro read with an Asymmetry Score), and `institutional-forecast` (live-verified street consensus). 3×N cells, concurrency-capped.
3. **Compile & verify** — a compiler agent applies the **Trillion-Dollar Confluence Score** rubric; deterministic TypeScript then re-derives the gate from the scanner's own labels, recomputes the arithmetic, re-sorts, and enforces the placement rule. The model judges; the code enforces.

The product thesis: any single analysis can talk itself into anything. Independent methods agreeing is harder to fake — that agreement (all three lenses bullish → +10 confluence bonus) is itself the signal, rendered everywhere as the gold braid.

---

## Quickstart

```bash
npm install
npm run setup:skills   # unpacks the four *.skill archives into .claude/skills/
npm run seed           # seeds a complete demo run so every page renders with zero spend
npm run dev            # http://localhost:3000
```

Windows note: `setup:skills` is a PowerShell script. On macOS/Linux, unzip manually instead:
`for f in *.skill; do unzip -o "$f" -d .claude/skills/; done` (each archive contains one `<skill-name>/SKILL.md` folder).

Browse `/runs/fixture-demo-run`, `/rankings`, `/stocks/ASTS` to see the seeded demo. Trigger a **mock run** from `/admin` (dev-only, zero spend) to watch Mission Control stream live over SSE.

### Before your first real run

Real runs authenticate one of two ways — the Agent SDK's spawned Claude Code CLI resolves whichever is present:

- **Claude subscription (Pro/Max), no API key.** If this machine has a logged-in Claude Code CLI, it just works: leave `ANTHROPIC_API_KEY` unset and the admin desk shows `CLAUDE SUBSCRIPTION AUTH`. Runs consume your plan's usage limits (the 5-hour window) instead of billing an API account — $0 marginal cost. Good for personal/dev use; a busy full run can eat a real chunk of a 5-hour window, so start with `--count 4` and expect any rate-limited lens cells to degrade gracefully into error cells (scored neutral, gap noted). For a server you own, mint a token with `claude setup-token` and set `CLAUDE_CODE_OAUTH_TOKEN`. Don't put subscription credentials behind a public site where third parties trigger usage — that's what API keys are for.
- **Claude API key.** `echo ANTHROPIC_API_KEY=sk-ant-... >> .env.local` — per-token billing, the right choice once the site serves real traffic.

```bash
# 1. cheap wiring probe: auth, skills filter, structured output, bypassPermissions
#    (~$0.20 on an API key; a sliver of plan usage on subscription auth)
npm run pipeline -- --smoke

# 2. either run headless…
npm run pipeline -- --full --count 4
# …or restart `npm run dev` and click "Run the pipeline" on /admin
```

A real run makes `1 + 3N + 1` agent calls (N=8 → 26 calls, roughly $5–$22 on an API key and 15–30 minutes; on subscription auth the $ figure is notional plan usage. The admin desk shows the estimate before you confirm). One run at a time, by design.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | for real runs* | Claude API key used by the Agent SDK (per-token billing). *Alternatively, Claude **subscription auth** unlocks real runs with no key: a logged-in Claude Code CLI on the machine is auto-detected, or set `CLAUDE_CODE_OAUTH_TOKEN` (from `claude setup-token`). With neither, mock runs only. |
| `CLAUDE_CODE_OAUTH_TOKEN` | no | Long-lived Claude subscription token (`claude setup-token`) for machines without a logged-in CLI. Plan usage, no API billing. |
| `MAG8_AUTH_MODE` | no | `subscription` asserts subscription auth when detection can't see it (e.g. macOS Keychain); `disabled` blocks real runs even if credentials exist. |
| `ADMIN_TOKEN` | production | Gates `/admin` and `POST /api/runs` (constant-time compare; httpOnly cookie or `x-admin-token` header). Unset in development = desk open; unset in production = desk locked. |
| `MAG8_DISCOVERY_MODEL` / `MAG8_LENS_MODEL` / `MAG8_COMPILER_MODEL` | no | Model overrides (all three default to `claude-sonnet-5`; set e.g. `MAG8_DISCOVERY_MODEL=claude-opus-4-8` to run a stage on Opus). |
| `MAG8_MAX_CONCURRENT_STOCKS` | no | Candidates in flight at once (default 3 → ≤9 concurrent agent sessions). |
| `MAG8_DB_PATH` | no | SQLite path (default `./db/mag8.db`). |
| `MAG8_ALLOW_MOCK` | no | `1` enables zero-spend mock runs on a production/staging deployment (dev always allows them). |
| `MAG8_DISCOVERY_EFFORT` / `MAG8_LENS_EFFORT` / `MAG8_COMPILER_EFFORT` | no | Reasoning effort per stage (`low…max`). Defaults: high / **medium** / medium — the 2026-07-06 A/B showed a high-effort lens cell blows the $1 per-call budget cap, while medium completes with strong sourcing. Raise `MAG8_LENS_EFFORT` and `MAG8_LENS_MAX_USD` together. |
| `MAG8_*_MAX_USD` | no | Hard per-call USD caps (runaway protection): discovery 2.0, lens 1.0, compile 1.0. |
| `MAG8_*_THINKING` | no | `adaptive` \| `disabled` thinking override per stage (unset = SDK default). |
| `MAG8_PRICE_CHECK` | no | `0` disables the independent price cross-check that runs between analysis and compile. |
| `MAG8_*_TIMEOUT_MS`, `MAG8_MAX_TURNS_*`, `MAG8_MOCK_SPEED` | no | See `.env.example`. |

## CLI harness

```bash
npm run pipeline -- --smoke                  # go/no-go integration probe (pennies)
npm run pipeline -- --full --count 8         # whole pipeline headless, live console rendering
npm run pipeline -- --full --mock            # whole pipeline through the mock path (zero spend)
npm run pipeline -- --full --count 8 --force # skip this week's lens cache
npm run pipeline -- --full --count 4 --focus "small-cap defense"   # focus-scoped run
npm run pipeline -- --lens-probe RKLB --effort medium   # ONE lens cell, no run row/cache — the effort A/B comparator
npm run seed                                 # (re)seed the demo fixture run
npm run gen:bib                              # regenerate each skill's references/bibliography.md from lib/citations.ts
```

## Focus runs & /lab

The weekly no-input pipeline stays canonical, but a run can carry a one-line **focus directive**
("small cap only", "energy infrastructure", …) that scopes *which stocks the scout hunts* — never
the rules, count, or scoring. Focus scopes **discovery only** by design: lens analyses stay
focus-blind so the weekly cache stays valid, and the compiler simply echoes the focus in its market
overview. Set it from `/admin`, from the public **`/lab`** page (visible to everyone; execution
gated by the admin token), or headless via `--focus`. The run page shows a FOCUS chip; mock runs
show the chip as a label only (the demo cohort is fixed).

## Grounding checks

Every lens write-up must end with a `## Sources` section listing the URLs actually consulted;
write-ups with fewer than three links are flagged. The compiler receives — and the published report
discloses — deterministic cross-checks: the fundamentals and street-consensus lenses' spot prices
compared against each other (>20% apart → flag) and against an independent market-data quote
(>15% → flag, fail-silent, `MAG8_PRICE_CHECK=0` to disable). AI sampling cannot be seeded, so Mag8
does not claim determinism from the models; repeatability lives in the deterministic score
verification, the weekly cache, and these disclosed checks. The methodology page's References
section — and each skill's `references/bibliography.md` — render from one verified registry
(`lib/citations.ts`, `npm run gen:bib`), so the cited evidence base cannot drift.

## How it holds together

- **Contracts** (`lib/schemas.ts`) — zod v4 schemas for every agent handoff. Each agent ends its final message with the full markdown analysis plus one trailing ```json fence carrying compact wire fields (the SDK's `outputFormat: json_schema` proved advisory-only in practice, so the fence contract is pinned in the prompts). A tolerant parser (`lib/orchestrator/extract.ts`) salvages labeled/bare/commented fences; the schemas normalize real-world drift (enum casing, numeric confidences, numbers-as-strings); zod re-validates everything, and a failure triggers exactly one corrective retry that resumes the same session carrying the precise validation issues and the schema itself.
- **Rubric** (`lib/ranking.ts`) — gate multipliers, weights, bonus, and placement rule live as constants; `buildRubricText()` renders the same text into both the compiler prompt and `/methodology`, so the page and the pipeline cannot drift. `finalizeRankings()` recomputes everything and appends any correction to the stock's grounding notes in plain sight.
- **Cache** — lens analyses double as a cache keyed `(ticker, skill, ISO week)`, matching the scanner's weekly cadence. Cache hits render instantly as "cached" chips and cost $0. Demo/mock rows use a `-demo` suffixed week so fixture data can never leak into a real run's cache. `force` skips lookup.
- **Progress** — every event is persisted to SQLite *before* it is emitted in-process; the rowid doubles as the SSE event id, so browser reconnects resume via `Last-Event-ID` for free. Mission Control is fully event-sourced; terminal runs render server-side from a snapshot with no stream.
- **Resilience** — a lens-cell failure becomes an error cell (scored neutral, gap noted), never a run failure. Runs are watchdog-aborted after 45 min. On boot, any `pending/running` row left by a crash is marked `interrupted` with a synthetic terminal event so replaying clients always resolve.
- **Skills are versioned in-repo** — the committed `.claude/skills/**` folders are the source of truth and carry improvements the original archives don't have: methodology grounding with verified citations, generated bibliographies, a widened discovery funnel, and honesty framing for the scoring heuristics. `npm run setup:skills` extracts an archive **only when its skill folder is missing**, so it can never clobber the repo versions (a deliberate factory reset = delete the folder, re-run setup, `git restore` to come back). Per-call wrapper prompts + the SDK `skills` filter still scope each agent to exactly one skill.

### Deviations from the build spec (all flagged, all additive)

1. The spec's fenced-JSON+retry is the primary handoff (real runs proved the SDK's native structured outputs advisory-only on this CLI version; `structured_output` is still preferred whenever the CLI does return it).
2. Additive `discovery_activity` and `compile_activity` progress-event variants (Mission Control needs Stage-1/Stage-3 live feeds).
3. The compiler prompt omits `fullAnalysisMarkdown` (display-only bulk; the rubric consumes scores/summaries/keyMetrics).
4. Email capture is a server action rather than a fourth API route.
5. `react-markdown` + `remark-gfm` and `tsx` added to the dependency list.
6. `finalizeRankings()` deterministically re-verifies the compiler's arithmetic.
7. Stage-1 discovery also gets the `Read` tool so it can follow the skill's own "read references/" instruction (and degrade gracefully if the files are ever absent).

## Deploying

This app needs a **single long-lived Node process**: runs execute in-process for up to ~45 minutes, SSE connections stay open, and SQLite lives on local disk.

- **Good fits:** Render, Fly.io, Railway, a VPS, or any Docker host. `npm run build && npm run start`.
- **Vercel/serverless:** not as-is — verify long-running compute support before relying on it; the detached orchestrator and the in-process event bus assume one persistent instance.
- **Scale-out:** the SQLite layer is one file (`lib/db.ts` holds every SQL statement; no raw handle escapes it), so a Postgres port is contained. The in-process `EventEmitter` bus would need a shared channel (e.g. LISTEN/NOTIFY) for multi-instance SSE.
- **better-sqlite3 fallback:** if the native module won't build on your platform, `lib/db.ts` is the only file to swap to `node:sqlite`'s `DatabaseSync` (Node ≥ 22.5).
- **Docker + `bypassPermissions`:** agents run unattended with permissions bypassed. Don't run the container as root without a sandbox; give it a non-root user and no credentials beyond `ANTHROPIC_API_KEY` (or `CLAUDE_CODE_OAUTH_TOKEN`).

## Disclaimer

Mag8 is a research experiment demonstrating multi-agent orchestration. **It is not investment advice.** Outputs come from AI models that can hallucinate figures, misread sources, or be confidently wrong; aggregated analyst targets have a historically poor hit rate; scores are arithmetic over model judgments, not predictions of returns. The in-app disclaimer (footer of every page + `/methodology`) is a good-faith draft — have a securities attorney review it before operating this anywhere near real users or real money.
