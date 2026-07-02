import { z } from "zod";

/* ============================================================================
 * Skill registry
 * ========================================================================== */

/** Frontmatter `name:` values — must match .claude/skills/<dir>/SKILL.md verbatim. */
export const DISCOVERY_SKILL = "new-gen-stock" as const;
export const LENS_SKILLS = [
  "stock-scanner",
  "gt-predictor",
  "institutional-forecast",
] as const;

export type LensSkill = (typeof LENS_SKILLS)[number];
export const LensSkillSchema = z.enum(LENS_SKILLS);

/** UI-facing metadata for the four threads. Colors live in the design tokens. */
export const LENS_META: Record<
  LensSkill,
  { label: string; short: string; accent: "fundamentals" | "macro" | "consensus" }
> = {
  "stock-scanner": { label: "Fundamentals", short: "SCAN", accent: "fundamentals" },
  "gt-predictor": { label: "Macro Asymmetry", short: "GT", accent: "macro" },
  "institutional-forecast": { label: "Street Consensus", short: "INST", accent: "consensus" },
};
export const DISCOVERY_META = { label: "Discovery Scout", short: "SCOUT", accent: "discovery" as const };

export type CellKey = `${string}:${LensSkill}`;
export const cellKey = (ticker: string, skill: LensSkill): CellKey => `${ticker}:${skill}`;

/* ============================================================================
 * Stage 1 — Discovery (new-gen-stock)
 * ========================================================================== */

export const DiscoveryCandidateSchema = z.object({
  ticker: z
    .string()
    .min(1)
    .max(8)
    .describe("US-listed ticker symbol, uppercase, no exchange prefix"),
  companyName: z.string().min(1),
  sector: z.string().min(1).describe("Short sector / secular-wave label"),
  thesis: z
    .string()
    .min(1)
    .describe("2-4 sentence discovery thesis: why this could be a next-generation mega-cap"),
  matchedTraits: z
    .array(z.string().min(1))
    .min(1)
    .describe("Pre-scale mega-cap DNA traits this company matches"),
});
export type DiscoveryCandidate = z.infer<typeof DiscoveryCandidateSchema>;

export const DiscoveryResultSchema = z.object({
  marketContext: z
    .string()
    .min(1)
    .describe("Brief summary of the secular waves and market context behind this scan"),
  candidates: z.array(DiscoveryCandidateSchema).min(1).max(12),
});
export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;

/* ============================================================================
 * Stage 2 — Lens analyses
 * ========================================================================== */

export const VerdictSchema = z
  .enum(["bullish", "neutral", "bearish"])
  .describe("Overall lean of THIS lens for the ticker");
export type Verdict = z.infer<typeof VerdictSchema>;

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** stock-scanner keyMetrics — mirrors the skill's own labels. */
export const ScannerMetricsSchema = z.object({
  piotroskiF: z.number().min(0).max(9).nullable().describe("Piotroski F-Score, 0-9; null if not computable"),
  altmanZ: z.number().nullable().describe("Altman Z-Score; null if not meaningful"),
  altmanZone: z.enum(["safe", "grey", "distress", "not-meaningful"]),
  reverseDcfVerdict: z.string().describe("Plain-language read: implied bar too low / about right / too high"),
  rewardRisk: z.string().describe("Probability-weighted reward/risk, e.g. '2.8 : 1'"),
  composite: z.number().nullable().describe("The skill's composite score across its scoring dimensions"),
  scannerVerdict: z.enum(["Buy", "Watchlist", "Pass"]).describe("The skill's own post-veto verdict"),
  valueTrap: z.boolean().describe("True if the skill flags this as a probable value trap"),
});
export type ScannerMetrics = z.infer<typeof ScannerMetricsSchema>;

/** gt-predictor keyMetrics. */
export const GtMetricsSchema = z.object({
  asymmetryScore: z.number().min(1).max(10).describe("1 = fully priced in, 10 = maximum mispricing"),
  entryWindow: z.string().describe("The skill's entry-window read for the highest-conviction implication"),
  baseRate: z.string().describe("Outside-view base rate the forecast anchored on"),
  adjustedProbability: z.string().describe("Base rate → adjusted probability for the primary outcome"),
  gapVsMarket: z.string().describe("Where the GT read differs from current market pricing"),
});
export type GtMetrics = z.infer<typeof GtMetricsSchema>;

