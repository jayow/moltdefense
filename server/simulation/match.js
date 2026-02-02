const { TICKS_PER_SECOND, TOTAL_WAVES } = require('./constants');
const { spawnWave, moveEnemy, resetEnemyCounter, getEnemyState } = require('./enemies');
const { initializeTowers, processTower, getTowerState } = require('./towers');

/**
 * Create a new match instance
 */
function createMatch(matchId, attacker, defender) {
  resetEnemyCounter();

  return {
    matchId,
    status: 'pending',
    attacker: {
      agentId: attacker.agentId,
      build: attacker.build,
      leaked: 0,
      totalEnemies: 0
    },
    defender: {
      agentId: defender.agentId,
      build: defender.build,
      kills: 0,
      damageDealt: 0
    },
    currentWave: 0,
    totalWaves: TOTAL_WAVES,
    tick: 0,
    enemies: [],
    towers: initializeTowers(defender.build),
    events: [],
    waveBreakdown: [],
    winner: null,
    startTime: null,
    endTime: null
  };
}

/**
 * Get current match state for spectators
 */
function getMatchState(match) {
  return {
    matchId: match.matchId,
    status: match.status,
    currentWave: match.currentWave,
    totalWaves: match.totalWaves,
    tick: match.tick,
    attacker: {
      agentId: match.attacker.agentId,
      leaked: match.attacker.leaked
    },
    defender: {
      agentId: match.defender.agentId,
      kills: match.defender.kills
    },
    enemies: match.enemies.filter(e => e.alive && !e.leaked).map(getEnemyState),
    towers: match.towers.map(getTowerState),
    events: match.events.slice(-20) // Last 20 events
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
      leaked: match.attacker.leaked
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
 * Process a single tick of the match
 */
function tick(match) {
  match.tick++;
  const tickEvents = [];

  // Move all enemies
  for (const enemy of match.enemies) {
    const leaked = moveEnemy(enemy);
    if (leaked) {
      match.attacker.leaked++;
      tickEvents.push({
        tick: match.tick,
        type: 'leak',
        enemy: enemy.id
      });
    }
  }

  // Process all towers
  for (const tower of match.towers) {
    const events = processTower(tower, match.enemies, match.tick);
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
 * Run a complete wave
 * Returns a generator that yields state on each tick
 */
function* runWave(match, waveIndex) {
  const waveConfig = match.attacker.build.waves[waveIndex];
  match.currentWave = waveIndex + 1;

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
      speed: enemy.speed
    });
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

  // Wave complete - record stats
  waveStats.killed = spawnedCount;
  waveStats.leaked = 0;
  match.waveBreakdown.push(waveStats);
}

/**
 * Run a complete match
 * Returns a generator that yields state on each tick
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
 * onTick callback receives state each tick
 * Returns a promise that resolves with final results
 * Speed can be changed dynamically via match.speed property
 */
function runMatchRealtime(match, onTick, speed = 1) {
  // Store speed on match object so it can be changed dynamically
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

      // Calculate tick interval dynamically based on current speed
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
