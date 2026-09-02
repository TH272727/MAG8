import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import DeskControls from "@/components/bottleneck/DeskControls";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { latestDemand } from "@/lib/bottleneck/demand";
import { scoreFromStored } from "@/lib/bottleneck/desk";
import { fmtAge, fmtDay, fmtPct, fmtUnits, fmtUsd } from "@/lib/bottleneck/format";
import type { CategoryScore, ConstraintStatus } from "@/lib/bottleneck/score";
import { allPlaybooks, DEFAULT_PLAYBOOK_ID, getPlaybook } from "@/lib/bottleneck/playbook";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bottleneck",
  description:
    "Dollars are elastic. Turbines aren't. The Bottleneck desk converts disclosed spending into physical units and checks them against what the world can actually produce.",
};

/** Status presentation. Gold is the leaderboard's verdict colour and is never used here. */
const STATUS: Record<ConstraintStatus, { label: string; chip: string; accent: string }> = {
  tightening: { label: "TIGHTENING", chip: "gate-caution", accent: "text-macro" },
  easing: { label: "EASING", chip: "gate-pass", accent: "text-fundamentals" },
  balanced: { label: "BALANCED", chip: "", accent: "text-muted" },
  "insufficient-data": { label: "NOT MEASURED", chip: "", accent: "text-dim" },
};

export default async function BottleneckPage({
  searchParams,
}: {
  searchParams: Promise<{ playbook?: string }>;
}) {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const { playbook: requested } = await searchParams;
  const themes = allPlaybooks();
  const playbookId = themes.some((p) => p.id === requested) ? requested! : DEFAULT_PLAYBOOK_ID;
  const playbook = getPlaybook(playbookId);
  const demand = playbook ? latestDemand(playbook.id) : null;
  const scored = playbook ? scoreFromStored(playbook) : null;
  // Server-decided: a visitor's payload never carries the operating controls,
  // and every action behind them re-checks the token anyway.
  const unlocked = tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);

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
        physical units, then checks each one against what the world can actually produce.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        Read straight from public filings and official statistics, recomputed on demand. No forecasts, no opinions,
        and nothing here is investment advice.
      </p>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Desk sections">
        <Link href="/bottleneck/clone" className="btn">
          Read an institutional book
        </Link>
        <Link href="/bottleneck/exposure" className="btn">
          Audit exposure
        </Link>
      </nav>

      {themes.length > 1 && (
        <nav className="mt-4 flex flex-wrap items-center gap-2" aria-label="Themes">
          <span className="font-mono text-[10px] tracking-[0.14em] text-dim">THEME</span>
          {themes.map((p) => (
            <Link
              key={p.id}
              href={`/bottleneck?playbook=${p.id}`}
              className={`chip ${p.id === playbookId ? "border-macro/50 text-macro" : "hover:border-muted"}`}
            >
              {p.label.toUpperCase()}
            </Link>
          ))}
        </nav>
      )}

      {!playbook || !demand || !scored ? (
        <div className="panel mt-8 p-6">
          <h2 className="font-display text-lg font-semibold">No reading yet</h2>
          <p className="mt-2 max-w-xl text-sm text-muted">
            The desk has not taken its first measurement of this theme. Once it reads the filings, this page shows
            which physical input is the tightest constraint, and whether that constraint is getting worse or better.
          </p>
        </div>
      ) : (
        <>
          <Ranking
            label={scored.snapshot.playbookLabel}
            takenAt={demand.takenAt}
            stale={demand.stale}
            categories={scored.snapshot.categories}
            themeLabel={playbook.label}
          />
          <DemandDetail demand={demand.snapshot} fallbackMeasure={playbook.demand.measure} />
          <Disclosures flags={[...scored.snapshot.flags, ...demand.snapshot.flags]} snapshot={demand.snapshot} />
        </>
      )}

      {playbook && unlocked && <DeskControls playbookId={playbook.id} playbookLabel={playbook.label} />}

      <p className="mt-10 text-[13px] text-dim">
        Looking for the scoring engine instead?{" "}
        <Link href="/rankings" className="underline underline-offset-2 hover:text-ink">
          See the leaderboard
        </Link>
        . Research, not investment advice.
      </p>
    </main>
  );
}

/**
 * A focus directive for the lab, built from a constraint the desk measured.
 *
 * This is the whole extent of the seam between the two products: a URL. The
 * desk hands over a sentence a person can edit or delete, and nothing flows
 * back — no score, no cohort, no dependency in either direction. Capped at the
 * 280 characters the pipeline accepts.
 */
