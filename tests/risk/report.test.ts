import { describe, expect, it } from "vitest";
import { buildRiskReport, reportInputs, verifyRiskReport } from "../../lib/risk/report";
import type { BoardName, RiskBoard } from "../../lib/risk/desk";
import type { Sleeve } from "../../lib/risk/sleeve";
import { RISK_SETTINGS_SPEC } from "../../lib/risk-settings";
import type { RiskSettings } from "../../lib/risk-settings";

/* ============================================================================
 * The written report. The point of these tests is not that the prose reads
 * well — it is that no figure in it can come from anywhere but an input, and
 * that the check saying so actually fails when it should.
 * ========================================================================== */

const settings = Object.fromEntries(
  RISK_SETTINGS_SPEC.map((s) => [s.key, s.default]),
) as unknown as RiskSettings;

const name = (over: Partial<BoardName>): BoardName => ({
  ticker: "AAA",
  companyName: null,
  sector: null,
  desks: 2,
  store: "risk",
  volPct: 48.5,
  downsideVolPct: 30.1,
  beta: 1.24,
  drawdown: {
    depthPct: -40.4,
    peakDate: "2025-10-14",
    troughDate: "2026-07-29",
    peakAtWindowStart: false,
    recoveredDate: null,
    sessionsToRecover: null,
    underwaterAtEnd: true,
  },
  totalReturnPct: 7.9,
  sessions: 252,
  from: "2025-09-05",
  to: "2026-09-04",
  adjusted: true,
  source: "yahoo",
  measured: true,
  reason: null,
  riskSharePct: 55.3,
  inSleeve: true,
  ...over,
});

const sleeve = (over: Partial<Sleeve> = {}): Sleeve => ({
  tickers: ["AAA", "BBB"],
  sessions: 252,
  from: "2025-09-05",
  to: "2026-09-04",
  volPct: 48.5,
  averageMemberVolPct: 71.2,
  effectivePositions: 2.2,
  totalReturnPct: 7.9,
  drawdown: {
    depthPct: -40.4,
    peakDate: "2025-10-14",
    troughDate: "2026-07-29",
    peakAtWindowStart: false,
    recoveredDate: null,
    sessionsToRecover: null,
    underwaterAtEnd: true,
  },
  beta: 2.47,
  benchmarkVolPct: 12.8,
  benchmarkTicker: "SPY",
  benchmarkSessions: 250,
  contributions: [
    { ticker: "AAA", weight: 0.5, ownVolPct: 60.2, riskSharePct: 55.3, excessPoints: 5.3 },
    { ticker: "BBB", weight: 0.5, ownVolPct: 82.1, riskSharePct: 44.7, excessPoints: -5.3 },
  ],
  returns: [],
  dates: [],
  ...over,
});

const board = (over: Partial<RiskBoard> = {}): RiskBoard => {
  const names = over.names ?? [name({}), name({ ticker: "BBB", riskSharePct: 44.7, volPct: 82.1 })];
  return {
    asOf: "2026-09-04",
    settings,
    benchmark: "SPY",
    names,
    shown: names,
    truncated: false,
    pairs: [
      {
        a: "AAA",
        b: "BBB",
        r: 0.85,
        sessions: 252,
        from: "2025-09-05",
        to: "2026-09-04",
        mixedBasis: false,
        together: true,
      },
    ],
    pairSummary: { together: 1, namesInvolved: 2, mixedBasisSuppressed: 0, strongest: null },
    sleeve: sleeve(),
    sleeveExcluded: [],
    exposure: null,
    atBand: null,
    totalNamed: 244,
    measured: names.filter((n) => n.measured).length,
    unmeasured: names.filter((n) => !n.measured).length,
    stale: false,
    flags: [],
    disabled: false,
    empty: false,
    ...over,
  };
};

