import type { Metadata } from "next";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CITATION_GROUPS, groundingShorts } from "@/lib/citations";
import { buildRubricText } from "@/lib/ranking";
import { PUBLIC_DISCOVERY, PUBLIC_LENS_META } from "@/lib/public-lens";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Mag8's three-stage pipeline and Trillion-Dollar Confluence Score work.",
};

const STAGES = [
  {
    n: "01",
    name: "Discovery",
    body: "The discovery scout runs a proprietary playbook: heavy web research matching small and mid-cap companies against the traits today's mega-caps had before they were big, riding durable secular waves. It nominates the candidate cohort.",
  },
  {
    n: "02",
    name: "Independent lenses",
    body: "Each candidate is analyzed by three lenses that cannot see each other's work: a fundamentals scanner (Piotroski F, Altman Z, reverse-DCF, value-trap gates), a game-theory macro engine (base rates, asymmetry scoring), and a street-consensus aggregator (live-verified analyst targets).",
  },
  {
    n: "03",
    name: "Compilation",
    body: "A compiler applies the confluence rubric below to every candidate. The platform then re-computes the arithmetic deterministically — gates, bonuses, sorting — so judgment proposes and the code enforces.",
  },
];

const LENSES = [
  {
    accent: "discovery",
    name: PUBLIC_DISCOVERY.label,
    code: PUBLIC_DISCOVERY.short,
    body: "Finds the cohort and argues each thesis: what mega-cap DNA does this company match, and what wave is it riding?",
  },
  {
    accent: "fundamentals",
    name: PUBLIC_LENS_META.fundamentals.label,
    code: PUBLIC_LENS_META.fundamentals.short,
    body: "Is the business financially real? Distress-zone balance sheets (Altman Z < 1.81, Piotroski F ≤ 3) or value-trap mechanics veto the gate no matter how good the story is.",
  },
  {
    accent: "macro",
    name: PUBLIC_LENS_META.macro.label,
    code: PUBLIC_LENS_META.macro.short,
    body: "What do structural forces say? Anchors on outside-view base rates, then scores how mispriced the setup is (Asymmetry 1–10) with explicit falsification conditions.",
  },
  {
    accent: "consensus",
    name: PUBLIC_LENS_META.consensus.label,
    code: PUBLIC_LENS_META.consensus.short,
    body: "What does the street actually say right now? Live-verified price targets only — stance, spread, freshness, and the gap between consensus and spot.",
  },
] as const;

