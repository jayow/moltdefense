/**
 * Build generation strategies for Moltdefense test agents
 * Updated for Phase 17: Game Expansion
 */

// Game constants
const BUDGET = 500;
const TOTAL_WAVES = 5;

// Original enemy costs (still supported)
const ENEMY_COSTS = {
  runner: 50,
  tank: 100,
  swarm: 75,
  // New enemy types
  healer: 80,
  shieldBearer: 90,
  regenerator: 85,
  boss: 200
};

// Original tower costs (still supported)
const TOWER_COSTS = {
  basic: 100,
  slow: 100,
  burst: 150,
  // New tower types
  chain: 125,
  sniper: 175,
  support: 80
};

// Power-up costs
const POWER_UP_COSTS = {
  // Attacker power-ups
  shield: 40,
  speedBoost: 25,
  invisibility: 50,
  healPulse: 35,
  // Defender power-ups
  damageBoost: 30,
  freeze: 45,
  chainLightning: 40,
  reinforcement: 35
};

const TOWER_SLOTS = ['A', 'B', 'C', 'D', 'E'];
const ENEMY_TYPES = ['runner', 'tank', 'swarm', 'healer', 'shieldBearer', 'regenerator', 'boss'];
const TOWER_TYPES = ['basic', 'slow', 'burst', 'chain', 'sniper', 'support'];

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

/**
 * Healer strategy - sustain damage with healing
 */
function attackHealer() {
  return {
    waves: [
      { runner: 2 },              // 100
      { healer: 1, runner: 1 },   // 130
      { tank: 1 },                // 100
      { healer: 1, runner: 1 },   // 130
      { runner: 1 }               // 40 = 500 total (need to adjust)
    ]
  };
}

/**
 * Armor strategy - use shieldBearers to buff allies
 */
function attackArmor() {
  return {
    waves: [
      { runner: 2 },                   // 100
      { shieldBearer: 1 },             // 90
      { tank: 1 },                     // 100
      { shieldBearer: 1, runner: 1 },  // 140
      { runner: 1 }                    // 50 = 480 total
    ]
  };
}

/**
 * Regenerator strategy - outlast tower damage
 */
function attackRegen() {
  return {
    waves: [
      { runner: 2 },        // 100
      { regenerator: 1 },   // 85
      { tank: 1 },          // 100
      { regenerator: 1 },   // 85
      { regenerator: 1 }    // 85 = 455 total
    ]
  };
}

/**
 * Boss rush - save for final wave boss
 */
function attackBoss() {
  return {
    waves: [
      { runner: 1 },    // 50
      { runner: 2 },    // 100
      { swarm: 1 },     // 75
      { runner: 1 },    // 50
      { boss: 1 }       // 200 = 475 total
    ],
    powerUps: [
      { type: 'shield', wave: 5 }  // 40 more = 515 over budget, remove
    ]
  };
}

/**
 * Rush timing strategy - use wave timing to overwhelm
 */
function attackRushTiming() {
  return {
    waves: [
      { runner: 2 },    // 100
      { runner: 2 },    // 100
      { swarm: 1 },     // 75
      { tank: 1 },      // 100
      { runner: 2 }     // 100 = 475 total
    ],
    waveTimings: [
      { rush: false },  // Wave 1: normal
      { rush: true },   // Wave 2: rush immediately
      { rush: true },   // Wave 3: rush immediately
      { rush: false },  // Wave 4: normal
      { rush: true }    // Wave 5: final rush
    ]
  };
}

/**
 * Power-up attack strategy - use shields and speed boosts
 */
function attackPowerUp() {
  return {
    waves: [
      { runner: 2 },    // 100
      { tank: 1 },      // 100
      { runner: 2 },    // 100
      { tank: 1 },      // 100
      { runner: 1 }     // 50 = 450 total
    ],
    powerUps: [
      { type: 'shield', wave: 2 },      // 40 = 490
    ]
  };
}

