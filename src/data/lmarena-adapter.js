'use strict';

const { fetchJSON } = require('./hf-parquet-client');

const CONNECTOR_ID  = 'lmarena-elo';
const LMARENA_URL   = 'https://lmarena.ai/api/leaderboard';
const DATA_TIER     = 'T1';

const id          = CONNECTOR_ID;
const displayName = 'LMArena ELO';
const tier        = DATA_TIER;

async function fetch() {
  return fetchJSON(LMARENA_URL);
}

function validate(raw) {
  if (!Array.isArray(raw) && !raw?.leaderboard) return { valid: false, errors: ['Expected array or {leaderboard:[]} from LMArena API'] };
  return { valid: true, errors: [] };
}

function transform(raw) {
  const scores = [];
  const rows = Array.isArray(raw) ? raw : (raw.leaderboard || []);

  for (const row of rows) {
    const modelName = row.model || row.name || row.model_name;
    if (!modelName) continue;
    const modelId = _normalizeModelId(modelName);
    const elo = parseFloat(row.elo || row.rating || row.score);
    if (isNaN(elo)) continue;

    // ELO maps to Safety (RLHF reward proxy)
    scores.push({
      model_id:          modelId,
      factor_group:      'safety',
      sub_metric:        'rlhf_reward',
      raw_score:         elo,
      normalized_score:  null,
      data_tier:         DATA_TIER,
      connector_id:      CONNECTOR_ID,
      benchmark_name:    'LMArena ELO',
      benchmark_url:     'https://lmarena.ai',
      publication_date:  null,
      model_release_date:null,
      contamination_flag:0,
    });

    // Also map to creative writing if available
    if (row.creative_elo) {
      scores.push({
        model_id:          modelId,
        factor_group:      'multimodal',
        sub_metric:        'creative_writing_elo',
        raw_score:         parseFloat(row.creative_elo),
        normalized_score:  null,
        data_tier:         DATA_TIER,
        connector_id:      CONNECTOR_ID,
        benchmark_name:    'LMArena Creative',
        benchmark_url:     'https://lmarena.ai',
        publication_date:  null,
        model_release_date:null,
        contamination_flag:0,
      });
    }
  }

  return scores;
}

function getLastSynced() { return null; }
function getStatus()     { return 'ok'; }

function _normalizeModelId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

module.exports = { id, displayName, tier, fetch, validate, transform, getLastSynced, getStatus };
