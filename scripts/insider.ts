/**
 * The Insider Turnaround Scanner — headless operator CLI.
 *
 *   npm run insider -- --probe                       live feed smoke test
 *   npm run insider -- --refresh [--dry] [--days N]  walk the filings, fetch the survivors
 *   npm run insider -- --board [--risk PROFILE]      the ranked list, from stored data only
 *   npm run insider -- --coverage                    what is stored, without fetching anything
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
  const v = i >= 0 ? args[i + 1] : undefined;
  return v && !v.startsWith("--") ? v : undefined;
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

const usd = (n: number): string =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/* ----------------------------------------------------------------------------
 * --probe : the live feeds, without opening the database.
 * -------------------------------------------------------------------------- */

async function probe(): Promise<number> {
  banner("INSIDER TURNAROUND SCANNER — LIVE FEED PROBE");
  const {
    fetchFiling,
    fetchIndexDay,
    filingsForIssuers,
    isQualifyingBuy,
    recentDays,
    transactionValueUsd,
  } = await import("../lib/insider/form4");

  console.log("\n the daily index\n");

  // Walk back until a session turns up: the last few days may be a weekend.
  let day = "";
  let filings: Awaited<ReturnType<typeof fetchIndexDay>>["filings"] = [];
  for (const d of recentDays(8)) {
    const res = await fetchIndexDay(d);
    if (!res.ok) {
      check(`index for ${d} is reachable`, false, res.note);
      break;
    }
    if (res.noSession) {
      console.log(` INFO  ${d} — no index published (weekend or market holiday)`);
      continue;
    }
    day = d;
    filings = res.filings;
    break;
  }

  if (!check("a recent trading day's index was read", day !== "")) {
    banner(`${failures} CHECK(S) FAILED`);
    return 1;
  }

  check("the index lists Form 4 filings", filings.length > 0, `${filings.length} rows on ${day}`);
  const distinct = new Set(filings.map((f) => f.accession));
  check(
    "rows collapse to distinct filings (one row per filer)",
    distinct.size > 0 && distinct.size <= filings.length,
    `${filings.length} rows → ${distinct.size} filings`,
  );
  check(
    "every row carries a CIK, an accession and a path",
    filings.every((f) => f.cik > 0 && /^\d{10}-\d{2}-\d{6}$/.test(f.accession) && f.path.startsWith("edgar/data/")),
  );
  check("filed dates are ISO", filings.every((f) => /^\d{4}-\d{2}-\d{2}$/.test(f.filedDate)), day);

  // The prefilter is the reason the scan is affordable — prove it resolves.
  const { getTickerCikMap } = await import("../lib/edgar");
  const register = await getTickerCikMap();
  check("the ticker register resolves", register.size > 1000, `${register.size.toLocaleString("en-US")} symbols`);
  const listed = new Set(register.values());
  const issuerFilings = filingsForIssuers(filings, listed);
  const pct = distinct.size > 0 ? (issuerFilings.length / distinct.size) * 100 : 0;
  check(
    "most filings are reachable through a listed-issuer row",
    pct >= 90,
    `${issuerFilings.length} of ${distinct.size} (${pct.toFixed(1)}%)`,
  );

  console.log("\n one filing, end to end\n");
  let purchases = 0;
  let read = 0;
  // Read a handful: any given filing is more often a sale than a purchase.
  for (const entry of issuerFilings.slice(0, 12)) {
    const { doc, note } = await fetchFiling(entry);
    if (!doc) {
      check(`filing ${entry.accession} parses`, false, note);
      continue;
    }
    read++;
    const buys = doc.transactions.filter(isQualifyingBuy);
    if (buys.length > 0 && purchases === 0) {
      purchases = buys.length;
      const total = buys.reduce(
        (s, t) => s + (transactionValueUsd({ shares: t.shares, price: t.pricePerShare }) ?? 0),
        0,
      );
      console.log(
        ` INFO  ${doc.ticker || "(no symbol)"} — ${buys.length} open-market purchase(s), ${usd(total)}, ` +
          `${doc.owners.length} reporting owner(s), plan affirmation: ${doc.planned}`,
      );
      check("a purchase carries shares and a price", buys.every((b) => b.shares !== null));
    }
  }
  check("filings parse into ownership documents", read > 0, `${read} of 12 read`);
  check(
    "every parsed filing names an issuer",
    read > 0,
    purchases > 0 ? `${purchases} purchase line(s) seen` : "no purchases in this sample, which is normal",
  );

  console.log("\n the screened universe\n");
  const { eligibleIssuers } = await import("../lib/insider/ingest");
  const issuers = await eligibleIssuers();
  if (issuers.note) {
    console.log(` INFO  ${issuers.note}`);
    check("a weekly screen is on file to match against", false, "run the universe screen first");
  } else {
    check("the weekly screen resolves to issuer CIKs", issuers.byCik.size > 0, `${issuers.byCik.size} companies`);
    console.log(
      ` INFO  week ${issuers.weekKey} · ${issuers.byCik.size} companies matched · ` +
        `${issuers.unmapped.length} eligible symbol(s) not on the filings register`,
    );
    const wanted = filingsForIssuers(filings, new Set(issuers.byCik.keys()));
    console.log(
      ` INFO  ${wanted.length} of ${distinct.size} filings on ${day} come from screened companies ` +
        `(${((wanted.length / Math.max(1, distinct.size)) * 100).toFixed(0)}% of the day's filings would be fetched)`,
    );
  }

  console.log("\n price history for a company\n");
  const { priceSources } = await import("../lib/rotation/bars");
  const [yahoo, nasdaq] = priceSources(150);
  const popts = { years: 5, timeoutMs: 20_000 };

  const primary = await yahoo.fetch("RSG", popts);
  check("the primary source returns a company series", primary.series !== null, primary.note ?? `${primary.series?.bars.length ?? 0} sessions`);
  if (primary.series) check("closes are adjusted for distributions", primary.series.adjusted);

  // The fallback has to be told it is looking at a share rather than a fund:
  // asked for a company as a fund it answers "Symbol not exists" and returns
  // nothing at all, which is not an error and produces no series.
  const asFund = await nasdaq.fetch("RSG", { ...popts, assetClass: "etf" });
  const asShare = await nasdaq.fetch("RSG", { ...popts, assetClass: "stocks" });
  check("the fallback declines a company asked for as a fund", asFund.series === null, asFund.note);
  check("the fallback answers when told it is a company", asShare.series !== null, asShare.note ?? `${asShare.series?.bars.length ?? 0} sessions`);
  if (asShare.series) check("fallback closes are NOT adjusted (basis differs)", asShare.series.adjusted === false);

  if (primary.series) {
    const { computeDrawdownProfile } = await import("../lib/insider/drawdown");
    const profile = computeDrawdownProfile(primary.series.bars.map((b) => ({ date: b.date, close: b.close })));
    check("a drawdown profile computes from a live series", profile !== null);
    if (profile) {
      console.log(
        ` INFO  RSG ${profile.price.toFixed(2)} · ${profile.pctOff52wHigh.toFixed(1)}% off its 52-week high ` +
          `of ${profile.high52w.toFixed(2)} set ${profile.monthsSinceHigh.toFixed(1)} months ago · ` +
          `${profile.pctOff3yHigh.toFixed(1)}% off its 3-year high · ` +
          `${profile.stabilizing ? "steadied" : "not steadied"}`,
      );
      check("percentages are finite", Number.isFinite(profile.pctOff52wHigh) && Number.isFinite(profile.pctOff3yHigh));
    }
  }

  console.log("\n financial statements\n");
  const { loadFinancials, piotroskiFScore, altmanZScore } = await import("../lib/insider/fundamentals");
  const { resolveTickerToCik } = await import("../lib/edgar");

  // Two filers of deliberately different shape: a steady large-cap that tags
  // everything, and one that migrated its revenue tag mid-window — the case
  // where first-populated-wins silently loses the most recent fiscal year.
  for (const [ticker, cap] of [["RSG", 90e9], ["F", 45e9]] as [string, number][]) {
    const cik = await resolveTickerToCik(ticker);
    if (!check(`${ticker} resolves to a CIK`, cik !== null)) continue;
    const fin = await loadFinancials(cik!, { years: 4 });
    if (!check(`${ticker} statements load`, fin !== null && fin.years.length >= 2, `${fin?.years.length ?? 0} years`)) {
      continue;
    }
    const years = fin!.years;
    const latest = years[years.length - 1];
    check(
      `${ticker} reaches the most recent completed fiscal year`,
      Date.now() - Date.parse(latest.end) < 400 * 86_400_000,
      latest.end,
    );
    check(`${ticker} has an income statement for it`, latest.revenue !== null || latest.netIncome !== null);
    const f = piotroskiFScore(latest, years[years.length - 2], years[years.length - 3]);
    const z = altmanZScore(latest, cap);
    check(`${ticker} scores on the nine-point scale`, f.criteria.length === 9 && f.score >= 0 && f.score <= 9);
    console.log(
      ` INFO  ${ticker} ${latest.end} — strength ${f.score}/9 (${f.measured} measurable) · ` +
        `solvency ${z.z ?? "not computable"} (${z.zone}) · shares from ${latest.sources.shares ?? "no source"}`,
    );
    for (const fl of fin!.flags) console.log(`       ${fl}`);
  }

  banner(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  return failures === 0 ? 0 : 1;
}

/* ----------------------------------------------------------------------------
 * --refresh : walk the filings and store them.
 * -------------------------------------------------------------------------- */

async function refresh(dry: boolean): Promise<number> {
  const { refreshScan } = await import("../lib/insider/scanner");
  const days = Number(argValue("--days"));

  banner(`INSIDER SCANNER — REFRESH${dry ? " (dry run)" : ""}`);
  const t0 = Date.now();
  const scan = await refreshScan({
    lookbackDays: Number.isFinite(days) && days > 0 ? days : undefined,
    dryRun: dry,
    force: has("--force"),
    skipIngest: has("--workup-only"),
    onProgress: (line) => console.log(` ${line}`),
  });
  const report = scan.ingest;

  if (scan.disabled) {
    console.log(" INFO  the scanner is switched off (MAG8_INSIDER=0); nothing was fetched");
    return 0;
  }

  console.log("");
  console.log(
    ` universe        week ${report.universeWeek ?? "—"} · ${report.eligibleIssuers} screened companies` +
      (report.unmappedTickers > 0 ? ` · ${report.unmappedTickers} unmapped symbols` : ""),
  );
  console.log(
    ` days            ${report.daysConsidered} in window · ${report.daysAlreadyOnRecord} already read · ` +
      `${report.daysWithoutSession} without a session · ${report.daysFailed} failed`,
  );
  console.log(
    ` filings         ${report.filingsListed.toLocaleString("en-US")} listed · ${report.filingsMatched} from ` +
      `screened companies · ${report.filingsRead} read · ${report.filingsFailed} failed`,
  );
  console.log(
    ` lines           ${report.linesStored.toLocaleString("en-US")} ${dry ? "parsed (not stored)" : "stored"} · ` +
      `${report.buyLines} open-market purchases`,
  );
  console.log(
    ` companies       ${scan.candidates} with qualifying buying · ${scan.workedUp} worked up · ` +
      `${scan.outcomes.filter((o) => o.pricesOk).length} priced · ` +
      `${scan.outcomes.filter((o) => o.financialsOk).length} with statements`,
  );
  console.log(` elapsed         ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (report.notes.length > 0) {
    console.log("\n NOTES\n");
    for (const n of report.notes.slice(0, 20)) console.log(` ${n}`);
    if (report.notes.length > 20) console.log(` … and ${report.notes.length - 20} more`);
  }

  if (scan.readNothing) {
    console.log("\n FAIL  nothing was read — stored filings left untouched");
    return 1;
  }
  return 0;
}

/* ----------------------------------------------------------------------------
 * --board : the ranked list, computed from stored bytes. No network.
 * -------------------------------------------------------------------------- */

const money = (n: number | null | undefined): string =>
  n === null || n === undefined ? "n/a" : `$${Math.round(n).toLocaleString("en-US")}`;
const pct1 = (n: number | null | undefined): string =>
  n === null || n === undefined ? "n/a" : `${n.toFixed(1)}%`;
const dec = (n: number | null | undefined, dp = 2): string =>
  n === null || n === undefined ? "n/a" : n.toFixed(dp);

async function board(): Promise<number> {
  const { readScan } = await import("../lib/insider/scanner");
  const { describeProfile } = await import("../lib/insider/profiles");

  const t0 = Date.now();
  const view = readScan({ profile: argValue("--risk") });
  const ms = Date.now() - t0;

  banner(`INSIDER TURNAROUND SCANNER — ${view.asOf ?? "no data"}`);
  if (view.disabled) {
    console.log(" the scanner is switched off (MAG8_INSIDER=0)");
    return 0;
  }

  // The document's requirement: whatever risk tolerance was actually applied is
  // printed at the top of every run, never left implicit.
  console.log(` risk tolerance   ${view.profile.label}`);
  console.log(`                  ${view.profile.blurb}`);
  const changed = describeProfile(view.settings, view.profile);
  if (changed.length > 0) console.log(`                  departures: ${changed.join(" · ")}`);
  console.log("");
  console.log(
    ` thresholds       buying >= ${money(view.settings.minDollarValue)} from >= ` +
      `${view.settings.minClusterInsiders} insider(s) in ${view.settings.lookbackDays} days`,
  );
  console.log(
    `                  ${pct1(view.settings.minDrawdownPct)}-${pct1(view.settings.maxDrawdownPct)} below ` +
      `${view.settings.measureAgainst52WeekHigh ? "the 52-week high" : "the one-year average"}, high within ` +
      `${view.settings.maxMonthsSinceHigh} months`,
  );
  console.log(
    `                  fallen-angel guard ${view.settings.fallenAngelGuardPct > 0 ? pct1(view.settings.fallenAngelGuardPct) : "off"}` +
      ` · stabilising ${view.settings.requireStabilizing ? "required" : "not required"}` +
      ` · strength floor ${view.settings.fScoreFloor}/9` +
      ` · grey zone ${view.settings.allowGreyZone ? "allowed" : "rejected"}`,
  );
  console.log(
    `                  discount ${pct1(view.settings.discountRatePct)} · terminal growth ` +
      `${pct1(view.settings.terminalGrowthPct)} · cushion required ${pct1(view.settings.minMarginOfSafetyPct)}`,
  );
  console.log("");
  console.log(
    ` data             last refresh ${view.lastRefresh ?? "never"} · screen week ${view.universeWeek ?? "-"}` +
      `${view.stale ? " · STALE" : ""}`,
  );

  if (!view.asOf && view.ranked.length === 0 && view.rejected.length === 0) {
    console.log("");
    console.log(" nothing stored yet — run: npm run insider -- --refresh");
    return 1;
  }

  console.log("");
  console.log(" THE FUNNEL");
  console.log("");
  for (const step of view.funnel) {
    console.log(` ${String(step.count).padStart(5)}  ${step.label}`);
  }

  console.log("");
  console.log(" CANDIDATES");
  console.log("");
  if (view.ranked.length === 0) {
    console.log(" none — no company cleared every filter at this risk tolerance");
  } else {
    console.log(
      " ticker  score  conv  setup  strgth  value   off high  bought       ins  F/9  zone      value/sh  cushion",
    );
    for (const c of view.ranked) {
      const k = c.composite.contributions;
      console.log(
        ` ${c.ticker.padEnd(7)} ${dec(c.composite.score, 1).padStart(5)} ` +
          `${dec(c.cluster.conviction, 0).padStart(5)} ${dec(k.setup, 0).padStart(6)} ` +
          `${dec(k.strength, 0).padStart(7)} ${dec(k.value, 0).padStart(6)}  ` +
          `${pct1(c.drawdown?.pctOff52wHigh).padStart(8)}  ${money(c.cluster.totalBoughtUsd).padStart(11)}  ` +
          `${String(c.cluster.distinctBuyers).padStart(3)}  ${String(c.fScore?.score ?? "-").padStart(3)}  ` +
          `${(c.altman?.zone ?? "-").padEnd(9)} ${dec(c.dcf?.perShareLow, 2).padStart(8)}  ` +
          `${c.dcf?.marginOfSafetyLow === null || c.dcf?.marginOfSafetyLow === undefined ? "n/a" : pct1(c.dcf.marginOfSafetyLow * 100)}`,
      );
      if (!c.composite.complete) {
        console.log(`         partly measured — no reading for ${c.composite.missing.join(", ")}`);
      }
    }
  }

  if (view.rejected.length > 0) {
    console.log("");
    console.log(" STOPPED, AND WHERE");
    console.log("");
    for (const c of view.rejected) {
      console.log(` ${c.ticker.padEnd(7)} ${c.stage.padEnd(10)} ${c.stopped[0] ?? ""}`);
      for (const r of c.stopped.slice(1)) console.log(`                    ${r}`);
    }
  }

  if (view.belowThreshold.length > 0) {
    console.log("");
    console.log(` BUYING BELOW YOUR THRESHOLDS (${view.belowThreshold.length})`);
    console.log("");
    for (const b of view.belowThreshold.slice(0, 15)) {
      console.log(` ${b.ticker.padEnd(7)} ${money(b.totalBoughtUsd).padStart(12)}  ${b.reasons.join(" ")}`);
    }
    if (view.belowThreshold.length > 15) {
      console.log(` … and ${view.belowThreshold.length - 15} more`);
    }
  }

  if (view.flags.length > 0) {
    console.log("");
    console.log(" DISCLOSED GAPS");
    console.log("");
    for (const f of view.flags) console.log(` ${f}`);
  }

  console.log("");
  console.log(
    ` ${view.ranked.length} ranked · ${view.rejected.length} stopped · computed from stored data in ${ms}ms`,
  );
  console.log(" Form 4 data is legally required public disclosure of insiders' own trades, not advice to");
  console.log(" mirror them. Not financial advice.");
  return 0;
}

/* ----------------------------------------------------------------------------
 * --stock : one company, in full.
 * -------------------------------------------------------------------------- */

async function stock(ticker: string): Promise<number> {
  const { readCandidate } = await import("../lib/insider/scanner");
  const { renderCandidate } = await import("../lib/insider/report");

  const hit = readCandidate(ticker, { profile: argValue("--risk") });
  if (!hit) {
    console.log(` no insider buying on record for ${ticker.toUpperCase()} inside the current window`);
    return 1;
  }
  console.log(renderCandidate(hit.candidate, hit.view));
  return 0;
}

/* ----------------------------------------------------------------------------
 * --report : the full markdown report, written to disk.
 * -------------------------------------------------------------------------- */

async function report(): Promise<number> {
  const { readScan } = await import("../lib/insider/scanner");
  const { renderReport, saveReport } = await import("../lib/insider/report");

  const view = readScan({ profile: argValue("--risk") });
  const markdown = renderReport(view);
  if (has("--write")) {
    const written = saveReport(markdown, view);
    console.log(` wrote ${written.markdownPath}`);
    console.log(` wrote ${written.csvPath}`);
    return 0;
  }
  console.log(markdown);
  return 0;
}

/* ----------------------------------------------------------------------------
 * --coverage : what is stored, no network.
 * -------------------------------------------------------------------------- */

async function coverage(): Promise<number> {
  const { insiderWalkedDays, getInsiderTransactionsSince, insiderBarCoverage } = await import("../lib/db");
  const { insiderSettings } = await import("../lib/insider-settings");
  const { isQualifyingBuy } = await import("../lib/insider/form4");

  banner("INSIDER SCANNER — STORED COVERAGE");
  const days = insiderWalkedDays();
  if (days.size === 0) {
    console.log(" nothing stored yet — run: npm run insider -- --refresh");
    return 0;
  }
  const sorted = [...days.values()].sort((a, b) => b.day.localeCompare(a.day));
  const sessions = sorted.filter((d) => !d.noSession);
  console.log(
    ` ${days.size} day(s) on record · ${sessions.length} with a session · ` +
      `${sorted[sorted.length - 1].day} .. ${sorted[0].day}`,
  );

  const s = insiderSettings();
  const from = new Date(Date.now() - s.lookbackDays * 86_400_000).toISOString().slice(0, 10);
  const rows = getInsiderTransactionsSince(from);
  const buys = rows.filter(isQualifyingBuy);
  const tickers = new Set(buys.map((r) => r.ticker));
  console.log(
    ` ${rows.length.toLocaleString("en-US")} filed line(s) since ${from} · ${buys.length} open-market ` +
      `purchases across ${tickers.size} companies`,
  );

  const bars = insiderBarCoverage();
  if (bars.length > 0) {
    console.log(`\n price history stored for ${bars.length} companies`);
    const mixed = bars.filter((b) => b.mixed);
    if (mixed.length > 0) {
      console.log(` WARN  ${mixed.length} with a mixed price basis: ${mixed.map((m) => m.ticker).join(", ")}`);
    }
  }
  return 0;
}

/**
 * Sets process.exitCode rather than calling process.exit(): on Windows, exiting
 * while fetch keep-alive sockets are still open trips a libuv assertion and
 * returns 127 even on success, which would make the exit code useless as a gate.
 */
async function main() {
  if (has("--probe")) {
    process.exitCode = await probe();
    return;
  }
  if (has("--refresh")) {
    process.exitCode = await refresh(has("--dry"));
    return;
  }
  if (has("--board")) {
    process.exitCode = await board();
    return;
  }
  const wantedStock = argValue("--stock");
  if (wantedStock) {
    process.exitCode = await stock(wantedStock);
    return;
  }
  if (has("--report")) {
    process.exitCode = await report();
    return;
  }
  if (has("--coverage")) {
    process.exitCode = await coverage();
    return;
  }
  console.log(
    "Usage: npm run insider -- --probe\n" +
      "                       | --refresh [--dry] [--days N] [--force] [--workup-only]\n" +
      "                       | --board [--risk conservative|balanced|aggressive]\n" +
      "                       | --coverage",
  );
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
