import { afterEach, describe, expect, it, vi } from "vitest";
import { attrValue, elementText, stripCdata } from "../../lib/xml";
import { BUILTIN_FEEDS, validateFeedSet, type FeedSource } from "../../lib/reach/catalog";
import { decodeBody, feedDate, parseFeed, readFeeds } from "../../lib/reach/feeds";

/* ============================================================================
 * Offline. Every body below is the shape a real source actually serves —
 * these are not invented dialects, they are the four that broke something:
 *
 *  - the Federal Reserve CDATA-wraps every link and date
 *  - the BLS release feeds are ATOM served from a `.rss` filename, with the
 *    URL in an attribute of a self-closing element
 *  - one built-in declares ISO-8859-1, which Response.text() would mangle
 *  - a global newest-first cap silently excluded both monthly BLS releases
 * ========================================================================== */

afterEach(() => vi.unstubAllGlobals());

const SRC: FeedSource = { id: "test", label: "Test feed", publisher: "Test Publisher", url: "https://example.com/f" };

const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel>${items}</channel></rss>`;
const atom = (entries: string) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom">${entries}</feed>`;

describe("the XML helpers feeds needed and filings did not", () => {
  it("unwraps CDATA", () => {
    // Without this the Federal Reserve's "URL" is the literal "<![CDATA[…]]>".
    expect(stripCdata("<![CDATA[https://www.federalreserve.gov/x.htm]]>")).toBe(
      "https://www.federalreserve.gov/x.htm",
    );
    expect(stripCdata("plain")).toBe("plain");
  });

  it("reads an attribute off a self-closing element", () => {
    // Atom puts the link here; every text-content matcher reads it as absent.
    expect(attrValue('<link href="https://a.test/x"/>', "link", "href")).toBe("https://a.test/x");
    expect(attrValue("<link rel='alternate' href='https://a.test/y' />", "link", "href")).toBe("https://a.test/y");
    expect(attrValue('<ns:link href="https://a.test/z"/>', "link", "href")).toBe("https://a.test/z");
    expect(attrValue("<link>text form</link>", "link", "href")).toBe("");
  });

  it("leaves the existing element reader untouched", () => {
    // The 13F and Form 4 parsers depend on this behaviour byte for byte.
    expect(elementText("<title>Hello &amp; goodbye</title>", "title")).toBe("Hello & goodbye");
  });
});

describe("dates", () => {
  it("reads every dialect the real sources serve", () => {
    expect(feedDate("Thu, 27 Aug 2026 15:00:00 GMT")).toBe("2026-08-27");
    // A named US zone, and a numeric offset with the stray double space BLS emits.
    expect(feedDate("Tue, 01 Sep 2026 09:00:00 EST")).toBe("2026-09-01");
    expect(feedDate("Wed,  2 Sep 2026 10:03:08 -0400")).toBe("2026-09-02");
    expect(feedDate("2026-08-07T07:50:34.021-04:00")).toBe("2026-08-07");
    expect(feedDate("<![CDATA[Thu, 27 Aug 2026 15:00:00 GMT]]>")).toBe("2026-08-27");
  });

  it("returns empty for an unreadable date rather than falling back to today", () => {
    // An item dated "now" because its stamp would not parse presents old news
    // as a fresh release — the one thing a dated feed exists to prevent.
    expect(feedDate("last Tuesday")).toBe("");
    expect(feedDate("")).toBe("");
  });
});

