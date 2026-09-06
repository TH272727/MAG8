import { crossdeskEnabled, crossdeskSettings, type CrossdeskSettings } from "../crossdesk-settings";
import {
  bottleneckClaims,
  insiderClaims,
  pipelineClaims,
  sectorContexts,
  universeFacts,
  type DeskAvailability,
  type DeskClaim,
} from "./claims";
import { buildLedger, summarize, type LedgerRow, type LedgerSummary } from "./score";

/* ============================================================================
 * The Cross-Desk Ledger — where four desks name the same company.
 *
 * readLedger() NEVER touches the network and NEVER writes. It stores nothing
 * of its own: no table, no snapshot, no cached ranking. Every row is derived,
 * on read, from data the four desks already hold, which means the ledger
 * cannot drift from them and updates the moment any one of them refreshes.
 *
 * That is also why the visitor's own risk tolerance can move this page for
 * free: the insider desk re-derives its whole funnel on read, so asking it
 * the same question under a different tolerance costs one more pass over
 * stored bytes and no fetches at all.
 * ========================================================================== */

export interface Ledger {
  /** Companies named by at least `minDesks` desks, best crossing first. */
  crossed: LedgerRow[];
  /** Named by fewer. Kept and counted; never presented as a rejection. */
  single: LedgerRow[];
  /** How many companies were named at all, across every desk. */
  totalNamed: number;
  pairs: LedgerSummary["pairs"];
  /** Companies named by more than one bottleneck theme. */
  multiTheme: number;
  /** Of those, how many lean on the same constrained input in both industries. */
  sharedConstraint: number;
  availability: DeskAvailability[];
  settings: CrossdeskSettings;
  /** Which insider risk tolerance produced this reading. */
  profileKey: string;
  universeWeek: string | null;
  /** Truncated to the row cap; the full count is `crossed.length`. */
  shown: LedgerRow[];
  truncated: boolean;
  disabled: boolean;
  flags: string[];
}

export function readLedger(opts: { profile?: string | null } = {}): Ledger {
  const settings = crossdeskSettings();

  const empty: Ledger = {
    crossed: [],
    single: [],
    totalNamed: 0,
    multiTheme: 0,
    sharedConstraint: 0,
    pairs: [],
    availability: [],
    settings,
    profileKey: "house",
    universeWeek: null,
    shown: [],
    truncated: false,
    disabled: false,
    flags: [],
  };
  if (!crossdeskEnabled()) return { ...empty, disabled: true };

  const pipeline = pipelineClaims();
  const insider = insiderClaims(opts.profile ?? null);
  const bottleneck = bottleneckClaims();
  const rotation = sectorContexts();
  const facts = universeFacts();

  let claims: DeskClaim[] = [...pipeline.claims, ...insider.claims, ...bottleneck.claims];
  if (!settings.showStopped) {
    claims = claims.filter((c) => c.chip !== "STOPPED");
  }

  const tickers = [...new Set(claims.map((c) => c.ticker.trim().toUpperCase()))];
  const factMap = new Map<string, { name: string; sector: string; cap: number }>();
  for (const t of tickers) {
    const row = facts.rows.get(t);
    if (row) factMap.set(t, { name: row.n, sector: row.s, cap: row.c });
  }

  const rows = buildLedger({
    claims,
    facts: factMap,
    eligible: facts.eligible,
    flags: facts.flagsFor(tickers),
    contexts: rotation.bySector,
  });

  const filtered = settings.requireMeasured ? rows.filter((r) => r.measuredDesks >= 1) : rows;
  const summary = summarize(filtered, settings.minDesks, settings.minThemes);

  const flags: string[] = [];
  if (facts.reason) flags.push(facts.reason);
  for (const a of [pipeline.availability, insider.availability, bottleneck.availability, rotation.availability]) {
    if (!a.ok && a.reason) flags.push(a.reason);
  }
  const naming = [pipeline.availability, insider.availability, bottleneck.availability].filter((a) => a.ok);
  if (naming.length < 2) {
    flags.push(
      "Fewer than two desks have anything on file, so there is nothing for this page to cross. It is reporting an " +
        "absence of data, not an absence of agreement.",
    );
  }

  return {
    crossed: summary.crossed,
    single: summary.single,
    totalNamed: summary.totalNamed,
    multiTheme: summary.multiTheme,
    sharedConstraint: summary.sharedConstraint,
    pairs: summary.pairs,
    availability: [
      pipeline.availability,
      insider.availability,
      bottleneck.availability,
      rotation.availability,
    ],
    settings,
    profileKey: insider.profileKey,
    universeWeek: facts.weekKey,
    shown: summary.crossed.slice(0, settings.maxRows),
    truncated: summary.crossed.length > settings.maxRows,
    disabled: false,
    flags,
  };
}

export type { LedgerRow } from "./score";
export type { DeskClaim, DeskKey, SectorContext } from "./claims";
