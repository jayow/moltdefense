/**
 * Build Evolver Module
 * Mutates successful builds to create variations and explore new strategies
 */

const path = require('path');
const { loadMatchHistory } = require(path.join(__dirname, '../../server/persistence'));
const { getBestBuilds } = require('./match-analyzer');
const {
  ENEMY_STATS,
  TOWER_STATS,
  BUDGET,
  FREE_PLACEMENT,
  VALID_ENEMY_TYPES,
  VALID_TOWER_TYPES,
  VALID_ATTACKER_POWERUPS,
  VALID_DEFENDER_POWERUPS,
  POWER_UP_COSTS
} = require(path.join(__dirname, '../../server/simulation/constants'));

/**
 * Calculate cost of an attack build
 * @param {Object} build - Attack build with waves
 * @returns {number} Total cost
 */
function calculateAttackCost(build) {
  let cost = 0;

  (build.waves || []).forEach(wave => {
    Object.entries(wave).forEach(([type, count]) => {
      const unitCost = ENEMY_STATS[type]?.cost || 50;
      cost += unitCost * count;
    });
  });

  (build.powerUps || []).forEach(pu => {
    cost += POWER_UP_COSTS[pu.type] || 0;
  });

  return cost;
}

/**
 * Calculate cost of a defense build
 * @param {Object} build - Defense build with towers
 * @returns {number} Total cost
 */
function calculateDefenseCost(build) {
  let cost = 0;

  const towers = build.towers || [];
  const towerList = Array.isArray(towers) ? towers : Object.values(towers);

  towerList.forEach(tower => {
    const type = typeof tower === 'string' ? tower : tower.type;
    cost += TOWER_STATS[type]?.cost || 100;
  });

  (build.powerUps || []).forEach(pu => {
    cost += POWER_UP_COSTS[pu.type] || 0;
  });

  return cost;
}

/**
 * Swap one enemy type for another in waves
 * @param {Array} waves - Wave array
 * @param {string} oldType - Type to replace
 * @param {string} newType - Replacement type
 * @returns {Array} Modified waves
 */
function swapUnit(waves, oldType, newType) {
  return waves.map(wave => {
    const newWave = { ...wave };
    if (newWave[oldType]) {
      const count = newWave[oldType];
      delete newWave[oldType];
      newWave[newType] = count;
    }
    return newWave;
  });
}

/**
 * Swap one tower type for another
 * @param {Array} towers - Tower array
 * @param {string} oldType - Type to replace
 * @param {string} newType - Replacement type
 * @returns {Array} Modified towers
 */
function swapTower(towers, oldType, newType) {
  return towers.map(tower => {
    if (typeof tower === 'string') {
      return tower === oldType ? newType : tower;
    }
    return tower.type === oldType
      ? { ...tower, type: newType }
      : tower;
  });
}

/**
 * Adjust tower position
 * @param {Array} towers - Tower array
 * @param {number} index - Tower index to adjust
 * @param {number} delta - Position change (-50 to 50)
 * @returns {Array} Modified towers
 */
function adjustPosition(towers, index, delta) {
  return towers.map((tower, i) => {
    if (i !== index || typeof tower === 'string') return tower;

    const newX = Math.max(
      FREE_PLACEMENT.minX,
      Math.min(FREE_PLACEMENT.maxX, (tower.x || 500) + delta)
    );

    return { ...tower, x: newX };
  });
}

/**
 * Adjust wave timing
 * @param {Array} waveTimings - Wave timing array
 * @param {number} index - Wave index
 * @param {boolean} rush - Whether to rush
 * @returns {Array} Modified timings
 */
function adjustTiming(waveTimings, index, rush) {
  const newTimings = [...(waveTimings || [])];

  // Ensure array has enough elements
  while (newTimings.length <= index) {
    newTimings.push({ rush: false });
  }

  newTimings[index] = { rush };
  return newTimings;
}

/**
 * Add a power-up to a build
 * @param {Array} powerUps - Existing power-ups
 * @param {string} type - Power-up type
 * @param {number} wave - Wave to use it on
 * @returns {Array} Modified power-ups
 */
function addPowerUp(powerUps, type, wave) {
  const existing = powerUps || [];

  // Don't exceed limit
  if (existing.length >= 3) return existing;

  // Don't duplicate wave
  if (existing.some(pu => pu.wave === wave)) return existing;

  return [...existing, { type, wave }];
}

/**
 * Apply random mutation to a build
 * @param {Object} build - Original build
 * @param {string} side - 'attack' or 'defend'
 * @param {number} mutationRate - Probability of each mutation (0-1)
 * @returns {Object} Mutated build
 */
