# Handoff — "The Signal" launch film (session 2026-07-07 evening → 07-08)

**Deliverable: `marketing/video/out/the-signal.mp4`** — 1:53 (113.0s), 1920×1080 @ 30fps,
H.264 + AAC, ~98 MB (~7 Mbps). A 21-scene motion-design launch film for MAG8, built
programmatically with Remotion. Nothing in this session is committed; `marketing/video/` is
new, plus one-line state updates to `CLAUDE.md` and the memory twin.

---

## 1. What was asked and what was decided

Ask: a MAG8 marketing video using Remotion + open-source tools, inspired by "the aside video,"
using the site and the logo.

- The reference is `C:\Users\nocap\Downloads\aside.mp4` (87.5s, 640×360). Studied via ffmpeg
  montage grids. Style takeaways: giant 2–6-word kinetic type, dark→white→dark chapter smash
  cuts, real product UI floating in clean space, typewriter reveals, word-highlight pills.
- `marketing/video-prompts.md` (from an earlier session) already scripted a 21-scene
  aside-style film — "The Signal" — as gen-AI prompts. **This session executed that storyboard
  natively in Remotion instead**: exact `globals.css` hex tokens, vendored brand fonts, the
  real four-blade mark, real product screenshots. The 8s-per-scene grid (a gen-AI constraint)
  was re-timed to natural pacing (~5s/scene, 113s total vs the storyboard's 2:48).
- Fully open-source pipeline: Remotion 4.0.486 (+`@remotion/paths`, `noise`, `fonts`),
  ffmpeg 8.1.2 (reference study + verification), headless Edge (site captures), headless
  Chrome (render), pure-Node procedural audio. No gen-AI services, no external assets.

## 2. The film, scene by scene (frames @30fps in `src/timeline.ts`)

| Ch | Scenes | Beat |
|----|--------|------|
| 1 Noise (dark) | S01 search-bar type-on "the next trillion-dollar stock?" · S02 hype bubbles bury the bar · S03 trash-can purge → "One opinion can talk itself into anything." | the problem |
| 2 Introducing | S04 eyebrow chip → "Introducing" → MAG8 letters rack in + four lens ticks | the name |
| 3 Method | S05 violet scan beam lifts 8 blocks, cohort thread · S06 candidate chip ×3 into sealed lanes · S07 green ledger/gauge/tape/checklist · S08 copper game tree, lit path, beads · S09 teal target brackets → consensus band · S10 four threads converge, **fusion flash → first gold: woven braid** · S11 heartbeat verdict dot → "90.3" | the system |
| 4 Product (real UI) | S12 native leaderboard row draws, 90.3 docks, match-dissolve to real `/rankings` panning · S13 real run page + native "ACTIVITY WIRE" feed + LIVE chip · S14 real VRT dossier panning + source chips stamping + confidence pips | the receipts |
| 5 Trust (WHITE) | S15 three sealed boxes, looping trails · S16 ▲ ─ ▼ honest disagreement, gray 61.2 · S17 GAP NOTED chip + "RE-CHECKED IN CODE" stamp press | the honesty |
| 6 Close (dark) | S18 slot reels land ▲▲▲ → gold CONFLUENCE ignition · S19 week-row archive strata · S20 Hype./Luck. drift out → "Method." + 4-color→gold signature line · S21 endcard: ink-rimmed mark, MAG8 + gold-dot period, disclaimer, fade to black | the close |

Brand rules enforced: **gold appears nowhere before the S10 fusion** (copper carries macro);
mark glow is ink-toned, never gold; film-source leak grep is **0-hit**
(scout/fundamentals/macro/consensus/compile/verify vocabulary only); **no URL on the endcard**
(deploy undecided — add in S21 when it ships); closes on "RESEARCH, NOT INVESTMENT ADVICE".
Numbers caveat (per storyboard): 90.3/73.9/61.2 are stylized demo numbers; the real W28 board
tops at VRT 49.1 with zero confluence — the screenshots ARE the real data.

## 3. Project layout (`marketing/video/` — standalone npm project, NOT part of the Next app)

```
remotion.config.ts     browser/port config (see §5 — load-bearing)
src/theme.ts           tokens mirrored from app/globals.css (C, F, W/H/FPS)
src/timeline.ts        SCENES table = single timing source (film AND score)
src/Root.tsx           <Composition TheSignal> + one comp per scene (S01-Search…) + <Audio>
src/lib/anim.ts        lerp/springs/heartbeat/deterministic rnd (remotion random(), no Math.random)
src/lib/ui.tsx         Void (dark/white stage: grid+vignette+grain), Kinetic, TypeOn, Chip, Panel
src/lib/setpieces.tsx  SearchBar, BUBBLES, TrashCan (S1–S3 continuity)
src/lib/scout.ts       S5/S6 shared block field + chosen-8 + thread path
src/lib/lens.tsx       LensScene layout + Instrument/Roll/ReadoutRow (S7–S9)
src/lib/braid.tsx      Threads/Braid/Embers/Flash — S10/S11 continuity (S11 passes t+180)
src/lib/browser.tsx    BrowserPanel: chrome frame + panning screenshot (pan/panWindow props)
src/scenes/S01…S21     one file per scene
scripts/gen-score.ts   procedural WAV (run with plain `node` — Node 24 strips types natively)
public/fonts/          copies of app/fonts/*.woff2 · public/brand/ mark.png
public/shots/          real 2× site captures (see §4) · public/audio/score.wav (generated)
out/the-signal.mp4     the film · out/stills/ review frames + contact sheets
```

Commands (from `marketing/video/`): `npm run render` · `npm run studio` (port 3334) ·
`npm run gen:score` · `npx remotion still TheSignal out/f.png --frame=N`.

## 4. Site captures (how to reshoot after UI changes)

Shots in `public/shots/` were taken this session from a **production** server on :3000
(dev-indicator badge would leak into frames) at `--force-device-scale-factor=2`:

- `home.png` — `/?heroT=21.4` (frozen WebGL braid; needs `--enable-unsafe-swiftshader`)
- `rankings.png` — `/rankings` (real W28: VRT 49.1 …) window 1920×1900
- `stock-vrt.png` — `/stocks/VRT` window 1920×2200
- `run.png` — `/runs/67091fae-060c-4ebe-ac6c-1a9f1cb759e3` (the W28 count=8 run) 1920×2000

Headless-Edge recipe: `--headless=new --user-data-dir=<fresh temp dir>` (**without an isolated
profile Edge exits 0 and writes nothing** — singleton lock), `--virtual-time-budget=12000
--run-all-compositor-stages-before-draw --hide-scrollbars`. Pan targets live as `pan`/
`panWindow` props in S12/S13/S14 — display-px = source-px × (panelInnerWidth/3840).

## 5. Rendering on this machine (each of these failed first)

1. **Remotion's default Chrome Headless Shell download is unusable here** — it lives on
   storage.googleapis.com, which this network intermittently DNS-blackholes.
2. **Edge cannot render for Remotion.** Its headless is hollowed out on this build: DevTools
   launch exits code 0 instantly, both `--headless=old` and `=new` print nothing via CLI
   (`--screenshot` mode is the one thing that works, per §4).
3. Fix: system Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) +
   `Config.setChromeMode('chrome-for-testing')` (new-headless launch; old headless was removed
   from Chromium 132+).
