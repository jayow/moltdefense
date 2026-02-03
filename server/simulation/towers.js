const { TOWER_STATS, TOWER_POSITIONS, TICKS_PER_SECOND, FREE_PLACEMENT } = require('./constants');
const { damageEnemy, slowEnemy, isTargetable } = require('./enemies');

let towerIdCounter = 0;

/**
 * Create a tower instance from slot-based definition (legacy)
 */
function createTower(slot, type) {
  const stats = TOWER_STATS[type];
  if (!stats) {
    throw new Error(`Unknown tower type: ${type}`);
  }

  const position = TOWER_POSITIONS[slot];
  if (position === undefined) {
    throw new Error(`Invalid tower slot: ${slot}`);
  }

  return {
    id: slot,  // Use slot as ID for legacy
    slot,
    type,
    position,
    lane: slot <= 'C' ? 'top' : 'bottom',  // Visual lane
    damage: stats.damage,
    fireRate: stats.fireRate,
    range: stats.range,
    special: stats.special,
    slowAmount: stats.slowAmount || 1.0,
    // New tower properties
    chainCount: stats.chainCount || 0,
    chainDamageDecay: stats.chainDamageDecay || 1.0,
    armorPiercePercent: stats.armorPiercePercent || 0,
    buffRadius: stats.buffRadius || 0,
    damageBuffPercent: stats.damageBuffPercent || 0,
    cooldown: 0,
    target: null,
    buffed: false,  // Whether buffed by support tower
    damageMultiplier: 1.0  // From support tower buff
  };
}

/**
 * Create a tower from free-flow placement definition
 * @param {Object} towerDef - { x: number, type: string, lane?: string }
 * @param {number} index - Tower index for ID generation
 */
function createTowerFreeFlow(towerDef, index) {
  const stats = TOWER_STATS[towerDef.type];
  if (!stats) {
    throw new Error(`Unknown tower type: ${towerDef.type}`);
  }

  const id = `T${towerIdCounter++}`;

  return {
    id,
    slot: null,  // No slot for free-flow
    type: towerDef.type,
    position: towerDef.x,
    lane: towerDef.lane || 'top',
    damage: stats.damage,
    fireRate: stats.fireRate,
    range: stats.range,
    special: stats.special,
    slowAmount: stats.slowAmount || 1.0,
    chainCount: stats.chainCount || 0,
    chainDamageDecay: stats.chainDamageDecay || 1.0,
    armorPiercePercent: stats.armorPiercePercent || 0,
    buffRadius: stats.buffRadius || 0,
    damageBuffPercent: stats.damageBuffPercent || 0,
    cooldown: 0,
    target: null,
    buffed: false,
    damageMultiplier: 1.0
  };
}

/**
 * Initialize all towers from a defense build (legacy slot-based)
 * Build format: { towers: { A: 'basic', B: 'slow', ... } }
 */
function initializeTowers(defendBuild) {
  const towers = [];

  if (!defendBuild || !defendBuild.towers) {
    return towers;
  }

  for (const [slot, type] of Object.entries(defendBuild.towers)) {
    if (type) {
      towers.push(createTower(slot, type));
    }
  }

  towers.sort((a, b) => a.position - b.position);
  return towers;
}

/**
 * Initialize towers with support for both legacy and free-flow formats
 * Legacy: { towers: { A: 'basic', B: 'slow' } }
 * Free-flow: { towers: [{ x: 100, type: 'basic' }, { x: 300, type: 'slow' }] }
 */
function initializeTowersV2(defendBuild) {
  towerIdCounter = 0;  // Reset counter for new match
  const towers = [];

  if (!defendBuild || !defendBuild.towers) {
    return towers;
  }

  // Check if it's the new array format
  if (Array.isArray(defendBuild.towers)) {
    for (let i = 0; i < defendBuild.towers.length; i++) {
      towers.push(createTowerFreeFlow(defendBuild.towers[i], i));
    }
  } else {
    // Legacy object format
    return initializeTowers(defendBuild);
  }

  towers.sort((a, b) => a.position - b.position);
  return towers;
}

/**
 * Calculate buffs from support towers
 * Returns a map of tower ID -> { damageMultiplier: number }
 */
function calculateTowerBuffs(towers) {
  const buffs = {};

  // Initialize all towers with base multiplier
  for (const tower of towers) {
    buffs[tower.id] = { damageMultiplier: 1.0 };
  }

  // Apply support tower buffs
  for (const tower of towers) {
    if (tower.special === 'buff' && tower.buffRadius > 0) {
      for (const other of towers) {
        if (other.id === tower.id) continue;
        if (other.special === 'buff') continue;  // Support doesn't buff support

        const distance = Math.abs(other.position - tower.position);
        if (distance <= tower.buffRadius) {
          buffs[other.id].damageMultiplier += tower.damageBuffPercent;
          other.buffed = true;
        }
      }
    }
  }

  return buffs;
}

/**
 * Find the best target for a tower (with invisibility check)
 * Targets the enemy furthest along the path that is in range and targetable
 */
