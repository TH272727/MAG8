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
    /**
     * What the tag chain above actually measures, as a sentence-opening noun
     * phrase. Not every theme's demand IS capital spending: homebuilders
     * capitalize their build into inventory, and a research-stage industry
     * spends through the income statement. The desk names the measure it used
     * rather than calling every reading "capital spending".
     */
    measure: z.string().min(1).default("Capital spending"),
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
    measure: "Capital spending",
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
    measure: "Capital spending",
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
    // Not capital spending, and the desk says so wherever it names the figure.
    measure: "The build in land and homes under construction",
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

/* ----------------------------------------------------------------------------
 * Built-in: the drone industrial base
 *
 * The first of four themes whose conversion factors are RESEARCHED rather than
 * seeded. Every figure below was read out of the primary document this session
 * (2026-09-01) — a budget justification book, a USGS commodity summary, a BLS
 * wage file — not out of a secondary summary of one. Where the arithmetic is
 * mine, the inputs and the division are both stated so a reader can redo it.
 *
 * A caution this theme earned: a web summary of the same Army budget page
 * reported $34.368M ÷ 265 = $129,681 per system. The page actually says that
 * line buys 265 SRR systems AND 500 PBAS systems, so the division is wrong by
 * roughly 3x. The figure used here is the whole line item over the whole
 * quantity, and the three quoted sub-lines sum to the stated total, which is
 * the check that the reading is complete.
 * -------------------------------------------------------------------------- */

