# HANDOFF 2026-07-16 — Fame-bias measured + S0 v3 ranked pool (A + B)

Owner question that started it: *"my biggest concern is that mag8 just analyzes stocks found in the
first few articles the model reads — RKLB was a top pick because of how often it's mentioned. I want
it to find great stocks on its own, without article influence."*

## 1. The diagnosis (validated with data, mechanism corrected)

- The concern is **valid** but the mechanism is deeper than runtime articles: the driver is the
  model's **training-data prior** — RKLB/ASTS/IONQ are famous *inside the weights* (the prior IS
  years of distilled articles). Disabling web search would make picks MORE prior-driven, not less.
- Proof from our own DB: three independent July "wide net" hunts converged on a nearly identical
  cohort (RKLB, ASTS, IONQ, SYM, OKLO, TEM, KTOS, NBIS). When coverage anti-repetition blocked
  tier 1, the 07-07 run reached for **tier 2 of the same fame list** (CRWV, VRT, HIMS, RGTI, SERV…)
  and broke the $1–50B band to grab VRT at $122B. Suppression does not create originality; it
  slides down the salience ranking.
- The old pool couldn't fix this alone: 300 bare `ticker|name|sector|cap` rows give the model no
  data to select on, so the only ordering it has is fame; the weekly rotation means its favorite
  names are usually NOT shown (300/2,070) which makes the off-pool escape hatch the fame channel.

## 2. (A) The salience instrument — `lib/salience.ts` + `npm run audit:salience`

- **Baseline**: one cold, TOOL-LESS Sonnet session (the discovery model tier) listed the ~200
  US-listed tickers most associated with "next mega-cap / next Nvidia" content, ordered by salience.
  That list is a direct capture of the weights-channel prior. Stored with provenance + date in
  `lib/salience.ts`; refresh roughly quarterly or when the discovery model changes. Server/script
  side only — never rendered publicly.
- **Audit script** (`scripts/audit-salience.ts`): for every real (non-mock) run, per pick: salience
  rank, board position, eligibility under the current screen, fundamentals-rank (see B), market-cap
  percentile within eligible, verified analyst desks (bankCount from the consensus lens), and the
  run-level overlap vs the **random-from-eligible expectation**.
- **Safety**: a raw READ-ONLY precheck for live runs happens BEFORE `lib/db` is imported (its boot
  reconciliation would mark a live run interrupted). The script refuses to start mid-run.
