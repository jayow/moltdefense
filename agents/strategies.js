/**
 * Build generation strategies for Moltdefense test agents
 */

// Game constants
const BUDGET = 500;
const TOTAL_WAVES = 5;

const ENEMY_COSTS = {
  runner: 50,
  tank: 100,
  swarm: 75
};

const TOWER_COSTS = {
  basic: 100,
  slow: 100,
  burst: 150
};

const TOWER_SLOTS = ['A', 'B', 'C', 'D', 'E'];
const ENEMY_TYPES = ['runner', 'tank', 'swarm'];
const TOWER_TYPES = ['basic', 'slow', 'burst'];

// ============================================
// ATTACKER STRATEGIES
// ============================================

/**
 * Generate a random attack build within budget
 */
function attackRandom() {
  const waves = [];
  let remainingBudget = BUDGET;

  for (let i = 0; i < TOTAL_WAVES; i++) {
    const wave = {};
    const waveBudget = Math.floor(remainingBudget / (TOTAL_WAVES - i));
    let waveSpent = 0;

    // Randomly add enemies until budget exhausted
    while (waveSpent < waveBudget - 50) {
      const type = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
      const cost = ENEMY_COSTS[type];

      if (waveSpent + cost <= waveBudget) {
        wave[type] = (wave[type] || 0) + 1;
        waveSpent += cost;
      } else {
        break;
      }
    }

    // Ensure at least 1 enemy per wave
    if (Object.keys(wave).length === 0) {
      wave.runner = 1;
      waveSpent = 50;
    }

    waves.push(wave);
    remainingBudget -= waveSpent;
  }

  return { waves };
}

/**
 * Rush strategy - heavy on runners for fast pressure
 */
function attackRush() {
  // 500 points = 10 runners total
  return {
    waves: [
      { runner: 3 },      // 150
      { runner: 2 },      // 100
      { runner: 2 },      // 100
      { runner: 2 },      // 100
      { runner: 1 }       // 50 = 500 total
    ]
  };
}

/**
 * Tank strategy - heavy units to absorb damage
 */
function attackTank() {
  // Tanks are 100 each, max 5 with budget
  return {
    waves: [
      { runner: 1 },      // 50 - probe
      { tank: 1 },        // 100
      { tank: 1 },        // 100
      { tank: 1 },        // 100
      { tank: 1, runner: 1 } // 150 = 500 total
    ]
  };
}

/**
 * Swarm strategy - overwhelm with numbers
 */
function attackSwarm() {
  // Swarms are 75 each, spawn 5 units
  return {
    waves: [
      { runner: 1 },      // 50 - probe
      { swarm: 1 },       // 75
      { swarm: 1 },       // 75
      { swarm: 2 },       // 150
      { swarm: 2 }        // 150 = 500 total
    ]
  };
}

/**
 * Balanced strategy - mix of all unit types
 */
function attackBalanced() {
  return {
    waves: [
      { runner: 2 },           // 100
      { tank: 1 },             // 100
      { swarm: 1 },            // 75
      { runner: 1, tank: 1 },  // 150
      { swarm: 1 }             // 75 = 500 total
    ]
  };
}

/**
 * Escalation strategy - save heavy units for later
 */
function attackEscalation() {
  return {
    waves: [
      { runner: 1 },           // 50
      { runner: 2 },           // 100
      { swarm: 1 },            // 75
      { tank: 1, runner: 1 },  // 150
      { swarm: 1, runner: 1 }  // 125 = 500 total
    ]
  };
}

// ============================================
// DEFENDER STRATEGIES
// ============================================

/**
 * Generate a random defense build within budget
 */
function defendRandom() {
  const towers = {};
  let spent = 0;
  const shuffledSlots = [...TOWER_SLOTS].sort(() => Math.random() - 0.5);

  for (const slot of shuffledSlots) {
    if (spent >= BUDGET - 100) break;

    const availableTypes = TOWER_TYPES.filter(t => spent + TOWER_COSTS[t] <= BUDGET);
    if (availableTypes.length === 0) break;

    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    towers[slot] = type;
    spent += TOWER_COSTS[type];
  }

  return { towers };
}

/**
 * Slow wall - maximize slow effect
 */
