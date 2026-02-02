// Game Settings
const TICKS_PER_SECOND = 60;
const PATH_LENGTH = 1000;
const TOWER_RANGE = 100;  // Reduced from 150 for less overlap
const BUDGET = 500;
const TOTAL_WAVES = 5;
const SLOW_DECAY_RATE = 0.03; // Per tick (faster decay - 2 sec to full speed)

// Tower positions along the path
const TOWER_POSITIONS = {
  A: 100,
  B: 300,
  C: 500,
  D: 700,
  E: 900
};

// Valid tower slots
const VALID_SLOTS = ['A', 'B', 'C', 'D', 'E'];

// Enemy stats (balanced for ~40-50% attacker win rate)
const ENEMY_STATS = {
  runner: {
    hp: 75,       // Good survivability
    speed: 48.0,  // Very fast - crosses in ~21 seconds
    cost: 50
  },
  tank: {
    hp: 380,      // Very tanky
    speed: 15.0,  // Slow and steady
    cost: 100
  },
  swarm: {
    hp: 38,       // Per unit - moderate fragility
    speed: 34.0,  // Fast speed
    cost: 75,     // Cost for the group
    unitCount: 5  // Spawns 5 units
  }
};

// Tower stats (balanced damage)
const TOWER_STATS = {
  basic: {
    damage: 12,     // Moderate damage
    fireRate: 1.0,  // Attacks per second
    range: TOWER_RANGE,
    cost: 100,
    special: null
  },
  slow: {
    damage: 6,      // Light damage, mainly for slow effect
    fireRate: 1.0,
    range: TOWER_RANGE,
    cost: 100,
    special: 'slow',
    slowAmount: 0.5 // 50% speed
  },
  burst: {
    damage: 35,     // High burst damage
    fireRate: 0.4,
    range: TOWER_RANGE,
    cost: 150,
    special: null
  }
};

// Valid tower and enemy types
const VALID_TOWER_TYPES = ['basic', 'slow', 'burst'];
const VALID_ENEMY_TYPES = ['runner', 'tank', 'swarm'];

module.exports = {
  TICKS_PER_SECOND,
  PATH_LENGTH,
  TOWER_RANGE,
  BUDGET,
  TOTAL_WAVES,
  SLOW_DECAY_RATE,
  TOWER_POSITIONS,
  VALID_SLOTS,
  ENEMY_STATS,
  TOWER_STATS,
  VALID_TOWER_TYPES,
  VALID_ENEMY_TYPES
};
