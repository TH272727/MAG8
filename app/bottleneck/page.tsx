import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { launchMode } from "@/lib/config";
import { latestDemand } from "@/lib/bottleneck/demand";
import { fmtAge, fmtDay, fmtPct, fmtUnits, fmtUsd } from "@/lib/bottleneck/format";
import { DEFAULT_PLAYBOOK_ID, getPlaybook } from "@/lib/bottleneck/playbook";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bottleneck",
  description:
    "Dollars are elastic. Turbines aren't. The Bottleneck desk converts disclosed capital spending into physical units and checks them against what the world can actually produce.",
};

export default async function BottleneckPage() {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const playbook = getPlaybook(DEFAULT_PLAYBOOK_ID);
  const demand = latestDemand(DEFAULT_PLAYBOOK_ID);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The bottleneck desk</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Dollars are elastic. Turbines aren&apos;t.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Every growth story implies a physical quantity of <span className="text-ink">something</span> — megawatts,
        gigabytes, square feet, tonnes. A spending number can be revised upward with a press release; a gas turbine
        takes years to build regardless of what anyone announces. This desk forces the dollar story back into
        physical units, so it can be checked against something that cannot be talked into existing faster.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        Read straight from public company filings and recomputed on demand — no forecasts, no opinions, and nothing
        here is investment advice.
      </p>

      {!playbook || !demand ? (
        <div className="panel mt-8 p-6">
          <h2 className="font-display text-lg font-semibold">No reading yet</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            The desk has not taken its first measurement of this theme. Once it reads the filings, this page shows
            what the money implies in physical terms and how fast that is changing.
          </p>
        </div>
      ) : (
        <DemandView playbookLabel={demand.snapshot.playbookLabel} demand={demand} />
      )}

      <p className="mt-10 text-[13px] text-dim">
        Want the scoring engine instead?{" "}
        <Link href="/rankings" className="underline underline-offset-2 hover:text-ink">
          See the leaderboard
        </Link>
        . Research, not investment advice.
      </p>
    </main>
  );
}

