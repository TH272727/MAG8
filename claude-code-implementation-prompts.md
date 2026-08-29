# Claude Code build prompts — Bottleneck Framework

Companion to `bottleneck-research-framework.md`. These eight prompts build the four modules from that document into your existing stock screener, one Claude Code session at a time.

**How to use these:**
- Paste them in order, one at a time, into Claude Code inside your existing project. Don't paste all eight at once.
- Review the diff, run/test it, commit, then move to the next one.
- Prompts 2–5 depend on Prompt 1's EDGAR client existing. Prompt 6 depends on 2–5. Prompt 7 is a refactor and comes last.
- Before you paste Prompt 1, fill in these two placeholders anywhere they appear — SEC EDGAR rejects requests without a real User-Agent, this isn't optional:
  - `[YOUR_APP_NAME]` → e.g. `ridge-screener`
  - `[YOUR_CONTACT_EMAIL]` → an email address SEC can reach you at if your traffic causes a problem

---

## Prompt 0 — Map the codebase before building anything

```
Before writing any feature code, get oriented in this repository and write up a short integration plan for a new feature set. Do not implement anything yet.

1. Explore the repo: language/framework, folder structure, how the app currently fetches external data (if it does), how it stores API keys/secrets (.env? a config service?), what database or storage layer exists, whether there's an existing job scheduler or cron mechanism, and the existing testing setup.

2. Look at how "stocks," "tickers," or "watchlists" are currently modeled in this app, if at all — is there an existing concept I should plug into, or does this need to be introduced fresh?

3. Check whether the app already talks to any market-data or SEC-data provider. If so, note the pattern it uses (auth, rate limiting, caching) so new code matches it instead of introducing a second, inconsistent style.

4. Propose a concrete plan in a new file at docs/bottleneck-framework-plan.md covering:
   - A top-level module/folder name for this feature set (I'd suggest something like `bottleneck/` or `research/`, but defer to this codebase's existing naming conventions).
   - Where snapshot data (13F holdings, capex figures, supply-side data points, bottleneck scores) will live — new DB tables, a new SQLite file, JSON files on disk, or the existing database — and why, given what you found in step 1.
   - How external credentials will be configured (SEC EDGAR User-Agent string, an OpenFIGI API key if we end up needing one, any other keys).
   - A rough file/module layout for the six pieces this feature set needs: (a) a shared SEC EDGAR client, (b) a 13F clone module, (c) a demand-quantification module, (d) a supply/bottleneck module, (e) a portfolio-exposure module, (f) UI wiring + scheduling.

5. End the plan with a short "open questions for you" section listing anything genuinely ambiguous that you'd rather I decide than guess at — for example, where snapshot data should live if the existing database has no obvious home for time-series research data.

Output the plan file and a short summary in chat. Do not write feature code in this step.
```

---

## Prompt 1 — Shared SEC EDGAR client