describe("parsing", () => {
  it("reads RSS whose link and date are CDATA-wrapped", () => {
    const items = parseFeed(
      rss(
        `<item><title>Board issues enforcement action</title>` +
          `<link><![CDATA[https://www.federalreserve.gov/a.htm]]></link>` +
          `<pubDate><![CDATA[Thu, 27 Aug 2026 15:00:00 GMT]]></pubDate></item>`,
      ),
      SRC,
    );
    expect(items).toEqual([
      {
        sourceId: "test",
        publisher: "Test Publisher",
        title: "Board issues enforcement action",
        date: "2026-08-27",
        url: "https://www.federalreserve.gov/a.htm",
      },
    ]);
  });

  it("reads Atom, taking the URL from the link attribute", () => {
    const items = parseFeed(
      atom(
        `<entry><title>Payroll employment changes little in July</title>` +
          `<link href="https://www.bls.gov/news.release/archives/empsit_08072026.htm"/>` +
          `<published>2026-08-07T07:50:34.021-04:00</published></entry>`,
      ),
      SRC,
    );
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe("https://www.bls.gov/news.release/archives/empsit_08072026.htm");
    expect(items[0].date).toBe("2026-08-07");
  });

  it("sniffs the dialect instead of trusting the filename", () => {
    // The BLS release feeds are Atom served from `.rss` URLs. A declared
    // format would have been wrong for two of five sources on day one.
    const body = atom(`<entry><title>T</title><link href="https://a.test/x"/><updated>2026-08-07T00:00:00Z</updated></entry>`);
    expect(parseFeed(body, { ...SRC, url: "https://www.bls.gov/feed/cpi.rss" })).toHaveLength(1);
  });

  it("falls back to updated when an entry has no published date", () => {
    const items = parseFeed(
      atom(`<entry><title>T</title><link href="https://a.test/x"/><updated>2026-08-07T00:00:00Z</updated></entry>`),
      SRC,
    );
    expect(items[0].date).toBe("2026-08-07");
  });

  it("drops an item that cannot be cited", () => {
    // Title, link and date are all required: an item missing one cannot be
    // pointed at, and an uncitable item has no business in a reference block.
    const body = rss(
      `<item><title>No link</title><pubDate>Thu, 27 Aug 2026 15:00:00 GMT</pubDate></item>` +
        `<item><link>https://a.test/x</link><pubDate>Thu, 27 Aug 2026 15:00:00 GMT</pubDate></item>` +
        `<item><title>No date</title><link>https://a.test/y</link></item>` +
        `<item><title>Not a url</title><link>javascript:alert(1)</link><pubDate>Thu, 27 Aug 2026 15:00:00 GMT</pubDate></item>` +
        `<item><title>Good</title><link>https://a.test/z</link><pubDate>Thu, 27 Aug 2026 15:00:00 GMT</pubDate></item>`,
    );
    expect(parseFeed(body, SRC).map((i) => i.title)).toEqual(["Good"]);
  });

  it("cleans markup and entities out of a title", () => {
    const body = rss(
      `<item><title><![CDATA[LNG exports rose 23% <b>because</b> of Europe&#8217;s demand]]></title>` +
        `<link>https://a.test/x</link><pubDate>Thu, 27 Aug 2026 15:00:00 GMT</pubDate></item>`,
    );
    expect(parseFeed(body, SRC)[0].title).toBe("LNG exports rose 23% because of Europe’s demand");
  });

  it("returns nothing rather than throwing on a body that is not a feed", () => {
    expect(parseFeed("<html><body>Not a feed</body></html>", SRC)).toEqual([]);
    expect(parseFeed("", SRC)).toEqual([]);
  });
});

describe("decoding a body by its declared charset", () => {
  const bytes = (s: string, enc: "utf-8" | "latin1") =>
    enc === "utf-8"
      ? new TextEncoder().encode(s).buffer
      : Uint8Array.from([...s].map((c) => c.charCodeAt(0) & 0xff)).buffer;

  it("honours a charset declared in the XML prolog", () => {
    // Response.text() always assumes UTF-8. One built-in declares ISO-8859-1.
    const src = `<?xml version="1.0" encoding="ISO-8859-1" ?><rss><title>café</title></rss>`;
    expect(decodeBody(bytes(src, "latin1"), null)).toContain("café");
  });

  it("honours a charset on the content-type header", () => {
    const src = `<?xml version="1.0"?><rss><title>café</title></rss>`;
    expect(decodeBody(bytes(src, "latin1"), "text/xml; charset=iso-8859-1")).toContain("café");
  });

  it("keeps UTF-8 multi-byte names intact", () => {
    // A real one: the ECB feed carries "Vujčić".
    const src = `<?xml version="1.0" encoding="utf-8"?><rss><title>Boris Vujčić</title></rss>`;
    expect(decodeBody(bytes(src, "utf-8"), "text/xml; charset=utf-8")).toContain("Vujčić");
  });

  it("falls back to UTF-8 when the declared charset is nonsense", () => {
    const src = `<?xml version="1.0" encoding="not-a-charset"?><rss><title>ok</title></rss>`;
    expect(decodeBody(bytes(src, "utf-8"), null)).toContain("ok");
  });
});

