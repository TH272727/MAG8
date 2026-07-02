# Screening thresholds & hard gates

Concrete, screenable metrics that operationalize the methodology. Read this at Step 2 (eligibility) and Step 3 (the hard gates). Treat thresholds as informed defaults, not laws — tune them to the user's universe, and always explain any exception you make.

## Table of contents
1. Eligibility filters (Step 2)
2. The three hard gates (Step 3)
3. Piotroski F-Score — all 9 criteria
4. Altman Z-Score
5. Quality & profitability metrics
6. Value / price metrics
7. Growth & sentiment metrics
8. Quick-reference threshold table

---

## 1. Eligibility filters (Step 2)

Apply before spending research effort. These just establish the stock is investable and worth analyzing:

- **Market cap** ≥ $1B (below this, proceed only if asked and flag small-cap risk).
- **Liquidity** — average daily volume generally > 500K shares, enough for clean entry/exit.
- **Franchise** — recognizable brand or well-known within its industry.
- **Revenue** — growing, or with a clear, credible path to acceleration.
- **Not in obvious terminal decline** — screen out melting ice cubes at a glance; the gates below do the rigorous version.

## 2. The three hard gates (Step 3)

Every candidate must clear all three, or carry a documented, flagged exception.

**Gate A — Financial strength (the value-trap / distress filter).**
- Piotroski F-Score ≥ 6 (see §3). A score ≤ 3 is a red flag; treat as a trap unless there is a specific, compelling reason.
- Altman Z-Score outside the distress zone (see §4).
- Purpose: keep deteriorating and distressed businesses off the watchlist. This gate is also the **veto gate** in the scoring rubric — failing it caps the overall rating.

**Gate B — Quality (the cheap-junk filter).**
- ROIC > WACC, or a clear, evidenced trend toward it. As a rough anchor, look for ROIC in the low-double-digits or better for an established business.
- Healthy Novy-Marx gross profitability (gross profits / total assets) relative to peers (see §5).
- Purpose: reject businesses that are cheap because they are low-quality.

**Gate C — Confirmation (the falling-knife filter).**
- At least one turn signal: price stabilizing / improving proximity to the 52-week high, positive 6–12 month relative strength, positive earnings revisions, or a concrete dated catalyst.
- Purpose: avoid buying cheapness with no reason to correct. A stock can pass A and B and still be dead money without this.

**Documented exceptions.** Some legitimate ideas fail a gate for structural reasons — most often a high-growth cash-burner where Altman Z is not meaningful and F-Score is depressed by heavy reinvestment. Include such a name only if the growth and asymmetry are compelling, mark it speculative, and state exactly which gate it fails and why the exception is justified. Never wave a stock through silently.

## 3. Piotroski F-Score — all 9 criteria

A 9-point checklist of financial-statement health, designed to separate improving businesses from deteriorating ones. Each criterion scores 1 point if true, 0 if false. It is most powerful among cheap, small/mid-cap names — exactly this scanner's hunting ground. Use it as a *filter*, not a standalone buy signal (its long/short spread has weakened out-of-sample).

**Profitability (4 points)**
1. Positive return on assets (ROA) in the current year.
2. Positive operating cash flow (CFO) in the current year.
3. ROA higher than the prior year (improving).
4. CFO greater than net income (earnings backed by cash — an accruals-quality check).

**Leverage, liquidity & funding (3 points)**
5. Long-term-debt-to-assets ratio decreased year-over-year (lower leverage).
6. Current ratio increased year-over-year (better liquidity).
7. No new shares issued in the year (no dilution).

**Operating efficiency (2 points)**
8. Gross margin increased year-over-year.
9. Asset turnover increased year-over-year.

**Reading it:** 8–9 = strong; 6–7 = acceptable (gate pass); 4–5 = marginal, needs a reason; 0–3 = weak, likely a trap. Compute from the two most recent annual filings.

## 4. Altman Z-Score

A bankruptcy-risk score. Original (manufacturing) formula:

`Z = 1.2·(Working Capital/Total Assets) + 1.4·(Retained Earnings/Total Assets) + 3.3·(EBIT/Total Assets) + 0.6·(Market Value of Equity/Total Liabilities) + 1.0·(Sales/Total Assets)`

**Zones:** Z > 2.99 = safe; 1.81–2.99 = grey; Z < 1.81 = distress. Roughly 80–90% accurate one year out.

**Cautions:** the trend matters more than the level — a Z declining over several quarters is the warning. High-growth cash-burners can score low without genuine insolvency risk; for those, use the private-firm variant (Z') or judgment, and lean on the confirmation and quality gates instead.

## 5. Quality & profitability metrics

- **ROIC vs WACC** — the core moat test. Spread > 0 and stable/widening is the target. ROIC roughly > 10–15% for an established firm is a reasonable anchor.
- **Novy-Marx gross profitability** = gross profits / total assets = (revenue − COGS) / total assets. Roughly as powerful as book-to-market for predicting returns, and negatively correlated with value — so it hedges value traps. Gross profit is used (rather than net income) because it is the cleanest measure of true economic profitability; the further down the income statement you go, the more distorted profitability becomes.
- **Greenblatt Return on Capital** = EBIT / (net fixed assets + net working capital). The quality half of the Magic Formula.
- **Gross-margin stability** — steady or rising gross margins signal pricing power and a defensible position.

## 6. Value / price metrics

- **FCF yield** = free cash flow / market cap (or enterprise value). > 5% is attractive; improving trajectory matters as much as the level.
- **Greenblatt earnings yield** = EBIT / enterprise value. The value half of the Magic Formula; ranks how cheap the operating business is.
- **EV/EBIT and EV/EBITDA** — compare to sector median and the stock's own historical range.
- **P/E and P/S** — same peer-and-history comparison; P/S for pre-profit names.
- **PEG** — P/E relative to growth, as a rough growth-adjusted cheapness check.
- **Magic Formula (Greenblatt)** — rank the universe by earnings yield + return on capital combined. A useful screening aid; note real-world returns run well below the original headline backtest, so use it to surface candidates, not to pick blindly.

## 7. Growth & sentiment metrics

- **Rule of 40 (software/high-growth)** — revenue growth % + profit margin % (EBITDA or FCF margin) ≥ 40. Most meaningful at scale; don't force it on very early-stage names.
- **Revenue growth and unit growth** — with attention to acceleration/deceleration, not just the level.
- **Earnings revisions** — direction of forward-estimate changes; positive revisions support the confirmation gate and PEAD catalyst.
- **Short interest & days-to-cover** — high short interest is a double-edged risk: a squeeze catalyst on good news, but also a signal that sophisticated money is betting against the thesis. Note it; don't treat it as bullish or bearish on its own.

## 8. Quick-reference threshold table

| Metric | Attractive threshold | Role |
|---|---|---|
| Market cap | ≥ $1B | Eligibility |
| Avg daily volume | > 500K shares | Eligibility |
| Piotroski F-Score | ≥ 6 (≤ 3 = trap) | Gate A (veto) |
| Altman Z-Score | > 2.99 safe; < 1.81 distress | Gate A (veto) |
| ROIC vs WACC | ROIC > WACC, widening | Gate B |
| Gross profitability (GP/TA) | Above peer median | Gate B |
| Confirmation signal | ≥ 1 (52-wk-high trend / relative strength / revisions / catalyst) | Gate C |
| FCF yield | > 5% or improving | Value |
| EV/EBIT | < sector median | Value |
| Rule of 40 (software) | ≥ 40% | Growth quality |
| Net debt / EBITDA | ≤ 3× | Balance sheet |
