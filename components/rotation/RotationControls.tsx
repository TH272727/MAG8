"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshRotationAction } from "@/app/rotation/actions";

/* ============================================================================
 * Operating controls for the board.
 *
 * Rendered only where the SERVER has already established an unlocked session;
 * every action behind it re-checks the token regardless, so a hand-crafted
 * request gets the same answer a visitor would.
 *
 * There is no scheduler behind this button and none is wanted. The pipeline
 * this app is built around must never be restarted mid-run, and a background
 * job is the easiest way to do that by accident. A refresh is something a
 * person does here, or a script does headlessly.
 * ========================================================================== */

export default function RotationControls({ tickerCount }: { tickerCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await refreshRotationAction();
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The refresh could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mt-10 p-5 sm:p-6" aria-label="Operate the board">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Operate the board</p>
        <div className="flex flex-wrap gap-2">
          <span className="chip">BOARD ONLY</span>
          <span className="chip">$0 · NO RESEARCH CAPACITY</span>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
        A refresh pulls daily closes for all {tickerCount} instruments the catalog needs, paced through a single
        queue, and stores them. It costs nothing and draws no research capacity — everything here is arithmetic
        over public prices. Scores are recomputed from stored prices on every page load, so retuning a weight
        takes effect without refetching anything.
      </p>
      <p className="mt-2 max-w-2xl text-[12px] text-dim">
        A ticker that cannot be fetched keeps the history it already has, and says so. Nothing is overwritten by
        a failed read.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-primary" onClick={refresh} disabled={busy}>
          {busy ? "Reading prices…" : "Refresh prices"}
        </button>
      </div>

      {msg && (
        <p className="mt-3 text-[13px] text-muted" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
