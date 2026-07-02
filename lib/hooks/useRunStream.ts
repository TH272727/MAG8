"use client";

import { useEffect, useReducer } from "react";
import type { RunSnapshot } from "../db";
import {
  cellKey,
  type CompiledReport,
  type Confidence,
  type DiscoveryCandidate,
  type LensCellStatus,
  type ProgressEvent,
  type Stage,
  type Verdict,
} from "../schemas";

/* ============================================================================
 * Event-sourced client state for Mission Control. Live pages rebuild entirely
 * from the SSE replay (server replays from id 0 or Last-Event-ID); terminal
 * pages skip SSE and convert the server snapshot to the same shape.
 * ========================================================================== */

const MAX_FEED = 50;

export interface CellState {
  status: LensCellStatus;
  activity: string[];
  verdict?: Verdict;
  confidence?: Confidence;
  headline?: string;
  cached?: boolean;
  error?: string;
}

export interface RunStreamState {
  connected: boolean;
  lastEventId: number;
  stage: Stage | null;
  discoveryActivity: string[];
  marketContext: string | null;
  candidates: DiscoveryCandidate[];
  cells: Record<string, CellState>;
  compileActivity: string[];
  report: CompiledReport | null;
  totalCostUsd: number | null;
  error: string | null;
  terminal: boolean;
}

export const initialRunStreamState: RunStreamState = {
  connected: false,
  lastEventId: 0,
  stage: null,
  discoveryActivity: [],
  marketContext: null,
  candidates: [],
  cells: {},
  compileActivity: [],
  report: null,
  totalCostUsd: null,
  error: null,
  terminal: false,
};

type Action =
  | { kind: "event"; id: number; event: ProgressEvent }
  | { kind: "connected" }
  | { kind: "disconnected" };

const push = (feed: string[], line: string) => [...feed, line].slice(-MAX_FEED);

export function runStreamReducer(state: RunStreamState, action: Action): RunStreamState {
  if (action.kind === "connected") return state.connected ? state : { ...state, connected: true };
  if (action.kind === "disconnected") return state.connected ? { ...state, connected: false } : state;

  const { id, event } = action;
  // Idempotent under EventSource auto-reconnect replays.
  if (id !== 0 && id <= state.lastEventId) return state;
  const s = { ...state, lastEventId: Math.max(id, state.lastEventId) };

  switch (event.type) {
    case "stage_start":
      return { ...s, stage: event.stage };
    case "discovery_activity":
      return { ...s, discoveryActivity: push(state.discoveryActivity, event.activity) };
    case "discovery_complete":
      return { ...s, marketContext: event.marketContext, candidates: event.candidates };
    case "lens_status": {
      const key = cellKey(event.ticker, event.skill);
      const prev = state.cells[key] ?? { status: "queued" as const, activity: [] };
      const cell: CellState = {
        status: event.status,
        activity: event.activity ? push(prev.activity, event.activity) : prev.activity,
        verdict: event.verdict ?? prev.verdict,
        confidence: event.confidence ?? prev.confidence,
        headline: event.headline ?? prev.headline,
        cached: event.cached ?? prev.cached,
        error: event.error ?? prev.error,
      };
      return { ...s, cells: { ...state.cells, [key]: cell } };
    }
    case "compile_activity":
      return { ...s, compileActivity: push(state.compileActivity, event.activity) };
    case "run_complete":
      return { ...s, report: event.report, totalCostUsd: event.totalCostUsd, terminal: true };
    case "run_error":
      return { ...s, error: event.error, terminal: true };
    default:
      return s;
  }
}

/**
 * Open the run's SSE stream and fold events into state. Only call with
 * enabled=true for pending/running runs; terminal runs should render from
 * snapshotToStreamState() without a stream.
 */
export function useRunStream(runId: string, enabled: boolean): RunStreamState {
  const [state, dispatch] = useReducer(runStreamReducer, initialRunStreamState);

  useEffect(() => {
    if (!enabled) return;
    const es = new EventSource(`/api/runs/${encodeURIComponent(runId)}/stream`);
    es.onopen = () => dispatch({ kind: "connected" });
    es.onmessage = (m: MessageEvent<string>) => {
      try {
        const event = JSON.parse(m.data) as ProgressEvent;
        dispatch({ kind: "event", id: Number(m.lastEventId) || 0, event });
        if (event.type === "run_complete" || event.type === "run_error") es.close();
      } catch {
        // malformed frame — ignore
      }
    };
    es.onerror = () => dispatch({ kind: "disconnected" }); // EventSource auto-reconnects with Last-Event-ID
    return () => es.close();
  }, [runId, enabled]);

  return state;
}

/** Convert a server snapshot into the same view-model shape (terminal runs, no SSE). */
export function snapshotToStreamState(snapshot: RunSnapshot): RunStreamState {
  const cells: Record<string, CellState> = {};
  for (const c of snapshot.cells) {
    cells[cellKey(c.ticker, c.skill)] = {
      status: c.status === "ok" ? "done" : "error",
      activity: [],
      verdict: c.verdict,
      confidence: c.confidence,
      headline: c.headline,
      cached: c.cached || undefined,
      error: c.error ?? undefined,
    };
  }
  const { run } = snapshot;
  return {
    connected: false,
    lastEventId: snapshot.lastEventId,
    stage: run.stage,
    discoveryActivity: [],
    marketContext: null,
    candidates: snapshot.candidates,
    cells,
    compileActivity: [],
    report: snapshot.report,
    totalCostUsd: run.totalCostUsd,
    error: run.error,
    terminal: run.status !== "running" && run.status !== "pending",
  };
}
