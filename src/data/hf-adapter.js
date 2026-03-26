'use strict';

/**
 * hf-adapter — HuggingFace Open LLM Leaderboard connector (T1).
 * Fetches benchmark scores from the HF datasets parquet API every 6 hours.
 * Covers: Reasoning, Factuality, Coding, Instruction, Agentic, Context, Bias.
 */

const { fetchJSON, fetchParquetRows } = require('./hf-parquet-client');

const CONNECTOR_ID   = 'hf-leaderboard';
const DATASET_ID     = 'open-llm-leaderboard/results';
const HF_API_BASE    = 'https://datasets-server.huggingface.co';
const DATA_TIER      = 'T1';

// Maps HF leaderboard column names → our factor_group + sub_metric_id
const COLUMN_MAP = {
  'IFEval':                { factor_group: 'instruction', sub_metric: 'ifeval_score',              benchmark_name: 'IFEval',      benchmark_url: 'https://arxiv.org/abs/2311.07911' },
  'BBH':                   { factor_group: 'reasoning',   sub_metric: 'logical_deduction',         benchmark_name: 'BBH',         benchmark_url: 'https://arxiv.org/abs/2210.09261' },
  'MATH Lvl 5':            { factor_group: 'reasoning',   sub_metric: 'math_accuracy',             benchmark_name: 'MATH-500',    benchmark_url: 'https://arxiv.org/abs/2103.03874' },
  'GPQA':                  { factor_group: 'reasoning',   sub_metric: 'causal_reasoning',          benchmark_name: 'GPQA',        benchmark_url: 'https://arxiv.org/abs/2311.12022' },
  'MuSR':                  { factor_group: 'reasoning',   sub_metric: 'logical_deduction',         benchmark_name: 'MuSR',        benchmark_url: 'https://arxiv.org/abs/2310.16049' },
  'MMLU-PRO':              { factor_group: 'factuality',  sub_metric: 'knowledge_recency',         benchmark_name: 'MMLU-Pro',    benchmark_url: 'https://arxiv.org/abs/2406.01574' },
};

const id          = CONNECTOR_ID;
const displayName = 'HuggingFace Open LLM Leaderboard';
const tier        = DATA_TIER;

async function fetch() {
  // Get list of parquet files for the dataset
  const index = await fetchJSON(
    `${HF_API_BASE}/parquet?dataset=${encodeURIComponent(DATASET_ID)}`
  );

  if (!index || !index.parquet_files || index.parquet_files.length === 0) {
    throw new Error('[hf-adapter] No parquet files found in leaderboard dataset');
  }

  // Fetch the first (most recent) parquet file
  const parquetFile = index.parquet_files[0];
  const rows = await fetchParquetRows(parquetFile.url, 100 * 1024 * 1024);
  return { rows, schemaHash: parquetFile.url };
}

function validate(raw) {
  if (!raw || !raw.rows || !Array.isArray(raw.rows)) {
    return { valid: false, errors: ['rows is not an array'] };
  }
  if (raw.rows.length === 0) {
    return { valid: false, errors: ['rows array is empty'] };
  }
  // Check at least one expected column is present
  const firstRow = raw.rows[0];
  const knownCols = Object.keys(COLUMN_MAP);
  const found = knownCols.some(col => col in firstRow);
  if (!found) {
    return { valid: false, errors: [`None of expected columns found. Schema may have changed. Keys: ${Object.keys(firstRow).slice(0, 10).join(', ')}`] };
  }
  return { valid: true, errors: [] };
}

function transform(raw) {
  const scores = [];
  const now = Date.now();

  for (const row of raw.rows) {
    const modelId = _normalizeModelId(row['fullname'] || row['model'] || row['name'] || '');
    if (!modelId) continue;

    for (const [col, mapping] of Object.entries(COLUMN_MAP)) {
      const val = row[col];
      if (val == null || val === '') continue;

      const numVal = parseFloat(val);
      if (isNaN(numVal)) continue;

      scores.push({
        model_id:          modelId,
        factor_group:      mapping.factor_group,
        sub_metric:        mapping.sub_metric,
        raw_score:         numVal,
        normalized_score:  null, // computed by db.upsertScores via baseline
        data_tier:         DATA_TIER,
        connector_id:      CONNECTOR_ID,
        benchmark_name:    mapping.benchmark_name,
        benchmark_url:     mapping.benchmark_url,
        publication_date:  null,
        model_release_date:null,
        contamination_flag:0,
      });
    }
  }

  return scores;
}

function getLastSynced() { return null; } // managed by sync-scheduler
function getStatus()     { return 'ok'; }

// ── Helpers ───────────────────────────────────────────────────────────────────

function _normalizeModelId(fullname) {
  if (!fullname) return null;
  // e.g. "meta-llama/Llama-3.3-70B-Instruct" → "llama-3-3-70b"
  const lower = fullname.toLowerCase().split('/').pop() || fullname.toLowerCase();
  return lower
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

module.exports = { id, displayName, tier, fetch, validate, transform, getLastSynced, getStatus };
