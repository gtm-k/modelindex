'use strict';

const { computeBatchMCS } = require('./mcs');

/**
 * runSensitivity — Computes how much the model ranking changes when each
 * factor weight is perturbed by ±step points (all others adjusted proportionally).
 *
 * @param {Array<{modelId, scores}>} allModelScores  - pre-fetched scores for all selected models
 * @param {Object} factorWeights                     - baseline weights (0–50 integers, sum to 100)
 * @param {Object|null} subDimWeights
 * @param {Object} baseline                          - normalization-baseline.json
 * @param {number} step                              - perturbation step (default 10)
 * @returns {SensitivityResult}
 */
function runSensitivity(allModelScores, factorWeights, subDimWeights, baseline, step = 10) {
  if (!allModelScores || allModelScores.length === 0) {
    return { perFactor: {}, rankStability: 100, crossoverPoints: [] };
  }

  const factorIds  = Object.keys(factorWeights).filter(k => (factorWeights[k] || 0) > 0);
  const baseRanked = computeBatchMCS(allModelScores, factorWeights, subDimWeights, baseline);
  const baseRankMap = _rankMap(baseRanked);

  const perFactor = {};

  for (const targetFactor of factorIds) {
    const upWeights   = _perturb(factorWeights, targetFactor, +step);
    const downWeights = _perturb(factorWeights, targetFactor, -step);

    const upRanked   = computeBatchMCS(allModelScores, upWeights,   subDimWeights, baseline);
    const downRanked = computeBatchMCS(allModelScores, downWeights, subDimWeights, baseline);

    const upRankMap   = _rankMap(upRanked);
    const downRankMap = _rankMap(downRanked);

    const modelDeltas = {};
    for (const { modelId } of allModelScores) {
      const baseRank = baseRankMap[modelId] ?? 99;
      const upRank   = upRankMap[modelId]   ?? 99;
      const downRank = downRankMap[modelId] ?? 99;
      modelDeltas[modelId] = {
        upDelta:   upRank   - baseRank,   // negative = moved up
        downDelta: downRank - baseRank,
        maxAbsDelta: Math.max(Math.abs(upRank - baseRank), Math.abs(downRank - baseRank)),
      };
    }

    // Factor sensitivity = max rank change across all models for this factor
    const maxChange = Math.max(...Object.values(modelDeltas).map(d => d.maxAbsDelta));

    perFactor[targetFactor] = {
      modelDeltas,
      maxRankChange: maxChange,
      impactLabel: maxChange === 0 ? 'none' : maxChange <= 1 ? 'low' : maxChange <= 2 ? 'medium' : 'high',
    };
  }

  // Rank stability score
  const totalMaxChange = Object.values(perFactor).reduce((s, v) => s + v.maxRankChange, 0);
  const maxPossible    = factorIds.length * (allModelScores.length - 1);
  const rankStability  = maxPossible > 0
    ? Math.round(100 * (1 - totalMaxChange / maxPossible))
    : 100;

  // Crossover points: pairs where rank could flip with a single factor perturbation
  const crossoverPoints = _findCrossoverPoints(baseRanked, perFactor, factorIds, factorWeights, step);

  return {
    baseRanking: baseRanked.map(r => ({ modelId: r.modelId, mcs: r.mcs })),
    perFactor,
    rankStability: Math.max(0, Math.min(100, rankStability)),
    rankStabilityLabel: rankStability >= 80 ? 'Robust' : rankStability >= 50 ? 'Moderate' : 'Fragile',
    crossoverPoints,
  };
}

// ── Private ───────────────────────────────────────────────────────────────────

function _perturb(weights, targetFactor, delta) {
  const total = Object.values(weights).reduce((a, b) => a + (b || 0), 0);
  const currentVal = weights[targetFactor] || 0;
  const newVal     = Math.max(0, Math.min(50, currentVal + delta));
  const actualDelta = newVal - currentVal;

  if (actualDelta === 0) return { ...weights };

  // Redistribute the change from/to other factors proportionally
  const others = Object.entries(weights)
    .filter(([k]) => k !== targetFactor && (weights[k] || 0) > 0);

  const othersTotal = others.reduce((s, [, v]) => s + (v || 0), 0);

  const adjusted = { ...weights, [targetFactor]: newVal };

  if (othersTotal > 0) {
    for (const [k, v] of others) {
      const share = (v || 0) / othersTotal;
      adjusted[k] = Math.max(0, (v || 0) - actualDelta * share);
    }
  }

  return adjusted;
}

function _rankMap(ranked) {
  const map = {};
  ranked.forEach(({ modelId }, i) => { map[modelId] = i + 1; });
  return map;
}

function _findCrossoverPoints(baseRanked, perFactor, factorIds, factorWeights, step) {
  const crossovers = [];
  if (baseRanked.length < 2) return crossovers;

  const top = baseRanked[0];

  for (const factorId of factorIds) {
    const factor = perFactor[factorId];
    if (!factor) continue;

    for (const { modelId } of baseRanked.slice(1, 4)) { // check top 4 vs #1
      const d = factor.modelDeltas[modelId];
      const topD = factor.modelDeltas[top.modelId];
      if (!d || !topD) continue;

      // If the challenger moves up and the leader moves down with a +step perturbation
      if (d.upDelta < 0 || topD.upDelta > 0) {
        crossovers.push({
          factorId,
          modelA: top.modelId,
          modelB: modelId,
          direction: 'increase',
          description: `If ${factorId} weight +${step}, ${modelId} could overtake ${top.modelId}`,
        });
      }
    }
  }

  return crossovers.slice(0, 5); // limit to 5 most relevant
}

module.exports = { runSensitivity };
