const express = require('express');
const { getLeaderboard, getAgentRanking } = require('../persistence');

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

/**
 * GET /leaderboard
 * Get top agents sorted by ELO
 * Returns ALL agents by default (includes external bots)
 *
 * Query params:
 *   limit: number (1-100, default 50)
 *   named_only: boolean (if true, only show in-house agents)
 */
router.get('/', (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const namedOnly = req.query.named_only === 'true';

  // Get all rankings
  let leaderboard = getLeaderboard(1000);
  const totalAgents = leaderboard.length;

  // Filter to named agents only if requested
  if (namedOnly) {
    leaderboard = leaderboard.filter(entry => NAMED_AGENTS[entry.agentId]);
  }

  // Add role information to each entry
  leaderboard = leaderboard.map(entry => ({
    ...entry,
    role: NAMED_AGENTS[entry.agentId] || 'external'
  }));

  // Apply limit and re-rank
  leaderboard = leaderboard.slice(0, limit).map((entry, index) => ({
    ...entry,
    rank: index + 1
  }));

  res.json({
    totalAgents,
    totalRanked: leaderboard.length,
    leaderboard
  });
});

/**
 * GET /leaderboard/:agentId
 * Get detailed ranking info for a specific agent
 */
router.get('/:agentId', (req, res) => {
  const { agentId } = req.params;
  const ranking = getAgentRanking(agentId);

  if (!ranking) {
    return res.status(404).json({
      error: 'Agent not found',
      message: `No ranking data for agent: ${agentId}`
    });
  }

  // Add role information
  ranking.role = NAMED_AGENTS[agentId] || 'unknown';

  res.json(ranking);
});

module.exports = router;
