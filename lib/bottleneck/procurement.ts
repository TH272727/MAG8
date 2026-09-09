import { getAppSettingJson, setAppSettingJson } from "../db";
import type { Playbook } from "./playbook";
import {
  coverage,
  fiscalYearOf,
  linkRecipients,
  obligationsByYear,
  obligationTrend,
  recipientsForYear,
  type CoverageReading,
  type LinkedRecipient,
  type ObligationSeries,
  type ObligationTrend,
} from "./usaspending";

/* ============================================================================
 * Procurement evidence — what the government committed, beside the gap.
 *
 * The desk's own arithmetic asks whether the money the suppliers are spending
 * can buy the physical things it implies. This asks a question the desk could
 * not previously answer at all: is the hand-kept list of who supplies this
 * input actually right?
 *
 * That list — a theme's `owners[].tickers` — is the one thing on the desk that
 * nothing measures. The cross-desk ledger labels it `curated` for exactly that
 * reason. Where the buyer is the federal government, the award record settles
 * it, and it settles it in both directions: which of the named companies really
 * hold contracts, and which of the largest recipients the list does not name.
 *
 * The second direction is usually the more useful. Under the unmanned-aircraft
 * code, the biggest recipients are primes and private companies — which is not
 * a flaw in the owner map but a measurement of how much of the theme a reader
 * can actually buy, and the desk had no way of stating that before.
 *
 * STORED, NOT FETCHED ON READ. The page must never reach the network, so a
 * refresh writes a snapshot and the page reads it — the same split every desk
 * here runs on. It lives in one `app_settings` key per playbook rather than a
 * table, because it is one small document per theme and a new table for that
 * would be a migration in exchange for nothing.
 * ========================================================================== */

const key = (playbookId: string) => `bottleneck_procurement_${playbookId}`;

export interface ProcurementSnapshot {
  takenAt: string;
  playbookId: string;
  /** The conversion-factor category these codes correspond to. */
  category: string;
  codeLabels: string[];
  note: string;
  sourceUrl: string;
  obligations: ObligationSeries;
  trend: ObligationTrend | null;
  /** The fiscal year the recipient list describes. */
  recipientYear: number;
  recipientYearPartial: boolean;
  recipients: LinkedRecipient[];
  /** Sum of the recipients listed — NOT the total for the code. */
  listedTotalUsd: number;
  /** How many recipients were asked for; absence below this is absence FROM THIS LIST. */
  recipientLimit: number;
  coverage: CoverageReading;
  /** Every ticker the theme's owner map names for this category. */
  curatedTickers: string[];
  unavailable: string | null;
}

/**
 * Read the government's own record for one theme.
 *
 * Fetches. Fail-open throughout: an unreachable source produces a snapshot that
 * says so rather than an exception, and — the rule this desk already learned
 * the expensive way — a reading in which NOTHING was read is never stored over
 * a good one.
 */
export async function refreshProcurement(
  pb: Playbook,
  opts: { timeoutMs: number; dryRun?: boolean; years?: number; recipientLimit?: number; now?: Date } = {
    timeoutMs: 30_000,
  },
): Promise<ProcurementSnapshot | null> {
  const p = pb.procurement;
  if (!p) return null;

  const now = opts.now ?? new Date();
  const currentFy = fiscalYearOf(now);
  const span = opts.years ?? 8;
  const recipientLimit = opts.recipientLimit ?? 50;

  const obligations = await obligationsByYear(p.codes, {
    fromYear: currentFy - span + 1,
    toYear: currentFy,
    timeoutMs: opts.timeoutMs,
    now,
  });

  // The recipient list is taken from the most recent year that has ANY data,
  // preferring a complete one: a fiscal year three weeks old has almost nothing
  // in it, and a list of its handful of early awards would misrepresent who
  // supplies the theme.
  const complete = obligations.years.filter((y) => !y.partial);
  const recipientYear =
    complete.length > 0 ? complete[complete.length - 1].fiscalYear : (obligations.years.at(-1)?.fiscalYear ?? currentFy);

  const list = await recipientsForYear(p.codes, {
    fiscalYear: recipientYear,
    limit: recipientLimit,
    timeoutMs: opts.timeoutMs,
    now,
  });

  const curatedTickers = pb.owners.filter((o) => o.category === p.category).flatMap((o) => o.tickers);
  const linked = linkRecipients(list.recipients, p.aliases);

  const snapshot: ProcurementSnapshot = {
    takenAt: now.toISOString(),
    playbookId: pb.id,
    category: p.category,
    codeLabels: p.codes.map((c) => c.label),
    note: p.note,
    sourceUrl: p.sourceUrl,
    obligations,
    trend: obligationTrend(obligations),
    recipientYear,
    recipientYearPartial: list.partial,
    recipients: linked,
    listedTotalUsd: list.listedTotalUsd,
    recipientLimit,
    coverage: coverage(linked, curatedTickers),
    curatedTickers: [...new Set(curatedTickers.map((t) => t.toUpperCase()))].sort(),
    unavailable: obligations.unavailable ?? list.unavailable,
  };

  // Nothing read, nothing stored. A snapshot with no years and no recipients
  // would blank a good one, and this desk has already had a transient outage
  // overwrite a live reading with zeros once.
  const readSomething = obligations.years.length > 0 || linked.length > 0;
  if (!opts.dryRun && readSomething) setAppSettingJson(key(pb.id), snapshot);
  return snapshot;
}

