/**
 * Bottleneck desk — headless operations.
 *
 *   npm run bottleneck -- --probe            live SEC EDGAR smoke test ($0, no model)
 *   npm run bottleneck -- --13f CIK|NAME     clone a filer's latest 13F and diff it
 *        --offline        skip the CUSIP mapping service (cache + snapshot only)
 *        --balance N      also print the sizing proposal for an N-dollar account
 *        --force          re-read the filings even if a parse is already stored
 *   npm run bottleneck -- --refresh [ID]     refresh demand + supply, score the gaps
 *        --dry            compute without persisting
 *        --reuse-demand   reuse the stored demand reading (supply + scoring only)
 *
 * The desk is deterministic and free: everything here is HTTP + arithmetic, so
 * it never touches the research plan's usage window.
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

import {
  edgarUserAgent,
  fetchFilingDocument,
  fullTextSearch,
  getCompanyConcept,
  getFilingIndex,
  getSubmissions,
  resolveTickerToCik,
} from "../lib/edgar";

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const argValue = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function banner(text: string) {
  console.log(`\n${"=".repeat(64)}\n${text}\n${"=".repeat(64)}`);
}

let failures = 0;
function check(name: string, ok: boolean, detail = ""): boolean {
  console.log(` ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
  return ok;
}

/* ============================================================================
 * --probe: every EDGAR endpoint the desk depends on, against live SEC.
 * ========================================================================== */

/** Capex tags in the order Module B tries them; filers tag this inconsistently. */
const CAPEX_TAGS = [
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "PaymentsForCapitalImprovements",
  "PaymentsToAcquireProductiveAssets",
  "PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets",
];

