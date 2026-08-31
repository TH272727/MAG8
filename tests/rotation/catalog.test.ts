import { describe, expect, it } from "vitest";
import {
  BUILT_IN_INDICATORS,
  CATEGORY_META,
  CYCLE_PHASES,
  IndicatorSchema,
  ROTATION_CATEGORIES,
  catalogTickers,
  indicatorsByCategory,
  sectorBoardIndicators,
} from "../../lib/rotation/catalog";

/* ============================================================================
 * The catalog is the board's only market-specific input, and everything
 * downstream trusts it completely: a mistyped ticker becomes a missing chart, a
 * swapped rising/falling meaning becomes a written note that says the opposite
 * of what the arithmetic found. Nothing here touches the network or the
 * database — it reads the shipped constants only.
 * ========================================================================== */

describe("built-in catalog", () => {
  it("validates every built-in against the schema", () => {
    for (const ind of BUILT_IN_INDICATORS) {
      const res = IndicatorSchema.safeParse(ind);
      expect(res.success, `${ind.id}: ${res.success ? "" : JSON.stringify(res.error.issues)}`).toBe(true);
    }
  });

  it("has unique ids", () => {
    const ids = BUILT_IN_INDICATORS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every ratio a denominator and every context gauge none", () => {
    for (const i of BUILT_IN_INDICATORS) {
      if (i.kind === "ratio") expect(i.quote, `${i.id} is a ratio with no denominator`).toBeTruthy();
      else expect(i.quote, `${i.id} is a context gauge with a denominator`).toBeNull();
    }
  });

  it("never divides a ticker by itself", () => {
    for (const i of BUILT_IN_INDICATORS) expect(i.base).not.toBe(i.quote);
  });

  it("describes both directions by naming the assets, never up or down", () => {
    // The published method is explicit that direction is plain language naming
    // the actual tickers — "Favors: SPY / mega-cap", never "up".
    for (const i of BUILT_IN_INDICATORS) {
      expect(i.favorsBase.length, `${i.id}`).toBeGreaterThan(3);
      expect(i.favorsQuote.length, `${i.id}`).toBeGreaterThan(3);
      expect(i.favorsBase.toLowerCase(), `${i.id}`).not.toMatch(/^(up|down|rising|falling)$/);
      expect(i.favorsQuote.toLowerCase(), `${i.id}`).not.toMatch(/^(up|down|rising|falling)$/);
    }
  });

  it("carries a falsification note on every entry", () => {
    // A stated way to be wrong is required of every reading this project ships.
    for (const i of BUILT_IN_INDICATORS) {
      expect(i.falsification.length, `${i.id} has a thin falsification note`).toBeGreaterThan(20);
    }
  });

  it("assigns every indicator to a category that has metadata", () => {
    for (const i of BUILT_IN_INDICATORS) {
      expect(ROTATION_CATEGORIES).toContain(i.category);
      expect(CATEGORY_META[i.category]).toBeTruthy();
    }
  });

  it("leaves no category empty", () => {
    const used = new Set(BUILT_IN_INDICATORS.map((i) => i.category));
    for (const c of ROTATION_CATEGORIES) expect(used, `category "${c}" has no indicators`).toContain(c);
  });
});

describe("ticker resolution", () => {
  it("collects every distinct ticker exactly once", () => {
    const tickers = catalogTickers(BUILT_IN_INDICATORS);
    expect(new Set(tickers).size).toBe(tickers.length);
    // Both legs of the flagship, and the index that has no fallback source.
    expect(tickers).toContain("RSP");
    expect(tickers).toContain("SPY");
    expect(tickers).toContain("^VIX");
  });

  it("counts fewer tickers than indicator legs, because legs are shared", () => {
    const legs = BUILT_IN_INDICATORS.reduce((n, i) => n + (i.quote ? 2 : 1), 0);
    expect(catalogTickers(BUILT_IN_INDICATORS).length).toBeLessThan(legs);
  });
});

describe("the sector board", () => {
  it("holds exactly the eleven sector funds", () => {
    const board = sectorBoardIndicators(BUILT_IN_INDICATORS);
    expect(board).toHaveLength(11);
    expect(new Set(board.map((i) => i.sectorTicker)).size).toBe(11);
  });

  it("measures every sector against the same benchmark", () => {
    // Ranking eleven ratios only means something if the denominator is shared.
    for (const i of sectorBoardIndicators(BUILT_IN_INDICATORS)) expect(i.quote).toBe("SPY");
  });

  it("names only sector funds the catalog actually carries in its cycle map", () => {
    const known = new Set(sectorBoardIndicators(BUILT_IN_INDICATORS).map((i) => i.sectorTicker));
    for (const phase of CYCLE_PHASES) {
      for (const leader of phase.leaders) {
        expect(known, `cycle phase "${phase.key}" names ${leader}, which the board does not track`).toContain(leader);
      }
    }
  });

  it("gives every cycle phase leaders and a stated caveat", () => {
    for (const p of CYCLE_PHASES) {
      expect(p.leaders.length).toBeGreaterThan(0);
      expect(p.note.length).toBeGreaterThan(20);
    }
  });
});

describe("grouping", () => {
  it("returns categories in declared order and drops empty ones", () => {
    const groups = indicatorsByCategory(BUILT_IN_INDICATORS);
    const order = groups.map((g) => g.category);
    expect(order).toEqual(ROTATION_CATEGORIES.filter((c) => order.includes(c)));
    for (const g of groups) expect(g.indicators.length).toBeGreaterThan(0);
  });

  it("places every indicator in exactly one group", () => {
    const total = indicatorsByCategory(BUILT_IN_INDICATORS).reduce((n, g) => n + g.indicators.length, 0);
    expect(total).toBe(BUILT_IN_INDICATORS.length);
  });
});
