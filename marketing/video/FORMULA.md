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
`[09-04 charts]` the viral chart format (data-driven chart shorts) · `[09-06 story]` story-first
chart subjects + the photographic backdrop.
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

- **Every chart film ships with its own platform title, description and tags — because YouTube
  writes them for you otherwise, and writes them badly.** The upload dialog pre-fills the title
  from the FILENAME and the description from the channel default, so `chart-the-gap-that-
  closed.mp4` arrives titled "chart the gap that closed" with a generic house description under
  it: the same riddle §K bans on screen, reintroduced by the platform at the last step. The pack
  is `marketing/youtube-chart-upload-plan-2026-09-08.md`, GENERATED by
  `npm run chart:platform` from the frozen datasets — a description is mostly figures, and a
  figure retyped from memory is the defect this repo keeps catching. Anything not in the data (a
  date, a historical fact, a span in years) is declared in the film's `claims` with its source,
  and the generator REFUSES any other loose numeral. Do not hand-edit the pack; edit
  `scripts/chart-platform.ts` and regenerate. `[09-08 platform]`
- **The platform copy obeys the same plain-language rule as the frame, and the same white-label
  gate.** Titles lead with the subject and say what the film measures; the generator runs the leak
  pattern over every title, description and tag before it writes. `[09-08 platform]`
- **Format, measured rather than assumed (research, Sept 2026):** a Shorts title is judged on its
  first ~40 characters and does better DECLARATIVE than interrogative — so the on-screen headline
  can stay a question while the platform title states the payoff; the first ~100 characters of the
  description sit above the fold; hashtags belong in the DESCRIPTION, 3-5 of them, and **more than
  15 makes YouTube ignore every one**; `#Shorts` alone is too saturated to buy anything. The tag
  box holds 500 characters and 30 per tag and is worth about five minutes — the title and the
  thumbnail carry the video. `[09-08 platform]`

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

- **The backdrop is a SCENE, not a product shot.** The owner's verdict on the first three: the
  Tokyo skyline and the trading floor were "general enough, but relevant enough"; the studio
  close-up of a pizza slice was the weakest of them, and what it wanted was "a more general photo
  like a pizza delivery man" (it was replaced with a delivery rider in a busy street). The test is
  what the story's WORLD looks like — a street, a floor, a skyline, a queue, people at work — not
  what the story's noun looks like. A place with depth in it still reads as a photograph at 15%
  opacity; an object on a white sweep reads as a smudge. Avoid legible third-party branding while
  you are at it: a logo behind a financial film implies an association nobody agreed to.
  `[09-06 story]`
- **A chart film may carry a PHOTOGRAPH under the plot, darkened almost to texture.** The owner's
  reason is the right one: every other pixel in this format is drawn, so one photographic surface
  is the cheapest evidence in the frame that a person chose the subject — "a small thing like this
  will make the video seem less AI generated". It is felt, not looked at. Three things keep it
  that way and all three are in code, not in a spec: strength clamped to 0.04–0.25, a scrim that
  protects the title and the receipts, and a lighter wash over the plot band where the lines live.
  **Judge it on a full-resolution crop** — at contact-sheet size every strength looks fine, and
  the first cut shipped the picture at about 0.06 effective, where a photograph reads as sensor
  noise. `[09-06 charts]`
- **Only PUBLIC DOMAIN or CC0 images, and the licence is checked twice.** Not squeamishness: CC BY
  and CC BY-SA are equally free and both oblige an attribution on the frame, and a chart film has
  one line of receipts which belongs to the data. `scripts/chart-backdrop.ts` refuses anything
  else at fetch time and records licence, author and source in `public/backdrops/CREDITS.json`;
  `chart-verify` re-checks it at render time. A picture with no origin is no more publishable than
  a figure with none. `[09-06 charts]`
- **EVERY chart film carries a STORY. This is a requirement, not a flavour.** Standing rule, given
  the day after the first story films landed: the subject must be something that captivates a
  stranger, *"rather than something only finance bros would care about"*. A comparison is not a
  story. "Someone bought two pizzas for ten thousand bitcoin"; "a country's stock market took
  thirty-four years to get back to where it started"; "what if you bought at the worst possible
  moment" — those are stories, and the chart is the ANSWER to one. The money counterfactual is
  usually the answer's shape: *what would that be worth now?* An idea that can only be described
  as "X versus Y over time" has not found its story yet and is not ready to propose.
  `[09-06 story]`
