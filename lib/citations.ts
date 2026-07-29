import { CONFLUENCE_BONUS } from "./ranking";

/* ============================================================================
 * Citation registry — the evidence base behind each lens's method and the
 * scoring rubric. Single source of truth (D4): /methodology renders it, and
 * scripts/gen-bibliographies.ts writes each playbook's references/
 * bibliography.md from it. Every attribution below was verified against the
 * primary source (web-checked 2026-07-06) — findings state what the works
 * actually report, including the inconvenient parts.
 *
 * Rules: public lens vocabulary only; no rubric numerals except values
 * interpolated from lib/ranking.ts constants.
 * ========================================================================== */

export interface Citation {
  /** Compact inline cite, e.g. "Piotroski 2000". */
  short: string;
  authors: string;
  year: string;
  title: string;
  /** Journal / publisher. */
  source: string;
  url?: string;
  /** One-sentence statement of what the work actually found/says. */
  finding: string;
  /** How this platform applies it (public phrasing). */
  usedFor: string;
}

export interface CitationGroup {
  key: "fundamentals" | "macro" | "consensus" | "discovery" | "universe" | "rubric";
  title: string;
  intro: string;
  works: Citation[];
}

export const CITATION_GROUPS: CitationGroup[] = [
  {
    key: "fundamentals",
    title: "Fundamentals lens",
    intro:
      "The hard gates and factor screens apply published, replicated results — the thresholds are the literature's, not ours.",
    works: [
      {
        short: "Piotroski 2000",
        authors: "Piotroski, J. D.",
        year: "2000",
        title: "Value Investing: The Use of Historical Financial Statement Information to Separate Winners from Losers",
        source: "Journal of Accounting Research, 38 (Supplement), 1–41",
        url: "https://doi.org/10.2307/2672906",
        finding:
          "A simple nine-signal fundamental-strength score (the F-Score) raised a value investor's mean annual return by at least 7.5 percentage points; a long-high/short-low F-Score strategy earned ~23% annualized over 1976–1996.",
        usedFor: "The F-Score is the financial-strength gate — a low score can veto a candidate regardless of story.",
      },
      {
        short: "Altman 1968",
        authors: "Altman, E. I.",
        year: "1968",
        title: "Financial Ratios, Discriminant Analysis and the Prediction of Corporate Bankruptcy",
        source: "The Journal of Finance, 23(4), 589–609",
        url: "https://doi.org/10.1111/j.1540-6261.1968.tb00843.x",
        finding:
          "A five-ratio discriminant model (the Z-Score) correctly classified 95% of the original sample as bankrupt or non-bankrupt one year before failure.",
        usedFor: "The distress-zone veto uses Altman's own zone boundaries — a balance sheet in the distress zone fails the gate.",
      },
      {
        short: "Fama & French 2015",
        authors: "Fama, E. F., & French, K. R.",
        year: "2015",
        title: "A Five-Factor Asset Pricing Model",
        source: "Journal of Financial Economics, 116(1), 1–22",
        url: "https://doi.org/10.1016/j.jfineco.2014.10.010",
        finding:
          "Adding profitability and investment factors to market, size, and value better explains the cross-section of average stock returns.",
        usedFor: "Grounds treating profitability and investment discipline as compensated factors in the quality screen.",
      },
      {
        short: "Asness, Frazzini & Pedersen 2019",
        authors: "Asness, C. S., Frazzini, A., & Pedersen, L. H.",
        year: "2019",
        title: "Quality Minus Junk",
        source: "Review of Accounting Studies, 24(1), 34–112",
        url: "https://doi.org/10.1007/s11142-018-9470-2",
        finding:
          "Stocks of profitable, growing, safe, well-managed companies earned significantly higher risk-adjusted returns than junk across 24 countries.",
        usedFor: "The quality dimension of the screen — quality is priced, but not fully.",
      },
      {
        short: "Novy-Marx 2013",
        authors: "Novy-Marx, R.",
        year: "2013",
        title: "The Other Side of Value: The Gross Profitability Premium",
        source: "Journal of Financial Economics, 108(1), 1–28",
        url: "https://doi.org/10.1016/j.jfineco.2013.01.003",
        finding:
          "Gross profits-to-assets predicts average returns about as powerfully as book-to-market and adds information beyond valuation.",
        usedFor: "Why the screen insists on profitable quality inside cheapness rather than cheapness alone.",
      },
      {
        short: "George & Hwang 2004",
        authors: "George, T. J., & Hwang, C.-Y.",
        year: "2004",
        title: "The 52-Week High and Momentum Investing",
        source: "The Journal of Finance, 59(5), 2145–2176",
        url: "https://doi.org/10.1111/j.1540-6261.2004.00695.x",
        finding:
          "Nearness to the 52-week high explains most momentum profits and forecasts returns better than past returns themselves.",
        usedFor: "Part of the momentum/confirmation check that separates a beaten-down bargain from a falling knife.",
      },
      {
        short: "Bernard & Thomas 1989",
        authors: "Bernard, V. L., & Thomas, J. K.",
        year: "1989",
        title: "Post-Earnings-Announcement Drift: Delayed Price Response or Risk Premium?",
        source: "Journal of Accounting Research, 27 (Supplement), 1–36",
        url: "https://doi.org/10.2307/2491062",
        finding:
          "Prices keep drifting in the direction of an earnings surprise for months after the announcement — a delayed response, not a risk premium.",
        usedFor: "Earnings-surprise drift as a catalyst-confirmation signal.",
      },
    ],
  },
  {
    key: "macro",
    title: "Game Theory lens",
    intro:
      "The lens's discipline — outside-view base rates, probability scoring, structured analogies, explicit falsifiers — is the tested core of the forecasting literature. Its actor-scoring framework is a stylized cousin of published expected-utility models and is labeled as judgment, not as an estimated parameter.",
    works: [
      {
        short: "Tetlock 2005",
        authors: "Tetlock, P. E.",
        year: "2005",
        title: "Expert Political Judgment: How Good Is It? How Can We Know?",
        source: "Princeton University Press",
        url: "https://press.princeton.edu/books/hardcover/9780691178288/expert-political-judgment",
        finding:
          "Across ~28,000 expert predictions over 20 years, political forecasters barely beat chance — and eclectic 'foxes' consistently out-predicted single-framework 'hedgehogs'.",
        usedFor:
          "Why the lens must argue the opposing case and treat its structural framework as one input among many, never a master key.",
      },
      {
        short: "Tetlock & Gardner 2015",
        authors: "Tetlock, P. E., & Gardner, D.",
        year: "2015",
        title: "Superforecasting: The Art and Science of Prediction",
        source: "Crown",
        url: "https://www.penguinrandomhouse.com/books/227815/superforecasting-by-philip-e-tetlock-and-dan-gardner/",
        finding:
          "Forecasters who decompose questions, start from outside-view base rates, use granular probabilities, and update relentlessly beat expert benchmarks by wide margins.",
        usedFor: "The working practices the lens enforces on every forecast.",
      },
      {
        short: "Mellers et al. 2014",
        authors: "Mellers, B., et al. (incl. Tetlock, P. E.)",
        year: "2014",
        title: "Psychological Strategies for Winning a Geopolitical Forecasting Tournament",
        source: "Psychological Science, 25(5), 1106–1115",
        url: "https://journals.sagepub.com/doi/10.1177/0956797614524255",
        finding:
          "In a two-year government-sponsored tournament, brief probability training, teaming, and tracking top performers each measurably improved geopolitical forecast accuracy.",
        usedFor: "Evidence that forecasting discipline is trainable and measurable — the basis for scoring the lens's own calls.",
      },
      {
        short: "Brier 1950",
        authors: "Brier, G. W.",
        year: "1950",
        title: "Verification of Forecasts Expressed in Terms of Probability",
        source: "Monthly Weather Review, 78(1), 1–3",
        url: "https://journals.ametsoc.org/view/journals/mwre/78/1/1520-0493_1950_078_0001_vofeit_2_0_co_2.xml",
        finding:
          "Introduced the quadratic scoring rule (the Brier score) that rewards probability forecasts for being both calibrated and decisive.",
        usedFor: "The lens keeps a Brier-scored prediction log, so its hit rate is measured rather than asserted.",
      },
      {
        short: "Kahneman & Tversky 1979",
        authors: "Kahneman, D., & Tversky, A.",
        year: "1979",
        title: "Intuitive Prediction: Biases and Corrective Procedures",
        source: "TIMS Studies in Management Science, 12, 313–327",
        url: "https://apps.dtic.mil/sti/tr/pdf/ADA047747.pdf",
        finding:
          "Intuitive forecasts neglect distributional evidence; the corrective 'outside view' anchors predictions on a reference class of similar past cases before adjusting for specifics.",
        usedFor: "The mandatory base-rate anchor that precedes any case-specific reasoning in the lens.",
      },
      {
        short: "Flyvbjerg 2006",
        authors: "Flyvbjerg, B.",
        year: "2006",
        title: "From Nobel Prize to Project Management: Getting Risks Right",
        source: "Project Management Journal, 37(3), 5–15",
        url: "https://journals.sagepub.com/doi/10.1177/875697280603700302",
        finding:
          "Turned the outside view into a working method — reference-class forecasting — that predicts outcomes from the distribution of comparable past cases, bypassing optimism bias.",
        usedFor: "The practical reference-class procedure the lens follows.",
      },
      {
        short: "Turchin & Nefedov 2009",
        authors: "Turchin, P., & Nefedov, S. A.",
        year: "2009",
        title: "Secular Cycles",
        source: "Princeton University Press",
        url: "https://press.princeton.edu/books/hardcover/9780691136967/secular-cycles",
        finding:
          "Quantitative history across Rome, France, England, and Russia shows recurring multi-generational cycles of expansion, elite overproduction, state stress, and crisis.",
        usedFor:
          "The elite-overproduction heuristic in the lens's framework is drawn from structural-demographic theory — used as one input, not a law of nature.",
      },
      {
        short: "Bueno de Mesquita 2011",
        authors: "Bueno de Mesquita, B.",
        year: "2011",
        title: "A New Model for Predicting Policy Choices: Preliminary Tests",
        source: "Conflict Management and Peace Science, 28(1), 65–87",
        url: "https://journals.sagepub.com/doi/10.1177/0738894210388127",
        finding:
          "The expected-utility line of policy-forecasting models (from The War Trap, 1981, onward) scores actors on position, salience, and potential influence (plus resolve); a declassified CIA evaluation found such forecasts accurate ~90% of the time — matching traditional analysis on hit rate while delivering far more specific predictions.",
        usedFor:
          "The lens's actor-map scoring is a stylized cousin of these models; the mapping — and where it departs (its coordination score has no direct analog) — is documented in the lens's own rubric.",
      },
      {
        short: "Green 2005",
        authors: "Green, K. C.",
        year: "2005",
        title: "Game Theory, Simulated Interaction, and Unaided Judgement for Forecasting Decisions in Conflicts: Further Evidence",
        source: "International Journal of Forecasting, 21(3), 463–472",
        url: "https://www.sciencedirect.com/science/article/abs/pii/S0169207005000348",
        finding:
          "Across eight real conflicts, game theorists' unaided predictions were right ~31% of the time — no better than novices and near the ~28% chance line — while simulated interaction (role-playing the parties) reached ~62%.",
        usedFor: "Why the lens distrusts unaided game-theoretic intuition and simulates actors' decisions for high-stakes calls.",
      },
      {
        short: "Green & Armstrong 2007",
        authors: "Green, K. C., & Armstrong, J. S.",
        year: "2007",
        title: "Structured Analogies for Forecasting",
        source: "International Journal of Forecasting, 23(3), 365–376",
        url: "https://ideas.repec.org/a/eee/intfor/v23y2007i3p365-376.html",
        finding:
          "Listing analogous past situations, rating similarity, and taking the modal outcome raised conflict-forecast accuracy from ~32% (unaided experts) to 46% — and to ~60% for experts who knew several analogies well.",
        usedFor: "The structured-analogies step the lens runs before forecasting any conflict or standoff.",
      },
    ],
  },
  {
    key: "consensus",
    title: "Street Consensus lens",
    intro:
      "The lens aggregates live-verified street targets while framing them with their measured accuracy — the numbers below are why its reports lead with humility instead of precision.",
    works: [
      {
        short: "Bradshaw, Brown & Huang 2013",
        authors: "Bradshaw, M. T., Brown, L. D., & Huang, K.",
        year: "2013",
        title: "Do Sell-Side Analysts Exhibit Differential Target Price Forecasting Ability?",
        source: "Review of Accounting Studies, 18(4), 930–955",
        url: "https://doi.org/10.1007/s11142-012-9216-5",
        finding:
          "For US 12-month targets (2000–2009): only 38% were met at the end of the horizon (64% touched at some point), absolute forecast errors averaged 45%, and target-implied returns exceeded realized returns by ~15% on average.",
        usedFor: "The headline accuracy framing on every consensus report — targets are treated as opinions, not predictions.",
      },
      {
        short: "Bilinski, Lyssimachou & Walker 2013",
        authors: "Bilinski, P., Lyssimachou, D., & Walker, M.",
        year: "2013",
        title: "Target Price Accuracy: International Evidence",
        source: "The Accounting Review, 88(3), 825–851",
        url: "https://doi.org/10.2308/accr-50378",
        finding:
          "Across ~586,000 targets in 16 countries (2002–2009), prices touched the target during the horizon in 59% of cases (US ~55%), with mean absolute errors of ~45% (US ~50%).",
        usedFor: "International corroboration that target inaccuracy is structural, not a bad-decade artifact.",
      },
      {
        short: "Asquith, Mikhail & Au 2005",
        authors: "Asquith, P., Mikhail, M. B., & Au, A. S.",
        year: "2005",
        title: "Information Content of Equity Analyst Reports",
        source: "Journal of Financial Economics, 75(2), 245–282",
        url: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=332662",
        finding:
          "Even star (Institutional Investor All-American) analysts' targets were achieved within the year only ~54% of the time (1997–1999).",
        usedFor: "Why verified coverage breadth matters more to the lens than any single desk's conviction.",
      },
      {
        short: "Brav & Lehavy 2003",
        authors: "Brav, A., & Lehavy, R.",
        year: "2003",
        title: "An Empirical Analysis of Analysts' Target Prices: Short-Term Informativeness and Long-Term Dynamics",
        source: "The Journal of Finance, 58(5), 1933–1968",
        url: "https://doi.org/10.1111/1540-6261.00593",
        finding:
          "Target-price revisions move stock prices even after controlling for concurrent recommendation and earnings-forecast revisions; one-year targets averaged ~28% above the prevailing market price.",
        usedFor:
          "Why the lens tracks target revisions and freshness (they carry information) while discounting the level (systematic optimism).",
      },
    ],
  },
  {
    key: "discovery",
    title: "Discovery scout",
    intro:
      "The hunt for the next mega-caps is grounded in how equity returns actually concentrate, and the DNA scorecard operationalizes the standard strategy literature rather than inventing criteria.",
    works: [
      {
        short: "Bessembinder 2018",
        authors: "Bessembinder, H.",
        year: "2018",
        title: "Do Stocks Outperform Treasury Bills?",
        source: "Journal of Financial Economics, 129(3), 440–457",
        url: "https://doi.org/10.1016/j.jfineco.2018.06.004",
        finding:
          "Since 1926, the best-performing ~4% of US listed companies account for the entire net wealth creation of the stock market over Treasury bills; the top ~90 firms account for over half, and 57% of individual stocks underperformed T-bills over their lifetimes.",
        usedFor:
          "The rationale for the scout's whole mandate: returns concentrate in a handful of compounders, so the game is finding them early — as a basket, with honest odds.",
      },
      {
        short: "Fahlenbrach 2009",
        authors: "Fahlenbrach, R.",
        year: "2009",
        title: "Founder-CEOs, Investment Decisions, and Stock Market Performance",
        source: "Journal of Financial and Quantitative Analysis, 44(2), 439–466",
        url: "https://doi.org/10.1017/S0022109009090139",
        finding:
          "An equal-weighted portfolio of founder-CEO firms earned a benchmark-adjusted ~8% annually (1993–2002), with founder-led firms investing more in R&D and capex.",
        usedFor: "The founder-led / reinvestment dimensions of the DNA scorecard.",
      },
      {
        short: "Helmer 2016",
        authors: "Helmer, H.",
        year: "2016",
        title: "7 Powers: The Foundations of Business Strategy",
        source: "Deep Strategy LLC",
        url: "https://7powers.com/",
        finding:
          "Durable excess returns require one of seven structural Powers — scale economies, network economies, counter-positioning, switching costs, branding, cornered resource, or process power.",
        usedFor: "The moat and counter-positioning dimensions ('counter-positioning' is Helmer's term).",
      },
      {
        short: "Rogers 1962",
        authors: "Rogers, E. M.",
        year: "1962",
        title: "Diffusion of Innovations",
        source: "Free Press (5th ed. 2003)",
        url: "https://www.simonandschuster.com/books/Diffusion-of-Innovations-5th-Edition/Everett-M-Rogers/9780743222099",
        finding:
          "Innovations spread along a predictable S-shaped adoption curve, from innovators and early adopters through the majority.",
        usedFor: "The S-curve timing dimension — the scout hunts for companies near the knee of adoption.",
      },
      {
        short: "Foster 1986",
        authors: "Foster, R. N.",
        year: "1986",
        title: "Innovation: The Attacker's Advantage",
        source: "Summit Books",
        url: "https://archive.org/details/innovationattack0000fost",
        finding:
          "Technologies improve along S-curves that hit physical limits, at which point attackers on a new S-curve gain a structural advantage over defending incumbents.",
        usedFor: "Why the scout prefers attackers riding fresh S-curves over incumbents defending old ones.",
      },
      {
        short: "Christensen 1997",
        authors: "Christensen, C. M.",
        year: "1997",
        title: "The Innovator's Dilemma: When New Technologies Cause Great Firms to Fail",
        source: "Harvard Business School Press",
        url: "https://www.hbs.edu/faculty/Pages/item.aspx?num=46",
        finding:
          "Well-managed incumbents rationally serving their best customers systematically lose to disruptive entrants that start at the low end and improve.",
        usedFor: "The incumbent-bind logic inside the counter-positioning dimension.",
      },
      {
        short: "Moore 1991",
        authors: "Moore, G. A.",
        year: "1991",
        title: "Crossing the Chasm: Marketing and Selling High-Tech Products to Mainstream Customers",
        source: "HarperBusiness",
        url: "https://geoffreyamoore.com/book/crossing-the-chasm/",
        finding:
          "A chasm separates early adopters from the mainstream majority; technology companies succeed or fail on whether they can bridge it.",
        usedFor: "The adoption-gap realism in S-curve timing — early traction is not the same as mainstream arrival.",
      },
    ],
  },
  {
    key: "universe",
    title: "Stage-0 universe screen",
    intro:
      "Before any judgment runs, a deterministic screen filters — and then ranks — the whole US primary-exchange universe on exchange feeds and SEC filings data — no model involved. Every threshold is owner-tunable; the defaults come from this literature, and the current effective values are disclosed above.",
    works: [
      {
        short: "Banz 1981",
        authors: "Banz, R. W.",
        year: "1981",
        title: "The Relationship Between Return and Market Value of Common Stocks",
        source: "Journal of Financial Economics, 9(1), 3–18",
        url: "https://doi.org/10.1016/0304-405X(81)90018-0",
        finding:
          "Smaller NYSE firms earned higher risk-adjusted returns than larger firms over 1936–1975 — the original size effect — with the premium concentrated in the very smallest companies.",
        usedFor:
          "Why the hunt runs below mega-cap at all, and why the band has a floor: below it, the same size effect comes bundled with illiquidity and data quality too poor to screen mechanically.",
      },
      {
        short: "Amihud 2002",
        authors: "Amihud, Y.",
        year: "2002",
        title: "Illiquidity and Stock Returns: Cross-Section and Time-Series Effects",
        source: "Journal of Financial Markets, 5(1), 31–56",
        url: "https://doi.org/10.1016/S1386-4181(01)00024-6",
        finding:
          "Expected stock returns rise with illiquidity, measured as price impact per dollar of trading volume — thinly traded names carry a structural liquidity discount and outsized trading costs.",
        usedFor: "The day-traded-value floor: names a retail reader could not actually trade at quoted prices are screened out.",
      },
      {
        short: "Kumar 2009",
        authors: "Kumar, A.",
        year: "2009",
        title: "Who Gambles in the Stock Market?",
        source: "The Journal of Finance, 64(4), 1889–1933",
        url: "https://doi.org/10.1111/j.1540-6261.2009.01483.x",
        finding:
          "Lottery-type stocks — low-priced, high idiosyncratic volatility and skewness — attract gambling-motivated retail flow and earn significantly negative average excess returns.",
        usedFor: "The minimum-price screen: very low-priced shares behave like lottery tickets, not like early compounders.",
      },
      {
        short: "Bali, Cakici & Whitelaw 2011",
        authors: "Bali, T. G., Cakici, N., & Whitelaw, R. F.",
        year: "2011",
        title: "Maxing Out: Stocks as Lotteries and the Cross-Section of Expected Returns",
        source: "Journal of Financial Economics, 99(2), 427–446",
        url: "https://doi.org/10.1016/j.jfineco.2010.08.014",
        finding:
          "Stocks with extreme recent daily gains subsequently underperform — demand for lottery-like payoffs systematically overprices them.",
        usedFor: "Corroborates the lottery-zone exclusion behind the minimum-price screen.",
      },
      {
        short: "Ritter 1991",
        authors: "Ritter, J. R.",
        year: "1991",
        title: "The Long-Run Performance of Initial Public Offerings",
        source: "The Journal of Finance, 46(1), 3–27",
        url: "https://doi.org/10.1111/j.1540-6261.1991.tb03743.x",
        finding:
          "IPOs from 1975–1984 substantially underperformed matched seasoned firms over the three years after issue — new listings arrive expensive on average.",
        usedFor:
          "The listing-age screen: brand-new listings wait out their first reporting cycle before joining the pool (the scout can still nominate one off-pool with an explicit justification).",
      },
      {
        short: "Campbell, Hilscher & Szilagyi 2008",
        authors: "Campbell, J. Y., Hilscher, J., & Szilagyi, J.",
        year: "2008",
        title: "In Search of Distress Risk",
        source: "The Journal of Finance, 63(6), 2899–2939",
        url: "https://doi.org/10.1111/j.1540-6261.2008.01416.x",
        finding:
          "Firms with high predicted failure probability earn anomalously LOW subsequent returns despite their higher risk — financial distress is not compensated.",
        usedFor:
          "The cash-runway and shell screens: names whose filings show they cannot fund their next twelve months without new money are excluded by arithmetic, not by judgment.",
      },
      {
        short: "FASB 2014",
        authors: "Financial Accounting Standards Board",
        year: "2014",
        title: "Presentation of Financial Statements — Going Concern (ASU 2014-15, Subtopic 205-40)",
        source: "FASB Accounting Standards Update",
        url: "https://www.fasb.org/page/document?pdf=ASU+2014-15.pdf",
        finding:
          "US GAAP requires management to evaluate every reporting period whether substantial doubt exists about the entity's ability to continue as a going concern within one year.",
        usedFor: "Why the cash-runway screen's default horizon is one year — it mirrors the accounting standard's own solvency window.",
      },
      {
        short: "Pontiff & Woodgate 2008",
        authors: "Pontiff, J., & Woodgate, A.",
        year: "2008",
        title: "Share Issuance and Cross-Sectional Returns",
        source: "The Journal of Finance, 63(2), 921–945",
        url: "https://doi.org/10.1111/j.1540-6261.2008.01335.x",
        finding:
          "Net share issuance strongly and negatively predicts cross-sectional returns — in post-1970 data its power is comparable to momentum and greater than size or book-to-market.",
        usedFor:
          "The share-issuance check. Raw filing-to-filing share counts cannot distinguish dilution from splits or stock-funded acquisitions, so by default heavy issuance is disclosed as a flag on any delivered pick rather than silently screened — the screen itself is available and owner-tunable.",
      },
      {
        short: "Sloan 1996",
        authors: "Sloan, R. G.",
        year: "1996",
        title: "Do Stock Prices Fully Reflect Information in Accruals and Cash Flows About Future Earnings?",
        source: "The Accounting Review, 71(3), 289–315",
        url: "https://www.jstor.org/stable/248290",
        finding:
          "The cash-flow component of earnings is markedly more persistent than the accrual component, and prices act as if investors miss the difference — high-accrual firms subsequently underperform.",
        usedFor:
          "Why the pool ranking reads operating cash flow rather than reported earnings: the cash component is the persistent one.",
      },
      {
        short: "Chan, Karceski & Lakonishok 2003",
        authors: "Chan, L. K. C., Karceski, J., & Lakonishok, J.",
        year: "2003",
        title: "The Level and Persistence of Growth Rates",
        source: "The Journal of Finance, 58(2), 643–684",
        url: "https://doi.org/10.1111/1540-6261.00540",
        finding:
          "Past growth rates show little persistence and are close to unpredictable at long horizons — sustained high growth is far rarer than valuations typically imply.",
        usedFor:
          "The honest caveat on the ranking's revenue-growth weight: growth is evidence of an engine today, not a forecast that it persists — the ranking orders the scout's reading list, it does not pick winners.",
      },
      {
        short: "Grinold 1989",
        authors: "Grinold, R. C.",
        year: "1989",
        title: "The Fundamental Law of Active Management",
        source: "The Journal of Portfolio Management, 15(3), 30–37",
        url: "https://doi.org/10.3905/jpm.1989.409211",
        finding:
          "The information ratio of an active process is approximately its edge per bet (the information coefficient) times the square root of the number of independent bets — breadth multiplies edge.",
        usedFor:
          "The pool-size default: the scout sees a wide, sector-stratified rotation of the eligible set rather than a handful of familiar names, so its judgment is applied across genuine breadth.",
      },
      {
        short: "Barber & Odean 2008",
        authors: "Barber, B. M., & Odean, T.",
        year: "2008",
        title:
          "All That Glitters: The Effect of Attention and News on the Buying Behavior of Individual and Institutional Investors",
        source: "The Review of Financial Studies, 21(2), 785–818",
        url: "https://doi.org/10.1093/rfs/hhm079",
        finding:
          "Individual investors are net buyers of attention-grabbing stocks — those in the news, with extreme one-day returns, or unusually high volume — and this attention-driven buying does not earn superior subsequent returns.",
        usedFor:
          "The consensus-name ceiling: the most attention-grabbing 'next-mega-cap' names are exactly the ones a familiarity-driven selection over-weights, so their share of a cohort is capped, measured, and disclosed rather than trusted.",
      },
    ],
  },
  {
    key: "rubric",
    title: "The scoring rubric",
    intro:
      "The rubric's combination rules — fixed transparent weights, a small bonus for independent agreement — are grounded product choices informed by the forecast-combination literature, not parameters estimated from data (and they are not claimed to be).",
    works: [
      {
        short: "Bates & Granger 1969",
        authors: "Bates, J. M., & Granger, C. W. J.",
        year: "1969",
        title: "The Combination of Forecasts",
        source: "Operational Research Quarterly, 20(4), 451–468",
        url: "https://doi.org/10.1057/jors.1969.103",
        finding:
          "Combining two independent forecasts produced lower error than either forecast alone — the founding result of forecast combination.",
        usedFor: "Why the platform scores a combination of independent lenses instead of trusting any single analysis.",
      },
      {
        short: "Clemen 1989",
        authors: "Clemen, R. T.",
        year: "1989",
        title: "Combining Forecasts: A Review and Annotated Bibliography",
        source: "International Journal of Forecasting, 5(4), 559–583",
        url: "https://doi.org/10.1016/0169-2070(89)90012-5",
        finding:
          "Across 200+ studies, combining independent forecasts substantially and consistently improves accuracy — and simple combination methods often match complex ones.",
        usedFor: "The breadth of evidence behind combining lenses at all.",
      },
      {
        short: "Timmermann 2006",
        authors: "Timmermann, A.",
        year: "2006",
        title: "Forecast Combinations",
        source: "Handbook of Economic Forecasting, Vol. 1, Ch. 4, 135–196 (Elsevier)",
        url: "https://ideas.repec.org/h/eee/ecofch/1-04.html",
        finding:
          "Simple equal-weighted forecast combinations are remarkably robust and frequently beat sophisticated optimal-weighting schemes (the 'forecast combination puzzle', as Stock & Watson 2004 named it).",
        usedFor:
          "Why the rubric's weights are fixed, transparent, and disclosed rather than fitted — fitted weights would add estimation error and false precision.",
      },
      {
        short: "Condorcet 1785",
        authors: "Condorcet, M. de",
        year: "1785",
        title: "Essai sur l'application de l'analyse à la probabilité des décisions rendues à la pluralité des voix",
        source: "Imprimerie Royale, Paris",
        url: "https://gallica.bnf.fr/ark:/12148/bpt6k417181.image",
        finding:
          "If each judge on a binary question is independently more likely right than wrong, the probability the majority is correct rises as judges are added.",
        usedFor: `The confluence bonus (+${CONFLUENCE_BONUS} points only when all three lenses independently lean bullish) is this logic in arithmetic form — with the honest caveat that lenses reading overlapping market data are only partially independent, which is why the bonus is small and disclosed.`,
      },
    ],
  },
];

/** Look up one work by its compact short cite (Stage-0 settings footnotes resolve through this). */
export function findCitation(short: string): Citation | undefined {
  for (const g of CITATION_GROUPS) {
    const hit = g.works.find((w) => w.short === short);
    if (hit) return hit;
  }
  return undefined;
}

/** Compact per-lens grounding line for cards, e.g. "Piotroski 2000 · Altman 1968 · …". */
export function groundingShorts(key: CitationGroup["key"], n = 3): string {
  const group = CITATION_GROUPS.find((g) => g.key === key);
  if (!group) return "";
  const shorts = group.works.slice(0, n).map((w) => w.short);
  const more = group.works.length - shorts.length;
  return more > 0 ? `${shorts.join(" · ")} +${more} more` : shorts.join(" · ");
}
