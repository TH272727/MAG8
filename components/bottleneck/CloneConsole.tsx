"use client";

import { useState } from "react";
import {
  cloneManagerAction,
  searchManagersAction,
  sizeCloneAction,
  type CloneView,
  type DiffRow,
  type HoldingRow,
  type SizingResult,
} from "@/app/bottleneck/actions";
import { fmtDay, fmtPct, fmtUsd } from "@/lib/bottleneck/format";
import type { OrderProposal, PositionChange } from "@/lib/bottleneck/thirteenf";

/* ============================================================================
 * The clone console: search a manager, read their disclosed book, see what
 * changed since last quarter.
 *
 * The sizing panel renders only when the SERVER has already established an
 * unlocked desk. A visitor's payload never carries it, and the action re-checks
 * the token regardless — the same posture as the run resume button.
 * ========================================================================== */

const CHANGE_CHIP: Record<PositionChange, string> = {
  new: "gate-pass",
  increased: "gate-pass",
  decreased: "gate-caution",
  closed: "gate-fail",
  unchanged: "",
};

const shares = (n: number) => n.toLocaleString("en-US");

export default function CloneConsole({
  initial,
  initialError,
  unlocked,
}: {
  initial: CloneView | null;
  initialError: string | null;
  unlocked: boolean;
}) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<null | "search" | "clone">(null);
  const [matches, setMatches] = useState<{ cik: number; name: string; period: string }[] | null>(null);
  const [clone, setClone] = useState<CloneView | null>(initial);
  const [error, setError] = useState<string | null>(initialError);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy("search");
    setError(null);
    setMatches(null);
    try {
      const res = await searchManagersAction(query);
      if (res.ok) setMatches(res.matches.map((m) => ({ cik: m.cik, name: m.name, period: m.period })));
      else setError(res.message);
    } catch {
      setError("The search could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function load(cik: number) {
    setBusy("clone");
    setError(null);
    try {
      const res = await cloneManagerAction(cik);
      if (res.ok) {
        setClone(res.clone);
        setMatches(null);
        // A shareable URL for the book on screen, without a navigation.
        window.history.replaceState(null, "", `/bottleneck/clone?cik=${cik}`);
      } else {
        setError(res.message);
      }
    } catch {
      setError("The filing could not be read.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <form onSubmit={search} className="mt-6 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Manager name, or a CIK"
          aria-label="Manager name or CIK"
          className="min-w-0 flex-1 rounded-md border border-hairline bg-void px-3 py-2 text-sm text-ink placeholder:text-dim focus:border-macro/60 focus:outline-none sm:flex-none sm:w-80"
        />
        <button type="submit" className="btn" disabled={busy !== null || query.trim().length < 3}>
          {busy === "search" ? "Searching…" : "Find filer"}
        </button>
        {/^\d{1,10}$/.test(query.trim()) && (
          <button type="button" className="btn" disabled={busy !== null} onClick={() => load(Number(query.trim()))}>
            {busy === "clone" ? "Reading…" : `Read CIK ${query.trim()}`}
          </button>
        )}
      </form>

      {error && (
        <div className="panel mt-4 border-danger/40 p-4 text-sm text-muted" role="status">
          {error}
        </div>
      )}

      {matches && (
        <div className="panel mt-4 p-4">
          <p className="eyebrow">{matches.length} filer{matches.length === 1 ? "" : "s"} on record</p>
          <ul className="mt-2 space-y-1.5">
            {matches.map((m) => (
              <li key={m.cik} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <button
                  type="button"
                  className="text-left text-ink underline decoration-hairline underline-offset-2 hover:decoration-ink"
                  disabled={busy !== null}
                  onClick={() => load(m.cik)}
                >
                  {m.name}
                </button>
                <span className="font-mono text-[12px] text-dim">
                  CIK {m.cik}
                  {m.period ? ` · latest period ${m.period}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {clone && <Book clone={clone} unlocked={unlocked} />}
    </>
  );
}

/* ---- One filer's disclosed book ---- */

function Book({ clone, unlocked }: { clone: CloneView; unlocked: boolean }) {
  const book = clone.totals.longUsd + clone.totals.optionsUsd;
  return (
    <>
      <section className="mt-8" aria-labelledby="book-h">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="book-h" className="font-display text-xl font-semibold">
            {clone.filerName}
          </h2>
          <span className="chip">{clone.form}</span>
          <span className="chip gate-caution">
            AS OF {clone.period} · FILED {clone.filedAt} · {clone.lagDays} DAYS LATER
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
          Positions as filed for the quarter ending {fmtDay(clone.period)}. The rule allows up to{" "}
          {clone.lagAllowanceDays} days between that date and the filing, so this is a picture of the past — never a
          live book.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-4">
          <Stat label="LONG STOCK" value={fmtUsd(clone.totals.longUsd)} note={`${clone.totals.longPositions} positions`} />
          <Stat
            label="OPTIONS OVERLAY"
            value={fmtUsd(clone.totals.optionsUsd)}
            note={
              clone.totals.optionPositions === 0
                ? "none reported"
                : `${clone.totals.optionPositions} · ${((clone.totals.optionsUsd / book) * 100).toFixed(2)}% of the book`
            }
          />
          <Stat label="DISCLOSED BOOK" value={fmtUsd(book)} note={`${clone.totals.positions} rows`} />
          <Stat
            label="IDENTIFIED"
            value={`${clone.totals.positions - clone.totals.unresolved} / ${clone.totals.positions}`}
            note={clone.totals.unresolved === 0 ? "every row matched" : `${clone.totals.unresolved} by name and CUSIP only`}
          />
        </div>
      </section>

      <HoldingsTable
        title="Long stock"
        blurb="Every disclosed long position, weighted against the long book alone."
        rows={clone.long}
        omitted={clone.omitted.long}
      />

      {clone.options.length > 0 && (
        <HoldingsTable
          title="Options overlay"
          blurb="Puts and calls reported in the same filing. Shown separately — cloning only the stock would understate how this manager is positioned."
          rows={clone.options}
          omitted={clone.omitted.options}
          options
        />
      )}

      {clone.diff.length > 0 && <Changes rows={clone.diff} priorPeriod={clone.priorPeriod} omitted={clone.omitted.diff} />}

      {unlocked && (
        <SizingPanel cik={clone.cik} filerName={clone.filerName} lagAllowanceDays={clone.lagAllowanceDays} />
      )}

      <section className="mt-10" aria-labelledby="clone-gaps-h">
        <h2 id="clone-gaps-h" className="eyebrow">
          What this clone cannot tell you
        </h2>
        <ul className="mt-3 max-w-3xl space-y-2">
          {clone.flags.map((f, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-muted">
              — {f}
            </li>
          ))}
        </ul>
        <p className="mt-4 font-mono text-[11px] text-dim">
          <a
            href={clone.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-ink"
          >
            read the filing itself →
          </a>
          {clone.periods.length > 1 && (
            <span className="ml-3">
              {clone.periods.length} periods on file · earliest {clone.periods[clone.periods.length - 1].period}
            </span>
          )}
        </p>
      </section>
    </>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="bg-panel2 px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.14em] text-dim">{label}</div>
      <div className="tabular mt-0.5 font-mono text-lg text-ink">{value}</div>
      <div className="mt-0.5 text-[12px] text-dim">{note}</div>
    </div>
  );
}

/** How a ticker was established — shown only when weaker than a US identifier match. */
function Provenance({ row }: { row: { ticker: string | null; cusip: string; resolvedBy?: string; usListed: boolean } }) {
  if (row.ticker === null) return <span className="text-[11px] text-dim"> unresolved · {row.cusip}</span>;
  if (!row.usListed) return <span className="text-[11px] text-dim"> no US listing found</span>;
  if (row.resolvedBy === "universe-name") return <span className="text-[11px] text-dim"> matched by name</span>;
  return null;
}

function HoldingsTable({
  title,
  blurb,
  rows,
  omitted,
  options = false,
}: {
  title: string;
  blurb: string;
  rows: HoldingRow[];
  omitted: number;
  options?: boolean;
}) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="eyebrow">{title}</h2>
      <p className="mt-1 max-w-2xl text-[13px] text-muted">{blurb}</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
              <th className="py-2 pr-4 font-normal">POSITION</th>
              {options && <th className="py-2 pr-4 font-normal">TYPE</th>}
              {!options && <th className="py-2 pr-4 text-right font-normal">% OF BOOK</th>}
              <th className="py-2 pr-4 text-right font-normal">VALUE</th>
              <th className="py-2 text-right font-normal">SHARES</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={`${h.cusip}-${h.putCall ?? "long"}-${h.shares}`} className="border-b border-hairline align-top">
                <td className="py-2.5 pr-4">
                  <span className="font-mono font-bold text-ink">{h.ticker ?? "—"}</span>
                  <span className="ml-2 text-[13px] text-muted">{h.name}</span>
                  <Provenance row={h} />
                </td>
                {options && (
                  <td className="py-2.5 pr-4 font-mono text-[13px] text-macro">{h.putCall?.toUpperCase()}</td>
                )}
                {!options && (
                  <td className="tabular py-2.5 pr-4 text-right font-mono text-ink">
                    {h.pctOfLong === null ? "—" : `${h.pctOfLong.toFixed(2)}%`}
                  </td>
                )}
                <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">{fmtUsd(h.valueUsd)}</td>
                <td className="tabular py-2.5 text-right font-mono text-muted">{shares(h.shares)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {omitted > 0 && (
        <p className="mt-2 text-[12px] text-dim">
          {omitted} smaller position{omitted === 1 ? "" : "s"} not shown. The totals above count all of them.
        </p>
      )}
    </section>
  );
}

function Changes({ rows, priorPeriod, omitted }: { rows: DiffRow[]; priorPeriod: string | null; omitted: number }) {
  return (
    <section className="mt-10" aria-label="Position changes">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="eyebrow">What changed</h2>
        {priorPeriod && <span className="chip">VS {priorPeriod}</span>}
      </div>
      <p className="mt-1 max-w-2xl text-[13px] text-muted">
        Classified by share count, not by value: a position worth more because the price rose has not been traded, and
        calling that an increase would invent activity that never happened.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
              <th className="py-2 pr-4 font-normal">CHANGE</th>
              <th className="py-2 pr-4 font-normal">POSITION</th>
              <th className="py-2 pr-4 text-right font-normal">SHARES NOW</th>
              <th className="py-2 pr-4 text-right font-normal">BEFORE</th>
              <th className="py-2 pr-4 text-right font-normal">DELTA</th>
              <th className="py-2 text-right font-normal">% OF BOOK</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.cusip} className="border-b border-hairline align-top">
                <td className="py-2.5 pr-4">
                  <span className={`chip ${CHANGE_CHIP[d.change]}`}>{d.change.toUpperCase()}</span>
                </td>
                <td className="py-2.5 pr-4">
                  <span className="font-mono font-bold text-ink">{d.ticker ?? "—"}</span>
                  <span className="ml-2 text-[13px] text-muted">{d.name}</span>
                  <Provenance row={d} />
                </td>
                <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">{shares(d.sharesNow)}</td>
                <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">{shares(d.sharesBefore)}</td>
                <td className="tabular py-2.5 pr-4 text-right font-mono text-ink">{fmtPct(d.sharesDeltaPct)}</td>
                <td className="tabular py-2.5 text-right font-mono text-muted">
                  {d.pctOfLongNow === null ? "—" : `${d.pctOfLongNow.toFixed(2)}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {omitted > 0 && <p className="mt-2 text-[12px] text-dim">{omitted} further changes not shown.</p>}
    </section>
  );
}

/* ---- Sizing: admin only, and a proposal only ---- */

function SizingPanel({
  cik,
  filerName,
  lagAllowanceDays,
}: {
  cik: number;
  filerName: string;
  lagAllowanceDays: number;
}) {
  const [balance, setBalance] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SizingResult | null>(null);

  async function size() {
    const amount = Number(balance.replace(/[^0-9.]/g, ""));
    setBusy(true);
    try {
      setResult(await sizeCloneAction(cik, amount));
    } catch {
      setResult({ ok: false, message: "The sizing could not be computed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mt-10 p-5 sm:p-6" aria-label="Position sizing">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="eyebrow">Size this book to an account</h2>
        <span className="chip">DESK ONLY</span>
      </div>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
        Applies {filerName}&apos;s disclosed weights to a balance you name. It is a list to review and nothing more —
        the positions are up to {lagAllowanceDays} days old by rule, and nothing on this page is connected to a broker
        or can place an order.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={balance}
          onChange={(e) => setBalance(e.target.value)}
          inputMode="decimal"
          placeholder="Account balance, USD"
          aria-label="Account balance in US dollars"
          className="min-w-0 flex-1 rounded-md border border-hairline bg-void px-3 py-2 text-sm text-ink placeholder:text-dim focus:border-macro/60 focus:outline-none sm:w-56 sm:flex-none"
        />
        <button type="button" className="btn" disabled={busy || balance.trim() === ""} onClick={size}>
          {busy ? "Sizing…" : "Compute proposal"}
        </button>
      </div>

      {result && !result.ok && (
        <p className="mt-3 text-sm text-muted" role="status">
          {result.message}
        </p>
      )}

      {result?.ok && <Proposal orders={result.orders} unpriced={result.unpriced} />}
    </section>
  );
}

function Proposal({ orders, unpriced }: { orders: OrderProposal[]; unpriced: number }) {
  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
              <th className="py-2 pr-4 font-normal">POSITION</th>
              <th className="py-2 pr-4 text-right font-normal">% OF BOOK</th>
              <th className="py-2 pr-4 text-right font-normal">AMOUNT</th>
              <th className="py-2 pr-4 text-right font-normal">PRICE</th>
              <th className="py-2 text-right font-normal">SHARES</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.cusip} className="border-b border-hairline align-top">
                <td className="py-2.5 pr-4">
                  <span className="font-mono font-bold text-ink">{o.ticker ?? "—"}</span>
                  <span className="ml-2 text-[13px] text-muted">{o.nameOfIssuer}</span>
                  {!o.usListed && <span className="text-[11px] text-dim"> no US listing</span>}
                </td>
                <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">{o.pctOfLong.toFixed(2)}%</td>
                <td className="tabular py-2.5 pr-4 text-right font-mono text-ink">{fmtUsd(o.suggestedUsd)}</td>
                <td className="tabular py-2.5 pr-4 text-right font-mono text-muted">
                  {o.price === null ? "—" : `$${o.price.toFixed(2)}`}
                </td>
                <td className="tabular py-2.5 text-right font-mono text-muted">
                  {o.suggestedShares === null ? "—" : shares(o.suggestedShares)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-dim">
        {unpriced > 0 &&
          `${unpriced} row(s) have a dollar amount but no share count — no live price was available, or the row has no US listing. `}
        A proposal for review. Prices move; the filing is already weeks old; this desk cannot place an order.
      </p>
    </>
  );
}
