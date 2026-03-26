'use strict';

const cron = require('node-cron');
const { ipcMain, BrowserWindow } = require('electron');

// ─── Connector registry ────────────────────────────────────────────────────
const ADAPTERS = {
  'hf-leaderboard':       { module: () => require('./hf-adapter'),                   schedule: '0 */6 * * *',  intervalMs: 6  * 60 * 60 * 1000 },
  'helm-lite':            { module: () => require('./helm-adapter'),                  schedule: '0 2 * * *',    intervalMs: 24 * 60 * 60 * 1000 },
  'lmarena-elo':          { module: () => require('./lmarena-adapter'),               schedule: '30 */6 * * *', intervalMs: 6  * 60 * 60 * 1000 },
  'evalplus':             { module: () => require('./evalplus-adapter'),              schedule: null,           intervalMs: null }, // on-demand only
  'routerbench':          { module: () => require('./routerbench-adapter'),           schedule: '0 3 * * 1',    intervalMs: 7  * 24 * 60 * 60 * 1000 },
  'ruler-longcontext':    { module: () => require('./ruler-adapter'),                 schedule: '0 4 * * 3',    intervalMs: 7  * 24 * 60 * 60 * 1000 },
  'bias-fairness':        { module: () => require('./bias-adapter'),                  schedule: '0 5 * * 5',    intervalMs: 7  * 24 * 60 * 60 * 1000 },
  // T2/T3 (disabled / manual — registered so Settings screen can display them)
  'artificial-analysis':  { module: () => require('./artificial-analysis-adapter'),  schedule: null,           intervalMs: null },
  'harmbench':            { module: () => require('./harmbench-adapter'),             schedule: null,           intervalMs: null },
};

// Connectors currently running (debounce guard)
const _running = new Set();
let _db = null;
const _jobs = {};

// ─── Init ──────────────────────────────────────────────────────────────────

/**
 * Call once after app ready and db is initialized.
 * Registers cron jobs and wires IPC handlers.
 */
function initScheduler(db) {
  _db = db;
  _registerIpcHandlers();
  _startCronJobs();
  // Catch-up sync is deferred 5s after launch to avoid blocking startup
  setTimeout(() => catchUpSync(), 5000);
}

// ─── Cron jobs ─────────────────────────────────────────────────────────────

function _startCronJobs() {
  for (const [connectorId, cfg] of Object.entries(ADAPTERS)) {
    if (!cfg.schedule) continue;
    _jobs[connectorId] = cron.schedule(cfg.schedule, async () => {
      const adapter = _safeLoad(connectorId, cfg.module);
      if (adapter) await runConnector(adapter);
    }, { scheduled: true, timezone: 'UTC' });
  }
}

// ─── Catch-up sync ─────────────────────────────────────────────────────────

/**
 * On launch, check sync_log for each scheduled connector.
 * If last successful sync is older than its interval, trigger an immediate sync.
 */
async function catchUpSync() {
  if (!_db) return;

  for (const [connectorId, cfg] of Object.entries(ADAPTERS)) {
    if (!cfg.schedule || !cfg.intervalMs) continue;

    try {
      const lastSync = _db.getLastSync(connectorId);
      const needsSync = !lastSync ||
        (Date.now() - new Date(lastSync.finished_at).getTime()) > cfg.intervalMs;

      if (needsSync) {
        const adapter = _safeLoad(connectorId, cfg.module);
        if (adapter) runConnector(adapter).catch(() => {}); // fire-and-forget
      }
    } catch (err) {
      console.error(`[sync-scheduler] catch-up check failed for ${connectorId}:`, err.message);
    }
  }
}

// ─── Run connector pipeline ────────────────────────────────────────────────

/**
 * Runs the full fetch → validate → transform → upsert pipeline for one adapter.
 * Emits sync:progress and sync:complete events to all renderer windows.
 * Writes to sync_log regardless of outcome.
 */
