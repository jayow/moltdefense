const express = require('express');
const { loadMatchHistory } = require('../persistence');

const router = express.Router();

// Enemy and tower types for tracking
const ENEMY_TYPES = ['runner', 'tank', 'swarm', 'healer', 'shieldBearer', 'regenerator', 'boss'];
const TOWER_TYPES = ['basic', 'slow', 'burst', 'chain', 'sniper', 'support'];
const ATTACKER_POWERUPS = ['shield', 'speedBoost', 'invisibility', 'healPulse'];
const DEFENDER_POWERUPS = ['damageBoost', 'freeze', 'chainLightning', 'reinforcement'];

/**
 * Analyze enemy usage from match history
 */
function analyzeEnemyStats(matches) {
  const stats = {};

  for (const type of ENEMY_TYPES) {
    stats[type] = {
      timesUsed: 0,
      totalSpawned: 0,
      totalLeaked: 0,
      totalKilled: 0,
      matchesWon: 0,
      matchesLost: 0
    };
  }

  for (const match of matches) {
    if (!match.attacker?.build?.waves) continue;

    const attackerWon = match.winner === 'attacker';
    const waves = match.attacker.build.waves;

    // Count enemy usage per wave
    for (const wave of waves) {
      for (const [type, count] of Object.entries(wave)) {
        if (stats[type] && count > 0) {
          stats[type].timesUsed++;
          stats[type].totalSpawned += type === 'swarm' ? count * 5 : count;
          if (attackerWon) {
            stats[type].matchesWon++;
          } else {
            stats[type].matchesLost++;
          }
        }
      }
    }
  }

  // Calculate derived stats
  for (const type of ENEMY_TYPES) {
    const s = stats[type];
    const totalMatches = s.matchesWon + s.matchesLost;
    s.winRate = totalMatches > 0 ? Math.round((s.matchesWon / totalMatches) * 100) : 0;
    s.leakRate = s.totalSpawned > 0 ? Math.round((s.totalLeaked / s.totalSpawned) * 100) : 0;
  }

  return stats;
}

/**
 * Analyze tower usage from match history
 */
function analyzeTowerStats(matches) {
  const stats = {};

  for (const type of TOWER_TYPES) {
    stats[type] = {
      timesUsed: 0,
      totalPlaced: 0,
      matchesWon: 0,
      matchesLost: 0
    };
  }

  for (const match of matches) {
    if (!match.defender?.build?.towers) continue;

    const defenderWon = match.winner === 'defender';
    const towers = match.defender.build.towers;

    // Handle both array and object formats
    if (Array.isArray(towers)) {
      for (const tower of towers) {
        const type = tower.type;
        if (stats[type]) {
          stats[type].timesUsed++;
          stats[type].totalPlaced++;
          if (defenderWon) {
            stats[type].matchesWon++;
          } else {
            stats[type].matchesLost++;
          }
        }
      }
    } else {
      for (const [, type] of Object.entries(towers)) {
        if (type && stats[type]) {
          stats[type].timesUsed++;
          stats[type].totalPlaced++;
          if (defenderWon) {
            stats[type].matchesWon++;
          } else {
            stats[type].matchesLost++;
          }
        }
      }
    }
  }

  // Calculate derived stats
  for (const type of TOWER_TYPES) {
    const s = stats[type];
    const totalMatches = s.matchesWon + s.matchesLost;
    s.winRate = totalMatches > 0 ? Math.round((s.matchesWon / totalMatches) * 100) : 0;
  }

  return stats;
}

/**
 * Analyze power-up usage
 */
function analyzePowerUpStats(matches) {
  const attackerStats = {};
  const defenderStats = {};

  for (const type of ATTACKER_POWERUPS) {
    attackerStats[type] = { used: 0, matchesWon: 0, matchesLost: 0 };
  }
  for (const type of DEFENDER_POWERUPS) {
    defenderStats[type] = { used: 0, matchesWon: 0, matchesLost: 0 };
  }

  for (const match of matches) {
    const attackerWon = match.winner === 'attacker';

    // Attacker power-ups
    if (match.attacker?.build?.powerUps) {
      for (const powerUp of match.attacker.build.powerUps) {
        const type = powerUp.type;
        if (attackerStats[type]) {
          attackerStats[type].used++;
          if (attackerWon) {
            attackerStats[type].matchesWon++;
          } else {
            attackerStats[type].matchesLost++;
          }
        }
      }
    }

    // Defender power-ups
    if (match.defender?.build?.powerUps) {
      for (const powerUp of match.defender.build.powerUps) {
        const type = powerUp.type;
        if (defenderStats[type]) {
          defenderStats[type].used++;
          if (!attackerWon) {
            defenderStats[type].matchesWon++;
          } else {
            defenderStats[type].matchesLost++;
          }
        }
      }
    }
  }

  // Calculate win rates
  const calcWinRate = (s) => {
    const total = s.matchesWon + s.matchesLost;
    s.winRate = total > 0 ? Math.round((s.matchesWon / total) * 100) : 0;
  };

  for (const type of ATTACKER_POWERUPS) calcWinRate(attackerStats[type]);
  for (const type of DEFENDER_POWERUPS) calcWinRate(defenderStats[type]);

  return { attacker: attackerStats, defender: defenderStats };
}

