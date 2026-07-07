import type { BoardResult, LensRow, RunSnapshot } from "./db";
import {
  LENS_SKILLS,
  type CompiledReport,
  type LensSkill,
  type ProgressEvent,
  type RankedStock,
} from "./schemas";
import {
  PUBLIC_LENS_META,
  type PublicBoard,
  type PublicCellSummary,
  type PublicLens,
  type PublicLensRow,
  type PublicProgressEvent,
  type PublicRunSnapshot,
} from "./public-lens";

/* ============================================================================
 * Public-view boundary (server-only). LOAD-BEARING INVARIANT:
 * no client payload — SSE frame, snapshot JSON, or RSC prop — may bypass this
 * module. Internal skill ids and provider/engine jargon stop existing here.
 *
 * Persisted rows and events keep their internal ids (historical data stays
 * valid); translation happens on the way out, every time.
 * ========================================================================== */

export const LENS_TO_PUBLIC: Record<LensSkill, PublicLens> = {
  "stock-scanner": "fundamentals",
  "gt-predictor": "macro",
  "institutional-forecast": "consensus",
};

export const PUBLIC_LENS_LABEL = (skill: LensSkill): string => PUBLIC_LENS_META[LENS_TO_PUBLIC[skill]].label;

/* ----------------------------------------------------------------------------
 * Text sanitizers. One regex catalog; applied to short strings we ship
 * (activities, errors, gap notes, report prose). Markdown gets the narrow
 * exact-token pass only — broad word scrubbing would mangle analysis prose.
 * -------------------------------------------------------------------------- */

const EXACT_TOKENS: [RegExp, string][] = [
  [/\bnew[- ]gen[- ]stock\b/gi, "the discovery scout"],
  [/\bstock[- ]scanner\b/gi, "the fundamentals lens"],
  [/\bgt[- ]predictor\b/gi, "the macro-asymmetry lens"],
  [/\binstitutional[- ]forecast\b/gi, "the street-consensus lens"],
  [/\bSKILL\.md\b/g, "the playbook"],
  [/\bClaude Code\b/g, "the research engine"],
  [/\bClaude\b/g, "the research engine"],
  [/\bAnthropic\b/g, "the research provider"],
];

const PHRASE_TOKENS: [RegExp, string][] = [
  [/\bLoading (?:a )?skill\b/gi, "Opening the research playbook"],
  [/\bthe (?:Agent )?SDK\b/gi, "the engine"],
  [/\bagent session\b/gi, "analysis session"],
];

function applyTokens(s: string, tokens: [RegExp, string][]): string {
  let out = s;
  for (const [re, sub] of tokens) out = out.replace(re, sub);
  return out;
}

/** Sanitize a short human-readable string (activity line, gap note, report prose). */
export function sanitizeText(s: string): string {
  return applyTokens(applyTokens(s, PHRASE_TOKENS), EXACT_TOKENS);
}

/** Narrow markdown pass: exact internal tokens only, never broad words. */
export function sanitizeMarkdown(md: string): string {
  return applyTokens(md, EXACT_TOKENS);
}

/**
 * Error strings can carry internal call labels ("lens:ASTS:stock-scanner: …")
 * and provider/engine jargon (session limits, oauth, SDK phrasing). Map known
 * failure categories to plain language; scrub and truncate the rest.
 */
export function sanitizeError(raw: string): string {
  // Strip the internal call label prefix.
  const msg = raw
    .replace(/^lens:[A-Za-z0-9.\-]{1,12}:[a-z-]+:\s*/i, "")
    .replace(/^(discovery|compiler):\s*/i, "");

  if (/(session|usage|weekly|5-hour) limit|capacity window/i.test(raw)) {
    return "Research capacity for this account's usage window is exhausted — the analysis could not finish. It can be retried after the window resets; completed cells are kept.";
  }
  if (/credit balance/i.test(raw)) {
    return "The research account has insufficient credit for live analysis.";
  }
  if (/invalid (api key|bearer token)|authentication[_ ]error|oauth/i.test(raw)) {
    return "Research credentials on the server are invalid or expired.";
  }
  if (/schema validation|without a usable result|failed validation/i.test(raw)) {
    return "The analysis output failed validation and was excluded from scoring.";
  }
  if (/timed out|timeout|watchdog|aborted/i.test(raw)) {
    return "The analysis ran too long and was stopped.";
  }
  if (/interrupted by a server restart/i.test(raw)) {
    return "The run was interrupted by a server restart before it could finish.";
  }

  const clean = sanitizeText(msg).replace(/\s+/g, " ").trim();
  return clean.length > 300 ? `${clean.slice(0, 299)}…` : clean;
}

