---
name: gt-predictor
description: >
  Game theory prediction engine: forecasts geopolitical, monetary, and macro events 3–24 months ahead, then maps predictions to mispriced financial assets with asymmetric upside. ALWAYS trigger for: wars, regime changes, sanctions, alliance shifts; Fed/CB policy trajectories (trapped, debasement, currency crises); trade war and tariff escalation; deglobalization and de-dollarization plays; resource scarcity and commodity supply disruptions; election outcomes; finding least-priced-in assets before structural shifts. Trigger phrases: "predict X", "GT analysis", "game theory analysis of X", "what does game theory say about X", "where is X heading", "who wins in X scenario", "what's the market missing about X", "run GT on X", or any geopolitical risk and investment question. Outputs: player maps with M×E×C scoring, dominant strategy analysis, 3/6/12/24-month probability forecasts, tiered asset implications with Asymmetry Scores (1–10), entry windows, falsification conditions, and leading indicator calendars.
---

# GT Predictor: Game Theory Event Forecasting & Asset Mapping

A structured forecasting engine that combines formal game-theory reasoning with a set of structural macro lenses, then maps the resulting probabilities to assets that may be mispriced relative to that read. It works by anchoring on the outside-view base rate for a situation, then adjusting with player constraints, structural forces, and current data — and it scores its own hit rate over time so the edge is measured, not assumed.

**The intended edge:** most commentary reasons purely from the specifics of a case ("here's what's happening, here's what I think comes next"), which reliably produces overconfident, narrative-driven calls. This skill forces the discipline that actually improves forecasts: start from how often situations like this resolve a given way, adjust deliberately, express the answer as a probability, and check later whether you were right.

**What it is not.** It does not tell you what *must* happen — geopolitical and macro outcomes are irreducibly uncertain, and anyone claiming structural certainty is selling a story. Every output is a probability with explicit uncertainty, a stated base rate, and falsification conditions. It is analysis to inform your own research and decisions, not personalized financial advice, and Claude is not a financial advisor.

**One structural caution, built in.** The macro lenses below tend to point toward the same conclusions (hard assets, short duration and richly-valued tech). That convergence is a bias risk, not a confirmation. The largest forecasting tournament on record found that reasoning through one dominant framework ("hedgehog" thinking) produces *worse* accuracy than blending many independent perspectives ("fox" thinking). So this skill deliberately requires a base rate and an argued opposing case before the lenses are applied — treat the framework as several inputs among many, never as a master key.

---

## Reference Files — Load When Relevant

Before running analysis, decide which reference files to load:

| File | Load When |
|---|---|
| `references/prediction_log.md` | **Load on every run.** Base-rate / outside-view procedure, probability calibration, and the Brier-scored prediction log. This is the accountability layer — it's not optional. |
| `references/source-standard.md` | **Load on every run, alongside `prediction_log.md`.** The source-quality bar for Step 2's live grounding: which material may move a probability and which is only a lead to verify. |
| `references/gt_laws.md` | Need detailed law application, historical analogues, mathematical formulations |
| `references/asset_map.md` | Mapping predictions to specific instruments, ETFs, sector rotation |
| `references/event_templates.md` | Running a specific event type (war, CB policy, regime change, trade war, etc.) |
| `references/scoring_rubric.md` | Calculating Asymmetry Score, M×E×C scoring, confidence calibration |
| `references/bibliography.md` | ONLY if the user asks about the evidence base / methodological grounding — not needed for a normal run |

For a full deep-dive prediction, load all six. For a quick situational read, load `prediction_log.md` (for the base-rate step) + `source-standard.md` + `gt_laws.md` + `asset_map.md`.

---

## The Seven GT Framework Laws (Quick Reference)

Consider all relevant laws — most situations engage 2–4 at once. **Read these as heuristics stated in strong shorthand, not literal certainties.** Words like "always," "near-certain," and "the market is always wrong" below are compressions of a tendency, not guarantees; each law is one input to weigh against the base rate and the opposing case, and any of them can be wrong in a given situation. The "investment signal" lines are directional hypotheses to test, never instructions.

**1. Universal Law** — Victory = Mass × Energy × Coordination
Coordination is 4× more important than mass; energy is 2× more important than mass.
→ *Investment signal: the actor with superior coordination always wins eventually, even against larger empires*

**2. Law of Asymmetry** — The underdog has structural advantages: motivation, geography, guerrilla tactics, nothing-to-lose energy. Empires decay through hubris, elite overproduction, and internal factionalism.
→ *Investment signal: bet against imperial overextension; resource-controlling locals beat occupiers*

