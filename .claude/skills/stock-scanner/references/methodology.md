# Methodology: the evidence base

This file explains *why* the scanner works the way it does, so you can apply judgment to cases the rubric doesn't anticipate. It also contains the deep-research checklist for Step 4. Read it when sourcing and researching candidates.

## Table of contents
1. Factor investing — what actually has robust return premia
2. Value traps vs genuine mispricing
3. Asymmetric / convex payoff investing
4. Quality and franchise (moat) assessment
5. Smart-money and insider signals
6. Catalysts and events
7. Behavioral pitfalls to guard against
8. Deep-research checklist (Step 4)

---

## 1. Factor investing — what actually has robust return premia

The core lesson: **combinations of factors beat single factors, and value works best alongside quality and momentum.** This is the empirical foundation for the fifth pillar of the thesis (confirmation, not just cheapness).

- **Fama-French.** The five-factor model (market, size, value, plus profitability RMW and investment CMA) added profitability and investment to the classic three-factor model. Profitability (robust-minus-weak) is the factor that has held up most robustly across regions and periods; it is why this scanner adds an explicit quality gate rather than screening on cheapness alone.
- **Momentum (Jegadeesh-Titman; Carhart UMD).** Recent winners over 3–12 months tend to keep outperforming recent losers over the next 6–12 months — one of the most robust and widely replicated patterns in finance.
- **52-week-high momentum (George & Hwang, 2004).** Proximity to the 52-week high predicts returns *better* than past returns, and those returns do not reverse in the long run. Interpreted through anchoring bias: investors under-react to good news in stocks near their highs. **This is the single most important corrective to a naive "buy what's most beaten-down" screen.** A stock in free-fall far below its high is, on the base rates, more likely to keep falling than to snap back — unless there is a confirming turn. Hence the confirmation gate.
- **Quality-minus-junk (Asness, Frazzini & Pedersen).** Going long profitable, growing, safe, well-managed firms and short "junk" has delivered positive returns in the large majority of markets studied, with a negative market beta and mild positive convexity — meaning quality tends to hold up in crises, exactly when a beaten-down value book is most exposed. Quality is a natural hedge for value and a direct antidote to value traps.

**Practical implication for the scanner:** treat a cheap price as the entry screen, then require quality (profitability, moat) and confirmation (momentum stabilizing, revisions turning, a catalyst). Cheap + high-quality + confirming is the target zone. Cheap + junk + still-falling is what the gates exist to reject.

## 2. Value traps vs genuine mispricing

A value trap looks cheap on trailing multiples because the business is structurally deteriorating — the multiple is low for a reason. Separating the two:

**Signs of a trap (deteriorating):** declining revenue, compressing margins, ROIC falling below cost of capital, rising leverage, secular/structural decline, insider selling, and a widening gap between net income and operating cash flow (an accruals red flag).

**Signs of genuine value (improving or stable):** fundamentals stable or improving but temporarily obscured by sentiment, positive earnings revisions, improving FCF trajectory, ROIC at or above WACC (or credibly trending there), insider buying, momentum stabilizing, and a credible catalyst.

**The falling-knife problem:** "value without a trigger can remain dead money" indefinitely, and often keeps falling. This is why the scanner never buys cheapness alone — it pairs every idea with a catalyst and a confirmation signal. The screenable filters that operationalize this (Piotroski F-Score, Altman Z-Score, ROIC vs WACC, debt trends, accruals) live in `references/screening-thresholds.md`.

## 3. Asymmetric / convex payoff investing

The goal is convexity: small, capped downside and large, open-ended upside.

- **"Heads I win; tails I don't lose much" (Pabrai).** Seek situations where the downside is minimal and the upside is a multiple of it — ideally risking a little to make a lot. Favor few, high-conviction bets over many diffuse ones.
- **Probability-weighted scenarios, not point estimates.** Replace a single price target with bear/base/bull cases, each assigned a probability and a price target; compute a probability-weighted expected value and an explicit reward/risk ratio. This is the single biggest analytical upgrade over a naive fair-value estimate, and it *is* the asymmetry thesis made quantitative. The template is in `references/valuation-templates.md`.
- **Sizing intuition (Kelly).** Position size should scale with edge; sophisticated practitioners deliberately bet a fraction of full Kelly (e.g., half-Kelly) to tame volatility. For a research watchlist, translate this into conviction tiers rather than literal position sizes unless the user asks for sizing.

## 4. Quality and franchise (moat) assessment

A moat is a sustained spread of **ROIC over WACC**; its strength is the *magnitude and durability* of that spread.

