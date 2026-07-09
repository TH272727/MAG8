import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfluenceLine, { type ThreadState } from "@/components/confluence/ConfluenceLine";
import LensCard from "@/components/stocks/LensCard";
import ScoreBreakdown from "@/components/stocks/ScoreBreakdown";
import {
  getCandidate,
  getLensRowsForTicker,
  getRankingForTicker,
  latestRunForTicker,
} from "@/lib/db";
import { launchMode } from "@/lib/config";
import { fmtDate, fmtMoney } from "@/lib/format";
import { PUBLIC_LENSES, type PublicLens } from "@/lib/public-lens";
import { sanitizeRankedStock, toPublicLensRow } from "@/lib/public-view";

export const dynamic = "force-dynamic";

function normalizeTicker(raw: string): string {
  return decodeURIComponent(raw).trim().toUpperCase();
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }): Promise<Metadata> {
  if (launchMode()) return {};
  const { ticker } = await params;
  return { title: `${normalizeTicker(ticker)} — confluence dossier` };
}

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  // Pre-launch curtain: dossiers stay in the tree but 404 until launch.
  if (launchMode()) notFound();

  const { ticker: raw } = await params;
  const ticker = normalizeTicker(raw);

  const run = latestRunForTicker(ticker);
  if (!run) notFound();
  const rankedRaw = getRankingForTicker(run.id, ticker);
  if (!rankedRaw) notFound();
  // Public-view boundary: everything rendered below must carry public lens
  // vocabulary and sanitized text, even for legacy rows.
  const ranked = sanitizeRankedStock(rankedRaw);

  const candidate = getCandidate(run.id, ticker);
  const lensRows = getLensRowsForTicker(run.id, ticker).map(toPublicLensRow);
  const byLens = new Map(lensRows.map((r) => [r.lens, r]));
  const orderedRows = PUBLIC_LENSES.map((l) => byLens.get(l)).filter((r) => r !== undefined);

  const threads: Partial<Record<"discovery" | PublicLens, ThreadState>> = { discovery: "done" };
  for (const l of PUBLIC_LENSES) {
    const row = byLens.get(l);
    threads[l] = !row ? "idle" : row.status === "ok" ? "done" : "error";
  }

  const total = run.report?.rankings.length ?? 0;
  const gateCls = ranked.gate === "pass" ? "gate-pass" : ranked.gate === "caution" ? "gate-caution" : "gate-fail";

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* ---- Header ---- */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="min-w-0">
          <p className="eyebrow">
            Confluence dossier · run of {fmtDate(run.finishedAt ?? run.createdAt)}
          </p>
          <h1 className="mt-2 font-mono text-5xl font-bold tracking-wide sm:text-6xl">{ticker}</h1>
          <p className="mt-1 text-lg text-muted">
            {ranked.companyName}
            {candidate?.sector ? <span className="text-dim"> · {candidate.sector}</span> : null}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip">RANK #{ranked.rank}{total ? ` OF ${total}` : ""}</span>
            <span className={`chip ${gateCls}`}>GATE {ranked.gate.toUpperCase()}</span>
            {ranked.confluence && (
              <span className="chip border-confluence/50 bg-confluence/10 text-confluence">CONFLUENCE — ALL LENSES BULLISH</span>
            )}
          </div>
        </div>
        <div className="w-full max-w-xs sm:w-72" aria-hidden="true">
          <ConfluenceLine mode="static" compact threads={threads} score={ranked.finalScore} className="w-full" />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* ---- Main column ---- */}
        <div className="min-w-0 space-y-6">
          {/* Why this score — the grounding notes */}
          <section className="panel border-l-2 border-l-confluence/70 p-5" aria-labelledby="grounding-h">
            <h2 id="grounding-h" className="eyebrow text-confluence">
              Why this score — grounding notes
            </h2>
            <p className="tabular mt-2 font-mono text-[13px] leading-relaxed text-ink/90">{ranked.groundingNotes}</p>
          </section>

          {/* Score arithmetic */}
          <section className="panel p-5" aria-labelledby="breakdown-h">
            <h2 id="breakdown-h" className="eyebrow">
              Score breakdown
            </h2>
            <div className="mt-3">
              <ScoreBreakdown
                scores={ranked.scores}
                gate={ranked.gate}
                confluence={ranked.confluence}
                finalScore={ranked.finalScore}
              />
            </div>
            <p className="mt-2 text-[12px] text-dim">
              Gate reason: <span className="text-muted">{ranked.gateReason}</span>
            </p>
          </section>

          {/* The three lenses */}
          {orderedRows.map((row) => (
            <LensCard key={row.lens} row={row} />
          ))}
        </div>

        {/* ---- Side column ---- */}
        <div className="space-y-6">
          {candidate && (
            <section className="panel border-t-2 border-t-discovery/70 p-5" aria-labelledby="thesis-h">
              <h2 id="thesis-h" className="font-display text-base font-semibold text-discovery">
                Discovery thesis
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/90">{candidate.thesis}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {candidate.matchedTraits.map((t) => (
                  <span key={t} className="chip inline-block max-w-full truncate border-discovery/40 text-discovery">
                    {t}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="panel p-5" aria-labelledby="risks-h">
            <h2 id="risks-h" className="eyebrow">
              Top risk flags
            </h2>
            <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
              {ranked.riskFlags.length ? (
                ranked.riskFlags.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true" className="text-danger/70">✗</span>
                    {r}
                  </li>
                ))
              ) : (
                <li>No headline risks recorded for this run.</li>
              )}
            </ul>
          </section>

          <section className="panel p-5" aria-labelledby="runinfo-h">
            <h2 id="runinfo-h" className="eyebrow">
              This analysis
            </h2>
            <dl className="mt-2 space-y-1.5 font-mono text-[12px] text-muted">
              <div className="flex justify-between gap-3">
                <dt>Run</dt>
                <dd>
                  <Link href={`/runs/${run.id}`} className="underline underline-offset-2 hover:text-ink">
                    {run.id.slice(0, 8)}…
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Completed</dt>
                <dd>{fmtDate(run.finishedAt ?? run.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Run cost</dt>
                <dd>{fmtMoney(run.totalCostUsd)}</dd>
              </div>
            </dl>
            <Link href="/rankings" className="btn mt-4 w-full">
              Full leaderboard
            </Link>
          </section>
        </div>
      </div>
    </main>
  );
}
