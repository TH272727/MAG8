import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { extractLastFencedJson } from "./extract";
import { toActivity } from "./progress";

/* ============================================================================
 * runAgentWithContract — the one place Mag8 talks to the Agent SDK.
 *
 * - Native structured outputs (outputFormat: json_schema) are the primary
 *   handoff; zod re-validates anyway (never trust unparsed).
 * - On zod failure: ONE corrective retry that resumes the same session with a
 *   prettified error report. Second failure → ContractError; the run decides
 *   whether that is cell-fatal or run-fatal.
 * - Per-call timeout + optional outer (run-watchdog) signal, combined into the
 *   SDK's AbortController.
 * ========================================================================== */

export class ContractError extends Error {
  constructor(message: string, public readonly detail?: string) {
    super(message);
    this.name = "ContractError";
  }
}

export class AgentTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentTimeoutError";
  }
}

export interface AgentCallOptions {
  prompt: string;
  model: string;
  /** Tool allowlist. The `skills` option auto-enables the Skill tool — do not list it here. */
  allowedTools: string[];
  /** Per-call skill scoping (context filter): exactly the skills this agent may see. */
  skills?: string[];
  maxTurns: number;
  timeoutMs: number;
  /** Run-level watchdog signal. */
  signal?: AbortSignal;
  onActivity?: (activity: string) => void;
  /** Short name for error messages, e.g. "lens:ASTS:stock-scanner". */
  label: string;
}

export interface AgentCallResult<T> {
  data: T;
  costUsd: number;
  numTurns: number;
  sessionId: string | null;
}

interface AttemptOutcome {
  raw: unknown;
  costUsd: number;
  numTurns: number;
}

export async function runAgentWithContract<S extends z.ZodType>(
  schema: S,
  opts: AgentCallOptions,
): Promise<AgentCallResult<z.infer<S>>> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  let sessionId: string | null = null;

  const attempt = async (prompt: string, resume?: string): Promise<AttemptOutcome> => {
    const ac = new AbortController();
    const timer = setTimeout(
      () => ac.abort(new AgentTimeoutError(`${opts.label}: timed out after ${Math.round(opts.timeoutMs / 1000)}s`)),
      opts.timeoutMs,
    );
    const onOuterAbort = () =>
      ac.abort(opts.signal?.reason ?? new AgentTimeoutError(`${opts.label}: aborted by run watchdog`));
    if (opts.signal?.aborted) onOuterAbort();
    else opts.signal?.addEventListener("abort", onOuterAbort, { once: true });

    let raw: unknown;
    let costUsd = 0;
    let numTurns = 0;
    let resultSeen = false;
    let errorSubtype: string | null = null;

    try {
      const stream = query({
        prompt,
        options: {
          cwd: process.cwd(),
          settingSources: ["project"],
          permissionMode: "bypassPermissions",
          allowDangerouslySkipPermissions: true,
          model: opts.model,
          allowedTools: opts.allowedTools,
          ...(opts.skills ? { skills: opts.skills } : {}),
          maxTurns: opts.maxTurns,
          abortController: ac,
          outputFormat: { type: "json_schema", schema: jsonSchema },
          ...(resume ? { resume } : {}),
        } as Options,
      });

      for await (const message of stream) {
        // Shapes verified against sdk.d.ts@0.3.198; access defensively anyway.
        const m = message as unknown as Record<string, unknown>;
        if (typeof m.session_id === "string") sessionId = m.session_id;

        if (m.type === "assistant") {
          const inner = m.message as { content?: unknown } | undefined;
          const content = inner?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              const b = block as { type?: string; name?: string; input?: Record<string, unknown> };
              if (b?.type === "tool_use" && typeof b.name === "string") {
                const activity = toActivity(b.name, b.input ?? {});
                if (activity) opts.onActivity?.(activity);
              }
            }
          }
        } else if (m.type === "result") {
          resultSeen = true;
          costUsd = typeof m.total_cost_usd === "number" ? m.total_cost_usd : 0;
          numTurns = typeof m.num_turns === "number" ? m.num_turns : 0;
          if (m.subtype === "success") {
            raw =
              m.structured_output !== undefined
                ? m.structured_output
                : typeof m.result === "string"
                  ? extractLastFencedJson(m.result)
                  : undefined;
          } else {
            const errors = Array.isArray(m.errors) ? (m.errors as string[]).join("; ") : "";
            errorSubtype = `${String(m.subtype)}${errors ? `: ${errors}` : ""}`;
          }
        }
      }
    } catch (err) {
      if (ac.signal.aborted) {
        const reason = ac.signal.reason;
        throw reason instanceof Error ? reason : new AgentTimeoutError(`${opts.label}: aborted`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onOuterAbort);
    }

    if (ac.signal.aborted) {
      const reason = ac.signal.reason;
      throw reason instanceof Error ? reason : new AgentTimeoutError(`${opts.label}: aborted`);
    }
    if (!resultSeen) throw new ContractError(`${opts.label}: SDK stream ended without a result message`);
    if (errorSubtype) throw new ContractError(`${opts.label}: agent ended without structured output (${errorSubtype})`);
    return { raw, costUsd, numTurns };
  };

  let totalCost = 0;

  const first = await attempt(opts.prompt);
  totalCost += first.costUsd;
  const parsed1 = schema.safeParse(first.raw);
  if (parsed1.success) {
    return { data: parsed1.data, costUsd: totalCost, numTurns: first.numTurns, sessionId };
  }

  // One corrective retry, resuming the session so research is not repeated.
  const problems = z.prettifyError(parsed1.error);
  opts.onActivity?.("Output failed validation — requesting a corrected result");
  const retryPrompt = `Your previous structured output failed validation against the required schema:

${problems}

Return a corrected result that satisfies the schema exactly. Do not redo the research — fix the structure/values of the output only.`;

  const second = await attempt(retryPrompt, sessionId ?? undefined);
  totalCost += second.costUsd;
  const parsed2 = schema.safeParse(second.raw);
  if (parsed2.success) {
    return { data: parsed2.data, costUsd: totalCost, numTurns: first.numTurns + second.numTurns, sessionId };
  }

  throw new ContractError(
    `${opts.label}: output failed schema validation after a corrective retry`,
    z.prettifyError(parsed2.error),
  );
}
