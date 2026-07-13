import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function int(v: string | undefined, fallback: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function num(v: string | undefined, fallback: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Reasoning-effort levels the SDK accepts (its own default is "high"). */
export type EffortLevel = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORT_LEVELS: ReadonlySet<string> = new Set(["low", "medium", "high", "xhigh", "max"]);
function effortLevel(v: string | undefined, fallback: EffortLevel): EffortLevel {
  const k = v?.trim().toLowerCase();
  return k && EFFORT_LEVELS.has(k) ? (k as EffortLevel) : fallback;
}

/** Thinking override: "adaptive" | "disabled"; anything else → undefined (SDK default). */
export type ThinkingMode = "adaptive" | "disabled";
function thinkingMode(v: string | undefined): ThinkingMode | undefined {
  const k = v?.trim().toLowerCase();
  return k === "adaptive" || k === "disabled" ? k : undefined;
}

/** How real agent calls will authenticate (the SDK's spawned CLI resolves credentials itself). */
export type AuthMode = "api-key" | "subscription" | "none";

/**
 * The Agent SDK spawns the bundled Claude Code CLI, which can authenticate with
 * an API key (per-token billing) OR with a Claude subscription — either a
 * CLAUDE_CODE_OAUTH_TOKEN (`claude setup-token`) or the stored credentials of a
 * logged-in CLI on this machine. Subscription runs draw on the plan's usage
 * limits instead of billing an API account.
 *
 * MAG8_AUTH_MODE=subscription asserts subscription auth when detection cannot
 * see it (e.g. macOS stores CLI credentials in the Keychain, not on disk);
 * MAG8_AUTH_MODE=disabled hard-disables real runs regardless of credentials.
 */
function resolveAuthMode(): AuthMode {
  const override = process.env.MAG8_AUTH_MODE?.trim().toLowerCase();
  if (override === "disabled") return "none";
  if (process.env.ANTHROPIC_API_KEY?.trim()) return "api-key";
  if (override === "subscription") return "subscription";
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN?.trim()) return "subscription";
  try {
    const configDir = process.env.CLAUDE_CONFIG_DIR?.trim() || path.join(os.homedir(), ".claude");
    if (fs.existsSync(path.join(configDir, ".credentials.json"))) return "subscription";
  } catch {
    /* fs unreadable — treat as no credentials */
  }
  return "none";
}

export const CONFIG = {
  models: {
    // All stages default to Sonnet 5 (2026-07-04) to stretch subscription usage
    // limits — count=12 opus-bookended runs were exhausting the 5-hour window.
    // Restore opus per stage via these env knobs if discovery/compile quality dips.
    discovery: process.env.MAG8_DISCOVERY_MODEL ?? "claude-sonnet-5",
    lens: process.env.MAG8_LENS_MODEL ?? "claude-sonnet-5",
    compiler: process.env.MAG8_COMPILER_MODEL ?? "claude-sonnet-5",
  },

  /** Candidates admitted to Stage 2 simultaneously; each fans out 3 lens calls (≤ 3× this in flight). */
  maxConcurrentStocks: int(process.env.MAG8_MAX_CONCURRENT_STOCKS, 3),

  candidates: { min: 4, max: 12, default: 8 },

  timeoutsMs: {
    discovery: int(process.env.MAG8_DISCOVERY_TIMEOUT_MS, 12 * 60_000),
    lens: int(process.env.MAG8_LENS_TIMEOUT_MS, 8 * 60_000),
    compile: int(process.env.MAG8_COMPILE_TIMEOUT_MS, 6 * 60_000),
    run: int(process.env.MAG8_RUN_TIMEOUT_MS, 45 * 60_000),
  },

  maxTurns: {
    discovery: int(process.env.MAG8_MAX_TURNS_DISCOVERY, 40),
    lens: int(process.env.MAG8_MAX_TURNS_LENS, 30),
    compile: int(process.env.MAG8_MAX_TURNS_COMPILE, 8),
  },

  /**
   * Reasoning effort per stage (SDK default is "high"). The real constraint on
   * subscription auth is the plan's 5-hour usage window, so effort cuts buy
   * survivability directly. Compiler runs "medium": it has no tools and its
   * arithmetic is re-verified deterministically in TS. Lens defaults "medium"
   * per the 2026-07-06 A/B (RKLB probe): at "high" a cell exceeded the $1
   * per-call budget cap and died mid-research; at "medium" it completed
   * first-attempt in 97s / ~$0.69 with 18 source links and full scenario
   * extras. Raise MAG8_LENS_EFFORT and MAG8_LENS_MAX_USD together if you want
   * high back.
   */
  effort: {
    discovery: effortLevel(process.env.MAG8_DISCOVERY_EFFORT, "high"),
    lens: effortLevel(process.env.MAG8_LENS_EFFORT, "medium"),
    compiler: effortLevel(process.env.MAG8_COMPILER_EFFORT, "medium"),
  },

  /** Optional thinking override per stage: adaptive | disabled (unset → SDK default). */
  thinking: {
    discovery: thinkingMode(process.env.MAG8_DISCOVERY_THINKING),
    lens: thinkingMode(process.env.MAG8_LENS_THINKING),
    compiler: thinkingMode(process.env.MAG8_COMPILER_THINKING),
  },

  /** Hard per-call USD caps — runaway protection (SDK stops at error_max_budget_usd). */
  maxBudgetUsd: {
    discovery: num(process.env.MAG8_DISCOVERY_MAX_USD, 2.0),
    lens: num(process.env.MAG8_LENS_MAX_USD, 1.0),
    compile: num(process.env.MAG8_COMPILE_MAX_USD, 1.0),
  },

  /** Rough per-call knobs used only for the /admin pre-run estimate. */
  estimate: {
    usd: {
      // Discovery/compile ranges assume the sonnet-5 defaults (opus ≈ 1.7× these);
      // compile range reflects its "medium" effort default.
      discovery: [0.4, 1.5] as const,
      lens: [0.15, 0.75] as const,
      compile: [0.15, 0.6] as const,
    },
    minutes: {
      discovery: [3, 9] as const,
      lensCall: [2, 6] as const, // per lens call; batches of maxConcurrentStocks×3 run together
      compile: [2, 5] as const,
    },
  },

  /** Multiplier for mock-run sleeps (0.2 = 5× faster demo). */
  mockSpeed: num(process.env.MAG8_MOCK_SPEED, 1),

  // Stage-0 universe screen knobs live in lib/universe-settings.ts — a
  // registry with research-backed defaults, the same MAG8_UNIVERSE_* env
  // overrides as before, and owner overrides persisted from /admin.
  // Kill switch (MAG8_UNIVERSE=0) stays in lib/universe.ts, read per call.

  dbPath: process.env.MAG8_DB_PATH
    ? path.resolve(process.env.MAG8_DB_PATH)
    : path.join(process.cwd(), "db", "mag8.db"),

  isDev: process.env.NODE_ENV !== "production",
  /** Mock runs are dev-only unless explicitly enabled (staging demos of Mission Control). */
  allowMock: () => process.env.NODE_ENV !== "production" || process.env.MAG8_ALLOW_MOCK === "1",
  authMode: resolveAuthMode,
} as const;

/* ----------------------------------------------------------------------------
 * Site mode — pre-launch visibility switch
 * -------------------------------------------------------------------------- */

export type SiteMode = "launch" | "full";

/**
 * "launch" leaves ONLY the homepage viewable — methodology, rankings, lab,
 * admin, run replays, stock dossiers, and the run APIs all 404, and the home
 * page renders zero outbound links (waitlist is the only action). Pages are
 * hidden, never deleted; email capture stays live in both modes. Defaults:
 * production → "launch" (a fresh deploy exposes nothing by accident),
 * development → "full". Override either way with MAG8_SITE_MODE=launch|full.
 */
export function siteMode(): SiteMode {
  const v = process.env.MAG8_SITE_MODE?.trim().toLowerCase();
  if (v === "launch" || v === "full") return v;
  return process.env.NODE_ENV === "production" ? "launch" : "full";
}

/** True when the pre-launch curtain is down (only / and /methodology respond). */
export function launchMode(): boolean {
  return siteMode() === "launch";
}

/** Pre-run estimate for N candidates, shown on /admin before confirming. */
export function estimateRun(count: number) {
  const calls = 1 + count * 3 + 1;
  const { usd, minutes } = CONFIG.estimate;
  const lensBatches = Math.ceil(count / CONFIG.maxConcurrentStocks);
  const usdLow = usd.discovery[0] + count * 3 * usd.lens[0] + usd.compile[0];
  const usdHigh = usd.discovery[1] + count * 3 * usd.lens[1] + usd.compile[1];
  const minLow = minutes.discovery[0] + lensBatches * minutes.lensCall[0] + minutes.compile[0];
  const minHigh = minutes.discovery[1] + lensBatches * minutes.lensCall[1] + minutes.compile[1];
  return {
    calls,
    usdLow: Math.round(usdLow * 10) / 10,
    usdHigh: Math.round(usdHigh * 10) / 10,
    minutesLow: minLow,
    minutesHigh: minHigh,
  };
}