const DRONES: Playbook = {
  id: "drone-industrial-base",
  label: "Drones",
  blurb:
    "A drone is a motor, a magnet, a battery and a radio wrapped in an airframe, and the West buys most of " +
    "those parts from the country it is arming against. This playbook reads what the US-listed uncrewed-systems " +
    "makers are spending to build capacity, converts it into the systems the Army actually buys at the Army's " +
    "own budgeted price, into the rare-earth oxide that every motor magnet starts as, and into the assembly " +
    "hours that no purchase order can conjure. The prime contractors are deliberately absent: their uncrewed " +
    "programs are real but not separable from the rest of their capital spending, and adding them would swamp " +
    "the specialists this theme is about.",
  demand: {
    // Verified against live SEC 2026-09-01. Red Cat is the tag-migration case
    // in this basket: PaymentsToAcquirePropertyPlantAndEquipment holds 14
    // quarters that stop at 2019-07-31 (the predecessor shell), while
    // PaymentsToAcquireProductiveAssets carries 27 quarters through
    // 2026-06-30. Freshest-tag-wins picks the live one and the desk reports
    // the migration; first-populated-wins would have published $3,000.
    // Draganfly (DPRO) files but tags no capital spending at all, so it is out.
    basket: ["AVAV", "KTOS", "RCAT", "ONDS", "UMAC", "AIRO"],
    capexTags: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
      "PaymentsForCapitalImprovements",
      "PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets",
    ],
    measure: "Capital spending",
    narrativeKeywords: ["capital expenditure", "unmanned", "uncrewed", "production capacity", "facility", "backlog"],
  },
  conversions: {
    version: "2026-09-a",
    asOf: "2026-09",
    factors: [
      {
        key: "uas_system",
        unit: "small uncrewed aircraft systems",
        usdPer: 263_029,
        source:
          "US Army FY2026 President's Budget, Aircraft Procurement Army justification book (June 2025), " +
          "P-1 Line 5 Small Unmanned Aircraft Systems: $250.141M of FY2026 base procurement for 951 systems " +
          "(265 SRR Tranche 2, 500 PBAS, 85 Company-Level SUAS DR, 101 LRR)",
        asOf: "2025-06",
        note:
          "The Army's own procurement dollars per system, not a list price: the three sub-lines it quotes " +
          "($34.368M, $90.582M, $125.192M) sum to the stated $250.141M, and they include flyaway costs, " +
          "initial spares, training, program management and software maintenance alongside the hardware. A " +
          "system is typically two air vehicles plus a ground station and payload, so per airframe this is " +
          "roughly half. It also blends a $1.2M-class battalion aircraft with a first-person-view drone.",
      },
      {
        key: "ndpr_kg",
        unit: "kg of neodymium-praseodymium oxide",
        usdPer: 69,
        source:
          "USGS Mineral Commodity Summaries 2026, Rare Earths: average price, neodymium-praseodymium (NdPr) " +
          "oxide, 99% minimum, 2025 estimate",
        asOf: "2026-01",
        note:
          "This prices the OXIDE FEEDSTOCK, not a finished magnet: reduction to metal, alloying and sintering " +
          "add most of the delivered cost of a motor magnet. The same USGS chapter puts China at 71% of US " +
          "rare-earth compound and metal imports over 2021-24, which is the reason the input is on this list.",
      },
      {
        key: "assembler_year",
        unit: "worker-years of aircraft assembly labour",
        usdPer: 71_420,
        source:
          "US Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2025: Aircraft " +
          "Structure, Surfaces, Rigging, and Systems Assemblers (SOC 51-2011), mean annual wage; 34,020 " +
          "employed nationally",
        asOf: "2025-05",
        note:
          "Wages only — benefits, overhead and facilities are excluded, so dollars divided by this figure " +
          "OVERSTATES how many people the money could actually hire. The scarcity is the point: 34,020 people " +
          "in this occupation exist in the whole United States.",
      },
    ],
  },
  supply: [
    {
      // Verified 2026-09-01: FRED publishes an aerospace OUTPUT index but no
      // aerospace CAPACITY index — CAPG3364S does not exist. This constraint is
      // therefore read from production alone, which is a weaker measure and is
      // labelled as such rather than substituted for with something adjacent.
      seriesId: "us-aerospace-output",
      label: "US aerospace product and parts manufacturing, actual output",
      unit: "index (2017=100)",
      constrains: "uas_system",
      connector: "fred",
      handle: "IPG3364S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG3364S",
    },
    {
      seriesId: "us-transportation-equipment-employment",
      label: "US transportation equipment manufacturing employment",
      unit: "thousands of persons",
      constrains: "assembler_year",
      connector: "fred",
      handle: "CES3133600001",
      sourceUrl: "https://fred.stlouisfed.org/series/CES3133600001",
    },
    {
      seriesId: "us-electrical-equipment-capacity",
      label: "US electrical equipment, appliance and component manufacturing capacity",
      unit: "index (2017=100)",
      constrains: "ndpr_kg",
      connector: "fred",
      handle: "CAPG335S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG335S",
    },
    {
      seriesId: "us-electrical-equipment-output",
      label: "US electrical equipment manufacturing, actual output",
      unit: "index (2017=100)",
      constrains: "ndpr_kg",
      connector: "fred",
      handle: "IPG335S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG335S",
    },
    {
      seriesId: "usgs-rare-earth-production",
      label: "US rare-earth mine production (USGS Mineral Commodity Summaries)",
      unit: "tonnes of rare-earth oxide equivalent",
      constrains: "ndpr_kg",
      connector: "stub",
      sourceUrl: "https://www.usgs.gov/centers/national-minerals-information-center/rare-earths-statistics-and-information",
      stub: true,
    },
    {
      // The natural automated feed here is the Census HS 8806 import series,
      // which carries both value and unit count. Checked 2026-09-01: the Census
      // international-trade API now answers "Missing Key", so it is named
      // rather than wired, and points can be entered by hand.
      seriesId: "us-uav-imports",
      label: "US imports of unmanned aircraft, HS 8806 (Census)",
      unit: "units",
      constrains: "uas_system",
      connector: "stub",
      sourceUrl: "https://usatrade.census.gov/",
      stub: true,
    },
  ],
  owners: [
    {
      category: "uas_system",
      label: "US-listed uncrewed aircraft makers",
      tickers: ["AVAV", "KTOS", "RCAT", "ONDS", "UMAC", "AIRO"],
      foreign: ["DJI (China, unlisted)", "Autel Robotics (SZSE)", "Quantum Systems (Germany, unlisted)", "Parrot (Euronext)"],
    },
    {
      category: "ndpr_kg",
      label: "Rare-earth oxide and permanent magnets",
      tickers: ["MP", "USAR"],
      foreign: [
        "China Northern Rare Earth (SSE)",
        "Lynas Rare Earths (ASX)",
        "Shin-Etsu Chemical (TSE)",
        "Proterial (Japan, unlisted)",
      ],
    },
    {
      category: "assembler_year",
      label: "Aerostructures and contract manufacturing",
      tickers: ["DCO", "HWM"],
      foreign: [],
    },
  ],
  builtIn: true,
};

