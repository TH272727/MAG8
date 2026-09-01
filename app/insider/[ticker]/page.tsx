import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RiskProfilePicker from "@/components/insider/RiskProfilePicker";
import { launchMode } from "@/lib/config";
import { computeOwnerEarnings } from "@/lib/insider/dcf";
import {
  fmtDay,
  fmtFraction,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtPrice,
  fmtSignedFraction,
  fmtUsd,
  STAGE_META,
  ZONE_STYLE,
} from "@/lib/insider/format";
import { falsifiers, whyItFits } from "@/lib/insider/report";
import { readCandidate } from "@/lib/insider/scanner";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  return {
    title: `${ticker.toUpperCase()} — insider turnaround`,
    description: `Open-market insider buying, drawdown, financial strength and owner-earnings valuation for ${ticker.toUpperCase()}.`,
  };
}

/** A label/value row, the shape the whole page is built from. */
function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <tr className="border-b border-hairline">
      <th scope="row" className="py-2 text-left text-[13px] font-normal text-muted">
        {label}
        {note && <span className="block text-[11px] text-dim">{note}</span>}
      </th>
      <td className="tabular py-2 text-right font-mono text-[13px] text-ink">{value}</td>
    </tr>
  );
}

export default async function InsiderStockPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ risk?: string }>;
}) {
  if (launchMode()) notFound();

  const { ticker } = await params;
  const { risk } = await searchParams;
  const hit = readCandidate(ticker, { profile: risk ?? null });
  if (!hit) notFound();

  const { candidate: c, view } = hit;
  const d = c.drawdown;
  const ownerEarnings = c.dcf ? computeOwnerEarnings(c.years, "total") : [];
  const backHref = view.profile.key === "house" ? "/insider" : `/insider?risk=${view.profile.key}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link href={backHref} className="font-mono text-[11px] tracking-[0.14em] text-dim hover:text-ink">
        ← ALL CANDIDATES
      </Link>

      <p className="eyebrow mt-6">{STAGE_META[c.stage].label}</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {c.ticker} <span className="text-muted">— {c.companyName}</span>
      </h1>

      {c.stage === "ranked" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="chip">COMPOSITE {fmtNum(c.composite.score, 1)}</span>
          {c.altman && (
            <span className={`chip ${ZONE_STYLE[c.altman.zone].chip}`}>
              SOLVENCY {ZONE_STYLE[c.altman.zone].label.toUpperCase()}
            </span>
          )}
          {c.fScore && <span className="chip">STRENGTH {c.fScore.score}/9</span>}
          {!c.composite.complete && <span className="chip gate-caution">PARTLY MEASURED</span>}
        </div>
      ) : (
        <div className="panel mt-4 p-5">
          <p className="text-[13px] text-muted">{STAGE_META[c.stage].blurb}</p>
          <ul className="mt-2 space-y-1 text-[13px] text-ink">
            {c.stopped.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <RiskProfilePicker active={view.profile.key} basePath={`/insider/${c.ticker}`} />

      {/* -- The written read. --------------------------------------------- */}
      <section className="mt-8" aria-labelledby="why-h">
        <h2 id="why-h" className="eyebrow">
          What was measured
        </h2>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-ink">{whyItFits(c, view.settings)}</p>
        <p className="mt-2 max-w-3xl text-[12px] text-dim">
          Assembled from the figures below and nothing else. No part of this paragraph is written by a model.
        </p>
      </section>

      {/* -- The transactions. --------------------------------------------- */}
      <section className="mt-10" aria-labelledby="buys-h">
        <h2 id="buys-h" className="eyebrow">
          The insider buying, line by line
        </h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted">
          Every open-market purchase in the window, as filed. Take any row to the filing itself and check it —
          that is what these tables are for.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                <th scope="col" className="pb-2 font-normal">DATE</th>
                <th scope="col" className="pb-2 font-normal">INSIDER</th>
                <th scope="col" className="pb-2 font-normal">ROLE</th>
                <th scope="col" className="pb-2 text-right font-normal">SHARES</th>
                <th scope="col" className="pb-2 text-right font-normal">PRICE</th>
                <th scope="col" className="pb-2 text-right font-normal">VALUE</th>
                <th scope="col" className="pb-2 font-normal">PRE-ARRANGED</th>
              </tr>
            </thead>
            <tbody>
              {[...c.cluster.buys]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((b) => (
                  <tr key={`${b.accession}-${b.line}`} className="border-b border-hairline">
                    <td className="py-2 font-mono text-[13px] text-muted">{b.date}</td>
                    <td className="py-2 text-[13px] text-ink">{b.ownerLabel}</td>
                    <td className="py-2 text-[12px] text-muted">{b.role}</td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                      {fmtInt(b.shares)}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                      {fmtPrice(b.price)}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-ink">
                      {fmtUsd(b.valueUsd)}
                    </td>
                    <td className="py-2 text-[12px] text-muted">
                      {b.planned === "yes" ? "yes" : b.planned === "no" ? "no" : "not stated"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-4">
          <div className="bg-panel2 px-4 py-3">
            <div className="font-mono text-[10px] tracking-[0.14em] text-dim">TOTAL BOUGHT</div>
            <div className="tabular mt-1 font-mono text-xl font-bold text-ink">
              {fmtUsd(c.cluster.totalBoughtUsd)}
            </div>
          </div>
          <div className="bg-panel2 px-4 py-3">
            <div className="font-mono text-[10px] tracking-[0.14em] text-dim">DISTINCT BUYERS</div>
            <div className="tabular mt-1 font-mono text-xl font-bold text-ink">{c.cluster.distinctBuyers}</div>
          </div>
          <div className="bg-panel2 px-4 py-3">
            <div className="font-mono text-[10px] tracking-[0.14em] text-dim">PRE-ARRANGED</div>
            <div className="tabular mt-1 font-mono text-xl font-bold text-muted">
              {fmtUsd(c.cluster.plannedBoughtUsd)}
            </div>
          </div>
          <div className="bg-panel2 px-4 py-3">
            <div className="font-mono text-[10px] tracking-[0.14em] text-dim">SOLD IN THE WINDOW</div>
            <div className="tabular mt-1 font-mono text-xl font-bold text-muted">
              {fmtUsd(c.cluster.totalSoldUsd)}
            </div>
          </div>
        </div>
      </section>

      {/* -- The price setup. ---------------------------------------------- */}
      {d && (
        <section className="mt-10" aria-labelledby="price-h">
          <h2 id="price-h" className="eyebrow">
            The price setup
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-8 md:grid-cols-2">
            <table className="w-full text-sm">
              <tbody>
                <Row label="Price" note={`close on ${fmtDay(d.asOf)}`} value={fmtPrice(d.price)} />
                <Row label="52-week high" note={fmtDay(d.high52wDate)} value={fmtPrice(d.high52w)} />
                <Row label="Below that high" value={fmtPct(d.pctOff52wHigh)} />
                <Row label="Months since the high" value={fmtNum(d.monthsSinceHigh, 1)} />
                <Row label="One-year average close" value={fmtPrice(d.avg1y)} />
                <Row label="Below that average" value={fmtPct(d.pctBelow1yAvg)} />
              </tbody>
            </table>
            <table className="w-full text-sm">
              <tbody>
                <Row label="Three-year high" note={fmtDay(d.high3yDate)} value={fmtPrice(d.high3y)} />
                <Row label="Below that high" value={fmtPct(d.pctOff3yHigh)} />
                <Row label="Above the three-year low" value={fmtPct(d.pctAbove3yLow)} />
                <Row label="Last eight weeks" value={fmtSignedFraction(d.return8w)} />
                <Row label="The eight weeks before" value={fmtSignedFraction(d.priorReturn8w)} />
                <Row label="Decline steadied" value={d.stabilizing ? "yes" : "no"} />
              </tbody>
            </table>
          </div>
          {c.priceFilter && (
            <ul className="mt-4 space-y-2 text-[13px] leading-relaxed">
              {c.priceFilter.checks.map((k) => (
                <li key={k.key} className={k.ok ? "text-muted" : "text-ink"}>
                  <span className="font-mono text-[11px] tracking-[0.1em] text-dim">
                    {k.ok ? "PASS" : "FAIL"}
                  </span>{" "}
                  {k.label} — {k.detail}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* -- Financial strength. -------------------------------------------- */}
      {c.fScore && (
        <section className="mt-10" aria-labelledby="strength-h">
          <h2 id="strength-h" className="eyebrow">
            Financial strength
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted">
            The nine-point checklist scores {c.fScore.score}, with {c.fScore.measured} of nine criteria
            measurable from this company&apos;s filings. A criterion that could not be judged scores no point
            rather than being guessed at, so the score understates rather than flatters.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                  <th scope="col" className="pb-2 font-normal">CRITERION</th>
                  <th scope="col" className="pb-2 text-center font-normal">POINT</th>
                  <th scope="col" className="pb-2 font-normal">MEASURED</th>
                </tr>
              </thead>
              <tbody>
                {c.fScore.criteria.map((k) => (
                  <tr key={k.key} className="border-b border-hairline align-top">
                    <td className="py-2 text-[13px] text-ink">{k.label}</td>
                    <td className="py-2 text-center font-mono text-[13px] text-muted">{k.point}</td>
                    <td className="py-2 text-[12px] text-muted">{k.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {c.altman && c.altman.zone !== "unmeasured" && (
            <>
              <p className="mt-5 max-w-3xl text-[13px] leading-relaxed text-muted">
                The five-ratio bankruptcy model reads <span className="text-ink">{fmtNum(c.altman.z, 3)}</span>,
                in its {ZONE_STYLE[c.altman.zone].label.toLowerCase()} zone. The model was fitted on
                manufacturers, and its own caution is that the trend matters more than the level: a company
                reinvesting heavily can score low without being anywhere near insolvent.
              </p>
              <table className="mt-3 w-full max-w-xl text-sm">
                <tbody>
                  <Row label="Working capital / assets" value={fmtNum(c.altman.parts.workingCapitalToAssets, 4)} />
                  <Row label="Retained earnings / assets" value={fmtNum(c.altman.parts.retainedEarningsToAssets, 4)} />
                  <Row label="Operating income / assets" value={fmtNum(c.altman.parts.ebitToAssets, 4)} />
                  <Row
                    label="Market value of equity / liabilities"
                    note={`market value from the screen of week ${view.universeWeek ?? "—"}`}
                    value={fmtNum(c.altman.parts.equityValueToLiabilities, 4)}
                  />
                  <Row label="Revenue / assets" value={fmtNum(c.altman.parts.salesToAssets, 4)} />
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      {/* -- The valuation. -------------------------------------------------- */}
      {c.dcf && (
        <section className="mt-10" aria-labelledby="value-h">
          <h2 id="value-h" className="eyebrow">
            Owner-earnings valuation
          </h2>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted">
            Reported earnings plus non-cash charges, less the capital spending the business needs to hold its
            position and the working capital its growth consumes. That last deduction cannot be read off a
            filing, so both bounds are shown: the conservative one deducts every dollar of capital spending, and
            the other treats depreciation as the maintenance figure.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                  <th scope="col" className="pb-2 font-normal">FISCAL YEAR</th>
                  <th scope="col" className="pb-2 text-right font-normal">NET INCOME</th>
                  <th scope="col" className="pb-2 text-right font-normal">D&amp;A</th>
                  <th scope="col" className="pb-2 text-right font-normal">CAPITAL SPENDING</th>
                  <th scope="col" className="pb-2 text-right font-normal">WORKING CAPITAL</th>
                  <th scope="col" className="pb-2 text-right font-normal">OWNER EARNINGS</th>
                </tr>
              </thead>
              <tbody>
                {ownerEarnings.map((y) => (
                  <tr key={y.end} className="border-b border-hairline">
                    <td className="py-2 font-mono text-[13px] text-muted">{y.end}</td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">{fmtUsd(y.netIncome)}</td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">{fmtUsd(y.depreciation)}</td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">{fmtUsd(y.capex)}</td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                      {fmtUsd(y.workingCapitalChange)}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-ink">
                      {y.value === null ? "—" : fmtUsd(y.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2">
            <div className="bg-panel2 px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.14em] text-dim">
                FULL CAPITAL SPENDING (CONSERVATIVE)
              </div>
              <div className="tabular mt-1 font-mono text-2xl font-bold text-ink">
                {fmtPrice(c.dcf.perShareLow)}
              </div>
              <div className="mt-1 text-[12px] text-muted">
                cushion {fmtFraction(c.dcf.marginOfSafetyLow)}
              </div>
            </div>
            <div className="bg-panel2 px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.14em] text-dim">
                DEPRECIATION AS MAINTENANCE
              </div>
              <div className="tabular mt-1 font-mono text-2xl font-bold text-muted">
                {fmtPrice(c.dcf.perShareHigh)}
              </div>
              <div className="mt-1 text-[12px] text-muted">
                cushion {fmtFraction(c.dcf.marginOfSafetyHigh)}
              </div>
            </div>
          </div>

          <table className="mt-4 w-full max-w-xl text-sm">
            <tbody>
              <Row label="Discount rate" value={fmtPct(view.settings.discountRatePct)} />
              <Row label="Terminal growth" value={fmtPct(view.settings.terminalGrowthPct)} />
              <Row
                label="Projected growth applied"
                note={
                  c.dcf.total.projection.historicalRate === null
                    ? "no rate could be taken from the history"
                    : `observed ${fmtFraction(c.dcf.total.projection.historicalRate)} before haircut and cap`
                }
                value={fmtFraction(c.dcf.total.projection.growthRate)}
              />
              <Row label="Years projected" value={String(view.settings.projectionYears)} />
              <Row
                label="Share of value in the perpetuity"
                value={fmtFraction(c.dcf.total.valuation.terminalShare, 0)}
              />
              {c.dcf.spreadPct !== null && (
                <Row label="Distance between the two bounds" value={fmtPct(c.dcf.spreadPct, 0)} />
              )}
            </tbody>
          </table>

          {c.quality && (
            <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-muted">
              Context, which gates nothing: owner earnings were positive in {fmtFraction(c.quality.positiveShare, 0)}{" "}
              of the {c.quality.yearsMeasured} years that could be computed and grew in{" "}
              {fmtFraction(c.quality.growingShare, 0)} of the steps between them; average return on equity{" "}
              {fmtFraction(c.quality.averageRoe)}; total liabilities {fmtNum(c.quality.leverage)} times equity.
            </p>
          )}
        </section>
      )}

      {/* -- Falsification. --------------------------------------------------- */}
      <section className="mt-10" aria-labelledby="wrong-h">
        <h2 id="wrong-h" className="eyebrow">
          What would say this is wrong
        </h2>
        <ul className="mt-3 max-w-3xl space-y-2 text-[13px] leading-relaxed text-muted">
          {falsifiers(c, view.settings).map((f) => (
            <li key={f}>{f.replace(/\*\*/g, "")}</li>
          ))}
        </ul>
      </section>

      {/* -- Disclosures. ----------------------------------------------------- */}
      <section className="mt-10" aria-labelledby="flags-h">
        <h2 id="flags-h" className="eyebrow">
          Disclosed gaps
        </h2>
        {c.flags.length === 0 ? (
          <p className="mt-3 max-w-3xl text-[13px] text-muted">
            Nothing about this company&apos;s data needed flagging beyond the limits that apply to every reading
            here.
          </p>
        ) : (
          <ul className="mt-3 max-w-3xl space-y-2 text-[13px] leading-relaxed text-muted">
            {c.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        )}
        <p className="mt-4 max-w-3xl text-[12px] leading-relaxed text-dim">
          Insider transaction data is the legally required public disclosure of company insiders&apos; own
          trades. It is a record of what they did with their own money, not advice to mirror them, and nothing
          here implies any insider is aware of or endorses this analysis. Not financial advice.
        </p>
      </section>
    </main>
  );
}
