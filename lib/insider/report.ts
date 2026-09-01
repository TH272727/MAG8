import fs from "node:fs";
import path from "node:path";
import type { InsiderSettings } from "../insider-settings";
import { computeOwnerEarnings } from "./dcf";
import type { Candidate, ScanView } from "./scanner";

/* ============================================================================
 * The written report — deterministic, template-filled, pure until it saves.
 *
 * Every sentence here is assembled from figures that were already computed.
 * Nothing is generated, nothing is inferred, and there is no free-form
 * narrative: that layer, if it is wanted at all, belongs to whoever reads this
 * afterwards and can be held to what it says. A report that quietly invents a
 * number is worse than no report, and this one is built so it cannot.
 *
 * The transaction table is printed line by line rather than summarised. The
 * whole product rests on a claim about who bought what, and a reader has to be
 * able to take a row of that table to the filing itself and check it — which
 * the source document explicitly asks for before trusting any of this.
 * ========================================================================== */

/** The platform's standard disclaimer, reproduced exactly. */
const DISCLAIMER =
  "**This is not financial advice.** These are research ideas for further due diligence, generated from " +
  "public data that may be delayed or inaccurate. Valuations and scenarios are estimates, not predictions. " +
  "Markets are risky and you can lose money. Always do your own research and consider consulting a licensed " +
  "financial professional before making any investment decision.";

/** The one line this product has to add to it. */
const FORM4_NOTE =
  "Insider transaction data is the legally required public disclosure of company insiders' own trades. It is " +
  "a record of what they did with their own money, not advice to mirror them, and nothing here implies any " +
  "insider endorses or is aware of this analysis.";

/* ----------------------------------------------------------------------------
 * Formatting
 * -------------------------------------------------------------------------- */

const money = (n: number | null | undefined, dp = 0): string =>
  n === null || n === undefined || !Number.isFinite(n)
    ? "—"
    : `$${n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

const pct = (n: number | null | undefined, dp = 1): string =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : `${n.toFixed(dp)}%`;

const fraction = (n: number | null | undefined, dp = 1): string =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : `${(n * 100).toFixed(dp)}%`;

const dec = (n: number | null | undefined, dp = 2): string =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : n.toFixed(dp);

const compact = (n: number | null | undefined): string => {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}k`;
  return `${sign}$${abs.toFixed(0)}`;
};

/** Transaction codes, in the words a reader can check against the filing. */
const CODE_LABEL: Record<string, string> = {
  P: "Open-market purchase",
  S: "Open-market sale",
  A: "Grant or award",
  M: "Option exercise",
  F: "Shares withheld for tax",
  G: "Gift",
  C: "Conversion",
};

/* ----------------------------------------------------------------------------
 * Header
 * -------------------------------------------------------------------------- */

function thresholdsBlock(view: ScanView): string[] {
  const s = view.settings;
  return [
    "| Threshold | Value applied |",
    "|---|---|",
    `| Risk tolerance | ${view.profile.label} |`,
    `| Filing window | ${s.lookbackDays} days |`,
    `| Minimum open-market buying | ${money(s.minDollarValue)} |`,
    `| Minimum distinct insiders | ${s.minClusterInsiders} |`,
    `| Officer or director required | ${s.requireOfficerOrDirector ? "yes" : "no"} |`,
    `| Pre-arranged buys discounted by | ${pct(s.discountPlannedPct, 0)} |`,
    `| Drawdown band | ${pct(s.minDrawdownPct)} to ${pct(s.maxDrawdownPct)} below ${
      s.measureAgainst52WeekHigh ? "the 52-week high" : "the one-year average close"
    } |`,
    `| High no older than | ${s.maxMonthsSinceHigh} months |`,
    `| Fallen-angel guard | ${s.fallenAngelGuardPct > 0 ? `reject below ${pct(s.fallenAngelGuardPct)} off the 3-year high` : "off"} |`,
    `| Steadying required | ${s.requireStabilizing ? "yes" : "no"} |`,
    `| Fundamental-strength floor | ${s.fScoreFloor} of 9 |`,
    `| Solvency grey zone | ${s.allowGreyZone ? "accepted" : "rejected"} |`,
    `| Discount rate | ${pct(s.discountRatePct)} |`,
    `| Terminal growth | ${pct(s.terminalGrowthPct)} |`,
    `| Projection | ${s.projectionYears} years, growth haircut ${pct(s.growthHaircutPct, 0)}, capped at ${pct(s.maxGrowthRatePct)} |`,
    `| Cushion required | ${pct(s.minMarginOfSafetyPct)} below the estimate |`,
  ];
}