/* ----------------------------------------------------------------------------
 * Built-in: robotics and industrial automation
 * -------------------------------------------------------------------------- */

const ROBOTICS: Playbook = {
  id: "robotics-automation",
  label: "Robotics",
  blurb:
    "North America ordered 36,766 robots last year and has 15,520 mechatronics technicians in the entire " +
    "country to install and keep them running. This playbook reads what the US-listed automation suppliers are " +
    "spending to expand, converts it into robots at the price the market actually paid for them, into the " +
    "rare-earth oxide inside every servo motor, and into the technician-years that are the least elastic input " +
    "of the three. Note whose spending this is: the equipment makers', not the factories' — the makers' capital " +
    "spending is a claim on the same magnets, machine tools and people, and it is not dominated by one buyer.",
  demand: {
    // Verified against live SEC 2026-09-01, all six current through mid-2026.
    // Symbotic is the most robotics-pure US company and is deliberately NOT
    // here: its last tagged capital-spending quarter ends 2024-12-28, which is
    // beyond the staleness window, so it would contribute a flag and nothing
    // else. It appears in the owner map instead.
    basket: ["ROK", "EMR", "TER", "ZBRA", "CGNX", "NDSN"],
    capexTags: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
      "PaymentsForCapitalImprovements",
      "PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets",
    ],
    measure: "Capital spending",
    narrativeKeywords: ["capital expenditure", "automation", "robot", "capacity", "orders", "backlog"],
  },
  conversions: {
    version: "2026-09-a",
    asOf: "2026-09",
    factors: [
      {
        key: "robot_unit",
        unit: "industrial robots",
        usdPer: 61_198,
        source:
          "A3 (Association for Advancing Automation) Robotics Industry Statistics, full-year 2025 release " +
          "(February 2026): 36,766 robots ordered in North America in 2025, valued at $2.25 billion",
        asOf: "2026-02",
        note:
          "Order value at the supplier — integration, tooling, end-of-arm hardware and safety guarding are " +
          "excluded and routinely multiply the installed cost. The mix moves this number hard: the same " +
          "release puts collaborative robots at 7,212 units and $241M, which is about $33,400 each.",
      },
      {
        key: "ndpr_kg",
        unit: "kg of neodymium-praseodymium oxide",
        usdPer: 69,
        source:
          "USGS Mineral Commodity Summaries 2026, Rare Earths: average price, neodymium-praseodymium (NdPr) " +
          "oxide, 99% minimum, 2025 estimate",
        asOf: "2026-01",
        note:
          "Oxide feedstock rather than a finished magnet; the reduction, alloying and sintering steps that " +
          "turn it into a servo motor's rotor add most of the delivered cost. Every axis of every robot " +
          "contains one.",
      },
      {
        key: "mechatronics_year",
        unit: "technician-years of mechatronics labour",
        usdPer: 76_420,
        source:
          "US Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2025: " +
          "Electro-Mechanical and Mechatronics Technologists and Technicians (SOC 17-3024), mean annual wage; " +
          "15,520 employed nationally",
        asOf: "2025-05",
        note:
          "Wages only, so dollars divided by this OVERSTATES the hiring it could fund. The national headcount " +
          "is the striking figure: 15,520 people, against 36,766 robots ordered in a single year.",
      },
    ],
  },
  supply: [
    {
      seriesId: "us-machinery-capacity",
      label: "US machinery manufacturing capacity",
      unit: "index (2017=100)",
      constrains: "robot_unit",
      connector: "fred",
      handle: "CAPG333S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG333S",
    },
    {
      seriesId: "us-machinery-output",
      label: "US machinery manufacturing, actual output",
      unit: "index (2017=100)",
      constrains: "robot_unit",
      connector: "fred",
      handle: "IPG333S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG333S",
    },
    {
      seriesId: "us-machinery-employment",
      label: "US machinery manufacturing employment",
      unit: "thousands of persons",
      constrains: "mechatronics_year",
      connector: "fred",
      handle: "CES3133300001",
      sourceUrl: "https://fred.stlouisfed.org/series/CES3133300001",
    },
    {
      seriesId: "us-electrical-equipment-capacity",
      label: "US electrical equipment, appliance and component manufacturing capacity",
      unit: "index (2017=100)",
      constrains: "ndpr_kg",
      connector: "fred",
      handle: "CAPG335S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG335S",
    },
    {
      seriesId: "us-electrical-equipment-output",
      label: "US electrical equipment manufacturing, actual output",
      unit: "index (2017=100)",
      constrains: "ndpr_kg",
      connector: "fred",
      handle: "IPG335S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG335S",
    },
    {
      seriesId: "usgs-rare-earth-production",
      label: "US rare-earth mine production (USGS Mineral Commodity Summaries)",
      unit: "tonnes of rare-earth oxide equivalent",
      constrains: "ndpr_kg",
      connector: "stub",
      sourceUrl: "https://www.usgs.gov/centers/national-minerals-information-center/rare-earths-statistics-and-information",
      stub: true,
    },
  ],
  owners: [
    {
      category: "robot_unit",
      label: "Robot and automation equipment makers",
      tickers: ["ROK", "EMR", "TER", "ZBRA", "CGNX", "NDSN", "SYM"],
      foreign: [
        "FANUC (TSE)",
        "Yaskawa Electric (TSE)",
        "ABB (SIX)",
        "KUKA (owned by Midea, SZSE)",
        "Kawasaki Heavy Industries (TSE)",
      ],
    },
    {
      category: "ndpr_kg",
      label: "Rare-earth oxide and permanent magnets",
      tickers: ["MP", "USAR"],
      foreign: [
        "China Northern Rare Earth (SSE)",
        "Lynas Rare Earths (ASX)",
        "Shin-Etsu Chemical (TSE)",
        "Nidec (TSE)",
      ],
    },
    {
      category: "mechatronics_year",
      label: "System integrators and industrial services",
      tickers: ["ATS", "AIT"],
      foreign: ["Comau (owned by Stellantis)", "Dürr (XETRA)"],
    },
  ],
  builtIn: true,
};

