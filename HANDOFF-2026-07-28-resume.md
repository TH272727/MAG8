# HANDOFF 2026-07-28 — Resume (E): finishing a run that stopped mid-flight

**Owner ask:** *"can you finish the work of Run faaa8ffe…, i didnt have enough tokens to finish it, and i
dont see any resume button, please add the resume button too just for admin testing on my subscription
credits."*

---

## 1. What was broken

Run `faaa8ffe` (2026-07-27, count=8, force — the **first real run after S0 v3 + selection/blind**) died at the
5-hour plan limit partway through Stage 2:

| | |
|---|---|
| Discovery | **complete** — 8 candidates persisted (IREN, SEI, CRCL, FIG, SITM, TMDX, TTAN, DUOL) |
| Lens matrix | **8 of 24 cells ok**, 16 errored on the session limit |
| Compile | never ran → **no report, no rankings** |
| Spent | $7.80 notional |

The only way forward was a **fresh run**: re-spend Stage 1, get a *different* cohort, and re-do the 8 cells
that had already succeeded. The weekly lens cache would not have saved them either — it keys on
`(ticker, skill, iso_week)` and the run carried `force: true`, which skips cache reads by design.

So: the work was strandable, and there was no affordance to continue it. That is what this change fixes.

## 2. What shipped

### `lib/orchestrator/resume.ts` — `planResume(runId)`
Read-only, spends nothing, and is the **single source of truth** for both questions:

- *Can this be finished?* → blocks `not_found` / `run_active` / `mock_run` / `already_complete` / `no_cohort`.
- *What is left?* → the persisted cohort plus this run's own `ok` lens rows rebuilt as **banked**
  `CellOutcome`s (`costUsd: 0` — that spend is already in the row's total; grounding flags recomputed so a
  thin-sourcing caution still reaches the report).

Because the cohort is persisted, **Stage 1 never repeats** — a resume cannot drift to a different set of
names. A run that died *before* delivering a cohort has nothing to carry forward and is correctly refused.

### `runAnalysisMatrix(…, { banked })`
Banked cells are carried straight through: not re-run, not re-billed, not even queued. A candidate whose whole
row is banked **takes no concurrency slot**, so the limiter admits only real work. `remaining === 0` is legal
and means *re-compile only* (the case where a run got through the matrix and died compiling).

### `executeResume(runId, plan)` in `lib/orchestrator/index.ts`
- `reopenRun()` clears status/error/finished_at **in place**; cost **accumulates** onto the existing row.
- `getWeeklyUniverse(false)` — forced, *regardless of the run's own `force` flag*. One cohort must be judged
  against **one** frozen ground truth; a refetch mid-cohort would split it across two.
- `marketContext` recovered from the run's own `discovery_complete` event (`getRunMarketContext`) — the only
  place it is persisted, so the compiler reads what Stage 1 actually said rather than a stub.
- Selection-discipline flags recomputed **flag-only** (`hardGate` forced off: a resume can never re-pick).
- Banked cells from an older ISO week → explicit `gapsNoted` disclosure that the cohort is not all as-of one
  date.

**Stages 2–3 were extracted into one shared `analyzeAndCompile`**, used by both `executeRun` and
`executeResume`, so a fresh run and a resumed one cannot drift apart.

### Surfaces (all admin-only, all server-decided)
- **`/admin` run history** — a `Finish` column. Eligibility comes from `runTallies()`: two grouped counts, no
  lens payloads loaded, for the whole 30-row list.
- **`/runs/<id>` error banner** — the same button, shown only when the desk cookie checks out (`runTally()`).
  A visitor's RSC payload never carries it, and the API re-checks the token regardless.
- **`POST /api/runs/[runId]/resume`** — admin-gated and behind the launch curtain like every run route
  (202 / 400 / 401 / 404 / 409 / 503 + `code`).
- **`npm run pipeline -- --resume RUN_ID`** — the headless twin, identical code path.

## 3. The SSE fix this depended on

