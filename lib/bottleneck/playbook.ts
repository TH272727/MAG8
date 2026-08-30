import { z } from "zod";
import { getAppSettingJson, setAppSettingJson } from "../db";

/* ============================================================================
 * Playbooks — the ONLY sector-specific input to the Bottleneck desk.
 *
 * A playbook answers four questions for one theme:
 *   demand      whose spending do we read, and under which filing tags?
 *   conversions how do those dollars become physical units?
 *   supply      which real-world series say how much can be produced?
 *   owners      who actually controls each constrained input?
 *
 * Everything sector-specific lives here so Modules B and C stay generic: no
 * ticker, tag name, conversion factor, or connector id may be hard-coded
 * outside a playbook definition. Adding a sector is data, not code.
 *
 * Built-ins live in this file (auditable, versioned in git). Owner-defined
 * playbooks live in app_settings and are merged over them by id, so a custom
 * playbook can extend the set or override a built-in without a deploy.
 *
 * CONVERSION FACTORS ARE ESTIMATES, NOT FACTS. Every factor carries its source
 * and an as-of date, the whole table carries a version, and every demand
 * snapshot records which version produced it — so a number computed last month
 * stays auditable after the assumptions change. The framework this desk
 * implements names loose conversion factors as its single biggest weakness;
 * this structure is the response to that, not a decoration.
 * ========================================================================== */

/** One $-to-physical-units assumption. */
export const ConversionFactorSchema = z.object({
  /** Physical unit produced, e.g. "MW of critical IT load". */
  unit: z.string().min(1),
  /** Short key used in tables and scoring, e.g. "mw". */
  key: z.string().min(1),
  /** USD required per one of `unit`. */
  usdPer: z.number().positive(),
  /** Where the figure came from — a named, checkable source, never "industry estimate". */
  source: z.string().min(1),
  /** When that source published it (YYYY-MM or YYYY-MM-DD). */
  asOf: z.string().min(4),
  /** Caveats a reader needs in order to distrust this properly. */
  note: z.string().optional(),
});
export type ConversionFactor = z.infer<typeof ConversionFactorSchema>;

export const ConversionTableSchema = z.object({
  /** Bumped whenever any factor changes; stamped onto every snapshot. */
  version: z.string().min(1),
  asOf: z.string().min(4),
  factors: z.array(ConversionFactorSchema).min(1),
});
export type ConversionTable = z.infer<typeof ConversionTableSchema>;

/** One supply-side series this playbook watches. */
export const SupplySeriesSchema = z.object({
  /** Stable id — the key in bottleneck_supply. */
  seriesId: z.string().min(1),
  label: z.string().min(1),
  /** Physical unit this series measures. */
  unit: z.string().min(1),
  /** Which conversion-factor `key` this series constrains (joins demand to supply). */
  constrains: z.string().min(1),
  /** Connector implementation id (lib/bottleneck/supply.ts). */
  connector: z.string().min(1),
  /** Connector-specific handle: a FRED series id, an FTS query, etc. */
  handle: z.string().optional(),
  /** Where a human can go to check it. */
  sourceUrl: z.string().optional(),
  /** Honest labelling when no automated feed exists yet. */
  stub: z.boolean().optional(),
});
export type SupplySeries = z.infer<typeof SupplySeriesSchema>;

/** Who produces a constrained input. */
export const OwnerGroupSchema = z.object({
  /** Conversion-factor `key` this group supplies. */
  category: z.string().min(1),
  label: z.string().min(1),
  /** US-listed tickers a reader can actually buy. */
  tickers: z.array(z.string()).default([]),
  /**
   * Producers that are NOT plainly US-listed. Named because leaving them out
   * would misrepresent who controls the input — many of the largest suppliers
   * in memory and heavy industrial equipment are Korean, Japanese, or European,
   * reachable as an ADR at best. Free text, never presented as tradable.
   */
  foreign: z.array(z.string()).default([]),
});
export type OwnerGroup = z.infer<typeof OwnerGroupSchema>;

