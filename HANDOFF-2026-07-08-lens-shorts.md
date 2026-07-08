# Handoff — three vertical lens shorts + master pacing pass (session 2026-07-08)

**Deliverables (all in `marketing/video/out/`, committed source at `eb7b874`):**

| File | Format | Length | Size | Story |
|---|---|---|---|---|
| `short-fundamentals.mp4` | 1080×1920 @30 | 74.9s (2244f) | 66.0 MB | whole pipeline + Fundamentals deep chapter |
| `short-macro.mp4` | 1080×1920 @30 | 79.9s (2394f) | 70.0 MB | whole pipeline + full game-theory chapter |
| `short-consensus.mp4` | 1080×1920 @30 | 75.6s (2265f) | 66.5 MB | whole pipeline + Street Consensus chapter |
| `the-signal.mp4` (re-render) | 1920×1080 @30 | 2:01.4 (3642f, was 1:53) | 104.4 MB | pacing pass — text holds longer |

Commit: `eb7b874` — "film: three vertical lens shorts + master pacing pass"
(29 files, +3798/−40; mp4s/WAVs are gitignored and reproducible).

---

## 1. What was asked

1. **Viewer feedback on the launch film:** "pause slightly longer whenever
   there is more text so viewers can read" — applied to the master (§3) AND
   codified into the new shorts (§4, twice — see the two-pass render story §6).
2. **Three short-form videos**, each covering *everything* about MAG8, each
   specializing in ONE lens (scout excluded as a specialization). The
   game-theory short explicitly needed the whole mapping: players of the
   game, all paths, etc. Context inputs: `HANDOFF-2026-07-07-launch-film.md`
   + the two prompt sets in `marketing/video-prompts.md` (21-scene long form
   + V1–V4 vertical short). The shorts are native Remotion work in the same
   brand system; `video-prompts.md` itself is untouched (still the gen-AI
   storyboard doc).

## 2. Shape of each short

One `<Composition>` per episode (`Short-Fundamentals` / `Short-Macro` /
`Short-Consensus`), all sharing a spine; a React context (`ShortCtx`) tells
V04 which sealed room to spotlight and V13 which episode chip to stamp.

- **Spine open** V01–V04 (~21s): search bar with "the next trillion-dollar
  stock?" buried under hype bubbles → trash can → "One opinion can talk
  itself into anything." → MAG8 wordmark + four lens ticks + "One scout.
  Three lenses. One verdict." → violet beam lifts 8 of a 144-block field →
  three sealed rooms (blind lanes); this episode's room glows
  ("THIS ONE GOES DEEP · …").
- **Deep chapter** (~30–35s) — the differentiator, built from the site's own
  PUBLIC instrument vocabulary (`GtCharts/ScannerCharts/ForecastRangeChart`,
  fixtures):
  - *Fundamentals* VF1–VF5: ledger bars + tape + quality gauge (8.6/10) →
    Piotroski F pips 8/9 with "F ≤ 3 IS AN AUTOMATIC VETO" + Altman-Z zone
    band (Z 4.2 → SAFE) → value-trap mesh (5 fall, 2 cut ✕, 3 through) →
    reverse-DCF bars ("price assumes 12% / path supports 31% / +19pts
    unpriced") → scenario ladder ($18/25% · $34/50% · $86/25%,
    prob-weighted $40.5 vs spot $27) + 3 source chips + "<3 sources = flagged".
  - *Macro* VM1–VM5 (the GT showcase): dotted board + great-circle arcs →
    **6 player cards with M/E/C meters** (Mass · Energy · Coordination;
    weighted = [M + 2E + 4C] ÷ 7, "ranking re-checked unweighted") that
    dissolve into the **Mass×Coordination scatter, dot size = Energy** —
    the exact instrument the live dossier ships — with numbered roster →
    **the full path tree**: TODAY → ESCALATE / HOLD / RESOLVE → 12 leaves
    with probability chips summing to 100, equilibrium line ignites through
    HOLD (readouts PATHS 21 · PRUNED 16 · EQUILIBRIUM P=0.62, beads travel)
    → horizon fan 45/55/60/70% with dashed bear line → asymmetry dial 8.5/10
    + entry window (setup 7/10, least-priced-in 62%) + **falsifier card**
    ("WRONG IF: the demand anchor slips two straight quarters." + red
    "✕ KILL CONDITION SET" stamp; "if it breaks, the call dies in public").
  - *Consensus* VC1–VC5: bracket field warms up → 8 desk cards
    (DESK 01–08, stance ▲/─/▼, range, AS OF date, ✓ VERIFIED; balance
    5▲ 2─ 1▼ + one stale cut) → ranges collapse into the band (LOW 236 ·
    CONSENSUS 247 · HIGH 258 · SPREAD 9%, spot 228) → bull $258 vs bear
    $236 cards ("disagreement is data") → Δ23% "DIVERGENCE FLAGGED" beat
    (mirrors the real >20% cross-check invariant; "joins the known-gaps list").
