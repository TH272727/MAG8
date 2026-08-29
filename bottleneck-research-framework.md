# The Bottleneck Framework

*Reverse-engineered from an Instagram reel, then generalized into a repeatable research process.*

## At a glance

The reel shows four prompts chained together. Generalized, they become four modules:

| Module | What it does | Works on |
|---|---|---|
| **A — Institutional clone** | Pull any manager's public SEC 13F holdings, resize them to your own account | Any 13F filer |
| **B — Demand quantification** | Turn a company's dollar-denominated spending/guidance into physical units | Any capex- or guidance-driven story |
| **C — Supply reality check** | Compare those physical units against real-world production/export data to find the tightest constraint | Any theme with a traceable physical value chain |
| **D — Exposure audit** | Check your own portfolio against whatever bottleneck Module C finds | Any portfolio |

A and B→C→D are two separate techniques the reel happens to show back to back — cloning a filer doesn't require doing the demand/supply analysis, and vice versa. Module D can draw from either.

---

# Part 1 — What's actually happening in the reel

A few words in the screenshots are physically covered by the creator's face or the app's UI. Where that happens below, it's marked — everything else is read directly off the screen.

### Who's being cloned

The CIK partially visible in Prompt 1 — `0002045724` — belongs to **Situational Awareness LP**, the AI-infrastructure hedge fund launched in 2024–2025 by Leopold Aschenbrenner (formerly of OpenAI's Superalignment team, author of the widely-read "Situational Awareness" essay series on AGI timelines). Its public 13F filings show a book concentrated in the physical layer of AI — power, memory, data-center and compute-adjacent names — sitting alongside a very large options overlay (multi-billion-dollar notional call and put positions layered on top of the long stock). That heavy derivatives overlay is almost certainly what the creator means by "overleveraged" — worth knowing, because Prompt 1 below explicitly discards it ("just want the long stock"), which understates how the fund is actually positioned. The generalized version in Part 2 fixes that.

### Prompt 1 — "Clone his book"

1. Pull the fund's latest Form 13F-HR from SEC EDGAR by CIK.
2. Read the information table: for every holding, get the ticker, share count, dollar value, and whether it's a plain share, a call, or a put.
3. Drop the options — keep only the long stock.
4. Work out what percent of the fund's book each name represents, then apply those same percentages to *your* account balance to size a parallel position.
5. Output an order list. *(The bottom of this step is cut off in the screenshot, but between the visible "do not plac—" and the creator's own "not financial advice, I'm an AI guy not a finance guy" framing, this reads as an explicit instruction not to auto-place the trades — just produce the list for review.)*

This is a version of a well-known (and imperfect) strategy: 13F shadowing. The catch is baked into the SEC's own rules — a 13F is filed up to 45 days after quarter-end, so you're always trading a stale snapshot.

### Prompt 2 — "What are they buying, in real things"

This one's fully legible, no reconstruction needed.

1. Pull the latest quarterly filing (10-Q or 10-K) for Microsoft, Amazon, Google, Meta, Oracle, and Nvidia from SEC.gov.
2. For each: how much are they spending on data centers this year, did it rise since last quarter, and quote the exact sentence explaining why.
3. Convert those dollars into physical things — megawatts of power, gigabytes of memory, square feet of building, gas turbines. Show the working.
4. Save the result to a dated record.

This is the actual trick, and it's the part worth stealing regardless of what you think of the fund in Prompt 1: turning a capex number that's easy to hand-wave about ("they're spending billions!") into a physical claim you can go check.

### Prompt 3 — "Can the world make that much"

1. Check whether the physical quantity from Prompt 2 can actually be produced.
2. Pull Korea's monthly memory-chip export figures and Taiwan's monthly export orders data. *(The middle of this step is obscured; the visible fragments — "the queue is to connect a new," "order backlog for gas turbines" — read as checking grid-interconnection queues and gas-turbine delivery backlogs, which lines up with the rest of the step.)*
3. Compare all of it against whichever input has the least room to grow — i.e., find the tightest constraint.
4. Explain in plain English what the bottleneck is and who owns it.
5. Compare against last month's version of this same check to see whether the bottleneck is tightening or easing.

For a sense of how real this specific example is: GE Vernova's gas-turbine backlog reached 116 GW at the end of Q2 2026, up from 100 GW the prior quarter, with new orders now booking into 2031. Lead times for new combined-cycle plants have stretched from roughly 3.5 years in 2023 to five-plus years today, and the bottleneck is structural — a limited number of specialized foundries cast the hot-section blades, and the skilled welders and machinists laid off in the 2010s were never fully replaced. That's exactly the kind of thing Prompt 3 is trying to surface — not a vague "supply chain issues" narrative, but a specific, named, checkable constraint. (Figures as of when this was written — refresh them before relying on them.)

### Prompt 4 — described but never shown

The transcript mentions a fourth step: run a prompt that looks at your own portfolio and reports how exposed you are to whatever bottleneck Prompt 3 found. It never appears on screen, so this is reconstructed from narration alone — but it's the natural close to the loop, and Part 2 builds it out fully as Module D.

---

# Part 2 — The generalized framework

### The core idea

Any time a company or sector is riding a growth story, that story implies a physical quantity of *something* — power, chips, square footage, labor, raw material — somewhere in the chain. Dollars are elastic; physical quantities aren't. A capex number can be revised upward with a press release. A gas turbine takes five years to build regardless of what anyone announces. This framework's only real job is forcing a dollar story back into physical units so it can be checked against something that can't be talked into existing faster.

### Module A — Institutional clone

Generalized, this works for any manager who exceeds the $100M threshold that triggers 13F filing — Berkshire Hathaway, Pershing Square, Scion, Duquesne, or a niche fund like the one in the reel.

1. Pick a filer.
2. Find their CIK (name search on EDGAR).
3. Pull the latest 13F-HR and the one before it.
4. Choose a view: long-only clone, options-inclusive view (don't default to discarding the hedges — see the note on Situational Awareness above), or diff-only ("what did they add or trim this quarter").
5. Size against your own capital. Output a reviewable list. Never auto-execute.

**Blind spots to keep in mind:** 13F doesn't capture short positions, non-US-listed securities, or most OTC derivatives and swaps — you're only ever seeing the long, US-listed, exchange-traded slice of a manager's book. And it's up to 45 days old by the time you see it.

### Module B — Demand quantification

The "capex → physical units" trick isn't specific to data centers. General template:

1. Find the biggest, most-disclosed dollar signal for your theme — capex guidance, unit or production guidance, backlog, reserved-capacity commitments, a government spending bill.
2. Track how it's changing quarter over quarter and year over year, and pull the company's own explanation for why.
3. Convert the dollars into the actual physical inputs that money has to buy. This step is sector-specific and needs a conversion-factor table you build and source yourself — see the table below for starting points.
4. Save a dated snapshot.

### Module C — Supply reality check

1. For each physical input from Module B, find the best real-world proxy for how much of it can actually be produced or supplied, and how fast that's growing — trade data, industrial production stats, disclosed capacity-expansion plans, backlogs and lead times, permitting timelines, labor supply.
2. Compare growth rates: demand growth vs. supply growth, per input.
3. The input with the biggest gap — or the hardest physical ceiling — is your bottleneck.
4. Map the bottleneck to the companies that actually control or produce it. These are frequently less obvious, less crowded names than whatever's on the headline chart — "picks and shovels," but arrived at with data instead of a vibe.
5. Re-run this periodically. A widening gap means the bottleneck is intensifying (typically good for whoever owns it, via pricing power). A narrowing gap means it's easing — new supply is catching up, and any scarcity premium is at risk. The framework should tell you both, not just the bullish one.

### Module D — Exposure audit

1. Take your actual holdings (or the cloned fund's holdings from Module A).
2. Cross-reference against the bottleneck-owner list from Module C.
3. Compute $ and % exposure per bottleneck category.
4. Flag concentration or gaps relative to your own conviction.

---

### Sector playbook table

The AI-infrastructure example in the reel is one instance of a pattern that shows up anywhere there's a physical value chain behind the growth story:

| Sector / theme | Demand signal to pull | $ → physical conversion | Supply-side data to check | Who typically owns the bottleneck |
|---|---|---|---|---|
| AI infra / hyperscale compute | Big Tech data-center capex guidance (10-Q/10-K, earnings calls) | $ → MW of critical IT load, GB of memory/storage, sqft of shell space, turbine units | Korea's trade ministry monthly semiconductor export data, Taiwan's export-orders series, gas-turbine OEM backlogs | Memory makers, leading-edge foundries, turbine OEMs, power utilities/IPPs, transformer makers |
| Power & grid buildout | Utility/IPP capex plans, data-center interconnection announcements | $ → MW of new generation/transmission, miles of line, # transformers | Transformer lead times, utility interconnection-queue backlogs, national generation-capacity data | Transformer/switchgear makers, turbine OEMs, transmission EPC firms |
| EVs & battery supply chain | Automaker + battery-maker capex and production guidance | $ → GWh of cell capacity → tonnes of lithium/nickel/cobalt needed | National mineral-production data, mining export statistics, refining-capacity utilization | Lithium/nickel/cobalt miners and refiners, cell makers |
| Homebuilding & construction | Builder unit-closing guidance, permit/start data | $ → board-feet of lumber, labor-hours, tons of concrete/steel | National housing starts/permits, lumber production and futures, construction employment data | Lumber and building-products producers, cement/aggregates |
| Aerospace & defense | Airline capacity growth guidance, backlog disclosures | $ → # aircraft, # engines, pilot-hours needed | Aircraft-maker delivery backlogs and production rates, engine-OEM delivery data | Engine OEMs, structures/composites suppliers |
| Pharma / biologics manufacturing | Pipeline + launch guidance, addressable patient population | $ → bioreactor liters of manufacturing capacity, doses needed | Contract-manufacturer (CDMO) capacity utilization and expansion announcements | Large-scale CDMOs, bioprocessing equipment/consumables makers |
| Shipping / logistics | Retail/e-commerce volume growth, reshoring capex | $ → TEUs of container capacity, sqft of warehouse | Port throughput, shipyard orderbooks, warehouse vacancy rates | Shipbuilders, port operators, warehouse REITs |

### A worked example in a different sector

Quick proof this isn't just the AI trade wearing a trench coat: run the same four modules on EV batteries. Demand = combined EV-maker and battery-maker capex and production guidance, converted to GWh of planned cell capacity, then converted again (using a sourced, editable GWh-to-lithium ratio) into tonnes of lithium carbonate equivalent needed. Supply = national mineral-production data and mining-export statistics out of Chile, Argentina, and Australia. Through 2021–2022 this comparison would have flagged lithium mining and refining capacity as a real, tightening bottleneck. By 2023–2024, new supply — especially Australian hard-rock output and expanded Chinese processing — had caught up with and then outpaced a slowing rate of EV demand growth, and lithium prices fell hard. Same four modules, same mechanics, and this time the honest output is "bottleneck easing" rather than "bottleneck tightening." That's the point: the framework is supposed to tell you when a squeeze is over, not just when one's starting.

### Limitations, stated plainly

- **13F lag and blind spots** apply to Module A regardless of which filer you pick — see above.
- **Conversion factors are estimates.** The $-to-physical-units step in Module B is only as good as the assumptions behind it. Source them, date them, and revisit them — don't treat a $/MW or $/GWh figure as a fact.
- **A confirmed bottleneck isn't automatically a mispriced stock.** The market may already know about it. This framework generates candidates for further valuation work; it doesn't replace valuation.
- **Data quality varies a lot by sector and country.** Not every theme has a clean "Korea chip exports"-style proxy sitting in a government press release. Some sectors will need a noisier proxy or more manual digging.
- **This is a research tool, not financial advice**, and nothing here should be read as a recommendation to buy, sell, or clone any specific fund's positions.
