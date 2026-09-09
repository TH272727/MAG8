import { numeralsIn, writtenPrecision } from "../number-verify";
import type { RiskBoard } from "./desk";

/* ============================================================================
 * The written report — deterministic, template-filled, pure.
 *
 * Every sentence is assembled from figures already computed. Nothing is
 * generated, nothing is inferred, and no model is involved at any point.
 *
 * The traceability check here is stricter than the three older writers in this
 * project, in two ways that this desk specifically needs.
 *
 * ONE, it reads SIGNS. Almost every interesting figure on a risk desk is
 * negative — a drawdown, a name carrying less risk than its weight — and a
 * sign-blind reader would accept a fall of forty-four per cent written as a
 * RISE of forty-four per cent, which is not a rounding, it is the opposite
 * claim. That forces the second difference.
 *
 * TWO, dates and company names are MASKED before the numerals are read, and
 * dates are then checked separately against the board's own set. A sign-aware
 * reader tokenises "2026-04-15" as 2026, -4 and -15, and the only way to admit
 * those is to put -4 and -15 in the allowed list — which would then silently
 * admit a fabricated "-4%" anywhere in the prose. Masking keeps the sign check
 * strong instead of trading it away for the calendar. Company names are masked
 * for the same reason: a company with a digit in its name is not a computed
 * figure, and 3M is not a claim about anything.
 * ========================================================================== */

const ISO_DATE = /\d{4}-\d{2}-\d{2}/g;

const pct = (n: number | null | undefined, d = 1): string =>
  n === null || n === undefined ? "not measured" : `${n.toFixed(d)}%`;
const dec = (n: number | null | undefined, d = 2): string =>
  n === null || n === undefined ? "not measured" : n.toFixed(d);

/** Structural numerals a template may always use: small counts and headings. */
const STRUCTURAL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100];

export interface ReportInputs {
  numbers: number[];
  dates: string[];
  names: string[];
}

/**
 * Every magnitude, date and name the write-up is allowed to contain.
 *
 * Collected as NUMBERS rather than as formatted strings, because a figure may
 * legitimately be rendered to a different precision in two places and string
 * matching gets that wrong in both directions — it rejects a correct rounding
 * and accepts a wrong number that happens to share a prefix.
 */
