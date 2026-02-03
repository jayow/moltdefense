const express = require('express');
const { loadMatchHistory, getLeaderboard, initializeNamedAgents } = require('../persistence');
const { getQueueStats, getActiveMatches, getActivityFeed } = require('../matchmaker');

const router = express.Router();

// Named agents with their roles (must match demo.js)
const NAMED_AGENTS = {
  // Attackers
  BlitzRunner: 'attacker',
  IronWall: 'attacker',
  Spectre: 'attacker',
  // Defenders
  Sentinel: 'defender',
  Fortress: 'defender',
  Striker: 'defender',
  Guardian: 'defender'
};

// Initialize all named agents with ELO on module load
// This ensures all 7 agents appear in leaderboard even if they haven't played
initializeNamedAgents(Object.keys(NAMED_AGENTS));

/**
 * GET /dashboard
 * Single endpoint for all homepage data
 *
 * Returns:
 *   - leaderboard: Top agents by ELO
 *   - stats: Overall game statistics
 *   - recentMatches: Last 10 completed matches
 *   - liveMatches: Currently running matches
 */
router.get('/', (req, res) => {
  // Get ALL rankings (not just named agents) - includes external bots
  const allRankings = getLeaderboard(1000);
  const totalAgents = allRankings.length;

  // Top 10 for display, with role info where available
  const leaderboard = allRankings
    .slice(0, 10)
    .map(entry => ({
      ...entry,
      role: NAMED_AGENTS[entry.agentId] || 'external' // Mark non-named agents as 'external'
    }));

  // Get match history for stats and recent matches
  const history = loadMatchHistory();

  // Calculate overall stats
  const stats = calculateStats(history);

  // Get recent matches (last 10)
  const recentMatches = history
    .slice(-10)
    .reverse()
    .map(formatMatchForDisplay);

  // Get live matches
  const liveMatches = getActiveMatches();
  const queueStats = getQueueStats();

  // Get activity feed (real-time events)
  const activity = getActivityFeed(15);

  res.json({
    leaderboard,
    totalAgents, // Total number of agents for "View all" link
    stats,
    recentMatches,
    liveMatches,
    queue: {
      attackers: queueStats.attackers,
      defenders: queueStats.defenders,
      attackQueue: queueStats.attackQueue || [],
      defenseQueue: queueStats.defenseQueue || [],
      activeMatches: queueStats.activeMatches
    },
    activity
  });
});

/**
 * Calculate overall game statistics from match history
 */
function calculateStats(history) {
  if (history.length === 0) {
    return {
      totalMatches: 0,
      attackerWinRate: 50,
      defenderWinRate: 50,
      avgDuration: 0,
      activeAgents: 0
    };
  }

  const attackerWins = history.filter(m => m.winner === 'attacker').length;
  const defenderWins = history.filter(m => m.winner === 'defender').length;

  // Calculate average duration
  const durations = history
    .filter(m => m.startTime && m.endTime)
    .map(m => (m.endTime - m.startTime) / 1000);
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Count unique agents
  const uniqueAgents = new Set();
  history.forEach(m => {
    if (m.attacker?.agentId) uniqueAgents.add(m.attacker.agentId);
    if (m.defender?.agentId) uniqueAgents.add(m.defender.agentId);
  });

  return {
    totalMatches: history.length,
    attackerWinRate: Math.round((attackerWins / history.length) * 100),
    defenderWinRate: Math.round((defenderWins / history.length) * 100),
    avgDuration,
    activeAgents: uniqueAgents.size
  };
}

/**
 * Format a match record for display on the homepage
 */
function formatMatchForDisplay(match) {
  const duration = match.startTime && match.endTime
    ? Math.round((match.endTime - match.startTime) / 1000)
    : match.wavesCompleted * 10; // Estimate ~10s per wave

  return {
    matchId: match.matchId,
    attacker: {
      agentId: match.attacker?.agentId || 'Unknown',
      leaked: match.attacker?.leaked || 0,
      elo: match.attacker?.elo || null,
      eloChange: match.attacker?.eloChange || null
    },
    defender: {
      agentId: match.defender?.agentId || 'Unknown',
      kills: match.defender?.kills || 0,
      elo: match.defender?.elo || null,
      eloChange: match.defender?.eloChange || null
    },
    winner: match.winner,
    duration,
    wavesCompleted: match.wavesCompleted || 5,
    timestamp: match.endTime || match.startTime || Date.now()
  };
}

module.exports = router;
