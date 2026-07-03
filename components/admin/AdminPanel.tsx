"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export interface RunEstimate {
  calls: number;
  usdLow: number;
  usdHigh: number;
  minutesLow: number;
  minutesHigh: number;
}

interface Message {
  kind: "error" | "info";
  text: string;
  runId?: string;
}

export default function AdminPanel({
  hasKey,
  isDev,
  allowMock,
  defaultCount,
  estimates,
}: {
  hasKey: boolean;
  isDev: boolean;
  allowMock: boolean;
  defaultCount: number;
  estimates: Record<number, RunEstimate>;
}) {
  const router = useRouter();
  const [count, setCount] = useState(defaultCount);
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState<null | "real" | "mock">(null);
  const [msg, setMsg] = useState<Message | null>(null);
  const est = estimates[count];

  async function trigger(mock: boolean) {
    setBusy(mock ? "mock" : "real");
    setMsg(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count, force, mock }),
      });
      const data = (await res.json().catch(() => ({}))) as { runId?: string; error?: string; activeRunId?: string };
      if (res.status === 202 && data.runId) {
        router.push(`/runs/${data.runId}`);
        return;
      }
      if (res.status === 409) {
        setMsg({ kind: "error", text: data.error ?? "A run is already in progress.", runId: data.activeRunId });
        return;
      }
      setMsg({ kind: "error", text: data.error ?? `Request failed (HTTP ${res.status}).` });
    } catch {
      setMsg({ kind: "error", text: "Network error — is the server still up?" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel p-5 sm:p-6">
      {/* API key status */}
      {hasKey ? (
        <span className="chip gate-pass">ANTHROPIC_API_KEY SET</span>
      ) : (
        <div className="rounded-md border border-macro/40 bg-macro/5 p-4">
          <p className="eyebrow text-macro">API key missing</p>
          <p className="mt-1 text-sm text-muted">
            ANTHROPIC_API_KEY is not set, so real pipeline runs are disabled. Add it to{" "}
            <code className="font-mono text-[12px] text-ink">.env.local</code> and restart the server.
            {isDev ? " Mock runs still work — full Mission Control, zero spend." : ""}
          </p>
        </div>
      )}

      {/* Controls */}
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <label htmlFor="count" className="eyebrow">
            Candidates to discover
          </label>
          <div className="mt-2 flex items-center gap-4">
            <input
              id="count"
              type="range"
              min={4}
              max={12}
              step={1}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full max-w-xs accent-[var(--color-discovery)]"
            />
            <span className="tabular w-10 text-right font-mono text-2xl font-bold">{count}</span>
          </div>

          <label className="mt-4 flex items-start gap-2.5 text-sm text-muted">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="mt-0.5 accent-[var(--color-discovery)]"
            />
            <span>
              <span className="text-ink">Force fresh analysis</span> — skip this week&apos;s lens cache and
              re-run every cell.
            </span>
          </label>
        </div>

        <div className="sm:text-right">
          <p className="eyebrow">Estimated footprint</p>
          <p className="tabular mt-2 font-mono text-[13px] leading-relaxed text-muted">
            1 discovery + {count}×3 lenses + 1 compile
            <br />
            <span className="text-ink">{est.calls} agent calls</span>
            <br />
            ~${est.usdLow}–${est.usdHigh} · ~{est.minutesLow}–{est.minutesHigh} min
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
        <button type="button" className="btn btn-primary" disabled={!hasKey || busy !== null} onClick={() => trigger(false)}>
          {busy === "real" ? "Starting…" : "Run the pipeline"}
        </button>
        {allowMock && (
          <button type="button" className="btn" disabled={busy !== null} onClick={() => trigger(true)}>
            {busy === "mock" ? "Starting…" : "Mock run (no spend)"}
          </button>
        )}
        <span className="text-[12px] text-dim">One run at a time; live view opens automatically.</span>
      </div>

      {msg && (
        <div className={`mt-4 rounded-md border p-3 text-sm ${msg.kind === "error" ? "border-danger/40 text-danger" : "border-hairline text-muted"}`} role="alert">
          {msg.text}{" "}
          {msg.runId && (
            <Link href={`/runs/${msg.runId}`} className="underline underline-offset-2">
              Watch the active run →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
