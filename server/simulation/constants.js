// ============================================
// CORE GAME SETTINGS
// ============================================
const TICKS_PER_SECOND = 60;
const PATH_LENGTH = 1000;
const TOWER_RANGE = 90;   // Default tower range (reduced for balance)
const BUDGET = 500;
const TOTAL_WAVES = 5;
const SLOW_DECAY_RATE = 0.03; // Per tick (faster decay - 2 sec to full speed)

// ============================================
// FREE-FLOW PLACEMENT SETTINGS
// ============================================
const FREE_PLACEMENT = {
  enabled: true,
  minSpacing: 50,      // Minimum distance between towers
  minX: 50,            // Left boundary
  maxX: 950,           // Right boundary
  lanes: ['top', 'bottom']
};

// Legacy tower positions (backward compatibility)
const TOWER_POSITIONS = {
  A: 100,
  B: 300,
  C: 500,
  D: 700,
  E: 900
};

const VALID_SLOTS = ['A', 'B', 'C', 'D', 'E'];

// ============================================
// WAVE TIMING SETTINGS
// ============================================
const WAVE_TIMING = {
  baseDelay: 180,           // 3 seconds (180 ticks) between waves
  rushBonusPerTick: 0.1,    // Budget bonus per tick rushed early
  maxRushBonus: 30,         // Maximum bonus budget for rushing per wave
  minWaveDelay: 30,         // Minimum 0.5 second delay
  maxWaveDelay: 600         // Maximum 10 second delay
};

// ============================================
// POWER-UP SETTINGS
// ============================================
const POWER_UP_COSTS = {
  // Attacker power-ups
  shield: 40,           // Absorbs damage before HP
  speedBoost: 25,       // Temporary speed increase
  invisibility: 50,     // Invisible to towers temporarily
  healPulse: 35,        // Heal nearby enemies

  // Defender power-ups
  damageBoost: 30,      // All towers deal +50% damage
  freeze: 45,           // Full stop all enemies
  chainLightning: 40,   // Jump damage between enemies
  reinforcement: 35     // Spawn temporary tower
};

const POWER_UP_DURATION = {
  shield: 120,          // 2 seconds
  speedBoost: 90,       // 1.5 seconds
  invisibility: 60,     // 1 second
  damageBoost: 120,     // 2 seconds
  freeze: 45,           // 0.75 seconds
  reinforcement: 180    // 3 seconds
};

const POWER_UP_EFFECTS = {
  speedBoost: 1.5,      // 50% speed increase
  damageBoost: 1.5,     // 50% damage increase
  healPulse: {
    amount: 30,
    radius: 100
  },
  chainLightning: {
    damage: 25,
    jumps: 5,
    decay: 0.8
  },
  reinforcement: {
    type: 'basic',
    position: 500       // Middle of path
  }
};

const POWER_UP_LIMITS = {
  perMatch: 3,          // Max power-ups per match per side
  perWave: 1            // Max power-ups per wave
};

const VALID_ATTACKER_POWERUPS = ['shield', 'speedBoost', 'invisibility', 'healPulse'];
const VALID_DEFENDER_POWERUPS = ['damageBoost', 'freeze', 'chainLightning', 'reinforcement'];

// ============================================
// ENEMY STATS
// ============================================
const ENEMY_STATS = {
  // Original enemies
  runner: {
    hp: 90,             // Buffed from 75 (more survivable)
    speed: 52.0,        // Slightly faster
    cost: 50,
    armor: 0,
    regen: 0,
    aura: null
  },
  tank: {
    hp: 320,            // Final balance
    speed: 18.0,        // Faster (was 15)
    cost: 100,
    armor: 3,           // Lower armor
    regen: 0,
    aura: null
  },
  swarm: {
    hp: 45,             // Buffed from 38
    speed: 38.0,        // Faster
    cost: 75,
    unitCount: 5,
    armor: 0,
    regen: 0,
    aura: null
  },

  // New enemies
  healer: {
    hp: 55,
    speed: 25.0,
    cost: 80,
    armor: 0,
    regen: 0,
    aura: 'heal',
    auraRadius: 80,
    auraAmount: 0.05    // ~3 HP/sec to nearby allies (was 120 HP/sec!)
  },
  shieldBearer: {
    hp: 100,            // Reduced from 120
    speed: 20.0,
    cost: 90,
    armor: 2,           // Reduced from 3
    regen: 0,
    aura: 'armor',
    auraRadius: 60,
    auraAmount: 1       // Reduced bonus armor (was 2)
  },
  regenerator: {
    hp: 180,            // Balanced
    speed: 18.0,
    cost: 85,
    armor: 0,
    regen: 0.08,        // ~5 HP/sec (was 180 HP/sec, now reasonable)
    aura: null
  },
  boss: {
    hp: 800,            // Reduced from 1000
    speed: 10.0,
    cost: 200,
    armor: 6,           // Reduced from 10
    regen: 0.03,        // ~2 HP/sec (was 120 HP/sec!)
    aura: 'resistance',
    auraRadius: 150,
    auraAmount: 0.15    // 15% damage reduction (was 20%)
  }
};

// ============================================
// TOWER STATS
// ============================================
const TOWER_STATS = {
  // Original towers
  basic: {
    damage: 14,         // Final balance
    fireRate: 0.9,      // Slightly slower (was 1.0)
    range: TOWER_RANGE,
    cost: 100,
    special: null
  },
  slow: {
    damage: 8,
    fireRate: 0.9,
    range: TOWER_RANGE,
    cost: 100,
    special: 'slow',
    slowAmount: 0.55    // 55% speed (moderate slow)
  },
  burst: {
    damage: 40,         // Final balance
    fireRate: 0.4,
    range: TOWER_RANGE,
    cost: 150,
    special: null
  },

  // New towers
  chain: {
    damage: 14,             // Increased from 8 (better AoE)
    fireRate: 0.8,
    range: TOWER_RANGE,
    cost: 125,
    special: 'chain',
    chainCount: 4,          // Hits up to 4 targets (was 3)
    chainDamageDecay: 0.75  // Each jump does 75% of previous (was 70%)
  },
  sniper: {
    damage: 85,             // Increased from 60 (anti-tank specialist)
    fireRate: 0.25,
    range: 200,             // Extended range
    cost: 175,
    special: 'armorPierce',
    armorPiercePercent: 0.7 // Ignores 70% armor (up from 50%)
  },
  support: {
    damage: 0,
    fireRate: 0,
    range: 150,
    cost: 80,
    special: 'buff',
    buffRadius: 100,
    damageBuffPercent: 0.25 // +25% damage to nearby towers
  }
};

// ============================================
// VALID TYPES
// ============================================
const VALID_TOWER_TYPES = ['basic', 'slow', 'burst', 'chain', 'sniper', 'support'];
const VALID_ENEMY_TYPES = ['runner', 'tank', 'swarm', 'healer', 'shieldBearer', 'regenerator', 'boss'];

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
