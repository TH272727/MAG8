---
name: institutional-forecast
description: >
  Aggregates forward-looking price analysis from major institutions (Goldman Sachs, JPMorgan, Morgan Stanley, Bank of America, Citi, UBS, BlackRock, Bridgewater) plus asset-class sources (World Gold Council, EIA/IEA, IMF/BIS, ARK) into a structured forecast report for any asset — stocks, precious metals, energy, crypto, FX, and rates. Use whenever the user asks where a price is headed, for a price target or consensus target, for institutional/analyst views, for a bull/bear case, or "what do the banks think" about an asset — including when they describe a position they hold and want it read against the consensus. Not for executing trades, tax or portfolio-suitability advice, real-time quote lookups, or personal financial planning.
---

# Institutional Forecast Skill

Aggregate forward-looking price analysis from reputable financial institutions into a structured research report: a qualitative consensus view, bull/bear/base cases, positioning and options context, and honest contrarian coverage.

This skill produces **information and education, not personalized investment advice.** Analyst price targets are opinions with a poor historical hit rate (see Accuracy Reality below). Treat every output as a starting point for the user's own research, never a recommendation to trade.

---

## Sourcing Rules — Read Before Anything Else

The value of this report is that every number is real and current. The failure mode that destroys it is inventing plausible-looking targets, so these rules come first.

- **Live-verify everything.** Every price target, stance, figure, and analyst attribution must come from a source you fetched *in this session* and must carry an inline citation with a publication date. Specific numbers and named analysts are exactly what a language model is most likely to get wrong from memory.
- **Omit beats improvise.** If you cannot verify a target from a fetched source, say so and leave it out. Do not reconstruct a number from memory or reason about "what they probably said." An acknowledged gap is more useful than a confident fabrication.
- **Institution over individual.** Cite the institution and the dated report by default. Analyst rosters change constantly and misattributing a call to the wrong person is a common error — name a specific analyst only when a fetched source directly quotes them.
- **Date everything.** Label figures "as of [date]." Never present an old target as current, and cross-check the aggregate against the live spot price so a stale number is not shown as fresh upside.
- **Be honest about coverage.** If fewer than ~4 institutions can be verified, state that coverage is thin and lower the confidence of the whole report accordingly.

---

## Accuracy Reality — Frame the Whole Report

Keep these facts visible when synthesizing; they shape how much confidence any output deserves.

