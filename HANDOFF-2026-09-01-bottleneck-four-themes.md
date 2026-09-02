# HANDOFF 2026-09-01 — Bottleneck desk: four researched themes

Owner ask: *"adding onto the bottleneck feature i want to add a few big major industries, i want the
same quality of research to be done using these industries: government filings, official company
reports, the most accurate, validated, reliable, reputable information. here are the industries:
drones, robotics, quantum, nuclear energy."*

Branch `feat/rotation-board` (unpushed, as the desk and board before it). No new routes, no new
tables, no new settings. The desk went from three themes to seven.

---

## 1. What shipped

Four built-in playbooks in `lib/bottleneck/playbook.ts`, each with conversion factors read out of a
**primary document this session** rather than seeded:

| theme | id | basket | measures |
|---|---|---|---|
| Drones | `drone-industrial-base` | AVAV KTOS RCAT ONDS UMAC AIRO | capital spending |
| Robotics | `robotics-automation` | ROK EMR TER ZBRA CGNX NDSN | capital spending |
| Quantum computing | `quantum-computing` | IONQ RGTI QBTS QUBT | **research and development spending** |
| Nuclear energy | `nuclear-energy` | CEG BWXT LEU OKLO SMR TLN | capital spending |

Plus one schema addition, `demand.measure`, described in §4.

### The conversion factors, and where each number came from

Every one of these was read out of the document named in its own `source` field, in this session.
Where arithmetic is mine, both inputs and the division are stated so a reader can redo it.

**Drones**
- `uas_system` **$263,029** per small uncrewed aircraft system — US Army FY2026 President's Budget,
  *Aircraft Procurement, Army* justification book (June 2025), P-1 Line 5: $250.141M of FY2026 base
  procurement for 951 systems (265 SRR Tranche 2 + 500 PBAS + 85 Company-Level SUAS DR + 101 LRR).
- `ndpr_kg` **$69** per kg — USGS *Mineral Commodity Summaries 2026*, Rare Earths: average price,
  NdPr oxide 99% minimum, 2025 estimate.
- `assembler_year` **$71,420** — BLS OEWS May 2025, Aircraft Structure/Surfaces/Rigging/Systems
  Assemblers (SOC 51-2011) mean annual wage; 34,020 employed nationally.

**Robotics**
- `robot_unit` **$61,198** per industrial robot — A3 Robotics Industry Statistics, full-year 2025
  (published Feb 2026): 36,766 robots ordered in North America valued at $2.25 billion.
- `ndpr_kg` **$69** — same USGS chapter.
- `mechatronics_year` **$76,420** — BLS OEWS May 2025, Electro-Mechanical and Mechatronics
  Technologists and Technicians (SOC 17-3024); **15,520 employed nationally**.

**Quantum computing**
- `helium_mcf` **$330** per thousand cubic feet — USGS *MCS 2026*, Helium and Rare Gases: estimated
  base price for Grade-A helium in 2025 (~$12/m³). The same chapter is the citation that ties
  helium-3 to quantum computing by name.
- `physicist_year` **$171,180** — BLS OEWS May 2025, Physicists (SOC 19-2012); **20,430 employed
  nationally**.

**Nuclear energy**
- `nuclear_mw` **$7,861,000** per MW — EIA (prepared by Sargent & Lundy), *Capital Cost and
  Performance Characteristics for Utility-Scale Electric Power Generating Technologies*, January
  2024, Table 1-2 Case 9: Advanced Nuclear (Brownfield), 2 × AP1000, 2,156 MW net = $7,861/kW in
  **2023 dollars, overnight** (the same table prices a 6 × 80 MW SMR plant at $8,936/kW).
- `u3o8_lb` **$58.46** — EIA *Uranium Marketing Annual Report* (released 29 July 2026): 2025
  weighted-average price paid by owners/operators of US civilian reactors.
- `swu` **$108.70** — same report: 2025 average price for enrichment services; 13 million SWU
  purchased from **four** sellers.

### Live readings, 2026-09-01 (persisted; `npm run bottleneck -- --refresh <id>`)

| theme | contributing | TTM | YoY | tightest constraint |
|---|---|---|---|---|
| Drones | 6/6 | $190.2M | +62.4% | aircraft assembly labour, **+61.7pp** |
| Robotics | 6/6 | $1.07B | +36.6% | industrial robots, **+36.5pp** |
| Quantum | 4/4 | $630.5M | +60.8% | physicist-years, **+60.2pp** |
| Nuclear | 6/6 | $4.60B | +90.2% | pounds of U3O8, **+89.4pp** |

