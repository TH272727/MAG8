import { describe, expect, it } from "vitest";

import {
  APPROXIMATE_SECTORS,
  KNOWN_SECTORS,
  mapSector,
  SECTOR_ETF,
  sectorIndicatorId,
} from "../../lib/crossdesk/sectors";
import { BUILT_IN_INDICATORS } from "../../lib/rotation/catalog";

/* ============================================================================
 * The sector bridge. Pinned exactly, because it is the single hop between a
 * company and a fund reading — and a wrong hop puts a confident neighbourhood
 * verdict beside the wrong company with nothing to reveal the error.
 * ========================================================================== */

/** Every classification the weekly screen actually emits, verified against a stored snapshot. */
const SCREEN_SECTORS = [
  "Consumer Discretionary",
  "Health Care",
  "Finance",
  "Technology",
  "Industrials",
  "Real Estate",
  "Energy",
  "Utilities",
  "Basic Materials",
  "Consumer Staples",
  "Telecommunications",
  "Miscellaneous",
  "Other",
];

describe("the sector bridge", () => {
  it("covers every classification the weekly screen emits", () => {
    for (const s of SCREEN_SECTORS) {
      expect(KNOWN_SECTORS, `${s} is unmapped`).toContain(s);
    }
    expect(KNOWN_SECTORS).toHaveLength(SCREEN_SECTORS.length);
  });

  it("maps the ten sectors that have a fund", () => {
    expect(mapSector("Technology")).toEqual({
      sector: "Technology",
      etf: "XLK",
      approximate: false,
      reason: null,
    });
    expect(mapSector("Utilities")?.etf).toBe("XLU");
    expect(mapSector("Real Estate")?.etf).toBe("XLRE");
    expect(mapSector("Basic Materials")?.etf).toBe("XLB");
  });

  it("marks the one approximate mapping as approximate", () => {
    const m = mapSector("Telecommunications");
    expect(m?.etf).toBe("XLC");
    expect(m?.approximate).toBe(true);
    expect(APPROXIMATE_SECTORS.has("Telecommunications")).toBe(true);
  });

  it("maps the two residual buckets to nothing, with a stated reason", () => {
    for (const s of ["Miscellaneous", "Other"]) {
      const m = mapSector(s);
      expect(m?.etf).toBeNull();
      expect(m?.reason).toBeTruthy();
    }
  });

  it("reports an unrecognised classification rather than guessing at one", () => {
    const m = mapSector("Bananas");
    expect(m?.etf).toBeNull();
    expect(m?.reason).toContain("no fund");
  });

  it("returns nothing for a company with no sector on file", () => {
    expect(mapSector(null)).toBeNull();
    expect(mapSector("")).toBeNull();
  });

  it("every fund it maps to is one the board actually measures against the market", () => {
    // The bridge must never point at an indicator that does not exist: the
    // page would show a sector with a permanently blank reading and no reason.
    const ids = new Set(BUILT_IN_INDICATORS.map((i) => i.id));
    for (const etf of Object.values(SECTOR_ETF)) {
      if (!etf) continue;
      expect(ids, `${etf} has no board indicator`).toContain(sectorIndicatorId(etf));
    }
  });
});
