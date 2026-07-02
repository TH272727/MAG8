import {
  LENS_SKILLS,
  type Gate,
  type LensSkill,
  type MetricValue,
  type RankedStock,
  type RankedStockWire,
  type SubScores,
  type Verdict,
} from "./schemas";

/* ============================================================================
 * Trillion-Dollar Confluence Score — single source of truth.
 * The compiler prompt and the /methodology page both render buildRubricText()
 * from these constants, and verify/finalize recompute the arithmetic from them.
 * LLM does judgment; TS enforces arithmetic.
 * ========================================================================== */

export const GATE_MULTIPLIER: Record<Gate, number> = {
  pass: 1,
  caution: 0.75,
  fail: 0.4,
};

export const WEIGHTS: Record<keyof SubScores, number> = {
  fundamentals: 0.35,
  discoveryThesis: 0.25,
  gtAsymmetry: 0.2,
  institutionalGap: 0.2,
};

export const CONFLUENCE_BONUS = 10;
export const SCORE_CAP = 100;
/** Sub-score assigned to a lens whose cell is missing or errored. */
export const NEUTRAL_SUBSCORE = 50;
/** Score drift tolerated before the deterministic recompute overwrites the compiler. */
export const SCORE_DRIFT_TOLERANCE = 1;

const round1 = (x: number) => Math.round(x * 10) / 10;

export function weightedBase(scores: SubScores): number {
  return round1(
    scores.fundamentals * WEIGHTS.fundamentals +
      scores.discoveryThesis * WEIGHTS.discoveryThesis +
      scores.gtAsymmetry * WEIGHTS.gtAsymmetry +
      scores.institutionalGap * WEIGHTS.institutionalGap,
  );
}

export function computeScore(scores: SubScores, gate: Gate, confluence: boolean): number {
  const base = weightedBase(scores);
  return round1(Math.min(SCORE_CAP, base * GATE_MULTIPLIER[gate] + (confluence ? CONFLUENCE_BONUS : 0)));
}

/* ============================================================================
 * Gate derivation — off stock-scanner's OWN labels, deterministically.
 * ========================================================================== */

export interface GateRead {
  gate: Gate;
  reason: string;
}

/** Derive the fundamentals gate from scanner keyMetrics. Returns null if metrics are unusable. */
export function deriveGate(km: Record<string, MetricValue> | null | undefined): GateRead | null {
  if (!km) return null;
  const verdict = typeof km.scannerVerdict === "string" ? km.scannerVerdict : null;
  if (!verdict) return null;

  const f = typeof km.piotroskiF === "number" ? km.piotroskiF : null;
  const z = typeof km.altmanZ === "number" ? km.altmanZ : null;
  const zone = typeof km.altmanZone === "string" ? km.altmanZone : null;
  const valueTrap = km.valueTrap === true;

  const distress = zone === "distress" || (z !== null && z < 1.81) || (f !== null && f <= 3);
  if (distress) {
    const parts: string[] = [];
    if (zone === "distress" || (z !== null && z < 1.81)) parts.push(`Altman Z ${z ?? "distress-zone"} < 1.81`);
    if (f !== null && f <= 3) parts.push(`Piotroski F ${f} ≤ 3`);
    return { gate: "fail", reason: `Distress-zone veto (${parts.join("; ")}) — scanner caps rating at Watchlist/Pass.` };
  }
  if (valueTrap) return { gate: "fail", reason: "Scanner flags a probable value trap." };
  if (verdict === "Pass") return { gate: "fail", reason: "Scanner verdict: Pass." };
  if (verdict === "Watchlist") return { gate: "caution", reason: "Scanner verdict: Watchlist — attractive but with an unresolved flag." };
  return { gate: "pass", reason: "Scanner verdict: Buy — gates cleared, no distress or value-trap flags." };
}

/** Confluence = all three lenses independently bullish. Requires all three verdicts known. */
export function deriveConfluence(verdicts: Partial<Record<LensSkill, Verdict>>): boolean | null {
  if (LENS_SKILLS.some((s) => verdicts[s] === undefined)) return null;
  return LENS_SKILLS.every((s) => verdicts[s] === "bullish");
}

