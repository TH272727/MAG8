# HANDOFF 2026-08-30 (session 2) — The Bottleneck Desk, Phases 5–8

**Owner ask:** *"read the bottleneck handoff.md and resume working through all left over phases"*

Continues `HANDOFF-2026-08-30-bottleneck-desk.md` (Phases 1–4). Read that first — the strategic call,
the separation contract, and the four live-data bugs it pins are all still load-bearing.

**Branch `feat/bottleneck-desk`. NOTHING PUSHED TO MAIN.**

| | |
|---|---|
| `6cc96d6` … `087a594` | Phases 1–4 + the first handoff (previous session) |
| this session | (5) Module A · (6) Module D · (7) disclosure & evidence · (8) three themes, editor, lab seam · desk operating controls |

---

## 0. What is now true that was not before

The desk is **feature-complete against the source prompts**. Every module in
`claude-code-implementation-prompts.md` exists, all of it deterministic and $0, none of it drawing on
the research plan's window.

```
/bottleneck                      which physical input is tightest, and tightening or easing
/bottleneck?playbook=<id>        three themes now, switchable
/bottleneck/clone                any manager's disclosed 13F book + what changed  (public)
/bottleneck/clone?cik=N          shareable
/bottleneck/exposure             a portfolio against the owner map                (admin-only)
/methodology#bottleneck          live effective settings from the desk's resolver
/bottleneck  (unlocked)          Refresh · Supply only · record an observation by hand
npm run bottleneck -- --13f CIK|NAME [--offline] [--force] [--balance USD]
```

---

## 1. Phase 5 — Module A, the institutional clone

`lib/bottleneck/thirteenf.ts` (parser, diff, sizing) + `lib/bottleneck/cusip.ts` (identifier
resolution) + `components/bottleneck/CloneConsole.tsx` + `app/bottleneck/clone/`.

**Gate met:** the frozen fixture reproduces exactly — 26 rows → 23 long **$20,169,035,068** + 3
options **$73,257,160**, SNDK 28.13% · MU 27.64% · BE 9.41% · TSM 6.27% · NBIS 6.11%. The
`ns1:`-prefixed variant parses with the same code at 28 rows / 9 option rows.

Everything the previous handoff's §4 corrected is implemented as corrected: `reportDate`,
index-driven filename discovery (`form13fInfoTable.xml` in one fixture, `SALP13FinfotableQ3.xml`
live), never `primaryDocument`, title-case `Put`/`Call` absent on stock, CUSIP resolution required.

### The dollar convention, and a free check on it

`DOLLAR_CONVENTION_FROM = "2023-01-03"`, branching on **filing date**. Verified this session against
the SEC's own FAQ, which is now cited in the evidence base: the amended Form 13F, in use from that
date, *"require[s] that the dollar values reported be rounded to the nearest dollar (rather than to
the nearest one thousand dollars)"*.

`REPORTING_THRESHOLD_USD = 100_000_000` is a second, independent check on the same thing. A manager
files only above $100M, so a book that computes to less than that has almost certainly been read
under the wrong convention — the desk flags it and says so. (The reference filing is three orders of
magnitude clear.)

### A wrong answer I shipped and then caught

The first live run resolved Bitfarms' CUSIP `09173B107` to **`1B2`** — a *Frankfurt* symbol — for a
company that trades on Nasdaq. Cause: my resolution ladder ranked an unrestricted OpenFIGI lookup
above the local universe snapshot, and OpenFIGI returns **six German venues and no US line** for that
identifier. A proposed order list would have carried `1B2` as the ticker.

The ladder is now, in order, and the order is the fix:

1. **OpenFIGI restricted to `exchCode: "US"`** — the tradeable line, authoritative
2. **the weekly universe snapshot**, matched on normalized issuer name — US listings by construction
3. **OpenFIGI unrestricted** — and whatever returns is labelled `openfigi-foreign` unless it is
   genuinely a US row
4. unresolved — visible, flagged, still counted in every total

`isUsListing(source)` gates the consequences: a foreign-only row gets its dollar weight and **no share
count**, because a foreign venue symbol is an identity, not an order. The clone says
`foreign venue — no US listing found` wherever it appears, including in the change list.

### The other identifier finding — better than the plan

The previous handoff's plan was "foreign CINS fails with `exchCode:"US"` → retry without exchCode".
That does not work: `G11448100` returns *No identifier found* under `ID_CUSIP` **with or without**
the exchange filter. The actual fix is the **id type**, decided by the identifier's own shape:

