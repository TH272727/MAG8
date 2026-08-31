import { TIER_META, type Reading } from "./score";
import { describeChange, type StateChange } from "./state";
import { fmtNum, fmtPct, fmtPercentile, fmtScore } from "./format";

/* ============================================================================
 * The written note.
 *
 * A note is written only when an indicator actually CHANGES STATE — never on a
 * schedule, never per page load, never once per indicator when several moved on
 * the same session. That constraint comes from the published method and is the
 * whole reason this layer is cheap.
 *
 * Two writers, and the free one is the default:
 *
 *   templateBrief()  deterministic, no network, no cost, always available.
 *                    The board is fully usable with nothing else.
 *   modelBrief()     the optional one, off unless the operator switches it on.
 *
 * The model is given the computed figures and asked to write prose from them.
 * It is never asked to work a figure out. That instruction is not trusted on
 * its own: verifyBriefNumbers() re-reads the returned text and rejects it if it
 * contains a number that cannot be traced back to an input. A rejected note is
 * discarded and the deterministic one is published in its place, so the worst
 * case of turning the model on is that it changes nothing.
 * ========================================================================== */

export interface BriefChange {
  change: StateChange;
  reading: Reading;
}

const DISCLAIMER =
  "Not financial advice. These are measurements of price behaviour that has already happened, not forecasts.";

/* ----------------------------------------------------------------------------
 * The deterministic writer.
 * -------------------------------------------------------------------------- */

/**
 * One paragraph per changed indicator, assembled from the computed figures.
 * Reads as prose, contains no judgement the arithmetic did not produce, and
 * cannot say anything the numbers do not.
 */
export function templateBrief(items: BriefChange[], asOf: string): string {
  if (items.length === 0) {
    return [
      `## Rotation brief — ${asOf}`,
      "",
      "No indicator changed state on this session. Nothing crossed a tier boundary and nothing flipped the " +
        "side it favours.",
      "",
      DISCLAIMER,
    ].join("\n");
  }

  const strengthened = items.filter(
    (i) => TIER_META[i.change.to.tier].rank > TIER_META[i.change.from.tier].rank,
  ).length;
  const eased = items.filter(
    (i) => TIER_META[i.change.to.tier].rank < TIER_META[i.change.from.tier].rank,
  ).length;
  const flipped = items.filter((i) => i.change.kind !== "tier").length;

  const headline: string[] = [];
  if (strengthened > 0) headline.push(`${strengthened} strengthened`);
  if (eased > 0) headline.push(`${eased} eased`);
  if (flipped > 0) headline.push(`${flipped} changed the side it favours`);

  const lines = [
    `## Rotation brief — ${asOf}`,
    "",
    `${items.length} indicator${items.length === 1 ? "" : "s"} changed state on this session` +
      (headline.length > 0 ? `: ${headline.join(", ")}.` : "."),
    "",
  ];

  for (const { change, reading } of items) {
    lines.push(`### ${reading.label}`);
    lines.push("");
    lines.push(`${describeChange(change, reading)}.`);
    lines.push("");
    lines.push(reading.meaning);
    lines.push("");

    const facts: string[] = [];
    if (reading.score !== null) {
      facts.push(`the composite reads ${fmtScore(reading.score)} of 10`);
    }
    if (reading.separationPct !== null) {
      facts.push(
        `its 50-day average sits ${fmtPct(reading.separationPct, 2)} from its 200-day` +
          (reading.confirmed ? "" : ", and is no longer moving with that gap"),
      );
    }
    if (reading.zScore !== null) {
      facts.push(`the ratio is ${fmtNum(reading.zScore)} deviations from its own one-year mean`);
    }
    if (reading.percentile !== null) {
      facts.push(`it sits at the ${fmtPercentile(reading.percentile)} percentile of its three-year range`);
    }
    if (reading.roc3m !== null) {
      facts.push(`it has moved ${fmtPct(reading.roc3m)} over three months`);
    }
    if (facts.length > 0) {
      lines.push(`Behind the change: ${facts.join("; ")}.`);
      lines.push("");
    }
    lines.push(`*How this could be wrong:* ${reading.falsification}`);
    lines.push("");
  }

  lines.push(DISCLAIMER);
  return lines.join("\n");
}

/* ----------------------------------------------------------------------------
 * The guard.
 * -------------------------------------------------------------------------- */

/** Method constants and ordinary counting words a writer may legitimately use. */
const STRUCTURAL_NUMBERS = [
  // Averages, windows and scales the method itself fixes.
  "50", "200", "14", "252", "756", "10", "100", "0",
  // Index names that contain digits.
  "500", "7", "11",
  // Small counts: "three indicators", "one of them", tier boundaries.
  "1", "2", "3", "4", "5", "6", "8", "9", "12",
];

const numeralsIn = (text: string): string[] => text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];

/** Decimal places a numeral was actually written to. */
const writtenPrecision = (raw: string): number => {
  const dot = raw.indexOf(".");
  return dot < 0 ? 0 : raw.length - dot - 1;
};

/**
 * Every magnitude the writer is allowed to use.
 *
 * Kept as NUMBERS rather than formatted strings, because a figure may
 * legitimately be rendered to a different precision than the one it was handed
 * over at, and string matching gets that wrong in both directions. It rejects
 * an honest rounding — 0.28685 written as 0.2869, which binary floating point
 * renders as 0.2868 — and it would just as happily accept a fabricated figure
 * that happened to collide with a formatting artefact.
 */
