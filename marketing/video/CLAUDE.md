# marketing/video — agent process rules (README.md = human-facing overview)

Standalone Remotion project (own package.json / node_modules; NOT part of the Next app build).
**Three product lines live here:** the launch film + lens shorts + fun campaign (hand-authored
scenes), and the DATA-DRIVEN CHART FORMAT (`src/charts/`) — see `CHARTS.md` for its engine, its
honesty gate and the traps already paid for, and the `viral-chart-protocol` for the procedure.
Everything here is white-label: film sources speak public lens vocabulary only.
**FORMULA.md (this dir) is the compounding owner rulebook** — every request the owner has made
about the videos (hooks, copy canon, read time, type size, contrast, fit, endcard contract),
provenance-tagged. Consult it BEFORE storyboarding and at QA; APPEND every new owner note to
its changelog the day it lands. This file = the physics; FORMULA.md = the taste.

## Hard render-model constraints

- Rendering = headless Chrome screenshotting EVERY frame, stitched by ffmpeg. All motion must be a
  pure function of `useCurrentFrame()` via `interpolate()`/`spring()` — use the `lib/anim.ts` wrappers.
  NEVER use CSS transitions, `@keyframes`, `requestAnimationFrame`, `setTimeout`/`setInterval`, or any
  wall-clock/ticker-driven animation: there is no wall clock at render time — they freeze or race.
  (If GSAP is ever adopted: build the timeline PAUSED and seek it to `frame / fps` on every frame;
  never let its ticker run. Not needed today — anim.ts covers current needs.)
- No `Math.random()` / `Date.now()` / `new Date()` anywhere in `src/`. Seeded randomness only:
  `anim.ts` `rnd()`/`rndIn()` (Remotion `random(seed)`). Score generators in `scripts/` are offline but
  keep them deterministic too (they use a seeded PRNG today) so a regen never silently changes audio.
- The encode path REUSES one DOM across sequential frames: every style must be valid at every frame.
  The Kinetic ghost-word bug was an invalid negative blur sticking in a reused DOM — clamped in
  `ui.tsx`. Fresh-DOM stills CANNOT reproduce this class; only encode-path frames can:
  `npm run stills -- <CompId> seq <from>-<to>`.
- All `@remotion/*` packages must be the SAME exact version (currently 4.0.486). Adding one:
  `npm i @remotion/<pkg>@4.0.486`; bump them together or not at all.
- `remotion.config.ts` (system Chrome path, `chrome-for-testing` mode, renderer port 3333, studio 3334)
  applies to the CLI ONLY. Programmatic renders (`scripts/stills.ts`) must pass
  `browserExecutable`/`chromeMode` explicitly — keep them in sync with the config file.

## Design system (tokens are law)

