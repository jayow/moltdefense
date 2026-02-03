const {
  TICKS_PER_SECOND,
  TOTAL_WAVES,
  WAVE_TIMING,
  POWER_UP_DURATION,
  POWER_UP_EFFECTS
} = require('./constants');
const {
  spawnWave,
  moveEnemy,
  resetEnemyCounter,
  getEnemyState,
  processEnemyAuras,
  processRegen,
  applyShield,
  applyInvisibility,
  applySpeedBoost,
  damageEnemy
} = require('./enemies');
const {
  initializeTowersV2,
  processTower,
  getTowerState,
  calculateTowerBuffs,
  resetTowerCounter
} = require('./towers');

/**
 * Create a new match instance with expanded features
 */
function createMatch(matchId, attacker, defender) {
  resetEnemyCounter();
  resetTowerCounter();

  return {
    matchId,
    status: 'pending',
    attacker: {
      agentId: attacker.agentId,
      build: attacker.build,
      leaked: 0,
      totalEnemies: 0,
      // New: Wave timing and power-ups
      waveTimings: attacker.build.waveTimings || [],
      powerUps: attacker.build.powerUps || [],
      powerUpsUsed: 0,
      rushBonus: 0
    },
    defender: {
      agentId: defender.agentId,
      build: defender.build,
      kills: 0,
      damageDealt: 0,
      // New: Power-ups
      powerUps: defender.build.powerUps || [],
      powerUpsUsed: 0,
      activePowerUps: []  // Currently active power-up effects
    },
    currentWave: 0,
    totalWaves: TOTAL_WAVES,
    tick: 0,
    enemies: [],
    towers: initializeTowersV2(defender.build),
    towerBuffs: {},  // Cache of tower buffs from support towers
    events: [],
    waveBreakdown: [],
    winner: null,
    startTime: null,
    endTime: null,
    // Wave timing state
    lastWaveEndTick: 0,
    speed: 1
  };
}

/**
 * Get current match state for spectators
 */
function getMatchState(match) {
  return {
    matchId: match.matchId,
    status: match.status,
    winner: match.winner,  // Include winner for completed matches
    currentWave: match.currentWave,
    totalWaves: match.totalWaves,
    tick: match.tick,
    attacker: {
      agentId: match.attacker.agentId,
      leaked: match.attacker.leaked,
      rushBonus: match.attacker.rushBonus
    },
    defender: {
      agentId: match.defender.agentId,
      kills: match.defender.kills,
      activePowerUps: match.defender.activePowerUps.map(p => ({
        type: p.type,
        endsAt: p.endsAt
      }))
    },
    enemies: match.enemies.filter(e => e.alive && !e.leaked).map(getEnemyState),
    towers: match.towers.map(getTowerState),
    events: match.events.slice(-20)
  };
}

/**
 * Get final match results
 */
function getMatchResults(match) {
  const duration = match.endTime && match.startTime
    ? Math.round((match.endTime - match.startTime) / 1000)
    : 0;

  return {
    matchId: match.matchId,
    status: match.status,
    winner: match.winner,
    durationSeconds: duration,
    wavesCompleted: match.currentWave,
    attacker: {
      agentId: match.attacker.agentId,
      totalEnemies: match.attacker.totalEnemies,
      leaked: match.attacker.leaked,
      rushBonus: match.attacker.rushBonus
    },
    defender: {
      agentId: match.defender.agentId,
      totalKills: match.defender.kills,
      damageDealt: match.defender.damageDealt
    },
    waveBreakdown: match.waveBreakdown,
    replayUrl: `/replay/${match.matchId}`
  };
}

/**
 * Process defender power-ups (check for expiration, apply effects)
 */
function processDefenderPowerUps(match, tickEvents) {
  const activePowerUps = match.defender.activePowerUps;

  // Process each active power-up
  for (let i = activePowerUps.length - 1; i >= 0; i--) {
    const powerUp = activePowerUps[i];

    // Check if expired
    if (match.tick >= powerUp.endsAt) {
      tickEvents.push({
        tick: match.tick,
        type: 'powerup_end',
        powerUp: powerUp.type,
        side: 'defender'
      });
      activePowerUps.splice(i, 1);
      continue;
    }

    // Apply ongoing effects
    switch (powerUp.type) {
      case 'freeze':
        // Freeze all enemies
        for (const enemy of match.enemies) {
          if (enemy.alive && !enemy.leaked) {
            enemy.speedMultiplier = 0;
          }
        }
        break;
      case 'damageBoost':
        // Damage boost is applied in tower processing via towerBuffs
        break;
    }
  }
}

/**
 * Activate a defender power-up
 */
