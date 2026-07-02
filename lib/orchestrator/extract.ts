/* ============================================================================
 * Fenced-block fallback parser.
 *
 * The primary handoff is the SDK's native structured output. This module is
 * the pre-built fallback (spec §6): the agent ends its reply with a
 * ```markdown block (full analysis) and a final ```json block (wire payload),
 * and the orchestrator stitches them. Activated only if the smoke test votes
 * native structured outputs down; also used defensively when a success result
 * arrives without structured_output.
 *
 * Limitation (documented): a ```json fence nested inside another fenced block
 * would confuse the lazy matcher — acceptable for a fallback path whose
 * prompts forbid nested fences.
 * ========================================================================== */

const JSON_FENCE = /```json\s*\r?\n([\s\S]*?)```/gi;
const MD_FENCE = /```(?:markdown|md)\s*\r?\n([\s\S]*?)```/i;

/** Parse the LAST ```json fence in the text. Returns undefined if absent/invalid. */
export function extractLastFencedJson(text: string): unknown {
  let last: string | null = null;
  for (const m of text.matchAll(JSON_FENCE)) last = m[1];
  if (last === null) {
    // Degenerate case: the whole message is bare JSON.
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) last = trimmed;
  }
  if (last === null) return undefined;
  try {
    return JSON.parse(last);
  } catch {
    return undefined;
  }
}

/** Extract the FIRST ```markdown fence (the full analysis write-up). */
export function extractFirstFencedMarkdown(text: string): string | null {
  const m = MD_FENCE.exec(text);
  return m ? m[1].trim() : null;
}
