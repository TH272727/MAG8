"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  refreshReachAction,
  saveFeedCatalogAction,
  saveHandleMapAction,
  saveReachSettingsAction,
} from "@/app/admin/reach-actions";
import SettingsGrid, { defaultRaw, type PanelGroup, type PanelSetting } from "./SettingsGrid";

/* ============================================================================
 * The evidence layer's dials, and its two catalogues.
 *
 * The dials change what the NEXT read gathers, not what is already stored: the
 * week's snapshot is frozen so that two readings of the same company in one
 * week were shown the same evidence, which is exactly the property that would
 * be lost if a dial silently rewrote it. Widening a window therefore needs a
 * refresh to take effect — and the button says so.
 *
 * Both catalogues validate as a whole set and store none of it on a failure. A
 * half-applied catalogue is much harder to notice than a rejected one.
 * ========================================================================== */

export default function ReachSettingsPanel({
  groups,
  settings,
  feeds,
  handles,
}: {
  groups: PanelGroup[];
  settings: PanelSetting[];
  feeds: string;
  handles: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number | boolean>>(() =>
    Object.fromEntries(settings.map((s) => [s.key, s.value])),
  );
  const [feedText, setFeedText] = useState(feeds);
  const [handleText, setHandleText] = useState(handles);
  const [busy, setBusy] = useState<null | "save" | "reset" | "refresh" | "feeds" | "handles">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (kind: NonNullable<typeof busy>, fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) => {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fn();
      setMsg(res.message);
      if (res.ok) {
        after?.();
        router.refresh();
      }
    } catch {
      setMsg("That could not be completed.");
    } finally {
      setBusy(null);
    }
  };

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
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => run("save", () => saveReachSettingsAction(values))}
          disabled={busy !== null}
        >
          {busy === "save" ? "Saving…" : "Save dials"}
        </button>
        <button type="button" className="btn" onClick={() => run("refresh", refreshReachAction)} disabled={busy !== null}>
          {busy === "refresh" ? "Reading sources…" : "Re-read this week"}
        </button>
        <button
          type="button"
          className="btn hover:border-danger/50 hover:text-danger"
          onClick={() =>
            window.confirm("Reset every evidence dial to its default?") &&
            run("reset", () => saveReachSettingsAction({}), () =>
              setValues(Object.fromEntries(settings.map((s) => [s.key, defaultRaw(s)]))),
            )
          }
          disabled={busy !== null}
        >
          {busy === "reset" ? "Resetting…" : "Reset to defaults"}
        </button>
      </div>

      <p className="mt-3 max-w-3xl text-[12px] text-dim">
        Saving stores only what differs from the default. Unlike the other panels, a dial here changes what
        the next read <em>gathers</em> rather than how stored data is scored — the week&apos;s evidence is
        frozen on purpose, so that two readings of the same company in one week were shown the same thing.
        Widening a window therefore needs a re-read to show up.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <h3 className="font-display text-base font-semibold">Official-release sources</h3>
          <p className="mt-1 text-[13px] text-muted">
            Added to the built-in central banks and statistical agencies; an entry reusing a built-in id
            replaces it. A list of{" "}
            <code className="font-mono text-[12px]">{`{"id","label","publisher","url"}`}</code> — https only.
            The feed dialect is detected from the body, so RSS and Atom both work and neither is declared.
          </p>
          <textarea
            className="mt-3 h-40 w-full rounded border border-line bg-black/20 p-2 font-mono text-[12px] text-ink"
            value={feedText}
            onChange={(e) => setFeedText(e.target.value)}
            spellCheck={false}
            aria-label="Custom official-release sources, as JSON"
          />
          <button
            type="button"
            className="btn mt-2"
            onClick={() => run("feeds", () => saveFeedCatalogAction(feedText))}
            disabled={busy !== null}
          >
            {busy === "feeds" ? "Saving…" : "Save sources"}
          </button>
        </div>

        <div className="panel p-5">
          <h3 className="font-display text-base font-semibold">Developer-account handles</h3>
          <p className="mt-1 text-[13px] text-muted">
            Ticker to public organisation name, e.g.{" "}
            <code className="font-mono text-[12px]">{`{"IONQ": "ionq"}`}</code>. An <em>empty</em> handle
            removes a built-in, which is how a wrong mapping is retired — that ticker then returns to being
            one nobody looked up, rather than one that failed. Handles are never guessed: a name that does
            not exist is reported as such, and is not read as a company that publishes nothing.
          </p>
          <textarea
            className="mt-3 h-40 w-full rounded border border-line bg-black/20 p-2 font-mono text-[12px] text-ink"
            value={handleText}
            onChange={(e) => setHandleText(e.target.value)}
            spellCheck={false}
            aria-label="Custom developer-account handles, as JSON"
          />
          <button
            type="button"
            className="btn mt-2"
            onClick={() => run("handles", () => saveHandleMapAction(handleText))}
            disabled={busy !== null}
          >
            {busy === "handles" ? "Saving…" : "Save handles"}
          </button>
        </div>
      </div>

      {msg && (
        <p className="mt-3 text-[13px] text-muted" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
