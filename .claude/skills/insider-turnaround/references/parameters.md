# Every threshold, and the two ways to change it

The build document is emphatic on one point: none of these numbers is a recommendation.
They are example defaults, and each is a real parameter that the person running a scan is
meant to set for themselves. This table exists so that stays checkable.

There are two ways to change any of them:

- **Per reading** — pick a named risk profile with `--risk`, or on the board itself. This
  costs nothing and refetches nothing: the scan stores only raw filings, closes and
  statements, so a different tolerance re-derives the whole candidate list, including the
  reason each rejected company failed.
- **As the house default** — the operator's dials on `/admin`, published live on
  `/methodology`. Precedence is database override, then environment variable, then the
  default below.

## The insider buying

| Setting | Example default | Environment variable | What it decides |
|---|---|---|---|
| Filing window | 60 days | `MAG8_INSIDER_LOOKBACK_DAYS` | How far back filings are read |
| Minimum open-market buying | $100,000 | `MAG8_INSIDER_MIN_DOLLAR` | Total dollars bought before a company is considered |
| Minimum distinct insiders | 1 | `MAG8_INSIDER_MIN_CLUSTER` | Two or more asks for a cluster |
| Pre-arranged discount | 50% | `MAG8_INSIDER_PLAN_DISCOUNT` | How much a scheduled purchase counts for |
| Require an officer or director | off | `MAG8_INSIDER_REQUIRE_INSIDER_ROLE` | Excludes buying only by large holders |

## The price setup

| Setting | Example default | Environment variable | What it decides |
|---|---|---|---|
| Minimum fall | 2% | `MAG8_INSIDER_MIN_DRAWDOWN` | Excludes a stock that has barely moved |
| Maximum fall | 60% | `MAG8_INSIDER_MAX_DRAWDOWN` | The single most consequential dial here |
| Measure against the 52-week high | on | `MAG8_INSIDER_DRAWDOWN_REF` | Off measures against the one-year average close |
| High no older than | 12 months | `MAG8_INSIDER_MAX_MONTHS_SINCE_HIGH` | Makes the decline recent rather than ancient |
| Fallen-angel guard | 80% off the 3-year high | `MAG8_INSIDER_FALLEN_ANGEL_GUARD` | Zero switches it off entirely |
| Require the fall to have steadied | on | `MAG8_INSIDER_REQUIRE_STABILIZING` | Off deliberately admits falling knives |

## The financial-strength gate

These two are **not** risk preferences and no profile moves them. The thresholds are the
literature's, and they are the same ones the platform's fundamentals method applies, so
the two products cannot disagree about the same balance sheet.

| Setting | Example default | Environment variable | What it decides |
|---|---|---|---|
| Strength score floor | 4 of 9 | `MAG8_INSIDER_F_FLOOR` | Below this the company fails |
| Accept the solvency middle zone | on | `MAG8_INSIDER_ALLOW_GREY` | Off requires the safe zone |
| Gate rejects rather than flags | on | `MAG8_INSIDER_STRENGTH_GATE` | Off ranks a failing company with a prominent flag |

## The valuation

| Setting | Example default | Environment variable | What it decides |
|---|---|---|---|
| Discount rate | 9% | `MAG8_INSIDER_DISCOUNT_RATE` | Moves the answer more than almost anything else |
| Terminal growth | 2.5% | `MAG8_INSIDER_TERMINAL_GROWTH` | Must stay well below the discount rate |
| Years projected | 10 | `MAG8_INSIDER_PROJECTION_YEARS` | Longer is not more accurate |
| Growth carried forward | 70% of observed | `MAG8_INSIDER_GROWTH_HAIRCUT` | Growth decays faster than extrapolation assumes |
| Growth cap | 15% | `MAG8_INSIDER_MAX_GROWTH` | Stops one good year compounding for a decade |
| Cushion required | 25% | `MAG8_INSIDER_MIN_MARGIN` | How far below the estimate the price must sit |

## The composite

Four readings, each 0–100, combined at equal weight by default:
`MAG8_INSIDER_W_INSIDER`, `MAG8_INSIDER_W_SETUP`, `MAG8_INSIDER_W_STRENGTH`,
`MAG8_INSIDER_W_VALUE`.

Equal weight is not a placeholder. There is no evidence for any particular blend of these
four, and inventing one would be false precision. A component that could not be measured
is not scored zero — the company is scored on what was available, marked partial, and
ranked below every fully measured one.

## Operational

`MAG8_INSIDER_MAX_CANDIDATES` (60), `MAG8_INSIDER_PRICE_YEARS` (5),
`MAG8_INSIDER_FETCH_TIMEOUT_MS` (20s). `MAG8_INSIDER=0` switches the whole scanner off,
in which case the pages report themselves unavailable rather than rendering an empty list.
