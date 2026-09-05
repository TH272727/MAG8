"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshTideAction } from "@/app/tide/actions";

/* ============================================================================
 * Operating controls for the desk.
 *
 * Rendered only where the SERVER has already established an unlocked session;
 * the action behind it re-checks the token regardless, so a hand-crafted
 * request gets the same answer a visitor would.
 *
 * There is no scheduler behind this button and none is wanted. The research
 * pipeline this application is built around must never be restarted mid-run,
 * and a background job is the easiest way to do that by accident. A refresh is
 * something a person does here, or a script does headlessly.
 * ========================================================================== */

export default function TideControls() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await refreshTideAction();
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The refresh could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mt-10 p-5 sm:p-6" aria-label="Operate the desk">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="eyebrow">Operating controls</h2>
        <span className="chip">DESK ONLY</span>
        <span className="chip">$0 · NO RESEARCH CAPACITY</span>
      </div>
      <p className="mt-2 max-w-2xl text-[13px] text-muted">
        Re-reads every source and recounts breadth across the screened universe. Breadth is by far the slowest part,
        because it is several hundred separate price requests where every other reading is one. A source that cannot
        be reached degrades a single reading and is disclosed above; a refresh in which nothing was read stores
        nothing, so a dead network can never blank a working desk.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="rounded border border-hairline px-3 py-1.5 text-sm text-ink transition-colors hover:bg-white/5 disabled:opacity-50"
        >
          {busy ? "Reading sources…" : "Refresh readings"}
        </button>
        {msg && <p className="text-[13px] text-muted">{msg}</p>}
      </div>
    </section>
  );
}
