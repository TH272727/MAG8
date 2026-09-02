import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config";
import type { UniverseExtras, UniverseRow } from "./universe";
import {
  type CompiledReport,
  type Confidence,
  type DiscoveryCandidate,
  type LensAnalysis,
  type LensSkill,
  type MetricValue,
  type ProgressEvent,
  type RankedStock,
  type RunParams,
  type Stage,
  type Verdict,
  lensHeadline,
} from "./schemas";

/* ============================================================================
 * All SQL lives in this file. No raw handle is exported, so swapping the
 * driver (e.g. to node:sqlite DatabaseSync) is a one-file change.
 * ========================================================================== */

export type RunStatus = "pending" | "running" | "complete" | "error" | "interrupted";

export interface RunRow {
  id: string;
  status: RunStatus;
  stage: Stage | null;
  params: RunParams;
  error: string | null;
  report: CompiledReport | null;
  totalCostUsd: number | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface LensRow {
  id: number;
  runId: string;
  ticker: string;
  skill: LensSkill;
  isoWeek: string;
  status: "ok" | "error";
  analysis: LensAnalysis | null;
  error: string | null;
  cachedFromId: number | null;
  costUsd: number | null;
  numTurns: number | null;
  createdAt: string;
}

export interface CellSummary {
  ticker: string;
  skill: LensSkill;
  status: "ok" | "error";
  cached: boolean;
  error: string | null;
  verdict?: Verdict;
  confidence?: Confidence;
  headline?: string;
  costUsd: number | null;
}

export interface RunSnapshot {
  run: RunRow;
  candidates: DiscoveryCandidate[];
  cells: CellSummary[];
  rankings: RankedStock[];
  report: CompiledReport | null;
  lastEventId: number;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending','running','complete','error','interrupted')),
  stage TEXT CHECK (stage IN ('discovery','analysis','compile')),
  params_json TEXT NOT NULL,
  error TEXT,
  report_json TEXT,
  total_cost_usd REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT
);

CREATE TABLE IF NOT EXISTS candidates (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  sector TEXT NOT NULL,
  thesis TEXT NOT NULL,
  matched_traits_json TEXT NOT NULL,
  UNIQUE (run_id, ticker)
);

CREATE TABLE IF NOT EXISTS lens_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN ('stock-scanner','gt-predictor','institutional-forecast')),
  iso_week TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok','error')),
  payload_json TEXT,
  full_markdown TEXT,
  error TEXT,
  cached_from_id INTEGER,
  cost_usd REAL,
  num_turns INTEGER,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (run_id, ticker, skill)
);
CREATE INDEX IF NOT EXISTS idx_lens_cache ON lens_analyses (ticker, skill, iso_week, status);

CREATE TABLE IF NOT EXISTS rankings (
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  UNIQUE (run_id, rank)
);

CREATE TABLE IF NOT EXISTS progress_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_events_run ON progress_events (run_id, id);