- `src/theme.ts` is the single source: palette `C` (mirrors `app/globals.css` — film and product are
  pixel-siblings), fonts `F` (vendored woff2 only — this network blackholes Google font hosts;
  new faces come from cdn.jsdelivr.net/fontsource, which resolves fine), `W`/`H`/`FPS`, and `SAFE`
  zones. New scenes import tokens; never inline hex or guess margins. `F.serif` (Libre Baskerville)
  and `F.hand` (Caveat) are episode-accent faces for the engine specials — scene-local flavor only;
  brand surfaces (desks, endcards, wordmark) stay on display/body/mono. Episode palettes (per the
  owner's 2026-07-09 creative-freedom note, FORMULA §H) are scene-local consts in the episode file
  (coldcase precedent) and every episode returns to house dark at the desk/endcard.
- GOLD (`C.confluence`) marks FINAL VERDICTS only and first appears at the fusion beat (S10 in the
  master). `C.macro` is copper for this reason. Same rule as the app.
- Type floors (post 2026-07-08 graded pass): `Chip` 25 / `Eyebrow` 26 are the smallest legal on-screen
  text; `Kinetic` defaults 84. Sizes in scenes are FINAL — the grade (≤32:+6 / 33–44:+5 / 45–68:+4 /
  ≥69:+0) is already baked into every scene file; NEVER re-apply it. Build text from the lib components
  (`lib/ui.tsx` Eyebrow/Chip/Roll/Kinetic, `lib/setpieces.tsx`, `shorts/vlib.tsx`, `fun/flib.tsx`)
  rather than ad-hoc styled divs.
- Safe zones: keep hero text/must-read UI inside `SAFE.portrait` (150/170/60 — TikTok/Reels/Shorts
  chrome) and `SAFE.landscape` (72/72/96) from `theme.ts`. Mono footers at 24px/0.12em tracking fit
  ~52 chars inside the 960px portrait safe width (chars × 0.6em + tracking) — MEASURE before writing;
  the 2026-07-09 pass shortened three footers that ran ~1030px wide.
- Contrast (2026-07-09 pass): text meant to be READ never sits in `C.dim` on the dark void (~3:1) —
  use `C.muted` (~4.9:1) or brighter. `C.dim` is reserved for state-based de-emphasis (skipped /
  pruned / inactive siblings of a lit element). On the white chapter, text uses `C.whiteInk` /
  `C.whiteMuted` only — mid-greys like the old `#9aa2b1` footnote fail on white (~2.4:1).
- Scout copy rule (owner, 2026-07-09): the scout is never just "a scout" — every scout mention
  carries the trillion-DNA framing (it hunts stocks with the DNA of trillion-dollar stocks, BEFORE
  they become trillion-dollar stocks). Canon: S05 "One scout hunts trillion-dollar DNA." + trait
  sub-line; V03 "First, a scout hunts / trillion-dollar DNA — / before the trillion."; V02 "One
  scout for trillion-dollar DNA."; thread labels TRILLION-DNA SCOUT (master braid) / TRILLION-DNA
  (portrait vbraid, longer collides with FUNDAMENTALS); S13 wire "trillion-DNA screen · 8 names".
- Motion grammar (`lib/anim.ts`): `pop()` = spring damping 12 / mass 0.7 / stiffness 130 for chips and
  glyph landings; `settle()` = 16 / 1 / 90 for big set pieces; `lerp()` is clamped by default. Specify
  motion numerically (frames, damping, px) — "nice entrance" is not a spec. Stagger related items a
  few frames apart rather than landing them simultaneously.
- Restraint: cap simultaneous movers at ~2–3 per beat. The usual failure mode is too much at once,
  not too little. Text-heavy beats hold ~0.5–0.7s longer than your first instinct (v1 viewer feedback).
- CHART FILMS are the exception to hand-authored timing: `src/charts/spec.ts` `DEFAULT_BEATS`
  drives the composition AND `scripts/gen-score-chart.ts`, and every figure on screen is READ
  from the frozen dataset rather than written into a scene. Their numbers come from
  `scripts/chart-fetch.ts` (the only thing in this project that touches the network) and must
  clear `scripts/chart-verify.ts` before a render — `scripts/render-charts.ts` enforces that
  order. Full rationale in `CHARTS.md`; do not add a chart without reading it.
- Timing single-source: `src/timeline.ts` (film), `src/shorts/timeline.ts`, `src/fun/timeline.ts` drive
  the compositions AND `scripts/gen-score*.ts`. Any re-cut ⇒ regenerate the matching score.
  `gen-score-fun.ts` accepts episode-id args to regenerate a subset (`node scripts/gen-score-fun.ts
  dnatest poker`); scores are seeded-deterministic so a full regen is byte-stable regardless.
- Every endcard closes with `WaitlistCta` (`lib/ui.tsx`) — "Join the email waitlist!" in big type
  (64px portrait / 56px master), ink + violet only. It is the one ask on every film; never drop it.

## Workflow gates (in order — full renders are the LAST step)

1. Storyboard/shot-list sign-off before code (`marketing/video-prompts.md` pattern) — checked
   against FORMULA.md first. Pacing and structure problems are cheapest to fix here.
2. Stills sweep, then READ the PNGs: `npm run stills -- <CompId>` (12 evenly spaced) or
   `npm run stills -- <CompId> 30,300,800` (exact frames). Output: `out/stills/<CompId>/`.
3. Encode-path check for DOM-reuse bugs: `npm run stills -- <CompId> seq 100-160`
   (sequential frames, one DOM, concurrency 1).
4. Leak gate: `npm run check:leak` — zero hits required before rendering or publishing. It walks `src/` AND `../manim/scenes`, and matches `.py` as well as the web extensions: a manim scene puts captions straight onto a frame, and the original walker saw neither that directory nor that extension. Proved by injection.
5. Full render (`npm run render` / `render:shorts` / `render:fun` / `render:charts`). A 30s@30fps
   short is 900 screenshots — don't iterate at this stage.
6. **Verify the ARTIFACT, not the still.** Extract frames from the finished mp4 and read them —
   `ffmpeg -ss <t> -i <file.mp4> -frames:v 1 -vf "crop=1080:80:0:1125,scale=2160:160" out.png`
   crops the axis strip at 2x. A fresh-DOM still is structurally incapable of reproducing the
   DOM-reuse class, and an encode-path sweep only covers the frames you chose: a duplicate React
   key minted at frame 20 and inherited for the rest of the run passed clean stills, a clean
   encode-path window at frames 300-312, and `chart-verify`, and was caught only by pulling
   frames out of a shipped mp4 (2026-09-07). Sample the OPENING as well as the end, and pull
   frames by INDEX (`-vf "select=eq(n\,30)"`) rather than by timestamp when a claim rests on a
   specific frame. Never predict what a frame contains from the revealed index alone: the axis
   window leads the data (`xSpan` floors it at 8% of the dataset), and guessing from the reveal
   produced a confident, wrong accusation about a peer's film this session.

Chart films insert one gate BEFORE stills: `npm run chart:verify` (0 FAIL required). It blocks
the window defect that gets charts in this genre fact-checked — a series that runs out of data
and stops climbing while its rivals keep going. `render:charts` re-runs it and refuses to render
on a FAIL. The same gate FAILS a chart spec that gives the hook, payoff or endcard beat any
frames: chart films are the race alone (owner rule, 2026-09-05). And they are filed apart from
the hand-authored films, into `out/charts/batch-NN/`, 25 per folder — one YouTube drag each;
`scripts/chart-out.ts` picks the folder, `npm run chart:made` prints the state.

The same gate FAILS a chart whose TITLE does not name its own declared `subject` (owner rule,
2026-09-07): the first text a viewer reads has to say what they are watching, so headlines lead
with the subject and the story follows it — "Life expectancy: / the gap that closed", not "The
gap that closed". Ids stay poetic; headlines say what the thing is. Changing a title or a
subtitle means a re-render, because both are baked into every frame.

Chart films also ship with PLATFORM metadata, because YouTube writes a title from the filename
and a description from the channel default if you let it. `npm run chart:platform` regenerates
`marketing/youtube-chart-upload-plan-2026-09-08.md` from the frozen datasets — every figure is
interpolated, any other numeral must be declared in that film's `claims`, and the generator runs
the leak pattern and the platform's own limits (title 100, description 5000, 15 hashtags, 500
characters of tags) before it writes. A new chart film needs an entry there or the generator FAILS.

