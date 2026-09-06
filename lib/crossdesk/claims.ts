import { getAllTimeBoard, latestUniverseSnapshot } from "../db";
import { sanitizeRankedStock } from "../public-view";
import { screenUniverse, universeScreenFlags, type UniverseRow } from "../universe";
import { universeSettings } from "../universe-settings";
import { allPlaybooks } from "../bottleneck/playbook";
import { scoreFromStored } from "../bottleneck/desk";
import { readScan } from "../insider/scanner";
import { readBoard } from "../rotation/board";
import { KNOWN_SECTORS, mapSector, sectorIndicatorId, type SectorMapping } from "./sectors";

/* ============================================================================
 * One adapter per desk. Every one reads stored bytes and nothing else — no
 * network, no writes, no model.
 *
 * The load-bearing idea of this file is that the desks do not all mean the
 * same thing when they name a company, so a claim carries its KIND:
 *
 *   measured  a desk computed a figure about THIS company. The pipeline's
 *             score, the insider desk's composite and the dollars actually
 *             filed.
 *
 *   curated   the company sits on a list somebody maintained by hand. The
 *             bottleneck desk's baskets and owner maps are exactly this, and
 *             calling it a measurement would be a lie — so the claim carries
 *             the MEASURED state of the constraint it is attached to instead,
 *             and the page prints both halves.
 *
 *   context   about the company's neighbourhood, never about the company. The
 *             rotation board trades funds; it cannot have an opinion on a
 *             single name and is never counted as one.
 *
 * Only measured and curated claims count towards agreement. Context does not,
 * and neither does simply passing the weekly screen: being eligible is the
 * price of entry to two of these desks, not evidence, and counting it would
 * hand every company a free point.
 * ========================================================================== */

export type DeskKey = "pipeline" | "insider" | "bottleneck" | "rotation";
export type ClaimKind = "measured" | "curated" | "context";

export interface DeskClaim {
  desk: DeskKey;
  kind: ClaimKind;
  ticker: string;
  /** What this desk found, in one line. */
  headline: string;
  /** The supporting figure, already formatted, or null. */
  detail: string | null;
  /**
   * Comparable strength WITHIN this desk, 0-100, or null when the desk does
   * not produce one. Never compared across desks except as a tie-break.
   */
  strength: number | null;
  href: string | null;
  /** A short label for the claim's own state, e.g. TIGHTENING or PASS. */
  chip: string | null;
  /**
   * The sub-source WITHIN a desk that made this claim — for the bottleneck
   * desk, the theme. A company named by two themes is a weaker fact than a
   * company named by two desks (it is one desk's method applied twice), but it
   * is a real one, so it is counted on its own axis rather than folded in.
   */
  group: string | null;
  /**
   * The specific constrained input, where there is one. Two themes naming a
   * company over the SAME input are one constraint appearing in two
   * industries; two themes naming it over different inputs are two. The page
   * has to be able to tell those apart.
   */
  constraint: string | null;
}

export interface DeskAvailability {
  desk: DeskKey;
  ok: boolean;
  /** Why this desk contributed nothing. Null when it did. */
  reason: string | null;
  /** Companies it named. */
  named: number;
}

/* ----------------------------------------------------------------------------
 * The pipeline's own board.
 * -------------------------------------------------------------------------- */

export function pipelineClaims(): { claims: DeskClaim[]; availability: DeskAvailability } {
  const board = getAllTimeBoard("canonical");

  // A board built from mock runs is a demonstration, not a reading. It must
  // never be presented as a desk agreeing with anything.
  if (board.demo) {
    return {
      claims: [],
      availability: {
        desk: "pipeline",
        ok: false,
        reason:
          "The weekly board has no completed run of its own yet, so the only rankings on file are the sample ones. Sample rankings are never counted here.",
        named: 0,
      },
    };
  }

  const claims: DeskClaim[] = board.entries.map((e) => {
    // Pipeline rows carry the research engine's own vocabulary in their free
    // text, so they cross the public boundary before they are shown.
    const stock = sanitizeRankedStock(e.best);
    return {
      desk: "pipeline" as const,
      kind: "measured" as const,
      ticker: e.ticker,
      headline: `Scored ${stock.finalScore.toFixed(1)} on the weekly board`,
      detail: stock.verdictLine,
      strength: stock.finalScore,
      href: `/stocks/${e.ticker}`,
      chip: stock.confluence ? "ALL THREE LENSES AGREE" : stock.gate.toUpperCase(),
      group: null,
      constraint: null,
    };
  });

  return {
    claims,
    availability: { desk: "pipeline", ok: true, reason: null, named: claims.length },
  };
}

