# Handoff — the evidence layer (2026-09-02)

Owner asked: review the Agent Reach integration prompts, confirm it can be built into Mag8 safely,
then integrate it to improve the quality of the outputs — noting the prompts were written in a chat
without access to the codebase, so the methods might not be ideal, and the call was mine.

**Verdict: the idea was right, the mechanism was wrong for this repo.** The review is in
`docs/agent-reach/README.md` — six structural reasons the CLI path fails here (the leak gate fails
*provably*, since the published grep bans `\bagents?\b` and `agent-reach` matches it), nine factual
errors in the source document, and measured coverage for every channel it proposed.

Owner decisions taken this session, from three options each: **native equivalent only** (do not
install the package anywhere) · **all three channels** · **social channels nowhere**.

Branch `feat/rotation-board`, six commits, `reach (1)` … `reach (6)`. Not pushed.

---

## What shipped

**One rule for what counts as evidence** (`lib/source-standard.ts`). Tier A is a primary-source
statement — the entity's own dated words, the artifact and not a summary — or practitioner material
citing specifics a casual observer could not produce. Everything else is Tier B: a lead, never
evidence, and alone it moves no verdict, score, probability or target. Single source of truth on the
`buildRubricText` pattern: the same constants render into every discovery and lens prompt, into each
playbook's `references/source-standard.md` via `gen:bib`, and onto `/methodology` verbatim.

The prompt is what actually binds — a reference file can go unread. Three playbooks already said a
version of this in their own words; what changed is that they now decide it the same way.

**A deterministic evidence layer** (`lib/reach/`), $0 and drawing no plan window, in the same shape
as the desk, the board and the scanner:

- `filings.ts` — the company's own dated filings with resolving sec.gov URLs, over the existing
  `getSubmissions`. **~100% coverage**; 8 of 8 on the fixture cohort, one cached request each.
- `feeds.ts` + `catalog.ts` — dated official releases from the Fed, ECB, EIA and two BLS series.
- `github.ts` — public developer activity for the ~15% of this universe that has any.
- `snapshot.ts` — the shape and the pure weekly merge; `index.ts` — `refreshReach` (network) and
  `readReach` (never network).
- `lib/reach-settings.ts` — 8 knobs over the shared registry, `MAG8_REACH=0` kill switch.
- `scripts/reach.ts` — `--probe | --refresh [TICKER,…] | --board`.

Wired into `analyzeAndCompile`, the one path a fresh run and a resume share, read *after* discovery
because only then is the cohort known. Frozen per ISO week, because a lens cell is cached on
(ticker, skill, week). Fail-open: no snapshot means no block and the run behaves exactly as before —
pinned byte-for-byte by a test. Mock and fixture runs return before this stage, so they stay $0.

---

## Findings — each one a confident wrong number avoided

**1. S-8 is not a capital raise.** It registers shares for employee compensation. Counting it would
report every company that pays people in equity as diluting. Checked against a real case: AST
SpaceMobile's *only* S-form in a 180-day window IS an S-8, so counting it would have turned a true
zero into a false raise. The remaining count is a clean dilution tell in exactly the place the
screen is weakest — its share-count check is disclosed as split- and acquisition-contaminated and
defaults OFF, while a filed registration is unambiguous. Live: RKLB 7, IONQ 5, ACHR 3, OKLO 1, and
four genuine zeroes.

**2. Form prefixes, not an exact set.** Variants proliferate (424B3/B5/B7, an `/A` of almost
anything) and an exact set silently drops the ones nobody thought of. Tests pin the near-misses that
must NOT classify: SC 13G, SCHEDULE 13D/A, DEFA14A, 425, and Forms 3/4/5/144, which belong to the
insider scanner.

**3. The Federal Reserve CDATA-wraps every link and date.** Without unwrapping, that feed's "URL" is
the literal string `<![CDATA[https://…]]>`.

**4. The BLS release feeds are ATOM served from `.rss` filenames,** with the URL in an attribute of a
self-closing `<link/>` that every text-content matcher reads as absent. So the dialect is **sniffed,
never declared** — a declared format would have been wrong for two sources of five on day one.

**5. Charset must be read, not assumed.** `Response.text()` always decodes UTF-8; one built-in
declares ISO-8859-1 and another carries "Vujčić". Assuming would mangle exactly the titles a reader
would notice.

**6. THE CAP HAD TO BE PER SOURCE.** With one global newest-first cap the block filled with
central-bank speeches and silently excluded *both* monthly BLS releases — the jobs report and CPI,
the two figures a macro thesis most wants, are always the oldest items in the pool. Per source, with
the window widened 21→35 days so a monthly cycle fits, both are now in. **Only visible by reading the
output; no test would have asked.**

