import {
  boolSetting,
  createSettingsRegistry,
  numSetting,
  type SettingSource,
  type SettingSpec,
} from "./settings-registry";

/* ============================================================================
 * The evidence layer — settings registry & resolver.
 *
 * Same contract as the Stage-0 screen and the Bottleneck desk: nothing is
 * hard-coded at its use site, every knob carries its reasoning, and /admin and
 * /methodology render the SAME effective values from this one source.
 * Precedence is DB > env > default.
 *
 * What this layer is: a deterministic, keyless, $0 fetch of material a company
 * or an official body has ITSELF published, frozen once a week and handed to
 * the research stages as reference data. It looks things up so the analysis
 * does not have to spend its budget doing so, and it never interprets them.
 *
 * What lives elsewhere: which feeds to read and which handle belongs to which
 * ticker are catalogue data (lib/reach/catalog.ts), because they change with
 * the world rather than with operator preference. These are the dials.
 * ========================================================================== */

export type ReachSettingGroupKey = "filings" | "feeds" | "ecosystem" | "ops";

export const REACH_SETTING_GROUPS: { key: ReachSettingGroupKey; title: string; note: string }[] = [
  {
    key: "filings",
    title: "Company primary sources",
    note:
      "What a company has itself filed, dated and linkable. This is the highest-coverage evidence available " +
      "here — every US-listed name has it — and it is handed to the analysis as citable links rather than " +
      "left to be searched for. Nothing here is interpreted: a filing is listed, never summarised.",
  },
  {
    key: "feeds",
    title: "Official releases",
    note:
      "Dated publications from the bodies whose decisions the macro thesis turns on — central banks and " +
      "statistical agencies. The same rule applies: the release is listed with its date and link, and what " +
      "it means is the analysis's job, not this layer's.",
  },
  {
    key: "ecosystem",
    title: "Developer ecosystem",
    note:
      "Public open-source activity for the minority of candidates that have any. Measured coverage on this " +
      "universe is roughly one name in seven, so this is offered as evidence where it exists and is silent " +
      "everywhere else. An organisation with no public repositories is reported as not measured, never as a " +
      "weak reading — an absence of data is not a low score.",
  },
  {
    key: "ops",
    title: "Operational",
    note:
      "Fetch budgets. Every source here is fail-open: a dead one degrades the reference block and never " +
      "breaks a run, and a week with no snapshot at all behaves exactly as before this layer existed.",
  },
];

const num = numSetting<ReachSettingGroupKey>;
const bool = boolSetting<ReachSettingGroupKey>;