Two readings are worth staring at because the factor and the national headcount are from the same
BLS file: robotics spending implies **13,959 technician-years against 15,520 mechatronics
technicians in the entire United States**, and quantum research spending implies **3,683
physicist-years against 20,430 physicists**.

Nuclear's `swu` correctly reports **insufficient-data** and ranks last: EIA publishes enrichment
supply annually, not as a feed, so the series is a named stub. Absence of a supply series is not
evidence that an input is unconstrained, and the desk says exactly that.

**Flagship regression held byte-identical** after the shared series ids gained writers from other
themes: AI infrastructure still reads $573.72B TTM, +85.7%, MW +81.9pp, memory +68.7pp.

---

## 2. Findings — each one a confident wrong number, avoided or fixed

1. **The Army budget division trap.** A web summary of the same budget page reported
   `$34.368M ÷ 265 = $129,681` per SRR system. The page actually says that line buys **265 SRR
   systems *and* 500 PBAS systems** — the division is wrong by roughly 3×. The figure used here is
   the whole line item over the whole quantity, and the check that the reading is complete is that
   the three quoted sub-lines ($34.368M + $90.582M + $125.192M = $250.142M) sum to the stated
   $250.141M.
2. **Red Cat is the third instance of the tag-migration bug** this repo has met (after Ford and
   AMZN/NVDA). `PaymentsToAcquirePropertyPlantAndEquipment` holds 14 quarters that stop at
   **2019-07-31** — the predecessor shell — while `PaymentsToAcquireProductiveAssets` carries 27
   quarters through 2026-06-30. First-populated-wins would have published **$3,000**; freshest-wins
   reads **$18.6M** and the desk discloses the migration. The existing machinery caught this on a
   basket it was never designed against, which is the useful part.
3. **Three government hosts, three opposite User-Agent rules.** `asafm.army.mil` 403s a plain
   identifying UA *and* WebFetch, and serves the PDF only to full browser headers
   (Accept / Accept-Language / Referer / Sec-Fetch-*). `comptroller.war.gov` serves the same class
   of document to an honest UA. FRED **hangs** on a spoofed `Mozilla/5.0` and answers an honest one
   (already known, re-confirmed — its series pages need the honest UA too, not just the CSV).
4. **The Census international-trade API now requires a key** — every data query answers
   `Missing Key`, while `variables.json` still answers. That kills the cleanest available
   government unit-value route: HS 8806 (unmanned aircraft) and HS 8479.50 (industrial robots)
   carry both customs value and unit counts. Both are shipped as named stubs, not wired.
5. **DOE publishes no helium-3 price.** `isotopes.gov` lists He-3 with a quote form and no figure,
   and the "supply and demand" page gives quantities but no price; the widely-quoted $600
   (government) / $1,000 (commercial) per litre traces to a magazine, not to DOE. So helium-3 is a
   **supply stub**, not a conversion factor — the desk names the constraint without pricing it.
6. **`CAPG3364S` does not exist.** FRED publishes an aerospace *output* index but no aerospace
   *capacity* index. Found by probing every candidate id rather than assuming the G.17 naming
   convention held; the drone theme reads that constraint from output alone and says so in a comment
   and in the series label. (`CAPG3345S` and `CAPG3251S` are likewise absent; `CES6054170001`, the
   obvious id for scientific R&D services employment, is not on FRED either, so the quantum theme
   uses the broader professional/scientific/technical services series and labels it as broader.)
7. **Symbotic stopped tagging capital spending after 2024-12-28** — checked across all eight of its
   `Payments*` tags, not just the playbook chain. It is the most robotics-pure US company and it is
   deliberately *not* in the basket, because it would contribute a staleness flag and nothing else.
   It is in the owner map instead.
8. **My own fallback bug, caught by rendering the page rather than by a test.** `demand.measure ??
   "Capital spending"` mislabelled homebuilding's *existing* stored snapshot as capital spending —
   the precise inaccuracy the field was added to remove. The fallback now uses the playbook's own
   measure, so a reading taken before the field existed still gets named correctly.
9. **A rounded factor in the working shown.** The CLI printed `$4.60B / $58 per unit` for a
   $58.46/lb factor — a reader who checks that arithmetic finds it wrong. `usd()` now keeps cents
   below $1,000. (The web page was already correct: `fmtUsd` keeps two decimals under $1,000.)
