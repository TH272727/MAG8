/**
 * Bottleneck desk — headless operations.
 *
 *   npm run bottleneck -- --probe          live SEC EDGAR smoke test ($0, no model)
 *   npm run bottleneck -- --13f CIK        parse a filer's latest 13F        (Phase 5)
 *   npm run bottleneck -- --refresh [ID]   refresh a playbook's snapshots    (Phase 3/4)
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

  console.log(`\n ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
  return failures === 0 ? 0 : 1;
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

async function refresh(playbookId: string, dry: boolean): Promise<number> {
  const { getPlaybook } = await import("../lib/bottleneck/playbook");
  const { buildDemandSnapshot } = await import("../lib/bottleneck/demand");

  const pb = getPlaybook(playbookId);
  if (!pb) {
    console.error(`No playbook with id "${playbookId}".`);
    return 2;
  }

  banner(`BOTTLENECK — DEMAND REFRESH: ${pb.label}`);
  console.log(` basket: ${pb.demand.basket.join(" ")}`);
  console.log(` conversions: v${pb.conversions.version} (${pb.conversions.asOf})\n`);

  const t0 = Date.now();
  const snap = await buildDemandSnapshot(pb, { dryRun: dry });
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

  if (snap.flags.length > 0) {
    console.log("\n DISCLOSED GAPS");
    for (const f of snap.flags) console.log(`  - ${f}`);
  }

  console.log(dry ? "\n dry run — nothing persisted" : "\n snapshot persisted");
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
    console.error(`--13f ${argValue("--13f") ?? ""}: Module A lands in Phase 5.`);
    process.exitCode = 2;
    return;
  }
  if (has("--refresh")) {
    const { DEFAULT_PLAYBOOK_ID } = await import("../lib/bottleneck/playbook");
    const raw = argValue("--refresh");
    const id = !raw || raw.startsWith("--") ? DEFAULT_PLAYBOOK_ID : raw;
    process.exitCode = await refresh(id, has("--dry"));
    return;
  }
  console.log(
    "Usage: npm run bottleneck -- --probe | --refresh [PLAYBOOK] [--dry] | --13f CIK (Phase 5)",
  );
  process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
