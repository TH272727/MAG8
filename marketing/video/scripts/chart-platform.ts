/**
 * Platform metadata for the chart films — YouTube title, description, hashtags
 * and tags, generated from the frozen datasets.
 *
 * WHY IT IS GENERATED AND NOT WRITTEN. YouTube pre-fills a title from the
 * FILENAME and a description from the channel default, so `chart-the-gap-that-
 * closed.mp4` arrives as exactly the riddle the owner objected to on screen.
 * The fix is a per-video pack — but a pack is 26 descriptions full of figures,
 * and a figure typed from memory is the one thing this repo keeps catching.
 * So every number below is INTERPOLATED out of the same frozen dataset the film
 * renders from: `f.usd('NVDA')` cannot disagree with the chart.
 *
 * Anything that is NOT in the dataset — a date, a historical fact, a span in
 * years — has to be declared in `claims` with its source, and the gate REFUSES
 * any other loose numeral in the copy. Same shape as `knownExcursions` in a
 * spec: the author states the claim, the machine makes sure nothing slips in
 * unstated.
 *
 * Research behind the format (Sept 2026): a Shorts title is read in its first
 * ~40 characters and does better declarative than interrogative; the first ~100
 * characters of the description sit above the fold; hashtags belong in the
 * DESCRIPTION, 3-5 of them, and more than 15 makes YouTube ignore every one;
 * the tag box is 500 characters total, 30 per tag, and is worth about five
 * minutes of anyone's time.
 *
 *   npm run chart:platform          write the pack
 *   npm run chart:platform -- --dry check only, write nothing
 */
import {writeFileSync} from 'node:fs';
import {CHART_SPECS, CHART_IDS} from '../src/charts/jobs.ts';
import {chartOf} from '../src/charts/registry.ts';

const OUT = '../../youtube-chart-upload-plan-2026-09-08.md';
const SITE = 'https://themag8.com';

/* -------------------------------------------------------------------------- */
/*  Figures, read out of the frozen data                                      */
/* -------------------------------------------------------------------------- */

const comma = (n: number, dp = 0) =>
  n.toLocaleString('en-US', {minimumFractionDigits: dp, maximumFractionDigits: dp});

class Facts {
  readonly y0: string;
  readonly y1: string;
  readonly principal: string | null;
  private last = new Map<string, number>();
  private min = new Map<string, number>();
  private max = new Map<string, number>();

  /**
   * A series LABEL is dataset copy too, and several carry digits — "S&P 500",
   * "Nasdaq 100", "10-yr Treasury", "Top 1%". Without these the traceability
   * check fails on the film's own vocabulary.
   */
  private labels: string[] = [];

  constructor(id: string) {
    const {data} = chartOf(id);
    this.labels = CHART_SPECS[id].series.map((s) => s.label);
    this.y0 = data.dates[0].slice(0, 4);
    this.y1 = data.dates[data.dates.length - 1].slice(0, 4);
    const m = /\$([\d,]+)/.exec(data.method);
    this.principal = m ? '$' + m[1] : null;
    for (const s of data.series) {
      const vals = s.values.filter((v): v is number => v !== null);
      if (!vals.length) continue;
      this.last.set(s.key, vals[vals.length - 1]);
      this.min.set(s.key, Math.min(...vals));
      this.max.set(s.key, Math.max(...vals));
    }
  }

  private get(map: Map<string, number>, k: string): number {
    const v = map.get(k);
    if (v === undefined) throw new Error(`no such series "${k}"`);
    return v;
  }
  v = (k: string) => this.get(this.last, k);
  lo = (k: string) => this.get(this.min, k);
  hi = (k: string) => this.get(this.max, k);

  /** $7,281,108 — cents kept only under $1,000, as the film's own formatter does. */
  private money = (n: number) => '$' + comma(n, n < 1000 ? 2 : 0).replace(/\.00$/, '');
  usd = (k: string) => this.money(this.v(k));
  usdLo = (k: string) => this.money(this.lo(k));
  usdHi = (k: string) => this.money(this.hi(k));

  /** +233.1% / -74.7% */
  private signed = (n: number) => (n >= 0 ? '+' : '-') + Math.abs(n).toFixed(1) + '%';
  pct = (k: string) => this.signed(this.v(k));
  pctLo = (k: string) => this.signed(this.lo(k));
  pctHi = (k: string) => this.signed(this.hi(k));

  /** 74.7% — for prose that already carries the direction in a word. */
  private bare = (n: number) => Math.abs(n).toFixed(1) + '%';
  apct = (k: string) => this.bare(this.v(k));
  apctLo = (k: string) => this.bare(this.lo(k));
  apctHi = (k: string) => this.bare(this.hi(k));

