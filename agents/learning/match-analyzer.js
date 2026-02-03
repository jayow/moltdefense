/**
 * Match Analyzer Module
 * Parses match history and extracts actionable insights for adaptive learning
 */

const path = require('path');
const { loadMatchHistory } = require(path.join(__dirname, '../../server/persistence'));

/**
 * Get all matches for a specific agent (as attacker or defender)
 * @param {string} agentId - Agent identifier
 * @param {Array} history - Match history array (optional, loads if not provided)
 * @returns {Array} Matches where this agent participated
 */
function getAgentMatches(agentId, history = null) {
  const matches = history || loadMatchHistory();

  return matches.filter(match =>
    match.attacker?.agentId === agentId ||
    match.defender?.agentId === agentId
  );
}

/**
 * Get an agent's matches filtered by side
 * @param {string} agentId - Agent identifier
 * @param {string} side - 'attack' or 'defend'
 * @param {Array} history - Match history array (optional)
 * @returns {Array} Filtered matches
 */
function getAgentMatchesBySide(agentId, side, history = null) {
  const matches = history || loadMatchHistory();

  if (side === 'attack') {
    return matches.filter(match => match.attacker?.agentId === agentId);
  } else {
    return matches.filter(match => match.defender?.agentId === agentId);
  }
}

/**
 * Extract build from a match record
 * @param {Object} match - Match record
 * @param {string} side - 'attack' or 'defend'
 * @returns {Object} Build object { waves, towers, powerUps, waveTimings }
 */
function extractBuild(match, side) {
  if (side === 'attack') {
    return match.attacker?.build || null;
  } else {
    return match.defender?.build || null;
  }
}

/**
 * Analyze wave-by-wave results from a match
 * @param {Object} match - Match record with waveBreakdown
 * @returns {Array} Wave results with kills, leaks, etc.
 */
function analyzeWaveResults(match) {
  if (!match.waveBreakdown) return [];

  return match.waveBreakdown.map((wave, index) => ({
    wave: index + 1,
    spawned: wave.spawned || 0,
    killed: wave.killed || 0,
    leaked: wave.leaked || 0,
    killRate: wave.spawned > 0 ? wave.killed / wave.spawned : 0,
    leakRate: wave.spawned > 0 ? wave.leaked / wave.spawned : 0
  }));
}

/**
 * Get opponent's most recent builds
 * @param {string} opponentId - Opponent's agent ID
 * @param {Array} history - Match history array (optional)
 * @param {number} limit - Maximum builds to return
 * @returns {Array} Recent builds with outcomes
 */
function getOpponentBuilds(opponentId, history = null, limit = 5) {
  const matches = history || loadMatchHistory();
  const opponentMatches = matches.filter(match =>
    match.attacker?.agentId === opponentId ||
    match.defender?.agentId === opponentId
  );

  // Get most recent matches
  const recent = opponentMatches.slice(-limit).reverse();

  return recent.map(match => {
    const isAttacker = match.attacker?.agentId === opponentId;
    const side = isAttacker ? 'attack' : 'defend';
    const won = (isAttacker && match.winner === 'attacker') ||
                (!isAttacker && match.winner === 'defender');

    return {
      matchId: match.matchId,
      side,
      build: isAttacker ? match.attacker.build : match.defender.build,
      won,
      opponent: isAttacker ? match.defender?.agentId : match.attacker?.agentId,
      timestamp: match.endTime || match.startTime
    };
  });
}

/**
 * Calculate win rate for an agent
 * @param {string} agentId - Agent identifier
 * @param {string} side - Optional: 'attack' or 'defend' to filter
 * @param {Array} history - Match history array (optional)
 * @returns {Object} Win statistics
 */
function getAgentWinRate(agentId, side = null, history = null) {
  const matches = history || loadMatchHistory();

  let agentMatches;
  if (side === 'attack') {
    agentMatches = matches.filter(m => m.attacker?.agentId === agentId);
  } else if (side === 'defend') {
    agentMatches = matches.filter(m => m.defender?.agentId === agentId);
  } else {
    agentMatches = matches.filter(m =>
      m.attacker?.agentId === agentId || m.defender?.agentId === agentId
    );
  }

  if (agentMatches.length === 0) {
    return { wins: 0, losses: 0, total: 0, winRate: 0 };
  }

  let wins = 0;
  agentMatches.forEach(match => {
    const isAttacker = match.attacker?.agentId === agentId;
    if ((isAttacker && match.winner === 'attacker') ||
        (!isAttacker && match.winner === 'defender')) {
      wins++;
    }
  });

  return {
    wins,
    losses: agentMatches.length - wins,
    total: agentMatches.length,
    winRate: Math.round((wins / agentMatches.length) * 100)
  };
}