// ============================================
// DEFENDER STRATEGIES
// ============================================

/**
 * Generate a random defense build within budget using free-flow placement
 */
function defendRandom() {
  const towers = [];
  let spent = 0;
  const minSpacing = 50;
  const minX = 50;
  const maxX = 950;
  const lanes = ['top', 'bottom'];

  // Generate random positions ensuring minimum spacing
  const usedPositions = [];
  const maxTowers = 5;

  for (let i = 0; i < maxTowers && spent < BUDGET - 80; i++) {
    // Find a valid position with minimum spacing
    let attempts = 0;
    let x = null;

    while (attempts < 20) {
      const candidateX = minX + Math.floor(Math.random() * (maxX - minX));
      const tooClose = usedPositions.some(pos => Math.abs(pos - candidateX) < minSpacing);

      if (!tooClose) {
        x = candidateX;
        break;
      }
      attempts++;
    }

    if (x === null) break; // Couldn't find valid position

    // Pick a random tower type within budget
    const availableTypes = TOWER_TYPES.filter(t => spent + TOWER_COSTS[t] <= BUDGET);
    if (availableTypes.length === 0) break;

    const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];

    towers.push({ x, type, lane });
    usedPositions.push(x);
    spent += TOWER_COSTS[type];
  }

  // Sort by x position for cleaner output
  towers.sort((a, b) => a.x - b.x);

  return { towers };
}

/**
 * Slow wall - maximize slow effect with varied positions
 */
function defendSlowWall() {
  // 5 slow towers = 500, spread across map with some variation
  const basePositions = [100, 280, 460, 640, 820];
  const variation = () => Math.floor(Math.random() * 60) - 30; // ±30 variation

  return {
    towers: [
      { x: basePositions[0] + variation(), type: 'slow', lane: 'top' },
      { x: basePositions[1] + variation(), type: 'slow', lane: 'bottom' },
      { x: basePositions[2] + variation(), type: 'slow', lane: 'top' },
      { x: basePositions[3] + variation(), type: 'slow', lane: 'bottom' },
      { x: basePositions[4] + variation(), type: 'slow', lane: 'top' }
    ]
  };
}

/**
 * Burst strategy - high damage output with varied positions
 */
function defendBurst() {
  const variation = () => Math.floor(Math.random() * 50) - 25;

  return {
    towers: [
      { x: 120 + variation(), type: 'slow', lane: 'top' },     // 100 - slow first
      { x: 320 + variation(), type: 'burst', lane: 'bottom' }, // 150
      { x: 520 + variation(), type: 'burst', lane: 'top' },    // 150
      { x: 750 + variation(), type: 'basic', lane: 'bottom' }  // 100 = 500
    ]
  };
}

/**
 * Balanced defense - mix of tower types with varied positions
 */
function defendBalanced() {
  const variation = () => Math.floor(Math.random() * 60) - 30;

  return {
    towers: [
      { x: 100 + variation(), type: 'slow', lane: 'top' },     // 100
      { x: 300 + variation(), type: 'basic', lane: 'bottom' }, // 100
      { x: 500 + variation(), type: 'burst', lane: 'top' },    // 150
      { x: 700 + variation(), type: 'basic', lane: 'bottom' }  // 100 = 450
    ]
  };
}

/**
 * Front-heavy - stop enemies early with varied positions
 */
function defendFrontHeavy() {
  const variation = () => Math.floor(Math.random() * 40) - 20;

  return {
    towers: [
      { x: 80 + variation(), type: 'slow', lane: 'top' },      // 100
      { x: 200 + variation(), type: 'burst', lane: 'bottom' }, // 150
      { x: 350 + variation(), type: 'basic', lane: 'top' },    // 100
      { x: 500 + variation(), type: 'basic', lane: 'bottom' }  // 100 = 450
    ]
  };
}

/**
 * Back-heavy - last line of defense with varied positions
 */
