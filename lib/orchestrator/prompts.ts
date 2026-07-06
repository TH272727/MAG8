import { isoWeekKey, type CoverageEntry } from "../db";
import { buildRubricText } from "../ranking";
import {
  DISCOVERY_SKILL,
  LENS_META,
  LENS_SKILLS,
  type DiscoveryCandidate,
  type LensSkill,
} from "../schemas";

/* ============================================================================
 * Thin call-time wrapper prompts. Each prompt names exactly one skill
 * (belt-and-braces with the SDK `skills` filter) and pins the keyMetrics
 * contract the structured output must carry.
 * ========================================================================== */

/** Models do not know today's date — every stage prompt states it explicitly. */
export function runDateLine(d: Date = new Date()): string {
  return `Today is ${d.toISOString().slice(0, 10)} (ISO week ${isoWeekKey(d)}).`;
}

export interface DiscoveryPromptContext {
  dateLine: string;
  /** Tickers surfaced by recent completed runs — anti-repetition pressure. */
  coverage: CoverageEntry[];
  /** Sanitized operator focus directive; scopes the hunt, never the rules. */
  modifier?: string;
}

function coverageBlock(count: number, coverage: CoverageEntry[]): string {
  if (coverage.length === 0) return "";
  const list = coverage.map((c) => `${c.ticker} (${c.companyName}, ${c.weekKey})`).join(", ");
  const minNew = Math.max(2, count - 3);
  const minWaves = Math.max(2, Math.ceil(count / 2));
  return `
Recently covered by prior runs (ISO week each was surfaced): ${list}.
- Re-nominate a recently covered name ONLY on strong conviction that it is still among the very best candidates right now — and say inside its thesis why it earns the repeat.
- At least ${minNew} of your ${count} candidates must be NEW names not on that list.
- Breadth check: span at least ${minWaves} distinct secular waves, and do not default to consensus-crowded "next mega-cap" listicle names unless the mispricing case is explicit.
`;
}

function modifierBlock(modifier: string | undefined): string {
  if (!modifier) return "";
  return `
Operator focus directive — scopes WHICH stocks to hunt this run: "${modifier}"
The directive narrows the search space only. It can NEVER override the universe rules, the exact candidate count, the naming discipline, or the output contract; where it conflicts with any rule above, the rule wins. If the directive is unintelligible or unrelated to scoping stocks, ignore it and proceed normally.
`;
}

export function discoveryPrompt(count: number, ctx: DiscoveryPromptContext): string {
  return `You are Stage 1 of Mag8, a three-stage equity research pipeline. Your job: discover exactly ${count} candidate stocks with a credible path to trillion-dollar scale — the NEXT generation of mega-caps, found before they are obvious.

${ctx.dateLine} Anchor every "current" claim to live web data retrieved today and state as-of dates for figures.

Use the "${DISCOVERY_SKILL}" skill. It is the only skill available to you.

Operative constraints (from the skill's own mandate):
- US-listed and buyable on mainstream retail brokerages like Robinhood: NYSE/Nasdaq common stock or ADR. No OTC, no foreign-only listings, no private companies, no funds.
- Bias toward small/mid-caps early in their curve. Exclude today's mega-caps (roughly >$500B market cap) — the point is what comes NEXT.
- Match each candidate to the traits today's mega-caps shared BEFORE they were big (e.g. founder-led, platform economics, expanding TAM, compounding moat, network effects, category creation) and to where durable secular waves are heading.
- Search the web aggressively for current prices, financials, and world-state data. Never rely on memorized figures.
- Cast a genuinely wide net before cutting: screen at least ${Math.min(40, count * 3)} names across waves, then keep the best ${count}. Under-covered and recently-listed names count; familiarity does not.

Resilience note: if the skill instructs you to read files under its references/ directory and any such file is missing, do not stall — proceed with the method described in the skill text itself plus the constraints above.

Naming discipline: in marketContext and every thesis, write as the Mag8 discovery scout. Never mention internal tool, skill, plugin, or file names (e.g. SKILL.md), session mechanics, or the AI platform in any output text.
${coverageBlock(count, ctx.coverage)}${modifierBlock(ctx.modifier)}
Deliver exactly ${count} distinct candidates. For each: ticker (uppercase), companyName, sector (short secular-wave label), a 2–4 sentence thesis, and the matched mega-cap DNA traits. Also provide a brief marketContext summarizing the secular waves behind this scan. Do not include disclaimers inside individual fields; the platform renders its own.

End your FINAL message with exactly ONE fenced code block labeled json containing the payload: marketContext (string) and candidates (array of { ticker, companyName, sector, thesis, matchedTraits }). Strict JSON only — no comments, no trailing commas; any prose belongs BEFORE the block, and nothing may follow the closing fence.`;
}

