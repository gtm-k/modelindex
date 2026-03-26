'use strict';

// T3 Connector — HarmBench (Manual Import)
// ──────────────────────────────────────────
// HarmBench requires curated manual import due to safety/ethical considerations.
// Raw attack success rates must be reviewed before ingestion.
//
// Import workflow (Settings → Data Sources → HarmBench → Import):
//   1. Download results JSON from https://www.harmbench.org/results
//   2. Place file at any path → select via file picker in Settings
//   3. This adapter parses and ingests the file
//
// Sub-metrics populated:
//   - safety.jailbreak_asr  (attack success rate — inverted: lower is better)
//   - safety.refusal_rate   (% of harmful prompts refused — higher is better)

const CONNECTOR_ID = 'harmbench';
const DATA_TIER    = 'T3';

const id          = CONNECTOR_ID;
const displayName = 'HarmBench (Safety — Manual Import)';
const tier        = DATA_TIER;

// fetch() is not used for T3 connectors — data is provided via file picker in Settings.
// The IPC handler `sync.importHarmBench(filePath)` reads the file and calls transform().
async function fetch() {
  throw new Error(
    '[harmbench] T3 connector — manual import only. ' +
    'Use Settings → Data Sources → HarmBench → Import File to load results.'
  );
}

function validate(raw) {
  if (!raw) return { valid: false, errors: ['No data provided'] };
  // HarmBench results can be array or object with model keys
  if (!Array.isArray(raw) && typeof raw !== 'object') {
    return { valid: false, errors: ['Expected array or object from HarmBench results JSON'] };
  }
  return { valid: true, errors: [] };
}

function transform(raw) {
  const scores = [];
  // HarmBench results format: { "model_name": { "ASR": 0.12, "refusal_rate": 0.88 }, ... }
  // or array: [{ "model": "...", "asr": 0.12 }, ...]
  const rows = Array.isArray(raw)
    ? raw
    : Object.entries(raw).map(([model, v]) => ({ model, ...v }));

  for (const row of rows) {
    const modelId = _normalizeModelId(row.model || row.model_name || row.name || '');
    if (!modelId) continue;

    const asr = parseFloat(row.ASR ?? row.asr ?? row.attack_success_rate);
    if (!isNaN(asr)) {
      scores.push({
        model_id:          modelId,
        factor_group:      'safety',
        sub_metric:        'jailbreak_asr',
        raw_score:         asr * 100, // convert 0–1 to 0–100
        normalized_score:  null,
        data_tier:         DATA_TIER,
        connector_id:      CONNECTOR_ID,
        benchmark_name:    'HarmBench',
        benchmark_url:     'https://arxiv.org/abs/2402.04249',
        publication_date:  null,
        model_release_date:null,
        contamination_flag:0,
      });
    }

    const refusal = parseFloat(row.refusal_rate ?? row.RefusalRate ?? row.refusal);
    if (!isNaN(refusal)) {
      scores.push({
        model_id:          modelId,
        factor_group:      'safety',
        sub_metric:        'refusal_rate',
        raw_score:         refusal * (refusal <= 1 ? 100 : 1),
        normalized_score:  null,
        data_tier:         DATA_TIER,
        connector_id:      CONNECTOR_ID,
        benchmark_name:    'HarmBench',
        benchmark_url:     'https://arxiv.org/abs/2402.04249',
        publication_date:  null,
        model_release_date:null,
        contamination_flag:0,
      });
    }
  }

  return scores.filter(s => !isNaN(s.raw_score));
}

function getLastSynced() { return null; }
function getStatus()     { return 'manual'; }

function _normalizeModelId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 60);
}

module.exports = { id, displayName, tier, fetch, validate, transform, getLastSynced, getStatus };
