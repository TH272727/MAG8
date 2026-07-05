import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { extractJsonLoose, stripTrailingJsonFence } from "./extract";
import { toActivity } from "./progress";

/* ============================================================================
 * runAgentWithContract — the one place Mag8 talks to the Agent SDK.
 *
 * Handoff reality (verified against CLI 2.1.198 transcripts): `outputFormat:
 * json_schema` is ADVISORY — the CLI nudges the model and fails open, so
 * `structured_output` on the result is a bonus, not a guarantee. The pinned
 * contract is the trailing ```json fence in the final message:
 * - prefer result.structured_output when present; otherwise salvage-parse the
 *   final text (extractJsonLoose); if native output fails zod, salvage the
 *   text before giving up on the attempt.
 * - zod re-validates everything (never trust unparsed).
 * - On failure: ONE corrective retry that resumes the same session carrying
 *   the ACTUAL zod issues plus the JSON schema verbatim (a retry that only
 *   says "invalid input" makes the model guess — observed guessing wrong).
 * - The narrative half (fullAnalysisMarkdown) is the final message minus the
 *   fence — taken from whichever attempt wrote the longer report.
 * - Per-call timeout + optional outer (run-watchdog) signal, combined into
 *   the SDK's AbortController. ContractError carries detail + costUsd so
 *   callers can persist WHY and WHAT IT COST.
 * ========================================================================== */

export class ContractError extends Error {
  constructor(
    message: string,
    public readonly detail?: string,
    public readonly costUsd: number = 0,
  ) {
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

/** Harness tools that only distract a headless research agent (permissions are bypassed, so allowedTools alone does not scope). */
const DISALLOWED_TOOLS = [
  "ToolSearch",
  "ReportFindings",
  "ScheduleWakeup",
  "AskUserQuestion",
  "Artifact",
  "EnterPlanMode",
  "ExitPlanMode",
];

export interface AgentCallOptions {
  prompt: string;
  model: string;
  /** Tool allowlist. The `skills` option auto-enables the Skill tool — do not list it here. */
  allowedTools: string[];
  /** Per-call skill scoping (context filter): exactly the skills this agent may see. */
  skills?: string[];
  maxTurns: number;
  timeoutMs: number;
  /** Reasoning effort (SDK default "high"); the main usage-window lever. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Thinking override; unset → SDK default. */
  thinking?: "adaptive" | "disabled";
  /** Hard USD cap for this call; breach ends the query with error_max_budget_usd. */
  maxBudgetUsd?: number;
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
  /** Which handoff produced the validated data. */
  via: "native" | "fenced";
  /** Final message minus the wire fence — the markdown analysis, if the agent wrote one. */
  narrativeText: string;
}

interface AttemptOutcome {
  raw: unknown;
  via: "native" | "fenced";
  text: string;
  costUsd: number;
  numTurns: number;
}

function valueAt(root: unknown, path: PropertyKey[]): unknown {
  let v = root;
  for (const k of path) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<PropertyKey, unknown>)[k];
  }
  return v;
}

/** Human-actionable report of what failed validation — fed back to the model and persisted on error cells. */
function issueReport(raw: unknown, error: z.ZodError): string {
  if (raw === undefined) {
    return "Your final message contained no parseable JSON at all — no valid ```json fenced block was found.";
  }
  const lines = error.issues.slice(0, 12).map((iss) => {
    const p = iss.path.length ? iss.path.join(".") : "(root)";
    const v = valueAt(raw, iss.path as PropertyKey[]);
    const received = v === undefined ? "missing" : (JSON.stringify(v) ?? String(v)).slice(0, 100);
    return `- ${p}: ${iss.message} (received: ${received})`;
  });
  const extra = error.issues.length > 12 ? `\n…and ${error.issues.length - 12} more issues.` : "";
  return `These fields failed validation:\n${lines.join("\n")}${extra}`;
}