describe("reading several sources", () => {
  /** Serve a different body per URL; anything unlisted is a network error. */
  function serve(bodies: Record<string, string>) {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      const body = bodies[String(url)];
      if (body === undefined) throw new Error("connection refused");
      return {
        ok: true,
        status: 200,
        headers: { get: () => "text/xml; charset=utf-8" },
        arrayBuffer: async () => new TextEncoder().encode(body).buffer,
      } as unknown as Response;
    });
  }

  const daily: FeedSource = { id: "daily", label: "Speeches", publisher: "A Central Bank", url: "https://a.test/f" };
  const monthly: FeedSource = { id: "monthly", label: "CPI", publisher: "A Statistics Agency", url: "https://b.test/f" };

  it("caps per source so a monthly release is not starved by a daily one", async () => {
    // THE reason the cap is per source. With one global newest-first cap the
    // jobs report and CPI — the two figures a macro view most wants — were
    // always the oldest items in the pool and never survived the cut.
    const dailyItems = Array.from(
      { length: 10 },
      (_, i) => `<item><title>Speech ${i}</title><link>https://a.test/${i}</link><pubDate>2026-09-0${(i % 9) + 1}T00:00:00Z</pubDate></item>`,
    ).join("");
    serve({
      "https://a.test/f": rss(dailyItems),
      "https://b.test/f": rss(
        `<item><title>CPI for July</title><link>https://b.test/cpi</link><pubDate>2026-08-12T00:00:00Z</pubDate></item>`,
      ),
    });
    const { items } = await readFeeds([daily, monthly], {
      lookbackDays: 35,
      maxPerSource: 2,
      asOf: new Date("2026-09-02T12:00:00Z"),
    });
    expect(items.filter((i) => i.sourceId === "daily")).toHaveLength(2);
    expect(items.map((i) => i.title)).toContain("CPI for July");
  });

  it("windows by date", async () => {
    serve({
      "https://a.test/f": rss(
        `<item><title>Old</title><link>https://a.test/o</link><pubDate>2026-01-01T00:00:00Z</pubDate></item>` +
          `<item><title>New</title><link>https://a.test/n</link><pubDate>2026-09-01T00:00:00Z</pubDate></item>`,
      ),
    });
    const { items } = await readFeeds([daily], { lookbackDays: 35, maxPerSource: 5, asOf: new Date("2026-09-02T12:00:00Z") });
    expect(items.map((i) => i.title)).toEqual(["New"]);
  });

  it("loses one dead publisher, not the others, and says which", async () => {
    serve({
      "https://b.test/f": rss(
        `<item><title>CPI</title><link>https://b.test/cpi</link><pubDate>2026-08-30T00:00:00Z</pubDate></item>`,
      ),
    });
    const { items, notes } = await readFeeds([daily, monthly], {
      lookbackDays: 35,
      maxPerSource: 5,
      asOf: new Date("2026-09-02T12:00:00Z"),
    });
    expect(items.map((i) => i.title)).toEqual(["CPI"]);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toContain("A Central Bank");
    expect(notes[0]).toContain("refused");
  });

  it("reports a source that answered with nothing citable", async () => {
    // The BLS rolling-dashboard failure mode: HTTP 200, well-formed, useless.
    serve({ "https://a.test/f": rss(`<item><title>No link and no date</title></item>`) });
    const { items, notes } = await readFeeds([daily], { lookbackDays: 35, maxPerSource: 5 });
    expect(items).toEqual([]);
    expect(notes[0]).toContain("no citable dated items");
  });
});

describe("the source catalogue", () => {
  it("ships only https sources with the fields a citation needs", () => {
    for (const f of BUILTIN_FEEDS) {
      expect(f.url).toMatch(/^https:\/\//);
      expect(f.id.length).toBeGreaterThan(0);
      expect(f.publisher.length).toBeGreaterThan(0);
      expect(f.label.length).toBeGreaterThan(0);
    }
    expect(new Set(BUILTIN_FEEDS.map((f) => f.id)).size).toBe(BUILTIN_FEEDS.length);
  });

  it("accepts a whole valid set", () => {
    const out = validateFeedSet([{ id: " x ", label: "L", publisher: "P", url: "https://a.test/f" }]);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.sources[0].id).toBe("x");
  });

  it("rejects the whole set rather than storing part of it", () => {
    // Same contract as the desk's playbook editor: all of it, or none of it.
    expect(validateFeedSet([{ id: "a", label: "L", publisher: "P", url: "http://a.test/f" }])).toMatchObject({ ok: false });
    expect(validateFeedSet([{ id: "a", label: "L", publisher: "P" }])).toMatchObject({ ok: false });
    expect(
      validateFeedSet([
        { id: "a", label: "L", publisher: "P", url: "https://a.test/f" },
        { id: "a", label: "M", publisher: "Q", url: "https://b.test/f" },
      ]),
    ).toMatchObject({ ok: false });
    expect(validateFeedSet("not a list")).toMatchObject({ ok: false });
  });
});
