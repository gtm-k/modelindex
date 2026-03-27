#!/usr/bin/env node
/**
 * fetch-data.js
 *
 * Fetches benchmark scores from public APIs (no API keys required) and writes
 * them as static JSON files into public/data/scores/.
 *
 * Designed to run under Node 18+ using the built-in global fetch.
 *
 * Score output uses factor_group and sub_metric IDs that match FACTOR_SCHEMA
 * in public/js/factors.js so the MCS engine can look up baseline values.
 */

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SCORES_DIR = path.resolve(__dirname, '..', 'public', 'data', 'scores');
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'ModelIndex/0.1 (github-actions)';

// ---------------------------------------------------------------------------
// Sub-metric mapping: external API fields → internal FACTOR_SCHEMA IDs
// ---------------------------------------------------------------------------

const SUB_METRIC_MAP = {
  huggingface: {
    'arc_challenge':    { factor: 'reasoning',  metric: 'logical_deduction' },
    'hellaswag':        { factor: 'reasoning',  metric: 'cot_faithfulness' },
    'truthfulqa':       { factor: 'factuality', metric: 'hallucination_rate' },
    'mmlu':             { factor: 'factuality', metric: 'knowledge_recency' },
    'winogrande':       { factor: 'reasoning',  metric: 'causal_reasoning' },
    'gsm8k':            { factor: 'reasoning',  metric: 'math_accuracy' },
  },
  helm: {
    'mmlu':             { factor: 'factuality', metric: 'knowledge_recency' },
    'boolq':            { factor: 'factuality', metric: 'factual_consistency' },
    'narrativeqa':      { factor: 'context',    metric: 'longbench_v2' },
    'imdb':             { factor: 'instruction', metric: 'format_compliance' },
    'raft':             { factor: 'instruction', metric: 'ifeval_score' },
  },
  lmarena: {
    'elo':              { factor: 'safety',     metric: 'rlhf_reward' },
  },
  evalplus: {
    'pass@1':           { factor: 'coding',     metric: 'humaneval_pass1' },
    'humaneval':        { factor: 'coding',     metric: 'humaneval_pass1' },
    'humaneval+':       { factor: 'coding',     metric: 'humaneval_pass1' },
    'mbpp':             { factor: 'coding',     metric: 'mbpp_plus' },
    'mbpp+':            { factor: 'coding',     metric: 'mbpp_plus' },
  },
  ruler: {
    'niah':             { factor: 'context',    metric: 'niah_128k' },
    'aggregate':        { factor: 'context',    metric: 'ruler_long_context' },
    'variable_tracking':{ factor: 'context',    metric: 'memory_consistency' },
  },
  bbq: {
    'aggregate':        { factor: 'bias',       metric: 'bbq_bias_score' },
    'age':              { factor: 'bias',       metric: 'bbq_bias_score' },
    'gender':           { factor: 'bias',       metric: 'winobias' },
    'race':             { factor: 'bias',       metric: 'cross_cultural_parity' },
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a model name into a URL-safe, lowercase identifier. */
function _normalizeModelId(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

/** Fetch JSON with timeout and User-Agent header. */
async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Build a score row with all required fields. */
function scoreRow(connectorId, modelId, factorGroup, subMetric, rawScore, benchmarkName, benchmarkUrl) {
  return {
    model_id:           modelId,
    factor_group:       factorGroup,
    sub_metric:         subMetric,
    raw_score:          typeof rawScore === 'number' ? rawScore : parseFloat(rawScore),
    benchmark_name:     benchmarkName,
    benchmark_url:      benchmarkUrl || '',
    connector_id:       connectorId,
    data_tier:          'T1',
    contamination_flag: false,
    fetched_at:         new Date().toISOString(),
  };
}

/** Build the standard score envelope for a connector. */
function envelope(connectorId, scores) {
  return {
    connector_id: connectorId,
    fetched_at: new Date().toISOString(),
    scores: scores.filter(s => s.raw_score != null && !isNaN(s.raw_score)),
  };
}

/** Write a connector's envelope to disk. */
function writeTo(connectorId, data) {
  const filePath = path.join(SCORES_DIR, `${connectorId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`  -> wrote ${filePath} (${data.scores.length} scores)`);
}

// ---------------------------------------------------------------------------
// Connectors
// ---------------------------------------------------------------------------

async function fetchHuggingFace() {
  const url =
    'https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fresults&config=default&split=test&offset=0&length=100';
  const data = await fetchJSON(url);
  const rows = data.rows || [];
  const map = SUB_METRIC_MAP.huggingface;
  const scores = [];

  for (const r of rows) {
    const row = r.row || r;
    const modelId = _normalizeModelId(row.model || row.Model || '');
    if (!modelId) continue;

    for (const [externalKey, mapping] of Object.entries(map)) {
      const rawVal = row[externalKey] ?? row[externalKey.replace(/_/g, ' ')] ?? null;
      if (rawVal == null) continue;
      scores.push(scoreRow(
        'huggingface', modelId, mapping.factor, mapping.metric, rawVal,
        'Open LLM Leaderboard',
        'https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard'
      ));
    }
  }

  return envelope('huggingface', scores);
}

async function fetchHELM() {
  const url = 'https://crfm.stanford.edu/helm/lite/latest/runs/summary.json';
  const data = await fetchJSON(url);
  const runs = Array.isArray(data) ? data : data.runs || data.entries || [];
  const map = SUB_METRIC_MAP.helm;
  const scores = [];

  for (const run of runs.slice(0, 200)) {
    const name =
      run.run_spec?.adapter_spec?.model ||
      run.model ||
      run.run_spec?.name ||
      '';
    const modelId = _normalizeModelId(name);
    if (!modelId) continue;

    const scenario = (run.scenario || run.run_spec?.scenario || '').toLowerCase();
    const mapping = map[scenario];
    if (!mapping) continue;

    const metric =
      run.stats?.[0]?.mean ??
      run.metrics?.[0]?.mean ??
      run.score ??
      null;
    if (metric == null) continue;

    scores.push(scoreRow(
      'helm', modelId, mapping.factor, mapping.metric, metric,
      'HELM (Lite)',
      'https://crfm.stanford.edu/helm/lite/latest/'
    ));
  }

  return envelope('helm', scores);
}

async function fetchLMArena() {
  const url = 'https://lmarena.ai/api/leaderboard';
  const data = await fetchJSON(url);
  const entries = Array.isArray(data) ? data : data.leaderboard || data.data || [];
  const scores = [];

  for (const entry of entries.slice(0, 200)) {
    const modelId = _normalizeModelId(entry.model || entry.name || '');
    if (!modelId) continue;

    const elo = entry.elo ?? entry.rating ?? entry.score ?? null;
    if (elo == null) continue;

    scores.push(scoreRow(
      'lmarena', modelId, 'safety', 'rlhf_reward', elo,
      'LMArena (Chatbot Arena)',
      'https://lmarena.ai/'
    ));
  }

  return envelope('lmarena', scores);
}

async function fetchEvalPlus() {
  const releaseURL =
    'https://api.github.com/repos/evalplus/evalplus/releases/latest';
  const release = await fetchJSON(releaseURL);

  const assets = release.assets || [];
  const asset = assets.find(
    (a) => a.name.includes('leaderboard') && a.name.endsWith('.json')
  );

  let entries = [];
  if (asset && asset.browser_download_url) {
    entries = await fetchJSON(asset.browser_download_url);
    if (!Array.isArray(entries)) {
      entries = entries.data || entries.leaderboard || [];
    }
  }

  const map = SUB_METRIC_MAP.evalplus;
  const scores = [];

  for (const entry of entries.slice(0, 200)) {
    const modelId = _normalizeModelId(entry.model || entry.name || '');
    if (!modelId) continue;

    const metricKey = (entry.metric || entry.benchmark || 'pass@1').toLowerCase();
    const mapping = map[metricKey];
    if (!mapping) continue;

    const rawVal = entry.score ?? entry.pass_at_1 ?? entry.pass1 ?? null;
    if (rawVal == null) continue;

    scores.push(scoreRow(
      'evalplus', modelId, mapping.factor, mapping.metric, rawVal,
      'EvalPlus',
      'https://evalplus.github.io/leaderboard.html'
    ));
  }

  return envelope('evalplus', scores);
}

async function fetchRULER() {
  const url =
    'https://datasets-server.huggingface.co/rows?dataset=ruler-llm%2FRULER&config=default&split=test&offset=0&length=100';
  const data = await fetchJSON(url);
  const rows = data.rows || [];
  const map = SUB_METRIC_MAP.ruler;
  const scores = [];

  for (const r of rows) {
    const row = r.row || r;
    const modelId = _normalizeModelId(row.model || row.Model || '');
    if (!modelId) continue;

    const task = (row.metric || row.task || 'aggregate').toLowerCase();
    const mapping = map[task];
    if (!mapping) continue;

    const rawVal = row.score ?? row.Score ?? row.accuracy ?? null;
    if (rawVal == null) continue;

    scores.push(scoreRow(
      'ruler', modelId, mapping.factor, mapping.metric, rawVal,
      'RULER',
      'https://huggingface.co/datasets/ruler-llm/RULER'
    ));
  }

  return envelope('ruler', scores);
}

async function fetchBBQ() {
  const url =
    'https://datasets-server.huggingface.co/rows?dataset=heegyu%2Fbbq&config=default&split=test&offset=0&length=100';
  const data = await fetchJSON(url);
  const rows = data.rows || [];
  const map = SUB_METRIC_MAP.bbq;
  const scores = [];

  for (const r of rows) {
    const row = r.row || r;
    const modelId = _normalizeModelId(row.model || row.Model || '');
    if (!modelId) continue;

    const category = (row.category || row.metric || 'aggregate').toLowerCase();
    const mapping = map[category];
    if (!mapping) continue;

    const rawVal = row.score ?? row.Score ?? row.accuracy ?? null;
    if (rawVal == null) continue;

    scores.push(scoreRow(
      'bbq', modelId, mapping.factor, mapping.metric, rawVal,
      'BBQ (Bias Benchmark for QA)',
      'https://huggingface.co/datasets/heegyu/bbq'
    ));
  }

  return envelope('bbq', scores);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const CONNECTORS = [
  { id: 'huggingface', fn: fetchHuggingFace },
  { id: 'helm', fn: fetchHELM },
  { id: 'lmarena', fn: fetchLMArena },
  { id: 'evalplus', fn: fetchEvalPlus },
  { id: 'ruler', fn: fetchRULER },
  { id: 'bbq', fn: fetchBBQ },
];

async function main() {
  fs.mkdirSync(SCORES_DIR, { recursive: true });

  const manifest = {};

  for (const { id, fn } of CONNECTORS) {
    console.log(`Fetching ${id}...`);
    try {
      const result = await fn();
      if (result.scores.length > 0) {
        writeTo(id, result);
        manifest[id] = { fetched_at: result.fetched_at, count: result.scores.length };
      } else {
        console.log(`  -- ${id}: 0 scores returned, keeping existing file`);
        manifest[id] = { fetched_at: result.fetched_at, count: 0, skipped: true };
      }
    } catch (err) {
      console.error(`  !! ${id} failed: ${err.message}`);
      manifest[id] = { fetched_at: null, count: 0, error: err.message };
    }
  }

  // Write manifest.
  const manifestPath = path.join(SCORES_DIR, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(manifest, null, 2) + '\n',
    'utf-8'
  );
  console.log(`\nManifest written to ${manifestPath}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
