# Agent Reach — the review, and what was built instead

`mag8-agent-reach-integration-prompts.md` in this folder is the source document: nine prompts to wire
the [Agent Reach](https://github.com/Panniantong/Agent-Reach) CLI into all four pipeline playbooks as
an automatic research layer, gated by a shared "practitioner & primary-source" standard. It was
written without access to this codebase.

**The idea was right; the mechanism was wrong for this repo.** Its core insight — usable signal is
either a primary-source statement or practitioner commentary, and everything else is a lead — is a
real quality lever, and was already latent in three of the four playbooks in their own words. It now
exists once, in `lib/source-standard.ts`, and binds every research stage.

What did not survive is the delivery mechanism. This file records why, so it is not re-derived.

## Agent Reach itself

Real, MIT-licensed, actively maintained. Python 3.10+, installed via pipx. Its own `CLAUDE.md` is
explicit that it is **an installer and a doctor, not a router**: "after install, agents call upstream
tools directly." So using it means an agent shelling out to `curl https://r.jina.ai/…`, `yt-dlp`,
`gh`, and similar — which the lens sessions can already do.

## Why the CLI path was rejected (verified, not assumed)

| # | Finding | Evidence |
|---|---|---|
| 1 | **The leak gate fails, provably.** Mission Control renders every Bash call as `Running: <command>`. The published leak grep bans `\bagents?\b`, and `agent-reach` matches it — `-` is a word boundary. Same class as the 2026-07-28 "per the skill's" leak. | `lib/orchestrator/progress.ts:59`, `scripts/__leak-probe.js:6` |
| 2 | **Budget.** A lens cell runs on 30 turns / 8 min / a **$1.00 hard cap**, and that cap has already killed a cell mid-research once. `doctor` plus N channel pulls, across 24 cells, produces error cells — neutral 50 and a gap note. The change meant to improve output would have measurably degraded it. | `lib/config.ts:87-116` |
| 3 | **Sourcing regression.** Grounding is `markdown.match(/https?:\/\//g)`, minimum 3. Text fetched through a CLI carries no URLs, so cells would be pushed *into* the thin-sourcing flag. | `lib/orchestrator/analysis.ts:31-45` |
| 4 | **Deployment.** Board updates run the pipeline on the server. That container would need Python, pipx, gh, yt-dlp, mcporter and headless browsers. The document never mentions deployment. | `DEPLOY.md:98-114` |
| 5 | **Security.** Sessions run `permissionMode: "bypassPermissions"` with `allowDangerouslySkipPermissions: true`. A third-party installer that clones repos, driven unattended by a model, is a supply-chain surface in the one place with no human in the loop. | `lib/orchestrator/agent.ts:154` |
| 6 | **Naming collision.** The lens prompt bans naming internal tools *and* generic self-reference; Prompt 4 asks the report to show when a Reach pull was used. | `lib/orchestrator/prompts.ts` vs. source doc line 248 |

## Factual errors in the source document

All confirmed against the repo:

- `new-gen-stock/SKILL.md` is an **8-line stub**. All five of Prompt 3's edit targets live in
  `references/playbook.md`, which the document never names.
- `institutional-forecast` **does** have a `references/` folder; Prompt 6 says it does not.
- gt-predictor has no "Step 2A" heading — it is a bold `**A.**` inside Step 2 (A/B/B2/C).
- gt-predictor's reference table says "load all five"; adding a row breaks the count. (It now says six.)
- Step 8 is "Falsification Protocol + Monitoring Calendar"; "Leading Indicator Calendar" is a sub-label.
- stock-scanner's Step 2 is **Broad-Scan-only**, so channels added there are skipped in Ticker mode.
- Every `references/bibliography.md` is **generated** by `npm run gen:bib` and cannot hold the standard.
- stock-scanner already says "prefer primary sources over aggregators and forums" — which the proposed
  Reddit/X channel contradicts. The shared standard now reconciles the two explicitly.
- There is no `shared/` directory and no `mag8-project-brief.md`; a `.sh` script is the wrong shape here.

## Measured channel coverage (probed live, 2026-09-02)

| Channel | Coverage on this universe | Outcome |
|---|---|---|
| SEC filings — every 8-K/10-Q/10-K, dated, company's own words, resolving URL | **~100%** | **Built.** Already half-present in `lib/edgar.ts` and never used by the pipeline. |
| Official releases — Fed, ECB, EIA, BLS ×2 | per-thesis | **Built.** |
| Developer ecosystem (GitHub public API) | **~15%**, concentrated in quantum and software | **Built,** honestly scoped. |
| Issuer IR RSS | ~25% and brittle per-vendor | Skipped — EDGAR supersedes it. |
| Jina Reader (Reach's flagship zero-config `web` channel) | **broken here** — `401 … blocked from performing anonymous queries due to bad network reputation (AS7922)` | Skipped; `WebFetch` already covers it. |
| YouTube, V2EX, Xueqiu | low relevance to a US-listed screen; binary dependencies | Skipped. |
| Reddit, X/Twitter, Facebook, Instagram, Xiaohongshu | cookie login, ToS and account-ban risk, cannot run headless | **Nowhere.** Owner decision, 2026-09-02. |

The social channels are a deliberate no rather than an oversight: they need a desktop browser session,
so they cannot run in the container that updates the board; the ban risk lands on a real account; and
by the Tier A/B standard the document itself proposes, the bulk of what they return is Tier B — a
lead, never evidence.

## What was built

`lib/reach/` — deterministic, keyless, $0, drawing no research budget, in the same shape as the
Bottleneck desk, the Rotation Board and the Insider scanner. See
`HANDOFF-2026-09-02-reach-evidence.md` at the repo root for the build and its findings.
