# Deploying Mag8 — state 2026-07-09

Mag8 must run as **one long-lived Node process**: live-run SSE fans out through an
in-process event bus, and state lives in an on-disk SQLite file (WAL). That rules out
static export, serverless/edge functions, and multi-replica scaling. Any host that runs
`node` ≥ 20 with a persistent disk works (VPS, Fly.io machine, Railway, Render — the
app doesn't care which).

## Quick start

```bash
npm ci
npm run build
npm start            # NODE_ENV=production → launch mode by default
```

## Site mode — the pre-launch curtain

`MAG8_SITE_MODE=launch|full` (`siteMode()` in `lib/config.ts`).

- **launch** (the production default): **only `/` responds.** `/methodology`,
  `/rankings`, `/lab`, `/admin`, `/runs/*`, `/stocks/*`, and **all** `/api/runs*` routes
  return 404 — even with a valid admin token. The homepage renders zero outbound links
  (nav and footer carry no page links; the waitlist anchor is the only action), and the
  board preview is a static **MOCKUP LEADERBOARD** — bold title, `$`-redacted ticker
  bars, fictional scores — so no picks, scores, or run dates leak. The launch homepage
  reads nothing from the DB: an empty first deploy renders identically. Pages are
  hidden, never deleted.
- **full** (the development default): the whole site, real board, all links.

To operate a deployed instance (open the admin desk, trigger a run), set
`MAG8_SITE_MODE=full` and restart; flip back afterwards.

**Note:** build and run with the same `MAG8_SITE_MODE` — the 404 page is prerendered at
build time (every other gated surface is checked per request).

## Environment

| Var | Required | Notes |
| --- | --- | --- |
| `ADMIN_TOKEN` | for full-mode ops | Admin desk + `POST /api/runs` auth. Unset in production = desk locked. |
| `MAG8_SITE_URL` | recommended | Absolute base URL for OG/Twitter metadata (`metadataBase`). |
| `MAG8_SITE_MODE` | no | See above. |
| `MAG8_DB_PATH` | no | Default `./db/mag8.db` — point it at the persistent volume. |
| `CLAUDE_CODE_OAUTH_TOKEN` | only to run pipelines on the server | Mint with `claude setup-token`. Owner policy: subscription only — never set `ANTHROPIC_API_KEY`. |
| `MAG8_ALLOW_MOCK` | no | `=1` permits $0 demo runs in production. |
| `MAG8_PRICE_CHECK` | no | `=0` disables the external quote cross-check (air-gapped deploys). |

`.env.example` documents every other knob (models, efforts, timeouts, budget caps).

## The database

- Ship the local `db/mag8.db` (carries the W28 boards) or start empty — the homepage
  preview and boards simply stay empty until a first run completes.
- SQLite runs in WAL mode; the app is the only writer. Back up by copying the file
  while no run is live.

## The email waitlist (verified end-to-end 2026-07-09)

- Form on `/` (`#waitlist`, the launch page's primary CTA) → server action
  `subscribeEmail` (`app/actions.ts`) → `email_signups` table (case-insensitive
  primary key = dedupe; zod-validated; 200-char cap).
- Verified against a production build in launch mode: new address stored, duplicate
  answered idempotently ("Already on the list"), invalid input rejected server-side.
  Works in **both** site modes.
- Nothing **sends** yet (known open item — capture only). Export addresses:

```bash
node -e "const db=require('better-sqlite3')('db/mag8.db',{readonly:true});console.log(db.prepare('SELECT email, created_at FROM email_signups ORDER BY created_at').all());db.close()"
```

- No rate limit beyond dedupe — fine for launch; add one if it gets abused.

## Railway (chosen host, 2026-07-09)

One service from the GitHub repo + one volume. Specifics that matter:

- **Volume**: mount at e.g. `/data`, set `MAG8_DB_PATH=/data/mag8.db`. To ship the
  local DB up, either copy it in via a one-off shell, or (simpler) flip to full mode
  and run the pipeline on the server — that IS the board-update path on Railway.
- **Keep 1 replica** and leave **App Sleeping off** (it's opt-in) — SQLite and the
  SSE bus need one always-on process.
- **SSE proxy caps** (full mode only): Railway closes any HTTP connection after
  15 min (and after 5 idle min). The app absorbs both by design — 15 s heartbeats
  and `Last-Event-ID` replay reconnect with zero event loss.
- **Auto-deploys**: Railway redeploys on every push to `main` — don't push while a
  run is live (boot reconciliation marks it interrupted; the week cache makes
  re-running cheap).
- **Build = run env**: set `MAG8_SITE_MODE` (if overriding) before the build, not
  just at runtime — the 404 page bakes its variant at build time.

## Pre-deploy gates (all passed 2026-07-09)

1. `npx tsc --noEmit` → 0. (Root `tsconfig.json` now excludes `marketing/` — the video
   subproject has its own tsconfig, and its files previously failed root tsc, which
   would also have failed `next build`.)
2. `npm run build` → clean (lockfile-root warning fixed via `outputFileTracingRoot`).
3. Launch-mode route matrix (re-run after the homepage-only tightening): `/` 200;
   methodology / rankings / lab / admin / stocks/ASTS / runs/* and all `/api/runs*`
   (including authorized `POST`) → 404.
4. Launch homepage: zero internal hrefs, zero real tickers (mockup board only),
   waitlist form + 26-agents copy present. Leak probe on rendered HTML: zero hits.
   The only allowed `agent` mention sitewide is the owner-approved "26 agents"
   homepage copy (2026-07-09); skill/provider names remain banned everywhere.
5. 375 px iframe probe on `/` in both modes: `scrollWidth 365, 0 offenders`.
6. Waitlist E2E (above).
7. Full-mode spot-check after the tightening: methodology/rankings/lab/admin all
   200, real "Latest leaderboard" + all links restored, mockup gone.

## Deliberately not done

- No email sending — capture only.
- Deploy target still undecided; a Postgres port would mean rewriting `lib/db.ts` only.
