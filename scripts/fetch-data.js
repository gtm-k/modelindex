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
const REQUEST_TIMEOUT_MS = 30_000;
const USER_AGENT = 'ModelIndex/0.1 (github-actions)';

// ---------------------------------------------------------------------------
// Sub-metric mapping: external API fields → internal FACTOR_SCHEMA IDs
// ---------------------------------------------------------------------------

const SUB_METRIC_MAP = {
  huggingface: {
    // Open LLM Leaderboard v2 column names from open-llm-leaderboard/contents
    'IFEval':           { factor: 'instruction', metric: 'ifeval_score' },
    'BBH':              { factor: 'reasoning',  metric: 'logical_deduction' },
    'MATH Lvl 5':       { factor: 'reasoning',  metric: 'math_accuracy' },
    'GPQA':             { factor: 'factuality', metric: 'knowledge_recency' },
    'MUSR':             { factor: 'reasoning',  metric: 'causal_reasoning' },
    'MMLU-PRO':         { factor: 'factuality', metric: 'hallucination_rate' },
  },
  helm: {
    // HELM Lite core_scenarios_accuracy.json header values
    'NarrativeQA':         { factor: 'context',    metric: 'longbench_v2' },
    'NaturalQuestions (open-book)': { factor: 'factuality', metric: 'factual_consistency' },
    'NaturalQuestions (closed-book)': { factor: 'factuality', metric: 'knowledge_recency' },
    'OpenbookQA':          { factor: 'reasoning',  metric: 'logical_deduction' },
    'MMLU':                { factor: 'factuality', metric: 'hallucination_rate' },
    'MATH':                { factor: 'reasoning',  metric: 'math_accuracy' },
    'GSM8K':               { factor: 'reasoning',  metric: 'causal_reasoning' },
    'LegalBench':          { factor: 'instruction', metric: 'ifeval_score' },
    'MedQA':               { factor: 'factuality', metric: 'factual_consistency' },
  },
  lmarena: {
    'elo':              { factor: 'safety',     metric: 'rlhf_reward' },
  },
  evalplus: {
    'humaneval':        { factor: 'coding',     metric: 'humaneval_pass1' },
    'humaneval+':       { factor: 'coding',     metric: 'humaneval_pass1' },
    'mbpp':             { factor: 'coding',     metric: 'mbpp_plus' },
    'mbpp+':            { factor: 'coding',     metric: 'mbpp_plus' },
  },
  ruler: {
    // HELM Long-Context leaderboard columns
    'RULER SQuAD':      { factor: 'context',    metric: 'niah_128k' },
    'RULER HotPotQA':   { factor: 'context',    metric: 'ruler_long_context' },
    'OpenAI MRCR':      { factor: 'context',    metric: 'memory_consistency' },
  },
  bbq: {
    // HELM Safety leaderboard BBQ column
    'BBQ':              { factor: 'bias',       metric: 'bbq_bias_score' },
  },
};

// ---------------------------------------------------------------------------
// LiveBench: model name → registry model_id aliases
// ---------------------------------------------------------------------------

const LIVEBENCH_MODEL_ALIASES = {
  'gpt-4o-2024-11-20':           'gpt-4o',
  'gpt-4o-2024-08-06':           'gpt-4o',
  'gpt-4o-mini-2024-07-18':      'gpt-4o-mini',
  'o3-2025-04-16':               'o3',
  'o3-mini-2025-01-31-high':     'o3',
  'claude-3-7-sonnet-20250219':  'claude-3-7-sonnet',
  'claude-3-7-sonnet-20250219-base': 'claude-3-7-sonnet',
  'claude-3-5-haiku-20241022':   'claude-3-5-haiku',
  'gemini-2.5-pro-exp-03-25':    'gemini-2-5-pro',
  'gemini-2.0-pro-exp-02-05':    'gemini-2-0-pro',
  'gemini-2.0-flash':            'gemini-2-0-flash',
  'gemini-2.0-flash-001':        'gemini-2-0-flash',
  'meta-llama-3.1-405b-instruct-turbo': 'llama-3-1-405b',
  'llama-3.3-70b-instruct-turbo':       'llama-3-3-70b',
  'deepseek-r1':                 'deepseek-r1',
  'deepseek-v3':                 'deepseek-v3',
  'mistral-large-2411':          'mistral-large-2',
  'mistral-large':               'mistral-large-2',
  'open-mixtral-8x22b':          'mixtral-8x22b',
  'phi-4':                       'phi-4',
  'gemma-3-27b-it':              'gemma-3-27b',
  'command-r-plus-08-2024':      'command-r-plus',
  'command-r-plus':              'command-r-plus',
};