function mutateBuild(build, side, mutationRate = 0.3) {
  let mutated = JSON.parse(JSON.stringify(build)); // Deep copy

  if (side === 'attack') {
    // Possible mutations for attack builds
    const mutations = [
      // Swap an enemy type
      () => {
        const waves = mutated.waves || [];
        const usedTypes = new Set();
        waves.forEach(w => Object.keys(w).forEach(t => usedTypes.add(t)));

        if (usedTypes.size > 0) {
          const oldType = Array.from(usedTypes)[Math.floor(Math.random() * usedTypes.size)];
          const availableTypes = VALID_ENEMY_TYPES.filter(t => !usedTypes.has(t));
          if (availableTypes.length > 0) {
            const newType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            mutated.waves = swapUnit(waves, oldType, newType);
          }
        }
      },

      // Adjust wave timing
      () => {
        const waveIndex = Math.floor(Math.random() * 5);
        const rush = Math.random() > 0.5;
        mutated.waveTimings = adjustTiming(mutated.waveTimings, waveIndex, rush);
      },

      // Add a power-up
      () => {
        if ((mutated.powerUps || []).length < 3) {
          const type = VALID_ATTACKER_POWERUPS[
            Math.floor(Math.random() * VALID_ATTACKER_POWERUPS.length)
          ];
          const wave = Math.floor(Math.random() * 5) + 1;
          mutated.powerUps = addPowerUp(mutated.powerUps, type, wave);
        }
      },

      // Adjust unit counts
      () => {
        if (!mutated.waves || mutated.waves.length === 0) return;
        const waveIdx = Math.floor(Math.random() * mutated.waves.length);
        const wave = mutated.waves[waveIdx];
        const types = Object.keys(wave);
        if (types.length > 0) {
          const type = types[Math.floor(Math.random() * types.length)];
          const delta = Math.random() > 0.5 ? 1 : -1;
          const newCount = Math.max(1, wave[type] + delta);
          mutated.waves[waveIdx] = { ...wave, [type]: newCount };
        }
      }
    ];

    // Apply random mutations
    mutations.forEach(mutation => {
      if (Math.random() < mutationRate) {
        mutation();
      }
    });

  } else {
    // Possible mutations for defense builds
    const mutations = [
      // Swap a tower type
      () => {
        const towers = mutated.towers || [];
        if (!Array.isArray(towers) || towers.length === 0) return;

        const usedTypes = new Set(towers.map(t =>
          typeof t === 'string' ? t : t.type
        ));

        if (usedTypes.size > 0) {
          const oldType = Array.from(usedTypes)[Math.floor(Math.random() * usedTypes.size)];
          const availableTypes = VALID_TOWER_TYPES.filter(t => !usedTypes.has(t));
          if (availableTypes.length > 0) {
            const newType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            mutated.towers = swapTower(towers, oldType, newType);
          }
        }
      },

      // Adjust tower position
      () => {
        const towers = mutated.towers || [];
        if (!Array.isArray(towers) || towers.length === 0) return;

        const index = Math.floor(Math.random() * towers.length);
        const delta = (Math.random() - 0.5) * 100; // -50 to +50
        mutated.towers = adjustPosition(towers, index, Math.round(delta));
      },

      // Add a power-up
      () => {
        if ((mutated.powerUps || []).length < 3) {
          const type = VALID_DEFENDER_POWERUPS[
            Math.floor(Math.random() * VALID_DEFENDER_POWERUPS.length)
          ];
          const wave = Math.floor(Math.random() * 5) + 1;
          mutated.powerUps = addPowerUp(mutated.powerUps, type, wave);
        }
      },

      // Toggle tower lane
      () => {
        const towers = mutated.towers || [];
        if (!Array.isArray(towers) || towers.length === 0) return;

        const index = Math.floor(Math.random() * towers.length);
        if (typeof towers[index] === 'object') {
          mutated.towers[index] = {
            ...towers[index],
            lane: towers[index].lane === 'top' ? 'bottom' : 'top'
          };
        }
      }
    ];

    // Apply random mutations
    mutations.forEach(mutation => {
      if (Math.random() < mutationRate) {
        mutation();
      }
    });
  }

  return mutated;
}

/**
 * Crossover two builds to create a hybrid
 * @param {Object} build1 - First parent build
 * @param {Object} build2 - Second parent build
 * @param {string} side - 'attack' or 'defend'
 * @returns {Object} Child build
 */