- **Retro result (baseline finding, keep for before/after):**
  - **59/70 real pick-slots (84%) sit inside the model-memory baseline vs ~6% expected at random.**
  - 07-05 canonical run: 11/12 (median salience rank #26). 07-07 run: **8/8**.
  - The two constrained runs drop to 50%: 07-06 defense-focus 2/4, 07-12 post-S0v1 3/6 —
    constraints measurably bend the bias.
  - Median cap percentile of picks: 72.5 (drawn from the famous, larger end of the band).
  - Fund-rank splits famous-with-data from famous-on-narrative: CRDO #30, AFRM #9, SYM #27,
    TMDX #50 vs RKLB #1611, SOFI #1993, JOBY #1876, CRSP #1984.

## 3. (B) S0 v3 — the pool is now RANKED by filings, with digests

- `lib/sec.ts`: `annual()` returns latest + prior fiscal year per tag (`rev0`, `ocf0`) — growth math
  only ever pairs the SAME XBRL tag across consecutive years (a tag switch or skipped year would
  corrupt YoY). +3–6 frame requests (~15–25 total, still trivially under SEC fair-access).
  New helper `revGrowthPct()` (+ `GROWTH_MIN_BASE_USD` $5M tiny-base floor).
- `lib/universe.ts`: `rankEligible()` — pure fn(eligible, extras), fixed weights **rev growth .35 /
  OCF margin .20 / margin trajectory .15 / share-count discipline .15 / cash survivability .15**;
  each factor a percentile within the eligible set; missing datum = neutral 50 (absence of data is
  never evidence); survivability absolute (self-funding=100, runway/4y linear). **Margin/trajectory
  need rev ≥ $25M** (`MARGIN_MIN_REV_USD`) — probe caught a $5B driller whose XBRL `Revenues` frame
  held a $12M stub against $546M OCF, which had vaulted an absurd margin into the top-15. Growth
  keeps the $5M floor (growth off a small REAL base is what the hunt wants).
- Pool assembly: top `rankTopN` (default 100) by composite lead `pool.shown` best-first with
  one-line digests (`rev $501M (+168% YoY) · OCF $246M · self-funding · shares -3% YoY`); the
  remaining `poolSize − rankTopN` stay the week-seeded sector-stratified rotation of the rest.
  SEC unavailable → pure rotation, `rankedCount 0`, everything else unchanged (fail-open intact).
- `prompts.ts` poolBlock: two segments (RANKED / ROTATION), new first discipline bullet ("work the
  ranked segment TOP-DOWN… a name you have never heard of outranking one you know is the screen
  working as designed"), off-pool escape now must say **which ranked names it beats**, marketContext
  line gains "candidates were read from a fundamentals-ranked long-list of that set".
  Prompt grows ~4.9k → **~6.7k tokens**. Lens groundBlock now appends revenue growth
  ("+58% vs the prior fiscal year, same filings basis").
- Playbook (`.claude/skills/new-gen-stock/references/playbook.md`) Step 2 INVERTED when a platform
  list exists: the list is the primary candidate source; web search verifies, deepens, falsifies —
  it does not nominate. Generic no-list behavior preserved (skill still works standalone).
- Knobs: `rankPool` (ON) + `rankTopN` (100, 25–500) in the pool group → **21 knobs**; env
  `MAG8_UNIVERSE_RANK` / `MAG8_UNIVERSE_RANK_TOP`; /admin + /methodology pick them up spec-driven.
- Citations: +**Sloan 1996** (cash-flow persistence — why the rank reads OCF, not earnings) and
  +**Chan, Karceski & Lakonishok 2003** (growth persistence is rare — the honest caveat on the
  growth weight) → **42 works**, homepage chip auto-updates. Weights are fixed and disclosed, not
  fitted (Timmermann precedent in the rubric group).

## 4. Honest limits (deliberate, disclosed — do not "fix" casually)

- **Filings rank buries pre-revenue burners** (RKLB #1611/2071, OKLO #1272, ACHR #1294,
  CRSP #1984 of W29 eligible). That is the truthful filings read; the rotation segment, the scout's
  wave-breadth mandate, and the off-pool escape exist precisely to cover that archetype. The scout
  argues exceptions; the math doesn't pretend.
- **Finance-sector OCF misread** buries lenders/BDCs (SOFI #1993) — same structural issue the
  runway screen's Finance exemption handles. Candidate future knob: score Finance neutral on
  margin/trajectory/survival. Left as pure arithmetic v1 on purpose.
- **Stub-tag artifacts**: expect ~1–2 incoherent rows per top-100 (e.g. OCF≫rev). They self-disclose
  in the digest and the scout is instructed to live-verify every finalist. Coherence heuristics were
  considered and rejected (they false-kill royalty/streaming models).
- The share-count factor inherits the known split/M&A contamination (PEGA-class artifacts) — bounded
  by percentile ranking + 0.15 weight + the always-on delivered-pick flag.

## 5. Gates run

tsc 0-err ×3 · W29 snapshot force-refetched twice (fetch ~7.1–7.5s, cache 14ms; SEC 5,306 mapped,
rev 3,481, rev0 3,416, ocf0 4,222; funnel 7,133 → 2,071) · determinism fresh-vs-cache IDENTICAL ·
seed regression EXACT (ASTS 90.3 … ACHR 19.3 #8) · `next build` clean ×2 (incl. after margin-floor
fix) · leak probe 0-hit across /, /rankings, /methodology, /lab, /stocks/ASTS, /runs/fixture-demo-run,
snapshot JSON, SSE (only the two approved homepage "26 AGENTS" chips) · gen:bib no-op (universe
group feeds /methodology only) · audit script run end-to-end (output in §2).
Note: W29 refetch was safe — no real W29 run had consumed the cached snapshot; on the server, /admin
→ refresh repersists the snapshot the same way after deploy.

## 6. What was deliberately NOT done (the C/D rungs, owner picked A+B)

- **C — structural quotas**: N of count picks MUST come from the ranked head (deterministically
  verified at extract time), hard pool-adherence gate knob (reject/replace instead of flag-only),
  salience-baseline cap ("at most K picks from the famous list"). Strongest practical lever left.
- **D — blind selection lab**: S1a picks a shortlist from anonymized data cards (no ticker/name),
  deterministic unblind, S1b researches. Reduces name-bias, doesn't eliminate (fingerprinting);
  blind-vs-sighted on the same snapshot = the cleanest measurement. Knob-gated experiment.
- Momentum factor (needs per-ticker price history — Yahoo v8 works here but 2k reqs/wk is a new
  failure surface); Finance-sector rank exemption; ranked-head sector caps.

## 7. Next session quick-start

1. First post-v3 real run (Open 5): watch that picks cite digests / come from the ranked head,
   marketContext carries the ranked-long-list line, flags land in gapsNoted.
2. `npm run audit:salience` immediately after — the before/after on 84% is the whole story.
3. If overlap stays high, ship C (quota + hard gate). If the owner wants the full answer to
   "no article influence", prototype D in /lab.
