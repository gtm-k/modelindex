/**
 * runSensitivity — Computes how much the model ranking changes when each
 * factor weight is perturbed by +/-step points (all others adjusted proportionally).
 *
 * @param {Array<{modelId, scores}>} allModelScores  - pre-fetched scores for all selected models
 * @param {Object} factorWeights                     - baseline weights (0-50 integers, sum to 100)
 * @param {Object|null} subDimWeights
 * @param {Object} baseline                          - normalization-baseline.json
 * @param {number} step                              - perturbation step (default 10)
 * @returns {SensitivityResult}
 */
function runSensitivity(allModelScores, factorWeights, subDimWeights, baseline, step) {
  if (step === undefined) step = 10;

  if (!allModelScores || allModelScores.length === 0) {
    return { perFactor: {}, rankStability: 100, crossoverPoints: [] };
  }

  var computeBatchMCS = window.MCS.computeBatchMCS;

  var factorIds  = Object.keys(factorWeights).filter(function(k) { return (factorWeights[k] || 0) > 0; });
  var baseRanked = computeBatchMCS(allModelScores, factorWeights, subDimWeights, baseline);
  var baseRankMap = _rankMap(baseRanked);

  var perFactor = {};

  for (var fi = 0; fi < factorIds.length; fi++) {
    var targetFactor = factorIds[fi];
    var upWeights   = _perturb(factorWeights, targetFactor, +step);
    var downWeights = _perturb(factorWeights, targetFactor, -step);

    var upRanked   = computeBatchMCS(allModelScores, upWeights,   subDimWeights, baseline);
    var downRanked = computeBatchMCS(allModelScores, downWeights, subDimWeights, baseline);

    var upRankMap   = _rankMap(upRanked);
    var downRankMap = _rankMap(downRanked);

    var modelDeltas = {};
    for (var mi = 0; mi < allModelScores.length; mi++) {
      var modelId  = allModelScores[mi].modelId;
      var baseRank = baseRankMap[modelId] !== undefined ? baseRankMap[modelId] : 99;
      var upRank   = upRankMap[modelId]   !== undefined ? upRankMap[modelId]   : 99;
      var downRank = downRankMap[modelId] !== undefined ? downRankMap[modelId] : 99;
      modelDeltas[modelId] = {
        upDelta:   upRank   - baseRank,   // negative = moved up
        downDelta: downRank - baseRank,
        maxAbsDelta: Math.max(Math.abs(upRank - baseRank), Math.abs(downRank - baseRank)),
      };
    }

    // Factor sensitivity = max rank change across all models for this factor
    var maxChange = 0;
    var deltaValues = Object.values(modelDeltas);
    for (var di = 0; di < deltaValues.length; di++) {
      if (deltaValues[di].maxAbsDelta > maxChange) maxChange = deltaValues[di].maxAbsDelta;
    }

    perFactor[targetFactor] = {
      modelDeltas: modelDeltas,
      maxRankChange: maxChange,
      impactLabel: maxChange === 0 ? 'none' : maxChange <= 1 ? 'low' : maxChange <= 2 ? 'medium' : 'high',
    };
  }

  // Rank stability score
  var totalMaxChange = 0;
  var perFactorValues = Object.values(perFactor);
  for (var pi = 0; pi < perFactorValues.length; pi++) {
    totalMaxChange += perFactorValues[pi].maxRankChange;
  }
  var maxPossible    = factorIds.length * (allModelScores.length - 1);
  var rankStability  = maxPossible > 0
    ? Math.round(100 * (1 - totalMaxChange / maxPossible))
    : 100;

  // Crossover points: pairs where rank could flip with a single factor perturbation
  var crossoverPoints = _findCrossoverPoints(baseRanked, perFactor, factorIds, factorWeights, step);

  return {
    baseRanking: baseRanked.map(function(r) { return { modelId: r.modelId, mcs: r.mcs }; }),
    perFactor: perFactor,
    rankStability: Math.max(0, Math.min(100, rankStability)),
    rankStabilityLabel: rankStability >= 80 ? 'Robust' : rankStability >= 50 ? 'Moderate' : 'Fragile',
    crossoverPoints: crossoverPoints,
  };
}

// -- Private ------------------------------------------------------------------

function _perturb(weights, targetFactor, delta) {
  var total = Object.values(weights).reduce(function(a, b) { return a + (b || 0); }, 0);
  var currentVal = weights[targetFactor] || 0;
  var newVal     = Math.max(0, Math.min(50, currentVal + delta));
  var actualDelta = newVal - currentVal;

  if (actualDelta === 0) return Object.assign({}, weights);

  // Redistribute the change from/to other factors proportionally
  var others = Object.entries(weights)
    .filter(function(entry) { return entry[0] !== targetFactor && (weights[entry[0]] || 0) > 0; });

  var othersTotal = others.reduce(function(s, entry) { return s + (entry[1] || 0); }, 0);

  var adjusted = Object.assign({}, weights);
  adjusted[targetFactor] = newVal;

  if (othersTotal > 0) {
    for (var i = 0; i < others.length; i++) {
      var k = others[i][0];
      var v = others[i][1];
      var share = (v || 0) / othersTotal;
      adjusted[k] = Math.max(0, (v || 0) - actualDelta * share);
    }
  }

  return adjusted;
}

function _rankMap(ranked) {
  var map = {};
  for (var i = 0; i < ranked.length; i++) {
    map[ranked[i].modelId] = i + 1;
  }
  return map;
}

function _findCrossoverPoints(baseRanked, perFactor, factorIds, factorWeights, step) {
  var crossovers = [];
  if (baseRanked.length < 2) return crossovers;

  var top = baseRanked[0];

  for (var fi = 0; fi < factorIds.length; fi++) {
    var factorId = factorIds[fi];
    var factor = perFactor[factorId];
    if (!factor) continue;

    var checkSlice = baseRanked.slice(1, 4); // check top 4 vs #1
    for (var ci = 0; ci < checkSlice.length; ci++) {
      var modelId = checkSlice[ci].modelId;
      var d = factor.modelDeltas[modelId];
      var topD = factor.modelDeltas[top.modelId];
      if (!d || !topD) continue;

      // If the challenger moves up and the leader moves down with a +step perturbation
      if (d.upDelta < 0 || topD.upDelta > 0) {
        crossovers.push({
          factorId: factorId,
          modelA: top.modelId,
          modelB: modelId,
          direction: 'increase',
          description: 'If ' + factorId + ' weight +' + step + ', ' + modelId + ' could overtake ' + top.modelId,
        });
      }
    }
  }

  return crossovers.slice(0, 5); // limit to 5 most relevant
}

window.Sensitivity = { runSensitivity: runSensitivity };
