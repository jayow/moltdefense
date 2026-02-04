/**
 * Entity Factory - Creates game entities (enemies and towers)
 *
 * This factory uses the GameConfig to create entities with consistent stats.
 * It decouples entity creation from the simulation logic.
 */

const { getConfig, getEnemyConfig, getTowerConfig } = require('../config/game-config');

// Counter for unique enemy IDs
let enemyIdCounter = 0;

// Counter for unique tower IDs
let towerIdCounter = 0;

/**
 * Reset ID counters (call between matches)
 */
function resetCounters() {
  enemyIdCounter = 0;
  towerIdCounter = 0;
}

/**
 * Create a new enemy entity
 * @param {string} type - Enemy type (runner, tank, swarm, etc.)
 * @param {object} options - Optional overrides
 * @returns {object} Enemy entity
 */
function createEnemy(type, options = {}) {
  const config = getEnemyConfig(type);
  if (!config) {
    throw new Error(`Unknown enemy type: ${type}`);
  }

  const id = options.id || `E${enemyIdCounter++}`;

  return {
    id,
    type,

    // Stats from config
    hp: config.hp,
    maxHp: config.hp,
    speed: config.speed,
    armor: config.armor || 0,
    regen: config.regen || 0,

    // Aura properties
    aura: config.aura || null,
    auraRadius: config.auraRadius || 0,
    auraAmount: config.auraAmount || 0,

    // State
    position: options.position || 0,
    lane: options.lane || 'top',
    speedMultiplier: 1.0,
    alive: true,

    // Effect states
    shielded: false,
    shieldHp: 0,
    invisible: false,
    frozen: false,

    // Allow option overrides
    ...options,
  };
}

/**
 * Create multiple enemies for a swarm
 * @param {number} count - Number of swarm units
 * @param {string} baseId - Base ID prefix
 * @param {object} options - Optional overrides
 * @returns {object[]} Array of swarm enemy entities
 */
function createSwarm(count = 5, baseId = null, options = {}) {
  const config = getEnemyConfig('swarm');
  if (!config) {
    throw new Error('Swarm enemy type not configured');
  }

  const swarmCount = count || config.unitCount || 5;
  const enemies = [];

  for (let i = 0; i < swarmCount; i++) {
    const id = baseId ? `${baseId}_${i}` : `E${enemyIdCounter++}`;
    enemies.push({
      id,
      type: 'swarm',

      // Stats from config
      hp: config.hp,
      maxHp: config.hp,
      speed: config.speed,
      armor: config.armor || 0,
      regen: config.regen || 0,

      // No aura for swarm units
      aura: null,
      auraRadius: 0,
      auraAmount: 0,

      // State - stagger start positions
      position: options.position !== undefined ? options.position - (i * 15) : -(i * 15),
      lane: options.lane || 'top',
      speedMultiplier: 1.0,
      alive: true,

      // Effect states
      shielded: false,
      shieldHp: 0,
      invisible: false,
      frozen: false,

      // Allow option overrides
      ...options,
      id, // Ensure ID isn't overridden
    });
  }

  return enemies;
}

/**
 * Create a new tower entity
 * @param {string} type - Tower type (basic, slow, burst, etc.)
 * @param {number} position - X position on the path (0-1000)
 * @param {string} lane - Lane ('top' or 'bottom')
 * @param {object} options - Optional overrides
 * @returns {object} Tower entity
 */
function createTower(type, position, lane = 'bottom', options = {}) {
  const config = getTowerConfig(type);
  if (!config) {
    throw new Error(`Unknown tower type: ${type}`);
  }

  const id = options.id || `T${towerIdCounter++}`;

  return {
    id,
    type,
    position,
    lane,

    // Stats from config
    damage: config.damage,
    fireRate: config.fireRate,
    range: config.range,
    cost: config.cost,

    // Special properties
    special: config.special || null,
    slowAmount: config.slowAmount || null,
    chainCount: config.chainCount || null,
    chainDamageDecay: config.chainDamageDecay || null,
    armorPiercePercent: config.armorPiercePercent || null,
    buffRadius: config.buffRadius || null,
    damageBuffPercent: config.damageBuffPercent || null,

    // State
    cooldown: 0,
    enabled: true,
    temporary: options.temporary || false, // For reinforcement power-up

    // Allow option overrides
    ...options,
  };
}