```
Build a shared SEC EDGAR client module that every later feature in this plan will import, following the file layout and conventions from docs/bottleneck-framework-plan.md.

SEC EDGAR facts to bake in — these are firm requirements, not suggestions:
- Every request to sec.gov or data.sec.gov MUST send a descriptive User-Agent header in the form "[YOUR_APP_NAME] [YOUR_CONTACT_EMAIL]" (e.g. "ridge-screener research@example.com"). Requests without one get a 403. Pull these two values from config/env, not hardcoded inline.
- Stay under roughly 10 requests/second to data.sec.gov and sec.gov. Add a simple request queue/throttle in this client so nothing downstream has to think about it.
- All of the following are free and need no API key:
  - Ticker → CIK lookup: GET https://www.sec.gov/files/company_tickers.json — CIKs here have NO leading zeros; zero-pad to 10 digits before using them in any data.sec.gov URL.
  - Filing history for a company or fund: GET https://data.sec.gov/submissions/CIK{10-digit-zero-padded}.json — the filings.recent object is columnar (parallel arrays for form, filingDate, accessionNumber, primaryDocument, periodOfReport, etc. — index i across every array describes one filing). filings.recent only covers roughly the last year or 1,000 filings; older history is referenced via a `files` array pointing to separate JSON files.
  - A single structured financial metric across all filings: GET https://data.sec.gov/api/xbrl/companyconcept/CIK{10-digit}/us-gaap/{tag}.json
  - Every structured financial fact for a company: GET https://data.sec.gov/api/xbrl/companyfacts/CIK{10-digit}.json
  - Full text search across all EDGAR filings since 2001 (for finding a fund by name, or filings that mention a phrase): GET https://efts.sec.gov/LATEST/search-index?q={query}&forms={comma-separated-form-types}&dateRange=custom&startdt={YYYY-MM-DD}&enddt={YYYY-MM-DD} — also supports an entityName param for free-text filer name search.
  - Directory listing for one filing, so you can find an exhibit's exact filename without guessing: GET https://www.sec.gov/Archives/edgar/data/{cik-no-leading-zeros}/{accession-no-dashes}/index.json — returns a directory.item array listing every filename in that filing.
  - Once you know a filename from that index, the document itself is at https://www.sec.gov/Archives/edgar/data/{cik-no-leading-zeros}/{accession-no-dashes}/{filename}

Build these functions (name them to match this codebase's conventions):
- resolveTickerToCik(ticker) — uses company_tickers.json, caches it locally (refresh at most daily; it's a large file that barely changes).
- getSubmissions(cik) — wraps the submissions endpoint, zero-pads the CIK for you, returns a clean list of {form, filingDate, periodOfReport, accessionNumber, primaryDocument} sorted newest-first.
- getCompanyConcept(cik, tag, taxonomy = "us-gaap") and getCompanyFacts(cik).
- fullTextSearch(query, { forms, startDate, endDate, entityName }).
- getFilingIndex(cik, accessionNumber) — returns the filenames in that filing.
- fetchFilingDocument(cik, accessionNumber, filename) — fetches the raw document; handle both XML and HTML.

Add response caching (using whatever storage layer the plan file specified) since none of this historical data changes once filed: cache submissions/companyfacts ~24h, cache individual filing documents indefinitely once successfully fetched.

Handle errors explicitly: 403 (almost always a missing/malformed User-Agent — surface a clear message saying so, not a generic failure), 404 (bad CIK or accession number), 429 or repeated timeouts (back off and retry, don't hammer it).

Write a handful of unit tests against a real, stable, well-known filing (e.g. Apple, CIK 320193) so the parsing logic is verified against a real EDGAR response, not just mocks. Do not build any 13F- or capex-specific logic here — this module should know nothing about 13F structure or XBRL tag names; it's purely the transport layer.
```

---

## Prompt 2 — Module A: institutional 13F clone

