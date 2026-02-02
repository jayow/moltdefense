const { ENEMY_STATS, SLOW_DECAY_RATE, PATH_LENGTH, TICKS_PER_SECOND } = require('./constants');

let enemyIdCounter = 0;

/**
 * Create a single enemy instance
 */
function createEnemy(type, spawnOffset = 0) {
  const stats = ENEMY_STATS[type];
  if (!stats) {
    throw new Error(`Unknown enemy type: ${type}`);
  }

  const id = `e${enemyIdCounter++}`;

  return {
    id,
    type,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    speedMultiplier: 1.0,
    position: -50 - spawnOffset, // Start off-screen
    alive: true,
    leaked: false
  };
}

/**
 * Spawn all enemies for a wave based on wave configuration
 * Wave config is an object like { runner: 2, tank: 1 }
 */
function spawnWave(waveConfig) {
  const enemies = [];
  let spawnOffset = 0;
  const SPAWN_SPACING = 30; // Distance between spawned enemies
  const SWARM_SPACING = 20; // Distance between swarm units

  for (const [type, count] of Object.entries(waveConfig)) {
    for (let i = 0; i < count; i++) {
      if (type === 'swarm') {
        // Swarm spawns multiple smaller units
        const unitCount = ENEMY_STATS.swarm.unitCount;
        for (let j = 0; j < unitCount; j++) {
          const enemy = createEnemy('swarm', spawnOffset + (j * SWARM_SPACING));
          enemy.type = 'swarm_unit'; // Mark as individual swarm unit
          enemies.push(enemy);
        }
        spawnOffset += unitCount * SWARM_SPACING + SPAWN_SPACING;
      } else {
        enemies.push(createEnemy(type, spawnOffset));
        spawnOffset += SPAWN_SPACING;
      }
    }
  }

  return enemies;
}

/**
 * Move an enemy forward and apply slow decay
 * Returns true if enemy reached the end (leaked)
 */
function moveEnemy(enemy) {
  if (!enemy.alive || enemy.leaked) {
    return false;
  }

  // Move based on speed and speed multiplier
  const moveAmount = (enemy.speed * enemy.speedMultiplier) / TICKS_PER_SECOND;
  enemy.position += moveAmount;

  // Decay slow effect
  if (enemy.speedMultiplier < 1.0) {
    enemy.speedMultiplier = Math.min(1.0, enemy.speedMultiplier + SLOW_DECAY_RATE);
  }

  // Check if reached end
  if (enemy.position >= PATH_LENGTH) {
    enemy.leaked = true;
    return true;
  }

  return false;
}

/**
 * Apply damage to an enemy
 * Returns true if enemy was killed
 */
function damageEnemy(enemy, damage) {
  if (!enemy.alive) {
    return false;
  }

  enemy.hp -= damage;

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.alive = false;
    return true;
  }

  return false;
}

/**
 * Apply slow effect to an enemy
 */
function slowEnemy(enemy, slowAmount) {
  if (!enemy.alive || enemy.leaked) {
    return;
  }
  enemy.speedMultiplier = slowAmount;
}

/**
 * Reset the enemy ID counter (for new matches)
 */
function resetEnemyCounter() {
  enemyIdCounter = 0;
}

/**
 * Get enemy state for API response (minimal data)
 */
function getEnemyState(enemy) {
  return {
    id: enemy.id,
    type: enemy.type,
    hp: Math.round(enemy.hp),
    maxHp: enemy.maxHp,
    position: Math.round(enemy.position),
    speed: enemy.speed,
    speedMultiplier: enemy.speedMultiplier
  };
}

module.exports = {
  createEnemy,
  spawnWave,
  moveEnemy,
  damageEnemy,
  slowEnemy,
  resetEnemyCounter,
  getEnemyState
};
