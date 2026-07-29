/**
 * Headless pipeline harness.
 *
 *   npm run pipeline -- --smoke            cheap wiring probe (auth, skills filter,
 *                                          structured output, bypassPermissions)
 *   npm run pipeline -- --full --count 4   whole pipeline: API-key billing, or plan usage on subscription auth
 *   npm run pipeline -- --full --mock      whole pipeline through the mock path (zero spend)
 *   npm run pipeline -- --full --count 4 --focus "small cap defense"
 *                                          focus-scoped run (modifier scopes discovery only)
 *   npm run pipeline -- --resume RUN_ID    finish a run that stopped mid-flight, IN PLACE:
 *                                          same cohort, banked cells kept, only the gap + compile run
 *   npm run pipeline -- --lens-probe RKLB [--effort medium]
 *                                          ONE fundamentals lens cell, no run row, no cache —
 *                                          the effort A/B comparator (cost/turns/quality metrics)
 *   flags: --count N (4..12), --force (skip lens cache)
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CONFIG, estimateRun, type EffortLevel } from "../lib/config";
import { createRun, getRunSnapshot } from "../lib/db";
import { executeResume, executeRun } from "../lib/orchestrator";
import { runAgentWithContract } from "../lib/orchestrator/agent";
import { bus, runChannel, type BusEvent } from "../lib/orchestrator/progress";
import { ALL_SKILLS, lensPrompt } from "../lib/orchestrator/prompts";
import { planResume } from "../lib/orchestrator/resume";
import { LENS_SKILLS, lensWireNoMarkdownSchema, sanitizeModifier, type RunParams } from "../lib/schemas";

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

  const auth = CONFIG.authMode();
  console.log(
    auth === "api-key"
      ? " INFO  auth: ANTHROPIC_API_KEY (per-token API billing)"
      : auth === "subscription"
        ? " INFO  auth: Claude subscription (logged-in CLI / OAuth token) — plan usage, no API billing; $ figures below are notional"
        : " INFO  auth: NONE detected — the probe will fail; set ANTHROPIC_API_KEY or log in with the Claude Code CLI",
  );

  const SmokeSchema = z.object({
    visibleSkills: z.array(z.string()).describe("Exact names of the skills listed as available to you"),
    echoedToken: z.string().describe("The token printed by the Bash command you ran"),
  });

  console.log(` ....  probing (model ${CONFIG.models.lens}, ~4 turns, pennies)…`);
  const started = Date.now();
  try {
    const { data, costUsd, numTurns, via } = await runAgentWithContract(SmokeSchema, {
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
    allOk = checkLine("structured output round-trip (zod-validated)", true, `via ${via} handoff${via === "fenced" ? " — CLI treats outputFormat as advisory; fence contract is load-bearing" : ""}`) && allOk;
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

  console.log(allOk ? "\nSmoke test PASSED — structured handoff is go." : "\nSmoke test FAILED — fix the above before a full run.");
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
  const focusRaw = argValue("--focus");
  const modifier = focusRaw ? sanitizeModifier(focusRaw) : undefined;
  const blind = args.has("--blind");
  const params: RunParams = { count, force: args.has("--force"), mock, blind, ...(modifier ? { modifier } : {}) };

  banner(`MAG8 FULL PIPELINE — count=${count} force=${params.force} mock=${mock}${blind ? " blind" : ""}${modifier ? ` focus="${modifier}"` : ""}`);
  if (!mock) {
    const est = estimateRun(count);
    console.log(
      ` INFO  ${est.calls} agent calls (1 discovery + ${count}×${LENS_SKILLS.length} lenses + 1 compile), est. $${est.usdLow}–$${est.usdHigh}, ~${est.minutesLow}–${est.minutesHigh} min`,
    );
    const auth = CONFIG.authMode();
    if (auth === "subscription") {
      console.log(" INFO  auth: Claude subscription — the $ estimate is notional; the run draws on your plan's usage limits, no API billing.");
    } else if (auth === "none") {
      console.log(" WARN  no Claude credentials detected (no API key, no logged-in CLI, no CLAUDE_CODE_OAUTH_TOKEN) — the first agent call will fail.");
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

/* ============================================================================
 * --resume: finish a run that stopped mid-flight, in place. Same run id, same
 * cohort, banked cells carried through — the plan window pays for the gap only.
 * The headless twin of the desk's Resume button (identical code path).
 * ========================================================================== */

