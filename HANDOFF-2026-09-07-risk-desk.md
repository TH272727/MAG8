# The Risk Desk — a sixth product

**2026-09-07 · branch `feat/rotation-board` · NOT PUSHED**

Owner brought five open-source repos and asked, in priority order, whether each could be verified,
integrated, and used to its maximum. This is Phase 1 of the four that survived that review: the
original replacement for **AutoHedge**, whose code could not be used but whose shape pointed at the
one genuine gap in this platform.

Plan: `~/.claude/plans/i-have-5-open-serialized-wadler.md`.

---

## Why AutoHedge itself was rejected

Verified against the repo, not assumed. MIT, 4,846 stars, pushed 2026-05-11, actively maintained —
and unusable here for six independent reasons, the first of which is decisive.

**`autohedge/workers.py` and `autohedge/prompts.py` contain no deterministic math whatsoever.** The
Quant agent is asked to emit `technical_score`, `volume_score`, `trend_strength`, `volatility`,
`probability_score` and support/resistance/pivot levels **as LLM output**. The Risk agent is asked
for "recommended position size" and "maximum drawdown risk" the same way. VaR and Expected Shortfall
are named in the prompt and computed nowhere. That is precisely the pattern every desk in this
project exists to avoid: an LLM-stated volatility is a hallucinated number wearing a decimal point.

The rest: it requires `OPENAI_API_KEY` (owner constraint is zero API spend); it trades a Solana
wallet through `WALLET_PRIVATE_KEY`, against the standing rule that nothing here is broker-wired; it
is Python-on-`swarms` inside a Node/Next app; its own vocabulary — "swarm intelligence and AI agents"
— matches the banned `\bagents?\b` leak pattern, the same trap that killed the Agent Reach CLI; and
it is crypto-first where this is a US-listed equity screen.

**The gap it pointed at was real.** `grep -rniE "correlat|covarianc"` over `lib/` returned nothing
but citation text. Five desks answered *what is interesting* and none answered *how much does this
move, and what moves with it*. The Tide already computed the top-down half — an exposure band. The
bottom-up half did not exist.

---

## What was built

`lib/risk/` + `/risk`, in the identical Stage-0 shape as the other four desks: deterministic, $0,
keyless, zero plan-window draw, no model in the critical path. **It reports and it flags.** There is
no action anywhere in it that proposes a trade, suggests a weight, sizes anything against a balance,
or reaches a broker — the same sentence `lib/bottleneck/exposure.ts` opens with, and a design
decision rather than an unfinished feature.

| Module | What it is |
|---|---|
| `lib/risk/returns.ts` | PURE. Bars → daily returns. Pairwise `overlap`, and `commonGrid` for the basket. |
| `lib/risk/stats.ts` | PURE. Volatility, downside deviation, covariance, correlation, beta, drawdown. |
| `lib/risk/sleeve.ts` | PURE. Equal-weight basket, effective positions, Euler risk decomposition. |
| `lib/risk/score.ts` | PURE. Per-name assessment, the pair table, the ordering rule. |
| `lib/risk/report.ts` | Deterministic markdown + a stricter traceability check (below). |
| `lib/risk/desk.ts` | `refreshRisk` (network) / `readRisk` (**never** network). |
| `lib/risk-settings.ts` | 14 knobs `MAG8_RISK_*` over the shared registry + `MAG8_RISK=0` kill. |
| `app/risk/page.tsx`, `app/risk/actions.ts`, `components/admin/RiskSettingsPanel.tsx`, `scripts/risk.ts` | Page, admin panel, CLI. |

**Storage: one additive table `risk_bars`, user_version 9, zero FKs.** A fourth table holding daily
closes is duplication and is deliberate — consolidating all four behind one shared table would mean
migrating three live desks' storage at once, a far larger and riskier change than adding one table.
The duplication is in the schema and not in the network traffic, because the desk **reads the other
three stores before it fetches anything**: of 14 tickers in the live population, 7 were already held
by the tide and rotation desks and cost nothing.

**Nothing derived is stored.** No volatility, correlation or ranking table. Every figure re-derives
on read, so changing the window re-derives the entire board — including every reason a company went
unmeasured — with zero fetches. Same property that makes the insider desk's public preset picker free.

---

## The live reading

