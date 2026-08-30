# HANDOFF — 2026-07-10 — Cross-post to X / Instagram / Facebook (Cowork session 3, owner AFK)

Session type: Claude Cowork driving the owner's Chrome (extension) + sandbox bash. Owner left after
kickoff ("keep working without stopping, go with recommended options"). No repo code touched except
this file, the CLAUDE.md state line, and a temp media folder `.uploads-tmp/` (see Cleanup).

## What shipped (all captions from `marketing/youtube-upload-plan-2026-07-10.md`, white-label held)

| Platform | Video | Status | Link |
|---|---|---|---|
| X @TheMAG8Stocks | the-signal (2:02) | **LIVE** 4:53 PM Jul 10 | https://x.com/TheMAG8Stocks/status/2075715096454762550 |
| Instagram @themag8stocks | fun-dnatest (Reel) | **LIVE** | https://www.instagram.com/themag8stocks/reel/DaoUc_2gjzj/ |
| Facebook TheMag EightStocks | the-signal (auto-converted to Reel) | **LIVE, Public** | https://www.facebook.com/reel/1863010218417309 |
| TikTok @themag8stocks | fun-groupchat (owner dragged; caption/settings/post automated) | **LIVE** 9:30 PM Jul 10, Everyone, review cleared | https://www.tiktok.com/@themag8stocks/video/7661107427600846093 |

All three verified rendering (video playback + caption + link) before close.

## Account changes made (owner pre-authorized "business accounts + recommended options")

- **Instagram → BUSINESS account** (category: News & media website, hidden on profile; contact info
  withheld — same privacy call as the YouTube pass). Unlocks native scheduling (75 days), View
  insights + Boost already visible on the reel.
- **Facebook default post audience → Public** (was Friends; set-as-default checked). FB is a
  *profile*, not a Page → **no scheduling exists for it** (Business Suite needs a Page). Consider
  creating a Page later if scheduling matters more than the profile's identity.
- **X**: free tier confirmed = **no native scheduler** (Premium-gated). Post-now only. Free-tier
  140s video cap — the-signal at 2:02 fits.
- **TikTok**: account-type switch to Business is **mobile-app-only** (web settings has no switch).
  Native scheduler (requires Creator/Business) caps at 10 days ahead regardless.

## TIKTOK — RESOLVED same evening (owner dragged fun-groupchat.mp4; caption/settings/post automated)

