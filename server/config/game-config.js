/**
 * GameConfig - Centralized game configuration
 *
 * This is the single source of truth for all game constants.
 * Agents can poll /api/rules to get the current configuration.
 *
 * Version history is tracked in changelog.js
 */

const GameConfig = {
  // Version info - update when making balance changes
  version: '0.3.0',
  lastUpdated: '2026-02-04',

  // ============================================
  // CORE GAME SETTINGS
  // ============================================
  core: {
    ticksPerSecond: 60,
    pathLength: 1000,
    defaultTowerRange: 90,
    slowDecayRate: 0.03,  // Per tick (2 sec to full speed)
  },

  // ============================================
  // BUDGET SETTINGS
  // ============================================
  budget: {
    attack: 500,
    defense: 500,
  },

  // ============================================
  // WAVE RULES
  // ============================================
  rules: {
    wavesPerMatch: 5,
    waveDelay: 180,           // 3 seconds (ticks) between waves
    minWaveDelay: 30,         // Minimum 0.5 second delay
    maxWaveDelay: 600,        // Maximum 10 second delay
    rushBonusPerTick: 0.1,    // Budget bonus per tick rushed early
    maxRushBonus: 30,         // Max bonus budget for rushing per wave
    maxPowerUpsPerMatch: 3,
    maxPowerUpsPerWave: 1,
    minTowerSpacing: 50,      // Minimum distance between towers
  },

  // ============================================
  // MAP CONFIGURATION
  // ============================================
  map: {
    id: 'default',
    name: 'Classic Lane',
    pathLength: 1000,
    canvasWidth: 800,
    canvasHeight: 200,
    lanes: ['top', 'bottom'],
    lanePositions: {
      top: 50,
      bottom: 150,
    },
    towerZones: [
      { id: 'A', x: 100, allowedLanes: ['top', 'bottom'] },
      { id: 'B', x: 300, allowedLanes: ['top', 'bottom'] },
      { id: 'C', x: 500, allowedLanes: ['top', 'bottom'] },
      { id: 'D', x: 700, allowedLanes: ['top', 'bottom'] },
      { id: 'E', x: 900, allowedLanes: ['top', 'bottom'] },
    ],
    freePlacement: {
      enabled: true,
      minX: 50,
      maxX: 950,
    },
    spawnPoint: { x: 0 },
    exitPoint: { x: 1000 },
  },

  // ============================================
  // ENEMY TYPES
  // ============================================
  enemies: {
    runner: {
      hp: 90,
      speed: 52.0,
      cost: 50,
      armor: 0,
      regen: 0,
      aura: null,
      description: 'Fast, low HP unit for early pressure',
    },
    tank: {
      hp: 320,
      speed: 18.0,
      cost: 100,
      armor: 3,
      regen: 0,
      aura: null,
      description: 'High HP, armored unit that absorbs damage',
    },
    swarm: {
      hp: 45,
      speed: 38.0,
      cost: 75,
      unitCount: 5,
      armor: 0,
      regen: 0,
      aura: null,
      description: 'Spawns 5 units, overwhelms single-target towers',
    },
    healer: {
      hp: 55,
      speed: 25.0,
      cost: 80,
      armor: 0,
      regen: 0,
      aura: 'heal',
      auraRadius: 80,
      auraAmount: 0.05,  // ~3 HP/sec to nearby allies
      description: 'Heals nearby enemies over time',
    },
    shieldBearer: {
      hp: 100,
      speed: 20.0,
      cost: 90,
      armor: 2,
      regen: 0,
      aura: 'armor',
      auraRadius: 60,
      auraAmount: 1,  // +1 armor to nearby enemies
      description: 'Provides armor buff to nearby enemies',
    },
    regenerator: {
      hp: 180,
      speed: 18.0,
      cost: 85,
      armor: 0,
      regen: 0.08,  // ~5 HP/sec
      aura: null,
      description: 'Regenerates HP over time',
    },
    boss: {
      hp: 800,
      speed: 10.0,
      cost: 200,
      armor: 6,
      regen: 0.03,  // ~2 HP/sec
      aura: 'resistance',
      auraRadius: 150,
      auraAmount: 0.15,  // 15% damage reduction
      description: 'Massive HP, armor, regen, and damage reduction aura',
    },
  },

  // ============================================
  // TOWER TYPES
  // ============================================
  towers: {
    basic: {
      damage: 14,
      fireRate: 0.9,
      range: 90,
      cost: 100,
      special: null,
      description: 'Balanced damage and fire rate',
    },
    slow: {
      damage: 8,
      fireRate: 0.9,
      range: 90,
      cost: 100,
      special: 'slow',
      slowAmount: 0.55,  // 55% speed
      description: 'Slows enemies, reducing their speed',
    },
    burst: {
      damage: 40,
      fireRate: 0.4,
      range: 90,
      cost: 150,
      special: null,
      description: 'High damage, slow fire rate',
    },
    chain: {
      damage: 14,
      fireRate: 0.8,
      range: 90,
      cost: 125,
      special: 'chain',
      chainCount: 4,
      chainDamageDecay: 0.75,  // 75% damage per jump
      description: 'Hits up to 4 targets with decaying damage',
    },
    sniper: {
      damage: 85,
      fireRate: 0.25,
      range: 200,
      cost: 175,
      special: 'armorPierce',
      armorPiercePercent: 0.7,  // Ignores 70% armor
      description: 'Long range, high damage, pierces armor',
    },
    support: {
      damage: 0,
      fireRate: 0,
      range: 150,
      cost: 80,
      special: 'buff',
      buffRadius: 100,
      damageBuffPercent: 0.25,  // +25% damage
      description: 'Buffs nearby towers with +25% damage',
    },
  },

  // ============================================
  // POWER-UPS
  // ============================================
  powerUps: {
    // Attacker power-ups
    shield: {
      cost: 40,
      duration: 120,  // 2 seconds (ticks)
      side: 'attack',
      description: 'Absorbs damage before HP',
    },
    speedBoost: {
      cost: 25,
      duration: 90,  // 1.5 seconds
      side: 'attack',
      effect: 1.5,  // 50% speed increase
      description: 'Temporarily increases movement speed by 50%',
    },
    invisibility: {
      cost: 50,
      duration: 60,  // 1 second
      side: 'attack',
      description: 'Enemies become untargetable by towers',
    },
    healPulse: {
      cost: 35,
      duration: 0,  // Instant
      side: 'attack',
      healAmount: 30,
      radius: 100,
      description: 'Instantly heals nearby enemies',
    },

    // Defender power-ups
    damageBoost: {
      cost: 30,
      duration: 120,  // 2 seconds
      side: 'defense',
      effect: 1.5,  // 50% damage increase
      description: 'All towers deal +50% damage',
    },
    freeze: {
      cost: 45,
      duration: 45,  // 0.75 seconds
      side: 'defense',
      description: 'Completely stops all enemies',
    },
    chainLightning: {
      cost: 40,
      duration: 0,  // Instant
      side: 'defense',
      damage: 25,
      jumps: 5,
      decay: 0.8,
      description: 'Damage jumps between enemies',
    },
    reinforcement: {
      cost: 35,
      duration: 180,  // 3 seconds
      side: 'defense',
      towerType: 'basic',
      position: 500,
      description: 'Spawns a temporary tower',
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get the current game configuration
 * @returns {object} Full game configuration
 */
function getConfig() {
  return GameConfig;
}

/**
 * Get configuration for a specific enemy type
 * @param {string} type - Enemy type name
 * @returns {object|null} Enemy configuration or null if not found
 */
function getEnemyConfig(type) {
  return GameConfig.enemies[type] || null;
}

/**
 * Get configuration for a specific tower type
 * @param {string} type - Tower type name
 * @returns {object|null} Tower configuration or null if not found
 */
function getTowerConfig(type) {
  return GameConfig.towers[type] || null;
}

/**
 * Get configuration for a specific power-up
 * @param {string} type - Power-up type name
 * @returns {object|null} Power-up configuration or null if not found
 */
function getPowerUpConfig(type) {
  return GameConfig.powerUps[type] || null;
}

/**
 * Get valid enemy types
 * @returns {string[]} Array of valid enemy type names
 */
function getValidEnemyTypes() {
  return Object.keys(GameConfig.enemies);
}

/**
 * Get valid tower types
 * @returns {string[]} Array of valid tower type names
 */
function getValidTowerTypes() {
  return Object.keys(GameConfig.towers);
}

/**
 * Get valid attacker power-ups
 * @returns {string[]} Array of valid attacker power-up names
 */
function getValidAttackerPowerUps() {
  return Object.entries(GameConfig.powerUps)
    .filter(([_, config]) => config.side === 'attack')
    .map(([name]) => name);
}

/**
 * Get valid defender power-ups
 * @returns {string[]} Array of valid defender power-up names
 */
function getValidDefenderPowerUps() {
  return Object.entries(GameConfig.powerUps)
    .filter(([_, config]) => config.side === 'defense')
    .map(([name]) => name);
}

/**
 * Get the API-safe version of the config (for /api/rules endpoint)
 * Removes internal properties, adds computed fields
 * @returns {object} API-safe configuration
 */
function getApiConfig() {
  return {
    version: GameConfig.version,
    lastUpdated: GameConfig.lastUpdated,
    budget: GameConfig.budget,
    rules: GameConfig.rules,
    map: {
      id: GameConfig.map.id,
      name: GameConfig.map.name,
      pathLength: GameConfig.map.pathLength,
      canvasWidth: GameConfig.map.canvasWidth,
      canvasHeight: GameConfig.map.canvasHeight,
      lanes: GameConfig.map.lanes,
      towerZones: GameConfig.map.towerZones,
      freePlacement: GameConfig.map.freePlacement,
    },
    enemies: GameConfig.enemies,
    towers: GameConfig.towers,
    powerUps: GameConfig.powerUps,
    validTypes: {
      enemies: getValidEnemyTypes(),
      towers: getValidTowerTypes(),
      attackerPowerUps: getValidAttackerPowerUps(),
      defenderPowerUps: getValidDefenderPowerUps(),
    },
  };
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  GameConfig,
  getConfig,
  getEnemyConfig,
  getTowerConfig,
  getPowerUpConfig,
  getValidEnemyTypes,
  getValidTowerTypes,
  getValidAttackerPowerUps,
  getValidDefenderPowerUps,
  getApiConfig,
};
