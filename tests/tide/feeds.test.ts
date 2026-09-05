import { describe, expect, it } from "vitest";
import { freshnessOf, parseCboeCsv, parseFredCsv } from "../../lib/tide/feeds";
import type { TideSeries } from "../../lib/tide/catalog";

/* ============================================================================
 * The failure mode this file exists to prevent: a source that answers
 * perfectly and means nothing.
 *
 * Every case below was found against live data during the build, and every one
 * of them produces a confident wrong number rather than an error. Nothing here
 * touches the network or the database.
 * ========================================================================== */

const series = (over: Partial<TideSeries> = {}): TideSeries => ({
  id: "x",
  label: "A series",
  connector: "fred",
  handle: "X",
  unit: "percent",
  frequency: "quarterly",
  publisher: "Somebody",
  sourceUrl: null,
  staleAfterDays: 280,
  builtIn: true,
  ...over,
});

describe("the economic data parser", () => {
  it("refuses an HTML page rather than reading it as a series", () => {
    // The host answers a request for a series that does not exist with HTTP 200
    // and an error page. A connector trusting the status code stores this.
    const out = parseFredCsv('<!DOCTYPE html>\n<html><head><title>Not found</title></head></html>');
    expect(out.rows).toHaveLength(0);
    expect(out.note).toBeTruthy();
  });

  it("refuses an empty body", () => {
    expect(parseFredCsv("").rows).toHaveLength(0);
    expect(parseFredCsv("observation_date,X").rows).toHaveLength(0);
  });

  it("does not read a blank field as zero", () => {
    // Number("") is 0 and passes Number.isFinite. On a conditions gauge a
    // phantom zero is not a missing month, it is a collapse.
    const out = parseFredCsv("observation_date,X\n2026-01-01,1.5\n2026-02-01,\n2026-03-01,.\n2026-04-01,2.5");
    expect(out.rows).toEqual([
      { date: "2026-01-01", value: 1.5 },
      { date: "2026-04-01", value: 2.5 },
    ]);
  });

  it("keeps negative values, which are real readings", () => {
    const out = parseFredCsv("observation_date,X\n2026-01-01,-0.07");
    expect(out.rows[0].value).toBe(-0.07);
  });

  it("ignores rows whose date is not a date", () => {
    const out = parseFredCsv("observation_date,X\n2026-13-99xx,1\nnot-a-date,2\n2026-01-01,3");
    expect(out.rows).toEqual([{ date: "2026-01-01", value: 3 }]);
  });
});

describe("the volatility index parser", () => {
  it("reads US-ordered dates as the dates they are", () => {
    // 09/04/2026 is the fourth of September. A naive Date reading is wrong for
    // eleven days of every month and right for the rest.
    const out = parseCboeCsv("DATE,OPEN,HIGH,LOW,CLOSE\n09/04/2026,14.15,14.58,13.80,14.53");
    expect(out.rows).toEqual([{ date: "2026-09-04", value: 14.53 }]);
  });

  it("finds the closing column by name rather than by position", () => {
    const out = parseCboeCsv("DATE,CLOSE,OPEN\n01/02/1990,17.24,16.00");
    expect(out.rows[0].value).toBe(17.24);
  });

  it("refuses a table with no closing price", () => {
    const out = parseCboeCsv("DATE,OPEN,HIGH,LOW\n09/04/2026,1,2,3");
    expect(out.rows).toHaveLength(0);
    expect(out.note).toContain("closing price");
  });

  it("returns rows in chronological order whatever order they arrived in", () => {
    const out = parseCboeCsv("DATE,CLOSE\n09/04/2026,3\n01/02/1990,1\n06/15/2010,2");
    expect(out.rows.map((r) => r.value)).toEqual([1, 2, 3]);
  });

  it("refuses a page that is not the daily table", () => {
    expect(parseCboeCsv("<Error><Code>AccessDenied</Code></Error>").rows).toHaveLength(0);
  });
});

describe("freshness", () => {
  const now = new Date("2026-09-05T00:00:00Z");

  it("treats a current series as current", () => {
    const f = freshnessOf(series(), "2026-04-01", now);
    expect(f.stale).toBe(false);
    expect(f.never).toBe(false);
    expect(f.reason).toBeNull();
  });

  it("calls a series that stopped publishing stale, with the date and the age", () => {
    // The free leading-index series answers a fetch perfectly and has published
    // nothing since February 2020. Reachable is not alive.
    const f = freshnessOf(series({ frequency: "monthly", staleAfterDays: 70 }), "2020-02-01", now);
    expect(f.stale).toBe(true);
    expect(f.reason).toContain("2020-02-01");
    expect(f.reason).toContain("no longer published");
  });

  it("separates never-published from stopped-publishing", () => {
    // Two different facts. Collapsing them would hide the death of a source
    // behind a reading that has simply not been entered yet.
    const f = freshnessOf(series(), null, now);
    expect(f.never).toBe(true);
    expect(f.stale).toBe(false);
    expect(f.reason).toContain("nothing has been stored");
  });

  it("does not call a quarterly series stale for being older than a quarter", () => {
    // The corporate-equities series is dated at the quarter START and published
    // about ten weeks after that quarter ENDS, so the newest available figure is
    // routinely more than two hundred days old and entirely current. Live data
    // caught this three days from declaring the source dead.
    const f = freshnessOf(series({ staleAfterDays: 330 }), "2026-01-01", now);
    expect(f.ageDays).toBeGreaterThan(240);
    expect(f.stale).toBe(false);
  });

  it("scales every budget at once through the grace dial", () => {
    const s = series({ staleAfterDays: 100 });
    // 66 days old: inside a 100-day budget, outside a halved one.
    expect(freshnessOf(s, "2026-07-01", now).stale).toBe(false);
    expect(freshnessOf(s, "2026-07-01", now, 50).stale).toBe(true);
  });
});
