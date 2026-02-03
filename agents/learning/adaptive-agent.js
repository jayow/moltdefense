/**
 * Adaptive Agent Module
 * Orchestrates all learning components to generate intelligent, evolving builds
 */

const path = require('path');
const { loadMatchHistory } = require(path.join(__dirname, '../../server/persistence'));
const { getAgentMatchesBySide, getBestBuilds } = require('./match-analyzer');
const { getMetaAnalysis, getBestEnemyTypes, getBestTowerTypes } = require('./effectiveness-tracker');
const { generateCounterBuild, scoreCounterEffectiveness, analyzeOpponentStrategy } = require('./counter-builder');
const { evolveBuild, validateMutatedBuild, crossoverBuilds } = require('./build-evolver');
const { ENEMY_STATS, TOWER_STATS, BUDGET, VALID_ENEMY_TYPES, VALID_TOWER_TYPES } = require(path.join(__dirname, '../../server/simulation/constants'));

/**
 * Selection weights for build candidates
 * Controls exploration vs exploitation balance
 */
const SELECTION_WEIGHTS = {
  bestOwn: 0.30,      // 30% - Use own best performing build
  counter: 0.25,      // 25% - Counter-build for specific opponent
  evolved: 0.25,      // 25% - Evolved/mutated version of best build
  metaOptimal: 0.20   // 20% - What's working globally in the meta
};

/**
 * Generate a meta-optimal build based on what's working globally
 * @param {string} side - 'attack' or 'defend'
 * @param {Object} meta - Meta analysis data
 * @returns {Object} Meta-optimal build
 */
function generateMetaOptimalBuild(side, meta) {
  if (side === 'attack') {
    const bestTypes = meta.bestEnemyTypes || [];

    // Use best performing enemy types
    const waves = [];
    let remainingBudget = BUDGET;

    for (let w = 0; w < 5; w++) {
      const wave = {};
      const waveTarget = Math.floor(remainingBudget / (5 - w));
      let waveCost = 0;

      // Prefer best types
      const typesToUse = bestTypes.length > 0
        ? bestTypes.map(t => t.type)
        : ['runner', 'tank'];

      while (waveCost < waveTarget - 50) {
        const type = typesToUse[Math.floor(Math.random() * typesToUse.length)];
        const cost = ENEMY_STATS[type]?.cost || 50;

        if (waveCost + cost <= waveTarget) {
          wave[type] = (wave[type] || 0) + 1;
          waveCost += cost;
        } else {
          break;
        }
      }

      if (Object.keys(wave).length > 0) {
        waves.push(wave);
        remainingBudget -= waveCost;
      } else {
        waves.push({ runner: 1 });
        remainingBudget -= 50;
      }
    }

    return {
      waves,
      waveTimings: waves.map((_, i) => ({ rush: i > 1 })), // Rush later waves
      powerUps: []
    };

  } else {
    const bestTypes = meta.bestTowerTypes || [];

    // Use best performing tower types
    const towers = [];
    let remainingBudget = BUDGET;

    const positions = [100, 250, 400, 550, 700];
    const lanes = ['top', 'bottom'];

    const typesToUse = bestTypes.length > 0
      ? bestTypes.map(t => t.type)
      : ['basic', 'slow', 'burst'];

    for (let i = 0; i < positions.length && remainingBudget >= 80; i++) {
      const type = typesToUse[i % typesToUse.length];
      const cost = TOWER_STATS[type]?.cost || 100;

      if (cost <= remainingBudget) {
        towers.push({
          x: positions[i],
          type,
          lane: lanes[i % 2]
        });
        remainingBudget -= cost;
      }
    }

    return {
      towers,
      powerUps: []
    };
  }
}

/**
 * Generate a random fallback build
 * Used when no historical data is available
 * @param {string} side - 'attack' or 'defend'
 * @returns {Object} Random valid build
 */