const ACCENT_TEXT: Record<string, string> = {
  discovery: "text-discovery",
  fundamentals: "text-fundamentals",
  macro: "text-macro",
  consensus: "text-consensus",
};
const ACCENT_BORDER: Record<string, string> = {
  discovery: "border-t-discovery/70",
  fundamentals: "border-t-fundamentals/70",
  macro: "border-t-macro/70",
  consensus: "border-t-consensus/70",
};

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Methodology</p>
      <h1 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Independent methods agreeing is itself the signal.
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Any single analysis can talk itself into anything. Mag8 runs four that cannot talk to each
        other, then measures where they land together. The pipeline, the lenses, and the exact scoring
        arithmetic are below — the same rubric text the compiler receives.
      </p>

      {/* Pipeline */}
      <section className="mt-12" aria-labelledby="pipeline-h">
        <h2 id="pipeline-h" className="eyebrow">
          The pipeline
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
          {STAGES.map((s) => (
            <div key={s.n} className="bg-panel p-5">
              <div className="font-mono text-[11px] tracking-[0.14em] text-dim">STAGE {s.n}</div>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.name}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Lenses */}
      <section className="mt-12" aria-labelledby="lenses-h">
        <h2 id="lenses-h" className="eyebrow">
          The four threads
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LENSES.map((l) => (
            <div key={l.code} className={`panel border-t-2 p-5 ${ACCENT_BORDER[l.accent]}`}>
              <div className="flex items-baseline justify-between gap-3">
                <h3 className={`font-display text-base font-semibold ${ACCENT_TEXT[l.accent]}`}>{l.name}</h3>
                <span className="font-mono text-[11px] text-dim">{l.code}</span>
              </div>
              <p className="mt-2 text-sm text-muted">{l.body}</p>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-dim">
                Grounded in: {groundingShorts(l.accent)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Rubric — rendered from the same constants the pipeline enforces */}
      <section className="mt-12" aria-labelledby="rubric-h">
        <h2 id="rubric-h" className="eyebrow">
          The scoring rubric — verbatim
        </h2>
        <div className="panel mt-4 p-6">
          <div className="md-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{buildRubricText()}</ReactMarkdown>
          </div>
        </div>
        <p className="mt-3 text-[13px] text-dim">
          This text is generated from the same constants the pipeline uses to verify every score — the
          page and the compiler cannot drift apart.
        </p>
      </section>

      {/* References — rendered from the same registry that generates each lens's bibliography */}
      <section className="mt-12" aria-labelledby="refs-h">
        <h2 id="refs-h" className="eyebrow">
          The evidence base
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          The methods each lens applies — and the rubric that combines them — are grounded in published
          research and standard practice. Grounding means the method is credited and its limits are
          measured, not that results are guaranteed: several of the works below quantify exactly how
          often these methods fail.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4">
          {CITATION_GROUPS.map((g) => (
            <div key={g.key} className="panel p-5">
              <h3 className={`font-display text-base font-semibold ${ACCENT_TEXT[g.key] ?? ""}`}>
                {g.title}
              </h3>
              <p className="mt-1 text-[13px] text-muted">{g.intro}</p>
              <ul className="mt-3 space-y-3">
                {g.works.map((w) => (
                  <li key={w.short} className="text-[13px] leading-relaxed">
                    <span className="text-ink">
                      {w.authors} ({w.year}).
                    </span>{" "}
                    {w.url ? (
                      <a
                        href={w.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-words underline decoration-hairline underline-offset-2 hover:text-ink"
                      >
                        <em>{w.title}</em>
                      </a>
                    ) : (
                      <em>{w.title}</em>
                    )}
                    <span className="text-dim"> — {w.source}.</span>
                    <span className="mt-0.5 block text-muted">
                      {w.finding} <span className="text-dim">{w.usedFor}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Operational notes */}
      <section className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Operational notes">
        <div className="panel p-5">
          <h3 className="font-display text-base font-semibold">Freshness &amp; caching</h3>
          <p className="mt-2 text-sm text-muted">
            Lens analyses are cached per ticker, per lens, per ISO week — matching the fundamentals
            lens&apos;s weekly cadence. Within a week, repeat runs reuse completed cells (marked
            &ldquo;cached&rdquo;); a new week means fresh research. Admins can force a full re-run.
          </p>
        </div>
        <div className="panel p-5">
          <h3 className="font-display text-base font-semibold">Judgment proposes, code enforces</h3>
          <p className="mt-2 text-sm text-muted">
            The lenses assign sub-scores and write the evidence; deterministic code re-derives the gate
            from the fundamentals lens&apos;s own labels, recomputes the weighted score, re-sorts, and
            enforces the placement rule. Any correction is appended to the stock&apos;s grounding notes in
            plain sight.
          </p>
        </div>
        <div className="panel p-5 sm:col-span-2">
          <h3 className="font-display text-base font-semibold">Grounding checks &amp; determinism</h3>
          <p className="mt-2 text-sm text-muted">
            AI text generation cannot be made bit-for-bit repeatable, so Mag8 does not pretend it can.
            Repeatability lives in the layers around the models: the deterministic score verification,
            the weekly cache, and independent grounding checks — every lens write-up must end with a
            sources section, thinly-sourced write-ups are flagged, the fundamentals and street-consensus
            lenses&apos; spot prices are compared against each other, and each spot price is cross-checked
            against an independent market-data feed. Anything that fails a check is disclosed as a data
            gap on the run and the affected figures are treated with caution — never silently trusted.
          </p>
        </div>
      </section>

      {/* Full disclaimer */}
      <section className="mt-12" aria-labelledby="disclaimer-h">
        <h2 id="disclaimer-h" className="eyebrow">
          Disclaimer
        </h2>
        <div className="panel mt-4 space-y-3 p-6 text-sm text-muted">
          <p>
            Mag8 is an automated research pipeline provided for information and education only. It is{" "}
            <strong className="text-ink">not investment advice</strong>, not a recommendation, and not an
            offer or solicitation to buy or sell any security.
          </p>
          <p>
            Outputs are generated by AI language models. They can hallucinate figures, misread sources,
            rely on stale data, or be confidently wrong. Analyst targets aggregated by the consensus lens
            are opinions with a historically poor hit rate. Scores are arithmetic over model judgments —
            they are not probabilities of returns.
          </p>
          <p>
            No fiduciary, advisory, or client relationship is created by using this site. Investing
            involves risk, including total loss. Do your own research and consider consulting a licensed
            financial professional who knows your circumstances before acting on anything you read here.
          </p>
        </div>
      </section>

      <div className="mt-10">
        <Link href="/rankings" className="btn">
          See the current leaderboard
        </Link>
      </div>
    </main>
  );
}
