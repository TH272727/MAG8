import {
  LENS_SKILLS,
  cellKey,
  lensHeadline,
  type CellKey,
  type CompiledReport,
  type Confidence,
  type DiscoveryCandidate,
  type ForecastMetrics,
  type GtMetrics,
  type LensAnalysis,
  type LensSkill,
  type MetricValue,
  type ProgressEvent,
  type RankedStockWire,
  type ScannerMetrics,
  type SubScores,
  type Verdict,
} from "./schemas";
import {
  GATE_MULTIPLIER,
  NEUTRAL_SUBSCORE,
  computeScore,
  deriveGate,
  finalizeRankings,
  weightedBase,
  type VerifyContext,
} from "./ranking";
import { isoWeekKey } from "./db";
import { PUBLIC_LENS_LABEL } from "./public-view";

/* ============================================================================
 * Deterministic fixture run: 8 candidates, 24 ok lens cells, rankings, events.
 * Numbers are built through the SAME ranking arithmetic the pipeline uses, so
 * every page renders internally-consistent data with zero API spend.
 * ========================================================================== */

export const FIXTURE_RUN_ID = "fixture-demo-run";

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Cache week for fixture/mock lens rows. The "-demo" suffix keeps seeded demo
 * data out of the REAL pipeline's cache lookups (which use plain isoWeekKey()),
 * while letting mock runs demonstrate genuine cache hits against fixture rows.
 */
export function demoWeekKey(d?: Date): string {
  return `${isoWeekKey(d)}-demo`;
}

interface LensSeed {
  verdict: Verdict;
  confidence: Confidence;
  summary: string;
  riskFlags: string[];
}

export interface TickerSeed {
  ticker: string;
  companyName: string;
  sector: string;
  thesis: string;
  matchedTraits: string[];
  scanner: LensSeed & { km: ScannerMetrics };
  gt: LensSeed & { km: Omit<GtMetrics, "adjustedProbability"> & { adjustedProbability: string } };
  forecast: LensSeed & {
    km: Omit<ForecastMetrics, "impliedUpsidePct" | "consensusTarget"> & { consensusTarget: number };
  };
  subScores: SubScores;
  verdictLine: string;
}

