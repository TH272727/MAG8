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
`[07-11 thumbs]` YouTube packaging (thumbnails + titles) ·
`[09-04 charts]` the viral chart format (data-driven chart shorts).
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

## K. The chart format — data films

- The owner asked for the racing-line chart short seen from creators in that genre
  (expanding x/y axes, time on x, money or percent on y, an enlarged date under the plot
  that counts as the animation runs, a title, several coloured lines, a badge at the head
  of each line), **branded MAG8 throughout — mark, name and the website**. Built as
  `marketing/video/src/charts/` + the `viral-chart-protocol`; `CHARTS.md` holds the
  engineering notes. `[09-04 charts]`
- **NO HOOK CARD AND NO ENDCARD.** The chart film opens ON the chart, already drawing, and
  ends ~1.5s after the last point lands. The owner cut both for retention: this format is
  "mostly a cool fun interesting moving graph video for the average scroller", and a question
  card in front and a brand card behind are two places to swipe away. The time the two cards
  used went back INTO the race (18s → 23s), so the chart draws more slowly and the date is
  followable. The final held frame is also the loop point. `[09-04 charts]`
- **This SUPERSEDES §G for the chart format only.** No endcard means no WaitlistCta on these
  films — the one exception to "never drop the CTA", made explicitly by the owner. Every
  other film keeps the §G contract in full. `[09-04 charts]`
- **The brand promotes by being PRESENT, not by interrupting.** With the endcard gone, the
  header carries all of it on every single frame: mark + MAG8 top-left, and top-right the
  tagline "The next trillion-dollar leaderboard." over `themag8.com`. Deliberately quiet —
  muted weight, no gold, no ask. The film is a chart; that block is the byline on it. The
  verifier FAILS a cut that has no endcard AND no address in the header, so this can never
  silently become an unbranded chart. `[09-04 charts]`
