# Valuation templates

The valuation workflow for Step 5. Lead with reverse-DCF, cross-check with a simplified DCF, and always express the result as a probability-weighted scenario with an explicit reward/risk ratio. Read this file at Step 5.

The order matters. A forward DCF invites false precision — small tweaks to growth or discount rate swing fair value wildly. Reverse-DCF flips the problem into something more honest and more useful for a scanner: *what is the market already assuming, and can the company beat it?* The scenarios then convert a single estimate into the asymmetry the whole strategy is built on.

## Table of contents
1. Reverse-DCF (lead method)
2. Simplified two-stage DCF (cross-check)
3. Probability-weighted scenario template
4. Handling pre-profit / high-growth names
5. Presentation rules

---

## 1. Reverse-DCF (lead method)

**Goal:** derive the expectations baked into the current price, then judge whether they are beatable. Alpha comes from correctly anticipating *revisions* to expectations — and revenue changes matter most because they are the most frequent, largest, and most value-relevant.

**Steps:**
1. Take the current price and shares outstanding → market cap → enterprise value.
2. Start from current revenue, margins, and free cash flow.
3. Solve for the combination of revenue growth, operating margin, and years of value-creation (the competitive-advantage period) that justifies today's price, holding a reasonable discount rate (default 10%) and terminal growth (2–3%) fixed.
4. State the market-implied "bar" in plain language: e.g., "at $X, the market is pricing ~Y% revenue growth for N years at a Z% margin."
5. Judge the bar. Is it too high (the company almost certainly can't clear it — overvalued), too low (the company can beat it comfortably — the asymmetric long), or about right (fairly priced)?

**Why this is the lead:** it reframes valuation as a falsifiable question about beatable expectations rather than a made-up intrinsic value, and it naturally surfaces asymmetry — you are explicitly looking for cases where the implied bar is set well below what the business can deliver.

## 2. Simplified two-stage DCF (cross-check)

Use this to sanity-check the reverse-DCF, not as the primary number.

**Method:**
1. Start with current free cash flow (or near-term projected FCF for a company approaching profitability).
2. Project FCF for 10 years in two stages:
   - **Years 1–5:** the company's recent revenue/FCF growth rate, adjusted conservatively downward (growth mean-reverts).
   - **Years 6–10:** taper toward a mature rate (e.g., 10–15% for durable high-growers, 5–8% for mature businesses).
3. **Terminal value:** apply a terminal growth rate of 2–3% (never above the long-run economy / risk-free rate), and cross-check with an exit-multiple sanity test.
4. **Discount rate:** default 10% (a reasonable required return); adjust for genuinely higher- or lower-risk businesses rather than fiddling to hit a target.
5. Sum discounted FCF + discounted terminal value → equity value → per-share intrinsic value.
6. Compare to price → **margin of safety %**.

**Discipline points:**
- Terminal value will usually be the majority (often 70%+) of the total, and for young growth companies can exceed 100% of today's value — that is normal, not an error. Make sure the assumed reinvestment actually supports the terminal growth.
- Don't over-tune the discount rate; cash flows and revenue growth dominate the output. Spend your effort there.
- Growth mean-reverts — trees don't grow to the sky. Over-optimism about sustained high growth is the most common valuation error.

## 3. Probability-weighted scenario template

Convert the valuation into asymmetry. Build three scenarios, assign probabilities that sum to 100%, and compute the expected value and reward/risk. This *is* the asymmetry thesis in numbers.

| Scenario | Key assumptions | Price target | Probability | Return vs current |
|---|---|---|---|---|
| **Bear** | What goes wrong (thesis breaks, catalyst fails, multiple compresses) — this is your downside floor | $___ | __% | −__% |
| **Base** | Most likely path (reverse-DCF "about right" case) | $___ | __% | +__% |
| **Bull** | Thesis plays out (expectations beaten, re-rating, catalyst hits) | $___ | __% | +__% |

Then compute:
- **Probability-weighted expected value** = Σ (probability × price target). Compare to current price for expected return.
- **Reward/risk ratio** = (bull upside %) ÷ (bear downside %). Favor setups meaningfully skewed to the upside; a convex idea has a shallow, well-defined bear floor and a much larger bull payoff.
- **Downside floor rationale** — state explicitly why the bear case is a floor (e.g., asset value, trough multiple, takeout value). A defined floor is what makes the bet "tails I don't lose much."

Frame the conclusion in options-like terms: what is the floor, and how convex is the upside?

## 4. Handling pre-profit / high-growth names

- Lead with reverse-DCF on revenue and a path-to-margin, plus a revenue-multiple comparison to peers with a discount for execution risk.
- Model an explicit failure probability in the bear scenario rather than assuming survival.
- Treat Altman Z with caution (see thresholds file) and mark the valuation speculative.
- Score the DCF/intrinsic-value dimension conservatively and say so.

## 5. Presentation rules

- Show the key assumptions transparently (growth, margin, discount rate, terminal growth, CAP) so the user can adjust them.
- Present outputs as ranges, and flag which assumptions the result is most sensitive to.
- Pull every input (price, share count, FCF, revenue) live via web search; never hardcode.
- Be candid about uncertainty — a confident-sounding precise number is a red flag, not a feature.