  num = (k: string) => comma(this.v(k));
  /** One decimal, for a quantity where whole numbers collapse real differences. */
  num1 = (k: string) => comma(this.v(k), 1);
  num1Lo = (k: string) => comma(this.lo(k), 1);
  numLo = (k: string) => comma(this.lo(k));
  numHi = (k: string) => comma(this.hi(k));

  /** A payroll series is filed in THOUSANDS: 938.6 is 938,600 people. */
  headcount = (k: string) => comma(Math.round(this.v(k) * 1000));
  headcountHi = (k: string) => comma(Math.round(this.hi(k) * 1000));

  /** 27,945 (thousands) -> "27.9 million" */
  millionsFromThousands = (k: string) => (this.v(k) / 1000).toFixed(1) + ' million';
  millionsFromThousandsHi = (k: string) => (this.hi(k) / 1000).toFixed(1) + ' million';

  people = (k: string) => {
    const n = this.v(k);
    return n >= 1e9 ? (n / 1e9).toFixed(2) + ' billion' : Math.round(n / 1e6) + ' million';
  };

  /** $1.25 trillion / $46.8 million — words, because a title reads them aloud. */
  moneyWords = (k: string) => {
    const n = this.v(k);
    if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + ' trillion';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + ' billion';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + ' million';
    return this.money(n);
  };

  /** Everything the gate will accept as traceable, in the exact shapes above. */
  allNumerals(): string[] {
    const out: string[] = [this.y0, this.y1, ...this.labels];
    if (this.principal) out.push(this.principal);
    for (const k of this.last.keys()) {
      out.push(
        this.usd(k), this.usdLo(k), this.usdHi(k),
        this.pct(k), this.pctLo(k), this.pctHi(k),
        this.apct(k), this.apctLo(k), this.apctHi(k),
        this.num(k), this.numLo(k), this.numHi(k),
        this.num1(k), this.num1Lo(k),
        this.headcount(k), this.headcountHi(k),
        this.millionsFromThousands(k), this.millionsFromThousandsHi(k),
        this.people(k), this.moneyWords(k),
      );
    }
    return out;
  }
}

/* -------------------------------------------------------------------------- */
/*  The copy                                                                  */
/* -------------------------------------------------------------------------- */

type Entry = {
  title: string;
  hook: string;
  bullets: string[];
  hashtags: string[];
  tags: string[];
  /** Numerals that are true but not in the dataset. Stated, with the source. */
  claims?: Record<string, string>;
};