/* ----------------------------------------------------------------------------
 * Structured translators.
 * -------------------------------------------------------------------------- */

export function sanitizeRankedStock(rk: RankedStock): RankedStock {
  return {
    ...rk,
    gateReason: sanitizeText(rk.gateReason),
    verdictLine: sanitizeText(rk.verdictLine),
    groundingNotes: sanitizeText(rk.groundingNotes),
    riskFlags: rk.riskFlags.map(sanitizeText),
  };
}

export function toPublicReport(report: CompiledReport): CompiledReport {
  return {
    ...report,
    marketOverview: sanitizeText(report.marketOverview),
    methodologyNote: sanitizeText(report.methodologyNote),
    gapsNoted: report.gapsNoted.map(sanitizeText),
    rankings: report.rankings.map(sanitizeRankedStock),
  };
}

/**
 * All-time board → public shape. Assigns board-position ranks (the origin-run
 * rank inside each payload is meaningless across runs) and sanitizes the two
 * free-text surfaces: the verdict line and the user-supplied focus directive.
 */
export function toPublicBoard(board: BoardResult): PublicBoard {
  return {
    kind: board.kind,
    runCount: board.runCount,
    updatedAt: board.updatedAt,
    demo: board.demo,
    entries: board.entries.map((e, i) => {
      const best = sanitizeRankedStock(e.best);
      return {
        rank: i + 1,
        ticker: e.ticker,
        companyName: best.companyName,
        gate: best.gate,
        confluence: best.confluence,
        finalScore: best.finalScore,
        verdictLine: best.verdictLine,
        appearances: e.appearances,
        bestRunAt: e.bestRunAt,
        lastSeenAt: e.lastSeenAt,
        ...(e.bestRunFocus ? { focus: sanitizeText(e.bestRunFocus) } : {}),
      };
    }),
  };
}

/** Translate one persisted/live progress event into its public shape. */
export function toPublicEvent(e: ProgressEvent): PublicProgressEvent {
  switch (e.type) {
    case "stage_start":
    case "discovery_complete":
      return e;
    case "discovery_activity":
      return { ...e, activity: sanitizeText(e.activity) };
    case "compile_activity":
      return { ...e, activity: sanitizeText(e.activity) };
    case "lens_status": {
      const { skill, activity, error, ...rest } = e;
      return {
        ...rest,
        lens: LENS_TO_PUBLIC[skill],
        ...(activity !== undefined ? { activity: sanitizeText(activity) } : {}),
        ...(error !== undefined ? { error: sanitizeError(error) } : {}),
      };
    }
    case "run_complete":
      return { ...e, report: toPublicReport(e.report) };
    case "run_error":
      return { ...e, error: sanitizeError(e.error) };
  }
}

export function toPublicSnapshot(s: RunSnapshot): PublicRunSnapshot {
  const cells: PublicCellSummary[] = s.cells.map((c) => ({
    ticker: c.ticker,
    lens: LENS_TO_PUBLIC[c.skill],
    status: c.status,
    cached: c.cached,
    error: c.error === null ? null : sanitizeError(c.error),
    verdict: c.verdict,
    confidence: c.confidence,
    headline: c.headline,
    costUsd: c.costUsd,
  }));
  return {
    run: {
      ...s.run,
      error: s.run.error === null ? null : sanitizeError(s.run.error),
      report: s.run.report ? toPublicReport(s.run.report) : null,
    },
    candidates: s.candidates,
    cells,
    rankings: s.rankings.map(sanitizeRankedStock),
    report: s.report ? toPublicReport(s.report) : null,
    lastEventId: s.lastEventId,
  };
}

export function toPublicLensRow(row: LensRow): PublicLensRow {
  const { skill, analysis, error, ...rest } = row;
  return {
    ...rest,
    lens: LENS_TO_PUBLIC[skill],
    error: error === null ? null : sanitizeError(error),
    analysis: analysis
      ? (({ skill: _s, ...a }) => ({
          ...a,
          summary: sanitizeText(a.summary),
          riskFlags: a.riskFlags.map(sanitizeText),
          fullAnalysisMarkdown: sanitizeMarkdown(a.fullAnalysisMarkdown),
        }))(analysis)
      : null,
  };
}

/** Internal lens order, exported for server code that builds public maps. */
export const LENS_SKILLS_ORDERED = LENS_SKILLS;
