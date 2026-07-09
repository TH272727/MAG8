# HANDOFF — 2026-07-09: deploy prep, homepage-only launch curtain, Railway go-live

Session record for future Claude Code sessions. CLAUDE.md stays authoritative (invariant 12 +
the 2026-07-09 state entry summarize this); this file carries the detail and the NEXT TASK spec.

## 1. What shipped (all committed & pushed through `540268e`)

### Launch curtain — `MAG8_SITE_MODE=launch|full` (`siteMode()`/`launchMode()` in lib/config.ts)
- Defaults: production → `launch`, development → `full`. A fresh deploy exposes nothing by accident.
- **Launch = HOMEPAGE-ONLY** (tightened same day by owner call; originally / + /methodology):
  - 404-guarded at the TOP of each page: methodology, rankings, lab, admin, runs/[runId],
    stocks/[ticker] (+ `generateMetadata` returns `{}` on the two dynamic ones).
  - All 3 run API routes 404 in launch — **admin token does NOT bypass**; flip to full to operate.
  - Homepage renders ZERO outbound links in launch: hero methodology button dropped (waitlist
    anchor `#waitlist` is the only CTA), "Read the full methodology." gated, "all 32 works cited"
    unlinked, both engine-panel arrow links gated, nav carries no page links, footer's "How scoring
    works" gated, 404 page → Home only.
  - Homepage board preview in launch = static **MOCKUP LEADERBOARD** (`MOCKUP_BOARD` const in
    app/page.tsx): bold title (`eyebrow font-bold text-ink`), $-prefixed **CSS redact bars** for
    tickers (spans, NOT unicode blocks — the vendored latin font subsets lack U+2588), fictional
    scores 88.6/74.2/61.9, process-copy verdict lines, "Revealed at launch" name rows.
  - Launch homepage reads **ZERO DB** (`latest`/`active` forced null) — an empty first deploy
    renders identically to a seeded one.
  - `not-found.tsx` bakes its variant at BUILD time → build and run with the same mode.
- Full mode is byte-identical to pre-curtain behavior (real board, dates, all links, all pages).

