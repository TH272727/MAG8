import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CITATION_GROUPS, groundingShorts } from "@/lib/citations";
import { launchMode } from "@/lib/config";
import { buildRubricText } from "@/lib/ranking";
import { buildSourceStandardText, sourceStandardCitations } from "@/lib/source-standard";
import { PUBLIC_DISCOVERY, PUBLIC_LENS_META } from "@/lib/public-lens";
import {
  UNIVERSE_SETTING_GROUPS,
  UNIVERSE_SETTINGS_SPEC,
  effectiveUniverseSettings,
  formatSettingValue,
} from "@/lib/universe-settings";
import {
  BOTTLENECK_SETTING_GROUPS,
  BOTTLENECK_SETTINGS_SPEC,
  effectiveBottleneckSettings,
} from "@/lib/bottleneck-settings";
import { allPlaybooks, DEFAULT_PLAYBOOK_ID, getPlaybook, usesPlaceholderFactors } from "@/lib/bottleneck/playbook";
import {
  ROTATION_SETTING_GROUPS,
  ROTATION_SETTINGS_SPEC,
  effectiveRotationSettings,
} from "@/lib/rotation-settings";
import {
  effectiveInsiderSettings,
  INSIDER_SETTING_GROUPS,
  INSIDER_SETTINGS_SPEC,
} from "@/lib/insider-settings";

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

/**
 * The Bottleneck desk's disclosure. Like the Stage-0 section above, every
 * threshold here is the LIVE effective value from the desk's own resolver
 * (defaults → env → operator overrides), so the page and the desk cannot drift
 * apart. The conversion factors are deliberately NOT here: they belong to a
 * theme's playbook rather than to the operator, and the desk publishes each one
 * with its source beside the number it produced.
 */
