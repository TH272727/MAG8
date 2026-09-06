"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCrossdeskSettingsAction } from "@/app/crossdesk/actions";
import SettingsGrid, { defaultRaw, type PanelGroup, type PanelSetting } from "./SettingsGrid";

/* ============================================================================
 * The Cross-Desk Ledger's dials.
 *
 * There is no refresh button here and there should not be one. The ledger
 * fetches nothing and stores nothing; it is derived on read from four other
 * desks, so a change here applies on the next page load, and the only thing
 * that could be refreshed belongs to one of those desks.
 * ========================================================================== */

export default function CrossdeskSettingsPanel({
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
  const [busy, setBusy] = useState<null | "save" | "reset">(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await saveCrossdeskSettingsAction(values);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The settings could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Reset every cross-desk dial to its default?")) return;
    setBusy("reset");
    setMsg(null);
    try {
      const res = await saveCrossdeskSettingsAction({});
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
        Saving stores only what differs from the default. Nothing is fetched or written by this page, so a
        change here shows up on the next read with no refresh of any kind.
      </p>

      {msg && (
        <p className="mt-2 text-[13px] text-muted" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
