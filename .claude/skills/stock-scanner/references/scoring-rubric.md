# Scoring rubric

How to score and rank candidates in Step 6. Score each stock on the eight dimensions below (1–5 each), then compute the composite — but respect the Financial-Strength veto gate first. Read this file at Step 6.

## The veto gate comes first

**Financial Strength is a gate, not just a score.** Before averaging anything, check Gate A (Piotroski F-Score and Altman Z-Score from `references/screening-thresholds.md`):

- If the stock is in the **distress zone** (Altman < 1.81 or F-Score ≤ 3) and has no documented, compelling exception, its overall rating is capped at **Watchlist-only / Pass** regardless of how attractive the story looks. A great narrative on a failing balance sheet is the definition of a value trap.
- If it carries a flagged exception (e.g., a high-growth cash-burner), note the cap is waived deliberately and mark the idea speculative.

This prevents the most common failure mode: a compelling growth or turnaround story that scores high on everything except the one thing that determines survival.

## The eight dimensions

Score each 1 (poor) to 5 (excellent).

| Dimension | What it measures | 5 looks like | 1 looks like |
|---|---|---|---|
| **Asymmetry** | Reward/risk skew from the scenario table; how capped the downside vs how convex the upside | Defined shallow floor, multi-bagger bull, reward/risk ≫ 1 | Symmetric or negative skew; downside open-ended |
| **Intrinsic-Value Gap** | Reverse-DCF verdict + DCF margin of safety | Market-implied bar far below what the business can clear | Price implies expectations the business can't meet |
| **Quality / Moat** | ROIC−WACC spread and its durability (CAP), margin stability, pricing power | Wide, durable, widening spread; clear moat | ROIC below WACC; no defensible advantage |
| **Financial Strength** | Piotroski F-Score, Altman Z, leverage, accruals — **also the veto gate** | F-Score 8–9, Altman safe, low leverage, cash-backed earnings | F-Score ≤ 3, Altman distress, high leverage |
| **Growth Quality** | Revenue/unit growth, TAM runway, Rule of 40 where relevant | Durable acceleration, large runway, Rule of 40 ≫ 40 | Decelerating or no credible growth |
| **Momentum / Catalyst** | 52-week-high proximity trend, relative strength, earnings revisions, dated catalysts (PEAD) | Stabilizing near highs, positive revisions, near-term catalysts | Free-falling, negative revisions, no catalyst |
| **Smart Money** | Cluster/opportunistic insider *buys*, quality of institutional accumulation | Multiple open-market insider buys (CFO/independent director), credible fund accumulation | Insider selling, distribution, or nothing |
| **Franchise / Competitive Edge** | Brand strength and standing vs the 2–3 closest rivals on growth, margins, valuation | Clear structural edge over closest rival | A rival is stronger on most dimensions |

**Scoring notes:**
- Momentum/Catalyst replaces the old "Drawdown Severity" dimension deliberately. A deep drawdown is a *reason to look*, not a virtue in itself; scoring it directly rewards falling knives. Score the *turn*, not the fall.
- Keep scores evidence-based. If the data for a dimension is thin, score conservatively and say so rather than guessing high.

## Composite and ranking

- **Composite score** = weighted average of the eight dimensions. Use equal weights unless the user specifies preferences (e.g., "I care most about asymmetry and quality").
- Apply the veto gate after computing the composite: a distressed name cannot be rated above Watchlist/Pass even if its composite is high.
- **Rank best-first** by composite (post-veto).
- Translate the composite into a **verdict**: Buy (high composite, gates cleared, clear catalyst), Watchlist (attractive but missing a catalyst or carrying an unresolved risk), or Pass (fails a gate without a compelling exception, or poor asymmetry).

## Suggested weighting presets (optional)

If the user wants a tilt, offer these rather than inventing weights silently:
- **Deep-value tilt:** overweight Intrinsic-Value Gap and Financial Strength.
- **Quality-compounder tilt:** overweight Quality/Moat and Growth Quality.
- **Catalyst/event tilt:** overweight Momentum/Catalyst and Smart Money.
- **Balanced (default):** equal weights.
