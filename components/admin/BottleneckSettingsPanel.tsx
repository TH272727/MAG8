"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  inspectPlaybookAction,
  saveBottleneckSettingsAction,
  type PlaybookSummary,
} from "@/app/bottleneck/actions";
import SettingsGrid, { defaultRaw, type PanelGroup, type PanelSetting } from "./SettingsGrid";

const usd = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`
      : `$${n}`;

export default function BottleneckSettingsPanel({
  groups,
  settings,
  playbooks,
}: {
  groups: PanelGroup[];
  settings: PanelSetting[];
  playbooks: { id: string; label: string; builtIn: boolean }[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number | boolean>>(() =>
    Object.fromEntries(settings.map((s) => [s.key, s.value])),
  );
  const [busy, setBusy] = useState<null | "save" | "reset" | "inspect">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [playbookId, setPlaybookId] = useState(playbooks[0]?.id ?? "");
  const [inspected, setInspected] = useState<PlaybookSummary | null>(null);

  const set = (key: string, v: number | boolean) => setValues((prev) => ({ ...prev, [key]: v }));

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await saveBottleneckSettingsAction(values);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("Save failed — network error.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Reset every Bottleneck setting to its default/env baseline?")) return;
    setBusy("reset");
    setMsg(null);
    try {
      const res = await saveBottleneckSettingsAction({});
      setMsg(res.ok ? "All overrides cleared." : res.message);
      if (res.ok) {
        setValues(Object.fromEntries(settings.map((s) => [s.key, defaultRaw(s)])));
        router.refresh();
      }
    } catch {
      setMsg("Reset failed — network error.");
    } finally {
      setBusy(null);
    }
  }

  async function inspect() {
    setBusy("inspect");
    setMsg(null);
    try {
      const res = await inspectPlaybookAction(playbookId);
      if (res.ok) setInspected(res.playbook);
      else setMsg(res.message);
    } catch {
      setMsg("Inspect failed — network error.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel p-5 sm:p-6">
      <p className="text-sm text-muted">
        The desk is deterministic and costs nothing to run — filings data and arithmetic, no research
        capacity consumed. These dials govern how it reads and reports; what it looks at for a given
        theme lives in that theme&apos;s playbook below.
      </p>

      <SettingsGrid groups={groups} settings={settings} values={values} onChange={set} accent="macro" />

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={save}>
          {busy === "save" ? "Saving…" : "Save settings"}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={reset}>
          {busy === "reset" ? "Resetting…" : "Reset all to defaults"}
        </button>
      </div>

      {msg && (
        <div className="mt-4 rounded-md border border-hairline p-3 text-sm text-muted" role="status">
          {msg}
        </div>
      )}

      {/* ---- Playbooks ---- */}
      <section className="mt-8 border-t border-hairline pt-5" aria-label="Playbooks">
        <h3 className="eyebrow">Playbooks</h3>
        <p className="mt-1 text-[13px] text-dim">
          A playbook is the only sector-specific input the desk takes: whose spending to read, how those
          dollars become physical units, which supply series constrain them, and who produces each one.
          Built-in playbooks ship with the code; owner-defined ones are stored and merged over them.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={playbookId}
            onChange={(e) => setPlaybookId(e.target.value)}
            className="rounded-md border border-hairline bg-void px-2 py-1.5 font-mono text-[13px] text-ink focus:border-macro/60 focus:outline-none"
          >
            {playbooks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} {p.builtIn ? "(built-in)" : "(custom)"}
              </option>
            ))}
          </select>
          <button type="button" className="btn" disabled={busy !== null || !playbookId} onClick={inspect}>
            {busy === "inspect" ? "Reading…" : "Inspect playbook"}
          </button>
        </div>

        {inspected && (
          <div className="mt-4 rounded-md border border-hairline bg-panel2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="eyebrow">{inspected.label}</p>
              <span className="chip">{inspected.builtIn ? "BUILT-IN" : "CUSTOM"}</span>
              <span className="chip">
                CONVERSIONS v{inspected.conversionVersion} · {inspected.conversionAsOf}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">{inspected.blurb}</p>

            {inspected.placeholderFactors && (
              <p className="mt-3 rounded-md border border-caution/40 p-2.5 text-[12px] leading-relaxed text-caution">
                Every conversion factor in this playbook is still a seeded placeholder. They are
                order-of-magnitude anchors, not researched benchmarks — replace them with sourced figures
                before treating any physical-unit total as meaningful.
              </p>
            )}

            <p className="mt-3 font-mono text-[11px] text-dim">
              demand basket ({inspected.basket.length}): {inspected.basket.join(" · ")} · {inspected.capexTags}{" "}
              capital-spending tags tried in order
            </p>

            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left font-mono text-[12px]">
                <thead>
                  <tr className="border-b border-hairline text-dim">
                    <th className="py-1 pr-3 font-normal">unit</th>
                    <th className="py-1 pr-3 text-right font-normal">$ per unit</th>
                    <th className="py-1 font-normal">source · as of</th>
                  </tr>
                </thead>
                <tbody>
                  {inspected.factors.map((f) => (
                    <tr key={f.key} className="border-b border-hairline align-top">
                      <td className="py-1 pr-3 text-ink">{f.unit}</td>
                      <td className="tabular py-1 pr-3 text-right text-ink">{usd(f.usdPer)}</td>
                      <td className="py-1 text-muted">
                        {f.source} · {f.asOf}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 font-mono text-[11px] text-dim">supply series</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {inspected.supply.map((s) => (
                <span key={s.seriesId} className="chip" title={`${s.label} (${s.unit})`}>
                  {s.seriesId} · {s.connector}
                  {s.stub ? " · STUB" : ""}
                </span>
              ))}
              {inspected.supply.length === 0 && <span className="text-[12px] text-dim">none defined</span>}
            </div>

            <p className="mt-3 font-mono text-[11px] text-dim">who owns each constrained input</p>
            <div className="mt-1 space-y-1.5">
              {inspected.owners.map((o) => (
                <p key={o.category} className="text-[12px] text-muted">
                  <span className="text-ink">{o.label}</span> — {o.tickers.join(", ") || "no US listings"}
                  {o.foreign.length > 0 && (
                    <span className="text-dim"> · not plainly US-listed: {o.foreign.join(", ")}</span>
                  )}
                </p>
              ))}
              {inspected.owners.length === 0 && <span className="text-[12px] text-dim">none defined</span>}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
