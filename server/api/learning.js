const express = require('express');
const { loadMatchHistory, getAgentRanking, loadEloRankings } = require('../persistence');

const router = express.Router();

/**
 * GET /learning/history
 * Get match history for an agent to learn from
 *
 * Query params:
 *   agentId: string (optional) - Filter by specific agent
 *   limit: number (1-100, default 50)
 *   side: 'attack' | 'defend' (optional) - Filter by side
 *
 * Returns matches with full build details for learning
 */
router.get('/history', (req, res) => {
  const { agentId, side } = req.query;
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);

  let history = loadMatchHistory();

  // Filter by agent if specified
  if (agentId) {
    history = history.filter(m =>
      m.attacker?.agentId === agentId || m.defender?.agentId === agentId
    );
  }

  // Filter by side if specified
  if (side === 'attack') {
    history = history.filter(m => m.winner === 'attacker');
  } else if (side === 'defend') {
    history = history.filter(m => m.winner === 'defender');
  }

  // Sort by timestamp descending and limit
  const matches = history
    .sort((a, b) => (b.endTime || 0) - (a.endTime || 0))
    .slice(0, limit)
    .map(m => ({
      matchId: m.matchId,
      winner: m.winner,
      duration: m.endTime && m.startTime
        ? Math.round((m.endTime - m.startTime) / 1000)
        : 0,
      attacker: {
        agentId: m.attacker?.agentId,
        build: m.attacker?.build,
        leaked: m.attacker?.leaked || 0,
        rushBonus: m.attacker?.rushBonus || 0
      },
      defender: {
        agentId: m.defender?.agentId,
        build: m.defender?.build,
        kills: m.defender?.kills || 0,
        damageDealt: m.defender?.damageDealt || 0
      },
      waveBreakdown: m.waveBreakdown
    }));

  res.json({
    total: matches.length,
    filter: { agentId: agentId || null, side: side || null },
    matches
  });
});

/**
 * GET /learning/meta
 * Get current meta analysis for strategic insights
 *
 * Returns:
 *   - Most successful attack strategies
 *   - Most successful defense strategies
 *   - Win rates by enemy type usage
 *   - Win rates by tower type usage
 */
router.get('/meta', (req, res) => {
  const history = loadMatchHistory();

  if (history.length === 0) {
    return res.json({
      totalMatches: 0,
      message: 'No match data available yet',
      attackMeta: {},
      defenseMeta: {}
    });
  }

  // Analyze attack strategies
  const attackMeta = analyzeAttackStrategies(history);

  // Analyze defense strategies
  const defenseMeta = analyzeDefenseStrategies(history);

  // Overall stats
  const attackerWins = history.filter(m => m.winner === 'attacker').length;

  res.json({
    totalMatches: history.length,
    overallBalance: {
      attackerWinRate: Math.round((attackerWins / history.length) * 100),
      defenderWinRate: Math.round(((history.length - attackerWins) / history.length) * 100)
    },
    attackMeta,
    defenseMeta
  });
});

/**
 * GET /learning/opponent/:agentId
 * Get opponent's historical patterns and builds
 */
router.get('/opponent/:agentId', (req, res) => {
  const { agentId } = req.params;
  const history = loadMatchHistory();

  // Find matches where this agent participated
  const agentMatches = history.filter(m =>
    m.attacker?.agentId === agentId || m.defender?.agentId === agentId
  );

  if (agentMatches.length === 0) {
    return res.status(404).json({
      error: 'Agent not found',
      message: `No match history for agent: ${agentId}`
    });
  }

  // Separate attack and defense matches
  const attackMatches = agentMatches.filter(m => m.attacker?.agentId === agentId);
  const defendMatches = agentMatches.filter(m => m.defender?.agentId === agentId);

  // Analyze patterns
  const attackBuilds = attackMatches.map(m => m.attacker?.build).filter(Boolean);
  const defendBuilds = defendMatches.map(m => m.defender?.build).filter(Boolean);

  // Win rates
  const attackWins = attackMatches.filter(m => m.winner === 'attacker').length;
  const defendWins = defendMatches.filter(m => m.winner === 'defender').length;

  res.json({
    agentId,
    totalMatches: agentMatches.length,
    attackStats: {
      matches: attackMatches.length,
      wins: attackWins,
      losses: attackMatches.length - attackWins,
      winRate: attackMatches.length > 0
        ? Math.round((attackWins / attackMatches.length) * 100)
        : 0,
      recentBuilds: attackBuilds.slice(-5)
    },
    defenseStats: {
      matches: defendMatches.length,
      wins: defendWins,
      losses: defendMatches.length - defendWins,
      winRate: defendMatches.length > 0
        ? Math.round((defendWins / defendMatches.length) * 100)
        : 0,
      recentBuilds: defendBuilds.slice(-5)
    }
  });
});

/**
 * Analyze attack strategies from match history
 */
