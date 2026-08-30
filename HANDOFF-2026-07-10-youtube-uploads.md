# HANDOFF — 2026-07-10 — YouTube channel populated (Cowork session)

Session type: Claude Cowork (desktop) driving the owner's real Chrome via the Claude-in-Chrome
extension into YouTube Studio. No repo code touched except two marketing docs (this file +
`marketing/youtube-upload-plan-2026-07-10.md`) and the CLAUDE.md state line. No renders, no deploys.

## What shipped

**TheMAG8 YouTube channel (UCksCjqUEx1-FFOnXqEjpFdg) went from empty → 16 videos.**

- `the-signal.mp4` (2:03, 1920×1080) — **PUBLIC immediately**, Jul 10: https://youtu.be/OSAv2laZ6XM
  Title: "The Next NVIDIA Won't Look Like NVIDIA — Here's the Machine That Hunts It | The Signal".
  Category Education, language English, 24 tags (447/500 chars).
- **All 15 vertical shorts SCHEDULED**, every 2 days at 12:00 PM local, Jul 12 → Aug 9, story-arc
  order (flagship engine films first, the three lens explainers woven between memes). Owner skipped
  the preferences form → recommended defaults locked (start Jul 12, 12:00 PM, story arc).

| # | Publish | File | ID |
|---|---------|------|----|
| — | LIVE Jul 10 | the-signal | OSAv2laZ6XM |
| 1 | Jul 12 | fun-dnatest | xeZPxoYyuNk |
| 2 | Jul 14 | fun-groupchat | Wy5nvHuB8yk |
| 3 | Jul 16 | short-fundamentals | FmBwkQssiwE |
| 4 | Jul 18 | fun-poker | pVm1QHkEYkM |
| 5 | Jul 20 | short-macro (Game Theory) | ChOii2U9DJA |
| 6 | Jul 22 | fun-redflags | AddmOjNgZgY |
| 7 | Jul 24 | fun-yearbook | ILKKzSfkXio |
| 8 | Jul 26 | short-consensus | KmUbhIoyx5w |
| 9 | Jul 28 | fun-eightball | hIuXaK-YdwE |
| 10 | Jul 30 | fun-forecast | WITn1M7I9nE |
| 11 | Aug 1 | fun-gate | _d63f5BY3ik |
| 12 | Aug 3 | fun-naturedoc | TMgRdqVY5fk |
| 13 | Aug 5 | fun-speedrun | str50UyVIUk |
| 14 | Aug 7 | fun-replay | zQaevqrl56M |
| 15 | Aug 9 | fun-coldcase | 0VpuJyZs3dM |

## Metadata (single source: `marketing/youtube-upload-plan-2026-07-10.md`)