async function runConnector(adapter) {
  const connectorId = adapter.id;

  if (_running.has(connectorId)) {
    console.log(`[sync-scheduler] ${connectorId} already running — skipping`);
    return { skipped: true };
  }
  _running.add(connectorId);

  const startedAt = new Date().toISOString();
  _emit('sync:progress', { connectorId, status: 'fetching', startedAt });

  let raw = null;
  let rowsFetched = 0;
  let rowsUpserted = 0;

  try {
    // 1. Fetch
    raw = await adapter.fetch();
    rowsFetched = _estimateRowCount(raw);
    _emit('sync:progress', { connectorId, status: 'transforming', rowsFetched });

    // 2. Validate
    const { valid, errors } = adapter.validate(raw);
    if (!valid) throw new Error(`Validation failed: ${errors.join('; ')}`);

    // 3. Transform
    const scores = adapter.transform(raw);

    // 4. Upsert
    if (_db && scores.length > 0) {
      rowsUpserted = _db.upsertScores(scores);
    }

    const finishedAt = new Date().toISOString();
    if (_db) _db.logSync(connectorId, 'success', rowsFetched, rowsUpserted, null);
    _emit('sync:complete', { connectorId, status: 'success', rowsFetched, rowsUpserted, finishedAt });

    return { success: true, rowsFetched, rowsUpserted };

  } catch (err) {
    const finishedAt = new Date().toISOString();
    const errorMsg = err.message || String(err);
    console.error(`[sync-scheduler] ${connectorId} failed:`, errorMsg);

    if (_db) _db.logSync(connectorId, 'error', rowsFetched, 0, errorMsg);
    _emit('sync:complete', { connectorId, status: 'error', error: errorMsg, finishedAt });

    return { success: false, error: errorMsg };

  } finally {
    _running.delete(connectorId);
  }
}

// ─── IPC handlers ──────────────────────────────────────────────────────────

function _registerIpcHandlers() {
  // Trigger manual sync for one connector (debounced — noop if already running)
  ipcMain.handle('sync:triggerManualSync', async (_event, connectorId) => {
    const cfg = ADAPTERS[connectorId];
    if (!cfg) return { success: false, error: `Unknown connector: ${connectorId}` };
    const adapter = _safeLoad(connectorId, cfg.module);
    if (!adapter) return { success: false, error: `Failed to load adapter: ${connectorId}` };
    return runConnector(adapter);
  });

  // Trigger sync for all scheduled connectors
  ipcMain.handle('sync:triggerAll', async () => {
    const results = {};
    for (const [connectorId, cfg] of Object.entries(ADAPTERS)) {
      if (!cfg.schedule) continue;
      const adapter = _safeLoad(connectorId, cfg.module);
      if (adapter) results[connectorId] = runConnector(adapter); // launch in parallel
    }
    return { triggered: Object.keys(results) };
  });

  // Return status for all connectors (for Settings screen)
  ipcMain.handle('sync:getConnectorStatuses', async () => {
    return Object.entries(ADAPTERS).map(([connectorId, cfg]) => {
      const adapter = _safeLoad(connectorId, cfg.module);
      const lastSync = _db ? (_db.getLastSync(connectorId) || null) : null;
      return {
        connectorId,
        displayName:  adapter ? adapter.displayName : connectorId,
        tier:         adapter ? adapter.tier : '?',
        schedule:     cfg.schedule || 'manual',
        isRunning:    _running.has(connectorId),
        lastSync,
      };
    });
  });

  // Import T3 manual file (HarmBench)
  ipcMain.handle('sync:importFile', async (_event, connectorId, filePath) => {
    const cfg = ADAPTERS[connectorId];
    if (!cfg) return { success: false, error: `Unknown connector: ${connectorId}` };
    const adapter = _safeLoad(connectorId, cfg.module);
    if (!adapter) return { success: false, error: 'Adapter load failed' };

    try {
      const fs = require('fs');
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const { valid, errors } = adapter.validate(raw);
      if (!valid) return { success: false, error: errors.join('; ') };
      const scores = adapter.transform(raw);
      const rowsUpserted = _db ? _db.upsertScores(scores) : 0;
      if (_db) _db.logSync(connectorId, 'success', scores.length, rowsUpserted, null);
      _emit('sync:complete', { connectorId, status: 'success', rowsFetched: scores.length, rowsUpserted });
      return { success: true, rowsUpserted };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function _safeLoad(connectorId, moduleFactory) {
  try {
    return moduleFactory();
  } catch (err) {
    console.error(`[sync-scheduler] failed to load adapter ${connectorId}:`, err.message);
    return null;
  }
}

function _emit(channel, payload) {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (win && !win.isDestroyed()) {
      win.webContents.send(channel, payload);
    }
  }
}

function _estimateRowCount(raw) {
  if (!raw) return 0;
  if (Array.isArray(raw)) return raw.length;
  if (raw.rows && Array.isArray(raw.rows)) return raw.rows.length;
  if (raw.leaderboard && Array.isArray(raw.leaderboard)) return raw.leaderboard.length;
  return 1;
}

// ─── Public API ────────────────────────────────────────────────────────────

module.exports = {
  initScheduler,
  runConnector,
  catchUpSync,
  getAdapters: () => ADAPTERS,
};