function analyzeAttackStrategies(history) {
  const enemyUsage = {};
  const powerUpUsage = {};
  const rushUsage = { total: 0, wins: 0 };

  history.forEach(match => {
    const build = match.attacker?.build;
    if (!build) return;

    const won = match.winner === 'attacker';

    // Count enemy type usage
    if (build.waves) {
      build.waves.forEach(wave => {
        Object.entries(wave).forEach(([type, count]) => {
          if (!enemyUsage[type]) {
            enemyUsage[type] = { used: 0, wins: 0 };
          }
          enemyUsage[type].used += count;
          if (won) enemyUsage[type].wins += count;
        });
      });
    }

    // Count power-up usage
    if (build.powerUps) {
      build.powerUps.forEach(pu => {
        if (!powerUpUsage[pu.type]) {
          powerUpUsage[pu.type] = { used: 0, wins: 0 };
        }
        powerUpUsage[pu.type].used++;
        if (won) powerUpUsage[pu.type].wins++;
      });
    }

    // Track rush timing
    if (build.waveTimings) {
      const hasRush = build.waveTimings.some(t => t.rush);
      if (hasRush) {
        rushUsage.total++;
        if (won) rushUsage.wins++;
      }
    }
  });

  // Calculate win rates
  const enemyWinRates = {};
  Object.entries(enemyUsage).forEach(([type, data]) => {
    enemyWinRates[type] = {
      totalUsed: data.used,
      winRate: data.used > 0 ? Math.round((data.wins / data.used) * 100) : 0
    };
  });

  const powerUpWinRates = {};
  Object.entries(powerUpUsage).forEach(([type, data]) => {
    powerUpWinRates[type] = {
      timesUsed: data.used,
      winRate: data.used > 0 ? Math.round((data.wins / data.used) * 100) : 0
    };
  });

  return {
    enemyEffectiveness: enemyWinRates,
    powerUpEffectiveness: powerUpWinRates,
    rushTiming: {
      matchesWithRush: rushUsage.total,
      winRateWithRush: rushUsage.total > 0
        ? Math.round((rushUsage.wins / rushUsage.total) * 100)
        : 0
    }
  };
}

/**
 * Analyze defense strategies from match history
 */
function analyzeDefenseStrategies(history) {
  const towerUsage = {};
  const powerUpUsage = {};
  const placementPatterns = { front: 0, mid: 0, back: 0 };
  const placementWins = { front: 0, mid: 0, back: 0 };

  history.forEach(match => {
    const build = match.defender?.build;
    if (!build) return;

    const won = match.winner === 'defender';

    // Count tower type usage
    if (build.towers) {
      const towers = Array.isArray(build.towers)
        ? build.towers
        : Object.entries(build.towers).map(([slot, type]) => ({ type, x: getSlotX(slot) }));

      towers.forEach(tower => {
        const type = tower.type;
        if (!towerUsage[type]) {
          towerUsage[type] = { used: 0, wins: 0, totalKills: 0 };
        }
        towerUsage[type].used++;
        if (won) towerUsage[type].wins++;

        // Track placement zones
        const x = tower.x || 500;
        if (x < 300) {
          placementPatterns.front++;
          if (won) placementWins.front++;
        } else if (x < 700) {
          placementPatterns.mid++;
          if (won) placementWins.mid++;
        } else {
          placementPatterns.back++;
          if (won) placementWins.back++;
        }
      });
    }

    // Count power-up usage
    if (build.powerUps) {
      build.powerUps.forEach(pu => {
        if (!powerUpUsage[pu.type]) {
          powerUpUsage[pu.type] = { used: 0, wins: 0 };
        }
        powerUpUsage[pu.type].used++;
        if (won) powerUpUsage[pu.type].wins++;
      });
    }
  });

  // Calculate win rates
  const towerWinRates = {};
  Object.entries(towerUsage).forEach(([type, data]) => {
    towerWinRates[type] = {
      totalUsed: data.used,
      winRate: data.used > 0 ? Math.round((data.wins / data.used) * 100) : 0
    };
  });

  const powerUpWinRates = {};
  Object.entries(powerUpUsage).forEach(([type, data]) => {
    powerUpWinRates[type] = {
      timesUsed: data.used,
      winRate: data.used > 0 ? Math.round((data.wins / data.used) * 100) : 0
    };
  });

  return {
    towerEffectiveness: towerWinRates,
    powerUpEffectiveness: powerUpWinRates,
    placementZones: {
      front: {
        usage: placementPatterns.front,
        winRate: placementPatterns.front > 0
          ? Math.round((placementWins.front / placementPatterns.front) * 100)
          : 0
      },
      mid: {
        usage: placementPatterns.mid,
        winRate: placementPatterns.mid > 0
          ? Math.round((placementWins.mid / placementPatterns.mid) * 100)
          : 0
      },
      back: {
        usage: placementPatterns.back,
        winRate: placementPatterns.back > 0
          ? Math.round((placementWins.back / placementPatterns.back) * 100)
          : 0
      }
    }
  };
}

/**
 * Convert slot letter to x position
 */
function getSlotX(slot) {
  const positions = { A: 100, B: 300, C: 500, D: 700, E: 900 };
  return positions[slot] || 500;
}

module.exports = router;
