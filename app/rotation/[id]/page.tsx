import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import RotationChart, { type ChartMarker } from "@/components/rotation/RotationChart";
import ScoreWithDirection from "@/components/rotation/ScoreWithDirection";
import { launchMode } from "@/lib/config";
import { baseRatesFromSeries, loadSeries } from "@/lib/rotation/board";
import { allIndicators, CATEGORY_META, getIndicator } from "@/lib/rotation/catalog";
import {
  directionMark,
  fmtDay,
  fmtNum,
  fmtPct,
  fmtPercentile,
  fmtRatio,
  fmtScore,
  fmtSince,
  TIER_STYLE,
} from "@/lib/rotation/format";
import { rotationSettings } from "@/lib/rotation-settings";
import { scoreIndicator, TIER_META } from "@/lib/rotation/score";
import { daysSinceChange, detectChanges, describeChange } from "@/lib/rotation/state";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // Titles must not leak from behind the curtain either.
  if (launchMode()) return {};
  const { id } = await params;
  const indicator = getIndicator(id);
  if (!indicator) return {};
  return {
    title: `${indicator.label} — Rotation`,
    description: indicator.risingMeans,
  };
}

export default async function IndicatorPage({ params }: { params: Promise<{ id: string }> }) {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const { id } = await params;
  const indicator = getIndicator(id);
  if (!indicator) notFound();

  const settings = rotationSettings();
  const result = scoreIndicator({
    indicator,
    base: loadSeries(indicator.base),
    quote: indicator.quote ? loadSeries(indicator.quote) : null,
    settings,
    withSeries: true,
  });

  const baseRates = baseRatesFromSeries(result.series, settings);
  // Stated rather than hard-coded: the count is part of the data-snooping
  // disclosure below, and a catalog addition must move it.
  const indicatorCount = allIndicators().filter((i) => i.kind === "ratio").length;

  const r = result.reading;
  const changes = detectChanges(indicator.id, result.history);
  const daysSince = r ? daysSinceChange(changes, r.asOf) : null;

  // A marker sits on the ratio line at the session the state changed.
  const byDate = new Map(result.series.map((p) => [p.date, p.value]));
  const markers: ChartMarker[] = r
    ? changes.flatMap((c) => {
        const value = byDate.get(c.date);
        if (value === undefined) return [];
        const strengthening = TIER_META[c.to.tier].rank > TIER_META[c.from.tier].rank;
        return [{ date: c.date, value, label: describeChange(c, r), strengthening }];
      })
    : [];

  const stat = (label: string, value: string, accent = "text-ink") => (
    <div className="bg-panel2 px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.14em] text-dim">{label}</div>
      <div className={`tabular mt-1 font-mono text-lg font-bold ${accent}`}>{value}</div>
    </div>
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <Link href="/rotation" className="font-mono text-[12px] text-muted hover:text-ink">
        ← All rotation signals
      </Link>

      <p className="eyebrow mt-4">{CATEGORY_META[indicator.category].title}</p>
      <h1 className="mt-2 max-w-3xl font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {indicator.label}
      </h1>

      {!r ? (
        <div className="panel mt-6 p-5">
          <p className="text-[13px] leading-relaxed text-muted">
            This indicator is not measured right now: {result.unavailable}.
          </p>
          <p className="mt-2 text-[12px] text-dim">
            Nothing is estimated in its place. An unmeasured reading stays unmeasured until the data supports one.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`chip ${TIER_STYLE[r.tier].chip}`}>{TIER_META[r.tier].label}</span>
            <span className="chip">AS OF {fmtDay(r.asOf).toUpperCase()}</span>
            <span className="chip">{r.sessions} SESSIONS</span>
            {r.stale && <span className="chip gate-caution">DATA STALE</span>}
            {r.basis.mixed && <span className="chip gate-caution">MIXED PRICE BASIS</span>}
          </div>

          <p className="mt-4 max-w-2xl text-lg text-ink">{r.directionLabel}</p>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">{r.meaning}</p>

          {/* -- Headline figures. ------------------------------------------- */}
          <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-panel2 px-4 py-3">
              <div className="font-mono text-[10px] tracking-[0.14em] text-dim">PIVOT SCORE</div>
              <div className="mt-1">
                <ScoreWithDirection
                  scoreLabel={fmtScore(r.score)}
                  tierAccent={TIER_STYLE[r.tier].accent}
                  size="md"
                  {...(({ glyph, ticker, label, accent }) => ({
                    glyph,
                    ticker,
                    directionLabel: label,
                    dirAccent: accent,
                  }))(directionMark(r))}
                />
              </div>
              <div className="mt-1 text-[11px] leading-snug text-dim">
                how decisively, not which way — the marker names the side
              </div>
            </div>
            {stat("RATIO", fmtRatio(r.value))}
            {stat("THREE-YEAR PERCENTILE", fmtPercentile(r.percentile))}
            {stat("LAST STATE CHANGE", fmtSince(daysSince))}
          </div>

          {/* -- The chart. --------------------------------------------------- */}
          <section className="mt-8" aria-labelledby="chart-h">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 id="chart-h" className="eyebrow">
                The ratio, its averages, and every state change
              </h2>
              <span className="font-mono text-[11px] text-dim">
                {fmtDay(result.series[0]?.date ?? r.asOf)} — {fmtDay(r.asOf)}
              </span>
            </div>
            <div className="panel mt-3 p-4">
              <RotationChart points={result.series} markers={markers} label={indicator.label} />
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[11px] text-dim">
                <span>
                  <span className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: "var(--color-discovery)" }} />
                  ratio
                </span>
                <span>
                  <span className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: "var(--color-consensus)" }} />
                  50-day average
                </span>
                <span>
                  <span className="mr-1.5 inline-block h-0.5 w-4 align-middle" style={{ background: "var(--color-dim)" }} />
                  200-day average
                </span>
                <span>shaded — beyond two deviations from its own year</span>
                <span>dots — a state change</span>
              </div>
            </div>
          </section>

          {/* -- How the score was reached. ----------------------------------- */}
          <section className="mt-8" aria-labelledby="score-h">
            <h2 id="score-h" className="eyebrow">
              How this score was reached
            </h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                    <th scope="col" className="pb-2 font-normal">COMPONENT</th>
                    <th scope="col" className="pb-2 font-normal">MEASURED</th>
                    <th scope="col" className="pb-2 text-right font-normal">WEIGHT</th>
                    <th scope="col" className="pb-2 text-right font-normal">MARK</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-hairline">
                    <td className="py-2 text-ink">Trend</td>
                    <td className="py-2 text-[13px] text-muted">
                      50-day is {fmtPct(r.separationPct, 2)} from the 200-day
                      {r.confirmed ? "" : ", and no longer moving with it"}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">{settings.weightTrend}</td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-ink">
                      {fmtScore(r.components.trend)}
                    </td>
                  </tr>
                  <tr className="border-b border-hairline">
                    <td className="py-2 text-ink">Stretch</td>
                    <td className="py-2 text-[13px] text-muted">
                      {fmtNum(r.zScore)} deviations from its own {settings.zWindowDays}-session mean
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                      {settings.weightStretch}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-ink">
                      {fmtScore(r.components.stretch)}
                    </td>
                  </tr>
                  <tr className="border-b border-hairline">
                    <td className="py-2 text-ink">Momentum</td>
                    <td className="py-2 text-[13px] text-muted">
                      momentum of the ratio reads {fmtNum(r.rsi, 1)}, against a neutral 50
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                      {settings.weightMomentum}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-ink">
                      {fmtScore(r.components.momentum)}
                    </td>
                  </tr>
                  <tr className="border-b border-hairline">
                    <td className="py-2 text-ink">Historical position</td>
                    <td className="py-2 text-[13px] text-muted">
                      {fmtPercentile(r.percentile)} of its {settings.percentileWindowDays}-session range
                      {settings.weightPercentile === 0 && " — computed and shown, but not scored"}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                      {settings.weightPercentile}
                    </td>
                    <td className="tabular py-2 text-right font-mono text-[13px] text-ink">
                      {fmtScore(r.components.percentile)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-3">
              {stat("ONE MONTH", fmtPct(r.roc1m), "text-muted")}
              {stat("THREE MONTHS", fmtPct(r.roc3m), "text-muted")}
              {stat("SIX MONTHS", fmtPct(r.roc6m), "text-muted")}
            </div>
          </section>

          {/* -- What followed, the last times it sat here. --------------------- */}
          <section className="mt-8" aria-labelledby="history-h">
            <h2 id="history-h" className="eyebrow">
              What followed, the last times it sat here
            </h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
              Every past session where this ratio sat in the same tenth of its own trailing range, and what the
              ratio did over the {baseRates.horizonSessions} sessions after each one. The sample is counted in{" "}
              <span className="text-ink">separate visits</span>, not in days: a forward reading taken on
              consecutive sessions shares almost all of its window with the reading beside it, so a run of
              qualifying days is one observation rather than many.
            </p>

            {!baseRates.measured ? (
              <div className="panel mt-4 p-5">
                <span className="chip">NOT MEASURED</span>
                <p className="mt-3 text-[13px] leading-relaxed text-muted">{baseRates.unavailable}</p>
                <p className="mt-2 text-[12px] text-dim">
                  Nothing is estimated in its place. An average of a handful of overlapping observations is not a
                  base rate, and publishing one as though it were is the failure this refusal exists to prevent.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
                  {stat("SEPARATE VISITS", String(baseRates.conditional.episodes))}
                  {stat("AFTER A READING LIKE TODAY", fmtPct(baseRates.conditional.meanPct, 2))}
                  {stat("OVER THE WHOLE SPAN", fmtPct(baseRates.unconditional.meanPct, 2), "text-muted")}
                  {stat("DIFFERENCE", fmtPct(baseRates.differencePct, 2))}
                </div>

                <p className="mt-4 max-w-2xl text-[13px] leading-relaxed text-muted">
                  This ratio sits in the{" "}
                  <span className="text-ink">{baseRates.band?.label ?? "—"}</span> of its{" "}
                  {baseRates.percentileWindowDays}-session range. Across{" "}
                  {baseRates.usableSessions.toLocaleString("en-US")} sessions with a finished forward window
                  ({fmtDay(baseRates.spanStart ?? "")} — {fmtDay(baseRates.spanEnd ?? "")}), it has been there on{" "}
                  {baseRates.conditional.sessions.toLocaleString("en-US")} of them, over{" "}
                  {baseRates.conditional.episodes} separate visits, of which{" "}
                  {baseRates.conditional.episodeHitRatePct === null
                    ? "—"
                    : `${Math.round(baseRates.conditional.episodeHitRatePct)}%`}{" "}
                  were followed by a rise. Only the difference between the two figures above carries information:
                  the first alone would look like a forecast and is not one.
                </p>

                {baseRates.bandSharePct !== null && baseRates.bandSharePct >= 40 && (
                  <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                    <span className="chip gate-caution">BARELY CONDITIONAL</span>{" "}
                    <span className="ml-1">
                      This ratio has spent {Math.round(baseRates.bandSharePct)}% of its measurable history in this
                      same band. A ratio in a long trend keeps making new extremes inside its own trailing window,
                      so a figure conditioned on most of the sample is close to the plain figure by construction.
                    </span>
                  </p>
                )}

                {baseRates.directionMatched && (
                  <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
                    Narrowed further to visits that also favoured the same side as today:{" "}
                    <span className="tabular font-mono text-ink">
                      {fmtPct(baseRates.directionMatched.meanPct, 2)}
                    </span>{" "}
                    over {baseRates.directionMatched.episodes} visits. The narrower cut is shown only when it
                    clears the same minimum on its own.
                  </p>
                )}

                {baseRates.conditional.list.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[520px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                          <th scope="col" className="pb-2 font-normal">VISIT</th>
                          <th scope="col" className="pb-2 text-right font-normal">SESSIONS</th>
                          <th scope="col" className="pb-2 text-right font-normal">MEAN</th>
                          <th scope="col" className="pb-2 text-right font-normal">WORST</th>
                          <th scope="col" className="pb-2 text-right font-normal">BEST</th>
                        </tr>
                      </thead>
                      <tbody>
                        {baseRates.conditional.list.slice(0, 12).map((e) => (
                          <tr key={e.startDate} className="border-b border-hairline">
                            <td className="tabular py-2 font-mono text-[12px] text-muted">
                              {e.startDate} → {e.endDate}
                            </td>
                            <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                              {e.sessions}
                            </td>
                            <td className="tabular py-2 text-right font-mono text-[13px] text-ink">
                              {fmtPct(e.meanChangePct, 2)}
                            </td>
                            <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                              {fmtPct(e.worstPct, 2)}
                            </td>
                            <td className="tabular py-2 text-right font-mono text-[13px] text-muted">
                              {fmtPct(e.bestPct, 2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {baseRates.conditional.list.length > 12 && (
                      <p className="mt-2 text-[12px] text-dim">
                        Showing the 12 most recent of {baseRates.conditional.list.length} visits.
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-4 max-w-3xl text-[12px] text-dim">
                  A visit can be a single session or an entire year, and the table says which — a long residency
                  and a two-day touch are not the same evidence. This board carries {indicatorCount} ratios, each
                  with ten bands and a choice of horizon, which is a setting in which some combination will look
                  striking by chance alone. This describes what followed in the past. It does not forecast.
                </p>
              </>
            )}
          </section>

          {/* -- Falsification and disclosure. -------------------------------- */}
          <section className="mt-8" aria-labelledby="wrong-h">
            <h2 id="wrong-h" className="eyebrow">
              How this reading could be wrong
            </h2>
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">{r.falsification}</p>
            {r.falsificationLevel !== null && (
              <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
                Concretely: the 200-day average currently sits at{" "}
                <span className="tabular font-mono text-ink">{fmtRatio(r.falsificationLevel)}</span>. A close
                through it that holds is what would turn this reading over.
              </p>
            )}
            {r.flags.length > 0 && (
              <ul className="mt-3 max-w-3xl space-y-2 text-[13px] leading-relaxed text-muted">
                {r.flags.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            )}
            <p className="mt-4 max-w-3xl text-[12px] text-dim">
              Not financial advice. This is a research instrument, not a recommendation to buy, sell or hold any
              security.
            </p>
          </section>

          {/* -- The change log. ----------------------------------------------- */}
          {changes.length > 0 && (
            <section className="mt-8" aria-labelledby="log-h">
              <h2 id="log-h" className="eyebrow">
                Every state change in the stored history
              </h2>
              <p className="mt-2 max-w-2xl text-[12px] text-dim">
                Derived from the stored prices under the weighting currently in force, not from a log written at
                the time — so these marks describe the method as it stands today.
              </p>
              <ul className="mt-3 space-y-1.5">
                {[...changes].reverse().slice(0, 24).map((c) => (
                  <li key={`${c.date}-${c.kind}`} className="text-[13px] leading-relaxed">
                    <span className="tabular font-mono text-[12px] text-dim">{c.date}</span>{" "}
                    <span className="text-muted">{describeChange(c, r)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