async function probe(): Promise<number> {
  banner("BOTTLENECK — EDGAR PROBE");
  const ua = edgarUserAgent();
  console.log(` User-Agent: ${ua}\n`);
  check(
    "User-Agent identifies this app",
    ua.length > 10 && !/^\s*$/.test(ua),
    "SEC 403s anonymous traffic; set MAG8_EDGAR_UA",
  );

  // 1. Ticker → CIK
  const t0 = Date.now();
  const aapl = await resolveTickerToCik("AAPL");
  check("resolveTickerToCik(AAPL) = 320193", aapl === 320193, `${aapl} in ${Date.now() - t0}ms`);
  const bogus = await resolveTickerToCik("ZZZZQQ");
  check("unknown ticker resolves to null", bogus === null, String(bogus));

  // 2. Cache round-trip — the second map read must not re-fetch.
  const t1 = Date.now();
  await resolveTickerToCik("MSFT");
  const cachedMs = Date.now() - t1;
  check("second ticker lookup served from cache", cachedMs < 100, `${cachedMs}ms`);

  // 3. Submissions
  const subs = await getSubmissions(320193);
  const periodic = subs.filings.filter((f) => f.form === "10-Q" || f.form === "10-K");
  check("getSubmissions returns filings", subs.filings.length > 0, `${subs.filings.length} recent`);
  check("periodic reports present", periodic.length > 0, `${periodic.length} 10-Q/10-K`);
  check(
    "reportDate populated (NOT periodOfReport)",
    periodic.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(periodic[0].reportDate),
    periodic[0] ? `${periodic[0].form} period ${periodic[0].reportDate}` : "none",
  );

  // 4. Capex tag chain — Module B's core lookup.
  let capexTag = "";
  let capexFacts = 0;
  for (const tag of CAPEX_TAGS) {
    const facts = await getCompanyConcept(320193, tag);
    if (facts && facts.length > 0) {
      capexTag = tag;
      capexFacts = facts.length;
      break;
    }
  }
  check(
    "capex tag chain resolves for AAPL",
    capexTag !== "",
    capexTag ? `${capexTag} (${capexFacts} facts)` : "no tag populated",
  );

  // 5. Full-text search — filer lookup by name.
  const fts = await fullTextSearch("situational awareness", { forms: ["13F-HR"] });
  const sa = fts.hits.find((h) => /situational awareness/i.test(h.entityName));
  check(
    "fullTextSearch finds a filer by name",
    Boolean(sa),
    sa ? `${sa.entityName} CIK ${sa.cik}` : `${fts.total} hits`,
  );

  // 6. Filing index + document — the 13F path.
  if (sa) {
    const files = await getFilingIndex(sa.cik, sa.accessionNumber);
    const infoTable = files.find((f) => /infotable|information.?table/i.test(f.name) && f.name.endsWith(".xml"));
    check(
      "filing index exposes an information table",
      Boolean(infoTable),
      infoTable ? infoTable.name : files.map((f) => f.name).join(", "),
    );
    if (infoTable) {
      const xml = await fetchFilingDocument(sa.cik, sa.accessionNumber, infoTable.name);
      // Namespace-agnostic BY NECESSITY: the same filer ships both an
      // unprefixed table and an `ns1:`-prefixed one depending on the filing
      // agent, and a prefix-blind regex silently reports zero holdings.
      const rows = (xml.match(/<(?:\w+:)?infoTable[\s>]/g) ?? []).length;
      check("information table parses as XML with holdings", rows > 0, `${rows} rows`);
      // putCall is title case and ABSENT on plain stock — both verified here.
      const putCall = [...xml.matchAll(/<(?:\w+:)?putCall>([^<]*)<\/(?:\w+:)?putCall>/g)].map((m) =>
        m[1].trim(),
      );
      check(
        "putCall values are title case when present",
        putCall.every((v) => v === "Put" || v === "Call"),
        putCall.length > 0
          ? `${putCall.length} option rows: ${[...new Set(putCall)].join("/")}`
          : "no option rows",
      );
    }
  }

  // 7. OpenFIGI — Module A cannot name a single position without it, and its
  //    keyless terms are the kind of thing that changes without notice.
  const { figiJobs } = await import("../lib/bottleneck/cusip");
  const jobs = figiJobs(["038169207", "G11448100"], "US"); // domestic CUSIP + a foreign CINS
  check(
    "identifier shape picks the OpenFIGI id type",
    jobs[0].idType === "ID_CUSIP" && jobs[1].idType === "ID_CINS",
    `${jobs.map((j) => `${j.idValue}→${j.idType}`).join(", ")}`,
  );
  try {
    const res = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jobs),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { data?: { ticker?: string }[]; warning?: string }[];
    const tickers = body.map((r) => r?.data?.[0]?.ticker ?? r?.warning ?? "?");
    check("OpenFIGI mapping answers without an API key", res.ok, `HTTP ${res.status}`);
    check(
      "a domestic CUSIP resolves to its US ticker",
      tickers[0] === "APLD",
      `038169207 → ${tickers[0]}`,
    );
    // The whole reason for the ID_CINS branch: ID_CUSIP returns "No identifier
    // found" for this same string.
    check("a foreign CINS resolves under ID_CINS", tickers[1] === "BTDR", `G11448100 → ${tickers[1]}`);
    const quota = res.headers.get("ratelimit-limit");
    if (quota) console.log(`       keyless quota: ${quota} requests/minute, 10 identifiers per request`);
  } catch (err) {
    check("OpenFIGI mapping reachable", false, err instanceof Error ? err.message : String(err));
  }

  console.log(`\n ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  return failures === 0 ? 0 : 1;
}

/* ============================================================================
 * --13f: clone a manager's disclosed book (Module A).
 * ========================================================================== */

/** How a ticker was established, shown only when it is weaker than an exact US identifier match. */
function provenance(ticker: string | null, resolvedBy: string, cusip: string): string {
  if (ticker === null) return `  [unresolved ${cusip}]`;
  if (resolvedBy === "openfigi-foreign") return "  [foreign venue — no US listing found]";
  if (resolvedBy === "universe-name") return "  [matched on issuer name]";
  return "";
}

async function thirteenF(target: string, opts: { offline: boolean; force: boolean; balance: number }): Promise<number> {
  const { cloneManager, searchManagers, sizeToBalance } = await import("../lib/bottleneck/thirteenf");
  const { bottleneckSettings } = await import("../lib/bottleneck-settings");
  const { fetchIndependentQuote } = await import("../lib/price-sanity");

  let cik = Number(target.replace(/\D/g, ""));
  if (!/^\d+$/.test(target.trim())) {
    banner(`BOTTLENECK — 13F FILER SEARCH: "${target}"`);
    const matches = await searchManagers(target);
    if (matches.length === 0) {
      console.error(` No 13F filer matched "${target}".`);
      return 2;
    }
    for (const m of matches) {
      console.log(` CIK ${String(m.cik).padStart(10)}  ${m.name}  (${m.form} ${m.filingDate}, period ${m.period})`);
    }
    if (matches.length > 1) {
      console.log(`\n ${matches.length} filers matched — re-run with the CIK you want.`);
      return 0;
    }
    cik = matches[0].cik;
  }

  const settings = bottleneckSettings();
  const clone = await cloneManager(cik, { offline: opts.offline, force: opts.force });
  const { current, prior, diff } = clone;

  banner(`BOTTLENECK — 13F CLONE: ${current.filerName}`);
  console.log(
    ` CIK ${current.cik} · ${current.form} · period ${current.period} · filed ${current.filedAt}` +
      ` (${current.lagDays} days later; the rule allows ${settings.filingLagDays})`,
  );
  console.log(` ${current.infoTableFile} · values in ${current.valueScale === 1 ? "dollars" : "thousands ×1,000"}`);
  console.log(
    ` long book ${usd(current.totals.longUsd)} across ${current.totals.longPositions} positions · ` +
      `options ${usd(current.totals.optionsUsd)} across ${current.totals.optionPositions}` +
      (current.totals.unresolved > 0 ? ` · ${current.totals.unresolved} unresolved` : ""),
  );

  console.log("\n LONG STOCK");
  console.log(" ticker    %book            value        shares  issuer");
  for (const h of current.long) {
    if ((h.pctOfLong ?? 0) < settings.holdingsMinPct) continue;
    console.log(
      ` ${(h.ticker ?? "—").padEnd(8)} ${(h.pctOfLong ?? 0).toFixed(2).padStart(6)}%` +
        ` ${usd(h.valueUsd).padStart(12)} ${h.shares.toLocaleString("en-US").padStart(13)}  ${h.nameOfIssuer}` +
        provenance(h.ticker, h.resolvedBy, h.cusip),
    );
  }

  if (settings.showOptionsOverlay && current.options.length > 0) {
    console.log("\n OPTIONS OVERLAY — reported alongside the stock, never folded into it");
    for (const h of current.options) {
      console.log(
        ` ${(h.ticker ?? "—").padEnd(8)} ${(h.putCall ?? "").padEnd(5)}` +
          ` ${usd(h.valueUsd).padStart(12)} ${h.shares.toLocaleString("en-US").padStart(13)}  ${h.nameOfIssuer}`,
      );
    }
  }

  if (prior) {
    console.log(`\n CHANGES vs ${prior.period} (filed ${prior.filedAt})`);
    console.log(" change      ticker      shares now   shares before      delta   %book now");
    for (const d of diff) {
      console.log(
        ` ${d.change.toUpperCase().padEnd(11)} ${(d.ticker ?? d.cusip).padEnd(10)}` +
          ` ${d.sharesNow.toLocaleString("en-US").padStart(12)}` +
          ` ${d.sharesBefore.toLocaleString("en-US").padStart(15)}` +
          ` ${(d.sharesDeltaPct === null ? "—" : pct(d.sharesDeltaPct)).padStart(10)}` +
          ` ${(d.pctOfLongNow === null ? "—" : `${d.pctOfLongNow.toFixed(2)}%`).padStart(11)}` +
          provenance(d.ticker, d.resolvedBy, d.cusip),
      );
    }
  }

  if (opts.balance > 0) {
    console.log(`\n SIZING PROPOSAL for ${usd(opts.balance)} — a list to review, not an order`);
    const prices = new Map<string, number>();
    for (const h of current.long) {
      if (!h.ticker) continue;
      const quote = await fetchIndependentQuote(h.ticker);
      if (quote !== null) prices.set(h.ticker, quote);
    }
    console.log(" ticker    %book       suggested $      price    shares");
    for (const o of sizeToBalance(current.long, opts.balance, prices, settings.holdingsMinPct)) {
      console.log(
        ` ${(o.ticker ?? "—").padEnd(8)} ${o.pctOfLong.toFixed(2).padStart(6)}%` +
          ` ${usd(o.suggestedUsd).padStart(15)}` +
          ` ${(o.price === null ? "—" : `$${o.price.toFixed(2)}`).padStart(10)}` +
          ` ${(o.suggestedShares === null ? "—" : o.suggestedShares.toLocaleString("en-US")).padStart(9)}` +
          (o.usListed ? "" : "   no US listing"),
      );
    }
    console.log(" Nothing here is wired to a broker; this desk cannot place an order.");
  }

  console.log("\n WHAT THIS CLONE CANNOT TELL YOU");
  for (const f of clone.flags) console.log(`  - ${f}`);
  console.log(`\n source: ${current.sourceUrl}`);
  return 0;
}

/* ============================================================================
 * --refresh: rebuild a playbook's demand snapshot from live filings.
 * ========================================================================== */

const usd = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${Math.round(n).toLocaleString("en-US")}`;
};
const num = (n: number): string =>
  n >= 1000 ? Math.round(n).toLocaleString("en-US") : String(Math.round(n * 100) / 100);
