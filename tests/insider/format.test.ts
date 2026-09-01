import { describe, expect, it } from "vitest";
import {
  BAND_ACCENT,
  fmtAgo,
  fmtDay,
  fmtFraction,
  fmtInt,
  fmtNum,
  fmtPct,
  fmtPrice,
  fmtSignedFraction,
  fmtUsd,
  scoreBand,
  STAGE_META,
  ZONE_STYLE,
} from "../../lib/insider/format";

/* ============================================================================
 * Display formatting.
 *
 * The thing being guarded is narrow and worth guarding: every one of these is
 * fed values that are legitimately absent — a company with no valuation, a
 * ratio that could not be computed — and a formatter that renders those as
 * "NaN", "null" or "0" puts a number on a page where there was no measurement.
 * An em dash is the only honest output.
 * ========================================================================== */

const ABSENT = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY];

describe("absent values never render as numbers", () => {
  it("holds for every formatter", () => {
    for (const v of ABSENT) {
      expect(fmtUsd(v)).toBe("—");
      expect(fmtPrice(v)).toBe("—");
      expect(fmtPct(v)).toBe("—");
      expect(fmtFraction(v)).toBe("—");
      expect(fmtSignedFraction(v)).toBe("—");
      expect(fmtNum(v)).toBe("—");
      expect(fmtInt(v)).toBe("—");
    }
    expect(fmtDay(null)).toBe("—");
    expect(fmtDay("")).toBe("—");
  });

  it("distinguishes an absent value from a real zero", () => {
    expect(fmtUsd(0)).toBe("$0");
    expect(fmtPct(0)).toBe("0.0%");
    expect(fmtNum(0)).toBe("0.00");
    expect(fmtInt(0)).toBe("0");
  });
});

describe("fmtUsd", () => {
  it("scales to a readable unit", () => {
    expect(fmtUsd(940)).toBe("$940");
    expect(fmtUsd(153_510)).toBe("$154k");
    expect(fmtUsd(1_144_927)).toBe("$1.1M");
    expect(fmtUsd(2_376_000_000)).toBe("$2.38B");
  });

  it("marks a negative with a real minus sign, not a hyphen", () => {
    expect(fmtUsd(-41_700_000)).toBe("−$41.7M");
  });
});

describe("percentages", () => {
  it("renders a percentage already in percent", () => {
    expect(fmtPct(34.121187)).toBe("34.1%");
    expect(fmtPct(34.121187, 2)).toBe("34.12%");
  });

  it("renders a fraction as a percentage", () => {
    expect(fmtFraction(0.154051)).toBe("15.4%");
    expect(fmtFraction(-7.5951)).toBe("-759.5%");
  });

  it("signs a return so a rise cannot be mistaken for a fall", () => {
    expect(fmtSignedFraction(0.4961)).toBe("+49.6%");
    expect(fmtSignedFraction(-0.1361)).toBe("−13.6%");
  });
});

describe("fmtDay and fmtAgo", () => {
  it("renders a date a person can read", () => {
    expect(fmtDay("2026-08-28")).toBe("28 Aug 2026");
    expect(fmtDay("2026-08-28T05:10:51.948Z")).toBe("28 Aug 2026");
  });

  it("leaves an unparseable date alone rather than inventing one", () => {
    expect(fmtDay("not a date")).toBe("not a date");
  });

  it("says how long ago in the coarsest unit still true", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    expect(fmtAgo("2026-09-01T00:00:00Z", now)).toBe("today");
    expect(fmtAgo("2026-08-31T00:00:00Z", now)).toBe("yesterday");
    expect(fmtAgo("2026-08-20T00:00:00Z", now)).toBe("12 days ago");
    expect(fmtAgo("2026-01-01T00:00:00Z", now)).toBe("8 months ago");
    expect(fmtAgo(null, now)).toBe("never");
  });
});

describe("vocabulary", () => {
  it("has a label for every solvency zone, including the unmeasured one", () => {
    expect(ZONE_STYLE.safe.label).toBe("Safe");
    expect(ZONE_STYLE.distress.label).toBe("Distress");
    // "Not measured" must never read as a verdict.
    expect(ZONE_STYLE.unmeasured.label).toBe("Not measured");
    expect(ZONE_STYLE.unmeasured.chip).toBe("");
  });

  it("has a label and an explanation for every stage a company can stop at", () => {
    for (const key of ["ranked", "price", "strength", "buying", "unworked"] as const) {
      expect(STAGE_META[key].label.length).toBeGreaterThan(0);
      expect(STAGE_META[key].blurb.length).toBeGreaterThan(0);
    }
  });

  it("bands a score coarsely, and gives an unscored one no band", () => {
    expect(scoreBand(80)).toBe("high");
    expect(scoreBand(50)).toBe("mid");
    expect(scoreBand(20)).toBe("low");
    expect(scoreBand(null)).toBe("none");
    for (const b of ["high", "mid", "low", "none"] as const) {
      expect(BAND_ACCENT[b]).toMatch(/^text-/);
    }
  });

  it("never uses the colour reserved for final verdicts", () => {
    // Gold marks a verdict across this platform; nothing the scanner shows is one.
    for (const v of Object.values(ZONE_STYLE)) expect(v.chip).not.toContain("confluence");
    for (const v of Object.values(BAND_ACCENT)) expect(v).not.toContain("confluence");
  });
});