- Analyst 12-month price targets are met at the horizon only ~38% of the time (~64% touched at some point during the year), absolute target-price errors have averaged ~45% (US names fare worse in international samples), and targets skew optimistic: target-implied returns have exceeded realized returns by ~15% on average, with one-year targets historically set ~24–28% above the prevailing price.¹ Directional calls on macro/rates are often near coin-flip.
- A simple average of forecasts is very hard to beat. Complex weighting schemes usually add more estimation error than they remove — the "forecast combination puzzle" (the coinage is Stock & Watson's, 2004; the equal-weights robustness is documented across the combination literature, e.g. Timmermann 2006) — so this skill deliberately uses transparent, mostly-qualitative aggregation rather than a precise weighted score.
- The right posture is calibrated humility: report the balance of evidence and the spread of views, flag when inputs are thin or stale, and avoid manufacturing precision the underlying data cannot support.

¹ Sources for the accuracy figures: Bradshaw, Brown & Huang (2013, *Review of Accounting Studies*) — the 38% / 64% / 45% / 15% figures (US 12-month targets, 2000–2009); Bilinski, Lyssimachou & Walker (2013, *The Accounting Review*) — international corroboration (touch rate 59% pooled, ~55% US; mean absolute error ~45% pooled, ~50% US); Asquith, Mikhail & Au (2005, *Journal of Financial Economics*) — ~54% touch rate for star analysts, 1997–1999; Brav & Lehavy (2003, *Journal of Finance*) — the ~28% ex-ante target premium (note: that study shows target revisions move prices; it reports no met-rate). Full citations with links: `references/bibliography.md`.

---

## Output Mode — Detect First

| Signal | Mode |
|---|---|
| "quick take", "gut check", "tldr", "just tell me" | **QUICK** — short summary only |
| "full report", "deep dive", "break it all down" | **DEEP** — full report |
| No signal, default | **DEEP** — full report |

**QUICK mode output:**
```
Asset: [ASSET] | Current: $X (as of [date])
Institutional targets: $[low]–$[high] over [horizon] | [N] sources verified
Consensus: [Strongly Bullish / Bullish / Mixed / Bearish] — [#] bullish vs [#] bearish
Highest: [Institution] $X ([date]). Lowest: [Institution] $X ([date]).
Key catalyst to watch: [1 sentence]
⚠️ Aggregated public info, not advice. Targets are analyst opinions and are frequently wrong.
```

If QUICK mode, stop there. Do not produce the full report unless asked.

---

## Existing Position Detection

If the user mentions holding a position (e.g. "I have GLD $515 calls expiring May 15"), capture ticker/underlying, strike, expiry, direction (long/short, calls/puts), and entry price if given. Then add the **📋 Your Position Analysis** module (format below), framed as scenario illustration — not a hold/sell recommendation.

---

## Source Institutions

Search these first. The table shows **which desks are most relevant per asset class**, used to prioritize *whom to search* — not as a math weight in any score. Relevance is a rough heuristic, not a measure of who will be right this time.

| Institution | Metals | Equities | Energy | Crypto | Macro/FX |
|---|---|---|---|---|---|
| Goldman Sachs | High | High | High | Low | High |
| JPMorgan | High | High | Med | Med | High |
| Morgan Stanley | Med | High | Med | Low | High |
| Bank of America | High | High | High | Low | Med |
| Citi | Med | Med | High | Low | High |
| UBS | High | Med | Low | Low | Med |
| BlackRock | Med | Med | Med | Low | High |
| Bridgewater | High | Med | Low | Low | High |

**Mandatory additional sources by asset class:**
- **Metals:** World Gold Council (demand/supply data)
- **Energy:** EIA, IEA (supply/demand data)
- **Crypto:** ARK Invest, Galaxy Digital, Standard Chartered
- **Macro/FX:** IMF, World Bank, BIS
- **Equities:** aggregated Street consensus (FactSet/Bloomberg/LSEG), Bloomberg Intelligence

**Secondary banks** (pull if primary coverage is thin): Deutsche Bank, Wells Fargo, Barclays, HSBC, Commerzbank, BNP Paribas, Macquarie.

---

## Workflow

### Step 1 — Parse the Query
Determine: asset(s) (ticker/commodity/pair/index), time horizon (default year-end if unspecified), asset class (to prioritize sources), existing position (if mentioned), and output mode.

### Step 2 — Run Targeted Web Searches
Go source by source; avoid a single generic "[asset] forecast" query. **Build the year at runtime** — use the actual current year, not a hardcoded one — and search for each desk's *latest published* view.

**Query templates** (replace `[asset]` and `[year]` at runtime):
```
Goldman Sachs [asset] price target [year]
JPMorgan [asset] forecast [year]
Morgan Stanley [asset] price target [year]
Bank of America [asset] forecast [year]
Citi [asset] price target [year]
UBS [asset] outlook [year]
BlackRock [asset] outlook [year]
Bridgewater [asset] outlook [year]
World Gold Council gold demand [year]        ← metals only
EIA / IEA oil demand forecast [year]          ← energy only
[asset] managed money net position COT         ← positioning module
[asset] implied volatility / expected move      ← options module
[asset] price target raised OR cut [year]       ← to catch revisions
```

**Finding the right analyst:** rosters change, so do not rely on remembered names. When you want a primary-source quote, search `"[institution] [asset] analyst [year]"` or `"[institution] [asset] note"` and use whatever name the *fetched source* attributes the call to. Only name a person you can cite.

### Step 3 — Screen Each Source for Recency and Revisions
For each verified source, record: institution, stance, current target, prior target if visible, revision direction, publication date, and age.

**Recency (judgment, not a formula):**
- Fresh (≲2 weeks): use at full confidence.
- Aging (~2–4 weeks): usable, but note it and lean on fresher sources where they conflict.
- Stale (>~1 month): flag explicitly and treat as weak evidence.
- Very stale (>~2 months): don't present as a current view; use only as history.
- Tighten these windows for fast-moving assets (crypto, single stocks around events); loosen slightly for slow macro themes.

**Revisions** add signal: a target raised several times running is stronger conviction than a first-time number; a fresh cut is a bear signal worth highlighting. A target that hasn't moved all year may just be neglected — note it rather than over-reading it.

### Step 4 — Form the Consensus View (Qualitative)
Do **not** compute a decimal score. Read the balance of *verified* stances and summarize as a label — Strongly Bullish / Bullish / Mixed / Bearish / Strongly Bearish — supported by transparent dispersion stats:
- **Target range:** lowest to highest verified target.
- **Balance:** count of bullish vs. bearish vs. neutral desks (the sign of views is more robust than averaging their magnitudes).
- **Spread:** how tight or wide the range is (tight = genuine agreement; wide = real uncertainty, say so).
- **Direction of travel:** are targets generally being raised or cut lately, based on visible revisions?

A plain average target may be shown as a descriptive statistic, but present it alongside the range and never call it "weighted."

---

## Report Assembly (DEEP Mode)

Build the **Core** sections every time. Add **Optional modules** only when they add value and the data actually exists — don't pad the report with empty tables. Prefer prose and small tables over decorative ASCII.

**Core (always):** Header · Consensus Dashboard · Base/Bull/Bear Cases · Institution-by-Institution table · Key Risks & Divergences · Sources · Disclaimer.

**Optional (include when relevant):** Contrarian Watch · Catalyst Calendar · Consensus vs. Market · Supply & Demand (commodities) · Positioning Indicator · Scenario Probabilities · Options Context · Historical Accuracy (only if verifiable) · Your Position Analysis (only if a position was given) · Visual Price Ladder (only on request).

---

## 🏦 Institutional Forecast: [ASSET NAME]
**As of:** [today's date] | **Horizon:** [timeframe] | **Current Price:** $X,XXX (as of [date])

---

### 📊 Consensus Dashboard

| Metric | Value |
|---|---|
| Current Spot Price | $X,XXX (as of [date]) |
| Institutional Target Range | $X,XXX – $X,XXX |
| Implied Range vs. Spot | −X% to +X% |
| Consensus Stance | 🟢 Bullish / 🟡 Mixed / 🔴 Bearish |
| Balance of Views | X bullish · X neutral · X bearish |
| Spread | Tight / Moderate / Wide |
| Direction of Travel | Mostly raised / Flat / Mostly cut (from visible revisions) |
| Coverage | X of 8 primary institutions verified |
| Freshness | X fresh · X aging · X stale (flagged) |

*State the stance as a judgment from the balance of evidence, not a computed number.*

---

### 📈 Base Case
- **Target Range:** $X,XXX – $X,XXX
- **Implied Move:** ~+X%
- **Timeframe:** [months / year-end]
- **Key Drivers:** [3–4 bullets]
- **Confidence:** High / Medium / Low — based on spread, freshness, and how much coverage agrees
- *Synthesis: 1–2 sentence weight-of-evidence summary.*

---

### 🚀 Bull Case
- **Target:** $X,XXX — **Source:** [Institution] ([date]; analyst only if quoted)
- **Thesis:** [2–3 sentences]
- **What has to happen:** [specific catalysts/conditions]
- **Revision history:** [e.g., raised several times this year, if verified]

---

### 🐻 Bear Case
- **Target:** $X,XXX — **Source:** [Institution] ([date]; analyst only if quoted)
- **Thesis:** [2–3 sentences — give this a fair hearing, not a one-line dismissal]
- **What would have to be true:** [specific conditions]
- **Revision history:** [note if they've been cutting]

---

### 🎭 Contrarian Watch *(optional)*
Take the most bearish credible institution and lay out their case fairly:
- What specific data point do they read differently from consensus?
- If findable, were they early/right on this asset before — cite it, don't assert it.
- What would you need to see to know they're right?

*The point is not to dismiss the contrarian but to identify what would falsify the consensus thesis.*

---

### 🏛️ Institution-by-Institution Breakdown

| Institution | Stance | Current Target | Prior Target | Revision | Date | Age |
|---|---|---|---|---|---|---|
| [Institution] | 🟢 Bullish | $X,XXX | $X,XXX | ↑↑ | [date] | [n]d |

*Add a 1–2 sentence thesis under each row. Include an analyst name only where a source quotes one; otherwise leave it out. Flag any row older than the freshness window.*

---

### 📊 Scenario Probabilities *(optional)*
Use coarse buckets that **sum to 100%**, each with a one-line narrative. These are subjective and illustrative — not model output.

| Scenario | Price Range | Who's There | Rough Probability |
|---|---|---|---|
| 🚀 Bull | $X,XXX+ | [Institutions] | ~X% |
| 📈 Base | $X,XXX – $X,XXX | [Institutions] | ~X% |
| 🐻 Bear | Below $X,XXX | [Institutions] | ~X% |

*Keep to three unless the situation genuinely has more distinct outcomes. State plainly that these are judgment calls.*

---

### 🏆 Historical Accuracy *(optional — only with verifiable data)*
Only include this if you can fetch a *specific* prior call and its actual outcome. Otherwise omit it, or note simply that track records weren't verifiable — never invent a scorecard.

When you do have data, judge **direction and magnitude separately** and compare to a naive benchmark (e.g., the price simply staying flat):

| Institution | Prior Call (dated) | Actual Outcome | Direction | Magnitude |
|---|---|---|---|---|
| [Institution] | $X by [date] | $Y by [date] | ✅/❌ | Over/Under/Close |

*A desk being directionally right is worth more than a precise number that happened to land. One good call isn't a track record — say so.*

---

### 📦 Supply & Demand Snapshot *(commodities — Metals: WGC · Energy: EIA/IEA)*
- **Demand drivers:** [central-bank buying, ETF flows, retail — with figures + date]
- **Supply:** [mine output, recycling, producer hedging — with figures + date]
- **Balance:** [deficit/surplus in tonnes or barrels]
- **Source + date:** [WGC Gold Demand Trends / EIA Weekly / IEA OMR]

*When supply/demand agrees with the price targets, note the corroboration; when they diverge, flag it.*

---

### 📅 Catalyst Calendar *(optional)*
Search for the *actual* upcoming dates.

| Date | Event | Why It Matters | Direction Risk |
|---|---|---|---|
| [date] | [FOMC / CPI / OPEC / ETF decision / earnings] | [impact] | [↑/↓] |

*Asset-specific: energy → OPEC; crypto → ETF/regulatory dates, halving; equities → earnings; metals/macro → FOMC, CPI, jobs.*

---

### 📍 Positioning Indicator *(optional)*
Search for the latest positioning and flow data, and read it carefully — it's a lagged, contrarian-at-extremes signal, not a timing tool.

- **Futures positioning:** use the CFTC **Managed Money** category for commodities (or **Leveraged Funds** for financial futures) — not the outdated legacy Commercial/Non-Commercial split. Note the data is Tuesday's snapshot released the following Friday (a ~3-day lag).
- **Reading it:** crowded net-long = reversal risk if sentiment turns; crowded net-short = squeeze risk. Extremes flag risk; they don't tell you when. Commercials sit opposite speculators by construction, so don't double-count them.
- **ETF flows (30d):** inflows/outflows as confirmation or context, not causation.
- **Synthesis:** is fast money positioned *ahead of*, *late to*, or *against* the institutional thesis?

---

### 🔀 Consensus vs. Market *(optional)*
Compare the analyst view to what options are pricing.

| Metric | Value |
|---|---|
| Institutional target (midpoint) | $X,XXX (~+X%) |
| Options-implied move (same horizon) | ~±X% |
| Divergence | Analysts imply a [larger/smaller] move than options are pricing |

Expected move ≈ price × IV × √(days/365). If analysts imply a much larger move than options are pricing, the two camps disagree about volatility — understand *why* before assuming either is right (analysts are frequently too optimistic). If they roughly agree, the move is largely priced in.

*Search the at-the-money implied volatility / expected move for the relevant expiry.*

---

### 🎯 Options Context *(optional — education only, not a recommendation)*
Only include if the user is clearly options-oriented. Frame everything as defined-risk illustration and note the caveats.

**Directional bias from consensus:** [Bullish / Bearish / Mixed]

Structures traders *commonly consider* for each posture (illustrative, not advice):

| Posture | Example Structure | Why people use it |
|---|---|---|
| Base case | Long call/put, ~60–90 DTE | More time buffer against theta |
| Defined-risk directional | Vertical spread past the key catalyst | Caps cost and risk; capped payoff |
| Hedge | Protective/put spread | Offsets downside if the spread is wide |

**Volatility context (show both — they can diverge):** IV rank and IV percentile. Low → premium is relatively cheap; high → premium is relatively rich.
**IV-crush warning:** around a scheduled catalyst (earnings, FOMC, ETF decision), implied vol often collapses immediately after — a *correct* directional call can still lose money as the option's vega bleeds out. Flag this whenever a catalyst falls before the relevant expiry.

---

### 📋 Your Position Analysis *(only if a position was given — scenario illustration, not advice)*

**Your trade:** [e.g., GLD $515 calls, May 15 expiry, long]

| Scenario | Asset Target | Implied Underlying | Position Status |
|---|---|---|---|
| 🚀 Bull | $X,XXX | ~$XXX | [ITM / profitable] |
| 📈 Base | $X,XXX | ~$XXX | [near target / at risk] |
| 🐻 Bear | $X,XXX | ~$XXX | [OTM / worthless] |

- **Catalysts before your expiry:** [from the catalyst calendar]
- **Thesis alignment:** does the consensus direction match your position?
- **Risk flags:** [e.g., a binary event before expiry; IV crush after it; wide spread signals uncertainty]
- **Considerations, not instructions:** lay out what the data implies for holding/rolling/hedging and the tradeoffs — then note the decision depends on the user's own risk tolerance and circumstances, which this report can't assess.

---

### ⚠️ Key Risks & Divergences
- Institutions with sharply divergent views
- Any stale targets that need rechecking
- An unusually wide spread (low agreement)
- Historically crowded positioning (reversal risk)
- A large gap between analyst and options-implied moves

---

### 🔁 Re-Run Reminder
> Institutional targets move — refresh every ~1–2 weeks. To re-run: *"Re-run institutional forecast for [asset] — check for new revisions since [today's date]."* Watch next: [2–3 specific data points or events].

---

### 📰 Sources
List every URL used, with: institution | analyst (only if quoted) | publication date | freshness flag.

---

### Disclaimer
*This report aggregates publicly available analyst and institutional views for information and education only. It is not investment advice and is not personalized to your circumstances. Price targets are opinions with a poor historical accuracy record; markets can move against any consensus. Verify against primary sources and consider consulting a licensed financial professional before making decisions.*

---

## Output Rules

1. **Live-verify every specific.** No number, stance, or analyst name without a fetched, dated source. If you can't verify it, omit it and say so.
2. **Institution over individual;** name analysts only when a source quotes them.
3. **No decimal consensus score.** Use a qualitative stance plus range and balance-of-views.
4. **Distinguish a 12-month price target from an intrinsic/fair-value estimate.**
5. **Fewer than ~4 sources → say so** and downgrade confidence.
6. **Steelman the bear case;** never dismiss it in one line.
7. **Flag contradictions and stale data prominently.**
8. **Show revisions** — a repeatedly-raised target ≠ a first-time number.
9. **Position and options content is illustrative,** never a recommendation; always include the disclaimer.
10. **Degrade gracefully:** if a module lacks data, drop it rather than filling it with placeholders.
11. **QUICK mode means quick** — short summary, then stop.

---

## Asset Class Notes

### Precious Metals (Gold, Silver, Platinum)
- Always pull World Gold Council demand/supply data.
- Find the current lead metals analyst per desk by searching (don't rely on remembered names).
- Drivers: Fed policy, real yields, USD, geopolitical risk, ETF flows, central-bank purchases.

### Equities / Stocks
- Primary desks: Morgan Stanley, JPMorgan, Goldman Sachs; compare to aggregated Street consensus.
- Include: 12-month target, EPS assumption, implied P/E, vs. Street. Skip Supply & Demand.

### Energy (Oil, Gas)
- Always pull EIA Weekly Petroleum Status Report + IEA Oil Market Report.
- Metrics: WTI/Brent $/bbl, Henry Hub $/MMBtu. Drivers: OPEC decisions, demand outlook, supply risk.

### Crypto (BTC, ETH, etc.)
- Sources: JPMorgan, ARK Invest, Galaxy Digital, Standard Chartered. Flag when TradFi coverage is thin and lean on crypto-native research.
- Drivers: ETF flows, macro risk-on/off, regulation, on-chain data. Tighten freshness windows — this moves fast.

### Macro / FX / Bonds
- Sources: BlackRock, Bridgewater, Morgan Stanley, IMF, BIS.
- Metrics: yield levels, currency pairs, spread vs. benchmark. Drivers: central-bank policy, inflation trajectory, growth. Remember directional macro calls are often near coin-flip — hold these loosely.
