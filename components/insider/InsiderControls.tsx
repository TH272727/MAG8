"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { refreshInsiderAction } from "@/app/insider/actions";

/* ============================================================================
 * Operating controls for the scanner.
 *
 * Rendered only where the SERVER has already established an unlocked session;
 * the action behind it re-checks the token regardless, so a hand-crafted
 * request gets the same answer a visitor would.
 *
 * There is no scheduler behind this button and none is wanted. The research
 * pipeline this app is built around must never be restarted mid-run, and a
 * background job is the easiest way to do that by accident.
 * ========================================================================== */

const WINDOWS = [3, 7, 30, 60] as const;

export default function InsiderControls({ lookbackDays }: { lookbackDays: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState<number>(7);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await refreshInsiderAction(days);
      setMsg(res.message);
      if (res.ok) router.refresh();
    } catch {
      setMsg("The refresh could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel mt-10 p-5 sm:p-6" aria-label="Operate the scanner">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">Operate the scanner</p>
        <div className="flex flex-wrap gap-2">
          <span className="chip">SCANNER ONLY</span>
          <span className="chip">$0 · NO RESEARCH CAPACITY</span>
        </div>
      </div>
      <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted">
        A refresh walks the filings index one day at a time, opens only the filings made by companies the weekly
        screen considers investable, and then fetches prices and financial statements for the companies whose
        buying is most convincing. Days already read are skipped, so a short window after a long one is quick.
        Everything the pages show is recomputed from what is stored, so a threshold change needs no refresh at
        all.
      </p>
      <p className="mt-2 max-w-2xl text-[12px] text-dim">
        A company that cannot be fetched keeps whatever it already had. A refresh in which nothing could be read
        writes nothing and says why. The scan currently reads a {lookbackDays}-day window.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor="ins-days" className="font-mono text-[11px] tracking-[0.1em] text-dim">
          DAYS TO WALK
        </label>
        <select
          id="ins-days"
          className="rounded-md border border-hairline bg-panel2 px-2 py-1.5 text-[13px] text-ink"
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          disabled={busy}
        >
          {WINDOWS.map((d) => (
            <option key={d} value={d}>
              {d} days
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-primary" onClick={refresh} disabled={busy}>
          {busy ? "Reading filings…" : "Refresh"}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-dim">
        A long window is a long job: roughly two hundred filings per trading day are opened, paced through one
        queue to stay well inside the regulator&apos;s published rate limit.
      </p>

      {msg && (
        <p className="mt-3 text-[13px] text-muted" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