Chart films are the one product line here that does NOT use the procedural score. They carry
the owner's licensed music (2026-09-07), muxed on after the render by `scripts/chart-music.ts`
at -14 LUFS with the video stream copied untouched; the chart `<Audio>` is unwired in
`Root.tsx` so the composition is silent and there is exactly one source of sound.
`render:charts` runs the scoring itself, so a new film cannot ship silent beside the rest —
nothing in a stills sweep or a frame check can see a missing sound track. A track is assigned
at random ONCE and recorded in `music/assignments.json`; a film that has one keeps it, because
a posted film must keep sounding like itself. See CHARTS.md for the three measurement traps
already paid for.

`scripts/stills.ts` pins renderer port 3335: the programmatic API defaults to :3000, which is the
app's own dev server, and the renderer then loads the WEBSITE and reports "not a valid Remotion
project".

Node prints a MODULE_TYPELESS_PACKAGE_JSON warning running `scripts/*.ts` — harmless, ignore.

## Manim — mechanism animations as assets (`../manim`)

ManimCE 0.19 in its own venv, NOT a second video pipeline. Scenes render to TRANSPARENT PNG frames
that a Remotion composition composites; the header, brand row, score and cut stay in Remotion.
Reach for it only when a beat works because a shape moves into another shape — the screen funnel,
the three lenses as a real set intersection, a DCF stream, a game-theory tree. Text, chips and
timing stay here.

