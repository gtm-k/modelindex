#!/usr/bin/env node
/**
 * generate-seed-scores.js
 *
 * One-time script to generate realistic seed benchmark data for all 19 registry
 * models across all 50 sub-metrics. Scores are distributed by model tier/strength
 * using a deterministic seeded PRNG for reproducibility.
 *
 * Run: node scripts/generate-seed-scores.js
 */

const fs = require('fs');
const path = require('path');

const SCORES_DIR = path.resolve(__dirname, '..', 'public', 'data', 'scores');
const REGISTRY = require(path.resolve(__dirname, '..', 'public', 'data', 'registry.json'));
const BASELINE = require(path.resolve(__dirname, '..', 'public', 'data', 'baseline.json'));

const models = REGISTRY.models;

// ---------------------------------------------------------------------------
// Model tier profiles: [min_percentile, max_percentile] within baseline range
// ---------------------------------------------------------------------------

const TIER_PROFILES = {
  'frontier-top':  [0.75, 0.98],  // GPT-4o, Claude 3.7, Gemini 2.5 Pro, o3
  'frontier':      [0.60, 0.90],  // Gemini 2.0 Pro, Mistral Large 2, Command R+
  'frontier-fast': [0.50, 0.82],  // GPT-4o mini, Claude 3.5 Haiku, Gemini 2.0 Flash, o4-mini
  'open-large':    [0.55, 0.88],  // Llama 3.1 405B, Qwen3 235B, DeepSeek R1/V3
  'open-mid':      [0.40, 0.78],  // Llama 3.3 70B, Qwen3 32B, Mixtral 8x22B
  'open-small':    [0.30, 0.72],  // Phi-4, Gemma 3 27B
};

// ---------------------------------------------------------------------------
// Per-model tier assignment + factor-specific strength boosts
// ---------------------------------------------------------------------------

const MODEL_PROFILES = {
  'gpt-4o':            { tier: 'frontier-top',  boosts: { multimodal: 0.15, instruction: 0.10 } },
  'gpt-4o-mini':       { tier: 'frontier-fast', boosts: { efficiency: 0.15 } },
  'o3':                { tier: 'frontier-top',  boosts: { reasoning: 0.15, coding: 0.12 } },
  'o4-mini':           { tier: 'frontier-fast', boosts: { reasoning: 0.12, efficiency: 0.15 } },
  'claude-3-7-sonnet': { tier: 'frontier-top',  boosts: { coding: 0.15, safety: 0.12, agentic: 0.10 } },
  'claude-3-5-haiku':  { tier: 'frontier-fast', boosts: { efficiency: 0.15, safety: 0.10 } },
  'gemini-2-0-flash':  { tier: 'frontier-fast', boosts: { efficiency: 0.18, multimodal: 0.10 } },
  'gemini-2-0-pro':    { tier: 'frontier',      boosts: { multimodal: 0.12 } },
  'gemini-2-5-pro':    { tier: 'frontier-top',  boosts: { reasoning: 0.12, multimodal: 0.15, context: 0.10 } },
  'llama-3-3-70b':     { tier: 'open-mid',      boosts: { instruction: 0.08 } },
  'llama-3-1-405b':    { tier: 'open-large',    boosts: { reasoning: 0.08, factuality: 0.08 } },
  'qwen3-235b-a22b':   { tier: 'open-large',    boosts: { reasoning: 0.10, coding: 0.08 } },
  'qwen3-32b':         { tier: 'open-mid',      boosts: { efficiency: 0.10 } },
  'deepseek-r1':       { tier: 'open-large',    boosts: { reasoning: 0.15, coding: 0.12 } },
  'deepseek-v3':       { tier: 'open-large',    boosts: { coding: 0.10 } },
  'mistral-large-2':   { tier: 'frontier',      boosts: { instruction: 0.08 } },
  'mixtral-8x22b':     { tier: 'open-mid',      boosts: { efficiency: 0.10 } },
  'phi-4':             { tier: 'open-small',    boosts: { efficiency: 0.18, reasoning: 0.10 } },
  'gemma-3-27b':       { tier: 'open-small',    boosts: { multimodal: 0.12 } },
  'command-r-plus':    { tier: 'frontier',      boosts: { factuality: 0.10, context: 0.08 } },
};

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------

let _seed = 42;
function rand() {
  let t = (_seed += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---------------------------------------------------------------------------
// Connector → factor group ownership
// ---------------------------------------------------------------------------

const CONNECTOR_OWNERSHIP = {
  huggingface: ['reasoning', 'factuality'],
  helm:        ['instruction', 'efficiency'],
  lmarena:     ['safety', 'multimodal'],
  evalplus:    ['coding'],
  ruler:       ['context'],
  bbq:         ['bias', 'agentic'],
};

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

function generateScores() {
  const connectorScores = {};
  for (const cid of Object.keys(CONNECTOR_OWNERSHIP)) {
    connectorScores[cid] = [];
  }

  for (const model of models) {
    const profile = MODEL_PROFILES[model.model_id];
    if (!profile) {
      console.warn(`  !! No profile for ${model.model_id}, skipping`);
      continue;
    }
    const [minPct, maxPct] = TIER_PROFILES[profile.tier];

    for (const [connectorId, factorGroups] of Object.entries(CONNECTOR_OWNERSHIP)) {
      for (const factorId of factorGroups) {
        const factorBaseline = BASELINE[factorId];
        if (!factorBaseline) continue;

        for (const [subMetricId, spec] of Object.entries(factorBaseline)) {
          const boost = (profile.boosts || {})[factorId] || 0;
          const effectiveMin = Math.min(minPct + boost, 0.98);
          const effectiveMax = Math.min(maxPct + boost, 0.99);

          // Generate a score within the model's effective percentile range
          const pct = effectiveMin + rand() * (effectiveMax - effectiveMin);
          const rawScore = spec.min + pct * (spec.max - spec.min);

          // Round appropriately based on the value scale
          let rounded;
          if (spec.max > 500) {
            rounded = Math.round(rawScore);         // ELO-scale
          } else if (spec.max < 1) {
            rounded = Number(rawScore.toFixed(3));   // Small decimals (ECE)
          } else {
            rounded = Number(rawScore.toFixed(1));   // Standard percentages
          }

          connectorScores[connectorId].push({
            model_id:           model.model_id,
            factor_group:       factorId,
            sub_metric:         subMetricId,
            raw_score:          rounded,
            benchmark_name:     spec.benchmark,
            benchmark_url:      spec.benchmark_url || '',
            connector_id:       connectorId,
            data_tier:          'T1',
            contamination_flag: false,
            fetched_at:         new Date().toISOString(),
          });
        }
      }
    }
  }

  return connectorScores;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  fs.mkdirSync(SCORES_DIR, { recursive: true });

  const allScores = generateScores();
  const manifest = {};
  let totalScores = 0;

  for (const [connectorId, scores] of Object.entries(allScores)) {
    const data = {
      connector_id: connectorId,
      fetched_at: new Date().toISOString(),
      scores,
    };
    const filePath = path.join(SCORES_DIR, `${connectorId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    console.log(`  -> ${connectorId}.json (${scores.length} scores)`);

    manifest[connectorId] = {
      fetched_at: data.fetched_at,
      count: scores.length,
    };
    totalScores += scores.length;
  }

  // Write manifest
  const manifestPath = path.join(SCORES_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

  console.log(`\nManifest: ${manifestPath}`);
  console.log(`Total: ${totalScores} scores across ${Object.keys(allScores).length} connectors`);
}

main();
