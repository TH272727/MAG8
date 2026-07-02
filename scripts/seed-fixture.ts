/**
 * Seeds one complete fake run so every page renders with zero API spend.
 *   npm run seed
 */
import {
  appendEvent,
  createRun,
  deleteRun,
  finishRun,
  getRunSnapshot,
  insertCandidates,
  insertLensResult,
  insertRankings,
  isoWeekKey,
  setRunStage,
} from "../lib/db";
import {
  FIXTURE_RUN_ID,
  FIXTURE_SEEDS,
  buildFixtureEventLog,
  buildFixtureReport,
  fixtureCandidates,
  fixtureCellCost,
  fixtureLensAnalysis,
  fixtureTotalCost,
} from "../lib/fixtures";
import { CompiledReportSchema, LENS_SKILLS } from "../lib/schemas";

const COUNT = 8;

function main() {
  const now = new Date();
  const generatedAt = now.toISOString();

  console.log(`Seeding fixture run "${FIXTURE_RUN_ID}" (${COUNT} candidates)…`);
  deleteRun(FIXTURE_RUN_ID);
  createRun(FIXTURE_RUN_ID, { count: COUNT, force: false, mock: true });
  setRunStage(FIXTURE_RUN_ID, "discovery");

  insertCandidates(FIXTURE_RUN_ID, fixtureCandidates(COUNT));

  const week = isoWeekKey(now);
  let cellIndex = 0;
  for (const seed of FIXTURE_SEEDS.slice(0, COUNT)) {
    for (const skill of LENS_SKILLS) {
      insertLensResult({
        runId: FIXTURE_RUN_ID,
        ticker: seed.ticker,
        skill,
        isoWeek: week,
        status: "ok",
        analysis: fixtureLensAnalysis(seed, skill),
        costUsd: fixtureCellCost(cellIndex++),
      });
    }
  }

  const report = buildFixtureReport({ runId: FIXTURE_RUN_ID, generatedAt, count: COUNT });
  // Self-check: the fixture must satisfy the same contract the pipeline enforces.
  CompiledReportSchema.parse(report);
  insertRankings(FIXTURE_RUN_ID, report.rankings);

  for (const event of buildFixtureEventLog(COUNT, report, now)) {
    appendEvent(FIXTURE_RUN_ID, event);
  }

  finishRun(FIXTURE_RUN_ID, {
    status: "complete",
    report,
    totalCostUsd: fixtureTotalCost(COUNT),
  });

  const snapshot = getRunSnapshot(FIXTURE_RUN_ID);
  if (!snapshot) throw new Error("snapshot readback failed");

  console.log(`\nSeeded OK — ${snapshot.candidates.length} candidates, ${snapshot.cells.length} lens cells, ${snapshot.rankings.length} ranked, ${snapshot.lastEventId ? "event log present" : "NO EVENTS"}.`);
  console.log("\nLeaderboard:");
  for (const s of snapshot.rankings) {
    console.log(
      `  #${String(s.rank).padStart(2)} ${s.ticker.padEnd(5)} ${String(s.finalScore).padStart(5)}  gate=${s.gate.padEnd(7)} confluence=${s.confluence ? "YES" : "no "}  ${s.verdictLine.slice(0, 60)}…`,
    );
  }
  console.log(`\nBrowse:  /runs/${FIXTURE_RUN_ID}   /rankings   /stocks/${snapshot.rankings[0]?.ticker ?? "ASTS"}`);
}

main();