async function resume(): Promise<number> {
  const runId = (argValue("--resume") ?? "").trim();
  if (!runId || runId.startsWith("--")) {
    console.log("Usage: npm run pipeline -- --resume RUN_ID");
    return 2;
  }

  const check = planResume(runId);
  if (!check.ok) {
    console.log(` FAIL  cannot resume ${runId} — ${check.error} (${check.code})`);
    return 2;
  }
  const { plan } = check;

  banner(`MAG8 RESUME — run ${plan.run.id}`);
  console.log(` INFO  started ${plan.run.createdAt}, stopped as "${plan.run.status}" after $${plan.run.totalCostUsd ?? 0} (notional on subscription auth)`);
  console.log(` INFO  cohort ${plan.candidates.length}: ${plan.candidates.map((c) => c.ticker).join(", ")}`);
  console.log(` INFO  ${plan.banked.size}/${plan.total} lens cells banked — ${plan.remaining} to run + 1 compile`);
  if (plan.staleWeeks.length > 0) {
    console.log(` WARN  banked cells date from ${plan.staleWeeks.join(", ")}, not the current week — the report will disclose it`);
  }
  const auth = CONFIG.authMode();
  if (auth === "subscription") {
    console.log(" INFO  auth: Claude subscription — plan usage, no API billing; $ figures are notional.");
  } else if (auth === "none") {
    console.log(" WARN  no credentials detected — the first call will fail.");
  }

  bus().on(runChannel(runId), renderEvent);
  const started = Date.now();
  await executeResume(runId, plan);
  bus().off(runChannel(runId), renderEvent);

  const snapshot = getRunSnapshot(runId);
  console.log(
    `\n  Finished in ${((Date.now() - started) / 60000).toFixed(1)} min — status=${snapshot?.run.status}, cells ok=${snapshot?.cells.filter((c) => c.status === "ok").length}/${snapshot?.cells.length}, ranked=${snapshot?.rankings.length}`,
  );
  console.log(`  View at /runs/${runId} once the app is up.`);
  return snapshot?.run.status === "complete" ? 0 : 1;
}

/* ============================================================================
 * --lens-probe: one fundamentals cell against a stub candidate — no run row,
 * no cache read/write. The effort A/B comparator: run the same ticker at
 * --effort high and --effort medium, then compare cost / turns / retry /
 * populated-metrics / source-link counts before flipping MAG8_LENS_EFFORT.
 * ========================================================================== */

const EFFORT_CHOICES = new Set(["low", "medium", "high", "xhigh", "max"]);

async function lensProbe(): Promise<number> {
  const ticker = (argValue("--lens-probe") ?? "").trim().toUpperCase();
  if (!ticker || ticker.startsWith("--")) {
    console.log("Usage: npm run pipeline -- --lens-probe TICKER [--effort low|medium|high|xhigh|max]");
    return 2;
  }
  const effortArg = argValue("--effort")?.trim().toLowerCase();
  const effort: EffortLevel = effortArg && EFFORT_CHOICES.has(effortArg) ? (effortArg as EffortLevel) : CONFIG.effort.lens;

  banner(`MAG8 LENS PROBE — ${ticker} × fundamentals @ effort=${effort} (model ${CONFIG.models.lens})`);
  const auth = CONFIG.authMode();
  if (auth === "none") console.log(" WARN  no credentials detected — the probe will fail.");
  else console.log(` INFO  auth: ${auth}${auth === "subscription" ? " — $ figures are notional plan usage" : ""}`);

  const candidate = {
    ticker,
    companyName: ticker,
    sector: "probe",
    thesis: `Probe run: analyze ${ticker} strictly on its own merits.`,
    matchedTraits: ["probe"],
  };

  let retried = false;
  const started = Date.now();
  try {
    const { data, costUsd, numTurns, via, narrativeText } = await runAgentWithContract(
      lensWireNoMarkdownSchema("stock-scanner"),
      {
        prompt: lensPrompt("stock-scanner", candidate),
        model: CONFIG.models.lens,
        allowedTools: ["WebSearch", "WebFetch", "Bash", "Read"],
        skills: ["stock-scanner"],
        maxTurns: CONFIG.maxTurns.lens,
        timeoutMs: CONFIG.timeoutsMs.lens,
        effort,
        thinking: CONFIG.thinking.lens,
        maxBudgetUsd: CONFIG.maxBudgetUsd.lens,
        label: `probe:${ticker}:fundamentals`,
        onActivity: (a) => {
          if (a.includes("failed validation")) retried = true;
          console.log(`        ${a}`);
        },
      },
    );

    const km = data.keyMetrics as Record<string, unknown>;
    const nullFields = Object.entries(km)
      .filter(([, v]) => v === null || v === undefined)
      .map(([k]) => k);
    const urlCount = (narrativeText.match(/https?:\/\//g) ?? []).length;

    banner("PROBE RESULT");
    console.log(`  duration        ${((Date.now() - started) / 1000).toFixed(0)}s`);
    console.log(`  cost            $${costUsd.toFixed(4)} (${auth === "subscription" ? "notional" : "billed"})`);
    console.log(`  turns           ${numTurns}`);
    console.log(`  handoff         via ${via}${retried ? " — CORRECTIVE RETRY FIRED" : " — first attempt"}`);
    console.log(`  verdict         ${data.verdict} (confidence ${data.confidence})`);
    console.log(`  keyMetrics      ${JSON.stringify(km)}`);
    console.log(`  null metrics    ${nullFields.length ? nullFields.join(", ") : "none"}`);
    console.log(`  source links    ${urlCount} in the narrative (${narrativeText.length} chars)`);
    console.log(`  riskFlags       ${data.riskFlags.length}`);
    return 0;
  } catch (err) {
    console.log(`  PROBE FAILED — ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}

async function main() {
  if (args.has("--smoke")) process.exit(await smoke());
  if (args.has("--full")) process.exit(await full());
  if (args.has("--resume")) process.exit(await resume());
  if (args.has("--lens-probe")) process.exit(await lensProbe());
  console.log(
    "Usage: npm run pipeline -- --smoke | --full [--count N] [--force] [--mock] | --resume RUN_ID | --lens-probe TICKER [--effort LEVEL]",
  );
  process.exit(2);
}

void main();