export const FIXTURE_SEEDS: TickerSeed[] = [
  {
    ticker: "ASTS",
    companyName: "AST SpaceMobile",
    sector: "Space · Direct-to-cell",
    thesis:
      "Building the only space-based cellular network that talks to unmodified phones, with spectrum agreements and revenue-sharing deals already signed with major carriers. If direct-to-cell becomes default coverage, ASTS owns the tollbooth layer of a new network tier.",
    matchedTraits: ["Platform economics", "Regulatory moat (spectrum)", "Carrier lock-in before scale", "Founder-led"],
    scanner: {
      verdict: "bullish",
      confidence: "medium",
      summary:
        "Balance sheet is grey-zone but funded through initial constellation deployment, and the reverse-DCF bar looks beatable if carrier milestones land. Confirmation signals are present: relative strength, insider holding, and dated launch catalysts. Verdict: Buy, with dilution as the standing caveat.",
      riskFlags: ["Launch cadence slippage", "Dilution before service revenue", "Carrier deals are revenue-share, not take-or-pay"],
      km: {
        piotroskiF: 6,
        altmanZ: 2.4,
        altmanZone: "grey",
        reverseDcfVerdict: "Implied bar beatable if carrier milestones land on schedule",
        rewardRisk: "3.1 : 1",
        composite: 7.4,
        scannerVerdict: "Buy",
        valueTrap: false,
      },
    },
    gt: {
      verdict: "bullish",
      confidence: "high",
      summary:
        "Deglobalization and sovereign-connectivity scripts both point at owning space-layer infrastructure, and the market still prices ASTS as a speculative telecom rather than a spectrum monopoly in formation. Base rate for funded first-movers in licensed-spectrum networks is favorable; the GT read adjusts further up on carrier coordination signals.",
      riskFlags: ["A Starlink direct-to-cell pricing war compresses the tollbooth", "Escalation risk: launch-provider bottlenecks"],
      km: {
        asymmetryScore: 8.5,
        entryWindow: "Next 2 quarters, before commercial service revenue prints",
        baseRate: "Funded licensed-spectrum first movers reach service ~35% of the time",
        adjustedProbability: "35% → 60% on carrier coordination + spectrum position",
        gapVsMarket: "Market prices a speculative telecom; GT reads carrier lock-in as structural",
      },
    },
    forecast: {
      verdict: "bullish",
      confidence: "medium",
      summary:
        "Six of eight primary desks verified with a wide but decisively bullish skew; targets were mostly raised after the latest launch block. Spread is wide — the street disagrees on timing, not direction.",
      riskFlags: ["Wide target spread signals real execution uncertainty"],
      km: {
        currentPrice: 34.2,
        consensusTarget: 45.0,
        consensusTargetLow: 28.0,
        consensusTargetHigh: 60.0,
        stance: "Bullish",
        bankCount: 6,
        spread: "Wide",
        freshness: "4 fresh · 2 aging",
      },
    },
    subScores: { fundamentals: 74, discoveryThesis: 88, gtAsymmetry: 84, institutionalGap: 78 },
    verdictLine: "The rare setup where all three lenses agree: infrastructure-grade moat priced as a story stock.",
  },
  {
    ticker: "RKLB",
    companyName: "Rocket Lab",
    sector: "Space · Launch + systems",
    thesis:
      "The only proven small-launch provider that is vertically integrating into satellite systems and constellation services, with Neutron opening the medium-lift market. Looks like pre-AWS Amazon: monetizing its own infrastructure while selling it to everyone else.",
    matchedTraits: ["Vertical integration", "Expanding TAM (launch → systems → services)", "Founder-led", "Execution cadence"],
    scanner: {
      verdict: "bullish",
      confidence: "high",
      summary:
        "Cleanest balance sheet in the cohort (Z 4.1, F 7), backlog growing, and the space-systems segment already carries gross margin. Reverse-DCF says the current price roughly prices Electron + systems; Neutron success is a free option. Verdict: Buy.",
      riskFlags: ["Neutron schedule risk", "Launch-margin pressure from reusability transition"],
      km: {
        piotroskiF: 7,
        altmanZ: 4.1,
        altmanZone: "safe",
        reverseDcfVerdict: "Implied bar about right; Neutron success is not priced",
        rewardRisk: "2.6 : 1",
        composite: 7.8,
        scannerVerdict: "Buy",
        valueTrap: false,
      },
    },
    gt: {
      verdict: "bullish",
      confidence: "medium",
      summary:
        "Defense-space budgets are structurally rising under every deglobalization scenario, and national-security launch is being deliberately dual-sourced away from a single provider. RKLB is the coordination beneficiary; the market treats it as a launch commodity.",
      riskFlags: ["A Neutron failure resets the medium-lift thesis by 18+ months"],
      km: {
        asymmetryScore: 7.0,
        entryWindow: "Before first Neutron flight window",
        baseRate: "Second-source defense suppliers win share ~55% of cycles",
        adjustedProbability: "55% → 70% on budget trajectory + dual-sourcing mandates",
        gapVsMarket: "Priced as commodity launch; GT reads a defense-infrastructure annuity forming",
      },
    },
    forecast: {
      verdict: "neutral",
      confidence: "medium",
      summary:
        "Seven desks verified but the balance is genuinely mixed — bulls underwrite Neutron, bears see launch-margin dilution. Consensus target sits barely above spot with a wide spread; the street is waiting for the same catalyst the GT lens is front-running.",
      riskFlags: ["Consensus offers little near-term upside cover if Neutron slips"],
      km: {
        currentPrice: 27.8,
        consensusTarget: 29.5,
        consensusTargetLow: 22.0,
        consensusTargetHigh: 38.0,
        stance: "Mixed",
        bankCount: 7,
        spread: "Wide",
        freshness: "5 fresh · 2 aging",
      },
    },
    subScores: { fundamentals: 78, discoveryThesis: 84, gtAsymmetry: 70, institutionalGap: 58 },
    verdictLine: "Two lenses lean in; the street is the holdout until Neutron flies.",
  },
  {
    ticker: "TMDX",
    companyName: "TransMedics Group",
    sector: "MedTech · Organ logistics",
    thesis:
      "Owns the organ-preservation-and-transport stack end to end — devices, aviation, logistics — turning transplant supply into a network business with hard regulatory and operational moats. The pre-scale pattern rhyme is early UPS with an FDA moat.",
    matchedTraits: ["End-to-end network control", "Regulatory moat", "Compounding unit economics", "Category creator"],
    scanner: {
      verdict: "bullish",
      confidence: "high",
      summary:
        "Best fundamentals in the cohort: F 8, safe-zone Z, real revenue growth with expanding margins, and a reverse-DCF bar that looks conservative against organ-flight volume growth. Verdict: Buy.",
      riskFlags: ["Aviation capex cycle", "Reimbursement policy shifts"],
      km: {
        piotroskiF: 8,
        altmanZ: 3.8,
        altmanZone: "safe",
        reverseDcfVerdict: "Implied bar too low vs the logistics-network moat",
        rewardRisk: "2.9 : 1",
        composite: 8.1,
        scannerVerdict: "Buy",
        valueTrap: false,
      },
    },
    gt: {
      verdict: "neutral",
      confidence: "medium",
      summary:
        "Largely idiosyncratic — healthcare logistics has little geopolitical beta, which cuts both ways: no macro tailwind to front-run, but also insulation from the escalation scenarios that hurt risk assets. Structural setup score is low; the thesis lives or dies on execution.",
      riskFlags: ["No macro catalyst to force a re-rating"],
      km: {
        asymmetryScore: 5.5,
        entryWindow: "No macro-driven window; accumulate on execution proof-points",
        baseRate: "Category-creating medtech compounds hold share ~60% of the time",
        adjustedProbability: "60% → 62%; macro adds little either way",
        gapVsMarket: "Market and GT read roughly agree; edge is company-specific",
      },
    },
    forecast: {
      verdict: "neutral",
      confidence: "medium",
      summary:
        "Five desks verified, moderate spread, targets modestly above spot after a strong run. The street likes the business but debates the multiple; freshness is decent.",
      riskFlags: ["Multiple compression risk after the run-up"],
      km: {
        currentPrice: 95.4,
        consensusTarget: 104.0,
        consensusTargetLow: 88.0,
        consensusTargetHigh: 125.0,
        stance: "Mixed",
        bankCount: 5,
        spread: "Moderate",
        freshness: "3 fresh · 2 aging",
      },
    },
    subScores: { fundamentals: 82, discoveryThesis: 68, gtAsymmetry: 55, institutionalGap: 64 },
    verdictLine: "Fundamentals carry it: the strongest business here, without the macro kicker.",
  },
  {
    ticker: "SYM",
    companyName: "Symbotic",
    sector: "Robotics · Warehouse automation",
    thesis:
      "AI-powered warehouse robotics with a multi-decade Walmart deployment contract and a backlog measured in tens of billions. Matches the pre-scale pattern of selling picks and shovels to retailers forced to automate against labor economics.",
    matchedTraits: ["Anchor-customer flywheel", "Massive contracted backlog", "Secular labor-cost wave", "Systems + software mix shift"],
    scanner: {
      verdict: "neutral",
      confidence: "medium",
      summary:
        "Backlog is real but concentration is extreme, and the reverse-DCF bar assumes a deployment pace Symbotic has missed before. Fundamentals are fine (F 6, grey-zone Z from working-capital swings); the missing piece is margin proof at scale. Verdict: Watchlist.",
      riskFlags: ["Customer concentration (Walmart)", "Deployment-pace execution", "Accounting restatement history"],
      km: {
        piotroskiF: 6,
        altmanZ: 3.2,
        altmanZone: "grey",
        reverseDcfVerdict: "Implied bar slightly rich on deployment pace",
        rewardRisk: "1.9 : 1",
        composite: 6.2,
        scannerVerdict: "Watchlist",
        valueTrap: false,
      },
    },
    gt: {
      verdict: "neutral",
      confidence: "medium",
      summary:
        "Reshoring and labor-scarcity lenses are genuinely active, but SYM captures them through one customer relationship, which mutes the structural read. Setup score mid-range.",
      riskFlags: ["Reshoring capex could route to competing integrators"],
      km: {
        asymmetryScore: 6.0,
        entryWindow: "On evidence of non-Walmart deployment wins",
        baseRate: "Single-anchor industrial scalers diversify successfully ~45% of the time",
        adjustedProbability: "45% → 52% on GreenBox JV progress",
        gapVsMarket: "Market discounts concentration; GT partially agrees — edge is modest",
      },
    },
    forecast: {
      verdict: "bullish",
      confidence: "medium",
      summary:
        "Five desks verified, bullish balance with targets raised after the last deployment update. Spread moderate; one stale target flagged and excluded from the range read.",
      riskFlags: ["Street models assume no further deployment slips"],
      km: {
        currentPrice: 28.1,
        consensusTarget: 33.0,
        consensusTargetLow: 24.0,
        consensusTargetHigh: 41.0,
        stance: "Bullish",
        bankCount: 5,
        spread: "Moderate",
        freshness: "3 fresh · 1 aging · 1 stale",
      },
    },
    subScores: { fundamentals: 68, discoveryThesis: 74, gtAsymmetry: 62, institutionalGap: 70 },
    verdictLine: "A real wave, one anchor customer: the caution gate does exactly its job here.",
  },
  {
    ticker: "IONQ",
    companyName: "IonQ",
    sector: "Quantum computing",
    thesis:
      "The most commercially advanced trapped-ion quantum company, already selling systems and cloud access while the field is pre-product everywhere else. If quantum reaches useful scale this decade, IONQ is positioned like early NVIDIA: the hardware standard-setter.",
    matchedTraits: ["Category leadership pre-market", "Cloud distribution deals", "Deep IP moat", "Cash-rich balance sheet"],
    scanner: {
      verdict: "neutral",
      confidence: "low",
      summary:
        "Cash fortress (Z 8.0) but weak operating signals (F 4) and a price that implies a flawless multi-year roadmap. No value-trap mechanics — just a valuation that outruns the fundamentals today. Verdict: Watchlist.",
      riskFlags: ["Roadmap slippage", "Dilution via ATM programs", "Revenue is still pilot-scale"],
      km: {
        piotroskiF: 4,
        altmanZ: 8.0,
        altmanZone: "safe",
        reverseDcfVerdict: "Price implies flawless quantum roadmap execution",
        rewardRisk: "1.4 : 1",
        composite: 5.1,
        scannerVerdict: "Watchlist",
        valueTrap: false,
      },
    },
    gt: {
      verdict: "bullish",
      confidence: "medium",
      summary:
        "Quantum is becoming a sovereign-capability race — export controls, national programs, defense procurement — and races of that shape historically overfund the perceived leader regardless of near-term revenue. The GT read is that state coordination, not commercial adoption, sets the floor.",
      riskFlags: ["A rival modality (superconducting, neutral-atom) hitting scale first"],
      km: {
        asymmetryScore: 7.5,
        entryWindow: "Ahead of national-program procurement announcements",
        baseRate: "Perceived leaders in sovereign tech races re-rate ~40% of the time",
        adjustedProbability: "40% → 58% on export-control tightening + program funding",
        gapVsMarket: "Market prices commercial adoption; GT prices the state-actor bid",
      },
    },
    forecast: {
      verdict: "neutral",
      confidence: "low",
      summary:
        "Thin verified coverage (4 desks) with the widest spread in the cohort — targets range from a third of spot to well above it. Consensus is a shrug with fat tails; coverage quality caps confidence.",
      riskFlags: ["Thin coverage — consensus read is low-signal"],
      km: {
        currentPrice: 32.6,
        consensusTarget: 34.0,
        consensusTargetLow: 18.0,
        consensusTargetHigh: 50.0,
        stance: "Mixed",
        bankCount: 4,
        spread: "Wide",
        freshness: "2 fresh · 2 aging",
      },
    },
    subScores: { fundamentals: 55, discoveryThesis: 80, gtAsymmetry: 75, institutionalGap: 48 },
    verdictLine: "A sovereign-race option masquerading as a revenue story; sized by the gate accordingly.",
  },
  {
    ticker: "CRSP",
    companyName: "CRISPR Therapeutics",
    sector: "Biotech · Gene editing",
    thesis:
      "First approved CRISPR therapy on the market with a platform pipeline behind it and a cash runway most of biotech would envy. The pattern-match is early Genentech: platform biology with one product proving the modality works.",
    matchedTraits: ["Platform IP", "First approval de-risks the modality", "Cash runway", "Partnership validation (Vertex)"],
    scanner: {
      verdict: "neutral",
      confidence: "medium",
      summary:
        "Casgevy revenue ramps slower than the science deserves — launch logistics are genuinely hard. Balance sheet is safe (Z 5.5) and F 5 reflects investment mode, not distress. The bar is high but the pipeline is free at this price. Verdict: Watchlist.",
      riskFlags: ["Slow launch ramp", "Pipeline readouts are binary events"],
      km: {
        piotroskiF: 5,
        altmanZ: 5.5,
        altmanZone: "safe",
        reverseDcfVerdict: "Pipeline optionality under-modeled; near-term revenue bar high",
        rewardRisk: "1.8 : 1",
        composite: 5.7,
        scannerVerdict: "Watchlist",
        valueTrap: false,
      },
    },
    gt: {
      verdict: "neutral",
      confidence: "low",
      summary:
        "Gene editing has modest structural-lens exposure — some sovereign-biotech funding tailwind, offset by drug-pricing politics. Mostly idiosyncratic science risk; GT adds little edge either direction.",
      riskFlags: ["Drug-pricing policy is an unhedgeable political variable"],
      km: {
        asymmetryScore: 5.0,
        entryWindow: "Around pipeline readout windows rather than macro timing",
        baseRate: "First-approval platform biotechs deliver a second hit ~35% of the time",
        adjustedProbability: "35% → 38%",
        gapVsMarket: "No meaningful gap — market and GT both see binary science risk",
      },
    },
    forecast: {
      verdict: "bullish",
      confidence: "medium",
      summary:
        "Six desks verified and the balance leans clearly bullish on pipeline value, with targets well above spot. Spread is wide — typical for binary-readout biotech — but direction of travel has been upward revisions.",
      riskFlags: ["Targets embed pipeline success probabilities that may not survive readouts"],
      km: {
        currentPrice: 48.3,
        consensusTarget: 58.0,
        consensusTargetLow: 40.0,
        consensusTargetHigh: 75.0,
        stance: "Bullish",
        bankCount: 6,
        spread: "Wide",
        freshness: "4 fresh · 2 aging",
      },
    },
    subScores: { fundamentals: 60, discoveryThesis: 66, gtAsymmetry: 52, institutionalGap: 72 },
    verdictLine: "The street believes; the gate holds it to Watchlist until the ramp proves out.",
  },
  {
    ticker: "OKLO",
    companyName: "Oklo",
    sector: "Energy · Advanced nuclear",
    thesis:
      "Compact fast-reactor developer with a build-own-operate model selling power, not reactors, straight into the AI datacenter load wave. The pre-scale rhyme is early utility-scale solar developers — if licensing lands, the order book is the moat.",
    matchedTraits: ["Secular wave (AI power demand)", "Business-model innovation (power-as-product)", "Regulatory optionality", "Founder-led"],
    scanner: {
      verdict: "neutral",
      confidence: "low",
      summary:
        "Pre-revenue: Altman is not meaningful and F 4 reflects a company that is all balance sheet and no operations yet. The valuation is entirely narrative until the first COLA milestone. No trap mechanics, but nothing to anchor on either. Verdict: Watchlist.",
      riskFlags: ["Licensing timeline risk (NRC)", "Pre-revenue — no fundamental anchor", "Fuel-supply dependency (HALEU)"],
      km: {
        piotroskiF: 4,
        altmanZ: null,
        altmanZone: "not-meaningful",
        reverseDcfVerdict: "Pre-revenue: valuation entirely narrative until licensing milestones",
        rewardRisk: "1.6 : 1",
        composite: 4.9,
        scannerVerdict: "Watchlist",
        valueTrap: false,
      },
    },
    gt: {
      verdict: "bullish",
      confidence: "medium",
      summary:
        "The strongest structural setup after ASTS: AI load growth, grid fragility, and energy-sovereignty scripts all converge on dispatchable clean baseload. Nuclear-friendly policy is one of the few genuinely bipartisan scripts. The market prices licensing risk; GT prices script convergence.",
      riskFlags: ["One adverse NRC decision resets the entire timeline"],
      km: {
        asymmetryScore: 7.8,
        entryWindow: "Before the first combined-license acceptance milestone",
        baseRate: "Novel-reactor licensees reach operation ~25% of the time historically",
        adjustedProbability: "25% → 45% on policy convergence + anchor customers",
        gapVsMarket: "Market prices regulatory attrition; GT reads a policy-forced fast lane",
      },
    },
    forecast: {
      verdict: "bearish",
      confidence: "medium",
      summary:
        "Only four desks verified and the balance tilts bearish on valuation — the average verified target sits below spot after the retail-driven run. Coverage is thin and partly stale; treat the consensus read as weak evidence, but its direction is hard to ignore.",
      riskFlags: ["Verified consensus sits below spot", "Thin, partly stale coverage"],
      km: {
        currentPrice: 38.9,
        consensusTarget: 31.0,
        consensusTargetLow: 20.0,
        consensusTargetHigh: 45.0,
        stance: "Bearish",
        bankCount: 4,
        spread: "Wide",
        freshness: "2 fresh · 1 aging · 1 stale",
      },
    },
    subScores: { fundamentals: 45, discoveryThesis: 78, gtAsymmetry: 70, institutionalGap: 38 },
    verdictLine: "Game theory loves it, the street doesn't, and there's no balance sheet to referee — textbook caution gate.",
  },
  {
    ticker: "ACHR",
    companyName: "Archer Aviation",
    sector: "eVTOL · Urban air mobility",
    thesis:
      "One of two credible US eVTOL certification candidates, with an automaker manufacturing partner and airline pre-orders. If urban air mobility becomes a market this decade, Archer is one of its two US gatekeepers.",
    matchedTraits: ["Duopoly positioning pre-market", "Manufacturing partner de-risks scale-up", "Airline distribution pre-orders"],
    scanner: {
      verdict: "bearish",
      confidence: "medium",
      summary:
        "The distress-zone veto fires: Altman 1.3 and F 3 on heavy cash burn with certification still ahead. The price implies certification, production ramp, and no further dilution simultaneously. This is exactly the falling-knife profile the gates exist to catch. Verdict: Pass.",
      riskFlags: ["Distress-zone balance sheet", "Certification timeline risk", "Serial dilution", "Pre-revenue burn rate"],
      km: {
        piotroskiF: 3,
        altmanZ: 1.3,
        altmanZone: "distress",
        reverseDcfVerdict: "Price implies certification + ramp with no dilution",
        rewardRisk: "0.9 : 1",
        composite: 3.6,
        scannerVerdict: "Pass",
        valueTrap: false,
      },
    },
    gt: {
      verdict: "neutral",
      confidence: "low",
      summary:
        "Defense and logistics interest in eVTOL is real but early; no structural thesis is compelled to fund Archer specifically. Setup score low-mid; the certification calendar, not macro, is the whole game.",
      riskFlags: ["Certification slips push any macro relevance past the entry window"],
      km: {
        asymmetryScore: 4.5,
        entryWindow: "Post-certification only; pre-cert entry is uncompensated risk",
        baseRate: "Clean-sheet aircraft programs certify on first announced timeline ~15% of the time",
        adjustedProbability: "15% → 22% on partner manufacturing discipline",
        gapVsMarket: "Market is ahead of the certification reality; GT sees no mispricing to harvest",
      },
    },
    forecast: {
      verdict: "bearish",
      confidence: "medium",
      summary:
        "Five desks verified; balance tilts bearish with the average target below spot and two recent cuts. The street is pricing dilution before certification — the same read the scanner's balance-sheet gate produces.",
      riskFlags: ["Recent target cuts", "Consensus below spot"],
      km: {
        currentPrice: 5.6,
        consensusTarget: 5.0,
        consensusTargetLow: 3.5,
        consensusTargetHigh: 7.5,
        stance: "Bearish",
        bankCount: 5,
        spread: "Wide",
        freshness: "3 fresh · 2 aging",
      },
    },
    subScores: { fundamentals: 35, discoveryThesis: 60, gtAsymmetry: 50, institutionalGap: 55 },
    verdictLine: "A credible story on a distressed balance sheet — the fail gate does the risk management.",
  },
];