**3. Law of Escalation** — Conflicts always escalate further than consensus expects. Control > Dominance. Calibration = strategic flexibility. You cannot skip rungs on the escalation ladder.
→ *Investment signal: price in more escalation than the market does; the "priced in" narrative is almost always wrong*

**4. Law of Eschatological Convergence** — Actors follow narrative scripts. These scripts are the operating system of their civilization. When multiple scripts converge on the same outcome, that outcome becomes near-certain.
→ *Investment signal: identify script convergence points months before they trigger; those are the highest-conviction trades*

**5. Law of Proximity** — Geography determines winners. Whoever controls resources near the conflict controls the outcome. Remote power projection degrades with distance.
→ *Investment signal: local resource controllers win; long the nearby hard assets*

**6. Elite Overproduction Cycle** (Peter Turchin) — When elite count grows faster than elite positions: polarization → dysfunction → crisis → debasement. Civilizations follow this cycle with predictable timing.
→ *Investment signal: a nation exhibiting Stage 3–4 overproduction symptoms is entering currency debasement/hard asset cycle*

**7. The Game Masters Layer** — Transnational capital (BIS, IMF, major investment banks, tech oligarchs) operates as a player tier above nation-states. They shape the game board, not just play on it. Their moves are visible through: unusual institutional positioning, policy coordination signals, major delegation compositions, and financial infrastructure shifts.
→ *Investment signal: follow institutional positioning before public narrative shifts; it's the earliest signal*

---

## The Three Structural Theses (Assess Live — Do Not Assume)

These are the macro background lenses. They are hypotheses to test against current data every run, **not** standing facts — and critically, none is guaranteed to be "on." A regime can flip: a debasement thesis can invert into a tightening/hawkish one within a couple of FOMC meetings; de-dollarization can stall or reverse. Before using any of these, pull current readings and decide whether the thesis is actually active *right now*.

| Thesis | What to pull live before invoking it | If active, historical beneficiaries* |
|---|---|---|
| **De-dollarization** | Dollar index trend, reserve-share data, cross-border settlement developments, central-bank gold flows | Gold and gold royalties, select miners, other reserve-diversification assets |
| **Monetary debasement / easing** | Current policy-rate path *and its direction*, real yields, inflation prints, balance-sheet trend, who chairs the central bank and their stance | Gold, silver, TIPS, real-asset producers |
| **Deglobalization** | Trade-growth data, tariff/export-control actions, reshoring announcements | Domestic manufacturers, aggregates/materials, defense, domestic energy |

*Beneficiaries are illustrative categories, not recommendations; confirm each still fits once you've established the thesis is live.

**Guard against the standing-narrative trap.** Do not walk in assuming "debasement is confirmed, buy gold." Check the current stance first. If the central bank is holding or *hiking* into an inflation shock, the debasement lens may be inactive or inverted, and forcing it anyway is exactly the hedgehog error this skill is built to avoid.

---

## Step-By-Step Prediction Workflow

### Step 1: Parse the Query

Identify:
- **Subject**: What event/situation/asset is being analyzed?
- **Horizon**: 3mo / 6mo / 12mo / 24mo (default: all four)
- **Mode**: Full prediction report / Quick situational read / Asset-only query / Falsification check

Load relevant reference files based on event type (see table above). Always load `prediction_log.md` — Step 2 depends on it.

---

### Step 2: Ground in Current Data, Establish the Base Rate, and Steelman the Opposing View

**This step is mandatory and comes before any law is applied.** It is the single biggest defense against the two ways this skill can fail: reasoning from a stale snapshot, and funneling every situation toward the same pre-baked conclusion.

**A. Ground in current data (web search — do not skip).**
Nothing in the reference files is a current reading. Before analyzing, retrieve the present state of the world for this question and stamp the output with the retrieval date:
- Current status of the event/situation (latest developments, who holds which position now)
- Current price and recent trajectory of every instrument you might name
- The current policy/rate/inflation regime *and its direction* (easing vs. tightening — do not assume)
- Current positioning where available (COT, ETF flows, notable institutional moves)
- Any leadership or regime change that alters the players (e.g., a new central-bank chair)

If you cannot verify a fact live, say so and lower confidence — do not fill the gap with a remembered number.

**B. Establish the base rate (outside view) — before the laws.**
Following the reference-class procedure in `prediction_log.md`: pick a class of past situations similar to this one, find how often they resolved the way you're about to forecast, and write that base rate down. This is the most evidence-backed forecasting move there is, and it exists precisely to stop the vivid, case-specific narrative the seven laws generate from producing overconfident calls. Anchor here first; the laws and current data are *adjustments* from this anchor, not replacements for it.

