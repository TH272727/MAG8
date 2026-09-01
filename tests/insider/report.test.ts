import { describe, expect, it } from "vitest";
import { buildClusters } from "../../lib/insider/clusters";
import { applyProfile, profileByKey } from "../../lib/insider/profiles";
import { rankByComposite } from "../../lib/insider/score";
import { assessCandidate, type AssessContext, type Candidate, type ScanView } from "../../lib/insider/scanner";
import {
  falsifiers,
  rankedCsv,
  renderCandidate,
  renderReport,
  verifyReportNumbers,
  whyItFits,
} from "../../lib/insider/report";
import { baselineInsiderSettings } from "../../lib/insider-settings";
import type { FinancialYear } from "../../lib/insider/fundamentals";
import type { InsiderOwner, InsiderTransactionRow } from "../../lib/db";

/* ============================================================================
 * The written report.
 *
 * Two things are being checked. That the structure and the number formatting
 * are right — a percentage printed as a percentage, dollars with separators.
 * And that the prose does not say things the figures do not support: a rally is
 * not a slowed decline, and a price above the estimate is not a negative
 * cushion "below" it. Both of those were real faults caught on live output.
 * ========================================================================== */

const AS_OF = "2026-08-28";
const DAY_MS = 86_400_000;

function series(anchors: [number, number][], days = 3 * 365) {
  const sorted = [...anchors].sort((a, b) => b[0] - a[0]);
  const at = (t: number): number => {
    if (t >= sorted[0][0]) return sorted[0][1];
    if (t <= sorted[sorted.length - 1][0]) return sorted[sorted.length - 1][1];
    for (let i = 0; i < sorted.length - 1; i++) {
      const [t0, p0] = sorted[i];
      const [t1, p1] = sorted[i + 1];
      if (t <= t0 && t >= t1) return p0 + ((p1 - p0) * (t0 - t)) / (t0 - t1);
    }
    return sorted[sorted.length - 1][1];
  };
  const end = Date.parse(`${AS_OF}T00:00:00Z`);
  const out: { date: string; close: number }[] = [];
  for (let t = days; t >= 0; t--) {
    const d = new Date(end - t * DAY_MS);
    if (d.getUTCDay() === 0 || d.getUTCDay() === 6) continue;
    out.push({ date: d.toISOString().slice(0, 10), close: Number(at(t).toFixed(4)) });
  }
  return out;
}

const FALLEN = series([[1095, 40], [121, 100], [120, 100], [20, 66], [10, 63], [0, 65]]);
const RALLIED = series([[1095, 40], [200, 100], [120, 62], [56, 63], [0, 94]]);

const fy = (over: Partial<FinancialYear>): FinancialYear => ({
  end: "2025-12-31",
  fy: 2025,
  netIncome: null,
  revenue: null,
  costOfRevenue: null,
  grossProfit: null,
  ebit: null,
  ocf: null,
  depreciation: null,
  capex: null,
  assets: null,
  currentAssets: null,
  liabilities: null,
  currentLiabilities: null,
  longTermDebt: null,
  equity: null,
  retainedEarnings: null,
  shares: null,
  sharesAsOf: null,
  sources: {},
  ...over,
});

const SOUND: FinancialYear[] = [2022, 2023, 2024, 2025].map((y, i) =>
  fy({
    end: `${y}-12-31`,
    fy: y,
    netIncome: 60 + i * 25,
    revenue: 500 + i * 120,
    grossProfit: 200 + i * 60,
    costOfRevenue: 300 + i * 60,
    ebit: 90 + i * 30,
    ocf: 110 + i * 30,
    depreciation: 40,
    capex: 45,
    assets: 900 + i * 60,
    currentAssets: 300 + i * 40,
    currentLiabilities: 180,
    liabilities: 350,
    longTermDebt: 200 - i * 15,
    equity: 560 + i * 60,
    retainedEarnings: 260 + i * 60,
    shares: 10,
  }),
);

