import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchTicker,
  isIndexSymbol,
  isValidTicker,
  parseMoney,
  parseUsDate,
  priceSources,
  toPriceBars,
} from "../../lib/rotation/bars";

/* ============================================================================
 * Price sources. Tests run offline: every response is a stub, because the point
 * is to pin how MALFORMED and PARTIAL answers are handled, which a live source
 * will not reliably produce on demand.
 *
 * The failure this file exists to prevent: a source answering with something
 * plausible-but-wrong and the board scoring it anyway. Every case below ends in
 * either a correct series or an explicit refusal with a reason — never a
 * half-built series and never a thrown error, since one dead ticker must not
 * take down a refresh of thirty others.
 * ========================================================================== */

/** Serve one canned body to every request; anything else is a network error. */
function stubFetch(body: string, status = 200) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string | URL) => {
    calls.push(String(url));
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => body,
      headers: { get: () => "application/json" },
    } as unknown as Response;
  });
  return calls;
}

function stubNetworkError(err: Error) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (url: string | URL) => {
    calls.push(String(url));
    throw err;
  });
  return calls;
}

const chart = (stamps: number[], adjclose: (number | null)[], close?: (number | null)[]) =>
  JSON.stringify({
    chart: {
      result: [
        {
          timestamp: stamps,
          indicators: { adjclose: [{ adjclose }], quote: [{ close: close ?? adjclose }] },
        },
      ],
    },
  });

/** 2021-01-04 onward, one stamp per weekday-ish step. */
const DAY = 86_400;
const START = Math.floor(Date.parse("2021-01-04T14:30:00Z") / 1000);
const stamps = (n: number) => Array.from({ length: n }, (_, i) => START + i * DAY);
const rising = (n: number) => Array.from({ length: n }, (_, i) => 100 + i * 0.1);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("symbol validation", () => {
  it("accepts funds and the one index symbol the catalog needs", () => {
    for (const t of ["RSP", "SPY", "XLRE", "QQQE", "^VIX", "BRK.B"]) {
      expect(isValidTicker(t), t).toBe(true);
    }
  });

  it("rejects anything that is not a symbol", () => {
    // The app's other price path rejects a leading caret outright; this one must
    // not, which is exactly why it has a validator of its own.
    for (const t of ["", "1SPY", "a b", "TOOLONGSYMBOL", "../etc", "SPY;DROP"]) {
      expect(isValidTicker(t), t).toBe(false);
    }
  });

  it("knows an index from a fund", () => {
    expect(isIndexSymbol("^VIX")).toBe(true);
    expect(isIndexSymbol("SPY")).toBe(false);
  });
});

describe("fallback-source parsing", () => {
  it("strips currency and thousands separators from a close", () => {
    expect(parseMoney("220.69")).toBe(220.69);
    expect(parseMoney("$220.69")).toBe(220.69);
    expect(parseMoney("1,234.50")).toBe(1234.5);
    expect(parseMoney("$1,234.50")).toBe(1234.5);
  });

  it("returns nothing rather than a wrong number for an unusable close", () => {
    for (const raw of ["", "N/A", "--", undefined, "0", "-5"]) {
      expect(parseMoney(raw as string | undefined), String(raw)).toBeNull();
    }
  });

  it("reads the American date order the source publishes", () => {
    // 08/28/2026 is 28 August, not 8 December. Reading it the other way would
    // reorder the series and silently corrupt every rolling statistic.
    expect(parseUsDate("08/28/2026")).toBe("2026-08-28");
    expect(parseUsDate("12/01/2025")).toBe("2025-12-01");
  });

  it("refuses a date it does not recognise", () => {
    for (const raw of ["2026-08-28", "8/28/2026", "", undefined]) {
      expect(parseUsDate(raw as string | undefined), String(raw)).toBeNull();
    }
  });
});

describe("primary source", () => {
  const [yahoo] = priceSources(0);
  const opts = { years: 5, timeoutMs: 1000 };

  it("returns a chronological series of adjusted closes", async () => {
    stubFetch(chart(stamps(5), rising(5)));
    const { series } = await yahoo.fetch("RSP", opts);
    expect(series).not.toBeNull();
    expect(series!.adjusted).toBe(true);
    expect(series!.source).toBe("yahoo");
    expect(series!.bars).toHaveLength(5);
    expect(series!.bars[0].date).toBe("2021-01-04");
    expect(series!.bars.every((b, i) => i === 0 || series!.bars[i - 1].date < b.date)).toBe(true);
  });

  it("drops padded sessions instead of interpolating them", async () => {
    // An index carries sessions its funds do not, and the source pads those
    // rows with nulls. Filling them in would invent prices that never traded.
    stubFetch(chart(stamps(5), [100, null, 102, null, 104]));
    const { series } = await yahoo.fetch("^VIX", opts);
    expect(series!.bars).toHaveLength(3);
    expect(series!.bars.map((b) => b.close)).toEqual([100, 102, 104]);
  });

  it("labels the series unadjusted when only a raw close is offered", async () => {
    // Silently presenting a raw close as an adjusted one is how two legs of a
    // ratio end up on different bases without anything saying so.
    const body = JSON.stringify({
      chart: { result: [{ timestamp: stamps(3), indicators: { quote: [{ close: [10, 11, 12] }] } }] },
    });
    stubFetch(body);
    const { series } = await yahoo.fetch("RSP", opts);
    expect(series!.adjusted).toBe(false);
  });

  it("refuses when the price array does not line up with the dates", async () => {
    stubFetch(chart(stamps(5), rising(3)));
    const { series, note } = await yahoo.fetch("RSP", opts);
    expect(series).toBeNull();
    expect(note).toMatch(/line up/);
  });

  it("reports the reason rather than throwing when the source errors", async () => {
    stubFetch(JSON.stringify({ chart: { result: null, error: { description: "No data found" } } }));
    const { series, note } = await yahoo.fetch("NOPE", opts);
    expect(series).toBeNull();
    expect(note).toBe("No data found");
  });

  it("survives a body that is not JSON at all", async () => {
    // The fallback source this project previously relied on started answering
    // with an HTML challenge page instead of data, and 200-with-HTML is the
    // shape that failure takes.
    stubFetch("<!DOCTYPE html><html><body>challenge</body></html>");
    const { series, note } = await yahoo.fetch("RSP", opts);
    expect(series).toBeNull();
    expect(note).toBeTruthy();
  });

  it("unwraps a transport failure into a stated reason", async () => {
    const err = new Error("fetch failed");
    (err as Error & { cause?: unknown }).cause = Object.assign(new Error("getaddrinfo ENOTFOUND"), {
      code: "ENOTFOUND",
    });
    stubNetworkError(err);
    const { series, note } = await yahoo.fetch("RSP", { years: 5, timeoutMs: 50 });
    expect(series).toBeNull();
    expect(note).toMatch(/ENOTFOUND/);
  });
});

