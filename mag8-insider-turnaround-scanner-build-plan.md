# MAG8 — Insider Turnaround Scanner: Claude Code Build Plan

**What this builds:** a free, open-source pipeline that finds stocks with recent, meaningful
open-market insider *buying*, filters to ones trading in a moderate, recent drawdown (not
flat, not dead), screens out financially distressed names, values them with a Buffett-style
owner-earnings DCF, and ranks the survivors as turnaround candidates.

```
Insider Form 4 buying (SEC)  →  price/drawdown filter (yfinance/Stooq)  →
financial-strength gate (Piotroski/Altman via SEC XBRL)  →  Buffett owner-earnings DCF  →
composite score & rank  →  report  →  MAG8 skill wrapper
```

**Why that order:** insider buying is the rare event, so screening the whole market for price
drawdowns first (thousands of tickers against free, rate-limited APIs) is the wrong direction.
Starting from the small set of tickers with a real insider-buying signal and only then pulling
price/fundamentals for those keeps this feasible on free tiers.

Feed the prompts below to Claude Code **in order, one phase per session**, pointed at your MAG8
repo (or a new `insider_scanner/` folder inside it). Where a prompt says "pasting X," copy the
actual contents of that MAG8 project file into the same message — that's what keeps this new
tool's math consistent with your existing stock-scanner skill instead of reinventing it.

---

## Risk-tolerance parameters (examples only — every number here is meant to be set per scan, not fixed)

The numbers in the first draft were just me making your description concrete, not a
recommendation. The actual design goal is stronger than "you could edit these constants in
code": every threshold below is meant to be a real, exposed parameter — a CLI flag, a question
the skill asks in conversation, eventually a form field on the website — so whoever runs a scan
sets *their own* risk tolerance, not mine.

| Your phrase | How I operationalized it | Example I used to make it concrete | How it's set per-run |
|---|---|---|---|
| "large insider trading" | Aggregate $ of open-market (code **P**) buys in the lookback window, weighted up for clusters (≥2 distinct insiders) and CFO/director buyers, weighted down for 10b5-1 scheduled trades | e.g. ≥ $100,000, cluster ≥ 2 | `--min-dollar` / `--min-cluster-insiders`, or just tell the skill |
| "low... compared to historical average" — **how far up or down, max** | Computed **two ways**: % off the 52-week high, and % below the trailing 1-year average close | e.g. band of 2%–60% off | `--min-drawdown` / `--max-drawdown` / `--drawdown-reference`, or your stated risk tolerance in chat |
| "recently... over the last year, maybe max" | How old the reference high is allowed to be | e.g. ≤ 12 months | `--max-months-since-high` |
| "haven't been down 90% and stayed that way" | Optional guard against a name that's really a multi-year fallen angel, not a recent dip | e.g. reject if >80% off the 3-year high | `--fallen-angel-guard` (settable to "off") |
| "shows no sign of recovery" | Light stabilization check (decline decelerating, or price above its own trailing 4-week low) | boolean, nothing to scale | `--require-stabilizing` on/off |
| "aren't dead" (fundamentally) | Reuses MAG8's existing Piotroski F-Score / Altman Z-Score veto gate — kept as the existing MAG8 standard rather than a new personal knob, so this stays consistent with stock-scanner | F ≥ 6, Z outside distress | change centrally in `screening-thresholds.md`, not per scan |
| "fair valued... DCF... Warren Buffett" | Owner-earnings DCF; discount rate, terminal growth, and margin-of-safety cushion all reflect how conservative *you* want to be | e.g. 9% discount / 2.5% terminal growth / 25% margin of safety | `--discount-rate` / `--terminal-growth` / `--margin-of-safety` |
| "free open source tools for everything" | SEC EDGAR (official, free, no key) + yfinance (free, unofficial) with Stooq as a free no-key fallback | — | — |

