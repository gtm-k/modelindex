// IndexedDB wrapper for ModelIndex static site
// Replaces better-sqlite3 — all operations are async
(function() {
  'use strict';

  const DB_NAME    = 'modelindex';
  const DB_VERSION = 1;
  let _db = null;

  function init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = (e) => {
        const db = e.target.result;

        // Models store
        if (!db.objectStoreNames.contains('models')) {
          db.createObjectStore('models', { keyPath: 'model_id' });
        }

        // Scores store — compound key (model_id + sub_metric)
        if (!db.objectStoreNames.contains('scores')) {
          const scores = db.createObjectStore('scores', { keyPath: ['model_id', 'sub_metric'] });
          scores.createIndex('by_model', 'model_id', { unique: false });
          scores.createIndex('by_factor', 'factor_group', { unique: false });
        }

        // Indexes store (user-created indexes)
        if (!db.objectStoreNames.contains('indexes')) {
          const idx = db.createObjectStore('indexes', { keyPath: 'id', autoIncrement: true });
          idx.createIndex('by_name', 'name', { unique: false });
        }

        // Index versions
        if (!db.objectStoreNames.contains('index_versions')) {
          const iv = db.createObjectStore('index_versions', { keyPath: 'id', autoIncrement: true });
          iv.createIndex('by_index', 'index_id', { unique: false });
        }

        // User pricing
        if (!db.objectStoreNames.contains('user_pricing')) {
          db.createObjectStore('user_pricing', { keyPath: 'model_id' });
        }

        // Model changelog
        if (!db.objectStoreNames.contains('model_changelog')) {
          const cl = db.createObjectStore('model_changelog', { keyPath: 'id', autoIncrement: true });
          cl.createIndex('by_model', 'model_id', { unique: false });
        }

        // Sync log
        if (!db.objectStoreNames.contains('sync_log')) {
          const sl = db.createObjectStore('sync_log', { keyPath: 'id', autoIncrement: true });
          sl.createIndex('by_connector', 'connector_id', { unique: false });
        }

        // Key-value store for metadata
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };

      req.onsuccess = (e) => {
        _db = e.target.result;
        resolve();
      };

      req.onerror = (e) => {
        reject(new Error('IndexedDB init failed: ' + e.target.error));
      };
    });
  }

  // ── Generic helpers ──────────────────────────────────────────────────────────

  function _tx(storeName, mode) {
    return _db.transaction(storeName, mode).objectStore(storeName);
  }

  function _txMulti(storeNames, mode) {
    const tx = _db.transaction(storeNames, mode);
    return storeNames.map(n => tx.objectStore(n));
  }

  function _promisify(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }

  function _getAll(storeName) {
    return _promisify(_tx(storeName, 'readonly').getAll());
  }

  function _get(storeName, key) {
    return _promisify(_tx(storeName, 'readonly').get(key));
  }

  function _put(storeName, value) {
    return _promisify(_tx(storeName, 'readwrite').put(value));
  }

  function _delete(storeName, key) {
    return _promisify(_tx(storeName, 'readwrite').delete(key));
  }

  // ── Models ───────────────────────────────────────────────────────────────────

  async function getModels(filters) {
    let models = await _getAll('models');
    if (!filters) return models;
    if (filters.provider) models = models.filter(m => m.provider === filters.provider);
    if (filters.license)  models = models.filter(m => m.license === filters.license);
    return models;
  }

  async function getModelById(modelId) {
    return _get('models', modelId);
  }

  async function putModel(model) {
    return _put('models', model);
  }

  async function seedModels(models) {
    const existing = await getModels();
    if (existing.length > 0) return; // only seed if empty
    const tx = _db.transaction('models', 'readwrite');
    const store = tx.objectStore('models');
    for (const m of models) {
      store.put(m);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ── Scores ───────────────────────────────────────────────────────────────────

  async function getScores(modelId) {
    const store = _tx('scores', 'readonly');
    const idx = store.index('by_model');
    return _promisify(idx.getAll(modelId));
  }

  async function getAllScores() {
    return _getAll('scores');
  }

  async function upsertScores(scores) {
    const tx = _db.transaction(['scores', 'model_changelog'], 'readwrite');
    const scoreStore = tx.objectStore('scores');
    const changeStore = tx.objectStore('model_changelog');
    let upserted = 0;

    for (const s of scores) {
      // Check for existing score to detect changes
      const key = [s.model_id, s.sub_metric];
      const existing = await _promisify(scoreStore.get(key));

      if (existing && Math.abs((existing.raw_score || 0) - (s.raw_score || 0)) >= 0.5) {
        changeStore.put({
          model_id:     s.model_id,
          factor_group: s.factor_group,
          sub_metric:   s.sub_metric,
          old_value:    existing.raw_score,
          new_value:    s.raw_score,
          delta:        s.raw_score - existing.raw_score,
          connector_id: s.connector_id,
          detected_at:  new Date().toISOString(),
        });
      }

      scoreStore.put({ ...s, fetched_at: s.fetched_at || new Date().toISOString() });
      upserted++;
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(upserted);
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ── Model changelog ──────────────────────────────────────────────────────────

  async function getModelChangelog(modelId) {
    const store = _tx('model_changelog', 'readonly');
    const idx = store.index('by_model');
    const rows = await _promisify(idx.getAll(modelId));
    return rows.sort((a, b) => (b.detected_at || '').localeCompare(a.detected_at || ''));
  }

  // ── User pricing ─────────────────────────────────────────────────────────────

  async function getUserPricing(modelId) {
    return _get('user_pricing', modelId);
  }

  async function saveUserPricing(data) {
    data.entered_at = new Date().toISOString();
    return _put('user_pricing', data);
  }

  async function getAllUserPricing() {
    return _getAll('user_pricing');
  }

  async function deleteUserPricing(modelId) {
    return _delete('user_pricing', modelId);
  }

  // ── Indexes ──────────────────────────────────────────────────────────────────

  async function saveIndex(config) {
    const now = new Date().toISOString();
    const entry = {
      ...config,
      version:          1,
      factor_weights:   JSON.stringify(config.factor_weights || {}),
      hard_constraints: JSON.stringify(config.hard_constraints || {}),
      selected_models:  JSON.stringify(config.selected_models || []),
      created_at:       now,
      updated_at:       now,
    };
    const id = await _put('indexes', entry);
    return { id: entry.id || id };
  }

  async function saveIndexVersion(indexId, snapshot) {
    return _put('index_versions', {
      index_id:    indexId,
      snapshot:    JSON.stringify(snapshot),
      created_at:  new Date().toISOString(),
    });
  }

  async function getIndexes() {
    return _getAll('indexes');
  }

  async function getIndex(id) {
    return _get('indexes', id);
  }

  async function deleteIndex(id) {
    return _delete('indexes', id);
  }

  async function getIndexVersions(indexId) {
    const store = _tx('index_versions', 'readonly');
    const idx = store.index('by_index');
    return _promisify(idx.getAll(indexId));
  }

  // ── Sync log ─────────────────────────────────────────────────────────────────

  async function logSync(connectorId, status, rowsFetched, rowsUpserted, errorMsg) {
    return _put('sync_log', {
      connector_id:  connectorId,
      status,
      rows_fetched:  rowsFetched,
      rows_upserted: rowsUpserted,
      error_msg:     errorMsg || null,
      finished_at:   new Date().toISOString(),
    });
  }

  async function getSyncLog(connectorId, limit) {
    let rows = await _getAll('sync_log');
    if (connectorId) rows = rows.filter(r => r.connector_id === connectorId);
    rows.sort((a, b) => (b.finished_at || '').localeCompare(a.finished_at || ''));
    return limit ? rows.slice(0, limit) : rows;
  }

  async function getLastSync(connectorId) {
    const logs = await getSyncLog(connectorId, 1);
    return logs[0] || null;
  }

  // ── Meta (key-value) ─────────────────────────────────────────────────────────

  async function getMeta(key) {
    const row = await _get('meta', key);
    return row ? row.value : null;
  }

  async function setMeta(key, value) {
    return _put('meta', { key, value });
  }

  // ── Export / Import (backup replacement) ─────────────────────────────────────

  async function exportAll() {
    const data = {};
    const storeNames = ['models', 'scores', 'indexes', 'index_versions', 'user_pricing', 'model_changelog', 'sync_log', 'meta'];
    for (const name of storeNames) {
      data[name] = await _getAll(name);
    }
    return data;
  }

  async function importAll(data) {
    for (const [storeName, rows] of Object.entries(data)) {
      if (!_db.objectStoreNames.contains(storeName)) continue;
      const tx = _db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      for (const row of rows) {
        store.put(row);
      }
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror    = () => reject(tx.error);
      });
    }
  }

  async function clearAll() {
    const storeNames = [..._db.objectStoreNames];
    const tx = _db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror    = () => reject(tx.error);
    });
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  window.DB = {
    init,
    getModels, getModelById, putModel, seedModels,
    getScores, getAllScores, upsertScores,
    getModelChangelog,
    getUserPricing, saveUserPricing, getAllUserPricing, deleteUserPricing,
    saveIndex, saveIndexVersion, getIndexes, getIndex, deleteIndex, getIndexVersions,
    logSync, getSyncLog, getLastSync,
    getMeta, setMeta,
    exportAll, importAll, clearAll,
  };
})();
