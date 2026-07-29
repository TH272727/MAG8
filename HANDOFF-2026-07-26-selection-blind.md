# HANDOFF 2026-07-26 — Selection discipline (C) + Blind lab (D)

Finishes the two improvement-ladder rungs the owner deferred in §6 of
`HANDOFF-2026-07-16-ranked-pool-salience.md`. The prompt this session was literally
*"read the most recent handoff and then finish coding parts C and D."*

Both features are **knob-gated and DEFAULT-NEUTRAL** — with default settings they are a complete
no-op, so nothing about a normal run changes until the owner opts in. That is deliberate: A+B (the
ranked pool + the salience instrument) shipped 07-16 but have **not yet been through a real run**
(owner constraint: ZERO API spend). C and D are the levers to turn on *after* measuring what A+B did
(see §7 of the 07-16 handoff and Open (6) below), so they ship ready, disclosed, and off.

## 0. Session log (one Code session, 2026-07-26)

1. Read the 07-16 handoff + the discovery path end-to-end (universe, universe-settings, salience,
   prompts, discovery, index, agent, db canonical/focused split, public-view boundary, lab/admin/
   methodology pages).
2. Built **C**: `selection` settings group (3 knobs) → `lib/orchestrator/selection.ts` pure enforcement
   → `selectionQuotaBlock` in prompts.ts → wired through discovery.ts/index.ts → flags to compiler.
   Probe-tested 8 scenarios, deleted the probe.
3. Built **D**: `RunParams.blind` + `BlindSelectionSchema` → `lib/orchestrator/blind.ts` two-phase
   discovery → index.ts branch → API + lab toggle + BLIND chip + audit tag → `kindClause` excludes
   blind from canonical. Prompt-render probe, deleted.
4. Disclosure: lab-page copy, +1 citation (Barber & Odean 2008), auto-rendered selection group on
   /admin + /methodology.
5. Gates (§4), docs (CLAUDE.md v3-dated entries, memory twin synced, this handoff).
6. **Not committed** — left on the working tree for owner review (Railway auto-deploys on push to
   main; a mid-review push is undesirable, and C/D are unrun live).

## 1. (C) Selection discipline — `lib/orchestrator/selection.ts`

The ranked pool (B) puts filings evidence in front of the scout but can't force it to use it. C is the
deterministic counterweight, applied to the DELIVERED cohort at Stage-1 extract time:

- **Ranked-head FLOOR** (`rankedFloor`, default 0): minimum picks that must come from the
  fundamentals-ranked head of the pool.
- **Consensus CEILING** (`salienceCap`, default 12 = cohort size = off): maximum picks that may be on
  the salience baseline (the 200 famous names in `lib/salience.ts`), measured via `salienceRank`.
- **Hard gate** (`selectionHardGate`, default off): off → a miss is disclosed only (flag-only); on →
  the platform deterministically **substitutes** top ranked-head names for the shortfall
  (reject-and-replace), each swap disclosed. Replacement candidates get a synthetic thesis built from
  their filings digest and honest matched-traits ("Fundamentals-ranked (data-surfaced…)"); the three
  lenses then research them from scratch (they treat the thesis as a hypothesis anyway). Length is
  always preserved.

`applySelectionQuota(candidates, pool, quota)` is a pure fn returning `{candidates, flags, activity,
stats}`. Two passes under the hard gate: (1) retire famous picks over the ceiling — non-ranked ones
first, swapping in the best unused **non-famous** ranked name so the count actually drops; (2) fill the
floor with unused ranked names, never pushing the famous count back over the ceiling. Flags flow into
the compiler's `extraGaps` → `gapsNoted` (public, sanitized). Activity narrates on the feed.

**Prompt side is qualitative only.** `selectionQuotaBlock` (prompts.ts) tells the scout to work the
RANKED SEGMENT top-down and cap consensus-crowded names — but it **never shows the model the salience
list**. Two reasons: naming the 200 famous tickers would let the model game the count, and it would be
a white-label leak. The floor references the RANKED SEGMENT table (already in the pool block); the
ceiling is stated qualitatively ("no more than K widely-covered next-mega-cap names"). The
deterministic check measures against the hidden list out of band.

**Knobs** (lib/universe-settings.ts, new `selection` group → 24 total): `rankedFloor` /
`salienceCap` / `selectionHardGate`; env `MAG8_SELECT_{RANKED_FLOOR,SALIENCE_CAP,HARD_GATE}`. All three
default-neutral, so with defaults `selectionQuotaBlock` renders nothing and `applySelectionQuota`
returns the cohort untouched.

## 2. (D) Blind-selection lab — `lib/orchestrator/blind.ts`

`RunParams.blind` (lab-only) switches Stage 1 to a two-phase blind pipeline:

- **Phase 1a (blind select)** — a TOOL-LESS agent (no skill, no web) sees the ranked head as
  ANONYMIZED data cards: sector + size **bucket** + filings digest, with an opaque card ID and **no
  ticker or company name**. Deck = ranked head capped at 60, week-seeded shuffled so card order does
  not encode rank. It returns a shortlist of card IDs (≈`count`×1.75). The id→row unblind map is kept
  server-side.