- **The person in the story is never named**, in copy or on screen. The §K rule about real
  individuals binds hardest exactly where a story is most tempting; "someone", "a buyer", "a
  country" carries every one of these without naming anybody. `[09-06 charts]`
- **The story never bends the data — the window discipline gets STRICTER on a story film.** A good
  story creates pressure to reach for the headline number. Bitcoin had no market price on pizza
  day, so that film starts months later and shows what $41 became rather than what the ten
  thousand coins became: a smaller number than the headlines, and the one the chart can stand
  behind. `[09-06 charts]`
- **The window discipline gets HARDER on a story film, not softer, because the story creates
  pressure to overclaim.** Bitcoin had no market price on pizza day — the series reads 0.00 every
  day until August 2010 because there was nowhere to sell one — so the film starts in the first
  month a price existed and says so, and it shows what $41 became rather than what the ten
  thousand coins became. The number on screen is smaller than the number in the headlines, and it
  is the one this chart can actually stand behind. `[09-06 charts]`

### Say what it is (owner, 2026-09-07)

- **The first text a viewer reads has to tell them what they are watching.** The owner's
  example is the whole rule: `the-gap-that-closed` opened on the words *"The gap that
  closed"*, and a viewer trying to work out what the film was about had to hunt down to the
  31px subtitle to find "life expectancy" — *"that isn't good for viewer retention, i need
  the viewer to know right away what they're watching"*. Every number on screen was correct
  and the subtitle did say it; none of that helps, because a scroller decides in the time it
  takes to read the 62px line and nothing underneath it rescues a headline that reads as a
  riddle. **Lead with the subject, then the story**: "Life expectancy: / the gap that
  closed". The hook survives, it just stops going first. `[09-07 clarity]`
- **A `subject` is declared on every spec and `chart-verify` FAILS a title that does not name
  it.** The field says what the film MEASURES in plain words a stranger understands — "life
  expectancy at birth", not "the gap that closed" — and the gate checks that the title shares
  a real word with it. A machine cannot judge whether a phrase is clear, but it can check
  that the title and the subject are talking about the same thing, which turns a taste rule
  into an arithmetic one. It is defeatable by declaring a dishonest subject, which is true of
  every other declared field here. `[09-07 clarity]`
