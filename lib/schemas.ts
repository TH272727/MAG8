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
  "gt-predictor": { label: "Game Theory", short: "GT", accent: "macro" },
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

/* ----------------------------------------------------------------------------
 * Wire tolerance helpers. Real-run transcripts (2026-07-03) showed models
 * drifting on exactly these shapes: enum casing/synonyms, numeric confidence
 * ("0.6"), numbers-as-strings ("4"), and "N/A" in nullable numerics. The
 * preprocess layer normalizes; z.toJSONSchema serializes the clean OUTPUT
 * side, so the schema shown to agents stays canonical.
 * -------------------------------------------------------------------------- */

/** Case-insensitive enum with an alias map; canonical casing survives. */
function ciEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  aliases: Record<string, T[number]> = {},
) {
  return z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const k = v.trim().toLowerCase();
    return values.find((x) => x.toLowerCase() === k) ?? aliases[k] ?? v;
  }, z.enum(values));
}

const NUMERIC_STRING = /^-?\d+(\.\d+)?$/;
const numberish = (v: unknown): unknown =>
  typeof v === "string" && NUMERIC_STRING.test(v.trim()) ? Number(v.trim()) : v;
const NULLISH_STRINGS = new Set(["null", "n/a", "na", "none", "unknown", "not available", "-", "—"]);
const nullish = (v: unknown): unknown =>
  typeof v === "string" && NULLISH_STRINGS.has(v.trim().toLowerCase()) ? null : v;

/** Number that tolerates numeric strings ("8.5"). */
const looseNumber = (inner: z.ZodNumber) => z.preprocess(numberish, inner);
/** Nullable number that also maps "N/A"-style placeholders to null. */
const looseNullableNumber = (inner: z.ZodNumber) =>
  z.preprocess((v) => nullish(numberish(v)), inner.nullable());
/** Boolean that tolerates "true"/"yes" strings. */
const looseBoolean = () =>
  z.preprocess((v) => {
    if (typeof v !== "string") return v;
    const k = v.trim().toLowerCase();
    return k === "true" || k === "yes" ? true : k === "false" || k === "no" ? false : v;
  }, z.boolean());

export const VerdictSchema = ciEnum(["bullish", "neutral", "bearish"]).describe(
  "Overall lean of THIS lens for the ticker",
);
export type Verdict = z.infer<typeof VerdictSchema>;

/** Accepts the canonical strings, common synonyms, and numeric confidences (0–1, 1–10, or percent). */
export const ConfidenceSchema = z.preprocess((v) => {
  const n = typeof v === "number" ? v : typeof v === "string" && NUMERIC_STRING.test(v.trim()) ? Number(v.trim()) : null;
  if (n !== null && Number.isFinite(n) && n >= 0) {
    const scaled = n > 10 ? n / 100 : n > 1 ? n / 10 : n;
    return scaled >= 0.7 ? "high" : scaled >= 0.4 ? "medium" : "low";
  }
  if (typeof v === "string") {
    const k = v.trim().toLowerCase();
    if (k === "low" || k === "medium" || k === "high") return k;
    const aliases: Record<string, string> = { moderate: "medium", med: "medium", mid: "medium", "very high": "high", "very low": "low" };
    if (aliases[k]) return aliases[k];
  }
  return v;
}, z.enum(["low", "medium", "high"]));
export type Confidence = z.infer<typeof ConfidenceSchema>;

/* ----------------------------------------------------------------------------
 * Optional structured extensions (2026-07-05, visual data layer). Every field
 * below is retry-proof by construction: .optional().catch(undefined) means a
 * malformed value is DROPPED, never a zod failure, never a corrective retry.
 * Arrays are slice-capped in preprocess (never .max() rejection).
 * -------------------------------------------------------------------------- */

/** Probability as 0–100 percent; tolerates 0–1 fractions (0.35 → 35) and "N/A". */
const loosePercent = z.preprocess((v) => {
  const n = nullish(numberish(v));
  if (typeof n === "number" && Number.isFinite(n) && n > 0 && n < 1) return n * 100;
  return n;
}, z.number().min(0).max(100).nullable());

const capArray = (max: number) => (v: unknown) => (Array.isArray(v) ? v.slice(0, max) : v);

const GtPlayerSchema = z.object({
  name: z.string().min(1),
  role: z.string().optional().catch(undefined),
  m: looseNumber(z.number().min(0).max(10)).describe("Mass 1-10"),
  e: looseNumber(z.number().min(0).max(10)).describe("Energy 1-10"),
  c: looseNumber(z.number().min(0).max(10)).describe("Coordination 1-10"),
  read: z.string().optional().catch(undefined).describe("One-line read on this player"),
});
export type GtPlayer = z.infer<typeof GtPlayerSchema>;

const ScenarioSchema = z.object({
  price: looseNullableNumber(z.number()).describe("Scenario price target, USD"),
  probability: loosePercent.describe("Scenario probability, 0-100 percent"),
});

const InstitutionRowSchema = z.object({
  name: z.string().min(1),
  target: looseNullableNumber(z.number()).describe("Verified price target, USD"),
  asOf: z.string().optional().catch(undefined).describe("Target publication date"),
  stance: z.string().optional().catch(undefined),
});
export type InstitutionRow = z.infer<typeof InstitutionRowSchema>;