**Worked example, just to make the mechanic concrete — not a target output:** with a 2%–60%
drawdown band and a 12-month recency window, a stock at $40 that hit a 52-week high of $65 four
months ago (−38%), with 2 insiders buying $250k combined, F-Score 7, Altman Z 3.1 ("safe"), and
a DCF intrinsic value of ~$52/share (23% margin of safety), would clear the filters. Someone
more conservative might set the band to 5%–25% instead, and the same stock might not qualify —
that's the point. The pipeline shouldn't have an opinion about whose risk tolerance is right.

---

## Phase 1 — Project scaffold + SEC insider-buying ingestion

```
I'm building a new component for my MAG8 project called the Insider Turnaround Scanner.
Set up a new Python project at insider_scanner/ (inside my MAG8 repo, alongside the existing
skills) with this structure:

insider_scanner/
  config.py
  data/
    __init__.py
    sec_client.py
    insider.py
  tests/
    __init__.py
    test_insider.py
    fixtures/
  requirements.txt
  README.md

Requirements: requests, pandas, python-dateutil, pytest. Use only the standard library's
xml.etree.ElementTree for XML parsing — no extra dependency needed for that.

config.py: define named constants for the operational settings that really are fixed —
SEC_USER_AGENT = "REPLACE_WITH_YOUR_NAME your-email@example.com" (I'll fill in my real contact
info — SEC requires a real identifying User-Agent on every request or it returns 403), and
SEC_REQUEST_DELAY_SECONDS = 0.15. Everything else that looks like a threshold —
INSIDER_LOOKBACK_DAYS = 60, MIN_INSIDER_DOLLAR_VALUE = 100_000,
MIN_CLUSTER_INSIDERS_HIGH_CONVICTION = 2, and every threshold added in later phases — should
live in config.py only as an example default. The functions that use them take the same value
as a real keyword argument, so any caller (CLI, skill, tests) can override it per run instead of
editing this file. Treat that as the pattern for the whole project, not just this phase.

data/sec_client.py: a small wrapper around requests for sec.gov / data.sec.gov. It must:
(1) always send the User-Agent header from config, (2) sleep SEC_REQUEST_DELAY_SECONDS between
requests (SEC caps everyone at 10 req/s and temporarily blocks IPs that exceed it — stay well
under that), (3) retry with exponential backoff on HTTP 429/403, (4) cache every response to a
local .cache/ folder keyed by a hash of the URL with a configurable TTL, so repeated dev runs
don't re-hit SEC for the same data.

data/insider.py — the core of this phase. BEFORE writing the parser, fetch one real example
first: call https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&output=atom&count=40
(SEC's live feed of the most recent Form 4 filings across all companies) through the client
above, print the raw response, open a couple of the linked filing index pages to find the real
.xml Form 4 document, fetch one, and print it too. Confirm the actual field names before
building the parser — Form 4's ownership XML has version drift, don't assume the schema from
memory. If the getcurrent feed is awkward to paginate reliably, fall back to walking the EDGAR
daily index files under https://www.sec.gov/Archives/edgar/daily-index/ for each of the last N
days instead. Also note as a fallback/backfill source: SEC publishes pre-flattened quarterly
bulk "Insider Transactions Data Sets" at
https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets — useful for
building historical test fixtures or a longer baseline later, even though it's not real-time.

Then implement:
- get_recent_form4_filings(lookback_days) -> list[FilingRef] with at least CIK, company name,
  filing date, and the filing index URL.
- parse_form4(filing_url) -> list[InsiderTransaction]: for each nonDerivativeTransaction extract
  issuer ticker/CIK/name, reporting owner name, isOfficer/isDirector/isTenPercentOwner + officer
  title, transaction date, transaction code, shares, price per share, acquired/disposed code,
  shares owned after, and whether the filing flags a Rule 10b5-1 planned trading arrangement
  (find the real field during your schema exploration above).
- is_qualifying_buy(txn) -> bool: True only for transactionCode == 'P' and
  acquiredDisposedCode == 'A' (genuine open-market purchases). Exclude codes A (grant),
  M (option exercise), G (gift), F (tax withholding), S (sale). If the 10b5-1 flag is set,
  still include it but mark it lower-conviction rather than dropping it.
- get_insider_buy_clusters(lookback_days, min_dollar_value) -> pandas.DataFrame: group
  qualifying buys by issuer; compute total $ bought, number of distinct insiders, whether any
  buyer is a CFO/officer/director (weight higher — this mirrors the insider-signal guidance
  already in my MAG8 stock-scanner methodology.md, which says cluster buys and CFO/independent-
  director open-market buys carry the most signal and 10b5-1/option-exercise activity should be
  discounted), earliest/latest buy date, and a 0-100 "insider signal strength" score you design
  from those inputs (document the scoring logic in a comment). Filter to
  total_dollars >= min_dollar_value.

Write pytest tests: save one real fetched Form 4 XML as a fixture and test that parse_form4
extracts fields correctly from it; test is_qualifying_buy against hand-built transactions
covering each code; test the rate limiter enforces the delay (mock time.sleep). Run the tests
and fix failures before you're done. Show me a live sample run of
get_insider_buy_clusters(lookback_days=60, min_dollar_value=100_000) at the end.
```