function BottleneckSection() {
  const eff = effectiveBottleneckSettings();
  const shown = BOTTLENECK_SETTINGS_SPEC.filter((s) => s.group !== "ops");
  const playbook = getPlaybook(DEFAULT_PLAYBOOK_ID);
  const allThemes = allPlaybooks();
  const sourcedThemes = allThemes.filter((p) => !usesPlaceholderFactors(p));
  return (
    <section id="bottleneck" className="mt-12 scroll-mt-24" aria-labelledby="bottleneck-h">
      <h2 id="bottleneck-h" className="eyebrow">
        The Bottleneck desk — a second product, measured not judged
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        The leaderboard above is a judgment engine. <Link href="/bottleneck" className="underline underline-offset-2 hover:text-ink">The Bottleneck desk</Link>{" "}
        is not: it is arithmetic over public filings, with no model anywhere in it. Any growth story
        implies a physical quantity of something — megawatts, gigabytes, square feet — and the desk
        reads the capital spending those companies have already disclosed, converts it into those
        physical units, and compares how fast that demand is growing against how fast the world&apos;s
        ability to supply it is growing. The widest gap is the tightest constraint. A{" "}
        <em>narrowing</em> gap is reported exactly as prominently as a widening one.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        It shares this application&apos;s database and its SEC connection and nothing else. It cannot
        write to a run, a candidate, a score, or the board; no reading it takes can move a ranking, and
        no ranking can change what it reads.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {BOTTLENECK_SETTING_GROUPS.filter((g) => g.key !== "ops").map((g) => (
          <div key={g.key} className="panel p-5">
            <h3 className="font-display text-base font-semibold">{g.title}</h3>
            <p className="mt-1 text-[13px] text-muted">{g.note}</p>
            <dl className="mt-3 space-y-2">
              {shown
                .filter((s) => s.group === g.key)
                .map((s) => (
                  <div key={s.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <dt className="text-[13px] text-muted">{s.label}</dt>
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

      {playbook && (
        <p className="mt-3 max-w-2xl text-[13px] text-dim">
          What the desk looks at for a given theme — whose spending to read, which filing tags carry it,
          how those dollars become physical units, which series constrain them, and who produces each
          one — lives in that theme&apos;s playbook rather than in the dials above, because it changes
          per theme rather than per operator.{" "}
          {usesPlaceholderFactors(playbook) ? (
            <>
              The conversion factors currently shipped with <span className="text-ink">{playbook.label}</span>{" "}
              are still seeded placeholders, and the desk says so on its own page: the growth rates and
              the ranking do not depend on them — a rate is unaffected by the constant it is divided by —
              but the absolute physical quantities are order-of-magnitude arithmetic until sourced
              benchmarks replace them. {sourcedThemes.length} of {allThemes.length} themes have had that
              work done — {sourcedThemes.map((p) => p.label).join(", ")} — and each of those carries the
              document and page its figures were read from, theme by theme.
            </>
          ) : (
            <>
              Every conversion factor carries its source and an as-of date, the table carries a version,
              and each reading records the version that produced it — so a number computed today stays
              auditable after the assumptions change.
            </>
          )}
        </p>
      )}
    </section>
  );
}

/**
 * The Rotation Board's disclosure. Same contract as the two sections above:
 * every threshold is the LIVE effective value from the board's own resolver, so
 * the page and the board cannot drift apart. Which indicators exist is
 * deliberately NOT here — that is a catalog of ticker pairs rather than an
 * operator preference, and each one publishes its own meaning on its own page.
 */
function RotationSection() {
  const eff = effectiveRotationSettings();
  const shown = ROTATION_SETTINGS_SPEC.filter((s) => s.group !== "ops");
  const s = eff.values;
  const plainAverage =
    s.weightTrend === s.weightStretch && s.weightStretch === s.weightMomentum && s.weightPercentile === 0;
  return (
    <section id="rotation" className="mt-12 scroll-mt-24" aria-labelledby="rotation-h">
      <h2 id="rotation-h" className="eyebrow">
        The Rotation Board — a third product, relative rather than absolute
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        An index going up says nothing about what is going up.{" "}
        <Link href="/rotation" className="underline underline-offset-2 hover:text-ink">
          The Rotation Board
        </Link>{" "}
        divides one traded fund by another so the common market move cancels and only the difference
        remains — the average company against the largest few, growth against value, credit risk against
        safety. Each ratio gets three marks out of ten: how far its 50-day average sits from its 200-day,
        how stretched it is against its own year, and how far the momentum of the ratio itself sits from
        neutral. No model is involved in any of that, and none is involved in deciding when a reading has
        changed.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Only daily closing prices are stored. Every ratio, average, score, tier and direction — and the
        whole history behind them — is recomputed from those prices on each page load, so retuning a dial
        below changes the board, and the marks on every chart, without refetching anything.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        Like the desk above, it shares this application&apos;s database and design and nothing else. It
        cannot write to a run, a candidate, a score, or the board; no reading it takes can move a ranking.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {ROTATION_SETTING_GROUPS.filter((g) => g.key !== "ops").map((g) => (
          <div key={g.key} className="panel p-5">
            <h3 className="font-display text-base font-semibold">{g.title}</h3>
            <p className="mt-1 text-[13px] text-muted">{g.note}</p>
            <dl className="mt-3 space-y-2">
              {shown
                .filter((x) => x.group === g.key)
                .map((x) => (
                  <div key={x.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <dt className="text-[13px] text-muted">{x.label}</dt>
                    <dd className="font-mono text-[13px] text-ink">
                      {formatSettingValue(x, eff.values[x.key as keyof typeof eff.values])}
                      {eff.sources[x.key as keyof typeof eff.sources] === "custom" && (
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
        {plainAverage ? (
          <>
            The three scored marks currently carry equal weight, which makes the composite the plain
            average the published method specifies. A fourth measurement — how extreme a ratio is against
            its full multi-year range — is computed and shown on every indicator but weighted zero, because
            that method does not score it. The consequence is visible and deliberate: a ratio can sit near a
            three-year low and still read as no signal. Raising that weight above zero is the supported way
            to disagree, and the changed weighting appears here the moment it is changed.
          </>
        ) : (
          <>
            The scoring weights have been tuned away from the equal weighting the published method
            specifies, so the composite above is no longer the plain average that method describes. The
            live values are shown so a reader can see exactly which method produced the scores they are
            looking at.
          </>
        )}
      </p>
      <p className="mt-3 max-w-2xl text-[13px] text-dim">
        A written note is produced only when an indicator actually crosses a tier boundary or flips the
        side it favours, never on a schedule and never per visit. The note is assembled from the computed
        figures at no cost. A model may optionally be allowed to rephrase it — that is off by default, and
        when it is on, any note containing a figure that cannot be traced back to a computed input is
        discarded in favour of the deterministic one.
      </p>
    </section>
  );
}

/**
 * The Insider Turnaround Scanner's disclosure. Same contract as the three
 * sections above: every threshold is the LIVE effective value from the
 * scanner's own resolver, so the page and the product cannot drift apart.
 *
 * One thing is said here that is not said on the other three, because it is
 * true only of this one: most of these numbers are not measurements, they are
 * somebody's tolerance for risk, and the page has to say whose.
 */
function InsiderSection() {
  const eff = effectiveInsiderSettings();
  const shown = INSIDER_SETTINGS_SPEC.filter((s) => s.group !== "ops");
  const s = eff.values;
  return (
    <section id="insider" className="mt-12 scroll-mt-24" aria-labelledby="insider-h">
      <h2 id="insider-h" className="eyebrow">
        The Insider Turnaround Scanner — a fourth product, starting from the rare event
      </h2>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        When a company&apos;s officers, directors and large holders trade its shares, the law requires them
        to disclose it within two business days.{" "}
        <Link href="/insider" className="underline underline-offset-2 hover:text-ink">
          The scanner
        </Link>{" "}
        reads that feed, keeps only genuine open-market purchases — not grants, not option exercises, not
        shares withheld to pay tax on one — and works forward: is the price actually down, is the fall
        recent rather than terminal, does the balance sheet survive the same published value-trap tests
        used elsewhere here, and what does the business look worth on its own cash.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-muted">
        The order is the design. Insider purchases are rare, so starting from them means the expensive work
        only ever runs on names that already carry the signal. Roughly two hundred filings a trading day
        come from companies inside the weekly screen; each is opened once and never again, because a filing
        does not change after it is accepted.
      </p>

      <div className="panel mt-4 p-5">
        <h3 className="font-display text-base font-semibold">Whose risk tolerance these are</h3>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-muted">
          Most of the values below are not facts about the market. How far a stock may have fallen, how
          convinced the buying must look, what discount rate future cash deserves, how much cushion an
          estimate must leave — none of those has a correct answer, and a product that presented one as
          settled would be smuggling in an opinion. So these are published as the HOUSE setting, and the
          board offers a reader three named departures from it. Nothing derived is stored, so choosing one
          re-derives the whole candidate list, including the reason each rejected company failed, without a
          single request. The two financial filters are the exception: their thresholds are the
          literature&apos;s, not ours, and a profile does not move them.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {INSIDER_SETTING_GROUPS.filter((g) => g.key !== "ops").map((g) => (
          <div key={g.key} className="panel p-5">
            <h3 className="font-display text-base font-semibold">{g.title}</h3>
            <p className="mt-1 text-[13px] text-muted">{g.note}</p>
            <dl className="mt-3 space-y-2">
              {shown
                .filter((x) => x.group === g.key)
                .map((x) => (
                  <div key={x.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <dt className="text-[13px] text-muted">{x.label}</dt>
                    <dd className="font-mono text-[13px] text-ink">
                      {formatSettingValue(x, eff.values[x.key as keyof typeof eff.values])}
                      {eff.sources[x.key as keyof typeof eff.sources] === "custom" && (
                        <span className="ml-1 text-[11px] text-dim">tuned</span>
                      )}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-muted">
        The financial filters are the same two the fundamentals method applies: a nine-point
        fundamental-strength checklist and a five-ratio bankruptcy model, at the thresholds their authors
        set. A company currently fails if it scores below {s.fScoreFloor} of nine
        {s.allowGreyZone ? " or falls into the bankruptcy model's distress zone" : ", or does not reach the bankruptcy model's safe zone"}.
        A criterion that cannot be judged from a company&apos;s filings scores no point rather than being
        guessed at, so a score understates rather than flatters; a partial solvency score is refused
        outright rather than placed on the same scale as a complete one; and statements that cannot be read
        at all are never treated as evidence of trouble, which would quietly exclude every foreign issuer.
      </p>
      <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted">
        The valuation deducts, from reported earnings plus non-cash charges, both the capital spending the
        business needs to hold its position and the working capital its growth consumes. That first
        deduction cannot be read off a filing — the method&apos;s originator said so when he defined it — so
        two answers are published rather than one: a conservative bound deducting all capital spending, and
        a higher bound treating depreciation as the maintenance figure. The distance between them is the
        honest width of the estimate, and where it exceeds the estimate itself the page says so. Growth is
        cut to {formatSettingValue(INSIDER_SETTINGS_SPEC.find((x) => x.key === "growthHaircutPct")!, s.growthHaircutPct)}{" "}
        of the observed rate and then capped, because growth decays towards the average far faster than
        extrapolation assumes.
      </p>
      <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted">
        What it cannot do is worth stating plainly. The research finding that insider purchases predict
        returns was strongest in companies smaller than the ones this pool draws from, so the effect this
        scanner hunts may be weakest exactly where it is looking. Much insider trading is routine and
        predicts nothing at all; a purchase affirmed as arranged in advance is therefore discounted, and
        where no affirmation was made either way the board says unstated rather than assuming. And only
        companies inside the weekly screen are searched, so buying at a company outside that band is
        invisible here however large it is.
      </p>
      <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-muted">
        Like the desk and the board, it shares this application&apos;s database and design and nothing else.
        It cannot write to a run, a candidate, a score, or the leaderboard, and it reads the weekly screen
        without ever being able to change it.
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

      {/* The Bottleneck desk — live effective settings from its own resolver */}
      <BottleneckSection />

      <RotationSection />

      <InsiderSection />

      {/* Source standard — the exact text injected into every research prompt */}
      <section id="source-standard" className="mt-12 scroll-mt-24" aria-labelledby="source-h">
        <h2 id="source-h" className="eyebrow">
          What counts as evidence — verbatim
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Reaching more places to look does not lower the bar on what may move a number. One rule
          decides that, and every research stage runs under it. This is the text itself, not a
          description of it:
        </p>
        <div className="panel mt-4 p-6">
          <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-muted">
            {buildSourceStandardText()}
          </pre>
        </div>
        <p className="mt-3 max-w-2xl text-[13px] text-dim">
          Injected into every discovery and lens prompt from one module, and written into each
          research playbook by the same generator — so the rule the research runs under, the rule the
          playbook states, and the rule published here cannot drift apart. It narrows what is usable;
          it never relaxes a hard gate, a veto, or the requirement to cite a fetched, dated source.
        </p>
        <p className="mt-3 max-w-2xl text-[13px] text-dim">
          Grounded in:{" "}
          {sourceStandardCitations()
            .map((c) => c.short)
            .join(" · ")}
          . The third is the inconvenient one — unaided expert forecasters were no better than
          novices — which is why the practitioner tier is decided on what a claim actually contains
          and never on a credential.
        </p>
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
