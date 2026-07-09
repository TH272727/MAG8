# Handoff — 2026-07-08 latest-night: "Game Theory" rename + the two flagship engines, surfaced

Owner directive: the new-gen (discovery) and gt-predictor engines are the most eye-catching, unique
parts of MAG8 but felt hidden on the site and in the films — and "macro asymmetry" should just be
called **"game theory"** everywhere. Also: make users understand (mostly on the website) that the
discovery engine captures the DNA trillion-dollar stocks showed *before* they became trillion-dollar
stocks, in smaller stocks today.

## 1. The rename — display-only, retro-active at the boundary

Internal ids, DB rows, wire keys, colors, and the short code did NOT change (`PublicLens` stays
`macro`, accent stays copper, short stays `GT` — which now reads literally as Game Theory).

| Site | Change |
|---|---|
| `lib/public-lens.ts` | `macro.label` → **"Game Theory"**; record gained a `tagline` field (all 3 lenses + `PUBLIC_DISCOVERY`) |
| `lib/schemas.ts` | `LENS_META["gt-predictor"].label` → "Game Theory" — this pins *future* lens report titles ("Game Theory — TICKER") via `prompts.ts` |
| `lib/public-view.ts` | `gt-predictor` token now maps to "the game-theory lens"; **added 3 case-variant retro-translations** (`MACRO ASYMMETRY`/`Macro Asymmetry`/`macro asymmetry` → Game Theory forms) so W28-cached lens markdown, old compiler prose, and demo rows all render renamed. Verified: rendered-page grep shows zero `macro.asymmetry` residue |
| `lib/ranking.ts` | Rubric sub-score 3 now reads "From the game-theory lens: … (players, compelled moves, base rates)" — flows to compiler prompt AND /methodology verbatim block |
| `lib/citations.ts` | Group title "Game Theory lens" (`gen:bib` re-run: bibliographies byte-identical — the generator never embedded group titles) |
| `lib/orchestrator/prompts.ts` | Compiler naming discipline: "…fundamentals, game-theory, and street-consensus lenses (they appear under the data keys \"fundamentals\", \"macro\", \"consensus\" below)" |
| `lib/fixtures.ts` | GT narrative title "# Game Theory — {t} situation read"; OKLO verdictLine "Game theory loves it, the street doesn't…" |
| `components/confluence/HeroConfluence.tsx` | WebGL hero thread label "Game Theory" |
| `components/stocks/LensCard.tsx` | Renders the new `tagline` as a dim mono line under every lens-card header |

