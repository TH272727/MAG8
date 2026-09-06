import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RiskProfilePicker from "@/components/insider/RiskProfilePicker";
import { launchMode } from "@/lib/config";
import { readLedger, type LedgerRow } from "@/lib/crossdesk";
import { countWord, DESK_META, fmtCap, fmtScore, KIND_META } from "@/lib/crossdesk/format";
import type { RiskProfileKey } from "@/lib/insider/profiles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cross-desk",
  description:
    "Where four independent desks — the weekly board, the insider scanner, the bottleneck desk and the rotation board — happen to name the same company.",
};

export default async function CrossdeskPage({
  searchParams,
}: {
  searchParams: Promise<{ risk?: string }>;
}) {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const { risk } = await searchParams;
  const ledger = readLedger({ profile: risk ?? null });

  const naming = ledger.availability.filter((a) => a.desk !== "rotation");
  const withData = naming.filter((a) => a.ok).length;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The cross-desk ledger</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Where the desks name the same company
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Four desks on this platform look for different things in different data. The weekly board hunts companies
        with a path to enormous scale. The insider scanner starts from officers buying their own beaten-down
        stock. The bottleneck desk works backwards from a physical input that is running short. The rotation board
        measures which part of the market is being rewarded. This page does one thing: it says where those desks
        happen to land on the same company, and it labels exactly what each of them actually claimed.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        Nothing here is a recommendation, and a crossing is not a score. It is an observation about overlap
        between four separate readings, computed on demand from data those desks already hold.
      </p>

      {ledger.disabled && (
        <p className="panel mt-6 p-4 text-[13px] text-muted">
          The ledger is switched off. Nothing below would be current.
        </p>
      )}

      {!ledger.disabled && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="chip">{ledger.crossed.length} CROSSINGS</span>
            <span className="chip">{ledger.totalNamed} COMPANIES NAMED</span>
            <span className="chip">
              {withData} OF {naming.length} DESKS WITH DATA
            </span>
            {ledger.universeWeek && <span className="chip">SCREEN {ledger.universeWeek.toUpperCase()}</span>}
          </div>

          {/* -- The honest headline: how much these desks overlap at all. ---- */}
          <section className="mt-8" aria-labelledby="overlap-h">
            <h2 id="overlap-h" className="eyebrow">
              How much these desks overlap
            </h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
              Read this before the table. Two of these desks are built to search different parts of the market —
              one wants companies on their way to enormous scale, the other wants beaten-down companies whose
              officers are buying — so they are not looking at the same universe of names and mostly cannot agree
              even in principle. The numbers below are the honest ceiling on everything underneath.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                    <th scope="col" className="pb-2 font-normal">PAIR OF DESKS</th>
                    <th scope="col" className="pb-2 text-right font-normal">COMPANIES IN COMMON</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.pairs.map((p) => (
                    <tr key={`${p.a}-${p.b}`} className="border-b border-hairline">
                      <td className="py-2 text-[13px] text-muted">
                        {DESK_META[p.a].label} · {DESK_META[p.b].label}
                      </td>
                      <td className="tabular py-2 text-right font-mono text-[13px] text-ink">{p.shared}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
              A company can also cross without two desks agreeing, by being named in more than one of the
              bottleneck desk&rsquo;s industries — a power producer that is both a grid supplier and a nuclear
              operator. {ledger.multiTheme} {ledger.multiTheme === 1 ? "company is" : "companies are"} in that
              position.{" "}
              {ledger.sharedConstraint > 0 && (
                <>
                  {ledger.sharedConstraint} of them{" "}
                  {ledger.sharedConstraint === 1 ? "is named" : "are named"} by two industries that lean on the{" "}
                  <span className="text-ink">same</span> constrained input, which is one constraint appearing
                  twice rather than two — those rows say so.{" "}
                </>
              )}
              This is a real observation and a weaker one than two desks agreeing: it is one desk&rsquo;s method
              applied twice, so these rows always rank below a desk crossing.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ledger.availability.map((a) => (
                <div key={a.desk} className="panel p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link href={DESK_META[a.desk].href} className="text-[13px] text-ink hover:underline">
                      {DESK_META[a.desk].label}
                    </Link>
                    <span className="tabular font-mono text-[12px] text-muted">
                      {a.ok ? `${a.named} named` : "nothing on file"}
                    </span>
                  </div>
                  {!a.ok && a.reason && <p className="mt-2 text-[12px] leading-relaxed text-dim">{a.reason}</p>}
                  {a.desk === "rotation" && a.ok && (
                    <p className="mt-2 text-[12px] leading-relaxed text-dim">
                      Trades funds, not companies — it appears below as neighbourhood context and is never counted
                      as a desk agreeing.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* -- The visitor's own risk tolerance moves the insider desk. ----- */}
          <RiskProfilePicker active={ledger.profileKey as RiskProfileKey} basePath="/crossdesk" />

          {/* -- The crossings. ---------------------------------------------- */}
          <section className="mt-8" aria-labelledby="crossings-h">
            <h2 id="crossings-h" className="eyebrow">
              Named by {countWord(ledger.settings.minDesks)} desks, or by{" "}
              {countWord(ledger.settings.minThemes)} bottleneck industries
            </h2>

            {ledger.crossed.length === 0 ? (
              <div className="panel mt-3 p-5">
                <p className="text-[13px] leading-relaxed text-muted">
                  No company is currently named by {countWord(ledger.settings.minDesks)} or more of these desks,
                  or by {countWord(ledger.settings.minThemes)} or more of the bottleneck desk&rsquo;s industries.
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-dim">
                  That is a statement about the overlap between these desks, not about any company. They were
                  built to look in different places, and most weeks they will.
                </p>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                {ledger.shown.map((row) => (
                  <CrossingCard key={row.ticker} row={row} />
                ))}
                {ledger.truncated && (
                  <p className="text-[12px] text-dim">
                    Showing {ledger.shown.length} of {ledger.crossed.length}.
                  </p>
                )}
              </div>
            )}
          </section>

          {/* -- What this page cannot tell you. ------------------------------ */}
          <section className="mt-10" aria-labelledby="limits-h">
            <h2 id="limits-h" className="eyebrow">
              What agreement here is not
            </h2>
            <ul className="mt-3 max-w-3xl space-y-3 text-[13px] leading-relaxed text-muted">
              <li>
                <span className="text-ink">These desks are not independent.</span> Two of them draw their
                candidates from the same weekly screen, so part of any agreement between them is shared plumbing
                rather than two separate opinions arriving at the same place.
              </li>
              <li>
                <span className="text-ink">Being on a list is not a measurement.</span> The bottleneck desk names
                companies from baskets and supplier maps that are maintained by hand. Every such claim below is
                labelled <em>curated</em>, and the tightening or easing figure beside it — which is measured — is
                about the input, not about the company&rsquo;s shares.
              </li>
              <li>
                <span className="text-ink">Two industries are not two desks.</span> A company named by more
                than one bottleneck industry is listed here, but that is one desk&rsquo;s method applied twice
                over lists the same person maintains — not two methods arriving independently at the same
                company. Those rows rank below every desk crossing, and where the two industries depend on the
                same constrained input the row says that too.
              </li>
              <li>
                <span className="text-ink">A sector fund is a neighbourhood, never the company.</span> The
                classification used here is the exchange&rsquo;s own and is not the one the sector funds are built
                from, so the reading is about the area a company is filed under. One company in this snapshot
                builds drones and is filed under prepackaged software.
              </li>
              <li>
                <span className="text-ink">Counting screens is a setting where things look striking by
                chance.</span> Four desks, several hundred companies and a handful of ways to intersect them will
                always produce a few coincidences. A crossing is a place to start reading, not a finding.
              </li>
              <li>
                <span className="text-ink">One desk is not a rejection.</span>{" "}
                {ledger.single.length.toLocaleString("en-US")} companies below the threshold are counted and kept
                rather than hidden. Most companies any desk names are named by that desk alone.
              </li>
            </ul>
            {ledger.flags.length > 0 && (
              <ul className="mt-4 max-w-3xl space-y-2 text-[13px] leading-relaxed text-muted">
                {ledger.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <p className="mt-4 max-w-3xl text-[12px] text-dim">
              Not financial advice. This is a research instrument, not a recommendation to buy, sell or hold any
              security.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

function CrossingCard({ row }: { row: LedgerRow }) {
  return (
    <article className="panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-lg font-bold tracking-tight">
          <span className="font-mono">{row.ticker}</span>
          {row.companyName && <span className="ml-2 text-base font-normal text-muted">{row.companyName}</span>}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            {countWord(row.desks)} desk{row.desks === 1 ? "" : "s"}
          </span>
          <span className="chip">
            {row.measuredDesks} measured
          </span>
          {row.groups.length > 1 && (
            <span className="chip">{countWord(row.groups.length)} industries</span>
          )}
          {!row.eligible && <span className="chip gate-caution">OUTSIDE THE WEEKLY SCREEN</span>}
        </div>
      </div>

      <p className="mt-1 font-mono text-[12px] text-dim">
        {row.sector ?? "sector not on file"} · {fmtCap(row.marketCapUsd)}
      </p>

      {/* Why this row is here at all — a desk crossing and a theme crossing are
          not the same fact, and the reader should never have to infer which. */}
      <p className="mt-2 text-[12px] leading-relaxed text-dim">
        {row.crossedBy.includes("desks") && row.crossedBy.includes("themes")
          ? "Crosses twice over: separate desks named it, and so did more than one of the bottleneck desk's industries."
          : row.crossedBy.includes("desks")
            ? "Listed because separate desks, working from different data, each named it."
            : "Listed because more than one of the bottleneck desk's industries names it — one desk's method applied twice, not two desks agreeing."}
        {row.groups.length > 1 && row.constraints.length < row.groups.length && (
          <>
            {" "}
            Those industries lean on the <span className="text-muted">same</span> constrained input, so this is
            one constraint showing up in two places rather than two separate ones.
          </>
        )}
      </p>

      <ul className="mt-4 space-y-3">
        {row.claims.map((c, i) => (
          <li key={`${c.desk}-${i}`} className="border-l-2 border-hairline2 pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={c.href ?? DESK_META[c.desk].href} className="text-[12px] text-ink hover:underline">
                {DESK_META[c.desk].label}
              </Link>
              <span className={`chip ${KIND_META[c.kind].chip}`}>{KIND_META[c.kind].label.toUpperCase()}</span>
              {c.chip && <span className="chip">{c.chip}</span>}
              {c.strength !== null && (
                <span className="tabular font-mono text-[12px] text-muted">{fmtScore(c.strength)}</span>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink">{c.headline}</p>
            {c.detail && <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{c.detail}</p>}
          </li>
        ))}

        {row.context?.etf && (
          <li className="border-l-2 border-hairline pl-3">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={row.context.href ?? "/rotation"}
                className="text-[12px] text-ink hover:underline"
              >
                {DESK_META.rotation.label}
              </Link>
              <span className="chip">CONTEXT</span>
              {row.context.approximate && <span className="chip gate-caution">APPROXIMATE MAPPING</span>}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              {row.context.sector} is measured with {row.context.etf} against the market, which reads{" "}
              {fmtScore(row.context.score)}
              {row.context.directionLabel ? ` — ${row.context.directionLabel.toLowerCase()}` : ""}. A fund is the
              neighbourhood, never the company.
            </p>
          </li>
        )}
      </ul>

      {row.flags.length > 0 && (
        <div className="mt-4 border-t border-hairline pt-3">
          <p className="font-mono text-[10px] tracking-[0.14em] text-dim">CAUTIONS FROM THE WEEKLY SCREEN</p>
          <ul className="mt-1.5 space-y-1.5 text-[13px] leading-relaxed text-muted">
            {row.flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