/* ============================================================================
 * Builders
 * ========================================================================== */

export function fixtureCandidates(count: number): DiscoveryCandidate[] {
  return FIXTURE_SEEDS.slice(0, Math.min(count, FIXTURE_SEEDS.length)).map((s) => ({
    ticker: s.ticker,
    companyName: s.companyName,
    sector: s.sector,
    thesis: s.thesis,
    matchedTraits: s.matchedTraits,
  }));
}

export const FIXTURE_MARKET_CONTEXT =
  "Seeded demo scan. The secular waves this cohort rides: space-layer infrastructure becoming carrier-grade, AI power demand outrunning the grid, automation against labor economics, and sovereign-capability races in quantum and biotech. Small/mid-caps only; current mega-caps excluded by mandate.";

function pctUpside(price: number, target: number): number {
  return round1((target / price - 1) * 100);
}

/* ----------------------------------------------------------------------------
 * Optional structured extras (visual data layer) — deterministically DERIVED
 * from each seed's existing numbers, so no gate/score input ever changes and
 * the seed regression stays byte-identical.
 * -------------------------------------------------------------------------- */

const round2 = (x: number) => Math.round(x * 100) / 100;
const clampPct = (n: number) => Math.max(5, Math.min(90, Math.round(n)));
const clamp10 = (n: number) => Math.max(1, Math.min(10, round1(n)));