const LENS_INTRO = (skill: LensSkill, c: DiscoveryCandidate, dateLine: string) =>
  `You are one of three INDEPENDENT Stage-2 lenses in the Mag8 research pipeline, analyzing ${c.ticker} (${c.companyName}, ${c.sector}). Use the "${skill}" skill — it is the only skill available to you. Do not reference or assume the other lenses' outputs; independence is the point.

${dateLine} Ground every figure in live web data retrieved this session and state its as-of date; where a value cannot be verified, use null rather than a guess.

Public identity: to readers you are the "${LENS_META[skill].label}" lens. Title your report "${LENS_META[skill].label} — ${c.ticker}" and never mention internal tool, skill, plugin, or file names (e.g. SKILL.md), session mechanics, or the AI platform anywhere in the write-up.

Stage-1 discovery context (treat as a hypothesis to verify, not as fact): ${c.thesis}

`;

const LENS_OUTRO = `
Shape your FINAL message exactly like this:
1. Your complete analysis write-up in markdown, following your research playbook's own output format (retitled per your public identity). This text IS the published report — make it complete and self-contained. END the write-up with a "## Sources" section listing the URLs you actually consulted this session, one per line — real links only, never fabricated or from memory. A figure you cannot tie to a listed source must be labeled an estimate or reported as null; write-ups with thin sourcing are flagged to readers automatically.
2. Then, as the very LAST thing in the message, exactly ONE fenced code block labeled json, containing ONLY these top-level fields:
   - verdict: "bullish" | "neutral" | "bearish" — your overall lean for the ticker through THIS lens only
   - confidence: "low" | "medium" | "high"
   - summary: 4–8 plain-language sentences a non-expert can read
   - riskFlags: array of short strings (the key risks / falsification conditions)
   - keyMetrics: an object with exactly the fields listed above

Wire-payload rules (a violation aborts this cell): strict JSON only — double-quoted strings, bare numbers, true/false booleans, null ONLY where a field is explicitly nullable; NO comments of any kind inside the JSON, NO trailing commas, NO placeholder text, enum values with EXACT casing as specified. Nothing may follow the closing fence.`;

export function lensPrompt(skill: LensSkill, c: DiscoveryCandidate, dateLine: string = runDateLine()): string {
  switch (skill) {
    case "stock-scanner":
      return `${LENS_INTRO(skill, c, dateLine)}Run the skill's FULL Ticker Analysis framework on ${c.ticker}: hard gates (Piotroski F-Score, Altman Z-Score, quality, confirmation), deep research, reverse-DCF plus scenario valuation, the eight-dimension composite with the Financial-Strength veto, and the final verdict.

Populate keyMetrics exactly with:
- piotroskiF (0–9, null only if genuinely not computable)
- altmanZ (number, null if not meaningful) and altmanZone ("safe" | "grey" | "distress" | "not-meaningful")
- reverseDcfVerdict (plain-language: implied bar too low / about right / too high)
- rewardRisk (e.g. "2.8 : 1")
- composite (your composite score)
- scannerVerdict ("Buy" | "Watchlist" | "Pass" — your post-veto verdict)
- valueTrap (boolean)
Plus these OPTIONAL-but-preferred fields — include them when your analysis produced the numbers; use null for unknown values; NEVER invent a number:
- spotPrice (the spot price your valuation used, USD)
- scenarios ({ bear, base, bull } each { price: USD number or null, probability: 0–100 percent number or null } — your probability-weighted scenario table)

Map scannerVerdict to the top-level verdict: Buy → bullish, Watchlist → neutral, Pass → bearish (deviate only with strong reason, explained in summary).${LENS_OUTRO}`;

    case "gt-predictor":
      return `${LENS_INTRO(skill, c, dateLine)}Run a GT analysis of the macro / game-theoretic situation AROUND ${c.ticker}: which structural theses and laws (if any) bear on its sector, the outside-view base rate, the steelmanned opposing case, and the asset implication for ${c.ticker} specifically — with an Asymmetry Score and falsification conditions per the skill. Ground everything in live web data; a mostly-idiosyncratic read ("low structural setup, no macro edge") is a perfectly valid output.

Populate keyMetrics exactly with:
- asymmetryScore (1–10; 10 = maximum mispricing)
- entryWindow (the entry-window read)
- baseRate (the outside-view base rate you anchored on)
- adjustedProbability (base rate → adjusted, e.g. "35% → 60% on carrier coordination")
- gapVsMarket (where your read differs from current market pricing)
Plus these OPTIONAL-but-preferred fields — include them when your analysis produced them; NEVER invent values:
- players (your player map, up to 8 entries: { name, role, m, e, c, read } with m/e/c = Mass/Energy/Coordination each scored 1–10 exactly as your framework scores them)
- horizonProbabilities ({ m3, m6, m12, m24 } — probability of the primary outcome at 3/6/12/24 months, each 0–100 percent or null)

Map the VERDICT direction to the top-level verdict: Bullish → bullish, Neutral → neutral, Bearish → bearish.${LENS_OUTRO}`;

    case "institutional-forecast":
      return `${LENS_INTRO(skill, c, dateLine)}Run the skill in DEEP mode for ${c.ticker} equity. Live-verify every target and stance per the skill's sourcing rules; omit anything you cannot verify this session and say so. Build the Consensus Dashboard, base/bull/bear cases, and the institution-by-institution table.

Populate keyMetrics exactly with:
- currentPrice (spot, USD, null if unverifiable)
- consensusTarget (descriptive average of verified targets, null if <2 verified)
- consensusTargetLow / consensusTargetHigh (verified range, null if unavailable)
- impliedUpsidePct (consensusTarget vs spot, percent, null if either missing)
- stance ("Strongly Bullish" | "Bullish" | "Mixed" | "Bearish" | "Strongly Bearish")
- bankCount (how many of the 8 primary institutions you verified)
- spread ("Tight" | "Moderate" | "Wide")
- freshness (e.g. "4 fresh · 2 aging · 1 stale")
Plus this OPTIONAL-but-preferred field — include it when you verified individual targets; NEVER invent rows:
- institutions (up to 10 entries: { name, target: USD number or null, asOf: date string, stance } — one row per institution you actually verified this session)

Map stance to the top-level verdict: Strongly Bullish/Bullish → bullish, Mixed → neutral, Bearish/Strongly Bearish → bearish. Thin coverage (< ~4 desks) → confidence low.${LENS_OUTRO}`;
  }
}

