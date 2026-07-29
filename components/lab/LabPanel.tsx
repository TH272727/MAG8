"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RunEstimate } from "@/components/admin/AdminPanel";
import type { AuthMode } from "@/lib/config";

interface Message {
  kind: "error" | "info";
  text: string;
  runId?: string;
}

/**
 * Public-facing focused-run console. Anyone can see it; launching a run is
 * operator-token-gated (or already unlocked via the admin cookie). Built
 * user-ready: when accounts/payments exist, the token gate swaps for a
 * per-user entitlement check without touching the rest of this flow.
 */
export default function LabPanel({
  authMode,
  allowMock,
  defaultCount,
  estimates,
  adminUnlocked,
}: {
  authMode: AuthMode;
  allowMock: boolean;
  defaultCount: number;
  estimates: Record<number, RunEstimate>;
  adminUnlocked: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(defaultCount);
  const [focus, setFocus] = useState("");
  const [blind, setBlind] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<null | "real" | "mock">(null);
  const [msg, setMsg] = useState<Message | null>(null);
  const est = estimates[count];

  async function trigger(mock: boolean) {
    setBusy(mock ? "mock" : "real");
    setMsg(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token.trim() ? { "x-admin-token": token.trim() } : {}),
        },
        body: JSON.stringify({ count, mock, blind, ...(focus.trim() ? { modifier: focus.trim() } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as { runId?: string; error?: string; activeRunId?: string };
      if (res.status === 202 && data.runId) {
        router.push(`/runs/${data.runId}`);
        return;
      }
      if (res.status === 401) {
        setMsg({ kind: "error", text: "Operator token required (or incorrect). Focused runs consume real research capacity, so launching stays gated for now." });
        return;
      }
      if (res.status === 409) {
        setMsg({ kind: "error", text: data.error ?? "A run is already in progress — Mag8 runs one pipeline at a time.", runId: data.activeRunId });
        return;
      }
      setMsg({ kind: "error", text: data.error ?? `Request failed (HTTP ${res.status}).` });
    } catch {
      setMsg({ kind: "error", text: "Network error — please try again." });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel p-5 sm:p-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <label htmlFor="lab-focus" className="eyebrow">
            Focus directive
          </label>
          <textarea
            id="lab-focus"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            maxLength={280}
            rows={3}
            placeholder={'e.g. "small cap only", "focus on tech stocks", "energy transition names under $10B"'}
            className="mt-2 w-full resize-none rounded-md border border-hairline bg-void px-3 py-2 font-mono text-[13px] text-ink placeholder:text-dim focus:border-discovery/60 focus:outline-none"
          />
          <p className="mt-1 font-mono text-[11px] text-dim">{focus.length}/280 · scopes WHICH stocks the scout hunts; scoring rules never change</p>

          <div className="mt-5">
            <label htmlFor="lab-count" className="eyebrow">
              Candidates to discover
            </label>
            <div className="mt-2 flex items-center gap-4">
              <input
                id="lab-count"
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
          </div>

          <div className="mt-5">
            <label htmlFor="lab-blind" className="flex cursor-pointer items-start gap-3">
              <input
                id="lab-blind"
                type="checkbox"
                checked={blind}
                onChange={(e) => setBlind(e.target.checked)}
                className="mt-0.5 accent-[var(--color-discovery)]"
              />
              <span className="min-w-0">
                <span className="text-sm text-ink">Blind selection (experiment)</span>
                <span className="mt-0.5 block text-[13px] leading-relaxed text-muted">
                  The scout picks its shortlist from anonymized fundamentals cards — no ticker or
                  company name — before researching the un-blinded names. A clean read on how much
                  name recognition drives a normal cohort. Live runs only; kept off the canonical
                  board.
                </span>
              </span>
            </label>
          </div>

          {!adminUnlocked && (
            <div className="mt-5">
              <label htmlFor="lab-token" className="eyebrow">
                Operator token
              </label>
              <input
                id="lab-token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Required to launch"
                autoComplete="off"
                className="mt-2 w-full max-w-xs rounded-md border border-hairline bg-void px-3 py-2 font-mono text-[13px] text-ink placeholder:text-dim focus:border-discovery/60 focus:outline-none"
              />
            </div>
          )}
        </div>

        <div className="sm:text-right">
          <p className="eyebrow">Estimated footprint</p>
          <p className="tabular mt-2 font-mono text-[13px] leading-relaxed text-muted">
            1 discovery + {count}×3 lenses + 1 compile
            <br />
            <span className="text-ink">{est.calls} research calls</span>
            <br />~{est.minutesLow}–{est.minutesHigh} min
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline pt-5">
        <button
          type="button"
          className="btn btn-primary"
          disabled={authMode === "none" || busy !== null}
          onClick={() => trigger(false)}
        >
          {busy === "real" ? "Starting…" : "Run a focused pipeline"}
        </button>
        {allowMock && (
          <button type="button" className="btn" disabled={busy !== null} onClick={() => trigger(true)}>
            {busy === "mock" ? "Starting…" : "Demo preview (no spend)"}
          </button>
        )}
        <span className="text-[12px] text-dim">
          One run at a time.{allowMock ? " Demo previews replay a fixed cohort — the focus shows as a label only." : ""}
        </span>
      </div>

      {authMode === "none" && (
        <p className="mt-3 text-[13px] text-dim">
          Live runs are currently disabled on this server (research credentials not configured).
        </p>
      )}

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