function scannerExtras(s: TickerSeed): Pick<ScannerMetrics, "spotPrice" | "scenarios"> {
  const k = s.forecast.km;
  const spot = k.currentPrice ?? null;
  const low = k.consensusTargetLow ?? k.consensusTarget;
  const high = k.consensusTargetHigh ?? k.consensusTarget;
  return {
    spotPrice: spot,
    scenarios: {
      bear: { price: spot !== null ? round2(Math.min(low, spot) * 0.85) : null, probability: 25 },
      base: { price: k.consensusTarget, probability: 50 },
      bull: { price: round2(high * 1.15), probability: 25 },
    },
  };
}

function gtExtras(s: TickerSeed): Pick<GtMetrics, "players" | "horizonProbabilities"> {
  const a = s.gt.km.asymmetryScore;
  const bullish = s.gt.verdict === "bullish";
  const base = clampPct(a * (bullish ? 7 : 4));
  return {
    players: [
      { name: s.companyName, role: "Operator", m: clamp10(3 + a * 0.4), e: clamp10(5 + a * 0.4), c: clamp10(4 + a * 0.3), read: "Executing against the entry window" },
      { name: "US policy apparatus", role: "Regulator / demand anchor", m: 9, e: clamp10(3 + a * 0.3), c: 4, read: "Sets the pace of the wave" },
      { name: "Incumbent competition", role: "Counterforce", m: 7, e: clamp10(8 - a * 0.4), c: 5, read: "Scale advantage, slower to move" },
      { name: "Capital markets", role: "Financier", m: 6, e: 5, c: 6, read: "Funding window open but fickle" },
    ],
    horizonProbabilities: { m3: clampPct(base - 15), m6: clampPct(base - 5), m12: base, m24: clampPct(base + 10) },
  };
}