/* ----------------------------------------------------------------------------
 * Built-in: quantum computing
 *
 * The measurement difference to notice here is the demand read itself. These
 * companies are pre-revenue research businesses whose capital spending is a
 * small fraction of what they actually spend; the money goes out through the
 * income statement as research and development. So the tag chain leads with
 * R&D expense and the desk labels the figure as what it is, rather than calling
 * a $630M research programme "capital spending" because that is the word the
 * other themes use.
 * -------------------------------------------------------------------------- */

const QUANTUM: Playbook = {
  id: "quantum-computing",
  label: "Quantum computing",
  blurb:
    "A superconducting quantum computer is a physics experiment that has to be kept a hundredth of a degree " +
    "above absolute zero, and the two things that buys are cryogens and physicists. This playbook reads what " +
    "the US-listed quantum developers are spending on research, converts it into Grade-A helium at the price " +
    "USGS publishes and into physicist-years at the wage the Bureau of Labor Statistics publishes, and checks " +
    "both against what the country can supply. The tightest input has no price at all: helium-3, the " +
    "millikelvin-stage refrigerant, is a byproduct of tritium decay produced at one site in South Carolina and " +
    "allocated by an inter-agency committee, and the dilution refrigerators themselves come from two firms, " +
    "in Finland and the United Kingdom. Both are named below and neither has an automated feed.",
  demand: {
    // Verified against live SEC 2026-09-01: all four tag
    // ResearchAndDevelopmentExpense through 2026-06-30 (IONQ $448.8M TTM,
    // QBTS $81.8M, RGTI $73.1M, QUBT $26.9M) and all four also report capital
    // spending, an order of magnitude smaller. Arqit files as a foreign private
    // issuer and carries none of these tags, so it is out.
    basket: ["IONQ", "RGTI", "QBTS", "QUBT"],
    capexTags: [
      "ResearchAndDevelopmentExpense",
      "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost",
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
    ],
    measure: "Research and development spending",
    narrativeKeywords: ["research and development", "qubit", "cryogenic", "dilution", "fidelity", "capacity"],
  },
  conversions: {
    version: "2026-09-a",
    asOf: "2026-09",
    factors: [
      {
        key: "helium_mcf",
        unit: "thousand cubic feet of Grade-A helium",
        usdPer: 330,
        source:
          "USGS Mineral Commodity Summaries 2026, Helium and Rare Gases: estimated base price for Grade-A " +
          "helium in 2025, about $12 per cubic meter ($330 per thousand cubic feet)",
        asOf: "2026-01",
        note:
          "A base price before the surcharges USGS notes producers post on top of it, so the delivered cost " +
          "is higher. For scale, the same chapter records US Grade-A and gaseous helium sales of 81 million " +
          "cubic meters valued at about $970 million in 2025, which divides out to $334 per thousand cubic " +
          "feet and is consistent with a $330 base plus surcharges. The whole national market is smaller " +
          "than a single large data-center campus.",
      },
      {
        key: "physicist_year",
        unit: "physicist-years of wages",
        usdPer: 171_180,
        source:
          "US Bureau of Labor Statistics, Occupational Employment and Wage Statistics, May 2025: Physicists " +
          "(SOC 19-2012), mean annual wage; 20,430 employed nationally",
        asOf: "2025-05",
        note:
          "Wages only — no benefits, overhead, equipment or laboratory space — so this OVERSTATES how many " +
          "researchers the money could actually fund. The national total of 20,430 physicists across every " +
          "employer and every field is the constraint worth staring at.",
      },
    ],
  },
  supply: [
    {
      // Industrial gases are NAICS 325120, inside the chemical aggregate FRED
      // publishes. Broader than helium alone, and labelled so.
      seriesId: "us-chemical-capacity",
      label: "US chemical manufacturing capacity (industrial gases sit inside this aggregate)",
      unit: "index (2017=100)",
      constrains: "helium_mcf",
      connector: "fred",
      handle: "CAPG325S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG325S",
    },
    {
      seriesId: "us-chemical-output",
      label: "US chemical manufacturing, actual output",
      unit: "index (2017=100)",
      constrains: "helium_mcf",
      connector: "fred",
      handle: "IPG325S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG325S",
    },
    {
      seriesId: "us-professional-scientific-employment",
      label: "US professional, scientific and technical services employment",
      unit: "thousands of persons",
      constrains: "physicist_year",
      connector: "fred",
      handle: "CES6054000001",
      sourceUrl: "https://fred.stlouisfed.org/series/CES6054000001",
    },
    {
      seriesId: "usgs-helium-production",
      label: "US helium sales and production (USGS Mineral Commodity Summaries)",
      unit: "million cubic meters",
      constrains: "helium_mcf",
      connector: "stub",
      sourceUrl: "https://www.usgs.gov/centers/national-minerals-information-center/helium-statistics-and-information",
      stub: true,
    },
    {
      seriesId: "doe-helium-3-supply",
      label: "DOE helium-3 supply and allocation (the millikelvin-stage refrigerant)",
      unit: "liters per year",
      constrains: "helium_mcf",
      connector: "stub",
      sourceUrl: "https://www.isotopes.gov/Supply-and-Demand-of-Helium-3",
      stub: true,
    },
  ],
  owners: [
    {
      category: "helium_mcf",
      label: "Industrial gas and cryogenic equipment",
      tickers: ["LIN", "APD"],
      foreign: [
        "Air Liquide (Euronext)",
        "Nippon Sanso (TSE)",
        "Bluefors (Finland, unlisted)",
        "Oxford Instruments (LSE)",
      ],
    },
    {
      category: "physicist_year",
      label: "Quantum computing developers",
      tickers: ["IONQ", "RGTI", "QBTS", "QUBT", "IBM", "HON"],
      foreign: [
        "Quantinuum (unlisted; Honeywell-majority)",
        "PsiQuantum (unlisted)",
        "Alice & Bob (France, unlisted)",
        "Fujitsu (TSE)",
      ],
    },
  ],
  builtIn: true,
};

