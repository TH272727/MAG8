import { CONFIG } from "../config";
import type { CoverageEntry } from "../db";
import type { UniversePool } from "../universe";
import type { UniverseSettings } from "../universe-settings";
import {
  DISCOVERY_SKILL,
  DiscoveryResultSchema,
  type DiscoveryCandidate,
  type DiscoveryResult,
} from "../schemas";
import { ContractError, runAgentWithContract } from "./agent";
import { discoveryPrompt, runDateLine } from "./prompts";
import { emitProgress, nowIso } from "./progress";
import { applySelectionQuota, selectionQuotaFrom } from "./selection";

/** Stage 1: run the new-gen-stock scout and normalize its candidate list. */
export async function runDiscovery(
  runId: string,
  count: number,
  signal: AbortSignal,
  ctx: { coverage: CoverageEntry[]; modifier?: string; pool?: UniversePool; settings?: UniverseSettings },
): Promise<{ discovery: DiscoveryResult; costUsd: number; selectionFlags: string[] }> {
  const quota = selectionQuotaFrom(ctx.settings, count);
  const { data, costUsd } = await runAgentWithContract(DiscoveryResultSchema, {
    prompt: discoveryPrompt(count, {
      dateLine: runDateLine(),
      coverage: ctx.coverage,
      modifier: ctx.modifier,
      pool: ctx.pool,
      quota,
    }),
    model: CONFIG.models.discovery,
    // Read included so the skill's own "read references/" instruction degrades
    // gracefully (the archive shipped without them); no Bash for discovery.
    allowedTools: ["WebSearch", "WebFetch", "Read"],
    skills: [DISCOVERY_SKILL],
    maxTurns: CONFIG.maxTurns.discovery,
    timeoutMs: CONFIG.timeoutsMs.discovery,
    effort: CONFIG.effort.discovery,
    thinking: CONFIG.thinking.discovery,
    maxBudgetUsd: CONFIG.maxBudgetUsd.discovery,
    signal,
    label: "discovery",
    onActivity: (activity) => emitProgress(runId, { type: "discovery_activity", activity, at: nowIso() }),
  });

  const seen = new Set<string>();
  const candidates: DiscoveryCandidate[] = [];
  for (const c of data.candidates) {
    const ticker = c.ticker.trim().toUpperCase();
    if (!ticker || seen.has(ticker)) continue;
    seen.add(ticker);
    candidates.push({ ...c, ticker });
    if (candidates.length >= count) break;
  }
  if (candidates.length === 0) {
    throw new ContractError("discovery: no usable candidates after normalization");
  }

  // Selection discipline: verify (and, under the hard gate, correct) the cohort
  // against the ranked-head floor and the consensus ceiling. Off by default —
  // a no-op unless the owner has set a floor or a ceiling.
  const selection = applySelectionQuota(candidates, ctx.pool, quota);
  if (selection.activity) {
    emitProgress(runId, { type: "discovery_activity", activity: selection.activity, at: nowIso() });
  }

  return {
    discovery: { marketContext: data.marketContext, candidates: selection.candidates },
    costUsd,
    selectionFlags: selection.flags,
  };
}