function defendBackHeavy() {
  const variation = () => Math.floor(Math.random() * 40) - 20;

  return {
    towers: [
      { x: 400 + variation(), type: 'basic', lane: 'top' },    // 100
      { x: 550 + variation(), type: 'slow', lane: 'bottom' },  // 100
      { x: 700 + variation(), type: 'burst', lane: 'top' },    // 150
      { x: 850 + variation(), type: 'burst', lane: 'bottom' }  // 150 = 500
    ]
  };
}

/**
 * DPS focused - maximize damage output with varied positions
 */
function defendDPS() {
  const variation = () => Math.floor(Math.random() * 50) - 25;

  return {
    towers: [
      { x: 100 + variation(), type: 'slow', lane: 'top' },     // 100 - need one slow
      { x: 280 + variation(), type: 'basic', lane: 'bottom' }, // 100
      { x: 460 + variation(), type: 'basic', lane: 'top' },    // 100
      { x: 640 + variation(), type: 'basic', lane: 'bottom' }, // 100
      { x: 820 + variation(), type: 'basic', lane: 'top' }     // 100 = 500
    ]
  };
}

// ============================================
// NEW FREE-FLOW PLACEMENT STRATEGIES
// ============================================

/**
 * Chain defense - use chain towers for multi-target
 */
function defendChain() {
  return {
    towers: [
      { x: 150, type: 'slow', lane: 'top' },     // 100
      { x: 300, type: 'chain', lane: 'bottom' }, // 125
      { x: 500, type: 'chain', lane: 'top' },    // 125
      { x: 700, type: 'basic', lane: 'bottom' }  // 100 = 450
    ]
  };
}

/**
 * Sniper defense - long range armor piercing
 */
function defendSniper() {
  return {
    towers: [
      { x: 200, type: 'slow', lane: 'top' },     // 100
      { x: 400, type: 'sniper', lane: 'bottom' }, // 175
      { x: 600, type: 'sniper', lane: 'top' }    // 175 = 450
    ]
  };
}

/**
 * Support cluster - buff nearby towers
 */
function defendSupport() {
  return {
    towers: [
      { x: 100, type: 'slow', lane: 'top' },      // 100
      { x: 200, type: 'support', lane: 'bottom' }, // 80
      { x: 280, type: 'burst', lane: 'top' },     // 150
      { x: 500, type: 'basic', lane: 'bottom' },  // 100 = 430
    ]
  };
}

/**
 * Flex defense - mix of new tower types with free placement
 */
function defendFlex() {
  return {
    towers: [
      { x: 100, type: 'slow', lane: 'top' },      // 100
      { x: 250, type: 'support', lane: 'bottom' }, // 80
      { x: 400, type: 'chain', lane: 'top' },     // 125
      { x: 600, type: 'basic', lane: 'bottom' },  // 100 = 405
    ]
  };
}

/**
 * Power-up defense - use freeze and damage boost
 */
function defendPowerUp() {
  return {
    towers: [
      { x: 150, type: 'slow', lane: 'top' },     // 100
      { x: 300, type: 'basic', lane: 'bottom' }, // 100
      { x: 500, type: 'burst', lane: 'top' },    // 150
      { x: 700, type: 'basic', lane: 'bottom' }  // 100 = 450
    ],
    powerUps: [
      { type: 'freeze', wave: 5 }  // 45 = 495 total
    ]
  };
}

/**
 * Dense cluster - towers close together for overlapping fire
 */