export const PlaybookSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "lowercase, digits and dashes only"),
  label: z.string().min(1),
  blurb: z.string().min(1),
  demand: z.object({
    /** Whose capital spending drives this theme. */
    basket: z.array(z.string().min(1)).min(1),
    /** us-gaap tags tried IN ORDER; filers tag capital spending inconsistently. */
    capexTags: z.array(z.string().min(1)).min(1),
    /** Words that mark the relevant discussion inside a filing's MD&A. */
    narrativeKeywords: z.array(z.string()).default([]),
  }),
  conversions: ConversionTableSchema,
  supply: z.array(SupplySeriesSchema).default([]),
  owners: z.array(OwnerGroupSchema).default([]),
  /** False for owner-defined playbooks loaded from the database. */
  builtIn: z.boolean().default(false),
});
export type Playbook = z.infer<typeof PlaybookSchema>;

/* ----------------------------------------------------------------------------
 * Built-in: AI infrastructure / hyperscale compute
 * -------------------------------------------------------------------------- */

const AI_INFRASTRUCTURE: Playbook = {
  id: "ai-infrastructure",
  label: "AI infrastructure",
  blurb:
    "The largest cloud operators are committing unprecedented capital to build computing capacity. " +
    "That spending is only as real as the electricity, memory, and buildings it has to buy — so this " +
    "playbook converts the disclosed dollars into megawatts, gigabytes, and square feet, then checks " +
    "each against what the world can actually produce.",
  demand: {
    basket: ["MSFT", "AMZN", "GOOGL", "META", "ORCL", "NVDA"],
    capexTags: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsForCapitalImprovements",
      "PaymentsToAcquireProductiveAssets",
      "PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets",
    ],
    narrativeKeywords: ["capital expenditure", "data center", "property and equipment", "capacity", "servers"],
  },
  conversions: {
    version: "2026-08-a",
    asOf: "2026-08",
    factors: [
      {
        key: "mw",
        unit: "MW of critical IT load",
        usdPer: 9_500_000,
        source: "Placeholder seed — replace with a sourced build-cost benchmark before relying on it",
        asOf: "2026-08",
        note:
          "All-in build cost per megawatt of critical IT load varies enormously by region, cooling " +
          "design, and whether land and power are included. Treat as an order-of-magnitude anchor only.",
      },
      {
        key: "memory_gb",
        unit: "GB of memory/storage deployed",
        usdPer: 4.5,
        source: "Placeholder seed — replace with a sourced contract-price benchmark before relying on it",
        asOf: "2026-08",
        note: "Blended DRAM/NAND dollars per gigabyte; contract pricing moves violently through a memory cycle.",
      },
      {
        key: "sqft",
        unit: "sq ft of data-center shell",
        usdPer: 1_100,
        source: "Placeholder seed — replace with a sourced construction-cost benchmark before relying on it",
        asOf: "2026-08",
        note: "Shell and core only; excludes the IT fit-out already counted under critical load.",
      },
      {
        key: "turbine_mw",
        unit: "MW of gas-turbine generating capacity",
        usdPer: 1_300_000,
        source: "Placeholder seed — replace with a sourced overnight-cost benchmark before relying on it",
        asOf: "2026-08",
        note:
          "Overnight cost per megawatt for new combined-cycle capacity. The binding constraint is " +
          "usually the delivery queue rather than the price.",
      },
    ],
  },
  supply: [
    {
      seriesId: "us-semiconductor-capacity",
      label: "US semiconductor & electronic component manufacturing capacity",
      unit: "index (2017=100)",
      constrains: "memory_gb",
      connector: "fred",
      handle: "CAPG3344S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG3344S",
    },
    {
      seriesId: "us-electric-power-capacity",
      label: "US electric power generating capacity",
      unit: "index (2017=100)",
      constrains: "mw",
      connector: "fred",
      handle: "CAPG2211S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG2211S",
    },
    {
      seriesId: "us-electric-power-output",
      label: "US electric power generation, actual output",
      unit: "index (2017=100)",
      constrains: "mw",
      connector: "fred",
      handle: "IPG2211S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG2211S",
    },
    {
      seriesId: "turbine-backlog-disclosed",
      label: "Gas-turbine backlog disclosed in filings",
      unit: "GW",
      constrains: "turbine_mw",
      connector: "filing-search",
      handle: "gas turbine backlog gigawatts",
    },
    {
      seriesId: "kr-semiconductor-exports",
      label: "Korea semiconductor export value, monthly",
      unit: "USD",
      constrains: "memory_gb",
      connector: "stub",
      sourceUrl: "https://www.motie.go.kr/",
      stub: true,
    },
    {
      seriesId: "tw-export-orders-electronics",
      label: "Taiwan export orders, electronics, monthly",
      unit: "USD",
      constrains: "memory_gb",
      connector: "stub",
      sourceUrl: "https://www.moea.gov.tw/",
      stub: true,
    },
    {
      seriesId: "datacenter-shell-construction",
      label: "US data-center construction put in place",
      unit: "USD millions",
      constrains: "sqft",
      connector: "stub",
      sourceUrl: "https://www.census.gov/construction/c30/c30index.html",
      stub: true,
    },
  ],
  owners: [
    {
      category: "memory_gb",
      label: "Memory and leading-edge foundry",
      tickers: ["MU", "SNDK", "WDC", "INTC"],
      foreign: ["Samsung Electronics (KRX)", "SK hynix (KRX)", "TSMC (ADR: TSM)", "Kioxia (TSE)"],
    },
    {
      category: "turbine_mw",
      label: "Turbine and heavy electrical equipment",
      tickers: ["GEV", "ETN", "PWR", "BWXT"],
      foreign: ["Siemens Energy (XETRA)", "Mitsubishi Heavy Industries (TSE)", "Hitachi (TSE)"],
    },
    {
      category: "mw",
      label: "Power generation and grid",
      tickers: ["VST", "CEG", "NRG", "TLN", "PCG"],
      foreign: [],
    },
    {
      category: "sqft",
      label: "Data-center development and REITs",
      tickers: ["DLR", "EQIX", "IRM"],
      foreign: [],
    },
  ],
  builtIn: true,
};