/** The stored snapshot for one theme. NEVER networks. */
export function readProcurement(playbookId: string): ProcurementSnapshot | null {
  const raw = getAppSettingJson(key(playbookId));
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Partial<ProcurementSnapshot>;
  // Shape-checked rather than trusted: this key is written by one code path
  // today, and a stored document outlives the code that wrote it.
  if (typeof s.takenAt !== "string" || !Array.isArray(s.recipients) || !s.obligations) return null;
  return s as ProcurementSnapshot;
}

export function clearProcurement(playbookId: string): void {
  setAppSettingJson(key(playbookId), null);
}

/* ----------------------------------------------------------------------------
 * Sentences, computed
 * -------------------------------------------------------------------------- */

const usd = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
};

export { usd as formatObligation };

/**
 * The one-line reading, with every qualifier that makes it true.
 *
 * Deliberately verbose about the fiscal year: a reader comparing a federal
 * October-to-September figure against a company's calendar-year capital
 * spending without being told is comparing two different twelve-month periods.
 */
export function describeProcurement(s: ProcurementSnapshot): string {
  if (s.unavailable) return `Federal award records could not be read: ${s.unavailable}`;
  if (!s.trend) {
    const latest = s.obligations.years.at(-1);
    return latest
      ? `${usd(latest.amountUsd)} obligated in FY${latest.fiscalYear}${latest.partial ? ", a year still running" : ""}. ` +
          `Too few complete years on record to state a change.`
      : `No obligations on record under these codes.`;
  }
  const dir = s.trend.changePct >= 0 ? "up" : "down";
  return (
    `${usd(s.trend.latest.amountUsd)} obligated in FY${s.trend.latest.fiscalYear}, ` +
    `${dir} ${Math.abs(s.trend.changePct).toFixed(1)}% on FY${s.trend.prior.fiscalYear}` +
    (s.trend.partial ? " — one of those years is still running, so the comparison is incomplete" : "")
  );
}

/**
 * What the award record says about the theme's hand-kept owner list.
 *
 * The absence sentence is worded precisely. A company missing from the top
 * `recipientLimit` recipients has no LARGE award under these codes; it has not
 * been shown to have none at all, and saying otherwise would be a claim the
 * data does not support.
 */
export function describeCoverage(s: ProcurementSnapshot): string[] {
  if (s.unavailable || s.recipients.length === 0) return [];
  const out: string[] = [];
  const c = s.coverage;

  if (c.tickers.length > 0) {
    out.push(
      `${c.tickers.join(", ")} appear in the award records under these codes, holding ${usd(c.linkedUsd)} of the ` +
        `${usd(s.listedTotalUsd)} across the ${s.recipients.length} largest recipients in FY${s.recipientYear}` +
        (c.linkedSharePct === null ? "" : ` — ${c.linkedSharePct.toFixed(1)}% of it`) +
        `.`,
    );
  } else if (s.curatedTickers.length > 0) {
    out.push(
      `None of the companies this theme names appear among the ${s.recipients.length} largest recipients under ` +
        `these codes in FY${s.recipientYear}.`,
    );
  }

  if (c.absentTickers.length > 0 && c.tickers.length > 0) {
    out.push(
      `${c.absentTickers.join(", ")} ${c.absentTickers.length === 1 ? "is" : "are"} named by the theme but hold no ` +
        `award among those ${s.recipients.length} — which means no LARGE award under these codes, not none at all.`,
    );
  }

  if (c.unlinkedLeaders.length > 0) {
    const lead = c.unlinkedLeaders.slice(0, 4).map((r) => `${r.name} (${usd(r.amountUsd)})`);
    out.push(
      `The largest recipients this theme does not name: ${lead.join(", ")}. Most of the money under a federal ` +
        `product code goes to prime contractors and to private companies, so the share reaching a listed ` +
        `specialist is the honest size of what a reader can actually buy — not a flaw in the list.`,
    );
  }

  return out;
}
