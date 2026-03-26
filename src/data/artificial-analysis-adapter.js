'use strict';

// T2 Connector — Artificial Analysis (Partnership Pending)
// ─────────────────────────────────────────────────────────
// This connector requires a partnership/API agreement with Artificial Analysis
// (https://artificialanalysis.ai). It is DISABLED at v0.1 Alpha launch.
//
// When enabled, this connector provides:
//   - efficiency.tokens_per_second   (throughput benchmark)
//   - efficiency.latency_ms_first    (TTFT — time to first token)
//   - efficiency.price_per_1m_tokens (provider cost index)
//
// To enable: obtain API key → store via `window.modelIndex.shell.setApiKey('artificial-analysis', key)`
// → keytar saves to OS keychain → un-comment ENABLED flag below.

const CONNECTOR_ID = 'artificial-analysis';
const DATA_TIER    = 'T2';
const ENABLED      = false; // set true once API agreement in place

const id          = CONNECTOR_ID;
const displayName = 'Artificial Analysis (Efficiency)';
const tier        = DATA_TIER;

async function fetch() {
  if (!ENABLED) {
    throw new Error('[artificial-analysis] T2 connector disabled — partnership pending. ' +
      'Use Manual Cost Entry (Settings → Pricing) to enter provider pricing manually.');
  }

  // TODO: implement when partnership is in place
  // const keytar = require('keytar');
  // const apiKey = await keytar.getPassword('modelindex', 'artificial-analysis-key');
  // if (!apiKey) throw new Error('[artificial-analysis] API key not configured');
  // return fetchJSON('https://artificialanalysis.ai/api/v1/leaderboard', {
  //   headers: { Authorization: `Bearer ${apiKey}` }
  // });
  throw new Error('[artificial-analysis] not implemented');
}

function validate(raw) {
  if (!ENABLED) return { valid: false, errors: ['Connector disabled'] };
  if (!raw || !Array.isArray(raw.models)) return { valid: false, errors: ['Expected {models:[]} from AA API'] };
  return { valid: true, errors: [] };
}

function transform(raw) {
  if (!ENABLED) return [];
  const scores = [];

  for (const row of (raw.models || [])) {
    const modelId = _normalizeModelId(row.model_id || row.model || '');
    if (!modelId) continue;

    if (row.tokens_per_second != null) {
      scores.push({
        model_id: modelId, factor_group: 'efficiency', sub_metric: 'tokens_per_second',
        raw_score: parseFloat(row.tokens_per_second),
        normalized_score: null, data_tier: DATA_TIER, connector_id: CONNECTOR_ID,
        benchmark_name: 'Artificial Analysis Throughput',
        benchmark_url: 'https://artificialanalysis.ai',
        publication_date: null, model_release_date: null, contamination_flag: 0,
      });
    }
    if (row.latency_ms != null) {
      scores.push({
        model_id: modelId, factor_group: 'efficiency', sub_metric: 'latency_ms_first',
        raw_score: parseFloat(row.latency_ms),
        normalized_score: null, data_tier: DATA_TIER, connector_id: CONNECTOR_ID,
        benchmark_name: 'Artificial Analysis Latency',
        benchmark_url: 'https://artificialanalysis.ai',
        publication_date: null, model_release_date: null, contamination_flag: 0,
      });
    }
    if (row.price_per_1m_tokens != null) {
      scores.push({
        model_id: modelId, factor_group: 'efficiency', sub_metric: 'price_per_1m_tokens',
        raw_score: parseFloat(row.price_per_1m_tokens),
        normalized_score: null, data_tier: DATA_TIER, connector_id: CONNECTOR_ID,
        benchmark_name: 'Artificial Analysis Pricing',
        benchmark_url: 'https://artificialanalysis.ai',
        publication_date: null, model_release_date: null, contamination_flag: 0,
      });
    }
  }

  return scores.filter(s => !isNaN(s.raw_score));
}

function getLastSynced() { return null; }
function getStatus()     { return ENABLED ? 'ok' : 'disabled'; }

function _normalizeModelId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

module.exports = { id, displayName, tier, fetch, validate, transform, getLastSynced, getStatus };
