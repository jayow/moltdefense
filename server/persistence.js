/**
 * File-based persistence for match history and ELO rankings
 */

const fs = require('fs');
const path = require('path');

// Data file paths - use environment variable for Railway volume mount
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const MATCH_HISTORY_FILE = path.join(DATA_DIR, 'match-history.json');
const ELO_RANKINGS_FILE = path.join(DATA_DIR, 'elo-rankings.json');

// ELO constants
const K_FACTOR = 32;
const DEFAULT_ELO = 1200;

// Ensure data directory exists
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ============================================
// MATCH HISTORY PERSISTENCE
// ============================================

/**
 * Load match history from JSON file
 * @returns {Array} Array of match records
 */
function loadMatchHistory() {
  ensureDataDir();
  try {
    if (fs.existsSync(MATCH_HISTORY_FILE)) {
      const data = fs.readFileSync(MATCH_HISTORY_FILE, 'utf8');
      const matches = JSON.parse(data);
      console.log(`Loaded ${matches.length} matches from history`);
      return matches;
    }
  } catch (error) {
    console.error('Error loading match history:', error.message);
  }
  return [];
}

/**
 * Save complete match history to JSON file
 * @param {Array} matches - Array of match records
 */
function saveMatchHistory(matches) {
  ensureDataDir();
  try {
    fs.writeFileSync(MATCH_HISTORY_FILE, JSON.stringify(matches, null, 2));
  } catch (error) {
    console.error('Error saving match history:', error.message);
  }
}

/**
 * Append a single match to history and save
 * @param {Object} match - Match record to append
 */
function appendMatch(match) {
  const history = loadMatchHistory();

  // Extract relevant data for persistence
  const record = {
    matchId: match.matchId,
    winner: match.winner,
    startTime: match.startTime,
    endTime: match.endTime,
    wavesCompleted: match.currentWave,
    eloChange: match.eloChange || null,
    attacker: {
      agentId: match.attacker.agentId,
      build: match.attacker.build,
      totalEnemies: match.attacker.totalEnemies,
      leaked: match.attacker.leaked,
      rushBonus: match.attacker.rushBonus || 0,
      powerUpsUsed: match.attacker.powerUpsUsed || 0,
      elo: match.attacker.elo || null,
      eloChange: match.attacker.eloChange || null
    },
    defender: {
      agentId: match.defender.agentId,
      build: match.defender.build,
      kills: match.defender.kills,
      damageDealt: match.defender.damageDealt,
      powerUpsUsed: match.defender.powerUpsUsed || 0,
      elo: match.defender.elo || null,
      eloChange: match.defender.eloChange || null
    },
    waveBreakdown: match.waveBreakdown,
    // Store events for replay (include damage for health bar accuracy)
    events: (match.events || []).filter(e =>
      ['spawn', 'kill', 'leak', 'wave', 'damage', 'powerup_start', 'powerup_end'].includes(e.type)
    ).slice(-2000) // Keep last 2000 events per match (damage events are more frequent)
  };

  history.push(record);

  // Keep last 1000 matches to prevent file from growing too large
  if (history.length > 1000) {
    history.splice(0, history.length - 1000);
  }

  saveMatchHistory(history);
  console.log(`Match ${match.matchId} saved to history (total: ${history.length})`);
}

// ============================================
// ELO RANKING SYSTEM
// ============================================

/**
 * Load ELO rankings from JSON file
 * @returns {Map} Map of agentId -> ranking data
 */
function loadEloRankings() {
  ensureDataDir();
  try {
    if (fs.existsSync(ELO_RANKINGS_FILE)) {
      const data = fs.readFileSync(ELO_RANKINGS_FILE, 'utf8');
      const rankings = JSON.parse(data);
      console.log(`Loaded ${Object.keys(rankings).length} agent rankings`);
      return new Map(Object.entries(rankings));
    }
  } catch (error) {
    console.error('Error loading ELO rankings:', error.message);
  }
  return new Map();
}

/**
 * Save ELO rankings to JSON file
 * @param {Map} rankings - Map of agentId -> ranking data
 */
function saveEloRankings(rankings) {
  ensureDataDir();
  try {
    const obj = Object.fromEntries(rankings);
    fs.writeFileSync(ELO_RANKINGS_FILE, JSON.stringify(obj, null, 2));
  } catch (error) {
    console.error('Error saving ELO rankings:', error.message);
  }
}

/**
 * Get or create agent ranking entry
 * @param {Map} rankings - Rankings map
 * @param {string} agentId - Agent identifier
 * @returns {Object} Agent ranking data
 */
function getOrCreateAgent(rankings, agentId) {
  if (!rankings.has(agentId)) {
    rankings.set(agentId, {
      elo: DEFAULT_ELO,
      wins: 0,
      losses: 0,
      lastPlayed: null,
      history: []
    });
  }
  return rankings.get(agentId);
}

/**
 * Calculate expected win probability
 * @param {number} ratingA - First player's rating
 * @param {number} ratingB - Second player's rating
 * @returns {number} Expected probability of A winning
 */
function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Calculate ELO change for a match
 * @param {number} winnerElo - Winner's current ELO
 * @param {number} loserElo - Loser's current ELO
 * @returns {number} ELO points to add/subtract
 */
function calculateEloChange(winnerElo, loserElo) {
  const expected = expectedScore(winnerElo, loserElo);
  return Math.round(K_FACTOR * (1 - expected));
}

