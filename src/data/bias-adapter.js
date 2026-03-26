'use strict';

const { fetchParquetRows, fetchJSON } = require('./hf-parquet-client');

const CONNECTOR_ID = 'bias-fairness';
const DATA_TIER    = 'T1';

// WinoBias dataset (BBQ is fetched from HELM; WinoBias from HF)
const WINOBIAS_URL = 'https://datasets-server.huggingface.co/rows?dataset=uclanlp%2Fwinobias&config=type1_anti&split=test&offset=0&length=100';
const BBQ_URL      = 'https://datasets-server.huggingface.co/rows?dataset=heegyu%2Fbbq&config=default&split=test&offset=0&length=100';

const id          = CONNECTOR_ID;
const displayName = 'Bias & Fairness (WinoBias / BBQ)';
const tier        = DATA_TIER;

async function fetch() {
  // Fetch both datasets; if one fails the other still provides partial data
  const [winobiasRaw, bbqRaw] = await Promise.allSettled([
    fetchJSON(WINOBIAS_URL),
    fetchJSON(BBQ_URL),
  ]);

  return {
    winobias: winobiasRaw.status === 'fulfilled' ? winobiasRaw.value : null,
    bbq:      bbqRaw.status      === 'fulfilled' ? bbqRaw.value      : null,
  };
}

function validate(raw) {
  if (!raw?.winobias && !raw?.bbq) {
    return { valid: false, errors: ['Both WinoBias and BBQ datasets failed to fetch'] };
  }
  return { valid: true, errors: [] };
}

function transform(raw) {
  const scores = [];

  // WinoBias: rows contain model predictions + gender bias labels
  if (raw.winobias?.rows) {
    const modelBias = {};
    const modelCount = {};

    for (const { row } of raw.winobias.rows) {
      const modelId = _normalizeModelId(row.model || row.model_name || '');
      if (!modelId) continue;
      const biasScore = parseFloat(row.bias_score ?? row.accuracy ?? row.score);
      if (isNaN(biasScore)) continue;
      modelBias[modelId]  = (modelBias[modelId] || 0) + biasScore;
      modelCount[modelId] = (modelCount[modelId] || 0) + 1;
    }

    for (const [modelId, total] of Object.entries(modelBias)) {
      scores.push({
        model_id:          modelId,
        factor_group:      'bias',
        sub_metric:        'gender_bias_score',
        raw_score:         total / modelCount[modelId],
        normalized_score:  null,
        data_tier:         DATA_TIER,
        connector_id:      CONNECTOR_ID,
        benchmark_name:    'WinoBias',
        benchmark_url:     'https://arxiv.org/abs/1804.06876',
        publication_date:  null,
        model_release_date:null,
        contamination_flag:0,
      });
    }
  }

  // BBQ: question-answering benchmark for social bias (9 categories)
  if (raw.bbq?.rows) {
    const modelBbq   = {};
    const modelCount = {};

    for (const { row } of raw.bbq.rows) {
      const modelId = _normalizeModelId(row.model || row.model_name || '');
      if (!modelId) continue;
      const acc = parseFloat(row.accuracy ?? row.score ?? row.bbq_score);
      if (isNaN(acc)) continue;
      modelBbq[modelId]   = (modelBbq[modelId] || 0) + acc;
      modelCount[modelId] = (modelCount[modelId] || 0) + 1;
    }

    for (const [modelId, total] of Object.entries(modelBbq)) {
      scores.push({
        model_id:          modelId,
        factor_group:      'bias',
        sub_metric:        'bbq_bias_score',
        raw_score:         total / modelCount[modelId],
        normalized_score:  null,
        data_tier:         DATA_TIER,
        connector_id:      CONNECTOR_ID,
        benchmark_name:    'BBQ',
        benchmark_url:     'https://arxiv.org/abs/2110.08193',
        publication_date:  null,
        model_release_date:null,
        contamination_flag:0,
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
