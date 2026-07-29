/**
 * Salience audit — measures, per completed run, how much of the delivered
 * cohort sits inside the discovery model's own cold-memory list of famous
 * "next mega-cap" names (lib/salience.ts), against the overlap expected if
 * picks were drawn at random from the eligible universe. Also reports each
 * pick's position in the deterministic fundamentals ranking, its market-cap
 * percentile within the eligible set, and verified analyst coverage
 * (bankCount from the consensus lens) as an external-coverage proxy.
 *
 *   npm run audit:salience
 *
 * Owner CLI, read-mostly, run BETWEEN runs: a raw read-only precheck refuses
 * to start while a run is live, because importing lib/db boot-reconciles and
 * would mark a live run interrupted.
 *
 * Interpretation notes:
 *  - The baseline is the model's TRAINING prior (generated with no tools) —
 *    overlap measures name-familiarity pressure, not pick quality. A great
 *    pick can be famous; a board that is ~all famous names is the signal.
 *  - Universe context uses the run week's snapshot when cached (W28+), else
 *    the most recent snapshot, always under CURRENT settings — an honest
 *    approximation for historical runs, exact for future ones.
 */
import Database from "better-sqlite3";
import path from "node:path";

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {
    /* file absent — fine */
  }
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  const { CONFIG } = await import("../lib/config");

  // Live-run precheck on a raw READ-ONLY connection, before lib/db loads.
  {
    const raw = new Database(CONFIG.dbPath, { readonly: true, fileMustExist: true });
    const live = raw
      .prepare(`SELECT COUNT(*) AS n FROM runs WHERE status IN ('pending','running')`)
      .get() as { n: number };
    raw.close();
    if (live.n > 0) {
      console.error("A run is live right now — the audit refuses to touch the DB mid-run. Re-run when it finishes.");
      process.exit(2);
    }
  }

  const db = await import("../lib/db");
  const { screenUniverse, rankEligible } = await import("../lib/universe");
  const { universeSettings } = await import("../lib/universe-settings");
  const { SALIENCE_BASELINE, SALIENCE_BASELINE_DATE, SALIENCE_BASELINE_INSTRUMENT, salienceRank } = await import(
    "../lib/salience"
  );

  const runs = db
    .listRuns(100)
    .filter((r) => r.params.mock !== true)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  if (runs.length === 0) {
    console.log("No real (non-mock) runs in the DB — nothing to audit.");
    return;
  }

  const settings = universeSettings();

  // Per-week universe context cache: eligible set, cap percentiles, fundamentals ranking.
  interface WeekCtx {
    week: string;
    approx: boolean;
    eligibleCount: number;
    eligibleSet: Set<string>;
    capSorted: number[];
    fundRank: Map<string, number>;
    baselineInEligible: number;
  }
  const ctxCache = new Map<string, WeekCtx>();
  const weekCtx = (runWeek: string): WeekCtx | null => {
    const hit = ctxCache.get(runWeek);
    if (hit) return hit;
    const snap = db.getUniverseSnapshot(runWeek) ?? db.latestUniverseSnapshot();
    if (!snap) return null;
    const screened = screenUniverse(snap.rows, snap.extras, settings);
    const ranked = rankEligible(screened.eligible, snap.extras);
    const ctx: WeekCtx = {
      week: snap.isoWeek,
      approx: snap.isoWeek !== runWeek,
      eligibleCount: screened.eligible.length,
      eligibleSet: new Set(screened.eligible.map((r) => r.t)),
      capSorted: screened.eligible.map((r) => r.c).sort((a, b) => a - b),
      fundRank: new Map((ranked ?? []).map((r, i) => [r.row.t, i + 1])),
      baselineInEligible: SALIENCE_BASELINE.filter((e) => screened.eligible.some((r) => r.t === e.t)).length,
    };
    ctxCache.set(runWeek, ctx);
    return ctx;
  };

  const capPct = (ctx: WeekCtx, ticker: string, capOf: Map<string, number>): number | null => {
    const c = capOf.get(ticker);
    if (c === undefined) return null;
    let lo = 0;
    let hi = ctx.capSorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ctx.capSorted[mid] < c) lo = mid + 1;
      else hi = mid;
    }
    return Math.round((lo / Math.max(1, ctx.capSorted.length - 1)) * 100);
  };

  console.log(`MAG8 SALIENCE AUDIT`);
  console.log(
    `Baseline: ${SALIENCE_BASELINE.length} names, ${SALIENCE_BASELINE_DATE}, ${SALIENCE_BASELINE_INSTRUMENT}`,
  );
  console.log(`Real (non-mock) runs found: ${runs.length}\n`);

  const overall = { picks: 0, inBaseline: 0, ranks: [] as number[], capPcts: [] as number[], desks: [] as number[] };

  for (const run of runs) {
    const week = db.isoWeekKey(new Date(run.createdAt));
    const candidates = db.getCandidates(run.id);
    if (candidates.length === 0) continue;
    const rankings = db.getRankings(run.id);
    const boardPos = new Map(rankings.map((x, i) => [x.ticker, i + 1]));
    const ordered = [...candidates].sort(
      (a, b) => (boardPos.get(a.ticker) ?? 99) - (boardPos.get(b.ticker) ?? 99),
    );

    // bankCount per ticker from the consensus lens rows of THIS run.
    const desks = new Map<string, number>();
    for (const row of db.getLensRowsForRun(run.id)) {
      if (row.skill !== "institutional-forecast" || row.status !== "ok") continue;
      const km = (row.analysis as { keyMetrics?: Record<string, unknown> } | null)?.keyMetrics;
      const n = km?.bankCount;
      if (typeof n === "number") desks.set(row.ticker, n);
    }

    const ctx = weekCtx(week);
    const capOf = new Map<string, number>();
    if (ctx) {
      const snap = db.getUniverseSnapshot(ctx.week);
      for (const r of snap?.rows ?? []) capOf.set(r.t, r.c);
    }

    const focus = run.params.modifier ? ` focus="${run.params.modifier}"` : "";
    const blind = run.params.blind ? " BLIND" : "";
    console.log(
      `Run ${run.createdAt.slice(0, 10)} (${run.status}, count=${candidates.length}${blind}${focus})` +
        (ctx ? `  [universe ${ctx.week}${ctx.approx ? " approx" : ""}, ${ctx.eligibleCount} eligible]` : ""),
    );

    const inBase: number[] = [];
    for (const c of ordered) {
      const sr = salienceRank(c.ticker);
      if (sr !== null) inBase.push(sr);
      const board = boardPos.has(c.ticker) ? `#${boardPos.get(c.ticker)}` : "—";
      const elig = ctx ? (ctx.eligibleSet.has(c.ticker) ? "yes" : capOf.has(c.ticker) ? "NO" : "n/s") : "?";
      const fr = ctx?.fundRank.get(c.ticker);
      const cp = ctx ? capPct(ctx, c.ticker, capOf) : null;
      const dk = desks.get(c.ticker);
      console.log(
        `  ${c.ticker.padEnd(5)} board ${board.padEnd(3)} salience ${sr !== null ? `#${String(sr).padEnd(4)}` : "—    "}` +
          ` eligible ${elig.padEnd(3)} fund-rank ${fr !== undefined ? `${fr}/${ctx!.eligibleCount}` : "—"}`.padEnd(24) +
          `${cp !== null ? ` capPct ${cp}` : ""}${dk !== undefined ? ` desks ${dk}` : ""}`,
      );
      overall.picks++;
      if (sr !== null) overall.inBaseline++;
      if (fr !== undefined && ctx) overall.ranks.push(fr / ctx.eligibleCount);
      if (cp !== null) overall.capPcts.push(cp);
      if (dk !== undefined) overall.desks.push(dk);
    }
    const expRate = ctx ? ctx.baselineInEligible / ctx.eligibleCount : null;
    console.log(
      `  → ${inBase.length}/${ordered.length} picks in the model-memory baseline` +
        (inBase.length ? ` (median salience rank #${median(inBase)})` : "") +
        (expRate !== null
          ? `; random-from-eligible expectation ≈ ${(expRate * 100).toFixed(1)}% (${(expRate * ordered.length).toFixed(1)} of ${ordered.length})`
          : "") +
        `\n`,
    );
  }

  const mr = median(overall.ranks);
  console.log(`OVERALL: ${overall.inBaseline}/${overall.picks} pick-slots inside the model-memory baseline (${Math.round((overall.inBaseline / Math.max(1, overall.picks)) * 100)}%)`);
  if (mr !== null) console.log(`         median fundamentals-rank position: top ${(mr * 100).toFixed(0)}% of eligible`);
  const mc = median(overall.capPcts);
  if (mc !== null) console.log(`         median market-cap percentile within eligible: ${mc}`);
  const md = median(overall.desks);
  if (md !== null) console.log(`         median verified analyst desks per pick (consensus lens): ${md}`);
  console.log(
    `\nReading: baseline overlap far above the random expectation = selection driven by name familiarity.` +
      `\nGoal of the ranked pool: future runs drift toward low salience ranks + strong fund-ranks, disclosed either way.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