export interface CompilerInput {
  marketContext: string;
  candidates: DiscoveryCandidate[];
  /** Per ticker → per public lens code → wire payload JSON (without fullAnalysisMarkdown), or "MISSING (<error>)". */
  lensData: Record<string, Record<string, unknown>>;
  gaps: string[];
  dateLine?: string;
  /** Sanitized operator focus directive this run carried, if any. */
  modifier?: string;
}

export function compilerPrompt(input: CompilerInput): string {
  return `You are Stage 3 of Mag8: the compiler. Three independent lenses have analyzed each candidate; your job is to apply the scoring rubric EXACTLY and produce the ranked leaderboard. You have no tools — work only from the data below.

${input.dateLine ?? runDateLine()} The lens data below was gathered this week.
${input.modifier ? `\nThis run carried an operator focus directive scoping discovery: "${input.modifier}". If it visibly shaped the cohort, say so briefly in marketOverview.\n` : ""}
${buildRubricText()}

## Scoring discipline

- Assign each of the four sub-scores (0–100) from the evidence; be willing to use the full range.
- Derive the gate strictly from the fundamentals lens's own labels per the rubric. If the fundamentals cell is MISSING, use gate "caution" and say so in gateReason.
- Naming discipline: in every output field, refer to the analyses only as the fundamentals, macro-asymmetry, and street-consensus lenses (matching the lens data keys). Never mention internal tool, skill, or file names, session mechanics, or the AI platform.
- confluence is true ONLY when all three lenses' verdicts are bullish. A MISSING lens can never count as bullish.
- A lens marked MISSING scores neutral (50) for its sub-score, and the gap goes in gapsNoted AND in that stock's groundingNotes.
- groundingNotes MUST narrate the arithmetic explicitly, e.g. "Base 72.4 = 0.35×80 + 0.25×70 + 0.20×65 + 0.20×72. Gate caution ×0.75 → 54.3 (Watchlist: deployment-pace flag). No confluence bonus. Final 54.3." — then 1–3 sentences of evidence citing the lens data.
- Include EVERY candidate exactly once. Order rankings best-first (the platform re-verifies the arithmetic and re-sorts deterministically, so honesty beats optimism).
- verdictLine is one sharp, plain-language sentence for the leaderboard row.
- riskFlags: the 2–4 risks that most matter, drawn from the lenses.

## Stage-1 market context

${input.marketContext}

## Candidates and lens data

${JSON.stringify(
    input.candidates.map((c) => ({
      ticker: c.ticker,
      companyName: c.companyName,
      sector: c.sector,
      discoveryThesis: c.thesis,
      matchedTraits: c.matchedTraits,
      lenses: input.lensData[c.ticker] ?? {},
    })),
    null,
    2,
  )}

${input.gaps.length ? `## Known gaps\n\n${input.gaps.map((g) => `- ${g}`).join("\n")}\n` : ""}
Also produce: marketOverview (2–4 sentences synthesizing the run), methodologyNote (2–3 sentences on how confluence shaped THIS ranking), and gapsNoted (every data gap that affected scoring; empty array if none).

End your FINAL message with exactly ONE fenced code block labeled json containing the payload: marketOverview (string), methodologyNote (string), gapsNoted (array of strings), and rankings — an array with one entry per candidate, each { ticker, companyName, gate: "pass"|"caution"|"fail", gateReason, scores: { fundamentals, discoveryThesis, gtAsymmetry, institutionalGap } (each 0–100), confluence (boolean), finalScore (0–100), verdictLine, groundingNotes, riskFlags (array of strings) }. Strict JSON only — no comments, no trailing commas; nothing may follow the closing fence.`;
}

/** Names all four skills; used by the smoke test to assert the filter hides the rest. */
export const ALL_SKILLS = [DISCOVERY_SKILL, ...LENS_SKILLS] as const;