/**
 * Generate balancing suggestions based on stats
 */
function generateBalancingSuggestions(matches, enemyStats, towerStats) {
  const suggestions = [];

  // Check overall win rate
  const attackerWins = matches.filter(m => m.winner === 'attacker').length;
  const defenderWins = matches.filter(m => m.winner === 'defender').length;
  const totalMatches = attackerWins + defenderWins;

  if (totalMatches >= 5) {
    const attackerWinRate = Math.round((attackerWins / totalMatches) * 100);

    if (attackerWinRate < 35) {
      suggestions.push({
        priority: 'high',
        type: 'balance',
        message: `Defenders winning too often (${100 - attackerWinRate}%). Consider buffing enemy HP or reducing tower damage.`
      });
    } else if (attackerWinRate > 65) {
      suggestions.push({
        priority: 'high',
        type: 'balance',
        message: `Attackers winning too often (${attackerWinRate}%). Consider buffing towers or reducing enemy speed.`
      });
    }
  }

  // Check for underused enemy types
  for (const [type, stats] of Object.entries(enemyStats)) {
    if (stats.timesUsed < 3 && totalMatches >= 10) {
      suggestions.push({
        priority: 'low',
        type: 'usage',
        message: `${type} enemies are rarely used (${stats.timesUsed} times). Consider reducing cost or buffing stats.`
      });
    }
    if (stats.winRate < 20 && stats.timesUsed >= 5) {
      suggestions.push({
        priority: 'medium',
        type: 'balance',
        message: `${type} enemies have low win rate (${stats.winRate}%). Consider buffing HP or speed.`
      });
    }
    if (stats.winRate > 80 && stats.timesUsed >= 5) {
      suggestions.push({
        priority: 'medium',
        type: 'balance',
        message: `${type} enemies have very high win rate (${stats.winRate}%). Consider nerfing or increasing cost.`
      });
    }
  }

  // Check for underused tower types
  for (const [type, stats] of Object.entries(towerStats)) {
    if (stats.timesUsed < 3 && totalMatches >= 10) {
      suggestions.push({
        priority: 'low',
        type: 'usage',
        message: `${type} towers are rarely used (${stats.timesUsed} times). Consider reducing cost or buffing damage/effects.`
      });
    }
    if (stats.winRate < 20 && stats.timesUsed >= 5) {
      suggestions.push({
        priority: 'medium',
        type: 'balance',
        message: `${type} towers have low win rate (${stats.winRate}%). Consider buffing damage or range.`
      });
    }
    if (stats.winRate > 80 && stats.timesUsed >= 5) {
      suggestions.push({
        priority: 'medium',
        type: 'balance',
        message: `${type} towers have very high win rate (${stats.winRate}%). Consider nerfing or increasing cost.`
      });
    }
  }

  return suggestions;
}

/**
 * GET /stats
 * Get comprehensive game statistics
 */
router.get('/', (req, res) => {
  const matches = loadMatchHistory();

  if (matches.length === 0) {
    return res.json({
      overview: {
        totalMatches: 0,
        attackerWins: 0,
        defenderWins: 0,
        attackerWinRate: 0,
        avgDurationSeconds: 0
      },
      enemies: {},
      towers: {},
      powerUps: { attacker: {}, defender: {} },
      balancing: { suggestions: [] }
    });
  }

  const attackerWins = matches.filter(m => m.winner === 'attacker').length;
  const defenderWins = matches.filter(m => m.winner === 'defender').length;
  const totalDuration = matches.reduce((sum, m) => {
    const duration = m.endTime && m.startTime ? (m.endTime - m.startTime) / 1000 : 0;
    return sum + duration;
  }, 0);

  const enemyStats = analyzeEnemyStats(matches);
  const towerStats = analyzeTowerStats(matches);
  const powerUpStats = analyzePowerUpStats(matches);
  const suggestions = generateBalancingSuggestions(matches, enemyStats, towerStats);

  res.json({
    overview: {
      totalMatches: matches.length,
      attackerWins,
      defenderWins,
      attackerWinRate: Math.round((attackerWins / matches.length) * 100),
      defenderWinRate: Math.round((defenderWins / matches.length) * 100),
      avgDurationSeconds: Math.round(totalDuration / matches.length)
    },
    enemies: enemyStats,
    towers: towerStats,
    powerUps: powerUpStats,
    balancing: {
      suggestions,
      recommendation: suggestions.find(s => s.priority === 'high')?.message || 'Game balance looks healthy!'
    }
  });
});

/**
 * GET /stats/enemies
 * Get only enemy statistics
 */
router.get('/enemies', (req, res) => {
  const matches = loadMatchHistory();
  res.json(analyzeEnemyStats(matches));
});

/**
 * GET /stats/towers
 * Get only tower statistics
 */
router.get('/towers', (req, res) => {
  const matches = loadMatchHistory();
  res.json(analyzeTowerStats(matches));
});

/**
 * GET /stats/powerups
 * Get only power-up statistics
 */
router.get('/powerups', (req, res) => {
  const matches = loadMatchHistory();
  res.json(analyzePowerUpStats(matches));
});

module.exports = router;