function activateDefenderPowerUp(match, powerUp, tickEvents) {
  const duration = POWER_UP_DURATION[powerUp.type] || 60;

  tickEvents.push({
    tick: match.tick,
    type: 'powerup_start',
    powerUp: powerUp.type,
    side: 'defender'
  });

  match.defender.powerUpsUsed++;

  switch (powerUp.type) {
    case 'freeze':
    case 'damageBoost':
      // Duration-based power-ups
      match.defender.activePowerUps.push({
        type: powerUp.type,
        endsAt: match.tick + duration
      });
      break;

    case 'chainLightning':
      // Instant effect - damage all enemies with chain
      const effect = POWER_UP_EFFECTS.chainLightning;
      let damage = effect.damage;
      const sortedEnemies = [...match.enemies]
        .filter(e => e.alive && !e.leaked)
        .sort((a, b) => b.position - a.position);

      for (let i = 0; i < Math.min(effect.jumps, sortedEnemies.length); i++) {
        const enemy = sortedEnemies[i];
        const killed = damageEnemy(enemy, damage);

        tickEvents.push({
          tick: match.tick,
          type: 'damage',
          source: 'chainLightning',
          enemy: enemy.id,
          amount: Math.round(damage)
        });

        if (killed) {
          match.defender.kills++;
          tickEvents.push({
            tick: match.tick,
            type: 'kill',
            source: 'chainLightning',
            enemy: enemy.id
          });
        }

        damage *= effect.decay;
      }
      break;

    case 'reinforcement':
      // Spawn temporary tower - handled separately
      // For now, add a damage boost effect
      match.defender.activePowerUps.push({
        type: 'damageBoost',
        endsAt: match.tick + duration
      });
      break;
  }
}

/**
 * Apply attacker power-up to enemies in current wave
 */
function applyAttackerPowerUp(match, powerUp, tickEvents) {
  tickEvents.push({
    tick: match.tick,
    type: 'powerup_start',
    powerUp: powerUp.type,
    side: 'attacker'
  });

  match.attacker.powerUpsUsed++;

  // Find target enemy or apply to all/first
  const aliveEnemies = match.enemies.filter(e => e.alive && !e.leaked);
  if (aliveEnemies.length === 0) return;

  // Target first enemy if no specific target
  const target = aliveEnemies[0];

  switch (powerUp.type) {
    case 'shield':
      applyShield(target, 50);  // 50 HP shield
      break;

    case 'speedBoost':
      const boostDuration = POWER_UP_DURATION.speedBoost;
      const boostMultiplier = POWER_UP_EFFECTS.speedBoost;
      applySpeedBoost(target, boostMultiplier, boostDuration, match.tick);
      break;

    case 'invisibility':
      const invisDuration = POWER_UP_DURATION.invisibility;
      applyInvisibility(target, invisDuration, match.tick);
      break;

    case 'healPulse':
      // Heal all nearby enemies
      const effect = POWER_UP_EFFECTS.healPulse;
      for (const enemy of aliveEnemies) {
        if (Math.abs(enemy.position - target.position) <= effect.radius) {
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + effect.amount);
        }
      }
      break;
  }
}

/**
 * Process a single tick of the match
 */
function tick(match) {
  match.tick++;
  const tickEvents = [];

  // 1. Process defender power-ups (freeze, damage boost expiration)
  processDefenderPowerUps(match, tickEvents);

  // 2. Process enemy auras (heal, armor, resistance)
  processEnemyAuras(match.enemies);

  // 3. Process enemy regeneration
  processRegen(match.enemies);

  // 4. Move all enemies (with current tick for state expiration)
  for (const enemy of match.enemies) {
    const leaked = moveEnemy(enemy, match.tick);
    if (leaked) {
      match.attacker.leaked++;
      tickEvents.push({
        tick: match.tick,
        type: 'leak',
        enemy: enemy.id
      });
    }
  }

  // 5. Calculate tower buffs from support towers
  match.towerBuffs = calculateTowerBuffs(match.towers);

  // Apply damage boost from defender power-up
  const hasDamageBoost = match.defender.activePowerUps.some(p => p.type === 'damageBoost');
  if (hasDamageBoost) {
    for (const towerId in match.towerBuffs) {
      match.towerBuffs[towerId].damageMultiplier *= POWER_UP_EFFECTS.damageBoost;
    }
  }

  // 6. Process all towers with buffs
  for (const tower of match.towers) {
    const buff = match.towerBuffs[tower.id] || { damageMultiplier: 1.0 };
    const events = processTower(tower, match.enemies, match.tick, buff);
    tickEvents.push(...events);

    // Track stats
    for (const event of events) {
      if (event.type === 'damage') {
        match.defender.damageDealt += event.amount;
      }
      if (event.type === 'kill') {
        match.defender.kills++;
      }
    }
  }

  // Add events to match history
  match.events.push(...tickEvents);

  return tickEvents;
}

/**
 * Check if the current wave is complete
 */
function isWaveComplete(match) {
  return match.enemies.every(e => !e.alive || e.leaked);
}

/**
 * Run a complete wave with timing support
 */