export function allowedNumbers(items: BriefChange[], asOf: string): number[] {
  const out = new Set<number>(STRUCTURAL_NUMBERS.map(Number));
  for (const part of asOf.split("-")) out.add(Number(part));
  out.add(items.length);

  const add = (v: number | null | undefined) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    out.add(Math.abs(v));
  };

  for (const { reading } of items) {
    add(reading.score);
    add(reading.value);
    add(reading.zScore);
    add(reading.percentile);
    add(reading.rsi);
    add(reading.separationPct);
    add(reading.roc1m);
    add(reading.roc3m);
    add(reading.roc6m);
    add(reading.smaFast);
    add(reading.smaSlow);
    add(reading.sessions);
    add(reading.falsificationLevel);
    add(reading.components.trend);
    add(reading.components.stretch);
    add(reading.components.momentum);
    add(reading.components.percentile);
    for (const part of reading.asOf.split("-")) out.add(Number(part));
  }
  return [...out].filter((n) => Number.isFinite(n));
}

export interface VerifyResult {
  ok: boolean;
  /** Numerals in the text that trace back to nothing computed. */
  offenders: string[];
}

/**
 * Re-read a written note and refuse any figure that was not an input.
 *
 * The instruction not to invent numbers is given in the prompt, but an
 * instruction is not a guarantee, and a fabricated statistic in a note about
 * markets is exactly the failure that matters here. This is the deterministic
 * half of that promise.
 *
 * A numeral is accepted when it sits within half a unit of the last place it
 * was WRITTEN to of some allowed magnitude — so 0.2869 and 0.287 both trace
 * back to a ratio of 0.28685, and 412.60 traces back to nothing.
 *
 * Half a unit rather than an exact match after rounding, because an exactly
 * half-way figure has no single correct rendering: 0.28685 is held in binary as
 * a hair BELOW itself, so rounding it to four places gives 0.2868 while any
 * writer working from the decimal would put 0.2869. Insisting on one of those
 * would throw away good notes over a representation detail.
 */
export function verifyBriefNumbers(text: string, allowed: number[]): VerifyResult {
  const offenders: string[] = [];
  for (const raw of numeralsIn(text)) {
    const written = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(written)) continue;
    const tolerance = 0.5 * 10 ** -writtenPrecision(raw) + 1e-9;
    const traced = allowed.some((a) => Math.abs(written - a) <= tolerance);
    if (!traced && !offenders.includes(raw)) offenders.push(raw);
  }
  return { ok: offenders.length === 0, offenders };
}

/* ----------------------------------------------------------------------------
 * The optional model writer.
 * -------------------------------------------------------------------------- */

/** Exactly what the writer is given: computed figures and the catalog's own words. */
export function briefPrompt(items: BriefChange[], asOf: string): string {
  const blocks = items.map(({ change, reading }) => {
    const rows = [
      `- indicator: ${reading.label}`,
      `- what changed: ${describeChange(change, reading)}`,
      `- tier: ${TIER_META[change.from.tier].label} -> ${TIER_META[change.to.tier].label}`,
      `- direction now: ${reading.directionLabel}`,
      `- composite score (0-10): ${fmtScore(reading.score)}`,
      `- 50-day vs 200-day separation: ${fmtPct(reading.separationPct, 2)}`,
      `- deviations from its own one-year mean: ${fmtNum(reading.zScore)}`,
      `- percentile of its three-year range: ${fmtPercentile(reading.percentile)}`,
      `- momentum of the ratio (0-100, neutral 50): ${fmtNum(reading.rsi, 1)}`,
      `- move over one/three/six months: ${fmtPct(reading.roc1m)} / ${fmtPct(reading.roc3m)} / ${fmtPct(reading.roc6m)}`,
      `- what this direction means: ${reading.meaning}`,
      `- how it could be wrong: ${reading.falsification}`,
    ];
    return rows.join("\n");
  });

  return [
    "You are writing a short market-rotation note for a research board. Every figure below has already been",
    "computed from daily closing prices by ordinary arithmetic.",
    "",
    `Session: ${asOf}`,
    `Indicators that changed state: ${items.length}`,
    "",
    blocks.join("\n\n"),
    "",
    "WRITE:",
    `- A markdown note beginning with the heading "## Rotation brief — ${asOf}".`,
    "- One short paragraph of two or three sentences per indicator, under its own level-3 heading.",
    "- Then one closing sentence on what the changes have in common, or that they have nothing in common.",
    "",
    "RULES, all of them binding:",
    "- Synthesise ONLY from the figures given above. You have no other information.",
    "- Do NOT introduce any number that is not in the data above. No price targets, no percentages you",
    "  worked out yourself, no historical statistics from memory, no dates other than the session given.",
    "  A note containing an unsupported figure is discarded in full.",
    "- Do not predict, recommend, or advise. Describe what the measurements say and what would falsify them.",
    "- Report an easing signal as plainly as a strengthening one.",
    "- Write for a reader who knows markets. No preamble, no summary of your instructions, no sign-off.",
    "- Refer only to the board and its indicators. Do not name or describe the tools, systems, models or",
    "  providers involved in producing this text, and do not refer to yourself or to these instructions.",
    "",
    "Return the markdown note as your final message, followed by a trailing json fence containing exactly",
    '{"indicatorsCovered": <how many indicators you wrote about>}. The note itself is the message text, not',
    "the fence.",
  ].join("\n");
}