CREATE TABLE IF NOT EXISTS email_signups (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS universe_snapshots (
  iso_week TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  total_listed INTEGER NOT NULL,
  rows_json TEXT NOT NULL,
  extra_json TEXT
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

/* ---------------------------------------------------------------------------
 * Bottleneck desk — a separate research product sharing this database file.
 * Deliberately carries NO foreign key into runs/candidates/lens_analyses/
 * rankings: the desk can never write to, or cascade from, the pipeline.
 * ------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS edgar_cache (
  url TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  content_type TEXT,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS bottleneck_filings (
  cik INTEGER NOT NULL,
  period TEXT NOT NULL,
  accession TEXT NOT NULL,
  filer_name TEXT NOT NULL,
  filed_at TEXT NOT NULL,
  rows_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (cik, period)
);

CREATE TABLE IF NOT EXISTS bottleneck_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('demand','bottleneck')),
  playbook_id TEXT NOT NULL,
  taken_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  payload_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_bn_snapshots ON bottleneck_snapshots (kind, playbook_id, taken_at DESC);

CREATE TABLE IF NOT EXISTS bottleneck_supply (
  series_id TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  source_url TEXT,
  origin TEXT NOT NULL CHECK (origin IN ('api','scrape','manual','filing')),
  entered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (series_id, date)
);

CREATE TABLE IF NOT EXISTS bottleneck_cusips (
  cusip TEXT PRIMARY KEY,
  ticker TEXT,
  name TEXT,
  source TEXT NOT NULL,
  resolved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

/* ---------------------------------------------------------------------------
 * The Rotation Board — a third research product sharing this database file.
 * Same rule as the desk above: NO foreign key into runs/candidates/
 * lens_analyses/rankings, so the board can never write to, or cascade from,
 * the pipeline. It stores raw daily closes and one cache of written notes;
 * every ratio, average, score, tier and direction is recomputed on read.
 * ------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS rotation_bars (
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  close REAL NOT NULL,
  adjusted INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('yahoo','nasdaq')),
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_rot_bars ON rotation_bars (ticker, date DESC);

CREATE TABLE IF NOT EXISTS rotation_briefs (
  state_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  origin TEXT NOT NULL CHECK (origin IN ('template','model')),
  as_of TEXT NOT NULL,
  changed_json TEXT NOT NULL,
  body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rot_briefs ON rotation_briefs (created_at DESC);

/* ---------------------------------------------------------------------------
 * The Insider Turnaround Scanner — a fourth research product sharing this
 * database file. Same rule as the desk and the board above: NO foreign key into
 * runs/candidates/lens_analyses/rankings, so the scanner can never write to, or
 * cascade from, the pipeline. It stores only raw inputs — filed transactions,
 * daily closes, extracted annual statements — and recomputes every cluster,
 * drawdown, score, gate, valuation and rank on read, which is what lets a
 * visitor change the risk tolerance and re-derive the whole list for free.
 * ------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS insider_transactions (
  accession TEXT NOT NULL,
  line INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  issuer_cik INTEGER NOT NULL,
  issuer_name TEXT NOT NULL,
  period TEXT NOT NULL,
  filed_date TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  code TEXT NOT NULL,
  acquired_disposed TEXT NOT NULL,
  shares REAL,
  price REAL,
  shares_after REAL,
  ownership TEXT NOT NULL,
  planned TEXT NOT NULL CHECK (planned IN ('yes','no','not-stated')),
  owners_json TEXT NOT NULL,
  flags_json TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (accession, line)
);
CREATE INDEX IF NOT EXISTS idx_ins_txn_ticker ON insider_transactions (ticker, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_ins_txn_filed ON insider_transactions (filed_date DESC);

CREATE TABLE IF NOT EXISTS insider_index_days (
  day TEXT PRIMARY KEY,
  walked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  filings_listed INTEGER NOT NULL,
  filings_fetched INTEGER NOT NULL,
  no_session INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS insider_prices (
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  close REAL NOT NULL,
  adjusted INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('yahoo','nasdaq')),
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (ticker, date)
);
CREATE INDEX IF NOT EXISTS idx_ins_prices ON insider_prices (ticker, date DESC);

CREATE TABLE IF NOT EXISTS insider_financials (
  cik INTEGER PRIMARY KEY,
  ticker TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  years_json TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  flags_json TEXT NOT NULL
);

/* ---------------------------------------------------------------------------
 * The evidence layer. ONE additive table, frozen per ISO week for the same
 * reason universe_snapshots is: a lens cell cached inside a week must describe
 * the same reference data the prompt that produced it was given. Nothing here
 * is derived — it is a list of what was published, and every reading of it
 * recomputes on read.
 * ------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS reach_snapshots (
  iso_week TEXT PRIMARY KEY,
  fetched_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS insider_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  taken_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  payload_json TEXT NOT NULL
);
`;

type GlobalWithDb = typeof globalThis & { __mag8_db?: Database.Database };

function init(): Database.Database {
  fs.mkdirSync(path.dirname(CONFIG.dbPath), { recursive: true });
  const db = new Database(CONFIG.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  migrate(db);
  reconcileInterrupted(db);
  return db;
}

/**
 * Guarded mini-migrations — the sanctioned pattern for schema evolution.
 * SCHEMA_SQL always creates the LATEST shape (fresh DBs need no ALTERs);
 * version-gated ALTERs below upgrade existing files. Each step is guarded by
 * a column check so a partially-applied step is safe to re-run.
 */
function migrate(db: Database.Database): void {
  const v = db.pragma("user_version", { simple: true }) as number;
  if (v < 2) {
    const cols = db.prepare(`PRAGMA table_info(lens_analyses)`).all() as { name: string }[];
    if (!cols.some((c) => c.name === "num_turns")) {
      db.exec(`ALTER TABLE lens_analyses ADD COLUMN num_turns INTEGER`);
    }
    db.pragma("user_version = 2");
  }
  if (v < 3) {
    // Stage-0 v2: SEC-derived fundamentals ride the weekly snapshot (extra_json);
    // app_settings is created by SCHEMA_SQL on both fresh and existing files.
    const cols = db.prepare(`PRAGMA table_info(universe_snapshots)`).all() as { name: string }[];
    if (cols.length > 0 && !cols.some((c) => c.name === "extra_json")) {
      db.exec(`ALTER TABLE universe_snapshots ADD COLUMN extra_json TEXT`);
    }
    db.pragma("user_version = 3");
  }
  if (v < 4) {
    // Bottleneck desk: five additive tables, all created by SCHEMA_SQL above on
    // fresh AND existing files (CREATE TABLE IF NOT EXISTS runs every boot), so
    // there is no column to patch — only the version to record. Nothing here
    // touches a pipeline table.
    db.pragma("user_version = 4");
  }
  if (v < 5) {
    // Rotation Board: two additive tables, created by SCHEMA_SQL on fresh AND
    // existing files for the same reason as step 4 — no column to patch, only
    // the version to record. Nothing here touches a pipeline table either.
    db.pragma("user_version = 5");
  }
  if (v < 6) {
    // Insider Turnaround Scanner: five additive tables, created by SCHEMA_SQL on
    // fresh AND existing files for the same reason as steps 4 and 5 — no column
    // to patch, only the version to record. Nothing here touches a pipeline
    // table either.
    db.pragma("user_version = 6");
  }
  if (v < 7) {
    // Evidence layer: one additive table, created by SCHEMA_SQL on fresh AND
    // existing files for the same reason as steps 4-6 — no column to patch,
    // only the version to record. Nothing here touches a pipeline table.
    db.pragma("user_version = 7");
  }
}

/** Boot reconciliation: fires once per true process start (globalThis survives dev HMR). */
function reconcileInterrupted(db: Database.Database): void {
  const stale = db
    .prepare(`SELECT id FROM runs WHERE status IN ('pending','running')`)
    .all() as { id: string }[];
  if (stale.length === 0) return;
  const now = new Date().toISOString();
  const message = "Run interrupted by a server restart before it could finish.";
  const upd = db.prepare(`UPDATE runs SET status='interrupted', error=?, finished_at=? WHERE id=?`);
  const evt = db.prepare(`INSERT INTO progress_events (run_id, type, payload_json) VALUES (?, 'run_error', ?)`);
  const tx = db.transaction(() => {
    for (const r of stale) {
      upd.run(message, now, r.id);
      const event: ProgressEvent = { type: "run_error", error: message, at: now };
      evt.run(r.id, JSON.stringify(event));
    }
  });
  tx();
}

function getDb(): Database.Database {
  const g = globalThis as GlobalWithDb;
  if (!g.__mag8_db) g.__mag8_db = init();
  return g.__mag8_db;
}

/* ============================================================================
 * Helpers
 * ========================================================================== */

/** ISO-8601 week key, e.g. "2026-W27" — the lens-cache freshness window. */
export function isoWeekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

interface RawRunRow {
  id: string;
  status: RunStatus;
  stage: Stage | null;
  params_json: string;
  error: string | null;
  report_json: string | null;
  total_cost_usd: number | null;
  created_at: string;
  finished_at: string | null;
}

function toRunRow(r: RawRunRow): RunRow {
  return {
    id: r.id,
    status: r.status,
    stage: r.stage,
    params: parseJson<RunParams>(r.params_json) ?? { count: 8, force: false, mock: false, blind: false },
    error: r.error,
    report: parseJson<CompiledReport>(r.report_json),
    totalCostUsd: r.total_cost_usd,
    createdAt: r.created_at,
    finishedAt: r.finished_at,
  };
}

interface RawLensRow {
  id: number;
  run_id: string;
  ticker: string;
  skill: LensSkill;
  iso_week: string;
  status: "ok" | "error";
  payload_json: string | null;
  full_markdown: string | null;
  error: string | null;
  cached_from_id: number | null;
  cost_usd: number | null;
  num_turns: number | null;
  created_at: string;
}

function toLensRow(r: RawLensRow): LensRow {
  const payload = parseJson<Omit<LensAnalysis, "fullAnalysisMarkdown">>(r.payload_json);
  return {
    id: r.id,
    runId: r.run_id,
    ticker: r.ticker,
    skill: r.skill,
    isoWeek: r.iso_week,
    status: r.status,
    analysis: payload ? { ...payload, fullAnalysisMarkdown: r.full_markdown ?? "" } : null,
    error: r.error,
    cachedFromId: r.cached_from_id,
    costUsd: r.cost_usd,
    numTurns: r.num_turns,
    createdAt: r.created_at,
  };
}

function toCellSummary(row: LensRow): CellSummary {
  const base: CellSummary = {
    ticker: row.ticker,
    skill: row.skill,
    status: row.status,
    cached: row.cachedFromId !== null,
    error: row.error,
    costUsd: row.costUsd,
  };
  if (row.status === "ok" && row.analysis) {
    base.verdict = row.analysis.verdict;
    base.confidence = row.analysis.confidence;
    base.headline = lensHeadline(row.skill, row.analysis.keyMetrics as Record<string, MetricValue>);
  }
  return base;
}

/* ============================================================================
 * Runs
 * ========================================================================== */

export function createRun(id: string, params: RunParams): void {
  getDb()
    .prepare(`INSERT INTO runs (id, status, params_json) VALUES (?, 'pending', ?)`)
    .run(id, JSON.stringify(params));
}

export function setRunStage(runId: string, stage: Stage): void {
  getDb().prepare(`UPDATE runs SET status='running', stage=? WHERE id=?`).run(stage, runId);
}

export function finishRun(
  runId: string,
  outcome: {
    status: Extract<RunStatus, "complete" | "error" | "interrupted">;
    error?: string;
    report?: CompiledReport;
    totalCostUsd?: number;
  },
): void {
  getDb()
    .prepare(
      `UPDATE runs SET status=?, stage=NULL, error=?, report_json=COALESCE(?, report_json),
       total_cost_usd=COALESCE(?, total_cost_usd), finished_at=? WHERE id=?`,
    )
    .run(
      outcome.status,
      outcome.error ?? null,
      outcome.report ? JSON.stringify(outcome.report) : null,
      outcome.totalCostUsd ?? null,
      new Date().toISOString(),
      runId,
    );
}

/**
 * Resume: clear a terminal run's ending so the same row can carry on in place.
 * The stage that picks it up sets `stage` (setRunStage); the earlier attempt's
 * cost stays put — a resume adds to the running total, it does not restart it.
 */
export function reopenRun(runId: string): void {
  getDb()
    .prepare(`UPDATE runs SET status='running', error=NULL, finished_at=NULL WHERE id=?`)
    .run(runId);
}

export function getRun(runId: string): RunRow | null {
  const r = getDb().prepare(`SELECT * FROM runs WHERE id=?`).get(runId) as RawRunRow | undefined;
  return r ? toRunRow(r) : null;
}

export function getActiveRun(): RunRow | null {
  const r = getDb()
    .prepare(`SELECT * FROM runs WHERE status IN ('pending','running') ORDER BY created_at DESC, rowid DESC LIMIT 1`)
    .get() as RawRunRow | undefined;
  return r ? toRunRow(r) : null;
}

export function latestCompleteRun(): RunRow | null {
  const r = getDb()
    .prepare(`SELECT * FROM runs WHERE status='complete' ORDER BY created_at DESC, rowid DESC LIMIT 1`)
    .get() as RawRunRow | undefined;
  return r ? toRunRow(r) : null;
}

/**
 * Most recent complete run WITHOUT a focus directive — the canonical weekly
 * board. Keeps a lab (focused) run from ever displacing the weekly leaderboard.
 */
export function latestCanonicalRun(): RunRow | null {
  const r = getDb()
    .prepare(
      `SELECT * FROM runs WHERE status='complete'
         AND ${kindClause("canonical")}
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get() as RawRunRow | undefined;
  return r ? toRunRow(r) : null;
}

export function listRuns(limit = 50): RunRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM runs ORDER BY created_at DESC, rowid DESC LIMIT ?`)
    .all(limit) as RawRunRow[];
  return rows.map(toRunRow);
}

export function deleteRun(runId: string): void {
  getDb().prepare(`DELETE FROM runs WHERE id=?`).run(runId);
}

export interface RunTally {
  /** Candidates the run's discovery stage delivered (0 = it never got that far). */
  cohort: number;
  /** Lens cells already banked (status ok) — what a resume would NOT have to re-run. */
  banked: number;
}

const EMPTY_TALLY: RunTally = { cohort: 0, banked: 0 };

/**
 * How far a run actually got, without loading a single lens payload — two
 * grouped counts. Powers the desk's resume affordance ("16 of 24 cells left")
 * across the whole history list.
 */
export function runTallies(): Record<string, RunTally> {
  const db = getDb();
  const out: Record<string, RunTally> = {};
  const at = (id: string) => (out[id] ??= { ...EMPTY_TALLY });
  for (const r of db.prepare(`SELECT run_id, COUNT(*) AS n FROM candidates GROUP BY run_id`).all() as {
    run_id: string;
    n: number;
  }[]) {
    at(r.run_id).cohort = r.n;
  }
  for (const r of db
    .prepare(`SELECT run_id, SUM(status='ok') AS n FROM lens_analyses GROUP BY run_id`)
    .all() as { run_id: string; n: number | null }[]) {
    at(r.run_id).banked = r.n ?? 0;
  }
  return out;
}

/** Single-run flavour of runTallies() — one run page, two counts. */
export function runTally(runId: string): RunTally {
  const db = getDb();
  const c = db.prepare(`SELECT COUNT(*) AS n FROM candidates WHERE run_id=?`).get(runId) as { n: number };
  const l = db
    .prepare(`SELECT SUM(status='ok') AS n FROM lens_analyses WHERE run_id=?`)
    .get(runId) as { n: number | null };
  return { cohort: c.n, banked: l.n ?? 0 };
}

/* ============================================================================
 * Candidates
 * ========================================================================== */

export function insertCandidates(runId: string, candidates: DiscoveryCandidate[]): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO candidates (run_id, position, ticker, company_name, sector, thesis, matched_traits_json)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    candidates.forEach((c, i) => {
      stmt.run(runId, i + 1, c.ticker, c.companyName, c.sector, c.thesis, JSON.stringify(c.matchedTraits));
    });
  });
  tx();
}

