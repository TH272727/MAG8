"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshRiskAction, saveRiskSettingsAction } from "@/app/risk/actions";
import SettingsGrid, { defaultRaw, type PanelGroup, type PanelSetting } from "./SettingsGrid";

/* ============================================================================
 * The Risk Desk's dials.
 *
 * Almost every knob here is a WINDOW, and a window is a choice rather than a
 * fact — volatility over three months and volatility over three years are both
 * true and are different numbers. Moving one re-derives the entire board on the
 * next read, including every reason a company went unmeasured, because this
 * desk stores no figure of its own. Only the prices are stored, and only those
 * need the refresh button.
 * ========================================================================== */

export default function RiskSettingsPanel({
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
      const res = await saveRiskSettingsAction(values);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The settings could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Reset every risk dial to its default?")) return;
    setBusy("reset");
    setMsg(null);
    try {
      const res = await saveRiskSettingsAction({});
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
      const res = await refreshRiskAction();
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
        Saving stores only what differs from the default. No figure on this desk is stored, so a dial applies on
        the next read with no refresh at all — the refresh button is only for pulling newer closes, and it skips
        any company another desk has already priced recently enough.
      </p>

      {msg && (
        <p className="mt-2 text-[13px] text-muted" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