function defendDense() {
  return {
    towers: [
      { x: 400, type: 'slow', lane: 'top' },      // 100
      { x: 450, type: 'support', lane: 'bottom' }, // 80
      { x: 500, type: 'burst', lane: 'top' },     // 150
      { x: 550, type: 'basic', lane: 'bottom' },  // 100 = 430
    ]
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
  escalation: attackEscalation,
  // New strategies
  healer: attackHealer,
  armor: attackArmor,
  regen: attackRegen,
  boss: attackBoss,
  'rush-timing': attackRushTiming,
  'power-up': attackPowerUp
};

const DEFEND_STRATEGIES = {
  random: defendRandom,
  'slow-wall': defendSlowWall,
  burst: defendBurst,
  balanced: defendBalanced,
  'front-heavy': defendFrontHeavy,
  'back-heavy': defendBackHeavy,
  dps: defendDPS,
  // New strategies (free-flow)
  chain: defendChain,
  sniper: defendSniper,
  support: defendSupport,
  flex: defendFlex,
  'power-up': defendPowerUp,
  dense: defendDense
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
 * Calculate cost of an attack build (includes power-ups)
 */
function calculateAttackCost(build) {
  let total = 0;

  // Enemy costs
  for (const wave of build.waves) {
    for (const [type, count] of Object.entries(wave)) {
      total += ENEMY_COSTS[type] * count;
    }
  }

  // Power-up costs
  if (build.powerUps) {
    for (const powerUp of build.powerUps) {
      total += POWER_UP_COSTS[powerUp.type] || 0;
    }
  }

  return total;
}

/**
 * Calculate cost of a defense build (includes power-ups, supports free-flow)
 */
function calculateDefenseCost(build) {
  let total = 0;

  // Support both array (free-flow) and object (legacy slot) formats
  if (Array.isArray(build.towers)) {
    for (const tower of build.towers) {
      total += TOWER_COSTS[tower.type] || 0;
    }
  } else {
    for (const [slot, type] of Object.entries(build.towers)) {
      if (type) {
        total += TOWER_COSTS[type];
      }
    }
  }

  // Power-up costs
  if (build.powerUps) {
    for (const powerUp of build.powerUps) {
      total += POWER_UP_COSTS[powerUp.type] || 0;
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

// ============================================
// ADAPTIVE STRATEGIES (based on match history)
// ============================================

/**
 * Fetch match history from server
 */
async function fetchHistory(serverUrl = 'http://localhost:3000') {
  try {
    const response = await fetch(`${serverUrl}/history/stats`);
    return await response.json();
  } catch (error) {
    console.log('Could not fetch history, using random strategy');
    return null;
  }
}

/**
 * Map pattern names to actual strategy names
 */
const PATTERN_TO_STRATEGY = {
  // Attacker patterns -> strategy names
  'tankHeavy': 'tank',
  'swarmHeavy': 'swarm',
  'runnerHeavy': 'rush',
  'balanced': 'balanced',
  // Defender patterns -> strategy names
  'slowHeavy': 'slow-wall',
  'burstHeavy': 'burst',
  'basicHeavy': 'dps'
};

/**
 * Get adaptive attack strategy based on match history
 * Priority: 1) Use what's actually winning 2) Avoid what's losing 3) Explore new strategies
 */
async function getAdaptiveAttackStrategy(serverUrl = 'http://localhost:3000') {
  const stats = await fetchHistory(serverUrl);

  if (!stats || stats.totalMatches === 0) {
    console.log('No history - using balanced strategy');
    return 'balanced';
  }

  console.log(`\n=== ADAPTIVE ATTACKER (${stats.totalMatches} matches) ===`);
  console.log(`Attacker win rate: ${stats.attackerWinRate}%`);

  const attackPatterns = stats.patterns?.attacker || {};

  // Step 1: Find the BEST performing attack strategy (highest win rate with >= 1 game)
  let bestStrategy = null;
  let bestWinRate = -1;
  let worstStrategy = null;
  let worstWinRate = 101;

  for (const [pattern, data] of Object.entries(attackPatterns)) {
    if (data.total > 0) {
      console.log(`  ${pattern}: ${data.wins}/${data.total} (${data.winRate}%)`);
      if (data.winRate > bestWinRate) {
        bestWinRate = data.winRate;
        bestStrategy = pattern;
      }
      if (data.winRate < worstWinRate) {
        worstWinRate = data.winRate;
        worstStrategy = pattern;
      }
    }
  }

  // Step 2: If we have a winning strategy, USE IT
  if (bestStrategy && bestWinRate > 0) {
    const strategyName = PATTERN_TO_STRATEGY[bestStrategy] || 'balanced';
    console.log(`>>> Best strategy: ${bestStrategy} (${bestWinRate}%) -> using "${strategyName}"`);
    return strategyName;
  }

  // Step 3: If everything is losing, try something we haven't tried much
  const triedPatterns = Object.keys(attackPatterns).filter(p => attackPatterns[p].total > 0);
  const allPatterns = ['tankHeavy', 'swarmHeavy', 'runnerHeavy', 'balanced'];
  const untriedPatterns = allPatterns.filter(p => !triedPatterns.includes(p) || attackPatterns[p]?.total < 2);

  if (untriedPatterns.length > 0) {
    const tryPattern = untriedPatterns[Math.floor(Math.random() * untriedPatterns.length)];
    const strategyName = PATTERN_TO_STRATEGY[tryPattern] || 'tank';
    console.log(`>>> Exploring untried: ${tryPattern} -> using "${strategyName}"`);
    return strategyName;
  }

  // Step 4: Default to tank (high HP tends to break through)
  console.log(`>>> Defaulting to tank strategy`);
  return 'tank';
}

/**
 * Get adaptive defense strategy based on match history
 * Priority: 1) Use what's actually winning 2) Counter what attackers are using 3) Explore
 */
async function getAdaptiveDefenseStrategy(serverUrl = 'http://localhost:3000') {
  const stats = await fetchHistory(serverUrl);

  if (!stats || stats.totalMatches === 0) {
    console.log('No history - using balanced strategy');
    return 'balanced';
  }

  console.log(`\n=== ADAPTIVE DEFENDER (${stats.totalMatches} matches) ===`);
  console.log(`Defender win rate: ${stats.defenderWinRate}%`);

  const defenderPatterns = stats.patterns?.defender || {};

  // Step 1: Find the BEST performing defense strategy
  let bestStrategy = null;
  let bestWinRate = -1;

  for (const [pattern, data] of Object.entries(defenderPatterns)) {
    if (data.total > 0) {
      console.log(`  ${pattern}: ${data.wins}/${data.total} (${data.winRate}%)`);
      if (data.winRate > bestWinRate) {
        bestWinRate = data.winRate;
        bestStrategy = pattern;
      }
    }
  }

  // Step 2: If we have a winning strategy, USE IT
  if (bestStrategy && bestWinRate > 50) {
    const strategyName = PATTERN_TO_STRATEGY[bestStrategy] || 'balanced';
    console.log(`>>> Best strategy: ${bestStrategy} (${bestWinRate}%) -> using "${strategyName}"`);
    return strategyName;
  }

  // Step 3: If defenders are struggling, try new tower types
  if (stats.defenderWinRate < 50) {
    // Try the new free-flow strategies
    const newStrategies = ['chain', 'sniper', 'support', 'dense', 'flex'];
    const tryStrategy = newStrategies[Math.floor(Math.random() * newStrategies.length)];
    console.log(`>>> Defenders struggling, trying new strategy: ${tryStrategy}`);
    return tryStrategy;
  }

  // Step 4: Default to burst (high damage)
  console.log(`>>> Defaulting to burst strategy`);
  return 'burst';
}

module.exports = {
  generateAttackBuild,
  generateDefenseBuild,
  calculateAttackCost,
  calculateDefenseCost,
  getRandomStrategy,
  getAdaptiveAttackStrategy,
  getAdaptiveDefenseStrategy,
  fetchHistory,
  ATTACK_STRATEGIES: Object.keys(ATTACK_STRATEGIES),
  DEFEND_STRATEGIES: Object.keys(DEFEND_STRATEGIES)
};