Videos (label swaps only — **zero timeline/duration changes, all scores untouched**):
`shorts/vlib.tsx` (label + chip), `fun/flib.tsx` (desk stamp rows — touches all 8 fun episodes),
`lib/braid.tsx` + `shorts/vbraid.tsx` (thread labels; vbraid's short 'MACRO' → 'GAME THEORY' fits —
FUNDAMENTALS is longer), `S06_Lanes`, `S08_Macro` (chip + headline **"Game theory maps the
board."** — fits: "Fundamentals" is 12 chars at the same Kinetic size), `VM_Macro` VM1 (chip; strap
"GAME THEORY, PLAYED IN THE OPEN" → **"PLAYERS · MOVES · PAYOFFS"** since the chip now says GAME
THEORY — no repetition, and it sets up VM1's "Markets are games. Games have players." TypeOn).
Docs: `marketing/video-prompts.md` (S6/S8/S10 beats), `marketing/video/README.md`, root `README.md`.

## 2. The explainers — what was actually added

**Homepage** (`app/page.tsx`):
- Hero paragraph now carries the DNA thesis: "A scout hunts trillion-dollar DNA — the traits
  today's giants showed before they were giants — in small companies now… fundamentals, game
  theory, street consensus…"
- HOW card 01 sharpened to the DNA hunt; card 02 renamed.
- NEW section **"Under the hood — the two engines doing the unusual work"**: two accent panels.
  - Violet / *Trillion-dollar DNA, found early* — the premise, 6 trait chips (FOUNDER-LED,
    PLATFORM ECONOMICS, COMPOUNDING MOAT, NETWORK EFFECTS, CATEGORY CREATION, EXPANDING TAM —
    all from the discovery prompt's own trait list), "Discovery opens the case; it never scores
    its own picks", link → `/methodology#discovery-dna`.
  - Copper / *Game theory: it war-games the world* — players → M×E×C → compelled moves → priced
    gap; 5 instrument chips (PLAYER MAP, M × E × C, 3–24M PROBABILITIES, ASYMMETRY 1–10,
    FALSIFIER); "a number and a kill switch"; link → `/methodology#game-theory`.

**Methodology** (`app/methodology/page.tsx`):
- Stage-02 body: "a game-theory engine (player maps, base rates, asymmetry scoring)".
- GT lens card body rewritten: "Who are the players, and what are they compelled to do?…"
- NEW section **"The two engines, closer up"** (both panels `scroll-mt-24`, anchor-linked from home):
  - `#discovery-dna` — Bessembinder 2018 premise (~4% of stocks = all net wealth creation → the
    mandate is finding members of that 4% while small), the inverted question ("what did the
    trillion-dollar companies look like *before* — and who looks like that now?"), a 6-trait
    definition grid (each tied to its literature short: Fahlenbrach, Helmer, Rogers…), and the
    separation-of-powers close (discovery argues, lenses attack blind, the board is what survives).
  - `#game-theory` — the 6-step anatomy of every GT cell: 1·Player map (Mass × Energy ×
    Coordination 1–10), 2·Compelled moves (dominant strategies), 3·Base rate first
    (reference-class), 4·Horizon probabilities (3/6/12/24m — "a curve, not a vibe"),
    5·Asymmetry Score (1–10 mispricing), 6·The falsifier ("a thesis that cannot be wrong is not a
    thesis"). Closes with the Tetlock/Green humility note — the lens is graded, not trusted — and
    points at the stock-page instruments (player map, horizon fan, asymmetry dial).

White-label discipline held throughout: no "skill"/"agent" words in any new copy; engine/lens/scout
vocabulary only; the trait and instrument names match what the prompts and GtCharts already expose.

## 3. Verification (all green)

- App: `npx tsc --noEmit` → 0 errors (the 4 reported errors are the standalone `marketing/video`
  subproject's scripts leaking into root tsc — pre-existing; the video project's own tsc is clean).
- `npm run seed` fixture regression: **exact** — ASTS 90.3 pass+confluence, RKLB 73.9, TMDX 69.5,
  SYM 51.5, IONQ 47.9, CRSP 46.7, OKLO 42.7, ACHR 19.3 fail-gated #8.
- `npm run gen:bib`: all four bibliographies unchanged (no drift).
- Video: own tsc clean; `npm run check:leak` 58 files, 0 hits.
- Stills read (fresh-DOM): S06-Lanes f80/f130, S08-Macro f100/f150, S10-Convergence f45/f90,
  Short-Macro f690 (V04 chips) / f870 (VM1 head) / f1860 (V10 thread labels — 'GAME THEORY' fits
  between threads) / f2430 (V13 episode chip), Fun-Eightball f615 (desk rows).
- Encode-path seq S08-Macro 95–125 (concurrency 1): word-entrance blur decays and settles clean —
  no ghost-word-class residue.
- Site leak probe (dev server, then killed): `/`, `/rankings`, `/methodology`, `/lab`,
  `/stocks/ASTS`, `/runs/fixture-demo-run` + snapshot JSON + SSE stream → **0 hits** on the full
  grep (`stock-scanner|gt-predictor|…|\bskills?\b|\bagents?\b`), **0** `macro.asymmetry` residue,
  "game theory" present 7×/8× on home/methodology.
- 375px iframe probe (temp `app/probe375`, headless Edge + virtual-time flags): `/` and
  `/methodology` both `scrollWidth=363, offenders=0`. Probe page + `.next/types` stub deleted.
- Visual pass: full-page headless-Edge screenshots of home (1440×3400) and methodology (1440×6200)
  read — both new sections render as designed.

## 4. Renders

Zero timeline changes → **no score regeneration needed**. All 12 films re-queued (flib touches
every fun desk beat; vlib touches all 3 shorts; S06/S08/S10/braid touch the master):
`npm run render` → `render:shorts` → `render:fun`, chained as three background stages (the single
combined queue would exceed the 10-min command timeout). Prior night's queue: ~15 min total.

## 5. Follow-ups / notes for next session

- If the pre-rename `the-signal.mp4`/shorts were already posted anywhere, the new renders replace
  them 1:1 (same durations, same audio).
- Old W28 lens rows STORE "Macro Asymmetry" in their markdown — that's by design; the public-view
  retro-token renders them as "Game Theory" on every surface. Do not rewrite DB rows.
- Next real run's GT cells will be titled "Game Theory — TICKER" natively (LENS_META pin).
- Standing open items unchanged: email capture stores but nothing sends; deploy target undecided.
