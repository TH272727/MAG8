import { NextRequest, NextResponse } from "next/server";
import { getEventsSince, getRun } from "@/lib/db";
import { bus, runChannel, type BusEvent } from "@/lib/orchestrator/progress";
import type { ProgressEvent } from "@/lib/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TERMINAL = new Set<ProgressEvent["type"]>(["run_complete", "run_error"]);
const HEARTBEAT_MS = 15_000;

/**
 * SSE stream for one run.
 *
 * Ordering: subscribe FIRST, then replay getEventsSince(lastEventId) — safe
 * because both happen in one synchronous block on one JS thread and writers
 * persist (SQLite INSERT) before they emit. The monotonic rowid doubles as the
 * SSE id, so browser reconnects resume via Last-Event-ID for free; send()
 * drops anything at or below the max id already sent.
 *
 * Requires compress:false (next.config.ts) so Next never gzip-buffers this.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ runId: string }> }) {
  const { runId } = await ctx.params;
  const run = getRun(runId);
  if (!run) {
    return NextResponse.json({ code: "not_found", error: "run not found" }, { status: 404 });
  }

  const lastEventId = Number(req.headers.get("last-event-id")) || 0;
  const encoder = new TextEncoder();
  const channel = runChannel(runId);

  let cleanupRef: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let maxSentId = lastEventId;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const onBusEvent = (e: BusEvent) => send(e.id, e.event);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        bus().off(channel, onBusEvent);
        req.signal.removeEventListener("abort", cleanup);
        try {
          controller.close();
        } catch {
          /* already closed by the runtime */
        }
      };
      cleanupRef = cleanup;

      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };

      const send = (id: number, event: ProgressEvent) => {
        if (closed || id <= maxSentId) return;
        maxSentId = id;
        write(`id: ${id}\ndata: ${JSON.stringify(event)}\n\n`);
        if (TERMINAL.has(event.type)) cleanup();
      };

      // Subscribe, then replay — no await between them, so no gap and no dupes.
      bus().on(channel, onBusEvent);
      write(`: connected ${runId}\n\n`);
      for (const row of getEventsSince(runId, lastEventId)) {
        send(row.id, row.event);
        if (closed) return;
      }

      // Already-terminal run whose replay lacked a terminal event (defensive).
      const current = getRun(runId);
      if (!current || (current.status !== "running" && current.status !== "pending")) {
        cleanup();
        return;
      }

      heartbeat = setInterval(() => write(": hb\n\n"), HEARTBEAT_MS);
      req.signal.addEventListener("abort", cleanup, { once: true });
    },
    cancel() {
      cleanupRef?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
