import path from "node:path";

function int(v: string | undefined, fallback: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function num(v: string | undefined, fallback: number): number {
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const CONFIG = {
  models: {
    discovery: process.env.MAG8_DISCOVERY_MODEL ?? "claude-opus-4-8",
    lens: process.env.MAG8_LENS_MODEL ?? "claude-sonnet-5",
    compiler: process.env.MAG8_COMPILER_MODEL ?? "claude-opus-4-8",
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

  /** Rough per-call knobs used only for the /admin pre-run estimate. */
  estimate: {
    usd: {
      discovery: [0.6, 2.5] as const,
      lens: [0.15, 0.75] as const,
      compile: [0.4, 1.5] as const,
    },
    minutes: {
      discovery: [3, 9] as const,
      lensCall: [2, 6] as const, // per lens call; batches of maxConcurrentStocks×3 run together
      compile: [2, 5] as const,
    },
  },

  /** Multiplier for mock-run sleeps (0.2 = 5× faster demo). */
  mockSpeed: num(process.env.MAG8_MOCK_SPEED, 1),

  dbPath: process.env.MAG8_DB_PATH
    ? path.resolve(process.env.MAG8_DB_PATH)
    : path.join(process.cwd(), "db", "mag8.db"),

  isDev: process.env.NODE_ENV !== "production",
  /** Mock runs are dev-only unless explicitly enabled (staging demos of Mission Control). */
  allowMock: () => process.env.NODE_ENV !== "production" || process.env.MAG8_ALLOW_MOCK === "1",
  hasApiKey: () => Boolean(process.env.ANTHROPIC_API_KEY?.trim()),
} as const;

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
