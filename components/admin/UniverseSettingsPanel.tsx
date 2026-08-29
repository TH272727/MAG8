"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  previewUniverseAction,
  saveUniverseSettingsAction,
  type UniversePreviewState,
} from "@/app/actions";
import SettingsGrid, { defaultRaw, type PanelGroup, type PanelSetting } from "./SettingsGrid";

// The knob grid itself is shared with the Bottleneck desk's panel.
export type { PanelGroup, PanelSetting };

export default function UniverseSettingsPanel({
  groups,
  settings,
}: {
  groups: PanelGroup[];
  settings: PanelSetting[];
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number | boolean>>(() =>
    Object.fromEntries(settings.map((s) => [s.key, s.value])),
  );
  const [busy, setBusy] = useState<null | "save" | "reset" | "preview" | "refresh">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<UniversePreviewState | null>(null);

  const set = (key: string, v: number | boolean) => setValues((prev) => ({ ...prev, [key]: v }));

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await saveUniverseSettingsAction(values);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("Save failed — network error.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Reset every Stage-0 setting to its default/env baseline?")) return;
    setBusy("reset");
    setMsg(null);
    try {
      const res = await saveUniverseSettingsAction({});
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

  async function runPreview(force: boolean) {
    setBusy(force ? "refresh" : "preview");
    setMsg(null);
    try {
      setPreview(await previewUniverseAction(force));
    } catch {
      setPreview({ ok: false, message: "Preview failed — network error." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel p-5 sm:p-6">
      <p className="text-sm text-muted">
        Every screening threshold is live-tunable — nothing is hard-coded. Defaults are
        research-backed (the papers are cited per setting and on the methodology page). Saved
        changes apply from the next run or preview; the weekly data snapshot itself is untouched
        until its scheduled refresh.
      </p>

      <SettingsGrid groups={groups} settings={settings} values={values} onChange={set} />

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={save}>
          {busy === "save" ? "Saving…" : "Save settings"}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => runPreview(false)}>
          {busy === "preview" ? "Screening…" : "Preview the screen"}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => runPreview(true)}>
          {busy === "refresh" ? "Refetching…" : "Refresh data & preview"}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={reset}>
          {busy === "reset" ? "Resetting…" : "Reset all to defaults"}
        </button>
        <span className="text-[12px] text-dim">
          Preview uses SAVED settings against this week&apos;s snapshot; refresh re-pulls the data (first pull ~20s).
        </span>
      </div>

      {msg && (
        <div className="mt-4 rounded-md border border-hairline p-3 text-sm text-muted" role="status">
          {msg}
        </div>
      )}

      {preview && !preview.ok && (
        <div className="mt-4 rounded-md border border-danger/40 p-3 text-sm text-danger" role="alert">
          {preview.message}
        </div>
      )}

      {preview?.ok && (
        <div className="mt-4 rounded-md border border-hairline bg-panel2 p-4">
          <p className="eyebrow">Screen preview — week {preview.preview.weekKey}</p>
          <p className="mt-2 font-mono text-[12px] leading-relaxed text-muted">
            fetched {preview.preview.fetchedAt.slice(0, 16).replace("T", " ")}
            {preview.preview.stale ? " · STALE (prior week)" : ""} · exchanges{" "}
            {preview.preview.exchanges.join("+") || "n/a"}
            {preview.preview.secCoverage
              ? ` · SEC data on ${preview.preview.secCoverage.withData.toLocaleString()} of ${preview.preview.secCoverage.total.toLocaleString()} in-band names`
              : " · SEC data unavailable"}
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[320px] text-left font-mono text-[12px]">
              <tbody>
                <tr className="border-b border-hairline text-dim">
                  <td className="py-1 pr-4">US listings fetched</td>
                  <td className="tabular py-1 text-right">{preview.preview.totalListed.toLocaleString()}</td>
                </tr>
                <tr className="border-b border-hairline text-dim">
                  <td className="py-1 pr-4">common stock / ADR</td>
                  <td className="tabular py-1 text-right">{preview.preview.normalized.toLocaleString()}</td>
                </tr>
                {preview.preview.funnel.map((f) => (
                  <tr key={f.key} className="border-b border-hairline">
                    <td className="py-1 pr-4 text-muted">
                      − {f.label}
                      {f.evaluated !== undefined ? ` (${f.evaluated.toLocaleString()} evaluated)` : ""}
                    </td>
                    <td className="tabular py-1 text-right text-ink">−{f.removed.toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1 pr-4 text-ink">eligible → weekly pool</td>
                  <td className="tabular py-1 text-right text-ink">
                    {preview.preview.eligibleCount.toLocaleString()} → {preview.preview.poolSize}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-dim">Criteria: {preview.preview.criteria}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {preview.preview.sample.map((r) => (
              <span key={r.t} className="chip" title={`${r.n} · ${r.s}`}>
                {r.t} ${r.capB}B
              </span>
            ))}
            <span className="chip">…{Math.max(0, preview.preview.poolSize - preview.preview.sample.length)} more</span>
          </div>
        </div>
      )}
    </div>
  );
}
