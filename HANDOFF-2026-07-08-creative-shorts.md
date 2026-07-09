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

Commit: `296c280` — "film: intro rework (huge question → shrink → scream-flood)
+ four fun campaign shorts" (20 files, +2385/−78; mp4s/WAVs gitignored &
reproducible via `gen:score*` + `render*` scripts).

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
- **ffprobe on all 8 files (post-render): exact frame counts** — the-signal
  3684 (1920×1080, 102MB), short-fundamentals 2364 (67MB), short-macro 2514
  (71MB), short-consensus 2385 (68MB), fun-eightball 861 (25MB),
  fun-groupchat 822 (25MB), fun-gate 894 (26MB), fun-redflags 864 (25MB) —
  all 30fps, AAC audio, every count matches its timeline sum. Full queue
  (master + 3 lens + 4 fun) rendered sequentially in one pass, exit 0.
- **Encoded-mp4 spot frames** (`out/stills/enc/`, extracted with ffmpeg
  `select='eq(n,N)'`): master f80 big-question hold + f332 flood peak;
  short-macro f70 confirms the retimed spine in a second lens short;
  fun-eightball f192 "REPLY HAZY" solid in the window; fun-gate f270 veto
  ✕ + "F-SCORE 2 / 9" reason chip readable with the extended hold. All as
  designed in the encoded output, not just the compositions.

## 5. Render pipeline (unchanged)

System Chrome via `chrome-for-testing`, rendererPort 3333 (SERIALIZES all
renders/stills — never two at once), headless-shell download DNS-blackholed.
Full queue (master + 3 lens + 4 fun) ≈ 70–90 min. ffmpeg `select='eq(n,N)'`
verifies encoded output; `remotion still` verifies compositions.

## 6. Hook rework (follow-up, same session date, later)

Feedback: viewers can't tell the fun shorts are about **stocks** from the
first seconds. Fix: every hook now names real mega-cap tickers (safe,
neutral/flattering framings only — nobody scores or vetoes a real company)
and/or says "stock" outright, inside the first ~1s. Videos stay ~90%
identical: same scene tables (zero duration changes), same jokes, desks,
endcards; only first-scene content (+2 tiny score cues) changed. One shared
campaign idea: *you know the famous winners — this is about the next one.*

- **flib**: `Redact` gains `cash` prop (glowing `$` prefix → bars read as a
  ticker at a glance); `MiniRow` uses it.
- **eightball**: ask-chip now cycles `$NVDA` (f10) → `$TSLA` (f42) → $-redact
  (f72) in a fixed 195px slot (violet mono, swap ticks in score); E2's static
  chip = same $-redact slot so the cut is invisible. Footer → "STOCK PICKING ·
  THE TRADITIONAL METHOD".
- **groupchat**: msgs 1–2 → "missed $NVDA. missed $TSLA 😭" / "NOT missing
  the next one."; ticker bubble gains `pre` lead-in "found it:" (+ $-redact).
  Other 8 messages, all timings/reactions untouched.
- **gate**: headline → `Everyone in line is\n“the next NVDA.”` (delay 46→26,
  violet accent on NVDA); queue chips arrive earlier (18+i·7, score pops
  retimed 44+i·9→18+i·7… i.e. [18,25,32,39,46]); TickerChip = $-redact at
  scale 0.8 (0.95 would overlap the 185px queue pitch with the $ added).
- **redflags**: eyebrow → "STOCK RED FLAGS · A FIELD GUIDE" (all 3 swipe
  scenes); profile-1 sub → `SMALL CAP · CALLS ITSELF “THE NEXT TSLA”`; card
  names $-redacted.

