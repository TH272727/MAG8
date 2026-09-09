/**
 * The Risk Desk — headless operator CLI.
 *
 *   npm run risk -- --probe                      live price-source smoke test
 *   npm run risk -- --refresh [--dry] [--force] [--ticker T]
 *   npm run risk -- --board                      every figure, no network
 *   npm run risk -- --pairs                      the full co-movement table
 *   npm run risk -- --stock TICKER               one company in detail
 *   npm run risk -- --coverage                   what price history is stored
 *   npm run risk -- --report [--write]           the deterministic write-up
 *
 * Everything except --refresh and --probe is read-only and costs nothing: no
 * figure on this desk is stored, so every one of them is re-derived on the spot
 * from closes the desks already hold.
 */
import path from "node:path";
import { writeFileSync } from "node:fs";

// tsx does not auto-load env files the way Next does.
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
  const v = i >= 0 ? args[i + 1] : undefined;
  // A flag immediately followed by another flag has no value — the CLI bug this
  // repo has already met once, where "--force" was read as a ticker and
  // replaced eight real companies with an entry named "--FORCE".
  return v && !v.startsWith("--") ? v : undefined;
};

function banner(text: string) {
  console.log(`\n${"=".repeat(76)}\n${text}\n${"=".repeat(76)}`);
}

const pct = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? "—" : `${n.toFixed(d)}%`);
const num = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? "—" : n.toFixed(d));

const REASON: Record<string, string> = {
  "no-history": "no stored prices",
  "too-short": "too little history",
  "no-variation": "price never moved",
};

/* ---------------------------------------------------------------------------
 * --probe : does anything still answer?
 * ------------------------------------------------------------------------- */

async function probe(): Promise<number> {
  const { fetchTicker } = await import("../lib/rotation/bars");
  const { benchmarkTicker } = await import("../lib/risk-settings");

  banner("RISK DESK — LIVE SOURCE PROBE");

  const checks: { label: string; ok: boolean; detail: string }[] = [];

  for (const [label, ticker, assetClass] of [
    ["benchmark", benchmarkTicker(), "etf"],
    ["a common share", "AAPL", "stocks"],
  ] as const) {
    const r = await fetchTicker(ticker, {
      years: 1,
      timeoutMs: 20_000,
      gapMs: 150,
      minBars: 60,
      fallbackEnabled: true,
      assetClass,
    });
    checks.push({
      label: `${label} (${ticker})`,
      ok: Boolean(r.series),
      detail: r.series
        ? `${r.series.bars.length} closes from ${r.series.source}, ${r.series.adjusted ? "adjusted" : "raw"}, ` +
          `through ${r.series.bars[r.series.bars.length - 1]?.date}`
        : (r.attempts[r.attempts.length - 1]?.note ?? "no source answered"),
    });
  }

  // The fallback source is the one that has silently died before: it was pinned
  // to funds, and a common share answered "Symbol not exists" with no error.
  const { priceSources } = await import("../lib/rotation/bars");
  const fallback = priceSources(150).find((s) => s.id === "nasdaq");
  if (fallback) {
    const r = await fallback.fetch("AAPL", { years: 1, timeoutMs: 20_000, assetClass: "stocks" });
    checks.push({
      label: "fallback source, common share",
      ok: Boolean(r.series),
      detail: r.series ? `${r.series.bars.length} closes, ${r.series.adjusted ? "adjusted" : "raw"}` : (r.note ?? "no answer"),
    });
  }

  console.log("");
  for (const c of checks) console.log(` ${c.ok ? "PASS" : "FAIL"}  ${c.label.padEnd(30)} ${c.detail}`);

  const failed = checks.filter((c) => !c.ok).length;
  console.log(`\n ${checks.length - failed}/${checks.length} passed`);
  return failed === 0 ? 0 : 1;
}

/* ---------------------------------------------------------------------------
 * --refresh
 * ------------------------------------------------------------------------- */

