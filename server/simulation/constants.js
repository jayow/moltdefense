/**
 * Constants - Game configuration values
 *
 * IMPORTANT: This file now imports from GameConfig for centralized configuration.
 * All values are derived from /server/config/game-config.js
 *
 * This file is maintained for backward compatibility with existing code.
 * New code should import directly from game-config.js when possible.
 */

const { getConfig } = require('../config/game-config');

// Get configuration
const _config = getConfig();

// ============================================
// CORE GAME SETTINGS (from GameConfig)
// ============================================
const TICKS_PER_SECOND = _config.core.ticksPerSecond;
const PATH_LENGTH = _config.core.pathLength;
const TOWER_RANGE = _config.core.defaultTowerRange;
const BUDGET = _config.budget.attack; // Both sides have same budget
const TOTAL_WAVES = _config.rules.wavesPerMatch;
const SLOW_DECAY_RATE = _config.core.slowDecayRate;

// ============================================
// FREE-FLOW PLACEMENT SETTINGS (from GameConfig)
// ============================================
const FREE_PLACEMENT = {
  enabled: _config.map.freePlacement.enabled,
  minSpacing: _config.rules.minTowerSpacing,
  minX: _config.map.freePlacement.minX,
  maxX: _config.map.freePlacement.maxX,
  lanes: _config.map.lanes
};

// Legacy tower positions (from GameConfig map.towerZones)
const TOWER_POSITIONS = {};
_config.map.towerZones.forEach(zone => {
  TOWER_POSITIONS[zone.id] = zone.x;
});

const VALID_SLOTS = _config.map.towerZones.map(zone => zone.id);

// ============================================
// WAVE TIMING SETTINGS (from GameConfig)
// ============================================
const WAVE_TIMING = {
  baseDelay: _config.rules.waveDelay,
  rushBonusPerTick: _config.rules.rushBonusPerTick,
  maxRushBonus: _config.rules.maxRushBonus,
  minWaveDelay: _config.rules.minWaveDelay,
  maxWaveDelay: _config.rules.maxWaveDelay
};

// ============================================
// POWER-UP SETTINGS (from GameConfig)
// ============================================
const POWER_UP_COSTS = {};
const POWER_UP_DURATION = {};
const POWER_UP_EFFECTS = {};

// Build power-up constants from GameConfig
Object.entries(_config.powerUps).forEach(([name, config]) => {
  POWER_UP_COSTS[name] = config.cost;
  POWER_UP_DURATION[name] = config.duration;

  // Effect-specific properties
  if (config.effect) {
    POWER_UP_EFFECTS[name] = config.effect;
  } else if (name === 'healPulse') {
    POWER_UP_EFFECTS[name] = { amount: config.healAmount, radius: config.radius };
  } else if (name === 'chainLightning') {
    POWER_UP_EFFECTS[name] = { damage: config.damage, jumps: config.jumps, decay: config.decay };
  } else if (name === 'reinforcement') {
    POWER_UP_EFFECTS[name] = { type: config.towerType, position: config.position };
  }
});

const POWER_UP_LIMITS = {
  perMatch: _config.rules.maxPowerUpsPerMatch,
  perWave: _config.rules.maxPowerUpsPerWave
};

const VALID_ATTACKER_POWERUPS = Object.entries(_config.powerUps)
  .filter(([_, c]) => c.side === 'attack')
  .map(([name]) => name);

const VALID_DEFENDER_POWERUPS = Object.entries(_config.powerUps)
  .filter(([_, c]) => c.side === 'defense')
  .map(([name]) => name);

// ============================================
// ENEMY STATS (from GameConfig)
// ============================================
const ENEMY_STATS = {};

// Build enemy stats from GameConfig (removing description field)
Object.entries(_config.enemies).forEach(([name, config]) => {
  ENEMY_STATS[name] = {
    hp: config.hp,
    speed: config.speed,
    cost: config.cost,
    armor: config.armor || 0,
    regen: config.regen || 0,
    aura: config.aura || null,
    ...(config.auraRadius && { auraRadius: config.auraRadius }),
    ...(config.auraAmount && { auraAmount: config.auraAmount }),
    ...(config.unitCount && { unitCount: config.unitCount })
  };
});

// ============================================
// TOWER STATS (from GameConfig)
// ============================================
const TOWER_STATS = {};

// Build tower stats from GameConfig (removing description field)
Object.entries(_config.towers).forEach(([name, config]) => {
  TOWER_STATS[name] = {
    damage: config.damage,
    fireRate: config.fireRate,
    range: config.range,
    cost: config.cost,
    special: config.special || null,
    ...(config.slowAmount && { slowAmount: config.slowAmount }),
    ...(config.chainCount && { chainCount: config.chainCount }),
    ...(config.chainDamageDecay && { chainDamageDecay: config.chainDamageDecay }),
    ...(config.armorPiercePercent && { armorPiercePercent: config.armorPiercePercent }),
    ...(config.buffRadius && { buffRadius: config.buffRadius }),
    ...(config.damageBuffPercent && { damageBuffPercent: config.damageBuffPercent })
  };
});

// ============================================
// VALID TYPES (from GameConfig)
// ============================================
const VALID_TOWER_TYPES = Object.keys(_config.towers);
const VALID_ENEMY_TYPES = Object.keys(_config.enemies);

// ============================================
// EXPORTS
// ============================================
module.exports = {
  // Core settings
  TICKS_PER_SECOND,
  PATH_LENGTH,
  TOWER_RANGE,
  BUDGET,
  TOTAL_WAVES,
  SLOW_DECAY_RATE,

  // Free-flow placement
  FREE_PLACEMENT,
  TOWER_POSITIONS,
  VALID_SLOTS,

  // Wave timing
  WAVE_TIMING,

  // Power-ups
  POWER_UP_COSTS,
  POWER_UP_DURATION,
  POWER_UP_EFFECTS,
  POWER_UP_LIMITS,
  VALID_ATTACKER_POWERUPS,
  VALID_DEFENDER_POWERUPS,

  // Stats
  ENEMY_STATS,
  TOWER_STATS,

  // Valid types
  VALID_TOWER_TYPES,
  VALID_ENEMY_TYPES
};