---

## Phase 2 — Price history & the "recent, moderate, not-dead" drawdown filter

```
Next phase for the MAG8 Insider Turnaround Scanner: price-history ingestion and the drawdown
filter.

Add to insider_scanner/:
data/prices.py
tests/test_prices.py
tests/fixtures/  (synthetic price CSVs)

Add yfinance to requirements.txt.

data/prices.py:
- get_price_history(ticker, years=5) -> DataFrame[date, open, high, low, close, volume, source].
  Try yfinance first (yf.Ticker(ticker).history(period=f"{years}y")). yfinance is unofficial and
  periodically rate-limits (YFRateLimitError) or returns empty data — catch that and fall back
  to Stooq's free CSV endpoint, https://stooq.com/q/d/l/?s={ticker.lower()}.us&i=d, no key
  needed. Normalize both to the same schema and tag which source was actually used — I want to
  know if a report leaned on the fallback. Cache to a local parquet file per ticker, 1-day TTL.
- compute_drawdown_profile(price_df) -> dict with: price_current, high_52wk, high_52wk_date,
  pct_off_52wk_high, months_since_52wk_high, avg_price_1yr, pct_below_1yr_avg_price, high_3yr,
  pct_off_3yr_high, low_3yr, pct_above_3yr_low, and a stabilizing boolean — True if the trailing
  8-week return is less negative than the prior 8-week return (decline decelerating) OR current
  price is above its own trailing-4-week low.
- passes_turnaround_price_filter(profile, min_drawdown_pct=0.02, max_drawdown_pct=0.60,
  drawdown_reference="52wk_high", max_months_since_high=12, fallen_angel_guard_pct=0.80,
  require_stabilizing=True) -> (bool, list[str] reasons). These six thresholds ARE the user's
  risk tolerance, not policy — make every one of them a real keyword argument with an example
  default (the numbers above are just what I used to describe this to you, not a
  recommendation), never a constant hardcoded into the function body. The CLI in Phase 5, the
  skill in Phase 7, and any future website form all need to pass their own values in per run
  without editing this file. drawdown_reference picks which "how far down" number
  min/max_drawdown_pct are measured against — "52wk_high" or "1yr_average" (both already sit in
  the profile). fallen_angel_guard_pct rejects a candidate whose pct_off_3yr_high exceeds it, to
  catch a stock that's been quietly dead for years and only looks "moderately down" because its
  own 52-week range already sits near a multi-year floor — accept None to skip the guard
  entirely for someone who wants it off. require_stabilizing defaults to True but is a real
  argument too, in case someone deliberately wants falling-knife candidates. Return the specific
  reasons for pass/fail so the report and skill can show the end user exactly which of *their
  own* thresholds a candidate failed.

Write tests with hand-built synthetic price DataFrames (no live API calls in these tests):
(a) a clean qualifying shape — down ~35% from a 52-week high set 4 months ago, recent higher
lows; (b) barely dipped 1% — should fail the minimum-drawdown floor; (c) a multi-year fallen
angel — down 20% from its own depressed 52-week high but 92% from its 3-year high — should fail
the fallen-angel guard; (d) still in freefall with lower lows every week — should fail
stabilizing. Assert each behaves as expected. Then take case (a) and show that changing the
keyword arguments directly in the test call — e.g. tightening max_drawdown_pct to 0.30, or
setting fallen_angel_guard_pct=None — flips the result. That's the concrete proof these are
live per-run parameters and not just documentation. Add one live smoke test
(@pytest.mark.live, skipped by default) against a real ticker.
```