```
THE RISK DESK — 13 measured of 13 named · closes through 2026-09-04 · 252-session window

  basket volatility        48.5%   (members average 71.2%)
  effective positions      2.2 of 13
  versus SPY               12.8% volatility, beta 2.47
  worst fall              -40.4%   2025-10-14 to 2026-07-29, not yet recovered
  total return              7.9%

  the tide's band          50.4-60.4% in equities
  this basket at it        24.4% to 29.3% portfolio volatility

  moves together (0.75+):  IONQ<->RGTI 0.85 · VST<->CEG 0.79 · VST<->TLN 0.78
                           3 pairs across 5 companies read as one position
```

**Thirteen companies that are really about two independent bets.** That is the desk's entire reason
to exist, printed on the first read. NVR carries 0.2% of the basket's risk on a 7.7% weight — a
homebuilder sitting in a basket that is otherwise power, nuclear and quantum.

---

## Findings

Six, of which four are bugs that produced or would have produced a confident wrong number.

**1. The basket's benchmark vanished silently, and only the basket's.** SPY's closes come from the
rotation desk, which had refreshed two days earlier, so its stored history was missing exactly 2 of
the basket's 252 dates. The benchmark join was all-or-nothing, so `sleeve.beta` and
`benchmarkVolPct` both came back null — while every *individual* company kept its beta, because
those are computed pairwise. Nothing was wrong, nothing said anything, and one line of the board was
simply gone. The join now measures on the sessions the two genuinely share, reports
`benchmarkSessions`, and raises a note when that is fewer than the basket's. Pinned by a regression
test.

**2. MY OWN BUG — a series that never recovered reported that it had.** `maxDrawdown` tracked the
high-water mark by an index into the RETURNS array, but the high-water mark is very often the level
the window OPENED at — a company already falling when the window began — which no such index can
address. Recomputing the peak's level by compounding `returns[0..peakIdx]` silently included the
first loss, making the recovery target the *trough* rather than the peak. A test caught it. The
wealth series is now built once with a leading element for the opening level, and a `peakAtWindowStart`
flag exists so the prose says "from the level it opened at" rather than naming a date as a peak.

**3. MY OWN BUG — a zero close became a −100% return.** `toReturns` guarded only the denominator, so
a close of 0 produced a total wipe-out for a company that merely had a missing reading, which then
made the whole drawdown unmeasurable and inflated volatility. Both closes are now checked. This is
the **fourth** time this project has met blank-as-zero (FRED's empty CSV field, live in
`lib/bottleneck/supply.ts`; the chart fetcher; the Tide's dead series), and it will not be the last:
`Number("")` is 0, and 0 is a perfectly finite price.

**4. Effective positions can legitimately exceed the number held**, and printing "5.9 of 3" reads as
an arithmetic error. It happens when members move AGAINST each other rather than merely apart, which
leaves the basket steadier than the same number of independent bets. Deliberately **not clamped** —
clamping would hide a real reading — but the desk now raises a note explaining it. Found by a test
whose assumption was wrong, which is how the presentation problem surfaced at all.

**5. Three copies of the number-traceability check already existed, and they had diverged.**
`lib/insider/report.ts` matched `-?\d…` (sign-aware); `lib/rotation/brief.ts` and `lib/tide/report.ts`
matched `\d…` (sign-blind, allowed list carries magnitudes). Writing a fourth copy would have meant
picking a variant silently. Extracted to `lib/number-verify.ts` with `signed` as an explicit
parameter and all three migrated, each preserving its own semantics — the three writers' 55 existing
tests pass unchanged.

The risk desk reads **signed**, because a fall of forty per cent written as a rise of forty per cent
is not a rounding, it is the opposite claim. That forced a second difference: a sign-aware reader
tokenises `2026-04-15` as 2026, −4 and −15, and admitting those through the allowed list would then
admit a fabricated "−4%" anywhere in the prose. So dates are **masked and checked separately**
against the board's own date set, and company names are masked too (3M is not a claim about
anything). Proved by injection in both directions.

**6. The traceability check earned its keep immediately.** After fixing finding 1, the report failed
on `250` — the benchmark session count I had just added to a note and never registered as an input.

---

## Citations