const LIVEBENCH_TASK_MAP = {
  'math':                   { factor: 'reasoning',  metric: 'math_accuracy' },
  'reasoning':              { factor: 'reasoning',  metric: 'logical_deduction' },
  'coding':                 { factor: 'coding',     metric: 'humaneval_pass1' },
  'language':               { factor: 'instruction', metric: 'ifeval_score' },
  'data_analysis':          { factor: 'factuality', metric: 'factual_consistency' },
  'instruction_following':  { factor: 'instruction', metric: 'format_compliance' },
  'typos':                  { factor: 'instruction', metric: 'constraint_following' },
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
  // Open LLM Leaderboard v2 uses the "open-llm-leaderboard/contents" dataset
  // with config=default, split=train.  The columns are:
  //   Model, Average ⬆️, IFEval, BBH, MATH Lvl 5, GPQA, MUSR, MMLU-PRO, ...
  // Raw-score variants have a " Raw" suffix; normalized ones don't.
  const PAGE = 100;
  const map = SUB_METRIC_MAP.huggingface;
  const scores = [];
  let offset = 0;
  let total = Infinity;

  while (offset < total && offset < 500) {
    const url =
      `https://datasets-server.huggingface.co/rows?dataset=open-llm-leaderboard%2Fcontents&config=default&split=train&offset=${offset}&length=${PAGE}`;
    const data = await fetchJSON(url);
    total = data.num_rows_total || 0;
    const rows = data.rows || [];
    if (rows.length === 0) break;

    for (const r of rows) {
      const row = r.row || r;
      const modelId = _normalizeModelId(row['fullname'] || row['eval_name'] || '');
      if (!modelId) continue;

      for (const [externalKey, mapping] of Object.entries(map)) {
        // Try the normalized column first, then the "Raw" variant
        const rawVal = row[externalKey] ?? row[`${externalKey} Raw`] ?? null;
        if (rawVal == null || typeof rawVal !== 'number') continue;
        scores.push(scoreRow(
          'huggingface', modelId, mapping.factor, mapping.metric, rawVal,
          'Open LLM Leaderboard v2',
          'https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard'
        ));
      }
    }
    offset += PAGE;
  }

  return envelope('huggingface', scores);
}

async function fetchHELM() {
  // HELM Lite v1.13.0 — fetch the core_scenarios_accuracy group table from GCS.
  // The JSON is a table with { title, header: [...], rows: [[cell, ...], ...] }.
  // Each header cell has { value }, each data cell has { value } (number).
  const url =
    'https://storage.googleapis.com/crfm-helm-public/gzip/lite/benchmark_output/releases/v1.13.0/groups/json/core_scenarios_accuracy.json';
  const data = await fetchJSON(url);

  const headers = (data.header || []).map(h =>
    typeof h === 'string' ? h : h.value || ''
  );
  const tableRows = data.rows || [];
  const map = SUB_METRIC_MAP.helm;
  const scores = [];

  for (const row of tableRows) {
    // First cell is the model name
    const modelCell = row[0];
    const modelName = typeof modelCell === 'string' ? modelCell
      : (modelCell?.value || '');
    const modelId = _normalizeModelId(modelName);
    if (!modelId) continue;

    // Iterate remaining cells, matching header name to SUB_METRIC_MAP
    for (let i = 1; i < row.length && i < headers.length; i++) {
      const headerName = headers[i];
      // Match the header to the map by checking if any map key is a prefix
      // of the header value (e.g., "MMLU" matches "MMLU - EM")
      let mapping = null;
      for (const [key, m] of Object.entries(map)) {
        if (headerName.startsWith(key)) {
          mapping = m;
          break;
        }
      }
      if (!mapping) continue;

      const cell = row[i];
      const rawVal = typeof cell === 'number' ? cell : cell?.value ?? null;
      if (rawVal == null || typeof rawVal !== 'number') continue;

      // HELM scores are 0-1 proportions; baseline expects 0-100 percentages
      const scaledVal = rawVal <= 1.0 ? rawVal * 100 : rawVal;

      scores.push(scoreRow(
        'helm', modelId, mapping.factor, mapping.metric, scaledVal,
        'HELM (Lite)',
        'https://crfm.stanford.edu/helm/lite/latest/'
      ));
    }
  }

  return envelope('helm', scores);
}