/* ----------------------------------------------------------------------------
 * Per-company sections
 * -------------------------------------------------------------------------- */

function insiderTable(c: Candidate): string[] {
  const rows = [...c.cluster.buys].sort((a, b) => b.date.localeCompare(a.date));
  const out = [
    "| Date | Insider | Role | Code | Shares | Price | Value | Pre-arranged |",
    "|---|---|---|---|---:|---:|---:|---|",
  ];
  for (const b of rows) {
    out.push(
      `| ${b.date} | ${b.ownerLabel} | ${b.role} | ${CODE_LABEL[b.code] ?? b.code} | ` +
        `${b.shares === null ? "—" : b.shares.toLocaleString("en-US")} | ${money(b.price, 2)} | ` +
        `${compact(b.valueUsd)} | ${b.planned === "yes" ? "yes" : b.planned === "no" ? "no" : "not stated"} |`,
    );
  }
  return out;
}

function drawdownBlock(c: Candidate): string[] {
  const d = c.drawdown;
  if (!d) return ["No price history has been fetched for this company yet."];
  return [
    "| Measure | Value |",
    "|---|---|",
    `| Price (${d.asOf}) | ${money(d.price, 2)} |`,
    `| 52-week high | ${money(d.high52w, 2)} on ${d.high52wDate} |`,
    `| Below that high | ${pct(d.pctOff52wHigh)} |`,
    `| Months since the high | ${dec(d.monthsSinceHigh, 1)} |`,
    `| One-year average close | ${money(d.avg1y, 2)} |`,
    `| Below that average | ${pct(d.pctBelow1yAvg)} |`,
    `| Three-year high | ${money(d.high3y, 2)} on ${d.high3yDate} |`,
    `| Below that high | ${pct(d.pctOff3yHigh)} |`,
    `| Above the three-year low | ${pct(d.pctAbove3yLow)} |`,
    `| Last eight weeks | ${fraction(d.return8w)} |`,
    `| The eight weeks before | ${fraction(d.priorReturn8w)} |`,
    `| Decline steadied | ${d.stabilizing ? "yes" : "no"} |`,
  ];
}

function strengthBlock(c: Candidate): string[] {
  if (!c.fScore) return ["The financial-strength filters could not be computed for this company."];
  const out = [
    `Fundamental-strength score **${c.fScore.score} of 9** (${c.fScore.measured} criteria measurable).`,
    "",
    "| Criterion | Point | Detail |",
    "|---|:---:|---|",
  ];
  for (const k of c.fScore.criteria) {
    out.push(`| ${k.label} | ${k.point} | ${k.detail} |`);
  }
  if (c.altman) {
    out.push("", `Bankruptcy model: **${dec(c.altman.z, 3)}**, in its ${c.altman.zone} zone.`);
    if (c.altman.zone !== "unmeasured") {
      out.push(
        "",
        "| Ratio | Value |",
        "|---|---:|",
        `| Working capital / assets | ${dec(c.altman.parts.workingCapitalToAssets, 4)} |`,
        `| Retained earnings / assets | ${dec(c.altman.parts.retainedEarningsToAssets, 4)} |`,
        `| Operating income / assets | ${dec(c.altman.parts.ebitToAssets, 4)} |`,
        `| Market value of equity / liabilities | ${dec(c.altman.parts.equityValueToLiabilities, 4)} |`,
        `| Revenue / assets | ${dec(c.altman.parts.salesToAssets, 4)} |`,
      );
    }
  }
  return out;
}

