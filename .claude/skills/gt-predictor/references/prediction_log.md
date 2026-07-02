# Prediction Log & Calibration — Making the Framework Accountable

A forecasting method that never scores itself cannot improve and cannot earn trust. The research on expert judgment is blunt about this: the forecasters who get better are the ones who track accuracy, keep score, and run feedback loops — accountability is the mechanism, not an afterthought. This file defines how every GT prediction gets logged, resolved, and scored, so the framework's real hit rate becomes visible over time instead of asserted.

**This directly counters the framework's biggest failure mode.** Because the seven laws tend to point at the same basket (hard assets, short duration/tech), the skill is prone to being right-sounding and unfalsified rather than actually right. A scored log is the antidote: it forces each call to be specific, dated, and later graded, and it exposes systematic bias (e.g., "we're consistently too bullish on gold" or "our 6-month escalation calls hit 40%, not the 80% we felt").

---

## 1. Log every prediction at the time you make it

For each discrete claim in a report, append a row to the running log. Keep it in a single file the user controls (a CSV, a note, a spreadsheet — wherever they'll actually keep it). Do not backfill or edit probabilities after the fact; a prediction edited after the outcome is not a prediction.

| Field | What goes here |
|---|---|
| `id` | Sequential ID |
| `date_made` | The date the forecast was recorded (stamp it — this is non-negotiable) |
| `claim` | A single, binary, resolvable statement. Not "tensions rise" — "WTI front-month closes above $90 on any day before [date]." |
| `horizon_date` | The date by which it resolves |
| `probability` | Your probability as a number, e.g. 0.62. Use granular values, not just High/Med/Low (see §4) |
| `base_rate` | The outside-view base rate you started from *before* GT adjustments (see §3) |
| `direction` | The asset/position implication, if any |
| `falsifier` | The specific observable that would resolve it NO |
| `outcome` | Filled in later: 1 (happened) or 0 (didn't) |
| `brier` | Filled in later: (probability − outcome)² |
| `notes` | What you got right/wrong and why — the part that actually teaches you |

A claim that can't be written as a binary, dated, observable statement isn't ready to be logged — sharpen it until it is.

---

## 2. Resolve on the horizon date

When `horizon_date` arrives (or the event resolves early), fill in `outcome` (1/0) and compute `brier = (probability − outcome)²`. Do this even when — especially when — the call was wrong. The misses are where the calibration information lives.

---

## 3. Anchor every probability on a base rate first (the outside view)

Before applying any GT law, establish the reference-class base rate. This is the single most evidence-backed forecasting technique there is (Kahneman & Tversky's "outside view," operationalized as reference-class forecasting by Flyvbjerg). It exists specifically to stop case-specific narrative — exactly what the seven laws generate — from producing overconfident forecasts.

**Three-step procedure:**
1. **Pick the reference class.** A set of past cases similar to this one — broad enough to be statistically meaningful, narrow enough to be genuinely comparable. E.g., for "does this border clash become a shooting war within 6 months?", the class is past border clashes of similar type, not "all wars." Expect some ambiguity here ("reference-class tennis"); state which class you chose and why.
2. **Get the distribution / base rate.** How often did cases in that class resolve the way you're forecasting? Search for actual frequencies where possible ("of X sanctions regimes since 1990, how many were lifted within a year?"). If no hard data exists, estimate the base rate explicitly and label it as an estimate.
3. **Place this case in the distribution, then adjust.** Start at the base rate and move off it only for specific, defensible reasons — this is where the GT laws, M×E×C scores, and current data come in. Adjust deliberately and in moderation; the whole point is that the base rate has more predictive weight than it feels like it should.

Log both numbers: the `base_rate` you started from and the final `probability` after adjustment. Over time, comparing them shows whether your GT adjustments actually add accuracy or just add confidence.

---

## 4. Use granular probabilities, then convert to words if needed

Superforecasters' accuracy measurably drops when their probabilities are rounded — the fine gradations carry real information. So assign an actual number (0.62, not "likely"), then, if a verbal label helps the reader, map it consistently:

| Probability | Label |
|---|---|
| 0.90–1.00 | Near-certain |
| 0.75–0.89 | Very likely |
| 0.60–0.74 | Likely |
| 0.45–0.59 | Roughly even |
| 0.30–0.44 | Unlikely |
| 0.10–0.29 | Very unlikely |
| 0.00–0.09 | Near-impossible |

Avoid the trap of collapsing everything to High/Medium/Low — it discards exactly the information that separates good forecasters from bad ones.

---

## 5. Score yourself with the Brier score

The **Brier score** is the standard proper scoring rule for probabilistic forecasts (Glenn Brier, 1950): the mean squared error between your probabilities and the outcomes.

> **Brier = (1/N) × Σ (probabilityᵢ − outcomeᵢ)²**, where outcome is 1 or 0. Lower is better.

**Interpretation benchmarks (binary events):**
| Mean Brier | Meaning |
|---|---|
| 0.00 | Theoretical perfect (every call at 100% and correct) |
| ~0.09 | Elite / superforecaster territory |
| ~0.15 | Strong |
| ~0.20 | Decent — roughly human-forecaster-on-prediction-markets level |
| 0.25 | The coin-flip line — what you'd get predicting 50% on everything. **Beating 0.25 is the minimum bar for the framework to be adding anything.** |
| >0.25 | Worse than a coin flip — the method is actively misleading and needs to change |
| 1.00 | Maximally, confidently wrong |

**Two rules when using it:**
- It is a *strictly proper* scoring rule — you minimize it by reporting your true probability, not by hedging to 0.5. So state what you actually believe.
- A good Brier score can still hide systematic bias. Always pair it with a calibration check (§6). Do not treat one number as the whole story.

**Brier Skill Score (optional):** to test whether GT beats just predicting the base rate, compare the GT Brier to the base-rate Brier. If GT's score isn't lower, the laws are adding confidence without accuracy — a finding worth acting on.

---

## 6. Run a periodic calibration review

Every ~10–20 resolved predictions, review the log as a batch:
- **Calibration:** Of the calls you made at ~70%, did about 70% happen? Bucket predictions by probability band and compare predicted vs. actual hit rate. Systematic overshoot (things you called 80% happen 55% of the time) means overconfidence — widen your uncertainty.
- **Directional bias:** Are the misses lopsided? If nearly every miss is an over-bullish hard-asset call, the framework has a structural tilt that needs correcting, not defending.
- **Which laws earned their keep:** Tag each resolved call with the law(s) that drove it. Over time, some lenses will show real predictive value and some won't. Downweight the ones that don't.
- **Horizon decay:** Check accuracy by horizon. Forecasting research finds accuracy degrades sharply beyond ~a year; if the 12–24-month calls are near chance, say so and stop presenting them with false confidence.

The point of the review is not to defend the framework — it's to update it. A method that survives contact with its own track record is worth trusting; one that never checks isn't.