- Analyze industry structure first (profit pools, market-share stability — large average share shifts signal an unstable, low-moat industry), then firm-specific advantage sources: low-cost production, network effects, switching costs, intangibles/brand, and efficient scale.
- **Competitive Advantage Period (CAP):** the number of years a firm can earn ROIC > WACC on incremental capital. "Compounders" sustain the spread longer than the market expects and tend to earn superior risk-adjusted returns. Underappreciated durability is a legitimate source of asymmetry.
- **Practical checks:** ROIC-vs-WACC spread and its trend, gross-margin stability, pricing power, reinvestment runway, and a wide/narrow/no-moat judgment. Thresholds are in `references/screening-thresholds.md`.

## 5. Smart-money and insider signals

Use insider and institutional activity as *confirmation*, weighted by how predictive each signal actually is:

- **Insider buying is informative; selling mostly is not.** Purchases — especially open-market buys — have historically preceded meaningful outperformance, with the strongest effect in smaller firms. Selling is noisy (diversification, taxes, liquidity) and should carry little weight.
- **Cluster and opportunistic buys are the high-conviction signal.** Multiple insiders buying within a short window, purchases by a CFO or an independent director, and open-market ("code P") transactions carry far more signal than routine, scheduled activity. Routine, pre-planned trades carry essentially no predictive power.
- **Discount the weak stuff.** Ignore 10b5-1 pre-scheduled sales and option-exercise/vesting activity. Treat 13F institutional filings as lagged (up to 45 days) and stale — useful color, not a trigger.

## 6. Catalysts and events

Near-term catalysts are what turn a cheap-but-quality stock into a timely one.

- **Post-earnings-announcement drift (PEAD).** Prices tend to drift in the direction of an earnings surprise for weeks to months afterward; the larger the standardized surprise, the larger the drift. A recent large positive earnings surprise combined with positive estimate revisions is a screenable, evidence-backed catalyst. Revenue surprises strengthen the effect.
- **Earnings revisions.** Upgrades to forward estimates predict continued drift. Combine a surprise with improving relative strength for the highest-conviction setups.
- **Other catalysts:** product launches, regulatory decisions, partnerships, capital-return initiatives, index inclusion, and macro/sector tailwinds. Always attach a rough timeline; a catalyst with no clock is just a hope.

## 7. Behavioral pitfalls to guard against

- **Anchoring on past highs.** "It's down 60% from its peak, so it's cheap" is an anchoring trap; the peak is not fair value. Judge against intrinsic value and current trajectory, not the old price.
- **Narrative fallacy and confirmation bias.** A compelling story is not evidence. For every idea, deliberately seek the disconfirming data and write the falsification condition (what would prove the thesis wrong).
- **Recency.** Don't extrapolate the last quarter or the last move indefinitely; growth and margins mean-revert.
- **Overfitting and survivorship.** Treat every backtested edge as probabilistic, not guaranteed — several well-known factors have weakened out-of-sample. Present factors as tilts in the odds, never certainties.

## 8. Deep-research checklist (Step 4)

For each candidate that clears the gates, gather via web search:

1. **Price & drawdown:** current price, 52-week high/low, distance from the 52-week high (not just the all-time high), and whether price action is stabilizing or still deteriorating.
2. **Financials:** revenue (TTM + growth), gross/operating margins and their trend, EPS, free cash flow and its trajectory, and the accruals check (operating cash flow vs net income).
3. **Valuation:** P/E, P/S, EV/EBIT, EV/EBITDA versus sector peers *and* the stock's own history.
4. **Growth & unit economics:** revenue growth, user/customer growth, TAM and share trajectory, and (for software) Rule of 40.
5. **Quality & moat:** ROIC vs WACC and its trend, gross profitability, pricing power, moat sources and durability.
6. **Financial strength:** Piotroski F-Score inputs and Altman Z-Score (see thresholds file).
7. **Insider & institutional:** recent insider *buys* (flag clusters, CFO/independent-director, open-market), notable fund entries/exits (noting 13F lag).
8. **Competitive landscape:** the 2–3 closest rivals compared on scale, growth, margins, and valuation, with an explicit answer to "why this stock over its closest competitor?" If a rival is objectively stronger on most dimensions, treat that as a red flag and explain why the pick still wins on asymmetry or mispricing — or drop it.
9. **Catalysts:** dated near-term triggers (earnings, launches, regulatory, capital return, macro).
10. **Risks / bear case:** the strongest arguments against the thesis, competitive threats, execution and balance-sheet risks.
