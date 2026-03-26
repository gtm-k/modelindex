'use strict';

const { fetchJSON } = require('./hf-parquet-client');

const CONNECTOR_ID  = 'evalplus';
const GITHUB_API    = 'https://api.github.com/repos/evalplus/evalplus/releases/latest';
const DATA_TIER     = 'T1';

const id          = CONNECTOR_ID;
const displayName = 'EvalPlus (HumanEval+ / MBPP+)';
const tier        = DATA_TIER;

async function fetch() {
  const headers = { 'User-Agent': 'ModelIndex/0.1', 'Accept': 'application/vnd.github.v3+json' };

  // Use GitHub token if available (stored in keytar)
  try {
    const keytar = require('keytar');
    const token = await keytar.getPassword('modelindex', 'github-token');
    if (token) headers['Authorization'] = `token ${token}`;
  } catch (_) { /* keytar unavailable — continue without token */ }

  const release = await fetchJSON(GITHUB_API, { headers });
  const asset = (release.assets || []).find(a => a.name === 'leaderboard.json' || a.name.endsWith('leaderboard.json'));

  if (!asset) throw new Error('[evalplus-adapter] leaderboard.json asset not found in latest release');

  const leaderboard = await fetchJSON(asset.browser_download_url, { headers });
  return { leaderboard, releaseTag: release.tag_name };
}

function validate(raw) {
  if (!raw?.leaderboard) return { valid: false, errors: ['Expected {leaderboard: [...]} structure'] };
  if (!Array.isArray(raw.leaderboard) && typeof raw.leaderboard !== 'object') {
    return { valid: false, errors: ['leaderboard is not array or object'] };
  }
  return { valid: true, errors: [] };
}

function transform(raw) {
  const scores = [];
  const rows = Array.isArray(raw.leaderboard) ? raw.leaderboard : Object.entries(raw.leaderboard).map(([k, v]) => ({ model: k, ...v }));

  for (const row of rows) {
    const modelId = _normalizeModelId(row.model || row.name || '');
    if (!modelId) continue;

    if (row['HumanEval+'] != null || row.humaneval_plus != null) {
      scores.push({
        model_id: modelId, factor_group: 'coding', sub_metric: 'humaneval_pass1',
        raw_score: parseFloat(row['HumanEval+'] || row.humaneval_plus),
        normalized_score: null, data_tier: DATA_TIER, connector_id: CONNECTOR_ID,
        benchmark_name: 'HumanEval+', benchmark_url: 'https://arxiv.org/abs/2107.03374',
        publication_date: null, model_release_date: null, contamination_flag: 1,
      });
    }
    if (row['MBPP+'] != null || row.mbpp_plus != null) {
      scores.push({
        model_id: modelId, factor_group: 'coding', sub_metric: 'mbpp_plus',
        raw_score: parseFloat(row['MBPP+'] || row.mbpp_plus),
        normalized_score: null, data_tier: DATA_TIER, connector_id: CONNECTOR_ID,
        benchmark_name: 'MBPP+', benchmark_url: 'https://arxiv.org/abs/2108.07732',
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
