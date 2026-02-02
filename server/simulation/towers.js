const { TOWER_STATS, TOWER_POSITIONS, TICKS_PER_SECOND } = require('./constants');
const { damageEnemy, slowEnemy } = require('./enemies');

/**
 * Create a tower instance
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
    slot,
    type,
    position,
    damage: stats.damage,
    fireRate: stats.fireRate,
    range: stats.range,
    special: stats.special,
    slowAmount: stats.slowAmount || 1.0,
    cooldown: 0,
    target: null
  };
}

/**
 * Initialize all towers from a defense build
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

  // Sort by position for consistent processing
  towers.sort((a, b) => a.position - b.position);

  return towers;
}

/**
 * Find the best target for a tower
 * Targets the enemy furthest along the path that is in range
 */
function findTarget(tower, enemies) {
  const inRange = enemies
    .filter(e => e.alive && !e.leaked)
    .filter(e => {
      const distance = Math.abs(e.position - tower.position);
      return distance <= tower.range;
    })
    .sort((a, b) => b.position - a.position); // Furthest first

  return inRange[0] || null;
}

/**
 * Process a tower's attack for one tick
 * Returns an event if something happened (damage or kill)
 */
function processTower(tower, enemies, tick) {
  const events = [];

  // Reduce cooldown
  if (tower.cooldown > 0) {
    tower.cooldown -= 1 / TICKS_PER_SECOND;
    if (tower.cooldown < 0) tower.cooldown = 0;
    return events;
  }

  // Find target
  const target = findTarget(tower, enemies);
  if (!target) {
    tower.target = null;
    return events;
  }

  tower.target = target.id;

  // Deal damage
  const killed = damageEnemy(target, tower.damage);

  events.push({
    tick,
    type: 'damage',
    tower: tower.slot,
    enemy: target.id,
    amount: tower.damage
  });

  // Apply slow effect if tower has it
  if (tower.special === 'slow') {
    slowEnemy(target, tower.slowAmount);
  }

  // Record kill event
  if (killed) {
    events.push({
      tick,
      type: 'kill',
      tower: tower.slot,
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
    slot: tower.slot,
    type: tower.type,
    target: tower.target,
    cooldown: Math.round(tower.cooldown * 100) / 100
  };
}

module.exports = {
  createTower,
  initializeTowers,
  findTarget,
  processTower,
  getTowerState
};
