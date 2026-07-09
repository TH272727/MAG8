import Link from "next/link";
import HeroConfluence from "@/components/confluence/HeroConfluence";
import EmailCapture from "@/components/landing/EmailCapture";
import LogoMark from "@/components/logo";
import { CITATION_GROUPS } from "@/lib/citations";
import { launchMode } from "@/lib/config";
import { getActiveRun, latestCanonicalRun } from "@/lib/db";
import { fmtDate } from "@/lib/format";
import { sanitizeRankedStock } from "@/lib/public-view";

export const dynamic = "force-dynamic";

/** Live count from the same registry that renders /methodology's evidence base. */
const WORKS_CITED = CITATION_GROUPS.reduce((n, g) => n + g.works.length, 0);

/** Pre-launch board stand-in: fictional scores, redacted tickers, zero real data. */
const MOCKUP_BOARD = [
  { rank: 1, score: "88.6", line: "Fundamentals, game theory, and street consensus each file a blind verdict." },
  { rank: 2, score: "74.2", line: "Where independent methods converge, the score climbs — agreement is the signal." },
  { rank: 3, score: "61.9", line: "Value-trap gates veto weak stories before they ever reach the board." },
] as const;

const HOW = [
  {
    n: "01",
    title: "One scout finds the cohort",
    body: "Deep web research hunts trillion-dollar DNA: the traits today's mega-caps showed before they were big, matched to small and mid-caps riding the same secular waves now.",
  },
  {
    n: "02",
    title: "Three lenses work blind",
    body: "Fundamentals, game theory, and street consensus each analyze every candidate — independently, never seeing each other.",
  },
  {
    n: "03",
    title: "Agreement gets measured",
    body: "A compiler scores each stock; deterministic code verifies the arithmetic. Where independent methods converge, the score says so.",
  },
];

