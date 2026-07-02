/**
 * Headless pipeline harness.
 *
 *   npm run pipeline -- --smoke            cheap wiring probe (auth, skills filter,
 *                                          structured output, bypassPermissions)
 *   npm run pipeline -- --full --count 4   whole pipeline, real API spend
 *   npm run pipeline -- --full --mock      whole pipeline through the mock path (zero spend)
 *   flags: --count N (4..12), --force (skip lens cache)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CONFIG, estimateRun } from "../lib/config";
import { createRun, getRunSnapshot } from "../lib/db";
import { executeRun } from "../lib/orchestrator";
import { runAgentWithContract } from "../lib/orchestrator/agent";
import { bus, runChannel, type BusEvent } from "../lib/orchestrator/progress";
import { ALL_SKILLS } from "../lib/orchestrator/prompts";
import { LENS_SKILLS, type RunParams } from "../lib/schemas";

// tsx does not auto-load env files the way Next does.
for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(path.join(process.cwd(), f));
  } catch {
    /* file absent — fine */
  }
}

const args = new Set(process.argv.slice(2));
const argValue = (name: string): string | undefined => {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
};

function banner(text: string) {
  console.log(`\n${"=".repeat(64)}\n${text}\n${"=".repeat(64)}`);
}

function checkLine(name: string, ok: boolean, detail = "") {
  console.log(` ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

/* ============================================================================
 * --smoke: one cheap call proving the five load-bearing integration facts.
 * ========================================================================== */

async function smoke(): Promise<number> {
  banner("MAG8 SMOKE TEST");

  const skillsDir = path.join(process.cwd(), ".claude", "skills");
  const present = ALL_SKILLS.filter((s) => fs.existsSync(path.join(skillsDir, s, "SKILL.md")));
  let allOk = checkLine(
    "skills unpacked in .claude/skills",
    present.length === ALL_SKILLS.length,
    `${present.length}/${ALL_SKILLS.length} (run: npm run setup:skills)`,
  );

  const hasKey = CONFIG.hasApiKey();
  console.log(
    ` INFO  ANTHROPIC_API_KEY ${hasKey ? "is set" : "NOT set — relying on a logged-in Claude Code CLI, which may or may not be available"}`,
  );

  const SmokeSchema = z.object({
    visibleSkills: z.array(z.string()).describe("Exact names of the skills listed as available to you"),
    echoedToken: z.string().describe("The token printed by the Bash command you ran"),
  });

  console.log(` ....  probing (model ${CONFIG.models.lens}, ~4 turns, pennies)…`);
  const started = Date.now();
  try {
    const { data, costUsd, numTurns } = await runAgentWithContract(SmokeSchema, {
      prompt:
        "This is a wiring smoke test for the Mag8 pipeline. Do exactly two things. " +
        "1) Run this via the Bash tool: echo mag8-smoke-ok " +
        "2) In your structured output set visibleSkills to the exact list of skill names available to you in this session (empty array if none are listed), and echoedToken to the token the command printed. Do nothing else.",
      model: CONFIG.models.lens,
      allowedTools: ["Bash"],
      skills: ["stock-scanner"],
      maxTurns: 6,
      timeoutMs: 4 * 60_000,
      label: "smoke",
      onActivity: (a) => console.log(`        ${a}`),
    });

    const visible = data.visibleSkills.map((s) => s.toLowerCase());
    allOk = checkLine("auth + agent round-trip", true, `${((Date.now() - started) / 1000).toFixed(0)}s, ~$${costUsd.toFixed(4)}, ${numTurns} turns`) && allOk;
    allOk = checkLine("structured output round-trip (zod-validated)", true) && allOk;
    allOk = checkLine(
      "skills filter shows stock-scanner",
      visible.some((s) => s.includes("stock-scanner")),
      `visible: [${data.visibleSkills.join(", ")}]`,
    ) && allOk;
    allOk = checkLine(
      "skills filter hides the other three",
      !visible.some((s) => s.includes("new-gen-stock") || s.includes("gt-predictor") || s.includes("institutional-forecast")),
    ) && allOk;
    allOk = checkLine(
      "bypassPermissions ran Bash unattended",
      data.echoedToken.includes("mag8-smoke-ok"),
      `echoed: "${data.echoedToken}"`,
    ) && allOk;
  } catch (err) {
    allOk = checkLine("agent probe", false, err instanceof Error ? err.message : String(err));
  }

  console.log(allOk ? "\nSmoke test PASSED — native structured-output handoff is go." : "\nSmoke test FAILED — fix the above before a full run.");
  return allOk ? 0 : 1;
}

/* ============================================================================
 * --full: whole pipeline headless with live console rendering.
 * ========================================================================== */

function renderEvent({ event }: BusEvent) {
  switch (event.type) {
    case "stage_start":
      banner(`STAGE: ${event.stage.toUpperCase()}`);
      break;
    case "discovery_activity":
      console.log(`  [scout] ${event.activity}`);
      break;
    case "discovery_complete":
      console.log(`  [scout] ${event.candidates.length} candidates:`);
      for (const c of event.candidates) console.log(`      ${c.ticker.padEnd(6)} ${c.companyName} — ${c.sector}`);
      break;
    case "lens_status": {
      const tag = `${event.ticker} ${event.skill}`.padEnd(32);
      if (event.status === "running" && event.activity) console.log(`  [${tag}] ${event.activity}`);
      else if (event.status === "done")
        console.log(`  [${tag}] DONE${event.cached ? " (cached)" : ""} — ${event.verdict ?? ""} ${event.headline ?? ""}`);
      else if (event.status === "error") console.log(`  [${tag}] ERROR — ${event.error}`);
      else if (event.status === "queued") {
        /* too chatty to print */
      } else console.log(`  [${tag}] ${event.status}`);
      break;
    }
    case "compile_activity":
      console.log(`  [compiler] ${event.activity}`);
      break;
    case "run_complete":
      banner("RUN COMPLETE");
      console.log(`  Total cost: ${event.totalCostUsd === null ? "n/a" : `$${event.totalCostUsd}`}`);
      for (const s of event.report.rankings) {
        console.log(
          `   #${String(s.rank).padStart(2)} ${s.ticker.padEnd(6)} ${String(s.finalScore).padStart(5)}  gate=${s.gate.padEnd(7)} ${s.confluence ? "CONFLUENCE" : "          "} ${s.verdictLine.slice(0, 70)}`,
        );
      }
      if (event.report.gapsNoted.length) {
        console.log(`  Gaps: ${event.report.gapsNoted.length}`);
        for (const g of event.report.gapsNoted) console.log(`   - ${g}`);
      }
      break;
    case "run_error":
      banner(`RUN ERROR: ${event.error}`);
      break;
  }
}

