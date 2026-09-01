import type { InsiderSettings } from "../insider-settings";

/* ============================================================================
 * Named risk tolerances — the reader's dial, applied on read.
 *
 * This exists because of the one thing the build document is emphatic about:
 * the pipeline should have no opinion about whose risk tolerance is right. The
 * operator's settings define what "the house view" means, and these three
 * profiles are ready-made departures from it that anybody can choose without
 * an account, a login, or a refetch.
 *
 * They are cheap because the scanner stores raw filings, closes and statements
 * and computes everything else on read: switching profile re-derives the whole
 * candidate list, including the reasons each rejected company failed, from
 * bytes already on disk.
 *
 * A profile overrides only the settings that ARE a risk preference. It never
 * touches the operational knobs, and it never touches the published thresholds
 * of the two financial filters, which are the literature's numbers rather than
 * anybody's taste.
 * ========================================================================== */

export type RiskProfileKey = "conservative" | "balanced" | "aggressive" | "house";

export interface RiskProfile {
  key: RiskProfileKey;
  label: string;
  /** One sentence a reader can decide from. */
  blurb: string;
  /** Empty for the house setting, which is whatever the operator configured. */
  overrides: Partial<InsiderSettings>;
}

export const RISK_PROFILES: RiskProfile[] = [
  {
    key: "house",
    label: "House settings",
    blurb:
      "Whatever this desk is currently configured with, published in full on the methodology page. Every " +
      "figure below is computed against these.",
    overrides: {},
  },
  {
    key: "conservative",
    label: "Conservative",
    blurb:
      "A shallow dip in a sound business. Narrow drawdown band, a recent high, a cluster of buyers rather " +
      "than one, a solvency score in the safe zone, and a wide cushion below the estimated value.",
    overrides: {
      minDrawdownPct: 5,
      maxDrawdownPct: 25,
      maxMonthsSinceHigh: 9,
      fallenAngelGuardPct: 50,
      requireStabilizing: true,
      minClusterInsiders: 2,
      minDollarValue: 250_000,
      requireOfficerOrDirector: true,
      fScoreFloor: 6,
      allowGreyZone: false,
      discountRatePct: 11,
      terminalGrowthPct: 2,
      minMarginOfSafetyPct: 40,
    },
  },
  {
    key: "balanced",
    label: "Balanced",
    blurb:
      "The example settings the build document used to make the idea concrete: a two to sixty percent fall " +
      "from a high set inside the last year, one insider or more, and a quarter off the estimated value.",
    overrides: {
      minDrawdownPct: 2,
      maxDrawdownPct: 60,
      maxMonthsSinceHigh: 12,
      fallenAngelGuardPct: 80,
      requireStabilizing: true,
      minClusterInsiders: 1,
      minDollarValue: 100_000,
      requireOfficerOrDirector: false,
      fScoreFloor: 4,
      allowGreyZone: true,
      discountRatePct: 9,
      terminalGrowthPct: 2.5,
      minMarginOfSafetyPct: 25,
    },
  },
  {
    key: "aggressive",
    label: "Aggressive",
    blurb:
      "Deep falls, including ones that have not stopped. The fallen-angel guard is off and the stabilisation " +
      "requirement is lifted, so this deliberately admits companies still falling — which is what somebody " +
      "hunting a bottom is asking for, and is the highest-risk setting here.",
    overrides: {
      minDrawdownPct: 10,
      maxDrawdownPct: 90,
      maxMonthsSinceHigh: 24,
      fallenAngelGuardPct: 0,
      requireStabilizing: false,
      minClusterInsiders: 1,
      minDollarValue: 50_000,
      requireOfficerOrDirector: false,
      fScoreFloor: 3,
      allowGreyZone: true,
      discountRatePct: 8,
      terminalGrowthPct: 3,
      minMarginOfSafetyPct: 10,
    },
  },
];

export const DEFAULT_PROFILE: RiskProfileKey = "house";

export function profileByKey(key: string | null | undefined): RiskProfile {
  return RISK_PROFILES.find((p) => p.key === key) ?? RISK_PROFILES[0];
}

/** The house settings with a profile's departures applied on top. */
export function applyProfile(settings: InsiderSettings, profile: RiskProfile): InsiderSettings {
  return { ...settings, ...profile.overrides };
}

/**
 * Which settings a profile actually changed, in plain language.
 *
 * Printed beside every list so the applied risk tolerance is never implicit —
 * the document's requirement that nothing has a hidden default buried inside
 * the pipeline.
 */
export function describeProfile(settings: InsiderSettings, profile: RiskProfile): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(profile.overrides)) {
    const current = settings[key as keyof InsiderSettings];
    if (current !== value) out.push(`${key}: ${String(current)} → ${String(value)}`);
  }
  return out;
}