export function getCandidates(runId: string): DiscoveryCandidate[] {
  const rows = getDb()
    .prepare(`SELECT * FROM candidates WHERE run_id=? ORDER BY position`)
    .all(runId) as {
    ticker: string;
    company_name: string;
    sector: string;
    thesis: string;
    matched_traits_json: string;
  }[];
  return rows.map((r) => ({
    ticker: r.ticker,
    companyName: r.company_name,
    sector: r.sector,
    thesis: r.thesis,
    matchedTraits: parseJson<string[]>(r.matched_traits_json) ?? [],
  }));
}

export function getCandidate(runId: string, ticker: string): DiscoveryCandidate | null {
  return getCandidates(runId).find((c) => c.ticker === ticker) ?? null;
}

export interface CoverageEntry {
  ticker: string;
  companyName: string;
  /** ISO week the run that surfaced this ticker was started in. */
  weekKey: string;
}

/**
 * Tickers surfaced by the last N completed REAL runs (mock/demo excluded),
 * most recent first, deduped by ticker. Fed into the discovery prompt as
 * anti-repetition pressure — never as a hard ban.
 */
export function getRecentCoverage(nRuns = 5): CoverageEntry[] {
  const db = getDb();
  const runs = db
    .prepare(
      `SELECT id, created_at FROM runs
       WHERE status='complete' AND COALESCE(json_extract(params_json, '$.mock'), 0) = 0
       ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .all(nRuns) as { id: string; created_at: string }[];
  const byRun = db.prepare(`SELECT ticker, company_name FROM candidates WHERE run_id=? ORDER BY position`);
  const seen = new Set<string>();
  const out: CoverageEntry[] = [];
  for (const r of runs) {
    const weekKey = isoWeekKey(new Date(r.created_at));
    for (const c of byRun.all(r.id) as { ticker: string; company_name: string }[]) {
      if (seen.has(c.ticker)) continue;
      seen.add(c.ticker);
      out.push({ ticker: c.ticker, companyName: c.company_name, weekKey });
    }
  }
  return out;
}

/* ============================================================================
 * Lens analyses (doubles as the cross-run cache via idx_lens_cache)
 * ========================================================================== */

export function getCachedLens(ticker: string, skill: LensSkill, isoWeek: string): LensRow | null {
  const r = getDb()
    .prepare(
      `SELECT * FROM lens_analyses WHERE ticker=? AND skill=? AND iso_week=? AND status='ok'
       ORDER BY id DESC LIMIT 1`,
    )
    .get(ticker, skill, isoWeek) as RawLensRow | undefined;
  return r ? toLensRow(r) : null;
}

export function insertLensResult(input: {
  runId: string;
  ticker: string;
  skill: LensSkill;
  isoWeek: string;
  status: "ok" | "error";
  analysis?: LensAnalysis;
  error?: string;
  costUsd?: number;
  numTurns?: number;
  cachedFromId?: number;
}): number {
  const payload = input.analysis
    ? (({ fullAnalysisMarkdown: _md, ...rest }) => rest)(input.analysis)
    : null;
  const info = getDb()
    .prepare(
      `INSERT OR REPLACE INTO lens_analyses
       (run_id, ticker, skill, iso_week, status, payload_json, full_markdown, error, cached_from_id, cost_usd, num_turns)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.runId,
      input.ticker,
      input.skill,
      input.isoWeek,
      input.status,
      payload ? JSON.stringify(payload) : null,
      input.analysis?.fullAnalysisMarkdown ?? null,
      input.error ?? null,
      input.cachedFromId ?? null,
      input.costUsd ?? null,
      input.numTurns ?? null,
    );
  return Number(info.lastInsertRowid);
}

/** Cache hit: copy the origin row into the current run with provenance. */
export function insertLensCachedCopy(runId: string, origin: LensRow): number {
  if (!origin.analysis) throw new Error("cannot copy a lens row without a payload");
  return insertLensResult({
    runId,
    ticker: origin.ticker,
    skill: origin.skill,
    isoWeek: origin.isoWeek,
    status: "ok",
    analysis: origin.analysis,
    costUsd: 0,
    cachedFromId: origin.id,
  });
}

export function getLensRowsForRun(runId: string): LensRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM lens_analyses WHERE run_id=? ORDER BY id`)
    .all(runId) as RawLensRow[];
  return rows.map(toLensRow);
}

export function getLensRowsForTicker(runId: string, ticker: string): LensRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM lens_analyses WHERE run_id=? AND ticker=? ORDER BY id`)
    .all(runId, ticker) as RawLensRow[];
  return rows.map(toLensRow);
}

/* ============================================================================
 * Rankings
 * ========================================================================== */

export function insertRankings(runId: string, rankings: RankedStock[]): void {
  const db = getDb();
  const del = db.prepare(`DELETE FROM rankings WHERE run_id=?`);
  const ins = db.prepare(`INSERT INTO rankings (run_id, rank, ticker, payload_json) VALUES (?, ?, ?, ?)`);
  const tx = db.transaction(() => {
    del.run(runId);
    for (const s of rankings) ins.run(runId, s.rank, s.ticker, JSON.stringify(s));
  });
  tx();
}

export function getRankings(runId: string): RankedStock[] {
  const rows = getDb()
    .prepare(`SELECT payload_json FROM rankings WHERE run_id=? ORDER BY rank`)
    .all(runId) as { payload_json: string }[];
  return rows.map((r) => parseJson<RankedStock>(r.payload_json)).filter((x): x is RankedStock => x !== null);
}

export function getRankingForTicker(runId: string, ticker: string): RankedStock | null {
  const r = getDb()
    .prepare(`SELECT payload_json FROM rankings WHERE run_id=? AND ticker=? LIMIT 1`)
    .get(runId, ticker) as { payload_json: string } | undefined;
  return r ? parseJson<RankedStock>(r.payload_json) : null;
}

/** Most recent complete run whose leaderboard includes this ticker. */
export function latestRunForTicker(ticker: string): RunRow | null {
  const r = getDb()
    .prepare(
      `SELECT r.* FROM runs r JOIN rankings k ON k.run_id = r.id
       WHERE k.ticker=? AND r.status='complete'
       ORDER BY r.created_at DESC, r.rowid DESC LIMIT 1`,
    )
    .get(ticker) as RawRunRow | undefined;
  return r ? toRunRow(r) : null;
}

/* ============================================================================
 * All-time boards — the rankings table aggregated per ticker across completed
 * runs, split by run kind. 'canonical' = the untouched weekly pipeline (no
 * focus directive AND not a blind-selection experiment); 'focused' = any
 * operator/user lab run (a focus directive OR blind mode). Both classifiers
 * live in params_json (sanitizeModifier never persists an empty one; blind
 * defaults false/absent), so historical rows sort themselves with no DDL.
 * Computed on read: a board can only move when a run of its own kind completes.
 * A blind experiment can therefore never displace the canonical weekly board.
 * ========================================================================== */