Two, each verified against its primary source this session, and **both argue against reading the
desk's output as advice** — built into the arithmetic rather than footnoted, in the same way
Goyal-Welch shapes the Tide and Titman/Wei/Xie shapes the Bottleneck desk.

- **DeMiguel, Garlappi & Uppal 2009** (RFS 22(5) 1915–1953) — fourteen optimising models across seven
  datasets, none consistently better than 1/N on Sharpe, certainty-equivalent return or turnover.
  *This is why the basket is equal-weighted and the desk publishes no weights.*
- **Longin & Solnik 2001** (JF 56(2) 649–676) — multivariate normality rejected for the negative tail
  and NOT for the positive one: correlation rises specifically in falling markets. *This is why every
  co-movement figure is stated as a calm-weather reading.*

**Homepage chip auto-counts 75 → 77 ACADEMIC WORKS CITED** — public copy, flagged.

**Not cited:** Choueifaty & Coignard 2008, the origin of the diversification ratio whose square is the
effective-positions figure. Two independent secondary sources agree on the definition and the maths
checks out (ρ=0 gives N, ρ=1 gives 1), but the JPM page is behind SSO and the authors' own PDF would
not extract, so it is named in the code comment as the formula's origin and kept out of the registry,
which is explicitly a list of works verified against the primary source.

---

## Gates

- `npx tsc --noEmit` clean
- `npm run test` — **990 passed** (was 908); 63 new in `tests/risk/`, plus the risk registry added to
  the shared settings-integrity table (now 8 registries)
