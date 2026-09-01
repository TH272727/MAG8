import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import InsiderControls from "@/components/insider/InsiderControls";
import RiskProfilePicker from "@/components/insider/RiskProfilePicker";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import {
  fmtAgo,
  fmtDay,
  fmtFraction,
  fmtNum,
  fmtPct,
  fmtPrice,
  fmtUsd,
  STAGE_META,
  ZONE_STYLE,
} from "@/lib/insider/format";
import { readScan } from "@/lib/insider/scanner";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Insider turnaround",
  description:
    "Companies whose own insiders are buying on the open market while the shares sit in a recent, moderate drawdown — filtered against published value-trap tests and valued on owner earnings.",
};

export default async function InsiderPage({
  searchParams,
}: {
  searchParams: Promise<{ risk?: string }>;
}) {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const { risk } = await searchParams;
  const view = readScan({ profile: risk ?? null });
  // Server-decided: a visitor's payload never carries the operating controls,
  // and the action behind them re-checks the token anyway.
  const unlocked = tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);

  const hasData = view.ranked.length > 0 || view.rejected.length > 0 || view.belowThreshold.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The insider turnaround scanner</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Who is buying their own beaten-down stock?
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        When a company&apos;s own officers and directors spend their own money on its shares at the going price,
        the law requires them to say so within two business days. This scanner starts there — at the rare event —
        and then asks whether the price has actually fallen, whether the fall is recent rather than terminal,
        whether the balance sheet is alive, and what the business looks worth on its own cash.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        Every number here is computed from public filings and daily closing prices. Nothing is forecast, nothing
        is recommended, and this is not investment advice.
      </p>

      {view.disabled && (
        <p className="panel mt-6 p-4 text-[13px] text-muted">
          The scanner is switched off. No filings are being read and nothing below would be current.
        </p>
      )}

      {!view.disabled && !hasData && (
        <p className="panel mt-6 p-4 text-[13px] text-muted">
          No filings are stored yet, so there is nothing to measure. An operator refreshes the scanner to
          populate it. An empty board means nothing has been read — not that no insider is buying anything.
        </p>
      )}

      {!view.disabled && hasData && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="chip">PRICES AS OF {fmtDay(view.asOf).toUpperCase()}</span>
            <span className="chip">{view.settings.lookbackDays}-DAY FILING WINDOW</span>
            <span className="chip">SCREEN WEEK {view.universeWeek ?? "—"}</span>
            {view.stale && <span className="chip gate-caution">LAST READ {fmtAgo(view.lastRefresh).toUpperCase()}</span>}
          </div>

          <RiskProfilePicker active={view.profile.key} basePath="/insider" />

          {/* -- The funnel. --------------------------------------------------- */}
          <section className="mt-8" aria-labelledby="funnel-h">
            <h2 id="funnel-h" className="eyebrow">
              What the filters did
            </h2>
            <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-5">
              {view.funnel.map((step) => (
                <div key={step.key} className="bg-panel2 px-4 py-3">
                  <div className="tabular font-mono text-2xl font-bold text-ink">{step.count}</div>
                  <div className="mt-1 text-[12px] leading-snug text-muted">{step.label}</div>
                </div>
              ))}
            </div>
          </section>

          {/* -- The ranked list. ---------------------------------------------- */}
          <section className="mt-10" aria-labelledby="ranked-h">
            <h2 id="ranked-h" className="eyebrow">
              Candidates at this risk tolerance
            </h2>
            {view.ranked.length === 0 ? (
              <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                None. No company with insider buying in this window cleared every filter at the tolerance you
                chose. That is a common outcome, and a scanner that always has something to show has been tuned
                until it does.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                      <th scope="col" className="pb-2 font-normal">#</th>
                      <th scope="col" className="pb-2 font-normal">COMPANY</th>
                      <th scope="col" className="pb-2 text-right font-normal">PRICE</th>
                      <th scope="col" className="pb-2 text-right font-normal">OFF HIGH</th>
                      <th scope="col" className="pb-2 text-right font-normal">INSIDER BUYING</th>
                      <th scope="col" className="pb-2 text-right font-normal">BUYERS</th>
                      <th scope="col" className="pb-2 text-right font-normal">STRENGTH</th>
                      <th scope="col" className="pb-2 font-normal">SOLVENCY</th>
                      <th scope="col" className="pb-2 text-right font-normal">EST. VALUE</th>
                      <th scope="col" className="pb-2 text-right font-normal">CUSHION</th>
                      <th scope="col" className="pb-2 text-right font-normal">SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.ranked.map((c, i) => (
                      <tr key={c.ticker} className="border-b border-hairline">
                        <td className="tabular py-2 font-mono text-[13px] text-dim">{i + 1}</td>
                        <td className="py-2">
                          <Link
                            href={`/insider/${c.ticker}${view.profile.key === "house" ? "" : `?risk=${view.profile.key}`}`}
                            className="text-ink hover:underline"
                          >
                            {c.ticker}
                          </Link>
                          <div className="text-[11px] text-dim">{c.companyName}</div>
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {fmtPrice(c.price)}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {fmtPct(c.drawdown?.pctOff52wHigh)}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-ink">
                          {fmtUsd(c.cluster.totalBoughtUsd)}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {c.cluster.distinctBuyers}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {c.fScore ? `${c.fScore.score}/9` : "—"}
                        </td>
                        <td className="py-2">
                          {c.altman && (
                            <span className={`chip ${ZONE_STYLE[c.altman.zone].chip}`}>
                              {ZONE_STYLE[c.altman.zone].label.toUpperCase()}
                            </span>
                          )}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {fmtPrice(c.dcf?.perShareLow)}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {fmtFraction(c.dcf?.marginOfSafetyLow)}
                        </td>
                        <td className="tabular py-2 text-right font-mono text-[13px] font-bold text-ink">
                          {fmtNum(c.composite.score, 1)}
                          {!c.composite.complete && <span className="ml-1 text-[10px] text-dim">part</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {view.ranked.some((c) => !c.composite.complete) && (
              <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-dim">
                A row marked <span className="text-muted">part</span> could not be measured on every component,
                so it is scored on what was available and ranks below every fully measured company whatever its
                number. An unmeasured company must never be able to look like a quiet one.
              </p>
            )}
          </section>

          {/* -- Where the others stopped. ------------------------------------ */}
          {view.rejected.length > 0 && (
            <section className="mt-10" aria-labelledby="stopped-h">
              <h2 id="stopped-h" className="eyebrow">
                Where the others stopped
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
                These companies had insider buying that met your conviction thresholds and then failed something
                later. The reason is your own threshold, not a judgement about the business.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                      <th scope="col" className="pb-2 font-normal">COMPANY</th>
                      <th scope="col" className="pb-2 font-normal">STOPPED AT</th>
                      <th scope="col" className="pb-2 font-normal">WHY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rejected.map((c) => (
                      <tr key={c.ticker} className="border-b border-hairline align-top">
                        <td className="py-2">
                          <Link
                            href={`/insider/${c.ticker}${view.profile.key === "house" ? "" : `?risk=${view.profile.key}`}`}
                            className="text-ink hover:underline"
                          >
                            {c.ticker}
                          </Link>
                        </td>
                        <td className="py-2 text-[13px] text-muted">{STAGE_META[c.stage].label}</td>
                        <td className="py-2 text-[13px] text-muted">{c.stopped.join(" ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* -- Below the reader's own bar. ---------------------------------- */}
          {view.belowThreshold.length > 0 && (
            <section className="mt-10" aria-labelledby="below-h">
              <h2 id="below-h" className="eyebrow">
                Insider buying below your own bar
              </h2>
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
                Genuine open-market purchases that this scan excluded because of the thresholds you chose, and
                for no other reason. Lower them and these appear.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                      <th scope="col" className="pb-2 font-normal">COMPANY</th>
                      <th scope="col" className="pb-2 text-right font-normal">BOUGHT</th>
                      <th scope="col" className="pb-2 font-normal">WHY EXCLUDED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.belowThreshold.slice(0, 25).map((b) => (
                      <tr key={b.ticker} className="border-b border-hairline align-top">
                        <td className="py-2 font-mono text-[13px] text-ink">{b.ticker}</td>
                        <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                          {fmtUsd(b.totalBoughtUsd)}
                        </td>
                        <td className="py-2 text-[13px] text-muted">{b.reasons.join(" ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {view.belowThreshold.length > 25 && (
                <p className="mt-2 text-[12px] text-dim">
                  and {view.belowThreshold.length - 25} more.
                </p>
              )}
            </section>
          )}

          {/* -- Disclosures. -------------------------------------------------- */}
          <section className="mt-12" aria-labelledby="gaps-h">
            <h2 id="gaps-h" className="eyebrow">
              What this scanner cannot tell you
            </h2>
            <ul className="mt-3 max-w-3xl space-y-2 text-[13px] leading-relaxed text-muted">
              <li>
                Insiders buy for reasons this cannot see, and the research finding that their purchases predict
                returns was strongest in companies smaller than the ones this pool draws from. That cuts against
                the premise of this board, and is on the{" "}
                <Link href="/methodology#insider" className="underline underline-offset-2 hover:text-ink">
                  methodology page
                </Link>{" "}
                in full.
              </li>
              <li>
                Much insider trading is routine and carries no information at all. A purchase the filer affirms
                was arranged in advance is kept and shown here, but counts for less — and where no affirmation
                was made either way, this board says so rather than assuming.
              </li>
              <li>
                The valuation is a simplified approximation, and its single most important input — how much
                capital spending merely maintains the business — cannot be read off a filing. Both bounds are
                published for that reason, and the distance between them is the honest width of the answer.
              </li>
              <li>
                Only companies inside the weekly screen are searched, so insider buying at a company outside that
                band is invisible here however large it is.
              </li>
              {view.flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-dim">
              Insider transaction data is the legally required public disclosure of company insiders&apos; own
              trades. It is a record of what they did with their own money, not advice to mirror them, and
              nothing here implies any insider is aware of or endorses this analysis. Not financial advice: this
              is a research instrument, not a recommendation to buy, sell or hold any security.
            </p>
          </section>
        </>
      )}

      {unlocked && <InsiderControls lookbackDays={view.settings.lookbackDays} />}
    </main>
  );
}
