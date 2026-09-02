import { describeFetchError } from "../edgar";
import { attrValue, decodeXml, elementBlocks, elementText, stripCdata } from "../xml";
import type { FeedSource } from "./catalog";

/* ============================================================================
 * Dated releases from the bodies whose decisions a macro thesis turns on.
 *
 * Companion to the filings channel and the same contract: this LISTS what was
 * published, with its date and its link. It never summarises a release, and it
 * never says what one means — that is the analysis's job, and a machine-made
 * gloss would be precisely the "description of the artifact" the source
 * standard says to prefer the artifact over.
 *
 * Its own request queue, deliberately NOT the EDGAR one: different hosts,
 * different courtesy limits, and sharing a queue would let a slow statistical
 * agency delay a filings read for no reason.
 * ========================================================================== */

export interface ReleaseItem {
  sourceId: string;
  publisher: string;
  title: string;
  /** YYYY-MM-DD. */
  date: string;
  url: string;
}

/* ----------------------------------------------------------------------------
 * Queue — one promise chain, global to the process, on its own key.
 * -------------------------------------------------------------------------- */

const GAP_MS = 250;
type GlobalWithGate = typeof globalThis & { __mag8_feed_gate?: { chain: Promise<void>; last: number } };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function takeSlot(): Promise<void> {
  const g = globalThis as GlobalWithGate;
  if (!g.__mag8_feed_gate) g.__mag8_feed_gate = { chain: Promise.resolve(), last: 0 };
  const gate = g.__mag8_feed_gate;
  const next = gate.chain.then(async () => {
    const wait = gate.last + GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    gate.last = Date.now();
  });
  gate.chain = next.catch(() => undefined);
  return next;
}

/* ----------------------------------------------------------------------------
 * Parsing — pure, and the only place feed dialects are known about.
 * -------------------------------------------------------------------------- */

/**
 * A date out of a feed, as YYYY-MM-DD, or "" when it cannot be read.
 *
 * Every real dialect encountered parses natively: RFC-822 with a GMT or a
 * named US zone, RFC-822 with a numeric offset and a stray double space, and
 * ISO-8601 with fractional seconds. An unreadable date returns empty rather
 * than today — an item dated "now" because its stamp was unparseable would
 * present old news as a fresh release, which is the one thing a dated feed
 * exists to prevent.
 */
export function feedDate(raw: string): string {
  const s = stripCdata(raw).trim();
  if (!s) return "";
  const t = new Date(s);
  return Number.isNaN(t.getTime()) ? "" : t.toISOString().slice(0, 10);
}

/** Collapse whitespace and drop any markup a title carries. */
const cleanTitle = (raw: string): string =>
  decodeXml(stripCdata(raw).replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/**
 * PURE: read one feed body into items.
 *
 * The dialect is sniffed rather than declared, because it has already been
 * wrong once: the BLS release feeds are served from `.rss` URLs and are Atom
 * documents. Presence of <entry> decides it.
 */
export function parseFeed(xml: string, source: FeedSource): ReleaseItem[] {
  const atom = elementBlocks(xml, "entry");
  const blocks = atom.length > 0 ? atom : elementBlocks(xml, "item");
  const isAtom = atom.length > 0;

  const items: ReleaseItem[] = [];
  for (const b of blocks) {
    const title = cleanTitle(elementText(b, "title"));
    // Atom carries the URL in an attribute of an empty element; RSS as text,
    // sometimes CDATA-wrapped (the Federal Reserve wraps every one of them).
    const url = isAtom ? attrValue(b, "link", "href") : stripCdata(elementText(b, "link"));
    const date = feedDate(isAtom ? elementText(b, "published") || elementText(b, "updated") : elementText(b, "pubDate"));
    // All three are required. An item missing any of them cannot be cited,
    // and an uncitable item has no business in a reference block.
    if (!title || !/^https?:\/\//i.test(url) || !date) continue;
    items.push({ sourceId: source.id, publisher: source.publisher, title, date, url });
  }
  return items;
}

/* ----------------------------------------------------------------------------
 * Fetch
 * -------------------------------------------------------------------------- */

const USER_AGENT = (): string =>
  process.env.MAG8_EDGAR_UA?.trim() || "Mag8/1.0 (research pipeline; +https://themag8.com)";

/**
 * Decode a body by its DECLARED charset rather than assuming UTF-8.
 *
 * `Response.text()` always decodes as UTF-8. One of the built-in feeds declares
 * ISO-8859-1 and another carries accented European names, so assuming would
 * mangle exactly the titles a reader would notice.
 */
export function decodeBody(buf: ArrayBuffer, contentType: string | null): string {
  const head = new TextDecoder("utf-8").decode(buf.slice(0, 200));
  const declared =
    /charset=["']?([\w-]+)/i.exec(contentType ?? "")?.[1] ?? /encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(declared.toLowerCase()).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

export interface ReadFeedsOptions {
  lookbackDays: number;
  /** Cap PER SOURCE, not across all of them — see below. */
  maxPerSource: number;
  asOf?: Date;
  timeoutMs?: number;
}

/**
 * Read every source into one list, newest first, windowed then capped.
 *
 * The cap is per source, and that is the whole design. A single newest-first
 * cap across all sources silently starves the low-frequency publishers: a
 * central bank posts speeches most days, while the jobs report and CPI come
 * once a month — so with a global cap the two releases a macro thesis most
 * wants are always the oldest items in the pool and never survive the cut.
 * Capping per source guarantees each publisher a place and lets the window,
 * not the calendar, decide what is current.
 *
 * Fail-open per source: a dead publisher costs its own items and states why —
 * it never throws, and it never takes the other four down with it.
 */
export async function readFeeds(
  sources: FeedSource[],
  opts: ReadFeedsOptions,
): Promise<{ items: ReleaseItem[]; notes: string[] }> {
  const asOf = opts.asOf ?? new Date();
  const cutoff = new Date(asOf.getTime() - opts.lookbackDays * 86_400_000).toISOString().slice(0, 10);
  const all: ReleaseItem[] = [];
  const notes: string[] = [];

  for (const source of sources) {
    await takeSlot();
    try {
      const res = await fetch(source.url, {
        headers: { "User-Agent": USER_AGENT(), Accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      });
      if (!res.ok) {
        notes.push(`${source.publisher} — ${source.label}: HTTP ${res.status}`);
        continue;
      }
      const body = decodeBody(await res.arrayBuffer(), res.headers.get("content-type"));
      const parsed = parseFeed(body, source);
      if (parsed.length === 0) {
        notes.push(`${source.publisher} — ${source.label}: answered, but no citable dated items`);
        continue;
      }
      const windowed = parsed.filter((i) => i.date >= cutoff);
      windowed.sort((a, b) => b.date.localeCompare(a.date));
      all.push(...windowed.slice(0, opts.maxPerSource));
    } catch (err) {
      notes.push(`${source.publisher} — ${source.label}: ${describeFetchError(err)}`);
    }
  }

  all.sort((a, b) => (b.date === a.date ? a.publisher.localeCompare(b.publisher) : b.date.localeCompare(a.date)));
  return { items: all, notes };
}