/* ----------------------------------------------------------------------------
 * Built-in: EV battery supply chain
 *
 * The second theme exists to prove the abstraction holds — Modules B and C take
 * a playbook as their only sector-specific input, and adding a sector must be
 * data rather than code. Every tag and series below was checked against live
 * SEC and FRED on 2026-08-30 rather than assumed.
 * -------------------------------------------------------------------------- */

const EV_BATTERY: Playbook = {
  id: "ev-battery-supply-chain",
  label: "EV battery supply chain",
  blurb:
    "Every announced gigafactory is a claim on cell capacity, and every gigawatt-hour of cells is a claim on " +
    "lithium that has to be dug up and refined years earlier. This playbook reads what the carmakers are " +
    "actually spending, converts it into cell capacity and the lithium that capacity consumes, and checks both " +
    "against what the chemical industry can currently produce.",
  demand: {
    // Verified 2026-08-30: all five report capital spending, though Ford tags it
    // as PaymentsToAcquireProductiveAssets AND is invisible through SEC's
    // per-concept endpoint — see conceptFromFacts in xbrl.ts.
    basket: ["TSLA", "GM", "F", "RIVN", "LCID"],
    capexTags: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
      "PaymentsForCapitalImprovements",
      "PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets",
    ],
    narrativeKeywords: ["capital expenditure", "battery", "cell", "gigafactory", "capacity", "lithium"],
  },
  conversions: {
    version: "2026-08-a",
    asOf: "2026-08",
    factors: [
      {
        key: "cell_gwh",
        unit: "GWh of annual cell capacity",
        usdPer: 75_000_000,
        source: "Placeholder seed — replace with a sourced plant-cost benchmark before relying on it",
        asOf: "2026-08",
        note:
          "All-in cost per gigawatt-hour of installed annual cell capacity. Carmaker capital spending also buys " +
          "vehicle assembly, tooling and software, so treating all of it as cell capacity overstates the total: " +
          "the RATE is the readable number here, not the level.",
      },
      {
        key: "lce_tonnes",
        unit: "tonnes of lithium carbonate equivalent",
        usdPer: 107_000,
        source: "Placeholder seed — derived, not sourced; replace both inputs before relying on it",
        asOf: "2026-08",
        note:
          "A derived factor: the cost per GWh above divided by an assumed ~700 tonnes of lithium carbonate " +
          "equivalent per GWh of cells. Two estimates multiplied together, and it should be read as such.",
      },
    ],
  },
  supply: [
    {
      seriesId: "us-chemical-capacity",
      label: "US chemical manufacturing capacity",
      unit: "index (2017=100)",
      constrains: "lce_tonnes",
      connector: "fred",
      handle: "CAPG325S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG325S",
    },
    {
      seriesId: "us-chemical-output",
      label: "US chemical manufacturing, actual output",
      unit: "index (2017=100)",
      constrains: "lce_tonnes",
      connector: "fred",
      handle: "IPG325S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG325S",
    },
    {
      seriesId: "us-motor-vehicle-capacity",
      label: "US motor vehicle and parts manufacturing capacity",
      unit: "index (2017=100)",
      constrains: "cell_gwh",
      connector: "fred",
      handle: "CAPG3361T3S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG3361T3S",
    },
    {
      seriesId: "usgs-lithium-production",
      label: "World lithium mine production (USGS Mineral Commodity Summaries)",
      unit: "tonnes",
      constrains: "lce_tonnes",
      connector: "stub",
      sourceUrl: "https://www.usgs.gov/centers/national-minerals-information-center/lithium-statistics-and-information",
      stub: true,
    },
    {
      seriesId: "chile-lithium-exports",
      label: "Chile lithium carbonate export volume",
      unit: "tonnes",
      constrains: "lce_tonnes",
      connector: "stub",
      sourceUrl: "https://www.aduana.cl/",
      stub: true,
    },
  ],
  owners: [
    {
      category: "lce_tonnes",
      label: "Lithium producers and refiners",
      tickers: ["ALB", "SQM", "LAC", "PLL"],
      foreign: ["Ganfeng Lithium (SZSE/HKEX)", "Tianqi Lithium (SZSE)", "Pilbara Minerals (ASX)", "IGO (ASX)"],
    },
    {
      category: "cell_gwh",
      label: "Cell manufacturing and battery equipment",
      tickers: ["ENVX", "AMPX", "MVST", "SES"],
      foreign: ["CATL (SZSE)", "LG Energy Solution (KRX)", "Samsung SDI (KRX)", "Panasonic (TSE)"],
    },
  ],
  builtIn: true,
};

