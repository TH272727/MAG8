import type { InsiderOwner, InsiderTransactionRow } from "../db";
import { isOpenMarketSale, isQualifyingBuy, transactionValueUsd } from "./form4";

/* ============================================================================
 * From filed lines to a reading of conviction — pure.
 *
 * The premise this whole product rests on is that a corporate insider spending
 * their own money at the going price knows something a reader does not. The
 * evidence for that is real but narrow, and the scoring below is built around
 * what the research actually found rather than around the premise:
 *
 *  - PURCHASES carry information; sales do not. Insiders sell for a dozen
 *    reasons that have nothing to do with the business — a house, a divorce, a
 *    tax bill — and buy for one.
 *  - SEVERAL insiders buying is worth more than one buying a lot. A cluster is
 *    harder to explain away as a personal circumstance.
 *  - ROUTINE trading predicts nothing. Only opportunistic purchases carry
 *    signal, and a trade the filer affirms was arranged in advance cannot be a
 *    reaction to anything known today.
 *
 * So the reading discounts pre-arranged purchases rather than counting them
 * equally, rewards distinct buyers more steeply than dollars, and never lets
 * the absence of an affirmation stand in for its denial.
 * ========================================================================== */

export interface InsiderBuy {
  accession: string;
  line: number;
  date: string;
  filedDate: string;
  shares: number | null;
  price: number | null;
  valueUsd: number | null;
  planned: InsiderTransactionRow["planned"];
  owners: InsiderOwner[];
  /** Who to show: the first named owner, with the count where there are more. */
  ownerLabel: string;
  role: string;
  flags: string[];
}

export interface InsiderCluster {
  ticker: string;
  issuerCik: number;
  issuerName: string;

  buys: InsiderBuy[];
  /** Dollars of genuine open-market purchases, counted once per filing. */
  totalBoughtUsd: number;
  /** Purchases the filer affirmed were arranged in advance. */
  plannedBoughtUsd: number;
  /** Dollars on purchase lines filed without a readable price — excluded from the total. */
  unpricedBuys: number;

  /** Distinct people or entities that bought, across every filing in the window. */
  distinctBuyers: number;
  buyerNames: string[];
  anyOfficerOrDirector: boolean;
  anyChiefOfficer: boolean;
  anyTenPercentOwner: boolean;

  firstBuy: string;
  lastBuy: string;
  filings: number;

  /** The other side, for the falsification check. */
  totalSoldUsd: number;
  distinctSellers: number;

  /** 0-100. See scoreConviction. */
  conviction: number;
  convictionParts: { dollars: number; cluster: number; role: number; recency: number };
  flags: string[];
}

const CHIEF = /\bchief\b|\bC\.?E\.?O\b|\bC\.?F\.?O\b|\bpresident\b/i;

/** How an owner should be described in one phrase. */
function describeRole(owners: InsiderOwner[]): string {
  const titles = owners.map((o) => o.officerTitle).filter((t): t is string => Boolean(t));
  if (titles.length > 0) return titles[0];
  if (owners.some((o) => o.isDirector)) return "Director";
  if (owners.some((o) => o.isOfficer)) return "Officer";
  if (owners.some((o) => o.isTenPercentOwner)) return "10% owner";
  return "Insider";
}

function ownerLabel(owners: InsiderOwner[]): string {
  if (owners.length === 0) return "Unnamed";
  if (owners.length === 1) return owners[0].name;
  return `${owners[0].name} +${owners.length - 1}`;
}

export interface ConvictionWeights {
  /** The threshold the dollar reading is scaled against. */
  minDollarValue: number;
  /** Share of a pre-arranged purchase's dollar contribution that is removed, 0-100. */
  discountPlannedPct: number;
  /** Reference date for the recency reading. */
  now?: Date;
}