Full pack of titles / descriptions / hidden tags per video, reusable verbatim for TikTok/IG/FB/X.
Rules applied everywhere:
- `https://themag8.com` is **line 1 of every description** (owner requirement), waitlist CTA phrasing.
- Every description ends "Research, not investment advice." + 3–5 hashtags (#Shorts on all shorts).
- WHITE-LABEL held: scout / lenses / engines / gates / verdict vocabulary only; "Game Theory" (never
  the dead name); no provider/skill/agent words anywhere in public copy; real mega-caps only in safe
  aspirational framings ("the next NVIDIA"); the only stat used is the disclosed Bessembinder ~4%.
- Tags are per-video (12–24 each, comma format), CTR keywords front-loaded in titles, one emoji max
  on fun-short titles, none on the long form.

## Upload settings state

- Audience: channel default already "not made for kids" — inherited by all 16 (verified per video).
- the-signal: Category **Education**, Video language **English** set individually.
- Shorts: category/language left default (Studio auto-guessed "Music" on the long form before fix —
  the shorts likely carry wrong auto categories; see follow-ups).
- No Altered-content question appeared in any wizard (not required for this account/flow).
- Copyright checks: "No issues" on everything that surfaced a checks page.
- Thumbnails: long form = auto frame (custom needs channel verification); Shorts thumbs only editable
  in the YouTube mobile app.

## How it was done (repeatable automation recipe)

1. **Claude-in-Chrome `file_upload` caps at 10 MB/call** — videos are 23–106 MB, so programmatic
   attach is impossible. Owner did ONE manual assist: selected all 16 mp4s in Explorer and dragged
   them into the Studio upload dialog → 16 drafts. Everything after was automated.
2. Per-video loop (all coordinates stable at 1568px-wide window):
   navigate `https://studio.youtube.com/channel/<id>/videos/short?filter=%5B%7B%22name%22%3A%22TITLE%22%2C%22value%22%3A%7B%22name%22%3A%22CONTAINS%22%2C%22value%22%3A%22<frag>%22%7D%7D%5D`
   (filtered URL → exactly one row) → Edit draft (1511,258) → title (649,241) ctrl+a+type →
   desc (649,362) type → **Escape** (hashtag autocomplete popup steals the next click otherwise) →
   scroll 8 → Escape → Show more (472,546) → scroll 8 → tags (649,228) type with trailing comma →
   Next ×3 (1131,658) → Schedule expander (649,512) → date field (517,406) ctrl+a + type
   "Jul 14, 2026" + Return (typed dates commit; no calendar-cell clicking needed) → time (644,406)
   ctrl+a + "12:00 PM" + Return → Schedule (1119,658) → confirm dialog Close (944,483).
3. Verification: `get_page_text` on the unfiltered Shorts tab — all 15 rows read "Scheduled" with the
   exact dates above; Videos tab shows the-signal "Public / Published Jul 10, 2026".
4. One misfire mid-run (clicking stale coordinates after a confirm dialog landed in a video's
   Comments page) — recovery rule: always re-enter via a fresh filtered URL, never click through
   stale list coordinates.

## Notables / channel hygiene

- Channel has pre-existing content that was NOT touched: "Tim Ha SHP Presentation" (Unlisted, Jul 8)
  on Videos, and ~23 old **Private** shorts (ragebait/roblox/brainrot, Jan–Feb 2026, some with
  1.5k–2.5k views). All private/unlisted so invisible to the public, but owner may want them deleted
  for a clean brand channel before pushing the channel URL anywhere.
- YouTube shows: "To make external links clickable, first complete a one-time verification" — the
  themag8.com links render as plain text until that's done.

## SAME-DAY SETTINGS PASS (Cowork session 2, 2026-07-10) — max-reach channel optimization

All via Claude-in-Chrome into Studio. WHITE-LABEL held on every new public string (scout/lenses/
engines/gates/"Game Theory"/Bessembinder ~4% only; no provider/skill/agent words).

1. **Shorts bulk-fixed** (Content → Shorts → filter Visibility: Has schedule → select 15):
   Category **Entertainment** + Video language **English** on all 15; then the 3 lens explainers
   (Fundamentals/Game Theory/Consensus) re-set to Category **Education**. Verified on short-macro's
   details page (Education + English stuck). Filter trick matters: unfiltered select-all grabs the
   ~15 old private shorts too (30 rows).
2. **Channel keywords REPLACED** — were leftovers from the channel's past life ("sad music, lofi,
   viral shorts"...actively mis-signaling the algorithm). Now 19 finance terms: stock market,
   investing, stock research, stock analysis, growth stocks, next nvidia, next magnificent 7,
   trillion dollar stocks, future mega cap stocks, stock picks, weekly stock rankings, stock
   leaderboard, game theory investing, fundamentals, finance, stocks, MAG8, themag8, English.
3. **Upload defaults fixed** (Settings → Upload defaults): default Category was **Music** (source of
   the-signal's wrong auto-category) → now **Entertainment**; Video language + Title/desc language →
   **English**; default description = themag8.com line + "Research, not investment advice."
4. **Channel profile**: Links section got its first entry — "MAG8 weekly board + waitlist" →
   https://themag8.com (renders under handle; clickable after verification). Video watermark display
   changed End-of-video → **Entire video**. Country already US; contact email left EMPTY on purpose
   (owner's personal gmail would go public). Channel description/banner/mark were already on-brand.
5. **Three public playlists** (descriptions carry themag8.com):
   - "The Three Lenses — How MAG8 Grades Stocks" (4): the-signal + 3 lens explainers
   - "Engine Files — Inside the MAG8 Machine" (4): dnatest, yearbook, poker, forecast
   - "MAG8 Memes — Finance, But Verified" (8): the remaining fun shorts
   Studio bug: after "Add videos" → Done, a stale dialog re-renders still-open — click **Cancel**
   (clicking Done again duplicates; had to remove 3 dupes by hand on playlist 1).
6. **Home tab layout was OFF** → toggled ON + published: Channel trailer = the-signal (plays for
   non-subscribers), For You, Videos, Short videos, Created playlists, + the 3 playlist sections.
7. **Comment posted on the-signal** (owner-approved): "The weekly board + waitlist →
   https://themag8.com — eight names, one board, rebuilt every week. New videos every 2 days through
   August." **PINNING BLOCKED** — pin requires the same one-time channel verification (owner chose
   to skip this session). Verification now unlocks THREE things: clickable links, custom thumbnails,
   AND comment pinning.

## Open items (in priority order)

1. **Channel verification** (one-time, Studio prompts under any description field) → makes the
   themag8.com links clickable in all 16 descriptions + channel Links; unlocks custom thumbnails;
   AND unlocks pinning the already-posted waitlist comment on the-signal.
2. ~~Bulk-edit the 15 shorts~~ DONE (settings pass above).
3. Custom thumbnail for the-signal once verified (auto frame is serviceable, not optimal).
4. ~~Post waitlist comment on the-signal~~ POSTED (pin pending verification); repeat per short as
   each publishes.
5. ~~Playlists~~ DONE (3 live, sections on Home tab).
6. Cross-post the same pack to TikTok / Instagram / Facebook / X — accounts are branded and signed in
   (owner confirmed) but nothing posted there yet; metadata doc is the copy source.
7. Watch first Shorts performance (Jul 12–16) before considering time-slot changes — schedule edits
   are cheap (Content page → visibility column), re-uploads are not.
8. Memory twin (`~/.claude/projects/C--Users-nocap-Mag8/memory/mag8-project-state.md`) NOT updated —
   Cowork session had no access outside the Mag8 folder. Next Claude Code session should sync it
   from this handoff + the CLAUDE.md state line.

## ZERO-VIEWS CHECKLIST AUDIT — 2026-07-11 (Cowork session 5, owner ran a Help-forum checklist)

Full pass over the forum Product-Expert checklist against the channel + the-signal (OSAv2laZ6XM):
feature eligibility now ALL THREE tiers Enabled (verification DONE since the 07-10 sessions — owner
also already set the custom thumb + title A/B "Test & compare" on the-signal, 13d14h left, "not
enough information" yet); Public ✓ not-MFK ✓ Education ✓ English ✓ 24 tags ✓ no notices/strikes ✓.
TWO FIXES APPLIED+SAVED: (1) altered-content/AI question was UNANSWERED on the details page (the
07-10 wizards never showed it) → answered **No** (stylized animation, no realistic person/event);
SAME SESSION: swept ALL 15 scheduled shorts — every one had the question unanswered → set **No** +
Saved on each (JS recipe: expand Show more, tp-yt-paper-radio-button exact-text 'No', ytcp-button#save;
save-disabled-after = commit proof; MFK "not made for kids" re-confirmed true on all 15). (2) Title &
description language was unset → English. Reach since publish: 3 impressions / 66.7% CTR / 2 views / 1 unique,
traffic 100% Channel pages, zero Browse/Search/Suggested → NOT a flag; it's a 2-subscriber day-old
channel with no external push. Real levers: Shorts slate (starts Jul 12), cross-posting the youtu.be
link on the live socials, deleting the ~23 old private ragebait shorts (hygiene item, still open).
