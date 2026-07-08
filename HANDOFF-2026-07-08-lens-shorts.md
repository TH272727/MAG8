# Handoff — three vertical lens shorts + master pacing pass (session 2026-07-08)

**Deliverables (all in `marketing/video/out/`):**

| File | Format | Length | Story |
|---|---|---|---|
| `short-fundamentals.mp4` | 1080×1920 @30 | 74.8s (2244f) | whole pipeline + Fundamentals deep chapter |
| `short-macro.mp4` | 1080×1920 @30 | 79.8s (2394f) | whole pipeline + full game-theory chapter |
| `short-consensus.mp4` | 1080×1920 @30 | 75.5s (2265f) | whole pipeline + Street Consensus chapter |
| `the-signal.mp4` (re-render) | 1920×1080 @30 | 2:01.4 (3642f, was 1:53) | pacing pass — text holds longer |

## 1. What was asked

- Viewer feedback on the launch film: **pause slightly longer wherever there is
  more text** → applied to the master (see §3) and baked into the shorts.
- **Three short-form videos**, each covering *everything* about MAG8, each
  specializing in ONE lens (scout excluded as a specialization). The
  game-theory short explicitly needed the whole mapping: players of the game,
  all paths, etc.

## 2. The shorts (`marketing/video/src/shorts/`)

Structure per short: shared spine + one deep chapter, one `<Composition>` each
(`Short-Fundamentals` / `Short-Macro` / `Short-Consensus`), context-driven
(`ShortCtx`) so V04 (lane pick) and V13 (endcard chip) brand the episode.

- **Spine open** V01–V04 (~21s): search-bar hook buried in hype bubbles →
  trash → "One opinion can talk itself into anything." → MAG8 wordmark + four
  ticks + "One scout. Three lenses. One verdict." → violet beam lifts 8 of a
  144-block field → three sealed rooms (blind lanes) → this episode's room
  glows ("THIS ONE GOES DEEP · …").
- **Deep chapters** (~30–35s):
  - *Fundamentals* VF1–VF5: ledger/tape/quality gauge → Piotroski F pips
    (8/9, "F ≤ 3 IS AN AUTOMATIC VETO") + Altman-Z zone band → value-trap
    mesh (5 fall, 2 cut, 3 advance) → reverse-DCF bars ("price assumes 12% /
    path supports 31% / +19pts unpriced") → scenario ladder ($18/25%,
    $34/50%, $86/25%, prob-weighted $40.5 vs spot $27) + source chips.
  - *Macro* VM1–VM5 (the GT showcase): arcs board → **6 player cards with
    M/E/C meters** (Mass·Energy·Coordination, weighted = [M+2E+4C]÷7,
    "ranking re-checked unweighted") docking into the **Mass×Coordination
    scatter (size = Energy)** — the same instrument `GtCharts.tsx` ships →
    **full path tree** (TODAY → ESCALATE/HOLD/RESOLVE → 12 leaves with
    probabilities summing to 100; equilibrium line ignites, PATHS 21 ·
    PRUNED 16 · P=0.62) → horizon fan 45/55/60/70% with dashed bear line →
    asymmetry dial 8.5 + entry window + **falsifier card with kill stamp**.
  - *Consensus* VC1–VC5: bracket field → 8 desk cards (stance/range/as-of/
    verified; 5▲ 2─ 1▼ + one stale cut) → ranges collapse into the band
    (low 236 / consensus 247 / high 258 / spread 9%, spot 228) → bull $258 vs
    bear $236 cards → Δ23% divergence flag ("flagged in the open, scored
    anyway").
- **Spine close** V10–V13 (~22s): four threads fall & fuse (first gold),
  "agreement is the signal." → verdict dot → 90.3 rises onto a native
  leaderboard (rows 73.9/69.5 dim) → real `rankings.png` + `stock-vrt.png`
  panning panels ("Every verdict shows its work.") → endcard with mark, gold
  dot, episode chip, disclaimer.

New files: `src/shorts/{timeline.ts,vlib.tsx,vbraid.tsx,vscout.ts}` +
`src/shorts/scenes/*` (8 spine + 3×5 deep), `scripts/gen-score-shorts.ts`
(three WAVs, same synth toolkit, per-short motifs), Root registrations,
`render:shorts`/`gen:score:shorts` npm scripts.

The pacing rule was applied to the shorts themselves after a first render
(V02 +15f, V10 165→189 — the "agreement is the signal." hold — V11 +15f,
VC5 +21f; V02's recede and V11's braid `T_OFF` moved with them). If you
re-cut, keep every full-sentence beat ≥ ~2.2s after its last word lands.

## 3. Master pacing pass (viewer feedback)

`src/timeline.ts`: +15–21f on S03/S05/S06/S07/S08/S09/S11/S12/S13/S14/S15/
S16/S17/S18/S19/S21 (total +252f → 3642f, 2:01). Because scenes are keyed on
absolute frames, extra frames = longer tail holds; the five scenes whose
exits were keyed near the old end moved with it: S03 dissolve 142→157,
S07/S08/S09 `slideOutAt` 140→155, S17 `toDark` 138→153, S21 `fadeOut`
196→211. Three chapter-spanning pads in `gen-score.ts` stretched to the new
chapter lengths (16/19/16.6s). S10 untouched → S11's braid `T_OFF=180` still
matches. Score regenerated; hits stay aligned by construction.

## 4. Verification

- `npx tsc --noEmit` clean.
- 23 stills reviewed across the three shorts (all spine + every deep scene).
  Fixed from stills: VF2 readouts overlapped pips/band (moved to bottom
  rows, panels tightened); VF3 mesh label under the line + earlier readouts;
  VM2 card stagger 16→11, MAP_AT 168→150, caption/roster earlier (cards 5–6
  and the map captions were landing too close to the cut); V11 board nudged
  up 60px; V11 score now born at the braid dot (y1450) and rises onto the
  board.
- Leak grep over `marketing/video/src/ scripts/`
  (`stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|skills?|agents?`)
  → **0 hits**. Method vocabulary on screen (M×E×C, player map, horizon fan,
  Piotroski/Altman, desks) is the site's own public vocabulary
  (`GtCharts/ScannerCharts/ForecastRangeChart`, fixtures).
- Renders: ffprobe + motion contact sheets after render (see §5 status).

## 5. Notes / open

- Numbers are the film's stylized demo universe (90.3 / 73.9 / 69.5, $247
  band, 8.5 asymmetry) — consistent with the master; screenshots are the
  real W28 data.
- No URL on endcards (deploy still undecided) — same rule as the master.
- Social encode when posting: `ffmpeg -i short-macro.mp4 -crf 26 -preset slow`
  per platform; captions "Research, not investment advice."
- `video-prompts.md` untouched — it remains the gen-AI storyboard doc; the
  shorts are native Remotion work layered on the same brand system.
