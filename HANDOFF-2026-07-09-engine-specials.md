# Handoff — four ENGINE SPECIAL films: trillion-DNA scout ×2 + Game Theory ×2 (2026-07-09, late)

## 1. What was asked

Owner: make **4 marketing videos about the scout** (finding stocks that have the DNA of
trillion-dollar stocks *before* they became trillion-dollar stocks) **and the game theory
engine** — "by far the most interesting, original, unique features that MAG8 has that other
tools don't." Read the handoffs + FORMULA.md first; **creative freedom granted**: any free
open-source tools, "no need to stick to the same colors, designs, visuals, etc."

## 2. The four films (all 1080×1920 @30, `src/fun/` episodes → `out/`)

| id | file | ~len | engine | format | the turn | desk foot |
|---|---|---|---|---|---|---|
| `dnatest` | `out/fun-dnatest.mp4` | 38.4s (1152f) | scout | genome lab / ancestry-kit reveal | "A match opens a case." | MATCHED · THEN ATTACKED BLIND · THEN SCORED |
| `yearbook` | `out/fun-yearbook.mp4` | 38.2s (1146f) | scout | halftone yearbook, "most likely to…" | "Superlatives don't score." | VOTED IN · THEN VERIFIED · THEN RANKED |
| `poker` | `out/fun-poker.mp4` | 43.4s (1302f) | game theory | felt-table top-down, pot-committed | "Game theory plays it in the open." | SEATED BY THE TRILLION-DNA SCREEN · JUDGED BLIND |
| `forecast` | `out/fun-forecast.mp4` | 45.0s (1350f) | game theory | Channel 8 Market Weather broadcast | "Game theory forecasts the board." | GRADED, NOT TRUSTED · FOUND BY TRILLION-DNA SCREEN |

Episode beats (for future edits):

