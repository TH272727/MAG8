"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Admin-only affordance: finish a run that stopped mid-flight, in place. Only
 * the unfinished lens cells and the compile run, so the plan window is spent on
 * the gap rather than on work that already succeeded.
 *
 * Rendered only where the SERVER has already established an unlocked desk —
 * the button never appears for a visitor, and the API re-checks the token
 * regardless.
 */
export default function ResumeRunButton({
  runId,
  remaining,
  total,
  /** Jump to mission control on success (the desk); otherwise refresh in place. */
  navigate = false,
  className = "btn",
}: {
  runId: string;
  remaining: number;
  total: number;
  navigate?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; runId?: string } | null>(null);

  async function resume() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/resume`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string; activeRunId?: string };
      if (res.status === 202) {
        if (navigate) router.push(`/runs/${runId}`);
        else router.refresh(); // the page re-renders live and opens the stream
        return;
      }
      setMsg({ text: data.error ?? `Request failed (HTTP ${res.status}).`, runId: data.activeRunId });
    } catch {
      setMsg({ text: "Network error — is the server still up?" });
    } finally {
      setBusy(false);
    }
  }

  const left = remaining > 0 ? `${remaining} of ${total} cells left` : "compile only";

  return (
    <div>
      <button type="button" className={className} disabled={busy} onClick={resume} title={`Resume — ${left}`}>
        {busy ? "Resuming…" : `Resume · ${left}`}
      </button>
      {msg && (
        <p className="mt-2 text-[12px] text-danger" role="alert">
          {msg.text}{" "}
          {msg.runId && (
            <Link href={`/runs/${msg.runId}`} className="underline underline-offset-2">
              Watch the active run →
            </Link>
          )}
        </p>
      )}
    </div>
  );
}