export type BoardKind = "canonical" | "focused";

/** SQL predicate for a run kind; `col` is the params_json column reference. */
function kindClause(kind: BoardKind, col = "params_json"): string {
  const m = `json_extract(${col},'$.modifier')`;
  const blind = `COALESCE(json_extract(${col},'$.blind'),0)`;
  return kind === "canonical"
    ? `((${m} IS NULL OR ${m} = '') AND ${blind} = 0)`
    : `((${m} IS NOT NULL AND ${m} != '') OR ${blind} = 1)`;
}

export interface BoardEntry {
  ticker: string;
  /** RankedStock payload from the run where this ticker posted its best score. */
  best: RankedStock;
  bestRunId: string;
  /** When the best-scoring run finished (falls back to its start time). */
  bestRunAt: string;
  /** Focus directive of the best-scoring run (focused board only; internal text — sanitize at the public boundary). */
  bestRunFocus?: string;
  /** Qualifying runs whose leaderboard included this ticker. */
  appearances: number;
  lastSeenAt: string;
}

export interface BoardResult {
  kind: BoardKind;
  entries: BoardEntry[];
  /** Qualifying runs feeding this board. */
  runCount: number;
  /** When the most recent qualifying run finished. */
  updatedAt: string | null;
  /** True when built from mock/demo runs because no real run of this kind exists yet. */
  demo: boolean;
}

interface RawBoardRow {
  ticker: string;
  payload_json: string;
  run_id: string;
  created_at: string;
  finished_at: string | null;
  modifier: string | null;
}

function boardRows(kind: BoardKind, mock: boolean): RawBoardRow[] {
  return getDb()
    .prepare(
      `SELECT k.ticker, k.payload_json, r.id AS run_id, r.created_at, r.finished_at,
              json_extract(r.params_json,'$.modifier') AS modifier
       FROM rankings k JOIN runs r ON r.id = k.run_id
       WHERE r.status='complete'
         AND COALESCE(json_extract(r.params_json,'$.mock'),0) = ?
         AND ${kindClause(kind, "r.params_json")}`,
    )
    .all(mock ? 1 : 0) as RawBoardRow[];
}

export function getAllTimeBoard(kind: BoardKind, limit = 50): BoardResult {
  let rows = boardRows(kind, false);
  let demo = false;
  if (rows.length === 0) {
    rows = boardRows(kind, true);
    demo = rows.length > 0;
  }

  const byTicker = new Map<string, BoardEntry>();
  const runIds = new Set<string>();
  let updatedAt: string | null = null;
  for (const r of rows) {
    const stock = parseJson<RankedStock>(r.payload_json);
    if (!stock) continue;
    runIds.add(r.run_id);
    const at = r.finished_at ?? r.created_at;
    if (updatedAt === null || at > updatedAt) updatedAt = at;
    const prev = byTicker.get(r.ticker);
    if (!prev) {
      byTicker.set(r.ticker, {
        ticker: r.ticker,
        best: stock,
        bestRunId: r.run_id,
        bestRunAt: at,
        ...(r.modifier ? { bestRunFocus: r.modifier } : {}),
        appearances: 1,
        lastSeenAt: at,
      });
      continue;
    }
    prev.appearances += 1;
    if (at > prev.lastSeenAt) prev.lastSeenAt = at;
    if (
      stock.finalScore > prev.best.finalScore ||
      (stock.finalScore === prev.best.finalScore && at > prev.bestRunAt)
    ) {
      prev.best = stock;
      prev.bestRunId = r.run_id;
      prev.bestRunAt = at;
      if (r.modifier) prev.bestRunFocus = r.modifier;
      else delete prev.bestRunFocus;
    }
  }

  const entries = [...byTicker.values()]
    .sort(
      (a, b) =>
        b.best.finalScore - a.best.finalScore ||
        b.lastSeenAt.localeCompare(a.lastSeenAt) ||
        a.ticker.localeCompare(b.ticker),
    )
    .slice(0, limit);
  return { kind, entries, runCount: runIds.size, updatedAt, demo };
}

/* ============================================================================
 * Progress events (rowid doubles as the SSE event id)
 * ========================================================================== */

export function appendEvent(runId: string, event: ProgressEvent): number {
  const info = getDb()
    .prepare(`INSERT INTO progress_events (run_id, type, payload_json) VALUES (?, ?, ?)`)
    .run(runId, event.type, JSON.stringify(event));
  return Number(info.lastInsertRowid);
}

export function getEventsSince(runId: string, afterId: number): { id: number; event: ProgressEvent }[] {
  const rows = getDb()
    .prepare(`SELECT id, payload_json FROM progress_events WHERE run_id=? AND id>? ORDER BY id`)
    .all(runId, afterId) as { id: number; payload_json: string }[];
  const out: { id: number; event: ProgressEvent }[] = [];
  for (const r of rows) {
    const event = parseJson<ProgressEvent>(r.payload_json);
    if (event) out.push({ id: r.id, event });
  }
  return out;
}

/**
 * The market framing this run's discovery stage delivered, recovered from its
 * own event log (the only place it is persisted). A resume feeds it back to the
 * compiler verbatim, so a finished-later report reads exactly as it would have.
 */
export function getRunMarketContext(runId: string): string | null {
  const r = getDb()
    .prepare(
      `SELECT payload_json FROM progress_events WHERE run_id=? AND type='discovery_complete'
       ORDER BY id DESC LIMIT 1`,
    )
    .get(runId) as { payload_json: string } | undefined;
  const text = r ? parseJson<{ marketContext?: string }>(r.payload_json)?.marketContext : null;
  return text && text.trim() ? text.trim() : null;
}

export function getMaxEventId(runId: string): number {
  const r = getDb()
    .prepare(`SELECT MAX(id) AS m FROM progress_events WHERE run_id=?`)
    .get(runId) as { m: number | null };
  return r.m ?? 0;
}

/* ============================================================================
 * Snapshot (server-rendered Mission Control for terminal runs; SSE-less state)
 * ========================================================================== */

export function getRunSnapshot(runId: string): RunSnapshot | null {
  const run = getRun(runId);
  if (!run) return null;
  return {
    run,
    candidates: getCandidates(runId),
    cells: getLensRowsForRun(runId).map(toCellSummary),
    rankings: getRankings(runId),
    report: run.report,
    lastEventId: getMaxEventId(runId),
  };
}

/* ============================================================================
 * Universe snapshots (Stage-0 weekly cache — logic lives in lib/universe.ts)
 * ========================================================================== */

export interface UniverseSnapshotRow {
  isoWeek: string;
  fetchedAt: string;
  /** Raw listings fetched across exchanges, pre-normalization. */
  totalListed: number;
  /** Normalized common-stock/ADR rows, ALL market caps — band filters apply on read. */
  rows: UniverseRow[];
  /** SEC-derived fundamentals + source metadata (v2 snapshots; null on pre-v2 rows — screens fail open). */
  extras: UniverseExtras | null;
}

interface RawUniverseSnapshot {
  iso_week: string;
  fetched_at: string;
  total_listed: number;
  rows_json: string;
  extra_json: string | null;
}

function toUniverseSnapshot(r: RawUniverseSnapshot): UniverseSnapshotRow | null {
  const rows = parseJson<UniverseRow[]>(r.rows_json);
  if (!rows) return null;
  return {
    isoWeek: r.iso_week,
    fetchedAt: r.fetched_at,
    totalListed: r.total_listed,
    rows,
    extras: parseJson<UniverseExtras>(r.extra_json),
  };
}

export function getUniverseSnapshot(isoWeek: string): UniverseSnapshotRow | null {
  const r = getDb()
    .prepare(`SELECT * FROM universe_snapshots WHERE iso_week=?`)
    .get(isoWeek) as RawUniverseSnapshot | undefined;
  return r ? toUniverseSnapshot(r) : null;
}

/** Most recent snapshot of any week — the stale fallback when a live refresh fails. */
export function latestUniverseSnapshot(): UniverseSnapshotRow | null {
  const r = getDb()
    .prepare(`SELECT * FROM universe_snapshots ORDER BY iso_week DESC LIMIT 1`)
    .get() as RawUniverseSnapshot | undefined;
  return r ? toUniverseSnapshot(r) : null;
}

/** Snapshots run ~0.5 MB each; keep a fixed trailing window. */
const UNIVERSE_KEEP_WEEKS = 12;

