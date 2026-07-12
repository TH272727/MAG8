# FORMULA.md — the MAG8 video formula (compounding owner rulebook)

Every request the owner has made about the marketing videos, distilled into rules. This file
exists so each video is better than the last: **consult it BEFORE storyboarding and again at
QA; append every new owner note the day it lands** (add the rule + a provenance tag, never
delete history — supersede explicitly). `marketing/video/CLAUDE.md` holds the engineering
rulebook (render model, tokens, gates); THIS file holds what the owner has asked the films
to BE. Where they overlap, this file is the taste, CLAUDE.md is the physics.

Provenance tags: `[07-07 film]` launch film · `[07-08 pace]` lens shorts + pacing ·
`[07-08 fun]` intro rework + fun wave 1 (incl. hooks + text-size passes) · `[07-08 w2]`
fun wave 2 + waitlist CTA · `[07-08 gt]` Game Theory rename · `[07-09 dna]` trillion-DNA +
fit/contrast pass · `[07-09 engines]` engine specials (scout + Game Theory features) ·
`[07-11 thumbs]` YouTube packaging (thumbnails + titles).
Full stories: `HANDOFF-2026-07-0{7,8,9}-*.md`.

---

## A. The hook — first ~3 seconds

- Open on the BIGGEST version of the idea: the question pops HUGE (master 150px / portrait
  126px), holds long enough to actually read (~2.4–3.2s), THEN shrinks into the UI, and only
  THEN does the noise/flood begin. Big → hold → shrink → chaos, in that order. `[07-08 fun]`
- A viewer must know the video is about STOCKS inside the first second: say "stock" outright
  and/or show real mega-cap cashtags ($NVDA, $TSLA) in the hook. `[07-08 fun]`
- Real tickers appear in SAFE framings only — famous winners referenced neutrally or
  flatteringly ("the next NVDA", "missed $TSLA"). A real company is NEVER scored, vetoed,
  red-flagged, or attached to a negative claim; every scored/traded name is $-redacted.
  `[07-08 fun]`
- Campaign through-line: *you know the famous winners — this is about the next one.*
  `[07-08 fun]`

## B. Copy & voice

- **The scout is never just "a scout."** Every scout mention carries the trillion-DNA
  framing: it hunts stocks with the DNA of trillion-dollar stocks, BEFORE they become
  trillion-dollar stocks. Canon lines — S05 "One scout hunts trillion-dollar DNA." (+ sub
  "The traits trillion-dollar stocks had — before they became trillion-dollar stocks.");
  V03 "First, a scout hunts / trillion-dollar DNA — / before the trillion."; V02 "One scout
  for trillion-dollar DNA. / Three lenses. One verdict."; thread labels TRILLION-DNA SCOUT
  (landscape) / TRILLION-DNA (portrait); wire "trillion-DNA screen · 8 names". `[07-09 dna]`
- The lens is **"Game Theory"** — "macro asymmetry" is dead everywhere on screen (ids/colors
  stay `macro`/copper internally). `[07-08 gt]`
- Lead with the flagship engines — the discovery-DNA hunt and the game-theory war-gaming are
  the eye-catching parts; don't bury them. DNA thesis language: "the traits today's giants
  showed before they were giants." `[07-08 gt]`