```
Build Module A: clone any institutional manager's public stock picks from their SEC Form 13F-HR. Use the EDGAR client from the previous step — don't re-implement HTTP calls here.

Core flow:
1. Input: a manager name (resolved to CIK via fullTextSearch with entityName, letting the user pick from matches) OR a CIK entered directly. Don't hardcode this to one fund — any 13F filer should work, including the one referenced in my source material: Situational Awareness LP, CIK 0002045724.
2. From getSubmissions(cik), find the most recent 13F-HR and, separately, the one before it, for diffing. Managers occasionally file 13F-HR/A amendments — prefer whichever version of a given period is most recent by filingDate.
3. For each of those two filings, use getFilingIndex to find the information table document. Its filename varies by filer/filing agent (commonly something like "information_table.xml" or "infotable.xml") — search the index's item list for something that looks like the information table exhibit rather than hardcoding one filename, and fall back to the primary document if only one XML exists.
4. Parse the information table. Each row has: NAME OF ISSUER, TITLE OF CLASS, CUSIP, (optionally FIGI, added in 2023), VALUE, SHRS OR PRN AMT, SH/PRN, PUT/CALL (blank for plain shares, "PUT" or "CALL" for listed options), INVESTMENT DISCRETION, OTHER MANAGER, and VOTING AUTHORITY (Sole/Shared/None).

   CRITICAL — get this right, it's a common source of a 1000x bug: since January 3, 2023, Form 13F values are reported to the nearest DOLLAR, not to the nearest thousand dollars like before that date. Do NOT multiply VALUE by 1000 for any filing dated on or after 2023-01-03. If you ever process a pre-2023 filing, branch to the old convention (thousands) for that one instead.

5. CUSIP → ticker resolution: 13F filings identify securities by CUSIP, not ticker. Use OpenFIGI's public mapping API (openfigi.com/api) to batch-resolve CUSIPs to tickers — check their current docs for request format, batch size limit, and whether an API key is now required or recommended, since this can change. Where a CUSIP fails to resolve, keep the row (don't silently drop it) and show the issuer name + CUSIP with a visible "unresolved" flag instead of a ticker.
6. Split parsed holdings into two views: (a) "long stock" — PUT/CALL blank, and (b) "options overlay" — flagged PUT or CALL. Default display clones only (a), matching "just want the long stock," but keep (b) visible and toggleable rather than discarded — the fund in my source material runs a large options book alongside its long stock, and silently dropping that would understate how it's actually positioned.
7. For the long-stock view, compute each holding's value as a % of that filing's total long-stock value. Given a user-supplied account balance, apply each holding's % to that balance to produce a suggested $ amount and (using a current price from wherever this app already sources prices, or a clearly stubbed interface if it doesn't) a suggested share count.
8. Output an "order list": ticker, suggested shares, suggested $, % of book, filing period. Label it clearly as a proposal for review. Do not wire this to any order-placement or broker API — this module only ever produces a list to look at, never submits anything.
9. Diff view: compare the current period's holdings against the prior period's and classify each name as New / Increased / Decreased / Closed / Unchanged, with the delta in shares and %.
10. Persist each parsed snapshot (raw holdings, computed %, filing period, fetch date) using the storage approach from the plan doc, keyed by CIK + period of report, so later modules can reuse it without re-fetching or re-parsing.
11. Surface the ~45-day filing lag prominently wherever this data is shown (e.g. "holdings as of [period end], filed [filing date] — up to 45 days old by rule") so it's never mistaken for real-time.

Write tests against a real historical 13F-HR (any well-known filer with a small, stable holdings list works) to verify the parser against ground truth you can check by eye.
```

---

## Prompt 3 — Module B: demand quantification engine

```
Build Module B: given a configurable basket of tickers, quantify their capex-style spending and translate it into physical units. Default the basket to MSFT, AMZN, GOOGL, META, ORCL, NVDA (matching my source material), but this must be a config value, not a hardcoded list — Module B has to run against any basket for this to generalize past AI infrastructure.

Core flow:
1. For each ticker: resolveTickerToCik, then getSubmissions to find the latest 10-Q (10-K if it's Q4) and the one from the prior comparable period.
2. Pull the capex figure via getCompanyConcept. Companies tag this inconsistently — try these us-gaap tags in order and use whichever the company actually populates: PaymentsToAcquirePropertyPlantAndEquipment, PaymentsForCapitalImprovements, PaymentsToAcquireProductiveAssets, PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets. If none are populated for a given filer, flag it for manual review rather than silently returning zero or guessing.
3. Compute QoQ change (vs. the immediately prior quarter) and YoY change (vs. the same quarter last year), in both dollars and %.
4. Extract "why it changed": fetch the primary 10-Q/10-K document (via getFilingIndex + fetchFilingDocument), locate the MD&A section, and search near keywords like "capital expenditures," "data center," "property and equipment." Pull 1–2 of the most relevant sentences as short supporting context with a link back to the specific filing — this is the user's own tool reading a public regulatory filing, so a couple of short supporting sentences with a source link is appropriate; don't try to summarize the whole MD&A, just anchor the "why."
5. Build a separate, versioned "conversion assumptions" config — not hardcoded inline in the calculation logic — mapping $ of this kind of capex to physical units. Seed it with clearly-labeled example figures for: $ per MW of critical IT load, $ per GB of memory/storage capacity deployed, $ per sqft of data-center shell space, $ per gas-turbine unit (or $ per MW of turbine capacity). Label every value with its assumed source and an "as of" date, and make the config user-editable — these are rough industry-benchmark assumptions, not facts the code should assert confidently. Store which config version was used alongside every computed snapshot so results stay auditable as assumptions get updated later.
6. Apply the conversion config to turn each company's capex delta into estimated physical units, and sum across the basket. Show your work — for each company and each physical unit, show the $ figure and the conversion factor used, not just the final total.
7. Persist the full output — basket, per-company capex figures + deltas + supporting quotes, aggregate physical-unit totals, and which conversion-config version was used — as a dated "demand snapshot," keyed by basket name + date, so it can be diffed against future runs and consumed by Module C.

This module should be runnable against a completely different basket (say, automaker or homebuilder tickers) and a completely different conversion-assumptions config without touching the core logic — the basket and the conversion table should be the only sector-specific inputs.
```