export function saveUniverseSnapshot(
  isoWeek: string,
  totalListed: number,
  rows: UniverseRow[],
  extras: UniverseExtras | null,
): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT OR REPLACE INTO universe_snapshots (iso_week, total_listed, rows_json, extra_json) VALUES (?, ?, ?, ?)`,
    ).run(isoWeek, totalListed, JSON.stringify(rows), extras ? JSON.stringify(extras) : null);
    db.prepare(
      `DELETE FROM universe_snapshots WHERE iso_week NOT IN
         (SELECT iso_week FROM universe_snapshots ORDER BY iso_week DESC LIMIT ?)`,
    ).run(UNIVERSE_KEEP_WEEKS);
  });
  tx();
}

/* ============================================================================
 * Evidence-layer snapshots. Stored whole and parsed on read: the payload is a
 * list of what was published, never a score, so there is nothing in it that
 * could go stale differently from the rest of it.
 * ========================================================================== */

export interface ReachSnapshotRow<T = unknown> {
  isoWeek: string;
  fetchedAt: string;
  payload: T;
}

function toReachSnapshot<T>(r: { iso_week: string; fetched_at: string; payload_json: string }): ReachSnapshotRow<T> | null {
  const payload = parseJson<T>(r.payload_json);
  return payload === null ? null : { isoWeek: r.iso_week, fetchedAt: r.fetched_at, payload };
}

type RawReachSnapshot = { iso_week: string; fetched_at: string; payload_json: string };

export function getReachSnapshot<T>(isoWeek: string): ReachSnapshotRow<T> | null {
  const r = getDb().prepare(`SELECT * FROM reach_snapshots WHERE iso_week=?`).get(isoWeek) as
    | RawReachSnapshot
    | undefined;
  return r ? toReachSnapshot<T>(r) : null;
}

/** Most recent snapshot of any week — the stale fallback when a refresh fails. */
export function latestReachSnapshot<T>(): ReachSnapshotRow<T> | null {
  const r = getDb().prepare(`SELECT * FROM reach_snapshots ORDER BY iso_week DESC LIMIT 1`).get() as
    | RawReachSnapshot
    | undefined;
  return r ? toReachSnapshot<T>(r) : null;
}

/** Small payloads, but there is no reason to keep a year of them. */
const REACH_KEEP_WEEKS = 12;

export function saveReachSnapshot(isoWeek: string, payload: unknown): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO reach_snapshots (iso_week, payload_json, fetched_at)
         VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(iso_week) DO UPDATE SET
         payload_json=excluded.payload_json, fetched_at=excluded.fetched_at`,
    ).run(isoWeek, JSON.stringify(payload));
    db.prepare(
      `DELETE FROM reach_snapshots WHERE iso_week NOT IN
         (SELECT iso_week FROM reach_snapshots ORDER BY iso_week DESC LIMIT ?)`,
    ).run(REACH_KEEP_WEEKS);
  });
  tx();
}

/* ============================================================================
 * App settings (owner-tunable knobs; namespaced JSON per key — the Stage-0
 * screen stores its overrides under 'universe_settings')
 * ========================================================================== */

export function getAppSettingJson(key: string): unknown {
  const r = getDb().prepare(`SELECT value_json FROM app_settings WHERE key=?`).get(key) as
    | { value_json: string }
    | undefined;
  return r ? parseJson<unknown>(r.value_json) : null;
}

export function setAppSettingJson(key: string, value: unknown): void {
  getDb()
    .prepare(
      `INSERT INTO app_settings (key, value_json, updated_at)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at`,
    )
    .run(key, JSON.stringify(value ?? null));
}

/* ============================================================================
 * Email signups
 * ========================================================================== */

export function insertSignup(email: string): boolean {
  const info = getDb()
    .prepare(`INSERT OR IGNORE INTO email_signups (email) VALUES (?)`)
    .run(email.trim());
  return info.changes > 0;
}

export function countSignups(): number {
  const row = getDb().prepare(`SELECT COUNT(*) AS n FROM email_signups`).get() as { n: number };
  return row.n;
}

export function listSignups(): { email: string; createdAt: string }[] {
  return getDb()
    .prepare(`SELECT email, created_at AS createdAt FROM email_signups ORDER BY created_at DESC, email`)
    .all() as { email: string; createdAt: string }[];
}

/* ============================================================================
 * EDGAR response cache (lib/edgar.ts binds to this lazily)
 * ========================================================================== */

export interface EdgarCacheRow {
  body: string;
  contentType: string | null;
  fetchedAt: string;
}

export function getEdgarCache(url: string): EdgarCacheRow | null {
  const r = getDb()
    .prepare(`SELECT body, content_type, fetched_at FROM edgar_cache WHERE url=?`)
    .get(url) as { body: string; content_type: string | null; fetched_at: string } | undefined;
  return r ? { body: r.body, contentType: r.content_type, fetchedAt: r.fetched_at } : null;
}

export function setEdgarCache(url: string, body: string, contentType: string | null): void {
  getDb()
    .prepare(
      `INSERT INTO edgar_cache (url, body, content_type, fetched_at)
       VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(url) DO UPDATE SET body=excluded.body, content_type=excluded.content_type,
         fetched_at=excluded.fetched_at`,
    )
    .run(url, body, contentType);
}

/** Drop cached responses older than `maxAgeDays`. Called from the desk's refresh path, not per write. */
export function sweepEdgarCache(maxAgeDays = 90): number {
  const info = getDb()
    .prepare(`DELETE FROM edgar_cache WHERE fetched_at < datetime('now', ?)`)
    .run(`-${Math.max(1, Math.round(maxAgeDays))} days`);
  return info.changes;
}

export function edgarCacheStats(): { rows: number; bytes: number } {
  return getDb()
    .prepare(`SELECT COUNT(*) AS rows, COALESCE(SUM(length(body)),0) AS bytes FROM edgar_cache`)
    .get() as { rows: number; bytes: number };
}

/* ============================================================================
 * Bottleneck desk — parsed 13F filings, dated snapshots, supply series, CUSIPs.
 * Payloads stay opaque JSON here so lib/bottleneck owns every shape (and this
 * file never imports from it, so there is no cycle).
 * ========================================================================== */

interface RawFilingSnapshot {
  cik: number;
  period: string;
  accession: string;
  filer_name: string;
  filed_at: string;
  rows_json: string;
  fetched_at: string;
}

export interface FilingSnapshotRow<T = unknown> {
  cik: number;
  /** Period of report, YYYY-MM-DD. */
  period: string;
  accession: string;
  filerName: string;
  filedAt: string;
  rows: T;
  fetchedAt: string;
}

function toFilingSnapshot<T>(r: RawFilingSnapshot): FilingSnapshotRow<T> | null {
  const rows = parseJson<T>(r.rows_json);
  if (rows === null) return null;
  return {
    cik: r.cik,
    period: r.period,
    accession: r.accession,
    filerName: r.filer_name,
    filedAt: r.filed_at,
    rows,
    fetchedAt: r.fetched_at,
  };
}

export function saveFilingSnapshot(input: {
  cik: number;
  period: string;
  accession: string;
  filerName: string;
  filedAt: string;
  rows: unknown;
}): void {
  getDb()
    .prepare(
      `INSERT INTO bottleneck_filings (cik, period, accession, filer_name, filed_at, rows_json, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
       ON CONFLICT(cik, period) DO UPDATE SET accession=excluded.accession, filer_name=excluded.filer_name,
         filed_at=excluded.filed_at, rows_json=excluded.rows_json, fetched_at=excluded.fetched_at`,
    )
    .run(input.cik, input.period, input.accession, input.filerName, input.filedAt, JSON.stringify(input.rows));
}

export function getFilingSnapshot<T = unknown>(cik: number, period: string): FilingSnapshotRow<T> | null {
  const r = getDb()
    .prepare(`SELECT * FROM bottleneck_filings WHERE cik=? AND period=?`)
    .get(cik, period) as RawFilingSnapshot | undefined;
  return r ? toFilingSnapshot<T>(r) : null;
}

/** A filer's stored periods, newest first. */
export function listFilingSnapshots<T = unknown>(cik: number, limit = 8): FilingSnapshotRow<T>[] {
  const rows = getDb()
    .prepare(`SELECT * FROM bottleneck_filings WHERE cik=? ORDER BY period DESC LIMIT ?`)
    .all(cik, limit) as RawFilingSnapshot[];
  return rows.map((r) => toFilingSnapshot<T>(r)).filter((x): x is FilingSnapshotRow<T> => x !== null);
}

export type BottleneckSnapshotKind = "demand" | "bottleneck";

export interface BottleneckSnapshotRow<T = unknown> {
  id: number;
  kind: BottleneckSnapshotKind;
  playbookId: string;
  takenAt: string;
  payload: T;
}