### Homepage copy additions (BOTH modes; owner-approved disclosure)
- Hero chips: `26 AGENTS PER RUN` / `3 LENSES, FULLY BLIND` / `{N} ACADEMIC WORKS CITED`
  (N computed from `CITATION_GROUPS` — currently 32, can't drift).
- "The scale is real" paragraph: 1 scout + 3 lenses × 8 candidates + 1 compiler = 26 (matches
  `estimateRun`'s `1 + 3N + 1`); links `/methodology#refs-h` in full, plain text in launch.
- **Leak-probe exception**: `\bagents?\b` is allowed ONLY as this homepage copy (owner call
  2026-07-09). Everything else (run payloads, all other tokens) still zero. Recorded in
  CLAUDE.md Commands & gates.

### Waitlist — verified end-to-end (stores; still nothing sends)
- Chain: `EmailCapture` → server action `subscribeEmail` (app/actions.ts, zod `z.email().max(200)`)
  → `insertSignup` → `email_signups` (PK COLLATE NOCASE = case-insensitive dedupe).
- E2E-tested against a production build by replaying the SSR form's progressive-enhancement POST
  (multipart with the form's `$ACTION_*` hidden fields — parse them from rendered HTML, POST to `/`
  with them + `email`): new → "You're on the list." + row present; dupe → idempotent message;
  garbage → server-side reject. Probe row deleted after.
- `lib/db.ts` `init()` does `mkdirSync(dirname, {recursive:true})` → fresh containers boot fine.

### Deploy fixes found along the way
- **tsconfig.json now excludes `marketing/`** — the Remotion subproject's `.ts`-extension imports
  failed root tsc and would have failed `next build` (it has its own tsconfig/toolchain).
- **next.config.ts `outputFileTracingRoot`** pinned — a stray `~/package-lock.json` mis-rooted
  build tracing.
- `.env.example`: +`MAG8_SITE_MODE` docs; price-check comment fixed Stooq → Yahoo.

### Docs
- **DEPLOY.md** (new) = the runbook: single long-lived instance requirement, env table, DB
  shipping, waitlist export one-liner, §Railway specifics, gate record.
- CLAUDE.md invariant 12 + 2026-07-09 state entry; memory twin + MEMORY.md updated in lockstep.

## 2. Verification record (production build, launch mode)
- tsc 0; `next build` clean.
- Route matrix: `/` 200; methodology / rankings / lab / admin / stocks/ASTS / runs/x /
  api/runs/x / api/runs/x/stream / POST api/runs (authorized) → all 404.
- Homepage HTML: 0 internal hrefs, 0 real tickers, MOCKUP LEADERBOARD + waitlist + 26-agents
  copy present; leak grep 0-hit.
- Full-mode spot-check: all pages 200, real board + links restored, mockup gone.
- 375px iframe probe (earlier, pre-tightening layout): scrollWidth 365 / 0 offenders both modes.

## 3. Git / GitHub
- origin = `git@github.com:TH272727/MAG8.git`, branch `main`, everything pushed through `540268e`.
- Commits this session: `0fd9321` (film domain: cashtag hooks, graded type pass, process rulebook,
  fun wave 2, waitlist CTAs), `6e65c28` (app: GT rename + deploy prep), `540268e` (homepage-only
  curtain + mockup board). Six phases were interleaved in shared files → split by domain, not phase.
- Ignore rules verified: `db/` (real data + signups), `marketing/video/out/` (renders), `.env*`.

## 4. Hosting: Railway (owner pick), DEPLOYED on free trial 2026-07-09
- Research compared Fly ($3.5–4.5/mo, `fly sftp`) / Railway ($5 Hobby) / Render ($8.25) /
  Hetzner CPX11 ($5 flat, 2GB). Owner chose **Railway** for simplicity.
- **Railway proxy caps (full mode only)**: any HTTP connection force-closed at 15 min, and at
  5 idle min. Both absorbed by design: SSE route heartbeats every 15s; browser `EventSource`
  auto-reconnects with `Last-Event-ID`; events persist-before-emit with rowid = SSE id → exact
  replay, no loss/dupes. The pipeline itself is in-process background work — unaffected by caps.
- Ops rules: **1 replica**, **App Sleeping OFF** (opt-in — leave it), **don't push to main during
  a live run** (auto-deploy restarts the container; boot reconciliation marks the run interrupted).
- **On-server full-mode runs are the board-update path** on Railway (no fly-sftp equivalent):
  set `CLAUDE_CODE_OAUTH_TOKEN`, flip `MAG8_SITE_MODE=full`, run from /admin, flip back.
- Deployment state at session end: service live on the **free trial** (one-time $5 credit;
  always-on burns ~$2–4/mo → upgrade to Hobby before it runs out or the service stops).
  User was walked through Settings → Networking → **Generate Domain**.
- **Volume**: instructed to attach at `/data` + set `MAG8_DB_PATH=/data/mag8.db` BEFORE sharing
  the link (container FS is ephemeral — a redeploy wipes un-volumed signups). NOT independently
  verified done — **check before any push that triggers a redeploy**.
- Envs advised: `MAG8_DB_PATH=/data/mag8.db`, `MAG8_SITE_URL=https://<domain>.up.railway.app`.
  `ADMIN_TOKEN` not yet needed in launch mode — **the next task needs it** (see §6).

## 5. Checking signups today (manual method)
`npm i -g @railway/cli` → `railway login` → `railway link` (in repo) → `railway ssh`, then:
```bash
node -e "const db=require('better-sqlite3')(process.env.MAG8_DB_PATH||'db/mag8.db',{readonly:true});const rows=db.prepare('SELECT email,created_at FROM email_signups ORDER BY created_at').all();console.log(rows.length+' signups');rows.forEach(r=>console.log(r.created_at,r.email));db.close()"
```
Local `db/mag8.db` is a different file — real signups exist only on the Railway volume.

## 6. NEXT TASK (owner request): token-protected `/api/waitlist`, launch-exempt, phone-friendly
Goal: owner checks signups from a phone browser against the live site.

Design (agreed intent, implement next session):
- `app/api/runs/*` stays dark in launch; NEW route `app/api/waitlist/route.ts` (GET) is the ONE
  launch-exempt API besides the waitlist action. `runtime: "nodejs"`, `dynamic: "force-dynamic"`.
- Auth: reuse `lib/auth.ts` constant-time compare. Accept the token via `x-admin-token` header
  OR `?token=` query param (phone browsers can't set headers). On missing/wrong token return
  **404** (not 401) so the endpoint is invisible — consistent with the curtain philosophy.
  Note query-string tokens can land in host logs — acceptable, owner-only; mention in DEPLOY.md.
- Response JSON: `{ count, signups: [{ email, createdAt }] }`, newest first; support `?count=1`
  for count-only. Consider `capArray`-style slicing if the list grows huge (not urgent).
- SQL goes in `lib/db.ts` (ALL SQL lives there — invariant): add `countSignups()` +
  `listSignups()` next to `insertSignup`.
- Update CLAUDE.md invariant 12 wording (launch-exempt surfaces: `/`, waitlist action,
  token-gated `/api/waitlist`) + DEPLOY.md + memory twin.
- Gates: tsc, prod build, matrix (endpoint 404 with no/bad token even in launch, JSON with valid
  token in BOTH modes), leak probe on the JSON (emails are owner-only — fine; no internal tokens).
- **Deployment prereq: set `ADMIN_TOKEN` on Railway** (Variables) — without it, prod auth is
  locked-closed and the endpoint must stay 404. Remind the owner; generating a long random value
  and adding it is their one manual step. Then usage from a phone:
  `https://<domain>.up.railway.app/api/waitlist?token=<ADMIN_TOKEN>`.

## 7. Session quirks worth keeping
- The owner's dev server on :3000 and `next build` share `.next` — stop dev before building
  (killed it twice this session; owner told to `npm run dev` after).
- PowerShell: `$home` is a read-only automatic variable — don't use it as a probe var name.
- Testing server actions without a browser: parse the rendered form's `$ACTION_*` hidden inputs
  and POST them multipart to the page URL (works with PS7 `Invoke-WebRequest -Form`).
- React SSR splits JSX text expressions with `<!-- -->` — grep rendered HTML accordingly
  (`32<!-- --> ACADEMIC…`), don't pattern-match across the boundary.
- Vendored latin woff2 subsets have no block-element glyphs (U+2588) — use CSS spans for
  redaction bars, never unicode blocks.
- `gh` CLI is NOT installed; plain `git push` over SSH works (origin already configured).

## 8. Open items (running list)
1. Email capture stores (verified) but **nothing sends** — no provider wired.
2. Railway trial → Hobby upgrade before the $5 credit exhausts.
3. Confirm the volume is attached + `MAG8_DB_PATH` set (protects signups across redeploys).
4. Set `MAG8_SITE_URL` once the domain is settled; `ADMIN_TOKEN` when building §6.
5. §6 endpoint is the next session's task.
