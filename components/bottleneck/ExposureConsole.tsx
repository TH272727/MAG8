"use client";

import { useState } from "react";
import {
  clearHoldingsAction,
  exposureAction,
  saveHoldingsAction,
  type ExposureState,
} from "@/app/bottleneck/actions";
import { fmtPct, fmtUsd } from "@/lib/bottleneck/format";
import type { CategoryExposure, ExposureReport, OverlapRow } from "@/lib/bottleneck/exposure";

/* ============================================================================
 * Module D — the exposure audit.
 *
 * Everything here is behind the desk token, because the input is the owner's
 * own portfolio. The output reports and flags; it never proposes a trade.
 * ========================================================================== */

const STATUS_CHIP: Record<CategoryExposure["status"], { label: string; chip: string }> = {
  tightening: { label: "TIGHTENING", chip: "gate-caution" },
  easing: { label: "EASING", chip: "gate-pass" },
  balanced: { label: "BALANCED", chip: "" },
  "insufficient-data": { label: "NOT MEASURED", chip: "" },
};

const PLACEHOLDER = `Symbol,Shares,Cost Basis
MU,120,4800
VST,300,21000
AAPL,50,9100`;

export default function ExposureConsole({ initial }: { initial: ExposureState }) {
  const [state, setState] = useState<ExposureState>(initial);
  const [text, setText] = useState("");
  const [compareCik, setCompareCik] = useState("");
  const [busy, setBusy] = useState<null | "save" | "clear" | "compare">(null);

  const cikOrUndefined = () => {
    const n = Number(compareCik.replace(/\D/g, ""));
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };

  async function run(kind: "save" | "clear" | "compare") {
    setBusy(kind);
    try {
      if (kind === "save") setState(await saveHoldingsAction(text, cikOrUndefined()));
      else if (kind === "clear") {
        setState(await clearHoldingsAction());
        setText("");
      } else setState(await exposureAction(cikOrUndefined()));
    } catch {
      setState({ ...state, message: "That could not be completed." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <section className="panel mt-6 p-5 sm:p-6" aria-label="Holdings">
        <h2 className="eyebrow">Your positions</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
          Paste a ticker and share count per line, with or without a header row. A cost basis is optional and nothing
          here needs it. Stored in one place on this server, never sent anywhere, and never connected to a brokerage.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          aria-label="Holdings, one per line"
          className="mt-3 w-full rounded-md border border-hairline bg-void px-3 py-2 font-mono text-[13px] text-ink placeholder:text-dim focus:border-macro/60 focus:outline-none"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary" disabled={busy !== null || text.trim() === ""} onClick={() => run("save")}>
            {busy === "save" ? "Reading…" : "Store and audit"}
          </button>
          <button type="button" className="btn" disabled={busy !== null} onClick={() => run("compare")}>
            {busy === "compare" ? "Auditing…" : "Re-audit stored positions"}
          </button>
          <button type="button" className="btn" disabled={busy !== null || state.holdings.length === 0} onClick={() => run("clear")}>
            {busy === "clear" ? "Clearing…" : "Forget them"}
          </button>
          <input
            value={compareCik}
            onChange={(e) => setCompareCik(e.target.value)}
            placeholder="Compare against CIK"
            aria-label="Compare against a filer's CIK"
            className="min-w-0 flex-1 rounded-md border border-hairline bg-void px-3 py-1.5 text-[13px] text-ink placeholder:text-dim focus:border-macro/60 focus:outline-none sm:w-48 sm:flex-none"
          />
        </div>

        {state.message && (
          <p className="mt-3 text-sm text-muted" role="status">
            {state.message}
          </p>
        )}

        {state.holdings.length > 0 && (
          <p className="mt-2 font-mono text-[12px] text-dim">
            stored: {state.holdings.map((h) => `${h.ticker} ${h.shares.toLocaleString("en-US")}`).join(" · ")}
          </p>
        )}

        {state.rejected.length > 0 && (
          <div className="mt-3 rounded-md border border-caution/40 p-3">
            <p className="font-mono text-[11px] tracking-[0.14em] text-macro">
              {state.rejected.length} LINE{state.rejected.length === 1 ? "" : "S"} NOT READ
            </p>
            <ul className="mt-1.5 space-y-1">
              {state.rejected.slice(0, 20).map((r, i) => (
                <li key={i} className="font-mono text-[12px] text-muted">
                  {r.line} <span className="text-dim">— {r.reason}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-dim">
              They are named rather than skipped: a portfolio quietly missing a position produces confidently wrong
              percentages.
            </p>
          </div>
        )}
      </section>

      {state.report && state.report.positions > 0 && <Report report={state.report} comparedTo={state.comparedTo} />}
    </>
  );
}

function Report({
  report,
  comparedTo,
}: {
  report: ExposureReport;
  comparedTo: ExposureState["comparedTo"];
}) {
  return (
    <>
      <section className="mt-10" aria-labelledby="exp-h">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="exp-h" className="eyebrow">
            Exposure by constrained input — {report.playbookLabel}
          </h2>
          <span className="chip">{fmtUsd(report.portfolioValueUsd)} PRICED</span>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] text-muted">
          Ordered the way the desk ranks the constraints themselves, tightest first — so the two pages cannot tell
          different stories about which input matters most.
        </p>

        <div className="mt-4 space-y-3">
          {report.categories.map((c) => {
            const s = STATUS_CHIP[c.status];
            return (
              <div key={c.key} className="panel p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`chip ${s.chip}`}>{s.label}</span>
                    <h3 className="font-display text-base font-semibold">{c.unit}</h3>
                    <span className="text-[12px] text-dim">{c.ownerLabel}</span>
                  </div>
                  <div className="tabular font-mono text-xl font-bold text-ink">
                    {c.pctOfPortfolio.toFixed(1)}
                    <span className="text-sm font-normal text-dim">% of portfolio</span>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {c.held.map((h) => (
                    <span key={h.ticker} className="chip">
                      {h.ticker} · {fmtUsd(h.valueUsd)}
                    </span>
                  ))}
                  {c.held.length === 0 && <span className="text-[12px] text-dim">nothing held here</span>}
                </div>

                {c.notHeld.length > 0 && (
                  <p className="mt-2 text-[12px] text-dim">
                    also produced by: {c.notHeld.join(", ")}
                    {c.gapPct !== null && <span> · desk gap {fmtPct(c.gapPct)}</span>}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-3 text-[13px] text-muted">
          {report.unmappedPct.toFixed(1)}% of the priced portfolio ({fmtUsd(report.unmappedUsd)}) sits in names the
          desk does not track as producers of any constrained input. That is not a criticism of those positions — the
          desk only knows about the inputs in this playbook.
        </p>
      </section>

      {report.comparison && <Comparison comparison={report.comparison} comparedTo={comparedTo} />}

      <section className="mt-10" aria-labelledby="exp-gaps-h">
        <h2 id="exp-gaps-h" className="eyebrow">
          What this audit cannot tell you
        </h2>
        <ul className="mt-3 max-w-3xl space-y-2">
          {report.flags.map((f, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-muted">
              — {f}
            </li>
          ))}
          <li className="text-[13px] leading-relaxed text-muted">
            — This is an exposure report and nothing else. It proposes no trade, rebalances nothing, and is not
            investment advice.
          </li>
        </ul>
      </section>
    </>
  );
}

function Comparison({
  comparison,
  comparedTo,
}: {
  comparison: NonNullable<ExposureReport["comparison"]>;
  comparedTo: ExposureState["comparedTo"];
}) {
  return (
    <section className="mt-10" aria-labelledby="cmp-h">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="cmp-h" className="eyebrow">
          Against {comparison.filerName}
        </h2>
        <span className="chip">AS OF {comparison.period}</span>
        {comparedTo && <span className="chip">CIK {comparedTo.cik}</span>}
      </div>
      <p className="mt-1 max-w-2xl text-[13px] text-muted">
        Their weights are of their disclosed long book; yours are of your priced portfolio. Two different denominators,
        so read the columns as directions rather than as a like-for-like difference.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <OverlapList title="Both hold" rows={comparison.both} showBoth />
        <OverlapList title="They hold, you don't" rows={comparison.theirsOnly} />
        <OverlapList title="You hold, they don't" rows={comparison.minesOnly} />
      </div>
    </section>
  );
}

function OverlapList({ title, rows, showBoth = false }: { title: string; rows: OverlapRow[]; showBoth?: boolean }) {
  return (
    <div className="panel p-4">
      <p className="font-mono text-[10px] tracking-[0.14em] text-dim">{title.toUpperCase()}</p>
      <ul className="mt-2 space-y-1">
        {rows.slice(0, 40).map((r) => (
          <li key={r.ticker} className="flex items-baseline justify-between gap-2 font-mono text-[13px]">
            <span className="font-bold text-ink">{r.ticker}</span>
            <span className="tabular text-muted">
              {showBoth ? (
                <>
                  {r.minePct === null ? "—" : `${r.minePct.toFixed(1)}%`}
                  <span className="text-dim"> vs </span>
                  {r.theirsPct === null ? "—" : `${r.theirsPct.toFixed(1)}%`}
                </>
              ) : (
                <>{(r.theirsPct ?? r.minePct)?.toFixed(1) ?? "—"}%</>
              )}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-[12px] text-dim">none</li>}
        {rows.length > 40 && <li className="text-[12px] text-dim">+{rows.length - 40} more</li>}
      </ul>
    </div>
  );
}