/** Snapshots run ~10–100 KB each; keep a trailing window per (kind, playbook). */
const BOTTLENECK_KEEP_SNAPSHOTS = 24;

export function saveBottleneckSnapshot(
  kind: BottleneckSnapshotKind,
  playbookId: string,
  payload: unknown,
): number {
  const db = getDb();
  let id = 0;
  const tx = db.transaction(() => {
    const info = db
      .prepare(`INSERT INTO bottleneck_snapshots (kind, playbook_id, payload_json) VALUES (?, ?, ?)`)
      .run(kind, playbookId, JSON.stringify(payload));
    id = Number(info.lastInsertRowid);
    db.prepare(
      `DELETE FROM bottleneck_snapshots WHERE kind=? AND playbook_id=? AND id NOT IN
         (SELECT id FROM bottleneck_snapshots WHERE kind=? AND playbook_id=? ORDER BY id DESC LIMIT ?)`,
    ).run(kind, playbookId, kind, playbookId, BOTTLENECK_KEEP_SNAPSHOTS);
  });
  tx();
  return id;
}

interface RawBottleneckSnapshot {
  id: number;
  kind: BottleneckSnapshotKind;
  playbook_id: string;
  taken_at: string;
  payload_json: string;
}

function toBottleneckSnapshot<T>(r: RawBottleneckSnapshot): BottleneckSnapshotRow<T> | null {
  const payload = parseJson<T>(r.payload_json);
  if (payload === null) return null;
  return { id: r.id, kind: r.kind, playbookId: r.playbook_id, takenAt: r.taken_at, payload };
}

/**
 * The most recent `limit` snapshots of a kind, newest first. Two of these is
 * what the desk's "tightening or easing?" comparison runs on.
 */
export function listBottleneckSnapshots<T = unknown>(
  kind: BottleneckSnapshotKind,
  playbookId: string,
  limit = 2,
): BottleneckSnapshotRow<T>[] {
  const rows = getDb()
    .prepare(`SELECT * FROM bottleneck_snapshots WHERE kind=? AND playbook_id=? ORDER BY id DESC LIMIT ?`)
    .all(kind, playbookId, limit) as RawBottleneckSnapshot[];
  return rows.map((r) => toBottleneckSnapshot<T>(r)).filter((x): x is BottleneckSnapshotRow<T> => x !== null);
}

/**
 * Remove snapshots by id. Shape-agnostic on purpose — this file never inspects
 * a payload, so deciding WHICH rows are unusable belongs to lib/bottleneck.
 */
export function deleteBottleneckSnapshots(ids: number[]): number {
  if (ids.length === 0) return 0;
  const db = getDb();
  let removed = 0;
  const tx = db.transaction(() => {
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400);
      removed += db
        .prepare(`DELETE FROM bottleneck_snapshots WHERE id IN (${chunk.map(() => "?").join(",")})`)
        .run(...chunk).changes;
    }
  });
  tx();
  return removed;
}

export function latestBottleneckSnapshot<T = unknown>(
  kind: BottleneckSnapshotKind,
  playbookId: string,
): BottleneckSnapshotRow<T> | null {
  return listBottleneckSnapshots<T>(kind, playbookId, 1)[0] ?? null;
}

export interface SupplyPoint {
  seriesId: string;
  /** YYYY-MM-DD (month-end for monthly series). */
  date: string;
  value: number;
  unit: string;
  sourceUrl: string | null;
  origin: "api" | "scrape" | "manual" | "filing";
}

/** Upsert points for any connector kind — scraped, API, manual, and filing-derived share one store. */
export function saveSupplyPoints(points: SupplyPoint[]): number {
  if (points.length === 0) return 0;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO bottleneck_supply (series_id, date, value, unit, source_url, origin, entered_at)
     VALUES (?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(series_id, date) DO UPDATE SET value=excluded.value, unit=excluded.unit,
       source_url=excluded.source_url, origin=excluded.origin, entered_at=excluded.entered_at`,
  );
  const tx = db.transaction(() => {
    for (const p of points) stmt.run(p.seriesId, p.date, p.value, p.unit, p.sourceUrl, p.origin);
  });
  tx();
  return points.length;
}

interface RawSupplyPoint {
  series_id: string;
  date: string;
  value: number;
  unit: string;
  source_url: string | null;
  origin: SupplyPoint["origin"];
}

/** One series, oldest first (growth math wants chronological order). */
export function getSupplySeries(seriesId: string, limit = 120): SupplyPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT series_id, date, value, unit, source_url, origin FROM bottleneck_supply
       WHERE series_id=? ORDER BY date DESC LIMIT ?`,
    )
    .all(seriesId, limit) as RawSupplyPoint[];
  return rows
    .map((r) => ({
      seriesId: r.series_id,
      date: r.date,
      value: r.value,
      unit: r.unit,
      sourceUrl: r.source_url,
      origin: r.origin,
    }))
    .reverse();
}

/** Total observations stored for a series (getSupplySeries caps its read window). */
export function countSupplyPoints(seriesId: string): number {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM bottleneck_supply WHERE series_id=?`)
    .get(seriesId) as { n: number };
  return r.n;
}

export function listSupplySeriesIds(): { seriesId: string; points: number; latest: string }[] {
  return getDb()
    .prepare(
      `SELECT series_id AS seriesId, COUNT(*) AS points, MAX(date) AS latest
       FROM bottleneck_supply GROUP BY series_id ORDER BY series_id`,
    )
    .all() as { seriesId: string; points: number; latest: string }[];
}

export function deleteSupplyPoint(seriesId: string, date: string): boolean {
  return getDb().prepare(`DELETE FROM bottleneck_supply WHERE series_id=? AND date=?`).run(seriesId, date).changes > 0;
}

export interface CusipResolution {
  cusip: string;
  ticker: string | null;
  name: string | null;
  source: string;
}

/** Cached CUSIP → ticker rows for the given CUSIPs (misses simply absent). */
export function getCusipResolutions(cusips: string[]): Map<string, CusipResolution> {
  const out = new Map<string, CusipResolution>();
  if (cusips.length === 0) return out;
  const db = getDb();
  // Chunked so a large 13F cannot exceed SQLite's bound-parameter limit.
  for (let i = 0; i < cusips.length; i += 400) {
    const chunk = cusips.slice(i, i + 400);
    const rows = db
      .prepare(
        `SELECT cusip, ticker, name, source FROM bottleneck_cusips
         WHERE cusip IN (${chunk.map(() => "?").join(",")})`,
      )
      .all(...chunk) as CusipResolution[];
    for (const r of rows) out.set(r.cusip, r);
  }
  return out;
}

export function saveCusipResolutions(rows: CusipResolution[]): void {
  if (rows.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO bottleneck_cusips (cusip, ticker, name, source, resolved_at)
     VALUES (?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(cusip) DO UPDATE SET ticker=excluded.ticker, name=excluded.name,
       source=excluded.source, resolved_at=excluded.resolved_at`,
  );
  const tx = db.transaction(() => {
    for (const r of rows) stmt.run(r.cusip, r.ticker, r.name, r.source);
  });
  tx();
}

/* ---------------------------------------------------------------------------
 * The Rotation Board.
 *
 * Only two shapes are stored: a daily close, and a written note keyed on the
 * state that produced it. Everything the board reports — ratios, averages,
 * scores, tiers, directions and their whole history — is recomputed from these
 * bars on read, so retuning a weight changes the board without refetching, and
 * lib/rotation owns every one of those shapes rather than this file.
 * ------------------------------------------------------------------------- */

export interface PriceBar {
  ticker: string;
  /** YYYY-MM-DD. */
  date: string;
  close: number;
  /** Whether the close is adjusted for distributions. Sources differ; see lib/rotation/bars.ts. */
  adjusted: boolean;
  source: "yahoo" | "nasdaq";
}

/**
 * Upsert daily closes. A refresh re-sends the full history because adjusted
 * closes are revised backwards whenever a distribution is paid, so the newer
 * value for an existing date is the correct one.
 */