/**
 * Get head-to-head record between two agents
 * @param {string} agentId1 - First agent
 * @param {string} agentId2 - Second agent
 * @param {Array} history - Match history array (optional)
 * @returns {Object} Head to head statistics
 */
function getHeadToHead(agentId1, agentId2, history = null) {
  const matches = history || loadMatchHistory();

  const headToHead = matches.filter(match =>
    (match.attacker?.agentId === agentId1 && match.defender?.agentId === agentId2) ||
    (match.attacker?.agentId === agentId2 && match.defender?.agentId === agentId1)
  );

  if (headToHead.length === 0) {
    return { matches: 0, agent1Wins: 0, agent2Wins: 0 };
  }

  let agent1Wins = 0;
  headToHead.forEach(match => {
    const agent1IsAttacker = match.attacker?.agentId === agentId1;
    const agent1Won = (agent1IsAttacker && match.winner === 'attacker') ||
                      (!agent1IsAttacker && match.winner === 'defender');
    if (agent1Won) agent1Wins++;
  });

  return {
    matches: headToHead.length,
    agent1Wins,
    agent2Wins: headToHead.length - agent1Wins,
    recentMatches: headToHead.slice(-5).reverse()
  };
}

/**
 * Extract enemy type usage from builds
 * @param {Array} matches - Array of match records
 * @returns {Object} Enemy type usage counts
 */
function analyzeEnemyUsage(matches) {
  const usage = {};

  matches.forEach(match => {
    const waves = match.attacker?.build?.waves || [];
    waves.forEach(wave => {
      Object.entries(wave).forEach(([type, count]) => {
        if (!usage[type]) {
          usage[type] = { used: 0, totalCount: 0 };
        }
        usage[type].used++;
        usage[type].totalCount += count;
      });
    });
  });

  return usage;
}

/**
 * Extract tower type usage from builds
 * @param {Array} matches - Array of match records
 * @returns {Object} Tower type usage counts
 */
function analyzeTowerUsage(matches) {
  const usage = {};

  matches.forEach(match => {
    const towers = match.defender?.build?.towers || [];

    // Handle both array (free-flow) and object (legacy) formats
    const towerList = Array.isArray(towers)
      ? towers
      : Object.values(towers);

    towerList.forEach(tower => {
      const type = typeof tower === 'string' ? tower : tower.type;
      if (!usage[type]) {
        usage[type] = { used: 0 };
      }
      usage[type].used++;
    });
  });

  return usage;
}

/**
 * Get the most successful builds for an agent
 * @param {string} agentId - Agent identifier
 * @param {string} side - 'attack' or 'defend'
 * @param {number} limit - Maximum builds to return
 * @param {Array} history - Match history array (optional)
 * @returns {Array} Top builds by win rate
 */
function getBestBuilds(agentId, side, limit = 3, history = null) {
  const matches = getAgentMatchesBySide(agentId, side, history);

  // Group by build (serialized)
  const buildStats = new Map();

  matches.forEach(match => {
    const build = extractBuild(match, side);
    if (!build) return;

    const key = JSON.stringify(build);
    if (!buildStats.has(key)) {
      buildStats.set(key, { build, wins: 0, total: 0 });
    }

    const stats = buildStats.get(key);
    stats.total++;

    const won = (side === 'attack' && match.winner === 'attacker') ||
                (side === 'defend' && match.winner === 'defender');
    if (won) stats.wins++;
  });

  // Convert to array and sort by win rate (with minimum sample size)
  return Array.from(buildStats.values())
    .filter(s => s.total >= 2) // Minimum 2 matches
    .map(s => ({
      ...s,
      winRate: Math.round((s.wins / s.total) * 100)
    }))
    .sort((a, b) => {
      // Sort by win rate, then by total matches
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.total - a.total;
    })
    .slice(0, limit);
}

module.exports = {
  getAgentMatches,
  getAgentMatchesBySide,
  extractBuild,
  analyzeWaveResults,
  getOpponentBuilds,
  getAgentWinRate,
  getHeadToHead,
  analyzeEnemyUsage,
  analyzeTowerUsage,
  getBestBuilds
};