const FIXTURE_DESKS = ["Goldman Sachs", "JPMorgan", "Morgan Stanley", "Bank of America", "Citi", "UBS", "BlackRock", "Bridgewater"];

function forecastExtras(s: TickerSeed): Pick<ForecastMetrics, "institutions"> {
  const k = s.forecast.km;
  const n = Math.max(2, Math.min(8, Math.round(k.bankCount ?? 4)));
  const low = k.consensusTargetLow ?? k.consensusTarget;
  const high = k.consensusTargetHigh ?? k.consensusTarget;
  return {
    institutions: Array.from({ length: n }, (_, i) => ({
      name: FIXTURE_DESKS[i],
      target: round2(low + ((high - low) * i) / Math.max(1, n - 1)),
      asOf: "this week",
      stance: s.forecast.verdict === "bullish" ? (i % 3 === 2 ? "Neutral" : "Buy") : i % 2 ? "Hold" : "Buy",
    })),
  };
}

export function fixtureLensAnalysis(seed: TickerSeed, skill: LensSkill): LensAnalysis {
  if (skill === "stock-scanner") {
    return {
      ticker: seed.ticker,
      skill,
      verdict: seed.scanner.verdict,
      confidence: seed.scanner.confidence,
      summary: seed.scanner.summary,
      keyMetrics: { ...seed.scanner.km, ...scannerExtras(seed) } as unknown as Record<string, MetricValue>,
      riskFlags: seed.scanner.riskFlags,
      fullAnalysisMarkdown: scannerMarkdown(seed),
    };
  }
  if (skill === "gt-predictor") {
    return {
      ticker: seed.ticker,
      skill,
      verdict: seed.gt.verdict,
      confidence: seed.gt.confidence,
      summary: seed.gt.summary,
      keyMetrics: { ...seed.gt.km, ...gtExtras(seed) } as unknown as Record<string, MetricValue>,
      riskFlags: seed.gt.riskFlags,
      fullAnalysisMarkdown: gtMarkdown(seed),
    };
  }
  const km: ForecastMetrics = {
    ...seed.forecast.km,
    impliedUpsidePct: pctUpside(seed.forecast.km.currentPrice ?? 0, seed.forecast.km.consensusTarget),
    ...forecastExtras(seed),
  };
  return {
    ticker: seed.ticker,
    skill,
    verdict: seed.forecast.verdict,
    confidence: seed.forecast.confidence,
    summary: seed.forecast.summary,
    keyMetrics: km as unknown as Record<string, MetricValue>,
    riskFlags: seed.forecast.riskFlags,
    fullAnalysisMarkdown: forecastMarkdown(seed),
  };
}

