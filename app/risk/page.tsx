import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { launchMode } from "@/lib/config";
import { readRisk } from "@/lib/risk/desk";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Risk",
  description:
    "How much the companies the desks agree on actually move, how much of that movement is the same movement, and what a basket of them would carry.",
};

const pct = (n: number | null | undefined, d = 1) =>
  n === null || n === undefined ? "—" : `${n.toFixed(d)}%`;
const dec = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? "—" : n.toFixed(d);

const REASON: Record<string, string> = {
  "no-history": "No stored price history.",
  "too-short": "Too little price history to measure.",
  "no-variation": "The stored price never moved.",
};

export default async function RiskPage() {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const board = readRisk();
  const s = board.settings;
  const sl = board.sleeve;
  const together = board.pairs.filter((p) => p.together);

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The risk desk</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        How much these move, and how much of it is the same move
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        The other desks answer what is interesting. This one asks a different question about the same companies.
        Twelve names is not twelve positions if six of them are the same trade, and the number of rows is the one
        figure on a watchlist that always looks reassuring. Everything below is computed from daily closes the
        other desks already hold.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        This page reports and it flags. It does not propose a trade, suggest a weight, size anything against a
        balance, or connect to anything that could place an order.
      </p>

      {board.disabled && (
        <p className="panel mt-6 p-4 text-[13px] text-muted">
          The risk desk is switched off. Nothing below would be current.
        </p>
      )}

      {!board.disabled && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="chip">
              {board.measured} OF {board.names.length} MEASURED
            </span>
            <span className="chip">{s.volWindowDays}-SESSION WINDOW</span>
            {board.asOf && <span className="chip">CLOSES THROUGH {board.asOf}</span>}
            {board.stale && <span className="chip border-caution/40 text-caution">STALE</span>}
          </div>

          {board.empty && (
            <p className="panel mt-8 p-4 text-[13px] text-muted">
              {board.flags[0] ??
                "No company has been named by more than one desk yet, so there is no basket to measure."}
            </p>
          )}

          {!board.empty && (
            <>
              {/* ---- The basket ------------------------------------------- */}
              <section className="mt-10" aria-labelledby="basket-h">
                <h2 id="basket-h" className="eyebrow">
                  The basket
                </h2>
                {sl.volPct === null || sl.tickers.length < 2 ? (
                  <p className="panel mt-3 p-4 text-[13px] text-muted">
                    Fewer than two companies share enough price history to be held as a basket, so the
                    co-movement figures are not measured. That is a statement about the price records, not
                    about the companies.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                      An equal-weight basket of the {sl.tickers.length} companies with enough shared history,
                      rebalanced every session, measured over {sl.sessions} sessions from {sl.from} to {sl.to}.
                      The weights are equal because this desk declines to optimise them — see the note at the
                      foot of the page.
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="panel p-4">
                        <p className="eyebrow">Basket volatility</p>
                        <p className="mt-1 font-display text-2xl font-bold">{pct(sl.volPct)}</p>
                        <p className="mt-1 text-[12px] text-dim">
                          members average {pct(sl.averageMemberVolPct)}
                        </p>
                      </div>
                      <div className="panel p-4">
                        <p className="eyebrow">Effective positions</p>
                        <p className="mt-1 font-display text-2xl font-bold">
                          {dec(sl.effectivePositions, 1)}
                        </p>
                        <p className="mt-1 text-[12px] text-dim">of {sl.tickers.length} held</p>
                      </div>
                      <div className="panel p-4">
                        <p className="eyebrow">Worst fall</p>
                        <p className="mt-1 font-display text-2xl font-bold">
                          {pct(sl.drawdown?.depthPct ?? null)}
                        </p>
                        <p className="mt-1 text-[12px] text-dim">
                          {sl.drawdown
                            ? sl.drawdown.recoveredDate
                              ? `back by ${sl.drawdown.recoveredDate}`
                              : "not yet recovered"
                            : "not measured"}
                        </p>
                      </div>
                      <div className="panel p-4">
                        <p className="eyebrow">Against {sl.benchmarkTicker}</p>
                        <p className="mt-1 font-display text-2xl font-bold">{dec(sl.beta)}</p>
                        <p className="mt-1 text-[12px] text-dim">
                          {sl.benchmarkVolPct === null
                            ? "not measured"
                            : `${sl.benchmarkTicker} at ${pct(sl.benchmarkVolPct)}`}
                        </p>
                      </div>
                    </div>
                    <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted">
                      Effective positions is the reading to look at. It is the members&rsquo; average volatility
                      divided by the basket&rsquo;s own, squared: companies that moved independently would give{" "}
                      {sl.tickers.length}, and companies that moved as one would give 1 however many of them
                      there were.
                    </p>
                  </>
                )}
              </section>

              {/* ---- Against the market reading ---------------------------- */}
              {board.exposure && board.atBand && sl.volPct !== null && (
                <section className="mt-10" aria-labelledby="tide-h">
                  <h2 id="tide-h" className="eyebrow">
                    Against the market reading
                  </h2>
                  <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                    The <Link href="/tide" className="underline decoration-dotted underline-offset-2">market
                    desk</Link> publishes how much of a portfolio to hold in shares at all, and currently puts
                    that at {board.exposure.low}% to {board.exposure.high}%. Holding this basket at that share,
                    with the rest in cash, would carry {pct(board.atBand.low)} to {pct(board.atBand.high)} of
                    portfolio volatility. Cash is treated as riskless and uncorrelated, which is the standard
                    simplification and is close enough at this horizon that saying so is the whole correction.
                  </p>
                </section>
              )}

              {/* ---- What moves together ---------------------------------- */}
              <section className="mt-10" aria-labelledby="pairs-h">
                <h2 id="pairs-h" className="eyebrow">
                  What moves together
                </h2>
                {together.length === 0 ? (
                  <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                    No pair of these companies reached {s.togetherAt} correlation over its own overlapping
                    history, so none of them is being counted twice on that test.
                  </p>
                ) : (
                  <>
                    <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                      {board.pairSummary.together} pair{board.pairSummary.together === 1 ? "" : "s"} across{" "}
                      {board.pairSummary.namesInvolved} companies reached {s.togetherAt} or above, which is close
                      enough to read as one position rather than two. Each pair is measured on its own
                      overlapping history rather than on one shared calendar, so a company that listed recently
                      never shortens anyone else&rsquo;s record.
                    </p>
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[440px] text-left text-sm">
                        <thead>
                          <tr className="border-b border-line text-[11px] uppercase tracking-wider text-dim">
                            <th className="py-2 pr-3 font-medium">Pair</th>
                            <th className="py-2 pr-3 font-medium">Correlation</th>
                            <th className="py-2 pr-3 font-medium">Sessions</th>
                            <th className="py-2 font-medium">Measured over</th>
                          </tr>
                        </thead>
                        <tbody>
                          {together.map((p) => (
                            <tr key={`${p.a}-${p.b}`} className="border-b border-line/60">
                              <td className="py-2 pr-3 font-mono text-[13px]">
                                {p.a} &amp; {p.b}
                              </td>
                              <td className="py-2 pr-3 tabular-nums">{dec(p.r)}</td>
                              <td className="py-2 pr-3 tabular-nums text-muted">{p.sessions}</td>
                              <td className="py-2 text-[12px] text-dim">
                                {p.from} to {p.to}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {board.pairSummary.mixedBasisSuppressed > 0 && (
                  <p className="mt-3 max-w-2xl text-[12px] leading-relaxed text-dim">
                    {board.pairSummary.mixedBasisSuppressed} pair
                    {board.pairSummary.mixedBasisSuppressed === 1 ? " is" : "s are"} listed but cannot raise that
                    flag, because their two price series are on different bases: one is adjusted for dividends
                    and the other is not, so the unadjusted leg carries each payment as a real one-day fall. That
                    is noise, and a co-movement warning should not be built on it.
                  </p>
                )}
              </section>

              {/* ---- Every name ------------------------------------------- */}
              <section className="mt-10" aria-labelledby="names-h">
                <h2 id="names-h" className="eyebrow">
                  Every company measured
                </h2>
                <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                  Ordered by share of the basket&rsquo;s risk, which combines how much a company moves with how
                  much of that movement is shared. Shares are rounded for display and will not always total
                  exactly one hundred.
                </p>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-line text-[11px] uppercase tracking-wider text-dim">
                        <th className="py-2 pr-3 font-medium">Company</th>
                        <th className="py-2 pr-3 font-medium">Volatility</th>
                        <th className="py-2 pr-3 font-medium">Beta</th>
                        <th className="py-2 pr-3 font-medium">Share of risk</th>
                        <th className="py-2 pr-3 font-medium">Worst fall</th>
                        <th className="py-2 font-medium">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.shown.map((n) => (
                        <tr key={n.ticker} className="border-b border-line/60">
                          <td className="py-2 pr-3">
                            <span className="font-mono text-[13px]">{n.ticker}</span>
                            {n.companyName && (
                              <span className="ml-2 text-[12px] text-dim">{n.companyName}</span>
                            )}
                            {!n.adjusted && (
                              <span className="ml-2 text-[11px] uppercase tracking-wider text-caution">
                                raw closes
                              </span>
                            )}
                          </td>
                          {n.measured ? (
                            <>
                              <td className="py-2 pr-3 tabular-nums">{pct(n.volPct)}</td>
                              <td className="py-2 pr-3 tabular-nums text-muted">{dec(n.beta)}</td>
                              <td className="py-2 pr-3 tabular-nums text-muted">
                                {n.riskSharePct === null ? "not in basket" : pct(n.riskSharePct)}
                              </td>
                              <td className="py-2 pr-3 tabular-nums text-muted">
                                {pct(n.drawdown?.depthPct ?? null)}
                              </td>
                              <td className="py-2 tabular-nums text-dim">{n.sessions}</td>
                            </>
                          ) : (
                            <td colSpan={5} className="py-2 text-[12px] text-dim">
                              NOT MEASURED — {REASON[n.reason ?? ""] ?? "no figure could be computed."}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {board.truncated && (
                  <p className="mt-3 text-[12px] text-dim">
                    {board.names.length} companies were measured; the table shows the first {s.maxRows}.
                  </p>
                )}
              </section>

              {/* ---- Notes ------------------------------------------------- */}
              {board.flags.length > 0 && (
                <section className="mt-10" aria-labelledby="notes-h">
                  <h2 id="notes-h" className="eyebrow">
                    Notes
                  </h2>
                  <ul className="mt-3 max-w-2xl space-y-2">
                    {board.flags.map((f) => (
                      <li key={f} className="text-[13px] leading-relaxed text-muted">
                        {f}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}

          {/* ---- What this does not tell you ---------------------------- */}
          <section className="mt-10" aria-labelledby="limits-h">
            <h2 id="limits-h" className="eyebrow">
              What this does not tell you
            </h2>
            <div className="mt-3 max-w-2xl space-y-3 text-[13px] leading-relaxed text-muted">
              <p>
                The basket is equal-weighted and this desk proposes no weights of its own. That is a result
                rather than a limitation: fourteen optimising allocation rules were tested against a simple
                equal-weight rule across seven datasets, and none was consistently better out of sample, because
                the error in estimating the inputs cost more than the optimisation gained.
              </p>
              <p>
                Every co-movement figure here is a calm-weather reading. Correlation between holdings has
                historically risen specifically in falling markets and not in rising ones, so companies that look
                independent in ordinary conditions have moved together in exactly the falls that diversification
                is held for. The figures above describe the past average, not the worst day.
              </p>
              <p>
                And volatility is not a forecast. It is what these prices did over a window this desk chose, and
                a different window is a different number about the same company. Both results are set out with
                their sources on the{" "}
                <Link href="/methodology#risk" className="underline decoration-dotted underline-offset-2">
                  methodology page
                </Link>
                .
              </p>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