const owner = (over: Partial<InsiderOwner> = {}): InsiderOwner => ({
  cik: "1",
  name: "SMITH JANE",
  isDirector: true,
  isOfficer: false,
  isTenPercentOwner: false,
  isOther: false,
  officerTitle: null,
  ...over,
});

const row = (over: Partial<InsiderTransactionRow> = {}): InsiderTransactionRow => ({
  accession: "0000000000-26-000001",
  line: 1,
  ticker: "GOOD",
  issuerCik: 1,
  issuerName: "Good Corp",
  period: "2026-08-20",
  filedDate: "2026-08-21",
  transactionDate: "2026-08-20",
  code: "P",
  acquiredDisposed: "A",
  shares: 5000,
  price: 65,
  sharesAfter: 50_000,
  ownership: "D",
  planned: "no",
  owners: [owner()],
  flags: [],
  ...over,
});

const SETTINGS = applyProfile(baselineInsiderSettings(), profileByKey("balanced"));

function build(rows: InsiderTransactionRow[], closes: Map<string, { closes: { date: string; close: number }[]; mixedBasis: boolean }>) {
  const { qualifying, rejected } = buildClusters(rows, {
    lookbackDays: SETTINGS.lookbackDays,
    minDollarValue: SETTINGS.minDollarValue,
    minClusterInsiders: SETTINGS.minClusterInsiders,
    requireOfficerOrDirector: SETTINGS.requireOfficerOrDirector,
    discountPlannedPct: SETTINGS.discountPlannedPct,
    now: new Date("2026-08-31T00:00:00Z"),
  });
  const ctx: AssessContext = {
    caps: new Map([...closes.keys()].map((t) => [t, 900])),
    coverage: new Map(),
    financials: new Map([...closes.keys()].map((t) => [t, { years: SOUND, entityName: `${t} Corp`, flags: [] }])),
    closes,
  };
  const assessed = qualifying.map((c) => assessCandidate(c, SETTINGS, ctx));
  const ranked = rankByComposite(assessed.filter((c) => c.stage === "ranked"));
  const view: ScanView = {
    asOf: AS_OF,
    lastRefresh: "2026-08-31T00:00:00.000Z",
    profile: profileByKey("balanced"),
    settings: SETTINGS,
    ranked,
    rejected: assessed.filter((c) => c.stage !== "ranked"),
    belowThreshold: rejected.map((r) => ({
      ticker: r.cluster.ticker,
      conviction: r.cluster.conviction,
      totalBoughtUsd: r.cluster.totalBoughtUsd,
      reasons: r.reasons,
    })),
    funnel: [{ key: "buying", label: "Companies with insider buying", count: assessed.length }],
    universeWeek: "2026-W32",
    disabled: false,
    stale: false,
    flags: [],
  };
  return { view, assessed: new Map(assessed.map((c) => [c.ticker, c])) };
}

const CLOSES = new Map([["GOOD", { closes: FALLEN, mixedBasis: false }]]);