async function refresh(): Promise<number> {
  const { refreshRisk } = await import("../lib/risk/desk");

  const only = argValue("--ticker");
  const dryRun = has("--dry");
  const force = has("--force");

  banner(`RISK DESK — REFRESH${dryRun ? " (dry run, nothing written)" : ""}${force ? " (forced)" : ""}`);

  const t0 = Date.now();
  const report = await refreshRisk({
    tickers: only ? [only.toUpperCase()] : undefined,
    dryRun,
    force,
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  if (report.disabled) {
    console.log(" the desk is switched off (MAG8_RISK=0)");
    return 0;
  }

  console.log("");
  for (const t of report.tickers) {
    const where = t.from === "fetched" ? `fetched ${t.source}` : t.from ? `reused ${t.from}` : "—";
    console.log(
      ` ${t.ok ? "ok  " : "FAIL"} ${t.ticker.padEnd(8)}${String(t.bars).padStart(6)} closes  ${where.padEnd(16)}` +
        `${t.rebased ? " REBASED" : ""}${t.note ? ` ${t.note}` : ""}`,
    );
  }

  console.log(
    `\n ${report.ok} ok · ${report.failed} failed · ${report.reused} reused from another desk · ` +
      `${report.stored} rows stored · ${secs}s`,
  );
  if (report.readNothing) {
    console.log(" NOTHING was read. Stored history is untouched and the board keeps its previous figures.");
    return 1;
  }
  return 0;
}

/* ---------------------------------------------------------------------------
 * --board
 * ------------------------------------------------------------------------- */

async function board(): Promise<number> {
  const { readRisk } = await import("../lib/risk/desk");

  const t0 = Date.now();
  const b = readRisk();
  const ms = Date.now() - t0;

  banner(
    `THE RISK DESK — ${b.measured} measured of ${b.names.length} named` +
      (b.asOf ? ` · closes through ${b.asOf}` : "") +
      ` · ${b.settings.volWindowDays}-session window`,
  );

  if (b.disabled) {
    console.log(" the desk is switched off (MAG8_RISK=0)");
    return 0;
  }
  if (b.empty) {
    for (const f of b.flags) console.log(` ${f}`);
    return 0;
  }

  const s = b.sleeve;
  console.log("\n THE BASKET — equal weight, rebalanced each session\n");
  if (s.volPct === null) {
    console.log("   not measured");
  } else {
    console.log(`   members                 ${s.tickers.length}`);
    console.log(`   window                  ${s.sessions} sessions, ${s.from} to ${s.to}`);
    console.log(`   volatility              ${pct(s.volPct)}   (members average ${pct(s.averageMemberVolPct)})`);
    console.log(
      `   effective positions     ${num(s.effectivePositions, 1)} of ${s.tickers.length}` +
        (s.effectivePositions !== null && s.effectivePositions < s.tickers.length * 0.6
          ? "   <- concentration the row count hides"
          : ""),
    );
    if (s.benchmarkVolPct !== null) {
      console.log(`   versus ${(s.benchmarkTicker ?? "benchmark").padEnd(16)}${pct(s.benchmarkVolPct)} volatility, beta ${num(s.beta)}`);
    }
    if (s.drawdown) {
      console.log(
        `   worst fall              ${pct(s.drawdown.depthPct)}  ${s.drawdown.peakDate} to ${s.drawdown.troughDate}` +
          (s.drawdown.recoveredDate
            ? `, back by ${s.drawdown.recoveredDate}`
            : s.drawdown.underwaterAtEnd
              ? ", not yet recovered"
              : ""),
      );
    }
    console.log(`   total return            ${pct(s.totalReturnPct)} over the window`);
  }

  if (b.exposure && b.atBand) {
    console.log("\n AGAINST THE TIDE\n");
    console.log(
      `   the tide's band         ${b.exposure.low}-${b.exposure.high}% in equities` +
        (b.exposure.partial ? " (partial)" : ""),
    );
    console.log(
      `   this basket at it       ${pct(b.atBand.low)} to ${pct(b.atBand.high)} portfolio volatility, ` +
        `the rest in cash`,
    );
  }

  console.log("\n NAMES — ordered by share of the basket's risk\n");
  console.log(
    `   ${"ticker".padEnd(8)}${"vol".padStart(8)}${"beta".padStart(7)}${"risk%".padStart(8)}` +
      `${"worst".padStart(9)}${"sess".padStart(7)}  store`,
  );
  for (const n of b.shown) {
    if (!n.measured) {
      console.log(`   ${n.ticker.padEnd(8)}${"NOT MEASURED".padStart(30)}   ${REASON[n.reason ?? ""] ?? n.reason ?? ""}`);
      continue;
    }
    console.log(
      `   ${n.ticker.padEnd(8)}${pct(n.volPct).padStart(8)}${num(n.beta).padStart(7)}` +
        `${(n.riskSharePct === null ? "—" : n.riskSharePct.toFixed(1)).padStart(8)}` +
        `${pct(n.drawdown?.depthPct ?? null, 0).padStart(9)}${String(n.sessions).padStart(7)}  ${n.store ?? "—"}` +
        `${n.adjusted ? "" : "  RAW CLOSES"}`,
    );
  }
  if (b.truncated) console.log(`   ... ${b.names.length - b.shown.length} more`);

  const p = b.pairSummary;
  console.log(`\n MOVES TOGETHER — ${b.settings.togetherAt} or above, on each pair's own overlap\n`);
  if (p.together === 0) {
    console.log("   no pair reaches the threshold");
  } else {
    for (const pair of b.pairs.filter((x) => x.together).slice(0, 12)) {
      console.log(
        `   ${pair.a.padEnd(7)}<-> ${pair.b.padEnd(7)} ${num(pair.r)}   ${pair.sessions} sessions ` +
          `${pair.from} to ${pair.to}`,
      );
    }
    console.log(
      `\n   ${p.together} pair(s) across ${p.namesInvolved} companies read as one position rather than two.`,
    );
  }
  if (p.mixedBasisSuppressed > 0) {
    console.log(
      `   ${p.mixedBasisSuppressed} pair(s) are shown but cannot raise that flag: their two price series are on ` +
        `different bases.`,
    );
  }

  if (b.flags.length > 0) {
    console.log("\n NOTES\n");
    for (const f of b.flags) console.log(`   ${f}`);
  }

  console.log("\n COUNTER-EVIDENCE\n");
  console.log(
    "   Correlation between holdings has historically risen in falling markets and not in rising ones, so the",
  );
  console.log(
    "   diversification measured above is a calm-weather figure and understates how much of this moves as one",
  );
  console.log("   thing on the day it matters (Longin & Solnik 2001).");
  console.log(
    "   The basket is equal-weighted because fourteen optimising rules failed to beat equal weight out of",
  );
  console.log("   sample across seven datasets (DeMiguel, Garlappi & Uppal 2009). No weight here is a recommendation.");

  console.log(`\n read in ${ms}ms, no network\n`);
  return 0;
}

/* ---------------------------------------------------------------------------
 * --pairs
 * ------------------------------------------------------------------------- */

async function pairs(): Promise<number> {
  const { readRisk } = await import("../lib/risk/desk");
  const b = readRisk({ withExposure: false });
  banner(`CO-MOVEMENT — ${b.pairs.length} pairs, strongest first`);
  if (b.pairs.length === 0) {
    console.log(" nothing measured");
    return 0;
  }
  console.log("");
  for (const p of b.pairs) {
    console.log(
      ` ${p.a.padEnd(7)}${p.b.padEnd(7)} ${num(p.r).padStart(6)}  ${String(p.sessions).padStart(5)} sessions  ` +
        `${p.from} to ${p.to}${p.together ? "   ONE POSITION" : ""}${p.mixedBasis ? "   mixed basis" : ""}`,
    );
  }
  console.log("");
  return 0;
}

/* ---------------------------------------------------------------------------
 * --stock
 * ------------------------------------------------------------------------- */

async function stock(ticker: string): Promise<number> {
  const { readRisk } = await import("../lib/risk/desk");
  const b = readRisk();
  const t = ticker.toUpperCase();
  const n = b.names.find((x) => x.ticker === t);

  banner(`${t} — RISK DESK`);
  if (!n) {
    console.log(` ${t} is not in this desk's population (the companies more than one desk named).`);
    return 1;
  }
  if (!n.measured) {
    console.log(` NOT MEASURED — ${REASON[n.reason ?? ""] ?? n.reason}`);
    console.log(` ${n.sessions} sessions of stored history.`);
    return 0;
  }

  console.log("");
  console.log(` ${n.companyName ?? ""}${n.sector ? `  ·  ${n.sector}` : ""}`);
  console.log(` named by ${n.desks} desk(s) · prices from the ${n.store} store · ${n.adjusted ? "adjusted" : "RAW"} closes`);
  console.log("");
  console.log(` window                 ${n.sessions} sessions, ${n.from} to ${n.to}`);
  console.log(` volatility             ${pct(n.volPct)} annualised`);
  console.log(` downside only          ${pct(n.downsideVolPct)}`);
  console.log(` beta vs ${(b.benchmark + "               ").slice(0, 15)}${num(n.beta)}`);
  console.log(` total return           ${pct(n.totalReturnPct)} over the window`);
  if (n.drawdown) {
    console.log(
      ` worst fall             ${pct(n.drawdown.depthPct)}  ${n.drawdown.peakDate} to ${n.drawdown.troughDate}` +
        (n.drawdown.recoveredDate
          ? `, back by ${n.drawdown.recoveredDate} (${n.drawdown.sessionsToRecover} sessions)`
          : ", not yet recovered"),
    );
  }
  if (n.inSleeve) {
    console.log(
      ` share of basket risk   ${pct(n.riskSharePct)} on a ${(100 / b.sleeve.tickers.length).toFixed(1)}% weight`,
    );
  } else {
    console.log(" share of basket risk   not in the basket — too little shared history");
  }

  const related = b.pairs.filter((p) => p.a === t || p.b === t).slice(0, 10);
  if (related.length > 0) {
    console.log("\n moves with\n");
    for (const p of related) {
      const other = p.a === t ? p.b : p.a;
      console.log(
        `   ${other.padEnd(8)}${num(p.r).padStart(6)}  ${p.sessions} sessions${p.together ? "   ONE POSITION" : ""}` +
          `${p.mixedBasis ? "   mixed basis" : ""}`,
      );
    }
  }
  console.log("");
  return 0;
}

/* ---------------------------------------------------------------------------
 * --coverage
 * ------------------------------------------------------------------------- */

async function coverage(): Promise<number> {
  const { riskCoverage } = await import("../lib/risk/desk");
  const rows = riskCoverage();
  banner(`STORED PRICE HISTORY — ${rows.length} names`);
  console.log("");
  console.log(` ${"ticker".padEnd(8)}${"rows".padStart(7)}  ${"store".padEnd(10)}${"from".padEnd(12)}${"to".padEnd(12)}stores`);
  for (const r of rows) {
    console.log(
      ` ${r.ticker.padEnd(8)}${String(r.rows).padStart(7)}  ${(r.store ?? "—").padEnd(10)}` +
        `${(r.oldest ?? "—").padEnd(12)}${(r.newest ?? "—").padEnd(12)}${r.stores}`,
    );
  }
  const missing = rows.filter((r) => r.rows === 0).length;
  console.log(`\n ${rows.length - missing} priced · ${missing} with no stored history\n`);
  return 0;
}

/* ---------------------------------------------------------------------------
 * --report
 * ------------------------------------------------------------------------- */

async function report(): Promise<number> {
  const { readRisk } = await import("../lib/risk/desk");
  const { buildRiskReport, verifyRiskReport, reportInputs } = await import("../lib/risk/report");

  const b = readRisk();
  const text = buildRiskReport(b);
  console.log(`\n${text}\n`);

  const check = verifyRiskReport(text, reportInputs(b));
  if (!check.ok) {
    if (check.offenders.length > 0) {
      console.error(`UNTRACEABLE NUMBERS in the write-up: ${check.offenders.join(", ")}`);
    }
    if (check.badDates.length > 0) {
      console.error(`DATES that are not the board's own: ${check.badDates.join(", ")}`);
    }
    return 1;
  }
  console.log("every numeral and every date in the write-up traces to an input.");

  if (has("--write")) {
    const out = path.join(process.cwd(), `risk-desk-${new Date().toISOString().slice(0, 10)}.md`);
    writeFileSync(out, text, "utf8");
    console.log(`written to ${out}`);
  }
  return 0;
}

/* ------------------------------------------------------------------------- */

async function main(): Promise<number> {
  if (has("--probe")) return probe();
  if (has("--refresh")) return refresh();
  if (has("--board")) return board();
  if (has("--pairs")) return pairs();
  if (has("--coverage")) return coverage();
  if (has("--report")) return report();
  const t = argValue("--stock");
  if (t) return stock(t);

  console.log(`
The Risk Desk — how much these names move, and how much of that is the same movement.

  npm run risk -- --probe                          live price-source smoke test
  npm run risk -- --refresh [--dry] [--force] [--ticker T]
  npm run risk -- --board                          every figure, no network
  npm run risk -- --pairs                          the full co-movement table
  npm run risk -- --stock TICKER                   one company in detail
  npm run risk -- --coverage                       what price history is stored
  npm run risk -- --report [--write]               the deterministic write-up

It reports and it flags. It does not propose a trade, suggest a weight, or
connect to anything that could place one.
`);
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
