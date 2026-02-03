const {
  BUDGET,
  TOTAL_WAVES,
  VALID_SLOTS,
  VALID_TOWER_TYPES,
  VALID_ENEMY_TYPES,
  ENEMY_STATS,
  TOWER_STATS,
  FREE_PLACEMENT,
  WAVE_TIMING,
  POWER_UP_COSTS,
  POWER_UP_LIMITS,
  VALID_ATTACKER_POWERUPS,
  VALID_DEFENDER_POWERUPS
} = require('../simulation/constants');

/**
 * Calculate total cost of an attack build (including power-ups)
 */
function calculateAttackCost(build) {
  if (!build || !build.waves) return 0;

  let total = 0;

  for (const wave of build.waves) {
    for (const [type, count] of Object.entries(wave)) {
      const stats = ENEMY_STATS[type];
      if (stats) {
        total += stats.cost * count;
      }
    }
  }

  // Add power-up costs
  if (build.powerUps && Array.isArray(build.powerUps)) {
    for (const powerUp of build.powerUps) {
      const cost = POWER_UP_COSTS[powerUp.type];
      if (cost) {
        total += cost;
      }
    }
  }

  return total;
}

/**
 * Calculate total cost of a defense build (supports both formats)
 */
function calculateDefenseCost(build) {
  if (!build || !build.towers) return 0;

  let total = 0;

  // Check if it's the new array format
  if (Array.isArray(build.towers)) {
    for (const tower of build.towers) {
      const stats = TOWER_STATS[tower.type];
      if (stats) {
        total += stats.cost;
      }
    }
  } else {
    // Legacy object format
    for (const [slot, type] of Object.entries(build.towers)) {
      const stats = TOWER_STATS[type];
      if (stats) {
        total += stats.cost;
      }
    }
  }

  // Add power-up costs
  if (build.powerUps && Array.isArray(build.powerUps)) {
    for (const powerUp of build.powerUps) {
      const cost = POWER_UP_COSTS[powerUp.type];
      if (cost) {
        total += cost;
      }
    }
  }

  return total;
}

/**
 * Validate power-ups for either side
 */
function validatePowerUps(powerUps, side) {
  if (!powerUps) {
    return { valid: true };  // Power-ups are optional
  }

  if (!Array.isArray(powerUps)) {
    return { valid: false, error: 'powerUps must be an array' };
  }

  const validTypes = side === 'attack' ? VALID_ATTACKER_POWERUPS : VALID_DEFENDER_POWERUPS;
  const perWaveCount = {};
  let totalCost = 0;

  // Check total limit
  if (powerUps.length > POWER_UP_LIMITS.perMatch) {
    return { valid: false, error: `Maximum ${POWER_UP_LIMITS.perMatch} power-ups per match` };
  }

  for (let i = 0; i < powerUps.length; i++) {
    const powerUp = powerUps[i];

    // Check type is valid
    if (!powerUp.type || !validTypes.includes(powerUp.type)) {
      return { valid: false, error: `Invalid ${side}er power-up: '${powerUp.type}'. Valid: ${validTypes.join(', ')}` };
    }

    // Check wave is valid
    if (typeof powerUp.wave !== 'number' || powerUp.wave < 1 || powerUp.wave > TOTAL_WAVES) {
      return { valid: false, error: `Power-up wave must be 1-${TOTAL_WAVES}` };
    }

    // Check per-wave limit
    perWaveCount[powerUp.wave] = (perWaveCount[powerUp.wave] || 0) + 1;
    if (perWaveCount[powerUp.wave] > POWER_UP_LIMITS.perWave) {
      return { valid: false, error: `Maximum ${POWER_UP_LIMITS.perWave} power-up per wave` };
    }

    totalCost += POWER_UP_COSTS[powerUp.type];
  }

  return { valid: true, powerUpCost: totalCost };
}

/**
 * Validate wave timings
 */