describe("renderReport", () => {
  const { view } = build([row()], CLOSES);
  const md = renderReport(view);

  it("opens with the risk tolerance that was actually applied", () => {
    // The document's requirement: nothing has a hidden default buried inside.
    expect(md).toContain("**Risk tolerance applied: Balanced.**");
    expect(md).toContain("| Drawdown band | 2.0% to 60.0% below the 52-week high |");
    expect(md).toContain("| Cushion required | 25.0% below the estimate |");
  });

  it("carries every section the report is meant to have", () => {
    for (const heading of [
      "# Insider turnaround scan",
      "## The funnel",
      "## Ranked candidates",
      "### Why this fits the turnaround setup",
      "### The insider buying, line by line",
      "### The price setup",
      "### Financial strength",
      "### Owner-earnings valuation",
      "### What would say this thesis is wrong",
      "## Disclaimer",
    ]) {
      expect(md).toContain(heading);
    }
  });

  it("reproduces the platform disclaimer exactly, and adds the one this product needs", () => {
    expect(md).toContain(
      "> **This is not financial advice.** These are research ideas for further due diligence, generated from " +
        "public data that may be delayed or inaccurate. Valuations and scenarios are estimates, not predictions. " +
        "Markets are risky and you can lose money. Always do your own research and consider consulting a licensed " +
        "financial professional before making any investment decision.",
    );
    expect(md).toContain("legally required public disclosure of company insiders' own trades");
    expect(md).toContain("not advice to mirror them");
  });

  it("prints percentages as percentages and money with separators", () => {
    expect(md).toMatch(/\d+\.\d%/);
    expect(md).toContain("$100,000");
  });

  it("dates the price rather than presenting it as timeless", () => {
    expect(md).toContain(`Price (${AS_OF})`);
    expect(md).toContain(`Prices as of ${AS_OF}`);
  });

  it("shows the insider transactions line by line, not summarised away", () => {
    expect(md).toContain("| Date | Insider | Role | Code | Shares | Price | Value | Pre-arranged |");
    expect(md).toContain("| 2026-08-20 | SMITH JANE | Director | Open-market purchase | 5,000 | $65.00 |");
  });

  it("names the buying that fell below the reader's own thresholds separately", () => {
    const withSmall = build([row(), row({ ticker: "TINY", accession: "t", shares: 10 })], CLOSES);
    const out = renderReport(withSmall.view);
    expect(out).toContain("## Insider buying below your own thresholds");
    expect(out).toContain("were excluded by the thresholds above, not by anything about the business");
  });
});

describe("whyItFits", () => {
  it("reads as a sentence for a single buyer", () => {
    const { assessed } = build([row()], CLOSES);
    const text = whyItFits(assessed.get("GOOD")!, SETTINGS);
    expect(text).toContain("one insider, SMITH JANE (Director), bought");
    // A single day is not a range.
    expect(text).toContain("on 2026-08-20");
    expect(text).not.toContain("between 2026-08-20 and 2026-08-20");
  });

  it("reads as a sentence for a cluster", () => {
    const { assessed } = build(
      [
        row({ owners: [owner({ cik: "1", name: "A", isOfficer: true, officerTitle: "Chief Executive Officer" })] }),
        row({ accession: "b", transactionDate: "2026-08-24", owners: [owner({ cik: "2", name: "B" })] }),
      ],
      CLOSES,
    );
    const text = whyItFits(assessed.get("GOOD")!, SETTINGS);
    expect(text).toContain("2 different insiders including a named chief officer bought");
    expect(text).toContain("between 2026-08-20 and 2026-08-24");
  });

  it("does not call a rally a slowed decline", () => {
    // The deceleration test reads improved for a rising price, which is true of
    // the test and false of the stock.
    const { assessed } = build([row({ ticker: "UP", price: 94 })], new Map([["UP", { closes: RALLIED, mixedBasis: false }]]));
    const text = whyItFits(assessed.get("UP")!, SETTINGS);
    expect(text).toContain("The price has since risen");
    expect(text).not.toContain("The fall has slowed");
  });

  it("does not describe a price above the estimate as a negative cushion below it", () => {
    const { assessed } = build([row()], CLOSES);
    const c = assessed.get("GOOD")!;
    // Force the expensive case: an estimate far below the price.
    const dear: Candidate = {
      ...c,
      price: 500,
      dcf: { ...c.dcf!, perShareLow: 50, marginOfSafetyLow: -9 },
    };
    const text = whyItFits(dear, SETTINGS);
    expect(text).toContain("times that estimate rather than below it");
    expect(text).not.toContain("-900.0% below it");
  });

  it("says plainly when a company has not been worked up", () => {
    const bare = build([row({ ticker: "NEW" })], new Map());
    expect(whyItFits(bare.assessed.get("NEW")!, SETTINGS)).toContain("has not yet been worked up");
  });
});

