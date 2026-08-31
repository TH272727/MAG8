/**
 * The Rotation Board — headless operator CLI.
 *
 *   npm run rotation -- --probe                 live price-source smoke test
 *   npm run rotation -- --refresh [--dry]       fetch every catalog ticker, store the closes
 *   npm run rotation -- --coverage              what is stored, without fetching anything
 *
 * Deterministic and free: everything here is HTTP plus arithmetic, so it never
 * touches the research plan's usage window.
 */
import path from "node:path";

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
  return i >= 0 ? args[i + 1] : undefined;
};

let failures = 0;

function banner(text: string) {
  console.log(`\n${"=".repeat(72)}\n${text}\n${"=".repeat(72)}`);
}

function check(name: string, ok: boolean, detail = ""): boolean {
  console.log(` ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
  return ok;
}

/* ----------------------------------------------------------------------------
 * --probe : both price sources, live, without opening the database.
 * -------------------------------------------------------------------------- */

async function probe(): Promise<number> {
  banner("ROTATION BOARD — LIVE PRICE-SOURCE PROBE");
  const { priceSources, isIndexSymbol } = await import("../lib/rotation/bars");
  const [yahoo, nasdaq] = priceSources(150);
  const opts = { years: 5, timeoutMs: 20_000 };

  console.log("\n primary source\n");
  const rsp = await yahoo.fetch("RSP", opts);
  check("RSP returns a series", rsp.series !== null, rsp.note ?? `${rsp.series?.bars.length ?? 0} sessions`);
  if (rsp.series) {
    const b = rsp.series.bars;
    check("history is at least three years", b.length >= 750, `${b.length} sessions`);
    check("closes are adjusted for distributions", rsp.series.adjusted);
    check("series is chronological", b.every((x, i) => i === 0 || b[i - 1].date < x.date));
    check("dates are ISO", /^\d{4}-\d{2}-\d{2}$/.test(b[0].date), `${b[0].date} .. ${b[b.length - 1].date}`);
    check("closes are positive and finite", b.every((x) => Number.isFinite(x.close) && x.close > 0));
  }

  const spy = await yahoo.fetch("SPY", opts);
  check("SPY returns a series", spy.series !== null, spy.note ?? `${spy.series?.bars.length ?? 0} sessions`);

  // The trading-calendar trap: an index carries sessions the funds do not, so
  // any ratio built by zipping two arrays positionally is silently wrong.
  const vix = await yahoo.fetch("^VIX", opts);
  check("index symbol resolves", vix.series !== null, vix.note ?? `${vix.series?.bars.length ?? 0} sessions`);
  if (vix.series && spy.series) {
    const spyDates = new Set(spy.series.bars.map((b) => b.date));
    const extra = vix.series.bars.filter((b) => !spyDates.has(b.date)).map((b) => b.date);
    check(
      "index and fund calendars differ (date-keyed joins are required)",
      true,
      extra.length > 0 ? `${extra.length} index-only session(s): ${extra.slice(0, 3).join(", ")}` : "none this window",
    );
  }

  console.log("\n fallback source\n");
  const nq = await nasdaq.fetch("RSP", opts);
  check("RSP returns a series", nq.series !== null, nq.note ?? `${nq.series?.bars.length ?? 0} sessions`);
  if (nq.series) {
    check("closes are NOT adjusted (basis differs from primary)", nq.series.adjusted === false);
    check("series is chronological", nq.series.bars.every((x, i) => i === 0 || nq.series!.bars[i - 1].date < x.date));
  }
  check("index symbols are declined rather than guessed at", isIndexSymbol("^VIX"));
  const nqVix = await nasdaq.fetch("^VIX", opts);
  check("fallback declines the index symbol", nqVix.series === null, nqVix.note);

  if (rsp.series && nq.series) {
    const a = rsp.series.bars[rsp.series.bars.length - 1];
    const b = nq.series.bars[nq.series.bars.length - 1];
    const drift = Math.abs(a.close - b.close) / b.close;
    console.log(`\n INFO  latest close — primary ${a.close.toFixed(2)} (${a.date}) · fallback ${b.close.toFixed(2)} (${b.date})`);
    check("the two sources agree on the most recent close", drift < 0.02, `${(drift * 100).toFixed(2)}% apart`);
  }

  console.log("\n catalog\n");
  const { BUILT_IN_INDICATORS, catalogTickers, sectorBoardIndicators } = await import("../lib/rotation/catalog");
  const tickers = catalogTickers(BUILT_IN_INDICATORS);
  check("catalog declares indicators", BUILT_IN_INDICATORS.length > 0, `${BUILT_IN_INDICATORS.length} indicators`);
  check("catalog resolves to distinct tickers", tickers.length > 0, `${tickers.length} tickers`);
  check("sector board is eleven ratios", sectorBoardIndicators(BUILT_IN_INDICATORS).length === 11);

  banner(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  return failures === 0 ? 0 : 1;
}

/* ----------------------------------------------------------------------------
 * --refresh : fetch every catalog ticker and store it.
 * -------------------------------------------------------------------------- */

async function refresh(dry: boolean): Promise<number> {
  const { refreshBars } = await import("../lib/rotation/board");
  const { catalogTickers } = await import("../lib/rotation/catalog");

  const only = argValue("--ticker");
  const tickers = only && !only.startsWith("--") ? [only.toUpperCase()] : undefined;

  banner(`ROTATION BOARD — REFRESH${dry ? " (dry run)" : ""}`);
  console.log(` ${tickers ? tickers.length : catalogTickers().length} ticker(s), paced through one queue\n`);

  const t0 = Date.now();
  const report = await refreshBars({ tickers, dryRun: dry });

  if (report.disabled) {
    console.log(" INFO  the board is switched off (MAG8_ROTATION=0); nothing was fetched");
    return 0;
  }

  console.log(" ticker    fetched   basis                     note");
  for (const r of report.tickers) {
    const basis = r.ok ? `${r.source}${r.adjusted ? ", adjusted" : ", unadjusted"}` : "—";
    console.log(
      ` ${r.ticker.padEnd(8)} ${String(r.bars).padStart(8)}  ${basis.padEnd(25)} ${r.note ?? ""}`,
    );
  }

  console.log("");
  const { barCoverage } = await import("../lib/db");
  if (!dry) {
    console.log(" stored coverage\n");
    console.log(" ticker    sessions  first        latest       basis");
    for (const c of barCoverage()) {
      console.log(
        ` ${c.ticker.padEnd(8)} ${String(c.bars).padStart(9)}  ${c.first.padEnd(12)} ${c.latest.padEnd(12)} ` +
          `${c.source}${c.adjusted ? ", adjusted" : ", unadjusted"}${c.mixed ? "  ** MIXED BASIS **" : ""}`,
      );
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `\n ${report.ok} ok · ${report.failed} failed · ${report.thin} thin · ` +
      `${report.stored.toLocaleString("en-US")} closes ${dry ? "not stored (dry run)" : "stored"} · ${secs}s`,
  );

  // A refresh in which nothing at all was read is withheld rather than published:
  // the same rule the Bottleneck desk learned the hard way.
  if (report.readNothing) {
    console.log("\n FAIL  nothing was read — stored history left untouched");
    return 1;
  }
  if (report.failed > 0) {
    console.log(`\n WARN  ${report.failed} ticker(s) could not be refreshed; their stored history is unchanged`);
  }
  for (const r of report.tickers.filter((x) => x.rebased)) {
    console.log(` WARN  ${r.ticker}: ${r.note}`);
  }
  return 0;
}

/* ----------------------------------------------------------------------------
 * --coverage : what is stored, no network.
 * -------------------------------------------------------------------------- */

async function coverage(): Promise<number> {
  const { barCoverage } = await import("../lib/db");
  const { catalogTickers } = await import("../lib/rotation/catalog");
  banner("ROTATION BOARD — STORED COVERAGE");
  const rows = barCoverage();
  if (rows.length === 0) {
    console.log(" nothing stored yet — run: npm run rotation -- --refresh");
    return 0;
  }
  console.log(" ticker    sessions  first        latest       basis");
  for (const c of rows) {
    console.log(
      ` ${c.ticker.padEnd(8)} ${String(c.bars).padStart(9)}  ${c.first.padEnd(12)} ${c.latest.padEnd(12)} ` +
        `${c.source}${c.adjusted ? ", adjusted" : ", unadjusted"}${c.mixed ? "  ** MIXED BASIS **" : ""}`,
    );
  }
  const stored = new Set(rows.map((r) => r.ticker));
  const missing = catalogTickers().filter((t) => !stored.has(t));
  console.log(`\n ${rows.length} ticker(s) stored${missing.length > 0 ? ` · MISSING: ${missing.join(", ")}` : ""}`);
  return missing.length > 0 ? 1 : 0;
}

/* ----------------------------------------------------------------------------
 * --board : score everything from stored bars. No network.
 * -------------------------------------------------------------------------- */

const pct = (n: number | null | undefined, dp = 1): string =>
  n === null || n === undefined ? "n/a" : `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
const num = (n: number | null | undefined, dp = 2): string =>
  n === null || n === undefined ? "n/a" : n.toFixed(dp);

async function board(): Promise<number> {
  const { readBoard } = await import("../lib/rotation/board");
  const { CATEGORY_META } = await import("../lib/rotation/catalog");
  const { TIER_META } = await import("../lib/rotation/score");
  const { describeChange } = await import("../lib/rotation/state");

  const t0 = Date.now();
  const b = readBoard();
  const ms = Date.now() - t0;

  banner(`ROTATION BOARD — ${b.asOf ?? "no data"}`);
  if (b.disabled) {
    console.log(" the board is switched off (MAG8_ROTATION=0)");
    return 0;
  }
  if (!b.asOf) {
    console.log(" nothing stored yet — run: npm run rotation -- --refresh");
    return 1;
  }

  const wanted = argValue("--indicator");
  const only = wanted && !wanted.startsWith("--") ? wanted : null;

  // Grouped by category so the numbers can be sanity-checked before any UI exists.
  const byCat = new Map<string, typeof b.readings>();
  for (const r of b.readings) {
    if (only && r.id !== only) continue;
    const list = byCat.get(r.category) ?? [];
    list.push(r);
    byCat.set(r.category, list);
  }

  for (const [cat, list] of byCat) {
    console.log(`\n ${CATEGORY_META[cat as keyof typeof CATEGORY_META].title.toUpperCase()}\n`);
    console.log(
      " indicator                                        score  tier         ratio      z      pct   rsi   3mo",
    );
    for (const r of list) {
      console.log(
        ` ${r.label.slice(0, 47).padEnd(48)} ${(r.score === null ? "—" : r.score.toFixed(1)).padStart(5)}  ` +
          `${TIER_META[r.tier].short.padEnd(11)} ${num(r.value, 4).padStart(9)} ` +
          `${num(r.zScore, 2).padStart(6)} ${num(r.percentile, 0).padStart(5)} ` +
          `${num(r.rsi, 1).padStart(5)} ${pct(r.roc3m).padStart(7)}`,
      );
      console.log(`   ${r.directionLabel}${r.basis.mixed ? "   ** MIXED PRICE BASIS — cannot raise a signal **" : ""}`);
    }
  }

  if (!only) {
    console.log("\n SECTOR BOARD — strongest three-month relative strength first\n");
    console.log(" rank  sector  vs market (3mo)   score  tier");
    b.sectors.forEach((s, i) => {
      console.log(
        ` ${String(i + 1).padStart(4)}  ${s.ticker.padEnd(6)} ${pct(s.relative3m).padStart(15)}   ` +
          `${(s.score === null ? "—" : s.score.toFixed(1)).padStart(5)}  ${TIER_META[s.tier].short}`,
      );
    });
    if (b.cycle) {
      console.log(
        `\n leadership most resembles: ${b.cycle.label.toUpperCase()} ` +
          `(${b.cycle.matched.length} of the top ${4} — match strength ${(b.cycle.strength * 100).toFixed(0)}%)`,
      );
      console.log(` ${b.cycle.note}`);
      console.log(" This mapping is a convention from practitioner research, not a law.");
    }

    for (const c of b.context) {
      console.log(`\n CONTEXT — ${c.label}\n`);
      console.log(
        ` level ${num(c.value, 2)} · 1-year percentile ${num(c.percentile, 0)} · 50-day average ${num(c.smaFast, 2)}`,
      );
      console.log(` ${c.directionLabel} — ${c.meaning.slice(0, 120)}`);
    }
  }

  console.log("\n STATE CHANGES ON THE NEWEST SESSION\n");
  if (b.changesToday.length === 0) {
    console.log(" none — no indicator crossed a tier or flipped direction");
  } else {
    for (const c of b.changesToday) {
      const r = b.readings.find((x) => x.id === c.indicatorId);
      if (r) console.log(` ${describeChange(c, r)}`);
    }
  }

  if (b.unavailable.length > 0) {
    console.log("\n NOT MEASURED\n");
    for (const u of b.unavailable) console.log(` ${u.label} — ${u.reason}`);
  }
  if (b.flags.length > 0) {
    console.log("\n DISCLOSED GAPS\n");
    for (const f of b.flags) console.log(` ${f}`);
  }

  console.log(
    `\n ${b.readings.length} ratios · ${b.context.length} context · ${b.unavailable.length} unmeasured · ` +
      `computed from stored bars in ${ms}ms${b.stale ? " · DATA STALE" : ""}`,
  );
  console.log(" Not financial advice.");
  return 0;
}

/* ----------------------------------------------------------------------------
 * --note : the written note for the current state.
 * -------------------------------------------------------------------------- */

async function note(write: boolean): Promise<number> {
  const { readBoard } = await import("../lib/rotation/board");
  const { briefItems, ensureNote, noteForBoard } = await import("../lib/rotation/note");
  const { rotationSettings } = await import("../lib/rotation-settings");

  const b = readBoard();
  if (!b.asOf) {
    console.log(" nothing stored yet — run: npm run rotation -- --refresh");
    return 1;
  }
  const items = briefItems(b);
  const modelOn = rotationSettings().briefModelEnabled;

  banner(`ROTATION NOTE — ${b.asOf}`);
  console.log(
    ` ${items.length} indicator(s) changed state · model writer ${modelOn ? "ON" : "OFF (deterministic only)"}\n`,
  );

  if (write) {
    const res = await ensureNote(b);
    console.log(` ${res.message}`);
    if (res.costUsd > 0) console.log(` cost: $${res.costUsd.toFixed(4)}`);
    console.log("");
  }

  const view = noteForBoard(b);
  if (!view) {
    console.log(" no note — nothing has changed and nothing is on record");
    return 0;
  }
  console.log(
    ` [${view.origin}${view.current ? "" : ", historic"}]${view.current ? "" : ` last note from ${view.asOf}`}\n`,
  );
  console.log(
    view.body
      .split("\n")
      .map((l) => ` ${l}`)
      .join("\n"),
  );
  return 0;
}

/**
 * Sets process.exitCode rather than calling process.exit(): on Windows, exiting
 * while fetch keep-alive sockets are still open trips a libuv assertion and
 * returns 127 even on success, which would make the exit code useless as a gate.
 */
async function main() {
  if (has("--board")) {
    process.exitCode = await board();
    return;
  }
  if (has("--note")) {
    process.exitCode = await note(has("--write"));
    return;
  }
  if (has("--probe")) {
    process.exitCode = await probe();
    return;
  }
  if (has("--refresh")) {
    process.exitCode = await refresh(has("--dry"));
    return;
  }
  if (has("--coverage")) {
    process.exitCode = await coverage();
    return;
  }
  console.log(
    "Usage: npm run rotation -- --probe\n" +
      "                        | --refresh [--dry] [--ticker SYMBOL]\n" +
      "                        | --board [--indicator ID]\n" +
      "                        | --coverage",
  );
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
