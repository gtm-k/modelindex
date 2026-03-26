'use strict';

/**
 * computeMCS — Pure MCS calculator. No DB access. Safe to duplicate in renderer.
 *
 * @param {Object} modelScores   - { sub_metric_id: rawScore, ... }
 * @param {Object} factorWeights - { factor_id: weight (0–50 integer), ... }
 * @param {Object} subDimWeights - { factor_id: { sub_metric_id: weight }, ... } | null
 * @param {Object} baseline      - normalization-baseline.json content
 * @returns {{ mcs, factorBreakdown, subMetricBreakdown }}
 */
function computeMCS(modelScores, factorWeights, subDimWeights, baseline) {
  const normWeights = _normalizeWeights(factorWeights);
  const factorBreakdown    = {};
  const subMetricBreakdown = {};

  let mcs = 0;

  for (const [factorId, weight] of Object.entries(normWeights)) {
    if (weight === 0) {
      factorBreakdown[factorId] = null;
      continue;
    }

    const factorBaseline = baseline[factorId];
    if (!factorBaseline) continue;

    const subMetricIds = Object.keys(factorBaseline);
    const subWeights   = subDimWeights && subDimWeights[factorId]
      ? _normalizeWeights(subDimWeights[factorId])
      : _equalWeights(subMetricIds);

    let factorScore    = 0;
    let totalSubWeight = 0;

    for (const smId of subMetricIds) {
      const raw  = modelScores[smId];
      const spec = factorBaseline[smId];
      if (raw == null || !spec) continue;

      const normalized = _normalize(raw, spec.min, spec.max, spec.invert);
      subMetricBreakdown[smId] = normalized;

      const w = subWeights[smId] || 0;
      factorScore    += normalized * w;
      totalSubWeight += w;
    }

    factorBreakdown[factorId] = totalSubWeight > 0
      ? factorScore / totalSubWeight
      : null;

    if (factorBreakdown[factorId] != null) {
      mcs += factorBreakdown[factorId] * weight;
    }
  }

  return { mcs, factorBreakdown, subMetricBreakdown };
}

/**
 * computeBatchMCS — convenience wrapper for ranking multiple models at once.
 *
 * @param {Array<{modelId, scores}>} allModelScores
 * @param {Object} factorWeights
 * @param {Object|null} subDimWeights
 * @param {Object} baseline
 * @returns {Array<{modelId, mcs, factorBreakdown, subMetricBreakdown}>} sorted desc by mcs
 */
function computeBatchMCS(allModelScores, factorWeights, subDimWeights, baseline) {
  return allModelScores
    .map(({ modelId, scores }) => ({
      modelId,
      ...computeMCS(scores, factorWeights, subDimWeights, baseline),
    }))
    .sort((a, b) => (b.mcs || 0) - (a.mcs || 0));
}

/**
 * estimateOracleGain — delta between index MCS and single-best model MCS.
 * RouterBench shows neural routing achieves ~89.2% of theoretical oracle.
 */
function estimateOracleGain(rankedResults) {
  if (!rankedResults || rankedResults.length < 2) return 0;
  const best   = rankedResults[0].mcs || 0;
  const second = rankedResults[1].mcs || 0;
  const ensembleEst = best + (second - best) * 0.3; // conservative ensemble gain
  return best > 0 ? ((ensembleEst - best) / best) * 100 : 0;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function _normalize(raw, min, max, invert) {
  if (max === min) return 50;
  let norm = ((raw - min) / (max - min)) * 100;
  norm = Math.max(0, Math.min(100, norm));
  return invert ? 100 - norm : norm;
}

function _normalizeWeights(weights) {
  const total = Object.values(weights).reduce((a, b) => (a + (b || 0)), 0);
  if (!total) return weights;
  return Object.fromEntries(
    Object.entries(weights).map(([k, v]) => [k, (v || 0) / total])
  );
}

function _equalWeights(ids) {
  const w = ids.length > 0 ? 1 / ids.length : 0;
  return Object.fromEntries(ids.map(id => [id, w]));
}

module.exports = { computeMCS, computeBatchMCS, estimateOracleGain };