export default function HomePage() {
  // Pre-launch curtain: the homepage is the whole site — no outbound links at
  // all, a static mockup board instead of real data, and no DB reads (a fresh
  // deploy with an empty volume renders identically).
  const launch = launchMode();
  // Canonical only — a focused lab run never swaps the home preview, and the
  // public-view boundary sanitizes legacy report rows before they reach props.
  const latest = launch ? null : latestCanonicalRun();
  const active = launch ? null : getActiveRun();
  const top3 = (latest?.report?.rankings.slice(0, 3) ?? []).map(sanitizeRankedStock);

  return (
    <main>
      {/* ---- Hero ---- */}
      <section className="hero-field relative overflow-hidden border-b border-hairline">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 sm:px-6 sm:pt-20">
          <LogoMark size={44} className="mb-6" />
          <p className="eyebrow">Four-lens research desk</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
            Four lenses hunt the next trillion-dollar stocks.
            <br />
            <span className="text-muted">Agreement is the signal.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted">
            A scout hunts trillion-dollar DNA — the traits today&apos;s giants showed before they were
            giants — in small companies now. Three independent lenses — fundamentals, game theory,
            street consensus — work the cohort blind. When their threads converge, Mag8 measures it.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="chip">26 AGENTS PER RUN</span>
            <span className="chip">3 LENSES, FULLY BLIND</span>
            <span className="chip">{WORKS_CITED} ACADEMIC WORKS CITED</span>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {launch ? (
              <a href="#waitlist" className="btn btn-primary">
                Join the waitlist
              </a>
            ) : active ? (
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
            {!launch && latest && (
              <Link href="/methodology" className="btn">
                Methodology
              </Link>
            )}
          </div>

          <div className="mt-14" aria-hidden="true">
            <HeroConfluence className="mx-auto w-full max-w-4xl" />
          </div>
        </div>
      </section>

      {/* ---- How it works ---- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="how-h">
        <h2 id="how-h" className="eyebrow">
          How a run works
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
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
          what gets scored.
          {!launch && (
            <>
              {" "}
              <Link href="/methodology" className="underline underline-offset-2 hover:text-ink">
                Read the full methodology.
              </Link>
            </>
          )}
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          The scale is real: a full run fields <span className="text-ink">26 agents</span> — one
          discovery scout, three lens analysts on each of eight candidates, and one compiler. And none
          of it is improvised: every lens works from methods published in academic research,{" "}
          {launch ? (
            <>all {WORKS_CITED} works cited</>
          ) : (
            <Link href="/methodology#refs-h" className="underline underline-offset-2 hover:text-ink">
              all {WORKS_CITED} works cited
            </Link>
          )}
          .
        </p>
      </section>

      {/* ---- The two engines ---- */}
      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6" aria-labelledby="engines-h">
        <h2 id="engines-h" className="eyebrow">
          Under the hood — the two engines doing the unusual work
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Discovery — trillion-dollar DNA */}
          <div className="panel border-t-2 border-t-discovery/70 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="font-display text-xl font-bold text-discovery">
                Trillion-dollar DNA, found early
              </h3>
              <span className="font-mono text-[11px] text-dim">STAGE 01 · SCOUT</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Every giant was small once — and the traits showed up before the market cap did. The
              scout studies what today&apos;s trillion-dollar companies looked like{" "}
              <em>before</em> they were big, then hunts the US small- and mid-cap universe for that
              same genome now, wave by wave.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["FOUNDER-LED", "PLATFORM ECONOMICS", "COMPOUNDING MOAT", "NETWORK EFFECTS", "CATEGORY CREATION", "EXPANDING TAM"].map(
                (t) => (
                  <span key={t} className="chip">
                    {t}
                  </span>
                ),
              )}
            </div>
            <p className="mt-4 text-[13px] text-muted">
              Discovery opens the case — it names the traits matched and the wave underneath. It
              never scores its own picks; the three lenses attack the thesis blind.
            </p>
            {!launch && (
              <Link
                href="/methodology#discovery-dna"
                className="mt-4 inline-block font-mono text-[12px] text-muted underline underline-offset-2 hover:text-ink"
              >
                how the DNA screen works →
              </Link>
            )}
          </div>

          {/* Game theory */}
          <div className="panel border-t-2 border-t-macro/70 p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="font-display text-xl font-bold text-macro">
                Game theory: it war-games the world
              </h3>
              <span className="font-mono text-[11px] text-dim">LENS 02 · GT</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Most research asks what a company is worth. This lens asks what the world around it is
              about to do. It maps the players who will actually decide the outcome — states,
              central banks, incumbents, regulators — scores each on mass, energy, and coordination,
              and follows the moves they&apos;re structurally compelled to make. Then it prices the
              gap between what&apos;s likely and what&apos;s priced in.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["PLAYER MAP", "M × E × C", "3–24M PROBABILITIES", "ASYMMETRY 1–10", "FALSIFIER"].map((t) => (
                <span key={t} className="chip">
                  {t}
                </span>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-muted">
              Every read ends with a number and a kill switch: an Asymmetry Score for the mispricing,
              and the observable condition that would prove the whole thesis wrong.
            </p>
            {!launch && (
              <Link
                href="/methodology#game-theory"
                className="mt-4 inline-block font-mono text-[12px] text-muted underline underline-offset-2 hover:text-ink"
              >
                inside the game-theory lens →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ---- Board preview: static MOCKUP pre-launch, real top-3 in full mode ---- */}
      {launch ? (
        <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6" aria-labelledby="latest-h">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="latest-h" className="eyebrow font-bold text-ink">
              MOCKUP LEADERBOARD
            </h2>
            <span className="font-mono text-[12px] text-dim">full board opens at launch</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
            {MOCKUP_BOARD.map((s) => (
              <div key={s.rank} className="bg-panel p-5">
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[11px] tracking-[0.14em] text-dim">#{s.rank}</span>
                  <span className="tabular font-mono text-xl font-bold text-confluence">{s.score}</span>
                </div>
                <div
                  className="mt-1 flex items-center gap-1.5 font-mono text-2xl font-bold tracking-wide"
                  aria-label="Ticker hidden until launch"
                >
                  <span className="text-dim">$</span>
                  <span className="inline-block h-[0.85em] w-20 rounded-sm bg-ink/25" aria-hidden="true" />
                </div>
                <div className="text-sm text-muted">Revealed at launch</div>
                <p className="mt-2 line-clamp-2 text-[13px] text-muted">{s.line}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        top3.length > 0 &&
        latest && (
          <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6" aria-labelledby="latest-h">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="latest-h" className="eyebrow">
                Latest leaderboard — {fmtDate(latest.finishedAt ?? latest.createdAt)}
              </h2>
              <Link href="/rankings" className="font-mono text-[12px] text-muted underline underline-offset-2 hover:text-ink">
                full board →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
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
        )
      )}

      {/* ---- Email capture ---- */}
      <section id="waitlist" className="scroll-mt-16 border-t border-hairline">
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