---

## Phase 3 — Fundamentals + the Piotroski/Altman "not dead" gate

```
Next phase: fundamentals and the financial-strength gate, using SEC's free XBRL data. I'm
pasting my existing MAG8 stock-scanner-screening-thresholds.md below — reuse its exact
Piotroski F-Score and Altman Z-Score formulas so this stays consistent with the rest of MAG8.

[paste the full contents of stock-scanner-screening-thresholds.md here]

Add to insider_scanner/:
data/fundamentals.py
tests/test_fundamentals.py

data/fundamentals.py:
- get_ticker_cik_map() -> dict: fetch https://www.sec.gov/files/company_tickers.json once
  (through the Phase-1 client, cache indefinitely — verify the real shape with one live fetch
  before coding against it, same as Phase 1), build ticker -> 10-digit zero-padded CIK.
- get_company_facts(cik) -> dict: GET
  https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json through the shared client, cached.
  Note the response nests values by unit (e.g. "USD", "shares", "USD/shares") — handle that
  structure explicitly rather than assuming a flat value.
- extract_financials(facts, years=5) -> DataFrame, one row per fiscal year, pulling the us-gaap
  tags needed for both scores below: net income, total assets, operating cash flow, long-term
  debt, current assets, current liabilities, shares outstanding, gross profit (or revenue minus
  cost of revenue), retained earnings, stockholders' equity, total liabilities, revenue, EBIT
  (or operating income as a proxy). Company reporting is inconsistent about exact tag names
  (e.g. Revenues vs RevenueFromContractWithCustomerExcludingAssessedTax vs SalesRevenueNet) —
  build a short fallback-tag list per concept and test it against at least 3 real companies with
  different reporting styles (one large stable company, one more leveraged/cyclical, one recent
  small-cap) before moving on. If fewer than 2 years of usable data exist for a company, don't
  crash — flag it and skip that candidate, consistent with how the rest of MAG8 degrades
  gracefully on thin data.
- compute_piotroski_f_score(financials_df) -> (int, dict breakdown): implement all 9 criteria
  exactly as in the pasted reference file's section 3.
- compute_altman_z_score(financials_df, market_cap) -> (float, str zone): implement the exact
  formula from section 4 of the pasted file; zones safe/grey/distress as defined there.
- passes_financial_strength_gate(f_score, z_score, z_zone, documented_exception=False) ->
  (bool, str): same veto logic as existing MAG8 stock-scanner — fail if z_zone == "distress" or
  f_score <= 3, unless documented_exception=True, in which case pass but note the exception was
  applied.

Tests: for the 3 real companies you validated tag-fallbacks against, hand-verify (another
trusted source, or the actual 10-K) roughly what F-Score/Z-Score should be, and encode those as
regression fixtures. Also unit-test the gate logic directly with fabricated scores covering
pass/fail/exception.
```

---

## Phase 4 — Buffett-style owner-earnings DCF

