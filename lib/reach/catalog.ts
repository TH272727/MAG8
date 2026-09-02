import { getAppSettingJson } from "../db";

/* ============================================================================
 * Which official bodies to read — the only world-specific input in this layer.
 *
 * Built-ins live in code, custom entries in app_settings, the same split the
 * rotation catalogue and the desk's playbooks use: this changes with the world
 * rather than with operator preference, so it is data, not a knob.
 *
 * Every source below was fetched and parsed this session. Two were rejected
 * after being read, and the reasons are recorded here rather than lost, because
 * "we tried it and it does not say what it appears to say" is exactly the kind
 * of finding that gets re-discovered later at cost.
 * ========================================================================== */

export interface FeedSource {
  id: string;
  /** What the feed is, in the words a reader would use. */
  label: string;
  publisher: string;
  url: string;
}

/**
 * Format is deliberately NOT declared: it is sniffed from the body. The BLS
 * release feeds are served from `.rss` filenames and are Atom documents, so a
 * declared format would have been wrong on two of five sources on day one.
 */
export const BUILTIN_FEEDS: readonly FeedSource[] = [
  {
    id: "fed-press",
    label: "Press releases",
    publisher: "Federal Reserve Board",
    url: "https://www.federalreserve.gov/feeds/press_all.xml",
  },
  {
    id: "ecb-press",
    label: "Press releases",
    publisher: "European Central Bank",
    url: "https://www.ecb.europa.eu/rss/press.html",
  },
  {
    id: "eia-today",
    label: "Today in Energy",
    publisher: "US Energy Information Administration",
    url: "https://www.eia.gov/rss/todayinenergy.xml",
  },
  {
    id: "bls-empsit",
    label: "The Employment Situation",
    publisher: "US Bureau of Labor Statistics",
    url: "https://www.bls.gov/feed/empsit.rss",
  },
  {
    id: "bls-cpi",
    label: "Consumer Price Index",
    publisher: "US Bureau of Labor Statistics",
    url: "https://www.bls.gov/feed/cpi.rss",
  },
] as const;

/**
 * Read and rejected, with the reason — so neither is quietly retried later.
 *
 * The BLS one is the instructive failure: the feed answers 200 with a
 * well-formed item, and that item is a rolling dashboard whose title is the
 * channel's own name, whose link is the section index, and whose publication
 * date is the moment you fetched it. Listing it would have produced a dated,
 * linked, entirely contentless "release" every single week — a plausible line
 * that says nothing, which is worse than an absent one.
 */
export const REJECTED_FEEDS: readonly { url: string; why: string }[] = [
  {
    url: "https://www.bls.gov/feed/bls_latest.rss",
    why: "a single rolling dashboard item, re-dated to the moment of fetch — not dated releases",
  },
  {
    url: "https://home.treasury.gov/rss/press.xml",
    why: "does not answer (timeout), and the documented alternative redirects without a feed body",
  },
] as const;

const isSource = (v: unknown): v is FeedSource => {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.trim().length > 0 &&
    typeof o.label === "string" &&
    typeof o.publisher === "string" &&
    typeof o.url === "string" &&
    /^https:\/\//i.test(o.url)
  );
};

/**
 * Built-ins plus any the owner added, custom entries overriding a built-in of
 * the same id. HTTPS only — a plaintext feed would put what this desk reads on
 * the wire for anyone to rewrite.
 */
export function feedSources(): FeedSource[] {
  const raw = getAppSettingJson("reach_feeds");
  const custom = Array.isArray(raw) ? raw.filter(isSource) : [];
  const byId = new Map<string, FeedSource>(BUILTIN_FEEDS.map((f) => [f.id, f]));
  for (const f of custom) byId.set(f.id.trim(), { ...f, id: f.id.trim() });
  return [...byId.values()];
}

/** Validate a whole proposed set: all of it is stored, or none of it is. */
export function validateFeedSet(input: unknown): { ok: true; sources: FeedSource[] } | { ok: false; reason: string } {
  if (!Array.isArray(input)) return { ok: false, reason: "expected a list of sources" };
  const out: FeedSource[] = [];
  const seen = new Set<string>();
  for (const [i, v] of input.entries()) {
    if (!isSource(v)) return { ok: false, reason: `entry ${i + 1} is missing an id, label, publisher, or https url` };
    const id = v.id.trim();
    if (seen.has(id)) return { ok: false, reason: `entry ${i + 1} repeats the id "${id}"` };
    seen.add(id);
    out.push({ ...v, id });
  }
  return { ok: true, sources: out };
}