function valuationBlock(c: Candidate): string[] {
  if (!c.dcf) return ["No valuation was attempted, because fewer than two fiscal years could be read."];
  const out: string[] = [];

  const history = computeOwnerEarnings(c.years, "total");
  out.push("Owner earnings as filed, under the conservative capital-spending assumption:", "");
  out.push("| Fiscal year | Net income | D&A | Capital spending | Working-capital change | Owner earnings |");
  out.push("|---|---:|---:|---:|---:|---:|");
  for (const y of history) {
    out.push(
      `| ${y.end} | ${compact(y.netIncome)} | ${compact(y.depreciation)} | ${compact(y.capex)} | ` +
        `${compact(y.workingCapitalChange)} | ${y.value === null ? "not computable" : compact(y.value)} |`,
    );
  }

  const p = c.dcf.total.projection;
  if (p.values) {
    out.push(
      "",
      `Projected forward ${p.values.length} years at ${fraction(p.growthRate)} a year` +
        (p.historicalRate === null
          ? " (no rate could be taken from the history)."
          : `, taken from an observed ${fraction(p.historicalRate)} and cut by the haircut and the cap.`),
      "",
      `First projected year ${compact(p.values[0])}, last ${compact(p.values[p.values.length - 1])}.`,
    );
  }

  out.push(
    "",
    "| Capital-spending assumption | Value per share | Cushion below it |",
    "|---|---:|---:|",
    `| Full capital spending (conservative) | ${money(c.dcf.perShareLow, 2)} | ${fraction(c.dcf.marginOfSafetyLow)} |`,
    `| Depreciation as maintenance | ${money(c.dcf.perShareHigh, 2)} | ${fraction(c.dcf.marginOfSafetyHigh)} |`,
  );
  if (c.dcf.spreadPct !== null) {
    out.push("", `The two assumptions leave the estimate ${pct(c.dcf.spreadPct, 0)} apart.`);
  }
  if (c.dcf.total.valuation.terminalShare !== null) {
    out.push(
      `${fraction(c.dcf.total.valuation.terminalShare, 0)} of the conservative estimate sits in the ` +
        "perpetuity beyond the projection.",
    );
  }

  if (c.quality) {
    out.push(
      "",
      "Supporting context, which gates nothing:",
      "",
      `- Owner earnings positive in ${fraction(c.quality.positiveShare, 0)} of the ${c.quality.yearsMeasured} ` +
        "years that could be computed.",
      `- Growing in ${fraction(c.quality.growingShare, 0)} of the year-on-year steps.`,
      `- Average return on equity ${fraction(c.quality.averageRoe)}.`,
      `- Total liabilities are ${dec(c.quality.leverage)} times equity.`,
    );
  }
  return out;
}

/**
 * Why this company fits the setup, assembled from the figures above.
 *
 * A template with the numbers dropped in, and deliberately nothing more. It
 * states what was measured and stops; it does not say the company is cheap,
 * good, or likely to recover, because none of those follow from arithmetic.
 */