```
Next phase: the Buffett-style owner-earnings DCF. This is a different lead method than my
existing MAG8 stock-scanner's reverse-DCF (that one asks "what does the price already assume";
this one asks "what is this business actually worth, so I can flag a margin of safety"). I'm
pasting stock-scanner-valuation-templates.md for context on discount-rate/terminal-growth
conventions, but implement owner earnings and margin of safety fresh — that's the specific
method I want here.

[paste the full contents of stock-scanner-valuation-templates.md here]

Add:
valuation/__init__.py
valuation/buffett_dcf.py
tests/test_buffett_dcf.py

valuation/buffett_dcf.py:
- compute_owner_earnings(financials_df, maintenance_capex_method="total_capex") -> Series, per
  fiscal year: net_income + D&A - capex - change_in_net_working_capital. Support two methods:
  "total_capex" (default — uses full capex, which is conservative since it overstates the
  deduction and understates value, which is a feature for a margin-of-safety approach) and
  "da_approximation" (treats maintenance capex as roughly equal to D&A, so only capex above D&A
  counts as growth capex and is excluded from the deduction — a less conservative, higher
  estimate). Compute both and expose both so the report can show the range.
- project_owner_earnings(historical_oe, years=10, growth_haircut=0.7, max_growth_rate=0.15) ->
  list[float]: trailing CAGR of historical_oe, multiplied by growth_haircut, capped at
  max_growth_rate, projected forward.
- intrinsic_value_per_share(projected_oe, discount_rate=0.09, terminal_growth=0.025,
  shares_outstanding) -> float: standard 2-stage DCF — discount each projected year, add a
  Gordon Growth terminal value on the final year discounted back, sum, divide by diluted shares
  outstanding. discount_rate and terminal_growth are real keyword arguments (config.py only
  holds the example default) — a different discount rate or growth assumption is exactly how
  someone with a different risk tolerance would use this, so it has to be settable per run, same
  as the price thresholds in Phase 2.
- min_margin_of_safety as its own similarly-tunable parameter (example default 0.25): used in
  Phase 5 to turn the raw margin_of_safety() number into a "meets my bar" flag. Someone more
  aggressive might accept 10%; someone more conservative might require 40% — this should be an
  argument on whatever function or pipeline step applies it, not a fixed rule.
- margin_of_safety(intrinsic_value, current_price) -> float:
  (intrinsic_value - current_price) / intrinsic_value.
- buffett_quality_snapshot(financials_df) -> dict: supporting color, not a gate — % of the last
  N years with positive and growing owner earnings, average ROE, a simple leverage ratio
  (net debt / equity or similar). Surface as qualitative Buffett-checklist context in the report.
- Document in the module docstring that this "owner earnings" is a simplified, formulaic
  approximation of Buffett's own 1986-letter definition, every assumption is a named adjustable
  constant, and the output is a directional estimate, not a precise valuation.

Tests: hand-build 2 tiny synthetic companies with fabricated but internally consistent
financials where you've worked out the correct intrinsic value by hand (a real calculator
check, not eyeballing), and assert the function matches within a small tolerance — this
validates the DCF math independent of live-data quirks. Also test margin_of_safety and the
growth-cap/haircut logic directly with simple numbers.
```

---

## Phase 5 — Pipeline orchestration & composite scoring

