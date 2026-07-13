# HANDOFF 2026-07-13 — Stage 0 v2: SEC-enriched screens, owner-tunable settings, lens ground truth

Owner ask: (1) more stocks in S0, free; (2) confirm the feed is fresh/clean; (3) push as much
deterministic filtering into S0 as possible to offload the scout + lenses — trust SEC/open data
over model recall; (4) every screened parameter tunable from the website, nothing hard-coded,
defaults academically backed.

## Audit findings (live probe, 2026-07-13)

- **Freshness CLEAN**: 12/12 spot-checks vs Yahoo live quotes diverged <1.4% (most <0.7%) —
  screener `lastsale` is same-day. Zero duplicate symbols across exchanges; 100% of rows carry
  price+volume, 94% market cap (capless rows are notes/rights, correctly dropped).
- **Dirty data found**: 11 closed-end funds ($1.1–4.0B: BlackRock ×5, Gabelli ×2, PIMCO ×2,
  Kayne Anderson, Cohen & Steers) inside the eligible pool; AMEX (~293 listings) absent;
  48 same-calendar-year IPOs; 5 sub-$2 names.
- **SEC EDGAR viable on this network** (sec.gov + data.sec.gov both fine): ticker→CIK map covers
  2,118/2,120 eligible; XBRL frames are 0.1–0.9 MB and sub-second each — whole enrichment
  ≈ 12–20 requests ≈ 5–8s, weekly, cached, $0, keyless.
- **Share-count YoY is split/M&A-contaminated**: PEGA +97% (2:1 split), MBLY +143%, AVAV +79%
  (stock-funded BlueHalo merger), LCID −87% (reverse split). No threshold separates splits from
  dilution → dilution ships as an always-on DISCLOSURE FLAG + optional screen, default OFF.
- **Runway needs the securities tags**: biotechs hold T-bill ladders in `MarketableSecuritiesCurrent`
  / `AvailableForSaleSecuritiesDebtSecuritiesCurrent`, not `ShortTermInvestments` — cash-only runway
  false-killed ABCL/AGIO/BEAM/AUR. With all three tags (max, never summed) kills dropped 84 → 36,
  all genuine sub-year burners. Finance sector exempt (BDC/asset-manager OCF is structurally
  negative — ARCC/CG were false kills).
- **Fixture cohort survives all default screens** (ASTS/RKLB/TMDX/SYM/IONQ/CRSP/OKLO/ACHR).
  IONQ sits at +50.6% share growth — right at the default threshold — which is WHY the dilution
  screen defaults off (flag-only). SERV legitimately fails runway (0.59y) → would flag if delivered.

## What shipped

- `lib/universe-settings.ts` (NEW): registry of all 19 S0 knobs — kind/min/max/step/unit/scale,
  research-backed default, env var, blurb, cites (resolve in lib/citations.ts). Resolution
  **DB override > env > default** (`effectiveUniverseSettings()` w/ per-key provenance);
  `saveUniverseOverrides()` persists diffs-from-baseline via `app_settings`. MAG8_UNIVERSE=0
  kill stays env-only supreme. Legacy env names kept (MCAP_MIN/MCAP_MAX/MIN_DVOL/POOL/TIMEOUT_MS).
- `lib/sec.ts` (NEW): CIK map + frames fetch. Tag-drift chains (revenue ×2, cash ×2, current
  securities ×3 — max not sum); dei share-count frame is the coverage oracle for instant-period
  selection (just-ended quarter sparse until 10-Qs land → fall back a quarter); same-quarter YoY
  for shares; annual concepts merge CY(y-1)+CY(y-2) while 10-Ks land; ~120ms gap, identifying UA
  (MAG8_SEC_UA overrides). Fail-open per frame AND per metric.
- `lib/universe.ts` v2: NASDAQ+NYSE all-or-nothing + AMEX additive-fail-open; rows gain
  exchange/industry/ipoyear; screens in order: band → dollar-volume → price floor →
  pooled-vehicle regex (probe-validated: 11/11 true CEFs, 0 false positives — REITs/banks pass) →
  listing age (blank ipoyear passes) → runway (Finance-exempt) → zombie composite
  (rev≤$1M AND ocf<0 AND equity<0; missing rev on a us-gaap filer counts as 0 by design) →
  dilution (default off). `screenUniverse()` is a pure fn of (snapshot, settings), computed on
  READ — tuning applies instantly without refetch, weekly determinism intact. Funnel counts +
  SEC coverage ride `UniversePool` → activity feed + admin preview. `universeScreenFlags()`
  (ex-bandFlags) adds price/runway/zombie/dilution flags on delivered picks (cause-neutral,
  public-safe wording). `lensGroundTruth()` extracts per-ticker verified data.