**B2. For conflict and standoff questions, use structured analogies — and do not trust unaided game-theory intuition.** The tested evidence on forecasting decisions in conflicts (Green 2002/2005; Green & Armstrong 2007 — see `references/bibliography.md`) is blunt: game theorists' and other experts' *unaided* predictions were right only ~31–37% of the time, barely above the ~28% chance line, while **structured analogies** raised accuracy to ~46% (~60% when the forecaster knew several analogies well) and **simulated interaction** — actually role-playing the parties — roughly doubled it to ~62%. So when the question is "what will these parties decide":
1. List 3+ analogous past situations *before* reasoning about this one, rate each for similarity, look up how each actually resolved, and let the modal outcome anchor your probability (this usually IS your Step-B reference class).
2. For the highest-stakes calls, briefly simulate the decision from inside each key actor's constraints — argue their move as they would — before settling on the forecast.
The player map you build next is a structuring device, not evidence; these two procedures are what has been shown to beat chance.

**C. Steelman the opposing thesis.**
Before building your player map, write the strongest version of the case *against* where you expect to land. If you're heading toward "escalation, buy hard assets," argue the de-escalation / soft-landing / disinflation case as persuasively as a smart opponent would. State what evidence would make the opposing case correct. If you can't argue the other side well, you don't understand the situation well enough to forecast it — and if the laws and the steelman disagree, that tension is information, not something to resolve in the framework's favor by default.

Only after A, B, and C proceed to the structural scan.

---

### Step 3: Structural Setup Scan

Before building the player map, assess the structural environment:

**A. Which GT laws are "hot"?**
Rate each law 1–5 on how actively it's driving the situation:
- Law of Escalation hot? → escalation-focused prediction, buy volatility/defense
- Law of Asymmetry hot? → bet against the empire/incumbent
- Eschatological Convergence hot? → highest-conviction call; multiple scripts aligning
- Elite Overproduction hot? → internal crisis coming; hard assets, short financials/bonds

**B. Which structural theses are engaged?**
Does this situation activate de-dollarization / debasement / deglobalization — or all three? Triple activation = maximum GT conviction.

**C. Structural Setup Score: 1–10**
- 1–3: Low — event is largely idiosyncratic
- 4–6: Medium — some structural alignment
- 7–9: High — multiple laws + theses active
- 10: Maximum — all laws + all theses converging

---

### Step 4: Build the Player Map

For every significant actor, record:

| Player | Narrative Script | M Score (1–10) | E Score (1–10) | C Score (1–10) | Dominant Strategy | Constraint |
|---|---|---|---|---|---|---|
| [Actor] | [Eschatological/ideological script] | | | | [What they MUST do] | [What limits them] |

**M×E×C formula**: weighted score = [M + (2×E) + (4×C)] ÷ 7 (bracket the numerator, then divide by 7; report to one decimal at most — the inputs are subjective 1–10 judgments, so more precision is false precision). The 1-2-4 weighting is this framework's own labeled prior, not an estimated parameter — so ALSO compute the unweighted (M + E + C) ÷ 3 per player, and if the player ranking flips, flag the read as low-robustness (full procedure in `references/scoring_rubric.md`).
**Game Masters layer**: always add a row for transnational capital — their coordination signal is usually the earliest predictor

**Key questions per player:**
1. What is their narrative script telling them to do?
2. What constraints prevent them from acting freely?
3. What is their payoff function — what do they GAIN from escalation vs. de-escalation?
4. Are they at a hubris stage (overconfident, making mistakes) or asymmetric stage (motivated, nothing to lose)?
5. Which rung are they on the escalation ladder?

---

### Step 5: Dominant Strategy Engine

For each player pair, identify the dominant strategy — not what they want to do, but what they are structurally compelled to do.

**Apply this test**: "Given this player's script, constraints, M×E×C score, and current rung on the escalation ladder — what action would they take even if it seemed irrational to outsiders?"

**Flag "script lock" scenarios**: When a player's narrative script compels an action that their rational self-interest would normally prevent. These are the highest-conviction predictions because markets price rational actors, not scripted actors.

**Output**: For each player: MUST → WILL LIKELY → MIGHT → WON'T

---

### Step 6: Equilibrium Forecast

Where does this situation settle, and when?

**Timeline structure** (always provide all four horizons):
- **3 months**: What happens next? What rung on the escalation ladder?
- **6 months**: First major equilibrium — ceasefire, deal, escalation peak, policy shift?
- **12 months**: Structural resolution — who won, what changed permanently?
- **24 months**: New normal — what does the world look like after this plays out?