describe("falsifiers", () => {
  const { assessed } = build([row()], CLOSES);
  const items = falsifiers(assessed.get("GOOD")!, SETTINGS);

  it("covers each of the four things that would overturn the reading", () => {
    const joined = items.join(" ");
    expect(joined).toContain("Insiders resume net selling");
    expect(joined).toContain("The strength score falls");
    expect(joined).toContain("Solvency deteriorates");
    expect(joined).toContain("A fresh low");
  });

  it("names the reader's own floor rather than a fixed one", () => {
    const strict = falsifiers(assessed.get("GOOD")!, { ...SETTINGS, fScoreFloor: 7 });
    expect(strict.join(" ")).toContain("A move below 7");
  });

  it("adds the pre-arranged warning only when there was pre-arranged buying", () => {
    expect(items.join(" ")).not.toContain("scheduled, not chosen");
    const planned = build([row({ planned: "yes" })], CLOSES);
    expect(falsifiers(planned.assessed.get("GOOD")!, SETTINGS).join(" ")).toContain("scheduled, not chosen");
  });

  it("reports selling that already happened", () => {
    const selling = build(
      [row(), row({ line: 2, code: "S", acquiredDisposed: "D", shares: 900, price: 66, owners: [owner({ cik: "9", name: "C" })] })],
      CLOSES,
    );
    expect(falsifiers(selling.assessed.get("GOOD")!, SETTINGS).join(" ")).toContain("already sold in this window");
  });
});

describe("renderCandidate", () => {
  it("says where a rejected company stopped instead of scoring it", () => {
    const flat = series([[1095, 60], [40, 100], [15, 98], [0, 99]]);
    const { view, assessed } = build([row({ ticker: "MEH", price: 99 })], new Map([["MEH", { closes: flat, mixedBasis: false }]]));
    const md = renderCandidate(assessed.get("MEH")!, view);
    expect(md).toContain("Not ranked. This company stopped at: price.");
    expect(md).toContain("drawdown band");
  });
});

describe("rankedCsv", () => {
  const { view } = build([row()], CLOSES);
  const csv = rankedCsv(view);

  it("has one header row and one row per ranked company", () => {
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1 + view.ranked.length);
    expect(lines[0]).toContain("ticker,company,as_of,price");
  });

  it("keeps every intermediate field, not just the score", () => {
    expect(csv).toContain("insider_bought_usd");
    expect(csv).toContain("value_per_share_conservative");
    expect(csv).toContain("value_per_share_maintenance");
    expect(csv).toContain("components_measured");
  });

  it("quotes a company name so a comma cannot break the row", () => {
    expect(csv).toContain('"GOOD Corp"');
  });
});

describe("verifyReportNumbers", () => {
  it("accepts a figure traceable to an input", () => {
    expect(verifyReportNumbers("The score is 57.2 today.", [57.2]).ok).toBe(true);
  });

  it("tolerates rounding to the last place actually written", () => {
    // Exact matching rejects 0.2869 for a computed 0.28685, which binary
    // arithmetic holds a hair low. The rotation board learned this first.
    expect(verifyReportNumbers("0.2869", [0.28685]).ok).toBe(true);
    expect(verifyReportNumbers("57.2", [57.24]).ok).toBe(true);
    expect(verifyReportNumbers("57", [57.4]).ok).toBe(true);
  });

  it("rejects a number that came from nowhere", () => {
    const r = verifyReportNumbers("The score is 57.2, up from 41.9.", [57.2]);
    expect(r.ok).toBe(false);
    expect(r.offenders).toEqual(["41.9"]);
  });

  it("reads a thousands separator as one number", () => {
    expect(verifyReportNumbers("$1,234,567 bought", [1_234_567]).ok).toBe(true);
  });
});
