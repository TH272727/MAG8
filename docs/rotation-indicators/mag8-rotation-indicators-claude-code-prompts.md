# Mag8 — Rotation & Pivot Indicators: Claude Code Prompts

Companion to `mag8-rotation-indicators-spec.md`. Put both files in the repo (e.g. `docs/rotation-indicators/`) before starting.

**How to use this:** run the six prompts below **in order, one at a time, in the same Claude Code session** (or a session that can still read the docs folder), reviewing the output before moving to the next. Don't paste all six at once — Prompt 0 especially may surface decisions worth making before any code exists.

**Before you start:** there's no visibility into Mag8's actual application codebase from the planning conversation this came out of — only the four skills and planning docs. Prompt 0 has Claude Code inspect the repo itself and report back (or propose a starting stack if there's no app code yet) rather than guessing at a framework.

**House rules worth re-pasting if a session drifts:** no AI/LLM calls inside the calculation or scoring path; the Claude API fires only on a confirmed, batched state change; every number comes from a live fetch, never invented.

---

## Prompt 0 — Discovery & plan

```
I'm adding a new "Rotation & Pivot Indicators" feature to Mag8. Before writing any code:

1. Explore this repository and summarize: frontend framework (if any), backend/API
   framework and language, database/storage, existing market-data fetching patterns
   (if any), existing charting library (if any), how scheduled/background jobs run
   today (if any), and whether/how the four existing skills (new-gen-stock,
   gt-predictor, institutional-forecast, stock-scanner) are wired into an actual app
   versus only existing as standalone Claude Skills.
2. Read docs/rotation-indicators/mag8-rotation-indicators-spec.md in full — that's
   the feature spec for what I want built.
3. Write docs/rotation-indicators/ARCHITECTURE_PLAN.md mapping each section of the
   spec to concrete locations in this codebase: where the calculation engine lives,
   where indicator config lives, where charts/UI live, where the AI-recommendation
   layer lives, and how scheduling will work given what you found in step 1.
4. If this repo has no application code yet — i.e. Mag8 is currently just the four
   Claude Skills with no website/backend — say that explicitly and propose a
   minimal, sensible MVP stack rather than guessing silently.
5. Don't write feature code yet. Stop after the plan and list any open decisions
   you want me to confirm before proceeding.
```

## Prompt 1 — Core calculation engine (zero AI calls)

```
Implement the core rotation-indicator engine from mag8-rotation-indicators-spec.md,
Sections 2-3, following ARCHITECTURE_PLAN.md.

- A data-fetching module for arbitrary ticker pairs: primary source + fallback
  source per the spec's Section 6 tooling table, with retry/backoff and at least
  3 years of daily history. Cache fetched data so we're not re-pulling on every
  request.
- A pure-calculation module — no network calls, no AI calls, fully unit-testable —
  that, given two price series, computes: the ratio series, SMA50/SMA200, rolling
  1-year z-score, 3-year percentile rank, RSI(14) of the ratio, and 1mo/3mo/6mo
  rate of change.
- The composite Pivot Score (1-10) and Tier exactly as specified in spec Section 3,
  including the worked formula given there. Make the weighting configurable, not
  hardcoded.
- A state object per indicator: {ticker_a, ticker_b, label, category, score, tier,
  direction, zscore, percentile, trend, computed_at}. Persist each computed state.
- A state-change detector comparing today's state to the last persisted one,
  returning a diff only when Tier or Direction actually changed.
- Run this end to end for exactly one indicator — RSP/SPY — and show me the real,
  current output (actual score/tier/direction, not a mock) before we go further.
- Unit tests for the calculation module using synthetic price series with known
  expected outputs (e.g. a strictly rising ratio should score high on trend).
- No AI/LLM calls anywhere in this step.
```

## Prompt 2 — Full indicator catalog

```
Extend the engine to cover the full catalog in mag8-rotation-indicators-spec.md,
Section 4, categories A through F (skip Category G — the Mag8-native basket — for
now, that's a later prompt).

- Add each indicator as a config entry (ticker pair, label, category, one-line
  "what rising/falling means") — the engine from Prompt 1 should already
  generalize, so this shouldn't require new calculation code.
- Run the full catalog end to end and show me a table of current
  score/tier/direction for every indicator, grouped by category, so I can
  sanity-check the numbers before we build UI on top of them.
- Flag any ticker that failed to fetch or returned suspiciously thin history
  instead of silently dropping it.
```

## Prompt 3 — Charting UI with labels + the dashboard

```
Build the frontend for this feature per mag8-rotation-indicators-spec.md,
Section 7, following ARCHITECTURE_PLAN.md.

- Use [the existing charting library if ARCHITECTURE_PLAN.md found one, otherwise
  lightweight-charts] to render each indicator as its own chart: the ratio line,
  SMA50/SMA200 overlays, shaded bands where the rolling z-score is beyond ±2, and
  markers at historical state-change points (hover shows the date and what
  changed).
- Each chart header shows: the human label, current Tier badge, current Direction
  in plain English (name the actual tickers/assets, never just "up" or "down"),
  and the last-updated date.
- Build a "Rotation Signals" dashboard page: a sortable/filterable table of every
  indicator (category, label, score, tier, direction, days since last state
  change), linking to each indicator's full chart.
- If you're adding lightweight-charts, add the required attribution notice and
  tradingview.com link on the public page per its Apache-2.0 license terms.
- Match Mag8's existing visual design system if one exists; if not, use a clean
  dark-mode, data-dense style.
- Add the standard "not financial advice" disclaimer, matching wording/placement
  already used elsewhere in the app or the skills' output templates, visible on
  every page in this section.
```

## Prompt 4 — AI recommendation layer (cost-minimized)

```
Implement the AI-recommendation layer per mag8-rotation-indicators-spec.md,
Section 5.

- Trigger: only when the state-change detector from Prompt 1 returns a
  non-empty diff on a given run. Never call the AI on a schedule independent of
  an actual change, and never call it once per indicator if several changed on
  the same run — batch them into a single request.
- The request to Claude should include, per changed indicator: label, category,
  old tier/direction -> new tier/direction, the underlying
  zscore/percentile/trend numbers, and the 1-2 sentence "what this means" line
  from the catalog — and should explicitly instruct the model to synthesize a
  plain-English note from these given facts, never to invent a number.
- Use claude-sonnet-5 for this call — it's short structured synthesis, not a
  task that needs a bigger model.
- Output: one "Rotation Brief" (a few sentences per changed indicator) with the
  standard disclaimer appended.
- Cache the result keyed to the state hash — an unchanged state never
  regenerates a note or re-calls the API.
- Wire the note into the dashboard/chart UI from Prompt 3, with a "no active
  signal — last note from [date]" fallback when nothing has changed.
- Keep the model name/config for this call in one clearly-named place so I can
  tune it later without hunting through the codebase.
```

## Prompt 5 — Scheduling, reliability, ship it

```
Wire this into a scheduled job and harden it, per ARCHITECTURE_PLAN.md.

- Run the calculation engine (Prompts 1-2) once per trading day after market
  close — these are regime signals, not intraday trades, so daily is enough.
  Use whatever scheduling mechanism ARCHITECTURE_PLAN.md identified for this
  repo's hosting.
- If a data source fails for a ticker pair, fall back to the secondary source
  before giving up; if both fail, keep showing the last successfully computed
  state with a visible "data stale as of [date]" flag instead of crashing or
  showing nothing.
- Add basic logging so I can tell after the fact when a run happened, which
  indicators changed state, and whether the AI layer fired.
- Add a short README in docs/rotation-indicators/ covering: how to add a new
  indicator to the catalog, how to manually re-trigger a run, and how to tune
  the Pivot Score weighting.
- Run the full pipeline end to end once more and show me the final dashboard.
```

---

## After this ships (optional, later)

- A lightweight `rotation-check` companion Skill that runs the same engine on-demand in chat for when you're not on the website — most of the work is already done by Prompt 1's engine, this would just be a thin wrapper around it.
- Section 4G from the spec — the Mag8-native "current Mag7 basket vs SPY" indicator — once the public-ETF catalog has been live and stable for a while.
- The RRG-style quadrant chart for the 11-sector board (spec Section 7).
