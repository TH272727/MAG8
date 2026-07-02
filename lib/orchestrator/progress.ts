import { EventEmitter } from "node:events";
import { appendEvent } from "../db";
import type { ProgressEvent } from "../schemas";

/* ============================================================================
 * Progress bus: emit() persists the event (synchronous SQLite INSERT — the row
 * exists before any subscriber sees it) and then notifies in-process listeners.
 * The rowid doubles as the SSE event id, so Last-Event-ID resume is free.
 * ========================================================================== */

export interface BusEvent {
  id: number;
  event: ProgressEvent;
}

type GlobalWithBus = typeof globalThis & { __mag8_bus?: EventEmitter };

export function bus(): EventEmitter {
  const g = globalThis as GlobalWithBus;
  if (!g.__mag8_bus) {
    g.__mag8_bus = new EventEmitter();
    g.__mag8_bus.setMaxListeners(200);
  }
  return g.__mag8_bus;
}

export const runChannel = (runId: string) => `run:${runId}`;

export const nowIso = () => new Date().toISOString();

export function emitProgress(runId: string, event: ProgressEvent): number {
  const id = appendEvent(runId, event);
  const payload: BusEvent = { id, event };
  bus().emit(runChannel(runId), payload);
  return id;
}

/* ============================================================================
 * tool_use → short human activity line for the Mission Control feeds.
 * Returns null for tools not worth narrating.
 * ========================================================================== */

const trunc = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function toActivity(name: string, input: Record<string, unknown>): string | null {
  switch (name) {
    case "WebSearch": {
      const q = input.query;
      return typeof q === "string" && q ? `Searching: "${trunc(q, 80)}"` : "Searching the web";
    }
    case "WebFetch": {
      const url = typeof input.url === "string" ? input.url : "";
      try {
        return `Reading ${new URL(url).hostname.replace(/^www\./, "")}`;
      } catch {
        return "Reading a page";
      }
    }
    case "Bash": {
      const cmd = typeof input.command === "string" ? input.command : "";
      return cmd ? `Running: ${trunc(cmd.replace(/\s+/g, " "), 80)}` : "Running a command";
    }
    case "Read": {
      const p = typeof input.file_path === "string" ? input.file_path : typeof input.path === "string" ? input.path : "";
      const base = p.split(/[\\/]/).pop();
      return base ? `Reading ${base}` : null;
    }
    case "Skill": {
      const s = input.skill ?? input.command ?? input.name;
      return typeof s === "string" && s ? `Loading skill ${s}` : "Loading a skill";
    }
    default:
      return null;
  }
}
