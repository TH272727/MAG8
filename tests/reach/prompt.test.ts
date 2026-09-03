import { describe, expect, it } from "vitest";
import { lensPrompt, runDateLine, type LensEvidence } from "../../lib/orchestrator/prompts";
import type { DiscoveryCandidate } from "../../lib/schemas";
import type { CompanyEntry } from "../../lib/reach/snapshot";

/* ============================================================================
 * What the evidence layer actually says to a lens.
 *
 * Two things are pinned here that nothing else can pin. First, the block must
 * be ABSENT — byte for byte — when there is no evidence, so a week with no
 * snapshot behaves exactly as the pipeline did before this layer existed.
 * Second, every distinction the layer works to preserve has to survive into
 * the prose: an unread company must not read as a company with nothing to
 * report, and an unmeasured ecosystem must not read as a weak one.
 * ========================================================================== */

const DATE = runDateLine(new Date("2026-09-02T12:00:00Z"));
const CANDIDATE: DiscoveryCandidate = {
  ticker: "RGTI",
  companyName: "Rigetti Computing",
  sector: "Quantum computing",
  thesis: "A hypothesis to verify.",
  matchedTraits: ["platform economics"],
};

const company = (over: Partial<CompanyEntry> = {}): CompanyEntry => ({
  ticker: "RGTI",
  cik: 1838359,
  entityName: "Rigetti Computing, Inc.",
  recent: [
    { form: "10-Q", filed: "2026-08-06", period: "2026-06-30", kind: "periodic", url: "https://www.sec.gov/Archives/a" },
    { form: "8-K", filed: "2026-08-20", period: "2026-08-19", kind: "event", url: "https://www.sec.gov/Archives/b" },
  ],
  offeringCount: 0,
  ...over,
});

const ev = (over: Partial<LensEvidence> = {}): LensEvidence => ({
  company: company(),
  filingsWindowDays: 180,
  releaseWindowDays: 35,
  ...over,
});

const prompt = (skill: "stock-scanner" | "gt-predictor" | "institutional-forecast", e: LensEvidence | null) =>
  lensPrompt(skill, CANDIDATE, DATE, null, e);

describe("absence of evidence changes nothing", () => {
  it("renders byte-identically with no evidence and with an empty read", () => {
    // The fail-open contract: a week with no snapshot must produce exactly the
    // prompt the pipeline produced before this layer existed.
    expect(prompt("stock-scanner", ev({ company: null }))).toBe(prompt("stock-scanner", null));
  });

  it("adds nothing for a company that filed nothing of interest", () => {
    expect(prompt("stock-scanner", ev({ company: company({ recent: [], offeringCount: 0 }) }))).toBe(
      prompt("stock-scanner", null),
    );
  });
});

describe("the distinctions have to survive into the prose", () => {
  it("says a company could not be READ, rather than staying silent", () => {
    // Silence here would read as "nothing was filed" — the exact conflation
    // the two-field design exists to prevent.
    const p = prompt("stock-scanner", ev({ company: company({ recent: [], unavailable: "filing history unavailable (503)" }) }));
    expect(p).toContain("could not be read");
    expect(p).toContain("absence of a list is not absence of filings");
  });

  it("says an ecosystem is NOT MEASURED, and says an absence is not a low reading", () => {
    const p = prompt(
      "stock-scanner",
      ev({
        company: company({
          ecosystem: {
            ticker: "SYM",
            org: "symbotic",
            url: "https://github.com/symbotic",
            publicRepos: 0,
            orgFollowers: 1,
            sampledRepos: 0,
            sampledStars: 0,
            topRepo: null,
            pushedLast90d: 0,
            latestPush: "",
            notMeasured: "the organisation exists but publishes no public repositories",
          },
        }),
      }),
    );
    expect(p).toContain("NOT MEASURED");
    expect(p).toContain("never as a low reading");
    // And it must not print a figure that could be read as a reading.
    expect(p).not.toMatch(/0 public repositories, 1 followers/);
  });

  it("refuses to claim a trend with no earlier reading", () => {
    const eco = {
      ticker: "RGTI",
      org: "rigetti",
      url: "https://github.com/rigetti",
      publicRepos: 64,
      orgFollowers: 228,
      sampledRepos: 41,
      sampledStars: 2010,
      topRepo: { name: "pyquil", stars: 1498, url: "https://github.com/rigetti/pyquil" },
      pushedLast90d: 12,
      latestPush: "2026-08-30",
    };
    expect(prompt("stock-scanner", ev({ company: company({ ecosystem: eco }) }))).toContain("no trend is claimed");
    const withPrior = prompt(
      "stock-scanner",
      ev({ company: company({ ecosystem: { ...eco, since: { weekKey: "2026-W35", publicRepos: 60, orgFollowers: 200 } } }) }),
    );
    expect(withPrior).toContain("Against 2026-W35: +4 repositories, +28 followers");
  });

  it("states the sample when the organisation publishes more than one page", () => {
    // publicRepos is exact; the star total is a sample. Conflating them would
    // silently understate the largest organisations.
    const p = prompt(
      "stock-scanner",
      ev({
        company: company({
          ecosystem: {
            ticker: "DDOG", org: "DataDog", url: "https://github.com/DataDog",
            publicRepos: 1201, orgFollowers: 3286, sampledRepos: 87, sampledStars: 5,
            topRepo: null, pushedLast90d: 40, latestPush: "2026-08-30",
          },
        }),
      }),
    );
    expect(p).toContain("87 most recently updated non-fork repositories");
  });

  it("reports offerings as a count, and calls it a count", () => {
    const p = prompt("stock-scanner", ev({ company: company({ offeringCount: 7 }) }));
    expect(p).toContain("7 registration or prospectus form(s)");
    expect(p).toContain("not as a judgement");
  });
});

describe("routing", () => {
  it("gives official releases only to the lens whose thesis turns on them", () => {
    // The other two would pay tokens out of the same per-call budget as the
    // analysis for context they have no use for.
    const releases = [
      { sourceId: "bls-cpi", publisher: "US Bureau of Labor Statistics", title: "CPI for all items increases 0.1%", date: "2026-08-12", url: "https://www.bls.gov/x" },
    ];
    expect(prompt("gt-predictor", ev({ releases }))).toContain("CPI for all items increases 0.1%");
    expect(prompt("stock-scanner", ev({ releases: undefined }))).not.toContain("Dated official releases");
    expect(prompt("institutional-forecast", ev({ releases: undefined }))).not.toContain("Dated official releases");
  });

  it("tells the lens to cite the artifact rather than a write-up about it", () => {
    const p = prompt("stock-scanner", ev());
    expect(p).toContain("These are the artifacts themselves");
    expect(p).toContain("rather than a secondary write-up about them");
    expect(p).toContain("https://www.sec.gov/Archives/a");
  });

  it("keeps the block inside one reference section rather than adding a new one", () => {
    // One block, one vocabulary — a second heading would be a second surface
    // to keep clean.
    const p = prompt("gt-predictor", ev({ releases: [] }));
    expect(p.match(/Platform-verified reference data/g)).toHaveLength(1);
  });
});
