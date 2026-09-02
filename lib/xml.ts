/* ============================================================================
 * Minimal XML reading helpers — shared, pure, no dependency.
 *
 * SEC's structured filings are machine-generated and shallow, so a full parser
 * would buy nothing a careful matcher does not. Two rules earn their place:
 *
 *  - Every tag is matched namespace-agnostically. A 13F information table
 *    arrives both bare and `ns1:`-prefixed FROM THE SAME FILER, and a
 *    prefix-blind matcher returns zero rows silently rather than erroring.
 *  - Entities are decoded once, here, so no caller ends up with a company name
 *    reading "Smith &amp; Co".
 *
 * Used by the Bottleneck desk's 13F clone and the Insider scanner's Form 4
 * parser. Anything filing-specific belongs in those modules, not here.
 * ========================================================================== */

const pattern = (name: string): string =>
  "<(?:\\w+:)?" + name + "\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?" + name + ">";

/** Namespace-agnostic element matcher: the prefix depends on the filing agent, not on meaning. */
export const tagRe = (name: string): RegExp => new RegExp(pattern(name), "i");

/** Same, global — for repeated elements. */
export const tagReAll = (name: string): RegExp => new RegExp(pattern(name), "gi");

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function decodeXml(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, ent: string) => {
    const key = ent.toLowerCase();
    if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
    if (key.startsWith("#")) return String.fromCodePoint(Number(key.slice(1)));
    return XML_ENTITIES[key] ?? m;
  });
}

/** One element's text, trimmed and entity-decoded. Empty string when absent. */
export function elementText(block: string, name: string): string {
  const m = tagRe(name).exec(block);
  return m ? decodeXml(m[1]).trim() : "";
}

/** Every occurrence of an element, as raw inner blocks. */
export function elementBlocks(xml: string, name: string): string[] {
  return [...xml.matchAll(tagReAll(name))].map((m) => m[1]);
}

/**
 * True when the element is present at all, however empty. Distinguishing
 * "absent" from "present and false" is load-bearing wherever a missing flag
 * must not be reported as a stated negative.
 */
export function hasElement(block: string, name: string): boolean {
  return tagRe(name).test(block);
}

/* ----------------------------------------------------------------------------
 * Syndication feeds need two things SEC's filings never do. Both are additive:
 * nothing above changes behaviour, so the 13F and Form 4 parsers are untouched.
 * -------------------------------------------------------------------------- */

/**
 * Unwrap CDATA. Feeds use it where filings do not — the Federal Reserve wraps
 * every <link> and <pubDate> in it, and without this the "URL" read out of that
 * feed is the literal string "<![CDATA[https://…]]>".
 */
export function stripCdata(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}

/**
 * One attribute off an element, matched namespace-agnostically and tolerant of
 * a self-closing tag. Atom puts the link in an attribute of an empty element —
 * `<link href="…"/>` — which every text-content matcher reads as absent.
 */
export function attrValue(block: string, name: string, attr: string): string {
  const re = new RegExp(`<(?:\\w+:)?${name}\\b([^>]*)>`, "i");
  const tag = re.exec(block);
  if (!tag) return "";
  const a = new RegExp(`\\b${attr}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag[1]);
  return a ? decodeXml(a[2] ?? a[3] ?? "").trim() : "";
}
