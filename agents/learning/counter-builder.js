/**
 * Counter-Builder Module
 * Generates builds that counter opponent's recent strategies
 */

const path = require('path');
const { loadMatchHistory } = require(path.join(__dirname, '../../server/persistence'));
const { getOpponentBuilds } = require('./match-analyzer');
const { ENEMY_STATS, TOWER_STATS, BUDGET } = require(path.join(__dirname, '../../server/simulation/constants'));

/**
 * Counter-Play Matrix
 * Defines which units/towers are effective against others
 */
const COUNTER_MATRIX = {
  // What towers counter which enemies (for defenders)
  towerCounters: {
    runner: ['slow', 'chain'],       // Slow them down, chain hits groups
    tank: ['sniper', 'burst'],       // Armor pierce, high burst damage
    swarm: ['chain', 'basic'],       // Chain spreads, basic for volume
    healer: ['burst', 'sniper'],     // Kill fast before they heal
    shieldBearer: ['chain', 'sniper'], // Chain bypasses, sniper pierces
    regenerator: ['burst', 'sniper'], // High damage to outpace regen
    boss: ['sniper', 'support']      // Armor pierce + damage boost
  },

  // What enemies counter which towers (for attackers)
  enemyCounters: {
    slow: ['tank', 'regenerator'],   // Slow doesn't matter with high HP/regen
    burst: ['swarm'],                // Overwhelm single-target
    sniper: ['swarm', 'runner'],     // Too slow for fast/many targets
    chain: ['tank', 'boss'],         // High HP absorbs chain decay
    basic: ['tank', 'boss'],         // Out-HP'd
    support: ['runner']              // Rush past before buff matters
  }
};

/**
 * Analyze opponent's strategy from their recent builds
 * @param {string} opponentId - Opponent's agent ID
 * @param {Array} history - Match history (optional)
 * @returns {Object} Strategy analysis
 */
function analyzeOpponentStrategy(opponentId, history = null) {
  const recentBuilds = getOpponentBuilds(opponentId, history, 5);

  if (recentBuilds.length === 0) {
    return { hasData: false };
  }

  // Separate attack and defense builds
  const attackBuilds = recentBuilds.filter(b => b.side === 'attack');
  const defenseBuilds = recentBuilds.filter(b => b.side === 'defend');

  // Analyze attack patterns
  const enemyUsage = {};
  attackBuilds.forEach(build => {
    const waves = build.build?.waves || [];
    waves.forEach(wave => {
      Object.entries(wave).forEach(([type, count]) => {
        enemyUsage[type] = (enemyUsage[type] || 0) + count;
      });
    });
  });

  // Analyze defense patterns
  const towerUsage = {};
  defenseBuilds.forEach(build => {
    const towers = build.build?.towers || [];
    const towerList = Array.isArray(towers) ? towers : Object.values(towers);
    towerList.forEach(tower => {
      const type = typeof tower === 'string' ? tower : tower.type;
      towerUsage[type] = (towerUsage[type] || 0) + 1;
    });
  });

  // Find most used types
  const favoriteEnemies = Object.entries(enemyUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);

  const favoriteTowers = Object.entries(towerUsage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);

  return {
    hasData: true,
    totalBuilds: recentBuilds.length,
    attackBuilds: attackBuilds.length,
    defenseBuilds: defenseBuilds.length,
    favoriteEnemies,
    favoriteTowers,
    enemyUsage,
    towerUsage,
    winRate: Math.round(
      (recentBuilds.filter(b => b.won).length / recentBuilds.length) * 100
    )
  };
}

/**
 * Generate counter-attack build against opponent's defense
 * @param {Array} opponentTowers - Tower types opponent uses
 * @param {number} budget - Available budget (default 500)
 * @returns {Object} Counter attack build
 */
function generateCounterAttack(opponentTowers, budget = BUDGET) {
  // Find which enemies counter opponent's towers
  const counterUnits = new Set();

  opponentTowers.forEach(towerType => {
    const counters = COUNTER_MATRIX.enemyCounters[towerType] || [];
    counters.forEach(unit => counterUnits.add(unit));
  });

  // If no specific counters, use balanced approach
  if (counterUnits.size === 0) {
    counterUnits.add('runner');
    counterUnits.add('tank');
  }

  // Build waves with counter units
  const waves = [];
  let remainingBudget = budget;
  const unitArray = Array.from(counterUnits);

  for (let w = 0; w < 5; w++) {
    const wave = {};
    const waveTarget = Math.floor(remainingBudget / (5 - w));
    let waveCost = 0;

    // Distribute units for this wave
    while (waveCost < waveTarget - 50) {
      const unit = unitArray[Math.floor(Math.random() * unitArray.length)];
      const cost = ENEMY_STATS[unit]?.cost || 50;

      if (waveCost + cost <= waveTarget) {
        wave[unit] = (wave[unit] || 0) + 1;
        waveCost += cost;
      } else {
        break;
      }
    }

    if (Object.keys(wave).length > 0) {
      waves.push(wave);
      remainingBudget -= waveCost;
    } else {
      // Fallback: add a runner
      waves.push({ runner: 1 });
      remainingBudget -= 50;
    }
  }

  // Ensure we have 5 waves
  while (waves.length < 5) {
    waves.push({ runner: 1 });
  }

  return {
    waves,
    waveTimings: waves.map((_, i) => ({ rush: i > 0 && Math.random() > 0.5 })),
    powerUps: []
  };
}