/* ----------------------------------------------------------------------------
 * The insider scanner.
 * -------------------------------------------------------------------------- */

const USD = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`;

export function insiderClaims(profile: string | null): {
  claims: DeskClaim[];
  availability: DeskAvailability;
  profileKey: string;
} {
  const view = readScan({ profile });

  if (view.disabled || !view.asOf) {
    return {
      claims: [],
      profileKey: view.profile.key,
      availability: {
        desk: "insider",
        ok: false,
        reason: view.disabled
          ? "The insider scanner is switched off, so nothing it would have found is counted."
          : "The insider scanner has never been run, so there is nothing on file to cross against.",
        named: 0,
      },
    };
  }

  const claims: DeskClaim[] = [];
  // Ranked names first, then names the desk worked up and stopped — a stop is
  // a finding too, and burying it would let this page read as a shortlist.
  for (const c of [...view.ranked, ...view.rejected]) {
    const ranked = c.stopped.length === 0;
    const bought = c.cluster.totalBoughtUsd;
    claims.push({
      desk: "insider",
      kind: "measured",
      ticker: c.ticker,
      headline: ranked
        ? `Insiders bought ${USD(bought)} of their own stock and it cleared every filter`
        : `Insiders bought ${USD(bought)} of their own stock, but the desk stopped it`,
      detail: ranked
        ? `${c.cluster.distinctBuyers} buyer${c.cluster.distinctBuyers === 1 ? "" : "s"}, last on ${c.cluster.lastBuy}`
        : c.stopped[0],
      strength: ranked ? c.composite.score : null,
      href: `/insider/${c.ticker}`,
      chip: ranked ? (c.composite.complete ? "RANKED" : "RANKED · PARTIAL") : "STOPPED",
      group: null,
      constraint: null,
    });
  }

  return {
    claims,
    profileKey: view.profile.key,
    availability: { desk: "insider", ok: true, reason: null, named: claims.length },
  };
}

/* ----------------------------------------------------------------------------
 * The bottleneck desk. Curated membership, measured constraint.
 * -------------------------------------------------------------------------- */

const STATUS_WORD: Record<string, string> = {
  tightening: "tightening",
  easing: "easing",
  balanced: "holding steady",
  "insufficient-data": "not measured",
};

export function bottleneckClaims(): { claims: DeskClaim[]; availability: DeskAvailability } {
  const claims: DeskClaim[] = [];
  let themesRead = 0;

  for (const pb of allPlaybooks()) {
    const scored = scoreFromStored(pb);
    if (!scored) continue;
    themesRead++;
    const href = `/bottleneck?playbook=${pb.id}`;

    // Whoever supplies the constrained input. The membership is hand-kept; the
    // gap beside it is measured, and the sentence says which is which.
    for (const cat of scored.snapshot.categories) {
      if (!cat.owners) continue;
      const word = STATUS_WORD[cat.status] ?? cat.status;
      const gap =
        cat.gapPct === null
          ? null
          : `${cat.gapPct >= 0 ? "+" : ""}${cat.gapPct.toFixed(1)}pp between demand and supply growth`;
      for (const ticker of cat.owners.tickers) {
        claims.push({
          desk: "bottleneck",
          kind: "curated",
          ticker,
          // Labels are interpolated whole, never case-folded: "US-listed" and
          // "The build in land and homes under construction" are written by
          // the theme's author, and lowercasing them mangles both.
          headline: `Named among ${cat.owners.label} for ${pb.label}`,
          detail: `That input is ${word}${gap ? `, at ${gap}` : ""}.`,
          strength: null,
          href,
          chip: cat.status === "insufficient-data" ? "NOT MEASURED" : cat.status.toUpperCase(),
          group: pb.id,
          constraint: cat.key,
        });
      }
    }

    // And whoever is doing the spending that creates the constraint. A very
    // different claim from supplying it, so it is never merged with the above.
    for (const ticker of pb.demand.basket) {
      claims.push({
        desk: "bottleneck",
        kind: "curated",
        ticker,
        headline: `Counted in the ${pb.label} spending basket`,
        detail: `What the desk reads from it: ${pb.demand.measure}.`,
        strength: null,
        href,
        chip: "SPENDING SIDE",
        group: pb.id,
        // The basket is who does the spending, not a claim about one input.
        constraint: null,
      });
    }
  }

  if (themesRead === 0) {
    return {
      claims: [],
      availability: {
        desk: "bottleneck",
        ok: false,
        reason: "No theme on the desk has a stored reading yet, so it names nobody.",
        named: 0,
      },
    };
  }

  return {
    claims,
    availability: {
      desk: "bottleneck",
      ok: true,
      reason: null,
      named: new Set(claims.map((c) => c.ticker)).size,
    },
  };
}

/* ----------------------------------------------------------------------------
 * The rotation board — context only, attached by sector.
 * -------------------------------------------------------------------------- */

export interface SectorContext extends SectorMapping {
  indicatorId: string | null;
  score: number | null;
  tierLabel: string | null;
  directionLabel: string | null;
  /** The conditional history is not read here; the board's own page carries it. */
  href: string | null;
}

export function sectorContexts(): {
  bySector: Map<string, SectorContext>;
  availability: DeskAvailability;
} {
  const board = readBoard();
  if (board.disabled || !board.asOf) {
    return {
      bySector: new Map(),
      availability: {
        desk: "rotation",
        ok: false,
        reason: board.disabled
          ? "The rotation board is switched off, so no neighbourhood reading is shown."
          : "The rotation board has no stored prices yet, so no neighbourhood reading is shown.",
        named: 0,
      },
    };
  }

  const bySector = new Map<string, SectorContext>();
  for (const sector of KNOWN_SECTORS) {
    const mapping = mapSector(sector)!;
    if (!mapping.etf) {
      bySector.set(sector, {
        ...mapping,
        indicatorId: null,
        score: null,
        tierLabel: null,
        directionLabel: null,
        href: null,
      });
      continue;
    }
    const id = sectorIndicatorId(mapping.etf);
    const reading = board.readings.find((r) => r.id === id) ?? null;
    bySector.set(sector, {
      ...mapping,
      indicatorId: id,
      score: reading?.score ?? null,
      tierLabel: reading?.tier ?? null,
      directionLabel: reading?.directionLabel ?? null,
      href: reading ? `/rotation/${id}` : null,
    });
  }

  return {
    bySector,
    availability: { desk: "rotation", ok: true, reason: null, named: bySector.size },
  };
}

/* ----------------------------------------------------------------------------
 * The weekly screen — enrichment and cautions, never agreement.
 * -------------------------------------------------------------------------- */

export interface UniverseFacts {
  rows: Map<string, UniverseRow>;
  eligible: Set<string>;
  weekKey: string | null;
  /** Cautions the screen raises about specific companies, keyed by ticker. */
  flagsFor: (tickers: string[]) => Map<string, string[]>;
  reason: string | null;
}

/**
 * Read STRICTLY read-only, the same rule the insider scanner keeps: a public
 * page must never set off a market-wide screener fetch. This reads whatever
 * snapshot is already on file and says plainly when there is none.
 */
export function universeFacts(): UniverseFacts {
  const snapshot = latestUniverseSnapshot();
  const empty: UniverseFacts = {
    rows: new Map(),
    eligible: new Set(),
    weekKey: null,
    flagsFor: () => new Map(),
    reason:
      "No weekly screen is on file, so company names, sectors and sizes cannot be filled in and the screen raises no cautions.",
  };
  if (!snapshot) return empty;

  const settings = universeSettings();
  const screened = screenUniverse(snapshot.rows, snapshot.extras, settings);
  const rows = new Map(snapshot.rows.map((r) => [r.t.toUpperCase(), r]));

  return {
    rows,
    eligible: new Set(screened.eligible.map((r) => r.t.toUpperCase())),
    weekKey: snapshot.isoWeek,
    reason: null,
    flagsFor: (tickers: string[]) => {
      const lines = universeScreenFlags(
        tickers.map((t) => ({ ticker: t })),
        { rows: snapshot.rows, extras: snapshot.extras, settings },
      );
      const out = new Map<string, string[]>();
      for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx <= 0) continue;
        const ticker = line.slice(0, idx).trim().toUpperCase();
        const rest = line.slice(idx + 1).trim();
        out.set(ticker, [...(out.get(ticker) ?? []), rest]);
      }
      return out;
    },
  };
}
