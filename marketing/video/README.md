# The Signal — MAG8 launch film

A ~1:53 motion-design launch film for MAG8, implemented programmatically with
[Remotion](https://remotion.dev). It executes the 21-scene storyboard in
`marketing/video-prompts.md` ("The Signal", aside-style) natively — exact
design tokens from `app/globals.css`, the vendored brand fonts, the real
four-blade mark, and real product screenshots — instead of gen-AI clips.

## Output

- `out/the-signal.mp4` — 1920×1080 @ 30fps, H.264 + procedural score.

## Commands

```bash
npm install
npm run gen:score   # regenerate public/audio/score.wav from src/timeline.ts
npm run render      # render out/the-signal.mp4
npm run studio      # open Remotion Studio (port 3334) to scrub/iterate
npx remotion still TheSignal out/f.png --frame=1234   # one frame
```

## How it fits the repo

- **White-label safe**: the leak-probe grep runs clean over `src/` — public
  lens vocabulary only (scout / fundamentals / macro / consensus / compile /
  verify). Gold appears for the first time at the S10 fusion, per the brand
  rule (gold = verdicts only).
- **Screenshots** in `public/shots/` were captured from the live site with
  headless Edge at 2× (`/?heroT=21.4`, `/rankings`, `/stocks/VRT`,
  `/runs/<W28 run id>`). Re-shoot after UI changes; panning targets live in
  `S12_Leaderboard/S13_Mission/S14_Receipts` as `pan`/`panWindow` props.
- **Fonts** are copies of `app/fonts/*.woff2` (never fetched from Google).
- **Timing single source**: `src/timeline.ts` drives both the composition and
  `scripts/gen-score.ts`, so scene re-cuts keep the music aligned.
- **Score**: fully synthesized (104 BPM pulse, fusion impact, white-chapter
  air, endcard resolve), −20.6 LUFS integrated. It's a bed — swap
  `public/audio/score.wav` for a licensed track any time; keep the filename.
- **Render browser**: system Chrome via `chrome-for-testing` mode
  (`remotion.config.ts`) because this network intermittently blackholes
  storage.googleapis.com (no headless-shell download) and Edge's headless is
  hollowed out. Renderer port pinned to 3333 (MAG8 owns 3000).
- **No URL on the endcard** — deploy target undecided; add it in S21 when it
  ships. Endcard closes on "RESEARCH, NOT INVESTMENT ADVICE".

## Numbers caveat

"90.3" is the seeded demo's hero score (storyboard §Numbers caveat); the live
W28 board tops out at VRT 49.1 with zero confluence — the film is stylized,
the product screenshots are real.
