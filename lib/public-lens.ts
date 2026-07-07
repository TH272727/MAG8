import type { LensRow, RunRow } from "./db";
import type {
  CompiledReport,
  Confidence,
  DiscoveryCandidate,
  LensAnalysis,
  LensCellStatus,
  RankedStock,
  Stage,
  Verdict,
} from "./schemas";

/* ============================================================================
 * Public lens vocabulary — the ONLY lens identifiers that may reach the client.
 *
 * Internal skill ids (stock-scanner, gt-predictor, institutional-forecast,
 * new-gen-stock) stay server-side: in the DB, persisted events, and prompts.
 * lib/public-view.ts translates at the server boundary; everything in this file
 * is client-safe (type-only imports, no runtime server deps).
 * ========================================================================== */

export const PUBLIC_LENSES = ["fundamentals", "macro", "consensus"] as const;
export type PublicLens = (typeof PUBLIC_LENSES)[number];

export const PUBLIC_LENS_META: Record<PublicLens, { label: string; short: string }> = {
  fundamentals: { label: "Fundamentals", short: "SCAN" },
  macro: { label: "Macro Asymmetry", short: "GT" },
  consensus: { label: "Street Consensus", short: "INST" },
};

export const PUBLIC_DISCOVERY = { code: "discovery", label: "Discovery Scout", short: "SCOUT" } as const;

export type PublicCellKey = `${string}:${PublicLens}`;
export const publicCellKey = (ticker: string, lens: PublicLens): PublicCellKey => `${ticker}:${lens}`;

/* ============================================================================
 * Public view-model shapes — what SSE frames, snapshot JSON, and RSC props
 * carry to the browser. Mirrors the internal shapes with `skill` replaced by
 * `lens` and all free-text pre-sanitized by lib/public-view.ts.
 * ========================================================================== */

export type PublicProgressEvent =
  | { type: "stage_start"; stage: Stage; at: string }
  | { type: "discovery_activity"; activity: string; at: string }
  | { type: "discovery_complete"; marketContext: string; candidates: DiscoveryCandidate[]; at: string }
  | {
      type: "lens_status";
      ticker: string;
      lens: PublicLens;
      status: LensCellStatus;
      activity?: string;
      cached?: boolean;
      verdict?: Verdict;
      confidence?: Confidence;
      headline?: string;
      error?: string;
      at: string;
    }
  | { type: "compile_activity"; activity: string; at: string }
  | { type: "run_complete"; report: CompiledReport; totalCostUsd: number | null; at: string }
  | { type: "run_error"; error: string; at: string };

export interface PublicCellSummary {
  ticker: string;
  lens: PublicLens;
  status: "ok" | "error";
  cached: boolean;
  error: string | null;
  verdict?: Verdict;
  confidence?: Confidence;
  headline?: string;
  costUsd: number | null;
}

export interface PublicRunSnapshot {
  run: RunRow;
  candidates: DiscoveryCandidate[];
  cells: PublicCellSummary[];
  rankings: RankedStock[];
  report: CompiledReport | null;
  lastEventId: number;
}

export type PublicLensAnalysis = Omit<LensAnalysis, "skill">;

export interface PublicLensRow extends Omit<LensRow, "skill" | "analysis"> {
  lens: PublicLens;
  analysis: PublicLensAnalysis | null;
}

/* ============================================================================
 * All-time boards — per-ticker best scores aggregated across completed runs,
 * split by run kind: 'canonical' (no focus directive) vs 'focused' (lab runs).
 * Built server-side by lib/public-view.ts toPublicBoard(); all free text
 * (verdict line, focus directive) is pre-sanitized.
 * ========================================================================== */

export interface PublicBoardEntry {
  /** Position on THIS board (not the rank inside the origin run). */
  rank: number;
  ticker: string;
  companyName: string;
  gate: RankedStock["gate"];
  confluence: boolean;
  /** Best final score this ticker ever posted on runs of this kind. */
  finalScore: number;
  verdictLine: string;
  /** Qualifying runs whose leaderboard included this ticker. */
  appearances: number;
  /** When the best-scoring run finished. */
  bestRunAt: string;
  lastSeenAt: string;
  /** Focus directive behind the best score (focused board only). */
  focus?: string;
}

export interface PublicBoard {
  kind: "canonical" | "focused";
  entries: PublicBoardEntry[];
  runCount: number;
  updatedAt: string | null;
  /** Built from demo runs because no real run of this kind exists yet. */
  demo: boolean;
}
