const { ENEMY_STATS, SLOW_DECAY_RATE, PATH_LENGTH, TICKS_PER_SECOND } = require('./constants');

let enemyIdCounter = 0;

/**
 * Create a single enemy instance with all attributes
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
    leaked: false,

    // New attributes
    armor: stats.armor || 0,
    baseArmor: stats.armor || 0,  // Original armor (for aura calculations)
    regen: stats.regen || 0,
    aura: stats.aura || null,
    auraRadius: stats.auraRadius || 0,
    auraAmount: stats.auraAmount || 0,

    // Power-up states
    shieldHP: 0,              // Shield absorbs damage before HP
    invisible: false,         // Invisible to towers
    invisibleUntil: 0,        // Tick when invisibility ends
    speedBoosted: false,      // Speed boost active
    speedBoostUntil: 0,       // Tick when speed boost ends
    speedBoostMultiplier: 1,  // Speed boost multiplier (1.5 = 50% faster)

    // Aura buffs received from other enemies
    damageReduction: 0        // From boss resistance aura
  };
}

/**
 * Spawn all enemies for a wave based on wave configuration
 * Wave config is an object like { runner: 2, tank: 1, healer: 1 }
 */
function spawnWave(waveConfig) {
  const enemies = [];
  let spawnOffset = 0;
  const SPAWN_SPACING = 30;
  const SWARM_SPACING = 20;

  for (const [type, count] of Object.entries(waveConfig)) {
    for (let i = 0; i < count; i++) {
      if (type === 'swarm') {
        const unitCount = ENEMY_STATS.swarm.unitCount;
        for (let j = 0; j < unitCount; j++) {
          const enemy = createEnemy('swarm', spawnOffset + (j * SWARM_SPACING));
          enemy.type = 'swarm_unit';
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
 * Move an enemy forward with speed modifiers and slow decay
 * Returns true if enemy reached the end (leaked)
 */
function moveEnemy(enemy, currentTick = 0) {
  if (!enemy.alive || enemy.leaked) {
    return false;
  }

  // Check if speed boost expired
  if (enemy.speedBoosted && currentTick >= enemy.speedBoostUntil) {
    enemy.speedBoosted = false;
    enemy.speedBoostMultiplier = 1;
  }

  // Check if invisibility expired
  if (enemy.invisible && currentTick >= enemy.invisibleUntil) {
    enemy.invisible = false;
  }

  // Calculate effective speed: base * slowMultiplier * boostMultiplier
  const effectiveMultiplier = enemy.speedMultiplier * enemy.speedBoostMultiplier;
  const moveAmount = (enemy.speed * effectiveMultiplier) / TICKS_PER_SECOND;
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
 * Apply damage to an enemy with armor calculation
 * @param {Object} enemy - The enemy to damage
 * @param {number} damage - Raw damage amount
 * @param {number} armorPiercePercent - Fraction of armor to ignore (0-1)
 * @returns {boolean} true if enemy was killed
 */
function damageEnemy(enemy, damage, armorPiercePercent = 0) {
  if (!enemy.alive) {
    return false;
  }

  // Shield absorbs damage first
  if (enemy.shieldHP > 0) {
    const shieldDamage = Math.min(enemy.shieldHP, damage);
    enemy.shieldHP -= shieldDamage;
    damage -= shieldDamage;
    if (damage <= 0) {
      return false;
    }
  }

  // Apply damage reduction from resistance aura
  if (enemy.damageReduction > 0) {
    damage *= (1 - enemy.damageReduction);
  }

  // Calculate effective armor (with pierce)
  const effectiveArmor = enemy.armor * (1 - armorPiercePercent);
  const reducedDamage = Math.max(1, damage - effectiveArmor);

  enemy.hp -= reducedDamage;

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.alive = false;
    return true;
  }

  return false;
}

/**
 * Process enemy auras - heal, armor, resistance
 * Call once per tick for all enemies
 */
function processEnemyAuras(enemies) {
  // First, reset aura-granted buffs
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    enemy.armor = enemy.baseArmor;  // Reset to base armor
    enemy.damageReduction = 0;      // Reset damage reduction
  }

  // Then apply auras
  for (const source of enemies) {
    if (!source.alive || !source.aura) continue;

    for (const target of enemies) {
      if (target.id === source.id || !target.alive) continue;

      const distance = Math.abs(target.position - source.position);
      if (distance > source.auraRadius) continue;

      switch (source.aura) {
        case 'heal':
          // Heal nearby enemies
          target.hp = Math.min(target.maxHp, target.hp + source.auraAmount);
          break;
        case 'armor':
          // Grant bonus armor
          target.armor = target.baseArmor + source.auraAmount;
          break;
        case 'resistance':
          // Grant damage reduction (doesn't stack, takes highest)
          target.damageReduction = Math.max(target.damageReduction, source.auraAmount);
          break;
      }
    }
  }
}

/**
 * Process regeneration for all enemies
 * Call once per tick
 */
function processRegen(enemies) {
  for (const enemy of enemies) {
    if (!enemy.alive || enemy.regen <= 0) continue;
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen);
  }
}

/**
 * Check if an enemy can be targeted by towers
 */
function isTargetable(enemy, currentTick = 0) {
  if (!enemy.alive || enemy.leaked) return false;
  if (enemy.invisible && currentTick < enemy.invisibleUntil) return false;
  return true;
}

/**
 * Apply shield power-up to an enemy
 */
function applyShield(enemy, shieldAmount) {
  if (!enemy.alive) return;
  enemy.shieldHP = shieldAmount;
}

/**
 * Apply invisibility power-up to an enemy
 */
function applyInvisibility(enemy, durationTicks, currentTick) {
  if (!enemy.alive) return;
  enemy.invisible = true;
  enemy.invisibleUntil = currentTick + durationTicks;
}

/**
 * Apply speed boost power-up to an enemy
 */
function applySpeedBoost(enemy, multiplier, durationTicks, currentTick) {
  if (!enemy.alive) return;
  enemy.speedBoosted = true;
  enemy.speedBoostMultiplier = multiplier;
  enemy.speedBoostUntil = currentTick + durationTicks;
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
 * Get enemy state for API response
 */
function getEnemyState(enemy) {
  return {
    id: enemy.id,
    type: enemy.type,
    hp: Math.round(enemy.hp),
    maxHp: enemy.maxHp,
    position: Math.round(enemy.position),
    speed: enemy.speed,
    speedMultiplier: enemy.speedMultiplier,
    // New fields
    armor: enemy.armor,
    shieldHP: enemy.shieldHP,
    invisible: enemy.invisible,
    aura: enemy.aura,
    auraRadius: enemy.auraRadius
  };
}

module.exports = {
  createEnemy,
  spawnWave,
  moveEnemy,
  damageEnemy,
  slowEnemy,
  resetEnemyCounter,
  getEnemyState,
  // New exports
  processEnemyAuras,
  processRegen,
  isTargetable,
  applyShield,
  applyInvisibility,
  applySpeedBoost
};
