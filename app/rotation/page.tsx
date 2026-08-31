import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import RotationControls from "@/components/rotation/RotationControls";
import RotationTable, { type TableRow } from "@/components/rotation/RotationTable";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { readBoard } from "@/lib/rotation/board";
import { CATEGORY_META, catalogTickers } from "@/lib/rotation/catalog";
import { fmtDay, fmtNum, fmtPct, fmtPercentile, fmtRatio, fmtScore, fmtSince, TIER_STYLE } from "@/lib/rotation/format";
import { TIER_META } from "@/lib/rotation/score";
import { noteForBoard } from "@/lib/rotation/note";
import { describeChange } from "@/lib/rotation/state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rotation",
  description:
    "Which market regime is actually being favoured — breadth against concentration, growth against value, risk against safety — measured from daily prices and scored by ordinary arithmetic.",
};

export default async function RotationPage() {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const board = readBoard();
  // Server-decided: a visitor's payload never carries the operating controls,
  // and every action behind them re-checks the token anyway.
  const unlocked = tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);
  const tickerCount = catalogTickers().length;
  // Free and read-only: the cached note for this exact state, the deterministic
  // one written on the spot, or the last note on record labelled as historic.
  const note = noteForBoard(board);

  const rows: TableRow[] = board.entries.flatMap((e) => {
    const r = e.result.reading;
    if (!r || r.kind !== "ratio") return [];
    return [
      {
        id: r.id,
        label: r.label,
        category: r.category,
        categoryTitle: CATEGORY_META[r.category].title,
        score: r.score,
        tier: r.tier,
        tierLabel: TIER_META[r.tier].short,
        tierChip: TIER_STYLE[r.tier].chip,
        tierAccent: TIER_STYLE[r.tier].accent,
        direction: r.direction,
        directionLabel: r.directionLabel,
        daysSince: e.daysSince,
        sinceLabel: fmtSince(e.daysSince),
        scoreLabel: fmtScore(r.score),
        mixedBasis: r.basis.mixed,
        stale: r.stale,
      },
    ];
  });

  const leaders = board.readings.filter((r) => r.score !== null).slice(0, 3);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The rotation board</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Which market is the market actually rewarding?
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        An index going up says nothing about <span className="text-ink">what</span> is going up. Dividing one fund
        by another strips the common move out and leaves only the difference: the average company against the
        largest few, growth against value, credit risk against safety. This board tracks{" "}
        {board.readings.length} of those ratios, scores each one by ordinary arithmetic, and says plainly when a
        reading has changed.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        Every number is computed from daily closing prices and recomputed on demand. No forecasts, no opinions,
        and nothing here is investment advice.
      </p>

      {board.disabled && (
        <p className="panel mt-6 p-4 text-[13px] text-muted">
          The board is switched off. No prices are being read and nothing below would be current.
        </p>
      )}

      {!board.disabled && !board.asOf && (
        <p className="panel mt-6 p-4 text-[13px] text-muted">
          No prices are stored yet, so there is nothing to measure. An operator refreshes the board to populate it.
        </p>
      )}

      {board.asOf && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="chip">AS OF {fmtDay(board.asOf).toUpperCase()}</span>
            <span className="chip">{board.readings.length} RATIOS</span>
            <span className="chip">{tickerCount} INSTRUMENTS</span>
            {board.stale && <span className="chip gate-caution">DATA STALE</span>}
          </div>

          {/* -- What changed. The only thing that raises a written note. ---- */}
          <section className="mt-8" aria-labelledby="changed-h">
            <h2 id="changed-h" className="eyebrow">
              What changed on the newest session
            </h2>
            {board.changesToday.length === 0 ? (
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                Nothing. No indicator crossed a tier boundary or flipped the side it favours. Most sessions look
                like this, and a board that always has something to report has been tuned until it does.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {board.changesToday.map((c) => {
                  const r = board.readings.find((x) => x.id === c.indicatorId);
                  if (!r) return null;
                  return (
                    <li key={`${c.indicatorId}-${c.date}`} className="text-[13px] leading-relaxed">
                      <Link href={`/rotation/${c.indicatorId}`} className="text-ink hover:underline">
                        {describeChange(c, r)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* -- The written note. ------------------------------------------- */}
          {note && (
            <section className="mt-8" aria-labelledby="note-h">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 id="note-h" className="eyebrow">
                  {note.current ? "The note on this change" : "No active signal"}
                </h2>
                <span className="font-mono text-[11px] text-dim">
                  {note.current ? fmtDay(note.asOf) : `last note from ${fmtDay(note.asOf)}`}
                </span>
              </div>
              <div className="panel md-body mt-3 p-5">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.body}</ReactMarkdown>
              </div>
            </section>
          )}

          {/* -- The strongest readings. ------------------------------------- */}
          {leaders.length > 0 && (
            <section className="mt-8" aria-labelledby="lead-h">
              <h2 id="lead-h" className="eyebrow">
                Strongest readings
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
                {leaders.map((r) => (
                  <Link key={r.id} href={`/rotation/${r.id}`} className="bg-panel2 px-4 py-3 hover:bg-panel">
                    <div className="font-mono text-[10px] tracking-[0.14em] text-dim">
                      {CATEGORY_META[r.category].title.toUpperCase()}
                    </div>
                    <div className={`tabular mt-1 font-mono text-2xl font-bold ${TIER_STYLE[r.tier].accent}`}>
                      {fmtScore(r.score)}
                    </div>
                    <div className="mt-1 text-[13px] text-ink">{r.label}</div>
                    <div className="mt-1 text-[12px] text-muted">{r.directionLabel}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* -- The full table. --------------------------------------------- */}
          <section className="mt-8" aria-labelledby="signals-h">
            <h2 id="signals-h" className="eyebrow">
              Every indicator
            </h2>
            <div className="mt-3">
              <RotationTable rows={rows} />
            </div>
          </section>

          {/* -- Sector board. ----------------------------------------------- */}
          {board.sectors.length > 0 && (
            <section className="mt-10" aria-labelledby="sector-h">
              <h2 id="sector-h" className="eyebrow">
                The eleven sectors, against the market
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
                Ranked by three-month relative strength. Read as a group: which sectors lead carries more
                information than any single one of them does.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                      <th scope="col" className="pb-2 font-normal">RANK</th>
                      <th scope="col" className="pb-2 font-normal">SECTOR</th>
                      <th scope="col" className="pb-2 text-right font-normal">VS MARKET, 3MO</th>
                      <th scope="col" className="pb-2 text-right font-normal">SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.sectors.map((s, i) => (
                      <tr key={s.ticker} className="border-b border-hairline">
                        <td className="tabular py-2 font-mono text-[13px] text-dim">{i + 1}</td>
                        <td className="py-2">
                          <Link href={`/rotation/${s.indicatorId}`} className="text-ink hover:underline">
                            {s.ticker}
                          </Link>
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {fmtPct(s.relative3m)}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {fmtScore(s.score)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {board.cycle && (
                <div className="panel mt-4 p-5">
                  <p className="font-mono text-[10px] tracking-[0.14em] text-dim">LEADERSHIP MOST RESEMBLES</p>
                  <p className="mt-1 font-display text-lg font-semibold text-ink">
                    {board.cycle.label}
                    <span className="ml-2 font-mono text-[12px] font-normal text-muted">
                      {Math.round(board.cycle.strength * 100)}% match
                    </span>
                  </p>
                  <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">{board.cycle.note}</p>
                  <p className="mt-2 max-w-2xl text-[12px] text-dim">
                    This mapping is a convention from practitioner research, not a law. It summarises which
                    sectors led in past cycles, and the funds themselves drift — the technology sector of today
                    is not the one the convention was first described against.
                  </p>
                </div>
              )}
            </section>
          )}

          {/* -- Volatility context. ----------------------------------------- */}
          {board.context.map((c) => (
            <section key={c.id} className="mt-10" aria-labelledby={`ctx-${c.id}`}>
              <h2 id={`ctx-${c.id}`} className="eyebrow">
                {c.label}
              </h2>
              <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
                <div className="bg-panel2 px-4 py-3">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim">LEVEL</div>
                  <div className="tabular mt-1 font-mono text-2xl font-bold text-ink">{fmtNum(c.value)}</div>
                </div>
                <div className="bg-panel2 px-4 py-3">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim">ONE-YEAR PERCENTILE</div>
                  <div className="tabular mt-1 font-mono text-2xl font-bold text-ink">
                    {fmtPercentile(c.percentile)}
                  </div>
                </div>
                <div className="bg-panel2 px-4 py-3">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim">50-DAY AVERAGE</div>
                  <div className="tabular mt-1 font-mono text-2xl font-bold text-muted">{fmtNum(c.smaFast)}</div>
                </div>
              </div>
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">{c.meaning}</p>
            </section>
          ))}

          {/* -- Disclosures. ------------------------------------------------ */}
          <section className="mt-10" aria-labelledby="gaps-h">
            <h2 id="gaps-h" className="eyebrow">
              What this board cannot tell you
            </h2>
            <ul className="mt-3 max-w-3xl space-y-2 text-[13px] leading-relaxed text-muted">
              <li>
                These are ratios of traded funds, so they describe what prices have already done. A reading is a
                measurement of the recent past, not a forecast of anything.
              </li>
              <li>
                The board computes {board.readings.length} ratios across four tiers. Testing many rules against
                the same history is exactly the setting in which some of them look predictive by chance, and no
                result here has been corrected for that.
              </li>
              <li>
                Prices come from free, unofficial endpoints. They are checked for plausibility and their age is
                shown, but they carry no guarantee and are not an official market record.
              </li>
              {board.unavailable.map((u) => (
                <li key={u.id}>
                  <span className="text-ink">{u.label}</span> is not measured: {u.reason}.
                </li>
              ))}
              {board.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
              {board.stale && (
                <li>
                  The newest stored price is older than the operator&apos;s freshness window, so every reading
                  above describes the market as of {fmtDay(board.asOf)}.
                </li>
              )}
            </ul>
            <p className="mt-4 max-w-3xl text-[12px] text-dim">
              Not financial advice. This is a research instrument, not a recommendation to buy, sell or hold any
              security.
            </p>
          </section>
        </>
      )}

      {unlocked && <RotationControls tickerCount={tickerCount} />}
    </main>
  );
}
