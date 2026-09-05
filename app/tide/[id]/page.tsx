import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StressBar from "@/components/tide/StressBar";
import TideChart from "@/components/tide/TideChart";
import { launchMode } from "@/lib/config";
import { FAMILY_META, getGauge, getSeries, HORIZON_META } from "@/lib/tide/catalog";
import { readTide } from "@/lib/tide/desk";
import { fmtDay, fmtPct, fmtReading, fmtStress, TONE_CLASS, stressTone } from "@/lib/tide/format";
import { meaningFor } from "@/lib/tide/normalize";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // Titles must not leak from behind the curtain either.
  if (launchMode()) return {};
  const { id } = await params;
  const gauge = getGauge(id);
  if (!gauge) return {};
  return { title: `${gauge.label} — The Tide`, description: gauge.highMeans };
}

export default async function GaugePage({ params }: { params: Promise<{ id: string }> }) {
  if (launchMode()) notFound();
  const { id } = await params;
  const gauge = getGauge(id);
  if (!gauge) notFound();

  const board = readTide({ withHistory: true });
  const reading = [...board.readings, ...board.context].find((r) => r.gauge.id === id);
  if (!reading) notFound();

  const sources = gauge.inputs.map((sid) => getSeries(sid)).filter((s) => s !== null);
  const unit = sources[0]?.unit ?? "reading";
  const tone = stressTone(reading.stress);

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="eyebrow">
        <Link href="/tide" className="underline decoration-hairline underline-offset-2 hover:text-ink">
          The tide
        </Link>{" "}
        · {FAMILY_META[gauge.family].title}
      </p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">{gauge.label}</h1>
      {gauge.attribution && <p className="mt-2 text-sm text-dim">After {gauge.attribution}.</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        <span className="chip">{HORIZON_META[gauge.horizon].title.toUpperCase()}</span>
        <span className="chip">
          {gauge.polarity === "high-is-bad" ? "A HIGH READING IS BAD" : "A HIGH READING IS GOOD"}
        </span>
        {gauge.kind === "context" && <span className="chip">REPORTED, NEVER SCORED</span>}
        {reading.stale && <span className="chip gate-caution">SOURCE STALE</span>}
      </div>

      {reading.unavailable ? (
        <div className="panel mt-6 p-5">
          <p className="text-sm text-muted">
            <span className="text-dim">NOT MEASURED.</span> {reading.unavailable}.
          </p>
          <p className="mt-2 text-[13px] text-dim">
            Nothing is estimated in its place, and this reading contributed nothing to any figure on the desk —
            rather than being counted as neutral, which would have pulled the composite toward the middle while
            looking like a complete reading.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Tile label={`Reading (${unit})`} value={fmtReading(reading.value)} />
            <Tile label="Rank against its own history" value={fmtPct(reading.percentile)} />
            <Tile label="Standard score" value={reading.zScore === null ? "—" : reading.zScore.toFixed(2)} />
            <Tile
              label="Score out of 100"
              value={fmtStress(reading.stress)}
              className={TONE_CLASS[tone]}
            />
          </div>
          <StressBar stress={reading.stress} />
          <p className="mt-2 text-[13px] text-dim">
            As of {fmtDay(reading.asOf)} · ranked against {reading.window} monthly observations, from{" "}
            {reading.observations} available.
          </p>

          <section className="mt-8" aria-labelledby="says-h">
            <h2 id="says-h" className="eyebrow">
              What it is saying now
            </h2>
            <p className="mt-2 max-w-2xl text-muted">{meaningFor(reading)}</p>
          </section>

          <section className="mt-8" aria-labelledby="chart-h">
            <h2 id="chart-h" className="eyebrow">
              The reading, and where it ranked
            </h2>
            <div className="mt-3">
              <TideChart points={reading.history ?? []} unit={unit} />
            </div>
          </section>
        </>
      )}

      <section className="mt-8" aria-labelledby="both-h">
        <h2 id="both-h" className="eyebrow">
          What each direction means
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="panel p-5">
            <p className="text-[11px] uppercase tracking-wide text-dim">A high reading</p>
            <p className="mt-1 text-[13px] text-muted">{gauge.highMeans}</p>
          </div>
          <div className="panel p-5">
            <p className="text-[11px] uppercase tracking-wide text-dim">A low reading</p>
            <p className="mt-1 text-[13px] text-muted">{gauge.lowMeans}</p>
          </div>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="wrong-h">
        <h2 id="wrong-h" className="eyebrow">
          How this reading could be misleading
        </h2>
        <p className="mt-2 max-w-2xl text-muted">{gauge.falsification}</p>
      </section>

      <section className="mt-8" aria-labelledby="src-h">
        <h2 id="src-h" className="eyebrow">
          Where the numbers come from
        </h2>
        <ul className="mt-3 space-y-2">
          {sources.map((s) => (
            <li key={s!.id} className="text-[13px] text-muted">
              <span className="text-ink">{s!.label}</span> — {s!.publisher}, published {s!.frequency}, in {s!.unit}.
              {s!.sourceUrl && (
                <>
                  {" "}
                  <a
                    href={s!.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-hairline underline-offset-2 hover:text-ink"
                  >
                    Source
                  </a>
                  .
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-2xl text-[13px] text-dim">
          Every gauge here is judged against its own past rather than against a fixed threshold. Saying a ratio above
          some round number is expensive is an argument; saying it is higher than it has been in nine years out of
          ten is a measurement — and unlike a fixed threshold it does not quietly stop meaning what it meant when
          the world moves.
        </p>
        <p className="mt-2 text-[13px] text-dim">Not financial advice.</p>
      </section>
    </main>
  );
}

function Tile({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] uppercase tracking-wide text-dim">{label}</p>
      <p className={`mt-1 font-mono text-lg ${className || "text-ink"}`}>{value}</p>
    </div>
  );
}
