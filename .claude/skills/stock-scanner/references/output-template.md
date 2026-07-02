# Output template

The exact presentation format for Step 7. Read this at Step 7 and follow the structure. Keep it scannable: the table gives the overview, the deep-dives give the reasoning, and the falsification section keeps everyone honest.

## Structure

Present results in this order:

1. **Weekly macro context** (3–4 sentences)
2. **Ranked watchlist table**
3. **Per-stock deep-dives** (ranked order)
4. **Disclaimer**

---

## 1. Weekly macro context

Open with 3–4 sentences on what's happening in markets that frames the scan: Fed / rates, major macro or geopolitical developments, earnings-season dynamics, and any sector rotation relevant to the names surfaced. This explains *why* these particular stocks are showing up now. Pull it from current web search, and date it.

## 2. Ranked watchlist table

| Rank | Ticker | Price (as of) | 52-Wk High | % Off High | Reverse-DCF Verdict | Reward/Risk | Composite | Verdict | One-Line Thesis |
|------|--------|---------------|------------|-----------|---------------------|-------------|-----------|---------|-----------------|

- "Reverse-DCF Verdict" is the plain-language read: implied bar too low / about right / too high.
- "Reward/Risk" is the ratio from the scenario table.
- "Verdict" is Buy / Watchlist / Pass (post-veto).
- Date the price row; don't present it as timeless.

## 3. Per-stock deep-dive

For each stock, in ranked order, use this layout:

### [Rank]. [TICKER] — [Company Name]

**Bull thesis** — 2–3 sentences on why this is an asymmetric opportunity.

**The setup** — why the price is beaten down (what went wrong, and whether it's temporary or structural).

**Why it's mispriced** — what the market is missing; tie this to the reverse-DCF (the implied bar vs what the business can deliver).

**Valuation** — reverse-DCF result (the market-implied bar and your judgment of it), the DCF cross-check margin of safety, and the probability-weighted scenario table:

| Scenario | Price target | Probability | Return |
|---|---|---|---|
| Bear | $___ | __% | −__% |
| Base | $___ | __% | +__% |
| Bull | $___ | __% | +__% |

with the expected value, reward/risk ratio, and the downside-floor rationale.

**Catalysts** — numbered, with rough timelines. A catalyst with no clock is just a hope; date them.

**Smart money** — insider *buys* (flag clusters, CFO/independent-director, open-market), notable institutional moves (noting 13F lag). Downweight selling and scheduled trades.

**Competitive edge** — a brief comparison table vs the 2–3 closest rivals (revenue, growth, margins, valuation), followed by an explicit "why this stock wins" statement. If a rival is objectively stronger, say so and justify the pick on asymmetry — or drop it.

**Key risks** — the honest bear case: what could go wrong, competitive threats, execution and balance-sheet risks.

**What would prove this thesis wrong** — the falsification section. State the specific, observable conditions that would break the thesis (e.g., "two consecutive quarters of decelerating revenue," "gross margin below X%," "the catalyst slips past Q_"). This is mandatory — it guards against narrative fallacy and gives the user tripwires to watch.

**Financial-strength check** — Piotroski F-Score and Altman Z-Score with the zone, so the veto gate is visible.

**Scores** — the eight-dimension table with the composite.

**Verdict** — Buy / Watchlist / Pass with a one-line rationale.

## 4. Disclaimer

Close every output with this exact disclaimer:

> **This is not financial advice.** These are research ideas for further due diligence, generated from public data that may be delayed or inaccurate. Valuations and scenarios are estimates, not predictions. Markets are risky and you can lose money. Always do your own research and consider consulting a licensed financial professional before making any investment decision.

## Formatting notes

- Lead with the table so the user gets the overview before the detail.
- Keep the deep-dives tight — dense and evidence-backed beats long and padded.
- Every price, multiple, and date must come from live web search this run, with the "as of" date shown. Never present stale or hardcoded figures.
- If a stock only made the list with a documented gate exception, surface that prominently in its deep-dive, not in a footnote.