/* ============================================================================
 * Rubric text — rendered FROM the constants (compiler prompt + /methodology).
 * ========================================================================== */

export function buildRubricText(): string {
  const w = (k: keyof SubScores) => `${Math.round(WEIGHTS[k] * 100)}%`;
  return `## Trillion-Dollar Confluence Score (0–100)

Each candidate receives four sub-scores, each 0–100, one per independent lens:

1. **Fundamentals** — weight ${w("fundamentals")}. From the stock-scanner lens: financial strength (Piotroski F, Altman Z), quality and moat, reverse-DCF expectations gap, reward/risk, and the scanner's own composite and verdict.
2. **Discovery thesis** — weight ${w("discoveryThesis")}. From the Stage-1 scout: how credibly the company matches pre-scale mega-cap DNA traits and rides a durable secular wave.
3. **GT asymmetry** — weight ${w("gtAsymmetry")}. From the gt-predictor lens: Asymmetry Score (1–10, 10 = maximum mispricing), strength and direction of the macro/game-theoretic read, quality of the entry window.
4. **Institutional gap** — weight ${w("institutionalGap")}. From the institutional-forecast lens: implied upside vs verified consensus targets, stance, coverage breadth, and spread (a tight bullish consensus scores higher than a wide scattered one).

**Sub-score anchors:** 80+ exceptional evidence, 60–79 strong, 40–59 mixed/neutral, below 40 weak or contradicting.

**Weighted base** = ${WEIGHTS.fundamentals}·Fundamentals + ${WEIGHTS.discoveryThesis}·DiscoveryThesis + ${WEIGHTS.gtAsymmetry}·GTAsymmetry + ${WEIGHTS.institutionalGap}·InstitutionalGap.

**Fundamentals gate** — derived from stock-scanner's own labels, then applied as a multiplier on the weighted base:

- **pass** ×${GATE_MULTIPLIER.pass.toFixed(2)} — clean Buy verdict; no distress or value-trap flags.
- **caution** ×${GATE_MULTIPLIER.caution.toFixed(2)} — Watchlist verdict, or one moderate unresolved flag.
- **fail** ×${GATE_MULTIPLIER.fail.toFixed(2)} — distress-zone veto (Altman Z < 1.81 or Piotroski F ≤ 3), a value-trap flag, or a Pass verdict.

**Confluence bonus** — +${CONFLUENCE_BONUS} points when all three lenses independently lean bullish. Independent methods agreeing is itself the signal; this bonus is the product thesis in arithmetic form.

**Final score** = min(${SCORE_CAP}, weighted base × gate multiplier + confluence bonus), rounded to one decimal.

**Missing lenses** — if a lens cell errored or is missing, treat that lens as neutral (sub-score ${NEUTRAL_SUBSCORE}), never bullish for confluence purposes, and note the gap explicitly.

**Placement rule** — a fail-gated stock may not rank in the top half of the leaderboard, regardless of score.`;
}

/* ============================================================================
 * Deterministic verification + finalization.
 * ========================================================================== */

export interface VerifyContext {
  /** Verdicts of the lenses that completed OK, per ticker. */
  lensVerdicts: Map<string, Partial<Record<LensSkill, Verdict>>>;
  /** Scanner keyMetrics per ticker (only for cells that completed OK). */
  scannerMetrics: Map<string, Record<string, MetricValue>>;
  /** Tickers that were actually discovered in Stage 1. */
  candidateTickers: string[];
}

export interface VerifiedStock {
  stock: RankedStockWire;
  corrections: string[];
}