/**
 * Generate counter-defense build against opponent's attack
 * @param {Array} opponentEnemies - Enemy types opponent uses
 * @param {number} budget - Available budget (default 500)
 * @returns {Object} Counter defense build
 */
function generateCounterDefense(opponentEnemies, budget = BUDGET) {
  // Find which towers counter opponent's enemies
  const counterTowers = new Set();

  opponentEnemies.forEach(enemyType => {
    const counters = COUNTER_MATRIX.towerCounters[enemyType] || [];
    counters.forEach(tower => counterTowers.add(tower));
  });

  // If no specific counters, use balanced approach
  if (counterTowers.size === 0) {
    counterTowers.add('basic');
    counterTowers.add('slow');
    counterTowers.add('burst');
  }

  // Build tower placement with counter towers
  const towers = [];
  let remainingBudget = budget;
  const towerArray = Array.from(counterTowers);

  // Place towers along the path
  const positions = [100, 250, 400, 550, 700, 850];
  const lanes = ['top', 'bottom'];
  let posIndex = 0;

  while (remainingBudget >= 80 && posIndex < positions.length) {
    const towerType = towerArray[posIndex % towerArray.length];
    const cost = TOWER_STATS[towerType]?.cost || 100;

    if (cost <= remainingBudget) {
      towers.push({
        x: positions[posIndex],
        type: towerType,
        lane: lanes[posIndex % 2]
      });
      remainingBudget -= cost;
    }
    posIndex++;
  }

  // Ensure at least 2 towers
  if (towers.length < 2) {
    towers.push({ x: 200, type: 'basic', lane: 'top' });
    towers.push({ x: 500, type: 'slow', lane: 'bottom' });
  }

  return {
    towers,
    powerUps: []
  };
}

/**
 * Generate a complete counter-build for an opponent
 * @param {string} opponentId - Opponent's agent ID
 * @param {string} side - 'attack' or 'defend'
 * @param {Array} history - Match history (optional)
 * @returns {Object} Counter build
 */
function generateCounterBuild(opponentId, side, history = null) {
  const strategy = analyzeOpponentStrategy(opponentId, history);

  if (!strategy.hasData) {
    // No data - return null to indicate no counter possible
    return null;
  }

  if (side === 'attack') {
    // Counter their defense
    return generateCounterAttack(strategy.favoriteTowers);
  } else {
    // Counter their attack
    return generateCounterDefense(strategy.favoriteEnemies);
  }
}

/**
 * Score how well a build counters opponent's build
 * @param {Object} myBuild - My build
 * @param {Object} opponentBuild - Opponent's build
 * @param {string} side - 'attack' or 'defend'
 * @returns {number} Counter effectiveness score (0-100)
 */
function scoreCounterEffectiveness(myBuild, opponentBuild, side) {
  let score = 50; // Base score

  if (side === 'attack') {
    // Check if my enemies counter their towers
    const opponentTowers = opponentBuild?.towers || [];
    const towerList = Array.isArray(opponentTowers)
      ? opponentTowers
      : Object.values(opponentTowers);

    const towerTypes = towerList.map(t => typeof t === 'string' ? t : t.type);

    const myEnemies = new Set();
    (myBuild?.waves || []).forEach(wave => {
      Object.keys(wave).forEach(type => myEnemies.add(type));
    });

    // Check counter relationships
    towerTypes.forEach(towerType => {
      const counters = COUNTER_MATRIX.enemyCounters[towerType] || [];
      myEnemies.forEach(enemy => {
        if (counters.includes(enemy)) {
          score += 10; // Good counter
        }
      });
    });
  } else {
    // Check if my towers counter their enemies
    const opponentWaves = opponentBuild?.waves || [];
    const opponentEnemies = new Set();
    opponentWaves.forEach(wave => {
      Object.keys(wave).forEach(type => opponentEnemies.add(type));
    });

    const myTowers = myBuild?.towers || [];
    const towerList = Array.isArray(myTowers) ? myTowers : Object.values(myTowers);
    const myTowerTypes = towerList.map(t => typeof t === 'string' ? t : t.type);

    // Check counter relationships
    opponentEnemies.forEach(enemyType => {
      const counters = COUNTER_MATRIX.towerCounters[enemyType] || [];
      myTowerTypes.forEach(tower => {
        if (counters.includes(tower)) {
          score += 10; // Good counter
        }
      });
    });
  }

  return Math.min(100, Math.max(0, score));
}

module.exports = {
  COUNTER_MATRIX,
  analyzeOpponentStrategy,
  generateCounterAttack,
  generateCounterDefense,
  generateCounterBuild,
  scoreCounterEffectiveness
};