const DEMO_BANNER = "> **Seeded demo analysis** — fixture data for UI preview, not real research. Not investment advice.\n";

function scannerMarkdown(s: TickerSeed): string {
  const k = s.scanner.km;
  return `${DEMO_BANNER}
# Fundamentals — ${s.ticker} (${s.companyName})

## The Setup
${s.thesis}

## Gates
| Gate | Reading | Result |
|---|---|---|
| Financial strength | Piotroski F ${k.piotroskiF ?? "n/m"} · Altman Z ${k.altmanZ ?? "n/m"} (${k.altmanZone}) | ${k.altmanZone === "distress" || (k.piotroskiF ?? 9) <= 3 ? "**VETO**" : "clear"} |
| Quality | Moat + unit economics reviewed | ${k.scannerVerdict === "Pass" ? "weak" : "clear"} |
| Confirmation | Momentum / revisions / catalyst | ${k.scannerVerdict === "Buy" ? "present" : "partial"} |

## Reverse-DCF
${k.reverseDcfVerdict}.

## Scenarios
${(() => {
    const x = scannerExtras(s);
    const sc = x.scenarios;
    if (!sc) return `Probability-weighted reward/risk: **${k.rewardRisk}**.`;
    const row = (label: string, v: { price: number | null; probability: number | null }) =>
      `| ${label} | ${v.price === null ? "n/m" : `$${v.price}`} | ${v.probability ?? "–"}% |`;
    return `Spot used in valuation: ${x.spotPrice === null || x.spotPrice === undefined ? "n/m" : `$${x.spotPrice}`}.

| Scenario | Price | Probability |
|---|---|---|
${row("Bear", sc.bear)}
${row("Base", sc.base)}
${row("Bull", sc.bull)}

Probability-weighted reward/risk: **${k.rewardRisk}**.`;
  })()}

## Falsification — what would prove this wrong
${s.scanner.riskFlags.map((r) => `- ${r}`).join("\n")}

## Verdict
**${k.scannerVerdict}** — composite ${k.composite}. ${s.scanner.summary}

*Research, not advice.*`;
}

function gtMarkdown(s: TickerSeed): string {
  const k = s.gt.km;
  return `${DEMO_BANNER}
# Game Theory — ${s.ticker} situation read

## Outside View
- Reference class: ${k.baseRate}
- Adjustment: ${k.adjustedProbability}

## Structural Setup
${s.gt.summary}

## Player Map (Mass × Energy × Coordination, 1–10)
${(() => {
    const x = gtExtras(s);
    const rows = (x.players ?? [])
      .map((p) => `| ${p.name} | ${p.role ?? ""} | ${p.m} | ${p.e} | ${p.c} | ${p.read ?? ""} |`)
      .join("\n");
    const h = x.horizonProbabilities;
    return `| Player | Role | M | E | C | Read |
|---|---|---|---|---|---|
${rows}

Primary-outcome probability path: 3mo ${h?.m3 ?? "–"}% · 6mo ${h?.m6 ?? "–"}% · 12mo ${h?.m12 ?? "–"}% · 24mo ${h?.m24 ?? "–"}%.`;
  })()}

## Asset Implication
| Field | Reading |
|---|---|
| Asymmetry Score | **${k.asymmetryScore}/10** |
| Entry window | ${k.entryWindow} |
| Gap vs market | ${k.gapVsMarket} |

## Falsification Conditions
${s.gt.riskFlags.map((r) => `- ✗ ${r}`).join("\n")}

## VERDICT
Direction: **${s.gt.verdict}** · Confidence: ${s.gt.confidence}. Analysis only — not financial advice.`;
}