function defendSlowWall() {
  // 5 slow towers = 500
  return {
    towers: {
      A: 'slow',
      B: 'slow',
      C: 'slow',
      D: 'slow',
      E: 'slow'
    }
  };
}

/**
 * Burst strategy - high damage output
 */
function defendBurst() {
  // 3 burst = 450, 1 slow = 100 = too much
  // 3 burst = 450
  return {
    towers: {
      A: 'slow',    // 100 - slow first
      B: 'burst',   // 150
      C: 'burst',   // 150
      E: 'basic'    // 100 = 500
    }
  };
}

/**
 * Balanced defense - mix of tower types
 */
function defendBalanced() {
  return {
    towers: {
      A: 'slow',    // 100
      B: 'basic',   // 100
      C: 'burst',   // 150
      D: 'basic'    // 100 = 450
    }
  };
}

/**
 * Front-heavy - stop enemies early
 */
function defendFrontHeavy() {
  return {
    towers: {
      A: 'slow',    // 100
      B: 'burst',   // 150
      C: 'basic',   // 100
      D: 'basic'    // 100 = 450
    }
  };
}

/**
 * Back-heavy - last line of defense
 */
function defendBackHeavy() {
  return {
    towers: {
      B: 'basic',   // 100
      C: 'slow',    // 100
      D: 'burst',   // 150
      E: 'burst'    // 150 = 500
    }
  };
}

/**
 * DPS focused - maximize damage output
 */
function defendDPS() {
  // Basic towers have best DPS per cost
  return {
    towers: {
      A: 'slow',    // 100 - need one slow
      B: 'basic',   // 100
      C: 'basic',   // 100
      D: 'basic',   // 100
      E: 'basic'    // 100 = 500
    }
  };
}

// ============================================
// STRATEGY REGISTRY
// ============================================

const ATTACK_STRATEGIES = {
  random: attackRandom,
  rush: attackRush,
  tank: attackTank,
  swarm: attackSwarm,
  balanced: attackBalanced,
  escalation: attackEscalation
};

const DEFEND_STRATEGIES = {
  random: defendRandom,
  'slow-wall': defendSlowWall,
  burst: defendBurst,
  balanced: defendBalanced,
  'front-heavy': defendFrontHeavy,
  'back-heavy': defendBackHeavy,
  dps: defendDPS
};

/**
 * Generate an attack build using the specified strategy
 */
function generateAttackBuild(strategy = 'balanced') {
  const strategyFn = ATTACK_STRATEGIES[strategy];
  if (!strategyFn) {
    console.error(`Unknown attack strategy: ${strategy}`);
    console.error(`Available: ${Object.keys(ATTACK_STRATEGIES).join(', ')}`);
    process.exit(1);
  }
  return strategyFn();
}

/**
 * Generate a defense build using the specified strategy
 */
function generateDefenseBuild(strategy = 'balanced') {
  const strategyFn = DEFEND_STRATEGIES[strategy];
  if (!strategyFn) {
    console.error(`Unknown defense strategy: ${strategy}`);
    console.error(`Available: ${Object.keys(DEFEND_STRATEGIES).join(', ')}`);
    process.exit(1);
  }
  return strategyFn();
}

/**
 * Calculate cost of an attack build
 */
function calculateAttackCost(build) {
  let total = 0;
  for (const wave of build.waves) {
    for (const [type, count] of Object.entries(wave)) {
      total += ENEMY_COSTS[type] * count;
    }
  }
  return total;
}

/**
 * Calculate cost of a defense build
 */
function calculateDefenseCost(build) {
  let total = 0;
  for (const [slot, type] of Object.entries(build.towers)) {
    if (type) {
      total += TOWER_COSTS[type];
    }
  }
  return total;
}

/**
 * Get a random strategy for the specified side
 */
function getRandomStrategy(side) {
  const strategies = side === 'attack' ? ATTACK_STRATEGIES : DEFEND_STRATEGIES;
  const keys = Object.keys(strategies);
  return keys[Math.floor(Math.random() * keys.length)];
}

module.exports = {
  generateAttackBuild,
  generateDefenseBuild,
  calculateAttackCost,
  calculateDefenseCost,
  getRandomStrategy,
  ATTACK_STRATEGIES: Object.keys(ATTACK_STRATEGIES),
  DEFEND_STRATEGIES: Object.keys(DEFEND_STRATEGIES)
};