function labFocus(c: CategoryScore, themeLabel: string): string {
  const gap = c.gapPct === null ? "" : ` The gap between demand and supply growth is ${c.gapPct.toFixed(1)} points.`;
  // The theme label keeps its own casing — lowercasing it turns "EV" into "ev".
  const text =
    `Companies that produce ${c.unit} — the ${c.status === "tightening" ? "tightening" : "measured"} ` +
    `constraint on ${themeLabel}.${gap} Start from ${c.owners?.tickers.join(", ")} and look wider.`;
  return text.length <= 280 ? text : `${text.slice(0, 277)}...`;
}

/* ---- The answer: which input is tightest ---- */

function Ranking({
  label,
  takenAt,
  stale,
  categories,
  themeLabel,
}: {
  label: string;
  takenAt: string;
  stale: boolean;
  categories: CategoryScore[];
  themeLabel: string;
}) {
  const measured = categories.filter((c) => c.gapPct !== null);
  return (
    <section className="mt-8" aria-labelledby="rank-h">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="rank-h" className="eyebrow">
          {label} — the tightest constraint first
        </h2>
        <span className="chip">{fmtAge(takenAt)}</span>
        {stale && <span className="chip gate-caution">READING IS STALE</span>}
      </div>
      <p className="mt-2 max-w-2xl text-[13px] text-muted">
        Each row compares how fast the money chasing an input is growing against how fast the ability to supply it
        is growing. The gap between those two rates is the score — and a{" "}
        <span className="text-ink">narrowing</span> gap is reported exactly as prominently as a widening one.
      </p>

      <div className="mt-4 space-y-4">
        {categories.map((c) => {
          const s = STATUS[c.status];
          return (
            <div key={c.key} className="panel p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`chip ${s.chip}`}>{s.label}</span>
                  <h3 className="font-display text-lg font-semibold">{c.unit}</h3>
                </div>
                <div className="tabular font-mono text-2xl font-bold">
                  {c.gapPct === null ? (
                    <span className="text-dim">—</span>
                  ) : (
                    <span className={s.accent}>
                      {c.gapPct >= 0 ? "+" : ""}
                      {c.gapPct.toFixed(1)}
                      <span className="text-sm font-normal text-dim"> pp gap</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
                <div className="bg-panel2 px-4 py-3">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim">DEMAND GROWTH</div>
                  <div className="tabular mt-0.5 font-mono text-lg text-ink">{fmtPct(c.demandGrowthPct)}</div>
                </div>
                <div className="bg-panel2 px-4 py-3">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim">SUPPLY GROWTH</div>
                  <div className="tabular mt-0.5 font-mono text-lg text-ink">{fmtPct(c.supplyGrowthPct)}</div>
                </div>
                <div className="bg-panel2 px-4 py-3">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim">IMPLIED THIS YEAR</div>
                  <div className="tabular mt-0.5 font-mono text-lg text-ink">{fmtUnits(c.demandUnits)}</div>
                </div>
              </div>

              <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted">{c.readout}</p>

              {c.gapChangePct !== null && c.gapChangePct !== 0 && (
                <p className="mt-2 font-mono text-[12px] text-dim">
                  since the previous reading: {c.gapChangePct >= 0 ? "+" : ""}
                  {c.gapChangePct} pp{c.materialMove && <span className="text-macro"> · material move</span>}
                </p>
              )}

              {/* Supply evidence */}
              {c.series.length > 0 && (
                <div className="mt-3 border-t border-hairline pt-3">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim">SUPPLY EVIDENCE</div>
                  <ul className="mt-1.5 space-y-1">
                    {c.series.map((sr) => (
                      <li key={sr.seriesId} className="text-[12px] leading-relaxed text-muted">
                        {sr.sourceUrl ? (
                          <a
                            href={sr.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-hairline underline-offset-2 hover:text-ink"
                          >
                            {sr.label}
                          </a>
                        ) : (
                          sr.label
                        )}
                        {sr.growthPct !== null && !sr.stale && (
                          <span className="text-ink"> · {fmtPct(sr.growthPct)}/yr</span>
                        )}
                        {sr.latestDate && <span className="text-dim"> · latest {fmtDay(sr.latestDate)}</span>}
                        {sr.stale && <span className="text-dim"> · stale, excluded</span>}
                        {sr.stub && <span className="text-dim"> · no automated feed yet</span>}
                        {sr.note && <span className="text-dim"> · {sr.note}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Who controls it */}
              {c.owners && (
                <div className="mt-3 border-t border-hairline pt-3">
                  <div className="font-mono text-[10px] tracking-[0.14em] text-dim">
                    WHO PRODUCES IT — {c.owners.label.toUpperCase()}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.owners.tickers.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                    {c.owners.tickers.length === 0 && (
                      <span className="text-[12px] text-dim">no plainly US-listed producers</span>
                    )}
                  </div>
                  {c.owners.foreign.length > 0 && (
                    <p className="mt-2 text-[12px] leading-relaxed text-dim">
                      Not plainly US-listed, and named because leaving them out would misrepresent who controls
                      this input: {c.owners.foreign.join(", ")}.
                    </p>
                  )}
                  {c.owners.tickers.length > 0 && (
                    <p className="mt-2.5 text-[12px] text-dim">
                      <Link
                        href={`/lab?focus=${encodeURIComponent(labFocus(c, themeLabel))}`}
                        className="underline decoration-hairline underline-offset-2 hover:text-ink"
                      >
                        research this constraint in the lab →
                      </Link>{" "}
                      opens a focused run with this directive already typed in. It is a starting point in an
                      editable box; the desk sends no data to the pipeline and takes none back.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {measured.length === 0 && (
        <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted">
          Nothing is scored yet: the demand side is measured but no supply series has enough history to compare it
          against. The desk says so rather than presenting an unmeasured input as an unconstrained one.
        </p>
      )}
    </section>
  );
}

/* ---- The demand side, in detail ---- */

function DemandDetail({
  demand,
  fallbackMeasure,
}: {
  demand: NonNullable<ReturnType<typeof latestDemand>>["snapshot"];
  /**
   * What this theme measures, for readings taken before the snapshot carried
   * its own label. Falling back to a hardcoded "Capital spending" instead would
   * mislabel exactly the themes the field exists for: homebuilding's stored
   * reading is an inventory build, and calling it capital spending is false.
   */
  fallbackMeasure: string;
}) {
  const contributors = demand.companies.filter((c) => c.status === "ok" && !c.stale);
  return (
    <>
      <section className="mt-12" aria-labelledby="companies-h">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="companies-h" className="eyebrow">
            Where the demand comes from
          </h2>
          <span className="chip">
            {demand.aggregate.contributing} OF {demand.aggregate.basketSize} COMPANIES
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] text-muted">
          {demand.measure ?? fallbackMeasure} across the basket totals{" "}
          <span className="text-ink">{fmtUsd(demand.aggregate.ttmUsd)}</span> over the trailing twelve months,
          growing {fmtPct(demand.aggregate.yoyPct)} year over year. That is the number the physical conversions
          above run on.
        </p>

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
              {demand.companies.map((c) => (
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

      <section className="mt-10" aria-labelledby="factors-h">
        <h2 id="factors-h" className="eyebrow">
          How dollars became units
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] text-muted">
          Each conversion shows the factor used, where it came from, and when — because these are estimates, and an
          estimate without its source is just a number.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                <th className="py-2 pr-4 font-normal">UNIT</th>
                <th className="py-2 pr-4 text-right font-normal">$ PER UNIT</th>
                <th className="py-2 pr-4 text-right font-normal">IMPLIED</th>
                <th className="py-2 font-normal">SOURCE · AS OF</th>
              </tr>
            </thead>
            <tbody>
              {demand.units.map((u) => (
                <tr key={u.key} className="border-b border-hairline align-top">
                  <td className="py-2.5 pr-4 text-ink">{u.unit}</td>
                  <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">{fmtUsd(u.usdPer)}</td>
                  <td className="tabular py-2.5 pr-4 text-right font-mono text-ink">{fmtUnits(u.totalUnits)}</td>
                  <td className="py-2.5 text-[12px] leading-relaxed text-dim">
                    {u.source} · {u.asOf}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
    </>
  );
}

/* ---- What the reading cannot tell you ---- */

function Disclosures({
  flags,
  snapshot,
}: {
  flags: string[];
  snapshot: NonNullable<ReturnType<typeof latestDemand>>["snapshot"];
}) {
  return (
    <section className="mt-10" aria-labelledby="gaps-h">
      <h2 id="gaps-h" className="eyebrow">
        What this reading cannot tell you
      </h2>
      <ul className="mt-3 max-w-3xl space-y-2">
        {flags.map((f, i) => (
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
        conversion table v{snapshot.conversionVersion} ({snapshot.conversionAsOf}) · read {fmtDay(snapshot.takenAt)}
      </p>
    </section>
  );
}