/**
 * Create tower from legacy slot format (A, B, C, D, E)
 * @param {string} type - Tower type
 * @param {string} slot - Slot ID (A-E)
 * @param {string} lane - Lane ('top' or 'bottom')
 * @param {object} options - Optional overrides
 * @returns {object} Tower entity
 */
function createTowerFromSlot(type, slot, lane = 'bottom', options = {}) {
  const config = getConfig();
  const zone = config.map.towerZones.find(z => z.id === slot);

  if (!zone) {
    throw new Error(`Unknown tower slot: ${slot}`);
  }

  return createTower(type, zone.x, lane, { ...options, slot });
}

/**
 * Create towers from a defense build
 * Supports both legacy slot format and free-flow array format
 * @param {object|Array} build - Defense build (towers property or array)
 * @returns {object[]} Array of tower entities
 */
function createTowersFromBuild(build) {
  // Handle object passed with towers property
  const towers = build.towers || build;

  // Free-flow array format: [{ x, type, lane }, ...]
  if (Array.isArray(towers)) {
    return towers.map((t, index) => {
      return createTower(t.type, t.x, t.lane || 'bottom', {
        id: `T${index}`,
        slot: t.slot || null,
      });
    });
  }

  // Legacy slot format: { A: 'basic', B: 'slow', ... }
  const towerEntities = [];
  const config = getConfig();

  for (const [slot, type] of Object.entries(towers)) {
    const zone = config.map.towerZones.find(z => z.id === slot);
    if (zone && type) {
      towerEntities.push(createTower(type, zone.x, 'bottom', {
        id: `T${towerEntities.length}`,
        slot,
      }));
    }
  }

  return towerEntities;
}

/**
 * Spawn enemies for a wave
 * @param {object} waveConfig - Wave configuration { runner: 2, tank: 1, etc. }
 * @param {string} lane - Default lane for enemies
 * @returns {object[]} Array of enemy entities
 */
function spawnWave(waveConfig, lane = 'top') {
  const enemies = [];
  let spawnOffset = 0;
  const SPAWN_SPACING = 30; // Distance between spawned units

  for (const [type, count] of Object.entries(waveConfig)) {
    for (let i = 0; i < count; i++) {
      if (type === 'swarm') {
        // Swarm spawns multiple units
        const swarmEnemies = createSwarm(5, null, {
          position: -spawnOffset,
          lane,
        });
        enemies.push(...swarmEnemies);
        spawnOffset += SPAWN_SPACING * 6; // More space for swarm
      } else {
        enemies.push(createEnemy(type, {
          position: -spawnOffset,
          lane,
        }));
        spawnOffset += SPAWN_SPACING;
      }
    }
  }

  return enemies;
}

/**
 * Calculate the total cost of a wave
 * @param {object} waveConfig - Wave configuration
 * @returns {number} Total cost
 */
function calculateWaveCost(waveConfig) {
  let cost = 0;

  for (const [type, count] of Object.entries(waveConfig)) {
    const config = getEnemyConfig(type);
    if (config) {
      cost += config.cost * count;
    }
  }

  return cost;
}

/**
 * Calculate the total cost of a tower build
 * @param {object|Array} build - Tower build (slot object or array)
 * @returns {number} Total cost
 */
function calculateTowerCost(build) {
  const towers = build.towers || build;
  let cost = 0;

  if (Array.isArray(towers)) {
    for (const tower of towers) {
      const config = getTowerConfig(tower.type);
      if (config) {
        cost += config.cost;
      }
    }
  } else {
    for (const type of Object.values(towers)) {
      const config = getTowerConfig(type);
      if (config) {
        cost += config.cost;
      }
    }
  }

  return cost;
}

module.exports = {
  resetCounters,
  createEnemy,
  createSwarm,
  createTower,
  createTowerFromSlot,
  createTowersFromBuild,
  spawnWave,
  calculateWaveCost,
  calculateTowerCost,
};