- **Deterministic unblind** — IDs → tickers → shortlist rows (with names). Backfilled from the ranked
  head if the model returned too few valid IDs, so phase 1b always has ≥ count.
- **Phase 1b (research)** — the normal discovery skill + web research the UN-blinded shortlist and
  deliver the best `count`, narrowing on research quality, not familiarity. Final cohort is enforced
  to be a subset of the shortlist (drift dropped), preserving the measurement.

Why: because the **selection** decision happened without names, the salience overlap of a blind cohort
vs a sighted one on the same week (`npm run audit:salience`) is the cleanest read on how much name
familiarity drives normal discovery. It **reduces** name-bias; a distinctive data profile can still
fingerprint a name, so it doesn't erase it — disclosed as such on the lab page.

Wiring: `index.ts` branches `params.blind ? runBlindDiscovery : runDiscovery` (same
`{discovery, costUsd, selectionFlags}` shape). Fail-open → normal discovery when there's no ranked pool
(SEC down / ranking off), disclosed on the feed. **Non-canonical:** `kindClause` in db.ts now excludes
`blind=1` from canonical (blind → focused), so a blind experiment can never displace the weekly board.
Labeled: BLIND chip on RunView + the admin history Mode column; `audit-salience` tags blind runs.
Lab panel has a "Blind selection (experiment)" toggle; `npm run pipeline -- --full --blind` runs it
from the CLI.

Note: blind mode does NOT also apply the selection quota (C) — blind is the stronger discipline, and
the two would be redundant. Design choice, not an oversight.

## 3. Disclosure

- The `selection` settings group auto-renders on /admin (editable) and /methodology (live effective
  values), like every other Stage-0 knob. Blurbs are public-safe (no "skill"/"agents"/provider words).
- Lab page: intro + a "Blind selection" info card, and the "Labeled everywhere" card now names the
  BLIND chip and the canonical exclusion.
- +1 citation **Barber & Odean 2008** ("All That Glitters" — attention-driven buying of famous names,
  the seminal empirical basis for the consensus ceiling) added to the `universe` citation group. This
  is **gen:bib no-op** (the universe group feeds /methodology only, not the skill bibliographies) and
  the homepage works-cited chip auto-computes → **44**.

## 4. Gates run

- **tsc** 0 errors (after adding `blind` to the RunParams literals in run-pipeline.ts + seed-fixture.ts;
  `--blind` CLI flag added along the way).
- **gen:bib** no-op (all four unchanged).
- **seed regression EXACT**: ASTS 90.3 pass+confluence, RKLB 73.9, TMDX 69.5, SYM 51.5, IONQ 47.9,
  CRSP 46.7, OKLO 42.7, ACHR 19.3 fail-gated #8.
- **next build** clean.
- **leak probe 0-hit** across /, /rankings, /methodology, /lab, /stocks/ASTS, /runs/fixture-demo-run +
  snapshot JSON + SSE (only the two approved homepage "26 AGENTS" chips; confirmed no skill/agent/
  provider tokens, and the new selection group + lab copy + Barber & Odean render clean).
- **Selection probe** (deleted): 8 scenarios pass — inactive no-op, soft flag, hard floor meets floor,
  hard ceiling meets cap, both together (no dupes), no-pool (flag only), well-formed replacement.
- **Prompt-render probe** (deleted): quota block appears when active / vanishes on defaults; blind
  cards leak no tickers; shared output contract intact on both discovery prompts.

## 5. Honest limits (deliberate — do not "fix" casually)

- **Blind deck = ranked head only.** The rotation segment has no filings digests, so the anonymized
  cards can only be the ranked head. Blind selection therefore chooses among the fundamentally-best
  names — which is much of the point, but means it isn't a blind draw over the whole eligible set.
- **Fingerprinting.** A distinctive card ("Space · $1–3B · rev $501M +168%") can still hint the name.
  Size is bucketed to blunt this; it is disclosed, not solved.
- **Finance-sector OCF** still misreads the ranked head (SOFI-class), same structural issue as the
  runway screen's Finance exemption — a future rank-exemption knob, left as pure arithmetic here.
- **Blind mode cost** is two agent calls (a cheap tool-less 1a + a normal-cost 1b). `estimateRun` still
  shows the sighted estimate; blind is an experiment, so this wasn't complicated.

## 6. Open / next session

- **Open (6)** (root CLAUDE.md): C and D are shipped but **UNRUN live**. After the first post-B real
  run: if `audit:salience` overlap is still high, turn the selection knobs on via /admin (suggest
  `rankedFloor` 3–4 and `salienceCap` 3–4; enable the hard gate once the soft flags read right), and/or
  run a `--blind` lab run, then `audit:salience` for the blind-vs-sighted delta on the same week.
- Everything is on the working tree, **uncommitted** — a push to main auto-deploys on Railway, so the
  owner should review/commit deliberately. Suggested commit split: one for C (selection.ts + knobs +
  prompt + wiring), one for D (blind.ts + schema/params + UI + db kindClause), one for docs.
