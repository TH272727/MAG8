---
name: insider-turnaround
description: Finds companies whose own officers, directors and large holders are buying stock on the open market while the shares sit in a recent, moderate drawdown — then screens out the ones whose balance sheets are failing and values the rest on Buffett-style owner earnings. Use whenever the user asks for an insider turnaround scan, wants to know who is buying their own beaten-down stock, asks about insider buying or Form 4 activity as a source of ideas, says "insider trading screener", "find insider buying turnarounds", "who's buying their own stock", or wants to check whether recent insider purchases at a specific company sit in a setup worth looking at. Establishes the user's own risk tolerance in conversation first, then runs a deterministic local pipeline and reads back its report — it never re-derives a number itself.
---

# Insider Turnaround Scanner

The bet this encodes, in the user's own words: *they know something I don't, and the
business isn't broken.* Your job is to establish what risk that person is actually
willing to carry, run the scan at those settings, and read the result back honestly —
including the parts that argue against it.

## What this is, and what you are

The scan itself is a deterministic local program. It costs nothing, calls no model, and
produces every figure from public filings and daily closing prices. **You do not compute
anything.** You establish the risk tolerance, run the command, read the generated report,
and add the qualitative layer the arithmetic cannot: what the company actually does, what
happened to it recently, whether the insider buying has a mundane explanation, and what
would make the whole idea wrong.

If you find yourself calculating a valuation, a percentage or a score, stop. That number
already exists in the report, and a second one that disagrees is worse than none.

## Step 1 — Establish the risk tolerance BEFORE running anything

This is the step that matters most, and the one it is most tempting to skip.

Almost every threshold in this scan is a statement about risk appetite rather than a fact
about markets. How far a stock may have fallen. Whether a decline that has not stopped is
disqualifying or is exactly the point. How convinced the buying must look. What return
future cash has to promise. There is no correct answer to any of them, and picking one
silently means substituting your taste for the user's.

**If the user has already said what they want** — in this message or earlier in the
conversation — use that. Do not re-ask. "I'm looking for something that's dipped, not
collapsed" is an answer. So is "I want the wreckage".

**If they have not**, ask briefly and in plain language. Three things, at most:

- How far off its highs a stock is allowed to be — a mild dip of ten or twenty percent, or
  something down half its value.
- How recent that fall has to be, and whether a stock still falling is acceptable or
  disqualifying.
- How convinced the buying should look — one purchase is fine, or several different
  insiders buying together.

Translate the answer to the nearest profile, and say which you picked:

| If they want | Use | What it means |
|---|---|---|
| A shallow dip in a sound business | `--risk conservative` | 5–25% off the high, a cluster of two or more buyers, safe solvency zone only, 40% cushion required |
| The document's own example settings | `--risk balanced` | 2–60% off the high set inside the last year, one buyer or more, 25% cushion |
| Deep falls, including ones still falling | `--risk aggressive` | 10–90% off, fallen-angel guard off, stabilisation not required, 10% cushion |
| Whatever the desk is configured with | omit `--risk` | The house setting, published on /methodology |

**If they have no preference and want a quick look, that is fine** — run the house
settings. But say plainly that is what happened, rather than presenting one person's risk
tolerance as "the" scan.

## Step 2 — Run it

```bash
npm run insider -- --board --risk balanced      # the ranked list
npm run insider -- --stock TICKER --risk balanced   # one company in full
npm run insider -- --report --risk balanced     # the whole report as markdown
```

The board prints the thresholds it actually applied at the top. Read them back to the
user; that is the record of whose risk tolerance produced the list.

If the data is stale or empty, the board says so. **An empty board means nothing was
read, not that no insider is buying anything** — never report it as the latter. Refreshing
is an operator action (`npm run insider -- --refresh --days N`); a long window takes tens
of minutes, so say so before starting one.

## Step 3 — Read it back, with the caveats attached

For each candidate worth the user's attention, cover:

- **Who bought, and what that person does.** A chief financial officer buying is a
  different statement from a fund crossing five percent. The report names them.
- **Whether the purchase was pre-arranged.** A trade the filer affirms was made under a
  plan was scheduled in advance and cannot be a reaction to anything known now. The report
  marks these; the research says routine trading predicts essentially nothing.
- **What actually happened to the stock.** The report gives the drawdown; you supply the
  reason, from search. A company down 35% after a guidance cut is a different proposition
  from one down 35% because its sector de-rated.
- **The two valuations, not one.** The scan publishes a conservative estimate and a higher
  one, because the single biggest input — how much capital spending merely maintains the
  business — cannot be read off a filing. If they are far apart, say so: that gap is the
  honest width of the answer.
- **The falsifiers.** The report lists them. Do not soften them.

Always carry these two limits, because they cut against the premise:

1. The research finding that insider purchases predict returns was **strongest in small
   companies**, and this scan draws from a mid-and-large-cap screen. The effect may be
   weakest exactly where it is looking.
2. **Most insider trading is routine and predicts nothing.** A filings feed is mostly
   noise, and the scan's discounting of pre-arranged trades is a partial answer at best.

## Step 4 — Offer the other lenses

A name that survives this scan has cleared one independent test. Offer to put it through
the others, and say why that is worth doing: independent methods agreeing is a stronger
statement than any one of them.

- `stock-scanner` — the full eight-dimension deep-dive, including the reverse-DCF that
  asks what the price already assumes, which is the complementary question to the one
  asked here.
- `gt-predictor` — whether anything structural is moving in the company's direction.
- `institutional-forecast` — what the large institutions currently say, which is the view
  this scan is implicitly betting against.

Do not run them unasked. Offer, and let the user choose.

## Never

- Never recompute a figure the report already contains.
- Never present the house settings as the correct or default risk tolerance.
- Never describe an insider purchase as an endorsement of the company by that insider, or
  imply they are aware of this analysis. It is a legally required disclosure of what they
  did with their own money.
- Never drop the disclaimer to save space. This is the closest thing this project produces
  to an individualised buy signal, and it carries the disclosure for that reason.

## References

- `references/data-sources.md` — where every figure comes from, and what each source can
  and cannot be trusted for.
- `references/parameters.md` — every threshold, its example default, and the flag or dial
  that overrides it.
- `references/bibliography.md` — the evidence base, generated from the platform's citation
  registry. Read it when the user asks why any of this should work.
