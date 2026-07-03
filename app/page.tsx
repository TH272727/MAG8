import Link from "next/link";
import ConfluenceLine from "@/components/confluence/ConfluenceLine";
import EmailCapture from "@/components/landing/EmailCapture";
import { getActiveRun, latestCompleteRun } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { DISCOVERY_META, LENS_META } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const LENS_CHIPS = [
  { label: DISCOVERY_META.label, cls: "border-discovery/40 text-discovery" },
  { label: LENS_META["stock-scanner"].label, cls: "border-fundamentals/40 text-fundamentals" },
  { label: LENS_META["gt-predictor"].label, cls: "border-macro/40 text-macro" },
  { label: LENS_META["institutional-forecast"].label, cls: "border-consensus/40 text-consensus" },
];

const HOW = [
  {
    n: "01",
    title: "One scout finds the cohort",
    body: "Deep web research nominates small and mid-caps that match the DNA today's mega-caps had before they were big.",
  },
  {
    n: "02",
    title: "Three lenses work blind",
    body: "Fundamentals, macro asymmetry, and street consensus each analyze every candidate — independently, never seeing each other.",
  },
  {
    n: "03",
    title: "Agreement gets measured",
    body: "A compiler scores each stock; deterministic code verifies the arithmetic. Where independent methods converge, the score says so.",
  },
];

export default function HomePage() {
  const latest = latestCompleteRun();
  const active = getActiveRun();
  const top3 = latest?.report?.rankings.slice(0, 3) ?? [];

  return (
    <main>
      {/* ---- Hero ---- */}
      <section className="grid-bg relative overflow-hidden border-b border-hairline">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
          <p className="eyebrow">Multi-agent research desk</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Four lenses hunt the next trillion-dollar stocks.
            <br />
            <span className="text-muted">Agreement is the signal.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted">
            A scout discovers candidates. Three independent analysts — fundamentals, macro, street
            consensus — each work the cohort blind. When their threads converge, Mag8 measures it.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {active ? (
              <Link href={`/runs/${active.id}`} className="btn btn-primary">
                <span className="live-dot" aria-hidden="true" />
                Watch the live run
              </Link>
            ) : latest ? (
              <Link href="/rankings" className="btn btn-primary">
                See the leaderboard
              </Link>
            ) : (
              <Link href="/methodology" className="btn btn-primary">
                How it works
              </Link>
            )}
            {latest && (
              <Link href="/methodology" className="btn">
                Methodology
              </Link>
            )}
          </div>

          <div className="mt-12" aria-hidden="true">
            <ConfluenceLine mode="ambient" className="mx-auto w-full max-w-4xl" />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {LENS_CHIPS.map((c) => (
              <span key={c.label} className={`chip ${c.cls}`}>
                {c.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="how-h">
        <h2 id="how-h" className="eyebrow">
          How a run works
        </h2>
        <div className="mt-4 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
          {HOW.map((s) => (
            <div key={s.n} className="bg-panel p-5">
              <div className="font-mono text-[11px] tracking-[0.14em] text-dim">STAGE {s.n}</div>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          Why blind lenses? Any one method can talk itself into a story. Independent methods agreeing is
          harder to fake — that agreement, the <span className="text-confluence">confluence</span>, is
          what gets scored.{" "}
          <Link href="/methodology" className="underline underline-offset-2 hover:text-ink">
            Read the full methodology.
          </Link>
        </p>
      </section>

      {/* ---- Latest leaderboard preview ---- */}
      {top3.length > 0 && latest && (
        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6" aria-labelledby="latest-h">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="latest-h" className="eyebrow">
              Latest leaderboard — {fmtDate(latest.finishedAt ?? latest.createdAt)}
            </h2>
            <Link href="/rankings" className="font-mono text-[12px] text-muted underline underline-offset-2 hover:text-ink">
              full board →
            </Link>
          </div>
          <div className="mt-4 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
            {top3.map((s) => (
              <Link
                key={s.ticker}
                href={`/stocks/${s.ticker}`}
                className="group bg-panel p-5 transition-colors hover:bg-panel2"
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-dim">#{s.rank}</span>
                  <span className="tabular font-mono text-xl font-bold text-confluence">{s.finalScore.toFixed(1)}</span>
                </div>
                <div className="mt-1 font-mono text-2xl font-bold tracking-wide group-hover:text-ink">{s.ticker}</div>
                <div className="text-sm text-muted">{s.companyName}</div>
                <p className="mt-2 line-clamp-2 text-[13px] text-muted">{s.verdictLine}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---- Email capture ---- */}
      <section className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight">Get the next leaderboard</h2>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Runs are triggered from the desk, not on a schedule. Leave an address and you&apos;ll get new
            boards when publishing ships.
          </p>
          <div className="mt-5">
            <EmailCapture />
          </div>
        </div>
      </section>
    </main>
  );
}