const COPY: Record<string, (f: Facts) => Entry> = {
  'mag7-10k': (f) => ({
    title: '$10,000 in the Magnificent 7, 14 Years Later 📈',
    hook: `$10,000 into each of the Magnificent 7 in June 2012. Nvidia alone turned into ${f.usd('NVDA')}.`,
    bullets: [
      `Nvidia ${f.usd('NVDA')} · Tesla ${f.usd('TSLA')} · Apple ${f.usd('AAPL')}`,
      `The S&P 500 over the same years: ${f.usd('SPY')}.`,
      'All seven beat the index. One beat it by more than 100 times.',
    ],
    hashtags: ['Investing', 'StockMarket', 'Nvidia', 'MagnificentSeven'],
    tags: ['magnificent 7 stocks', 'nvidia stock', '10000 invested', 'stock market returns',
      'long term investing', 'sp500 returns', 'tech stocks', 'buy and hold'],
    claims: {'14': 'June 2012 to September 2026 is 14 years — the dataset span.',
      '100': 'NVDA final / SPY final = 100.9x, computed from the dataset.',
      '7': 'seven companies plus the index — the series list.'},
  }),

  'wages-vs-everything': (f) => ({
    title: 'Did Wages Keep Up With House Prices? 🏠',
    hook: `Since January 2000, US home prices are up ${f.apct('HOMEIDX')} and wages are up ${f.apct('WAGES')}.`,
    bullets: [
      `Home prices ${f.pct('HOMEIDX')} · Median home sold ${f.pct('HOMEPRICE')}`,
      `Wages ${f.pct('WAGES')} · Everyday prices ${f.pct('CPI')}`,
      'Wages beat inflation. Houses beat wages. That gap is the whole housing argument.',
    ],
    hashtags: ['HousingMarket', 'Inflation', 'Wages', 'Economy'],
    tags: ['house prices vs wages', 'housing affordability', 'us home prices', 'inflation vs wages',
      'cost of living', 'real wages', 'housing market', 'cpi inflation'],
  }),

  'cost-of-money': (f) => ({
    title: `US Interest Rates Since 1976: Prime Hit ${f.apctHi('PRIME')} 💵`,
    hook: `The prime rate touched ${f.apctHi('PRIME')} in the early 1980s. Today it is ${f.apct('PRIME')}.`,
    bullets: [
      `Prime ${f.apct('PRIME')} · 10-year Treasury ${f.apct('GS10')} · Fed funds ${f.apct('FF')}`,
      `Six published US rates, every quarter since ${f.y0}. Nothing adjusted.`,
      'Almost everything a household pays is priced off these lines.',
    ],
    hashtags: ['InterestRates', 'Economy', 'FederalReserve', 'Mortgages'],
    tags: ['us interest rates history', 'prime rate', 'fed funds rate', 'treasury yields',
      'mortgage rates', 'federal reserve', 'inflation', 'us economy'],
    claims: {'1980': 'the prime rate peak sits in the early 1980s in the plotted series.'},
  }),

  'cheaper-or-dearer': (f) => ({
    title: `Hospital Care ${f.pct('HOSP')}, Toys ${f.pct('TOYS')}: US Prices Since 1990 🛒`,
    hook: `Same country, same years. Hospital care is up ${f.apct('HOSP')}. Toys are down ${f.apct('TOYS')}.`,
    bullets: [
      `Up most: hospital care ${f.pct('HOSP')}, tuition ${f.pct('TUIT')}, rent ${f.pct('RENT')}`,
      `Barely moved: clothes ${f.pct('APP')}. Fell: toys ${f.pct('TOYS')}.`,
      'The things you must buy went up. The things you choose to buy went down.',
    ],
    hashtags: ['Inflation', 'CostOfLiving', 'Economy', 'Prices'],
    tags: ['us inflation by category', 'cost of living', 'hospital costs', 'college tuition cost',
      'rent increases', 'cpi categories', 'prices since 1990', 'inflation explained'],
  }),

  'sector-race-10k': (f) => ({
    title: '$10,000 in Every Part of the Stock Market Since 2001 📊',
    hook: `$10,000 into each part of the US stock market in October 2001. Technology finished at ${f.usd('XLK')}.`,
    bullets: [
      `Technology ${f.usd('XLK')} · Consumer ${f.usd('XLY')} · Industrials ${f.usd('XLI')}`,
      `The S&P 500 itself: ${f.usd('SPY')}. Financials finished last at ${f.usd('XLF')}.`,
      'Four of the seven finished behind the index that contains them.',
    ],
    hashtags: ['Investing', 'StockMarket', 'SP500', 'ETFs'],
    tags: ['stock market sectors', 'sector etf returns', 'technology stocks', 'sp500 returns',
      'long term investing', '10000 invested', 'buy and hold', 'sector rotation'],
    claims: {'7': 'seven sectors plus the index — the series list.',
      '4': 'four sector finals fall below the S&P 500 final, computed from the dataset.'},
  }),

  'work-in-america': (f) => ({
    title: 'What America Does for a Living, 1970 to Today 👷',
    hook: `Health care and schools now employ ${f.millionsFromThousands('EDHE')} people. Manufacturing employs ${f.millionsFromThousands('MANU')}.`,
    bullets: [
      `Health & schools ${f.millionsFromThousands('EDHE')} · Government ${f.millionsFromThousands('GOVT')} · Manufacturing ${f.millionsFromThousands('MANU')}`,
      `Manufacturing peaked at ${f.millionsFromThousandsHi('MANU')} and has not been back.`,
      'Eight federal payroll counts at their published levels.',
    ],
    hashtags: ['Economy', 'Jobs', 'Manufacturing', 'America'],
    tags: ['us jobs by industry', 'manufacturing jobs decline', 'payroll employment',
      'bls jobs data', 'american economy', 'service economy', 'employment history'],
    claims: {'8': 'eight series — the series list.'},
  }),

  'grocery-run': (f) => ({
    title: 'What a Grocery Run Costs Now vs 2000 🛒',
    hook: `Ground beef went from ${f.usdLo('BEEF')} a pound to ${f.usd('BEEF')}. Bananas went from ${f.usdLo('BANA')} to ${f.usd('BANA')}.`,
    bullets: [
      `Ground beef ${f.usd('BEEF')}/lb · Bacon ${f.usd('BACN')}/lb · Milk ${f.usd('MILK')}/gal`,
      `Eggs peaked at ${f.usdHi('EGGS')} a dozen and are ${f.usd('EGGS')} now.`,
      'These are collected prices, not an index — what the item actually rang up at.',
    ],
    hashtags: ['Groceries', 'Inflation', 'CostOfLiving', 'FoodPrices'],
    tags: ['grocery prices', 'food inflation', 'egg prices', 'ground beef price',
      'cost of living', 'bls average prices', 'grocery costs', 'food prices history'],
  }),

  'world-markets': (f) => ({
    title: "Which Country's Stock Market Won Since 2004? 🌍",
    hook: `Eight national stock markets, all measured in US dollars. Taiwan finished first at ${f.pct('TWN')}.`,
    bullets: [
      `Taiwan ${f.pct('TWN')} · United States ${f.pct('USA')} · Canada ${f.pct('CAN')}`,
      `Brazil led for a decade and finished ${f.pct('BRA')} — in the bottom half.`,
      'Every line is in dollars, so the exchange rate is part of the result.',
    ],
    hashtags: ['Investing', 'StockMarket', 'GlobalMarkets', 'Economy'],
    tags: ['global stock market returns', 'international investing', 'taiwan stock market',
      'emerging markets', 'sp500 vs world', 'country returns', 'world markets'],
    claims: {'8': 'eight countries — the series list.'},
  }),

  'what-america-owes': (f) => ({
    title: `America's Biggest Borrower Owes ${f.moneyWords('GOV')} 🏦`,
    hook: `The US government owes ${f.moneyWords('GOV')}. Households owe ${f.moneyWords('HH')}. Companies owe ${f.moneyWords('CORP')}.`,
    bullets: [
      `Government ${f.moneyWords('GOV')} · Banks & lenders ${f.moneyWords('FIN')} · Households ${f.moneyWords('HH')}`,
      `The biggest borrower in America has changed hands three times since ${f.y0}.`,
      'Five separate borrowers, never added together — there is no total on this chart.',
    ],
    hashtags: ['Economy', 'Debt', 'Finance', 'USA'],
    tags: ['us national debt', 'household debt', 'corporate debt', 'debt by sector',
      'federal reserve data', 'us economy', 'government borrowing', 'debt history'],
  }),

  'eight-billion': (f) => ({
    title: 'India Just Passed China in Population 🌏',
    hook: `India is now the most populous country on earth: ${f.people('IND')} people against China's ${f.people('CHN')}.`,
    bullets: [
      `India ${f.people('IND')} · China ${f.people('CHN')} · United States ${f.people('USA')}`,
      `In ${f.y0} China led by more than 200 million.`,
      'Nothing here moves fast. The lines cross because growth rates differ.',
    ],
    hashtags: ['Population', 'India', 'China', 'WorldData'],
    tags: ['world population', 'india population', 'china population', 'most populous country',
      'population growth', 'demographics', 'world bank data'],
    claims: {'200': "China's 1960 value less India's 1960 value is 224 million, from the dataset."},
  }),

  'below-zero': (f) => ({
    title: 'When Interest Rates Went Below Zero 📉',
    hook: `Switzerland's ten-year government bond fell to ${f.pctLo('CHE')}. Lending a government money cost you money.`,
    bullets: [
      `Lows: Switzerland ${f.pctLo('CHE')} · Germany ${f.pctLo('DEU')} · Japan ${f.pctLo('JPN')}`,
      `Today: United States ${f.apct('USA')} · Germany ${f.apct('DEU')} · Japan ${f.apct('JPN')}`,
      'A yield is what buyers accepted that month, not what a central bank set.',
    ],
    hashtags: ['InterestRates', 'Bonds', 'Economy', 'Finance'],
    tags: ['negative interest rates', 'government bond yields', '10 year yield', 'swiss bonds',
      'japan yields', 'bond market', 'interest rates history', 'oecd data'],
  }),

  'pizza-day': (f) => ({
    title: `The $41 Pizza Order That Became ${f.moneyWords('BTC')} 🍕`,
    hook: `In 2010 someone paid ten thousand bitcoin for two pizzas — about $41 at the first price bitcoin ever had.`,
    bullets: [
      `That $41 in bitcoin: ${f.usd('BTC')}`,
      `The same $41 in Apple ${f.usd('AAPL')} · in the S&P 500 ${f.usd('SPX')} · in gold ${f.usd('GOLD')}`,
      `Left as cash in a drawer: ${f.usd('CASH')}.`,
    ],
    hashtags: ['Bitcoin', 'Crypto', 'Investing', 'PizzaDay'],
    tags: ['bitcoin pizza day', 'bitcoin price history', '10000 bitcoin pizza', 'btc vs sp500',
      'bitcoin vs gold', 'crypto history', 'bitcoin 2010', 'bitcoin returns'],
    claims: {'2010': "the dataset starts 2010-08, bitcoin's first priced month.",
      '10': 'ten thousand coins — the documented order, and the reason the film exists.'},
  }),

  'nikkei-1989': (f) => ({
    title: "Japan's Stock Market Took 34 Years to Get Even 🇯🇵",
    hook: `Japan's market peaked in December 1989 and spent 34 years below that level. It sits ${f.pct('JPN')} today.`,
    bullets: [
      `Japan ${f.pct('JPN')} · United States ${f.pct('USA')} · Hong Kong ${f.pct('HKG')} · Britain ${f.pct('GBR')}`,
      `At its worst Japan was ${f.apctLo('JPN')} below where it started.`,
      'Share prices only, each market measured in its own currency.',
    ],
    hashtags: ['Japan', 'StockMarket', 'Investing', 'Economy'],
    tags: ['nikkei 1989 bubble', 'japan lost decades', 'nikkei 225 history', 'stock market crash',
      'japan economy', 'long term stock returns', 'market bubble', 'investing history'],
    claims: {'34': 'December 1989 to the first monthly close back above it in February 2024.',
      '1989': 'the dataset starts at the December 1989 peak.'},
  }),

  'covid-crash': (f) => ({
    title: '$10,000 Invested at the Exact 2020 Market Top 📉',
    hook: `Bought the week markets peaked in February 2020 — the worst possible week. Bitcoin turned $10,000 into ${f.usd('BTC')}.`,
    bullets: [
      `Bitcoin ${f.usd('BTC')} · Nasdaq 100 ${f.usd('NDQ')} · Gold ${f.usd('GOLD')} · S&P 500 ${f.usd('SPX')}`,
      `Long bonds ${f.usd('BOND')} — the only one still below the ${f.principal} stake.`,
      'The worst week to buy was still a decent week to buy.',
    ],
    hashtags: ['Investing', 'StockMarket', 'Bitcoin', 'Bonds'],
    tags: ['covid crash 2020', 'market timing', 'worst time to invest', 'buy and hold',
      'bitcoin returns', 'sp500 returns', 'bonds vs stocks', 'lump sum investing'],
  }),

  'the-wage-that-stopped': (f) => ({
    title: "The US Minimum Wage Hasn't Moved Since 2009 💵",
    hook: `The federal minimum wage has been ${f.usd('US')} an hour since July 2009 — the longest freeze since 1938.`,
    bullets: [
      `Federal ${f.usd('US')} · Washington ${f.usd('WA')} · New York ${f.usd('NY')} · California ${f.usd('CA')}`,
      'Six states more than doubled the federal rate while it sat still.',
      'Dollars as written into law, not adjusted for what the money buys.',
    ],
    hashtags: ['MinimumWage', 'Economy', 'Wages', 'Work'],
    tags: ['federal minimum wage', 'minimum wage by state', 'wage stagnation', 'cost of living',
      'labor economics', 'minimum wage history', 'us wages'],
    claims: {'2009': 'the federal rate reaches its current level in July 2009 and never moves again.',
      '1938': 'the Fair Labor Standards Act, the start of the federal minimum wage.',
      '6': 'six states — the series list.'},
  }),

  'nobody-wanted-oil': (f) => ({
    title: 'The Day Oil Sold for Less Than Nothing 🛢️',
    hook: 'On 20 April 2020 US crude settled at minus $36.98 a barrel. Sellers paid buyers to take it away.',
    bullets: [
      `US crude finished the year ${f.pct('WTI')} — but touched ${f.pctLo('WTI')}, which is a price below zero`,
      `Jet fuel ${f.pct('JET')} · Petrol ${f.pct('GAS')} · Propane finished ${f.pct('PROP')}`,
      'Seven energy prices, each measured from the first trading day of 2020.',
    ],
    hashtags: ['Oil', 'Energy', 'Markets', 'Economy'],
    tags: ['negative oil price', 'wti crude 2020', 'oil crash', 'april 2020 oil',
      'energy prices', 'jet fuel prices', 'natural gas', 'commodity markets'],
    claims: {'20': 'the settlement date, 2020-04-20.',
      '36.98': 'FRED DCOILWTICO 2020-04-20 = -36.98, the only negative reading since 1986.',
      '2020': 'the film covers the 2020 calendar year.',
      '7': 'seven series — the series list.'},
  }),

  'nowhere-to-hide': (f) => ({
    title: '$10,000 in 2022: Five of Seven Lost Money 📉',
    hook: '2022 was the year almost nothing worked. $10,000 into seven different things on the first trading day:',
    bullets: [
      `Commodities ${f.usd('DBC')} · Gold ${f.usd('GLD')} · US bonds ${f.usd('AGG')}`,
      `S&P 500 ${f.usd('SPY')} · Property ${f.usd('VNQ')} · Long Treasuries ${f.usd('TLT')} · Big tech ${f.usd('QQQ')}`,
      'Government bonds are held for the year shares fall. They fell further.',
    ],
    hashtags: ['Investing', 'StockMarket', 'Bonds', 'Inflation'],
    tags: ['2022 bear market', 'stocks and bonds fell', '60 40 portfolio', 'diversification',
      'worst year for bonds', 'inflation 2022', 'market returns', 'investing 2022'],
    claims: {'2022': 'the film covers the 2022 calendar year.',
      '5': `five of the seven finals sit below the ${'$10,000'} stake, computed from the dataset.`,
      '7': 'seven series — the series list.'},
  }),

  'same-house-eight-cities': (f) => ({
    title: 'A $200,000 House in 8 Cities, 25 Years Later 🏘️',
    hook: `The same ${f.principal} house bought in January 2000. In Miami it is now ${f.usd('MIA')}. In Detroit, ${f.usd('DET')}.`,
    bullets: [
      `Miami ${f.usd('MIA')} · Seattle ${f.usd('SEA')} · San Francisco ${f.usd('SF')}`,
      `Phoenix ${f.usd('PHX')} and Las Vegas ${f.usd('LV')} each more than doubled, gave it all back, then did it again.`,
      'The price of the house only — no mortgage, taxes or upkeep.',
    ],
    hashtags: ['HousingMarket', 'RealEstate', 'Investing', 'Economy'],
    tags: ['us house prices by city', 'case shiller index', 'miami real estate', 'detroit housing',
      'housing bubble 2008', 'home price growth', 'real estate returns', 'housing market'],
    claims: {'8': 'eight cities — the series list.',
      '25': 'January 2000 to May 2026 is 25 years, the dataset span.'},
  }),

  'money-left-at-home': (f) => ({
    title: '$1,000 in Cash, 8 Countries, 20 Years 💵',
    hook: `Convert $1,000 once, then do nothing at all. In Japan you would hold ${f.usd('JPY')}. In Argentina, ${f.usd('ARS')}.`,
    bullets: [
      `Japanese yen ${f.usd('JPY')} · Mexican peso ${f.usd('MXN')} · Indian rupee ${f.usd('INR')}`,
      `Turkish lira ${f.usd('TRY')} · Argentine peso ${f.usd('ARS')}`,
      'All eight ended below where they started. Nobody traded and nobody was robbed.',
    ],
    hashtags: ['Currency', 'Inflation', 'Economy', 'Finance'],
    tags: ['currency devaluation', 'holding cash', 'argentine peso collapse', 'turkish lira',
      'exchange rates', 'inflation', 'forex history', 'cash vs inflation'],
    claims: {'8': 'eight currencies — the series list.',
      '20': 'March 2006 to September 2026 is 20 years, the dataset span.'},
  }),

  'who-stopped-working': (f) => ({
    title: 'In 1948, One in Three Women Had a Job 📊',
    hook: `Women in the American workforce went from ${f.apctLo('WOMEN')} to ${f.apct('WOMEN')}. Men went the other way.`,
    bullets: [
      `Women ${f.apct('WOMEN')}, up from a low of ${f.apctLo('WOMEN')}`,
      `Men ${f.apct('MEN')}, down from a high of ${f.apctHi('MEN')}`,
      'The workforce did not just grow. It changed who it was made of.',
    ],
    hashtags: ['Economy', 'Work', 'Jobs', 'History'],
    tags: ['labor force participation', 'women in the workforce', 'men labor force decline',
      'us employment', 'bls data', 'workforce demographics', 'jobs history'],
    claims: {'1948': 'the dataset starts in January 1948.',
      '3': 'one in three — the 1948 reading rounds to a third.'},
  }),

  'the-interest-bill': (f) => ({
    title: 'America Now Pays More Interest Than Defense 🏛️',
    hook: `Interest on the national debt has passed the entire defense budget: ${f.moneyWords('INT')} against ${f.moneyWords('DEF')}.`,
    bullets: [
      `Interest ${f.moneyWords('INT')} · Defense ${f.moneyWords('DEF')} · Social Security ${f.moneyWords('SS')}`,
      'Interest reached the top of this chart once before, then fell for five years.',
      'Five separate spending lines, never added together.',
    ],
    hashtags: ['Economy', 'Debt', 'Government', 'Finance'],
    tags: ['us federal spending', 'interest on national debt', 'defense budget',
      'social security spending', 'budget deficit', 'fiscal policy', 'us economy'],
  }),

  'america-stopped-building': (f) => ({
    title: 'America Builds Half the Homes It Did in 1972 🏗️',
    hook: `In its best year the US started ${f.numHi('US')} homes. The latest reading is ${f.num('US')}.`,
    bullets: [
      `South ${f.num('SOUTH')} · West ${f.num('WEST')} · Midwest ${f.num('MIDWEST')} · Northeast ${f.num('NE')}`,
      'The South now starts more homes than the other three regions combined.',
      `Homes started at a yearly pace, every quarter since ${f.y0}.`,
    ],
    hashtags: ['HousingMarket', 'RealEstate', 'Economy', 'Construction'],
    tags: ['us housing starts', 'housing shortage', 'home construction', 'housing affordability',
      'new home builds', 'census housing data', 'housing supply'],
    claims: {'1972': 'the national peak in the plotted series sits in 1972.',
      '3': 'the other three regions — the series list.'},
  }),

  'black-monday': (f) => ({
    title: '$10,000 Through the 1987 Crash, 6 Countries 📉',
    hook: `Black Monday, October 1987. ${f.principal} in six markets, held to the end of 1988. Only Japan finished ahead.`,
    bullets: [
      `Japan ${f.usd('JP')} · S&P 500 ${f.usd('SPX')} · Nasdaq ${f.usd('NDQ')}`,
      `Hong Kong ${f.usd('HK')} · Britain ${f.usd('UK')} · Australia ${f.usd('AU')}`,
      'Hong Kong shut for four days and fell by a third the day it reopened.',
    ],
    hashtags: ['StockMarket', 'Investing', 'History', 'Crash'],
    tags: ['black monday 1987', '1987 stock market crash', 'market crash history',
      'hang seng crash', 'nikkei 1987', 'investing history', 'stock market history'],
    claims: {'1987': 'the dataset starts in August 1987.',
      '1988': 'the dataset ends in December 1988.',
      '6': 'six markets — the series list.',
      '4': 'Hong Kong closed for four days from 20 October 1987 and fell 33.3% on reopening.'},
  }),

  'the-jobs-that-vanished': (f) => ({
    title: `The American Jobs That Vanished: ${f.headcountHi('APPA')} to ${f.headcount('APPA')} 🏭`,
    hook: `Apparel employed ${f.headcountHi('APPA')} Americans at its peak. Today the count is ${f.headcount('APPA')}.`,
    bullets: [
      `Apparel ${f.headcount('APPA')} · Textile mills ${f.headcount('TEXT')} · Coal mining ${f.headcount('COAL')}`,
      `Printing fell from ${f.headcountHi('PRNT')} to ${f.headcount('PRNT')}.`,
      'There was no single day any of these ended. Every one is still published.',
    ],
    hashtags: ['Economy', 'Jobs', 'Manufacturing', 'America'],
    tags: ['manufacturing job losses', 'apparel industry decline', 'textile jobs',
      'coal mining jobs', 'deindustrialization', 'us factory jobs', 'bls payrolls'],
  }),

  'who-owns-the-country': (f) => ({
    title: "Who Owns America's Wealth? Top 1% vs Bottom Half 💰",
    hook: `The richest 1% of US households hold ${f.apct('TOP1')} of all household wealth. The bottom half hold ${f.apct('BOT50')}.`,
    bullets: [
      `Top 1% ${f.apct('TOP1')} · Next 9% ${f.apct('NEXT9')} · Middle 40% ${f.apct('MID40')} · Bottom half ${f.apct('BOT50')}`,
      `At its lowest on this chart the top 1% held ${f.apctLo('TOP1')}.`,
      'Four shares of one pie — a rise anywhere is a fall somewhere else.',
    ],
    hashtags: ['Wealth', 'Economy', 'Inequality', 'Finance'],
    tags: ['wealth inequality us', 'top 1 percent wealth', 'household net worth',
      'wealth distribution', 'middle class wealth', 'federal reserve data', 'us economy'],
    claims: {'1': 'the top 1% — a published series label.',
      '9': 'the next 9% — a published series label.',
      '40': 'the middle 40% — a published series label.'},
  }),

  'the-gap-that-closed': (f) => ({
    title: "In 1960, China's Life Expectancy Was 33 🌍",
    hook: `In 1960 a child born in China could expect ${f.num1Lo('CHN')} years. Today the figure is ${f.num1('CHN')}.`,
    bullets: [
      `China ${f.num1Lo('CHN')} to ${f.num1('CHN')} · South Korea ${f.num1Lo('KOR')} to ${f.num1('KOR')}`,
      `Japan ${f.num1('JPN')} · France ${f.num1('FRA')} · United Kingdom ${f.num1('GBR')} · United States ${f.num1('USA')}`,
      'The widest gap on this chart is at the beginning, not the end.',
    ],
    hashtags: ['Health', 'WorldData', 'LifeExpectancy', 'History'],
    tags: ['life expectancy by country', 'life expectancy history', 'japan life expectancy',
      'china life expectancy', 'world bank data', 'global health', 'life expectancy 1960'],
    claims: {'1960': 'the dataset starts in 1960.'},
  }),
};

