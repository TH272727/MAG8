# Handoff — intro rework (all 4 films) + four fun campaign shorts (session 2026-07-08 evening)

**Deliverables (all in `marketing/video/out/`):**

| File | Format | Length | Story |
|---|---|---|---|
| `the-signal.mp4` (re-render) | 1920×1080 @30 | 2:02.8 (3684f, +42f) | intro rework |
| `short-{fundamentals,macro,consensus}.mp4` (re-renders) | 1080×1920 @30 | +4.0s each (V01 180→300f) | intro rework |
| `fun-eightball.mp4` **NEW** | 1080×1920 @30 | 28.7s (861f) | "Not a magic 8-ball." |
| `fun-groupchat.mp4` **NEW** | 1080×1920 @30 | 27.4s (822f) | the group chat meltdown |
| `fun-gate.mp4` **NEW** | 1080×1920 @30 | 29.8s (894f) | bouncer / automatic vetoes |
| `fun-redflags.mp4` **NEW** | 1080×1920 @30 | 28.8s (864f) | dating-app value traps |

## 1. What was asked

1. **Intro rework on the existing 4 videos:** make "the next trillion-dollar
   stock?" LARGER, pop out more, read longer, then become smaller, and THEN
   get filled with the noise of people screaming different comments.
2. **Brainstorm fun/creative marketing ideas** (move away from formal) and
   **build 3–4 new short-form videos**.

## 2. Intro rework (Part A)

New shared set-piece `BigQuestion` in `lib/setpieces.tsx`: words pop in huge
(Kinetic + spring), the block looms (scale 1→1.045) during a long hold, then
shrinks/translates down INTO the search pill with blur-masked crossfade (the
pill's `done` text takes over mid-motion — line-count change is invisible
under motion+blur at ~0.24 scale).

- **S01_Search** (master): two lines @150px, violet accent on "stock?";
  hold f14–116 (~3.2s); shrink f116–146; pill appears f130; lone-bar breath
  f146–192. Scene 150→**192f** (`src/timeline.ts`, total 3684f).