/**
 * A 0-100 reading of how convincing the buying looks. Four parts:
 *
 *   dollars   up to 40, on a logarithmic scale against the reader's own
 *             minimum, so ten times the threshold reaches full marks and a
 *             hundred times does not score any more than that. Size matters
 *             and matters with sharply diminishing returns: a figure that is
 *             meaningful for a director is trivial for a fund.
 *
 *   cluster   up to 30, on the number of DIFFERENT people buying. This rises
 *             faster than dollars because it is the part the research supports
 *             most strongly, and because one person buying a large amount has
 *             one explanation while four people buying has fewer.
 *
 *   role      up to 20, for buying by people who actually run the business
 *             rather than hold shares in it, with more for a named chief
 *             officer. An outside holder crossing five percent is making a
 *             portfolio decision.
 *
 *   recency   up to 10, decaying over the reader's own window. A purchase two
 *             months ago is a weaker statement about today than one last week.
 *
 * The dollar part is reduced by the pre-arranged share, so a company whose
 * entire buying was scheduled in advance scores as if it had bought much less.
 */
export function scoreConviction(
  c: Omit<InsiderCluster, "conviction" | "convictionParts">,
  w: ConvictionWeights,
  lookbackDays: number,
): { conviction: number; parts: InsiderCluster["convictionParts"] } {
  const now = w.now ?? new Date();

  const plannedShare = c.totalBoughtUsd > 0 ? c.plannedBoughtUsd / c.totalBoughtUsd : 0;
  const effectiveUsd = c.totalBoughtUsd * (1 - plannedShare * (w.discountPlannedPct / 100));
  const floor = Math.max(1, w.minDollarValue);
  // log(1 + x) against log(11): ten times the threshold reaches full marks.
  const dollars = Math.min(40, (Math.log10(1 + effectiveUsd / floor) / Math.log10(11)) * 40);

  const cluster = c.distinctBuyers >= 4 ? 30 : c.distinctBuyers === 3 ? 25 : c.distinctBuyers === 2 ? 20 : 10;

  const role = (c.anyOfficerOrDirector ? 12 : 0) + (c.anyChiefOfficer ? 8 : 0);

  const ageDays = Math.max(
    0,
    (now.getTime() - Date.parse(`${c.lastBuy}T00:00:00Z`)) / 86_400_000,
  );
  const recency = lookbackDays > 0 ? Math.max(0, 1 - ageDays / lookbackDays) * 10 : 0;

  const parts = {
    dollars: Math.round(dollars * 10) / 10,
    cluster,
    role,
    recency: Math.round(recency * 10) / 10,
  };
  return {
    conviction: Math.round((parts.dollars + parts.cluster + parts.role + parts.recency) * 10) / 10,
    parts,
  };
}

export interface ClusterOptions extends ConvictionWeights {
  lookbackDays: number;
  /** Only companies where at least this many different people bought. */
  minClusterInsiders: number;
  /** Only companies with at least this much bought in total. */
  minDollarValue: number;
  /** Require an officer or a director among the buyers. */
  requireOfficerOrDirector: boolean;
}

export interface ClusterOutcome {
  /** Companies meeting the reader's buying thresholds, most convincing first. */
  qualifying: InsiderCluster[];
  /** Companies with buying that did not meet them, and why. */
  rejected: { cluster: InsiderCluster; reasons: string[] }[];
}

/**
 * Group filed lines into one reading per company.
 *
 * Dollars are counted ONCE PER FILING, never once per reporting owner. A
 * jointly filed purchase was made once by a group, and multiplying it by the
 * number of filers would inflate the headline figure by exactly the factor that
 * makes a cluster look impressive. The distinct-buyer count does take every
 * named owner, because that is a different question.
 */