function* runWave(match, waveIndex) {
  const waveConfig = match.attacker.build.waves[waveIndex];
  const waveTiming = match.attacker.waveTimings[waveIndex] || {};
  match.currentWave = waveIndex + 1;

  // Calculate rush bonus if applicable
  if (waveIndex > 0 && waveTiming.rush) {
    const ticksSinceLastWave = match.tick - match.lastWaveEndTick;
    if (ticksSinceLastWave < WAVE_TIMING.baseDelay) {
      const ticksRushed = WAVE_TIMING.baseDelay - ticksSinceLastWave;
      const bonus = Math.min(
        ticksRushed * WAVE_TIMING.rushBonusPerTick,
        WAVE_TIMING.maxRushBonus
      );
      match.attacker.rushBonus += bonus;

      match.events.push({
        tick: match.tick,
        type: 'rush',
        wave: match.currentWave,
        ticksRushed,
        bonusEarned: bonus
      });
    }
  }

  // Spawn enemies for this wave
  match.enemies = spawnWave(waveConfig);
  const spawnedCount = match.enemies.length;
  match.attacker.totalEnemies += spawnedCount;

  // Generate wave start event
  match.events.push({
    tick: match.tick,
    type: 'wave',
    wave: match.currentWave,
    totalEnemies: spawnedCount
  });

  // Generate spawn events with enhanced details
  for (const enemy of match.enemies) {
    match.events.push({
      tick: match.tick,
      type: 'spawn',
      enemy: enemy.id,
      enemyType: enemy.type,
      health: enemy.maxHp,
      speed: enemy.speed,
      armor: enemy.armor,
      aura: enemy.aura
    });
  }

  // Apply attacker power-ups for this wave
  const attackerPowerUps = match.attacker.powerUps.filter(p => p.wave === match.currentWave);
  for (const powerUp of attackerPowerUps) {
    const tickEvents = [];
    applyAttackerPowerUp(match, powerUp, tickEvents);
    match.events.push(...tickEvents);
  }

  // Apply defender power-ups for this wave
  const defenderPowerUps = match.defender.powerUps.filter(p => p.wave === match.currentWave);
  for (const powerUp of defenderPowerUps) {
    const tickEvents = [];
    activateDefenderPowerUp(match, powerUp, tickEvents);
    match.events.push(...tickEvents);
  }

  // Track wave stats
  const waveStats = {
    wave: match.currentWave,
    spawned: spawnedCount,
    killed: 0,
    leaked: 0
  };

  // Run until wave is complete
  while (!isWaveComplete(match)) {
    tick(match);
    yield getMatchState(match);

    // Check for attacker win (any leak)
    if (match.attacker.leaked > 0) {
      waveStats.leaked = match.attacker.leaked;
      waveStats.killed = match.defender.kills - (match.waveBreakdown.reduce((sum, w) => sum + w.killed, 0));
      match.waveBreakdown.push(waveStats);
      return;
    }
  }

  // Wave complete - record stats and timing
  waveStats.killed = spawnedCount;
  waveStats.leaked = 0;
  match.waveBreakdown.push(waveStats);
  match.lastWaveEndTick = match.tick;
}

/**
 * Run a complete match
 */
function* runMatch(match) {
  match.status = 'in_progress';
  match.startTime = Date.now();

  // Run all waves
  for (let waveIndex = 0; waveIndex < TOTAL_WAVES; waveIndex++) {
    // Yield between waves for spectator updates
    yield getMatchState(match);

    // Run the wave
    for (const state of runWave(match, waveIndex)) {
      yield state;
    }

    // Check for attacker win
    if (match.attacker.leaked > 0) {
      match.winner = 'attacker';
      match.status = 'complete';
      match.endTime = Date.now();
      yield getMatchState(match);
      return;
    }
  }

  // All waves complete - defender wins
  match.winner = 'defender';
  match.status = 'complete';
  match.endTime = Date.now();
  yield getMatchState(match);
}

/**
 * Run match at specified ticks per second (for real-time playback)
 */
function runMatchRealtime(match, onTick, speed = 1) {
  match.speed = speed;

  return new Promise((resolve) => {
    const generator = runMatch(match);

    function processNextTick() {
      const result = generator.next();

      if (result.done) {
        resolve(getMatchResults(match));
        return;
      }

      if (onTick) {
        onTick(result.value);
      }

      const currentSpeed = match.speed || 1;
      const tickInterval = 1000 / (TICKS_PER_SECOND * currentSpeed);
      setTimeout(processNextTick, tickInterval);
    }

    processNextTick();
  });
}

/**
 * Run match instantly (for testing/results only)
 */
function runMatchInstant(match) {
  const generator = runMatch(match);
  let state;

  while (true) {
    const result = generator.next();
    if (result.done) break;
    state = result.value;
  }

  return getMatchResults(match);
}

module.exports = {
  createMatch,
  getMatchState,
  getMatchResults,
  runMatch,
  runMatchRealtime,
  runMatchInstant,
  tick,
  isWaveComplete
};