export function whyItFits(c: Candidate, settings: InsiderSettings): string {
  const d = c.drawdown;
  const k = c.cluster;
  if (!d) return "This company has qualifying insider buying but has not yet been worked up.";

  // Singular and plural are written separately rather than patched together:
  // "one insider, X, including a named chief officer" is not a sentence.
  const solo = k.distinctBuyers === 1;
  // The role is quoted as filed rather than folded into the sentence: the
  // filing's own words are checkable, and rewriting them is not.
  const soloRole = k.buys[0]?.role ?? "insider";
  const who = solo
    ? `one insider, ${k.buyerNames[0] ?? "unnamed"} (${soloRole}),`
    : `${k.distinctBuyers} different insiders` +
      (k.anyChiefOfficer
        ? " including a named chief officer"
        : k.anyOfficerOrDirector
          ? " including an officer or director"
          : ", none of whom is an officer or director,");

  const when =
    k.firstBuy === k.lastBuy ? `on ${k.firstBuy}` : `between ${k.firstBuy} and ${k.lastBuy}`;

  const parts = [
    `Across ${k.filings === 1 ? "one filing" : `${k.filings} filings`} in this window, ` +
      `${who} bought ${compact(k.totalBoughtUsd)} of ${c.ticker} on the open market ${when}.`,
    `The shares closed at ${money(d.price, 2)} on ${d.asOf}, ${pct(d.pctOff52wHigh)} below the ` +
      `${money(d.high52w, 2)} high set ${dec(d.monthsSinceHigh, 1)} months earlier, and ` +
      `${pct(d.pctOff3yHigh)} below the highest close of the last three years.`,
  ];

  if (d.decelerating === true) {
    // A positive eight-week return is a recovery, not a slower fall. Calling a
    // rally "the fall has slowed" because the arithmetic reads improved would
    // be a true statement about the test and a false one about the stock.
    parts.push(
      d.return8w !== null && d.return8w > 0
        ? `The price has since risen: the last eight weeks returned ${fraction(d.return8w)}, against ` +
          `${fraction(d.priorReturn8w)} over the eight before them.`
        : `The fall has slowed: the last eight weeks returned ${fraction(d.return8w)} against ` +
          `${fraction(d.priorReturn8w)} over the eight before them.`,
    );
  } else if (d.aboveFourWeekLow) {
    parts.push(
      `The decline has not slowed, but the price is above its four-week low of ${money(d.low4w, 2)}.`,
    );
  }

  if (c.fScore && c.altman) {
    parts.push(
      `The balance sheet scores ${c.fScore.score} of 9 on the fundamental-strength checklist and sits in the ` +
        `${c.altman.zone} zone of the bankruptcy model at ${dec(c.altman.z, 2)}.`,
    );
  }

  if (c.dcf?.perShareLow !== null && c.dcf?.perShareLow !== undefined) {
    const cushion = c.dcf.marginOfSafetyLow;
    // A negative cushion means the price is ABOVE the estimate. Printing that
    // as "-759.5% below it" is arithmetically true and reads as nonsense.
    const gap =
      cushion === null
        ? "which cannot be compared with the price."
        : cushion >= 0
          ? `leaving the price ${fraction(cushion)} below it.`
          : `putting the price ${dec(c.price !== null && c.dcf.perShareLow > 0 ? c.price / c.dcf.perShareLow : null, 1)} ` +
            "times that estimate rather than below it.";
    parts.push(
      `Owner earnings discounted at ${pct(settings.discountRatePct)} give a conservative estimate of ` +
        `${money(c.dcf.perShareLow, 2)} a share, ${gap}`,
    );
  }

  return parts.join(" ");
}

/**
 * What would say this is wrong.
 *
 * Specific and checkable rather than a gesture at risk. Each item names a
 * figure in this report and the observation that would overturn it.
 */
export function falsifiers(c: Candidate, settings: InsiderSettings): string[] {
  const out: string[] = [];
  const d = c.drawdown;

  out.push(
    "**Insiders resume net selling.** The buying below is one window. Open-market sales by the same people, " +
      "or by other insiders, would say the reading has turned." +
      (c.cluster.distinctSellers > 0
        ? ` ${c.cluster.distinctSellers} insider${c.cluster.distinctSellers === 1 ? "" : "s"} already sold in ` +
          `this window, totalling ${compact(c.cluster.totalSoldUsd)}.`
        : ""),
  );

  if (c.fScore) {
    out.push(
      `**The strength score falls.** It is ${c.fScore.score} of 9 today. A move below ` +
        `${settings.fScoreFloor} on the next annual filing would fail the gate this company just passed.`,
    );
  }
  if (c.altman && c.altman.z !== null) {
    out.push(
      `**Solvency deteriorates.** The bankruptcy model reads ${dec(c.altman.z, 2)}. Below 1.81 it is in the ` +
        "distress zone, and the model's own caution is that the trend matters more than the level.",
    );
  }
  if (d) {
    out.push(
      `**A fresh low.** A close below ${money(d.low3y, 2)}, the lowest of the last three years, would say ` +
        "this is a continuing decline rather than a setback.",
    );
  }
  if (c.cluster.plannedBoughtUsd > 0) {
    out.push(
      `**The buying was scheduled, not chosen.** ${compact(c.cluster.plannedBoughtUsd)} of the purchases here ` +
        "were affirmed as made under a pre-arranged plan, so they were decided before anything known now.",
    );
  }
  if (c.dcf && c.dcf.spreadPct !== null && c.dcf.spreadPct > 50) {
    out.push(
      `**The valuation is assumption-led.** The two capital-spending treatments leave it ` +
        `${pct(c.dcf.spreadPct, 0)} apart, so the cushion depends on a judgement this method does not make.`,
    );
  }
  return out;
}

/* ----------------------------------------------------------------------------
 * The whole report
 * -------------------------------------------------------------------------- */