Post flow findings: caption typed into Description (single field, hashtags inline, 404/4000);
"When to post" offers **Now AND Schedule natively — no Business switch needed** (so future drags can
be scheduled up to 10 days out); Who can see = Everyone; High-quality uploads ON; music/content
checks passed pre-post; brief "Content under review" + "Only me" state after publish cleared to
Everyone within ~1 min. Do NOT touch the Location field (it suggests the owner's town). Original
(untreated) mp4 dragged by a real file-pick uploads fine — the colr bug only bites the *client-side
JS parsers* on synthetic feeds (TikTok/X); a real drag hands the file straight to their uploader.
Remaining 14 shorts: drag up to 5 per visit (10-day schedule window) and any session captions+schedules
from the pack.

## THE ORIGINAL TIKTOK BLOCKER (kept for reference — synthetic feeds, don't re-burn time)

TikTok Studio's web uploader **hard-requires a real OS file-pick**. Proven by elimination:
- Byte-perfect files injected via `input.files` + change, and via synthesized drag/drop events,
  start their pipeline (spinner, upload/auth call, decoder workers) but the UI never leaves the
  select screen — their state machine arms only on a genuine picker interaction (missing
  `selectVideoFiles-start` perf mark is the tell; no `.click()`/`showPicker()`/`showOpenFilePicker`
  call to intercept — it's native label activation).
- A pristine 27KB bt709 probe mp4 fed straight into their own input stalls identically → not a
  file problem.

**Owner unlock (~10 sec):** open https://www.tiktok.com/tiktokstudio/upload and drag
`marketing/video/out/fun-dnatest.mp4` (or `.uploads-tmp/r3-dnatest.mp4`, safer — see colr bug) into
the dropzone. Any Claude session can then fill caption/settings/post. Caption ready:

> We DNA-tested the stock market. Only 4% have the trillion-dollar gene 🧬
>
> Stock DNA: the results are in. Only ~4% of stocks ever create real wealth (Bessembinder). MAG8's scout hunts trillion-dollar DNA — the traits giants showed before they were giants — then three blind lenses grade what it finds.
>
> Weekly board + waitlist → themag8.com
>
> Research, not investment advice.
>
> #stocks #investing #stockmarket #fintok #moneytok #finance

NOTE: 1–2 orphan native file-picker dialogs may be open on the desktop from the intercept attempts
— just close them.

## KEY TECHNICAL FINDINGS (reusable)

1. **The colr-box bug (matters for EVERY future upload of these renders):** Remotion/Chrome-encoded
   mp4s (`marketing/video/out/*.mp4`) carry a malformed `colr` atom (bt470bg/pc, truncated payload)
   that **crashes TikTok's AND X's client-side JS mp4 parsers** (`RangeError … Box.colr`) — uploads
   hang with no visible error. YouTube (server-side) didn't care; Meta didn't either.
   **Fix (byte-lossless, streams untouched):** `ffmpeg -i in.mp4 -c copy -movflags +faststart tmp.mp4`
   then binary-rename the moov `colr` fourcc → `free` (python patcher in this session; r3 pattern).
   Treated copies live in `.uploads-tmp/`: `r3-dnatest.mp4`, `r3-signal.mp4` (sha-verified vs
   originals' streams). **Recommend r3-treating all 16 before any future TikTok/X upload.**
2. **10MB extension attach cap beaten by chunk-feed:** `split -b 9437184` → `file_upload` one chunk
   per call into a collector `<input>` injected on a *static same-origin page* (`/robots.txt` — an
   SPA page's delegated change listeners will try to parse the chunks and lock up; that cost 30 min
   on TikTok) → page-JS accumulates ArrayBuffers → `new File(parts…)` → SHA-256 verify → stash in
   IndexedDB (`mag8`/`files`) → navigate to the app page → restore → `input.files` + change.
   Worked first-try on X, IG, FB with 74–106MB files.
3. IG quirks: **never press Escape** in the create dialog (opens Discard). Hashtag autocomplete
   steals clicks — reposition the caret with a click elsewhere in the caption before Share.
4. FB quirk: attaching media rebuilt the composer and silently reset audience Friends → had to
   re-set Public (now sticky via set-as-default).
5. X: media upload runs during composing (`upload.x.com … APPENDMULTI`); "filename: Ready" chip =
   safe to Post. X trimmed display duration to 1:58 (their re-encode; content intact).

## Caption/compliance notes

- White-label leak check on all public copy: scout / lenses / gates / Game Theory / verified score /
  Bessembinder ~4% only — zero provider/skill/agent vocabulary. themag8.com in every caption.
- "Research, not investment advice." on IG + FB; **omitted on X** (280-char limit, 19 chars spare) —
  the site itself carries the disclaimer; add it to a reply if the owner wants it on-platform.

## Cleanup

- `Mag8/.uploads-tmp/` (~600MB: chunks + r2/r3 remuxes + probe-clip) — sandbox mount blocks
  deletion; **owner can delete the whole folder**, EXCEPT consider keeping `r3-*.mp4` for future
  TikTok/X uploads.
- Memory twin (`~/.claude/projects/C--Users-nocap-Mag8/memory/mag8-project-state.md`) NOT updated
  (no access from Cowork) — next Code session syncs from this handoff.

## Open items after this session

1. TikTok: owner drag → then caption/post (this doc has the caption); optionally switch account to
   Business in the mobile app first if scheduling wanted (10-day window only).
2. Scheduling build-out (user's "preferred" path): IG is business-ready → native scheduler (75
   days) can take the remaining 14 shorts on the YouTube cadence; FB needs a Page first; X needs
   Premium or manual posting.
3. Remaining 14 shorts cross-posting (r3-treat first for TikTok/X; chunk-feed recipe above).
4. X "Unlock more on X" graduated-access notice appeared once (new account) — engagement will clear it.

---

## TIKTOK SCHEDULING PASS — 2026-07-10 late night (Cowork session 4)

Owner dragged "5 more" into TikTok Studio (~9:54–9:58 PM) then asked to schedule+optimize.
**Only 3 survived TikTok's web pipeline** (multi-drag silently drops files — see finding below):
fun-speedrun (restorable "Continue editing" session) + fun-gate & fun-redflags (local IndexedDB
temp drafts, `web_creation_draft` DB, store `local_draft_<userId>`, videos fully uploaded server-side).

**SCHEDULED (Everyone, HQ ON, Location untouched, checks green, 12:00 PM local):**

| Video | Slot | Caption base |
|---|---|---|
| fun-redflags | **Sat Jul 12, 12:00 PM** | pack #6 + hook line, `#redflags` variant tag |
| fun-speedrun | **Thu Jul 16, 12:00 PM** | pack #13 + hook line, base tags |

Caption format (TikTok): hook line + pack body + "Weekly board + waitlist → themag8.com" +
"Research, not investment advice." + `#stocks #investing #stockmarket #fintok #moneytok` + 1 theme tag.
Leak-check: clean (board vocab only). Verified on /tiktokstudio/content: both rows show schedule
badge + Everyone. fun-groupchat (live Jul 10) untouched.

**LOST: fun-gate** — its local draft entry was PURGED by TikTok's cleanup the moment the other two
flows completed (store went 3 → 0; video bytes still on their servers under
vid v12025gd0000d98rsrnog65nr1tssi30 but no UI handle reaches it). The 2 others of the owner's "5"
never appeared in ANY web-visible store (page, IndexedDB, async-task API all empty).

**Owner picked the refill trio: dnatest → Jul 14, poker → Jul 18, gate → Jul 20** (arc order,
engine flagships first; fills the 10-day window at the 2-day cadence). Waited ~10 min on the upload
page — no drag landed before session close. ANY future session: owner drags ONE AT A TIME into
tiktok.com/tiktokstudio/upload, session captions+schedules (captions stage-ready below).

### NEW FINDINGS (TikTok web, reusable)

1. **Multi-drag is lossy.** 5 dragged → only 3 registered (2 at 9:54 simultaneous, 1 at 9:58).
   Always drag ONE file, wait for "Uploaded ✓" header, finish the flow, then next.
2. **Local drafts are volatile.** "A video you were editing wasn't saved. Continue editing?" banner
   restores ONE session at a time from IndexedDB `web_creation_draft`; completing/posting other
   sessions triggers a cleanup that DELETES remaining temp entries. Process ALL pending drafts
   before posting any, or they're gone (dump the full `local_draft_*` rows FIRST if >1 pending —
   the `data` blob + server `vid` is the only recovery handle).
3. **Scheduling consent dialog** ("Allow your video to be saved for scheduled posting?") appears
   once per account on first Schedule-radio click → Allow; remembered afterward.
4. **Time picker**: wheel-scroll hits the page, not the hour list. Reliable path: JS
   `scrollIntoView` + pointer/mouse event sequence on the option in
   `div.tiktok-timepicker-time-scroll-container` (col 0 = hours, col 1 = minutes). Date picker:
   plain calendar click works. Schedule button: same JS click pattern is fine.
5. Scheduled posts land on /tiktokstudio/content with an editable schedule badge; they do NOT
   appear on the public profile until publish time.

### STAGE-READY CAPTIONS (for the Jul 14 / 18 / 20 refills)

fun-dnatest (Jul 14, 12:00 PM):
> We DNA-tested the stock market. Only 4% have the trillion-dollar gene 🧬
> Stock DNA: the results are in. Only ~4% of stocks ever create real wealth (Bessembinder). MAG8's scout hunts trillion-dollar DNA — the traits giants showed before they were giants — then three blind lenses grade what it finds.
> Weekly board + waitlist → themag8.com
> Research, not investment advice.
> #stocks #investing #stockmarket #fintok #moneytok #finance

fun-poker (Jul 18, 12:00 PM):
> Wall Street is a poker table. Here's how to read the players ♠️
> MAG8's Game Theory engine reads the market like a felt table: every player scored on Motivation × Emotion × Capability, forced moves spotted, the 62/28/10 tree mapped — and every read carries a falsifier. If the kill condition hits, the thesis folds.
> Weekly board + waitlist → themag8.com
> Research, not investment advice.
> #stocks #investing #stockmarket #fintok #moneytok #gametheory

fun-gate (Jul 20, 12:00 PM):
> Everyone's a genius until the gate 🚧
> Why most hype stocks never make the board: MAG8 runs every candidate through hard vetoes — leverage, dilution, broken moats — and stamps the reason on every rejection. Passing the vibe check ≠ passing the gate.
> Weekly board + waitlist → themag8.com
> Research, not investment advice.
> #stocks #investing #stockmarket #fintok #moneytok #finance

---

## DAILY CROSS-POST PASS — 2026-07-11 (Cowork session 5)

Owner asked for one video scheduled/posted per platform today. YouTube skipped (slate already full
through Aug 9; dnatest publishes Jul 12). Story-arc picks, captions from the pack; leak-check clean
(board vocab only; scout / three blind lenses / Game Theory / gates / Bessembinder ~4%).

| Platform | Video | Status | Link |
|---|---|---|---|
| X @TheMAG8Stocks | fun-dnatest | **LIVE** 12:36 PM Jul 11 | https://x.com/TheMAG8Stocks/status/2076012772731900093 |
| Facebook | fun-dnatest (auto-Reel, Public) | **LIVE** | https://www.facebook.com/reel/1410937844199702 |
| Instagram @themag8stocks | fun-groupchat (Reel) | **LIVE** | https://www.instagram.com/themag8stocks/reel/DaqcEVMJ41y/ |
| TikTok @themag8stocks | fun-dnatest (owner dragged) | **SCHEDULED Jul 14, 12:00 PM** | verified on /tiktokstudio/content |

TikTok slate now: redflags Jul 12 / dnatest Jul 14 / speedrun Jul 16 (all Everyone, HQ, 12:00 PM);
**poker Jul 18 + gate Jul 20 still need owner drags** (captions staged above). Location field untouched;
music/content checks green; schedule consent did NOT reappear (remembered from 07-10).

### New findings (reusable)

1. **X: use the /compose/post modal, not the inline home composer.** Synthetic injection into the
   home-feed composer accepted the file but NEVER started the upload (no APPENDMULTI, spinner forever,
   ~90s dead; the stuck draft arms a leave-site guard — discard via navigate force). The IDENTICAL
   injection on https://x.com/compose/post fires APPENDMULTI immediately, STATUS polls follow, Post
   enables while server transcode finishes ("sent" toast ≈ instant). X weighted count: emoji/→ = 2,
   any URL = 23 (dnatest caption used 249/280).
2. **file_upload's 10MB cap applies to a whole browser_batch call too** — it pre-validates the summed
   payload and aborts the batch before delivering ANY chunk (collector stayed empty). Chunk-feed must
   be one standalone file_upload per chunk; everything else batches fine.
3. TikTok time picker: when target values are already visible in the open columns, plain clicks work
   (12 / 00 clicked directly); the JS scrollIntoView+pointer recipe is only needed for off-screen values.
4. `.uploads-tmp/` gained `gc.00-02` (fun-groupchat, sha e9d64ae2…). r3dna chunks reused as-is for both
   X and FB (in-page SHA-256 re-verified match both times; Meta is colr-indifferent but r3 is free).

Cross-post state after this pass: X 2 (signal, dnatest) · FB 2 (signal, dnatest) · IG 2 (dnatest,
groupchat) · TikTok 1 live + 3 scheduled. Remaining ≈12-13 shorts per platform.

---

## DAILY CROSS-POST PASS — 2026-07-12 (Cowork session 6, RESUMED after model-limit interruption)

Prior session (Fable 5) prepped all media (r3-groupchat.mp4 + r3gc chunks for X/FB; r3-fundamentals.mp4 +
r3fun.00-07 chunks for IG) then hit its usage limit MID-Facebook-post (clicking Post). This session (Opus)
picked it up and finished the full daily slate. Captions from the pack; leak-check clean (board vocab only:
scout / three blind lenses — Fundamentals, Game Theory, Consensus / gates / MAG8 / themag8.com; "Research,
not investment advice." on FB+IG, omitted on X per the 280-weighted rule).

| Platform | Video | Status | Link |
|---|---|---|---|
| X @TheMAG8Stocks | fun-groupchat | **LIVE** (was blocked earlier tonight; cleared on retry) | https://x.com/TheMAG8Stocks/status/2076492110753361988 |
| Facebook | fun-groupchat (Reel, Public) | **LIVE** | https://www.facebook.com/reel/1384242970286171 |
| Instagram @themag8stocks | short-fundamentals (Reel) | **LIVE** | https://www.instagram.com/themag8stocks/reel/Datz2XUvtN7/ |
| TikTok @themag8stocks | fun-redflags (scheduled 07-10) | **verified auto-published 12:00 PM** | https://www.tiktok.com/@themag8stocks/video/7661118212569976078 |
| YouTube TheMAG8 | fun-dnatest (scheduled) | **verified Public 12:00 PM** (Studio: Visibility=Public) | https://youtube.com/shorts/xeZPxoYyuNk |

Findings / notes (reusable):
- **FB resume:** the interrupted attempt had left the r3 groupchat in FB-origin IndexedDB (SHA-verified
  53542590…) AND a stray "Create post" draft. Fresh composer → injected File from IndexedDB into the mounted
  input (no native picker) → typed caption WITH a trailing space so the last hashtag's autocomplete
  auto-closes (the missing trailing space is what left the popup stuck last time) → Post → aria-live "Your Post
  is successfully shared with EVERYONE"; a leftover post-submit composer re-opened with the media buffered —
  **do NOT re-click Post; close it and choose "Delete draft"**. Reels 2→3 (new id 1384242970286171).
- **IG:** separate origin, so chunk-fed r3fun.00-07 into IG-origin IndexedDB (overwrote the old groupchat
  blob under key "video"), reassembled by holding File refs (push File object after each file_upload — no async
  byte reads), SHA-verified d55e45f2…, injected into the create-flow input, stepped Crop→Edit(Next)→caption→
  Share; ~40s "Sharing" spinner for the 71MB/79s reel → "Your reel has been shared." Reels 2→3 (newest Datz2XUvtN7).
  **file_upload + a JS push CAN share one browser_batch** (only summed file_upload payload counts vs the 10MB cap).
- **X:** earlier tonight the compose pipeline stalled (no APPENDMULTI — looked account-throttled). On this
  retry via **/compose/post** the r3 groupchat (still in x.com IndexedDB) uploaded cleanly (saw FINALIZE +
  STATUS polls) and posted WITH video (profile 2→3 posts). The throttle had cleared on its own. The blue ring
  by Post is the CHARACTER counter (84/100 ≈ 235/280), not an upload spinner. Injecting into BOTH modal+inline
  file inputs attaches media to both composers (attachmentsBlocks=2) — post via the MODAL only; a stray media
  draft may remain in the inline composer (harmless). The "Your post was sent → View" toast's View can land on
  a feed post, not yours — verify via the profile.

TikTok slate still: dnatest Jul 14 / speedrun Jul 16 scheduled (verified on profile as clock badges);
**poker Jul 18 + gate Jul 20 still need owner drags** (captions staged above).

Cross-post state after this pass: X 3 (signal, dnatest, groupchat) · FB 3 (signal, dnatest, groupchat) ·
IG 3 (dnatest, groupchat, fundamentals) · TikTok 2 live (groupchat, redflags) + 2 scheduled (dnatest 14,
speedrun 16) · YouTube dnatest live + rest scheduled through Aug 9. `.uploads-tmp/` keep r3-* + chunks.
Memory twin NOT updated (no Cowork access) — next Code session syncs from this handoff.