Verified: `tsc --noEmit` clean; scores regenerated (same lengths); leak grep
over `src/ scripts/` **0 hits** (tickers aren't in the banned set); 11 hook
stills reviewed (`out/stills/hk-*`): $NVDA/$TSLA/$-redact chip states + E2
continuity, chat 3-message arc, gate line+$-queue+veto-chip readability,
redflags header/card/sub. All four re-rendered (same frame counts as §4) +
encoded spot frames checked.

**Found & fixed while spot-checking the encode — Kinetic ghost words
(latent, ALL films):** encoded gate frames showed single words of the
headline heavily blurred (~3px) for ~0.5s stretches ("is" at n≈74–76, "in"
at n≈89–91) while `remotion still` at the same frames was crisp. Root cause:
`Kinetic` set `filter: blur(${(1-s)*5}px)` off a raw spring — on overshoot
(s>1) that emits a NEGATIVE blur radius, which is invalid CSS; the video
renderer's tabs reuse the DOM across queued frames, so the invalid write is
rejected and the *previous* (possibly mid-rise, large) blur sticks until the
oscillation next dips below 1. Stills render one frame per fresh page →
never affected; which words stick is queue-timing-dependent → capricious
(prior sessions' spot checks were clean by luck). Fix in `src/lib/ui.tsx`:
`blur(${Math.max(0, 1 - s) * 5}px)` — invalid values can no longer be
emitted, verified by full re-render + re-extracting the exact offending
frames. NOTE: the-signal + the three lens shorts were rendered with the
buggy Kinetic and may carry transient ghost words — re-render them whenever
convenient to pick up the fix (compositions unchanged otherwise).

## 7. Text-size pass (ALL 8 films, same session, later still)

Feedback: small text is hard to read in short-form. Applied a graded bump —
readability-first on the smallest classes, barely-there on display text:
**≤32px → +6 · 33–44 → +5 · 45–68 → +4 · ≥69 unchanged** (`fontSize: N`,
`size={N}` props, and bubble-spec `size:` fields; 241 automated rewrites via
one-shot codemod, plus component defaults: Eyebrow 20→26, Chip 19→25,
lens `Roll` 30→36, vlib SceneTitle 64→68).

Containers retuned so nothing clips/wraps ugly (the "surroundings" work):
- groupchat bubble maxWidth 660→750; 8-ball answer window 210→244;
  redflags card 820→890 (sub pinned 22px nowrap — 26 wrapped in the
  642px name column); AskChip pill text 45/47px in the same 195px slot.
- `Roll` is now `whiteSpace: nowrap` (VF2's "8 / 9" wrapped mid-readout);
  VF2 veto note wraps intentionally (maxWidth 620, flex-end row).
- VM2 MeterRow label columns 14→20 / 24→34; VM4's first point label
  anchors `start` +16px so "45%" clears the y-axis ticks.
- S12: docked 90.3 now lands right-aligned with rows 2/3 (numX −36, scale
  45/236 — was −96/40: glyphs glued into the number after the bump).
- S13 wire: fontSize 23, tag column minWidth 150→180 ("fundamentals" was
  overrunning it), slice(-11)→slice(-7) so wrapped rows can't overflow
  the 636px panel.
- BigQuestion→pill handoff retuned for the 41px pill text (was 36): S01
  target x −174→−134 scale 41/150; V01 x −142→−110 scale (41·0.82)/126;
  SearchBar cursor 40→45.

Verified: tsc clean; leak grep 0; ~35 stills across all 8 comps (masters
S01/S02/S12/S13/S14/S19/S20/S21, lens VF1-5/VM2-5/VC2-4 + spine/receipts/
endcard, fun hooks/desks/cards) — every finding above came out of that sweep
and was re-stilled after its fix. All 8 re-rendered (frame counts unchanged;
scores untouched — no timeline edits) + encoded spot checks.

## 8. Open / next

- Social encodes on posting day (`ffmpeg -crf 26 -preset slow`, ~20MB);
  poster frames: fun endcards sit in the last ~4s of each file.
- Speedrun + tier-list shorts are scoped and cheap to add (see §3 pattern).
- Email capture still stores-only; deploy target still undecided (no URL on
  endcards until it ships).
