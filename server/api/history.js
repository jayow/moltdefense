const express = require('express');
const router = express.Router();
const { getMatchHistory } = require('../matchmaker');

/**
 * GET /history
 * Returns recent match results with full build data for strategy analysis
 */
router.get('/', (req, res) => {
  const limit = parseInt(req.query.limit) || 10;
  const history = getMatchHistory(limit);

  res.json({
    total: history.length,
    matches: history
  });
});

/**
 * GET /history/stats
 * Returns aggregated win statistics
 */
router.get('/stats', (req, res) => {
  const history = getMatchHistory(50);

  if (history.length === 0) {
    return res.json({
      totalMatches: 0,
      attackerWins: 0,
      defenderWins: 0,
      attackerWinRate: 0,
      message: 'No match history yet'
    });
  }

  const attackerWins = history.filter(m => m.winner === 'attacker').length;
  const defenderWins = history.filter(m => m.winner === 'defender').length;

  // Analyze build patterns
  const buildAnalysis = analyzeBuildPatterns(history);

  res.json({
    totalMatches: history.length,
    attackerWins,
    defenderWins,
    attackerWinRate: Math.round((attackerWins / history.length) * 100),
    defenderWinRate: Math.round((defenderWins / history.length) * 100),
    patterns: buildAnalysis
  });
});

/**
 * Analyze build patterns from match history
 */
function analyzeBuildPatterns(matches) {
  const patterns = {
    attacker: {
      tankHeavy: { wins: 0, total: 0 },
      swarmHeavy: { wins: 0, total: 0 },
      runnerHeavy: { wins: 0, total: 0 },
      balanced: { wins: 0, total: 0 }
    },
    defender: {
      slowHeavy: { wins: 0, total: 0 },
      burstHeavy: { wins: 0, total: 0 },
      basicHeavy: { wins: 0, total: 0 },
      balanced: { wins: 0, total: 0 }
    }
  };

  for (const match of matches) {
    if (!match.attackerBuild || !match.defenderBuild) continue;

    // Classify attacker build
    const attackType = classifyAttackBuild(match.attackerBuild);
    patterns.attacker[attackType].total++;
    if (match.winner === 'attacker') {
      patterns.attacker[attackType].wins++;
    }

    // Classify defender build
    const defendType = classifyDefenseBuild(match.defenderBuild);
    patterns.defender[defendType].total++;
    if (match.winner === 'defender') {
      patterns.defender[defendType].wins++;
    }
  }

  // Calculate win rates
  for (const side of ['attacker', 'defender']) {
    for (const type of Object.keys(patterns[side])) {
      const p = patterns[side][type];
      p.winRate = p.total > 0 ? Math.round((p.wins / p.total) * 100) : 0;
    }
  }

  return patterns;
}

/**
 * Classify an attack build by dominant unit type
 */
function classifyAttackBuild(build) {
  if (!build.waves) return 'balanced';

  let tanks = 0, swarms = 0, runners = 0;

  for (const wave of build.waves) {
    tanks += (wave.tank || 0) * 100;
    swarms += (wave.swarm || 0) * 75;
    runners += (wave.runner || 0) * 50;
  }

  const total = tanks + swarms + runners;
  if (total === 0) return 'balanced';

  if (tanks / total > 0.5) return 'tankHeavy';
  if (swarms / total > 0.5) return 'swarmHeavy';
  if (runners / total > 0.5) return 'runnerHeavy';
  return 'balanced';
}

/**
 * Classify a defense build by dominant tower type
 */
function classifyDefenseBuild(build) {
  if (!build.towers) return 'balanced';

  const towers = Object.values(build.towers);
  const counts = { slow: 0, burst: 0, basic: 0 };

  for (const type of towers) {
    if (counts[type] !== undefined) {
      counts[type]++;
    }
  }

  const total = towers.length;
  if (total === 0) return 'balanced';

  if (counts.slow / total > 0.5) return 'slowHeavy';
  if (counts.burst / total > 0.4) return 'burstHeavy';
  if (counts.basic / total > 0.5) return 'basicHeavy';
  return 'balanced';
}

module.exports = router;
