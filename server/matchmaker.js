const { createMatch, runMatchRealtime, getMatchState } = require('./simulation/match');
const { loadMatchHistory, appendMatch, updateElo, getLeaderboard, registerAgent } = require('./persistence');
const path = require('path');

// Import adaptive learning for in-house agent builds
const { generateAdaptiveBuild } = require(path.join(__dirname, '../agents/learning/adaptive-agent'));

// Activity feed (recent events for dashboard)
const activityFeed = [];
const MAX_ACTIVITY = 50;

// Queues for waiting agents
const attackQueue = [];
const defenseQueue = [];

// Queue timeout tracking (agentId -> setTimeout handle)
const queueTimeouts = new Map();

// Auto-match timeout in milliseconds (30 seconds)
const AUTO_MATCH_TIMEOUT = 30000;

// In-house named agents
const INHOUSE_ATTACKERS = ['BlitzRunner', 'IronWall', 'Spectre'];
const INHOUSE_DEFENDERS = ['Sentinel', 'Fortress', 'Striker', 'Guardian'];

// Active and completed matches (in-memory storage)
const matches = new Map();

// Track agent states to prevent spam
const agentStates = new Map(); // agentId -> { state: 'queued'|'in_match'|'cooldown', until: timestamp }
const COOLDOWN_MS = 5000; // 5 second cooldown after match ends

// Callback for match state updates (set by server)
let onMatchUpdate = null;

/**
 * Check if an agent can submit (not in queue, not in match, not in cooldown)
 * @returns {{ allowed: boolean, reason?: string, retryIn?: number }}
 */
function canAgentSubmit(agentId) {
  const state = agentStates.get(agentId);
  if (!state) return { allowed: true };

  const now = Date.now();

  switch (state.state) {
    case 'queued':
      return {
        allowed: false,
        reason: 'Already in queue waiting for opponent',
        state: 'queued'
      };

    case 'in_match':
      return {
        allowed: false,
        reason: 'Currently in an active match. Wait for results.',
        state: 'in_match',
        matchId: state.matchId
      };

    case 'cooldown':
      if (now < state.until) {
        return {
          allowed: false,
          reason: 'Cooldown active. Wait before submitting again.',
          state: 'cooldown',
          retryIn: Math.ceil((state.until - now) / 1000)
        };
      }
      // Cooldown expired
      agentStates.delete(agentId);
      return { allowed: true };

    default:
      return { allowed: true };
  }
}

/**
 * Set agent state
 */
function setAgentState(agentId, state, extra = {}) {
  agentStates.set(agentId, { state, ...extra });
}

/**
 * Clear agent state
 */
function clearAgentState(agentId) {
  agentStates.delete(agentId);
}

/**
 * Start cooldown for agent after match
 */
function startCooldown(agentId) {
  agentStates.set(agentId, {
    state: 'cooldown',
    until: Date.now() + COOLDOWN_MS
  });
}

/**
 * Add an event to the activity feed and broadcast it
 */
function addActivity(event) {
  const activity = {
    ...event,
    timestamp: Date.now()
  };

  activityFeed.unshift(activity);

  // Trim to max size
  if (activityFeed.length > MAX_ACTIVITY) {
    activityFeed.pop();
  }

  // Broadcast to all connected clients
  if (onMatchUpdate) {
    onMatchUpdate('activity', activity);
  }

  return activity;
}

/**
 * Get recent activity feed
 */
function getActivityFeed(limit = 20) {
  return activityFeed.slice(0, limit);
}

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
 * Pick a random in-house agent for the given side
 */
