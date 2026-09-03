/**
 * The evidence layer — headless operator CLI.
 *
 *   npm run reach -- --probe                        live source smoke test
 *   npm run reach -- --refresh [TICKER,…] [--dry] [--force]   no ticker = feeds only
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
  const v = i >= 0 ? args[i + 1] : undefined;
  // A following FLAG is not this flag's value. Without this, `--refresh
  // --force` reads "--force" as the ticker list — which, combined with force
  // clearing the week's existing entries, silently replaced a snapshot of
  // eight real companies with one entry named "--FORCE". Caught live.
  return v !== undefined && !v.startsWith("--") ? v : undefined;
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

  console.log("\n official releases\n");
  const { feedSources, REJECTED_FEEDS } = await import("../lib/reach/catalog");
  const { readFeeds } = await import("../lib/reach/feeds");
  const sources = feedSources();
  const { items, notes } = await readFeeds(sources, { lookbackDays: 60, maxPerSource: 2, timeoutMs: 20_000 });
  check("every configured source answered", notes.length === 0, notes.join(" | "));
  check("releases come back", items.length > 0, `${items.length} across ${sources.length} sources`);
  const publishers = new Set(items.map((i) => i.publisher));
  // The per-source cap exists so the monthly publishers are not starved by the
  // daily ones. If a publisher vanishes from the mix, that has regressed.
  check("every publisher is represented", publishers.size === new Set(sources.map((s) => s.publisher)).size,
    [...publishers].join(", "));
  check("newest first", items.every((x, i) => i === 0 || items[i - 1].date >= x.date));

  // A citation that does not resolve is worse than an omitted one — and the
  // EIA feed genuinely ships one of these, with the id missing from its own XML.
  let dead = 0;
  for (const r of items) {
    const res = await fetch(r.url, { headers: { "User-Agent": process.env.MAG8_EDGAR_UA ?? "Mag8/1.0 (research pipeline; +https://themag8.com)" }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
    if (!res?.ok) {
      dead++;
      console.log(`   DEAD ${r.publisher} — ${r.url}`);
    }
  }
  check("every release URL resolves", dead === 0, `${items.length - dead}/${items.length} live`);
  for (const r of REJECTED_FEEDS) console.log(`   (not configured: ${r.url} — ${r.why})`);

  console.log("\n developer ecosystem\n");
  const { readEcosystem, BUILTIN_HANDLES } = await import("../lib/reach/github");
  const measured = await readEcosystem("RGTI", BUILTIN_HANDLES.RGTI, { minRepos: 1, timeoutMs: 20_000 });
  check("a resolved organisation is measured", measured?.notMeasured === undefined, measured?.notMeasured ?? `${measured?.publicRepos} repos`);
  const emptyOrg = await readEcosystem("SYM", BUILTIN_HANDLES.SYM, { minRepos: 1, timeoutMs: 20_000 });
  check(
    "a registered but empty organisation is NOT MEASURED, never a zero",
    emptyOrg?.notMeasured !== undefined,
    emptyOrg?.notMeasured ?? "REPORTED FIGURES — this is the bug this check exists for",
  );
  check("an unmapped ticker reports nothing at all", (await readEcosystem("ASTS", undefined, { minRepos: 1 })) === null);

  banner(failures === 0 ? "ALL PASS" : `${failures} CHECK(S) FAILED`);
  return failures === 0 ? 0 : 1;
}

/* ----------------------------------------------------------------------------
 * --refresh : read the named tickers into this week's frozen snapshot.
 * -------------------------------------------------------------------------- */

async function refresh(tickers: string[], dryRun: boolean, force: boolean): Promise<number> {
  banner(`EVIDENCE LAYER — REFRESH${dryRun ? " (DRY RUN — nothing persisted)" : ""}`);
  const { refreshReach } = await import("../lib/reach");
  // No tickers is legal: it reads the official-release feeds alone, which is
  // the weekly maintenance call.
  const snap = await refreshReach(tickers, {
    dryRun,
    force,
    withReleases: tickers.length === 0,
    onProgress: (l) => console.log(l),
  });

  console.log(
    `\n week ${snap.weekKey} — ${snap.companies.length} company(ies), ${snap.releases.length} release(s) held`,
  );
  for (const n of [...snap.notes, ...snap.feedNotes]) console.log(`   not read — ${n}`);
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

  if (!one && snap.releases.length > 0) {
    console.log(` official releases (${snap.releases.length}):`);
    for (const r of snap.releases) {
      console.log(`   ${r.date}  ${r.publisher}`);
      console.log(`             ${r.title.slice(0, 96)}`);
    }
    console.log("");
  }

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
    const e = c.ecosystem;
    if (e) {
      if (e.notMeasured) {
        console.log(`   ecosystem  NOT MEASURED — ${e.notMeasured}`);
      } else {
        const trend = e.since
          ? ` (since ${e.since.weekKey}: repos ${e.publicRepos - e.since.publicRepos >= 0 ? "+" : ""}${e.publicRepos - e.since.publicRepos}, followers ${e.orgFollowers - e.since.orgFollowers >= 0 ? "+" : ""}${e.orgFollowers - e.since.orgFollowers})`
          : " (no prior reading)";
        console.log(
          `   ecosystem  ${e.publicRepos} repos · ${e.orgFollowers} followers · ${e.pushedLast90d}/${e.sampledRepos} pushed in 90d${trend}`,
        );
        if (e.topRepo) console.log(`              top: ${e.topRepo.name} (${e.topRepo.stars} stars)`);
      }
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
      "                     | --refresh [TICKER[,TICKER…]] [--dry] [--force]\n" +
      "                     | --board [--ticker SYMBOL]",
  );
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