export function saveBars(bars: PriceBar[]): number {
  if (bars.length === 0) return 0;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO rotation_bars (ticker, date, close, adjusted, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(ticker, date) DO UPDATE SET close=excluded.close, adjusted=excluded.adjusted,
       source=excluded.source, fetched_at=excluded.fetched_at`,
  );
  const tx = db.transaction(() => {
    for (const b of bars) stmt.run(b.ticker, b.date, b.close, b.adjusted ? 1 : 0, b.source);
  });
  tx();
  return bars.length;
}

interface RawPriceBar {
  ticker: string;
  date: string;
  close: number;
  adjusted: number;
  source: PriceBar["source"];
}

/** One ticker, oldest first — every rolling statistic wants chronological order. */
export function getBars(ticker: string, limit = 3000): PriceBar[] {
  const rows = getDb()
    .prepare(
      `SELECT ticker, date, close, adjusted, source FROM rotation_bars
       WHERE ticker=? ORDER BY date DESC LIMIT ?`,
    )
    .all(ticker, limit) as RawPriceBar[];
  return rows
    .map((r) => ({
      ticker: r.ticker,
      date: r.date,
      close: r.close,
      adjusted: r.adjusted === 1,
      source: r.source,
    }))
    .reverse();
}

export interface BarCoverage {
  ticker: string;
  bars: number;
  first: string;
  latest: string;
  /** More than one distinct source or adjustment basis in a single ticker's history. */
  mixed: boolean;
  source: PriceBar["source"];
  adjusted: boolean;
}

/** One row per stored ticker — what the desk and the CLI report without loading any series. */
export function barCoverage(): BarCoverage[] {
  const rows = getDb()
    .prepare(
      `SELECT ticker, COUNT(*) AS bars, MIN(date) AS first, MAX(date) AS latest,
              COUNT(DISTINCT source) AS sources, COUNT(DISTINCT adjusted) AS bases,
              MAX(source) AS source, MAX(adjusted) AS adjusted
       FROM rotation_bars GROUP BY ticker ORDER BY ticker`,
    )
    .all() as {
    ticker: string;
    bars: number;
    first: string;
    latest: string;
    sources: number;
    bases: number;
    source: PriceBar["source"];
    adjusted: number;
  }[];
  return rows.map((r) => ({
    ticker: r.ticker,
    bars: r.bars,
    first: r.first,
    latest: r.latest,
    mixed: r.sources > 1 || r.bases > 1,
    source: r.source,
    adjusted: r.adjusted === 1,
  }));
}

/** Drop one ticker's history — used when a source switch would otherwise leave a mixed series. */
export function deleteBars(ticker: string): number {
  return getDb().prepare(`DELETE FROM rotation_bars WHERE ticker=?`).run(ticker).changes;
}

export interface RotationBriefRow {
  stateHash: string;
  createdAt: string;
  origin: "template" | "model";
  asOf: string;
  changed: string[];
  body: string;
}

interface RawRotationBrief {
  state_hash: string;
  created_at: string;
  origin: RotationBriefRow["origin"];
  as_of: string;
  changed_json: string;
  body: string;
}

function toBrief(r: RawRotationBrief | undefined): RotationBriefRow | null {
  if (!r) return null;
  const changed = parseJson<string[]>(r.changed_json);
  return {
    stateHash: r.state_hash,
    createdAt: r.created_at,
    origin: r.origin,
    asOf: r.as_of,
    changed: Array.isArray(changed) ? changed : [],
    body: r.body,
  };
}

/** The cache lookup: an unchanged state never regenerates a note. */
export function getRotationBrief(stateHash: string): RotationBriefRow | null {
  const row = getDb()
    .prepare(
      `SELECT state_hash, created_at, origin, as_of, changed_json, body
       FROM rotation_briefs WHERE state_hash=?`,
    )
    .get(stateHash) as RawRotationBrief | undefined;
  return toBrief(row);
}

const ROTATION_KEEP_BRIEFS = 60;

export function saveRotationBrief(input: {
  stateHash: string;
  origin: RotationBriefRow["origin"];
  asOf: string;
  changed: string[];
  body: string;
}): void {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO rotation_briefs (state_hash, created_at, origin, as_of, changed_json, body)
       VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?, ?, ?, ?)
       ON CONFLICT(state_hash) DO UPDATE SET origin=excluded.origin, as_of=excluded.as_of,
         changed_json=excluded.changed_json, body=excluded.body, created_at=excluded.created_at`,
    ).run(input.stateHash, input.origin, input.asOf, JSON.stringify(input.changed), input.body);
    db.prepare(
      `DELETE FROM rotation_briefs WHERE state_hash NOT IN
         (SELECT state_hash FROM rotation_briefs ORDER BY created_at DESC LIMIT ?)`,
    ).run(ROTATION_KEEP_BRIEFS);
  });
  tx();
}

/** Most recent note of any kind — the "last note from [date]" fallback on the board. */
export function latestRotationBrief(): RotationBriefRow | null {
  const row = getDb()
    .prepare(
      `SELECT state_hash, created_at, origin, as_of, changed_json, body
       FROM rotation_briefs ORDER BY created_at DESC LIMIT 1`,
    )
    .get() as RawRotationBrief | undefined;
  return toBrief(row);
}

/* ---------------------------------------------------------------------------
 * Insider Turnaround Scanner
 *
 * Raw inputs only. There is deliberately no table of candidates, scores or
 * rankings: those are a function of the operator's — or the reader's — risk
 * tolerance, and storing them would freeze one person's answer into the
 * database and let it drift away from the settings that produced it. Everything
 * the scanner reports is recomputed from these rows on read, and lib/insider
 * owns every one of those shapes rather than this file.
 * ------------------------------------------------------------------------- */

export interface InsiderOwner {
  cik: string;
  name: string;
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isOther: boolean;
  officerTitle: string | null;
}

export interface InsiderTransactionRow {
  accession: string;
  line: number;
  ticker: string;
  issuerCik: number;
  issuerName: string;
  /** The date the filing reports the activity for. */
  period: string;
  filedDate: string;
  transactionDate: string;
  code: string;
  acquiredDisposed: string;
  shares: number | null;
  price: number | null;
  sharesAfter: number | null;
  ownership: string;
  planned: "yes" | "no" | "not-stated";
  /** Every reporting owner on the filing — the transaction belongs to them jointly. */
  owners: InsiderOwner[];
  flags: string[];
}

interface RawInsiderTransaction {
  accession: string;
  line: number;
  ticker: string;
  issuer_cik: number;
  issuer_name: string;
  period: string;
  filed_date: string;
  transaction_date: string;
  code: string;
  acquired_disposed: string;
  shares: number | null;
  price: number | null;
  shares_after: number | null;
  ownership: string;
  planned: InsiderTransactionRow["planned"];
  owners_json: string;
  flags_json: string;
}

function toInsiderTransaction(r: RawInsiderTransaction): InsiderTransactionRow {
  const owners = parseJson<InsiderOwner[]>(r.owners_json);
  const flags = parseJson<string[]>(r.flags_json);
  return {
    accession: r.accession,
    line: r.line,
    ticker: r.ticker,
    issuerCik: r.issuer_cik,
    issuerName: r.issuer_name,
    period: r.period,
    filedDate: r.filed_date,
    transactionDate: r.transaction_date,
    code: r.code,
    acquiredDisposed: r.acquired_disposed,
    shares: r.shares,
    price: r.price,
    sharesAfter: r.shares_after,
    ownership: r.ownership,
    planned: r.planned,
    owners: Array.isArray(owners) ? owners : [],
    flags: Array.isArray(flags) ? flags : [],
  };
}

/** Upsert filed transaction lines. A filing is immutable, so a re-read is a no-op. */
export function saveInsiderTransactions(rows: InsiderTransactionRow[]): number {
  if (rows.length === 0) return 0;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO insider_transactions
       (accession, line, ticker, issuer_cik, issuer_name, period, filed_date, transaction_date,
        code, acquired_disposed, shares, price, shares_after, ownership, planned, owners_json,
        flags_json, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(accession, line) DO UPDATE SET
       ticker=excluded.ticker, issuer_cik=excluded.issuer_cik, issuer_name=excluded.issuer_name,
       period=excluded.period, filed_date=excluded.filed_date,
       transaction_date=excluded.transaction_date, code=excluded.code,
       acquired_disposed=excluded.acquired_disposed, shares=excluded.shares, price=excluded.price,
       shares_after=excluded.shares_after, ownership=excluded.ownership, planned=excluded.planned,
       owners_json=excluded.owners_json, flags_json=excluded.flags_json`,
  );
  const tx = db.transaction(() => {
    for (const r of rows) {
      stmt.run(
        r.accession,
        r.line,
        r.ticker,
        r.issuerCik,
        r.issuerName,
        r.period,
        r.filedDate,
        r.transactionDate,
        r.code,
        r.acquiredDisposed,
        r.shares,
        r.price,
        r.sharesAfter,
        r.ownership,
        r.planned,
        JSON.stringify(r.owners),
        JSON.stringify(r.flags),
      );
    }
  });
  tx();
  return rows.length;
}

/**
 * Every stored line filed on or after a date, newest activity first.
 *
 * Filed date, not transaction date, because that is what the lookback window
 * means: a filing that reaches the public late is news on the day it lands.
 */
export function getInsiderTransactionsSince(filedFrom: string): InsiderTransactionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM insider_transactions WHERE filed_date >= ?
       ORDER BY transaction_date DESC, ticker, line`,
    )
    .all(filedFrom) as RawInsiderTransaction[];
  return rows.map(toInsiderTransaction);
}

