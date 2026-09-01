# The Insider Turnaround Scanner — handoff, 2026-08-31

Fourth product. Deterministic, $0, zero plan-window draw, same Stage-0 shape as the
Bottleneck desk and the Rotation board. Branch `feat/rotation-board` (itself stacked on the
unmerged `feat/bottleneck-desk`). **Not pushed.**

Source: `mag8-insider-turnaround-scanner-build-plan.md` at the repo root.
Plan: `~/.claude/plans/ive-uploaded-a-insider-melodic-truffle.md`.

## What it is

Start at the rare event — a company insider spending their own money on the open market —
then ask whether the price actually fell, whether the fall is recent rather than terminal,
whether the balance sheet is alive, and what the business looks worth on its own cash.

Eight commits, one per phase: `6aa99f8 · abd9eb9 · 8a8dcea · 4886c21 · c12983f · 02da222 ·
c82a90f · 285928d`.

## Owner decisions taken

- Sweep restricted to the Stage-0 eligible universe (~2,069 companies), not all listed issuers.
- Public risk presets recomputed on read, **plus** admin knobs — not admin-only.
- Public page with admin-only controls, not an admin-only tool.
- Product stays model-free; a separate playbook wraps it for conversation.

## Shape decisions that departed from the source document

The document specifies a standalone Python project. Three of its stack choices did not
survive contact with this repo, the same way three of the rotation spec's did not:

| Document | Built as | Why |
|---|---|---|
| Python at `insider_scanner/` | TypeScript at `lib/insider/` + `/insider` | No Python in this toolchain; a Python folder would have no page, no dials, no disclosure, no leak gate, and no share in the SEC rate limiter |
| Its own SEC client | `lib/edgar.ts` | Already exists: one User-Agent, one global queue, one error vocabulary |
| yfinance + Stooq | `lib/rotation/bars.ts` | Stooq answers a JS challenge page here; the board's two-source fetcher already records price basis |
| `config.yaml` | `lib/settings-registry.ts` | DB > env > default with provenance, an /admin panel and live /methodology rendering |
| Per-run CLI flags as the tunability story | Settings + risk profiles applied **on read** | The one place the design goes beyond the document |

**The architectural upgrade.** Nothing derived is stored — no candidates table, no scores,
no ranking. Only raw filings, closes and extracted statements. So changing the drawdown
band, the discount rate or the required cushion re-derives the whole list, *including the
reason each rejected company failed*, from bytes already on disk. That is what makes
conservative / balanced / aggressive something a visitor can switch between rather than
settings only an operator can reach. Live: house yields 3 ranked companies, aggressive 4,
and one company's estimated value moves $142.17 → $185.75 with the discount rate.

## Findings — each of which produced, or would have produced, a plausible wrong number

1. **`aff10b5One` arrives as `1`/`0` AND `true`/`false`** from different filing agents on
   the same day. Comparing against `"true"` reads a genuinely pre-arranged purchase as
   discretionary — the *higher*-conviction reading.
2. **`reportingOwnerRelationship` omits the flags that are false.** Absent is not
   stated-and-negative, and the scan scores on that difference.
3. **A filing can name several reporting owners**, and its purchases were made once by the
   group. One row per owner multiplies the dollars by the number of filers.
4. **A purchase can be filed without a price.** Counted as zero it shrinks the cluster
   total silently; it is flagged instead.
5. **SEC answers an absent daily index with 403, not 404** — every weekend, every holiday,
   and today before publication. Read through the shared client's rule that 403 means a bad
   User-Agent, a sixty-day walk declares a broken configuration seventeen times over
   ordinary weekends and never records those days. Resolution: a refusal is an absence day
   by day, and a window of *nothing but* refusals is reported as a fault — never as a
   market with no filings in it.
6. **MY OWN BUG, the one this codebase had already met.** First-populated-wins on an XBRL
   tag chain loses a whole fiscal year: Ford reports FY2024 revenue under `Revenues` and
   FY2025 under `RevenueFromContractWithCustomerExcludingAssessedTax`. Before the fix Ford
   simply looked like it had not filed. After it: FY2025 revenue $187,267M, **net income
   −$8,162M, solvency 0.794 — squarely in the distress zone.** Same shape as the AMZN/NVDA
   bug in the desk's demand module. Now the whole chain is merged, per-year provenance is
   recorded, and a comparison spanning two tags is disclosed.
7. **Share counts are not dated at the fiscal year end.** They sit on the cover of the
   annual report, weeks later, so an exact match found nothing for the *most complete*
   filers and the dilution criterion went unscored for exactly them. Republic Services goes
   from 7/9 on 8 measurable criteria to 8/9 on all nine.
8. **The fallback price source was pinned to funds.** Asked for a common share as a fund it
   answers `"Symbol not exists"` — not an error, no series, no message — so the fallback was
   silently dead for every company this scanner will ever look at. `assetClass` is now
   threaded through; the rotation board's behaviour is unchanged and its 23 tests still pass.
9. **Three sentences that were true of the arithmetic and false about the stock**, caught by
   rendering real companies: "one insider, X, including a named chief officer bought" is not
   a sentence; a +49.6% eight-week return is not "the fall has slowed"; and a price 8.6× the
   estimate is not a "-759.5% cushion below it".