- **The title stays.** The owner keeps the question inside the chart frame ("as the charts
  are playing out I still like how the question is in there") — it is the headline over the
  plot, not a card in front of it. `[09-04 charts]`
- This discharges the §G hold ("no URL on endcards until the public domain is live") — the
  domain is live, and the owner asked for it on screen. `[09-04 charts]`
- **Nothing on screen is a typed figure.** Head values, the live rail, the standings, the
  gold winner's number, the growth multiple and the date range are all read from the frozen
  dataset at render time. `payoff.lines` is qualitative copy only, and the verifier warns on
  any number in copy that is not a final value, a multiple, a year or the principal.
  `[09-04 charts]`
- **The receipts are part of the frame.** Every chart carries the arithmetic in one line
  ("Value of $10,000 invested on 2012-06-01, held, distributions reinvested."), the source,
  and the date the numbers were pulled. A log axis carries a LOG SCALE chip or the render is
  blocked. `[09-04 charts]`
- **The window is the thing that gets these charts fact-checked, not the numbers.** The
  best-known chart in this genre lost a public fact-check because one series had fewer
  periods than the others and simply stopped climbing while its rivals kept going. Every
  MAG8 chart rebases to the first date all series exist and stops at the last date they all
  report, and the gate refuses to render otherwise. `[09-04 charts]`
- **Real names stay in safe framings, and that now covers PEOPLE.** §A already bars scoring,
  vetoing or attaching a negative claim to a real company. A chart about a named
  individual's money or conduct — the "X's net worth vs Y's" shape common in this genre —
  is an **owner decision, never a default**: MAG8 is a real financial product with a live
  waitlist, and that is a different risk class from a chart of tickers. Line-head badges
  default to monogram discs (no likeness, no licence). `[09-04 charts]`
- Chart beats, default cut: **race only, 690 frames, 23s portrait**. The hook, payoff and
  endcard beats still exist in the engine and come back for any chart that gives them frames
  — a beat set to zero is dropped from the sequence rather than rendered empty. `[09-04 charts]`
- The chart must FILL its plot from the first seconds. A y window that opens wider than the
  data (a whole decade on a log axis) leaves every line flat in a sliver of the frame and
  fans the head badges into what reads as a floating legend. The window opens tight around
  what has been revealed and widens from there — which is also the move the format is FOR:
  the axis visibly expands and its units climb as time passes. `[09-04 charts]`
- A line must never leave the plot box. A preferred floor (`yFloor`) yields to real data
  below it — a chart whose line runs off the bottom edge is hiding something. `[09-04 charts]`
- **"Run the viral fun chart marketing protocol" is a standing brief, not a blank one.**
  Asked for the protocol with no subject, the answer is **three brainstormed comparisons**,
  each a story none of the already-made charts has told — read `npm run chart:made` and the
  spec folder before proposing, so "new" is checked and not remembered. Put the three to the
  owner and build the one they pick. `[09-05 charts]`
- **No intro, no outro — now a GATE, not a default.** The owner has called this twice, so
  `chart-verify` FAILS any spec that gives the hook, payoff or endcard beat frames. The
  reference is the first two films: the chart moving, and nothing else. A card comes back
  only if the owner asks for one on a specific film. `[09-05 charts]`
- **"Make N original videos" means build all N, not brainstorm N and build one.** The
  standing brief's default is three ideas → owner picks one; an explicit count is an
  instruction to ship that many. The brainstorm still happens and novelty is still checked
  against `npm run chart:made` first — what changes is that every idea is built, so they have
  to be three genuinely different SHAPES rather than three subjects on one shape. `[09-05 charts]`
- **Chart films are filed apart, 25 to a folder.** `out/charts/batch-01/`, `batch-02/`, …
  Twenty-five is YouTube's one-drag upload limit, so a full folder is exactly one drag and
  nothing has to be counted out by hand. The driver picks the folder; a re-render of an
  existing film goes back to its own folder rather than taking a slot in the current one,
  and a folder that has already been dragged is never re-filed. `npm run chart:made` prints
  the state. `[09-05 charts]`

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
| 2026-09-04 | Replicate the animated-chart shorts format (expanding axes, ticking date, coloured lines, badge on each line head) — and make it better; branded MAG8 with the logo, the name and the website; runnable on demand as the "viral chart content protocol" | §K chart format; `src/charts/` engine + `chart-fetch`/`chart-verify`/`gen-score-chart`/`render-charts`; `viral-chart-protocol`; two films shipped (`chart-mag7-10k`, `chart-wages-vs-everything`); §G URL hold discharged for charts |
| 2026-09-04 | Cut the intro question card and the outro from the chart films — go straight into the chart, end when the chart is done; fit "the next trillion dollar leaderboard" up near the logo and the website; keep it a subtle, casual promo — mostly just a cool moving graph for the average scroller | §K rewritten: race-only 23s cut, §G superseded for charts (no endcard, no CTA), tagline added to the persistent header, verifier FAILS an unbranded cut; y-window opens tight so the chart fills the frame from the start |
| 2026-09-05 | Whenever I say "run the viral fun chart marketing protocol": automatically brainstorm 3 things we could chart and compare that we haven't made before; no intro/outro, only the interesting chart moving (the first two chart videos are ideal); and put chart videos in their own folders, 25 max per folder, new folder after that, so I can drag 25 into YouTube at once | §K standing brief: 3 novel ideas on every unqualified invocation + `npm run chart:made` as the novelty check; no-cards is now a `chart-verify` FAIL not a default; `out/charts/batch-NN/` 25-film batch folders via `scripts/chart-out.ts`, re-renders return to their own folder |
| 2026-09-05 | "Execute the viral chart protocol and make 3 original videos" | §K explicit-count rule; three films shipped (`chart-cost-of-money`, `chart-cheaper-or-dearer`, `chart-sector-race-10k`) on three shapes — published levels / a fan that crosses zero / a linear dollar race with 25 lead changes; six engine findings in CHARTS.md incl. Yahoo's duplicate live month bar |
| 2026-09-05 | "Run the protocol again, create 3 more original videos" | Three more films (`chart-work-in-america`, `chart-grocery-run`, `chart-world-markets`) on three unused shapes — raw headcounts on the `index` unit / dollars at shelf scale / a percent race of national markets; batch-01 now 8/25; four more engine findings in CHARTS.md incl. a spike check that failed a real market crash |