function DemandView({
  playbookLabel,
  demand,
}: {
  playbookLabel: string;
  demand: NonNullable<ReturnType<typeof latestDemand>>;
}) {
  const s = demand.snapshot;
  const contributors = s.companies.filter((c) => c.status === "ok" && !c.stale);

  return (
    <>
      {/* ---- Headline ---- */}
      <section className="mt-8" aria-labelledby="demand-h">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="demand-h" className="eyebrow">
            {playbookLabel} — what the money implies
          </h2>
          <span className="chip">{fmtAge(demand.takenAt)}</span>
          {demand.stale && <span className="chip gate-caution">READING IS STALE</span>}
          <span className="chip">
            {s.aggregate.contributing} OF {s.aggregate.basketSize} COMPANIES
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
          <div className="bg-panel p-5">
            <div className="font-mono text-[11px] tracking-[0.14em] text-dim">TRAILING TWELVE MONTHS</div>
            <div className="tabular mt-1 font-mono text-2xl font-bold text-ink">{fmtUsd(s.aggregate.ttmUsd)}</div>
            <p className="mt-1 text-[13px] text-muted">Capital spending committed across the basket.</p>
          </div>
          <div className="bg-panel p-5">
            <div className="font-mono text-[11px] tracking-[0.14em] text-dim">LATEST QUARTER</div>
            <div className="tabular mt-1 font-mono text-2xl font-bold text-ink">
              {fmtUsd(s.aggregate.latestQuarterUsd)}
            </div>
            <p className="mt-1 text-[13px] text-muted">Most recent complete quarter each company has filed.</p>
          </div>
          <div className="bg-panel p-5">
            <div className="font-mono text-[11px] tracking-[0.14em] text-dim">YEAR OVER YEAR</div>
            <div className="tabular mt-1 font-mono text-2xl font-bold text-ink">{fmtPct(s.aggregate.yoyPct)}</div>
            <p className="mt-1 text-[13px] text-muted">Growth in the same quarter a year earlier.</p>
          </div>
        </div>
      </section>

      {/* ---- Physical units ---- */}
      <section className="mt-10" aria-labelledby="units-h">
        <h2 id="units-h" className="eyebrow">
          In physical terms
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">
          Trailing-twelve-month dollars divided by the cost of one unit. Each row shows the factor used, where it
          came from, and when — because these are estimates, and an estimate without its source is just a number.
        </p>

        {s.placeholderFactors && (
          <p className="mt-3 max-w-2xl rounded-md border border-caution/40 p-3 text-[13px] leading-relaxed text-caution">
            Every conversion factor below is still a seeded placeholder rather than a sourced benchmark. Treat these
            totals as order-of-magnitude arithmetic, not measurements.
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {s.units.map((u) => (
            <div key={u.key} className="panel p-5">
              <div className="tabular font-mono text-2xl font-bold text-ink">{fmtUnits(u.totalUnits)}</div>
              <div className="mt-0.5 text-sm text-muted">{u.unit}</div>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-dim">
                {fmtUsd(u.totalUsd)} ÷ {fmtUsd(u.usdPer)} per unit
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-dim">
                {u.source} · as of {u.asOf}
              </p>
              {u.note && <p className="mt-2 text-[12px] leading-relaxed text-muted">{u.note}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ---- Per-company ---- */}
      <section className="mt-10" aria-labelledby="companies-h">
        <h2 id="companies-h" className="eyebrow">
          Who is spending it
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                <th className="py-2 pr-4 font-normal">COMPANY</th>
                <th className="py-2 pr-4 text-right font-normal">LATEST QTR</th>
                <th className="py-2 pr-4 text-right font-normal">TTM</th>
                <th className="py-2 pr-4 text-right font-normal">QoQ</th>
                <th className="py-2 pr-4 text-right font-normal">YoY</th>
                <th className="py-2 font-normal">PERIOD END</th>
              </tr>
            </thead>
            <tbody>
              {s.companies.map((c) => (
                <tr key={c.ticker} className="border-b border-hairline align-top">
                  <td className="py-2.5 pr-4">
                    <span className="font-mono font-bold text-ink">{c.ticker}</span>
                    <span className="ml-2 text-[13px] text-muted">{c.companyName}</span>
                    {c.stale && <span className="chip ml-2">EXCLUDED · STALE</span>}
                    {c.status !== "ok" && <span className="chip ml-2">NO FIGURE</span>}
                    {c.note && <p className="mt-1 max-w-md text-[12px] leading-relaxed text-dim">{c.note}</p>}
                  </td>
                  <td className="tabular py-2.5 pr-4 text-right font-mono text-ink">
                    {c.latestQuarterUsd === undefined ? "—" : fmtUsd(c.latestQuarterUsd)}
                  </td>
                  <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">
                    {c.ttmUsd === undefined ? "—" : fmtUsd(c.ttmUsd)}
                  </td>
                  <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">{fmtPct(c.qoq?.pct)}</td>
                  <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">{fmtPct(c.yoy?.pct)}</td>
                  <td className="py-2.5 font-mono text-[12px] text-dim">
                    {c.latestQuarterEnd ? fmtDay(c.latestQuarterEnd) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- The filers' own words ---- */}
      {contributors.some((c) => c.narrative) && (
        <section className="mt-10" aria-labelledby="why-h">
          <h2 id="why-h" className="eyebrow">
            Why, in their own words
          </h2>
          <p className="mt-1 max-w-2xl text-[13px] text-muted">
            Quoted directly from the filing that reported the spending, with a link back to the source document.
          </p>
          <div className="mt-4 space-y-4">
            {contributors
              .filter((c) => c.narrative)
              .map((c) => (
                <div key={c.ticker} className="panel p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-ink">{c.ticker}</span>
                    <span className="chip">
                      {c.narrative!.form} · FILED {fmtDay(c.narrative!.filed)}
                    </span>
                  </div>
                  {c.narrative!.sentences.map((line, i) => (
                    <p key={i} className="mt-2 text-[13px] leading-relaxed text-muted">
                      &ldquo;{line}&rdquo;
                    </p>
                  ))}
                  <a
                    href={c.narrative!.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-block font-mono text-[12px] text-dim underline underline-offset-2 hover:text-ink"
                  >
                    read the filing →
                  </a>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* ---- Disclosures ---- */}
      <section className="mt-10" aria-labelledby="gaps-h">
        <h2 id="gaps-h" className="eyebrow">
          What this reading cannot tell you
        </h2>
        <ul className="mt-3 max-w-3xl space-y-2">
          {s.flags.map((f, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-muted">
              — {f}
            </li>
          ))}
          <li className="text-[13px] leading-relaxed text-muted">
            — A confirmed constraint is not automatically a mispriced stock. The market may already know. This desk
            generates candidates for further work; it does not replace valuation.
          </li>
        </ul>
        <p className="mt-4 font-mono text-[11px] text-dim">
          conversion table v{s.conversionVersion} ({s.conversionAsOf}) · read {fmtDay(s.takenAt)}
        </p>
      </section>
    </>
  );
}