10. **Ticker collision check.** `ATS` resolves to CIK 1394832 "ATS Corp /ATS". Confirmed via raw SEC
    submissions to be SIC 3569 (General Industrial Machinery), NYSE, filing 6-K — the Canadian
    automation company, not the defunct US IT-services firm of the same name. All 42 tickers across
    the four baskets and owner maps were resolved against SEC before shipping.

---

## 3. Not claimed, and why

- **Robotics unit price is A3's, not a government statistic.** No US agency publishes a per-robot
  price; the Census route in finding 4 is the one that would, and it is gated. A3 is the standard
  reference for North American robot orders, publishes units and dollars together for free, and the
  factor's note gives the collaborative-robot sub-figure (7,212 units / $241M ≈ $33,400) so a reader
  can see how hard the mix moves the number.
- **Nothing was added to the citation registry.** `lib/citations.ts` is a registry of *academic
  works*; a budget justification book and a commodity summary are primary data, not papers, and
  filing them there would misrepresent both. The homepage chip stays at 64.
- **The three original themes still carry placeholder factors.** That is unchanged and still
  disclosed — and `/methodology` now says "4 of 7 themes have had that work done" and names them,
  so the placeholder note cannot be read as covering the whole desk.

---

## 4. `demand.measure` — the schema addition

Not every theme's demand *is* capital spending. Homebuilders capitalize their build into inventory
(the desk has read that since August), and a research-stage industry spends through the income
statement — quantum's tag chain leads with `ResearchAndDevelopmentExpense`, verified to return
discrete reported quarters for all four filers.

So `demand.measure` (default `"Capital spending"`) names what the tag chain measured, is **carried
on the demand snapshot** so a stored reading keeps the label it was taken under, and replaces the
hardcoded phrase in four places: the desk page's demand paragraph, three disclosure flags in
`demandFlags`, the CLI's per-company table header, and the admin panel's basket line. The page's
meta description now says "disclosed spending" rather than "disclosed capital spending".

---

## 5. New invariants, pinned by tests (`tests/bottleneck/playbook.test.ts`)

- **A shared series id means the same series everywhere it appears.** Series ids key one global
  observations table, so ids are reused deliberately here — the chemical, electric-power,
  electrical-equipment and rare-earth series each serve two themes, and reuse means one fetch and
  one history. Declaring the same id with a different handle or unit would silently mix two
  measurements into one history and raise no error. Now a test failure.
- **Every FRED series carries a handle** (the connector's first line is `if (!series.handle) return
  []` — a typo'd omission would return nothing, forever, in silence).
- **Every conversion unit has at least one series that could measure it**, or it can never be scored
  and ranks last forever.
- The researched figures are **pinned by value**, so editing one has to be a deliberate re-reading
  of the document rather than a tweak; every researched source string must exceed 40 characters and
  name a year.
- Owner tickers are uppercase and unique within a group.

---

## 6. Gates

`npx tsc --noEmit` clean · `npm run test` **639 passed** (was 592) · `npm run seed` EXACT
(ASTS 90.3 … ACHR 19.3 #8) · `npm run gen:bib` no-op · `npm run build` clean · `npm run bottleneck
-- --probe` ALL CHECKS PASSED · leak probe **0 architecture hits** across 18 rendered surfaces
including all seven theme pages and `/methodology` (only the 2 owner-approved homepage
"26 AGENTS" strings, on `/` alone) · curtain guard unchanged (the four themes are query parameters
on the already-guarded `/bottleneck` page, so no new route needs one) · separation contract intact
(no new tables, no pipeline imports).

---

## 7. Open

1. **The three original themes' placeholder factors.** Same job, one theme at a time: AI
   infrastructure needs a sourced $/MW of critical IT load, $/GB and $/sq ft; EV batteries needs a
   sourced $/GWh (its `lce_tonnes` factor is two estimates multiplied and says so); homebuilding
   needs a sourced $/board-foot and loaded trade wage — the last is now easy, since BLS OEWS is
   already proven reachable and parsed.
2. **Enrichment (SWU) has no automated supply series.** EIA publishes it annually. Hand-entered
   points via the desk's admin controls would score it; nothing else will.
3. **Never seen at 375px.** Headless Chrome and Edge return an empty DOM in this environment (known
   since 2026-08-30). Structural check only: the theme chip row is `flex-wrap` and now carries seven
   chips; source URLs render as `href`s, never as visible text, so no unbreakable token was added.
4. **Census unit values** (finding 4) are the single best upgrade available if an API key ever
   becomes acceptable — they would give government-published $/drone and $/robot with value and
   quantity from the same row.
5. The four new themes have **one reading each**, so tightening/easing against a prior reading needs
   a second refresh. That is normal and the desk says so.