/* ----------------------------------------------------------------------------
 * Built-in: nuclear energy
 *
 * The best-sourced theme on the desk, because the US government publishes every
 * number this one needs: EIA commissions an engineering cost estimate for a new
 * reactor and publishes the $/kW, and EIA's own annual survey of the utilities
 * publishes what they paid for uranium and for enrichment.
 * -------------------------------------------------------------------------- */

const NUCLEAR: Playbook = {
  id: "nuclear-energy",
  label: "Nuclear energy",
  blurb:
    "A reactor is the one machine whose fuel cannot be bought on a spot market at short notice: the uranium " +
    "has to be mined years earlier and the enrichment has to be booked years before that, from four sellers " +
    "worldwide. This playbook reads what the US-listed nuclear operators, component makers and reactor " +
    "developers are spending, and converts it into megawatts at the cost EIA's engineers estimated for a new " +
    "AP1000, into pounds of uranium at the price the utilities actually paid last year, and into separative " +
    "work units at the price they actually paid for enrichment. Read the basket honestly: one large operator " +
    "dominates the dollars, and the developers whose names carry the story contribute a rounding error.",
  demand: {
    // Verified against live SEC 2026-09-01, all six current through 2026-06-30:
    // CEG $3.90B TTM, TLN $228M, BWXT $202M, OKLO $159M, LEU $109M, SMR $2.5M.
    // Vistra and GE Vernova spend more than most of these but their capital
    // budgets are majority non-nuclear, so they sit in the owner map instead.
    // Nano Nuclear has three tagged quarters, one short of a trailing year.
    basket: ["CEG", "BWXT", "LEU", "OKLO", "SMR", "TLN"],
    capexTags: [
      "PaymentsToAcquirePropertyPlantAndEquipment",
      "PaymentsToAcquireProductiveAssets",
      "PaymentsForCapitalImprovements",
      "PaymentsToAcquirePropertyPlantAndEquipmentAndIntangibleAssets",
    ],
    measure: "Capital spending",
    narrativeKeywords: ["capital expenditure", "reactor", "uranium", "enrichment", "uprate", "licence", "license"],
  },
  conversions: {
    version: "2026-09-a",
    asOf: "2026-09",
    factors: [
      {
        key: "nuclear_mw",
        unit: "MW of new nuclear generating capacity",
        usdPer: 7_861_000,
        source:
          "US Energy Information Administration (prepared by Sargent & Lundy), Capital Cost and Performance " +
          "Characteristics for Utility-Scale Electric Power Generating Technologies, January 2024, Table 1-2 " +
          "Case 9: Advanced Nuclear (Brownfield), 2 x AP1000, 2,156 MW net — $7,861/kW",
        asOf: "2024-01",
        note:
          "In 2023 dollars, and an OVERNIGHT cost: it excludes the interest accrued across a build that the " +
          "same report gives a 40-month construction time and a 176-month total lead time. It is also the " +
          "brownfield case, which assumes an existing site. The same table prices a 6 x 80 MW small modular " +
          "plant at $8,936/kW.",
      },
      {
        key: "u3o8_lb",
        unit: "pounds of U3O8 equivalent",
        usdPer: 58.46,
        source:
          "US Energy Information Administration, Uranium Marketing Annual Report (released 29 July 2026): " +
          "2025 weighted-average price of uranium purchased by owners and operators of US civilian nuclear " +
          "power reactors",
        asOf: "2026-07",
        note:
          "What the utilities actually paid, not a spot quote: it averages deliveries under contracts signed " +
          "across many years, so it lags the market in both directions. EIA reports it 11% above the 2024 " +
          "average.",
      },
      {
        key: "swu",
        unit: "separative work units of enrichment",
        usdPer: 108.7,
        source:
          "US Energy Information Administration, Uranium Marketing Annual Report (released 29 July 2026): " +
          "2025 average price paid for enrichment services; 13 million SWU purchased from four sellers",
        asOf: "2026-07",
        note:
          "Up 11% from the $97.66 per SWU paid in 2024. Four sellers is the whole market, which is why this " +
          "line moves on policy rather than on demand.",
      },
    ],
  },
  supply: [
    {
      seriesId: "us-electric-power-capacity",
      label: "US electric power generating capacity",
      unit: "index (2017=100)",
      constrains: "nuclear_mw",
      connector: "fred",
      handle: "CAPG2211S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG2211S",
    },
    {
      seriesId: "us-electric-power-output",
      label: "US electric power generation, actual output",
      unit: "index (2017=100)",
      constrains: "nuclear_mw",
      connector: "fred",
      handle: "IPG2211S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG2211S",
    },
    {
      // Reactor vessels, steam generators and turbine rotors are heavy forgings,
      // and the number of presses in the world that can make them is small. This
      // is the closest published capacity series; it covers all primary metal,
      // not forging alone, and is labelled accordingly.
      seriesId: "us-primary-metal-capacity",
      label: "US primary metal manufacturing capacity (the heavy-forging constraint sits inside this)",
      unit: "index (2017=100)",
      constrains: "nuclear_mw",
      connector: "fred",
      handle: "CAPG331S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG331S",
    },
    {
      seriesId: "us-metal-ore-mining-capacity",
      label: "US metal ore mining capacity (uranium mining sits inside this)",
      unit: "index (2017=100)",
      constrains: "u3o8_lb",
      connector: "fred",
      handle: "CAPG2122S",
      sourceUrl: "https://fred.stlouisfed.org/series/CAPG2122S",
    },
    {
      seriesId: "us-metal-ore-mining-output",
      label: "US metal ore mining, actual output",
      unit: "index (2017=100)",
      constrains: "u3o8_lb",
      connector: "fred",
      handle: "IPG2122S",
      sourceUrl: "https://fred.stlouisfed.org/series/IPG2122S",
    },
    {
      seriesId: "eia-domestic-uranium-production",
      label: "US domestic uranium concentrate production (EIA quarterly report)",
      unit: "pounds U3O8",
      constrains: "u3o8_lb",
      connector: "stub",
      sourceUrl: "https://www.eia.gov/uranium/production/quarterly/",
      stub: true,
    },
    {
      seriesId: "us-enrichment-supply",
      label: "Enrichment services purchased and sellers (EIA Uranium Marketing Annual)",
      unit: "separative work units",
      constrains: "swu",
      connector: "stub",
      sourceUrl: "https://www.eia.gov/uranium/marketing/",
      stub: true,
    },
    {
      seriesId: "nuclear-backlog-disclosed",
      label: "Reactor backlog disclosed in filings",
      unit: "GW",
      constrains: "nuclear_mw",
      connector: "filing-search",
      handle: "nuclear reactor backlog gigawatts",
    },
  ],
  owners: [
    {
      category: "nuclear_mw",
      label: "Nuclear operators, component makers and reactor developers",
      tickers: ["CEG", "VST", "TLN", "BWXT", "SMR", "OKLO", "GEV", "NNE"],
      foreign: [
        "EDF (France, state-owned)",
        "KEPCO / KHNP (KRX)",
        "Rosatom (Russia, state-owned)",
        "CNNC (SSE)",
        "Mitsubishi Heavy Industries (TSE)",
      ],
    },
    {
      category: "u3o8_lb",
      label: "Uranium miners",
      tickers: ["CCJ", "UEC", "UUUU", "DNN", "NXE", "URG"],
      foreign: ["Kazatomprom (LSE GDR)", "Orano (France, state-owned)", "CGN Mining (HKEX)"],
    },
    {
      category: "swu",
      label: "Enrichment and conversion",
      tickers: ["LEU", "CCJ"],
      foreign: [
        "Urenco (UK/Germany/Netherlands consortium, unlisted)",
        "Orano (France, state-owned)",
        "TENEX / Rosatom (Russia, state-owned)",
      ],
    },
  ],
  builtIn: true,
};

export const BUILT_IN_PLAYBOOKS: Playbook[] = [
  AI_INFRASTRUCTURE,
  EV_BATTERY,
  HOMEBUILDING,
  DRONES,
  ROBOTICS,
  QUANTUM,
  NUCLEAR,
];

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