/**
 * Update ELO ratings after a match
 * @param {string} winnerId - Winner's agent ID
 * @param {string} loserId - Loser's agent ID
 * @param {string} matchId - Match identifier
 * @returns {Object} ELO update details
 */
function updateElo(winnerId, loserId, matchId) {
  const rankings = loadEloRankings();

  const winner = getOrCreateAgent(rankings, winnerId);
  const loser = getOrCreateAgent(rankings, loserId);

  const change = calculateEloChange(winner.elo, loser.elo);

  // Update winner
  winner.elo += change;
  winner.wins++;
  winner.lastPlayed = Date.now();
  winner.history.push({
    matchId,
    change: change,
    opponent: loserId,
    result: 'win',
    timestamp: Date.now()
  });

  // Update loser
  loser.elo -= change;
  loser.losses++;
  loser.lastPlayed = Date.now();
  loser.history.push({
    matchId,
    change: -change,
    opponent: winnerId,
    result: 'loss',
    timestamp: Date.now()
  });

  // Keep only last 50 match history entries per agent
  if (winner.history.length > 50) winner.history.shift();
  if (loser.history.length > 50) loser.history.shift();

  saveEloRankings(rankings);

  console.log(`ELO Updated: ${winnerId} ${winner.elo} (+${change}), ${loserId} ${loser.elo} (-${change})`);

  return {
    winnerId,
    loserId,
    change,
    winnerNewElo: winner.elo,
    loserNewElo: loser.elo
  };
}

/**
 * Get all ELO rankings as array sorted by ELO
 * @param {number} limit - Maximum entries to return
 * @returns {Array} Sorted leaderboard entries
 */
function getLeaderboard(limit = 20) {
  const rankings = loadEloRankings();

  return Array.from(rankings.entries())
    .map(([agentId, data]) => ({
      agentId,
      elo: data.elo,
      wins: data.wins,
      losses: data.losses,
      winRate: data.wins + data.losses > 0
        ? Math.round((data.wins / (data.wins + data.losses)) * 100)
        : 0,
      lastPlayed: data.lastPlayed
    }))
    .sort((a, b) => b.elo - a.elo)
    .slice(0, limit)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

/**
 * Get single agent's ranking info
 * @param {string} agentId - Agent identifier
 * @returns {Object|null} Agent ranking data or null if not found
 */
function getAgentRanking(agentId) {
  const rankings = loadEloRankings();

  if (!rankings.has(agentId)) {
    return null;
  }

  const data = rankings.get(agentId);
  const allRankings = getLeaderboard(1000);
  const rank = allRankings.findIndex(e => e.agentId === agentId) + 1;

  return {
    agentId,
    rank: rank || null,
    elo: data.elo,
    wins: data.wins,
    losses: data.losses,
    winRate: data.wins + data.losses > 0
      ? Math.round((data.wins / (data.wins + data.losses)) * 100)
      : 0,
    lastPlayed: data.lastPlayed,
    recentMatches: data.history.slice(-10).reverse()
  };
}

/**
 * Initialize ELO rankings for a list of named agents
 * Creates entries for agents that don't exist yet with default values
 * @param {Array} agentIds - Array of agent IDs to initialize
 * @returns {number} Number of agents created
 */
function initializeNamedAgents(agentIds) {
  const rankings = loadEloRankings();
  let created = 0;

  for (const agentId of agentIds) {
    if (!rankings.has(agentId)) {
      rankings.set(agentId, {
        elo: DEFAULT_ELO,
        wins: 0,
        losses: 0,
        lastPlayed: null,
        history: [],
        role: null,
        registeredAt: Date.now()
      });
      created++;
    }
  }

  if (created > 0) {
    saveEloRankings(rankings);
    console.log(`Initialized ELO for ${created} new agents`);
  }

  return created;
}

/**
 * Register a new agent when they first submit
 * @param {string} agentId - Agent identifier
 * @param {string} side - 'attack' or 'defend'
 * @returns {Object} { isNew: boolean, agent: Object }
 */
function registerAgent(agentId, side) {
  if (!agentId || agentId.trim() === '') {
    throw new Error('Agent must have a valid name (agent_id)');
  }

  const rankings = loadEloRankings();
  const isNew = !rankings.has(agentId);

  if (isNew) {
    rankings.set(agentId, {
      elo: DEFAULT_ELO,
      wins: 0,
      losses: 0,
      lastPlayed: null,
      history: [],
      role: side,
      registeredAt: Date.now()
    });
    saveEloRankings(rankings);
    console.log(`[ELO] New agent registered: ${agentId} (${side}) - Starting ELO: ${DEFAULT_ELO}`);
  } else {
    // Update role if not set (for legacy agents)
    const agent = rankings.get(agentId);
    if (!agent.role) {
      agent.role = side;
      saveEloRankings(rankings);
    }
  }

  return {
    isNew,
    agent: rankings.get(agentId)
  };
}

/**
 * Check if an agent exists
 * @param {string} agentId - Agent identifier
 * @returns {boolean}
 */
function agentExists(agentId) {
  const rankings = loadEloRankings();
  return rankings.has(agentId);
}

module.exports = {
  // Match history
  loadMatchHistory,
  saveMatchHistory,
  appendMatch,

  // ELO rankings
  loadEloRankings,
  saveEloRankings,
  updateElo,
  getLeaderboard,
  getAgentRanking,
  initializeNamedAgents,
  registerAgent,
  agentExists,

  // Constants
  DEFAULT_ELO,
  K_FACTOR
};
