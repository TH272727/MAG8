"use client";

import { useMemo, useState } from "react";
import ConfluenceLine, { type ThreadState } from "@/components/confluence/ConfluenceLine";
import type { ThreadKey } from "@/components/confluence/paths";
import CandidateCard from "./CandidateCard";
import CompilerPanel from "./CompilerPanel";
import DiscoveryFeed from "./DiscoveryFeed";
import MatrixGrid from "./MatrixGrid";
import PipelineMap from "./PipelineMap";
import StageRail, { type StageStatus } from "./StageRail";
import { fmtDateTime, fmtMoney, shortId } from "@/lib/format";
import {
  snapshotToStreamState,
  useRunStream,
  type RunStreamState,
} from "@/lib/hooks/useRunStream";
import { PUBLIC_LENSES, publicCellKey, type PublicRunSnapshot } from "@/lib/public-lens";
import type { Stage } from "@/lib/schemas";

function deriveThreads(state: RunStreamState): Partial<Record<ThreadKey, ThreadState>> {
  const threads: Partial<Record<ThreadKey, ThreadState>> = {};

  if (state.candidates.length > 0) threads.discovery = "done";
  else if (state.error) threads.discovery = "error";
  else if (state.stage === "discovery") threads.discovery = "active";
  else threads.discovery = "idle";

  for (const lens of PUBLIC_LENSES) {
    if (state.candidates.length === 0) {
      threads[lens] = "idle";
      continue;
    }
    const column = state.candidates.map((c) => state.cells[publicCellKey(c.ticker, lens)]);
    const done = column.filter((c) => c?.status === "done").length;
    const error = column.filter((c) => c?.status === "error").length;
    const running = column.some((c) => c?.status === "running");
    const settled = done + error === column.length;

    if (running) threads[lens] = "active";
    else if (settled || state.stage === "compile" || state.report) threads[lens] = done > 0 ? "done" : error > 0 ? "error" : "idle";
    else if (done + error > 0) threads[lens] = "active";
    else threads[lens] = "idle";
  }
  return threads;
}

function deriveStageStatuses(state: RunStreamState): Record<Stage, StageStatus> {
  const failedAt = state.error ? (state.stage ?? "discovery") : null;
  const discovery: StageStatus =
    state.candidates.length > 0
      ? "done"
      : failedAt === "discovery"
        ? "error"
        : state.stage === "discovery"
          ? "active"
          : "pending";
  const analysis: StageStatus =
    state.stage === "compile" || state.report
      ? "done"
      : failedAt === "analysis"
        ? "error"
        : state.stage === "analysis"
          ? "active"
          : "pending";
  const compile: StageStatus = state.report
    ? "done"
    : failedAt === "compile"
      ? "error"
      : state.stage === "compile"
        ? "active"
        : "pending";
  return { discovery, analysis, compile };
}

const STAGE_LABEL: Record<Stage, string> = {
  discovery: "Stage 1 — discovery",
  analysis: "Stage 2 — analysis matrix",
  compile: "Stage 3 — compile and verify",
};

