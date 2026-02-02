const { createMatch, runMatchRealtime, getMatchState } = require('./simulation/match');

// Queues for waiting agents
const attackQueue = [];
const defenseQueue = [];

// Active and completed matches (in-memory storage)
const matches = new Map();

// Callback for match state updates (set by server)
let onMatchUpdate = null;

/**
 * Generate a unique match ID
 */
function generateMatchId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'm_';
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

/**
 * Set the callback for match state updates
 */
function setMatchUpdateCallback(callback) {
  onMatchUpdate = callback;
}

/**
 * Add an agent to the matchmaking queue
 */
function addToQueue(agent) {
  const queue = agent.side === 'attack' ? attackQueue : defenseQueue;
  const oppositeQueue = agent.side === 'attack' ? defenseQueue : attackQueue;

  // Check if we can match immediately
  if (oppositeQueue.length > 0) {
    const opponent = oppositeQueue.shift();

    // Create the match
    const attacker = agent.side === 'attack' ? agent : opponent;
    const defender = agent.side === 'defend' ? agent : opponent;

    const matchId = generateMatchId();
    const match = createMatch(matchId, attacker, defender);
    matches.set(matchId, match);

    // Start the match
    startMatch(match);

    return {
      matched: true,
      matchId,
      opponent: opponent.agentId
    };
  }

  // No opponent available, add to queue
  queue.push(agent);

  return {
    matched: false,
    position: queue.length
  };
}

/**
 * Start a match and run it in real-time
 */
function startMatch(match) {
  console.log(`Starting match ${match.matchId}: ${match.attacker.agentId} vs ${match.defender.agentId}`);

  // Run match with tick callback for WebSocket updates
  runMatchRealtime(match, (state) => {
    if (onMatchUpdate) {
      onMatchUpdate(match.matchId, state);
    }
  }, 1) // Speed multiplier: 1 = normal speed
    .then((results) => {
      console.log(`Match ${match.matchId} complete. Winner: ${results.winner}`);
      if (onMatchUpdate) {
        onMatchUpdate(match.matchId, getMatchState(match));
      }
    })
    .catch((error) => {
      console.error(`Match ${match.matchId} error:`, error);
      match.status = 'error';
      match.error = error.message;
    });
}

/**
 * Get a match by ID
 */
function getMatch(matchId) {
  return matches.get(matchId);
}

/**
 * Get queue position for an agent
 */
function getQueuePosition(agentId, side) {
  const queue = side === 'attack' ? attackQueue : defenseQueue;
  const index = queue.findIndex(a => a.agentId === agentId);
  return index === -1 ? null : index + 1;
}

/**
 * Get all active matches
 */
function getActiveMatches() {
  return Array.from(matches.values())
    .filter(m => m.status === 'in_progress')
    .map(m => ({
      matchId: m.matchId,
      attacker: m.attacker.agentId,
      defender: m.defender.agentId,
      currentWave: m.currentWave
    }));
}

/**
 * Get queue stats
 */
function getQueueStats() {
  return {
    attackers: attackQueue.length,
    defenders: defenseQueue.length,
    activeMatches: Array.from(matches.values()).filter(m => m.status === 'in_progress').length,
    completedMatches: Array.from(matches.values()).filter(m => m.status === 'complete').length
  };
}

/**
 * Remove an agent from the queue
 */
function removeFromQueue(agentId, side) {
  const queue = side === 'attack' ? attackQueue : defenseQueue;
  const index = queue.findIndex(a => a.agentId === agentId);
  if (index !== -1) {
    queue.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Set the playback speed for a match
 */
function setMatchSpeed(matchId, speed) {
  const match = matches.get(matchId);
  if (!match) {
    return { success: false, error: 'Match not found' };
  }
  if (match.status !== 'in_progress') {
    return { success: false, error: 'Match is not in progress' };
  }
  if (speed < 1 || speed > 10) {
    return { success: false, error: 'Speed must be between 1 and 10' };
  }

  match.speed = speed;
  console.log(`Match ${matchId} speed set to ${speed}x`);
  return { success: true, speed };
}

/**
 * Get match history for strategy analysis
 * Returns completed matches with builds and results
 */
function getMatchHistory(limit = 10) {
  const completed = Array.from(matches.values())
    .filter(m => m.status === 'complete')
    .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
    .slice(0, limit);

  return completed.map(m => ({
    matchId: m.matchId,
    winner: m.winner,
    duration: m.endTime && m.startTime ? Math.round((m.endTime - m.startTime) / 1000) : 0,
    wavesCompleted: m.currentWave,
    attacker: {
      agentId: m.attacker.agentId,
      totalEnemies: m.attacker.totalEnemies,
      leaked: m.attacker.leaked
    },
    defender: {
      agentId: m.defender.agentId,
      kills: m.defender.kills,
      damageDealt: m.defender.damageDealt
    },
    attackerBuild: m.attacker.build,
    defenderBuild: m.defender.build,
    waveBreakdown: m.waveBreakdown
  }));
}

module.exports = {
  addToQueue,
  getMatch,
  getQueuePosition,
  getActiveMatches,
  getQueueStats,
  removeFromQueue,
  setMatchUpdateCallback,
  setMatchSpeed,
  getMatchHistory
};