- The two engines deserve DEDICATED films ("by far the most interesting, original, unique
  features") — engine specials go deep on ONE engine while the desk carries the rest of the
  story: fun-{dnatest,yearbook} = trillion-DNA scout; fun-{poker,forecast} = Game Theory
  (M×E×C players, forced moves, base rates, horizon curve, asymmetry, kill condition, graded
  in public). `[07-09 engines]`
- Fun front half, deadpan instrument voice for the turn. The joke earns the pivot; the desk
  answers quietly. `[07-08 fun]`
- Owner taste ranking: dialogue/social comedy (groupchat) > swipe/pun formats (redflags,
  eightball) > procedural bits (gate). New episodes lean human/dialogue-driven; never re-tread
  a shipped format. `[07-08 w2]`
- Every short tells the WHOLE MAG8 story (hook → name → scout → blind lanes → fusion →
  verdict → receipts → endcard) while going deep on ONE thing. A GT deep-dive shows the full
  mapping: players with M×E×C, every path, horizons, asymmetry, the falsifier. `[07-08 pace]`
- White-label always: scout / lenses / compile / verify vocabulary only; provider, skills,
  and agents never appear; `npm run check:leak` must be 0-hit. `[07-07 film]`

## C. Read time — "pause longer when there's text"

- Every full-sentence beat holds **≥ ~2.2s AFTER its last word lands**; secondary mono
  footnotes ≥ ~1s. When in doubt, hold 0.5–0.7s longer than your first instinct — viewers
  read slower than editors. `[07-08 pace]`
- Beats whose payoff is a stamped chip/reason (vetoes, flags) hold longer than their happy
  path so the reason can actually be read (gate vetoes exit ~24f after passes). `[07-08 fun]`
- Endcards are lengthened, never squeezed, when a new element (CTA) is added — the close
  gets read time. `[07-08 w2]`

## D. Type size — "make text larger"

- The 2026-07-08 graded bump is BAKED INTO every scene file (≤32px:+6 · 33–44:+5 · 45–68:+4 ·
  ≥69:+0). Sizes in scenes are FINAL — never re-apply the grade. `[07-08 fun]`
- Floors: Chip 25 / Eyebrow 26 are the smallest legal on-screen text; Kinetic default 84.
  New text starts AT or above the floor. `[07-08 fun]`
- When text grows, retune its container in the same edit — fixed-width columns,
  space-between rows, and nowrap pills are where size bumps break layouts. `[07-08 fun]`

## E. Contrast — "no dark on dark, no light on light"

- Text meant to be READ never uses `C.dim` on the dark void (~3:1) — `C.muted` (~4.9:1) or
  brighter. `C.dim` is reserved for state-based de-emphasis (skipped / pruned / inactive
  siblings of a lit element), where being faint IS the meaning. `[07-09 dna]`
- On the white chapter, text is `C.whiteInk` / `C.whiteMuted` only — mid-greys (the old
  `#9aa2b1`) fail on white. `[07-09 dna]`
- Accent-on-accent needs the same check (copper chip text on white passed at 4.3:1; verify,
  don't assume). `[07-09 dna]`

## F. Fit — "all text inside its box, nothing overlapping"

- MEASURE before writing: mono ≈ 0.6em/char + letterSpacing. A 24px/0.12em mono footer fits
  ~52 chars inside the 960px portrait safe width. Landscape safe width is 1728px. Shorten
  the copy, not the safe zone. `[07-09 dna]`
- Keep must-read text inside `SAFE.portrait` (150/170/60) and `SAFE.landscape` (72/72/96)
  from theme.ts. `[07-08 fun]`
- Absolutely-positioned text chips/stamps/labels ALWAYS get `whiteSpace: 'nowrap'` — their
  shrink-to-fit width is capped by (containing block − left offset) and they wrap invisibly
  in code review (S17 GAP NOTED, VF4 gap label, redflags stamps all failed this way).
  `[07-09 dna]`
- Decorative slams/stamps land in EMPTY regions — the gag never covers copy that hasn't
  finished its read (redflags stamps moved to the card's empty band). `[07-09 dna]`
- Rows that can outgrow their panel get a deliberate multi-line layout, not incidental
  wrapping (S13 wire = time+tag line / message line). `[07-09 dna]`
- Multi-label rails (thread labels, legends): compute neighbor spans before renaming —
  portrait fits TRILLION-DNA, not TRILLION-DNA SCOUT. `[07-09 dna]`

## G. The close — endcard contract

- Every endcard, every film: mark → MAG8 wordmark + gold-dot pulse → tagline ("The next
  trillion-dollar leaderboard.") → episode/gag chip → **WaitlistCta "Join the email
  waitlist!" in big type (64px portrait / 56 master, ink + violet only)** → "RESEARCH, NOT
  INVESTMENT ADVICE" → fade. The CTA is the one ask; never drop it. `[07-08 w2]`
- No URL on endcards until the public domain is live (open item — add it the day it ships).
  `[07-07 film]`

## H. Brand & production laws

- GOLD marks final verdicts only, and first appears at the fusion beat. Copper carries Game
  Theory for exactly this reason. Ink-toned mark glow, never gold. `[07-07 film]`
- The film and the product are pixel-siblings: theme.ts mirrors globals.css; real UI appears
  as REAL screenshots (reshoot `public/shots/` after site changes — `run.png` currently
  pre-dates the Game Theory rename). Stylized demo numbers (90.3 / 73.9 / 69.5) are fine;
  screenshots must show real data. `[07-07 film]`
- Aside-style grammar: giant 2–6-word kinetic type, dark→white→dark chapter smash cuts, real
  UI floating in clean space, typewriter reveals, restraint (~2–3 movers per beat).
  `[07-07 film]`
- Per-episode visual identities are owner-approved ("no need to stick to the same colors,
  designs, visuals") — an episode may own a bespoke palette/typeface world (genome lab,
  yearbook paper, poker felt, broadcast weather), PROVIDED the contracts still bind:
  white-label, endcard close, gold = verdicts only (copper stays Game Theory), read-time,
  type floors, contrast, fit. Episode palettes live only inside the episode; the desk and
  endcard return to house dark (coldcase precedent). OFL accent faces (Caveat, Libre
  Baskerville) are vendored via jsdelivr/fontsource — google hosts stay blackholed.
  `[07-09 engines]`
- ZERO spend: free/open tools only, everything renders locally; procedural score stays
  licensed-track-swappable (replace the WAV, keep the filename). `[07-08 w2]`

## I. QA gates — the order that catches everything

1. Storyboard against THIS file, then `marketing/video/CLAUDE.md` for the physics.
2. Fresh-DOM stills of every changed scene — and READ them (every overflow/contrast bug ever
   shipped was caught or missed here). `[07-08 pace]`
3. Encode-path seq (`npm run stills -- <Comp> seq a-b`) on scenes with animated text — the
   ghost-word class only reproduces in the reused-DOM path. `[07-08 fun]`
4. `npm run check:leak` → 0 hits, then full renders LAST. Timeline changes ⇒ regenerate the
   matching score; copy-only changes ⇒ scores stay valid. `[07-08 pace]`

## J. Packaging — thumbnails & titles

- A thumbnail is a film frame in spirit: house tokens, ONE focal element, ≤6 giant words. Every
  film law binds — white-label, gold = verdict elements only, cashtags safe-framed, scored names
  $-redacted, trillion-DNA scout framing. Secondary mono chips are texture (fine if unreadable at
  168px preview); the hook words must survive that size. `[07-11 thumbs]`
- Keep the bottom-right ~260×100 free of must-read content — YouTube stamps the duration badge
  there. `[07-11 thumbs]`
- Pipeline (zero-spend, repo-proven OG recipe): scratch HTML with data-URI vendored fonts +
  `public/brand/mark-ink.png` → headless Edge `--headless=new --force-device-scale-factor=2
  --window-size=1280,720 --virtual-time-budget=5000` → ffmpeg lanczos to 1280×720 PNG (<2MB
  YouTube cap; keep the `@2x` master). READ the PNGs before shipping — same gate as stills.
  `[07-11 thumbs]`
- Ship THREE per video (YouTube "Test & compare" A/Bs exactly three); alt titles front-load the
  hook inside ~60 chars (display truncation) and live in the platform metadata pack next to the
  video's entry. Set lives in `marketing/youtube-thumbs/`. `[07-11 thumbs]`

## Changelog (append here — this is the compounding)

| Date | Owner note | Landed as |
|---|---|---|
| 2026-07-07 | Launch film in the aside style, from the site + logo | §A/§H grammar, gold/fusion law, white-label gate |
| 2026-07-08 | "Pause slightly longer whenever there is more text so viewers can read" | §C read-time floors; master +252f pacing pass |
| 2026-07-08 | Hook question LARGER, pops, reads longer, then shrinks, THEN the noise | §A BigQuestion pattern |
| 2026-07-08 | Move away from formal — fun/creative shorts | §B voice; fun campaign |
| 2026-07-08 | "Can't tell it's about stocks in the first seconds" | §A stocks-in-first-second + cashtag discipline |
| 2026-07-08 | Small text hard to read in short form | §D graded size bump + floors |
| 2026-07-08 | 4 more episodes, no re-treads; groupchat > redflags/eightball > gate | §B taste ranking |
| 2026-07-08 | Every video ends with big "join the email waitlist!" | §G endcard contract |
| 2026-07-08 | "Game theory", not "macro asymmetry"; surface the two engines | §B naming + engine-forward copy |
| 2026-07-09 | Scout must carry the trillion-DNA framing everywhere | §B scout canon |
| 2026-07-09 | All text fits its box; no overlap; no dark-on-dark / light-on-light | §E + §F, S13/S14/S17/VF4/VM2/VC3/redflags fixes |
| 2026-07-09 | 4 films on the two engines (scout trillion-DNA + Game Theory — "the most interesting, original, unique features"); get creative, any free/open tools, no need to keep the same colors/designs/visuals | §B engine specials; §H per-episode identity freedom + vendored accent fonts; fun-{dnatest,yearbook,poker,forecast} |
| 2026-07-11 | 3 thumbnails for the-signal + 3 more titles (third requested for thumb C) | §J packaging contract; `marketing/youtube-thumbs/` a-4pct / b-one-signal / c-next-one + alt titles 1–3 in the upload plan |