const pct = (p: number | null | undefined): string =>
  p === null || p === undefined ? "n/a" : `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;

async function refresh(playbookId: string, dry: boolean, reuseDemand: boolean): Promise<number> {
  const { getPlaybook } = await import("../lib/bottleneck/playbook");
  const { refreshDesk } = await import("../lib/bottleneck/desk");

  const pb = getPlaybook(playbookId);
  if (!pb) {
    console.error(`No playbook with id "${playbookId}".`);
    return 2;
  }

  banner(`BOTTLENECK — REFRESH: ${pb.label}`);
  console.log(` basket: ${pb.demand.basket.join(" ")}`);
  console.log(` conversions: v${pb.conversions.version} (${pb.conversions.asOf})\n`);

  const t0 = Date.now();
  const { demand: snap, supply, bottleneck } = await refreshDesk(pb, { dryRun: dry, reuseDemand });
  console.log(` read ${snap.companies.length} companies in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

  console.log(" CAPITAL SPENDING (per company)");
  console.log(" ticker  status   latest qtr        TTM       QoQ       YoY  basis     tag");
  for (const c of snap.companies) {
    if (c.status !== "ok") {
      console.log(` ${c.ticker.padEnd(7)} ${c.status.padEnd(8)} ${c.note ?? ""}`);
      continue;
    }
    console.log(
      ` ${c.ticker.padEnd(7)} ${c.status.padEnd(8)}` +
        ` ${usd(c.latestQuarterUsd ?? 0).padStart(10)}` +
        ` ${(c.ttmUsd === undefined ? "n/a" : usd(c.ttmUsd)).padStart(10)}` +
        ` ${pct(c.qoq?.pct).padStart(9)}` +
        ` ${pct(c.yoy?.pct).padStart(9)}` +
        `  ${(c.basis ?? "").padEnd(8)} ${c.tagUsed ?? ""}`,
    );
  }

  console.log(
    `\n aggregate: ${snap.aggregate.contributing}/${snap.aggregate.basketSize} contributing · ` +
      `latest quarter ${usd(snap.aggregate.latestQuarterUsd)} · TTM ${usd(snap.aggregate.ttmUsd)} · ` +
      `YoY ${pct(snap.aggregate.yoyPct)}`,
  );

  console.log("\n PHYSICAL UNITS (TTM dollars / conversion factor)");
  for (const u of snap.units) {
    console.log(` ${num(u.totalUnits).padStart(12)}  ${u.unit}`);
    console.log(`               ${usd(u.totalUsd)} / ${usd(u.usdPer)} per unit  ·  ${u.source} (${u.asOf})`);
  }

  const withNarrative = snap.companies.filter((c) => c.narrative);
  if (withNarrative.length > 0) {
    console.log(`\n WHY IT CHANGED — quoted from the filings (${withNarrative.length} of ${snap.companies.length})`);
    for (const c of withNarrative.slice(0, 3)) {
      console.log(` ${c.ticker} (${c.narrative!.form}, filed ${c.narrative!.filed}):`);
      const s = c.narrative!.sentences[0] ?? "";
      console.log(`   "${s.slice(0, 200)}${s.length > 200 ? "…" : ""}"`);
    }
  }

  console.log("\n SUPPLY SERIES");
  for (const s of supply) {
    console.log(
      ` ${s.seriesId.padEnd(32)} ${s.connector.padEnd(14)} ${String(s.stored).padStart(4)} obs` +
        ` ${(s.latest ?? "—").padStart(11)}${s.fetched > 0 ? `  (+${s.fetched})` : ""}${s.stub ? "  STUB" : ""}`,
    );
    if (s.note) console.log(`     ${s.note}`);
  }

  console.log("\n BOTTLENECK RANKING — tightest constraint first");
  console.log(" status              demand    supply       gap   unit");
  for (const c of bottleneck.categories) {
    console.log(
      ` ${c.status.padEnd(18)}` +
        ` ${pct(c.demandGrowthPct).padStart(8)}` +
        ` ${pct(c.supplyGrowthPct).padStart(9)}` +
        ` ${(c.gapPct === null ? "—" : `${c.gapPct >= 0 ? "+" : ""}${c.gapPct.toFixed(1)}pp`).padStart(9)}` +
        `   ${c.unit}`,
    );
    if (c.gapChangePct !== null && c.gapChangePct !== 0) {
      console.log(`     since last reading: ${c.gapChangePct >= 0 ? "+" : ""}${c.gapChangePct}pp${c.materialMove ? "  MATERIAL" : ""}`);
    }
    if (c.owners) {
      console.log(`     owned by: ${c.owners.tickers.join(", ") || "no US listings"}${c.owners.foreign.length ? `  ·  not plainly US-listed: ${c.owners.foreign.join(", ")}` : ""}`);
    }
  }

  const lead = bottleneck.categories.find((c) => c.gapPct !== null);
  if (lead) console.log(`\n READOUT\n  ${lead.readout}`);

  if (snap.flags.length > 0 || bottleneck.flags.length > 0) {
    console.log("\n DISCLOSED GAPS");
    for (const f of [...snap.flags, ...bottleneck.flags]) console.log(`  - ${f}`);
  }

  console.log(dry ? "\n dry run — nothing persisted" : "\n snapshots persisted");
  return 0;
}

/* ============================================================================
 * Entry
 * ========================================================================== */

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
  if (has("--13f")) {
    const target = argValue("--13f");
    if (!target || target.startsWith("--")) {
      console.error("--13f needs a CIK or a manager name, e.g. --13f 2045724");
      process.exitCode = 2;
      return;
    }
    const balance = Number(argValue("--balance") ?? 0);
    try {
      process.exitCode = await thirteenF(target, {
        offline: has("--offline"),
        force: has("--force"),
        balance: Number.isFinite(balance) && balance > 0 ? balance : 0,
      });
    } catch (err) {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
    return;
  }
  if (has("--refresh")) {
    const { DEFAULT_PLAYBOOK_ID } = await import("../lib/bottleneck/playbook");
    const raw = argValue("--refresh");
    const id = !raw || raw.startsWith("--") ? DEFAULT_PLAYBOOK_ID : raw;
    process.exitCode = await refresh(id, has("--dry"), has("--reuse-demand"));
    return;
  }
  console.log(
    "Usage: npm run bottleneck -- --probe\n" +
      "                          | --13f CIK|NAME [--offline] [--force] [--balance USD]\n" +
      "                          | --refresh [PLAYBOOK] [--dry] [--reuse-demand]",
  );
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