- **S02_Noise** (master): 8 new screaming bubbles (26 total — now mixed
  panic/hype: SELL EVERYTHING / it's over / PUMP IT / GET IN NOW / obvious
  scam / you're all wrong / 10x by Friday / told you so), faster pile-in
  (delay 8+order·5), growing shake (amp→5px), creep 1→1.07. The new bubbles
  also tumble into S03's can automatically (shared `BUBBLES`).
- **V01_Hook** (all three lens shorts): three lines @126px; hold f14–88;
  shrink f88–114 into the 0.82-scale pill; flood f128+ (4 new screams, 18
  bubbles, shake); can f190; thesis f232; fade f290. Scene 180→**300f**
  (`src/shorts/timeline.ts`).
- **Audio:** new `walla()` synth-crowd helper in BOTH `gen-score.ts` and
  `gen-score-shorts.ts` (also copied into `gen-score-fun.ts`) — overlapping
  voice-ish chirp clusters (fundamental + formant partials, random pitch
  contours), density/level crescendo, a few "shouts" cutting through. Placed
  under S02 (4.2s) and V01's flood (2.5s). Plus: riser+kick when the question
  pops, descending whoosh at the shrink. Keeps the no-samples contract — the
  score stays licensed-track-swappable.
- All downstream scene starts shift automatically (both timelines drive
  compositions AND scores); scene-internal keys are Sequence-relative so no
  other scene files changed. V10/V11 braid `T_OFF` untouched.

## 3. Fun campaign (Part B) — brainstorm → four built

Brainstormed formats: magic-8-ball name pun; group-chat meltdown; bouncer/
velvet-rope gate; dating-profile red flags; stock-research speedrun (HUD +
splits); S/A/B/F tier list where the machine re-sorts a vibes hand; game-show
"three isolated booths, one answer"; autocomplete horror. Built the first
four (name pun = strongest brand bit; chat = most relatable; gate = the real
auto-veto invariant dramatized; red flags = value-trap education in a meme).
Speedrun + tier-list are the best next candidates — the `src/fun/` pattern
(scene table + scene file + score block) extends in an afternoon.

Structure (all in `marketing/video/src/fun/`):
- `timeline.ts` — FUN scene tables (single timing source, same contract).
- `flib.tsx` — `DeskStamps` (three lens chips stamp in → gold score +
  optional CONFLUENCE chip + mono footnote; `glyphs`/`score`/`confluence`
  props), `MiniRow` (simple board row), `Redact`, `FunEndcard` (V13 layout
  with a gag chip instead of the lens chip).
- `scenes/eightball.tsx` — E1 ask-chip + glossy ball drops in ("THE
  TRADITIONAL METHOD") → E2 three shake-rattle-answer cycles (REPLY HAZY /
  ASK AGAIN LATER / SIGNS POINT TO YES 🚀; "HELPFUL." deadpan) → E3 ball
  rolls into the TrashCan, "Stop asking toys." → E4 "MAG8 is not a magic
  8-ball." + DeskStamps ▲▲▲ 90.3 CONFLUENCE → E5 endcard "NO HAZY ANSWERS".
- `scenes/groupchat.tsx` — 11 messages accelerate (typing dots, avatars,
  emoji reactions, redacted ticker + 🚀🚀🚀, "wait what do they even do" /
  "DOESN'T MATTER"), shake + walla → hard cut: "Your group chat has eight
  opinions." → "Enthusiasm isn't evidence." → DeskStamps → endcard "GROUP
  CHATS ARE FOR MEMES".
- `scenes/gate.tsx` — THE GATE eyebrow + red rope draw-on + 5 bobbing
  redacted chips → five scan cycles (violet beam, "CHECKING F · Z ·
  DILUTION"): pass ✓ slides through dim, veto ✕ + reason chip slams
  (F-SCORE 2/9 · DISTRESS ZONE · SERIAL DILUTION; vetoes hold ~24f longer
  than passes so reasons read), live IN/OUT counter → "The gate doesn't
  argue. It checks." → B4 two MiniRows 73.9/69.5 "Getting in only earns a
  scoring." → endcard "NO VIBES PAST THIS POINT".
- `scenes/redflags.tsx` — swipe cards ("RED FLAGS · A FIELD GUIDE"): profile
  1 (loves: dilution / "adjusted" everything / bio "this time it's
  different.") NOPE-stamped, swiped left; profile 2 (+340% THIS MONTH,
  insiders selling, −$2.1B FCF, going-concern) swiped harder; profile 3
  (BORING. IN A GOOD WAY. — F-Score 8/9, FCF+, insiders buying) "WORTH A
  LOOK" swiped right + green burst, "FINALLY." → "One good profile isn't a
  verdict." + DeskStamps **▲ ─ ▲ 73.9 no-confluence** (honest read; matches
  the 73.9 row's glyphs in V11) → endcard "SWIPE LESS. VERIFY MORE."
- `scripts/gen-score-fun.ts` — per-short scores: 8-ball rattles + wah-wah
  non-answers; chat pop accelerando → SILENCE as the cut lands (the joke);
  gate club four-on-floor + scan sweeps + veto buzz-cluster; redflags sour
  minor-2nd clashes per 🚩, major ticks per ✓, chime on the right-swipe;
  shared DeskStamps cues (3 thunks → riser → impact → groove out) + the
  standard endcard resolve. `Root.tsx` registers `Fun-*` comps; package
  scripts `render:fun` / `gen:score:fun`.

Copy discipline: fun front half, deadpan instrument voice for the turn, gold
only on verdict numbers, lens PUBLIC labels only, every endcard keeps
"RESEARCH, NOT INVESTMENT ADVICE". No URLs (deploy target still undecided).

## 4. Verification

- `npx tsc --noEmit` clean (fun scenes included via `src` include).
- **Leak grep** (white-label gate) over `src/ scripts/`: **0 hits**.
- **~30 stills reviewed** (`out/stills/in-* fe-* fg-* fb-* fr-*`): master
  big-question hold/shrink/pill handoff/flood-peak; portrait hold/pill+flood/
  can/thesis; 8-ball ask/shake/toys/desk/endcard; chat meltdown; gate
  queue/pass/counter/board; redflags NOPE/keeper/mixed-desk. Bug found &
  fixed from stills: gate veto reason-chips exited too fast to read →
  verdict at s+34, veto exit pushed to [s+58, s+74] (pass exit unchanged),
  score cues moved to match.
- Encoded-mp4 spot frames + ffprobe: see §5 (post-render).

## 5. Render pipeline (unchanged)

System Chrome via `chrome-for-testing`, rendererPort 3333 (SERIALIZES all
renders/stills — never two at once), headless-shell download DNS-blackholed.
Full queue (master + 3 lens + 4 fun) ≈ 70–90 min. ffmpeg `select='eq(n,N)'`
verifies encoded output; `remotion still` verifies compositions.

## 6. Open / next

- Social encodes on posting day (`ffmpeg -crf 26 -preset slow`, ~20MB);
  poster frames: fun endcards sit in the last ~4s of each file.
- Speedrun + tier-list shorts are scoped and cheap to add (see §3 pattern).
- Email capture still stores-only; deploy target still undecided (no URL on
  endcards until it ships).