**For each horizon, provide:**
- Primary outcome (most likely) + probability %
- Secondary outcome + probability %
- Bear scenario (for market positioning) + probability %

**The "Slowly Then All At Once" Flag**: If you detect the market is ignoring structural stress (equity market disconnected from commodity/credit markets), explicitly flag this with:
→ *"Market immunity signal active. The repricing will be sudden, not gradual. Position before the trigger event."*
Then identify what the trigger event is and when it's likely.

---

### Step 7: Asset Implication Engine

Map every predicted outcome to specific financial instruments. Load `references/asset_map.md` for the full lookup tables.

**Structure outputs in tiers:**

**Tier 1 — High Conviction (GT thesis fully confirmed, structurally compelled, high asymmetry)**
- [Instrument] | [Why GT compels this move] | Entry Window | Asymmetry Score: X/10

**Tier 2 — Medium Conviction (partially confirmed, or on catalyst watch)**
- [Instrument] | [Conditional thesis] | Entry Trigger | Asymmetry Score: X/10

**Short Candidates — Where GT thesis directly contradicts current market pricing**
- [Instrument] | [Why this is structurally wrong]

**New Entry Opportunities — Not in portfolio but GT thesis opens them**
- [Instrument] | [Specific GT law driving this] | Asymmetry Score: X/10

**The Asymmetry Score formula** (see `references/scoring_rubric.md` for full methodology):
> Score = (GT-framework probability of positive outcome) ÷ (Market-implied probability) × Position relative to historical range
> 10 = maximum mispricing; 1 = fully priced in

---

### Step 8: Falsification Protocol + Monitoring Calendar

**Every prediction MUST include:**

**Falsification conditions** (what would prove the thesis wrong):
- ✗ If [specific observable X] occurs → thesis invalidated, exit positions
- ✗ If [specific observable Y] occurs → thesis weakened, reduce exposure
- ✓ If [specific observable Z] occurs → thesis accelerating, add exposure

**The Leading Indicator Calendar** (60-Day Rule generalized):
For every prediction, identify 2–3 specific, dated, observable signals that tell you the thesis is on track:
- *Example: "60 days after ceasefire announcement — retail gas price trajectory is the primary thesis health signal. >$4.50 = thesis intact; <$3.50 = thesis stalling."*
- These should be observable from public data, not requires proprietary access

**Weekly monitoring signals:**
List 3–5 specific data points to check weekly for thesis confirmation/denial

---

### Step 9: Log the Prediction (Close the Loop)

A forecast that's never scored can't be trusted or improved. For every discrete, resolvable claim in the report, append a row to the prediction log per `references/prediction_log.md`: the dated claim, its probability, the base rate you started from, the falsifier, and the horizon date. Leave `outcome` and `brier` blank to fill in when it resolves.

Offer to save or update the log as a file the user keeps (a CSV or note). Periodically — once enough predictions have resolved — run the calibration review in `prediction_log.md` to check whether the framework is actually beating the coin-flip line (mean Brier < 0.25) and whether its misses are lopsided (e.g., a persistent hard-asset tilt). This is what converts the skill from a confident-sounding narrative generator into something with a measurable track record.

---

## Output Format

Deliver every full prediction in this structure:

```
═══════════════════════════════════════════════════════
GT PREDICTOR: [EVENT/SITUATION NAME]
Analysis date: [Today] | Data retrieved: [date/time of live pull] | Horizon: 3/6/12mo (24mo noted as low-confidence)
═══════════════════════════════════════════════════════

DATA GROUNDING
├── Current status (live): [key facts + source dates]
├── Regime/direction check: [e.g., policy easing or tightening right now]
└── Unverified / assumed: [anything not confirmed live → lowers confidence]

OUTSIDE VIEW (BASE RATE)
├── Reference class: [what past cases, and why this class]
├── Base rate: [how often cases like this resolved this way]
└── Adjustment rationale: [why this case moves off the base rate — and by how much]

STEELMAN (OPPOSING CASE)
├── Strongest case against my read: [1–3 sentences]
└── What would make the opposing case right: [specific evidence]

STRUCTURAL SETUP
├── Setup Score: X/10
├── Active Laws: [list — as several inputs, not the master key]
├── Structural Theses Engaged (verified live): [list]
└── Market Immunity Signal: [Active / Inactive]

PLAYER MAP
├── [Actor 1]: Script | M×E×C (1 decimal) | Dominant Strategy | Constraint
├── [Actor 2]: Script | M×E×C (1 decimal) | Dominant Strategy | Constraint
└── Game Masters: [Institutional actors + positioning signal] (heuristic — weight modestly)

PREDICTION ENGINE (probabilities anchored on the base rate above)
├── 3 months: [Event] — [P%] | Alt: [Event] — [P%] | Base rate was [B%]
├── 6 months: [Event] — [P%] | Alt: [Event] — [P%] | Base rate was [B%]
├── 12 months: [Event] — [P%] | Alt: [Event] — [P%] | Base rate was [B%]
└── 24 months: [Directional only — flagged low confidence; accuracy decays past ~1yr]

ASSET IMPLICATIONS  (illustrative categories, not advice — verify prices live)
├── TIER 1 (High Conviction)
│   ├── [Asset] | [driver] | Entry idea: [window] | Asymmetry: X/10
│   └── [Asset] | [driver] | Entry idea: [window] | Asymmetry: X/10
├── TIER 2 (Conditional)
│   └── [Asset] | [Trigger] | Asymmetry: X/10
├── SHORT CANDIDATES
│   └── [Asset] | [contradiction with current pricing]
└── NEW ENTRY OPPORTUNITIES
    └── [Asset] | [driving law] | Asymmetry: X/10

FALSIFICATION CONDITIONS
├── ✗ [Observable X] → thesis invalidated
├── ✗ [Observable Y] → thesis weakened
└── ✓ [Observable Z] → thesis accelerating

LEADING INDICATOR CALENDAR
├── [Date/trigger]: [Signal to watch]
├── [Date/trigger]: [Signal to watch]
└── Weekly: [3–5 specific data points]

PREDICTION LOG
└── [N rows appended to the log: dated claim | probability | base rate | falsifier | horizon date]

VERDICT
├── Direction: [Bullish / Bearish / Neutral on thesis]
├── Confidence: [as a probability band, with the biggest source of uncertainty named]
├── Base rate → adjusted read: [B% → P%, and one line on what drove the move]
├── Gap vs. market: [where GT read differs from current pricing, and why that could be wrong]
└── Reminder: analysis only, not financial advice; verify all live data before acting
═══════════════════════════════════════════════════════
```

---

## Quick Mode (No Full Report Needed)

When the user asks for a "quick read," "gut check," or "what does GT say about X," still do a fast live check and a base rate, then output only:

```
GT QUICK READ: [Situation]  (as of [live-check date])
Base rate: [how often situations like this go this way]
Active Laws: [2–3 most relevant — inputs, not gospel]
Most likely outcome: [1 sentence] — [probability %]
Strongest counter: [1 sentence — the opposing case]
Key asset angle: [category, illustrative not advice]
Watch for: [1 key falsification signal]
```
Even in quick mode, give a probability (not just High/Med/Low) and name the opposing case. Analysis only — not financial advice.

---

## Integration With Other Skills

This skill feeds directly into:
- **`/institutional-forecast`**: Use GT prediction to select which asset class to forecast; feed GT conviction into interpreting institutional target divergence
- **`/stock-scanner`**: Use GT's Tier 1 asset list as the input scanner; look for beaten-down names within GT-aligned sectors
- **GT Framework Project Files**: Always treat project knowledge as the prior; GT Predictor updates the posterior with current data

---

## Important Calibration Notes

1. **GT predictions are structural, not tactical**: The framework predicts *that* something will happen and roughly *when*, not the exact day. Position 3–6 months before the expected event window, not on a specific date.

2. **The market's narrative vs. the GT equilibrium**: Markets price consensus narratives. GT predicts structural equilibria. The gap between these is the trade. Identify the narrative the market is pricing, then identify the GT-predicted equilibrium — the difference is the asymmetric return.

3. **Being early vs. being wrong — but prove it with the log**: Structural calls often resolve later than they feel like they should, so build time buffers rather than betting on a precise date. But do not lean on an assumption that the framework "has historically been right" — that claim is only worth anything once the prediction log (Step 9) backs it up. Let the scored track record, not the framework's self-image, tell you how much to trust it. If the log shows the calls aren't beating the base rate, the honest conclusion is that "early" was in fact "wrong."

4. **Falsification is as important as confirmation**: An unfalsifiable thesis is not a thesis — it's a story. Every GT prediction must have at least two specific observable conditions that would prove it wrong.

5. **The "Game Masters" note is a lens, not a law — and beware its unfalsifiability**: Large institutional actors (central banks, big allocators) can clearly delay or blunt macro adjustments through policy and liquidity, so factor in delay risk. But the stronger claim — that they "delay but cannot prevent" an outcome — is unfalsifiable as stated: any delay confirms it and any non-occurrence is just "not yet." That's precisely the story-not-thesis trap this skill warns against. Treat institutional positioning as one early signal among many, hold it loosely, and never let it turn a failed prediction into a permanently deferred one.
