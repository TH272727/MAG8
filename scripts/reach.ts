/**
 * The evidence layer — headless operator CLI.
 *
 *   npm run reach -- --probe                        live source smoke test
 *   npm run reach -- --refresh TICKER[,TICKER…] [--dry] [--force]
 *   npm run reach -- --board [--ticker T]           what is stored, no network
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

const tickerList = (raw: string | undefined): string[] =>
  (raw ?? "").split(",").map((t) => t.trim().toUpperCase()).filter(Boolean);

/* ----------------------------------------------------------------------------
 * --probe : live sources, WITHOUT opening the database.
 *
 * Importing lib/db runs boot reconciliation, which marks a live run
 * interrupted — so the probe passes cache:false and never reaches a module
 * that touches storage. Same rule the salience audit follows.
 * -------------------------------------------------------------------------- */

async function probe(): Promise<number> {
  banner("EVIDENCE LAYER — LIVE SOURCE PROBE");
  const { readCompanyFilings, classifyForm, filingUrl } = await import("../lib/reach/filings");

  console.log("\n form classification (pure)\n");
  check("a periodic report is periodic", classifyForm("10-Q") === "periodic");
  check("an amended annual report still classifies", classifyForm("10-K/A") === "periodic");
  check("a foreign issuer's event form classifies", classifyForm("6-K") === "event");
  check("a prospectus variant classifies", classifyForm("424B5") === "offering");
  // The two that must NOT be read as capital raising or as company news.
  check("routine equity-comp registration is ignored", classifyForm("S-8") === null);
  check("insider forms are left to the scanner", classifyForm("4") === null && classifyForm("144") === null);
  check("a beneficial-ownership schedule is not an offering", classifyForm("SC 13G") === null);

  console.log("\n live filing history\n");
  const opts = { lookbackDays: 365, max: 6, timeoutMs: 20_000, cache: false as const };
  const ionq = await readCompanyFilings("IONQ", opts);
  check("a known filer resolves to a CIK", ionq.cik !== null, String(ionq.cik));
  check("filings come back", ionq.recent.length > 0, `${ionq.recent.length} in the window`);
  check("nothing is reported unavailable", ionq.unavailable === undefined, ionq.unavailable ?? "");
  if (ionq.recent.length > 0) {
    const r = ionq.recent;
    check("newest first", r.every((x, i) => i === 0 || r[i - 1].filed >= x.filed));
    check("dates are ISO", /^\d{4}-\d{2}-\d{2}$/.test(r[0].filed), `${r[0].filed} .. ${r[r.length - 1].filed}`);
    check("every entry carries a URL", r.every((x) => x.url.startsWith("https://www.sec.gov/Archives/")));
    check("the cap is honoured", r.length <= opts.max, `${r.length} ≤ ${opts.max}`);

    // The link has to actually resolve — a citable URL that 404s is worse than
    // no URL, because it reads as verification.
    const res = await fetch(r[0].url, {
      headers: { "User-Agent": process.env.MAG8_EDGAR_UA ?? "Mag8/1.0 (research pipeline; +https://themag8.com)" },
      signal: AbortSignal.timeout(20_000),
    });
    check("the newest filing's URL resolves", res.ok, `HTTP ${res.status} — ${r[0].form} ${r[0].filed}`);
    console.log(`\n   newest: ${r[0].form} filed ${r[0].filed}\n   ${r[0].url}`);
  }

  console.log("\n absence is reported as absence, never as zero\n");
  const bogus = await readCompanyFilings("ZZZZQQ", opts);
  check("an unlisted ticker states a reason", bogus.unavailable !== undefined, bogus.unavailable ?? "");
  check("and returns no filings rather than a fabricated empty read", bogus.recent.length === 0);

  banner(failures === 0 ? "ALL PASS" : `${failures} CHECK(S) FAILED`);
  return failures === 0 ? 0 : 1;
}

/* ----------------------------------------------------------------------------
 * --refresh : read the named tickers into this week's frozen snapshot.
 * -------------------------------------------------------------------------- */

async function refresh(tickers: string[], dryRun: boolean, force: boolean): Promise<number> {
  banner(`EVIDENCE LAYER — REFRESH${dryRun ? " (DRY RUN — nothing persisted)" : ""}`);
  if (tickers.length === 0) {
    console.error("Give at least one ticker: --refresh IONQ,RKLB");
    return 2;
  }
  const { refreshReach } = await import("../lib/reach");
  const snap = await refreshReach(tickers, { dryRun, force, onProgress: (l) => console.log(l) });

  console.log(`\n week ${snap.weekKey} — ${snap.companies.length} company(ies) held`);
  if (snap.notes.length > 0) {
    console.log("\n not read:");
    for (const n of snap.notes) console.log(`   ${n}`);
  }
  return 0;
}

/* ----------------------------------------------------------------------------
 * --board : what is stored. Reads the database and NOTHING else.
 * -------------------------------------------------------------------------- */

async function board(one: string | undefined): Promise<number> {
  banner("EVIDENCE LAYER — STORED SNAPSHOT");
  const { readReach, companyEvidence } = await import("../lib/reach");
  const snap = readReach({ allowStale: true });
  if (!snap) {
    console.log(" Nothing stored yet. Run: npm run reach -- --refresh TICKER");
    return 0;
  }
  console.log(` week ${snap.weekKey} · read ${snap.fetchedAt.slice(0, 19).replace("T", " ")}Z\n`);

  const rows = one ? [companyEvidence(snap, one)].filter((c) => c !== null) : snap.companies;
  if (rows.length === 0) {
    console.log(one ? ` ${one.toUpperCase()} is not in this snapshot.` : " Snapshot holds no companies.");
    return 0;
  }
  for (const c of rows) {
    const head = `${c.ticker.padEnd(6)} ${c.entityName || "(name not read)"}`;
    if (c.unavailable) {
      console.log(` ${head}\n   NOT READ — ${c.unavailable}\n`);
      continue;
    }
    console.log(` ${head}   ${c.recent.length} filing(s) · ${c.offeringCount} registration/prospectus in window`);
    for (const f of c.recent) {
      console.log(`   ${f.form.padEnd(9)} ${f.filed}  ${f.period ? `(period ${f.period}) ` : ""}${f.url}`);
    }
    console.log("");
  }
  return 0;
}

async function main() {
  if (has("--probe")) {
    process.exitCode = await probe();
    return;
  }
  if (has("--refresh")) {
    process.exitCode = await refresh(tickerList(argValue("--refresh")), has("--dry"), has("--force"));
    return;
  }
  if (has("--board")) {
    process.exitCode = await board(argValue("--ticker"));
    return;
  }
  console.log(
    "Usage: npm run reach -- --probe\n" +
      "                     | --refresh TICKER[,TICKER…] [--dry] [--force]\n" +
      "                     | --board [--ticker SYMBOL]",
  );
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
