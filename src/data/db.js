'use strict';

const path = require('path');
const fs   = require('fs');

let _db = null;

// ── Schema version ────────────────────────────────────────────────────────────
const SCHEMA_VERSION = 1;

// ── Static JSON manifests (loaded once) ───────────────────────────────────────
const DATA_DIR = path.join(__dirname);

let _baseline         = null;
let _licenseCompat    = null;
let _hardwareManifest = null;

function loadJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf8'));
}

// ── Initialization ────────────────────────────────────────────────────────────
function initialize(dbPath) {
  const Database = require('better-sqlite3');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  const currentVersion = _db.pragma('user_version', { simple: true });

  if (currentVersion < SCHEMA_VERSION) {
    _runMigrations(currentVersion);
    _db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  // Load static manifests
  _baseline         = loadJSON('normalization-baseline.json');
  _licenseCompat    = loadJSON('license-compat.json');
  _hardwareManifest = loadJSON('hardware-manifest.json');

  // Validate baseline covers all 50 sub-metrics
  _validateBaseline();

  // Seed on first run
  const modelCount = _db.prepare('SELECT COUNT(*) AS n FROM models').get().n;
  if (modelCount === 0) {
    _seedStaticData();
  }
}

function _runMigrations(fromVersion) {
  const migrate = _db.transaction(() => {
    if (fromVersion < 1) _migration_v1();
  });
  migrate();
}

function _migration_v1() {
  _db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      model_id               TEXT PRIMARY KEY,
      name                   TEXT NOT NULL,
      provider               TEXT NOT NULL,
      license                TEXT NOT NULL,
      tags                   TEXT NOT NULL DEFAULT '[]',
      tier                   TEXT NOT NULL DEFAULT 'open',
      provider_version_string TEXT,
      created_at             INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at             INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS scores (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id           TEXT    NOT NULL REFERENCES models(model_id),
      factor_group       TEXT    NOT NULL,
      sub_metric         TEXT    NOT NULL,
      raw_score          REAL,
      normalized_score   REAL,
      data_tier          TEXT    NOT NULL DEFAULT 'T1',
      connector_id       TEXT,
      benchmark_name     TEXT,
      benchmark_url      TEXT,
      publication_date   INTEGER,
      model_release_date INTEGER,
      fetched_at         INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      contamination_flag INTEGER NOT NULL DEFAULT 0,
      UNIQUE(model_id, factor_group, sub_metric, connector_id)
    );
    CREATE INDEX IF NOT EXISTS idx_scores_model  ON scores(model_id);
    CREATE INDEX IF NOT EXISTS idx_scores_factor ON scores(factor_group, sub_metric);

    CREATE TABLE IF NOT EXISTS indexes (
      id                  TEXT    PRIMARY KEY,
      name                TEXT    NOT NULL,
      version             TEXT    NOT NULL DEFAULT '1.0',
      use_case_preset     TEXT,
      factor_weights      TEXT    NOT NULL DEFAULT '{}',
      sub_dimension_weights TEXT  NOT NULL DEFAULT '{}',
      hard_constraints    TEXT    NOT NULL DEFAULT '{}',
      selected_models     TEXT    NOT NULL DEFAULT '[]',
      index_mode          TEXT    NOT NULL DEFAULT 'router',
      mode_params         TEXT    NOT NULL DEFAULT '{}',
      source              TEXT    NOT NULL DEFAULT 'local',
      created_at          INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at          INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      published_at        INTEGER
    );

    CREATE TABLE IF NOT EXISTS index_versions (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      index_id     TEXT    NOT NULL REFERENCES indexes(id),
      version_tag  TEXT    NOT NULL,
      snapshot     TEXT    NOT NULL,
      changed_fields TEXT  NOT NULL DEFAULT '{}',
      created_at   INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_iv_index ON index_versions(index_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS sync_log (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      connector_id  TEXT    NOT NULL,
      started_at    INTEGER NOT NULL,
      finished_at   INTEGER,
      status        TEXT    NOT NULL,
      rows_fetched  INTEGER,
      rows_upserted INTEGER,
      schema_hash   TEXT,
      error_msg     TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_sync_log_connector ON sync_log(connector_id, started_at DESC);

    CREATE TABLE IF NOT EXISTS model_changelog (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id     TEXT    NOT NULL,
      factor_group TEXT    NOT NULL,
      sub_metric   TEXT    NOT NULL,
      old_value    REAL,
      new_value    REAL,
      delta        REAL,
      connector_id TEXT,
      detected_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_changelog_model ON model_changelog(model_id, detected_at DESC);

    CREATE TABLE IF NOT EXISTS user_pricing (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id                  TEXT    NOT NULL UNIQUE REFERENCES models(model_id),
      input_cost_per_1m         REAL    NOT NULL,
      output_cost_per_1m        REAL    NOT NULL,
      normalized_cost_per_1k_chars REAL,
      source_url                TEXT,
      entered_at                INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
  `);
}

// ── Baseline validation ───────────────────────────────────────────────────────
function _validateBaseline() {
  const subMetrics = [];
  for (const group of Object.values(_baseline)) {
    for (const key of Object.keys(group)) {
      subMetrics.push(key);
    }
  }
  if (subMetrics.length < 50) {
    console.warn(`[db] normalization-baseline.json covers only ${subMetrics.length} sub-metrics (expected 50). Some MCS scores may be incomplete.`);
  }
}

// ── Seed data ─────────────────────────────────────────────────────────────────
function _seedStaticData() {
  const manifest = loadJSON('registry-manifest.json');
  const insert = _db.prepare(`
    INSERT OR IGNORE INTO models (model_id, name, provider, license, tags, tier, provider_version_string)
    VALUES (@model_id, @name, @provider, @license, @tags, @tier, @provider_version_string)
  `);
  const seedAll = _db.transaction((models) => {
    for (const m of models) {
      insert.run({
        ...m,
        tags: JSON.stringify(m.tags || []),
        provider_version_string: m.provider_version_string || null,
      });
    }
  });
  seedAll(manifest.models);
  console.log(`[db] Seeded ${manifest.models.length} models from registry-manifest.json`);
}

// ── Models ────────────────────────────────────────────────────────────────────
function getModels(filters = {}) {
  let sql = `
    SELECT m.*,
      (SELECT AVG(s.normalized_score)
       FROM scores s
       WHERE s.model_id = m.model_id) AS avg_mcs
    FROM models m
    WHERE 1=1
  `;
  const params = [];

  if (filters.provider) {
    sql += ` AND m.provider = ?`;
    params.push(filters.provider);
  }
  if (filters.license) {
    sql += ` AND m.license = ?`;
    params.push(filters.license);
  }
  if (filters.tag) {
    sql += ` AND json_each.value = ?`;
    sql = sql.replace('FROM models m WHERE 1=1', 'FROM models m, json_each(m.tags) WHERE 1=1');
    params.push(filters.tag);
  }
  if (filters.tier) {
    sql += ` AND m.tier = ?`;
    params.push(filters.tier);
  }

  sql += ' ORDER BY avg_mcs DESC NULLS LAST';
  const rows = _db.prepare(sql).all(...params);
  return rows.map(r => ({
    ...r,
    tags: JSON.parse(r.tags || '[]'),
  }));
}

function getModelById(modelId) {
  const row = _db.prepare('SELECT * FROM models WHERE model_id = ?').get(modelId);
  if (!row) return null;
  return { ...row, tags: JSON.parse(row.tags || '[]') };
}

// ── Scores ────────────────────────────────────────────────────────────────────
function getScores(modelId) {
  return _db.prepare(`
    SELECT * FROM scores WHERE model_id = ? ORDER BY factor_group, sub_metric
  `).all(modelId);
}

function upsertScores(rows) {
  if (!rows || rows.length === 0) return 0;

  const getExisting = _db.prepare(`
    SELECT normalized_score FROM scores
    WHERE model_id = ? AND factor_group = ? AND sub_metric = ? AND connector_id = ?
  `);

  const upsert = _db.prepare(`
    INSERT INTO scores
      (model_id, factor_group, sub_metric, raw_score, normalized_score, data_tier,
       connector_id, benchmark_name, benchmark_url, publication_date, model_release_date,
       fetched_at, contamination_flag)
    VALUES
      (@model_id, @factor_group, @sub_metric, @raw_score, @normalized_score, @data_tier,
       @connector_id, @benchmark_name, @benchmark_url, @publication_date, @model_release_date,
       @fetched_at, @contamination_flag)
    ON CONFLICT(model_id, factor_group, sub_metric, connector_id) DO UPDATE SET
      raw_score          = excluded.raw_score,
      normalized_score   = excluded.normalized_score,
      fetched_at         = excluded.fetched_at,
      contamination_flag = excluded.contamination_flag
  `);

  const logChange = _db.prepare(`
    INSERT INTO model_changelog
      (model_id, factor_group, sub_metric, old_value, new_value, delta, connector_id, detected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  let upserted = 0;

  const run = _db.transaction(() => {
    for (const row of rows) {
      const existing = getExisting.get(
        row.model_id, row.factor_group, row.sub_metric, row.connector_id
      );

      upsert.run({ ...row, fetched_at: now });
      upserted++;

      if (existing && existing.normalized_score != null && row.normalized_score != null) {
        const delta = row.normalized_score - existing.normalized_score;
        if (Math.abs(delta) >= 0.5) {
          logChange.run(
            row.model_id, row.factor_group, row.sub_metric,
            existing.normalized_score, row.normalized_score, delta,
            row.connector_id, now
          );
        }
      }
    }
  });

  run();
  return upserted;
}

// ── Model Changelog ───────────────────────────────────────────────────────────
function getModelChangelog(modelId, limit = 50) {
  return _db.prepare(`
    SELECT * FROM model_changelog WHERE model_id = ?
    ORDER BY detected_at DESC LIMIT ?
  `).all(modelId, limit);
}

// ── User Pricing ──────────────────────────────────────────────────────────────
function getUserPricing(modelId) {
  return _db.prepare('SELECT * FROM user_pricing WHERE model_id = ?').get(modelId) || null;
}

function saveUserPricing(data) {
  _db.prepare(`
    INSERT INTO user_pricing
      (model_id, input_cost_per_1m, output_cost_per_1m, normalized_cost_per_1k_chars, source_url, entered_at)
    VALUES (@model_id, @input_cost_per_1m, @output_cost_per_1m, @normalized_cost_per_1k_chars, @source_url, @entered_at)
    ON CONFLICT(model_id) DO UPDATE SET
      input_cost_per_1m  = excluded.input_cost_per_1m,
      output_cost_per_1m = excluded.output_cost_per_1m,
      normalized_cost_per_1k_chars = excluded.normalized_cost_per_1k_chars,
      source_url         = excluded.source_url,
      entered_at         = excluded.entered_at
  `).run({ ...data, entered_at: Date.now() });
}

function getAllUserPricing() {
  return _db.prepare('SELECT * FROM user_pricing').all();
}

function deleteUserPricing(modelId) {
  _db.prepare('DELETE FROM user_pricing WHERE model_id = ?').run(modelId);
}

// ── Indexes ───────────────────────────────────────────────────────────────────
function saveIndex(config) {
  const id = config.id || `idx_${Date.now()}`;
  _db.prepare(`
    INSERT INTO indexes
      (id, name, version, use_case_preset, factor_weights, sub_dimension_weights,
       hard_constraints, selected_models, index_mode, mode_params, source, updated_at, published_at)
    VALUES
      (@id, @name, @version, @use_case_preset, @factor_weights, @sub_dimension_weights,
       @hard_constraints, @selected_models, @index_mode, @mode_params, @source, @updated_at, @published_at)
    ON CONFLICT(id) DO UPDATE SET
      name                  = excluded.name,
      version               = excluded.version,
      use_case_preset       = excluded.use_case_preset,
      factor_weights        = excluded.factor_weights,
      sub_dimension_weights = excluded.sub_dimension_weights,
      hard_constraints      = excluded.hard_constraints,
      selected_models       = excluded.selected_models,
      index_mode            = excluded.index_mode,
      mode_params           = excluded.mode_params,
      updated_at            = excluded.updated_at,
      published_at          = excluded.published_at
  `).run({
    id,
    name:                   config.name,
    version:                config.version || '1.0',
    use_case_preset:        config.use_case_preset || null,
    factor_weights:         JSON.stringify(config.factor_weights || {}),
    sub_dimension_weights:  JSON.stringify(config.sub_dimension_weights || {}),
    hard_constraints:       JSON.stringify(config.hard_constraints || {}),
    selected_models:        JSON.stringify(config.selected_models || []),
    index_mode:             config.index_mode || 'router',
    mode_params:            JSON.stringify(config.mode_params || {}),
    source:                 config.source || 'local',
    updated_at:             Date.now(),
    published_at:           config.published_at || null,
  });
  return id;
}

function saveIndexVersion(indexId, snapshot) {
  const idx = _db.prepare('SELECT version FROM indexes WHERE id = ?').get(indexId);
  _db.prepare(`
    INSERT INTO index_versions (index_id, version_tag, snapshot, created_at)
    VALUES (?, ?, ?, ?)
  `).run(indexId, idx ? idx.version : '1.0', JSON.stringify(snapshot), Date.now());
}

function getIndexes() {
  return _db.prepare('SELECT * FROM indexes ORDER BY updated_at DESC').all().map(_parseIndex);
}

function getIndex(id) {
  const row = _db.prepare('SELECT * FROM indexes WHERE id = ?').get(id);
  return row ? _parseIndex(row) : null;
}

function deleteIndex(id) {
  _db.prepare('DELETE FROM index_versions WHERE index_id = ?').run(id);
  _db.prepare('DELETE FROM indexes WHERE id = ?').run(id);
}

function getIndexVersions(indexId) {
  return _db.prepare(`
    SELECT * FROM index_versions WHERE index_id = ? ORDER BY created_at DESC
  `).all(indexId).map(r => ({ ...r, snapshot: JSON.parse(r.snapshot) }));
}

function _parseIndex(row) {
  return {
    ...row,
    factor_weights:        JSON.parse(row.factor_weights || '{}'),
    sub_dimension_weights: JSON.parse(row.sub_dimension_weights || '{}'),
    hard_constraints:      JSON.parse(row.hard_constraints || '{}'),
    selected_models:       JSON.parse(row.selected_models || '[]'),
    mode_params:           JSON.parse(row.mode_params || '{}'),
  };
}

// ── Sync log ──────────────────────────────────────────────────────────────────
function logSync({ connectorId, startedAt, finishedAt, status, rowsFetched, rowsUpserted, schemaHash, errorMsg }) {
  _db.prepare(`
    INSERT INTO sync_log
      (connector_id, started_at, finished_at, status, rows_fetched, rows_upserted, schema_hash, error_msg)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(connectorId, startedAt, finishedAt, status, rowsFetched || 0, rowsUpserted || 0, schemaHash || null, errorMsg || null);
}

function getSyncLog(connectorId, limit = 50) {
  if (connectorId) {
    return _db.prepare(`
      SELECT * FROM sync_log WHERE connector_id = ?
      ORDER BY started_at DESC LIMIT ?
    `).all(connectorId, limit);
  }
  return _db.prepare(`
    SELECT * FROM sync_log ORDER BY started_at DESC LIMIT ?
  `).all(limit);
}

function getLastSync(connectorId) {
  return _db.prepare(`
    SELECT * FROM sync_log
    WHERE connector_id = ? AND status = 'success'
    ORDER BY started_at DESC LIMIT 1
  `).get(connectorId) || null;
}

// ── Backup / Restore ──────────────────────────────────────────────────────────
async function backup(destPath) {
  await _db.backup(destPath);
}

async function restore(srcPath, userDataDir) {
  const dbPath = path.join(userDataDir, 'modelindex.db');
  // Auto-backup current state
  const autoBackupPath = dbPath + '.pre-restore.bak';
  await _db.backup(autoBackupPath);
  // Close current DB
  _db.close();
  // Copy backup file over current DB
  fs.copyFileSync(srcPath, dbPath);
  // Reopen
  const Database = require('better-sqlite3');
  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
}

// ── Static manifest accessors ─────────────────────────────────────────────────
function getBaseline()         { return _baseline; }
function getLicenseCompat()    { return _licenseCompat; }
function getHardwareManifest() { return _hardwareManifest; }

module.exports = {
  initialize,
  getModels, getModelById,
  getScores, upsertScores,
  getModelChangelog,
  getUserPricing, saveUserPricing, getAllUserPricing, deleteUserPricing,
  saveIndex, saveIndexVersion, getIndexes, getIndex, deleteIndex, getIndexVersions,
  logSync, getSyncLog, getLastSync,
  backup, restore,
  getBaseline, getLicenseCompat, getHardwareManifest,
};