- `npm run seed` — fixture regression **EXACT** (ASTS 90.3 · RKLB 73.9 · TMDX 69.5 · SYM 51.5 ·
  IONQ 47.9 · CRSP 46.7 · OKLO 42.7 · ACHR 19.3 fail-gated #8)
- `npm run gen:bib` — no-op (the `risk` citation group maps to no playbook)
- `npm run build` clean, `/risk` registered
- `npm run risk -- --probe` — 3/3 PASS
- **Leak probe: 0 architecture hits across 12 surfaces**, run against BOTH the dev server and the
  production build, every response size-checked (0 thin). Only the 2 sanctioned homepage strings.
- **Curtain: `/risk` 404s in launch mode WITH a valid admin cookie**, and the launch homepage carries
  no link to it
- **Admin gating** verified on a prod build with a real `ADMIN_TOKEN`: the locked payload carries zero
  trace of the risk panel, its refresh control, or its env vars
- Separation contract holds: no pipeline imports, no SQL outside `lib/db.ts`, 0 FKs, user_version 9

NB the dev server was stopped before building and restarted afterwards, per the `.next` corruption rule.

---

## Open

- **`readRisk` is ~1.3s**, slower than the other desks' read targets. ~0.9s of that is `readLedger()`
  (four desks) and ~0.17s is `readTide()`; the risk arithmetic itself is ~250ms. Both are read-only
  and neither is this desk's code. A caller rendering several desks at once pays each of them again.
- **The population is the cross-desk ledger's crossings**, 13 companies. `includeSingleDesk` widens it
  to every company any desk named, default off. Whether that is the right default is a product
  question, not a bug.
- **Never seen at 375px** — headless browsers return an empty DOM in this environment; checked
  structurally (`grid-cols-1` base, `flex-wrap` chip rows, every wide table inside `overflow-x-auto`).
- The four bar tables could be consolidated behind one shared `price_bars`. Deliberately deferred as a
  pure cleanup, not mixed into a feature build.
- `MAG8_RISK_BENCHMARK` overrides SPY but is env-only and deliberately not on the settings page.

---

# Phase 2 — USAspending into the Bottleneck desk

Owner picked exactly one of the four candidate data sources: **USAspending.gov → Bottleneck**.

## The plan's framing did not survive, and the replacement is better

The plan said "add a fifth supply connector: `usaspending`". That is wrong, and the code says why:
the desk's gap is `demand rate − supply rate`, and **a procurement obligation is a DEMAND quantity**.
Putting it in a supply slot would compare the government's spending against the suppliers' spending
and print the difference as a physical constraint tightening — every figure real, the conclusion
meaningless. So it reads as its own evidence block BESIDE the gap and never into it.

What it answers instead is the one thing the desk could not: **whether the hand-kept list of who
supplies an input is right.** A theme's `owners[].tickers` is the only claim on the desk that nothing
measures — `/crossdesk` labels it `curated` for exactly that reason. Where the buyer is federal, the
award record settles it in both directions.

## What was built

- `lib/bottleneck/usaspending.ts` — keyless transport, its own request queue, two endpoints
  (`spending_over_time`, `spending_by_category/recipient`), fiscal-year arithmetic, curated linkage,
  coverage. Pure functions throughout except the two fetches.
- `lib/bottleneck/procurement.ts` — refresh (network) / read (**never** network), stored in ONE
  `app_settings` key per theme. **No new table and no migration** — it is one small document per
  theme, and a table for that would be a migration in exchange for nothing.
- `ProcurementSchema` on the playbook, **optional**, populated for the drone theme only.
- Wired into `refreshDesk`, rendered on the theme page, printed by the CLI, disclosed on
  `/methodology`.

## Findings

**1. Naive name matching fails, and fails in the most damaging direction.** Of six companies in the
drone owner map, a normalised name match found **one**. Kratos Defense & Security Solutions appears
in the award records only as **"KRATOS UNMANNED AERIAL SYSTEMS, INC"** — an operating subsidiary — so
a parent-name match reports *no federal awards* for a company holding $164M of them. Linkage is
therefore curated and verified against the record, the same rule the developer-activity layer
follows for its handles and the identifier resolver learned by returning a Frankfurt symbol for a
Nasdaq listing. Pinned by a test that asserts the parent name does NOT match and the subsidiary does.

**2. A product code's TITLE is not evidence of what it contains.** Nine codes were probed live and
seven rejected on their recipient lists:

| Code | Title suggests | Recipients say |
|---|---|---|
| PSC 4470 | Nuclear reactors | **Naval propulsion** — Fluor Marine, Electric Boat, Bechtel Plant Machinery |
| PSC AN11/AN12 | R&D, general science | **Biomedical** — Leidos Biomedical, Charles River, Sanofi Vaccines |
| PSC 1560 | Airframe structural components | Boeing, and not drone-specific |
| PSC 3695 | Misc special industry machinery | $2.5M leaders — noise, wrong industry |
| PSC D399 | IT and telecom, other | Generic IT services, not AI infrastructure |

Wiring the nuclear theme to "Nuclear reactors" would have printed billions of real dollars under a
heading that meant submarines. **Only PSC 1550 survived**, and only the drone theme declares codes —
the same honesty as "4 of 7 themes have had that work done".

**3. Obligations can be NEGATIVE.** PSC 7021 returns `$-0M` for FY2026: de-obligations exceeding
obligations when contracts are de-scoped. Handled rather than assumed away.

**4. A fiscal year is not a calendar year**, and the desk compares against calendar-year capital
spending. Federal years run Oct–Sep and are named for the year they END in, so every figure carries
that label. The CURRENT year is marked *still running* rather than dropped — dropping it throws away
the newest information, and printing it unmarked beside finished years shows a collapse that is only
an unfinished year. The trend deliberately compares the two most recent COMPLETE years.

**5. Absence had to be worded precisely.** A company missing from the top 50 recipients has no LARGE
award under those codes — not none at all. The copy says exactly that.

## The live reading (drone theme, 2026-09-07)

```
WHAT THE BUYER ACTUALLY COMMITTED — PSC 1550, Aircraft, Unmanned
  $1.94B obligated in FY2025, down 11.8% on FY2024
  FY2019 $2.34B · FY2020 $1.53B · FY2021 $1.24B · FY2022 $1.66B
  FY2023 $1.84B · FY2024 $2.21B · FY2025 $1.94B · FY2026* $1.56B

  KTOS $164.0M  KRATOS UNMANNED AERIAL SYSTEMS, INC
  AVAV  $75.8M  AEROVIRONMENT, INC

  AVAV, KTOS hold $239.8M of the $1.94B across the 50 largest recipients — 12.3% of it.
  AIRO, ONDS, RCAT, UMAC are named by the theme but hold no LARGE award under these codes.
  Largest recipients the theme does not name: General Atomics ($745.7M), Northrop ($308.5M),
  Leidos ($160.1M), Anduril ($94.0M).
```

**The tension this surfaces is the point.** The theme's demand reading is **+62.4%** — the listed
makers are spending heavily to build capacity — while their largest single customer's obligations
under this product code are **−11.8%**. Neither number is wrong. The desk now shows both, and it
could not before.

And it quantifies something nothing on the platform measured: **12.3%** of the code's dollars reach a
company a reader can actually buy. The playbook's blurb already argued that the primes are
deliberately excluded; the government's own records now put a number on what that exclusion costs.

## Gates

- `npx tsc --noEmit` clean · `npm run test` **1009 passed** (was 990; 19 new)
- `npm run seed` fixture regression EXACT · `npm run gen:bib` no-op (9 unchanged)
- `npm run build` clean
- **Flagship AI-infrastructure reading held byte-identical**: $573.72B TTM, +85.7%, 6/6 contributing,
  MW +81.9pp, memory +68.7pp
- **Leak probe: 0 architecture hits across 16 surfaces** including
  `/bottleneck?playbook=drone-industrial-base` and `/methodology`; all responses >20KB (0 thin)
- Curtain unchanged — a theme is a query parameter on an already-guarded page

## Open

- Only the drone theme has codes. Nuclear and quantum were probed and their obvious codes rejected on
  the evidence; finding a code whose recipients ARE the civil-nuclear or quantum-computing market is
  research, not code.
- The recipient list is the top 50; the tail is not read. `listedTotalUsd` is named so it cannot be
  mistaken for the code's total, and for PSC 1550 the top 50 happens to capture essentially all of it.
- Aliases are two names. Extending them to the smaller makers means checking each against the record
  by hand — which is the point, but it is manual.

---

# Phase 3 — humanizer + marketing skills

## What was installed, and what deliberately was not

- **`blader/humanizer`** — MIT, 44,493★, one 28KB `SKILL.md` drawing its 25 patterns from Wikipedia's
  "Signs of AI writing". Copied to `.claude/skills/humanizer/`.
- **`coreyhaines31/marketingskills`** — MIT, 47,648★. **12 of its 50 skills** copied, plus the **31
  `references/` files they link to** (a skill whose internal links dangle is a defect, and every one
  now resolves — checked). Chosen: `video social copywriting copy-editing launch seo-audit schema
  ai-seo programmatic-seo site-architecture directory-submissions lead-magnets`. Skipped everything
  assuming a live SaaS funnel — paywalls, pricing, onboarding, churn-prevention, revops,
  sales-enablement — because the waitlist stores and **nothing sends yet**.
- **NOT installed: the upstream `AGENTS.md`.** It instructs a session to fetch `VERSIONS.md` from
  GitHub once per session, and its tools registry points at GA4, Stripe, Mailchimp and Composio.
  Neither behaviour was wanted, and neither was adopted silently.
- All 13 recorded in `skills-lock.json` with a content hash, so a local edit is detectable — the same
  mechanism the Remotion skill already used, and invariant 2's rule that skills are editable applies.

## `npm run check:voice` — the gate, not just the advice

`scripts/check-voice.ts`, in the exact shape of `marketing/video/scripts/check-leak.ts`. It turns the
mechanically checkable half of the patterns into something that runs, over hand-written copy in
`app/`, `components/`, `lib/` and `marketing/video/src`.

**It reports and never rewrites, and it stays out of the runtime path.** The deterministic writers
(`rotation/brief.ts`, `insider/report.ts`, `tide/report.ts`, `risk/report.ts`) verify that every
numeral traces to an input — so flagging a template is safe, but a rewrite that changed what a
sentence CLAIMS while keeping its digits would pass that verifier and still be false. Those files are
scanned and reported under their own heading saying exactly that.

**Findings:**

1. **The house voice would have made the gate useless on day one.** Em-dash-as-connector is **801
   hits** in authored copy; the one-line closer is deliberate too. Both are behind `--house`. A linter
   that flags the house voice on every run gets ignored, and an ignored gate is worse than no gate.
2. **The curly-quotation-mark pattern was REMOVED.** All five hits it produced were film captions
   quoting someone correctly — in a TSX codebase curly quotes in copy are correct typography, and a
   curly quote that has genuinely leaked into code is a syntax error `tsc` catches first. The reason
   is recorded in the file rather than the rule silently dropped.
3. **Authored copy is 0 hits across 271 files** with 6 patterns active. That is the result, not an
   absence of testing — proved by injection: a probe component with `Great question!`, `delves into
   the intricate tapestry`, `a pivotal moment` and `as of my last training update` produced 10 hits
   across 3 patterns and `--strict` exited 1; removing it returned to 0 and exit 0.

`marketing/video/FORMULA.md` gained **§L**: this file outranks every imported skill; everything they
produce is public copy that must clear the leak gate (two of them talk fluently about "agents" and
"MCP directories", which is banned in published output); and nothing auto-updates.

---

# Phase 4 — ManimCE for the video line

**ManimCE 0.19.0, not `3b1b/manim`** — the owner's call after being shown the tradeoff. ManimGL's own
README warns older code may not render on a newer version, and "a re-render is not a new film" is
already a rule here.

`marketing/manim/`, its own venv, pinned `requirements.txt`. Python 3.13.15 and ffmpeg were already
on the machine; **LaTeX is not needed** — scenes use `Text()`, which renders through Pango. Installed
clean with wheels for everything.

**It is an asset generator, not a second pipeline.** Scenes render to transparent frames a Remotion
composition composites; the header, brand row, score and cut stay in Remotion. First scene:
`Funnel` — the screen funnel, 7,106 → 2,030 → 300 → 8, with bar widths on a square root because at a
7106-to-8 range a linear width makes the last bar 0.008 of the first, understating the one row the
whole screen exists to produce.

## The transparency trap — two of three routes fail SILENTLY

Each accepts the flag, prints no warning, and writes a file whose corner pixel is the opaque
background. Composited, that is a solid rectangle. All measured:

| Route | `pix_fmt` | Corner alpha | Verdict |
|---|---|---|---|
| `manim -t --format=webm` | `yuv420p` | **255** | No alpha at all |
| `manim -t --format=mov` | `argb` | 0 | Real alpha — but qtrle, which no browser decodes |
| MOV → VP9 **or** VP8 WebM | `yuv420p` | **255** | Both encoders LIST `yuva420p`; neither writes it |
| `manim -t --format=png` | `rgba` | 0 | **Works.** 12 MB for 233 frames at 1080×1920 |

WebM alpha lives in a BlockAdditions track this ffmpeg build does not produce — an explicit
`-vf format=yuva420p` and `-auto-alt-ref 0` change nothing.

`render.py` verifies rather than assumes: pixel format, corner alpha on **three** frames rather than
one (an empty opening frame is transparent whatever went wrong), and then that something was actually
**drawn**, because a scene that rendered nothing passes a transparency check trivially. Frames land in
`marketing/video/public/manim/<Scene>/` with a `manifest.json` (frames, fps, duration) and are
gitignored.

## The gate fix that shipped with it, not after it

`marketing/video/scripts/check-leak.ts` walked only `src/` and matched only web extensions. **A manim
scene puts captions straight onto a frame and the white-label gate could not see them.** It now walks
`../manim/scenes` and matches `.py`, skipping the venv and scratch trees. Proved by injection: a
probe scene containing "three agents run the stock-scanner skill" produced 1 hit and exit 1; removing
it returned to clean at 98 files.

---

# Final gate sweep, all four phases

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run test` | **1009 passed**, 44 files (was 908) |
| `npm run seed` | fixture regression **EXACT** |
| `npm run gen:bib` | no-op |
| `npm run build` | clean, `/risk` registered |
| `npm run risk -- --probe` | 3/3 PASS |
| `npm run check:voice` | 0 hits, 271 files |
| `check-leak.ts` (video + manim) | clean, 98 files |
| Leak probe, 16 surfaces | **0 architecture hits**, dev AND production build, 0 thin responses |
| Curtain | `/risk` 404s in launch mode **with a valid admin cookie**; no homepage link |
| Admin gating | prod build, real `ADMIN_TOKEN`: locked payload carries no trace of the risk panel |
| Bottleneck flagship | byte-identical: $573.72B, +85.7%, MW +81.9pp, memory +68.7pp |
| Separation contract | no pipeline imports, no SQL outside `lib/db.ts`, 0 FKs, user_version 9 |

**Homepage chip 75 → 77 ACADEMIC WORKS CITED** — public copy, flagged.

NOT PUSHED. Branch `feat/rotation-board`, itself unmerged. The dev server was stopped before each
build and restarted after, per the `.next` corruption rule.