function crossoverBuilds(build1, build2, side) {
  if (side === 'attack') {
    // Take waves from both parents
    const waves1 = build1.waves || [];
    const waves2 = build2.waves || [];

    const childWaves = [];
    for (let i = 0; i < 5; i++) {
      // Randomly pick from parent 1 or 2
      const parent = Math.random() > 0.5 ? waves1 : waves2;
      childWaves.push(parent[i] ? { ...parent[i] } : { runner: 1 });
    }

    // Mix timings
    const timings1 = build1.waveTimings || [];
    const timings2 = build2.waveTimings || [];
    const childTimings = [];
    for (let i = 0; i < 5; i++) {
      const parent = Math.random() > 0.5 ? timings1 : timings2;
      childTimings.push(parent[i] ? { ...parent[i] } : { rush: false });
    }

    return {
      waves: childWaves,
      waveTimings: childTimings,
      powerUps: Math.random() > 0.5
        ? [...(build1.powerUps || [])]
        : [...(build2.powerUps || [])]
    };

  } else {
    // Mix towers from both parents
    const towers1 = Array.isArray(build1.towers) ? build1.towers : [];
    const towers2 = Array.isArray(build2.towers) ? build2.towers : [];

    const allTowers = [...towers1, ...towers2];
    const childTowers = [];
    const usedPositions = new Set();

    // Randomly select towers, avoiding position conflicts
    const shuffled = allTowers.sort(() => Math.random() - 0.5);

    for (const tower of shuffled) {
      const x = tower.x || 500;
      const key = Math.floor(x / FREE_PLACEMENT.minSpacing);

      if (!usedPositions.has(key)) {
        usedPositions.add(key);
        childTowers.push({ ...tower });

        if (childTowers.length >= 5) break; // Max 5 towers
      }
    }

    return {
      towers: childTowers,
      powerUps: Math.random() > 0.5
        ? [...(build1.powerUps || [])]
        : [...(build2.powerUps || [])]
    };
  }
}

/**
 * Validate that a mutated build is within budget
 * @param {Object} build - Build to validate
 * @param {string} side - 'attack' or 'defend'
 * @param {number} budget - Maximum budget
 * @returns {Object} Adjusted build within budget
 */
function validateMutatedBuild(build, side, budget = BUDGET) {
  const validated = JSON.parse(JSON.stringify(build));

  if (side === 'attack') {
    let cost = calculateAttackCost(validated);

    // Remove units until within budget
    while (cost > budget && validated.waves && validated.waves.length > 0) {
      // Find most expensive wave
      let maxWaveIdx = 0;
      let maxWaveCost = 0;

      validated.waves.forEach((wave, idx) => {
        const waveCost = Object.entries(wave).reduce((sum, [type, count]) => {
          return sum + (ENEMY_STATS[type]?.cost || 50) * count;
        }, 0);
        if (waveCost > maxWaveCost) {
          maxWaveCost = waveCost;
          maxWaveIdx = idx;
        }
      });

      // Reduce count of most expensive unit in that wave
      const wave = validated.waves[maxWaveIdx];
      const types = Object.keys(wave);
      if (types.length > 0) {
        const mostExpensive = types.reduce((a, b) =>
          (ENEMY_STATS[a]?.cost || 0) > (ENEMY_STATS[b]?.cost || 0) ? a : b
        );
        wave[mostExpensive]--;
        if (wave[mostExpensive] <= 0) {
          delete wave[mostExpensive];
        }
      }

      // Remove empty waves
      validated.waves = validated.waves.filter(w => Object.keys(w).length > 0);

      cost = calculateAttackCost(validated);
    }

    // Ensure at least one wave
    if (validated.waves.length === 0) {
      validated.waves = [{ runner: 1 }];
    }

    // Ensure 5 waves
    while (validated.waves.length < 5) {
      validated.waves.push({ runner: 1 });
    }

  } else {
    let cost = calculateDefenseCost(validated);

    // Remove towers until within budget
    while (cost > budget && validated.towers && validated.towers.length > 1) {
      // Remove most expensive tower
      const towerList = Array.isArray(validated.towers)
        ? validated.towers
        : Object.values(validated.towers);

      let maxIdx = 0;
      let maxCost = 0;

      towerList.forEach((tower, idx) => {
        const type = typeof tower === 'string' ? tower : tower.type;
        const towerCost = TOWER_STATS[type]?.cost || 100;
        if (towerCost > maxCost) {
          maxCost = towerCost;
          maxIdx = idx;
        }
      });

      validated.towers.splice(maxIdx, 1);
      cost = calculateDefenseCost(validated);
    }

    // Ensure at least one tower
    if (!validated.towers || validated.towers.length === 0) {
      validated.towers = [{ x: 500, type: 'basic', lane: 'top' }];
    }
  }

  return validated;
}

/**
 * Evolve a build by applying mutation and validation
 * @param {Object} build - Original build
 * @param {string} side - 'attack' or 'defend'
 * @param {number} mutationRate - Mutation probability
 * @returns {Object} Evolved and validated build
 */
function evolveBuild(build, side, mutationRate = 0.3) {
  const mutated = mutateBuild(build, side, mutationRate);
  return validateMutatedBuild(mutated, side);
}

module.exports = {
  calculateAttackCost,
  calculateDefenseCost,
  swapUnit,
  swapTower,
  adjustPosition,
  adjustTiming,
  addPowerUp,
  mutateBuild,
  crossoverBuilds,
  validateMutatedBuild,
  evolveBuild
};