async function fetchLMArena() {
  // Use the third-party archive API (no auth required).
  // Endpoint returns { leaderboard, source_url, fetched_at, models: [...] }.
  // Each model entry: { rank, model, vendor, license, score, ci, votes }.
  const url =
    'https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=text';
  const data = await fetchJSON(url);
  const models = data.models || [];
  const scores = [];

  for (const entry of models.slice(0, 200)) {
    const modelId = _normalizeModelId(entry.model || '');
    if (!modelId) continue;

    const elo = entry.score ?? null;
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
  // The EvalPlus leaderboard publishes results.json on GitHub Pages.
  // Format: { "ModelName": { "link": "...", "pass@1": { "humaneval": N,
  //           "humaneval+": N, "mbpp": N, "mbpp+": N }, ... }, ... }
  const url =
    'https://raw.githubusercontent.com/evalplus/evalplus.github.io/main/results.json';
  const data = await fetchJSON(url);
  const map = SUB_METRIC_MAP.evalplus;
  const scores = [];

  // data is an object keyed by model name
  for (const [modelName, info] of Object.entries(data)) {
    const modelId = _normalizeModelId(modelName);
    if (!modelId) continue;

    const passAt1 = info['pass@1'];
    if (!passAt1 || typeof passAt1 !== 'object') continue;

    for (const [benchKey, mapping] of Object.entries(map)) {
      const rawVal = passAt1[benchKey] ?? null;
      if (rawVal == null || typeof rawVal !== 'number') continue;
      scores.push(scoreRow(
        'evalplus', modelId, mapping.factor, mapping.metric, rawVal,
        'EvalPlus',
        'https://evalplus.github.io/leaderboard.html'
      ));
    }
  }

  return envelope('evalplus', scores);
}

async function fetchRULER() {
  // HELM Long-Context leaderboard v1.0.0 includes RULER SQuAD and RULER
  // HotPotQA scores.  Same tabular JSON format as HELM Lite.
  const url =
    'https://storage.googleapis.com/crfm-helm-public/gzip/long-context/benchmark_output/releases/v1.0.0/groups/json/long_context_scenarios_accuracy.json';
  const data = await fetchJSON(url);

  const headers = (data.header || []).map(h =>
    typeof h === 'string' ? h : h.value || ''
  );
  const tableRows = data.rows || [];
  const map = SUB_METRIC_MAP.ruler;
  const scores = [];

  for (const row of tableRows) {
    const modelCell = row[0];
    const modelName = typeof modelCell === 'string' ? modelCell
      : (modelCell?.value || '');
    const modelId = _normalizeModelId(modelName);
    if (!modelId) continue;

    for (let i = 1; i < row.length && i < headers.length; i++) {
      const headerName = headers[i];
      let mapping = null;
      for (const [key, m] of Object.entries(map)) {
        if (headerName.startsWith(key)) {
          mapping = m;
          break;
        }
      }
      if (!mapping) continue;

      const cell = row[i];
      const rawVal = typeof cell === 'number' ? cell : cell?.value ?? null;
      if (rawVal == null || typeof rawVal !== 'number') continue;

      // RULER (HELM) scores are 0-1 proportions; baseline expects 0-100
      const scaledVal = rawVal <= 1.0 ? rawVal * 100 : rawVal;

      scores.push(scoreRow(
        'ruler', modelId, mapping.factor, mapping.metric, scaledVal,
        'RULER (HELM Long-Context)',
        'https://crfm.stanford.edu/helm/long-context/latest/'
      ));
    }
  }

  return envelope('ruler', scores);
}

async function fetchBBQ() {
  // HELM Safety leaderboard v1.17.0 includes BBQ accuracy scores.
  // Same tabular JSON format as other HELM group tables.
  const url =
    'https://storage.googleapis.com/crfm-helm-public/gzip/safety/benchmark_output/releases/v1.17.0/groups/json/safety_scenarios_accuracy.json';
  const data = await fetchJSON(url);

  const headers = (data.header || []).map(h =>
    typeof h === 'string' ? h : h.value || ''
  );
  const tableRows = data.rows || [];
  const scores = [];

  // Find the column index for BBQ
  const bbqColIdx = headers.findIndex(h => h.startsWith('BBQ'));
  if (bbqColIdx < 0) {
    console.log('  -- BBQ column not found in HELM Safety headers');
    return envelope('bbq', scores);
  }

  const mapping = SUB_METRIC_MAP.bbq['BBQ'];

  for (const row of tableRows) {
    const modelCell = row[0];
    const modelName = typeof modelCell === 'string' ? modelCell
      : (modelCell?.value || '');
    const modelId = _normalizeModelId(modelName);
    if (!modelId) continue;

    const cell = row[bbqColIdx];
    const rawVal = typeof cell === 'number' ? cell : cell?.value ?? null;
    if (rawVal == null || typeof rawVal !== 'number') continue;

    // BBQ (HELM) scores are 0-1 proportions; baseline expects 0-100
    const scaledVal = rawVal <= 1.0 ? rawVal * 100 : rawVal;

    scores.push(scoreRow(
      'bbq', modelId, mapping.factor, mapping.metric, scaledVal,
      'BBQ (HELM Safety)',
      'https://crfm.stanford.edu/helm/safety/latest/'
    ));
  }

  return envelope('bbq', scores);
}

async function fetchLiveBench() {
  const PAGE = 100;
  const BASE_URL = 'https://datasets-server.huggingface.co/rows?dataset=livebench/model_judgment&config=default&split=leaderboard';
  const modelTaskScores = {};
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = `${BASE_URL}&offset=${offset}&length=${PAGE}`;
    let data;
    try {
      data = await fetchJSON(url);
    } catch (e) {
      console.log(`  -- LiveBench pagination stopped at offset ${offset}: ${e.message}`);
      break;
    }
    total = data.num_rows_total || 0;
    const rows = data.rows || [];
    if (rows.length === 0) break;

    for (const r of rows) {
      const row = r.row || r;
      const apiModel = row.model || '';
      const registryId = LIVEBENCH_MODEL_ALIASES[apiModel];
      if (!registryId) continue;

      const task = row.task || '';
      const score = row.score;
      if (score == null || typeof score !== 'number') continue;

      if (!modelTaskScores[registryId]) modelTaskScores[registryId] = {};
      if (!modelTaskScores[registryId][task]) modelTaskScores[registryId][task] = [];
      modelTaskScores[registryId][task].push(score);
    }
    offset += PAGE;
  }

  const scores = [];
  for (const [modelId, tasks] of Object.entries(modelTaskScores)) {
    for (const [task, vals] of Object.entries(tasks)) {
      const mapping = LIVEBENCH_TASK_MAP[task];
      if (!mapping) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const scaled = avg * 100;
      scores.push(scoreRow(
        'livebench', modelId, mapping.factor, mapping.metric, scaled,
        'LiveBench', 'https://livebench.ai/'
      ));
    }
  }

  return envelope('livebench', scores);
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
  { id: 'livebench', fn: fetchLiveBench },
];

async function main() {
  fs.mkdirSync(SCORES_DIR, { recursive: true });

  // Preserve existing manifest entries for files this script doesn't manage
  // (e.g., robotics.json, weather.json, materials.json from seed generator)
  let manifest = {};
  const manifestPath = path.join(SCORES_DIR, 'manifest.json');
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch (_) { /* first run, no manifest yet */ }

  const managedIds = new Set(CONNECTORS.map(c => c.id));

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

  // Auto-discover score files not managed by this script (domain seeds, etc.)
  const scoreFiles = fs.readdirSync(SCORES_DIR)
    .filter(f => f.endsWith('.json') && f !== 'manifest.json');
  for (const file of scoreFiles) {
    const id = file.replace('.json', '');
    if (managedIds.has(id) || manifest[id]) continue;
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SCORES_DIR, file), 'utf-8'));
      manifest[id] = { fetched_at: data.fetched_at || null, count: (data.scores || []).length };
      console.log(`  -> preserved ${file} (${manifest[id].count} scores)`);
    } catch (_) { /* skip unreadable files */ }
  }

  // Write manifest.
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
