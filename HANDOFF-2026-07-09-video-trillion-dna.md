# Handoff — trillion-DNA scout framing + text-fit/contrast pass, ALL 12 films (2026-07-09) + FORMULA.md

**Deliverables:** all 12 videos re-rendered in `marketing/video/out/` (master 101 MB, lens
shorts 68–72 MB, fun shorts 22–53 MB — timestamps 2026-07-09 ~8:20–8:33 PM, exit 0), plus
`marketing/video/FORMULA.md` — the new compounding owner-request rulebook (see §5).
Commits: `9a57c33` (video pass), `63895f9` (storyboard sync), + this handoff/formula commit.
**Committed locally, NOT pushed** — a push to main auto-deploys on Railway (owner's call).

## 1. What was asked

1. Wherever the videos mention the **scout**, don't let it be a plain "scout" — make it known
   it scouts **stocks with the DNA of trillion-dollar stocks, BEFORE they became
   trillion-dollar stocks** ("scout alone sounds boring, doesn't represent MAG8's full
   capabilities"). Apply to ALL videos.
2. In ALL videos: **all text fits its designated box/section** (nothing overlaps outside its
   box), **no dark text on dark backgrounds, no light text on light backgrounds**.
3. (Follow-up, same session:) write this handoff, mine ALL past handoffs for video feedback,
   and save every owner request into a **formula md** so videos compound — noted in CLAUDE.md.

## 2. Scout → trillion-DNA copy (master + 3 lens shorts; fun shorts never say "scout")

| Where | Before | After |
|---|---|---|
| Master S05 headline | "One scout finds the cohort." | **"One scout hunts trillion-dollar DNA."** + NEW muted sub-line "The traits trillion-dollar stocks had — before they became trillion-dollar stocks." (F.body 33, C.muted, fades 112–126; Kinetic delay 100→90; chip unchanged) |
| Shorts V03 headline | "First, a scout\nscreens the field." | **"First, a scout hunts\ntrillion-dollar DNA —\nbefore the trillion."** (3 lines, size 68 — header block ends ~531px, clears the 582px field top) |
| Shorts V02 triad | "One scout. Three lenses.\nOne verdict." | **"One scout for trillion-dollar DNA.\nThree lenses. One verdict."** (line 1 ≈ 884px < 960 safe) |
| Master braid label (S10/S11) | DISCOVERY SCOUT | **TRILLION-DNA SCOUT** (landscape has room) |
| Portrait vbraid label (V10/V11) | SCOUT | **TRILLION-DNA** (the full "TRILLION-DNA SCOUT" at 22px mono spans to x≈360 and collides with FUNDAMENTALS at 337 — measured, not guessed) |
| S13 wire scout line | "cohort locked · 8 names" | **"trillion-DNA screen · 8 names"** |
| `marketing/video-prompts.md` | stale storyboard copy | synced to all of the above (S5 beat, S10 + V4 label lists) |

Canon copy + the standing rule live in `marketing/video/CLAUDE.md` (design-system section)
and FORMULA.md §B.

## 3. Contrast pass (dark-on-dark / light-on-light eliminated)

Rule (now standing): **text meant to be READ never sits in `C.dim` (#5a6274, ~3:1 on the
void) — use `C.muted` (~4.9:1) or brighter. `C.dim` is reserved for state-based de-emphasis**
(skipped splits, pruned branches, unchecked boxes, ignite-dimmed siblings — being faded IS
their meaning; those were kept). ~35 read-copy sites moved dim→muted across: vlib (VHead
strap, VFoot), flib (DeskStamps foot, MiniRow rank, FunEndcard disclaimer), S06/S12/S13/S19/
S21, V04/V11/V12/V13, VF_Fundamentals ×5, VM_Macro ×11 (M/E/C tags, roles, axes, legend,
"/10", entry note, both bottom notes), VC_Consensus ×2, eightball/gate ×4/groupchat/naturedoc/
redflags ×2/replay/speedrun/coldcase ×2. The one light-on-light bug: S16's footnote
"NO CONFLUENCE · NO BONUS · THAT'S THE SYSTEM WORKING" was `#9aa2b1` on white (~2.4:1) →
`C.whiteMuted` (5.5:1). White chapter otherwise clean (whiteInk/whiteMuted everywhere).

## 4. Text-fit pass — audit method + the six real bugs

Method: every scene file measured statically (mono = 0.6em/char + tracking; the ~52-char
limit for 24px/0.12em mono footers inside the 960px portrait safe width is now written into
the rulebook), then a ~50-frame fresh-DOM still sweep across ALL 12 comps (one-shot temp
script, bundle-once; deleted after), fixes, re-still, encode-path seq checks.

1. **S13 activity wire overflowed its panel**: 23px mono rows needed ~632px in a 496px inner
   panel — messages wrapped raggedly. Restructured to deliberate TWO-LINE entries (time+tag /
   message in `C.ink`); 7 entries fit with slack.
2. **S14 source pills overlapped the headline** ("SHORT INTEREST" ran into "Every verdict
   shows its work.", ~37px): pills got `lineHeight: 1` — stack bottom 873→785.
3. **S17 "GAP NOTED" chip wrapped to two lines** and the second line collided with the next
   text bar → `whiteSpace: 'nowrap'`. (Root cause class: an absolutely-positioned box's
   shrink-to-fit width is capped by `containing-block width − left offset`; three separate
   bugs this session — S17 chip, VF4 gap label, redflags stamps — all this class. Rule in
   FORMULA.md: absolutely-positioned text chips ALWAYS get nowrap.)
4. **VF4 "THE GAP: +19 PTS UNPRICED" wrapped** (1–2px over its available box) → nowrap.
5. **Redflags stamps covered card copy**: NOPE sat on profile-1's subtitle; WORTH A LOOK
   covered the keeper's ticker + "BORING. IN A GOOD WAY." → stamps moved to the card's empty
   mid-band (`left: 50%, top: 620`, ±12° kept) + nowrap ("WORTH A LOOK" wrapped inside its
   own border at 50% offset). Slam gag intact, zero text covered.
6. **Three portrait footers measured wider than the 960px safe zone**: VM2 formula (60 chars
   ≈ 1034px) → "WEIGHTED = [M + 2E + 4C] ÷ 7 · RE-CHECKED UNWEIGHTED"; VC3 → "THE SPREAD IS
   SIGNAL · WIDE MEANS UNSURE"; VF4 → "LOW EXPECTATIONS = ASYMMETRY · YOU BUY THE
   DIFFERENCE". VM2's two bottom notes also moved bottom 168→176 (SAFE.portrait.bottom=170).

## 5. FORMULA.md — the compounding video formula (NEW)

`marketing/video/FORMULA.md` distills EVERY owner request from all six video sessions
(2026-07-07 launch film → today), mined from the five video handoffs + this session:
hook rules (stocks-in-first-second, BigQuestion pattern), copy rules (trillion-DNA scout,
"Game Theory" naming, fun-front/deadpan-turn, taste ranking dialogue>procedural), read-time
rule (≥2.2s per sentence beat), type-size grade + floors, contrast rules, fit rules,
endcard contract (WaitlistCta on every close), brand laws (gold=verdicts, white-label,
cashtag discipline, zero spend), and the QA gate order — each rule tagged with the session
that created it. **Consult it at storyboard time AND at QA time; append every new owner
note to it** — that's the compounding contract, now written into `marketing/video/CLAUDE.md`
(workflow gate 1) and root `CLAUDE.md`.

## 6. Verification (rulebook gates, all green)

- `npx tsc --noEmit` clean · `npm run check:leak` 58 files, **0 hits** (twice).
- ~50 stills read across all 12 comps (two passes; every §3/§4 fix visually re-verified).
- Encode-path DOM-reuse seq checks: S05-Scout 85–140, S13-Mission 20–80, Short-Fundamentals
  470–560 (V03 window), Fun-Redflags 100–140 — no stuck-style/ghost-word artifacts.
- **Zero timeline changes → all scores stay valid** (no gen:score needed).
- Full 12-render queue exit 0; all mp4s freshly stamped, sizes sane (§ deliverables).

## 7. State / notes for next session

- Commits local on `main`, **not pushed** (Railway auto-deploy). Push when convenient;
  marketing/ is excluded from the app build so a deploy restart is the only side effect.
- `public/shots/run.png` (baked real-site screenshot in S13/V12) still shows the pre-rename
  "MACRO ASYMMETRY" pipeline label → **site reshoot pending** (HANDOFF-2026-07-07 §4 recipe);
  re-render S12/S13/S14 + V12 afterwards.
- Root CLAUDE.md, marketing/video/CLAUDE.md, video-prompts.md, memory twin all updated.
- Standing open items unchanged: waitlist stores/nothing sends; Railway trial → Hobby.