export function buildClusters(rows: InsiderTransactionRow[], o: ClusterOptions): ClusterOutcome {
  const byTicker = new Map<string, InsiderTransactionRow[]>();
  for (const r of rows) {
    if (!r.ticker) continue;
    const list = byTicker.get(r.ticker);
    if (list) list.push(r);
    else byTicker.set(r.ticker, [r]);
  }

  const clusters: InsiderCluster[] = [];
  for (const [ticker, lines] of byTicker) {
    const buyRows = lines.filter(isQualifyingBuy);
    if (buyRows.length === 0) continue;

    const buys: InsiderBuy[] = buyRows.map((r) => ({
      accession: r.accession,
      line: r.line,
      date: r.transactionDate,
      filedDate: r.filedDate,
      shares: r.shares,
      price: r.price,
      valueUsd: transactionValueUsd({ shares: r.shares, price: r.price }),
      planned: r.planned,
      owners: r.owners,
      ownerLabel: ownerLabel(r.owners),
      role: describeRole(r.owners),
      flags: r.flags,
    }));

    const priced = buys.filter((b) => b.valueUsd !== null);
    const totalBoughtUsd = priced.reduce((s, b) => s + b.valueUsd!, 0);
    const plannedBoughtUsd = priced
      .filter((b) => b.planned === "yes")
      .reduce((s, b) => s + b.valueUsd!, 0);

    const buyerCiks = new Map<string, InsiderOwner>();
    for (const b of buys) {
      for (const o of b.owners) buyerCiks.set(o.cik || o.name, o);
    }
    const owners = [...buyerCiks.values()];

    const sellRows = lines.filter(isOpenMarketSale);
    const sellerCiks = new Set<string>();
    for (const r of sellRows) for (const o of r.owners) sellerCiks.add(o.cik || o.name);

    const dates = buys.map((b) => b.date).filter(Boolean).sort();
    const flags: string[] = [];
    const unpricedBuys = buys.length - priced.length;
    if (unpricedBuys > 0) {
      flags.push(
        `${unpricedBuys} purchase line${unpricedBuys === 1 ? " was" : "s were"} filed without a readable ` +
          "price and contribute no dollars to the total, so the figure below understates the buying.",
      );
    }
    if (plannedBoughtUsd > 0) {
      const share = (plannedBoughtUsd / totalBoughtUsd) * 100;
      flags.push(
        `${share.toFixed(0)}% of the dollars bought were affirmed as made under a pre-arranged trading plan, ` +
          "so they were scheduled before anything known today and count for less.",
      );
    }
    if (sellRows.length > 0) {
      flags.push(
        `${sellerCiks.size} insider${sellerCiks.size === 1 ? "" : "s"} also sold in the open market during ` +
          "this window. Buying and selling at once is a weaker signal than buying alone.",
      );
    }

    const base = {
      ticker,
      issuerCik: buyRows[0].issuerCik,
      issuerName: buyRows[0].issuerName,
      buys,
      totalBoughtUsd,
      plannedBoughtUsd,
      unpricedBuys,
      distinctBuyers: buyerCiks.size,
      buyerNames: owners.map((x) => x.name),
      anyOfficerOrDirector: owners.some((x) => x.isOfficer || x.isDirector),
      anyChiefOfficer: owners.some((x) => x.officerTitle !== null && CHIEF.test(x.officerTitle)),
      anyTenPercentOwner: owners.some((x) => x.isTenPercentOwner),
      firstBuy: dates[0] ?? "",
      lastBuy: dates[dates.length - 1] ?? "",
      filings: new Set(buys.map((b) => b.accession)).size,
      totalSoldUsd: sellRows.reduce(
        (s, r) => s + (transactionValueUsd({ shares: r.shares, price: r.price }) ?? 0),
        0,
      ),
      distinctSellers: sellerCiks.size,
      flags,
    };

    const { conviction, parts } = scoreConviction(base, o, o.lookbackDays);
    clusters.push({ ...base, conviction, convictionParts: parts });
  }

  const qualifying: InsiderCluster[] = [];
  const rejected: ClusterOutcome["rejected"] = [];

  for (const c of clusters) {
    const reasons: string[] = [];
    if (c.totalBoughtUsd < o.minDollarValue) {
      reasons.push(
        `$${Math.round(c.totalBoughtUsd).toLocaleString("en-US")} of open-market buying, below the ` +
          `$${o.minDollarValue.toLocaleString("en-US")} required.`,
      );
    }
    if (c.distinctBuyers < o.minClusterInsiders) {
      reasons.push(
        `${c.distinctBuyers} insider${c.distinctBuyers === 1 ? "" : "s"} bought, below the ` +
          `${o.minClusterInsiders} required.`,
      );
    }
    if (o.requireOfficerOrDirector && !c.anyOfficerOrDirector) {
      reasons.push("No officer or director was among the buyers.");
    }
    if (reasons.length === 0) qualifying.push(c);
    else rejected.push({ cluster: c, reasons });
  }

  const byConviction = (a: InsiderCluster, b: InsiderCluster) =>
    b.conviction - a.conviction || b.totalBoughtUsd - a.totalBoughtUsd || a.ticker.localeCompare(b.ticker);

  return {
    qualifying: qualifying.sort(byConviction),
    rejected: rejected.sort((a, b) => byConviction(a.cluster, b.cluster)),
  };
}