export default function RunView({ snapshot }: { snapshot: PublicRunSnapshot }) {
  const { run } = snapshot;
  const live = run.status === "pending" || run.status === "running";
  const stream = useRunStream(run.id, live);
  const state = live ? stream : snapshotToStreamState(snapshot);

  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const threads = useMemo(() => deriveThreads(state), [state]);
  const stageStatuses = useMemo(() => deriveStageStatuses(state), [state]);
  const topScore = state.report?.rankings[0]?.finalScore ?? null;
  const connecting = live && !state.connected && state.lastEventId === 0;
  const interrupted = !live && run.status === "interrupted";
  const cost = state.totalCostUsd ?? run.totalCostUsd;

  const statusChip = state.terminal
    ? state.error
      ? { cls: "gate-fail", text: interrupted ? "INTERRUPTED" : "ERROR" }
      : { cls: "border-confluence/50 bg-confluence/10 text-confluence", text: "COMPLETE" }
    : state.connected
      ? { cls: "border-fundamentals/40 text-fundamentals", text: "LIVE" }
      : { cls: "", text: connecting ? "CONNECTING" : "RECONNECTING" };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* announce stage changes to screen readers without flooding them */}
      <p className="sr-only" aria-live="polite">
        {state.terminal ? (state.error ? "Run ended with an error" : "Run complete") : state.stage ? STAGE_LABEL[state.stage] : "Run starting"}
      </p>

      {/* ---- header ---- */}
      <div className="grid-bg rounded-md border border-hairline p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Mission control</p>
            <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Run <span className="font-mono text-muted">{shortId(run.id)}</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${statusChip.cls}`}>
              {!state.terminal && state.connected && <span className="live-dot" aria-hidden="true" />}
              {statusChip.text}
            </span>
            <span className="chip">N = {run.params.count}</span>
            {run.params.force && <span className="chip">FORCE</span>}
            {run.params.mock && <span className="chip border-discovery/40 text-discovery">MOCK</span>}
            {run.params.modifier && (
              <span
                className="chip max-w-56 border-discovery/40 text-discovery"
                title={
                  run.params.mock
                    ? `Focus: ${run.params.modifier} — demo runs use the fixed demo cohort, so the focus is shown as a label only.`
                    : `Focus: ${run.params.modifier}`
                }
              >
                <span className="truncate">FOCUS · {run.params.modifier.toUpperCase()}</span>
              </span>
            )}
            {cost !== null && <span className="chip tabular">COST {fmtMoney(cost)}</span>}
          </div>
        </div>
        <p className="mt-2 font-mono text-[11px] tracking-[0.08em] text-dim">
          STARTED {fmtDateTime(run.createdAt).toUpperCase()}
          {run.finishedAt ? ` · FINISHED ${fmtDateTime(run.finishedAt).toUpperCase()}` : ""}
        </p>

        <div className="mt-4" aria-hidden="true">
          <ConfluenceLine
            mode={state.terminal ? "static" : "live"}
            threads={threads}
            score={topScore}
            className="w-full"
          />
        </div>
      </div>

      {/* ---- stage rail ---- */}
      <div className="mt-6">
        <StageRail statuses={stageStatuses} />
      </div>

      {/* ---- pipeline map ---- */}
      <div className="panel mt-6 p-3 sm:p-4">
        <PipelineMap state={state} />
      </div>

      {/* ---- error banner ---- */}
      {state.error && (
        <div className="panel mt-6 border-danger/40 p-4" role="alert">
          <p className="eyebrow text-danger">{interrupted ? "Run interrupted" : "Run error"}</p>
          <p className="mt-1 font-mono text-[13px] text-ink/90">{state.error}</p>
          <p className="mt-2 text-[13px] text-muted">
            Completed lens cells are kept and will be reused from cache within the week. Start a fresh
            run from the admin desk.
          </p>
        </div>
      )}

      {/* ---- stage 1 ---- */}
      {(live || state.discoveryActivity.length > 0) && !state.report && (
        <section className="mt-6" aria-label="Stage 1 — discovery">
          <DiscoveryFeed
            lines={state.discoveryActivity}
            searching={stageStatuses.discovery === "active"}
            marketContext={state.marketContext}
          />
        </section>
      )}

      {state.candidates.length > 0 && (
        <section className="mt-8" aria-labelledby="cohort-h">
          <h2 id="cohort-h" className="eyebrow">
            Stage 01 · Cohort — {state.candidates.length} candidates
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {state.candidates.map((c, i) => (
              <CandidateCard key={c.ticker} candidate={c} index={i} entrance={live && !state.terminal} />
            ))}
          </div>
        </section>
      )}

      {/* ---- stage 2 ---- */}
      {state.candidates.length > 0 && (
        <section className="mt-8" aria-labelledby="matrix-h">
          <h2 id="matrix-h" className="eyebrow">
            Stage 02 · Analysis matrix — {state.candidates.length} × {PUBLIC_LENSES.length}, independent
          </h2>
          <div className="mt-3">
            <MatrixGrid
              candidates={state.candidates}
              cells={state.cells}
              expandedKey={expandedKey}
              onToggle={(key) => setExpandedKey((prev) => (prev === key ? null : key))}
              terminal={state.terminal}
            />
          </div>
        </section>
      )}

      {/* ---- stage 3 ---- */}
      {(stageStatuses.compile !== "pending" || state.compileActivity.length > 0) && (
        <section className="mt-8" aria-labelledby="compile-h">
          <h2 id="compile-h" className="eyebrow">
            Stage 03 · Compile &amp; verify
          </h2>
          <div className="mt-3">
            <CompilerPanel
              active={stageStatuses.compile === "active"}
              lines={state.compileActivity}
              report={state.report}
            />
          </div>
        </section>
      )}

      {connecting && (
        <p className="mt-8 text-center font-mono text-[12px] text-dim">Connecting to mission control…</p>
      )}
    </main>
  );
}