---

## Prompt 4 — Module C: supply reality check & bottleneck detector

```
Build Module C: check whether the physical demand computed in Module B can actually be supplied, and identify the tightest constraint.

Core flow:
1. Define a SupplyDataSource interface with one method: fetchMonthlySeries(seriesId, dateRange) → an array of {date, value, unit, sourceUrl}. Every supply-side connector implements this interface so new sources can be added later without touching the scoring logic.
2. Implement two concrete connectors, matching my source material:
   a. Korea semiconductor/memory export value — Korea's trade ministry publishes monthly export/import trend releases that break out semiconductor export values (historically "Ministry of Trade, Industry and Energy" / MOTIE; verify the current official name and URL when you build this, as government branding and URLs shift). Check first whether Korea's official statistics API (KOSIS, kosis.kr) exposes this series programmatically with a registered key — that's the cleaner path if available. If not, build a resilient parser for the ministry's monthly English-language press release page, and clearly mark this connector as "scraped, verify layout hasn't changed" since press-release HTML can change without notice.
   b. Taiwan export orders — Taiwan's Ministry of Economic Affairs publishes a monthly "export orders" series distinct from customs export data — it measures orders received by Taiwanese firms 1–3 months ahead of actual shipment, broken out by category including electronics/ICT. Check whether Taiwan's open data portal (data.gov.tw) exposes this series via API before falling back to scraping the ministry's monthly release.
3. Add a lightweight "manual data point" entry path for supply signals that don't come from a clean recurring release — e.g. a gas-turbine OEM's disclosed backlog in gigawatts, which typically only appears in quarterly earnings releases and 8-Ks. Build a helper that uses fullTextSearch to find a company's recent 8-Ks/earnings releases mentioning keywords like "backlog," "GW," "turbine," so the user (or an agent) can quickly log a dated {value, unit, sourceUrl} point without a manual search every time. Store these the same way as the scraped/API series so downstream code treats every connector type uniformly.
4. Bottleneck scoring: for each physical-unit category from Module B's demand snapshot, find the matching supply series, compute its own trailing growth rate (QoQ/YoY), and compare it against the demand growth rate for that same unit from Module B. Compute a gap score per category (e.g. demand growth rate minus supply growth rate) and rank categories from tightest to loosest. Treat a persistently widening gap, or a disclosed backlog/lead-time that keeps extending further into the future release over release (delivery slots moving from 2029 to 2031, for example), as a strong bottleneck signal even without a clean supply time series.
5. "Who owns it": build a configurable mapping from bottleneck category → list of tickers that are primary producers/suppliers of that input. Seed it for the AI-infra example but make this a config table, not hardcoded conditionals, and explicitly flag in the UI when an "owner" is foreign-listed and not directly tradable as a plain US ticker — many of the biggest suppliers in categories like advanced memory or heavy industrial equipment are Korean, Japanese, or European names, accessible as ADRs at best.
6. Persist a dated "bottleneck snapshot" (per category: demand growth, supply growth, gap score, ranked owners) so the UI can show trend over time — is a given bottleneck tightening or easing release over release, the same comparison my source material does manually "against last month."

Write this so a brand-new sector playbook could add a new SupplyDataSource connector (say, US housing starts from the Census Bureau, or lithium production from USGS) and immediately participate in the same scoring/ranking logic without changes elsewhere.
```

---

## Prompt 5 — Module D: portfolio exposure audit