/* ----------------------------------------------------------------------------
 * Built-in: homebuilding
 *
 * The third theme is here for an awkward reason worth keeping: it does NOT fit
 * the capital-spending shape, and that is the useful thing about it. See the
 * blurb — homebuilders capitalize land and construction into inventory rather
 * than reporting it as capital expenditure, so the demand tag chain reads the
 * inventory build instead, and the desk says so on the page.
 * -------------------------------------------------------------------------- */

const HOMEBUILDING: Playbook = {
  id: "homebuilding",
  label: "Homebuilding",
  blurb:
    "A house is roughly sixteen thousand board-feet of lumber and a thousand hours of skilled labour, and " +
    "neither can be conjured by raising a forecast. This playbook reads what the large builders are putting " +
    "into land and houses under construction and checks it against what the sawmills can cut and the trade " +
    "can staff. Note the measurement difference from the other themes: builders do not report land and " +
    "construction as capital expenditure — it is capitalized into real-estate inventory — so the demand " +
    "figures here are the change in that inventory, which can legitimately be NEGATIVE when builders are " +
    "working stock down.",
  demand: {
    // Verified 2026-08-30: DHI/LEN/PHM/NVR/TOL/KBH report PP&E capex of $10-110M
    // — their office and equipment spend, not their build spend. The real
    // quantity is the inventory build, tagged inconsistently across the six.
    basket: ["DHI", "LEN", "PHM", "NVR", "TOL", "KBH"],
    capexTags: [
      "IncreaseDecreaseInInventories",
      "IncreaseDecreaseInFinishedGoodsAndWorkInProcessInventories",
      "PaymentsToDevelopRealEstateAssets",
      "PaymentsToAcquireRealEstate",
    ],
    narrativeKeywords: ["homes closed", "land", "lots", "inventory", "communities", "backlog"],
  },
  conversions: {
    version: "2026-08-a",
    asOf: "2026-08",
    factors: [
      {
        key: "board_feet",
        unit: "board-feet of framing lumber",
        usdPer: 1.35,
        source: "Placeholder seed — replace with a sourced cost-per-board-foot benchmark before relying on it",
        asOf: "2026-08",
        note:
          "Dollars of build spending per board-foot of framing lumber. Lumber is a single-digit percentage of a " +
          "finished house, so this factor is small and moves violently with the lumber cycle.",
      },
      {
        key: "trade_hours",
        unit: "hours of skilled construction labour",
        usdPer: 42,
        source: "Placeholder seed — replace with a sourced loaded-wage benchmark before relying on it",
        asOf: "2026-08",
        note: "Fully loaded cost per hour of skilled trade labour, blended across trades and regions.",
      },
    ],
  },
  supply: [
    {
      seriesId: "us-wood-product-capacity",
      label: "US wood product manufacturing capacity",
      unit: "index (2017=100)",
      constrains: "board_feet",
      connector: "fred",
      handle: "CAPG321S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG321S",
    },
    {
      seriesId: "us-wood-product-output",
      label: "US wood product manufacturing, actual output",
      unit: "index (2017=100)",
      constrains: "board_feet",
      connector: "fred",
      handle: "IPG321S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG321S",
    },
    {
      seriesId: "us-construction-employment",
      label: "US construction employment, all employees",
      unit: "thousands of persons",
      constrains: "trade_hours",
      connector: "fred",
      handle: "CEU2000000001",
      sourceUrl: "https://fred.stlouisfed.org/series/CEU2000000001",
    },
    {
      seriesId: "us-housing-starts",
      label: "US housing starts, new privately-owned units",
      unit: "thousands of units, annual rate",
      constrains: "board_feet",
      connector: "fred",
      handle: "HOUST",
      sourceUrl: "https://fred.stlouisfed.org/series/HOUST",
    },
  ],
  owners: [
    {
      category: "board_feet",
      label: "Lumber and building products",
      tickers: ["WY", "PCH", "LPX", "BCC", "UFPI", "BLDR"],
      foreign: ["West Fraser Timber (TSX/NYSE: WFG)", "Canfor (TSX)", "Interfor (TSX)"],
    },
    {
      category: "trade_hours",
      label: "Construction labour and specialty trades",
      tickers: ["IBP", "TPC", "PRIM"],
      foreign: [],
    },
  ],
  builtIn: true,
};