function pickRandomInhouse(side) {
  const pool = side === 'attack' ? INHOUSE_ATTACKERS : INHOUSE_DEFENDERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Create an in-house agent with adaptive build
 */
function createInhouseAgent(side, opponentId) {
  const agentId = pickRandomInhouse(side);
  let build;

  try {
    build = generateAdaptiveBuild(agentId, side, opponentId);
    console.log(`[Auto-Match] Generated adaptive build for ${agentId} vs ${opponentId}`);
  } catch (err) {
    console.error(`[Auto-Match] Adaptive build failed for ${agentId}:`, err.message);
    // Fallback to simple build
    if (side === 'attack') {
      build = {
        waves: [
          { runner: 2 },
          { tank: 1 },
          { healer: 1 },
          { regenerator: 1 },
          { tank: 1 }
        ]
      };
    } else {
      build = {
        towers: [
          { x: 150, type: 'sniper', lane: 'top' },
          { x: 400, type: 'chain', lane: 'bottom' },
          { x: 600, type: 'slow', lane: 'top' },
          { x: 800, type: 'basic', lane: 'bottom' }
        ]
      };
    }
  }

  return {
    agentId,
    side,
    build,
    submittedAt: Date.now(),
    isInhouse: true
  };
}

/**
 * Auto-match a queued agent with an in-house opponent
 */
function autoMatchAgent(agent) {
  const queue = agent.side === 'attack' ? attackQueue : defenseQueue;

  // Check if agent is still in queue
  const index = queue.findIndex(a => a.agentId === agent.agentId);
  if (index === -1) {
    console.log(`[Auto-Match] Agent ${agent.agentId} no longer in queue, skipping`);
    return;
  }

  // Remove from queue
  queue.splice(index, 1);

  // Clear timeout tracker
  queueTimeouts.delete(agent.agentId);

  // Create in-house opponent
  const oppositeSide = agent.side === 'attack' ? 'defend' : 'attack';
  const inhouseAgent = createInhouseAgent(oppositeSide, agent.agentId);

  // Create the match
  const attacker = agent.side === 'attack' ? agent : inhouseAgent;
  const defender = agent.side === 'defend' ? agent : inhouseAgent;

  const matchId = generateMatchId();
  const match = createMatch(matchId, attacker, defender);
  matches.set(matchId, match);

  console.log(`[Auto-Match] Created match ${matchId}: ${attacker.agentId} vs ${defender.agentId} (in-house: ${inhouseAgent.agentId})`);

  // Add activity for auto-match
  addActivity({
    type: 'auto_match',
    matchId,
    agentId: agent.agentId,
    inhouseAgent: inhouseAgent.agentId,
    attacker: attacker.agentId,
    defender: defender.agentId,
    message: `Auto-matched: ${agent.agentId} vs ${inhouseAgent.agentId} (in-house)`
  });

  // Set both agents to 'in_match' state
  setAgentState(agent.agentId, 'in_match', { matchId });
  setAgentState(inhouseAgent.agentId, 'in_match', { matchId });

  // Start the match
  startMatch(match);

  // Notify via callback if available
  if (onMatchUpdate) {
    onMatchUpdate(matchId, {
      type: 'auto_matched',
      matchId,
      attacker: attacker.agentId,
      defender: defender.agentId,
      inhouseAgent: inhouseAgent.agentId
    });
  }
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
  // Validate agent has a name
  if (!agent.agentId || agent.agentId.trim() === '') {
    throw new Error('Agent must have a valid name (agent_id)');
  }

  // Check if agent can submit (not already queued, in match, or in cooldown)
  const submitCheck = canAgentSubmit(agent.agentId);
  if (!submitCheck.allowed) {
    return {
      matched: false,
      rejected: true,
      reason: submitCheck.reason,
      state: submitCheck.state,
      matchId: submitCheck.matchId,
      retryIn: submitCheck.retryIn
    };
  }

  // Register agent in ELO system (creates if new)
  const { isNew } = registerAgent(agent.agentId, agent.side);

  if (isNew) {
    addActivity({
      type: 'agent_registered',
      agentId: agent.agentId,
      side: agent.side,
      message: `New agent "${agent.agentId}" joined as ${agent.side}er!`
    });
  }

  const queue = agent.side === 'attack' ? attackQueue : defenseQueue;
  const oppositeQueue = agent.side === 'attack' ? defenseQueue : attackQueue;

  // Check if we can match immediately
  if (oppositeQueue.length > 0) {
    const opponent = oppositeQueue.shift();

    // Clear opponent's auto-match timeout since they got a real match
    if (queueTimeouts.has(opponent.agentId)) {
      clearTimeout(queueTimeouts.get(opponent.agentId));
      queueTimeouts.delete(opponent.agentId);
      console.log(`[Queue] Cleared auto-match timeout for ${opponent.agentId} - matched with ${agent.agentId}`);
    }

    // Create the match
    const attacker = agent.side === 'attack' ? agent : opponent;
    const defender = agent.side === 'defend' ? agent : opponent;

    const matchId = generateMatchId();
    const match = createMatch(matchId, attacker, defender);
    matches.set(matchId, match);

    // Add activity for match creation
    addActivity({
      type: 'match_created',
      matchId,
      attacker: attacker.agentId,
      defender: defender.agentId,
      message: `Match started: ${attacker.agentId} vs ${defender.agentId}`
    });

    // Set both agents to 'in_match' state
    setAgentState(agent.agentId, 'in_match', { matchId });
    setAgentState(opponent.agentId, 'in_match', { matchId });

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

  // Set agent state to 'queued'
  setAgentState(agent.agentId, 'queued');

  // Add activity for queue join
  addActivity({
    type: 'queue_join',
    agentId: agent.agentId,
    side: agent.side,
    queuePosition: queue.length,
    message: `${agent.agentId} joined ${agent.side} queue (waiting for opponent)`
  });

  // Start auto-match timeout (30 seconds)
  const timeoutHandle = setTimeout(() => {
    console.log(`[Auto-Match] Timeout reached for ${agent.agentId}, matching with in-house agent`);
    autoMatchAgent(agent);
  }, AUTO_MATCH_TIMEOUT);

  queueTimeouts.set(agent.agentId, timeoutHandle);
  console.log(`[Queue] ${agent.agentId} queued (${agent.side}), auto-match in ${AUTO_MATCH_TIMEOUT / 1000}s if no opponent`);

  return {
    matched: false,
    position: queue.length,
    autoMatchIn: AUTO_MATCH_TIMEOUT / 1000
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

      // Update ELO rankings FIRST so we can store the data
      const winnerId = results.winner === 'attacker' ? match.attacker.agentId : match.defender.agentId;
      const loserId = results.winner === 'attacker' ? match.defender.agentId : match.attacker.agentId;
      const eloUpdate = updateElo(winnerId, loserId, match.matchId);
      console.log(`ELO: ${winnerId} now ${eloUpdate.winnerNewElo}, ${loserId} now ${eloUpdate.loserNewElo}`);

      // Add ELO data to match record for history
      match.eloChange = eloUpdate.change;
      match.attacker.elo = results.winner === 'attacker' ? eloUpdate.winnerNewElo : eloUpdate.loserNewElo;
      match.attacker.eloChange = results.winner === 'attacker' ? eloUpdate.change : -eloUpdate.change;
      match.defender.elo = results.winner === 'defender' ? eloUpdate.winnerNewElo : eloUpdate.loserNewElo;
      match.defender.eloChange = results.winner === 'defender' ? eloUpdate.change : -eloUpdate.change;

      // Persist match to history file (now includes ELO data)
      appendMatch(match);

      // Add activity for match completion
      addActivity({
        type: 'match_complete',
        matchId: match.matchId,
        winner: winnerId,
        loser: loserId,
        winnerSide: results.winner,
        eloChange: eloUpdate.change,
        winnerElo: eloUpdate.winnerNewElo,
        loserElo: eloUpdate.loserNewElo,
        message: `${winnerId} defeated ${loserId} (+${eloUpdate.change} ELO)`
      });

      // Start cooldown for both players (prevents immediate re-queue spam)
      startCooldown(match.attacker.agentId);
      startCooldown(match.defender.agentId);

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
 * Get queue stats with details
 */
function getQueueStats() {
  return {
    attackers: attackQueue.length,
    defenders: defenseQueue.length,
    attackQueue: attackQueue.map(a => ({
      agentId: a.agentId,
      queuedAt: a.submittedAt,
      waitingSeconds: Math.round((Date.now() - a.submittedAt) / 1000)
    })),
    defenseQueue: defenseQueue.map(a => ({
      agentId: a.agentId,
      queuedAt: a.submittedAt,
      waitingSeconds: Math.round((Date.now() - a.submittedAt) / 1000)
    })),
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

    // Clear auto-match timeout
    if (queueTimeouts.has(agentId)) {
      clearTimeout(queueTimeouts.get(agentId));
      queueTimeouts.delete(agentId);
    }

    // Clear agent state
    clearAgentState(agentId);

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
 * Returns completed matches with builds and results (from file + in-memory)
 */
function getMatchHistory(limit = 10) {
  // Load persisted history from file
  const persistedHistory = loadMatchHistory();

  // Get in-memory completed matches (current session, not yet in file)
  const inMemoryCompleted = Array.from(matches.values())
    .filter(m => m.status === 'complete')
    .map(m => ({
      matchId: m.matchId,
      winner: m.winner,
      startTime: m.startTime,
      endTime: m.endTime,
      wavesCompleted: m.currentWave,
      attacker: {
        agentId: m.attacker.agentId,
        build: m.attacker.build,
        totalEnemies: m.attacker.totalEnemies,
        leaked: m.attacker.leaked
      },
      defender: {
        agentId: m.defender.agentId,
        build: m.defender.build,
        kills: m.defender.kills,
        damageDealt: m.defender.damageDealt
      },
      waveBreakdown: m.waveBreakdown
    }));

  // Merge and dedupe by matchId (in-memory takes precedence)
  const seenIds = new Set(inMemoryCompleted.map(m => m.matchId));
  const merged = [
    ...inMemoryCompleted,
    ...persistedHistory.filter(m => !seenIds.has(m.matchId))
  ];

  // Sort by endTime descending and limit
  return merged
    .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
    .slice(0, limit)
    .map(m => ({
      matchId: m.matchId,
      winner: m.winner,
      duration: m.endTime && m.startTime ? Math.round((m.endTime - m.startTime) / 1000) : 0,
      wavesCompleted: m.wavesCompleted,
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
  getActivityFeed,
  removeFromQueue,
  setMatchUpdateCallback,
  setMatchSpeed,
  getMatchHistory,
  getLeaderboard,
  canAgentSubmit,
  AUTO_MATCH_TIMEOUT
};