function generateRandomBuild(side) {
  if (side === 'attack') {
    const waves = [];
    let budget = BUDGET;

    for (let w = 0; w < 5; w++) {
      const wave = {};
      const waveTarget = Math.floor(budget / (5 - w));
      let waveCost = 0;

      while (waveCost < waveTarget - 50) {
        const type = VALID_ENEMY_TYPES[Math.floor(Math.random() * VALID_ENEMY_TYPES.length)];
        const cost = ENEMY_STATS[type]?.cost || 50;

        if (waveCost + cost <= waveTarget) {
          wave[type] = (wave[type] || 0) + 1;
          waveCost += cost;
        } else {
          break;
        }
      }

      waves.push(Object.keys(wave).length > 0 ? wave : { runner: 1 });
      budget -= waveCost || 50;
    }

    return {
      waves,
      waveTimings: waves.map(() => ({ rush: Math.random() > 0.5 })),
      powerUps: []
    };

  } else {
    const towers = [];
    let budget = BUDGET;
    const positions = [100, 250, 400, 550, 700, 850];
    const lanes = ['top', 'bottom'];

    for (let i = 0; budget >= 80 && i < positions.length; i++) {
      const type = VALID_TOWER_TYPES[Math.floor(Math.random() * VALID_TOWER_TYPES.length)];
      const cost = TOWER_STATS[type]?.cost || 100;

      if (cost <= budget) {
        towers.push({
          x: positions[i],
          type,
          lane: lanes[i % 2]
        });
        budget -= cost;
      }
    }

    return {
      towers,
      powerUps: []
    };
  }
}

/**
 * Score a build's expected performance
 * @param {Object} build - Build to score
 * @param {string} side - 'attack' or 'defend'
 * @param {Object} meta - Meta analysis data
 * @param {Object} opponentBuild - Opponent's expected build (optional)
 * @returns {number} Score (0-100)
 */
function scoreBuild(build, side, meta, opponentBuild = null) {
  let score = 50; // Base score

  if (side === 'attack') {
    // Check if we're using good enemy types
    const bestTypes = new Set((meta.bestEnemyTypes || []).map(t => t.type));
    const usedTypes = new Set();
    (build.waves || []).forEach(wave => {
      Object.keys(wave).forEach(type => usedTypes.add(type));
    });

    usedTypes.forEach(type => {
      if (bestTypes.has(type)) score += 10;
    });

    // Bonus for wave timing variety
    const hasRush = (build.waveTimings || []).some(t => t.rush);
    if (hasRush) score += 5;

  } else {
    // Check if we're using good tower types
    const bestTypes = new Set((meta.bestTowerTypes || []).map(t => t.type));
    const towers = build.towers || [];
    const towerList = Array.isArray(towers) ? towers : Object.values(towers);

    towerList.forEach(tower => {
      const type = typeof tower === 'string' ? tower : tower.type;
      if (bestTypes.has(type)) score += 8;
    });

    // Bonus for good coverage (multiple positions)
    if (towerList.length >= 4) score += 5;
  }

  // Counter effectiveness bonus
  if (opponentBuild) {
    const counterScore = scoreCounterEffectiveness(build, opponentBuild, side);
    score += (counterScore - 50) * 0.3; // Add/subtract based on counter effectiveness
  }

  return Math.min(100, Math.max(0, score));
}

/**
 * Select a build from weighted candidates
 * @param {Array} candidates - Array of { build, weight, source }
 * @returns {Object} Selected build
 */
function selectBuild(candidates) {
  if (candidates.length === 0) {
    return null;
  }

  // Normalize weights
  const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) {
    return candidates[0].build;
  }

  // Random weighted selection
  let random = Math.random() * totalWeight;

  for (const candidate of candidates) {
    random -= candidate.weight;
    if (random <= 0) {
      return candidate.build;
    }
  }

  return candidates[candidates.length - 1].build;
}

/**
 * Main entry point - Generate an adaptive build
 * @param {string} agentId - Agent identifier
 * @param {string} side - 'attack' or 'defend'
 * @param {string} opponentId - Opponent's agent ID (optional)
 * @returns {Object} Generated build
 */
