"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshInsiderAction, saveInsiderSettingsAction } from "@/app/insider/actions";
import SettingsGrid, { defaultRaw, type PanelGroup, type PanelSetting } from "./SettingsGrid";

/* ============================================================================
 * The Insider Turnaround Scanner's dials.
 *
 * These differ in kind from the other three panels. Most of them are not
 * measurement choices — they are a statement of how much risk somebody is
 * willing to carry, and there is no correct setting. What is saved here is
 * therefore the HOUSE answer: the one a visitor sees before choosing their own,
 * and the one published on the methodology page.
 *
 * Nothing derived is stored, so a save re-derives the whole candidate list —
 * including the reason each rejected company failed — on the next read, with no
 * refetch. The refresh button is only for pulling newer filings.
 * ========================================================================== */

export default function InsiderSettingsPanel({
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
  const [busy, setBusy] = useState<null | "save" | "reset" | "refresh">(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await saveInsiderSettingsAction(values);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The settings could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Reset every insider dial to its default?")) return;
    setBusy("reset");
    setMsg(null);
    try {
      const res = await saveInsiderSettingsAction({});
      setMsg(res.message);
      if (res.ok) {
        setValues(Object.fromEntries(settings.map((s) => [s.key, defaultRaw(s)])));
        router.refresh();
      }
    } catch {
      setMsg("The settings could not be reset.");
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    setBusy("refresh");
    setMsg(null);
    try {
      const res = await refreshInsiderAction(7);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The refresh could not be started.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <SettingsGrid
        groups={groups}
        settings={settings}
        values={values}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
        accent="discovery"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save dials"}
        </button>
        <button type="button" className="btn" onClick={refresh} disabled={busy !== null}>
          {busy === "refresh" ? "Reading filings…" : "Refresh last 7 days"}
        </button>
        <button
          type="button"
          className="btn hover:border-danger/50 hover:text-danger"
          onClick={reset}
          disabled={busy !== null}
        >
          {busy === "reset" ? "Resetting…" : "Reset to defaults"}
        </button>
      </div>

      <p className="mt-3 max-w-3xl text-[12px] text-dim">
        Saving stores only what differs from the default, so a value typed back to its default stops being an
        override. These set the house tolerance; a visitor can still choose conservative, balanced or aggressive
        on the page itself, and the reading is recomputed either way with nothing refetched.
      </p>

      {msg && (
        <p className="mt-2 text-[13px] text-muted" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