```
Build Module D: tell the user how exposed their actual portfolio is to whatever bottleneck(s) Module C has identified, and how it compares to the cloned manager from Module A.

Core flow:
1. Define a simple Holding {ticker, shares, costBasis?} input. Source this from wherever this app already tracks a user's positions if that exists (check Prompt 0's findings); if it doesn't exist yet, build a minimal manual-entry and CSV-upload UI for it — no brokerage integration in this step.
2. Cross-reference the user's holdings against the "owner" mapping from Module C: for each bottleneck category, sum the user's $ value and % of portfolio in tickers on that category's owner list.
3. Separately, cross-reference the user's holdings against the cloned manager's current long-stock holdings from Module A (when the user has run that module for a given manager): show overlap (tickers both hold, and the delta in %) and divergence (tickers the manager holds that the user doesn't, and vice versa).
4. Output an exposure report: a table of bottleneck categories with the user's $/% exposure to each, sorted by size, plus flags for (a) categories Module C ranked as tightest where the user has ~0% exposure, and (b) categories where the user is unusually concentrated (pick a reasonable default threshold, e.g. >20% of portfolio tied to one bottleneck category, and make it configurable).
5. This module is informational only — no trade suggestions or auto-rebalancing, just the exposure numbers and flags.
```

---

## Prompt 6 — UI wiring, scheduling, error states

```
Wire Modules A–D into the existing app as a new section, following the navigation and component conventions already in this codebase (check the plan doc for the agreed module/folder name).

1. Add a new section with, at minimum: a manager-search + clone view (Module A), a demand-basket view showing current physical-unit totals and trend (Module B), a bottleneck-ranking view with trend over time (Module C), and an exposure-report view (Module D).
2. Add scheduled refresh jobs using whatever job/cron mechanism already exists (or a minimal one if none does): 13F clone data only needs to check for new filings after each quarter's ~45-day deadline; capex data only changes on each company's earnings cadence; supply-side series refresh monthly, matching their real publication cadence. Don't poll any of these more often than their underlying data actually changes.
3. Add a lightweight alert (however this app currently surfaces notifications) for two events: a new 13F-HR posting for a manager the user is tracking, and a bottleneck category's gap score moving by more than a configurable threshold since the last snapshot.
4. Add explicit UI states for: no data yet (first run), an external API being down or rate-limited (show the last successful snapshot with an "as of" timestamp rather than a blank page), and a CUSIP or capex tag that failed to resolve (show it clearly flagged rather than silently omitted).
5. Add integration tests covering at least one full pipeline run end-to-end against real (or realistically mocked, if you'd rather not hit live SEC endpoints in CI) data for one manager and one demand basket.
```

---

## Prompt 7 — Config-driven playbooks (generalize past AI infra)

```
Refactor Modules B and C so "AI infrastructure / hyperscaler capex" becomes one example Playbook rather than the only path through the code — this is the step that makes the tool work for any sector, not just the one in my source material.

1. Define a Playbook config schema with: a name/id; a demand definition (ticker basket + ordered list of XBRL tags to try, matching Module B); a conversion-assumptions table (physical units + $ factors + sources, matching Module B); a list of SupplyDataSource connectors to query (matching Module C); and an owner-mapping table (bottleneck category → ticker list, matching Module C).
2. Refactor Module B and Module C to take a Playbook as their only sector-specific input — no ticker, tag name, conversion factor, or connector reference should be hardcoded outside a Playbook definition after this change.
3. Migrate the existing AI-infra logic into a Playbook definition (id something like "ai-infrastructure") so behavior doesn't regress.
4. Add two more example Playbooks to prove the abstraction actually holds:
   - "ev-battery-supply-chain": demand = capex/production guidance from a configurable basket of automakers and battery makers, converted to GWh of cell capacity and then to tonnes of lithium-carbonate-equivalent needed (using a clearly sourced, editable GWh-to-tonnes ratio); supply = lithium production/export data (USGS annual mineral summaries, Chile/Argentina export statistics); owners = major lithium/nickel producers and refiners.
   - "homebuilding": demand = unit-closing guidance from a configurable basket of homebuilders, converted to board-feet of lumber and skilled-labor-hours; supply = US housing starts/permits (Census Bureau) and lumber production data; owners = lumber and building-products producers.
   These two don't need fully polished connector implementations if the underlying source is genuinely hard to reach programmatically — a stubbed connector with a clear TODO and the correct source named is fine. The point of this step is proving the Playbook abstraction holds, not building out every sector completely.
5. Add a simple UI (even a form backed by the config schema) for defining a new Playbook without writing code, for whatever sector you want to point this at next.
```