function generateAdaptiveBuild(agentId, side, opponentId = null) {
  const history = loadMatchHistory();
  const meta = getMetaAnalysis(history);

  const candidates = [];

  // 1. Best own build (exploitation)
  const bestBuilds = getBestBuilds(agentId, side, 3, history);
  if (bestBuilds.length > 0) {
    const bestBuild = bestBuilds[0].build;
    candidates.push({
      build: bestBuild,
      weight: SELECTION_WEIGHTS.bestOwn,
      source: 'bestOwn',
      score: scoreBuild(bestBuild, side, meta)
    });
  }

  // 2. Counter-build for opponent
  if (opponentId) {
    const counterBuild = generateCounterBuild(opponentId, side, history);
    if (counterBuild) {
      const validated = validateMutatedBuild(counterBuild, side);
      candidates.push({
        build: validated,
        weight: SELECTION_WEIGHTS.counter,
        source: 'counter',
        score: scoreBuild(validated, side, meta)
      });
    }
  }

  // 3. Evolved build (exploration)
  if (bestBuilds.length > 0) {
    const evolved = evolveBuild(bestBuilds[0].build, side, 0.4);
    candidates.push({
      build: evolved,
      weight: SELECTION_WEIGHTS.evolved,
      source: 'evolved',
      score: scoreBuild(evolved, side, meta)
    });
  }

  // 4. Crossover of top builds
  if (bestBuilds.length >= 2) {
    const child = crossoverBuilds(bestBuilds[0].build, bestBuilds[1].build, side);
    const validated = validateMutatedBuild(child, side);
    candidates.push({
      build: validated,
      weight: SELECTION_WEIGHTS.evolved * 0.5,
      source: 'crossover',
      score: scoreBuild(validated, side, meta)
    });
  }

  // 5. Meta-optimal build
  const metaBuild = generateMetaOptimalBuild(side, meta);
  const validatedMeta = validateMutatedBuild(metaBuild, side);
  candidates.push({
    build: validatedMeta,
    weight: SELECTION_WEIGHTS.metaOptimal,
    source: 'metaOptimal',
    score: scoreBuild(validatedMeta, side, meta)
  });

  // 6. Random exploration (small chance)
  if (Math.random() < 0.1) {
    const randomBuild = generateRandomBuild(side);
    candidates.push({
      build: randomBuild,
      weight: 0.1,
      source: 'random',
      score: scoreBuild(randomBuild, side, meta)
    });
  }

  // If no candidates, generate random
  if (candidates.length === 0) {
    return generateRandomBuild(side);
  }

  // Adjust weights based on scores
  candidates.forEach(c => {
    c.weight *= (1 + (c.score - 50) / 100); // Boost high-scoring builds
  });

  // Select and return
  const selected = selectBuild(candidates);

  // Log selection for debugging
  console.log(`[Adaptive Agent] ${agentId} (${side}): Selected from ${candidates.length} candidates`);
  console.log(`  Sources: ${candidates.map(c => `${c.source}(${c.score})`).join(', ')}`);

  return selected;
}

/**
 * Get learning stats for an agent
 * @param {string} agentId - Agent identifier
 * @returns {Object} Learning statistics
 */
function getLearningStats(agentId) {
  const history = loadMatchHistory();
  const meta = getMetaAnalysis(history);

  const attackBuilds = getBestBuilds(agentId, 'attack', 3, history);
  const defenseBuilds = getBestBuilds(agentId, 'defend', 3, history);

  return {
    agentId,
    meta: {
      totalMatches: meta.totalMatches,
      attackerWinRate: meta.attackerWinRate,
      defenderWinRate: meta.defenderWinRate
    },
    bestAttackBuilds: attackBuilds.length,
    bestDefenseBuilds: defenseBuilds.length,
    topEnemyTypes: meta.bestEnemyTypes?.slice(0, 3) || [],
    topTowerTypes: meta.bestTowerTypes?.slice(0, 3) || []
  };
}

module.exports = {
  generateAdaptiveBuild,
  scoreBuild,
  selectBuild,
  generateMetaOptimalBuild,
  generateRandomBuild,
  getLearningStats,
  SELECTION_WEIGHTS
};
