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

- **launch** (the production default): only `/` and `/methodology` respond. `/rankings`,
  `/lab`, `/admin`, `/runs/*`, `/stocks/*`, and **all** `/api/runs*` routes return 404 —
  even with a valid admin token. The nav collapses to Methodology, homepage CTAs fold
  into waitlist + methodology, leaderboard preview cards render without links, and the
  404/methodology bottom CTAs swap targets. Pages are hidden, never deleted.
- **full** (the development default): the whole site.

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

## Pre-deploy gates (all passed 2026-07-09)

1. `npx tsc --noEmit` → 0. (Root `tsconfig.json` now excludes `marketing/` — the video
   subproject has its own tsconfig, and its files previously failed root tsc, which
   would also have failed `next build`.)
2. `npm run build` → clean (lockfile-root warning fixed via `outputFileTracingRoot`).
3. Launch-mode route matrix: `/` and `/methodology` 200; rankings / lab / admin /
   stocks/ASTS / runs/* and all `/api/runs*` (including authorized `POST`) → 404.
4. Leak probe on `/` + `/methodology` rendered HTML: zero hits. The only allowed
   `agent` mention sitewide is the owner-approved "26 agents" homepage copy
   (2026-07-09); skill/provider names remain banned everywhere.
5. 375 px iframe probe on `/` in both modes: `scrollWidth 365, 0 offenders`.
6. Waitlist E2E (above).

## Deliberately not done

- No email sending — capture only.
- Deploy target still undecided; a Postgres port would mean rewriting `lib/db.ts` only.
