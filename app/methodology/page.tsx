import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CITATION_GROUPS, groundingShorts } from "@/lib/citations";
import { launchMode } from "@/lib/config";
import { buildRubricText } from "@/lib/ranking";
import { PUBLIC_DISCOVERY, PUBLIC_LENS_META } from "@/lib/public-lens";
import {
  UNIVERSE_SETTING_GROUPS,
  UNIVERSE_SETTINGS_SPEC,
  effectiveUniverseSettings,
  formatSettingValue,
} from "@/lib/universe-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How Mag8's three-stage pipeline and Trillion-Dollar Confluence Score work.",
};

const STAGES = [
  {
    n: "00",
    name: "Universe screen",
    body: "Before any judgment runs, deterministic code — no model — pulls every US primary-exchange listing and filters it on exchange feeds and SEC filings data: size band, liquidity, price and listing-age floors, pooled-vehicle hygiene, cash-runway and shell solvency. Survivors are then ranked by a fixed-weight fundamentals composite from the same filings; the ranked list becomes the scout's weekly pool.",
  },
  {
    n: "01",
    name: "Discovery",
    body: "The discovery scout runs a proprietary playbook: heavy web research matching small and mid-cap companies against the traits today's mega-caps had before they were big, riding durable secular waves. It nominates the candidate cohort.",
  },
  {
    n: "02",
    name: "Independent lenses",
    body: "Each candidate is analyzed by three lenses that cannot see each other's work: a fundamentals scanner (Piotroski F, Altman Z, reverse-DCF, value-trap gates), a game-theory engine (player maps, base rates, asymmetry scoring), and a street-consensus aggregator (live-verified analyst targets).",
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
    body: "Who are the players, and what are they compelled to do? Maps the actors around the stock, anchors on outside-view base rates, prices the 3–24-month scenarios, then scores how mispriced the setup is (Asymmetry 1–10) — with explicit falsification conditions.",
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

/**
 * The Stage-0 disclosure renders the LIVE effective thresholds from the same
 * resolver the pipeline screens with (defaults → env → operator overrides) —
 * like the rubric, the page and the screen cannot drift apart.
 */
function UniverseScreenSection() {
  const eff = effectiveUniverseSettings();
  const shown = UNIVERSE_SETTINGS_SPEC.filter((s) => s.group !== "ops");
  return (
    <section id="universe-screen" className="mt-12 scroll-mt-24" aria-labelledby="universe-h">
      <h2 id="universe-h" className="eyebrow">
        Stage 0 — the universe screen, in the open
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        The scout&apos;s weekly pool is not curated by anyone&apos;s judgment. Deterministic code
        pulls every listing on the US primary exchanges (~7,000 names), joins structured SEC
        filings data — cash, operating cash flow, revenue and its growth, equity, share counts —
        and applies the thresholds below mechanically. What survives is then <em>ranked</em> by a
        fixed-weight fundamentals composite computed from the same filings (revenue growth,
        cash-flow margin and its trajectory, share-count discipline, cash survivability — each a
        percentile within the eligible set, missing data scoring neutral): the top of the ranking
        leads the weekly pool with per-name filings digests, so selection evidence reaches the
        scout before name familiarity can, and the rest rotates sector-stratified week to week.
        The same data later cross-checks every delivered pick and hands each lens verified
        reference figures, so grounding starts from filings rather than model recall.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {UNIVERSE_SETTING_GROUPS.filter((g) => g.key !== "ops").map((g) => (
          <div key={g.key} className="panel p-5">
            <h3 className="font-display text-base font-semibold">{g.title}</h3>
            <p className="mt-1 text-[13px] text-muted">{g.note}</p>
            <dl className="mt-3 space-y-2">
              {shown
                .filter((s) => s.group === g.key)
                .map((s) => (
                  <div key={s.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <dt className="text-[13px] text-muted">
                      {s.label}
                      {s.cites.length > 0 && (
                        <span className="ml-2 font-mono text-[11px] text-dim">{s.cites.join(" · ")}</span>
                      )}
                    </dt>
                    <dd className="font-mono text-[13px] text-ink">
                      {formatSettingValue(s, eff.values[s.key as keyof typeof eff.values])}
                      {eff.sources[s.key as keyof typeof eff.sources] === "custom" && (
                        <span className="ml-1.5 text-[11px] text-dim">(tuned)</span>
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="mt-3 max-w-2xl text-[13px] text-dim">
        Fail-open by construction: a name missing a data point passes the affected screen —
        absence of data is never treated as evidence (foreign filers reporting under IFRS are the
        main gap). Every threshold above is a live value from the running configuration, tunable by
        the operator; the research behind each default is in the evidence base below. When a
        delivered pick sits outside the band or trips a solvency check, the run says so in its
        published gap notes.
      </p>
    </section>
  );
}

export default function MethodologyPage() {
  // Pre-launch curtain: hidden like every other page — the homepage stands alone.
  if (launchMode()) notFound();

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
        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map((s) => (
            <div key={s.n} className="bg-panel p-5">
              <div className="font-mono text-[11px] tracking-[0.14em] text-dim">STAGE {s.n}</div>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.name}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stage-0 universe screen — live effective thresholds */}
      <UniverseScreenSection />

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

      {/* The two engines, closer up */}
      <section className="mt-12" aria-labelledby="engines-h">
        <h2 id="engines-h" className="eyebrow">
          The two engines, closer up
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Two parts of the pipeline do work you will not find in a stock screener: the discovery
          stage&apos;s DNA matching and the game-theory lens. Here is what each one actually does.
        </p>

        {/* Discovery — the DNA screen */}
        <div id="discovery-dna" className="panel mt-4 scroll-mt-24 border-t-2 border-t-discovery/70 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-display text-lg font-semibold text-discovery">
              Discovery — the trillion-dollar DNA screen
            </h3>
            <span className="font-mono text-[11px] text-dim">{PUBLIC_DISCOVERY.short}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Since 1926, the best-performing ~4% of US stocks account for <em>all</em> of the
            market&apos;s net wealth creation over Treasury bills (Bessembinder 2018 — in the evidence
            base below). Returns don&apos;t spread out; they concentrate in a handful of compounders.
            The scout&apos;s whole mandate is finding members of that 4% while they are still small.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            So it inverts the usual question. Instead of &ldquo;what looks cheap this week?&rdquo; it
            asks: <span className="text-ink">what did the trillion-dollar companies look like before
            they were trillion-dollar companies — and who looks like that now?</span> The traits the
            giants shared before they were big are the genome; the screen hunts US-listed small and
            mid-caps expressing it today, while the label on the tin still says niche.
          </p>
          <dl className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2">
            {[
              ["Founder-led", "The founder still steering, reinvesting heavily in R&D and capacity (Fahlenbrach 2009)."],
              ["Platform economics", "Every new customer makes the product cheaper or better for the next one."],
              ["Compounding moat", "A structural power — network effects, switching costs, scale — already visible at small size (Helmer 2016)."],
              ["Category creation", "Selling something that had no market yesterday, so growth is taken from the future, not from rivals."],
              ["S-curve timing", "Sitting near the knee of an adoption curve as a durable secular wave arrives underneath (Rogers 1962)."],
              ["Misunderstood", "Consensus sees a toy, a niche, or a money-loser. The asymmetry lives in that gap."],
            ].map(([t, d]) => (
              <div key={t} className="bg-panel2 px-4 py-3">
                <dt className="eyebrow text-discovery">{t}</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Every nomination names the specific traits matched and the wave underneath it — a
            hypothesis, stated so it can be attacked. Discovery opens the case and argues it; it
            never scores it. The three lenses below take the thesis apart independently, and the
            weekly leaderboard is what survives.
          </p>
        </div>

        {/* Game theory — the world, war-gamed */}
        <div id="game-theory" className="panel mt-4 scroll-mt-24 border-t-2 border-t-macro/70 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="font-display text-lg font-semibold text-macro">
              Game Theory — the world, war-gamed
            </h3>
            <span className="font-mono text-[11px] text-dim">{PUBLIC_LENS_META.macro.short}</span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Most research asks what a company is worth. This lens asks what the world around it is
            about to do — export controls, rate regimes, subsidy races, procurement cycles, cartel
            discipline. For a small company riding a big wave, those moves often decide more than any
            quarterly print. Markets are games; games have players; players can be read.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted">Every cell it files is built the same way:</p>
          <dl className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2">
            {[
              ["1 · Player map", "The actors that actually decide the outcome — states, central banks, incumbents, regulators, suppliers — each scored Mass × Energy × Coordination (1–10): the weight they swing, how badly they want it, how coherently they can act."],
              ["2 · Compelled moves", "The read looks for dominant strategies — moves a player makes in every scenario because incentives leave no real alternative. Structure over opinion."],
              ["3 · Base rate first", "Before any story: the outside-view base rate for situations shaped like this one (reference-class forecasting). The specific case only adjusts it."],
              ["4 · Horizon probabilities", "The primary outcome is priced at 3, 6, 12, and 24 months — a thesis is a curve over time, not a vibe."],
              ["5 · Asymmetry Score (1–10)", "The gap between what the lens judges likely and what the market has priced. 10 = maximum mispricing — the setups worth waking up for."],
              ["6 · The falsifier", "Every read states the observable condition that would kill it. A thesis that cannot be wrong is not a thesis."],
            ].map(([t, d]) => (
              <div key={t} className="bg-panel2 px-4 py-3">
                <dt className="eyebrow text-macro">{t}</dt>
                <dd className="mt-1 text-[13px] leading-relaxed text-muted">{d}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            The forecasting literature is blunt about unaided expert prediction (Tetlock 2005; Green
            2005 — below), which is why this lens is graded rather than trusted: base rates come
            first, the opposing case is argued in every report, and its probability calls are logged
            and Brier-scored. On each stock&apos;s page all of this renders as instruments — the
            player map, the horizon fan, the asymmetry dial — with the full write-up underneath.
          </p>
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
