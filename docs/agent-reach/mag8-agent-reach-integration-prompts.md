# Mag8 × Agent Reach — Claude Code Build Prompts

Nine prompts to wire [Agent Reach](https://github.com/Panniantong/Agent-Reach) into all four Mag8 skills as an automatic research layer, gated by one shared "practitioner & primary-source" standard.

**How to use this.** Run these one at a time, in order, as messages to Claude Code inside your Mag8 codebase (the repo containing the new-gen-stock, gt-predictor, institutional-forecast, and stock-scanner skill folders). Review the diff before moving to the next prompt — several of these edit files that already carry careful, specific language, and it's worth confirming Claude Code's edits keep that spirit rather than just bolting text onto the end. Commit after each one; each prompt ends with a suggested commit message.

**The standard, in one paragraph.** Agent Reach can reach a lot of platforms, but not everything on those platforms is worth using. Prompt 2 defines a hard filter: usable signal is either a primary-source statement (the entity's own words — a transcript, a filing, a direct quote — not a summary of it) or practitioner commentary (someone demonstrably in the field, judged by what they actually say, not by which platform they said it on). Everything else is a lead at best, never evidence. All four skills apply this the same way, via one shared file instead of four separate copies of the same judgment call.

**One honest gap before you start.** GitHub, YouTube, RSS, V2EX, Xueqiu, Bilibili, and public web/LinkedIn pages work with zero login and can be fully automatic starting today. Reddit and X/Twitter — genuinely the best channels for "engineers talking shop before it's news" and "the leader's actual words" — need a one-time manual cookie login, and Agent Reach's own docs are explicit that this carries real account-ban risk on the platforms themselves. That should be a deliberate decision with a burner account, not something installed silently as a side effect of Prompt 1. Prompts 1–8 build everything so it degrades gracefully without Reddit/X active; Prompt 9 (clearly marked optional) is where you turn them on when you're ready.

## Contents
1. Discover the repo & install Agent Reach
2. Create the shared standard
3. Wire it into new-gen-stock
4. Wire it into gt-predictor
5. Wire it into stock-scanner
6. Wire it into institutional-forecast (restrained)
7. Project-level docs + doctor-check script
8. Verification & changelog
9. *(Optional)* Turn on Reddit + X/Twitter

---

## Prompt 1 — Discover the repo & install Agent Reach

*Confirms the real file layout before anything gets edited, and brings in only the channels that need no login or risk decision.*

````
I'm building Mag8, a stock-research product made of four Claude Skills living in
this repo: new-gen-stock, gt-predictor, institutional-forecast, stock-scanner.
Each has a SKILL.md, and all but institutional-forecast have a references/
folder with supporting reference files.

1. Find all four skill folders. For each, report the exact path to SKILL.md
   and list what's in its references/ folder (if any). If you can't find one
   of them, stop and tell me instead of guessing at a path.

2. Confirm Python 3.10+ is available.

3. Install Agent Reach (https://github.com/Panniantong/Agent-Reach) by
   fetching and following its own install doc:
   https://raw.githubusercontent.com/Panniantong/agent-reach/main/docs/install.md
   Use the default check-only/safe install. Don't pass --system unless the
   install doc says the zero-config channels genuinely require it.

4. Run `agent-reach doctor` and show me the full output.

5. Only bring these channels online right now: web pages, YouTube, RSS,
   GitHub (public repos), Exa web search, V2EX, Xueqiu, Bilibili. Do NOT
   configure Twitter/X, Reddit, Facebook, Instagram, or Xiaohongshu — those
   need a manual cookie login and carry real account-ban risk per Agent
   Reach's own docs. That's a deliberate later step, not part of this one.

6. Create docs/agent-reach-setup.md recording: install date, the
   `agent-reach doctor` output, which channels are live, and a note that
   Reddit/X/Facebook/Instagram/Xiaohongshu are intentionally deferred
   pending a manual burner-account setup (Prompt 9, later).

Commit as "Install Agent Reach (zero-config channels only)".
````

---

## Prompt 2 — Create the shared standard

*The core deliverable. Every other prompt just points back to this file instead of re-deriving the same judgment call four times.*

````
Before touching any individual skill, create the one file all four will
point to for how they're allowed to use Agent Reach.

Create a new file at shared/agent-reach-standard.md (sibling to the four
skill folders — if that's not how this repo is laid out, put it wherever
makes sense given the structure from Prompt 1, but tell me exactly where)
with this exact content:

```markdown
# Agent Reach Standard — Practitioner & Primary-Source Filtering

Used by: new-gen-stock, gt-predictor, stock-scanner, institutional-forecast
(narrow use — see its own SKILL.md).

## Why this file exists
Agent Reach expands *where* a skill can look for information. It does not
lower the bar on *what counts as usable signal*. This file is the single
standard all four skills apply when using Agent Reach for qualitative or
sentiment research. Structured data pulls (a stock quote from Xueqiu, a star
count from GitHub) don't need this filter — it applies to anything that's
someone's opinion, claim, or narrative.

## The two tiers

**Tier A — usable as signal**
1. **Primary-source statements** — the actual words of the entity being
   discussed: an executive's own quote, an official transcript, a
   government filing or press release, a company's own post. Not a summary
   of it, not a reaction to it — the thing itself.
2. **Practitioner commentary** — posts or threads from people who
   demonstrate direct domain knowledge of the specific field under
   discussion: engineers, researchers, operators, and other insiders citing
   specifics (part numbers, benchmarks, internal roadmaps, firsthand
   technical or operational experience) that a casual observer wouldn't
   know or say. Judge this from what the post actually contains, not from
   which platform it's on — a technical thread on Reddit or V2EX from
   someone who clearly works in the field clears the bar; a generic
   reaction or hype post on the same platform does not.

**Tier B — not signal, at most a lead**
Generic retail sentiment, hype or meme posts, reaction threads with no
substantive claim, engagement-bait. This can tell you *what to go verify*,
but it never counts as verification, and it never moves a score,
probability, or verdict on its own.

## How to apply it, every time
1. **Classify before you use it.** For any qualitative content pulled via
   Agent Reach, decide Tier A or Tier B before it goes into the analysis.
   If it's a close call, say so in one line.
2. **Tier B is a lead, not evidence.** It can point you toward a primary
   source or a specific practitioner claim worth checking — it cannot
   stand in for that check.
3. **Prefer the primary artifact over a description of it.** If a
   transcript, filing, or press release is reachable, fetch that instead
   of a secondary summary or a post about it.
4. **Cite it like anything else.** Every piece of Tier A content used in an
   output gets a source and platform noted, the same as any other citation
   these skills already require.

## Why this isn't a new idea, just a new name for one already in use
- stock-scanner already weighs informed insider signals (cluster buys,
  CFO/independent-director purchases) far above routine or uninformed
  activity (references/methodology.md, "Smart-money and insider signals").
- new-gen-stock already treats "next Nvidia"-style social chatter as leads
  to verify, never gospel (playbook Step 2).
- institutional-forecast already refuses to improvise a number it can't
  verify from a fetched, dated source ("Omit beats improvise").

This file makes that judgment explicit, gives it a name, and applies it
consistently everywhere Agent Reach is used, instead of leaving it to be
re-derived each time.

## Automatic pre-flight (every skill runs this first)
Before any live-research step that uses Agent Reach:
- Run `agent-reach doctor`.
- If a zero-config channel needed for this step isn't active, bring it up
  now (no login required: web, YouTube, RSS, GitHub public repos, Exa web
  search, V2EX, Xueqiu, Bilibili).
- If a login-gated channel (X/Twitter, Reddit, Facebook, Instagram,
  Xiaohongshu) isn't configured, proceed without it rather than blocking
  the analysis — note in the output that the channel was unavailable.
- Never configure a login-gated channel automatically mid-run. That's a
  deliberate, one-time human decision (see docs/agent-reach-setup.md).

## Channel map by skill

| Skill | Auto from day one (zero-config) | Needs one-time login setup |
|---|---|---|
| new-gen-stock | GitHub (star/fork/contributor activity), V2EX, Xueqiu, YouTube | Reddit, X/Twitter |
| gt-predictor | YouTube, RSS, V2EX, Xueqiu | X/Twitter, Reddit |
| stock-scanner | YouTube, GitHub | Reddit, X/Twitter |
| institutional-forecast | LinkedIn (public pages), web search — discovery only | X/Twitter — discovery only, never as the source of a number |
```

Confirm the exact path you used and show me the file. Commit as
"Add shared Agent Reach standard (practitioner & primary-source filtering)".
````

---

## Prompt 3 — Wire it into new-gen-stock

*Adds the developer-ecosystem signal your own megacap-dna.md already names as the real early CUDA tell, plus practitioner chatter for the World-State Scan.*

````
Open the new-gen-stock skill (SKILL.md, and references/megacap-dna.md where
relevant). Make these edits:

1. In Step 0 ("Refresh the lens"), add: before starting research, run
   `agent-reach doctor`. Read shared/agent-reach-standard.md (the path from
   Prompt 2) alongside references/megacap-dna.md — it governs every Agent
   Reach pull in the steps below.

2. In Step 1 ("World-State Scan"), add a bullet: alongside the existing web
   search for each wave, pull practitioner-level chatter via Agent Reach's
   V2EX channel (and Reddit, once configured) — people discussing the
   specific bottleneck or gap from hands-on experience, not general
   commentary. Filter everything through the standard's Tier A/B rule
   before it goes into the State of the World section.

3. In Step 2 ("Source Candidates"), add two things:
   a. A new sourcing angle: for candidates with an open-source SDK, API, or
      developer platform, pull GitHub activity via Agent Reach (star/fork/
      contributor trend, release cadence, recent commit activity) as an
      early read on developer-ecosystem traction.
   b. For the existing "next Nvidia / next Tesla / next Palantir" angle,
      note it should now be pulled via Agent Reach's X/Twitter channel
      where configured, and stays Tier B by default (a lead to verify)
      unless the specific post is from a practitioner or the entity
      itself, per the standard.

4. In Step 3 ("Deep Research"), add: where a candidate's supply chain or
   comparables run through China, pull Xueqiu for stock data, hot posts,
   and named comparables that Western sources typically miss.

5. In the DNA Scorecard section, add a line to Dimension 3 (Platform /
   Network Effects): when GitHub developer-ecosystem data is available for
   a candidate, cite the actual trend (e.g. "contributors grew from X to Y
   over N months") as supporting evidence for the score instead of a
   purely qualitative call.

Show me a diff before committing. Commit as
"Wire Agent Reach into new-gen-stock".
````

---

## Prompt 4 — Wire it into gt-predictor

*Upgrades Step 2A's data-grounding from generic web search to actual primary-source statements, and turns the Leading Indicator Calendar into something genuinely monitored.*

````
Open the gt-predictor skill (SKILL.md and references/prediction_log.md,
gt_laws.md, asset_map.md, event_templates.md, scoring_rubric.md). Make
these edits:

1. In the "Reference Files — Load When Relevant" table near the top, add a
   row for shared/agent-reach-standard.md (the path from Prompt 2), marked
   "Load on every run, alongside prediction_log.md — the source-quality bar
   for anything pulled via Agent Reach."

2. In Step 2A ("Ground in current data"), extend the existing instruction
   (currently "web search — do not skip") to also require Agent Reach
   where it adds something web search alone doesn't:
   - X/Twitter and YouTube for primary-source statements — an official's
     actual words or an actual transcript, not a paraphrase — feeding the
     "current status" and "regime/direction check" bullets.
   - V2EX and Xueqiu specifically when a structural thesis touches China
     (de-dollarization, deglobalization, or the tech-geopolitics law) —
     these give a vantage point Western-only search misses.
   Every pull gets classified Tier A/B per shared/agent-reach-standard.md
   before use; run `agent-reach doctor` first and proceed without any
   channel that isn't active rather than blocking the analysis.

3. In Step 8 (Leading Indicator Calendar), add: where the signal source is
   a body that publishes an RSS feed (a central bank, EIA/IEA, etc.),
   register that feed via Agent Reach so the calendar becomes something
   actually monitored going forward, not just a note to re-search later.

4. In the output template's DATA GROUNDING section, add a line so the
   report shows when a primary-source Agent Reach pull was used,
   consistent with how "Data retrieved: [date/time]" is already shown.

Show me a diff before committing. Commit as
"Wire Agent Reach into gt-predictor".
````

---

## Prompt 5 — Wire it into stock-scanner

*Adds retail-attention color and primary-source earnings-call reads without touching the Piotroski/Altman gates, which stay untouched on purpose.*

````
Open the stock-scanner skill (SKILL.md and references/methodology.md,
screening-thresholds.md, valuation-templates.md, scoring-rubric.md,
output-template.md). Make these edits:

1. In Step 2 ("Source candidates"), add Reddit and X/Twitter (once
   configured) as additional sourcing angles alongside the existing
   web-search angles — specifically for surfacing chatter around recent
   insider/institutional buying or a beaten-down name people in the space
   are discussing. Classify everything Tier A/B via
   shared/agent-reach-standard.md.

2. In Step 4 ("Deep research"), add:
   - YouTube for earnings-call replays and management interviews, as a
     primary-source read on capital-allocation language and founder
     conviction, instead of relying on secondary paraphrase.
   - GitHub, for software/SaaS candidates, as one more input to the
     competitive-landscape comparison (methodology.md checklist item 8) —
     contributor/release activity vs. the 2-3 closest rivals.

3. Add an explicit guardrail wherever it fits best (Step 4 or the top of
   methodology.md): none of this Agent Reach content ever overrides Gate
   A/B/C or the Piotroski/Altman veto in screening-thresholds.md. It's
   narrative color for the "setup" and "why it's mispriced" sections of
   the output template — never a new scored dimension, never a reason to
   wave a gate failure through.

Show me a diff before committing. Commit as
"Wire Agent Reach into stock-scanner".
````

---

## Prompt 6 — Wire it into institutional-forecast (restrained)

*The one skill where this needs a narrower leash — its whole design is "live-verify everything, omit beats improvise, institution over individual," and that doesn't change.*

````
Open the institutional-forecast skill (SKILL.md — self-contained, no
references/ folder). Make these edits more conservatively than the other
three skills:

1. Add a new bullet to the "Sourcing Rules — Read Before Anything Else"
   section: Agent Reach's X/Twitter and LinkedIn channels may be used for
   discovery only — finding that a desk has published something today
   faster than a generic search would, or confirming a current analyst's
   name and role via their public LinkedIn page before attributing a quote
   to them (consistent with the existing rule to name an analyst only when
   a fetched source directly quotes them). A social post is never itself
   the source of a target, a stance, or a figure — always resolve to the
   actual fetched, dated institutional publication.

2. Add one explicit line forbidding Reddit/X sentiment from being used as
   a stand-in for the Consensus Dashboard's "Balance of Views" or Stance
   fields — those come only from verified institutional sources, as
   already specified.

3. In the optional "Contrarian Watch" and "Positioning Indicator" modules,
   note that Agent Reach can add color there specifically (both are
   already subjective/qualitative by design) — still Tier A only, per
   shared/agent-reach-standard.md, which this skill should reference
   alongside its own sourcing rules.

Show me a diff before committing. Commit as
"Wire Agent Reach into institutional-forecast (discovery only)".
````

---

## Prompt 7 — Project-level docs + doctor-check script

*Makes the integration visible at the project level and gives you one command to check status before any run, regardless of how the four skills end up being invoked.*

````
Two things to finish wiring this together at the project level:

1. Update mag8-project-brief.md: add a short new section noting that all
   four skills now use Agent Reach as an automatic research layer, gated
   by shared/agent-reach-standard.md. Two or three sentences is enough —
   point to the standard file rather than restating it.

2. Create scripts/agent-reach-check.sh, a small script that runs
   `agent-reach doctor` and prints a clean summary of which channels are
   active and which are pending manual setup (read the "pending" list from
   docs/agent-reach-setup.md). This is meant to be run before kicking off
   any skill, regardless of how the four skills end up being invoked.

Commit as "Add project-level Agent Reach docs and doctor-check script".
````

---

## Prompt 8 — Verification & changelog

*A consistency pass so nothing was left half-wired, and a record of exactly what changed.*

````
Do a final review of everything from this integration:

1. Re-read all four SKILL.md files and shared/agent-reach-standard.md end
   to end.
2. Confirm every skill references the standard file with a correct,
   working relative path, and that each has the pre-flight step
   (`agent-reach doctor` before any Agent-Reach-based research).
3. Run `agent-reach doctor` again and check it still matches
   docs/agent-reach-setup.md — update the file if anything drifted.
4. Write a short changelog at docs/agent-reach-integration-changelog.md
   listing every file this integration touched and a one-line summary of
   what changed in each.

Show me the changelog. Commit as
"Verify Agent Reach integration and add changelog".
````

---

## Prompt 9 — *(Optional)* Turn on Reddit + X/Twitter

*Only run this once you've actually decided to accept the setup cost and the ban-risk tradeoff on a burner account — not as a default next step.*

````
Only run this when I've decided to actually turn Reddit and X/Twitter on —
they're the two channels most likely to carry the "engineers talking shop"
and "primary rhetoric" signal, but they need a real decision first, not a
default.

1. Before doing anything else, confirm out loud that this should use a
   dedicated/burner account for each platform, not my main one — Agent
   Reach's own docs are explicit that scripted access to these platforms
   risks the account being flagged or banned.
2. Walk me through Agent Reach's documented flow for each: exporting
   cookies via Cookie-Editor for X/Twitter and running
   `agent-reach configure twitter-cookies "..."`; the OpenCLI browser-
   session flow for Reddit (there's no zero-config path for Reddit per
   Agent Reach's own docs).
3. Once configured, run `agent-reach doctor` to confirm both are active,
   and update docs/agent-reach-setup.md accordingly.
4. Remind me: these two channels are where the Tier A/B filter in
   shared/agent-reach-standard.md matters most, since they're the most
   chatter-heavy of everything Agent Reach touches.

Commit as "Configure Reddit and X/Twitter channels (manual, burner accounts)".
````

---

Re-run Prompt 8 any time after future edits to check the integration is still consistent.
