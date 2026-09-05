import { describe, expect, it } from "vitest";
import {
  BUILT_IN_GAUGES,
  FAMILY_META,
  GaugeSchema,
  HORIZON_META,
  PER_YEAR,
  SeriesSchema,
  TIDE_FAMILIES,
  requiredSeries,
  allSeries,
} from "../../lib/tide/catalog";

/* ============================================================================
 * The catalogue is the only place a human writes anything down, so it is the
 * only place a typo becomes a confident wrong statement rather than a crash: a
 * swapped polarity turns a warning into reassurance, and a mistyped series
 * identifier turns a reading into permanent silence.
 *
 * This file reads the shipped constants only. Nothing here touches the network
 * or the database.
 * ========================================================================== */

const SERIES = allSeries();

describe("series", () => {
  it("every entry validates against its own schema", () => {
    for (const s of SERIES) expect(() => SeriesSchema.parse(s), s.id).not.toThrow();
  });

  it("has unique identifiers", () => {
    const ids = SERIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every series a staleness budget of at least one publication cycle", () => {
    // A series that is merely reachable is not a series that is alive, and a
    // budget shorter than the publisher's own cadence would call a healthy
    // source dead on the day after it published.
    for (const s of SERIES) {
      const cycleDays = 365 / PER_YEAR[s.frequency];
      expect(s.staleAfterDays, `${s.id} would go stale inside one cycle`).toBeGreaterThan(cycleDays);
    }
  });

  it("survives one missed release on any quarterly series", () => {
    for (const s of SERIES.filter((x) => x.frequency === "quarterly")) {
      expect(s.staleAfterDays, `${s.id}`).toBeGreaterThanOrEqual(182);
    }
  });

  it("allows for a publication lag longer than the interval on the national accounts", () => {
    // These date an observation at the START of a quarter and publish it about
    // ten weeks after that quarter ENDS, so the newest available figure is
    // routinely past two hundred days old and entirely current. Live data
    // caught the corporate-equities series three days from being declared dead.
    for (const id of ["gdp", "cp", "equities", "networth", "hheq", "mmf"]) {
      const s = SERIES.find((x) => x.id === id)!;
      expect(s.staleAfterDays, id).toBeGreaterThanOrEqual(280);
    }
  });

  it("names a publisher and a link for everything it fetches", () => {
    for (const s of SERIES.filter((x) => x.connector !== "manual")) {
      expect(s.publisher.length, s.id).toBeGreaterThan(2);
      expect(s.sourceUrl, s.id).toBeTruthy();
    }
  });
});

describe("gauges", () => {
  it("every entry validates against its own schema", () => {
    for (const g of BUILT_IN_GAUGES) expect(() => GaugeSchema.parse(g), g.id).not.toThrow();
  });

  it("has unique identifiers", () => {
    const ids = BUILT_IN_GAUGES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("names only series that exist", () => {
    // A mistyped identifier is not an error at any point in the pipeline — the
    // reading simply never appears, for ever.
    const known = new Set(SERIES.map((s) => s.id));
    for (const g of BUILT_IN_GAUGES) {
      for (const input of g.inputs) expect(known, `${g.id} names "${input}"`).toContain(input);
    }
  });

  it("gives a single-input gauge exactly one series and a combined gauge exactly two", () => {
    for (const g of BUILT_IN_GAUGES) {
      expect(g.inputs.length, g.id).toBe(g.combine === "single" ? 1 : 2);
    }
  });

  it("states what a high and a low reading each mean, in full sentences", () => {
    for (const g of BUILT_IN_GAUGES) {
      expect(g.highMeans.length, g.id).toBeGreaterThan(20);
      expect(g.lowMeans.length, g.id).toBeGreaterThan(20);
      expect(g.highMeans, g.id).not.toBe(g.lowMeans);
    }
  });

  it("states how every reading could be misleading", () => {
    // A gauge with no stated weakness is a gauge nobody has thought about.
    for (const g of BUILT_IN_GAUGES) expect(g.falsification.length, g.id).toBeGreaterThan(30);
  });

  it("never uses a percent change on a series that can cross zero", () => {
    // A percent change off a negative or zero base is meaningless, and the
    // number it produces looks perfectly ordinary.
    const crossesZero = new Set(["t10y3m", "t10y2y", "cfnaima3", "cfnaidiff", "nfci", "anfci", "stlfsi4", "sahm", "drtscilm"]);
    for (const g of BUILT_IN_GAUGES) {
      if (g.transform.mode !== "changePct") continue;
      for (const input of g.inputs) {
        expect(crossesZero, `${g.id} takes a percent change of "${input}"`).not.toContain(input);
      }
    }
  });

  it("fills every declared family with at least one gauge", () => {
    const used = new Set(BUILT_IN_GAUGES.map((g) => g.family));
    for (const f of TIDE_FAMILIES) expect(used, `family "${f}" has no gauges`).toContain(f);
  });

  it("gives every family and horizon a description", () => {
    for (const f of TIDE_FAMILIES) expect(FAMILY_META[f].note.length).toBeGreaterThan(30);
    for (const h of ["slow", "fast"] as const) {
      expect(HORIZON_META[h].question).toContain("?");
    }
  });

  it("scores recession dating as context and never as a reading", () => {
    // Recessions are dated long after they begin. Scoring the dating would be
    // reading the answer off the back of the paper.
    const nber = BUILT_IN_GAUGES.find((g) => g.id === "nber-recession");
    expect(nber).toBeDefined();
    expect(nber!.kind).toBe("context");
  });

  it("carries both horizons, with the long one smaller than the near one", () => {
    const slow = BUILT_IN_GAUGES.filter((g) => g.horizon === "slow" && g.kind === "scored");
    const fast = BUILT_IN_GAUGES.filter((g) => g.horizon === "fast" && g.kind === "scored");
    expect(slow.length).toBeGreaterThan(5);
    expect(fast.length).toBeGreaterThan(slow.length);
  });

  it("reads the credit spread twice, with opposite polarities, on the two horizons", () => {
    // The one-polarity rule made concrete: a variable that matters both ways
    // becomes two gauges rather than one gauge with an argument attached.
    const level = BUILT_IN_GAUGES.find((g) => g.id === "credit-spread-level")!;
    const change = BUILT_IN_GAUGES.find((g) => g.id === "credit-spread-change")!;
    expect(level.inputs).toEqual(change.inputs);
    expect(level.horizon).toBe("slow");
    expect(change.horizon).toBe("fast");
    expect(level.polarity).not.toBe(change.polarity);
  });

  it("keeps a named originator on the readings that have one", () => {
    const attributed = BUILT_IN_GAUGES.filter((g) => g.attribution);
    expect(attributed.length).toBeGreaterThanOrEqual(5);
    for (const g of attributed) expect(g.attribution!.length).toBeGreaterThan(3);
  });
});

describe("what a refresh will actually fetch", () => {
  it("leaves no catalogued series unread by every gauge", () => {
    // A series nothing reads is never fetched, so it looks catalogued and is
    // in fact invisible. Two entries sat like that until live output showed it.
    const needed = new Set(requiredSeries(BUILT_IN_GAUGES, SERIES).map((s) => s.id));
    for (const s of SERIES) expect(needed, `"${s.id}" is catalogued but no gauge reads it`).toContain(s.id);
  });
});