describe("fallback source", () => {
  const [, nasdaq] = priceSources(0);
  const opts = { years: 3, timeoutMs: 1000 };

  const table = (rows: { date: string; close: string }[]) =>
    JSON.stringify({ data: { tradesTable: { rows } } });

  it("reverses the newest-first order the source publishes", async () => {
    stubFetch(
      table([
        { date: "08/28/2026", close: "$220.69" },
        { date: "08/27/2026", close: "$221.45" },
        { date: "08/26/2026", close: "$222.11" },
      ]),
    );
    const { series } = await nasdaq.fetch("RSP", opts);
    expect(series!.bars.map((b) => b.date)).toEqual(["2026-08-26", "2026-08-27", "2026-08-28"]);
    expect(series!.bars[2].close).toBe(220.69);
  });

  it("declares itself unadjusted, because it is", async () => {
    stubFetch(table([{ date: "08/28/2026", close: "220.69" }]));
    const { series } = await nasdaq.fetch("RSP", opts);
    expect(series!.adjusted).toBe(false);
  });

  it("declines an index symbol rather than guessing", async () => {
    const calls = stubFetch(table([{ date: "08/28/2026", close: "14.43" }]));
    const { series, note } = await nasdaq.fetch("^VIX", opts);
    expect(series).toBeNull();
    expect(note).toMatch(/index/);
    expect(calls, "it must not spend a request on a symbol it cannot serve").toHaveLength(0);
  });

  it("keeps the readable rows when one row is malformed", async () => {
    stubFetch(
      table([
        { date: "08/28/2026", close: "220.69" },
        { date: "not-a-date", close: "221.45" },
        { date: "08/26/2026", close: "N/A" },
      ]),
    );
    const { series } = await nasdaq.fetch("RSP", opts);
    expect(series!.bars).toHaveLength(1);
  });
});

describe("fetchTicker", () => {
  const base = { years: 5, timeoutMs: 1000, gapMs: 0, minBars: 4, fallbackEnabled: true };

  it("takes the primary answer and never consults the fallback", async () => {
    const calls = stubFetch(chart(stamps(10), rising(10)));
    const res = await fetchTicker("RSP", base);
    expect(res.series!.source).toBe("yahoo");
    expect(res.attempts).toHaveLength(1);
    expect(calls).toHaveLength(1);
  });

  it("reports a thin series instead of scoring it", async () => {
    // A short answer from a price source is far more often a fault at their end
    // than a real gap in market history.
    stubFetch(chart(stamps(2), rising(2)));
    const res = await fetchTicker("RSP", base);
    expect(res.series).toBeNull();
    expect(res.thin).toBe(true);
    expect(res.attempts.every((a) => !a.ok)).toBe(true);
    expect(res.attempts[0].note).toMatch(/below the 4 required/);
  });

  it("does not reach for the fallback when the operator has turned it off", async () => {
    stubFetch(JSON.stringify({ chart: { result: null } }));
    const res = await fetchTicker("RSP", { ...base, fallbackEnabled: false });
    expect(res.series).toBeNull();
    expect(res.attempts.map((a) => a.source)).toEqual(["yahoo"]);
  });

  it("records every source it tried, with what each said", async () => {
    stubFetch(JSON.stringify({ chart: { result: null, error: { description: "No data found" } } }));
    const res = await fetchTicker("RSP", base);
    expect(res.attempts.map((a) => a.source)).toEqual(["yahoo", "nasdaq"]);
    for (const a of res.attempts) expect(a.note).toBeTruthy();
  });
});

describe("toPriceBars", () => {
  it("stamps every row with the basis that produced it", () => {
    // This is what lets the scorer refuse a ratio whose two legs disagree.
    const rows = toPriceBars({
      ticker: "RSP",
      bars: [{ date: "2026-08-28", close: 220.69 }],
      source: "nasdaq",
      adjusted: false,
    });
    expect(rows).toEqual([
      { ticker: "RSP", date: "2026-08-28", close: 220.69, adjusted: false, source: "nasdaq" },
    ]);
  });
});
