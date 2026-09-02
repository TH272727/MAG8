import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BUILTIN_HANDLES,
  ecosystemHandles,
  foldEcosystem,
  notMeasured,
  readEcosystem,
} from "../../lib/reach/github";

/* ============================================================================
 * Offline.
 *
 * The failure this whole file guards is a single one: reporting an ABSENCE as
 * a low reading. Four real companies in this universe — Symbotic, Archer
 * Aviation, Rocket Lab and SentinelOne — hold a registered organisation handle
 * that publishes nothing at all. A resolver that says "found" and then reads
 * emptiness as weak developer traction produces a confident wrong answer about
 * every one of them.
 *
 * So there are THREE states, and they must never collapse into two:
 *   null                → never looked up (no curated handle)
 *   notMeasured set     → looked up, and there is nothing to measure
 *   figures             → measured
 * ========================================================================== */

afterEach(() => vi.unstubAllGlobals());

const ORG = { public_repos: 64, followers: 228, html_url: "https://github.com/rigetti" };
const repo = (name: string, stars: number, pushed: string, fork = false) => ({
  name,
  html_url: `https://github.com/rigetti/${name}`,
  stargazers_count: stars,
  pushed_at: `${pushed}T00:00:00Z`,
  fork,
});
const ASOF = new Date("2026-09-02T12:00:00Z");
const OPTS = { minRepos: 1, asOf: ASOF };

describe("an absence is not a low score", () => {
  it("reports an organisation with no repositories as not measured", () => {
    const out = foldEcosystem("SYM", "symbotic", { public_repos: 0, followers: 1 }, [], OPTS);
    expect(out.notMeasured).toBe("the organisation exists but publishes no public repositories");
    // And carries no figures that could be read as a reading.
    expect(out.sampledStars).toBe(0);
    expect(out.topRepo).toBeNull();
  });

  it("reports below-threshold as not measured, saying how far below", () => {
    const out = foldEcosystem("X", "x", { public_repos: 2, followers: 5 }, [], { minRepos: 5, asOf: ASOF });
    expect(out.notMeasured).toContain("2 public repository");
  });

  it("distinguishes never-looked-up from looked-up-and-empty", async () => {
    // No curated handle means we never looked. That is not a finding, so there
    // is nothing to report at all — a different answer from "publishes nothing".
    expect(await readEcosystem("ASTS", undefined, OPTS)).toBeNull();
    expect(notMeasured("SYM", "symbotic", "why").notMeasured).toBe("why");
  });
});

describe("folding an organisation and its repositories", () => {
  it("sums stars, finds the top repository, and counts recent pushes", () => {
    const out = foldEcosystem(
      "RGTI",
      "rigetti",
      ORG,
      [repo("pyquil", 1498, "2026-08-30"), repo("quilc", 500, "2026-08-01"), repo("old", 12, "2024-01-01")],
      OPTS,
    );
    expect(out.sampledStars).toBe(2010);
    expect(out.topRepo).toEqual({ name: "pyquil", stars: 1498, url: "https://github.com/rigetti/pyquil" });
    expect(out.pushedLast90d).toBe(2);
    expect(out.latestPush).toBe("2026-08-30");
    expect(out.notMeasured).toBeUndefined();
  });

  it("excludes forks from every per-repository figure", () => {
    // An organisation that mirrors other people's projects has not built an
    // ecosystem. Counting stars on a fork as its own traction is exactly the
    // flattering wrong number this layer exists to avoid.
    const out = foldEcosystem(
      "X",
      "x",
      { public_repos: 2, followers: 3 },
      [repo("mine", 10, "2026-08-30"), repo("someone-elses", 90_000, "2026-08-30", true)],
      OPTS,
    );
    expect(out.sampledRepos).toBe(1);
    expect(out.sampledStars).toBe(10);
    expect(out.topRepo?.name).toBe("mine");
  });

  it("keeps the exact organisation totals separate from the sampled ones", () => {
    // GitHub pages this endpoint at 100 and several of these organisations
    // publish many times that, so the star total is a SAMPLE. publicRepos is
    // the truth; conflating them would understate the biggest ones silently.
    const out = foldEcosystem("DDOG", "DataDog", { public_repos: 1201, followers: 3286 }, [repo("a", 5, "2026-08-30")], OPTS);
    expect(out.publicRepos).toBe(1201);
    expect(out.orgFollowers).toBe(3286);
    expect(out.sampledRepos).toBe(1);
  });

  it("survives records with fields missing or of the wrong type", () => {
    const out = foldEcosystem("X", "x", { public_repos: 3 }, [{ name: "a" }, { stargazers_count: "many" }, {}], OPTS);
    expect(out.orgFollowers).toBe(0);
    expect(out.sampledStars).toBe(0);
    expect(out.latestPush).toBe("");
    expect(out.notMeasured).toBeUndefined();
  });
});

describe("the curated handle map", () => {
  it("ships handles that were verified, including four known-empty ones", () => {
    // The empty ones are deliberate: keeping them lets the read say "publishes
    // nothing" instead of "not looked up".
    for (const t of ["IONQ", "RGTI", "QBTS"]) expect(BUILTIN_HANDLES[t]).toBeTruthy();
    for (const t of ["SYM", "ACHR", "RKLB", "S"]) expect(BUILTIN_HANDLES[t]).toBeTruthy();
  });

  it("lets a custom entry override a built-in", () => {
    expect(ecosystemHandles({ IONQ: "ionq-labs" }).IONQ).toBe("ionq-labs");
    expect(ecosystemHandles({ " nvda ": "NVIDIA" }).NVDA).toBe("NVIDIA");
  });

  it("lets an empty handle remove a built-in", () => {
    // The way to say "this mapping is wrong" without editing code — and it must
    // return to never-looked-up, not to a broken lookup.
    expect(ecosystemHandles({ IONQ: "" }).IONQ).toBeUndefined();
  });

  it("leaves the built-ins alone when there are no overrides", () => {
    expect(ecosystemHandles(null)).toEqual({ ...BUILTIN_HANDLES });
  });
});

describe("failing open", () => {
  function stub(status: number, body: unknown, headers: Record<string, string> = {}) {
    vi.stubGlobal("fetch", async () => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
      json: async () => body,
    }) as unknown as Response);
  }

  it("names a missing organisation rather than throwing", async () => {
    stub(404, { message: "Not Found" });
    const out = await readEcosystem("X", "nope", OPTS);
    expect(out?.notMeasured).toContain("no such organisation");
  });

  it("says the budget is exhausted rather than reporting a company as empty", async () => {
    // The dangerous one: a rate-limited request that fell through as a zero
    // would report every remaining candidate as publishing nothing.
    stub(403, {}, { "x-ratelimit-remaining": "0" });
    const out = await readEcosystem("X", "rigetti", OPTS);
    expect(out?.notMeasured).toBe("hourly request budget exhausted");
  });

  it("distinguishes a plain refusal from an exhausted budget", async () => {
    stub(403, {}, { "x-ratelimit-remaining": "42" });
    expect((await readEcosystem("X", "rigetti", OPTS))?.notMeasured).toContain("refused");
  });

  it("does not spend a second request on an organisation with nothing to list", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ public_repos: 0, followers: 1 }),
      } as unknown as Response;
    });
    const out = await readEcosystem("SYM", "symbotic", OPTS);
    expect(calls).toBe(1);
    expect(out?.notMeasured).toContain("publishes no public repositories");
  });
});