function validateWaveTimings(waveTimings) {
  if (!waveTimings) {
    return { valid: true };  // Wave timings are optional
  }

  if (!Array.isArray(waveTimings)) {
    return { valid: false, error: 'waveTimings must be an array' };
  }

  if (waveTimings.length !== TOTAL_WAVES) {
    return { valid: false, error: `waveTimings must have ${TOTAL_WAVES} entries` };
  }

  for (let i = 0; i < waveTimings.length; i++) {
    const timing = waveTimings[i];

    if (typeof timing !== 'object') {
      return { valid: false, error: `Wave ${i + 1} timing must be an object` };
    }

    // Check rush flag
    if (timing.rush !== undefined && typeof timing.rush !== 'boolean') {
      return { valid: false, error: `Wave ${i + 1} timing.rush must be boolean` };
    }

    // Check delay
    if (timing.delay !== undefined) {
      if (typeof timing.delay !== 'number') {
        return { valid: false, error: `Wave ${i + 1} timing.delay must be a number` };
      }
      if (timing.delay < WAVE_TIMING.minWaveDelay || timing.delay > WAVE_TIMING.maxWaveDelay) {
        return { valid: false, error: `Wave ${i + 1} delay must be ${WAVE_TIMING.minWaveDelay}-${WAVE_TIMING.maxWaveDelay} ticks` };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate an attack build with new features
 */
function validateAttackBuild(build) {
  // Check build exists
  if (!build || typeof build !== 'object') {
    return { valid: false, error: 'Build is required' };
  }

  // Check waves array
  if (!build.waves || !Array.isArray(build.waves)) {
    return { valid: false, error: 'Build must have a waves array' };
  }

  // Check wave count
  if (build.waves.length !== TOTAL_WAVES) {
    return { valid: false, error: `Must have exactly ${TOTAL_WAVES} waves, got ${build.waves.length}` };
  }

  // Validate each wave
  for (let i = 0; i < build.waves.length; i++) {
    const wave = build.waves[i];

    if (!wave || typeof wave !== 'object') {
      return { valid: false, error: `Wave ${i + 1} must be an object` };
    }

    // Check enemy types
    for (const [type, count] of Object.entries(wave)) {
      if (!VALID_ENEMY_TYPES.includes(type)) {
        return { valid: false, error: `Invalid enemy type '${type}' in wave ${i + 1}. Valid types: ${VALID_ENEMY_TYPES.join(', ')}` };
      }

      if (typeof count !== 'number' || count < 0 || !Number.isInteger(count)) {
        return { valid: false, error: `Invalid count for '${type}' in wave ${i + 1}. Must be a non-negative integer` };
      }
    }

    // Check wave is not empty
    const waveTotal = Object.values(wave).reduce((sum, count) => sum + count, 0);
    if (waveTotal === 0) {
      return { valid: false, error: `Wave ${i + 1} cannot be empty` };
    }
  }

  // Validate wave timings (optional)
  const timingResult = validateWaveTimings(build.waveTimings);
  if (!timingResult.valid) {
    return timingResult;
  }

  // Validate power-ups (optional)
  const powerUpResult = validatePowerUps(build.powerUps, 'attack');
  if (!powerUpResult.valid) {
    return powerUpResult;
  }

  // Check budget
  const totalCost = calculateAttackCost(build);
  if (totalCost > BUDGET) {
    return { valid: false, error: `Budget exceeded: ${totalCost}/${BUDGET} points` };
  }

  return { valid: true, cost: totalCost };
}

/**
 * Validate free-flow tower placement
 */
function validateFreeFlowTowers(towers) {
  if (!Array.isArray(towers)) {
    return { valid: false, error: 'towers must be an array for free-flow placement' };
  }

  if (towers.length === 0) {
    return { valid: false, error: 'Must place at least one tower' };
  }

  const positions = [];
  let totalCost = 0;

  for (let i = 0; i < towers.length; i++) {
    const tower = towers[i];

    // Check tower has required fields
    if (!tower || typeof tower !== 'object') {
      return { valid: false, error: `Tower ${i + 1} must be an object` };
    }

    // Validate position
    if (typeof tower.x !== 'number') {
      return { valid: false, error: `Tower ${i + 1}: x position is required` };
    }

    if (tower.x < FREE_PLACEMENT.minX || tower.x > FREE_PLACEMENT.maxX) {
      return { valid: false, error: `Tower ${i + 1}: x position must be ${FREE_PLACEMENT.minX}-${FREE_PLACEMENT.maxX}` };
    }

    // Validate type
    if (!tower.type || !VALID_TOWER_TYPES.includes(tower.type)) {
      return { valid: false, error: `Tower ${i + 1}: invalid type '${tower.type}'. Valid: ${VALID_TOWER_TYPES.join(', ')}` };
    }

    // Check minimum spacing
    for (let j = 0; j < positions.length; j++) {
      if (Math.abs(tower.x - positions[j]) < FREE_PLACEMENT.minSpacing) {
        return { valid: false, error: `Tower ${i + 1}: too close to another tower (min spacing: ${FREE_PLACEMENT.minSpacing})` };
      }
    }
    positions.push(tower.x);

    // Validate lane (optional)
    if (tower.lane && !FREE_PLACEMENT.lanes.includes(tower.lane)) {
      return { valid: false, error: `Tower ${i + 1}: lane must be 'top' or 'bottom'` };
    }

    totalCost += TOWER_STATS[tower.type].cost;
  }

  return { valid: true, cost: totalCost };
}

/**
 * Validate a defense build (supports both legacy and free-flow)
 */
function validateDefenseBuild(build) {
  // Check build exists
  if (!build || typeof build !== 'object') {
    return { valid: false, error: 'Build is required' };
  }

  // Check towers exists
  if (!build.towers) {
    return { valid: false, error: 'Build must have towers' };
  }

  let towerCost = 0;

  // Check if it's the new array format (free-flow)
  if (Array.isArray(build.towers)) {
    const result = validateFreeFlowTowers(build.towers);
    if (!result.valid) {
      return result;
    }
    towerCost = result.cost;
  } else if (typeof build.towers === 'object') {
    // Legacy slot-based format
    const towerEntries = Object.entries(build.towers).filter(([, type]) => type);
    if (towerEntries.length === 0) {
      return { valid: false, error: 'Must place at least one tower' };
    }

    for (const [slot, type] of Object.entries(build.towers)) {
      if (!type) continue;

      if (!VALID_SLOTS.includes(slot)) {
        return { valid: false, error: `Invalid tower slot '${slot}'. Valid slots: ${VALID_SLOTS.join(', ')}` };
      }

      if (!VALID_TOWER_TYPES.includes(type)) {
        return { valid: false, error: `Invalid tower type '${type}' at slot ${slot}. Valid: ${VALID_TOWER_TYPES.join(', ')}` };
      }

      towerCost += TOWER_STATS[type].cost;
    }
  } else {
    return { valid: false, error: 'towers must be an object or array' };
  }

  // Validate power-ups (optional)
  const powerUpResult = validatePowerUps(build.powerUps, 'defend');
  if (!powerUpResult.valid) {
    return powerUpResult;
  }

  // Calculate total cost including power-ups
  const totalCost = calculateDefenseCost(build);
  if (totalCost > BUDGET) {
    return { valid: false, error: `Budget exceeded: ${totalCost}/${BUDGET} points` };
  }

  return { valid: true, cost: totalCost };
}

/**
 * Validate a submission request
 */
function validateSubmission(body) {
  // Check agent_id
  if (!body.agent_id || typeof body.agent_id !== 'string') {
    return { valid: false, error: 'agent_id is required and must be a string' };
  }

  if (body.agent_id.length < 1 || body.agent_id.length > 50) {
    return { valid: false, error: 'agent_id must be 1-50 characters' };
  }

  // Check side
  if (!body.side || !['attack', 'defend'].includes(body.side)) {
    return { valid: false, error: "side must be 'attack' or 'defend'" };
  }

  // Validate build based on side
  if (body.side === 'attack') {
    return validateAttackBuild(body.build);
  } else {
    return validateDefenseBuild(body.build);
  }
}

module.exports = {
  calculateAttackCost,
  calculateDefenseCost,
  validateAttackBuild,
  validateDefenseBuild,
  validateFreeFlowTowers,
  validatePowerUps,
  validateWaveTimings,
  validateSubmission
};
