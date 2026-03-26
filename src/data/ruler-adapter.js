'use strict';

const { fetchJSON } = require('./hf-parquet-client');

const CONNECTOR_ID = 'ruler-longcontext';
const HF_API       = 'https://datasets-server.huggingface.co/rows?dataset=ruler-llm%2FRULER&config=default&split=test&offset=0&length=100';
const DATA_TIER    = 'T1';

const id          = CONNECTOR_ID;
const displayName = 'RULER (Long Context)';
const tier        = DATA_TIER;

async function fetch() {
  return fetchJSON(HF_API);
}

function validate(raw) {
  if (!raw?.rows) return { valid: false, errors: ['Expected {rows:[]} from RULER dataset'] };
  return { valid: true, errors: [] };
}

function transform(raw) {
  const scores = [];
  for (const { row } of (raw.rows || [])) {
    const modelId = _normalizeModelId(row.model || row.model_name || '');
    if (!modelId) continue;

    if (row.ruler_score != null) {
      scores.push({
        model_id: modelId, factor_group: 'context', sub_metric: 'ruler_long_context',
        raw_score: parseFloat(row.ruler_score),
        normalized_score: null, data_tier: DATA_TIER, connector_id: CONNECTOR_ID,
        benchmark_name: 'RULER', benchmark_url: 'https://arxiv.org/abs/2404.06654',
        publication_date: null, model_release_date: null, contamination_flag: 0,
      });
    }
    if (row.niah_score != null) {
      scores.push({
        model_id: modelId, factor_group: 'context', sub_metric: 'niah_128k',
        raw_score: parseFloat(row.niah_score),
        normalized_score: null, data_tier: DATA_TIER, connector_id: CONNECTOR_ID,
        benchmark_name: 'NIAH (128K)', benchmark_url: 'https://github.com/gkamradt/LLMTest_NeedleInAHaystack',
        publication_date: null, model_release_date: null, contamination_flag: 0,
      });
    }
  }
  return scores.filter(s => !isNaN(s.raw_score));
}

function getLastSynced() { return null; }
function getStatus()     { return 'ok'; }

function _normalizeModelId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

module.exports = { id, displayName, tier, fetch, validate, transform, getLastSynced, getStatus };