/** institutional-forecast keyMetrics (DEEP mode Consensus Dashboard). */
export const ForecastMetricsSchema = z.object({
  currentPrice: z.number().nullable().describe("Spot price at retrieval, USD"),
  consensusTarget: z.number().nullable().describe("Descriptive average of verified targets, USD"),
  consensusTargetLow: z.number().nullable(),
  consensusTargetHigh: z.number().nullable(),
  impliedUpsidePct: z.number().nullable().describe("Consensus target vs spot, percent"),
  stance: z.string().describe("Strongly Bullish / Bullish / Mixed / Bearish / Strongly Bearish"),
  bankCount: z.number().nullable().describe("How many of the 8 primary institutions were verified"),
  spread: z.string().describe("Tight / Moderate / Wide"),
  freshness: z.string().describe("e.g. '4 fresh · 1 aging · 1 stale'"),
});
export type ForecastMetrics = z.infer<typeof ForecastMetricsSchema>;

const LensWireBase = z.object({
  verdict: VerdictSchema,
  confidence: ConfidenceSchema,
  summary: z
    .string()
    .min(1)
    .describe("4-8 sentence plain-language summary of this lens's findings"),
  riskFlags: z
    .array(z.string())
    .describe("Key risks / falsification conditions surfaced by this lens"),
  fullAnalysisMarkdown: z
    .string()
    .min(1)
    .describe("The complete analysis write-up in markdown, following the skill's own output format"),
});

export const ScannerWireSchema = LensWireBase.extend({ keyMetrics: ScannerMetricsSchema });
export const GtWireSchema = LensWireBase.extend({ keyMetrics: GtMetricsSchema });
export const ForecastWireSchema = LensWireBase.extend({ keyMetrics: ForecastMetricsSchema });

export type LensWire = z.infer<typeof ScannerWireSchema> | z.infer<typeof GtWireSchema> | z.infer<typeof ForecastWireSchema>;

/** Structured-output schema for one lens call (native handoff path). */
export function lensWireSchema(skill: LensSkill) {
  switch (skill) {
    case "stock-scanner":
      return ScannerWireSchema;
    case "gt-predictor":
      return GtWireSchema;
    case "institutional-forecast":
      return ForecastWireSchema;
  }
}

/** Fallback handoff path: fenced ```json block minus the markdown (stitched from a ```markdown block). */
export function lensWireNoMarkdownSchema(skill: LensSkill) {
  return lensWireSchema(skill).omit({ fullAnalysisMarkdown: true });
}

const MetricValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type MetricValue = z.infer<typeof MetricValueSchema>;

/** Persisted lens analysis (payload_json + full_markdown column). */
export const LensAnalysisSchema = z.object({
  ticker: z.string().min(1),
  skill: LensSkillSchema,
  verdict: VerdictSchema,
  confidence: ConfidenceSchema,
  summary: z.string().min(1),
  keyMetrics: z.record(z.string(), MetricValueSchema),
  riskFlags: z.array(z.string()),
  fullAnalysisMarkdown: z.string(),
});
export type LensAnalysis = z.infer<typeof LensAnalysisSchema>;

/** Short data-chip line for a completed cell, e.g. "F 7 · Z 4.1 · Buy". */
export function lensHeadline(skill: LensSkill, km: Record<string, MetricValue>): string {
  const num = (v: MetricValue) => (typeof v === "number" ? String(Math.round(v * 10) / 10) : "–");
  switch (skill) {
    case "stock-scanner":
      return `F ${num(km.piotroskiF)} · Z ${num(km.altmanZ)} · ${typeof km.scannerVerdict === "string" ? km.scannerVerdict : "–"}`;
    case "gt-predictor":
      return `Asymmetry ${num(km.asymmetryScore)}/10`;
    case "institutional-forecast": {
      const up = km.impliedUpsidePct;
      if (typeof up === "number") {
        const r = Math.round(up * 10) / 10;
        return `${r >= 0 ? "+" : ""}${r}% vs consensus`;
      }
      return typeof km.stance === "string" ? km.stance : "consensus read";
    }
  }
}