export const REACH_SETTINGS_SPEC: SettingSpec<ReachSettingGroupKey>[] = [
  /* ---- Company primary sources ---- */
  num({
    key: "filingsLookbackDays",
    label: "Filing window",
    group: "filings",
    envVar: "MAG8_REACH_FILINGS_DAYS",
    default: 180,
    min: 30,
    max: 730,
    step: 30,
    unit: "days",
    integer: true,
    blurb:
      "How far back to list a company's own filings. Six months covers two quarterly reports plus the events " +
      "between them, which is the span over which a thesis actually changes. Going wider mostly adds filings " +
      "too old to bear on a current view while crowding the reference block.",
    cites: [],
  }),
  num({
    key: "maxFilingsPerCandidate",
    label: "Filings listed per company",
    group: "filings",
    envVar: "MAG8_REACH_MAX_FILINGS",
    default: 6,
    min: 1,
    max: 20,
    step: 1,
    unit: "filings",
    integer: true,
    blurb:
      "A cap on the list, newest first. This block is spent from the same per-call budget as the analysis " +
      "itself, so length is a real cost: six recent filings orient the research without displacing it.",
    cites: [],
  }),
  bool({
    key: "flagOfferings",
    label: "Count registration and prospectus filings",
    group: "filings",
    envVar: "MAG8_REACH_FLAG_OFFERINGS",
    default: true,
    blurb:
      "Reports how many registration or prospectus filings a company made in the window — a direct, filed " +
      "record of capital raising. It complements the screen's share-count check, which is disclosed as " +
      "contaminated by splits and acquisitions and is therefore off by default. This one is not: a filed " +
      "registration is an unambiguous act. It is stated as a count, never scored.",
    cites: [],
  }),

  /* ---- Official releases ---- */
  num({
    key: "feedLookbackDays",
    label: "Release window",
    group: "feeds",
    envVar: "MAG8_REACH_FEED_DAYS",
    default: 21,
    min: 3,
    max: 90,
    step: 1,
    unit: "days",
    integer: true,
    blurb:
      "How recent an official release must be to be listed. Three weeks spans a full cycle of scheduled " +
      "statistical publications without reaching back into material the market has already absorbed.",
    cites: [],
  }),
  num({
    key: "maxFeedItems",
    label: "Releases listed",
    group: "feeds",
    envVar: "MAG8_REACH_MAX_FEED_ITEMS",
    default: 8,
    min: 1,
    max: 30,
    step: 1,
    unit: "releases",
    integer: true,
    blurb:
      "A cap across all sources combined, newest first. Same budget logic as the filing cap — this block is " +
      "shared by every candidate in a week, so it earns its length once and pays for it many times.",
    cites: [],
  }),

  /* ---- Developer ecosystem ---- */
  bool({
    key: "ecosystemEnabled",
    label: "Read public developer activity",
    group: "ecosystem",
    envVar: "MAG8_REACH_ECOSYSTEM",
    default: true,
    blurb:
      "On for the resolved minority, silent for everyone else. Turning it off removes the block entirely " +
      "rather than substituting a blank one.",
    cites: [],
  }),
  num({
    key: "ecosystemMinRepos",
    label: "Repositories before a reading counts",
    group: "ecosystem",
    envVar: "MAG8_REACH_MIN_REPOS",
    default: 1,
    min: 1,
    max: 25,
    step: 1,
    unit: "repositories",
    integer: true,
    blurb:
      "Below this, the organisation is reported as not measured. Several companies here hold a registered " +
      "handle with nothing published under it; reading that emptiness as low developer traction would be a " +
      "confident wrong answer, when the honest one is that nothing was measured.",
    cites: [],
  }),

  /* ---- Operational ---- */
  num({
    key: "fetchTimeoutMs",
    label: "Per-request timeout",
    group: "ops",
    envVar: "MAG8_REACH_TIMEOUT_MS",
    default: 15_000,
    min: 2_000,
    max: 60_000,
    step: 1_000,
    scale: 1_000,
    unit: "seconds",
    integer: true,
    blurb:
      "How long any one source gets before it is abandoned for the week. A slow source costs a snapshot " +
      "section; it never costs a run.",
    cites: [],
  }),
];

export interface ReachSettings {
  filingsLookbackDays: number;
  maxFilingsPerCandidate: number;
  flagOfferings: boolean;
  feedLookbackDays: number;
  maxFeedItems: number;
  ecosystemEnabled: boolean;
  ecosystemMinRepos: number;
  fetchTimeoutMs: number;
}

export type ReachSettingKey = keyof ReachSettings;

const registry = createSettingsRegistry<ReachSettingGroupKey, ReachSettings>({
  spec: REACH_SETTINGS_SPEC,
  storageKey: "reach_settings",
});

export interface EffectiveReachSettings {
  values: ReachSettings;
  sources: Record<ReachSettingKey, SettingSource>;
}

export const cleanReachOverrides = registry.clean;
export const effectiveReachSettings = registry.effective;
export const reachSettings = registry.values;
export const baselineReachSettings = registry.baseline;
export const saveReachOverrides = registry.save;
export const saveReachDiff = registry.saveDiff;

/**
 * Supreme kill switch, env-only and read per call — the same shape as
 * MAG8_UNIVERSE and MAG8_ROTATION. Off means no snapshot is taken and no
 * reference block is built; runs behave exactly as they did before this layer.
 */
export const reachEnabled = (): boolean => process.env.MAG8_REACH !== "0";
