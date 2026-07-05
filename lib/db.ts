import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { CONFIG } from "./config";
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
    params: parseJson<RunParams>(r.params_json) ?? { count: 8, force: false, mock: false },
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

export function listRuns(limit = 50): RunRow[] {
  const rows = getDb()
    .prepare(`SELECT * FROM runs ORDER BY created_at DESC, rowid DESC LIMIT ?`)
    .all(limit) as RawRunRow[];
  return rows.map(toRunRow);
}

export function deleteRun(runId: string): void {
  getDb().prepare(`DELETE FROM runs WHERE id=?`).run(runId);
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
 * Email signups
 * ========================================================================== */

export function insertSignup(email: string): boolean {
  const info = getDb()
    .prepare(`INSERT OR IGNORE INTO email_signups (email) VALUES (?)`)
    .run(email.trim());
  return info.changes > 0;
}
