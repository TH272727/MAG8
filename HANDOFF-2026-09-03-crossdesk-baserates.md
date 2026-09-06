# 2026-09-03 — The Cross-Desk Ledger + rotation conditional base rates

Two deterministic additions, both $0, both drawing zero plan window, neither storing anything of its own.
Branch `feat/rotation-board` (still unmerged, as are `feat/bottleneck-desk` beneath it). **NOT PUSHED.**

Origin: the owner asked for a brainstorm on whether **MiroFish** — an open-source multi-persona social
simulator (OASIS/CAMEL-AI under the hood, AGPL-3.0, no published accuracy validation) — could improve Mag8.
The review said the idea was right and the mechanism wrong, for reasons that are worth keeping on file:

- **Mag8's own source standard rejects its output.** `lib/source-standard.ts` says sentiment is Tier B — a
  lead, never evidence, and alone moves no verdict, score, probability or target. A simulated crowd produces
  *synthetic* Tier B. It could not legally touch a score under the rule already published on /methodology.
- **Spend.** Upstream needs an OpenAI-compatible endpoint plus Zep Cloud; the Agent SDK is neither. Shimming
  the SDK behind a fake `/chat/completions` would put a simulation in competition with the pipeline for the
  same 5-hour window that already killed run `faaa8ffe` twice. Local Ollama is the only honest $0 route, and
  this box is an RTX 5070 / 12GB — the offline fork's *minimum* (qwen2.5:14b), not its recommended tier.
- **The leak gate**, again: "multi-agent swarm intelligence" is the agent-reach trap verbatim.
- **AGPL-3.0 network copyleft** would arguably oblige offering Mag8's source to every visitor.

The owner picked the two ideas that survived, and neither needs MiroFish. Both were then built.

---

## What was measured before anything was designed

Read-only against `db/mag8.db` and live Yahoo. Each finding changed the build.

**1. The desks barely overlap, and one pair cannot overlap at all.**
Measured, then reproduced by the shipped code: weekly board ∩ insider buys = **0**. The pipeline hunts
$1–50B companies on a path to enormous scale; the insider scanner wants a drawdown plus officers buying, and
lands on small/mid value names. They are structurally disjoint populations. The page says so rather than
showing an empty table.

**2. My own sanity-check figure was wrong, and the code is stricter than I was.**
The plan's expected pipeline ∩ bottleneck crossing was 7 names (AVAV KTOS RCAT SYM IONQ RGTI OKLO). The
shipped ledger reports **5**. It is right and the plan was wrong: I had counted raw `rankings` rows, while
`getAllTimeBoard("canonical")` correctly excludes focused and blind runs — and AVAV and RCAT appear **only**
in a focused run (`modifier: "small-cap defense technology and dual-use autonomy"`). Verified in the DB.

**3. Five years of closes could not support a base rate, and would have published the wrong sign.**
1,255 stored sessions, minus a 756-session percentile warmup, minus a 63-session forward window, left
**439 usable days**. RSP/SPY occupied its own bottom decile on 316 of them — 72% — because a trending series
keeps making new lows inside its own trailing window. Those 316 days were **12 episodes**. Recomputed on 20
years of the same data the conditional 63-day mean **flips sign**, −1.21% → +0.24%.

**4. Yahoo serves 20 years.** Verified live and then stored: 31/31 tickers, 140,970 closes, 20.7s, zero basis
switches. Core funds reach 2006-09-05 (5,030 sessions); newer ones do not (XLC 2018, XLRE 2015, MTUM 2013,
QQQE 2012), so each indicator reports its own usable span.

**5. Overlapping windows are not independent observations.** A 63-day forward reading taken on consecutive
sessions shares 62 of 63 days with its neighbour. The honest sample size is the episode count, never the day
count — and episodes need a merge tolerance, because a condition that flickers fragments into fake
independent visits (measured: adding a slope filter turned 316 days / 12 episodes into 86 days / **20**).

---

## Feature A — The Cross-Desk Ledger (`/crossdesk`)

Named `/crossdesk`, not `/convergence`: the pipeline already owns "Trillion-Dollar Confluence" and
`--color-confluence` (gold) is reserved for its final verdicts. No gold appears on this page.

`lib/crossdesk/` — **stores nothing.** No table, no migration, `user_version` stays 7. Every row is derived
on read from what four desks already hold, so it cannot drift from them and updates the moment any one of
them refreshes. Same doctrine as the insider scanner.

- `sectors.ts` — the ticker → sector → sector-fund bridge, pinned by test.
- `claims.ts` — one adapter per desk, each reading a no-network function.
- `score.ts` — pure: claims in, ranked rows out.
- `format.ts`, `index.ts` (`readLedger`, never network).
- `lib/crossdesk-settings.ts` — 4 knobs over the shared registry + `MAG8_CROSSDESK=0`.

