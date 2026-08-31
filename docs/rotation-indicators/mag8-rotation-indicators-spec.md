# Mag8 — Rotation & Pivot Indicators: Feature Spec

*Reference document for Claude Code. Pairs with `mag8-rotation-indicators-claude-code-prompts.md`. Drop both files in the repo (e.g. `docs/rotation-indicators/`) before starting.*

## 1. What this feature is

A set of deterministic, free-data-driven ratio indicators that flag when the market (or a slice of it) is favoring one "regime" over another — mega-cap vs. broad market, growth vs. value, one sector vs. another, risk-on vs. risk-off — displayed as labeled charts inside Mag8, with a short AI-written recommendation attached only when a signal actually changes state.

**Design philosophy, in priority order:**
1. Every number on every chart comes from real, fetched market data — never invented or remembered by an LLM.
2. Every score, tier, and signal is computed by ordinary code, not by asking an AI to eyeball a chart.
3. The Claude API is called exactly once per detected state change — never on a schedule, never per page-load — and batches multiple simultaneous changes into one call.
4. This is what "free/open source, less AI, more accuracy" means in practice: cheap deterministic computation for the signal itself, AI reserved for turning an already-verified fact into a sentence a human can read.

This mirrors the house style already used in `stock-scanner` (gates, composite scores, verdicts) and `gt-predictor` (falsification conditions, base rates, live-data discipline) — same spirit, applied to regime/rotation questions instead of single-stock picks.

## 2. The flagship indicator: RSP / SPY

- **RSP** — Invesco S&P 500 Equal Weight ETF. **SPY** — SPDR S&P 500 ETF Trust (cap-weighted).
- Ratio = Price(RSP) ÷ Price(SPY).
- **Ratio rising** → the average S&P 500 stock is outperforming the index → breadth improving → favors broad/equal-weight, more diversified exposure.
- **Ratio falling** → a handful of mega-caps are carrying the index → concentration rising → favors the largest names (the Mag7-type cohort Mag8 is built around) — but persistent narrowing is also a classic late-cycle fragility signal, not automatically bullish for mega-caps.
- This is the exact ratio from the reference screenshot: a multi-year downtrend, i.e. sustained mega-cap dominance.

## 3. Generic signal methodology (applies to every ratio in the catalog)

Given ratio R = Price(A) ÷ Price(B), computed daily over 3+ years of history:

- `SMA50`, `SMA200` of R → trend regime
- `zscore = (R_today − mean(R, 252d)) / stdev(R, 252d)` → how stretched
- `percentile = percentile_rank(R_today, R_history_3y)` → where today sits historically
- `RSI(R, 14)` → momentum of the ratio itself. This is a legitimate, well-established technique — applying momentum math to a relative-strength ratio (not the underlying price) is the same core idea behind Relative Rotation Graphs / JdK RS-Ratio & RS-Momentum (see StockCharts ChartSchool: https://chartschool.stockcharts.com/table-of-contents/chart-analysis/chart-types/relative-rotation-graphs-rrg-charts). Worth knowing about as a Phase 2 visualization — see Section 7.
- Rate of change over 1mo / 3mo / 6mo windows

**Composite Pivot Score (1–10):**
```
trend_score    = 10 if |SMA50 - SMA200| / SMA200 > 3% and direction confirmed,
                 scaled toward 0 otherwise
stretch_score  = min(10, abs(zscore) * 3.3)        # zscore of ±3 ≈ 10
momentum_score = scaled distance of RSI(14) from 50 (further from 50 = higher)

pivot_score = round((trend_score + stretch_score + momentum_score) / 3, 1)
```
Weights should be configurable, not hardcoded — matching the "weighting preset" pattern already used in `stock-scanner`.

**Tiers:**

| Score | Tier |
|---|---|
| 8–10 | Strong Pivot Signal |
| 5–7 | Building |
| 3–4 | Neutral / Rangebound |
| 1–2 | No Signal |

**Direction** — always plain-language, naming the actual tickers/assets ("Favors: SPY / mega-cap," never just "up"). **State** = (Tier, Direction). Log a **state change** only when Tier crosses a boundary or Direction flips — this is the *only* trigger for the AI layer (Section 5). Every indicator also carries a one-line **falsification note**, mirroring the falsification sections already in `gt-predictor` / `stock-scanner`.

## 4. Full indicator catalog

Verify every ticker still exists, is liquid, and has adequate history before wiring it up — this list is accurate as of when this file was written, not guaranteed current. Same live-verify discipline the rest of Mag8 already follows.

### A. Market cap / breadth

| Ratio | Tickers | Rising means | Falling means |
|---|---|---|---|
| Equal-weight vs cap-weight S&P 500 | RSP / SPY | Breadth improving, broad market favored | Mega-cap concentration rising |
| Small-cap vs large-cap | IWM / SPY | Small caps leading (often early-cycle) | Large caps leading (often late-cycle/defensive) |
| Mid-cap vs large-cap | IJH / SPY | Mid-caps leading | Large-caps leading |
| Equal-weight vs cap-weight Nasdaq-100 | QQQE / QQQ | Broader tech participation | Mega-cap tech concentration — narrower than even RSP/SPY |

### B. Style / factor

| Ratio | Tickers | Rising means | Falling means |
|---|---|---|---|
| Growth vs value | VUG / VTV | Growth leading | Value leading |
| Momentum factor vs market | MTUM / SPY | Momentum working | Momentum lagging |
| High-beta vs low-vol | SPHB / SPLV | Risk appetite up | Risk-off, defensive positioning |
| Quality factor vs market | QUAL / SPY | Quality/balance-sheet strength rewarded | Risk-on, junk rally |

### C. Sector rotation

| Ratio | Tickers | Rising means | Falling means |
|---|---|---|---|
| Discretionary vs staples | XLY / XLP | Consumer confidence, risk-on | Consumer pulling back — a well-known early-recession tell |
| Tech vs staples | XLK / XLP | Growth favored | Defensive rotation |
| Financials vs market | XLF / SPY | Credit/rate backdrop favorable | Credit stress or falling-rate drag |
| Energy vs market | XLE / SPY | Commodity/inflation cycle heating up | Disinflationary, soft-demand backdrop |
| **Full 11-sector board** | XLK, XLF, XLV, XLY, XLP, XLI, XLE, XLB, XLU, XLRE, XLC vs SPY | A ranked relative-strength table across all SPDR sectors, mapped to the classic business-cycle rotation model (early / mid / late-cycle / recession leadership) | |

### D. Risk appetite / credit

| Ratio | Tickers | Rising means | Falling means |
|---|---|---|---|
| High yield vs Treasuries | HYG / IEF | Credit risk appetite rising | Credit stress building — one of the most tightly-correlated risk-off signals to equities |
| Copper vs gold ("Dr. Copper") | CPER / GLD | Growth optimism | Fear / flight to safety |

### E. Geography

| Ratio | Tickers | Rising means | Falling means |
|---|---|---|---|
| International vs US | VXUS / VTI | Rest-of-world leading | US-exceptionalism trade |
| Emerging vs US | EEM / SPY | EM risk-on | Flight to US / developed markets |

### F. Volatility regime (context gauge, not a ratio)

- VIX level + trend vs its own 1-year range — read alongside every ratio above as regime context, not as its own pivot signal.

### G. Mag8-native (Phase 2 — the real differentiator)

- An equal-weighted basket of the current Mag7 (or the live `new-gen-stock` shortlist) vs SPY. This is Mag8's own IP rather than a public ETF ratio — exactly the kind of proprietary asset the project brief's defensibility section calls out as the real moat. It's more work (constructing and periodically rebalancing a custom basket in code, not just dividing two ETF prices), so sequence it *after* the public-ETF catalog above is live and stable.

## 5. AI recommendation layer — cost-minimized by design

- **Trigger:** only a detected state change from Section 3's engine. Never a timer, never per page-load, never per-indicator-per-day.
- **Batching:** if N indicators change state on the same run, that's one Claude API call producing one "Rotation Brief" — never N separate calls.
- **Scope of what's sent to Claude:** for each changed indicator — label, category, old tier/direction → new tier/direction, the underlying zscore/percentile/trend numbers, and the 1–2 sentence "what this means" line from Section 4. Instruct the model explicitly to synthesize from these given numbers, never to invent or estimate a figure itself. This is what keeps the AI layer both cheap and accurate — it's writing, not calculating.
- **Caching:** key the generated note to a hash of the state; an unchanged state never regenerates a note or re-calls the API.
- **Model:** `claude-sonnet-5` is the right fit for this — short, structured synthesis from clean inputs, not a task that needs a bigger model.
- **Disclaimer:** every AI-generated note carries the same "not financial advice" framing already used across `gt-predictor` / `stock-scanner` / `institutional-forecast`.

## 6. Free / open-source tooling

| Need | Recommendation | Notes |
|---|---|---|
| Primary price data | `yfinance` (Python) | Free, no key, most-supported option — but it scrapes unofficial Yahoo endpoints, so it *will* occasionally rate-limit or break without warning. Cache aggressively, add retry/backoff, never let a failed fetch take the whole dashboard down. |
| Fallback price data | Stooq (`stooq.com/q/d/l/` CSV endpoint, or via `pandas-datareader`) | Genuinely independent pipeline from Yahoo, not just a mirror — worth having as a real second source. Also unofficial/undocumented, so the same caching discipline applies. |
| Macro/credit series (optional) | FRED (official, free, documented, requires a free API key) | Use if you want a raw credit-spread series (e.g. ICE BofA HY OAS) alongside the HYG/IEF ratio. |
| *Not recommended as primary* | Alpha Vantage | Free tier is 25 requests/day, 5/minute as of 2026 — too thin to refresh a 20+ indicator catalog daily. Fine only as an occasional spot-check on one or two series. |
| Calculation | `pandas` + `numpy` (SMA, z-score, percentile, RSI are each a few lines; `pandas-ta` if you'd rather not hand-roll them) | |
| Charting | TradingView `lightweight-charts` (npm: `lightweight-charts`) | Free, Apache-2.0, ~35KB, built for exactly this (candlesticks, line overlays, markers). **License requires an attribution notice + a visible link to tradingview.com on the public-facing page** — small thing, easy to skip by accident, don't. |
| Scheduling | Whatever the existing Mag8 infra offers (cron, serverless scheduled function); GitHub Actions on a schedule works as a zero-cost fallback for an MVP | |

## 7. UI / UX requirements

- Every indicator gets its **own labeled chart**: the ratio line, SMA50/SMA200 overlays, shaded bands where the rolling z-score is beyond ±2, and markers at historical state-change points (hover shows the date and what changed).
- Each chart header shows: the human label (e.g. "RSP / SPY — Mega-Cap Concentration"), current Tier badge, current Direction in plain English, last-updated date.
- A **Rotation Signals dashboard**: one sortable/filterable table of every indicator — category, label, score, tier, direction, days since last state change — linking out to each full chart.
- **Phase 2 idea:** an actual RRG-style quadrant chart (relative-strength trend on one axis, momentum-of-that-trend on the other) for the full 11-sector board specifically — that's the one indicator group where seeing everything on one scatter plot beats eleven separate line charts. Don't build this first; the line-chart-per-indicator version is the MVP.
- Disclaimer visible on every page in this section, matching wording already used elsewhere in Mag8's output templates.

## 8. Non-negotiables (worth re-stating if a build session drifts)

1. No AI/LLM call anywhere inside the data-fetch, calculation, scoring, or state-detection path.
2. The Claude API is called only on a confirmed state change, batched, and cached.
3. Every price/ratio/date shown is fetched live — never hardcoded, never remembered from training data.
4. Every indicator carries a falsification note and a disclaimer.

---
*Not financial advice. This document specifies a research/analytics feature; it is not a recommendation to buy, sell, or hold any security.*
