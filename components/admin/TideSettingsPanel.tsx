"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshTideAction, saveTideSettingsAction } from "@/app/tide/actions";
import SettingsGrid, { defaultRaw, type PanelGroup, type PanelSetting } from "./SettingsGrid";

/* ============================================================================
 * The Tide's dials.
 *
 * The weights are the only place a judgement is made on this desk — everything
 * else is arithmetic over public numbers — so they are edited here, published
 * at their live effective values on the methodology page, and each one states
 * its reasoning and cites the work behind it. An operator who disagrees can
 * retune them and see the desk change; what they cannot do is find a weight
 * that is not written down.
 * ========================================================================== */

export default function TideSettingsPanel({
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
      const res = await saveTideSettingsAction(values);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The settings could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Reset every dial on this desk to its default?")) return;
    setBusy("reset");
    setMsg(null);
    try {
      const res = await saveTideSettingsAction({});
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
      const res = await refreshTideAction();
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
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy !== null}
          className="rounded border border-hairline px-3 py-1.5 text-sm text-ink transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          {busy === "save" ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy !== null}
          className="rounded border border-hairline px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {busy === "reset" ? "Resetting…" : "Reset to defaults"}
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={busy !== null}
          className="rounded border border-hairline px-3 py-1.5 text-sm text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          {busy === "refresh" ? "Reading sources…" : "Refresh readings"}
        </button>
        {msg && <p className="text-[13px] text-muted">{msg}</p>}
      </div>
      <p className="mt-3 max-w-3xl text-[13px] text-dim">
        Nothing derived is stored, so saving a weight re-derives the entire desk on the next page load — today&rsquo;s
        reading, both composites, the exposure band and the whole conditional history — without fetching anything.
        A refresh is only needed to bring in newly published data.
      </p>
    </div>
  );
}
