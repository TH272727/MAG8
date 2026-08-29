import { defineConfig } from "vitest/config";

/**
 * Unit tests cover the DETERMINISTIC half of this codebase — EDGAR parsing,
 * 13F arithmetic, conversion math, gap scoring — where a silently wrong number
 * is the failure mode. The model-driven pipeline is verified separately by
 * `npm run seed` (fixture regression) and the probe scripts, which is why they
 * are not in here.
 *
 * Tests run offline: every network response is served from tests/fixtures,
 * frozen from real SEC responses.
 */
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
  },
});