```
Next phase: wire Phases 1-4 into the actual pipeline, in the insider-first order (start from
the rare signal, not from scanning the whole market for drawdowns) and produce a ranked, scored
list.

Add:
screen/__init__.py
screen/pipeline.py
tests/test_pipeline.py
run_scan.py   (CLI entry point at project root)

screen/pipeline.py — run_pipeline(config) -> DataFrame implementing:
1. get_insider_buy_clusters() (Phase 1) -> candidate tickers with insider signal strength.
2. For each candidate: get_price_history + compute_drawdown_profile +
   passes_turnaround_price_filter (Phase 2) -> drop non-qualifiers, log why.
3. For survivors: get_company_facts + compute_piotroski_f_score + compute_altman_z_score +
   passes_financial_strength_gate (Phase 3) -> drop distressed names unless flagged as a
   documented exception.
4. For survivors: compute_owner_earnings + project_owner_earnings + intrinsic_value_per_share +
   margin_of_safety (Phase 4).
5. Composite score: combine insider-signal strength, turnaround-setup quality (derive 0-100 from
   the drawdown profile — reward sitting mid-band and recently stabilizing over either extreme),
   financial-strength score (from F-score/Z-score), and margin-of-safety score into one 0-100
   composite. Default equal weights, but support named presets the way my existing
   stock-scanner-scoring-rubric.md does for its own composite (pasted below) — add an
   "insider-weighted" preset and a "value-weighted" preset as examples.
6. Rank best-first; return the full DataFrame with every intermediate field preserved, not just
   the final score, so the report step has everything and I can debug any ranking.

[paste the full contents of stock-scanner-scoring-rubric.md here]

run_scan.py: argparse CLI exposing every risk-tolerance parameter from Phases 1-4 as its own
flag — --lookback-days, --min-dollar, --min-cluster-insiders, --min-drawdown, --max-drawdown,
--drawdown-reference, --max-months-since-high, --fallen-angel-guard (accepts "off" to disable
it), --require-stabilizing, --discount-rate, --terminal-growth, --margin-of-safety,
--weighting-preset. Nothing should have a hidden "true" default buried inside the pipeline —
whatever value each flag resolves to (an explicit flag, or the example fallback from config.py
if the person didn't pass one) gets printed at the top of every run's output, so it's always
visible which risk tolerance was actually applied. Optionally add a --risk-profile
{conservative,balanced,aggressive} convenience flag that sets a bundle of the above (conservative
= narrower drawdown band, higher margin-of-safety requirement, stricter fallen-angel guard) —
but any individual flag passed alongside it should still win over that preset's value.

Tests: a pipeline test using mocked/fixture versions of each phase's functions (no live calls)
with ~5 synthetic candidates where you know in advance which survive each gate and how they
should rank — assert the funnel produces exactly that. Add a second test that runs the same
fixture data through run_pipeline twice with different risk-tolerance arguments (e.g. a tight
5%-25% drawdown band vs. the wide 2%-60% example) and asserts the surviving set actually
differs — proof the tunability holds end-to-end, not just inside individual functions. Add one
@pytest.mark.live end-to-end smoke test with a short lookback and low thresholds, skipped by
default.
```

---

## Phase 6 — Report generation + CLI polish

```
Next phase: render the pipeline's output into MAG8's house report format. Pasting
stock-scanner-output-template.md for the exact structure and the exact disclaimer text to reuse
verbatim.

[paste the full contents of stock-scanner-output-template.md here]

Add:
report/__init__.py
report/render.py
tests/test_render.py

report/render.py:
- render_report(ranked_df) -> str (markdown): (1) a short header with run date, lookback
  window, thresholds used; (2) a ranked summary table — ticker, price (as-of date), % off
  52-week high, months since high, total insider $ bought, # distinct insiders, F-Score, Altman
  zone, intrinsic value/share, margin of safety %, composite score; (3) a per-stock section for
  each candidate with: an insider-buying detail table (who, role, code, shares, price, date —
  from the transaction-level data, not summarized away), the drawdown/stabilization snapshot,
  the owner-earnings table (trailing history + projection) and intrinsic value/margin of safety
  from both capex methods, the F-Score/Z-Score breakdown, a short auto-generated "why this fits
  the turnaround setup" paragraph built from a template filling in the actual numbers (keep this
  layer deterministic — no free-form narrative generation here, that's the skill wrapper's job
  in Phase 7), and a "what would say this thesis is wrong" checklist in the same falsification
  spirit as the pasted template (insiders resume net selling, F-Score/Altman deteriorate next
  quarter, price makes a fresh 52-week low, the buy was on a 10b5-1 plan not discretionary);
  (4) the exact disclaimer from the pasted file, verbatim, plus one added line noting Form 4
  data reflects legally required public disclosure of insiders' own trades, not investment
  advice to mirror them.
- save_report(markdown_str, out_dir="output/") -> Path: write a timestamped .md file, plus a
  sibling .csv of the ranked DataFrame.

Wire this into run_scan.py from Phase 5 so the CLI produces both files.

Tests: a snapshot test with one fixture candidate asserting the rendered markdown has the
expected section headers and correctly formatted numbers (percentages as percentages, dollars
with commas).
```

---

## Phase 7 — Wrap it as a MAG8 skill