- DB (user_version 3): `app_settings` table + `universe_snapshots.extra_json` (fundamentals +
  exchange list; ~0.9MB/wk). Pre-v2 snapshot rows still read (extras null → SEC screens skip).
- **Lens prompts now carry a "Platform-verified reference data" block** (analysis.ts →
  prompts.ts): weekly price/cap/traded-value as scale anchors (verify spot live) + SEC filing
  figures (cash, STI, OCF, revenue, equity, runway, share growth w/ split caveat) marked
  filing-anchored and safe to cite "per SEC filings". Cache-safe: snapshot frozen within the week.
- `/admin`: "Universe screen — Stage 0" panel — every knob editable, provenance chips
  (DEFAULT/ENV/CUSTOM), per-setting citation links, Save (stores diff-from-baseline; typing a
  value back to baseline reverts provenance), Preview (cached, ~10ms), Refresh data & preview
  (repersists this week's snapshot), Reset-all. Server actions in app/actions.ts, admin-cookie +
  launch-curtain guarded.
- `/methodology`: pipeline strip now 4 stages (00 Universe screen) + "Stage 0 — the universe
  screen, in the open" section rendering LIVE effective thresholds from the same resolver
  (can't drift; "(tuned)" marker on custom values) + fail-open/IFRS-gap stance.
- `lib/citations.ts`: new "universe" group, 8 works (Banz 1981, Amihud 2002, Kumar 2009,
  Bali/Cakici/Whitelaw 2011, Ritter 1991, Campbell/Hilscher/Szilagyi 2008, FASB 2014 going-concern,
  Pontiff & Woodgate 2008, Grinold 1989) → registry 32→40; homepage chip auto-updates
  ("40 ACADEMIC WORKS CITED"). gen:bib unaffected (group unmapped, renders /methodology only).

## Defaults (all tunable)

band $1–50B · dvol ≥$2M/day · price ≥$2 · listing age ≥1 cal-year · CEF screen ON · SEC enrich ON ·
runway ≥1y (≈ASC 205-40 horizon) ON, Finance exempt · zombie ON (rev≤$1M) · dilution OFF @50%
(flag always) · pool 300 · band slack 10% · timeouts 25s/20s · AMEX ON

Default funnel (live 2026-07-13): 7,106 listings → 5,3xx common/ADR → −3041 band → −147 dvol →
−5 price → −11 CEF → −49 listing-age → −36 runway (220 evaluated) → −1 zombie = **2,030 eligible**,
SEC data on 1,840/2,067 in-band.

## Verified

tsc clean · seed regression EXACT (ASTS 90.3 … ACHR 19.3) · gen:bib no-op ·
next build clean · live E2E (fetch 7.4s, cache 8ms, deterministic pool, override round-trip w/
clamping + unknown-key drop + reset) · leak probe on all 8 public surfaces ZERO hits (had to
reword the Grinold cite — the grep bans the English word "skill"; public copy must write around
skill/agent vocabulary) · headless-Edge screenshots of /admin + /methodology read clean.

## Open / notes for next session

- **First post-S0v2 real run** (W29 snapshot already cached): verify scout draws from the pool,
  marketContext carries the screen-scale line, the funnel activity line renders in Mission
  Control, lens write-ups actually cite "per SEC filings", and delivered-pick flags land in
  gapsNoted correctly.
- Homepage chip now says 40 works; the-signal video + YouTube descriptions were written in the
  32-works era. No on-site drift (all computed), but marketing copy mentioning "32" (if any
  exists — films use "Bessembinder 4%", none found in repo grep) is a snapshot. Owner call.
- IFRS filers (foreign ADRs, e.g. GRAB) have no us-gaap frames → pass solvency unscreened,
  disclosed. ifrs-full frames exist if coverage ever matters.
- Rubric calibration levers still untouched (owner decision, unchanged from 07-12).
