const {
  BUDGET,
  TOTAL_WAVES,
  VALID_SLOTS,
  VALID_TOWER_TYPES,
  VALID_ENEMY_TYPES,
  ENEMY_STATS,
  TOWER_STATS
} = require('../simulation/constants');

/**
 * Calculate total cost of an attack build
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

  return total;
}

/**
 * Calculate total cost of a defense build
 */
function calculateDefenseCost(build) {
  if (!build || !build.towers) return 0;

  let total = 0;

  for (const [slot, type] of Object.entries(build.towers)) {
    const stats = TOWER_STATS[type];
    if (stats) {
      total += stats.cost;
    }
  }

  return total;
}

/**
 * Validate an attack build
 * Returns { valid: true } or { valid: false, error: 'message' }
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

  // Check budget
  const totalCost = calculateAttackCost(build);
  if (totalCost > BUDGET) {
    return { valid: false, error: `Budget exceeded: ${totalCost}/${BUDGET} points` };
  }

  return { valid: true, cost: totalCost };
}

/**
 * Validate a defense build
 * Returns { valid: true } or { valid: false, error: 'message' }
 */
function validateDefenseBuild(build) {
  // Check build exists
  if (!build || typeof build !== 'object') {
    return { valid: false, error: 'Build is required' };
  }

  // Check towers object
  if (!build.towers || typeof build.towers !== 'object') {
    return { valid: false, error: 'Build must have a towers object' };
  }

  // Check at least one tower
  const towerEntries = Object.entries(build.towers).filter(([, type]) => type);
  if (towerEntries.length === 0) {
    return { valid: false, error: 'Must place at least one tower' };
  }

  // Validate each tower
  for (const [slot, type] of Object.entries(build.towers)) {
    // Skip empty slots
    if (!type) continue;

    // Check slot is valid
    if (!VALID_SLOTS.includes(slot)) {
      return { valid: false, error: `Invalid tower slot '${slot}'. Valid slots: ${VALID_SLOTS.join(', ')}` };
    }

    // Check tower type is valid
    if (!VALID_TOWER_TYPES.includes(type)) {
      return { valid: false, error: `Invalid tower type '${type}' at slot ${slot}. Valid types: ${VALID_TOWER_TYPES.join(', ')}` };
    }
  }

  // Check budget
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
  validateSubmission
};
