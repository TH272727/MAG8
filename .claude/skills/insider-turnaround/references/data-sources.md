# Where every figure comes from

All of it is free, keyless and public. Nothing here is a licensed market-data feed, and
the limits below are real rather than boilerplate.

## Insider transactions — SEC EDGAR

**The daily index.** One file per trading day listing every filing accepted that day. It
emits one row per *filer*, so a single filing appears once under its issuer and once under
each reporting owner: on 2026-08-28, 811 rows covered 382 distinct filings. Because 381 of
those 382 had a row whose identifier belongs to a listed company, the company can be known
before a single document is opened — which is what makes the scan affordable.

**The filing.** The complete submission text file carries both the header and the inline
ownership XML, so one request of about twelve kilobytes reads a whole filing.

Two things about the format that will produce a wrong number if ignored, both observed in
one ordinary day's filings:

- The pre-arranged-plan affirmation arrives as `1`/`0` from some filing agents and
  `true`/`false` from others. Comparing against `"true"` reads a genuinely scheduled
  purchase as discretionary — the higher-conviction reading.
- A filing can name several reporting owners, and its purchases were made once by the
  group. Counting them per filer multiplies the dollars by the number of filers.

**And one about the transport:** an absent daily index is answered with 403, not 404 —
every weekend, every market holiday, and the current day before publication. Read as the
"bad credentials" that 403 means everywhere else on this service, a sixty-day walk
declares a broken configuration seventeen times over ordinary weekends.

Only transaction code `P` with an acquisition counts as a buy. Grants, option exercises,
gifts and shares withheld to pay tax on an exercise are all things that happened *to* the
insider rather than decisions to spend money at the going price.

## Financial statements — SEC XBRL company facts

One request per company returns every structured figure it has ever filed. Two traps:

- **Filers migrate tags between years.** Ford reported one fiscal year's revenue under
  `Revenues` and the next under `RevenueFromContractWithCustomerExcludingAssessedTax`.
  Taking the first tag that has any rows loses the most recent year in silence. The whole
  chain is merged instead, and a comparison spanning two labels is disclosed.
- **Share counts are not dated at the fiscal year end.** They sit on the cover of the
  annual report, weeks later, so an exact date match finds nothing for most large filers
  and the dilution criterion silently goes unscored for the most complete filings.

Coverage is roughly three quarters to four fifths of the companies in the band. A company
filing under a foreign regime has no US-GAAP statements at all; that is reported as
unmeasured, never as a failure.

## Prices — two independent sources

A primary source returning closes **adjusted** for distributions, and an independent
fallback returning **raw** closes. Neither is an official market record.

Because a drawdown is a percentage between two prices, a series whose early years are
adjusted and whose recent ones are not has a discontinuity that reads as a real move. So
each stored close records its basis, a source change replaces a company's history rather
than merging it, and a company still carrying a mixed basis is flagged.

The fallback must be told which kind of instrument it is being asked about. Asked for a
common share as though it were a fund, it answers "Symbol not exists" — not an error, no
series, no message.

Both sources have gaps. On 2026-08-28 the primary returned a wholly empty row for every
company. That session is skipped rather than filled with a zero, which is why every window
here is defined in calendar days rather than session counts.

## Market values — the weekly screen

Taken from this platform's own weekly snapshot rather than a live quote, so every company
in one scan is valued as of the same moment. A score built from a price fetched at a
different time than its neighbour's is not comparable with it, and the comparison is the
entire point.

## What none of this can do

These are free-tier public endpoints with real reliability and terms-of-use limits. They
are appropriate for personal research and would need revisiting against a licensed feed
before anything is built on them commercially — a point the project's own brief already
makes about the platform generally, and which applies here more than anywhere else,
because this is the closest thing the project produces to an individualised buy signal.

**Not financial advice.** Insider transaction data is the legally required public
disclosure of company insiders' own trades. It is a record of what they did with their own
money, not advice to mirror them, and nothing produced here implies any insider is aware
of or endorses the analysis.