**7. A publisher-side dead link.** The EIA feed ships its *newest* item as `detail.php?id=` — the
identifier missing from EIA's own XML. A syntactically valid URL and a dead page, which in a
reference block reads as a citation that does not resolve. Any address left hanging on an unfilled
parameter is now refused, and `--probe` checks every release link end-to-end, permanently. The ECB's
doubled slash is deliberately NOT rewritten: it is the publisher's own and it resolves.

**8. An empty organisation is NOT MEASURED, never a zero.** Symbotic, Archer Aviation, Rocket Lab
and SentinelOne each hold a registered handle that publishes nothing — all four confirmed live. A
resolver that says "found" and then reads that emptiness as weak developer traction is confidently
wrong about all of them. Three states that never collapse into two: no handle → nothing reported;
handle with an empty org → NOT MEASURED with the reason; handle with a real org → figures.

**9. Resolution is curated, never guessed.** All 17 handles fetched and confirmed this session;
C3.ai stays unresolved rather than guessed at. Guessing is how a lookup once returned `1B2`, a
Frankfurt symbol, for Nasdaq-listed Bitfarms. Forks are excluded from every per-repo figure (23 of
Rigetti's 64), organisation totals stay separate from the 100-repo sample, and a rate-limited request
reports the exhausted budget rather than falling through as a zero — which would have reported every
remaining candidate as publishing nothing.

**10. MY OWN destructive CLI bug, caught live, twice.** `argValue` returned the next argv element
whatever it was, so `--refresh --force` read "--force" as a ticker; combined with force clearing the
week, it replaced eight real companies with one entry named `--FORCE`. Fixed at the parse, and again
in the library — `normalizeTickers` now shape-checks, so no caller bug can put a non-ticker into
state several runs read. Then force itself: it cleared the whole map, so `--refresh --force` with no
tickers — the natural way to refresh only the feeds — deleted every company in the week. Force now
re-reads what you ASK for and never discards what you did not mention. Its orphaned note also
outlived it, so a note is kept only while the company it describes is still held.

**11. Honest coverage, reported not hidden.** Developer activity reaches roughly one candidate in
seven on this universe, because most of it builds hardware. That number is on `/methodology`.

---

## Gates (all green)

`npx tsc --noEmit` 0 · `npm run test` **721** (was 639) · `npm run seed` **EXACT** (ASTS 90.3, RKLB
73.9, TMDX 69.5, SYM 51.5, IONQ 47.9, CRSP 46.7, OKLO 42.7, ACHR 19.3 #8) · `npm run gen:bib`
idempotent · `npm run build` clean · `npm run reach -- --probe` **ALL PASS** (incl. every publisher
represented, every release URL resolving, and the empty-org check) · 13F fixture and Form 4 parser
byte-identical after the `lib/xml.ts` additions.

**Leak probe: 0 hits** across 13 surfaces — `/`, `/rankings`, `/methodology`, `/lab`, `/bottleneck`,
`/bottleneck/exposure`, `/rotation`, `/insider`, `/stocks/ASTS`, `/stocks/RGTI`, `/runs/<id>`,
snapshot JSON, `/admin`. Nothing anywhere names the package; the module is `reach`, which the grep
does not match.

**Curtain:** launch-mode build → `/methodology`, `/admin`, `/rankings` all 404, and `/admin` 404s
*even with a valid admin token*. **Admin gating:** verified on a production build with a real
`ADMIN_TOKEN` — the locked payload carries neither the dials nor either catalogue editor.

**Separation:** `lib/reach/` writes only `reach_snapshots`, `edgar_cache` and `reach_*` app_settings.
One additive table, `user_version` 7, zero FKs into pipeline tables.

---

## Open

- **Never run live.** Everything above is offline gates plus $0 live probes. The one step that costs
  plan window is the owner's to run: `npm run pipeline -- --lens-probe IONQ` before and after, to
  confirm the added prompt text (+376 tokens for a lens with filings and developer activity, +786 for
  the macro lens that also gets releases) does not push a cell toward the $1 cap — and that source
  link counts go **up**, since the lens is now handed resolving URLs rather than hunting for them.
- **The handle map is 17 names.** Extending it is research, not code; the `/admin` editor takes
  additions without a deploy, and an empty handle retires a wrong one.
- **No prior week yet**, so every ecosystem reading honestly says "no prior reading". Trends start
  next week.
- **Never seen at 375px** — headless browsers return an empty DOM in this environment. The new
  `/admin` panel and `/methodology` section are structurally the same as the four that came before.
- The three original Bottleneck themes still carry placeholder factors (unrelated, still open).