### The claim model — the honest core

A row is not "N desks like this stock". Every claim carries its **kind**, and the page prints it:

| kind | means | from |
|---|---|---|
| `measured` | a desk computed a figure about **this company** | board `finalScore`; insider composite + dollars filed |
| `curated` | the company is on a hand-kept list, carrying the **measured** state of what it is attached to | bottleneck `owners[].tickers` and `demand.basket` |
| `context` | about the **neighbourhood**, never the company | rotation sector ratio, via the sector bridge |

**Two deviations from the approved plan, both deliberate:**

1. **The universe screen is not a desk.** The plan listed it as a `measured` source. Being eligible is the
   price of entry to two of these desks, not evidence — counting it would hand every company a free point.
   It instead contributes what it actually measured: cautions about size, price, solvency and dilution,
   shown against a company and never as agreement with it. (`universeScreenFlags` was widened from
   `UniverseResult` to `Pick<…,"rows"|"extras"|"settings">` so a stored snapshot can be passed without
   faking a live screen.)
2. **The rotation board never counts toward agreement.** It trades funds, so it cannot have an opinion on a
   single name. It is absent from `DESK_ORDER` by construction, and a test asserts no desk pair involving it
   is ever reported.

### The sector bridge

The sector comes from the weekly screen — the exchange's own classification, **13 clean values**, verified
against the stored W32 snapshot (5,315 rows). It deliberately does **not** come from `candidates.sector`,
which is model-written free text: **88 distinct values across 55 companies** ("AI-native creative/software
platform", "Physical AI / warehouse automation"). Nothing can be joined on that.

Ten sectors map to a fund, `Telecommunications → XLC` is labelled approximate, and `Miscellaneous`/`Other`
map to nothing and show nothing. A test asserts every mapped fund has a real board indicator, so the bridge
can never point at a permanently blank reading.

### Second crossing axis — bottleneck themes (owner follow-up, same session)

The owner pointed out that a company named by **more than one bottleneck industry** is itself a crossing,
and gave CEG as the example. They were right: CEG is named under AI-infrastructure power generation
(+81.9pp tightening) *and* under nuclear energy (+86.5pp). Seven companies are in that position — BWXT,
CEG, GEV, MP, TLN, USAR, VST — and the ledger went from **7 crossings to 13**. VST now crosses on both
axes at once.

Two things make it honest rather than just a bigger number:

1. **It ranks below every desk crossing, always.** Two themes are one desk's method applied twice over
   lists the same person maintains — not two methods arriving independently. `compareRows` orders on
   measured desks, then desks, then themes; `crossedBy: ("desks" | "themes")[]` is on every row and the
   card states in words which kind of crossing it is.
2. **Two themes over the same input is one constraint, not two.** MP and USAR are named by drones *and*
   robotics, but both through `ndpr_kg` — the same rare-earth magnet constraint showing up in two
   industries. `DeskClaim` gained `constraint` (the conversion-factor key) alongside `group` (the theme
   id) precisely so the page can tell those apart; `sharedConstraint` counts them and the row says so.
   CEG by contrast spans two genuinely different inputs (`mw`, `nuclear_mw`).

A side effect worth noting: CEG ($97.5B) and GEV ($263.8B) are correctly flagged as above the discovery
band's $50B ceiling. They are bottleneck owner-map names, not pipeline candidates, and the weekly screen's
caution says so on the row.

### Live reading (2026-09-03)

13 crossings out of 244 companies named (7 by desks, 6 more by themes alone). Pair overlap: **board ∩ insider 0**, board ∩ bottleneck 5,
insider ∩ bottleneck 2. The crossings: SYM, KTOS, IONQ, OKLO, RGTI (board × bottleneck) and NVR, VST
(insider × bottleneck). RGTI additionally carries a screen caution — 1.9 quarters of cash runway.

`/crossdesk?risk=conservative` returns a visibly smaller page than `?risk=aggressive`: the visitor's own risk
tolerance re-derives the insider desk's whole funnel, for free, because nothing derived is stored.

---

## Feature B — Rotation conditional base rates

**Step 0, the history change.** `historyYears` max 10 → 20 via a new exported `MAX_HISTORY_YEARS`.

**A real bug this surfaced.** `loadSeries` read bars with a hard-coded `limit = 3000`, and `getBars` returns
the **newest** rows. At 20 years (5,030 sessions) that would have silently discarded the oldest eight years
while every page carried on describing the full span — a confident wrong number with nothing to reveal it.
`barReadLimit()` is now sized to the most history the board can ever hold, deliberately **not** to the
operator's current setting, so lowering the fetch knob cannot appear to rewrite history still on file.

**`lib/rotation/baserates.ts`** — pure. `forwardChangeAt` was added to `math.ts` as the mirror of the
existing backward-looking `rateOfChangeAt`. `directionFrom` was **extracted** from `score.ts` and exported so
both the board and the conditional history apply one deadband rule rather than two implementations.

What keeps it from reading as a forecast:

- Sample counted in **episodes**, never days, with a merge tolerance (`baseRateEpisodeGapDays`, 5).
- The **plain figure is always published beside the conditional one** — only the difference informs.
- Below `baseRateMinEpisodes` (8) it reports **NOT MEASURED** and ranks last. Never a zero.
- **`bandSharePct`** — added after reading real output, not planned: `xlk-spy` sits in its own "top decile"
  for **49% of its measurable history**, because a trending ratio keeps making new extremes inside its
  trailing window. Above 40% the page says BARELY CONDITIONAL in as many words.
- No look-ahead: percentiles are trailing, and the last `horizon` sessions are excluded — visible in the
  output, where every usable span ends 2026-06-03 against a newest session of 2026-09-02.

A new settings group `baserates` (a small deviation from the plan's "put them in `signals`") so the
"episodes, not days" disclosure has a home that /admin and /methodology both render for free.

### Live reading, all 25 ratios (386ms)

All 25 clear the 8-episode floor. `xlu-spy` at the 0–10th percentile: **+1.42% conditional vs −0.33% plain,
+1.75pp, 72% of 32 visits positive.** `xli-spy` +1.54pp over 30 visits, 80%. `xlf-spy` +1.56pp over 58.
The flagship `rsp-spy` is the honest counterweight: **−0.35pp**, i.e. low breadth has historically *not* been
followed by breadth recovering.

`readBoard()` went 95ms → **279ms** at 4× the bars; the board page with base rates renders in ~1.7s and the
indicator detail page in ~2.2s (dev).

---

## Gates

- `npx tsc --noEmit` clean.
- `npm run test` — **762 passing** (was 721): +21 `tests/rotation/baserates.test.ts`, +20 `tests/crossdesk/`.
- `npm run seed` — fixture regression **EXACT**: ASTS 90.3 · RKLB 73.9 · TMDX 69.5 · SYM 51.5 · IONQ 47.9 ·
  CRSP 46.7 · OKLO 42.7 · ACHR 19.3 fail-gated #8.
- `npm run gen:bib` — no-op.
- `npx next build` clean, `/crossdesk` registered.
- `npm run rotation -- --refresh` at 20y: 31 ok · 0 failed · 0 thin · 140,970 closes · 20.7s, all
  yahoo/adjusted, **no basis switches** (the mixed-basis rule never fired).
- Leak gate: see below.
- Separation contract: no new table, no FK into a pipeline table, no SQL outside `lib/db.ts`.

## Environment findings (new, and both cost real time)

- **Node's `fetch` (undici) against this Next dev server wedges the server.** It answers curl in 1–2s, but a
  node-fetch probe produced `UND_ERR_HEADERS_TIMEOUT` and left the dev process spinning at 100% CPU
  answering nothing at all — twice, reproducibly, requiring a `Stop-Process`. The leak probe was rewritten to
  use **curl** (`scripts/__leak-curl.sh`, gitignored like every `scripts/__*`). It also prints byte sizes and
  flags anything under 20KB, because a mid-recompile response is a ~3KB Next shell that greps clean.
- **First-compile pile-up:** firing every surface at a cold dev server stacks compiles until requests time
  out. Warm the routes one at a time first.
- The Bash-tool heredoc backslash-eating quirk bit again: a multi-line Python edit whose pattern contained
  `\n` failed its own assertion because the heredoc ate the escape. Files with escapes must go through
  Write/Edit, exactly as CLAUDE.md says.

## Open

- The insider desk's contribution is thinner than it should be: NVR and VST are stopped with "No price
  history has been fetched for this company yet", which is the known `maxCandidates` (60 of 136 worked up per
  refresh) limit, not a finding about those companies. An insider refresh would improve the ledger.
- `historyYears` is still **5 by default**. The 20-year history is stored, and `barReadLimit()` reads all of
  it regardless — but the owner should set the knob to 20 on /admin so a future refresh keeps it.
- No new citations were added. Nothing was cited that had not been verified against a primary source in this
  session; the existing `Sullivan, Timmermann & White 1999` entry carries the data-snooping disclosure on
  both new surfaces. **The homepage chip stays 64.**
- Neither page has been seen at 375px (headless browsers return an empty DOM in this environment).
- Both features are on an unmerged branch stacked on another unmerged branch.