```
leading letter  → ID_CINS    G11448100 → BTDR ✓
leading digit   → ID_CUSIP   038169207 → APLD ✓
```

Submitting a domestic CUSIP as `ID_CINS` is rejected in the other direction (*Invalid idValue
format*), so this cannot be a blind retry. Verified live and pinned in `--probe`. Every foreign name
in the reference book now resolves: NBIS, IREN, BTDR.

Keyless quota: **25 requests/minute, 10 identifiers per request**. Resolutions are cached in
`bottleneck_cusips`, **including failures** — but only when the mapping service actually *answered*.
An unreachable service never writes an "unresolved" verdict, because a transient outage must not
poison later reads. A cached row whose `source` this build does not recognize is treated as a miss
and re-resolved (that is how the retired `openfigi-any-exchange` rows healed themselves).

### Posture

Holdings, weights and the diff are **public** — a 13F is a public document and showing it back is not
a privilege. **Sizing is admin-only**: the panel renders only when the server has already established
an unlocked desk, and `sizeCloneAction` re-checks the token regardless. Nothing is wired to a broker,
and the copy says so on the page.

Changes are classified **by share count, not by value**: a position worth more because the price rose
has not been traded, and calling that "increased" would invent activity that never happened.

---

## 2. Phase 6 — Module D, the exposure audit

`lib/bottleneck/exposure.ts` + `components/bottleneck/ExposureConsole.tsx` + `app/bottleneck/exposure/`.
**Admin-only in full** — the input is a real portfolio. One `app_settings` key
(`bottleneck_holdings`), no accounts, no new table, no brokerage anything.

- Paste with or without a header, any column order, comma / tab / semicolon.
- A line that cannot be read is **reported with its reason**, never dropped — a portfolio silently
  missing its largest position produces confidently wrong percentages.
- Categories are ordered by **the desk's own ranking**, not by exposure, so the two pages cannot tell
  different stories about which input matters most.
- The two flags the framework asks for: tightest constraints with ~0% exposure, and concentration
  past `concentrationPct` (default 20).
- Overlap and both directions of divergence against a cloned manager.

**The comma is both a delimiter and a thousands separator.** `MU,"1,200"` parses; `MU,1,200,48000` is
refused with the reason; and `MU,1,200` is read as *1 share at a $200 basis*, because with no header
that is exactly what the format means and nothing in the line says otherwise. Documented rather than
guessed at.

