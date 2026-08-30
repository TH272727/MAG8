"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addSupplyPointAction,
  deleteSupplyPointAction,
  refreshDeskAction,
  supplySeriesAction,
  type SeriesState,
} from "@/app/bottleneck/actions";

/* ============================================================================
 * Operating the desk. Rendered only where the SERVER has already established an
 * unlocked desk; every action behind it re-checks the token regardless.
 *
 * Two jobs, both of which the desk claims on its public page and could not
 * otherwise do:
 *
 *   Refresh        there is no scheduler in this codebase and inventing one was
 *                  ruled out, so a reading is refreshed by a person or by the
 *                  headless script — exactly like the weekly universe screen.
 *   Hand entry     several named supply sources have no automated feed, and the
 *                  page says dated observations can be entered by hand. This is
 *                  where that happens; without it the sentence would be false.
 * ========================================================================== */

export default function DeskControls({
  playbookId,
  playbookLabel,
}: {
  playbookId: string;
  playbookLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "refresh" | "reuse" | "series" | "add" | "del">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [series, setSeries] = useState<SeriesState[] | null>(null);
  const [seriesId, setSeriesId] = useState("");
  const [date, setDate] = useState("");
  const [value, setValue] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const selected = series?.find((s) => s.seriesId === seriesId) ?? null;

  async function refresh(reuseDemand: boolean) {
    setBusy(reuseDemand ? "reuse" : "refresh");
    setMsg(null);
    try {
      const res = await refreshDeskAction(playbookId, { reuseDemand });
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The refresh could not be started.");
    } finally {
      setBusy(null);
    }
  }

  async function loadSeries() {
    setBusy("series");
    setMsg(null);
    try {
      const rows = await supplySeriesAction(playbookId);
      setSeries(rows);
      if (rows.length > 0 && !rows.some((r) => r.seriesId === seriesId)) setSeriesId(rows[0].seriesId);
    } catch {
      setMsg("Could not read the supply series.");
    } finally {
      setBusy(null);
    }
  }

  async function addPoint() {
    setBusy("add");
    setMsg(null);
    try {
      const res = await addSupplyPointAction(playbookId, seriesId, date.trim(), Number(value), sourceUrl);
      setMsg(res.message);
      if (res.ok) {
        setDate("");
        setValue("");
        await loadSeries();
        router.refresh();
      }
    } catch {
      setMsg("Could not record that observation.");
    } finally {
      setBusy(null);
    }
  }

  async function removePoint(id: string, d: string) {
    setBusy("del");
    setMsg(null);
    try {
      const res = await deleteSupplyPointAction(id, d);
      setMsg(res.message);
      if (res.ok) {
        await loadSeries();
        router.refresh();
      }
    } catch {
      setMsg("Could not remove that observation.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="panel mt-10 p-5 sm:p-6" aria-label="Operate the desk">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="eyebrow">Operate the desk</h2>
        <span className="chip">DESK ONLY</span>
        <span className="chip">$0 · NO RESEARCH CAPACITY</span>
      </div>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">
        A reading of <span className="text-ink">{playbookLabel}</span> is a stored snapshot, recomputed on every
        read. Nothing here schedules itself — refreshing is filings data and arithmetic, so it costs nothing and
        can be run as often as it is useful.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => refresh(false)}>
          {busy === "refresh" ? "Reading filings…" : "Refresh this theme"}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => refresh(true)}>
          {busy === "reuse" ? "Refreshing…" : "Supply only"}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={loadSeries}>
          {busy === "series" ? "Loading…" : series ? "Reload series" : "Enter an observation by hand"}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-dim">
        A full refresh re-reads every company&apos;s filings and takes roughly ten to twenty seconds.{" "}
        <span className="text-muted">Supply only</span> keeps the stored spending reading and re-pulls the supply
        series alone.
      </p>

      {msg && (
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted" role="status">
          {msg}
        </p>
      )}

      {series && (
        <div className="mt-5 border-t border-hairline pt-5">
          <h3 className="font-mono text-[10px] tracking-[0.14em] text-dim">SUPPLY SERIES</h3>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-muted">
            A source the desk names but cannot yet fetch is still a real constraint. Recording dated observations
            by hand is how one of those becomes measurable — the points join the same store as every automated
            one, and carry their origin wherever they appear.
          </p>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline font-mono text-[11px] tracking-[0.1em] text-dim">
                  <th className="py-2 pr-4 font-normal">SERIES</th>
                  <th className="py-2 pr-4 text-right font-normal">STORED</th>
                  <th className="py-2 pr-4 font-normal">LATEST</th>
                  <th className="py-2 font-normal">FEED</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.seriesId} className="border-b border-hairline align-top">
                    <td className="py-2 pr-4">
                      <span className="font-mono text-[12px] text-ink">{s.seriesId}</span>
                      <span className="ml-2 text-[12px] text-muted">{s.label}</span>
                    </td>
                    <td className="tabular py-2 pr-4 text-right font-mono text-[12px] text-muted">{s.points}</td>
                    <td className="py-2 pr-4 font-mono text-[12px] text-dim">{s.latest ?? "—"}</td>
                    <td className="py-2 text-[12px] text-dim">
                      {s.stub ? <span className="text-macro">no automated feed</span> : s.connector}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.14em] text-dim">SERIES</span>
              <select
                value={seriesId}
                onChange={(e) => setSeriesId(e.target.value)}
                className="rounded-md border border-hairline bg-void px-2 py-1.5 font-mono text-[13px] text-ink focus:border-macro/60 focus:outline-none"
              >
                {series.map((s) => (
                  <option key={s.seriesId} value={s.seriesId}>
                    {s.seriesId}
                    {s.stub ? " · stub" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.14em] text-dim">DATE</span>
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-36 rounded-md border border-hairline bg-void px-2 py-1.5 font-mono text-[13px] text-ink placeholder:text-dim focus:border-macro/60 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.14em] text-dim">
                VALUE{selected ? ` · ${selected.unit}` : ""}
              </span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="w-32 rounded-md border border-hairline bg-void px-2 py-1.5 font-mono text-[13px] text-ink placeholder:text-dim focus:border-macro/60 focus:outline-none"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-mono text-[10px] tracking-[0.14em] text-dim">SOURCE URL (OPTIONAL)</span>
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={selected?.sourceUrl ?? "where this number came from"}
                className="min-w-0 rounded-md border border-hairline bg-void px-2 py-1.5 font-mono text-[12px] text-ink placeholder:text-dim focus:border-macro/60 focus:outline-none"
              />
            </label>
            <button
              type="button"
              className="btn"
              disabled={busy !== null || !seriesId || date.trim() === "" || value.trim() === ""}
              onClick={addPoint}
            >
              {busy === "add" ? "Recording…" : "Record"}
            </button>
          </div>

          {selected && selected.manual.length > 0 && (
            <div className="mt-4">
              <p className="font-mono text-[10px] tracking-[0.14em] text-dim">
                ENTERED BY HAND — {selected.seriesId}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {selected.manual.map((p) => (
                  <li key={p.date}>
                    <button
                      type="button"
                      className="chip hover:border-danger/50 hover:text-danger"
                      disabled={busy !== null}
                      title="Remove this observation"
                      onClick={() => removePoint(selected.seriesId, p.date)}
                    >
                      {p.date} · {p.value} ×
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12px] text-dim">
                Only hand-entered points are listed here, and removing one is for correcting a mistake — fetched
                observations are replaced by their source on the next refresh, never deleted from this panel.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