function forecastMarkdown(s: TickerSeed): string {
  const k = s.forecast.km;
  const upside = pctUpside(k.currentPrice ?? 0, k.consensusTarget);
  return `${DEMO_BANNER}
# Street Consensus — ${s.ticker} (deep verification)

## Consensus Dashboard
| Metric | Value |
|---|---|
| Current spot | $${k.currentPrice} |
| Target range | $${k.consensusTargetLow} – $${k.consensusTargetHigh} |
| Average verified target | $${k.consensusTarget} (${upside >= 0 ? "+" : ""}${upside}% vs spot) |
| Stance | ${k.stance} |
| Coverage | ${k.bankCount} of 8 primary institutions verified |
| Spread | ${k.spread} |
| Freshness | ${k.freshness} |

## Institution-by-institution
${(() => {
    const rows = (forecastExtras(s).institutions ?? [])
      .map((r) => `| ${r.name} | ${r.target === null ? "n/m" : `$${r.target}`} | ${r.stance ?? ""} | ${r.asOf ?? ""} |`)
      .join("\n");
    return `| Institution | Target | Stance | As of |
|---|---|---|---|
${rows}`;
  })()}

## Synthesis
${s.forecast.summary}

## Key Risks & Divergences
${s.forecast.riskFlags.map((r) => `- ${r}`).join("\n")}

*Aggregated public views, poor historical hit rate; information, not advice.*`;
}

/* ============================================================================
 * Report builder — runs the REAL ranking arithmetic over the seeds.
 * `missing` marks cells that errored (mock uses this to exercise the gap path).
 * ========================================================================== */

export function buildFixtureReport(opts: {
  runId: string;
  generatedAt: string;
  count: number;
  missing?: CellKey[];
}): CompiledReport {
  const seeds = FIXTURE_SEEDS.slice(0, Math.min(opts.count, FIXTURE_SEEDS.length));
  const missing = new Set(opts.missing ?? []);

  const ctx: VerifyContext = {
    lensVerdicts: new Map(),
    scannerMetrics: new Map(),
    candidateTickers: seeds.map((s) => s.ticker),
  };

  const wire: RankedStockWire[] = seeds.map((seed) => {
    const verdicts: Partial<Record<LensSkill, Verdict>> = {};
    const lensSeed = { "stock-scanner": seed.scanner, "gt-predictor": seed.gt, "institutional-forecast": seed.forecast } as const;
    for (const skill of LENS_SKILLS) {
      if (!missing.has(cellKey(seed.ticker, skill))) verdicts[skill] = lensSeed[skill].verdict;
    }
    ctx.lensVerdicts.set(seed.ticker, verdicts);

    const scannerMissing = missing.has(cellKey(seed.ticker, "stock-scanner"));
    if (!scannerMissing) {
      ctx.scannerMetrics.set(seed.ticker, seed.scanner.km as unknown as Record<string, MetricValue>);
    }

    const scores: SubScores = { ...seed.subScores };
    const gapNotes: string[] = [];
    if (scannerMissing) {
      scores.fundamentals = NEUTRAL_SUBSCORE;
      gapNotes.push("fundamentals lens missing → neutral 50");
    }
    if (missing.has(cellKey(seed.ticker, "gt-predictor"))) {
      scores.gtAsymmetry = NEUTRAL_SUBSCORE;
      gapNotes.push("GT lens missing → neutral 50");
    }
    if (missing.has(cellKey(seed.ticker, "institutional-forecast"))) {
      scores.institutionalGap = NEUTRAL_SUBSCORE;
      gapNotes.push("consensus lens missing → neutral 50");
    }

    const gateRead = scannerMissing
      ? { gate: "caution" as const, reason: "Fundamentals lens unavailable — gate defaulted to caution and the gap noted." }
      : (deriveGate(seed.scanner.km as unknown as Record<string, MetricValue>) ?? {
          gate: "caution" as const,
          reason: "Gate could not be derived — defaulted to caution.",
        });

    const confluence =
      LENS_SKILLS.every((sk) => verdicts[sk] !== undefined) && LENS_SKILLS.every((sk) => verdicts[sk] === "bullish");

    const base = weightedBase(scores);
    const finalScore = computeScore(scores, gateRead.gate, confluence);
    const gated = round1(base * GATE_MULTIPLIER[gateRead.gate]);

    const grounding =
      `Base ${base} = 0.35×${scores.fundamentals} + 0.25×${scores.discoveryThesis} + 0.20×${scores.gtAsymmetry} + 0.20×${scores.institutionalGap}. ` +
      `Gate ${gateRead.gate} ×${GATE_MULTIPLIER[gateRead.gate]} → ${gated} (${gateRead.reason.replace(/\.$/, "")}). ` +
      (confluence
        ? `Confluence bonus +10 — all three lenses independently bullish. `
        : `No confluence bonus — lenses did not all lean bullish. `) +
      `Final ${finalScore}. Evidence: scanner ${scannerMissing ? "unavailable" : `${seed.scanner.km.scannerVerdict} (F ${seed.scanner.km.piotroskiF ?? "n/m"}, Z ${seed.scanner.km.altmanZ ?? "n/m"})`}; ` +
      `GT asymmetry ${seed.gt.km.asymmetryScore}/10; street ${seed.forecast.km.stance.toLowerCase()} at ` +
      `${pctUpside(seed.forecast.km.currentPrice ?? 0, seed.forecast.km.consensusTarget)}% implied vs spot.` +
      (gapNotes.length ? ` Gaps: ${gapNotes.join("; ")}.` : "");

    return {
      ticker: seed.ticker,
      companyName: seed.companyName,
      gate: gateRead.gate,
      gateReason: gateRead.reason,
      scores,
      confluence,
      finalScore,
      verdictLine: seed.verdictLine,
      groundingNotes: grounding,
      riskFlags: [seed.scanner.riskFlags[0], seed.gt.riskFlags[0], seed.forecast.riskFlags[0]].filter(Boolean),
    };
  });

  const { rankings, notes } = finalizeRankings(wire, ctx);

  const gapsNoted = [
    ...[...missing].map((key) => {
      const [ticker, skill] = key.split(":") as [string, LensSkill];
      return `${ticker} × ${PUBLIC_LENS_LABEL(skill)} errored — treated as neutral in scoring.`;
    }),
    ...notes,
  ];

  return {
    runId: opts.runId,
    generatedAt: opts.generatedAt,
    marketOverview: FIXTURE_MARKET_CONTEXT,
    methodologyNote:
      "DEMO FIXTURE — seeded data for UI preview, produced without any model calls. Scores follow the Trillion-Dollar Confluence rubric arithmetic exactly; see /methodology. Nothing here is investment advice.",
    gapsNoted,
    rankings,
  };
}

