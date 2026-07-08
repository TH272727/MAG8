# The Signal — MAG8 launch film + lens shorts + fun campaign

A ~2:03 motion-design launch film for MAG8, three vertical lens episodes, and
four fun meme-format campaign shorts, implemented programmatically with
[Remotion](https://remotion.dev). The film executes the 21-scene storyboard in
`marketing/video-prompts.md` ("The Signal", aside-style) natively — exact
design tokens from `app/globals.css`, the vendored brand fonts, the real
four-blade mark, and real product screenshots — instead of gen-AI clips.

**Intro (2026-07-08 rework):** every film opens on the question popping HUGE
(two lines @150px master, three lines @126px portrait, violet "stock?"),
holding ~2.4–3.2s for read time, shrinking down into the search pill, and
only THEN the screaming flood — conflicting hype/panic bubbles, screen shake,
and a synthesized crowd ("walla") crescendo in the score.

## Output

- `out/the-signal.mp4` — 1920×1080 @ 30fps, H.264 + procedural score.
- `out/short-fundamentals.mp4` — 1080×1920 @ 30fps, ~73s. Full MAG8 story +
  a deep chapter on the Fundamentals lens (ledger/tape/quality gauge,
  Piotroski F with the ≤3 auto-veto, Altman-Z zones, the value-trap mesh,
  reverse-DCF expectations gap, bear/base/bull scenario ladder + sources).
- `out/short-macro.mp4` — 1080×1920 @ 30fps, ~78s. Full story + the Macro
  Asymmetry game-theory chapter: player cards scored M×E×C
  (Mass · Energy · Coordination) with the weighted formula, the
  Mass×Coordination player map (dot size = Energy — the product's own
  instrument), the full 21-branch path tree with per-leaf probabilities and
  the lit equilibrium line (P=0.62), 3/6/12/24-month horizon fan, asymmetry
  dial, entry window, and the falsification kill switch.
- `out/short-consensus.mp4` — 1080×1920 @ 30fps, ~73s. Full story + the
  Street Consensus chapter: eight verified desk cards (stance/target/date),
  targets collapsing into the consensus band (low/median/high/spread), bull
  vs bear cases side by side, and the >20% divergence flag.

Every short covers the whole pipeline (hook → wordmark → scout → blind
lanes → its lens deep-dive → fusion → verdict board → real UI receipts →
endcard); the middle chapter is what changes.

### Fun campaign (meme-format, ~27–30s each, 1080×1920)

Attention-catchers that hand off to the brand: a joke format up front, the
deadpan instrument voice for the turn, the standard endcard close (gag chip +
"RESEARCH, NOT INVESTMENT ADVICE"). Source in `src/fun/` (own timeline +
`scripts/gen-score-fun.ts`, same single-source timing contract).

- `out/fun-eightball.mp4` — **"Not a magic 8-ball."** The name pun: shake the
  toy, get "REPLY HAZY" three times, trash it, meet the three-lens desk
  (chips stamp ▲▲▲ → gold 90.3 + CONFLUENCE).
- `out/fun-groupchat.mp4` — **"The group chat found a stock."** Eleven
  escalating messages ("my uber driver owns it" → "DOESN'T MATTER"), hard cut
  to black: "Your group chat has eight opinions." → "Enthusiasm isn't
  evidence." → the desk answers.
- `out/fun-gate.mp4` — **"The Gate."** Velvet rope + automatic vetoes: five
  redacted tickers approach, scanner sweeps, two pass, three get stamped
  (F-SCORE 2/9 · DISTRESS ZONE · SERIAL DILUTION). "The gate doesn't argue.
  It checks." Passing only earns a scoring (73.9 / 69.5 rows).
- `out/fun-redflags.mp4` — **"Red flags."** Dating-app format for value
  traps: two horror profiles swiped left (NOPE), the boring-good one gets
  "WORTH A LOOK" — then "One good profile isn't a verdict." and an honest
  mixed read (▲ ─ ▲, 73.9, no confluence).

## Commands

```bash
npm install
npm run gen:score          # regenerate public/audio/score.wav from src/timeline.ts
npm run gen:score:shorts   # regenerate public/audio/score-{fundamentals,macro,consensus}.wav
npm run gen:score:fun      # regenerate public/audio/score-fun-{eightball,groupchat,gate,redflags}.wav
npm run render             # render out/the-signal.mp4
npm run render:shorts      # render all three vertical lens shorts
npm run render:fun         # render all four fun campaign shorts
npm run studio             # open Remotion Studio (port 3334) to scrub/iterate
npx remotion still Short-Macro out/f.png --frame=1200   # one frame of a short
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
  `scripts/gen-score.ts`, so scene re-cuts keep the music aligned. The shorts
  mirror the contract: `src/shorts/timeline.ts` drives the three `Short-*`
  compositions and `scripts/gen-score-shorts.ts`.
- **Pacing rule (2026-07-08)**: text-heavy beats hold ~0.5–0.7s longer than
  their first cut so lines can actually be read — keep that bias when
  re-cutting (viewer feedback on v1).
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