4. **Remotion's render server port-scans from :3000** and will handshake the running MAG8
   server → "Does this look like a foreign page?" → `Config.setRendererPort(3333)`
   (+ studio 3334). All of this is already in `remotion.config.ts`.

## 6. Score

`scripts/gen-score.ts` synthesizes `public/audio/score.wav` (48k stereo 16-bit) from the same
`SCENES` table: 104 BPM soft-kick groove entering at S05, sonar pings aligned to the beam
passing the 8 chosen blocks, per-lens motifs, riser + boom + shimmer at the S10 fusion,
heartbeat thumps under S11, plotter ratchets/wire ticks/stamp thunks in the product chapter,
airy kickless white chapter, slot clicks + ignition impact at S18, A-major resolve + final
thump on the endcard. Measured −20.6 LUFS integrated, peak −3.5 dBFS — a deliberate underscore
bed. **To use licensed music: replace `public/audio/score.wav` (keep the filename), re-render.**
Re-cutting scene durations: edit `timeline.ts`, run `gen:score`, re-render — hits stay aligned.

## 7. Verification done

- ~40 stills reviewed across two passes; contact sheets in `out/stills/`.
- Bugs found and fixed: braid rendered dashed (each front segment's void underlay erased its
  neighbor — now all underlays draw before all gold strokes, `lib/braid.tsx`); S2 bubbles
  didn't bury the bar (added a 6-bubble late wave over center); S3 line 2 typed past its
  dissolve (base 1.35→0.95, can-drop retimed); S5 field nearly invisible (18px blocks,
  brighter); S6 field matched for continuity; S12 pan retargeted to end on rows 01–03;
  S17 GAP NOTED chip overflowed the card; S18 chip sized up, reel bounce made upward-only.
- Final: ffprobe (streams/duration), 1-per-3.3s motion contact sheets from the MP4 (all 21
  scenes flow, fade-out clean), EBU R128 on the score, leak grep over `src/` (0 hits).

## 8. Machine/repo state after this session

- **The dev server on :3000 was replaced with `next build` + `next start` (production)** for
  clean captures, and it is still running. To go back to dev: kill the port-3000 process
  (PowerShell `Get-NetTCPConnection`/`Stop-Process`) and `npm run dev`.
- Uncommitted: everything from before this session (all-time boards, brand, fonts) **plus**
  `marketing/video/` (node_modules/ and out/ are .gitignored inside it), `CLAUDE.md` state
  line, `HANDOFF` file. One-commit-per-phase is the repo convention — commit when ready.
- Memory twin updated both places (CLAUDE.md state + `mag8-project-state.md`).
- No mock/real pipeline runs were made; the DB was untouched (run id was scraped from
  `/rankings` HTML, not queried).

## 9. Not done / natural next steps

- **Vertical 9:16 short (V1–V4, 32s)** from the same storyboard — the component library makes
  this mostly re-composition work (new Composition + vertical layouts).
- Social encode (the master is ~7 Mbps; e.g. `ffmpeg -i the-signal.mp4 -crf 26 -preset slow`
  for a ~25 MB upload copy) and a poster frame (`--frame=3310` is the endcard).
- URL on the endcard + reshoot `public/shots/` once a deploy target exists (open item).
- Music swap if a licensed track is wanted; the procedural bed is intentionally subtle.
