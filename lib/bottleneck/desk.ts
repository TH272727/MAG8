import { bottleneckSettings } from "../bottleneck-settings";
import { getSupplySeries, listBottleneckSnapshots, saveBottleneckSnapshot, type SupplyPoint } from "../db";
import { buildDemandSnapshot, latestDemand, type DemandSnapshot } from "./demand";
import type { Playbook } from "./playbook";
import { scoreBottlenecks, type BottleneckSnapshot } from "./score";
import { refreshSupply, type SeriesRefresh } from "./supply";

/* ============================================================================
 * The desk's orchestration: demand, then supply, then the score.
 *
 * Everything expensive is a fetch and everything decisive is a pure function,
 * so the ranking can always be recomputed from stored data without touching the
 * network — which is what makes a published number reproducible after the fact.
 * ========================================================================== */

export interface DeskRefreshResult {
  demand: DemandSnapshot;
  supply: SeriesRefresh[];
  bottleneck: BottleneckSnapshot;
}

export interface DeskRefreshOptions {
  /** Reuse the stored demand snapshot instead of re-reading filings. */
  reuseDemand?: boolean;
  /** Skip persistence. */
  dryRun?: boolean;
  timeoutMs?: number;
}

/**
 * Full refresh for one playbook: read capital spending, pull every supply
 * series, score the gaps, persist both snapshots.
 *
 * The previous bottleneck snapshot is loaded BEFORE the new one is written, so
 * the tightening/easing comparison is against the genuine prior reading.
 */
export async function refreshDesk(pb: Playbook, opts: DeskRefreshOptions = {}): Promise<DeskRefreshResult> {
  const settings = bottleneckSettings();
  const timeoutMs = opts.timeoutMs ?? settings.edgarTimeoutMs;

  const stored = opts.reuseDemand ? latestDemand(pb.id) : null;
  const demand = stored?.snapshot ?? (await buildDemandSnapshot(pb, { timeoutMs, dryRun: opts.dryRun }));

  const supply = await refreshSupply(pb, { timeoutMs });

  const previous = priorReading(pb.id, demand.takenAt);
  const bottleneck = scoreBottlenecks({
    playbook: pb,
    demand,
    seriesPoints: loadSeriesPoints(pb),
    settings,
    previous,
  });

  if (!opts.dryRun) saveBottleneckSnapshot("bottleneck", pb.id, bottleneck);
  return { demand, supply, bottleneck };
}

/** Stored observations for every series a playbook declares. */
export function loadSeriesPoints(pb: Playbook): Record<string, SupplyPoint[]> {
  const out: Record<string, SupplyPoint[]> = {};
  for (const s of pb.supply) out[s.seriesId] = getSupplySeries(s.seriesId);
  return out;
}

/**
 * Recompute the ranking from stored data alone — no network. Used by the desk
 * page so a settings change applies immediately, exactly as the universe screen
 * recomputes its funnel on read.
 */
export function scoreFromStored(pb: Playbook): { snapshot: BottleneckSnapshot; demandTakenAt: string } | null {
  const demand = latestDemand(pb.id);
  if (!demand) return null;
  return {
    snapshot: scoreBottlenecks({
      playbook: pb,
      demand: demand.snapshot,
      seriesPoints: loadSeriesPoints(pb),
      settings: bottleneckSettings(),
      previous: priorReading(pb.id, demand.snapshot.takenAt),
    }),
    demandTakenAt: demand.takenAt,
  };
}

/**
 * The most recent stored score built on a DIFFERENT demand reading.
 *
 * A refresh writes its own snapshot, so simply taking the latest stored one
 * would compare a reading against itself and report every constraint as
 * unchanged. A genuine prior reading is one whose underlying demand differs.
 */
export function priorReading(playbookId: string, currentDemandTakenAt: string): BottleneckSnapshot | null {
  const rows = listBottleneckSnapshots<BottleneckSnapshot>("bottleneck", playbookId, PRIOR_LOOKBACK);
  return rows.find((r) => r.payload.demandTakenAt !== currentDemandTakenAt)?.payload ?? null;
}

/** How far back to look for a reading based on different data. */
const PRIOR_LOOKBACK = 12;