- **"Don't make anything more complex than it has to be."** The rule does not stop at the
  headline: the trade's vocabulary is not a stranger's. Bond-rating codes (`Aaa`, `Baa`),
  statistical furniture ("cumulative change", "seasonally adjusted annual rate", "total
  return"), and clipped agency category names are all things a viewer has to decode before
  they can watch. Say the plain thing where the plain thing is equally true — "top-rated
  firms" for Aaa, "how much each has risen" for cumulative change. Where plain language would
  cost accuracy, keep the accurate words: a disclosure is not clutter, and the fix for a
  jargon term that is load-bearing is to keep it and cut the words around it. `[09-07 clarity]`
- **The title is not the file name and the file name is not the title.** `the-gap-that-closed`
  is a good ID and was a bad headline. Ids stay poetic; headlines say what the thing is.
  `[09-07 clarity]`

### Music (owner, 2026-09-07)

- **Chart films carry the owner's licensed music, and nothing else.** They used to carry the
  same procedural score every other film here carries (`gen-score-chart.ts` — synthesised,
  no samples, no spend, a tick on every year boundary). The owner supplied eight tracks and
  asked for those to be the only sound: "this is the only sound/music i want in the videos,
  cut all sound that is currently in these videos that isnt these songs." The synthetic bed
  is unwired in `Root.tsx`, so the composition is silent and there is exactly ONE source of
  sound. `gen-score-chart.ts` is kept, unwired, for a film that ever wants it back.
  `[09-07 music]`
- **The music is muxed AFTER the render, never baked into the composition.** A render is 690
  screenshots and minutes; the mux is a container operation and takes about a second. Baked
  in, changing a bed would mean re-rendering twenty-six finished films. The video stream is
  STREAM-COPIED — the picture in a scored film is bit-for-bit the picture the renderer made,
  checked by MD5 on the video stream before and after. `[09-07 music]`
- **Assigned at random ONCE, then fixed forever.** `music/assignments.json` is committed and a
  film that already has a track keeps it — a film that has been posted must keep sounding
  like itself, and a re-roll on every run would mean the copy on YouTube and the copy in the
  batch folder are different videos. New films take the least-used track so the spread stays
  even (26 films over 8 tracks sits at 3–4 each). `--reroll <id>` is the deliberate override.
  `[09-07 music]`
- **The excerpt is chosen by energy, not by starting at zero.** A track's opening is usually
  its quietest part, and a 23-second film that starts there spends a third of its runtime on
  the least interesting bar of the music. The loudest 23-second window is found once at
  extract time and recorded in `music/library.json`, so it never moves under a film that has
  already been scored. `[09-07 music]`
- **Every film is normalised to −14 LUFS, two-pass.** There is no voiceover to duck under, so
  the music sits at full streaming-normalised music level, and twenty-six films come out at
  the same loudness rather than merely near it. Single-pass loudnorm pumps audibly on a short
  excerpt. `[09-07 music]`
- **Licensing is the owner's and is recorded per track**, not enforced by the tooling. These
  films go to YouTube, TikTok, Instagram and Facebook, all of which run Content ID: an
  unlicensed track does not fail any gate here, it fails on the platform, days later, as a
  claim against the channel. `[09-07 music]`

## L. Imported skills — precedence

Third-party marketing and writing skills live in `.claude/skills/` (installed 2026-09-07 from
`coreyhaines31/marketingskills` and `blader/humanizer`, both MIT, both recorded in
`skills-lock.json` with a content hash). They are advice. Three rules bound them.

**1. This file outranks all of them.** FORMULA.md and CHARTS.md are the owner's compounding rulebook.
An imported skill never changes a film rule, never relaxes a gate, and never overrides an owner
decision recorded in the changelog below. Where a skill's generic advice conflicts with a rule here,
the rule here wins and the conflict is worth a changelog line, not a silent edit.

**2. Everything they produce is public copy.** A YouTube description, a landing headline, a social
caption, a schema block — all of it must clear the leak gate (`node scripts/check-leak.ts` for film
sources, and the repo-wide grep for anything on the site). Two of the imported skills talk fluently
about "agents" and "MCP directories"; that vocabulary is banned in published output, and a skill
suggesting it is not permission to use it.

**3. Nothing auto-updates.** The upstream repo ships an `AGENTS.md` that instructs an agent to fetch
its `VERSIONS.md` from GitHub once per session, and a tools registry pointing at GA4, Stripe,
Mailchimp and Composio. Neither was installed. Skills here are edited freely, like every other skill
in this project — the hash in `skills-lock.json` exists so a local edit is detectable, not to be
restored over.

**The voice gate.** `npm run check:voice` turns the mechanically checkable half of the humanizer
patterns into a repeatable check over hand-written copy in `app/`, `components/`, `lib/` and
`marketing/video/src`. It reports; it never rewrites. Two of the source's strongest patterns —
em-dash-as-connector and the one-line closer — are this project's deliberate voice and sit behind
`--house`: the em dash alone is 801 hits in authored copy, so on by default the gate would have been
useless on the day it shipped. It also stays out of the runtime path entirely: the deterministic
writers verify that every numeral traces to an input, and a rewrite that changes what a sentence
claims while keeping its digits would pass that check and still be false.

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
| 2026-09-06 | "Run the viral chart marketing protocol and make 3 original videos" | Three films shipped into batch-01 (9–11/25): `chart-what-america-owes` (the first LOG axis over published levels — five borrowing sectors, 1952→, trillions), `chart-eight-billion` (the first ANNUAL grid and year-ticking date — eight populations, one lead change at the wire), `chart-below-zero` (eight government bond yields, a field that dives THROUGH the baseline). Five engine findings in CHARTS.md: FRED units disagree between series (Z.1 in millions, GDP in billions) so conversions now travel as NAMES; a series can change its own publishing frequency mid-history (Z.1 is annual before 1952) and the index-spaced axis then misstates time — now a `chart-verify` FAIL, proved by injection; the receipts line has a 62-character budget and a wrap is invisible at contact-sheet size — now a FAIL; the head badges had no clearance from the year labels and printed values through them; and `yFloor` pinned at zero wasted half the plot for a decade on the film named after the zero line |
| 2026-09-06 | "Create three more viral chart marketing videos, focusing on an interesting story related to finance, like the buying pizza with bitcoin story and comparing how much the guy could've had... also try taking an image from the internet related to the story, darkening the image, and putting it subtly into the background of the chart video. a small thing like this will make the video seem less AI generated" | §K story films + the backdrop layer; three films shipped (`chart-pizza-day`, `chart-nikkei-1989`, `chart-covid-crash`) into batch-01 (12-14/25); `scripts/chart-backdrop.ts` with a PD/CC0-only licence rule checked at fetch AND render; a mixed-source job so bitcoin's pre-2014 history can share an axis with tickers; the Yahoo local-time bar-dating fix; `dividends` declared rather than assumed; the spike gate taught to tell a bad month from a bad parse |
| 2026-09-06 | "Add it into the protocol permanently that i want videos to always include some type of interesting story to captivate viewers attentions better rather than something only finance bros would care about. i also like the background images a lot, the pizza one i liked the least, i think it would have done better with a more general photo like a pizza delivery man, besides that i like how the other two backgrounds look, general enough, but relevant enough." | §K: a STORY is now a REQUIREMENT of every chart film and the first test an idea must pass (a comparison is not a story); the backdrop must be a SCENE rather than a product shot, judged on what the story's world looks like; both rules written into the skill's standing brief so they apply on every invocation. `chart-pizza-day` re-shot with a delivery rider in a busy street and re-rendered into its own slot |
| 2026-09-05 | "Run the protocol again, create 3 more original videos" | Three more films (`chart-work-in-america`, `chart-grocery-run`, `chart-world-markets`) on three unused shapes — raw headcounts on the `index` unit / dollars at shelf scale / a percent race of national markets; batch-01 now 8/25; four more engine findings in CHARTS.md incl. a spike check that failed a real market crash |
| 2026-09-07 | Five open-source repos brought for review; marketing skills and the humanizer adopted | §L imported-skill precedence: this file outranks every imported skill, everything they produce is public copy and must clear the leak gate, and nothing auto-updates (the upstream `AGENTS.md` and its MCP tools registry were deliberately NOT installed). `npm run check:voice` added — the humanizer patterns as a repeatable gate over hand-written copy, house voice behind `--house`, proved by injection |
| 2026-09-07 | Same review: manim adopted for the video line | ManimCE (NOT 3b1b/manim — its own README warns older code may not re-render, and a re-render is not a new film here) in `marketing/manim`, as an ASSET generator only: transparent frames Remotion composites, never a second pipeline. `check-leak.ts` extended to walk the scene tree and match `.py`, since a scene puts captions straight on a frame and the gate could not see them. Two of the three obvious transparency routes fail SILENTLY (webm writes no alpha; the WebM transcode drops it even though both encoders list the format) — so PNG frames, with the alpha verified on three frames and the content verified on one |
| 2026-09-07 | "Run the viral chart protocol" — one of five parallel sessions, each asked for three original films and to de-conflict with the others first | Three films shipped: `chart-the-wage-that-stopped` (the first STAIRCASE — the federal minimum wage frozen at $7.25 since 2009 while six states climb away; published dollars, annual, nothing rebased, so the lines step rather than curve), `chart-nobody-wanted-oil` (the first DAILY film — seven energy prices through 2020 and the day US crude settled at MINUS $36.98, a line crossing below −100%), `chart-nowhere-to-hide` (the first race that goes DOWN — $10,000 into seven things on the first trading day of 2022, five of the seven finishing below the stake). Engine: an end cutoff `to`, and a gate that FAILS it unless the film's own copy names the period; `knownExcursions` so a real negative price can be declared rather than loosening the spike check; month labels on the x axis for runs under three years. A house-versus-wage film was DROPPED after checking the arithmetic — nominal house prices and wages have both grown five to sevenfold since 1979, so the honest chart would have undersold the story it was there to tell |
| 2026-09-07 | "Run the viral chart protocol" — one of five parallel sessions, each asked for three original films and to de-conflict with the others in a shared meeting first | Three films shipped into batch-01 (21–23/25): `chart-the-jobs-that-vanished` (the first CONTRACTING field — seven trades walking down and crowding into the floor, apparel 938,600 workers to 72,000; every one of the fourteen earlier films rises, fans or oscillates), `chart-who-owns-the-country` (the first COMPOSITION chart — four shares of one pie that must total 100, so a rise anywhere is a fall somewhere else), `chart-the-gap-that-closed` (the first CONVERGENCE — eight countries' life expectancy starting thirty-seven years apart and finishing six, the format run backwards). Findings in CHARTS.md: a FRED series can be alive and DISCONTINUED, which ends a film years early with every value correct (the window defect entering through the end rather than the start); CES payroll series are seasonally adjusted while the shared on-screen method line says "no adjustment" — flagged to the owner, not reworded, because it sits under eleven published films; the verifier reads numerals so a SENTENCE is unguarded, and two of my own payoff lines were false until I walked the series; two archival backdrops needed cropping because raw scans include the film's own sprocket holes and slide mount; and a licence check is not a judgement check — correctly-licensed results included internment-camp hospitals for a life-expectancy film. `scripts/stills.ts` port is now overridable (`MAG8_STILLS_PORT`, default unchanged) because a hard-coded port makes the port itself the queue when several sessions share one machine |
| 2026-09-07 | "I dragged a couple mp4 files into the mag8 codebase, these videos all have background music that i really like, i want you to extract just the background music of each video and randomly assign music to the viral chart marketing videos. this is the only sound/music i want in the videos, cut all sound that is currently in these videos that isnt these songs." (owner confirmed the tracks are licensed or royalty-free) | §K Music. `scripts/chart-music.ts` — extract eight tracks from `music/sources/`, pick each one's loudest 23s window, assign one per film at random ONCE and record it, then mux at −14 LUFS with the video stream copied untouched. The chart `<Audio>` is unwired in `Root.tsx` so the procedural score is gone and the licensed music is the only sound. All 26 films scored; video-stream MD5 verified identical before and after. Wired into `render-charts.ts` so a new film can never ship silent next to twenty-six that are not. Three findings: `execFileSync` returns stdout ALONE and ffmpeg writes every measurement to stderr, so all eight tracks reported their loudest passage at 0s; `-of csv=p=0` emits a trailing separator, so a 23-second film parsed as NaN and surfaced three steps later as loudnorm "reporting nothing measurable"; and the container duration is the LONGER of picture and sound, so measuring the film that way put the fade-out past the last frame |
| 2026-09-07 | "Make sure the subject of every chart video is crystal clear... the first piece of text they read is \"the gap that closed\" which can be confusing to a viewer trying to figure out what the video is about... i need the viewer to know right away what theyre watching, dont make anything more complex than it has to be, go through all videos and enforce this, and permanently make this a big rule for the whole protocol." | §K "Say what it is". A required `subject` field on every spec — what the film MEASURES, in plain words — and a `chart-verify` FAIL when the title shares no word with it, proved by re-injecting the owner's own example. Titles rewritten to lead with the subject across eleven films, then a second pass over the subtitles and series labels for the jargon that had collected there (Moody's `Aaa`/`Baa` rating codes, "cumulative change", "seasonally adjusted annual rate", "total return"). Twelve films re-rendered into their own slots. The gate also measures the title's WIDTH per character rather than counting them, because digits and capitals are half again as wide as an `i` and a 62px headline has about thirty characters a line |
| 2026-09-08 | "YouTube prefills the title from the filename and the description too, ive seen it automatically advertise mag8 — optimize the title and description of all video, research effective tags for the title and description and add them, even add emojis if possible, and keeping the language simple and easy to understand, i want a captivating title and description directly related to the subject of the video" | §J platform metadata. `scripts/chart-platform.ts` + `npm run chart:platform` generate a per-film YouTube title, description, hashtags and tags for all 26 chart films into `marketing/youtube-chart-upload-plan-2026-09-08.md`, with every figure interpolated from the frozen dataset and every other numeral required to be declared in `claims` — proved by injecting a false figure. Titles are declarative and lead with the subject (58 chars at the longest), descriptions open on the payoff, 4 hashtags each in the description rather than the title, 7-8 tags. Research fixed the shape: >15 hashtags makes YouTube ignore all of them, and the first ~40 characters of a Shorts title are what actually get read |
