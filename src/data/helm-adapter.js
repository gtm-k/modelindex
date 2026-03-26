'use strict';

const { fetchJSON } = require('./hf-parquet-client');

const CONNECTOR_ID   = 'helm-lite';
const HELM_BASE_URL  = 'https://crfm.stanford.edu/helm/lite/latest/runs';
const DATA_TIER      = 'T1';

const id          = CONNECTOR_ID;
const displayName = 'HELM Lite (Stanford CRFM)';
const tier        = DATA_TIER;

async function fetch() {
  const summary = await fetchJSON(`${HELM_BASE_URL}/summary.json`);
  return summary;
}

function validate(raw) {
  if (!raw || typeof raw !== 'object') return { valid: false, errors: ['summary.json is not an object'] };
  if (!raw.groups && !raw.models && !raw.runs) return { valid: false, errors: ['Expected groups, models, or runs keys in HELM summary'] };
  return { valid: true, errors: [] };
}

function transform(raw) {
  const scores = [];
  // HELM summary structure varies by release — map what we can
  const groups = raw.groups || raw.scenarios || [];
  for (const group of groups) {
    const modelName = group.model_name || group.model;
    if (!modelName) continue;
    const modelId = _normalizeModelId(modelName);

    // Map HELM scenario names to our sub-metrics
    const scenario = (group.scenario_name || group.name || '').toLowerCase();

    let mapping = null;
    if (scenario.includes('truthfulqa'))  mapping = { factor_group: 'factuality', sub_metric: 'hallucination_rate', benchmark_name: 'TruthfulQA',  benchmark_url: 'https://arxiv.org/abs/2109.07958' };
    else if (scenario.includes('mmlu'))   mapping = { factor_group: 'factuality', sub_metric: 'knowledge_recency',  benchmark_name: 'MMLU-Pro',    benchmark_url: 'https://arxiv.org/abs/2406.01574' };
    else if (scenario.includes('bbq'))    mapping = { factor_group: 'bias',       sub_metric: 'bbq_bias_score',    benchmark_name: 'BBQ',         benchmark_url: 'https://arxiv.org/abs/2110.08193' };
    else if (scenario.includes('bbh'))    mapping = { factor_group: 'reasoning',  sub_metric: 'logical_deduction', benchmark_name: 'BBH',         benchmark_url: 'https://arxiv.org/abs/2210.09261' };

    if (!mapping) continue;
    const score = group.score || group.mean_win_rate || group.accuracy;
    if (score == null) continue;

    scores.push({
      model_id:          modelId,
      ...mapping,
      raw_score:         parseFloat(score) * (score <= 1 ? 100 : 1), // normalize 0–1 → 0–100
      normalized_score:  null,
      data_tier:         DATA_TIER,
      connector_id:      CONNECTOR_ID,
      publication_date:  null,
      model_release_date:null,
      contamination_flag:0,
    });
  }
  return scores;
}

function getLastSynced() { return null; }
function getStatus()     { return 'ok'; }

function _normalizeModelId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

module.exports = { id, displayName, tier, fetch, validate, transform, getLastSynced, getStatus };