/** Recompute gate, confluence, and score arithmetic; overwrite the compiler where it drifted. */
export function verifyRankedStock(input: RankedStockWire, ctx: VerifyContext): VerifiedStock {
  const corrections: string[] = [];
  const stock: RankedStockWire = { ...input, scores: { ...input.scores }, riskFlags: [...input.riskFlags] };

  const expectedGate = deriveGate(ctx.scannerMetrics.get(stock.ticker));
  if (expectedGate && expectedGate.gate !== stock.gate) {
    corrections.push(`gate corrected ${stock.gate} → ${expectedGate.gate} per scanner labels`);
    stock.gate = expectedGate.gate;
    stock.gateReason = expectedGate.reason;
  }

  const verdicts = ctx.lensVerdicts.get(stock.ticker) ?? {};
  const expectedConfluence = deriveConfluence(verdicts);
  const confluence = expectedConfluence !== null ? expectedConfluence : false;
  if (expectedConfluence !== null && expectedConfluence !== stock.confluence) {
    corrections.push(`confluence corrected ${stock.confluence} → ${expectedConfluence} from lens verdicts`);
  } else if (expectedConfluence === null && stock.confluence) {
    corrections.push(`confluence bonus removed — not all three lenses completed`);
  }
  stock.confluence = confluence;

  const expectedScore = computeScore(stock.scores, stock.gate, stock.confluence);
  if (Math.abs(stock.finalScore - expectedScore) > SCORE_DRIFT_TOLERANCE || corrections.length > 0) {
    if (Math.abs(stock.finalScore - expectedScore) > SCORE_DRIFT_TOLERANCE) {
      corrections.push(`score recomputed ${stock.finalScore} → ${expectedScore}`);
    }
    stock.finalScore = expectedScore;
  }

  if (corrections.length > 0) {
    stock.groundingNotes = `${stock.groundingNotes.trim()} [Verification: ${corrections.join("; ")}.]`;
  }
  return { stock, corrections };
}

export interface FinalizedRankings {
  rankings: RankedStock[];
  notes: string[];
}

/**
 * Verify every entry, re-sort desc, enforce the fail-not-in-top-half rule,
 * and assign ranks. Unknown tickers are dropped; omitted candidates are noted.
 */
export function finalizeRankings(wire: RankedStockWire[], ctx: VerifyContext): FinalizedRankings {
  const notes: string[] = [];
  const known = new Set(ctx.candidateTickers);
  const seen = new Set<string>();

  const verified: RankedStockWire[] = [];
  for (const raw of wire) {
    const ticker = raw.ticker.toUpperCase();
    if (!known.has(ticker)) {
      notes.push(`Compiler emitted unknown ticker ${ticker}; dropped.`);
      continue;
    }
    if (seen.has(ticker)) {
      notes.push(`Compiler emitted duplicate entry for ${ticker}; kept the first.`);
      continue;
    }
    seen.add(ticker);
    const { stock, corrections } = verifyRankedStock({ ...raw, ticker }, ctx);
    if (corrections.length > 0) notes.push(`${ticker}: ${corrections.join("; ")}.`);
    verified.push(stock);
  }

  for (const t of ctx.candidateTickers) {
    if (!seen.has(t)) notes.push(`Candidate ${t} missing from the compiled rankings — no entry synthesized.`);
  }

  verified.sort((a, b) => b.finalScore - a.finalScore || a.ticker.localeCompare(b.ticker));

  // Fail-gated stocks may not occupy positions 1..floor(n/2).
  const n = verified.length;
  const zone = Math.floor(n / 2);
  const ordered: RankedStockWire[] = [];
  const pool = [...verified];
  let displaced = false;
  for (let pos = 0; pos < n; pos++) {
    let idx = 0;
    if (pos < zone) {
      const nonFail = pool.findIndex((s) => s.gate !== "fail");
      if (nonFail >= 0) {
        if (nonFail > 0) displaced = true;
        idx = nonFail;
      } else {
        notes.push("Not enough non-fail stocks to fill the top half; a fail-gated stock remains in it.");
      }
    }
    ordered.push(pool.splice(idx, 1)[0]);
  }
  if (displaced) notes.push("One or more fail-gated stocks were displaced below the top half per the placement rule.");

  return {
    rankings: ordered.map((s, i) => ({ ...s, rank: i + 1 })),
    notes,
  };
}