/** stock-scanner keyMetrics — mirrors the skill's own labels. */
export const ScannerMetricsSchema = z.object({
  piotroskiF: looseNullableNumber(z.number().min(0).max(9)).describe("Piotroski F-Score, 0-9; null if not computable"),
  altmanZ: looseNullableNumber(z.number()).describe("Altman Z-Score; null if not meaningful"),
  altmanZone: ciEnum(["safe", "grey", "distress", "not-meaningful"], {
    gray: "grey",
    "not meaningful": "not-meaningful",
    "n/a": "not-meaningful",
    na: "not-meaningful",
    none: "not-meaningful",
  }),
  reverseDcfVerdict: z.string().describe("Plain-language read: implied bar too low / about right / too high"),
  rewardRisk: z.string().describe("Probability-weighted reward/risk, e.g. '2.8 : 1'"),
  composite: looseNullableNumber(z.number()).describe("The lens's composite score across its scoring dimensions"),
  scannerVerdict: ciEnum(["Buy", "Watchlist", "Pass"], { watch: "Watchlist", hold: "Watchlist", avoid: "Pass", sell: "Pass" }).describe(
    "The lens's own post-veto verdict",
  ),
  valueTrap: looseBoolean().describe("True if the lens flags this as a probable value trap"),
  spotPrice: looseNullableNumber(z.number()).optional().catch(undefined).describe(
    "OPTIONAL: spot price used in the valuation, USD; null if unverified",
  ),
  scenarios: z
    .object({ bear: ScenarioSchema, base: ScenarioSchema, bull: ScenarioSchema })
    .optional()
    .catch(undefined)
    .describe("OPTIONAL: probability-weighted scenario targets from the valuation"),
});
export type ScannerMetrics = z.infer<typeof ScannerMetricsSchema>;

/** gt-predictor keyMetrics. */
export const GtMetricsSchema = z.object({
  asymmetryScore: looseNumber(z.number().min(1).max(10)).describe("1 = fully priced in, 10 = maximum mispricing"),
  entryWindow: z.string().describe("The lens's entry-window read for the highest-conviction implication"),
  baseRate: z.string().describe("Outside-view base rate the forecast anchored on"),
  adjustedProbability: z.string().describe("Base rate → adjusted probability for the primary outcome"),
  gapVsMarket: z.string().describe("Where the GT read differs from current market pricing"),
  players: z
    .preprocess(capArray(8), z.array(GtPlayerSchema))
    .optional()
    .catch(undefined)
    .describe("OPTIONAL: the player map — up to 8 key actors with Mass/Energy/Coordination scored 1-10 each"),
  horizonProbabilities: z
    .object({ m3: loosePercent, m6: loosePercent, m12: loosePercent, m24: loosePercent })
    .optional()
    .catch(undefined)
    .describe("OPTIONAL: primary-outcome probability (0-100 percent) at 3/6/12/24 months"),
});
export type GtMetrics = z.infer<typeof GtMetricsSchema>;

/** institutional-forecast keyMetrics (DEEP mode Consensus Dashboard). */
export const ForecastMetricsSchema = z.object({
  currentPrice: looseNullableNumber(z.number()).describe("Spot price at retrieval, USD"),
  consensusTarget: looseNullableNumber(z.number()).describe("Descriptive average of verified targets, USD"),
  consensusTargetLow: looseNullableNumber(z.number()),
  consensusTargetHigh: looseNullableNumber(z.number()),
  impliedUpsidePct: looseNullableNumber(z.number()).describe("Consensus target vs spot, percent"),
  stance: z.string().describe("Strongly Bullish / Bullish / Mixed / Bearish / Strongly Bearish"),
  bankCount: looseNullableNumber(z.number()).describe("How many of the 8 primary institutions were verified"),
  spread: z.string().describe("Tight / Moderate / Wide"),
  freshness: z.string().describe("e.g. '4 fresh · 1 aging · 1 stale'"),
  institutions: z
    .preprocess(capArray(10), z.array(InstitutionRowSchema))
    .optional()
    .catch(undefined)
    .describe("OPTIONAL: up to 10 per-institution verified target rows"),
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
    .describe("The complete analysis write-up in markdown, following the lens's own report format"),
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

/** Persisted metric values — recursive so structured keyMetrics (players[],
 * scenarios{}, institutions[], horizonProbabilities{}) persist alongside the
 * primitives. All existing consumers use typeof guards, so widening is safe. */
export type MetricValue =
  | string
  | number
  | boolean
  | null
  | MetricValue[]
  | { [key: string]: MetricValue | undefined };
const MetricValueSchema: z.ZodType<MetricValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(MetricValueSchema),
    z.record(z.string(), MetricValueSchema),
  ]),
);

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

export const GateSchema = ciEnum(["pass", "caution", "fail"]);
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
  gate: GateSchema.describe("Fundamentals gate derived from the fundamentals lens's own labels"),
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

/** Hard cap on the operator focus directive (a "small cap only"-style scope). */
export const MODIFIER_MAX_LENGTH = 280;

/**
 * Strip prompt-injection surfaces from a focus directive before it goes
 * anywhere near a prompt: no fences/backticks (cannot fake the wire contract),
 * no control characters, collapsed whitespace, hard length cap.
 * Returns undefined when nothing meaningful remains.
 */
export function sanitizeModifier(raw: string): string | undefined {
  const cleaned = raw
    .replace(/```+/g, " ")
    .replace(/`/g, "'")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MODIFIER_MAX_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

export const RunParamsSchema = z.object({
  count: z.number().int().min(4).max(12).default(8),
  force: z.boolean().default(false),
  mock: z.boolean().default(false),
  /** Operator focus directive — scopes discovery only; rides in params_json. */
  modifier: z.string().min(1).max(MODIFIER_MAX_LENGTH).optional(),
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
