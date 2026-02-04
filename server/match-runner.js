/**
 * Match Runner - Orchestrates match execution
 *
 * Separates match execution logic from queue management (matchmaker).
 * Provides hooks for:
 * - Real-time state updates (onTick)
 * - Event notifications (onEvent)
 * - Mid-match modifications (future: addTower, upgradeEnemy)
 *
 * Uses:
 * - GameConfig for rules and stats
 * - EntityFactory for creating entities
 * - EffectSystem for buffs/debuffs
 */

const { getConfig } = require('./config/game-config');
const { createTowersFromBuild, spawnWave, resetCounters } = require('./simulation/entity-factory');
const { effectSystem, EFFECT_TYPES } = require('./simulation/effect-system');

/**
 * MatchRunner class - executes a single match
 */
class MatchRunner {
  constructor(options = {}) {
    this.config = options.config || getConfig();
    this.mapId = options.mapId || 'default';

    // Callbacks
    this.onTick = options.onTick || null;
    this.onEvent = options.onEvent || null;
    this.onWaveStart = options.onWaveStart || null;
    this.onWaveEnd = options.onWaveEnd || null;
    this.onComplete = options.onComplete || null;
  }

  /**
   * Initialize a new match
   * @param {object} attackBuild - Attacker's build configuration
   * @param {object} defenseBuild - Defender's build configuration
   * @returns {object} Match state
   */
  initializeMatch(attackBuild, defenseBuild) {
    // Reset entity counters and effect system
    resetCounters();
    effectSystem.reset();

    const match = {
      matchId: `m_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      status: 'initialized',

      // Timing
      tick: 0,
      startTime: null,
      endTime: null,

      // Builds
      attackBuild,
      defenseBuild,

      // Entities
      towers: createTowersFromBuild(defenseBuild),
      enemies: [],
      projectiles: [],

      // Wave tracking
      currentWave: 0,
      totalWaves: attackBuild.waves?.length || this.config.rules.wavesPerMatch,
      waveInProgress: false,
      waveTimings: attackBuild.waveTimings || [],

      // Power-ups
      attackPowerUps: attackBuild.powerUps || [],
      defensePowerUps: defenseBuild.powerUps || [],
      activePowerUps: [],

      // Scoring
      leaked: 0,
      kills: 0,

      // Events log
      events: [],

      // Results
      complete: false,
      winner: null,
    };

    return match;
  }

  /**
   * Run a complete match
   * @param {object} attackBuild - Attacker's build
   * @param {object} defenseBuild - Defender's build
   * @returns {Promise<object>} Match results
   */
  async runMatch(attackBuild, defenseBuild) {
    const match = this.initializeMatch(attackBuild, defenseBuild);
    match.status = 'running';
    match.startTime = Date.now();

    // Process all waves
    for (let wave = 0; wave < match.totalWaves; wave++) {
      match.currentWave = wave + 1;

      // Run the wave
      await this.runWave(match, wave);

      // Check win condition - attacker wins if any enemy leaked
      if (match.leaked > 0) {
        match.winner = 'attacker';
        break;
      }

      // Delay between waves (if not last wave)
      if (wave < match.totalWaves - 1) {
        const delay = this.getWaveDelay(match, wave);
        await this.delay(delay);
      }
    }

    // If no leaks, defender wins
    if (!match.winner) {
      match.winner = 'defender';
    }

    match.status = 'complete';
    match.complete = true;
    match.endTime = Date.now();

    this.onComplete?.(match);

    return this.getResults(match);
  }

  /**
   * Run a single wave
   * @param {object} match - Match state
   * @param {number} waveIndex - Wave index (0-based)
   */
  async runWave(match, waveIndex) {
    const waveConfig = match.attackBuild.waves[waveIndex];
    if (!waveConfig) return;

    match.waveInProgress = true;

    // Spawn enemies for this wave
    const newEnemies = spawnWave(waveConfig, 'top');
    match.enemies.push(...newEnemies);

    // Add wave event
    this.addEvent(match, {
      type: 'wave',
      wave: waveIndex + 1,
      enemies: newEnemies.map(e => ({ id: e.id, type: e.type })),
    });

    this.onWaveStart?.(match, waveIndex + 1);

    // Process wave power-ups
    this.processWavePowerUps(match, waveIndex + 1);

    // Run until wave is cleared or enemy leaks
    while (match.enemies.some(e => e.alive) && match.leaked === 0) {
      this.processTick(match);
      this.onTick?.(match);
      await this.delay(1000 / this.config.core.ticksPerSecond);
    }

    match.waveInProgress = false;
    this.onWaveEnd?.(match, waveIndex + 1);
  }

  /**
   * Process a single game tick
   * @param {object} match - Match state
   */
  processTick(match) {
    match.tick++;

    // Process effect system
    const expiredEffects = effectSystem.tick();
    for (const { entityId, effect } of expiredEffects) {
      this.addEvent(match, {
        type: 'effect_end',
        entity: entityId,
        effectType: effect.type,
      });
    }

    // Process enemy auras (heal, armor, resistance)
    this.processEnemyAuras(match);

    // Process tower attacks
    this.processTowerAttacks(match);

    // Process enemy movement
    this.processEnemyMovement(match);

    // Process enemy regeneration
    this.processEnemyRegen(match);

    // Update projectiles
    this.updateProjectiles(match);
  }

  /**
   * Process tower attacks
   * @param {object} match - Match state
   */
  processTowerAttacks(match) {
    for (const tower of match.towers) {
      if (!tower.enabled) continue;

      // Update cooldown
      if (tower.cooldown > 0) {
        tower.cooldown -= 1 / this.config.core.ticksPerSecond;
        continue;
      }

      // Support towers don't attack
      if (tower.special === 'buff') {
        this.processSupportTower(match, tower);
        continue;
      }

      // Find target
      const target = this.findTarget(match, tower);
      if (!target) continue;

      // Attack
      this.attackEnemy(match, tower, target);

      // Set cooldown
      tower.cooldown = 1 / tower.fireRate;
    }
  }

  /**
   * Find a target for a tower
   * @param {object} match - Match state
   * @param {object} tower - Tower entity
   * @returns {object|null} Target enemy or null
   */
  findTarget(match, tower) {
    let bestTarget = null;
    let bestPosition = -1;

    for (const enemy of match.enemies) {
      if (!enemy.alive) continue;
      if (!effectSystem.isTargetable(enemy)) continue;

      // Check if in range
      const distance = Math.abs(enemy.position - tower.position);
      if (distance > tower.range) continue;

      // Prioritize furthest enemy (closest to exit)
      if (enemy.position > bestPosition) {
        bestPosition = enemy.position;
        bestTarget = enemy;
      }
    }

    return bestTarget;
  }

  /**
   * Execute an attack from tower to enemy
   * @param {object} match - Match state
   * @param {object} tower - Tower entity
   * @param {object} target - Target enemy
   */
  attackEnemy(match, tower, target) {
    const damage = effectSystem.getEffectiveDamage(tower);

    // Apply damage with armor consideration
    const { actualDamage, shieldAbsorbed, blocked } = effectSystem.applyDamage(
      target,
      damage,
      { armorPiercePercent: tower.armorPiercePercent || 0 }
    );

    target.hp -= actualDamage;

    // Add damage event
    this.addEvent(match, {
      type: 'damage',
      tower: tower.id,
      enemy: target.id,
      amount: actualDamage,
      shieldAbsorbed,
      blocked,
    });

    // Handle chain towers
    if (tower.special === 'chain') {
      this.processChainAttack(match, tower, target, damage);
    }

    // Handle slow towers
    if (tower.special === 'slow') {
      effectSystem.applyEffect(target.id, {
        type: EFFECT_TYPES.SLOW,
        stat: 'speed',
        modifier: tower.slowAmount,
        duration: this.config.core.ticksPerSecond, // 1 second
        stacks: false,
      });
    }

    // Check for kill
    if (target.hp <= 0) {
      target.alive = false;
      match.kills++;

      this.addEvent(match, {
        type: 'kill',
        tower: tower.id,
        enemy: target.id,
        enemyType: target.type,
      });
    }
  }

  /**
   * Process chain tower attack (hits multiple targets)
   * @param {object} match - Match state
   * @param {object} tower - Chain tower
   * @param {object} initialTarget - First target
   * @param {number} initialDamage - Initial damage amount
   */
  processChainAttack(match, tower, initialTarget, initialDamage) {
    const hitTargets = new Set([initialTarget.id]);
    let currentTarget = initialTarget;
    let currentDamage = initialDamage;

    for (let i = 1; i < tower.chainCount; i++) {
      currentDamage *= tower.chainDamageDecay;

      // Find next closest enemy not already hit
      let nextTarget = null;
      let closestDist = Infinity;

      for (const enemy of match.enemies) {
        if (!enemy.alive) continue;
        if (hitTargets.has(enemy.id)) continue;
        if (!effectSystem.isTargetable(enemy)) continue;

        const dist = Math.abs(enemy.position - currentTarget.position);
        if (dist < closestDist && dist < tower.range) {
          closestDist = dist;
          nextTarget = enemy;
        }
      }

      if (!nextTarget) break;

      hitTargets.add(nextTarget.id);
      currentTarget = nextTarget;

      // Apply chained damage
      const { actualDamage } = effectSystem.applyDamage(nextTarget, currentDamage);
      nextTarget.hp -= actualDamage;

      this.addEvent(match, {
        type: 'damage',
        tower: tower.id,
        enemy: nextTarget.id,
        amount: actualDamage,
        chained: true,
      });

      if (nextTarget.hp <= 0) {
        nextTarget.alive = false;
        match.kills++;

        this.addEvent(match, {
          type: 'kill',
          tower: tower.id,
          enemy: nextTarget.id,
          enemyType: nextTarget.type,
        });
      }
    }
  }

  /**
   * Process support tower (buffs nearby towers)
   * @param {object} match - Match state
   * @param {object} tower - Support tower
   */
  processSupportTower(match, tower) {
    for (const otherTower of match.towers) {
      if (otherTower.id === tower.id) continue;
      if (otherTower.special === 'buff') continue; // Don't buff other supports

      const distance = Math.abs(otherTower.position - tower.position);
      if (distance <= tower.buffRadius) {
        // Apply damage buff (refreshes each tick)
        effectSystem.applyEffect(otherTower.id, {
          type: EFFECT_TYPES.DAMAGE_BOOST,
          stat: 'damage',
          modifier: 1 + tower.damageBuffPercent,
          duration: 2, // Refresh every tick
          stacks: false,
          source: tower.id,
        });
      }
    }
  }

  /**
   * Process enemy auras (heal, armor, resistance)
   * @param {object} match - Match state
   */
  processEnemyAuras(match) {
    for (const enemy of match.enemies) {
      if (!enemy.alive || !enemy.aura) continue;

      for (const otherEnemy of match.enemies) {
        if (!otherEnemy.alive || otherEnemy.id === enemy.id) continue;

        const distance = Math.abs(otherEnemy.position - enemy.position);
        if (distance > enemy.auraRadius) continue;

        switch (enemy.aura) {
          case 'heal':
            // Heal nearby enemies
            const healAmount = enemy.auraAmount * otherEnemy.maxHp;
            otherEnemy.hp = Math.min(otherEnemy.maxHp, otherEnemy.hp + healAmount);
            break;

          case 'armor':
            // Provide armor buff
            effectSystem.applyEffect(otherEnemy.id, {
              type: EFFECT_TYPES.ARMOR_AURA,
              stat: 'armor',
              data: { flatBonus: enemy.auraAmount },
              duration: 2,
              stacks: false,
              source: enemy.id,
            });
            break;

          case 'resistance':
            // Provide damage reduction
            effectSystem.applyEffect(otherEnemy.id, {
              type: EFFECT_TYPES.RESISTANCE_AURA,
              stat: 'damageReduction',
              modifier: 1 - enemy.auraAmount,
              duration: 2,
              stacks: false,
              source: enemy.id,
            });
            break;
        }
      }
    }
  }

  /**
   * Process enemy movement
   * @param {object} match - Match state
   */
  processEnemyMovement(match) {
    const pathLength = this.config.core.pathLength;

    for (const enemy of match.enemies) {
      if (!enemy.alive) continue;

      // Get effective speed (accounts for effects)
      const speed = effectSystem.getEffectiveSpeed(enemy);

      // Move enemy
      enemy.position += speed / this.config.core.ticksPerSecond;

      // Decay slow effect
      if (enemy.speedMultiplier < 1.0) {
        enemy.speedMultiplier = Math.min(1.0, enemy.speedMultiplier + this.config.core.slowDecayRate);
      }

      // Check for leak
      if (enemy.position >= pathLength) {
        enemy.alive = false;
        match.leaked++;

        this.addEvent(match, {
          type: 'leak',
          enemy: enemy.id,
          enemyType: enemy.type,
        });
      }
    }
  }

  /**
   * Process enemy regeneration
   * @param {object} match - Match state
   */
  processEnemyRegen(match) {
    for (const enemy of match.enemies) {
      if (!enemy.alive || enemy.regen <= 0) continue;

      const regenAmount = enemy.regen * enemy.maxHp;
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + regenAmount);
    }
  }

  /**
   * Process power-ups for a wave
   * @param {object} match - Match state
   * @param {number} wave - Wave number (1-based)
   */
  processWavePowerUps(match, wave) {
    // Process attacker power-ups
    for (const powerUp of match.attackPowerUps) {
      if (powerUp.wave === wave) {
        this.activatePowerUp(match, powerUp, 'attack');
      }
    }

    // Process defender power-ups
    for (const powerUp of match.defensePowerUps) {
      if (powerUp.wave === wave) {
        this.activatePowerUp(match, powerUp, 'defense');
      }
    }
  }

  /**
   * Activate a power-up
   * @param {object} match - Match state
   * @param {object} powerUp - Power-up configuration
   * @param {string} side - 'attack' or 'defense'
   */
  activatePowerUp(match, powerUp, side) {
    const config = this.config.powerUps[powerUp.type];
    if (!config) return;

    this.addEvent(match, {
      type: 'powerup_start',
      powerUp: powerUp.type,
      side,
      duration: config.duration,
    });

    // Apply power-up effects based on type
    switch (powerUp.type) {
      case 'damageBoost':
        // Buff all towers
        for (const tower of match.towers) {
          effectSystem.applyEffect(tower.id, {
            type: EFFECT_TYPES.DAMAGE_BOOST,
            stat: 'damage',
            modifier: config.effect,
            duration: config.duration,
            stacks: false,
          });
        }
        break;

      case 'freeze':
        // Freeze all enemies
        for (const enemy of match.enemies) {
          if (enemy.alive) {
            effectSystem.applyEffect(enemy.id, {
              type: EFFECT_TYPES.FREEZE,
              duration: config.duration,
              stacks: false,
            });
          }
        }
        break;

      case 'speedBoost':
        // Boost all enemies
        for (const enemy of match.enemies) {
          if (enemy.alive) {
            effectSystem.applyEffect(enemy.id, {
              type: EFFECT_TYPES.SPEED_BOOST,
              stat: 'speed',
              modifier: config.effect,
              duration: config.duration,
              stacks: false,
            });
          }
        }
        break;

      case 'shield':
        // Shield specific enemy or all
        const targetId = powerUp.target;
        for (const enemy of match.enemies) {
          if (enemy.alive && (!targetId || enemy.type === targetId)) {
            effectSystem.applyEffect(enemy.id, {
              type: EFFECT_TYPES.SHIELD,
              duration: config.duration,
              data: { shieldHp: enemy.maxHp * 0.5 }, // 50% HP shield
              stacks: false,
            });
          }
        }
        break;

      case 'invisibility':
        // Make enemies invisible
        for (const enemy of match.enemies) {
          if (enemy.alive) {
            effectSystem.applyEffect(enemy.id, {
              type: EFFECT_TYPES.INVISIBILITY,
              duration: config.duration,
              stacks: false,
            });
          }
        }
        break;
    }
  }

  /**
   * Update projectiles (visual only)
   * @param {object} match - Match state
   */
  updateProjectiles(match) {
    // Projectiles are visual-only, no processing needed here
    // They're handled by the client renderer
  }

  /**
   * Get wave delay based on timing config
   * @param {object} match - Match state
   * @param {number} waveIndex - Wave index
   * @returns {number} Delay in milliseconds
   */
  getWaveDelay(match, waveIndex) {
    const timing = match.waveTimings[waveIndex] || {};

    if (timing.rush) {
      return this.config.rules.minWaveDelay * (1000 / this.config.core.ticksPerSecond);
    }

    if (timing.delay) {
      const ticks = Math.min(timing.delay, this.config.rules.maxWaveDelay);
      return ticks * (1000 / this.config.core.ticksPerSecond);
    }

    return this.config.rules.waveDelay * (1000 / this.config.core.ticksPerSecond);
  }

  /**
   * Add an event to the match log
   * @param {object} match - Match state
   * @param {object} event - Event data
   */
  addEvent(match, event) {
    const fullEvent = {
      tick: match.tick,
      timestamp: Date.now(),
      ...event,
    };

    match.events.push(fullEvent);
    this.onEvent?.(match, fullEvent);
  }

  /**
   * Get match results
   * @param {object} match - Match state
   * @returns {object} Match results
   */
  getResults(match) {
    return {
      matchId: match.matchId,
      status: match.status,
      winner: match.winner,
      duration: match.endTime - match.startTime,
      ticks: match.tick,
      wavesCompleted: match.currentWave,
      leaked: match.leaked,
      kills: match.kills,
      attackBuild: match.attackBuild,
      defenseBuild: match.defenseBuild,
      events: match.events,
    };
  }

  /**
   * Get current match state (for real-time updates)
   * @param {object} match - Match state
   * @returns {object} Current state
   */
  getState(match) {
    return {
      matchId: match.matchId,
      status: match.status,
      tick: match.tick,
      wave: match.currentWave,
      totalWaves: match.totalWaves,
      leaked: match.leaked,
      kills: match.kills,
      enemies: match.enemies.filter(e => e.alive).map(e => ({
        id: e.id,
        type: e.type,
        position: e.position,
        lane: e.lane,
        hp: e.hp,
        maxHp: e.maxHp,
        speedMultiplier: e.speedMultiplier,
      })),
      towers: match.towers.map(t => ({
        id: t.id,
        type: t.type,
        position: t.position,
        lane: t.lane,
        cooldown: t.cooldown,
      })),
    };
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================
  // FUTURE: Mid-match modifications
  // ============================================

  /**
   * Add a tower mid-match (future feature)
   * @param {object} match - Match state
   * @param {string} type - Tower type
   * @param {number} position - Position on path
   * @param {string} lane - Lane
   */
  addTower(match, type, position, lane) {
    // TODO: Implement for future dynamic tower placement
    throw new Error('Mid-match tower addition not yet implemented');
  }

  /**
   * Remove a tower mid-match (future feature)
   * @param {object} match - Match state
   * @param {string} towerId - Tower ID to remove
   */
  removeTower(match, towerId) {
    // TODO: Implement for future dynamic tower removal
    throw new Error('Mid-match tower removal not yet implemented');
  }

  /**
   * Upgrade an enemy mid-match (future feature)
   * @param {object} match - Match state
   * @param {string} enemyId - Enemy ID
   * @param {object} upgrade - Upgrade configuration
   */
  upgradeEnemy(match, enemyId, upgrade) {
    // TODO: Implement for future enemy upgrades
    throw new Error('Mid-match enemy upgrade not yet implemented');
  }
}

module.exports = {
  MatchRunner,
};
