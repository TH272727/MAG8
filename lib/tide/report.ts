import { FAMILY_META, HORIZON_META } from "./catalog";
import { meaningFor } from "./normalize";
import type { TideBoard } from "./desk";
import { POSTURE_META } from "./score";

/* ============================================================================
 * The written note. Deterministic, and checked against its own inputs.
 *
 * Nothing here is worked out. Every figure the note prints was computed
 * upstream, and `verifyReportNumbers` re-reads the finished text and rejects it
 * if it contains a numeral that cannot be traced back to one of them.
 *
 * That guard exists because a write-up is the one place a wrong number is
 * invisible: a chart with a bad point looks wrong, but a sentence saying the
 * market rose nine per cent reads exactly like a sentence saying it rose seven.
 * The rule is the one the Rotation Board established — a numeral is accepted
 * when it lands within half a unit of the last place it was WRITTEN to of some
 * allowed magnitude, so 58.2 and 58 both trace back to 58.19 and 412.60 traces
 * back to nothing.
 * ========================================================================== */

const DISCLAIMER =
  "Not financial advice. These are measurements of conditions that already exist, not forecasts.";

const fmt1 = (n: number | null): string => (n === null ? "not measured" : n.toFixed(1));
const fmt0 = (n: number | null): string => (n === null ? "not measured" : n.toFixed(0));
const pct2 = (n: number | null): string => (n === null ? "not measured" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`);

export function tideReport(board: TideBoard): string {
  const lines: string[] = [];
  const push = (s = "") => lines.push(s);

  push(`## The Tide — ${board.asOf ?? "no reading"}`);
  push();

  if (board.disabled) {
    push("The desk is switched off, so there is no reading.");
    push();
    push(DISCLAIMER);
    return lines.join("\n");
  }
  if (board.empty) {
    push("Nothing has been stored yet, so there is no reading.");
    push();
    push(DISCLAIMER);
    return lines.join("\n");
  }

  /* ---- the headline: the two horizons, never averaged ---- */
  const { fast, slow, exposure, goodBad } = board;
  push(
    `The near-term reading stands at ${fmt1(fast.stress)} and the long-horizon reading at ` +
      `${fmt1(slow.stress)}, on a scale where a hundred is the worst this desk can report and fifty is ` +
      `the middle of each reading's own history. They are published separately and never averaged: they ` +
      `answer different questions over different spans.`,
  );
  push();

  for (const composite of [fast, slow]) {
    const meta = HORIZON_META[composite.horizon];
    push(`### ${meta.title} — ${fmt1(composite.stress)}`);
    push();
    push(`*${meta.question}*`);
    push();
    push(
      `Standing on ${composite.measuredGauges} of ${composite.totalGauges} readings, covering ` +
        `${fmt1(composite.weightCoveragePct)} per cent of the weight this horizon declares.`,
    );
    if (composite.unavailable) push(`\n${composite.unavailable}.`);
    push();
    const ranked = [...composite.families]
      .filter((f) => f.stress !== null)
      .sort((a, b) => (b.stress as number) - (a.stress as number));
    for (const f of ranked) {
      push(
        `- **${FAMILY_META[f.family].title}** — ${fmt1(f.stress)}, weighted ${fmt1(f.weight)}, ` +
          `from ${f.measured} of ${f.total} readings.`,
      );
    }
    push();
  }

  /* ---- good against bad ---- */
  push(`### The good against the bad`);
  push();
  push(
    `Of the weight that could be measured, ${fmt1(goodBad.goodWeightPct)} per cent sits on readings that ` +
      `are better than their own historical middle and ${fmt1(goodBad.badWeightPct)} per cent on readings ` +
      `that are worse. That is a share of weight rather than a count of readings: ten sentiment gauges ` +
      `agreeing is not more evidence than one yield curve.`,
  );
  if (goodBad.unmeasured > 0) {
    push();
    push(
      `${goodBad.unmeasured} reading${goodBad.unmeasured === 1 ? "" : "s"} could not be measured. ` +
        `They contributed nothing rather than counting as neutral, so the weight was shared among the ` +
        `readings that could be.`,
    );
  }
  push();
  if (goodBad.bad.length > 0) {
    push(`The worst readings today:`);
    push();
    for (const w of goodBad.bad.slice(0, 5)) {
      push(`- **${w.reading.gauge.label}** — ${fmt1(w.reading.stress)}, carrying ${fmt1(w.weightPct)} per cent of the weight. ${meaningFor(w.reading)}`);
    }
    push();
  }
  if (goodBad.good.length > 0) {
    push(`The best readings today:`);
    push();
    for (const w of goodBad.good.slice(0, 5)) {
      push(`- **${w.reading.gauge.label}** — ${fmt1(w.reading.stress)}, carrying ${fmt1(w.weightPct)} per cent of the weight. ${meaningFor(w.reading)}`);
    }
    push();
  }

  /* ---- the band ---- */
  push(`### Suggested exposure`);
  push();
  push(
    `**${fmt0(exposure.low)} to ${fmt0(exposure.high)} per cent in equities**, with the rest in cash. ` +
      `Posture: ${POSTURE_META[board.posture].label.toLowerCase()}.`,
  );
  push();
  push(`The arithmetic, in full: ${exposure.workings}`);
  push();
  push(
    `The near-term reading moves this band far harder than the long-horizon one does. That is deliberate ` +
      `and it is the desk's most consequential choice: valuation says a great deal about what a decade ` +
      `pays and very little about what a year does, so letting an expensive market drive the allocation ` +
      `would have meant sitting in cash for most of the past three decades.`,
  );
  for (const note of exposure.notes) {
    push();
    push(note);
  }
  push();

  /* ---- base rates ---- */
  const br = board.baseRates;
  if (br) {
    push(`### What followed, the last times it read like this`);
    push();
    if (!br.measured) {
      push(`Not measured. ${br.unavailable}.`);
    } else {
      const c = br.conditional!;
      const u = br.unconditional!;
      push(
        `The near-term reading sits in the ${br.band?.label ?? ""} band. Across ` +
          `${br.spanStart ?? ""} to ${br.spanEnd ?? ""}, that band was visited ${c.episodes} separate ` +
          `times. Over the ${br.horizonMonths} months following those visits the market returned ` +
          `${pct2(c.episodeMeanPct)} on average, against ${pct2(u.meanPct)} after every reading in the ` +
          `same history.`,
      );
      push();
      push(
        `The difference is ${pct2(br.differencePct)}, and the difference is the only part that carries ` +
          `information — a conditional figure on its own would let an ordinary market look like a finding.`,
      );
      if (br.bandSharePct !== null && br.bandSharePct >= 40) {
        push();
        push(
          `Barely conditional: the desk has spent ${fmt1(br.bandSharePct)} per cent of its measurable ` +
            `history inside this band, so "readings like today's" describes much of the record rather ` +
            `than a distinctive state.`,
        );
      }
      push();
      push(
        `The sample is ${c.episodes} draws, not ${c.months} months. ${c.months} individual months ` +
          `qualified, but a forward reading taken in March and again in April shares almost all of its ` +
          `future with itself, so the draws above are spaced a full window apart and share no month of ` +
          `outcome with one another. That is a small sample, and it is the honest one.`,
      );
    }
    push();
  }

  /* ---- what this cannot tell you ---- */
  push(`### What this cannot tell you`);
  push();
  for (const flag of board.flags) {
    push(`- ${flag}`);
  }
  if (board.unavailable.length > 0) {
    push(
      `- ${board.unavailable.length} reading${board.unavailable.length === 1 ? " was" : "s were"} not ` +
        `measured at all and took no part in any figure above.`,
    );
  }
  if (board.stale.length > 0) {
    push(
      `- ${board.stale.length} series answered but ${board.stale.length === 1 ? "has" : "have"} stopped ` +
        `being published, and ${board.stale.length === 1 ? "was" : "were"} excluded rather than read as current.`,
    );
  }
  push();
  push(DISCLAIMER);

  return lines.join("\n");
}