10. **MY OWN VALUATION BUG, found only by running 197 real companies.** Owner earnings deduct the
    change in working capital — a difference between two balance sheets — so anchoring a ten-year
    projection on the *single latest year* lets one reclassification decide a valuation.
    Harley-Davidson's current liabilities fell nearly a billion in a year, its owner earnings read
    −$1,132M after four positive years, and it got no valuation at all; Parsons the same; Dick's
    latest year collapsed to $77M against a $563M middle year and took the estimate with it. Fixed
    with the *cause*: the latest year stays the base unless the working-capital movement exceeded the
    whole operating result for that year, in which case the middle year is used **and the page says
    so with both figures**. My first attempt used a plain median, which fixed Harley-Davidson and
    silently broke Somnigroup — a genuinely growing business whose owner earnings rose 447 → 884 and
    which a median valued at half what it earns. Both shapes are now fixtures. Two further faults in
    the same change: a negative endpoint raised to a fractional power is `NaN` and flowed out as a
    NaN price, and the note explaining the substitution was guarded on a *positive* latest year,
    excluding exactly the case it exists for.
11. **MY OWN WRONG ASSUMPTION about a citation.** I expected Brochet (2010) to show the
    two-day filing rule had eroded the returns to reading Form 4s. It shows the opposite —
    purchase filings became *more* informative once they arrived quickly. Cited for what it
    says. And Seyhun's outsider-after-costs conclusion could not be verified from any
    reachable primary source, so it is **not claimed**; Seyhun is cited only for what is
    confirmed.

## The full run

`--refresh --days 60`: **41,110 filings listed, 9,594 read from screened companies, zero failures,
24.7 minutes.** 18,557 transaction lines stored, 530 open-market purchases. The funnel then reads:

| Companies | Stage |
|---:|---|
| 197 | with open-market insider buying in the window |
| 136 | meeting the house conviction thresholds |
| 58 | worked up with price history |
| 39 | inside the drawdown band, recent and steadied |
| 25 | through the financial-strength gate |

Dick's Sporting Goods is the reading worth remembering: $2.70 a share on the conservative bound
against $320.70 on the maintenance one — **11,796% apart** — because it spent $1,137M of capital
against $489M of depreciation. Both are published and the page says most of its value depends on a
judgement these figures cannot settle. That is what publishing two bounds is for.

## Live behaviour worth keeping

- One trading day's index: 811 Form 4 rows → 382 distinct filings, **381 (99.7%) reachable
  through a listed-issuer row**, so the company is known before a document is opened.
  Against the screened universe that is ~192 filings a day worth fetching.
- A 3-day refresh: 197 filings read in 37s. The board then computes in **50ms**.
- The solvency model **declines to score** Agree Realty and Glacier Bancorp — a property
  trust and a bank do not present a classified balance sheet, so working capital cannot be
  computed. Shown as NOT MEASURED and ranked below every fully measured company rather than
  scored zero. The refusal rule working on real filers.
- An Argentine issuer (PAM) has no US-GAAP statements at all: reported unmeasured, never a
  failure.
- Yahoo has a genuine hole at 2026-08-28 — the whole row is null for every ticker. Skipped
  rather than zero-filled, which is why every window here is **calendar days, not session
  counts** (a deliberate difference from the rotation board).

## Map

- `lib/insider/form4.ts` — daily-index walk + Form 4 parsing. The 403-is-absence rule lives here.
- `lib/insider/ingest.ts` — the walk; universe resolution is **strictly read-only**
  (`latestUniverseSnapshot()` + pure `screenUniverse()`, never `getWeeklyUniverse()`, so a
  public refresh button can never trigger a market-wide screener fetch).
- `lib/insider/prices.ts` / `drawdown.ts` — fetch/store, then pure measurement + filter.
- `lib/insider/fundamentals.ts` — merged tag chains, Piotroski, Altman, the gate.
- `lib/insider/dcf.ts` — owner earnings, both capital-spending bounds, refusals.
- `lib/insider/clusters.ts` / `score.ts` / `profiles.ts` — conviction, composite, tolerances.
- `lib/insider/scanner.ts` — `refreshScan()` (network→store) / `readScan()` (store→everything,
  never network). `assessCandidate()` is pure and exported, which is what lets the whole
  funnel be tested from fixtures.
- `lib/insider/report.ts` — deterministic markdown + `verifyReportNumbers`.
- `lib/xml.ts` — extracted from the 13F parser so both share one XML style (13F fixture
  still reproduces byte-identically).
- `lib/db.ts` — 5 additive tables, `user_version` 6, **no FK into any pipeline table**.
- `app/insider/`, `components/insider/`, `components/admin/InsiderSettingsPanel.tsx`.
- `.claude/skills/insider-turnaround/`.

## Gates, all passed

tsc clean · **592 vitest** (was 381) · seed regression EXACT (ASTS 90.3 … ACHR 19.3 #8) ·
`gen:bib` idempotent · `next build` clean, both routes registered · `npm run insider --
--probe` ALL PASS · leak probe **zero architecture hits** across 10 surfaces including all
three insider views and /methodology (only the two approved homepage `26 AGENTS`
exceptions) · launch curtain 404s both new routes while the homepage stays link-free ·
admin gating verified with a real `ADMIN_TOKEN` on a production build (a visitor's payload
carries neither the controls nor the refresh action) · separation contract holds.

**Homepage chip auto-counts 58 → 64 ACADEMIC WORKS CITED. Public copy — flagged.**

## Open

1. **Only the top 60 of 136 qualifying companies are worked up per refresh**
   (`maxCandidates`). The rest are listed as *not worked up* rather than as failing anything,
   which is correct, but raising the cap or running a second refresh would deepen the board.
2. **Never seen in a browser at 375px.** Headless Chrome and Edge return an empty DOM in
   this environment. Structural checks and a real production render were used instead.
3. **The universe restriction is the biggest open question about the product itself**, not
   the code: Lakonishok & Lee found the effect concentrated in small companies, and this
   pool excludes them. The honest options are to widen the sweep (a knob, ~4× the fetching)
   or to leave it and keep saying so. It currently says so, on the board and on /methodology.
4. `output/` is gitignored — generated reports are exports, the board is the source of truth.