describe("buildRiskReport", () => {
  it("writes a report whose every numeral and date traces to an input", () => {
    const b = board();
    const text = buildRiskReport(b);
    const check = verifyRiskReport(text, reportInputs(b));
    expect(check.offenders, `untraceable: ${check.offenders.join(", ")}`).toEqual([]);
    expect(check.badDates, `bad dates: ${check.badDates.join(", ")}`).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it("still verifies with a full set of notes attached", () => {
    // The notes are free prose with numbers embedded in them, which is exactly
    // where an unregistered figure gets in.
    const b = board({
      flags: [
        "SPY is stored by another desk and its history reaches 2 session(s) less far forward than the " +
          "basket's, so the market comparison is measured over 250 of the basket's 252 sessions.",
      ],
      sleeveExcluded: [{ ticker: "CCC", sessions: 91 }],
    });
    const text = buildRiskReport(b);
    const check = verifyRiskReport(text, reportInputs(b));
    expect(check.offenders).toEqual([]);
    expect(check.ok).toBe(true);
  });

  it("says a company is NOT MEASURED rather than giving it a zero", () => {
    const b = board({
      names: [name({ ticker: "ZZZ", measured: false, reason: "too-short", volPct: null, sessions: 40 })],
    });
    const text = buildRiskReport(b);
    expect(text).toContain("NOT MEASURED");
    expect(text).not.toMatch(/\|\s*ZZZ\s*\|\s*0\.0%/);
  });

  it("names the window's opening level rather than calling it a peak", () => {
    const b = board({
      sleeve: sleeve({
        drawdown: {
          depthPct: -40.4,
          peakDate: "2025-09-05",
          troughDate: "2026-07-29",
          peakAtWindowStart: true,
          recoveredDate: null,
          sessionsToRecover: null,
          underwaterAtEnd: true,
        },
      }),
    });
    const text = buildRiskReport(b);
    expect(text).toContain("from the level it opened at on 2025-09-05");
    expect(verifyRiskReport(text, reportInputs(b)).ok).toBe(true);
  });

  it("always carries the two results that argue against reading it as advice", () => {
    const text = buildRiskReport(board());
    expect(text).toContain("equal-weight");
    expect(text).toContain("risen specifically in falling markets");
    expect(text).toContain("Nothing here is a recommendation to buy, sell, or hold anything");
  });
});

describe("verifyRiskReport", () => {
  const inputs = reportInputs(board());

  it("accepts a figure written to a coarser precision than it was computed at", () => {
    // 0.2869 and 0.287 both trace back to a computed 0.28685.
    expect(verifyRiskReport("the reading is 0.2869", { ...inputs, numbers: [0.28685] }).ok).toBe(true);
    expect(verifyRiskReport("the reading is 0.287", { ...inputs, numbers: [0.28685] }).ok).toBe(true);
  });

  it("REFUSES a fabricated figure", () => {
    // Proved by injection, not assumed: this is the whole reason the check
    // exists, so it has to be shown failing.
    const r = verifyRiskReport("the basket fell 63.2% last year", { ...inputs, numbers: [48.5] });
    expect(r.ok).toBe(false);
    expect(r.offenders).toContain("63.2");
  });

  it("REFUSES a figure whose sign is wrong", () => {
    // A fall of forty per cent written as a RISE of forty per cent is not a
    // rounding, it is the opposite claim. A sign-blind reader would pass it.
    const r = verifyRiskReport("the worst fall was 40.4%", { ...inputs, numbers: [-40.4] });
    expect(r.ok).toBe(false);
    expect(r.offenders).toContain("40.4");
    expect(verifyRiskReport("the worst fall was -40.4%", { ...inputs, numbers: [-40.4] }).ok).toBe(true);
  });

  it("REFUSES a date the board never produced", () => {
    const r = verifyRiskReport("the trough was 2019-03-11", { ...inputs, dates: ["2026-07-29"] });
    expect(r.ok).toBe(false);
    expect(r.badDates).toEqual(["2019-03-11"]);
  });

  it("does not mistake a date's parts for fabricated figures", () => {
    // A sign-aware reader tokenises 2026-04-15 as 2026, -4 and -15. Admitting
    // those through the allowed list would then admit a fabricated "-4%"
    // anywhere in the prose, so dates are masked and checked separately.
    const r = verifyRiskReport("measured to 2026-09-04", { ...inputs, dates: ["2026-09-04"], numbers: [] });
    expect(r.ok).toBe(true);
  });

  it("does not flag a digit that is part of a company's name", () => {
    const r = verifyRiskReport("3M Company was measured", {
      numbers: [],
      dates: [],
      names: ["3M Company"],
    });
    expect(r.ok).toBe(true);
  });

  it("masks the longest company name first, so one inside another survives", () => {
    const r = verifyRiskReport("Acme 3 Holdings and Acme 3 both listed", {
      numbers: [],
      dates: [],
      names: ["Acme 3", "Acme 3 Holdings"],
    });
    expect(r.ok).toBe(true);
  });
});