export function reportInputs(board: RiskBoard): ReportInputs {
  const numbers = new Set<number>(STRUCTURAL);
  const dates = new Set<string>();
  const names = new Set<string>();

  const addNum = (n: number | null | undefined) => {
    if (typeof n === "number" && Number.isFinite(n)) numbers.add(n);
  };
  const addDate = (d: string | null | undefined) => {
    if (d) dates.add(d);
  };

  const s = board.settings;
  addNum(s.volWindowDays);
  addNum(s.minSessions);
  addNum(s.sleeveMinSessions);
  addNum(s.togetherAt);
  addNum(s.maxNames);
  addNum(s.maxRows);
  addNum(s.maxPairs);
  addNum(s.barsStaleDays);
  addNum(s.historyYears);

  addNum(board.measured);
  addNum(board.unmeasured);
  addNum(board.names.length);
  addNum(board.totalNamed);
  addNum(board.pairs.length);
  addNum(board.pairSummary.together);
  addNum(board.pairSummary.namesInvolved);
  addNum(board.pairSummary.mixedBasisSuppressed);
  addNum(board.sleeveExcluded.length);
  addDate(board.asOf);

  const sl = board.sleeve;
  addNum(sl.volPct);
  addNum(sl.averageMemberVolPct);
  addNum(sl.effectivePositions);
  addNum(sl.totalReturnPct);
  addNum(sl.beta);
  addNum(sl.benchmarkVolPct);
  addNum(sl.sessions);
  addNum(sl.tickers.length);
  addNum(sl.benchmarkSessions);
  // The desk's notes quote the shortfall as well as the count, and a gap of
  // more than a handful of sessions is not covered by the structural numbers.
  if (sl.benchmarkSessions !== null) addNum(sl.sessions - sl.benchmarkSessions);
  addDate(sl.from);
  addDate(sl.to);
  if (sl.tickers.length > 0) {
    // The equal weight itself is printed, and it is a computed quantity.
    addNum(Math.round((1000 * 100) / sl.tickers.length) / 1000);
    addNum(Math.round((10 * 100) / sl.tickers.length) / 10);
  }
  if (sl.drawdown) {
    addNum(sl.drawdown.depthPct);
    addNum(sl.drawdown.sessionsToRecover);
    addDate(sl.drawdown.peakDate);
    addDate(sl.drawdown.troughDate);
    addDate(sl.drawdown.recoveredDate);
  }
  for (const c of sl.contributions) {
    addNum(c.riskSharePct);
    addNum(c.ownVolPct);
    addNum(c.excessPoints);
  }

  if (board.exposure) {
    addNum(board.exposure.low);
    addNum(board.exposure.high);
    addNum(board.exposure.centre);
  }
  if (board.atBand) {
    addNum(board.atBand.low);
    addNum(board.atBand.high);
  }

  for (const n of board.names) {
    addNum(n.volPct);
    addNum(n.downsideVolPct);
    addNum(n.beta);
    addNum(n.riskSharePct);
    addNum(n.totalReturnPct);
    addNum(n.sessions);
    addNum(n.desks);
    addDate(n.from);
    addDate(n.to);
    if (n.drawdown) {
      addNum(n.drawdown.depthPct);
      addNum(n.drawdown.sessionsToRecover);
      addDate(n.drawdown.peakDate);
      addDate(n.drawdown.troughDate);
      addDate(n.drawdown.recoveredDate);
    }
    if (n.companyName) names.add(n.companyName);
  }
  for (const p of board.pairs) {
    addNum(p.r);
    addNum(p.sessions);
    addDate(p.from);
    addDate(p.to);
  }
  for (const e of board.sleeveExcluded) addNum(e.sessions);

  return {
    numbers: [...numbers].filter((n) => Number.isFinite(n)),
    dates: [...dates],
    names: [...names],
  };
}

export interface RiskVerifyResult {
  ok: boolean;
  /** Numerals that trace back to nothing computed. */
  offenders: string[];
  /** Dates in the text that are not one of the board's own. */
  badDates: string[];
}

/**
 * Re-read the write-up and refuse anything that was not an input.
 *
 * A numeral is accepted when it sits within half a unit of the last place it
 * was WRITTEN to of some allowed magnitude, sign included — so -44.1 traces
 * back to a computed -44.14 and never to +44.1.
 */
export function verifyRiskReport(text: string, inputs: ReportInputs): RiskVerifyResult {
  const badDates: string[] = [];
  const allowedDates = new Set(inputs.dates);
  for (const d of text.match(ISO_DATE) ?? []) {
    if (!allowedDates.has(d) && !badDates.includes(d)) badDates.push(d);
  }

  let masked = text.replace(ISO_DATE, " ");
  // Longest first, so a name that contains another name is masked whole.
  for (const name of [...inputs.names].sort((a, b) => b.length - a.length)) {
    masked = masked.split(name).join(" ");
  }

  const offenders: string[] = [];
  for (const raw of numeralsIn(masked, true)) {
    const written = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(written)) continue;
    const tolerance = 0.5 * 10 ** -writtenPrecision(raw) + 1e-9;
    const traced = inputs.numbers.some((a) => Math.abs(written - a) <= tolerance);
    if (!traced && !offenders.includes(raw)) offenders.push(raw);
  }

  return { ok: offenders.length === 0 && badDates.length === 0, offenders, badDates };
}

/* ----------------------------------------------------------------------------
 * The write-up
 * -------------------------------------------------------------------------- */