function findTarget(tower, enemies, currentTick = 0) {
  const inRange = enemies
    .filter(e => isTargetable(e, currentTick))
    .filter(e => {
      const distance = Math.abs(e.position - tower.position);
      return distance <= tower.range;
    })
    .sort((a, b) => b.position - a.position);

  return inRange[0] || null;
}

/**
 * Find a chain target (different from current, in range)
 */
function findChainTarget(tower, enemies, excludeIds, fromPosition, currentTick = 0) {
  const inRange = enemies
    .filter(e => isTargetable(e, currentTick))
    .filter(e => !excludeIds.has(e.id))
    .filter(e => {
      const distance = Math.abs(e.position - fromPosition);
      return distance <= tower.range;
    })
    .sort((a, b) => {
      // Prefer closest to last target for chain effect
      const distA = Math.abs(a.position - fromPosition);
      const distB = Math.abs(b.position - fromPosition);
      return distA - distB;
    });

  return inRange[0] || null;
}

/**
 * Process a chain tower's attack
 */
function processChainTower(tower, enemies, tick, damageMultiplier = 1.0) {
  const events = [];

  const target = findTarget(tower, enemies, tick);
  if (!target) {
    tower.target = null;
    return events;
  }

  tower.target = target.id;
  let currentTarget = target;
  let currentDamage = tower.damage * damageMultiplier;
  const hitTargets = new Set([target.id]);

  // Hit initial target and chain to others
  for (let i = 0; i <= tower.chainCount; i++) {
    const killed = damageEnemy(currentTarget, currentDamage, tower.armorPiercePercent);

    events.push({
      tick,
      type: 'damage',
      tower: tower.id || tower.slot,
      enemy: currentTarget.id,
      amount: Math.round(currentDamage),
      chain: i > 0
    });

    if (killed) {
      events.push({
        tick,
        type: 'kill',
        tower: tower.id || tower.slot,
        enemy: currentTarget.id
      });
    }

    // Find next chain target
    if (i < tower.chainCount) {
      currentDamage *= tower.chainDamageDecay;
      const nextTarget = findChainTarget(tower, enemies, hitTargets, currentTarget.position, tick);
      if (!nextTarget) break;
      hitTargets.add(nextTarget.id);
      currentTarget = nextTarget;
    }
  }

  tower.cooldown = 1 / tower.fireRate;
  return events;
}

/**
 * Process a tower's attack for one tick
 * @param {Object} tower - The tower
 * @param {Array} enemies - All enemies
 * @param {number} tick - Current tick
 * @param {Object} buff - Buff info from support towers { damageMultiplier }
 */
function processTower(tower, enemies, tick, buff = { damageMultiplier: 1.0 }) {
  const events = [];

  // Support towers don't attack
  if (tower.special === 'buff') {
    tower.target = null;
    return events;
  }

  // Reduce cooldown
  if (tower.cooldown > 0) {
    tower.cooldown -= 1 / TICKS_PER_SECOND;
    if (tower.cooldown < 0) tower.cooldown = 0;
    return events;
  }

  // Store buff state for rendering
  tower.damageMultiplier = buff.damageMultiplier;
  tower.buffed = buff.damageMultiplier > 1.0;

  // Handle chain tower specially
  if (tower.special === 'chain') {
    return processChainTower(tower, enemies, tick, buff.damageMultiplier);
  }

  // Find target (with invisibility check)
  const target = findTarget(tower, enemies, tick);
  if (!target) {
    tower.target = null;
    return events;
  }

  tower.target = target.id;

  // Calculate damage with buff
  const damage = tower.damage * buff.damageMultiplier;

  // Deal damage (with armor pierce for sniper)
  const killed = damageEnemy(target, damage, tower.armorPiercePercent);

  events.push({
    tick,
    type: 'damage',
    tower: tower.id || tower.slot,
    enemy: target.id,
    amount: Math.round(damage)
  });

  // Apply slow effect
  if (tower.special === 'slow') {
    slowEnemy(target, tower.slowAmount);
  }

  // Record kill event
  if (killed) {
    events.push({
      tick,
      type: 'kill',
      tower: tower.id || tower.slot,
      enemy: target.id
    });
  }

  // Reset cooldown
  tower.cooldown = 1 / tower.fireRate;

  return events;
}

/**
 * Get tower state for API response
 */
function getTowerState(tower) {
  return {
    id: tower.id || tower.slot,
    slot: tower.slot,
    type: tower.type,
    position: tower.position,
    lane: tower.lane,
    target: tower.target,
    cooldown: Math.round(tower.cooldown * 100) / 100,
    buffed: tower.buffed,
    range: tower.range
  };
}

/**
 * Reset tower ID counter (for new matches)
 */
function resetTowerCounter() {
  towerIdCounter = 0;
}

module.exports = {
  createTower,
  createTowerFreeFlow,
  initializeTowers,
  initializeTowersV2,
  calculateTowerBuffs,
  findTarget,
  findChainTarget,
  processTower,
  processChainTower,
  getTowerState,
  resetTowerCounter
};