**The transparency trap, measured:** `manim -t --format=webm` writes `yuv420p` with corner alpha
255 — no alpha, no warning, composites as a solid rectangle. `--format=mov` carries real alpha but
in qtrle, which no browser decodes. Transcoding MOV to VP9 or VP8 WebM produces `yuv420p` too:
both encoders LIST `yuva420p` and neither writes it, because WebM alpha needs a BlockAdditions
track this ffmpeg build does not produce. `--format=png` gives `rgba` with real alpha, ~12 MB for
233 frames at 1080x1920. `render.py` verifies the format, the corner alpha on three frames, and
that something was actually drawn — an empty scene passes a transparency check trivially.

Frames land in `public/manim/<Scene>/` with a `manifest.json` (frames, fps, duration) and are
gitignored. Type floors, contrast rules and safe zones from FORMULA.md apply to a manim frame
exactly as to a Remotion one. Full detail: `../manim/README.md`.

## Packages (all ^4.0.486) and when to reach for them

- `@remotion/transitions` — `<TransitionSeries>` + timing presets for scene cuts. The braid/vbraid
  hand-rolled crossfades predate it and stay; prefer TransitionSeries for NEW multi-scene comps.
- `@remotion/motion-blur` — `<Trail>`/`<CameraMotionBlur>` for fast movers (scream-flood-class
  entrances/exits). SELECTIVE use only: it multiplies per-frame render cost.
- `@remotion/animation-utils` — `makeTransform()`/`interpolateStyles()`; prefer over hand-concatenated
  transform strings in new code.
- `@remotion/shapes` + `@remotion/paths` — parametric SVG (grow-in shapes) + path measure/animate (draw-on).
- `@remotion/noise`, `@remotion/fonts` — already in use (textures, vendored font loading).
- Dev: `@remotion/bundler` + `@remotion/renderer` power `scripts/stills.ts`.
- Deliberately NOT adopted: `@remotion/{lottie,rive,three}` (no such assets), `@remotion/captions`
  (no voiceover — the score is instrumental), GSAP (see bridge note above), Onda/RemotionUI component
  libraries (the bespoke lib/ + vlib + flib set-piece system IS the house style), and the
  remotion-superpowers plugin (its voiceover/music/footage pipeline needs ElevenLabs/Suno/Pexels API
  keys — owner policy is ZERO API spend, subscription only).

## Ground truth

- Skill: `.claude/skills/remotion-best-practices` (repo root; installed from remotion-dev/skills via
  `npx skills add`) — consult it before reaching for a Remotion API; the surface evolves. Its generic
  layout guidance yields to the house tokens/floors above where they conflict.
- Remotion docs serve agent-clean markdown: append `.md` to any docs URL. Working prompt patterns:
  remotion.dev/prompts.
- License: Remotion is source-available — free for individuals and companies with <3 people; a paid
  company license is required at ≥3. Solo today; recheck if a team forms.