export function buildRiskReport(board: RiskBoard): string {
  const lines: string[] = [];
  const s = board.settings;
  const sl = board.sleeve;

  lines.push(`# The Risk Desk`);
  lines.push("");

  if (board.disabled) {
    lines.push("This desk is switched off, so there is nothing to report.");
    return lines.join("\n");
  }

  lines.push(
    `The other desks answer what is interesting. This one answers a different question about the same ` +
      `companies: how much do they move, and how much of that movement is the same movement.`,
  );
  lines.push("");
  lines.push(
    board.asOf
      ? `Closes through ${board.asOf}. Figures are measured over the most recent ${s.volWindowDays} sessions ` +
        `unless a company has less history than that, in which case its row says how much it has.`
      : `No stored price history, so nothing below is measured.`,
  );
  lines.push("");

  if (board.empty) {
    for (const f of board.flags) lines.push(f);
    return lines.join("\n");
  }

  lines.push(
    `${board.measured} of ${board.names.length} companies were measured. A company with too little price ` +
      `history is marked NOT MEASURED and ranks last; it is never given a volatility of zero, because zero ` +
      `volatility is a real reading that means something else entirely.`,
  );
  lines.push("");

  /* ---- The basket ---- */
  lines.push(`## The basket`);
  lines.push("");
  if (sl.volPct === null || sl.tickers.length < 2) {
    lines.push(
      `Fewer than two companies share enough price history to be held as a basket, so the co-movement ` +
        `figures are not measured. That is a statement about the price records, not about the companies.`,
    );
  } else {
    const weight = Math.round((10 * 100) / sl.tickers.length) / 10;
    lines.push(
      `An equal-weight basket of the ${sl.tickers.length} companies with enough shared history — ${weight}% ` +
        `each, rebalanced every session — measured over ${sl.sessions} sessions from ${sl.from} to ${sl.to}.`,
    );
    lines.push("");
    lines.push(`| | |`);
    lines.push(`|---|---|`);
    lines.push(`| Volatility of the basket | ${pct(sl.volPct)} |`);
    lines.push(`| Average of the members' own | ${pct(sl.averageMemberVolPct)} |`);
    lines.push(`| Effective positions | ${dec(sl.effectivePositions, 1)} of ${sl.tickers.length} |`);
    if (sl.benchmarkVolPct !== null) {
      lines.push(`| ${sl.benchmarkTicker} over the same window | ${pct(sl.benchmarkVolPct)} |`);
      lines.push(`| Basket beta to ${sl.benchmarkTicker} | ${dec(sl.beta)} |`);
    }
    lines.push(`| Total return over the window | ${pct(sl.totalReturnPct)} |`);
    if (sl.drawdown) {
      const rec = sl.drawdown.recoveredDate
        ? `back to its old level by ${sl.drawdown.recoveredDate}, ${sl.drawdown.sessionsToRecover} sessions later`
        : sl.drawdown.underwaterAtEnd
          ? `not recovered by the end of the window`
          : `recovered`;
      // When the high-water mark is the level the window opened at, the fall
      // began before the window did, and naming that date as a peak would
      // imply a high was reached on it.
      const from = sl.drawdown.peakAtWindowStart
        ? `from the level it opened at on ${sl.drawdown.peakDate}`
        : `${sl.drawdown.peakDate} to ${sl.drawdown.troughDate}`;
      lines.push(`| Worst fall | ${pct(sl.drawdown.depthPct)}, ${from}, ${rec} |`);
    }
    lines.push("");
    if (sl.effectivePositions !== null) {
      lines.push(
        `Effective positions is the reading to look at, because the number of rows is the one figure on a ` +
          `watchlist that always looks reassuring. It is the members' average volatility divided by the ` +
          `basket's own, squared: companies that moved independently would give ${sl.tickers.length}, and ` +
          `companies that moved as one would give 1 however many of them there were.`,
      );
      lines.push("");
    }
  }

  /* ---- Against the tide ---- */
  if (board.exposure && board.atBand && sl.volPct !== null) {
    lines.push(`## Against the market reading`);
    lines.push("");
    lines.push(
      `The market desk publishes how much of a portfolio to hold in shares at all, and currently puts that ` +
        `at ${board.exposure.low}% to ${board.exposure.high}%. Holding this basket at that share, with the ` +
        `rest in cash, would carry ${pct(board.atBand.low)} to ${pct(board.atBand.high)} of portfolio ` +
        `volatility. Cash is treated as riskless and uncorrelated, which is the standard simplification and ` +
        `is close enough at this horizon that saying so is the whole correction.`,
    );
    lines.push("");
  }

  /* ---- Pairs ---- */
  lines.push(`## What moves together`);
  lines.push("");
  const together = board.pairs.filter((p) => p.together);
  if (together.length === 0) {
    lines.push(
      `No pair of these companies reached ${s.togetherAt} correlation over its own overlapping history, so ` +
        `none of them is being counted twice on that test.`,
    );
  } else {
    lines.push(
      `${board.pairSummary.together} pair${board.pairSummary.together === 1 ? "" : "s"} across ` +
        `${board.pairSummary.namesInvolved} companies reached ${s.togetherAt} or above, which is close enough ` +
        `to read as one position rather than two. Each pair is measured on its own overlapping history rather ` +
        `than on one shared calendar, so a company that listed recently never shortens anyone else's record.`,
    );
    lines.push("");
    lines.push(`| Pair | Correlation | Sessions | From | To |`);
    lines.push(`|---|---|---|---|---|`);
    for (const p of together.slice(0, 15)) {
      lines.push(`| ${p.a} and ${p.b} | ${dec(p.r)} | ${p.sessions} | ${p.from} | ${p.to} |`);
    }
  }
  lines.push("");
  if (board.pairSummary.mixedBasisSuppressed > 0) {
    lines.push(
      `${board.pairSummary.mixedBasisSuppressed} pair${board.pairSummary.mixedBasisSuppressed === 1 ? " is" : "s are"} ` +
        `listed but cannot raise that flag, because the two price series are on different bases: one is ` +
        `adjusted for dividends and the other is not, so the unadjusted leg carries each payment as a real ` +
        `one-day fall. That is noise, and a co-movement warning should not be built on it.`,
    );
    lines.push("");
  }

  /* ---- Names ---- */
  lines.push(`## Every company measured`);
  lines.push("");
  lines.push(`| Company | Volatility | Beta | Share of basket risk | Worst fall | Sessions |`);
  lines.push(`|---|---|---|---|---|---|`);
  for (const n of board.shown) {
    if (!n.measured) {
      lines.push(`| ${n.ticker} | NOT MEASURED | | | | ${n.sessions} |`);
      continue;
    }
    lines.push(
      `| ${n.ticker} | ${pct(n.volPct)} | ${dec(n.beta)} | ` +
        `${n.riskSharePct === null ? "not in the basket" : pct(n.riskSharePct)} | ` +
        `${pct(n.drawdown?.depthPct ?? null)} | ${n.sessions} |`,
    );
  }
  lines.push("");
  if (board.truncated) {
    lines.push(`${board.names.length} companies were measured; the table shows the first ${s.maxRows}.`);
    lines.push("");
  }

  if (board.sleeveExcluded.length > 0) {
    lines.push(
      `${board.sleeveExcluded.length} of them have too little shared history to join the basket and were left ` +
        `out of it rather than shortening everyone else's window down to theirs. They are still measured on ` +
        `their own record above.`,
    );
    lines.push("");
  }

  /* ---- The limits ---- */
  lines.push(`## What this does not tell you`);
  lines.push("");
  lines.push(
    `The basket is equal-weighted and this desk proposes no weights of its own. That is a result rather than ` +
      `a limitation: fourteen optimising allocation rules were tested against a simple equal-weight rule ` +
      `across seven datasets, and none of them was consistently better out of sample, because the error in ` +
      `estimating the inputs cost more than the optimisation gained.`,
  );
  lines.push("");
  lines.push(
    `Every co-movement figure here is a calm-weather reading. Correlation between holdings has historically ` +
      `risen specifically in falling markets and not in rising ones, so companies that look independent in ` +
      `ordinary conditions have moved together in exactly the falls that diversification is held for. The ` +
      `figures above describe the past average, not the worst day.`,
  );
  lines.push("");
  lines.push(
    `And volatility is not a forecast. It is what these prices did over a window that this desk chose, and a ` +
      `different window is a different number about the same company. Nothing here is a recommendation to ` +
      `buy, sell, or hold anything.`,
  );

  if (board.flags.length > 0) {
    lines.push("");
    lines.push(`## Notes`);
    lines.push("");
    for (const f of board.flags) lines.push(`- ${f}`);
  }

  return lines.join("\n");
}
