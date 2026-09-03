# Mag8

**Four research desks over one US-equity universe. One of them asks AI models to agree. Three ask public filings to.**

Mag8 is a Next.js app. A deterministic Stage-0 screen (~7,100 US listings → ~2,000 eligible, ranked on SEC XBRL fundamentals, every threshold owner-tunable from `/admin`) feeds four independent products:

| Product | The question it answers | Cost per run |
|---|---|---|
| **The Pipeline** `/rankings` | Which small/mid caps carry trillion-dollar DNA? | 26 agent calls |
| **The Bottleneck Desk** `/bottleneck` | What physical thing is this boom running out of? | **$0** |
| **The Rotation Board** `/rotation` | What is the market actually rotating into? | **$0** |
| **The Insider Scanner** `/insider` | Who is buying their own beaten-down stock? | **$0** |

The three desks keep every model out of the critical path — fetch → parse → arithmetic — so they cost nothing to run, draw no plan window, and every number they publish is reproducible from a primary source. 721 offline tests. 64 academic works cited from one verified registry, including, on every product's own page, the papers that argue *against* it.

Under all of it sits a fifth thing that is not a product: **one rule for what counts as evidence**, and a deterministic layer that fetches the primary sources before any research starts — see §6.

---

## 1. The Pipeline — `/rankings`

Four Claude Skills orchestrated (via `@anthropic-ai/claude-agent-sdk`) into a three-stage research pipeline with a live multi-agent Mission Control:

1. **Discovery** — a scout agent runs the `new-gen-stock` skill: the "trillion-dollar DNA" screen — heavy web research nominating small/mid-cap candidates that match the traits today's mega-caps had before they were big.
2. **Analysis matrix** — every candidate is analyzed by three agents that never see each other's work: `stock-scanner` (fundamentals: Piotroski F, Altman Z, reverse-DCF, value-trap gates), `gt-predictor` (public label **Game Theory**: player maps scored M×E×C, compelled moves, 3–24-month horizon probabilities, an Asymmetry Score, a falsifier), and `institutional-forecast` (live-verified street consensus). 3×N cells, concurrency-capped.
3. **Compile & verify** — a compiler agent applies the **Trillion-Dollar Confluence Score** rubric; deterministic TypeScript then re-derives the gate from the scanner's own labels, recomputes the arithmetic, re-sorts, and enforces the placement rule. The model judges; the code enforces.

The product thesis: any single analysis can talk itself into anything. Independent methods agreeing is harder to fake — that agreement (all three lenses bullish → +10 confluence bonus) is itself the signal, rendered everywhere as the gold braid.

## 2. The Bottleneck Desk — `/bottleneck`

Every boom is a spending number chasing a physical thing. The desk reads what companies actually filed (XBRL capex, de-cumulated from fiscal-YTD — the naive "latest 10-Q" is a 2.8× overstatement), converts the dollars into physical units through a versioned, sourced conversion table, and ranks categories by the **gap between demand's growth rate and supply's** — rates, not levels, so a conversion factor can never decide the ranking.

- **Seven themes.** Four of them fully researched: every conversion factor read from the primary document — Army FY2026 P-1 procurement exhibit, USGS Mineral Commodity Summaries 2026, BLS OEWS May 2025, EIA/Sargent & Lundy, EIA Uranium Marketing. The three older themes still carry placeholders and say so on the page.
- **Live reading:** AI-infrastructure capex **+85.7% YoY ($573.7B TTM)** against data-centre power at **+3.8%** — an 81.9pp tightening gap. Quantum's demand is R&D, not capex, and the desk names what it read rather than assuming.
- **13F clone** of any filer by CIK or name, diffed quarter over quarter by *share count* (a price move is not a trade). Holdings public; position sizing admin-only and never wired to a broker.
- Unmeasured ranks **last** and reads NOT MEASURED — never zero. A reading in which nothing was read is never stored.

## 3. The Rotation Board — `/rotation`

26 ratios of traded funds (RSP/SPY, HYG/IEF, XLU/SPY…) across breadth, style, sector, credit and geography, each scored on trend, momentum and z-score into a 0–10 composite with tiers and a direction deadband. VIX is reported as context and **never scored**.

- **State history is computed from bars, not logged** — five years of chart marks on day one, re-derived whenever the weights change. There is no state table, so there is nothing to drift.
- Two independent price sources behind one fail-open interface. A ratio whose legs disagree on adjusted-vs-raw basis is shown, flagged, and **barred from raising a signal**.
- The written brief is template-generated and then machine-verified: any numeral not traceable to an input is rejected before it can be published.
- Calibration is disclosed rather than quietly tuned — the published formula scores the flagship 1.1/No Signal while it sits at the 22nd percentile of its 3-year range. The percentile weight ships at 0, and `/methodology` prints a different paragraph the moment an owner moves it.

## 4. The Insider Turnaround Scanner — `/insider`