async function full(): Promise<number> {
  const mock = args.has("--mock");
  const count = Math.min(
    CONFIG.candidates.max,
    Math.max(CONFIG.candidates.min, parseInt(argValue("--count") ?? String(CONFIG.candidates.default), 10) || CONFIG.candidates.default),
  );
  const params: RunParams = { count, force: args.has("--force"), mock };

  banner(`MAG8 FULL PIPELINE — count=${count} force=${params.force} mock=${mock}`);
  if (!mock) {
    const est = estimateRun(count);
    console.log(
      ` INFO  ${est.calls} agent calls (1 discovery + ${count}×${LENS_SKILLS.length} lenses + 1 compile), est. $${est.usdLow}–$${est.usdHigh}, ~${est.minutesLow}–${est.minutesHigh} min`,
    );
    if (!CONFIG.hasApiKey()) {
      console.log(" WARN  ANTHROPIC_API_KEY not set — relying on a logged-in Claude Code CLI. The app itself requires the key.");
    }
  }

  const runId = crypto.randomUUID();
  createRun(runId, params);
  console.log(` INFO  run ${runId}`);

  bus().on(runChannel(runId), renderEvent);
  const started = Date.now();
  await executeRun(runId, params);
  bus().off(runChannel(runId), renderEvent);

  const snapshot = getRunSnapshot(runId);
  console.log(
    `\n  Finished in ${((Date.now() - started) / 60000).toFixed(1)} min — status=${snapshot?.run.status}, cells ok=${snapshot?.cells.filter((c) => c.status === "ok").length}/${snapshot?.cells.length}, ranked=${snapshot?.rankings.length}`,
  );
  console.log(`  View at /runs/${runId} once the app is up.`);
  return snapshot?.run.status === "complete" ? 0 : 1;
}

async function main() {
  if (args.has("--smoke")) process.exit(await smoke());
  if (args.has("--full")) process.exit(await full());
  console.log("Usage: npm run pipeline -- --smoke | --full [--count N] [--force] [--mock]");
  process.exit(2);
}

void main();