A resumed run's event log carries its **earlier attempt's terminal event in the middle of the log**. Both ends
treated any terminal frame as end-of-stream, so a resumed run's live view died on connect — the replay hit the
old `run_error`, the server closed the body, and the client closed the EventSource before a single new frame
arrived.

- **Route** — suppress cleanup for terminal frames seen while `replaying && liveOnConnect`.
- **`useRunStream`** — close on `onerror` only when the *last* frame was terminal; otherwise let EventSource
  retry with Last-Event-ID (a network blip must never strand a live run).
- **Reducer** — `stage_start` clears `error`/`terminal`: re-entering a stage means the run is live again.

**Verified live during the resume:** the historical `run_error` sat at frame 205 and **98 further frames
streamed past it**. Before the fix the feed was cut at 205.

## 4. White-label hole found by the mandated leak probe

Pre-existing, not introduced here — but the gate surfaced it, so it is fixed.

Lens write-ups cite their own instructions as **"the skill"**: *"Treated per the skill's pre-profit edge
case"* (FIG × fundamentals), *"held modestly per the skill's own caution"* (SEI × game theory), *"Flagged
exception, per the skill's own discipline"* (SITM × fundamentals). These render on the public run page and
`/stocks/<ticker>`, and `sanitizeMarkdown`'s deliberately narrow pass never caught the bare word.

**Fixed two ways:** four self-reference tokens added to `EXACT_TOKENS` (capitalized variants first, so
sentence case survives) — which retro-translates rows already persisted — and the lens prompt's naming
discipline now bans **generic self-reference**, not just names.

**Deliberately NOT scrubbed:** the same words as *subject matter* — `agentic AI`, `AI agents`, and a source
URL containing `ai-agents`. That is the market talking, not us. Rewriting it would falsify analysis prose and
break the real source links invariant 11 requires.

**Consequence — an owner call (CLAUDE.md open item 7):** the leak grep as literally written still flags those.
The gate now means **zero *architecture* hits**. Pick one: (a) keep as-is and read it that way, (b) whitelist
`agentic|AI agents|https?://\S+` before matching, or (c) scrub market prose too — rejected here for the
reasons above.

## 5. Operational finding worth more than the code

**The 5-hour plan window recovers continuously, not only at the stated reset time.** Resume attempt 2 ran at
15:07 Denver against a window that reported "resets 7:50pm", and still banked **6 more cells** before dying
again. A limit-abort is therefore worth retrying *within the hour* — each attempt ratchets the run forward and
nothing is ever re-spent.

This is exactly why resume is idempotent and re-entrant. Run `faaa8ffe` was finished across **three**
attempts: 8 → 14 → 24 cells, with zero re-spend at each hand-off.

## 6. Gates

| Gate | Result |
|---|---|
| `tsc --noEmit` | clean |
| `npm run seed` | **EXACT** — ASTS 90.3 · RKLB 73.9 · TMDX 69.5 · SYM 51.5 · IONQ 47.9 · CRSP 46.7 · OKLO 42.7 · ACHR 19.3 fail-gated #8 |
| `npm run gen:bib` | no-op (4 unchanged) |
| `next build` | clean; `/api/runs/[runId]/resume` registered |
| Leak probe | 0 architecture hits — `/`, `/rankings`, `/methodology`, `/lab`, `/stocks/*`, `/runs/<id>`, snapshot JSON, SSE |
| API guards | 404 unknown run · 400 mock run · 202 valid · (409 active-run path shares `startRun`'s lock) |
| Resume plan | dry-run verified before any spend: 8 banked / 16 remaining / no stale weeks / marketContext recovered (1282 chars) |

## 7. Note on the auth probe

`isAuthorized` cannot be negative-tested on this box: with **no `ADMIN_TOKEN` in the environment**,
`tokenMatches` returns true for any token in development (invariant 7 — open in dev, locked in prod). A probe
intended as a 401 check therefore returned 202 and started a resume. The resume itself was wanted work and
completed the run; the lesson is that the 401 path needs a server started **with** `ADMIN_TOKEN` set to be
exercised. The route uses the same `isAuthorized(req)` as `POST /api/runs`, which is already proven.
