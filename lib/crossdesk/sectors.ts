/* ============================================================================
 * The sector bridge — pure.
 *
 * The rotation board trades funds, not companies, so it can never say anything
 * about a single name. What it can say is how the company's NEIGHBOURHOOD is
 * being treated, and that needs one deterministic hop: ticker to sector to
 * sector fund.
 *
 * The sector comes from the weekly universe snapshot, which carries the
 * exchange's own classification — thirteen values, stable, machine-written.
 * It deliberately does NOT come from the discovery scout's sector field: that
 * is free text written per candidate, and the stored runs hold eighty-eight
 * distinct values across fifty-five companies ("AI-native creative/software
 * platform", "Physical AI / warehouse automation"). Nothing can be joined on
 * that, and pretending otherwise would put a confident sector reading beside
 * the wrong company.
 *
 * Two honest limits, both published on the page:
 *   - This classification is not the one the sector funds are built from, so a
 *     fund is a neighbourhood and never the company. A drone maker filed under
 *     "Computer Software" is a real example from this snapshot.
 *   - Two of the thirteen values are not sectors at all. They map to nothing,
 *     and nothing is what gets shown.
 * ========================================================================== */

/** Exchange sector → the fund the board measures that neighbourhood with. */
export const SECTOR_ETF: Record<string, string | null> = {
  Technology: "XLK",
  "Health Care": "XLV",
  Finance: "XLF",
  Industrials: "XLI",
  "Consumer Discretionary": "XLY",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  "Basic Materials": "XLB",
  // Approximate, and said so on the page: the communication-services fund is
  // not built from the exchange's telecom bucket. It is the closest fund the
  // board holds, not a translation.
  Telecommunications: "XLC",
  // Not sectors. A residual bucket has no neighbourhood to report.
  Miscellaneous: null,
  Other: null,
};

/** True when the mapping is a near-neighbour rather than a match. */
export const APPROXIMATE_SECTORS = new Set(["Telecommunications"]);

/** Every classification the bridge knows, mapped or deliberately not. */
export const KNOWN_SECTORS: string[] = Object.keys(SECTOR_ETF);

export interface SectorMapping {
  sector: string;
  etf: string | null;
  approximate: boolean;
  /** Set when the sector is known but deliberately maps to nothing. */
  reason: string | null;
}

export function mapSector(sector: string | null | undefined): SectorMapping | null {
  if (!sector) return null;
  if (!(sector in SECTOR_ETF)) {
    return {
      sector,
      etf: null,
      approximate: false,
      reason: "The weekly screen files this company under a classification the board holds no fund for.",
    };
  }
  const etf = SECTOR_ETF[sector];
  return {
    sector,
    etf,
    approximate: APPROXIMATE_SECTORS.has(sector),
    reason: etf
      ? null
      : "This is a residual bucket rather than a sector, so there is no neighbourhood to report.",
  };
}

/** The board indicator that measures a sector fund against the market. */
export function sectorIndicatorId(etf: string): string {
  return `${etf.toLowerCase()}-spy`;
}
