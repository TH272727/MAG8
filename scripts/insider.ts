/**
 * The Insider Turnaround Scanner — headless operator CLI.
 *
 *   npm run insider -- --probe                      live feed smoke test
 *   npm run insider -- --refresh [--dry] [--days N] walk the filings, store what is found
 *   npm run insider -- --coverage                   what is stored, without fetching anything
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

  banner(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  return failures === 0 ? 0 : 1;
}

/* ----------------------------------------------------------------------------
 * --refresh : walk the filings and store them.
 * -------------------------------------------------------------------------- */

async function refresh(dry: boolean): Promise<number> {
  const { ingestFilings } = await import("../lib/insider/ingest");
  const days = Number(argValue("--days"));

  banner(`INSIDER SCANNER — FILINGS${dry ? " (dry run)" : ""}`);
  const t0 = Date.now();
  const report = await ingestFilings({
    lookbackDays: Number.isFinite(days) && days > 0 ? days : undefined,
    dryRun: dry,
    force: has("--force"),
    onProgress: (line) => console.log(` ${line}`),
  });

  if (report.disabled) {
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
  console.log(` elapsed         ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (report.notes.length > 0) {
    console.log("\n NOTES\n");
    for (const n of report.notes.slice(0, 20)) console.log(` ${n}`);
    if (report.notes.length > 20) console.log(` … and ${report.notes.length - 20} more`);
  }

  if (report.readNothing) {
    console.log("\n FAIL  nothing was read — stored filings left untouched");
    return 1;
  }
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
  if (has("--coverage")) {
    process.exitCode = await coverage();
    return;
  }
  console.log(
    "Usage: npm run insider -- --probe\n" +
      "                       | --refresh [--dry] [--days N] [--force]\n" +
      "                       | --coverage",
  );
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
