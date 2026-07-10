# marketing/video — agent process rules (README.md = human-facing overview)

Standalone Remotion project (own package.json / node_modules; NOT part of the Next app build).
Everything here is white-label: film sources speak public lens vocabulary only.

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
  pixel-siblings), fonts `F` (vendored woff2 only — this network blackholes Google font hosts),
  `W`/`H`/`FPS`, and `SAFE` zones. New scenes import tokens; never inline hex or guess margins.
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
- Timing single-source: `src/timeline.ts` (film), `src/shorts/timeline.ts`, `src/fun/timeline.ts` drive
  the compositions AND `scripts/gen-score*.ts`. Any re-cut ⇒ regenerate the matching score.
- Every endcard closes with `WaitlistCta` (`lib/ui.tsx`) — "Join the email waitlist!" in big type
  (64px portrait / 56px master), ink + violet only. It is the one ask on every film; never drop it.

## Workflow gates (in order — full renders are the LAST step)

1. Storyboard/shot-list sign-off before code (`marketing/video-prompts.md` pattern). Pacing and
   structure problems are cheapest to fix here.
2. Stills sweep, then READ the PNGs: `npm run stills -- <CompId>` (12 evenly spaced) or
   `npm run stills -- <CompId> 30,300,800` (exact frames). Output: `out/stills/<CompId>/`.
3. Encode-path check for DOM-reuse bugs: `npm run stills -- <CompId> seq 100-160`
   (sequential frames, one DOM, concurrency 1).
4. Leak gate: `npm run check:leak` — zero hits required over `src/` before rendering or publishing.
5. Full render (`npm run render` / `render:shorts` / `render:fun`). A 30s@30fps short is 900
   screenshots — don't iterate at this stage.

Node prints a MODULE_TYPELESS_PACKAGE_JSON warning running `scripts/*.ts` — harmless, ignore.

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
