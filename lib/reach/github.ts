import { describeFetchError } from "../edgar";

/* ============================================================================
 * Public developer activity — evidence for the minority of names that have any.
 *
 * The discovery playbook names developer-ecosystem traction as one of the
 * traits today's giants showed before they were giants. This measures it where
 * it can be measured and is silent everywhere else, which on this universe is
 * most of the time: of the eight-name fixture cohort, exactly one has any
 * public presence at all. That number is reported, not hidden.
 *
 * TWO RULES, both of which exist because breaking either produces a confident
 * wrong answer:
 *
 *  1. Resolution is CURATED, never guessed. Every handle below was fetched and
 *     confirmed this session. Guessing at handles is how a lookup returned a
 *     Frankfurt symbol for a Nasdaq-listed company once already.
 *  2. An organisation with no public repositories is NOT MEASURED — never a
 *     zero, never a weak reading. Four real cases: Symbotic, Archer Aviation,
 *     Rocket Lab and SentinelOne all hold a registered handle with nothing
 *     published under it. Reading that emptiness as low developer traction
 *     would be an answer; the honest output is that there is no answer.
 *
 * Keyless at 60 requests an hour, which is ample for a weekly read of a
 * handful of names. MAG8_GITHUB_TOKEN (a free personal token, no scopes
 * needed) raises it to 5,000; without one everything still works.
 * ========================================================================== */

const API = "https://api.github.com";

/**
 * Ticker → GitHub organisation. Every entry verified against the live API on
 * 2026-09-02; the count beside each is what it held that day.
 *
 * The last four are deliberate: they resolve to a real handle that publishes
 * NOTHING. Keeping them here is more informative than leaving them out —
 * "we looked and they publish nothing" and "we never looked" are different
 * facts, and only the map can tell them apart.
 */
export const BUILTIN_HANDLES: Readonly<Record<string, string>> = {
  IONQ: "ionq", //            10 repos
  RGTI: "rigetti", //         64
  QBTS: "dwavesystems", //    47
  PATH: "UiPath", //         101
  GTLB: "gitlabhq", //        44
  MDB: "mongodb", //         307
  ESTC: "elastic", //        956
  CFLT: "confluentinc", //   426
  DDOG: "DataDog", //       1201
  NET: "cloudflare", //      576
  DOCN: "digitalocean", //   362
  FSLY: "fastly", //         298
  TWLO: "twilio", //         238
  // Registered, empty. Present so the read says "publishes nothing" rather
  // than "not looked up".
  SYM: "symbotic", //          0
  ACHR: "archer-aviation", //  0
  RKLB: "RocketLab", //        0
  S: "sentinelone", //         0
};

export interface EcosystemRead {
  ticker: string;
  org: string;
  url: string;
  /** Exact, from the organisation record. */
  publicRepos: number;
  orgFollowers: number;
  /**
   * How many repositories the per-repo figures below actually cover. GitHub
   * pages this endpoint at 100, and several of these organisations publish
   * many times that — so the star total is a SAMPLE over the most recently
   * pushed repositories, and saying otherwise would understate them silently.
   */
  sampledRepos: number;
  sampledStars: number;
  topRepo: { name: string; stars: number; url: string } | null;
  /** Repositories pushed to in the last 90 days — the cadence signal. */
  pushedLast90d: number;
  latestPush: string;
  /** Set when nothing could be measured. Never accompanied by figures. */
  notMeasured?: string;
  /** Exact figures from an earlier week, so a trend can be stated rather than implied. */
  since?: { weekKey: string; publicRepos: number; orgFollowers: number };
}

/** Handles the owner added or overrode, merged over the built-ins. */
export function ecosystemHandles(custom?: Record<string, string> | null): Record<string, string> {
  const out: Record<string, string> = { ...BUILTIN_HANDLES };
  if (custom) {
    for (const [t, h] of Object.entries(custom)) {
      const ticker = t.trim().toUpperCase();
      const handle = String(h ?? "").trim();
      // An empty handle REMOVES a built-in — the way to say "this mapping is
      // wrong" without editing code.
      if (!ticker) continue;
      if (handle) out[ticker] = handle;
      else delete out[ticker];
    }
  }
  return out;
}

/** PURE: the shape of a read that measured nothing, with the reason stated. */
export const notMeasured = (ticker: string, org: string, why: string): EcosystemRead => ({
  ticker,
  org,
  url: org ? `https://github.com/${org}` : "",
  publicRepos: 0,
  orgFollowers: 0,
  sampledRepos: 0,
  sampledStars: 0,
  topRepo: null,
  pushedLast90d: 0,
  latestPush: "",
  notMeasured: why,
});