/* ---------------------------------------------------------------------------
 * The number guard
 * ------------------------------------------------------------------------- */

/** Method constants and ordinary counting words the writer may legitimately use. */
const STRUCTURAL_NUMBERS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 50, 100];

const numeralsIn = (text: string): string[] => text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];

/** Decimal places a numeral was actually written to. */
const writtenPrecision = (raw: string): number => {
  const dot = raw.indexOf(".");
  return dot < 0 ? 0 : raw.length - dot - 1;
};

/**
 * Every magnitude the write-up is allowed to contain.
 *
 * Collected as NUMBERS rather than as formatted strings: a figure may
 * legitimately be rendered to a different precision in two places, and string
 * matching gets that wrong in both directions — it rejects a correct rounding
 * and accepts a wrong number that happens to share a prefix.
 */
export function allowedNumbers(board: TideBoard): number[] {
  const out: number[] = [...STRUCTURAL_NUMBERS];
  const add = (n: number | null | undefined) => {
    if (n !== null && n !== undefined && Number.isFinite(n)) out.push(Math.abs(n));
  };
  const addDate = (d: string | null) => {
    if (!d) return;
    for (const part of d.split("-")) add(Number(part));
  };

  addDate(board.asOf);
  add(board.unavailable.length);
  add(board.stale.length);

  for (const composite of [board.fast, board.slow]) {
    add(composite.stress);
    add(composite.measuredGauges);
    add(composite.totalGauges);
    add(composite.weightCoveragePct);
    for (const f of composite.families) {
      add(f.stress);
      add(f.weight);
      add(f.measured);
      add(f.total);
    }
  }

  for (const w of [...board.goodBad.good, ...board.goodBad.bad, ...board.goodBad.neutral]) {
    add(w.weightPct);
    add(w.reading.stress);
    add(w.reading.value);
    add(w.reading.percentile);
    add(w.reading.zScore);
    add(w.reading.observations);
    add(w.reading.window);
    addDate(w.reading.asOf);
  }
  add(board.goodBad.goodWeightPct);
  add(board.goodBad.badWeightPct);
  add(board.goodBad.neutralWeightPct);
  add(board.goodBad.measured);
  add(board.goodBad.unmeasured);

  const e = board.exposure;
  add(e.centre);
  add(e.low);
  add(e.high);
  add(e.fastPoints);
  add(e.slowPoints);

  const br = board.baseRates;
  if (br) {
    add(br.todayStress);
    add(br.horizonMonths);
    add(br.usableMonths);
    add(br.bandSharePct);
    add(br.differencePct);
    add(br.band?.lo);
    add(br.band?.hi);
    addDate(br.spanStart ? `${br.spanStart}-01` : null);
    addDate(br.spanEnd ? `${br.spanEnd}-01` : null);
    if (br.conditional) {
      add(br.conditional.episodes);
      add(br.conditional.months);
      add(br.conditional.meanPct);
      add(br.conditional.medianPct);
      add(br.conditional.episodeMeanPct);
      add(br.conditional.episodeHitRatePct);
      add(br.conditional.positiveSharePct);
      for (const ep of br.conditional.list) {
        add(ep.changePct);
        for (const part of ep.month.split("-")) add(Number(part));
      }
    }
    if (br.unconditional) {
      add(br.unconditional.meanPct);
      add(br.unconditional.medianPct);
      add(br.unconditional.positiveSharePct);
      add(br.unconditional.months);
    }
  }

  // The exposure workings print the operator's own dials verbatim.
  for (const n of numeralsIn(e.workings)) add(Number(n.replace(/,/g, "")));
  for (const note of e.notes) for (const n of numeralsIn(note)) add(Number(n.replace(/,/g, "")));
  // Gauge prose is authored text and may name a threshold of its own.
  for (const r of [...board.readings, ...board.context]) {
    for (const source of [r.gauge.highMeans, r.gauge.lowMeans, r.gauge.falsification, r.gauge.label]) {
      for (const n of numeralsIn(source)) add(Number(n.replace(/,/g, "")));
    }
  }
  for (const flag of board.flags) for (const n of numeralsIn(flag)) add(Number(n.replace(/,/g, "")));

  return out.filter((n) => Number.isFinite(n));
}

export interface VerifyResult {
  ok: boolean;
  /** Numerals in the text that trace back to nothing computed. */
  offenders: string[];
}

/**
 * A numeral is accepted when it sits within half a unit of the last place it
 * was WRITTEN to of some allowed magnitude — so 0.2869 and 0.287 both trace
 * back to 0.28685, and 412.60 traces back to nothing.
 *
 * Half a unit rather than an exact match after rounding, because an exactly
 * half-way figure has no single correct rendering: 0.28685 is held in binary as
 * a hair BELOW itself, so rounding it to four places gives 0.2868 while any
 * writer working from the decimal would put 0.2869.
 */
export function verifyReportNumbers(text: string, allowed: number[]): VerifyResult {
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
