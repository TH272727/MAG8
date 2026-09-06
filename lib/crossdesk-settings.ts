import {
  boolSetting,
  createSettingsRegistry,
  numSetting,
  type SettingSource,
  type SettingSpec,
} from "./settings-registry";

/* ============================================================================
 * The Cross-Desk Ledger — settings registry & resolver.
 *
 * Same contract as every other desk here: nothing is hard-coded, each knob
 * carries its reasoning, and /admin and /methodology render the SAME effective
 * values from this one source. Precedence is DB > env > default.
 *
 * There are few knobs because there is little to tune. The ledger stores
 * nothing and computes nothing of its own — it reads what four desks already
 * decided and reports where they overlap. These dials govern presentation and
 * the one real judgement call: how many desks make a crossing.
 * ========================================================================== */

export type CrossdeskSettingGroupKey = "crossing" | "display";

export const CROSSDESK_SETTING_GROUPS: {
  key: CrossdeskSettingGroupKey;
  title: string;
  note: string;
}[] = [
  {
    key: "crossing",
    title: "What counts as a crossing",
    note:
      "The desks were built to look at different things, and two of them draw from the same weekly screen, so " +
      "agreement between them is partly shared plumbing rather than four independent opinions. Requiring more " +
      "desks makes a crossing rarer and stronger; requiring fewer turns this page back into four lists side by " +
      "side.",
  },
  {
    key: "display",
    title: "What is shown",
    note:
      "A company one desk named is not a rejection, and a company a desk examined and STOPPED is a finding of " +
      "its own. Both are kept, counted and labelled rather than filtered away, because a page that shows only " +
      "agreement teaches a reader that agreement is the normal case.",
  },
];

const num = numSetting<CrossdeskSettingGroupKey>;
const bool = boolSetting<CrossdeskSettingGroupKey>;

export const CROSSDESK_SETTINGS_SPEC: SettingSpec<CrossdeskSettingGroupKey>[] = [
  num({
    key: "minDesks",
    label: "Desks that must name a company",
    group: "crossing",
    envVar: "MAG8_CROSSDESK_MIN_DESKS",
    default: 2,
    min: 1,
    max: 3,
    step: 1,
    unit: "desks",
    integer: true,
    blurb:
      "How many independent desks must name the same company before it is listed as a crossing. Three desks " +
      "can name a company here — the weekly board, the insider scanner and the bottleneck desk — so a setting " +
      "of three is a demand for unanimity and will usually return nothing at all. Two is the default because " +
      "one desk agreeing with another is the smallest fact this page can honestly report.",
    cites: ["Sullivan, Timmermann & White 1999"],
  }),
  num({
    key: "minThemes",
    label: "Bottleneck themes that must name a company",
    group: "crossing",
    envVar: "MAG8_CROSSDESK_MIN_THEMES",
    default: 2,
    min: 2,
    max: 7,
    step: 1,
    unit: "themes",
    integer: true,
    blurb:
      "A company can also cross by being named in more than one of the bottleneck desk's industries — a " +
      "power producer that is both a grid supplier and a nuclear operator, say. This is a genuinely weaker " +
      "fact than two desks agreeing, because it is one desk's method applied twice rather than two methods " +
      "arriving at the same place, so these rows are listed but always rank below a desk crossing. Where the " +
      "two industries lean on the SAME constrained input, that is one constraint appearing twice and the row " +
      "says so.",
    cites: [],
  }),
  bool({
    key: "requireMeasured",
    label: "Require at least one measured claim",
    group: "crossing",
    envVar: "MAG8_CROSSDESK_REQUIRE_MEASURED",
    default: false,
    blurb:
      "With this on, a company must have at least one desk that actually computed a figure about it, rather " +
      "than only appearing on hand-maintained lists. It is off by default because being named as the supplier " +
      "of an input that is measurably tightening is a real observation, and the page already labels which half " +
      "of that claim was measured and which was curated.",
    cites: [],
  }),
  bool({
    key: "showStopped",
    label: "Show companies a desk examined and stopped",
    group: "display",
    envVar: "MAG8_CROSSDESK_SHOW_STOPPED",
    default: true,
    blurb:
      "The insider scanner works companies up and rejects most of them, with a stated reason. Keeping those " +
      "visible is what stops this page from reading as a shortlist: a company two desks named and one desk " +
      "rejected on its balance sheet is more informative than the same company shown with the rejection hidden.",
    cites: [],
  }),
  num({
    key: "maxRows",
    label: "Most crossings listed",
    group: "display",
    envVar: "MAG8_CROSSDESK_MAX_ROWS",
    default: 60,
    min: 10,
    max: 250,
    step: 10,
    unit: "rows",
    integer: true,
    blurb:
      "An upper bound on the table, so a future desk that names several hundred companies cannot turn this " +
      "page into a dump. The count of everything found is always printed above the table, so a truncated list " +
      "says it is truncated.",
    cites: [],
  }),
];

export interface CrossdeskSettings {
  minDesks: number;
  minThemes: number;
  requireMeasured: boolean;
  showStopped: boolean;
  maxRows: number;
}

export type CrossdeskSettingKey = keyof CrossdeskSettings;

const registry = createSettingsRegistry<CrossdeskSettingGroupKey, CrossdeskSettings>({
  spec: CROSSDESK_SETTINGS_SPEC,
  storageKey: "crossdesk_settings",
});

export interface EffectiveCrossdeskSettings {
  values: CrossdeskSettings;
  sources: Record<CrossdeskSettingKey, SettingSource>;
}

export const cleanCrossdeskOverrides = registry.clean;
export const effectiveCrossdeskSettings = registry.effective;
export const crossdeskSettings = registry.values;
export const baselineCrossdeskSettings = registry.baseline;
export const saveCrossdeskOverrides = registry.save;
export const saveCrossdeskDiff = registry.saveDiff;

/**
 * Env-only kill switch, checked per call and supreme over every other knob —
 * the same shape as MAG8_ROTATION=0. With the ledger off the page reports
 * itself unavailable rather than rendering an empty table that would read as
 * "no desk agrees with any other".
 */
export function crossdeskEnabled(): boolean {
  return process.env.MAG8_CROSSDESK !== "0";
}