/* ============================================================================
 * Activity feeds (fixture event log + mock runs)
 * ========================================================================== */

export const FIXTURE_DISCOVERY_ACTIVITIES = [
  'Searching: "secular waves 2026 underappreciated small cap"',
  'Searching: "next trillion dollar companies candidates"',
  "Reading fool.com",
  'Searching: "AI datacenter power demand small cap beneficiaries"',
  'Searching: "direct-to-cell satellite carrier agreements"',
  "Reading spacenews.com",
  'Searching: "warehouse automation backlog growth"',
  'Searching: "quantum computing export controls procurement"',
  "Reading sec.gov",
  "Opening the research playbook",
];

export function fixtureCellActivities(skill: LensSkill, ticker: string): string[] {
  switch (skill) {
    case "stock-scanner":
      return [
        `Searching: "${ticker} stock price 52 week range"`,
        `Searching: "${ticker} Piotroski F-Score Altman Z"`,
        "Reading stockanalysis.com",
        `Searching: "${ticker} insider buying earnings revisions"`,
        "Running: python reverse_dcf.py",
      ];
    case "gt-predictor":
      return [
        "Opening the research playbook",
        `Searching: "${ticker} sector policy geopolitical drivers"`,
        `Searching: "current fed policy direction real yields"`,
        "Reading the prediction log",
      ];
    case "institutional-forecast":
      return [
        `Searching: "Goldman Sachs ${ticker} price target 2026"`,
        `Searching: "JPMorgan ${ticker} forecast 2026"`,
        `Searching: "${ticker} price target raised OR cut 2026"`,
        "Reading marketbeat.com",
      ];
  }
}

/** Full ordered event log for the fixture run (timestamps spaced backward from `end`). */
export function buildFixtureEventLog(count: number, report: CompiledReport, end: Date): ProgressEvent[] {
  const events: ProgressEvent[] = [];
  const seeds = FIXTURE_SEEDS.slice(0, Math.min(count, FIXTURE_SEEDS.length));
  const totalMs = 18 * 60_000;
  const start = new Date(end.getTime() - totalMs);
  let cursor = start.getTime();
  const tick = (ms: number) => {
    cursor += ms;
    return new Date(cursor).toISOString();
  };

  events.push({ type: "stage_start", stage: "discovery", at: tick(0) });
  for (const a of FIXTURE_DISCOVERY_ACTIVITIES) {
    events.push({ type: "discovery_activity", activity: a, at: tick(25_000) });
  }
  events.push({
    type: "discovery_complete",
    marketContext: FIXTURE_MARKET_CONTEXT,
    candidates: fixtureCandidates(count),
    at: tick(30_000),
  });

  events.push({ type: "stage_start", stage: "analysis", at: tick(2_000) });
  for (const seed of seeds) {
    for (const skill of LENS_SKILLS) {
      events.push({ type: "lens_status", ticker: seed.ticker, skill, status: "queued", at: tick(100) });
    }
  }
  for (const seed of seeds) {
    for (const skill of LENS_SKILLS) {
      const analysis = fixtureLensAnalysis(seed, skill);
      events.push({ type: "lens_status", ticker: seed.ticker, skill, status: "running", at: tick(4_000) });
      for (const a of fixtureCellActivities(skill, seed.ticker)) {
        events.push({ type: "lens_status", ticker: seed.ticker, skill, status: "running", activity: a, at: tick(6_000) });
      }
      events.push({
        type: "lens_status",
        ticker: seed.ticker,
        skill,
        status: "done",
        verdict: analysis.verdict,
        confidence: analysis.confidence,
        headline: headlineOf(analysis),
        at: tick(5_000),
      });
    }
  }

  events.push({ type: "stage_start", stage: "compile", at: tick(2_000) });
  events.push({ type: "compile_activity", activity: `Scoring ${seeds.length} candidates against the confluence rubric…`, at: tick(8_000) });
  events.push({ type: "compile_activity", activity: "Verifying gate + score arithmetic…", at: tick(60_000) });
  events.push({ type: "run_complete", report, totalCostUsd: fixtureTotalCost(count), at: tick(20_000) });
  return events;
}

function headlineOf(a: LensAnalysis): string {
  return lensHeadline(a.skill, a.keyMetrics);
}

export function fixtureCellCost(index: number): number {
  return Math.round((0.18 + (index % 5) * 0.06) * 100) / 100;
}

export function fixtureTotalCost(count: number): number {
  let total = 1.12 + 0.71; // discovery + compile
  for (let i = 0; i < count * 3; i++) total += 0.18 + (i % 5) * 0.06;
  return Math.round(total * 100) / 100;
}