Live end-to-end (real prices, real 13F, the desk's stored ranking): a 4-position test portfolio read
80.5% in memory producers, 8.9% in power, 8.3% unmapped, one concentration flag, and the
counter-evidence line below.

**It never proposes a trade.** Every report carries, unconditionally: *owning the producers of a
tightening input is a position, not an edge — the market may already price the constraint, and
companies that invest most aggressively have historically delivered worse subsequent returns.*

---

## 3. Phase 7 — disclosure and the evidence base

**`/methodology#bottleneck`** renders the **live effective settings** from the desk's own resolver, the
same way the Stage-0 section does, so the page and the desk cannot drift. It states the separation
contract in public words and surfaces the placeholder-factor warning automatically.

**Seven works added** in a new `bottleneck` citation group, each verified against the primary source
this session (not from memory):

| Work | What it actually found |
|---|---|
| Carvalho & Tahbaz-Salehi 2019 | input–output linkages propagate micro shocks into aggregate fluctuations |
| Jacks 2019 | 40 commodities, 1900–2015: large, **long-lived** deviations from trend |
| SEC Form 13F FAQ | $100M · 45 days · no shorts, never netted · no non-US exchanges · dollars from 2023-01-03 |
| Frank, Poterba, Shackelford & Shoven 2004 | copycat funds: worse before expenses, **indistinguishable after** |
| Griffin & Xu 2009 | hedge funds beat mutual funds at picking by **1.32%/yr value-weighted, insignificant equal-weighted** |
| Titman, Wei & Xie 2004 | heavy capital investment → **negative** benchmark-adjusted returns |
| Cooper, Gulen & Schill 2008 | 1968–2003: lowest asset-growth decile ~26%/yr vs ~6% highest, ~20pp spread |

The last two are the inconvenient ones and they are in on purpose: this desk reads capital spending as
a measure of physical demand and **never** as a bullish signal about the spender.

⚠️ **The homepage chip moved: 44 → 51 ACADEMIC WORKS CITED.** It is computed from the registry, so it
updated itself; flagging it because it is public copy. `npm run gen:bib` stays a 4× no-op (the
bottleneck group maps to no playbook folder, same as `universe`).

**Jacks 2019 is cited for what it says, not what the plan hoped.** The previous handoff proposed it as
"supply responses take a decade"; the paper's abstract makes no such claim. It is cited for the
long-lived-deviation finding, which supports the same point honestly.

**One leak-gate catch, from my own new copy:** the Griffin & Xu note read *"information, not skill"* —
the grep bans the bare English word. Reworded to *"not proof of an edge"*, exactly as the Grinold
citation was reworded in 2026-07-13.

---

## 4. Phase 8 — done except the one thing that is an owner decision

### Three themes, which is what actually proves the abstraction

`ai-infrastructure` (unchanged) · **`ev-battery-supply-chain`** · **`homebuilding`**. Every ticker,
tag and FRED series below was **probed live before shipping**, not assumed.

`ev-battery-supply-chain` — 5/5 contributing, $33.78B TTM, **+53.3% YoY**, cell capacity tightening at
**+53.6pp**, LCE at **+50.5pp**. Real FRED capacity series (`CAPG325S`, `IPG325S`, `CAPG3361T3S`);
USGS and Chilean customs named as stubs.

`homebuilding` is in **because it does not fit**, and that is the useful part. Builders capitalize land
and construction into inventory rather than reporting it as capital expenditure — verified: DHI/LEN/
PHM/NVR/TOL/KBH report PP&E capex of $10–110M, their *office* spend. The tag chain therefore reads
the **inventory build**, the blurb says so, and the figures can legitimately be negative.

### Two general Module B improvements that fell out of building those

1. **The empty-concept trap.** SEC's two XBRL endpoints disagree:
   `companyconcept/CIK0000037996/us-gaap/PaymentsToAcquireProductiveAssets` returns
   `units: { USD: {} }` — an empty **object** where an array belongs — while `companyfacts` carries
   **158 USD facts** for the same tag. Ford's capital spending is invisible through the cheap
   endpoint. Nothing produced a wrong number (it read as "filer does not use this tag" and was
   flagged), but it silently dropped one of the largest spenders in a basket. `conceptFromFacts()` in
   `xbrl.ts` is the fallback, fired **only when the whole chain came up empty**. Ford now reads
   $2.376B / $9.37B TTM.
2. **Fragile totals are labelled.** Two new demand flags, both general: *only N% of gross spending
   survives netting* (fires on homebuilding at 36%, silent on the other two), and *a year-over-year
   change computed against a near-zero base* (TOL's +15012%). The basket total is summed before it is
   compared, so neither distorts the aggregate — the flags say that too.

**Regression held:** the flagship AI-infra reading is byte-identical after both changes — $573.72B TTM,
+85.7% YoY, 6/6, MW **+81.9pp**, memory **+68.7pp**, 60,392 MW.

### Also shipped

- **Theme selector** on `/bottleneck` (`?playbook=<id>`).
- **No-code playbook editor** on `/admin`: edit the owner-defined set as JSON validated against the
  zod schema, or start from a copy of a built-in. **Nothing is stored unless all of it passes** —
  every rejection names the failing field. Probe-verified: malformed saves nothing, valid round-trips,
  an id matching a built-in overrides it, clearing restores the originals exactly.
- **The Lab seam.** Each constraint links to `/lab?focus=<directive>` with a sentence already typed
  in ("Companies that produce GWh of annual cell capacity — the tightening constraint on EV battery
  supply chain. …Start from ENVX, AMPX, MVST, SES and look wider.", 212 chars, under the 280 cap).
  `LabPanel` gained `initialFocus`. **It is a URL and nothing else** — no score, cohort or dependency
  crosses in either direction, and the copy on the page says so.

### Operating the desk — a gap found by re-reading the plan, and closed

Asked "is all the work done?", I re-read the approved plan rather than answering from memory, and two
committed-scope items were missing. Both are now in `DeskControls.tsx`, rendered on `/bottleneck` only
when the SERVER has established an unlocked desk, with every action re-checking the token:

- **Refresh, on the desk.** The plan is explicit — no scheduler, "snapshot-on-read with a freshness
  TTL + a manual Refresh on the desk + a headless script". Only the headless script existed, so in
  production the page would have shown whatever the last CLI run stored, indefinitely. Now: *Refresh
  this theme* (full, ~10–20s) and *Supply only* (keeps the stored spending reading).
- **Observations entered by hand.** This one mattered more, because it made **public copy untrue**:
  the desk's own disclosure says *"dated observations can be entered by hand"* and *"Points can be
  entered by hand"* — and there was no way to do it short of SQL. A named source with no automated
  feed and no way to fill it is a constraint the desk can never measure.

  **Verified end-to-end, then cleaned up:** `datacenter-shell-construction` (a stub, 0 observations,
  ranked `insufficient-data`) took five hand-entered points → the category became **`tightening`,
  supply +20%, gap +65.7pp**, with origin recorded as `manual`; deleting them returned it to
  `insufficient-data` and 0 stored. No fabricated data was left in the database.

  The unit comes from the playbook's series definition, never the form, so a hand-entered point can
  never be measured in something the series does not use. Only hand-entered points are deletable
  here — fetched ones are replaced by their source on the next refresh.

**Deliberately still out of scope, per the plan:** cron/scheduler, push alerts, brokerage
integration, user accounts. The "what changed since last snapshot" delta panel replaces alerts, and
it already exists.

**One deviation worth naming:** the plan sketched `/bottleneck/managers` (a tracked-filer list) and
`/bottleneck/managers/[cik]`. I built `/bottleneck/clone` with search + a shareable `?cik=` instead —
any filer, no list to curate. Functionally broader; there is no persisted "followed filers" set.

### A failed refresh used to blank the desk — three fixes

The owner clicked Refresh and got **0 of 6 companies**, with the page emptying out. Diagnosis from the
stored snapshots, not from guessing: every company failed with `SEC request failed after 3 attempts:
fetch failed`, three clicks in a row, ~60s apart. Fetching from the Next runtime works fine now
(verified through a temporary route: 200, 521 KB, with and without our headers and abort signal), so
that was a **transient transport failure** against SEC — this session made heavy use of it, including
several multi-MB `getCompanyFacts` calls — not a code fault.

The transient outage is not the interesting part. What it exposed is:

1. **`fetch failed` was the entire error.** Undici puts the real reason in `cause`, and the message
   discarded it, so a DNS failure, a refused connection, a TLS fault and a timeout were one
   indistinguishable string. `describeFetchError()` in `lib/edgar.ts` now unwraps the chain with
   codes.
2. **A reading in which nothing was read was persisted, over a good one.** This is the same rule the
   module already applies one level down — a company that cannot be read is flagged, never counted as
   zero — so a basket that cannot be read is now refused, never stored as an empty desk.
   `buildDemandSnapshot` withholds it, `refreshDesk` withholds the score too (storing one without the
   other would leave the two snapshot series describing different worlds), and the action reports the
   **transport reason**, not "0 of 6".
3. **A dead snapshot in the history poisoned the comparison.** `priorReading` picks the most recent
   score built on *different* demand — a 0-of-6 reading qualified, and a gap measured against zero
   demand moves by the entire gap, reading as a dramatic and entirely fictional tightening, capable of
   tripping the materiality flag. `priorReading` now skips them and `refreshDesk` sweeps them.

`latestDemand` also skips unusable readings on the READ path, which un-blanks a desk immediately
without waiting for a refresh. Seven junk rows (3 demand + 4 scores) were pruned from the owner's
database; all three themes verified back to normal — ai-infrastructure 6/6 **$573.72B, MW +81.89pp**.

**Verified, not assumed:** a full refresh through the real server action reads 6 of 6; and a
deliberately unreadable basket produces `readNothing = true`, stores nothing, and leaves the good
reading and the row count untouched.

*(The `searchAnalyzer.js` error in the same console — "Search engine null is not supported" — is a
browser extension content script, `VM`-prefixed. Not this app.)*

### NOT done, deliberately — needs the owner

**The optional tool-less narrative brief.** It puts a model into a product whose entire strategic
premise is $0 and zero plan-window draw. The previous handoff already marked Phase 8 "owner
re-decides"; this is the item that genuinely needs the call, so it is left alone.

---

## 5. Gates — all green this session

```
npx tsc --noEmit                     clean
npm run test                         231 passing (was 120)
npm run seed                         EXACT: ASTS 90.3 · RKLB 73.9 · TMDX 69.5 · SYM 51.5
                                            IONQ 47.9 · CRSP 46.7 · OKLO 42.7 · ACHR 19.3 #8
npm run gen:bib                      4x unchanged (no-op)
npm run build                        clean; /bottleneck/clone + /bottleneck/exposure registered
npm run bottleneck -- --probe        ALL CHECKS PASSED (now covers OpenFIGI too)
```

**Leak probe** over `/`, `/rankings`, `/methodology`, `/lab`, `/bottleneck`,
`/bottleneck?playbook=ev-battery-supply-chain`, `/bottleneck?playbook=homebuilding`,
`/bottleneck/clone?cik=…`, `/bottleneck/exposure`, `/stocks/ASTS` **and the snapshot JSON** →
**2 hits, both the approved homepage exception; 0 everywhere else.** The new routes are on the
permanent list in CLAUDE.md.

**Curtain matrix** with `MAG8_SITE_MODE=launch`: `/bottleneck`, `/bottleneck/clone` and
`/bottleneck/exposure` all **404**, and the launch homepage carries no link to any of them (verified,
`grep -c bottleneck` = 0).

**Responsive**, structurally (headless browsers still return an empty DOM here — see §7 of the first
handoff): every grid carries a `grid-cols-1` base, every chip row `flex-wrap`, every wide table sits
inside `overflow-x-auto`. **Pixel measurement is still unverified.**

---

## 6. Environment notes to add to the pile

- **`npm run bottleneck -- --probe` can fail transiently on OpenFIGI's keyless 25/min quota.** It
  failed once mid-session and passed on a re-run with no change. Fail-visible is correct for a probe;
  do not "fix" it into fail-open.
- **`next build` while a dev server is up CORRUPTS that dev server** — worse than CLAUDE.md recorded. Not just
  404 CSS: every route 500s with `Cannot find module './611.js'` from `.next/server/webpack-runtime.js`, and the
  site shows nothing. I caused it twice this session by building with the owner's server running. Kill every dev
  server, `rm -rf .next`, restart. Build and dev must never share `.next`.
- **Long heredocs still fail in this shell** (confirmed again at ~150 lines, `unexpected EOF`). Use
  Write/Edit for source; short heredocs are fine.
- **A `curl` of a dev-mode page mid-recompile returns a ~3KB Next.js shell, not the page.** It reads
  as a clean leak-grep result. Check `wc -c` before trusting a 0.
- Windows Python still cannot read Git-Bash `/tmp` paths, and its console cannot print `→`
  (`UnicodeEncodeError`) — `sys.stdout.reconfigure(encoding='utf-8')` first.

---

## 7. Open items

1. **Conversion factors are still placeholders — now across all three themes.** Unchanged as the
   highest-value item left: they do not affect any ranking (a rate is unaffected by the constant it
   is divided by, and every surface says so), but the absolute quantities are order-of-magnitude
   arithmetic. Replacing them is research, not code. Bump `conversions.version` and the warnings
   retire themselves.
2. **Two AI-infra categories still unmeasured** (data-center shell sqft, gas-turbine capacity) —
   Census C30 named as a stub; the turbine backlog has one filing-derived observation.
3. **Pixel-level 375px verification never ran** in this environment. Worth a manual look on a real
   browser before launch.
4. **The narrative brief is the one open owner decision** (§4).
4b. **No tracked-filer list.** `/bottleneck/clone` reaches any filer by search or `?cik=`; nothing is
   persisted as "followed". Add one only if the owner wants a watchlist.
5. **Nothing is pushed.** Railway auto-deploys `main` and a redeploy restarts any live run. Prod
   defaults to `launch`, so every desk route 404s there until `MAG8_SITE_MODE=full`.
6. **The homepage chip now reads 51.** Public copy, computed automatically — flagged, not a question.

---

## 8. Inventory added this session

New: `lib/bottleneck/{thirteenf 560, cusip 300, exposure 400}` ·
`components/bottleneck/{CloneConsole, ExposureConsole, DeskControls}.tsx` ·
`app/bottleneck/{clone,exposure}/page.tsx` · `tests/bottleneck/{thirteenf,cusip,exposure}.test.ts`.

Modified: `lib/bottleneck/{playbook (2 themes), demand (facts fallback + 2 flags), xbrl
(conceptFromFacts)}` · `app/bottleneck/{page,actions}.ts` · `app/methodology/page.tsx` ·
`lib/citations.ts` (+7) · `components/admin/BottleneckSettingsPanel.tsx` (editor) ·
`components/lab/LabPanel.tsx` + `app/lab/page.tsx` (`initialFocus`) · `scripts/bottleneck.ts`
(`--13f`, OpenFIGI probe checks).

No schema change: `bottleneck_filings` and `bottleneck_cusips` were already created in Phase 1, and
`user_version` stays at **4**.