```
Final integration phase: wrap this as a MAG8 skill, same pattern as my other four skills, and
wire it into the existing stock-scanner as an optional extra sourcing angle.

Create insider-turnaround-scanner/SKILL.md (same folder/frontmatter pattern as my other skills
— pasting stock-scanner-SKILL.md as the format reference) that:
- Has name: insider-turnaround-scanner and a description with trigger phrases like "insider
  turnaround scan", "find insider buying turnarounds", "who's buying their own beaten-down
  stock", "insider trading screener".
- Before running anything, has Claude establish the person's own risk tolerance in plain
  conversation: how far off its highs a stock is allowed to be (a mild ~10-20% dip vs. someone
  fine with a deeper ~50-60% drawdown), how recent that decline needs to be, and how convinced
  they want the insider buying to look (one small buy vs. a real cluster). If the person already
  stated a preference — in this message or earlier in the conversation — use that instead of
  asking again. If they have no preference and just want a quick look, it's fine to run with the
  example values from config.py, but say plainly that's what happened rather than presenting one
  risk tolerance as "the" scan.
- Instructs Claude to run `python run_scan.py [flags]` via the bash/code-execution tool using
  whatever risk-tolerance values came out of the step above, read back the generated markdown
  report, then add a qualitative narrative layer on top of the deterministic numbers — matching
  the tone, rigor, and disclaimer conventions of my other MAG8 skills — rather than re-deriving
  any number itself.
- Explicitly offers, for any survivor, to hand the ticker to the existing stock-scanner skill
  for a full 8-dimension deep-dive, and/or to gt-predictor / institutional-forecast for the
  other independent MAG8 lenses — this is the "confluence" pitch from my project brief:
  multiple independent signals agreeing on the same name.
- Includes a short references/ note inside the new skill folder documenting the free data
  sources used, every example default value from config.py alongside the CLI flag that
  overrides it (one table), and MAG8's standard "not financial advice" framing.

[paste stock-scanner-SKILL.md here]

Show me the final insider-turnaround-scanner/SKILL.md and confirm the whole pipeline runs
end-to-end from a single command.
```

---

## Phase 8 (optional) — Hardening for repeated weekly use

```
Harden this before I rely on it weekly:
1. Replace the flat-file caches from earlier phases with a single local SQLite database
   (insider_scanner/.cache/scanner.db) storing raw SEC/price/fundamentals responses with fetch
   timestamps, so a weekly re-run only fetches what's actually new or stale (closed fiscal years
   and old filings never need refetching).
2. Add exponential backoff with jitter to every external call (SEC, yfinance, Stooq); a single
   failed ticker should never crash the whole run — log it and continue.
3. Add a "seen clusters" log so the same insider-buying cluster on the same ticker doesn't get
   re-flagged as "new" every week if nothing has changed since the last run.
4. Move every threshold currently in config.py into a single config.yaml so I can tune the
   scanner without touching code.
5. Add a top-level README.md documenting setup (where my SEC User-Agent contact string goes),
   how to run a scan, what each config value does, and a clear note that yfinance/Stooq are
   free-tier tools with real reliability and ToS caveats for anything beyond personal research —
   worth revisiting with a licensed data feed before MAG8 is a paid product, per my own project
   brief's regulatory-considerations section.
```

---

## After it runs: sanity checks worth doing by hand

- Before trusting a "large insider buy," open the actual Form 4 on SEC EDGAR yourself for the
  first few hits — confirm it's really an open-market purchase and not something the parser
  miscategorized.
- Spot-check 2-3 F-Score/Z-Score outputs against a source you trust, since these are
  self-computed from raw XBRL tags that vary company to company.
- Treat the DCF intrinsic value as a range, not a number — run both owner-earnings methods and
  see how much the answer moves. A big gap between them is itself informative.
- Check the `source` field the pipeline stamps on each price row. Lots of `stooq` fallbacks
  means yfinance was rate-limiting that run — worth knowing before you trust the numbers.

## One product note carried over from your own project brief

`mag8-project-brief.md` already flags the publisher's-exclusion / disclaimer requirements for
MAG8 generally. This tool is worth being extra careful about, since "stock X, this many dollars
of insiders bought it, here's our calculated fair value" is about as close to an individualized
buy signal as MAG8 produces anywhere. Phase 6 bakes the disclaimer in by default — just don't
let a future UI layer quietly drop it to save space.
