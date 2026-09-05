import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import TideControls from "@/components/tide/TideControls";
import StressBar from "@/components/tide/StressBar";
import { ADMIN_COOKIE, tokenMatches } from "@/lib/auth";
import { launchMode } from "@/lib/config";
import { FAMILY_META, HORIZON_META } from "@/lib/tide/catalog";
import { readTide } from "@/lib/tide/desk";
import {
  fmtDay,
  fmtMonth,
  fmtPct,
  fmtReading,
  fmtSigned,
  fmtStress,
  fmtWhole,
  POSTURE_TONE,
  TONE_CLASS,
  stressTone,
} from "@/lib/tide/format";
import { meaningFor } from "@/lib/tide/normalize";
import { POSTURE_META, type Composite } from "@/lib/tide/score";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Tide",
  description:
    "What the market's own conditions say about how much to own — about forty published readings, each ranked against its own history, aggregated into a near-term and a long-horizon score.",
};

export default async function TidePage() {
  // Pre-launch curtain: the page stays in the tree but 404s until launch.
  if (launchMode()) notFound();

  const board = readTide({ withBaseRates: true });
  // Server-decided: a visitor's payload never carries the operating controls,
  // and every action behind them re-checks the token anyway.
  const unlocked = tokenMatches((await cookies()).get(ADMIN_COOKIE)?.value ?? null);

  const { fast, slow, goodBad, exposure, baseRates } = board;

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="eyebrow">The tide</p>
      <h1 className="mt-2 max-w-3xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
        How much of the market is worth owning right now
      </h1>
      <p className="mt-4 max-w-2xl text-muted">
        Every other desk here asks which company. This one asks whether to be in the market at all. It reads about
        forty published measurements — the shape of the yield curve, what lenders charge for risk, how many
        companies are actually participating, what the market costs against the economy behind it — ranks each one
        against its own history, and points it in the direction that is bad for someone who owns shares.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-dim">
        It publishes two figures and never averages them, because they answer different questions over different
        spans. Nothing here is a forecast, and nothing here is advice.
      </p>

      {board.disabled && (
        <div className="panel mt-8 p-5">
          <p className="text-sm text-muted">
            The desk is switched off. Nothing is being read and no figure below would mean anything.
          </p>
        </div>
      )}

      {board.empty && !board.disabled && (
        <div className="panel mt-8 p-5">
          <p className="text-sm text-muted">
            Nothing has been stored yet, so there is no reading. The sources have to be read once before the desk
            can say anything.
          </p>
        </div>
      )}

      {!board.disabled && !board.empty && (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="chip">AS OF {fmtDay(board.asOf).toUpperCase()}</span>
            <span className="chip">{fast.totalGauges + slow.totalGauges} READINGS</span>
            <span className="chip">$0 · NO RESEARCH CAPACITY</span>
            {board.stale.length > 0 && <span className="chip gate-caution">{board.stale.length} SOURCES STALE</span>}
          </div>

          {/* ---- the two horizons, side by side, never averaged ---- */}
          <section className="mt-10" aria-labelledby="horizons-h">
            <h2 id="horizons-h" className="eyebrow">
              Two readings, deliberately not one
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              A hundred is the worst this desk can report and fifty is the middle of each reading&rsquo;s own
              history. Averaging the two would report something mild and hide the only information in the picture,
              which is whether they agree.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {[fast, slow].map((c) => (
                <CompositeCard key={c.horizon} composite={c} />
              ))}
            </div>
          </section>

          {/* ---- the exposure band ---- */}
          <section className="mt-10" aria-labelledby="exposure-h">
            <h2 id="exposure-h" className="eyebrow">
              What that implies for exposure
            </h2>
            <div className="panel mt-3 p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                  {fmtWhole(exposure.low)} – {fmtWhole(exposure.high)}
                </p>
                <p className="text-sm text-muted">in equities, the rest in cash</p>
                <span className={`chip ${TONE_CLASS[POSTURE_TONE[board.posture]]}`}>
                  {POSTURE_META[board.posture].short}
                </span>
              </div>
              <p className="mt-3 font-mono text-[13px] text-muted">{exposure.workings}</p>
              <p className="mt-3 max-w-2xl text-[13px] text-muted">
                It is a band rather than a figure on purpose. A single percentage carried to the point would claim a
                precision that revised economic data, a sample of about seven recessions and a set of hand-chosen
                weights cannot support.
              </p>
              <p className="mt-2 max-w-2xl text-[13px] text-muted">
                The near-term reading moves this band far harder than the long-horizon one. That is the desk&rsquo;s
                most consequential choice: valuation says a great deal about what a decade pays and very little
                about what a year does, so letting an expensive market drive the allocation would have meant sitting
                in cash for most of the past thirty years.
              </p>
              {exposure.notes.map((n) => (
                <p key={n} className="mt-2 max-w-2xl text-[13px] text-dim">
                  {n}
                </p>
              ))}
            </div>
          </section>

          {/* ---- good against bad ---- */}
          <section className="mt-10" aria-labelledby="goodbad-h">
            <h2 id="goodbad-h" className="eyebrow">
              The good against the bad
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted">
              Split by what each reading says today, never by what kind of reading it is. The shares below are of
              WEIGHT rather than of count: ten sentiment gauges agreeing is not more evidence than one yield curve.
            </p>
            <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full border border-hairline">
              <div
                className="h-full bg-[color:var(--color-consensus)]"
                style={{ width: `${goodBad.goodWeightPct ?? 0}%` }}
                aria-hidden
              />
              <div
                className="h-full bg-[color:var(--color-macro)]"
                style={{ width: `${goodBad.badWeightPct ?? 0}%` }}
                aria-hidden
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              <span className="text-[color:var(--color-consensus)]">{fmtPct(goodBad.goodWeightPct)}</span> of measured
              weight reads better than its own middle;{" "}
              <span className="text-[color:var(--color-macro)]">{fmtPct(goodBad.badWeightPct)}</span> reads worse.
              {goodBad.unmeasured > 0 && (
                <>
                  {" "}
                  {goodBad.unmeasured} reading{goodBad.unmeasured === 1 ? "" : "s"} could not be measured and
                  contributed nothing rather than counting as neutral.
                </>
              )}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ReadingList title="Reading worse than its own history" rows={goodBad.bad} tone="bad" />
              <ReadingList title="Reading better than its own history" rows={goodBad.good} tone="ok" />
            </div>
          </section>

          {/* ---- conditional history ---- */}
          <section className="mt-10" aria-labelledby="base-h">
            <h2 id="base-h" className="eyebrow">
              What followed, the last times it read like this
            </h2>
            <div className="panel mt-3 p-5">
              {!baseRates || !baseRates.measured ? (
                <>
                  <p className="text-sm text-muted">
                    <span className="text-dim">NOT MEASURED.</span>{" "}
                    {baseRates?.unavailable ?? "There is not enough stored history to measure a conditional record."}
                  </p>
                  <p className="mt-2 text-[13px] text-dim">Nothing is estimated in its place.</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted">
                    The near-term reading sits in the {baseRates.band?.label} band. Between{" "}
                    {fmtMonth(baseRates.spanStart)} and {fmtMonth(baseRates.spanEnd)} that band was visited{" "}
                    <span className="text-ink">{baseRates.conditional!.episodes}</span> times, counted so that no two
                    visits share a month of outcome.
                  </p>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Tile
                      label={`Next ${baseRates.horizonMonths} months, after readings in this band`}
                      value={fmtSigned(baseRates.conditional!.episodeMeanPct, 2)}
                    />
                    <Tile
                      label="Next 12 months, after every reading"
                      value={fmtSigned(baseRates.unconditional!.meanPct, 2)}
                    />
                    <Tile label="Difference" value={fmtSigned(baseRates.differencePct, 2)} />
                  </div>
                  <p className="mt-4 text-[13px] text-muted">
                    Only the difference carries information. A conditional figure on its own would let an ordinary
                    market look like a finding.
                  </p>
                  {baseRates.bandSharePct !== null && baseRates.bandSharePct >= 40 && (
                    <p className="mt-2 text-[13px] text-dim">
                      <span className="chip gate-caution">BARELY CONDITIONAL</span> The desk has spent{" "}
                      {fmtPct(baseRates.bandSharePct)} of its measurable history in this band, so &ldquo;readings
                      like today&rsquo;s&rdquo; describes much of the record rather than a distinctive state.
                    </p>
                  )}
                  <p className="mt-2 text-[13px] text-dim">
                    {baseRates.conditional!.months} individual months qualified, but a forward reading taken in one
                    month and again the next shares almost all of its future with itself. The{" "}
                    {baseRates.conditional!.episodes} draws above are spaced a full {baseRates.horizonMonths}-month
                    window apart. That is a small sample, and it is the honest one.
                  </p>
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[22rem] text-left text-[13px]">
                      <thead className="text-dim">
                        <tr>
                          <th className="pb-2 pr-4 font-normal">Draw</th>
                          <th className="pb-2 pr-4 text-right font-normal">
                            Next {baseRates.horizonMonths} months
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {baseRates.conditional!.list.map((d) => (
                          <tr key={d.month} className="border-t border-hairline">
                            <td className="py-1.5 pr-4">{fmtMonth(d.month)}</td>
                            <td
                              className={`py-1.5 pr-4 text-right font-mono ${
                                d.changePct >= 0 ? "text-[color:var(--color-consensus)]" : "text-[color:var(--color-macro)]"
                              }`}
                            >
                              {fmtSigned(d.changePct, 1)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ---- context ---- */}
          {board.context.length > 0 && (
            <section className="mt-10" aria-labelledby="ctx-h">
              <h2 id="ctx-h" className="eyebrow">
                Reported, never scored
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted">
                These move nothing. Recession dating is announced long after a recession begins, so scoring it would
                be reading the answer off the back of the paper — it is the ruler this desk&rsquo;s history is
                measured against, not a reading.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {board.context.map((r) => (
                  <div key={r.gauge.id} className="panel p-5">
                    <p className="text-sm text-ink">{r.gauge.label}</p>
                    <p className="mt-1 font-mono text-lg">{fmtReading(r.value)}</p>
                    <p className="mt-2 text-[13px] text-muted">{meaningFor(r)}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- what this cannot tell you ---- */}
          <section className="mt-10" aria-labelledby="gaps-h">
            <h2 id="gaps-h" className="eyebrow">
              What this desk cannot tell you
            </h2>
            <div className="panel mt-3 space-y-3 p-5 text-[13px] text-muted">
              <p>
                <span className="text-ink">The sample is smaller than it looks.</span> Thirty years of monthly
                readings is 360 rows and about three recessions. However the arithmetic is dressed, the effective
                sample for anything cycle-shaped is single digits, and no quantity of daily data changes that.
              </p>
              <p>
                <span className="text-ink">About forty readings were searched against their own histories.</span>{" "}
                That is exactly the setting in which some relationships look predictive by chance, and nothing here
                is corrected for it.
              </p>
              {board.flags.map((f) => (
                <p key={f}>{f}</p>
              ))}
              {board.unavailable.length > 0 && (
                <p>
                  <span className="text-ink">{board.unavailable.length} readings are not measured:</span>{" "}
                  {board.unavailable.map((u) => `${u.label} — ${u.reason}`).join("; ")}.
                </p>
              )}
              {board.stale.length > 0 && (
                <p>
                  <span className="text-ink">{board.stale.length} sources have stopped publishing:</span>{" "}
                  {board.stale.map((u) => `${u.label} — ${u.reason}`).join("; ")}. They were excluded rather than
                  read as current.
                </p>
              )}
              <p className="text-dim">
                Not financial advice. These are measurements of conditions that already exist, not forecasts. How
                every figure here is computed is set out on{" "}
                <Link href="/methodology#tide" className="underline decoration-hairline underline-offset-2 hover:text-ink">
                  the methodology page
                </Link>
                .
              </p>
            </div>
          </section>

          {unlocked && <TideControls />}
        </>
      )}
    </main>
  );
}

/* ---------------------------------------------------------------------------
 * Pieces
 * ------------------------------------------------------------------------- */

function CompositeCard({ composite }: { composite: Composite }) {
  const meta = HORIZON_META[composite.horizon];
  const tone = stressTone(composite.stress);
  return (
    <div className="panel p-5 sm:p-6">
      <h3 className="font-display text-base font-semibold">{meta.title}</h3>
      <p className="mt-1 text-[13px] text-muted">{meta.question}</p>
      <p className={`mt-3 font-display text-4xl font-bold tracking-tight ${TONE_CLASS[tone]}`}>
        {fmtStress(composite.stress)}
        <span className="ml-1 text-base font-normal text-dim">/ 100</span>
      </p>
      <StressBar stress={composite.stress} />
      <p className="mt-2 text-[13px] text-dim">
        {composite.measuredGauges} of {composite.totalGauges} readings measured
        {composite.weightCoveragePct !== null && <> · {fmtPct(composite.weightCoveragePct)} of declared weight in use</>}
      </p>
      {composite.unavailable && <p className="mt-2 text-[13px] text-dim">{composite.unavailable}.</p>}

      <dl className="mt-4 space-y-2">
        {composite.families.map((f) => (
          <div key={f.family} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <dt className="text-[13px] text-muted">
              {FAMILY_META[f.family].title}
              <span className="ml-1.5 text-[11px] text-dim">weight {f.weight}</span>
            </dt>
            <dd className={`font-mono text-[13px] ${TONE_CLASS[stressTone(f.stress)]}`}>
              {f.stress === null ? "NOT MEASURED" : fmtStress(f.stress)}
              <span className="ml-1.5 text-[11px] text-dim">
                {f.measured}/{f.total}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[13px] text-dim">{meta.note}</p>
    </div>
  );
}

function ReadingList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { reading: Parameters<typeof meaningFor>[0] & { stress: number | null; gauge: { id: string; label: string } }; weightPct: number }[];
  tone: "bad" | "ok";
}) {
  return (
    <div className="panel p-5">
      <h3 className="font-display text-base font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-[13px] text-dim">Nothing sits on this side today.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map((w) => (
            <li key={w.reading.gauge.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <Link
                href={`/tide/${w.reading.gauge.id}`}
                className="text-[13px] text-muted underline decoration-hairline underline-offset-2 hover:text-ink"
              >
                {w.reading.gauge.label}
              </Link>
              <span className={`font-mono text-[13px] ${TONE_CLASS[tone]}`}>
                {fmtStress(w.reading.stress)}
                <span className="ml-1.5 text-[11px] text-dim">{fmtPct(w.weightPct)} wt</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[11px] uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-1 font-mono text-lg text-ink">{value}</p>
    </div>
  );
}
