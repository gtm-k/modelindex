#!/usr/bin/env node
/**
 * generate-seed-scores.js
 *
 * Generates realistic seed benchmark data for all registry models across all
 * sub-metrics. Supports LLM + domain models (robotics, weather, materials).
 * Scores are distributed by model tier/strength using a deterministic seeded
 * PRNG for reproducibility.
 *
 * Run: node scripts/generate-seed-scores.js
 */

const fs = require('fs');
const path = require('path');

const SCORES_DIR = path.resolve(__dirname, '..', 'public', 'data', 'scores');
const REGISTRY = require(path.resolve(__dirname, '..', 'public', 'data', 'registry.json'));
const BASELINE = require(path.resolve(__dirname, '..', 'public', 'data', 'baseline.json'));
const BASELINE_ROBOTICS = require(path.resolve(__dirname, '..', 'public', 'data', 'baseline-robotics.json'));
const BASELINE_WEATHER = require(path.resolve(__dirname, '..', 'public', 'data', 'baseline-weather.json'));
const BASELINE_MATERIALS = require(path.resolve(__dirname, '..', 'public', 'data', 'baseline-materials.json'));

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
// Domain model tiers and profiles
// ---------------------------------------------------------------------------

const DOMAIN_TIER_PROFILES = {
  'domain-top':   [0.70, 0.95],
  'domain-mid':   [0.45, 0.80],
  'domain-small': [0.30, 0.70],
};

const DOMAIN_MODEL_PROFILES = {
  'openvla-7b':     { tier: 'domain-top',  domain: 'robotics',  boosts: { generalization: 0.10 } },
  'pi0-3b':         { tier: 'domain-top',  domain: 'robotics',  boosts: { manipulation: 0.12, task_success: 0.10 } },
  'octo-base':      { tier: 'domain-mid',  domain: 'robotics',  boosts: { robo_efficiency: 0.15 } },
  'rt-1-x':         { tier: 'domain-mid',  domain: 'robotics',  boosts: { task_success: 0.08 } },
  'rt-2-x':         { tier: 'domain-top',  domain: 'robotics',  boosts: { planning: 0.10, generalization: 0.08 } },
  'graphcast':      { tier: 'domain-top',  domain: 'weather',   boosts: { forecast_accuracy: 0.10 } },
  'gencast':        { tier: 'domain-top',  domain: 'weather',   boosts: { probabilistic_skill: 0.15 } },
  'aurora-1-3b':    { tier: 'domain-top',  domain: 'weather',   boosts: { resolution: 0.10, weather_efficiency: 0.08 } },
  'fourcastnet-3':  { tier: 'domain-mid',  domain: 'weather',   boosts: { weather_efficiency: 0.15 } },
  'pangu-weather':  { tier: 'domain-mid',  domain: 'weather',   boosts: { forecast_accuracy: 0.05 } },
  'mattersim-5m':   { tier: 'domain-top',  domain: 'materials', boosts: { property_prediction: 0.12 } },
  'mace-mp-0':      { tier: 'domain-top',  domain: 'materials', boosts: { mat_generalization: 0.10 } },
  'chgnet':         { tier: 'domain-mid',  domain: 'materials', boosts: { stability_discovery: 0.08 } },
  'gnome':          { tier: 'domain-top',  domain: 'materials', boosts: { stability_discovery: 0.12, mat_generalization: 0.08 } },
  'mattergen':      { tier: 'domain-mid',  domain: 'materials', boosts: { structure_quality: 0.15 } },
};

const DOMAIN_BASELINES = {
  robotics:  BASELINE_ROBOTICS,
  weather:   BASELINE_WEATHER,
  materials: BASELINE_MATERIALS,
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
  // LLM seed scores go into a single 'seed-llm' connector so fetch-data.js
  // (which writes huggingface/helm/etc.) doesn't overwrite them.
  connectorScores['seed-llm'] = [];

  for (const model of models) {
    const profile = MODEL_PROFILES[model.model_id];
    if (!profile) {
      console.warn(`  !! No profile for ${model.model_id}, skipping`);
      continue;
    }
    const [minPct, maxPct] = TIER_PROFILES[profile.tier];

    for (const factorGroups of Object.values(CONNECTOR_OWNERSHIP)) {
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

          connectorScores['seed-llm'].push({
            model_id:           model.model_id,
            factor_group:       factorId,
            sub_metric:         subMetricId,
            raw_score:          rounded,
            benchmark_name:     spec.benchmark,
            benchmark_url:      spec.benchmark_url || '',
            connector_id:       'seed-llm',
            data_tier:          'T1',
            contamination_flag: false,
            fetched_at:         new Date().toISOString(),
          });
        }
      }
    }
  }

  // Generate domain model scores
  for (const model of models) {
    const profile = DOMAIN_MODEL_PROFILES[model.model_id];
    if (!profile) continue;

    const domainId = profile.domain;
    const baseline = DOMAIN_BASELINES[domainId];
    if (!baseline) continue;

    if (!connectorScores[domainId]) connectorScores[domainId] = [];

    const [minPct, maxPct] = DOMAIN_TIER_PROFILES[profile.tier];

    for (const [factorId, factorBaseline] of Object.entries(baseline)) {
      if (factorId === '_meta') continue;

      for (const [subMetricId, spec] of Object.entries(factorBaseline)) {
        const boost = (profile.boosts || {})[factorId] || 0;
        const effectiveMin = Math.min(minPct + boost, 0.98);
        const effectiveMax = Math.min(maxPct + boost, 0.99);

        const pct = effectiveMin + rand() * (effectiveMax - effectiveMin);
        const rawScore = spec.min + pct * (spec.max - spec.min);

        let rounded;
        if (spec.max > 500) {
          rounded = Math.round(rawScore);
        } else if (spec.max < 1) {
          rounded = Number(rawScore.toFixed(3));
        } else {
          rounded = Number(rawScore.toFixed(1));
        }

        connectorScores[domainId].push({
          model_id:           model.model_id,
          factor_group:       factorId,
          sub_metric:         subMetricId,
          raw_score:          rounded,
          benchmark_name:     spec.benchmark,
          benchmark_url:      spec.benchmark_url || '',
          connector_id:       domainId,
          data_tier:          'T1',
          contamination_flag: false,
          fetched_at:         new Date().toISOString(),
        });
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