export const BUILT_IN_PLAYBOOKS: Playbook[] = [AI_INFRASTRUCTURE, EV_BATTERY, HOMEBUILDING];

/** The playbook used when none is named. */
export const DEFAULT_PLAYBOOK_ID = AI_INFRASTRUCTURE.id;

/* ----------------------------------------------------------------------------
 * Resolution: built-ins, overlaid by owner-defined playbooks from the database
 * -------------------------------------------------------------------------- */

const CUSTOM_KEY = "bottleneck_playbooks";

/** Owner-defined playbooks; malformed entries are dropped, never thrown. */
export function customPlaybooks(): Playbook[] {
  const parsed = z.array(PlaybookSchema).safeParse(getAppSettingJson(CUSTOM_KEY));
  if (!parsed.success) return [];
  return parsed.data.map((p) => ({ ...p, builtIn: false }));
}

/** Every available playbook: built-ins first, then custom, with custom winning on id. */
export function allPlaybooks(): Playbook[] {
  const byId = new Map(BUILT_IN_PLAYBOOKS.map((p) => [p.id, p]));
  for (const p of customPlaybooks()) byId.set(p.id, p);
  return [...byId.values()];
}

export function getPlaybook(id: string = DEFAULT_PLAYBOOK_ID): Playbook | null {
  return allPlaybooks().find((p) => p.id === id) ?? null;
}

/** Persist the owner-defined set (replaces it; pass [] to drop every custom playbook). */
export function saveCustomPlaybooks(input: unknown): { saved: number; errors: string[] } {
  const parsed = z.array(PlaybookSchema).safeParse(input);
  if (!parsed.success) {
    return { saved: 0, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).slice(0, 10) };
  }
  const cleaned = parsed.data.map((p) => ({ ...p, builtIn: false }));
  setAppSettingJson(CUSTOM_KEY, cleaned);
  return { saved: cleaned.length, errors: [] };
}

/* ----------------------------------------------------------------------------
 * Helpers shared by Modules B, C and the desk UI
 * -------------------------------------------------------------------------- */

export function conversionFactor(pb: Playbook, key: string): ConversionFactor | null {
  return pb.conversions.factors.find((f) => f.key === key) ?? null;
}

/** Supply series constraining one physical unit. */
export function seriesFor(pb: Playbook, categoryKey: string): SupplySeries[] {
  return pb.supply.filter((s) => s.constrains === categoryKey);
}

export function ownersFor(pb: Playbook, categoryKey: string): OwnerGroup | null {
  return pb.owners.find((o) => o.category === categoryKey) ?? null;
}

/**
 * True when every conversion factor still carries its seeded placeholder source.
 * The desk uses this to say so plainly rather than presenting seeded
 * order-of-magnitude anchors as researched benchmarks.
 */
export function usesPlaceholderFactors(pb: Playbook): boolean {
  return pb.conversions.factors.every((f) => /placeholder/i.test(f.source));
}
