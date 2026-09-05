import path from "node:path";

/* ============================================================================
 * The Tide — command line.
 *
 *   npm run tide -- --probe                        live source smoke test
 *   npm run tide -- --refresh [--dry] [--series ID] [--no-breadth]
 *   npm run tide -- --board                        the whole desk, no network
 *   npm run tide -- --gauge ID                     one reading, in detail
 *   npm run tide -- --baserates                    what followed, last time
 *   npm run tide -- --coverage                     what is stored
 *   npm run tide -- --report [--write]             the deterministic write-up
 *
 * Every subcommand imports its dependencies dynamically, so `--probe` never
 * opens the database — which matters because opening it during a live research
 * run marks that run interrupted.
 * ========================================================================== */

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {
    /* file absent — fine */
  }
}

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const argValue = (name: string): string | undefined => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? v : undefined;
};

let failures = 0;

function banner(text: string) {
  console.log(`\n${"=".repeat(78)}\n${text}\n${"=".repeat(78)}`);
}

function check(name: string, ok: boolean, detail = ""): boolean {
  console.log(` ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
  return ok;
}

const num = (n: number | null | undefined, dp = 1): string =>
  n === null || n === undefined || !Number.isFinite(n) ? "n/a" : n.toFixed(dp);
const pct = (n: number | null | undefined, dp = 1): string =>
  n === null || n === undefined || !Number.isFinite(n) ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;

/* ---------------------------------------------------------------------------
 * probe — live sources, no database
 * ------------------------------------------------------------------------- */

async function probe(): Promise<number> {
  banner("THE TIDE — live source probe");
  const { CONNECTORS, parseCboeCsv, parseFredCsv } = await import("../lib/tide/feeds");
  const { BUILT_IN_GAUGES } = await import("../lib/tide/catalog");

  // Parsers first: they are pure and a failure here explains every later one.
  const htmlLooking = parseFredCsv("<!DOCTYPE html>\n<html><head></head></html>");
  check(
    "an HTML page is refused rather than parsed as a series",
    htmlLooking.rows.length === 0 && Boolean(htmlLooking.note),
    htmlLooking.note,
  );
  const blank = parseFredCsv("observation_date,X\n2026-01-01,1.5\n2026-02-01,\n2026-03-01,.");
  check(
    "a blank field is not read as zero",
    blank.rows.length === 1 && blank.rows[0].value === 1.5,
    `${blank.rows.length} observation kept from three rows`,
  );
  const cboe = parseCboeCsv("DATE,OPEN,HIGH,LOW,CLOSE\n09/04/2026,14.15,14.58,13.80,14.53");
  check(
    "US-ordered dates become ISO dates",
    cboe.rows.length === 1 && cboe.rows[0].date === "2026-09-04",
    cboe.rows[0]?.date,
  );

  const opts = { years: 30, timeoutMs: 30_000, gapMs: 200 };
  const { allSeries } = await import("../lib/tide/catalog");
  const catalogue = allSeries();
  const sample = ["t10y3m", "sahm", "gdp", "equities", "vix", "vix3m", "spx", "wilshire"];

  banner("Sources");
  for (const id of sample) {
    const series = catalogue.find((x) => x.id === id);
    if (!series) {
      check(`${id} exists in the catalogue`, false);
      continue;
    }
    const connector = CONNECTORS[series.connector];
    const out = await connector.fetch(series, opts);
    const latest = out.observations[out.observations.length - 1];
    check(
      `${id.padEnd(10)} ${series.connector}`,
      out.observations.length > 0,
      out.observations.length > 0
        ? `${out.observations.length} observations, ${out.observations[0].date} → ${latest.date} = ${latest.value}`
        : out.note,
    );
    if (out.droppedFuture > 0) {
      console.log(`       note: ${out.droppedFuture} future-dated rows dropped as projections`);
    }
  }

  banner("Catalogue integrity");
  const ids = new Set(catalogue.map((x) => x.id));
  const dangling = BUILT_IN_GAUGES.flatMap((g) => g.inputs.filter((i) => !ids.has(i)));
  check("every gauge names a series that exists", dangling.length === 0, dangling.join(", "));
  const scored = BUILT_IN_GAUGES.filter((g) => g.kind === "scored");
  check(`${scored.length} scored readings, ${BUILT_IN_GAUGES.length - scored.length} context`, scored.length > 20);

  banner(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
  return failures === 0 ? 0 : 1;
}

/* ---------------------------------------------------------------------------
 * refresh
 * ------------------------------------------------------------------------- */

async function refresh(dry: boolean): Promise<number> {
  const { refreshTide } = await import("../lib/tide/desk");
  banner(`THE TIDE — refresh${dry ? " (dry run: nothing is stored)" : ""}`);

  const only = argValue("--series");
  const report = await refreshTide({
    seriesIds: only ? [only] : undefined,
    dryRun: dry,
    onProgress: (msg) => console.log(`  … ${msg}`),
  });

  if (report.disabled) {
    console.log("\nThe desk is switched off (MAG8_TIDE=0). Nothing was fetched.");
    return 0;
  }

  console.log();
  console.log(`  ${"series".padEnd(22)}${"obs".padStart(7)}  ${"first".padEnd(12)}${"latest".padEnd(12)}note`);
  console.log(`  ${"-".repeat(74)}`);
  for (const r of report.series) {
    // "not fetched" is a category, not a failure: a hand-entered or locally
    // computed series is meant to be left alone by a refresh.
    const byDesign = r.note?.startsWith("not fetched");
    const flag = byDesign ? "--" : r.ok ? (r.stale ? "STALE" : "") : "FAIL";
    console.log(
      `  ${r.seriesId.padEnd(22)}${String(r.observations).padStart(7)}  ${(r.first ?? "-").padEnd(12)}` +
        `${(r.latest ?? "-").padEnd(12)}${flag}${flag && r.note ? " " : ""}${r.note ?? ""}`,
    );
  }

  if (report.breadth) {
    const b = report.breadth;
    console.log(
      b.skipped
        ? `\n  breadth: skipped — ${b.note}`
        : `\n  breadth: ${b.ok} of ${b.requested} companies read, ${b.failed} failed, ` +
          `${b.rebased} rebased, ${b.storedBars.toLocaleString()} closes stored`,
    );
  }

  console.log(`\n  ${report.ok} read, ${report.failed} failed, ${report.skipped} not fetched by design.`);
  console.log(`  ${report.stored.toLocaleString()} observations stored.`);

  if (report.readNothing) {
    console.log("\n  Every source that was asked failed. Nothing was stored — a dead network is not a market");
    console.log("  reading, and an empty refresh must never overwrite a good one.");
    return 1;
  }
  return 0;
}

/* ---------------------------------------------------------------------------
 * board
 * ------------------------------------------------------------------------- */

async function board(): Promise<number> {
  const { readTide } = await import("../lib/tide/desk");
  const { FAMILY_META, HORIZON_META } = await import("../lib/tide/catalog");
  const { POSTURE_META } = await import("../lib/tide/score");

  const t0 = Date.now();
  const b = readTide({ withBaseRates: has("--baserates") });
  const ms = Date.now() - t0;

  banner("THE TIDE");
  if (b.disabled) {
    console.log("The desk is switched off (MAG8_TIDE=0).");
    return 0;
  }
  if (b.empty) {
    console.log("Nothing has been stored yet. Run: npm run tide -- --refresh");
    return 1;
  }

  console.log(`As of ${b.asOf ?? "unknown"}  ·  read in ${ms}ms, no network`);

  /* ---- the two composites ---- */
  console.log();
  for (const c of [b.fast, b.slow]) {
    const meta = HORIZON_META[c.horizon];
    console.log(`  ${meta.title.toUpperCase()}`);
    console.log(`    ${meta.question}`);
    console.log(
      `    stress ${num(c.stress)} / 100   ` +
        `${c.measuredGauges} of ${c.totalGauges} readings measured   ` +
        `${num(c.weightCoveragePct)}% of the declared weight in use` +
        (c.partial ? "   PARTIAL" : ""),
    );
    if (c.unavailable) console.log(`    ${c.unavailable}`);
    for (const f of c.families) {
      const bar = f.stress === null ? "  not measured" : renderBar(f.stress);
      console.log(
        `      ${FAMILY_META[f.family].title.padEnd(22)} w${String(f.weight).padStart(4)}  ` +
          `${num(f.stress).padStart(5)}  ${bar}  (${f.measured}/${f.total})`,
      );
    }
    console.log();
  }

  /* ---- good against bad ---- */
  const gb = b.goodBad;
  console.log("  GOOD AGAINST BAD — by weight, not by count");
  console.log(
    `    ${num(gb.goodWeightPct)}% of measured weight reads better than its own middle, ` +
      `${num(gb.badWeightPct)}% reads worse` +
      (gb.neutralWeightPct ? `, ${num(gb.neutralWeightPct)}% exactly neutral` : ""),
  );
  console.log(`    ${gb.measured} readings measured, ${gb.unmeasured} not measured and excluded`);
  console.log();
  console.log(`    ${"the worst readings".padEnd(46)}stress  weight`);
  for (const w of gb.bad.slice(0, 8)) {
    console.log(`      ${w.reading.gauge.label.slice(0, 44).padEnd(44)}${num(w.reading.stress).padStart(6)}  ${num(w.weightPct).padStart(5)}%`);
  }
  console.log(`    ${"the best readings".padEnd(46)}stress  weight`);
  for (const w of gb.good.slice(0, 8)) {
    console.log(`      ${w.reading.gauge.label.slice(0, 44).padEnd(44)}${num(w.reading.stress).padStart(6)}  ${num(w.weightPct).padStart(5)}%`);
  }

  /* ---- the band ---- */
  const e = b.exposure;
  console.log();
  console.log("  SUGGESTED EXPOSURE");
  console.log(`    ${num(e.low, 0)}% to ${num(e.high, 0)}% in equities  ·  posture: ${POSTURE_META[b.posture].label}`);
  console.log(`    ${e.workings}`);
  for (const n of e.notes) console.log(`    ${n}`);

  /* ---- base rates ---- */
  if (b.baseRates) printBaseRates(b.baseRates);

  /* ---- what could not be read ---- */
  if (b.unavailable.length > 0) {
    console.log(`\n  NOT MEASURED (${b.unavailable.length})`);
    for (const u of b.unavailable) console.log(`    ${u.label} — ${u.reason}`);
  }
  if (b.stale.length > 0) {
    console.log(`\n  STALE (${b.stale.length})`);
    for (const u of b.stale) console.log(`    ${u.label} — ${u.reason}`);
  }

  console.log("\n  WHAT THIS CANNOT TELL YOU");
  for (const f of b.flags) console.log(`    ${wrap(f, 4)}`);
  console.log("\n  Not financial advice. These are measurements of conditions, not forecasts.");
  return 0;
}

function renderBar(stress: number): string {
  const cells = 20;
  const filled = Math.round((stress / 100) * cells);
  return `[${"#".repeat(filled)}${"-".repeat(cells - filled)}]`;
}

function wrap(text: string, indent: number): string {
  const width = 92 - indent;
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else line += ` ${w}`;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join(`\n${" ".repeat(indent)}`);
}

/* ---------------------------------------------------------------------------
 * gauge
 * ------------------------------------------------------------------------- */

async function gauge(id: string): Promise<number> {
  const { readTide } = await import("../lib/tide/desk");
  const { HORIZON_META, FAMILY_META } = await import("../lib/tide/catalog");

  const b = readTide({ withHistory: true });
  const r = [...b.readings, ...b.context].find((x) => x.gauge.id === id);
  if (!r) {
    console.log(`No reading named "${id}".`);
    console.log(`Known: ${[...b.readings, ...b.context].map((x) => x.gauge.id).join(", ")}`);
    return 2;
  }

  banner(r.gauge.label);
  const g = r.gauge;
  console.log(`  ${FAMILY_META[g.family].title} · ${HORIZON_META[g.horizon].title} · ${g.kind}`);
  if (g.attribution) console.log(`  After ${g.attribution}.`);
  console.log();
  console.log(`  reading      ${num(r.value, 3)}  (as of ${r.asOf ?? "n/a"})`);
  console.log(`  percentile   ${num(r.percentile)} of its own ${r.window} monthly observations`);
  console.log(`  z-score      ${num(r.zScore, 2)}`);
  console.log(`  stress       ${num(r.stress)} / 100  ${r.stress === null ? "" : renderBar(r.stress)}`);
  console.log(`  polarity     ${g.polarity === "high-is-bad" ? "a HIGH reading is bad" : "a HIGH reading is good"}`);
  console.log(`  observations ${r.observations}`);
  if (r.unavailable) console.log(`  NOT MEASURED — ${r.unavailable}`);
  if (r.staleReason) console.log(`  STALE — ${r.staleReason}`);

  console.log(`\n  A HIGH reading means\n    ${wrap(g.highMeans, 4)}`);
  console.log(`\n  A LOW reading means\n    ${wrap(g.lowMeans, 4)}`);
  console.log(`\n  How this could be misleading\n    ${wrap(g.falsification, 4)}`);

  const hist = r.history ?? [];
  if (hist.length > 0) {
    console.log(`\n  Last 12 monthly readings`);
    for (const p of hist.slice(-12)) {
      console.log(`    ${p.date}  ${num(p.value, 3).padStart(12)}  stress ${num(p.stress).padStart(5)}`);
    }
  }
  return 0;
}

/* ---------------------------------------------------------------------------
 * base rates
 * ------------------------------------------------------------------------- */

async function baserates(): Promise<number> {
  const { readTide } = await import("../lib/tide/desk");
  const b = readTide({ withBaseRates: true });
  banner("WHAT FOLLOWED, THE LAST TIMES THE DESK READ LIKE THIS");
  if (!b.baseRates) {
    console.log("Not enough is stored to measure a conditional history.");
    return 1;
  }
  printBaseRates(b.baseRates);
  return 0;
}

function printBaseRates(br: import("../lib/tide/baserates").TideBaseRates): void {
  console.log("\n  CONDITIONAL HISTORY — the near-term reading against what the market did next");
  console.log(
    `    today ${num(br.todayStress)} → band ${br.band?.label ?? "n/a"}   ` +
      `forward window ${br.horizonMonths} months   ` +
      `history ${br.spanStart ?? "?"} → ${br.spanEnd ?? "?"} (${br.usableMonths} usable months)`,
  );
  if (!br.measured) {
    console.log(`    NOT MEASURED — ${br.unavailable}`);
    return;
  }
  const c = br.conditional!;
  const u = br.unconditional!;
  console.log(`    ${"".padEnd(28)}${"mean".padStart(9)}${"median".padStart(9)}${"positive".padStart(10)}${"sample".padStart(14)}`);
  console.log(
    `    ${"after readings in this band".padEnd(28)}${pct(c.episodeMeanPct).padStart(9)}` +
      `${pct(c.medianPct).padStart(9)}${num(c.episodeHitRatePct, 0).padStart(9)}%` +
      `${String(`${c.episodes} draws`).padStart(14)}`,
  );
  console.log(
    `    ${"after every reading".padEnd(28)}${pct(u.meanPct).padStart(9)}` +
      `${pct(u.medianPct).padStart(9)}${num(u.positiveSharePct, 0).padStart(9)}%` +
      `${String(`${u.months} months`).padStart(14)}`,
  );
  console.log(`\n    difference: ${pct(br.differencePct)}   ${br.bandSharePct !== null && br.bandSharePct >= 40 ? "BARELY CONDITIONAL — " : ""}the desk has spent ${num(br.bandSharePct)}% of its measurable history in this band`);
  if (br.overlappingWindows) {
    console.log(
      `    OVERLAPPING WINDOWS — draws sit closer together than the ${br.horizonMonths}-month forward\n` +
        "    window, so neighbours share part of the same future and the count overstates the evidence.",
    );
  }
  if (c.list.length > 0) {
    console.log(`\n    ${"draw".padEnd(14)}${`next ${br.horizonMonths}m`.padStart(12)}`);
    for (const e of c.list.slice(0, 20)) {
      console.log(`    ${e.month.padEnd(14)}${pct(e.changePct).padStart(12)}`);
    }
    console.log(
      `\n    Each draw is one month, spaced a full ${br.horizonMonths}-month window from the next, so no\n` +
        "    two share a month of outcome. Qualifying months that fell inside another draw's window are\n" +
        `    counted for scale (${c.months} of them) but are not additional evidence.`,
    );
  }
  console.log("\n    Only the distance between the conditional figure and the plain one carries information.");
  console.log("    This describes what followed in the past. It does not forecast.");
}

/* ---------------------------------------------------------------------------
 * coverage
 * ------------------------------------------------------------------------- */

async function coverage(): Promise<number> {
  const { tideCoverageReport } = await import("../lib/tide/desk");
  banner("THE TIDE — what is stored");
  const rows = tideCoverageReport();
  console.log(`  ${"series".padEnd(22)}${"conn".padEnd(9)}${"obs".padStart(7)}  ${"first".padEnd(12)}${"latest".padEnd(12)}`);
  console.log(`  ${"-".repeat(76)}`);
  let missing = 0;
  for (const r of rows) {
    if (r.observations === 0) missing++;
    console.log(
      `  ${r.seriesId.padEnd(22)}${r.connector.padEnd(9)}${String(r.observations).padStart(7)}  ` +
        `${(r.first ?? "-").padEnd(12)}${(r.latest ?? "-").padEnd(12)}${r.stale ? "STALE" : ""}`,
    );
  }
  const stale = rows.filter((r) => r.stale && r.observations > 0);
  if (stale.length > 0) {
    console.log(`\n  ${stale.length} stored series are no longer current:`);
    for (const r of stale) console.log(`    ${r.seriesId} — ${r.reason}`);
  }
  console.log(`\n  ${rows.length - missing} of ${rows.length} series stored.`);
  return missing === rows.length ? 1 : 0;
}

/* ---------------------------------------------------------------------------
 * report
 * ------------------------------------------------------------------------- */

async function report(write: boolean): Promise<number> {
  const { readTide } = await import("../lib/tide/desk");
  const { tideReport, verifyReportNumbers, allowedNumbers } = await import("../lib/tide/report");
  const b = readTide({ withBaseRates: true });
  if (b.empty) {
    console.log("Nothing has been stored yet. Run: npm run tide -- --refresh");
    return 1;
  }
  const text = tideReport(b);
  console.log(text);
  const verdict = verifyReportNumbers(text, allowedNumbers(b));
  if (!verdict.ok) {
    console.log(`\n[!] Untraceable numerals in the write-up: ${verdict.offenders.join(", ")}`);
    return 1;
  }
  if (write) {
    const fs = await import("node:fs");
    const out = path.join(process.cwd(), `tide-${b.asOf ?? "latest"}.md`);
    fs.writeFileSync(out, text, "utf8");
    console.log(`\nWritten to ${out}`);
  }
  return 0;
}

/* ------------------------------------------------------------------------- */

async function main() {
  if (has("--probe")) {
    process.exitCode = await probe();
    return;
  }
  if (has("--refresh")) {
    process.exitCode = await refresh(has("--dry"));
    return;
  }
  if (has("--gauge")) {
    const id = argValue("--gauge");
    process.exitCode = id ? await gauge(id) : 2;
    return;
  }
  if (has("--baserates") && !has("--board")) {
    process.exitCode = await baserates();
    return;
  }
  if (has("--board")) {
    process.exitCode = await board();
    return;
  }
  if (has("--coverage")) {
    process.exitCode = await coverage();
    return;
  }
  if (has("--report")) {
    process.exitCode = await report(has("--write"));
    return;
  }
  console.log(
    "Usage:\n" +
      "  npm run tide -- --probe\n" +
      "  npm run tide -- --refresh [--dry] [--series ID]\n" +
      "  npm run tide -- --board [--baserates]\n" +
      "  npm run tide -- --gauge ID\n" +
      "  npm run tide -- --baserates\n" +
      "  npm run tide -- --coverage\n" +
      "  npm run tide -- --report [--write]\n",
  );
  process.exitCode = 2;
}

// Sets process.exitCode rather than calling process.exit(): on Windows,
// exiting while fetch keep-alive sockets are still open trips a libuv
// assertion and returns 127 even on success.
main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