/* ============================================================================
 * Stage 3 — Compiled report
 * ========================================================================== */

export const GateSchema = z.enum(["pass", "caution", "fail"]);
export type Gate = z.infer<typeof GateSchema>;

export const SubScoresSchema = z.object({
  fundamentals: z.number().min(0).max(100),
  discoveryThesis: z.number().min(0).max(100),
  gtAsymmetry: z.number().min(0).max(100),
  institutionalGap: z.number().min(0).max(100),
});
export type SubScores = z.infer<typeof SubScoresSchema>;

export const RankedStockWireSchema = z.object({
  ticker: z.string().min(1),
  companyName: z.string().min(1),
  gate: GateSchema.describe("Fundamentals gate derived from stock-scanner's own labels"),
  gateReason: z.string().min(1),
  scores: SubScoresSchema,
  confluence: z.boolean().describe("True when all three lenses independently lean bullish"),
  finalScore: z.number().min(0).max(100),
  verdictLine: z.string().min(1).describe("One-line leaderboard verdict"),
  groundingNotes: z
    .string()
    .min(1)
    .describe("Narrates the gate + score arithmetic and the evidence behind each sub-score"),
  riskFlags: z.array(z.string()),
});
export type RankedStockWire = z.infer<typeof RankedStockWireSchema>;

export const RankedStockSchema = RankedStockWireSchema.extend({
  rank: z.number().int().min(1),
});
export type RankedStock = z.infer<typeof RankedStockSchema>;

export const CompilerWireSchema = z.object({
  marketOverview: z.string().min(1),
  methodologyNote: z.string().min(1),
  gapsNoted: z
    .array(z.string())
    .describe("Missing/errored lens cells and any other data gaps that shaped the ranking"),
  rankings: z.array(RankedStockWireSchema).min(1).max(12),
});
export type CompilerWire = z.infer<typeof CompilerWireSchema>;

export const CompiledReportSchema = z.object({
  runId: z.string(),
  generatedAt: z.string(),
  marketOverview: z.string(),
  methodologyNote: z.string(),
  gapsNoted: z.array(z.string()),
  rankings: z.array(RankedStockSchema),
});
export type CompiledReport = z.infer<typeof CompiledReportSchema>;

/* ============================================================================
 * Run params
 * ========================================================================== */

export const RunParamsSchema = z.object({
  count: z.number().int().min(4).max(12).default(8),
  force: z.boolean().default(false),
  mock: z.boolean().default(false),
});
export type RunParams = z.infer<typeof RunParamsSchema>;

/* ============================================================================
 * Progress events (SSE payloads; persisted in progress_events)
 * ========================================================================== */

export const StageSchema = z.enum(["discovery", "analysis", "compile"]);
export type Stage = z.infer<typeof StageSchema>;

export const LensCellStatusSchema = z.enum(["queued", "running", "done", "error"]);
export type LensCellStatus = z.infer<typeof LensCellStatusSchema>;

export const ProgressEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("stage_start"),
    stage: StageSchema,
    at: z.string(),
  }),
  // Additive extension vs the spec's union: Stage-1 live feed for Mission Control.
  z.object({
    type: z.literal("discovery_activity"),
    activity: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("discovery_complete"),
    marketContext: z.string(),
    candidates: z.array(DiscoveryCandidateSchema),
    at: z.string(),
  }),
  z.object({
    type: z.literal("lens_status"),
    ticker: z.string(),
    skill: LensSkillSchema,
    status: LensCellStatusSchema,
    activity: z.string().optional(),
    // Additive extension: cache hits render as instant "done · cached" chips.
    cached: z.boolean().optional(),
    verdict: VerdictSchema.optional(),
    confidence: ConfidenceSchema.optional(),
    headline: z.string().optional(),
    error: z.string().optional(),
    at: z.string(),
  }),
  // Additive extension: the compiler has no tools, so it narrates synthetic progress.
  z.object({
    type: z.literal("compile_activity"),
    activity: z.string(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("run_complete"),
    report: CompiledReportSchema,
    totalCostUsd: z.number().nullable(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("run_error"),
    error: z.string(),
    at: z.string(),
  }),
]);
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;

export type LensStatusEvent = Extract<ProgressEvent, { type: "lens_status" }>;