export async function runAgentWithContract<S extends z.ZodType>(
  schema: S,
  opts: AgentCallOptions,
): Promise<AgentCallResult<z.infer<S>>> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  let sessionId: string | null = null;
  let totalCost = 0;

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
    let via: "native" | "fenced" = "fenced";
    let text = "";
    let attemptCost = 0;
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
          disallowedTools: DISALLOWED_TOOLS,
          // Never load the machine's user-level / claude.ai MCP connectors into
          // research sessions — they bloat context and distract the agent.
          strictMcpConfig: true,
          ...(opts.skills ? { skills: opts.skills } : {}),
          maxTurns: opts.maxTurns,
          ...(opts.effort ? { effort: opts.effort } : {}),
          ...(opts.thinking ? { thinking: { type: opts.thinking } } : {}),
          ...(opts.maxBudgetUsd ? { maxBudgetUsd: opts.maxBudgetUsd } : {}),
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
          attemptCost = typeof m.total_cost_usd === "number" ? m.total_cost_usd : 0;
          numTurns = typeof m.num_turns === "number" ? m.num_turns : 0;
          if (m.subtype === "success") {
            text = typeof m.result === "string" ? m.result : "";
            if (m.structured_output !== undefined) {
              raw = m.structured_output;
              via = "native";
            } else {
              raw = extractJsonLoose(text);
            }
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

    totalCost += attemptCost;
    if (ac.signal.aborted) {
      const reason = ac.signal.reason;
      throw reason instanceof Error ? reason : new AgentTimeoutError(`${opts.label}: aborted`);
    }
    if (!resultSeen) throw new ContractError(`${opts.label}: SDK stream ended without a result message`, undefined, totalCost);
    if (errorSubtype) {
      throw new ContractError(`${opts.label}: agent ended without a usable result (${errorSubtype})`, undefined, totalCost);
    }
    return { raw, via, text, costUsd: attemptCost, numTurns };
  };

  type Validated =
    | { ok: true; data: z.infer<S>; via: "native" | "fenced" }
    | { ok: false; error: z.ZodError; raw: unknown; via: "native" | "fenced" };

  /** Validate an attempt; when native output fails zod, give the fenced text a chance before failing the attempt. */
  const validate = (a: AttemptOutcome): Validated => {
    const parsed = schema.safeParse(a.raw);
    if (parsed.success) return { ok: true, data: parsed.data as z.infer<S>, via: a.via };
    if (a.via === "native") {
      const salvage = extractJsonLoose(a.text);
      if (salvage !== undefined) {
        const p2 = schema.safeParse(salvage);
        if (p2.success) return { ok: true, data: p2.data as z.infer<S>, via: "fenced" };
      }
    }
    return { ok: false, error: parsed.error, raw: a.raw, via: a.via };
  };

  const first = await attempt(opts.prompt);
  const v1 = validate(first);
  if (v1.ok) {
    return {
      data: v1.data,
      costUsd: totalCost,
      numTurns: first.numTurns,
      sessionId,
      via: v1.via,
      narrativeText: stripTrailingJsonFence(first.text),
    };
  }

  // One corrective retry, resuming the session so research is not repeated —
  // carrying the actual issues and the schema so the model doesn't guess.
  opts.onActivity?.("Output failed validation — requesting a corrected result");
  const retryPrompt = `Your previous structured output failed validation against the required schema.

${issueReport(v1.raw, v1.error)}

The required JSON schema is:
\`\`\`json
${JSON.stringify(jsonSchema)}
\`\`\`

Reply with ONLY one \`\`\`json fenced code block containing the complete corrected object — no prose before or after it. Strict JSON: double-quoted strings, bare numbers, no comments of any kind, no trailing commas, enum values with exact casing. Do not redo the research — fix the structure/values of the output only.`;

  const second = await attempt(retryPrompt, sessionId ?? undefined);
  const v2 = validate(second);
  if (v2.ok) {
    const narrative1 = stripTrailingJsonFence(first.text);
    const narrative2 = stripTrailingJsonFence(second.text);
    return {
      data: v2.data,
      costUsd: totalCost,
      numTurns: first.numTurns + second.numTurns,
      sessionId,
      via: v2.via,
      narrativeText: narrative1.length >= narrative2.length ? narrative1 : narrative2,
    };
  }

  throw new ContractError(
    `${opts.label}: output failed schema validation after a corrective retry`,
    issueReport(v2.raw, v2.error),
    totalCost,
  );
}