/* -------------------------------------------------------------------------- */
/*  Assembly + gates                                                          */
/* -------------------------------------------------------------------------- */

const LEAK =
  /stock-scanner|gt-predictor|institutional-forecast|new-gen-stock|claude|anthropic|SKILL\.md|Loading skill|\bskills?\b|\bagents?\b/i;

const describe = (e: Entry, id: string, f: Facts): string => {
  const {data} = chartOf(id);
  return [
    e.hook,
    '',
    ...e.bullets.map((b) => '• ' + b),
    '',
    `Data: ${data.sourceLabel}, ${f.y0}-${f.y1}. ${data.method}`,
    `More charts like this: ${SITE} — the next trillion-dollar leaderboard.`,
    'Not investment advice.',
    '',
    e.hashtags.map((h) => '#' + h).join(' '),
  ].join('\n');
};

let fails = 0;
let warns = 0;
const fail = (id: string, msg: string) => { console.log(`  FAIL  ${id}: ${msg}`); fails++; };
const warn = (id: string, msg: string) => { console.log(`  WARN  ${id}: ${msg}`); warns++; };

const sections: string[] = [];

for (const id of CHART_IDS) {
  const build = COPY[id];
  if (!build) { fail(id, 'no platform copy — every film needs a title and a description'); continue; }
  const f = new Facts(id);
  const e = build(f);
  const desc = describe(e, id, f);

  /* ---- the platform's own limits ---- */
  if (e.title.length > 100) fail(id, `title is ${e.title.length} chars, YouTube caps it at 100`);
  else if (e.title.length > 70) warn(id, `title is ${e.title.length} chars — the feed shows about 40`);
  if (desc.length > 5000) fail(id, `description is ${desc.length} chars, YouTube caps it at 5000`);
  if (e.hashtags.length > 15) fail(id, 'more than 15 hashtags — YouTube then ignores every one');
  else if (e.hashtags.length < 2 || e.hashtags.length > 5) warn(id, `${e.hashtags.length} hashtags; 3-5 is the band`);
  const tagLine = e.tags.join(', ');
  if (tagLine.length > 500) fail(id, `tags are ${tagLine.length} chars, the box holds 500`);
  for (const t of e.tags) if (t.length > 30) fail(id, `tag "${t}" is over 30 chars`);

  /* ---- white-label ---- */
  for (const [what, text] of [['title', e.title], ['description', desc], ['tags', tagLine]] as const) {
    const m = LEAK.exec(text);
    if (m) fail(id, `${what} contains "${m[0]}"`);
  }

  /* ---- every numeral traceable ---- */
  const allowed = new Set(f.allNumerals().flatMap((s) => s.match(/[\d.,]+/g) ?? []));
  const claimed = new Set(Object.keys(e.claims ?? {}));
  const copy = `${e.title}\n${desc}`;
  for (const tok of copy.match(/\d[\d.,]*/g) ?? []) {
    const bare = tok.replace(/[.,]$/, '');
    if (allowed.has(bare) || claimed.has(bare)) continue;
    // A figure inside the receipts line comes from the dataset itself.
    if (describe({...e, hook: '', bullets: [], title: ''} as Entry, id, f).includes(bare)) continue;
    fail(id, `numeral "${bare}" is in the copy but not in the data and not declared in claims`);
  }

  sections.push(
    `## ${id}\n\n` +
    `**File** \`chart-${id}.mp4\`\n\n` +
    `**Title** (${e.title.length} chars)\n\n${e.title}\n\n` +
    `**Description**\n\n${desc.split('\n').map((l) => (l ? l : '')).join('\n')}\n\n` +
    `**Tags** (${tagLine.length}/500)\n\n${tagLine}\n`,
  );
}

