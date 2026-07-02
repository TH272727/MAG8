import { CONFIG } from "../config";
import {
  DISCOVERY_SKILL,
  DiscoveryResultSchema,
  type DiscoveryCandidate,
  type DiscoveryResult,
} from "../schemas";
import { ContractError, runAgentWithContract } from "./agent";
import { discoveryPrompt } from "./prompts";
import { emitProgress, nowIso } from "./progress";

/** Stage 1: run the new-gen-stock scout and normalize its candidate list. */
export async function runDiscovery(
  runId: string,
  count: number,
  signal: AbortSignal,
): Promise<{ discovery: DiscoveryResult; costUsd: number }> {
  const { data, costUsd } = await runAgentWithContract(DiscoveryResultSchema, {
    prompt: discoveryPrompt(count),
    model: CONFIG.models.discovery,
    // Read included so the skill's own "read references/" instruction degrades
    // gracefully (the archive shipped without them); no Bash for discovery.
    allowedTools: ["WebSearch", "WebFetch", "Read"],
    skills: [DISCOVERY_SKILL],
    maxTurns: CONFIG.maxTurns.discovery,
    timeoutMs: CONFIG.timeoutsMs.discovery,
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

  return { discovery: { marketContext: data.marketContext, candidates }, costUsd };
}