export function renderCandidate(c: Candidate, view: ScanView): string {
  const lines: string[] = [];

  lines.push(`## ${c.ticker} — ${c.companyName}`, "");
  if (c.stage === "ranked") {
    lines.push(
      `Composite **${dec(c.composite.score, 1)}** of 100` +
        (c.composite.complete
          ? "."
          : ` on ${c.composite.measured} of 4 components; no reading for ${c.composite.missing.join(", ")}.`),
      "",
    );
  } else {
    lines.push(`Not ranked. This company stopped at: ${c.stage}.`, "");
    for (const r of c.stopped) lines.push(`- ${r}`);
    lines.push("");
  }

  lines.push("### Why this fits the turnaround setup", "", whyItFits(c, view.settings), "");
  lines.push("### The insider buying, line by line", "", ...insiderTable(c), "");
  lines.push("### The price setup", "", ...drawdownBlock(c), "");
  lines.push("### Financial strength", "", ...strengthBlock(c), "");
  lines.push("### Owner-earnings valuation", "", ...valuationBlock(c), "");

  const f = falsifiers(c, view.settings);
  if (f.length > 0) {
    lines.push("### What would say this thesis is wrong", "");
    for (const item of f) lines.push(`- ${item}`);
    lines.push("");
  }

  if (c.flags.length > 0) {
    lines.push("### Disclosed gaps", "");
    for (const flag of c.flags) lines.push(`- ${flag}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function renderReport(view: ScanView): string {
  const lines: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  lines.push("# Insider turnaround scan", "");
  lines.push(
    `Run ${today}. Prices as of ${view.asOf ?? "no data"}. Filings walked over the last ` +
      `${view.settings.lookbackDays} days. Screened universe from week ${view.universeWeek ?? "unknown"}.`,
    "",
  );
  lines.push(`**Risk tolerance applied: ${view.profile.label}.** ${view.profile.blurb}`, "");
  lines.push(...thresholdsBlock(view), "");

  lines.push("## The funnel", "", "| Companies | Stage |", "|---:|---|");
  for (const step of view.funnel) lines.push(`| ${step.count} | ${step.label} |`);
  lines.push("");

  lines.push("## Ranked candidates", "");
  if (view.ranked.length === 0) {
    lines.push("No company cleared every filter at this risk tolerance.", "");
  } else {
    lines.push(
      "| # | Ticker | Price (as of) | % off 52-wk high | Months since | Insider buying | Insiders | " +
        "Strength | Solvency | Value/share | Cushion | Composite |",
      "|---:|---|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|",
    );
    view.ranked.forEach((c, i) => {
      lines.push(
        `| ${i + 1} | ${c.ticker} | ${money(c.price, 2)} (${c.drawdown?.asOf ?? "—"}) | ` +
          `${pct(c.drawdown?.pctOff52wHigh)} | ${dec(c.drawdown?.monthsSinceHigh, 1)} | ` +
          `${compact(c.cluster.totalBoughtUsd)} | ${c.cluster.distinctBuyers} | ` +
          `${c.fScore ? `${c.fScore.score}/9` : "—"} | ${c.altman?.zone ?? "—"} | ` +
          `${money(c.dcf?.perShareLow, 2)} | ${fraction(c.dcf?.marginOfSafetyLow)} | ` +
          `${dec(c.composite.score, 1)} |`,
      );
    });
    lines.push("");
  }

  if (view.rejected.length > 0) {
    lines.push("## Companies that stopped short, and where", "", "| Ticker | Stopped at | Reason |", "|---|---|---|");
    for (const c of view.rejected) {
      lines.push(`| ${c.ticker} | ${c.stage} | ${c.stopped.join(" ")} |`);
    }
    lines.push("");
  }

  if (view.belowThreshold.length > 0) {
    lines.push(
      "## Insider buying below your own thresholds",
      "",
      "These companies had genuine open-market insider buying in the window and were excluded by the " +
        "thresholds above, not by anything about the business.",
      "",
      "| Ticker | Bought | Why excluded |",
      "|---|---:|---|",
    );
    for (const b of view.belowThreshold) {
      lines.push(`| ${b.ticker} | ${compact(b.totalBoughtUsd)} | ${b.reasons.join(" ")} |`);
    }
    lines.push("");
  }

  for (const c of view.ranked) lines.push(renderCandidate(c, view), "");

  if (view.flags.length > 0) {
    lines.push("## What this scan cannot tell you", "");
    for (const f of view.flags) lines.push(`- ${f}`);
    lines.push("");
  }

  lines.push("## Disclaimer", "", `> ${DISCLAIMER}`, "", `> ${FORM4_NOTE}`, "");
  return lines.join("\n");
}

/* ----------------------------------------------------------------------------
 * Traceability
 * -------------------------------------------------------------------------- */

const NUMERAL = /-?\d[\d,]*(?:\.\d+)?/g;

function writtenPrecision(raw: string): number {
  const dot = raw.indexOf(".");
  return dot < 0 ? 0 : raw.length - dot - 1;
}

export interface VerifyResult {
  ok: boolean;
  offenders: string[];
}

/**
 * Reject any numeral in a piece of text that cannot be traced to an input.
 *
 * Carried over from the rotation board, including the tolerance rule learned
 * there: matching is to half a unit of the LAST PLACE WRITTEN, because exact
 * comparison rejects a figure printed as 0.2869 against a computed 0.28685 that
 * binary arithmetic holds a hair low.
 *
 * Nothing in this module can currently fail it — every sentence is assembled
 * from computed values. It exists so that stays true: the moment a template
 * gains a figure of its own, this catches it.
 */
export function verifyReportNumbers(text: string, allowed: number[]): VerifyResult {
  const offenders: string[] = [];
  for (const raw of text.match(NUMERAL) ?? []) {
    const written = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(written)) continue;
    const tolerance = 0.5 * 10 ** -writtenPrecision(raw) + 1e-9;
    if (!allowed.some((a) => Math.abs(written - a) <= tolerance) && !offenders.includes(raw)) {
      offenders.push(raw);
    }
  }
  return { ok: offenders.length === 0, offenders };
}

/* ----------------------------------------------------------------------------
 * Saving
 * -------------------------------------------------------------------------- */

/** The ranked table as comma-separated values, for a spreadsheet. */
export function rankedCsv(view: ScanView): string {
  const head = [
    "rank",
    "ticker",
    "company",
    "as_of",
    "price",
    "pct_off_52wk_high",
    "months_since_high",
    "pct_off_3yr_high",
    "insider_bought_usd",
    "distinct_insiders",
    "planned_usd",
    "conviction",
    "f_score",
    "altman_z",
    "altman_zone",
    "value_per_share_conservative",
    "value_per_share_maintenance",
    "margin_of_safety",
    "composite",
    "components_measured",
  ];
  const rows = view.ranked.map((c, i) =>
    [
      i + 1,
      c.ticker,
      `"${c.companyName.replace(/"/g, '""')}"`,
      c.drawdown?.asOf ?? "",
      c.price ?? "",
      c.drawdown?.pctOff52wHigh ?? "",
      c.drawdown?.monthsSinceHigh ?? "",
      c.drawdown?.pctOff3yHigh ?? "",
      c.cluster.totalBoughtUsd,
      c.cluster.distinctBuyers,
      c.cluster.plannedBoughtUsd,
      c.cluster.conviction,
      c.fScore?.score ?? "",
      c.altman?.z ?? "",
      c.altman?.zone ?? "",
      c.dcf?.perShareLow ?? "",
      c.dcf?.perShareHigh ?? "",
      c.dcf?.marginOfSafetyLow ?? "",
      c.composite.score ?? "",
      c.composite.measured,
    ].join(","),
  );
  return [head.join(","), ...rows].join("\n");
}

export interface SavedReport {
  markdownPath: string;
  csvPath: string;
}

/** Write the report and a sibling spreadsheet, both stamped with the run time. */
export function saveReport(markdown: string, view: ScanView, outDir = "output"): SavedReport {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const base = `insider-turnaround-${stamp}-${view.profile.key}`;
  const markdownPath = path.join(outDir, `${base}.md`);
  const csvPath = path.join(outDir, `${base}.csv`);
  fs.writeFileSync(markdownPath, markdown, "utf8");
  fs.writeFileSync(csvPath, rankedCsv(view), "utf8");
  return { markdownPath, csvPath };
}