- **dnatest**: DN1 hook "Trillion-dollar stocks share the same DNA." + three vials
  ($AAPL/$NVDA/$MSFT, safe/flattering "club" framing) → DN2 procedural double-helix
  (violet `C.discovery` + lab-blue strands, slow frame-driven twist) with SIX gene rungs
  igniting bio-green: FOUNDER-LED / PLATFORM ECONOMICS / COMPOUNDING MOAT / NETWORK
  EFFECTS / CATEGORY CREATION / EXPANDING TAM (the discovery prompt's own trait list);
  "Six markers. Every giant had them — before it was a giant." + "~4% OF STOCKS CREATED
  ALL THE NET WEALTH" (Bessembinder) → DN3 "run it in reverse": $-redacted SMALL CAP ·
  $2.1B specimen, scan beam, 6/6 marker ticks, GENOME MATCH chip, canon line "The scout
  hunts trillion-dollar DNA — before the trillion." → DN4 desk ▲▲▲ 90.3 → DN5 endcard,
  gag "SIX MARKERS · CHECKED".
- **yearbook**: Y1 hook "Every giant stock was small once." + navy leather cover (serif
  THE GIANTS, 4% seal, BEFORE THE TRILLION) → Y2 two halftone class pages ($NVDA CLASS
  OF 1999 "most likely to accelerate everything"; $AAPL CLASS OF 1980 "most likely to
  think different") with Caveat marker-scribble traits sweeping on (clip-path write-on)
  → Y3 "They voted for traits, not market caps." + CLASS OF 2026 page (4 ink-redacted
  candidate cards, trait scribbles, rough two-pass red marker circle via `evolvePath`)
  + canon "The scout reads yearbooks — hunting trillion-dollar DNA before the trillion."
  → Y4 desk → Y5 endcard, gag "CLASS OF 2026 · IN SESSION".
- **poker**: PK1 hook "The market is a poker table." + top-down felt oval (wood rail),
  four seats THE INCUMBENT/CHALLENGER/REGULATOR/SUPPLIER, $-redact pot, "IN THE POT: THE
  NEXT $NVDA-SIZED WIN" → PK2 2×2 player reads, meters STACK·M / PRESSURE·E / ALLIES·C
  (values 1–10, copper fills; foot "MASS × ENERGY × COORDINATION · 1–10 EACH") → PK3
  POT-COMMITTED double-border stamp, betting tree TODAY → RAISE 62% / CALL 28% / FOLD
  10% (sums 100), equilibrium path ignites copper, "A pot-committed player has exactly
  one move." + "FORCED MOVES ARE THE PREDICTABLE ONES" → PK4 EVEN MONEY vs 62/38 cards,
  ASYMMETRY 8.5/10 meter, falsifier card "WRONG IF: THE INCUMBENT FOLDS THE FLAGSHIP
  LINE." + ✕ KILL CONDITION SET, "A read you can't kill is a superstition." → PK5 desk →
  PK6 endcard, gag "NO BLUFFS · BASE RATES".
- **forecast**: WX1 "Tonight's stock forecast:" + gag card 100% CHANCE OF MOON 🚀 /
  SOURCE: VIBES → deadpan "Here's the real forecast." (CH·8 MARKET WEATHER station bug
  rides every scene) → WX2 pressure map: radar-green coastline draw, H = THE INCUMBENT ·
  HIGH PRESSURE, L = THE CHALLENGER · LOW PRESSURE (isobar rings), red toothed front +
  wind arrows H→L; "Pressure is incentive. Wind is the forced move." → WX3 4-horizon
  strip 3M 45% / 6M 55% / 12M 60% / 24M 70% with cloud→sun icons + probability cone +
  dashed bear line ("THE BEAR PATH STAYS ON THE MAP"); "A curve, not a vibe." → WX4
  amber SEVERE ASYMMETRY WARNING banner ("PRICED LIKE DRIZZLE · MAPS LIKE A FRONT"),
  MISPRICING 8.5/10, kill card "THIS FORECAST DIES IF: THE DEMAND ANCHOR SLIPS TWO
  STRAIGHT QUARTERS." + stamp; "Every forecast here gets graded in public." + "GRADED
  LIKE A FORECASTER, NOT A GURU" (Tetlock nod) → WX5 desk → WX6 endcard, gag "SEVERE
  ASYMMETRY WARNING".

## 3. Creative-freedom implementation (the owner's note, made concrete)

- **Per-episode visual identities** (coldcase precedent — palette lives INSIDE the
  episode; desk + endcard return to house dark): genome lab (LAB `#57c8ff` + BIO
  `#63e6b8`), yearbook paper (PAPER `#f0e9d8` / NAVY `#22305c` / MARKER `#c8443a`,
  halftone dot fields), poker felt (FELT `#0f3d2e` + wood RAIL, copper stays the GT
  accent per the gold/copper law), broadcast weather (RADAR `#3fe07f` / WARN `#ffb23e`
  banner with `C.whiteInk` text ~9:1).
- **Two OFL faces vendored** from cdn.jsdelivr.net/fontsource (google hosts still
  blackholed; jsdelivr resolves): `libre-baskerville-latin-700.woff2` (yearbook serif) +
  `caveat-latin-700.woff2` (marker handwriting). Registered in `src/lib/fonts.ts`,
  tokenized as `F.serif` / `F.hand` (theme.ts documents them as episode-accent only).
- New reusable idea: `Scribble` (yearbook.tsx) — clip-path sweep reveals Caveat text like
  a marker writing; rough hand-drawn circle = two offset ellipse `evolvePath` passes.
- FORMULA.md gained §B engine-specials rule, §H per-episode-identity rule, provenance tag
  `[07-09 engines]`, changelog row. Both scout films carry the §B trillion-DNA canon
  verbatim; both GT films thread it through the desk foot ("…TRILLION-DNA SCREEN…").

## 4. Infrastructure deltas

- `src/fun/timeline.ts`: `FunId` + tables + `FUN_IDS` for the four (5–6 scenes each;
  every endcard 168f standard).
- `src/Root.tsx`: 22 new scene components registered → comps `Fun-Dnatest/-Yearbook/
  -Poker/-Forecast` (auto via FUN_IDS).
- `package.json`: `render:engines` (just the four); `render:fun` now chains all 12.
- `scripts/gen-score-fun.ts`: **argv episode filter** (`node scripts/gen-score-fun.ts
  dnatest poker`; no args = all, byte-stable regardless) + four score blocks: dnatest
  (sequencer read-head ticks, six ascending gene chimes, reverse whoosh, scan sweep,
  match impact), yearbook (music-box plucks, page-flip swooshes, Caveat "squeak" drift
  tones, cover slam), poker (noir bass walk A2-C3-E3-C3, chip-clack tick clusters, card
  slides, heartbeat, ignite chord, kill-stamp buzz), forecast (broadcast sting + tom
  fill, radar ping+echo, front crackle, stylized two-tone klaxon — NOT real EAS tones —
  kill-stamp buzz). WAVs: 7.5/7.4/8.4/8.7 MB (38.9/38.7/43.9/45.5s).

## 5. QA (rulebook gate order, all green)

- `npx tsc --noEmit` clean · `npm run check:leak` **62 files, 0 hits** (run before scores
  AND again after fixes, before renders).
- **Fresh-DOM stills: 48 read across the four comps.** Three real bugs found and fixed:
  1. Y1 cover sub-line "CLASS PHOTOS · BEFORE THE TRILLION" wrapped outside the
     double-rule frame → shortened to "BEFORE THE TRILLION" + nowrap (§F class).
  2. PK2 meter label "PRESSURE · E" overflowed its 190px column into the bar → label
     column 214px, panels 430→452 (grid 78/550 stays inside the 960 safe).
  3. DN2 lit gene rungs collapsed to ~dots when the frame-driven twist put them at a
     strand crossover → lit bands clamp to a 72px minimum span (unlit rungs untouched).
  Re-stilled all three fixes + WX3; clean.
- **Encode-path seq checks** (DOM-reuse, concurrency 1): Dnatest 680–716 (canon TypeOn/
  Kinetic + glow chips), Yearbook 312–348 (page-slide handoff + clip-path scribbles),
  Poker 548–584 (ignite re-stroke + stamp + Kinetic), Forecast 862–898 (banner + kill
  stamp + Kinetic). No stuck styles; all blur = word-entrance decay, ghost-word class
  still dead.
- **Full renders + ffprobe**: see §6.

## 6. Renders / verification results

`npm run render:engines` (serialized, port 3333): all four rendered exit 0.
ffprobe: **exact frame counts** 1152 / 1146 / 1302 / 1350, all 1080×1920 30fps AAC.
Encoded spot frames (ffmpeg `select=`) read from the mp4s: dnatest helix+labels and
canon beat, yearbook circle beat, poker ignite beat, forecast banner beat — all as
composed (see `out/stills/enc/` if kept).

## 7. State / notes for next session

- Committed locally on `main`, **NOT pushed** (Railway auto-deploys main; owner's call —
  marketing/ is excluded from the app build so a deploy restart is the only side effect).
- The four originals + master + lens shorts are untouched (no timeline edits ⇒ their
  scores/renders stay valid). `render:fun` now includes the engine specials for future
  full-queue re-renders.
- Social encodes on posting day (`ffmpeg -crf 26 -preset slow`); poster frames: endcards
  in the last ~4s; the yearbook circle beat (~f716) and poker ignite (~f596) make strong
  thumbnails.
- Standing open items unchanged: waitlist stores/nothing sends; Railway trial → Hobby;
  `public/shots/run.png` site reshoot still pending (master-film scenes only — the four
  new films use no screenshots).