/** One company's stored lines, newest first. Used by the per-stock page. */
export function getInsiderTransactionsForTicker(ticker: string, limit = 400): InsiderTransactionRow[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM insider_transactions WHERE ticker=?
       ORDER BY transaction_date DESC, line LIMIT ?`,
    )
    .all(ticker.toUpperCase(), limit) as RawInsiderTransaction[];
  return rows.map(toInsiderTransaction);
}

export interface InsiderDayRow {
  day: string;
  walkedAt: string;
  filingsListed: number;
  filingsFetched: number;
  noSession: boolean;
}

/** Which days have been read already — the whole of the scan's incrementality. */
export function insiderWalkedDays(): Map<string, InsiderDayRow> {
  const rows = getDb()
    .prepare(
      `SELECT day, walked_at, filings_listed, filings_fetched, no_session
       FROM insider_index_days ORDER BY day DESC`,
    )
    .all() as {
    day: string;
    walked_at: string;
    filings_listed: number;
    filings_fetched: number;
    no_session: number;
  }[];
  return new Map(
    rows.map((r) => [
      r.day,
      {
        day: r.day,
        walkedAt: r.walked_at,
        filingsListed: r.filings_listed,
        filingsFetched: r.filings_fetched,
        noSession: r.no_session === 1,
      },
    ]),
  );
}

export function markInsiderDayWalked(input: {
  day: string;
  filingsListed: number;
  filingsFetched: number;
  noSession: boolean;
}): void {
  getDb()
    .prepare(
      `INSERT INTO insider_index_days (day, walked_at, filings_listed, filings_fetched, no_session)
       VALUES (?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET walked_at=excluded.walked_at,
         filings_listed=excluded.filings_listed, filings_fetched=excluded.filings_fetched,
         no_session=excluded.no_session`,
    )
    .run(input.day, input.filingsListed, input.filingsFetched, input.noSession ? 1 : 0);
}

/**
 * Daily closes for a scanner candidate.
 *
 * A separate table from the rotation board's, on purpose. The board's coverage
 * view and refresh loop are scoped to its own catalog of funds, and pouring
 * hundreds of individual company tickers into the same table would leave that
 * view describing something else entirely.
 */
export function saveInsiderBars(bars: PriceBar[]): number {
  if (bars.length === 0) return 0;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO insider_prices (ticker, date, close, adjusted, source, fetched_at)
     VALUES (?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(ticker, date) DO UPDATE SET close=excluded.close, adjusted=excluded.adjusted,
       source=excluded.source, fetched_at=excluded.fetched_at`,
  );
  const tx = db.transaction(() => {
    for (const b of bars) stmt.run(b.ticker, b.date, b.close, b.adjusted ? 1 : 0, b.source);
  });
  tx();
  return bars.length;
}

/** One candidate's closes, oldest first. */
export function getInsiderBars(ticker: string, limit = 3000): PriceBar[] {
  const rows = getDb()
    .prepare(
      `SELECT ticker, date, close, adjusted, source FROM insider_prices
       WHERE ticker=? ORDER BY date DESC LIMIT ?`,
    )
    .all(ticker.toUpperCase(), limit) as RawPriceBar[];
  return rows
    .map((r) => ({
      ticker: r.ticker,
      date: r.date,
      close: r.close,
      adjusted: r.adjusted === 1,
      source: r.source,
    }))
    .reverse();
}

/** Wipe one ticker's history — used when the price basis changes and merging would lie. */
export function deleteInsiderBars(ticker: string): number {
  return getDb().prepare(`DELETE FROM insider_prices WHERE ticker=?`).run(ticker.toUpperCase()).changes;
}

/** One row per stored candidate, without loading any series. */
export function insiderBarCoverage(): BarCoverage[] {
  const rows = getDb()
    .prepare(
      `SELECT ticker, COUNT(*) AS bars, MIN(date) AS first, MAX(date) AS latest,
              COUNT(DISTINCT source) AS sources, COUNT(DISTINCT adjusted) AS bases,
              MAX(source) AS source, MAX(adjusted) AS adjusted
       FROM insider_prices GROUP BY ticker ORDER BY ticker`,
    )
    .all() as {
    ticker: string;
    bars: number;
    first: string;
    latest: string;
    sources: number;
    bases: number;
    source: PriceBar["source"];
    adjusted: number;
  }[];
  return rows.map((r) => ({
    ticker: r.ticker,
    bars: r.bars,
    first: r.first,
    latest: r.latest,
    mixed: r.sources > 1 || r.bases > 1,
    source: r.source,
    adjusted: r.adjusted === 1,
  }));
}

export interface InsiderFinancialsRow<T = unknown> {
  cik: number;
  ticker: string;
  entityName: string;
  fetchedAt: string;
  years: T;
  /** Which XBRL tag actually supplied each concept — reporting varies by filer. */
  tags: Record<string, string>;
  flags: string[];
}

export function saveInsiderFinancials(input: {
  cik: number;
  ticker: string;
  entityName: string;
  years: unknown;
  tags: Record<string, string>;
  flags: string[];
}): void {
  getDb()
    .prepare(
      `INSERT INTO insider_financials (cik, ticker, entity_name, fetched_at, years_json, tags_json, flags_json)
       VALUES (?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?, ?, ?)
       ON CONFLICT(cik) DO UPDATE SET ticker=excluded.ticker, entity_name=excluded.entity_name,
         fetched_at=excluded.fetched_at, years_json=excluded.years_json, tags_json=excluded.tags_json,
         flags_json=excluded.flags_json`,
    )
    .run(
      input.cik,
      input.ticker.toUpperCase(),
      input.entityName,
      JSON.stringify(input.years),
      JSON.stringify(input.tags),
      JSON.stringify(input.flags),
    );
}

interface RawInsiderFinancials {
  cik: number;
  ticker: string;
  entity_name: string;
  fetched_at: string;
  years_json: string;
  tags_json: string;
  flags_json: string;
}

function toInsiderFinancials<T>(r: RawInsiderFinancials): InsiderFinancialsRow<T> {
  const tags = parseJson<Record<string, string>>(r.tags_json);
  const flags = parseJson<string[]>(r.flags_json);
  return {
    cik: r.cik,
    ticker: r.ticker,
    entityName: r.entity_name,
    fetchedAt: r.fetched_at,
    years: parseJson<T>(r.years_json) as T,
    tags: tags && typeof tags === "object" ? tags : {},
    flags: Array.isArray(flags) ? flags : [],
  };
}

export function getInsiderFinancials<T = unknown>(cik: number): InsiderFinancialsRow<T> | null {
  const r = getDb().prepare(`SELECT * FROM insider_financials WHERE cik=?`).get(cik) as
    | RawInsiderFinancials
    | undefined;
  return r ? toInsiderFinancials<T>(r) : null;
}

/** Every stored statement set, keyed by ticker — one query for a whole board read. */
export function allInsiderFinancials<T = unknown>(): Map<string, InsiderFinancialsRow<T>> {
  const rows = getDb().prepare(`SELECT * FROM insider_financials`).all() as RawInsiderFinancials[];
  return new Map(rows.map((r) => [r.ticker, toInsiderFinancials<T>(r)]));
}

export interface InsiderScanRow<T = unknown> {
  id: number;
  takenAt: string;
  payload: T;
}

const INSIDER_KEEP_SCANS = 30;

/** Record what one refresh actually did. Freshness and coverage come from here. */
export function saveInsiderScan(payload: unknown): number {
  const db = getDb();
  let id = 0;
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO insider_scans (taken_at, payload_json)
         VALUES (strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?)`,
      )
      .run(JSON.stringify(payload));
    id = Number(info.lastInsertRowid);
    db.prepare(
      `DELETE FROM insider_scans WHERE id NOT IN
         (SELECT id FROM insider_scans ORDER BY taken_at DESC LIMIT ?)`,
    ).run(INSIDER_KEEP_SCANS);
  });
  tx();
  return id;
}

export function latestInsiderScan<T = unknown>(): InsiderScanRow<T> | null {
  const r = getDb()
    .prepare(`SELECT id, taken_at, payload_json FROM insider_scans ORDER BY taken_at DESC LIMIT 1`)
    .get() as { id: number; taken_at: string; payload_json: string } | undefined;
  if (!r) return null;
  return { id: r.id, takenAt: r.taken_at, payload: parseJson<T>(r.payload_json) as T };
}