const header = `# YouTube metadata — the chart films (26)

Generated by \`npm run chart:platform\` from the frozen datasets, so every figure below matches the
film frame for frame. Do not hand-edit this file — edit \`marketing/video/scripts/chart-platform.ts\`
and regenerate.

**Why this pack exists.** YouTube pre-fills the title from the FILENAME and the description from the
channel default. \`chart-the-gap-that-closed.mp4\` therefore arrives titled "chart the gap that
closed" — the exact riddle the owner rejected on screen — with a generic description under it. Paste
these in instead.

**Format**, from the September 2026 research: a Shorts title is judged on its first ~40 characters and
does better declarative than interrogative; the first ~100 characters of the description sit above the
fold; hashtags go in the DESCRIPTION, 3-5 of them, and more than 15 makes YouTube ignore all of them;
the tag box holds 500 characters total and 30 per tag, and matters far less than the title.

**Settings for every upload**: Not made for kids · Altered content: No · Language: English ·
Category: Education. White-label checked by the same gate the films use.

---

`;

if (!process.argv.includes('--dry')) {
  writeFileSync(new URL(OUT, import.meta.url), header + sections.join('\n---\n\n'), 'utf8');
  console.log(`\nwrote ${OUT} — ${sections.length} films`);
}
console.log(`\n${fails} FAIL · ${warns} WARN across ${CHART_IDS.length} film(s)`);
process.exit(fails ? 1 : 0);
