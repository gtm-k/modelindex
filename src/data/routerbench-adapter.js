'use strict';

const { fetchParquetRows } = require('./hf-parquet-client');

const CONNECTOR_ID  = 'routerbench';
const HF_DATASET    = 'https://huggingface.co/datasets/routerbench/routerbench/resolve/main/data/train-00000-of-00001.parquet';
const DATA_TIER     = 'T1';

const id          = CONNECTOR_ID;
const displayName = 'RouterBench';
const tier        = DATA_TIER;

async function fetch() {
  // RouterBench is a large static dataset (~180MB). Only re-fetch if dataset updated.
  const rows = await fetchParquetRows(HF_DATASET, 200 * 1024 * 1024);
  return { rows };
}

function validate(raw) {
  if (!raw?.rows || !Array.isArray(raw.rows)) return { valid: false, errors: ['rows is not an array'] };
  if (raw.rows.length === 0) return { valid: false, errors: ['RouterBench rows are empty'] };
  return { valid: true, errors: [] };
}

function transform(raw) {
  // RouterBench: compute per-model average accuracy across routing scenarios
  const modelAcc = {};
  const modelCount = {};

  for (const row of raw.rows) {
    for (const key of Object.keys(row)) {
      if (!key.startsWith('score_') && key !== 'model') continue;
      const modelId = _normalizeModelId(key.replace('score_', ''));
      const val = parseFloat(row[key]);
      if (isNaN(val)) continue;
      modelAcc[modelId]   = (modelAcc[modelId] || 0) + val;
      modelCount[modelId] = (modelCount[modelId] || 0) + 1;
    }
  }

  return Object.entries(modelAcc).map(([modelId, total]) => ({
    model_id:          modelId,
    factor_group:      'efficiency',
    sub_metric:        'pareto_efficiency',
    raw_score:         total / modelCount[modelId],
    normalized_score:  null,
    data_tier:         DATA_TIER,
    connector_id:      CONNECTOR_ID,
    benchmark_name:    'RouterBench',
    benchmark_url:     'https://huggingface.co/datasets/routerbench/routerbench',
    publication_date:  null,
    model_release_date:null,
    contamination_flag:0,
  }));
}

function getLastSynced() { return null; }
function getStatus()     { return 'ok'; }

function _normalizeModelId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

module.exports = { id, displayName, tier, fetch, validate, transform, getLastSynced, getStatus };