- **Spine close** V10–V13 (~24s): four threads fall from the top edge and
  fuse (first gold; vertical braid) → "— agreement is the signal." →
  heartbeat dot births 90.3 which **rises onto** a native leaderboard row
  (01 CONFLUENCE ▲▲▲ 90.3; dim 73.9/69.5 below; "gates checked · scores
  re-verified in code") → real `rankings.png` + `stock-vrt.png` panning
  panels ("Every verdict shows its work.") → endcard: ink-rimmed mark,
  MAG8 + gold-dot pulse, tagline, `THIS EPISODE · LENS 0X · <lens>` chip,
  "RESEARCH, NOT INVESTMENT ADVICE", fade to black.

Stylized demo numbers (90.3 / 73.9 / 69.5, $247 band, 8.5 asymmetry) match
the master film's universe; the screenshots are the real W28 data.

## 3. Master pacing pass (the feedback, applied)

`src/timeline.ts`: +15–21f on S03 S05 S06 S07 S08 S09 S11 S12 S13 S14 S15
S16 S17 S18 S19 S21 (total +252f → 3642f, 2:01.4). Scene-internal beats are
keyed on absolute frames, so added frames = longer tail holds — except five
scenes whose exits were keyed near the old end; those moved out by the same
amount **in their scene files**: S03 dissolve 142→157, S07/S08/S09
`slideOutAt` 140→155, S17 `toDark` 138→153, S21 `fadeOut` 196→211. Three
chapter-spanning pads in `gen-score.ts` stretched to the new chapter lengths
(16 / 19 / 16.6s). S10 untouched → S11's braid `T_OFF=180` still matches.
`gen:score` re-run (121.9s WAV), master re-rendered.

## 4. New source (all under `marketing/video/`)

```
src/shorts/timeline.ts       per-short scene tables (spine + deep), VW/VH,
                             shortScenes/shortTotal/shortSceneStart — the
                             single timing source for film AND scores
src/shorts/vlib.tsx          ShortCtx + LENS meta, VKeyLight, VHead, VFoot,
                             Redacted (portrait shared pieces)
src/shorts/vbraid.tsx        vertical transpose of lib/braid (threads fall
                             from top, braid weaves down; VNODE 540,1010 →
                             VBRAID_END y1450)
src/shorts/vscout.ts         12×12 portrait index field + chosen-8 + thread
src/shorts/scenes/V01…V13    8 shared spine scenes
src/shorts/scenes/VF_… VM_… VC_…   3×5 deep-dive scenes (one file per lens)
scripts/gen-score-shorts.ts  three WAVs (score-{short}.wav), same synth
                             toolkit as gen-score.ts wrapped per-track;
                             per-short motifs (abacus / strategic heartbeat
                             / plucks), shared spine cues (pops, sonar,
                             riser+impact at V10 f108, board ratchets,
                             endcard resolve)
```

`Root.tsx` registers the three comps (durations from the tables, audio
`staticFile('audio/score-<short>.wav')`). `package.json`: `render:shorts`,
`gen:score:shorts`. README documents outputs + the pacing rule.

**Pacing rule (now standing, in README):** every full-sentence beat holds
≥ ~2.2s after its last word lands; secondary mono footnotes ≥ ~1s. Bake it
into any re-cut.

## 5. Verification done

- `npx tsc --noEmit` clean (strict; shorts included via `src` include).
- **~30 stills reviewed** (`out/stills/sf-* sm-* sc-* m2-* m3-* vf2-* vm2-*
  vc2-* probe-*`; 91 files in the dir now). Bugs found and fixed from
  stills: VF2 "8 / 9" Roll overlapped pips 8–9 and the Z readout touched the
  zone band (both readouts moved into flex rows, panels tightened
  410/400→340/340); VF3 mesh label was covered by a landing trap chip
  (moved below the line) + screen-result readouts landed too late (−12f);
  VM2 cards 5–6 were barely formed before the map crossfade (stagger 16→11,
  meters faster, MAP_AT 168→150, map captions/roster earlier); V11 board
  nudged up 60px and the 90.3 now **births at the braid's verdict dot
  (y1450) and rises onto rank 01** (was appearing mid-air).
- **Two-pass pacing on the shorts themselves** (§6): after the first full
  render, a self-audit against the user's rule found four spine beats still
  too fast — V02 135→150 (recede keys moved 124→139), V10 165→189 (the
  "agreement is the signal." hold; V11 `T_OFF` 165→189 for braid phase
  continuity), V11 150→165, VC5 135→156. Scores regenerated, shorts
  re-rendered. Final spot-frames from the **encoded mp4s** confirmed every
  retimed hold on screen (V02 promise card, V10 slogan + braid, VF2/VF3
  fixes, VM2 map + captions, VC5 full stack).
- **ffprobe** on all four files: exact frame counts (2244/2394/2265/3642),
  1080×1920 / 1920×1080, 30fps, AAC audio.
- **Leak grep** (white-label gate) over `marketing/video/src/ scripts/`:
  `stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b`
  → **0 hits**. On-screen method vocabulary (M×E×C, player map, Piotroski,
  Altman, desks, horizon fan) is the site's own public instrument language.
- **H.264 softness finding (not a bug):** frames extracted from the mp4
  showed intermittent gaussian-looking softness on the big display font
  (e.g. master S07 headline). A composition-direct
  `remotion still --frame=1125` is razor crisp, and the old approved
  encode's contact sheets show the same softness family → it's the encoder
  coasting on static regions between refreshes at the current quality
  settings, identical to shipped v1, invisible at playback speed. If it
  ever matters: raise crf/jpeg quality or use `--image-format=png`.

## 6. Render pipeline notes (this box)

- All of §5 of the 2026-07-07 handoff still applies verbatim: system Chrome
  + `chrome-for-testing` mode (headless-shell download is DNS-blackholed),
  `setRendererPort(3333)`.
- **Port 3333 serializes everything** — never run two renders (or a render
  + `remotion still`) concurrently. This session's order: stills → batch
  render (3 shorts + master, ~45 min total) → pacing patch → regen shorts
  scores (safe while master rendered: master reads only `score.wav`) →
  re-render 3 shorts (~30 min). Editing source files while a render runs is
  safe AFTER that render has bundled (bundle snapshots at process start).
- ffmpeg frame extraction (`select='eq(n,N)'`) is the cheap way to verify
  encoded output; `remotion still` is the way to verify the composition.

## 7. Repo / machine state after this session

- Committed on `main`: `eb7b874` (sources + docs). `out/*.mp4`,
  `public/audio/*.wav`, `out/stills/*` remain gitignored & reproducible
  (`gen:score`, `gen:score:shorts`, `render`, `render:shorts`).
- Docs updated: `CLAUDE.md` state line (122s master + three shorts),
  `marketing/video/README.md` (outputs, commands, pacing rule), this file.
  Memory twin updated in BOTH places (`mag8-project-state.md` + `MEMORY.md`
  index) per the standing instruction.
- The production `next start` server from the previous session is still on
  :3000 (untouched); DB untouched; no pipeline runs; zero spend.
- `video-prompts.md` unchanged. Old master mp4 was overwritten in place
  (113s version is gone; regenerate by reverting `src/timeline.ts` + the
  five exit-key edits if ever needed).

## 8. Not done / natural next steps

- **Social encodes** when posting: `ffmpeg -i short-macro.mp4 -crf 26
  -preset slow` per platform (~20 MB copies); caption "Research, not
  investment advice." Poster frames: endcards sit in the last ~5s of each
  file (e.g. `--frame=2160` on Short-Fundamentals).
- **No URL on any endcard** — deploy target still undecided (open item along
  with email capture). Add to V13 + S21 the day it ships; reshoot
  `public/shots/` after any UI change.
- Licensed-music swap stays trivial: replace the WAV(s), keep filenames,
  re-render.
- If more episodes are wanted (e.g. a scout/discovery special, a
  methodology explainer), the spine + `DEEP` table pattern in
  `src/shorts/timeline.ts` is the extension point: add a scene table +
  scene files + a score block keyed off the same table.
