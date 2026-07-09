# Handoff — fun campaign wave 2 (four new episodes) + waitlist CTA on every endcard (2026-07-08, late)

## 1. What was asked

1. Read the recent handoffs; build **4 more original fun creative marketing
   videos** — no re-treads of the four shipped formats. Taste signal from the
   owner: groupchat #1, redflags/eightball #2, gate least (dialogue/social
   comedy > procedural bits).
2. **Every video's conclusion** gets big text: **"join the email waitlist!"**
3. Use everything available and free to improve motion/visual quality
   (no external paid APIs — ZERO-spend policy stands; everything renders
   locally through the native Remotion pipeline).

## 2. The four new episodes (all 1080×1920 @30, in `src/fun/`)

| id | file | ~len | format | the turn | desk read |
|---|---|---|---|---|---|
| `naturedoc` | `out/fun-naturedoc.mp4` | 29.8s (894f) | Attenborough nature doc | "Herds aren't research." | ▲▲▲ 90.3 CONFLUENCE |
| `speedrun` | `out/fun-speedrun.mp4` | 30.0s (900f) | any% speedrun HUD | "Research isn't a race." | ▲▲▲ 90.3 + "13 MINUTES · EVERY CHECK · ON PURPOSE" |
| `replay` | `out/fun-replay.mp4` | 30.0s (900f) | sports broadcast + instant replay | "The pros study the tape before they play." | ▲▲▲ 90.3 + "EVERY VERDICT KEEPS ITS RECEIPTS" |
| `coldcase` | `out/fun-coldcase.mp4` | 29.8s (894f) | true-crime evidence board | "Read the filings first." | **▼ ─ ▼ 19.3 — the campaign's first FAIL desk** + "WOULD HAVE FAILED THE GATE" chip, "CASE CLOSED IN 13 MINUTES" |

Scene tables in `src/fun/timeline.ts` (same single-source contract); scenes in
`src/fun/scenes/{naturedoc,speedrun,replay,coldcase}.tsx`; scores appended to
`scripts/gen-score-fun.ts` (savanna crickets/stampede toms/record-scratch;
chiptune arps/split dings/sad-wah slam; stadium walla/buzzer/replay jingle;
noir heartbeat/typewriter/string stings — plus a `dark` minor-chord variant of
`deskCues` for the coldcase FAIL). `Root.tsx` registers `Fun-Naturedoc/-
Speedrun/-Replay/-Coldcase`; `render:fun` now renders all eight.

Episode beats (for future edits):
- **naturedoc**: N1 habitat (silhouette + phone glow that turns red) → N2
  stampede of candle-critters behind a glowing $-redact alpha, `Trail` motion
  blur, "All of them chasing 'the next $NVDA.'" → N3 the cliff (they tip over
  one by one; he follows; freeze-frame + white border; "Magnificent." /
  "Devastating.") → N4 desk → N5 endcard "THE HERD IS NOT A SOURCE".
- **speedrun**: SP1 title + WORLD RECORD ATTEMPT + RULES: NO RESEARCH ALLOWED
  + 3-2-1-GO → SP2 clock at 3.1× with seven splits (SEE TRENDING $-redact;
  CHECK THE FILINGS — SKIPPED strikethrough; BUY THE TOP "BEST SEGMENT") →
  0:31.07 slam, NEW PERSONAL BEST stamp, PORTFOLIO: REKT, confetti through
  `Trail` → SP3 deadpan → SP4 "CATEGORY: 100% · EVERY CHECK" desk → SP5
  endcard "SPEEDRUNS ARE FOR GAMES".
- **replay**: RP1 LIVE bug + FRIDAY NIGHT STOCKS scorebug (RETAIL 0 — MARKET
  3) + line draw via `evolvePath`, dot rides `getPointAtLength` → RP2 sprint
  (Trail), BUY flag plants at the exact apex, crash, buzzer, scorebug flips
  MARKET 4 → RP3 INSTANT REPLAY banner wipe, 0.25× zoom, telestrator circle +
  arrow draw-on (teal), scanlines → RP4 desk → RP5 endcard "WATCH THE TAPE
  FIRST". Commentary = alternating PLAY-BY-PLAY (violet) / COLOR (copper)
  lower-thirds.