Starts at the rare event — a Form 4 **open-market purchase** — then price setup → Piotroski F / Altman Z strength gate → Buffett owner-earnings DCF (both capex bounds published, because the 1986 letter says the maintenance figure "must be a guess") → composite.

- **Nothing derived is stored.** No candidates, scores or rankings table — so changing the drawdown band, the discount rate or the required cushion re-derives the whole board *including every rejection reason*, with zero fetches. That is what makes the public conservative / balanced / aggressive picker free to a visitor.
- **Last full sweep:** 41,110 filings listed → 9,594 read → 197 companies with insider buying → 25 through the strength gate. 24.7 minutes, zero failures, $0.
- An unmeasured component is not zero: a company is scored on what exists, marked partial, and ranks below every complete one. Banks and REITs have no classified balance sheet, so solvency **refuses** to score them.

## 6. The source standard and the evidence layer — under everything

Not a product. Two things that sit beneath the pipeline, both deterministic and both free.

**One rule for what counts as evidence** (`lib/source-standard.ts`, published verbatim on `/methodology`). Usable signal is either a primary-source statement — the entity's own dated words, the artifact and not a summary of it — or practitioner material citing specifics a casual observer could not produce, judged on what it contains and never on which platform carried it. Everything else is a lead: it can tell you what to verify, it can never stand in for the verification, and alone it moves no verdict, score, probability or target. Three of the four playbooks already said a version of this in their own words; now they decide it the same way, because the same text is injected into every research prompt, written into every playbook by one generator, and printed on the methodology page.

**The primary sources, fetched before the research starts** (`lib/reach/`). Reaching further for evidence should not mean trusting more loosely, so the fetching is deterministic: what each candidate has itself filed (≈100% coverage — every US-listed company has a filing history), what the Fed, ECB, EIA and BLS have themselves published, and public developer activity for the ~15% of this universe that publishes code. Every item carries its date and a link that resolves, so an analysis cites the artifact instead of spending its budget hunting for one. Frozen weekly, so two readings of the same company in one week were shown the same evidence.

Absence is never a low reading. A company that could not be read says so; an organisation that publishes nothing is reported as *not measured*, never as zero — four companies here hold a registered developer account with nothing in it, and reading that emptiness as weak traction would be confidently wrong about all of them.

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

The three deterministic desks each ship a headless twin of their page — all $0, no model, no plan usage:

```bash
npm run bottleneck -- --probe                # live EDGAR + OpenFIGI smoke test
npm run bottleneck -- --refresh [PLAYBOOK]   # demand + supply, score the gaps
npm run bottleneck -- --13f CIK|NAME         # clone a filer's book and diff it

npm run rotation -- --refresh                # 31 tickers, ~39k closes, ~24s
npm run rotation -- --board [--indicator ID] # read the board (never hits the network)

npm run insider -- --refresh [--days N]      # incremental; days already read are skipped
npm run insider -- --board [--risk conservative|balanced|aggressive]
npm run insider -- --stock TICKER            # one company's full work-up
```

## Focus runs & /lab

The weekly no-input pipeline stays canonical, but a run can carry a one-line **focus directive**
("small cap only", "energy infrastructure", …) that scopes *which stocks the scout hunts* — never
the rules, count, or scoring. Focus scopes **discovery only** by design: lens analyses stay
focus-blind so the weekly cache stays valid, and the compiler simply echoes the focus in its market
overview. Set it from `/admin`, from the public **`/lab`** page (visible to everyone; execution
gated by the admin token), or headless via `--focus`. The run page shows a FOCUS chip; mock runs
show the chip as a label only (the demo cohort is fixed).

The two run kinds keep separate all-time records on `/rankings`: the **canonical board** aggregates
every stock the untouched weekly pipeline has surfaced, and the **lab board** aggregates the best
scores posted by focus-directed runs (each row shows the directive that surfaced it). Each board
tracks a stock's best score to date and moves only when a run of its own kind completes; the weekly
leaderboard and the home preview always show the latest *canonical* run, so a lab run can never
displace them.

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
- **Separation contract** — each desk writes only its own tables (`bottleneck_*`, `rotation_*`, `edgar_cache`) and never the pipeline's runs, candidates, analyses or rankings. Enforced structurally: zero foreign keys into pipeline tables, and all SQL still lives in `lib/db.ts`. A desk cannot move the leaderboard.
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

Mag8 is a research experiment. **It is not investment advice.** The pipeline's outputs come from AI models that can hallucinate figures, misread sources, or be confidently wrong; aggregated analyst targets have a historically poor hit rate; scores are arithmetic over model judgments, not predictions of returns. The three deterministic desks don't hallucinate, but arithmetic over real filings is still not a forecast: heavy capital spending has historically predicted *worse* returns, insider buying is concentrated in companies smaller than this universe, and 26 ratios across 4 tiers is exactly the setting data-snooping bias was described for. Each page cites the paper that says so. The in-app disclaimer (footer of every page + `/methodology`) is a good-faith draft — have a securities attorney review it before operating this anywhere near real users or real money.