interface RepoRecord {
  name?: unknown;
  html_url?: unknown;
  stargazers_count?: unknown;
  pushed_at?: unknown;
  fork?: unknown;
}

const int = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * PURE: fold an organisation record and its repository page into a reading.
 *
 * Forks are excluded from every per-repo figure. An organisation that mirrors
 * other people's projects has not built an ecosystem, and counting the stars
 * on a fork of someone else's repository as its own traction is exactly the
 * kind of flattering, wrong number this layer is supposed to avoid.
 */
export function foldEcosystem(
  ticker: string,
  org: string,
  orgRecord: { public_repos?: unknown; followers?: unknown; html_url?: unknown },
  repos: RepoRecord[],
  opts: { minRepos: number; asOf?: Date },
): EcosystemRead {
  const publicRepos = int(orgRecord.public_repos);
  if (publicRepos < opts.minRepos) {
    return notMeasured(
      ticker,
      org,
      publicRepos === 0
        ? "the organisation exists but publishes no public repositories"
        : `only ${publicRepos} public repository(ies) — below the threshold for a reading`,
    );
  }

  const own = repos.filter((r) => r.fork !== true);
  const asOf = opts.asOf ?? new Date();
  const cutoff = new Date(asOf.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);

  let sampledStars = 0;
  let pushedLast90d = 0;
  let latestPush = "";
  let topRepo: EcosystemRead["topRepo"] = null;
  for (const r of own) {
    const stars = int(r.stargazers_count);
    sampledStars += stars;
    const pushed = str(r.pushed_at).slice(0, 10);
    if (pushed) {
      if (pushed >= cutoff) pushedLast90d++;
      if (pushed > latestPush) latestPush = pushed;
    }
    if (!topRepo || stars > topRepo.stars) {
      topRepo = { name: str(r.name), stars, url: str(r.html_url) };
    }
  }

  return {
    ticker,
    org,
    url: str(orgRecord.html_url) || `https://github.com/${org}`,
    publicRepos,
    orgFollowers: int(orgRecord.followers),
    sampledRepos: own.length,
    sampledStars,
    topRepo,
    pushedLast90d,
    latestPush,
  };
}

/* ----------------------------------------------------------------------------
 * Fetch
 * -------------------------------------------------------------------------- */

const headers = (): Record<string, string> => {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": process.env.MAG8_EDGAR_UA?.trim() || "Mag8/1.0 (research pipeline; +https://themag8.com)",
  };
  const token = process.env.MAG8_GITHUB_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
};

/** Most repositories one page returns. Beyond this the star total is a sample. */
export const REPO_PAGE = 100;

export interface EcosystemOptions {
  minRepos: number;
  asOf?: Date;
  timeoutMs?: number;
}

/**
 * One company's public developer activity, in two requests.
 *
 * Fail-open: an unresolved ticker, a missing organisation, or a dead request
 * all come back as a stated reason rather than a throw or a zero.
 */
export async function readEcosystem(
  ticker: string,
  org: string | undefined,
  opts: EcosystemOptions,
): Promise<EcosystemRead | null> {
  // No handle means we never looked. That is not a finding, so there is
  // nothing to report — distinct from a handle that resolves to an empty org.
  if (!org) return null;

  const get = async (path: string): Promise<unknown> => {
    const res = await fetch(`${API}${path}`, {
      headers: headers(),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    if (res.status === 404) throw new Error(`no such organisation "${org}"`);
    if (res.status === 403 || res.status === 429) {
      const left = res.headers.get("x-ratelimit-remaining");
      throw new Error(left === "0" ? "hourly request budget exhausted" : `refused (HTTP ${res.status})`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  try {
    const orgRecord = (await get(`/orgs/${encodeURIComponent(org)}`)) as Record<string, unknown>;
    const publicRepos = int(orgRecord.public_repos);
    // Do not spend a second request on an organisation that has nothing to list.
    const repos =
      publicRepos >= opts.minRepos
        ? ((await get(`/orgs/${encodeURIComponent(org)}/repos?per_page=${REPO_PAGE}&sort=pushed&direction=desc`)) as RepoRecord[])
        : [];
    return foldEcosystem(ticker, org, orgRecord, Array.isArray(repos) ? repos : [], opts);
  } catch (err) {
    return notMeasured(ticker, org, err instanceof Error ? err.message : describeFetchError(err));
  }
}