- **coldcase**: K1 manila folder slap + typewriter CASE #4,721 + CONFIDENTIAL
  stamp (paper palette lives only inside this episode; endcard returns to
  house dark) → K2 polaroid board (TIP → CHART → BUY → BAG −84%) joined by
  red string drawn with `evolvePath`, Ken-Burns creep → K3 the filing sheet
  (F-SCORE 2/9 · GOING CONCERN · NET DILUTION) + flashlight sweep +
  "The evidence was public the whole time." → K4 FAIL desk → K5 endcard
  "DON'T BECOME A CASE FILE".

Cashtag discipline (handoff §6 rules hold): the only real ticker is
naturedoc's herd line — *chasing* "the next $NVDA" (aspirational/flattering,
claim attaches to the herd). Everything traded/scored/vetoed stays $-redacted.
Hooks read "STOCK" inside the first second via eyebrows/titles in all four.

## 3. Waitlist CTA — every endcard, all 12 films

`WaitlistCta` (new, `src/lib/ui.tsx`): "Join the **email waitlist!**" — 700
display, ink + violet accent, spring-in, 430px underline sweep, recurring soft
glow pulse. Gold untouched (verdict-only rule).

- `FunEndcard` (flib): CTA at f86; endcard scenes 150→**168f** (all EIGHT fun
  timelines) so it gets read time; disclaimer shifted to f104–120, fade
  155–168; endcard score resolve gained a CTA chime + closing kick.
- `V13_Endcard` (lens shorts): CTA at f90; V13 165→**183f** in
  `src/shorts/timeline.ts`; V13 score cues extended to match. New totals:
  fundamentals 2382f / macro 2532f / consensus 2403f (+18 each).
- `S21_Endcard` (master): CTA at f92 size 56 between tagline and disclaimer —
  **no length change** (3684f stands, master score untouched).

## 4. New packages actually used (all @4.0.486, installed earlier tonight)

- `@remotion/motion-blur` `<Trail>` — naturedoc stampede + falls, speedrun
  confetti, replay sprint.
- `@remotion/paths` `evolvePath`/`getLength`/`getPointAtLength` — replay price
  line + telestrator circle/arrow, coldcase red string.
- `@remotion/noise` `noise2D` — phone flicker, dust drift, confetti sway.
- (`@remotion/transitions`/`animation-utils`/`shapes` installed + documented,
  not needed by these four.)

## 5. Verification (per marketing/video/CLAUDE.md gates)

- `tsc --noEmit` clean; `npm run check:leak` **0 hits** (58 files).
- Scores regenerated deterministically: 8 fun WAVs (29.8–30.5s) + 3 short WAVs
  (+0.6s each); master WAV untouched.
- **~40 stills read** across the four comps + retrofitted endcards. Found &
  fixed from stills: N2 herd too sparse/fast (11 critters, spacing 58, linear
  run [24,200] travel 2570 — pack now on-frame through the $NVDA caption);
  RP3 INSTANT REPLAY banner parked on screen (sweep end 1300→1740 = fully
  exits); coldcase K3 white-on-cream redact invisible (ink-on-paper bars);
  WaitlistCta 56→64px (portrait) after eyeballing.
- **Encode-path seq checks** (`npm run stills -- <comp> seq a-b`, concurrency
  1 DOM-reuse): Fun-Speedrun 420–448 (slam/stamps/Trail confetti) and
  Fun-Coldcase 480–516 (Kinetic + TypeOn + paper) — no stuck styles, final
  frames crisp. The ghost-word class stays dead.
- **Full 12-render queue COMPLETE (exit 0)**, serialized on port 3333; lens
  shorts + master picked up the Kinetic ghost-word fix. **ffprobe counts all
  exact**: fun 879/840/912/882 (originals +18) + 894/900/900/894 (new four),
  shorts 2382/2532/2403, master 3684 — 1080×1920 portrait / master 1920×1080,
  sizes 23–53MB fun, 68–72MB shorts, 102MB master. **Encoded spot frames**
  (`out/stills/enc/`: naturedoc-cta-830, replay-tele-500, vf-cta-2295,
  master-cta-3565, extracted with ffmpeg `select='eq(n,N)'`): waitlist CTA
  settled + underline swept in portrait AND landscape encodes; replay
  telestrator circle/arrow clean with the banner fully exited. All verified
  in the encoded output, not just the compositions.

## 6. Open / next

- Post-render: ffprobe counts + encoded spot frames (ffmpeg `select=`) on the
  new four; social encodes on posting day.
- Tier-list episode still scoped in the backlog (brainstorm leftover); the
  four-scene + score-block pattern extends in an afternoon.
- Email capture still stores-only — the CTA points at a waitlist the site
  collects but doesn't yet send to; deploy target still undecided (no URL on
  endcards).
