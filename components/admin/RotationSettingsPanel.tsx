"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshRotationAction, saveRotationSettingsAction } from "@/app/rotation/actions";
import SettingsGrid, { defaultRaw, type PanelGroup, type PanelSetting } from "./SettingsGrid";

/* ============================================================================
 * The Rotation Board's dials.
 *
 * Every one of them re-derives the whole board on the next read, including the
 * marks on every chart, because nothing is stored except daily closes. So a
 * save here is not a configuration change that takes effect later — it changes
 * what the board says immediately, and the methodology page publishes the
 * values that produced it.
 * ========================================================================== */

export default function RotationSettingsPanel({
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
      const res = await saveRotationSettingsAction(values);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The settings could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Reset every rotation dial to its default?")) return;
    setBusy("reset");
    setMsg(null);
    try {
      const res = await saveRotationSettingsAction({});
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
      const res = await refreshRotationAction();
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
        accent="consensus"
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={save} disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save dials"}
        </button>
        <button type="button" className="btn" onClick={refresh} disabled={busy !== null}>
          {busy === "refresh" ? "Reading prices…" : "Refresh prices"}
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
        Saving stores only what differs from the default, so a value typed back to its default stops being
        an override. Scores are recomputed from stored prices on every read, so a change here applies at
        once and needs no refresh — the refresh button is for pulling newer closes.
      </p>

      {msg && (
        <p className="mt-2 text-[13px] text-muted" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
