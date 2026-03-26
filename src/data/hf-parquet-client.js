'use strict';

/**
 * hf-parquet-client — shared utility for fetching and parsing HuggingFace
 * Parquet dataset files. Used by hf-adapter, routerbench-adapter, ruler-adapter,
 * and bias-adapter.
 */

let _wasmInitialized = false;
let _parquet = null;

async function initWasm() {
  if (_wasmInitialized) return _parquet;
  try {
    _parquet = require('parquet-wasm');
    if (_parquet.default) _parquet = _parquet.default;
    if (typeof _parquet.init === 'function') await _parquet.init();
    _wasmInitialized = true;
    console.log('[hf-parquet-client] WASM initialized');
    return _parquet;
  } catch (err) {
    console.error('[hf-parquet-client] WASM init failed — parquet fetching unavailable:', err.message);
    return null;
  }
}

/**
 * fetchWithRetry — fetches a URL with timeout + exponential backoff.
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  const { http, https } = require('node:http') === undefined
    ? { http: require('http'), https: require('https') }
    : { http: require('http'), https: require('https') };

  const nodeFetch = (...args) => import('node-fetch').then(m => m.default(...args));

  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 5000);
    try {
      const res = await nodeFetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (attempt < retries - 1) {
        await _sleep(500 * Math.pow(2, attempt));
      }
    }
  }
  throw lastErr;
}

/**
 * fetchParquetRows — downloads a HuggingFace parquet file and returns rows as JS objects.
 * Falls back to returning null on any WASM/network failure.
 *
 * @param {string} url - full URL to a .parquet file
 * @param {number} [maxBytes=50*1024*1024] - abort if file exceeds this size
 */
async function fetchParquetRows(url, maxBytes = 50 * 1024 * 1024) {
  const pq = await initWasm();
  if (!pq) return null;

  let res;
  try {
    res = await fetchWithRetry(url, { timeoutMs: 30000 });
  } catch (err) {
    throw new Error(`[hf-parquet-client] fetch failed for ${url}: ${err.message}`);
  }

  const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
  if (contentLength > maxBytes) {
    throw new Error(`[hf-parquet-client] file too large (${contentLength} bytes) for ${url}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());

  try {
    const table = pq.readParquet(buffer);
    return _tableToRows(table);
  } catch (err) {
    throw new Error(`[hf-parquet-client] parse failed for ${url}: ${err.message}`);
  }
}

/**
 * fetchJSON — fetches a JSON endpoint with retry.
 */
async function fetchJSON(url, options = {}) {
  const res = await fetchWithRetry(url, { ...options, timeoutMs: 10000 });
  return res.json();
}

// ── Private ───────────────────────────────────────────────────────────────────

function _tableToRows(table) {
  // parquet-wasm returns an Arrow table; convert to plain JS objects
  const rows = [];
  const schema = table.schema;
  const numRows = table.numRows;

  for (let i = 0; i < numRows; i++) {
    const row = {};
    for (const field of schema.fields) {
      const col = table.getChildAt(schema.fields.indexOf(field));
      row[field.name] = col ? col.get(i) : null;
    }
    rows.push(row);
  }
  return rows;
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { fetchParquetRows, fetchJSON, fetchWithRetry, initWasm };
