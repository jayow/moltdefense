/**
 * Effectiveness Tracker Module
 * Tracks and scores unit/tower effectiveness from match data
 */

const path = require('path');
const { loadMatchHistory } = require(path.join(__dirname, '../../server/persistence'));

/**
 * Calculate enemy effectiveness from match history
 * Tracks which enemy types are most successful at leaking
 * @param {Array} history - Match history array (optional)
 * @returns {Object} Enemy effectiveness stats by type
 */
function calculateEnemyEffectiveness(history = null) {
  const matches = history || loadMatchHistory();

  const stats = {};

  matches.forEach(match => {
    const waves = match.attacker?.build?.waves || [];
    const waveBreakdown = match.waveBreakdown || [];
    const attackerWon = match.winner === 'attacker';

    // Track total enemies spawned by type
    waves.forEach((wave, waveIndex) => {
      Object.entries(wave).forEach(([type, count]) => {
        if (!stats[type]) {
          stats[type] = {
            used: 0,
            totalSpawned: 0,
            matchesUsed: 0,
            wins: 0,
            avgLeakRate: 0,
            leakSum: 0
          };
        }

        stats[type].totalSpawned += type === 'swarm' ? count * 5 : count;
        stats[type].used += count;
      });
    });

    // Track win rate when using each type
    const typesUsedThisMatch = new Set();
    waves.forEach(wave => {
      Object.keys(wave).forEach(type => typesUsedThisMatch.add(type));
    });

    typesUsedThisMatch.forEach(type => {
      if (stats[type]) {
        stats[type].matchesUsed++;
        if (attackerWon) stats[type].wins++;
      }
    });
  });

  // Calculate derived metrics
  Object.keys(stats).forEach(type => {
    const s = stats[type];
    s.winRate = s.matchesUsed > 0
      ? Math.round((s.wins / s.matchesUsed) * 100)
      : 0;
    s.avgPerMatch = s.matchesUsed > 0
      ? Math.round(s.totalSpawned / s.matchesUsed)
      : 0;
  });

  return stats;
}

/**
 * Calculate tower effectiveness from match history
 * Tracks which tower types are most successful at defending
 * @param {Array} history - Match history array (optional)
 * @returns {Object} Tower effectiveness stats by type
 */
function calculateTowerEffectiveness(history = null) {
  const matches = history || loadMatchHistory();

  const stats = {};

  matches.forEach(match => {
    const towers = match.defender?.build?.towers || [];
    const defenderWon = match.winner === 'defender';
    const kills = match.defender?.kills || 0;
    const damageDealt = match.defender?.damageDealt || 0;

    // Handle both array (free-flow) and object (legacy) formats
    const towerList = Array.isArray(towers)
      ? towers
      : Object.values(towers);

    const typesUsedThisMatch = new Set();
    const towerCount = towerList.length;

    towerList.forEach(tower => {
      const type = typeof tower === 'string' ? tower : tower.type;

      if (!stats[type]) {
        stats[type] = {
          used: 0,
          matchesUsed: 0,
          wins: 0,
          totalKills: 0,
          totalDamage: 0
        };
      }

      stats[type].used++;
      typesUsedThisMatch.add(type);
    });

    // Distribute kills/damage proportionally (approximation)
    typesUsedThisMatch.forEach(type => {
      const typeCount = towerList.filter(t =>
        (typeof t === 'string' ? t : t.type) === type
      ).length;

      const proportion = towerCount > 0 ? typeCount / towerCount : 0;

      stats[type].matchesUsed++;
      if (defenderWon) stats[type].wins++;
      stats[type].totalKills += Math.round(kills * proportion);
      stats[type].totalDamage += Math.round(damageDealt * proportion);
    });
  });

  // Calculate derived metrics
  Object.keys(stats).forEach(type => {
    const s = stats[type];
    s.winRate = s.matchesUsed > 0
      ? Math.round((s.wins / s.matchesUsed) * 100)
      : 0;
    s.avgKillsPerMatch = s.matchesUsed > 0
      ? Math.round((s.totalKills / s.matchesUsed) * 10) / 10
      : 0;
    s.avgDamagePerMatch = s.matchesUsed > 0
      ? Math.round(s.totalDamage / s.matchesUsed)
      : 0;
  });

  return stats;
}

/**
 * Get best-performing enemy types for attackers
 * @param {Object} stats - Enemy effectiveness stats (optional)
 * @param {number} top - Number of types to return
 * @returns {Array} Top enemy types by win rate
 */
function getBestEnemyTypes(stats = null, top = 3) {
  const effectivenessStats = stats || calculateEnemyEffectiveness();

  return Object.entries(effectivenessStats)
    .filter(([, s]) => s.matchesUsed >= 3) // Minimum sample size
    .map(([type, s]) => ({
      type,
      winRate: s.winRate,
      matchesUsed: s.matchesUsed,
      avgPerMatch: s.avgPerMatch
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, top);
}

/**
 * Get best-performing tower types for defenders
 * @param {Object} stats - Tower effectiveness stats (optional)
 * @param {number} top - Number of types to return
 * @returns {Array} Top tower types by win rate
 */
function getBestTowerTypes(stats = null, top = 3) {
  const effectivenessStats = stats || calculateTowerEffectiveness();

  return Object.entries(effectivenessStats)
    .filter(([, s]) => s.matchesUsed >= 3) // Minimum sample size
    .map(([type, s]) => ({
      type,
      winRate: s.winRate,
      matchesUsed: s.matchesUsed,
      avgKillsPerMatch: s.avgKillsPerMatch
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, top);
}

/**
 * Analyze win rate by build composition
 * Groups similar builds and calculates their effectiveness
 * @param {Array} history - Match history array (optional)
 * @param {string} side - 'attack' or 'defend'
 * @returns {Array} Build compositions with win rates
 */
function getWinRateByComposition(history = null, side) {
  const matches = history || loadMatchHistory();
  const compositions = new Map();

  matches.forEach(match => {
    let composition;

    if (side === 'attack') {
      // Create composition fingerprint based on enemy type mix
      const waves = match.attacker?.build?.waves || [];
      const typeCounts = {};
      waves.forEach(wave => {
        Object.entries(wave).forEach(([type, count]) => {
          typeCounts[type] = (typeCounts[type] || 0) + count;
        });
      });

      // Create sorted fingerprint
      const sortedTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type]) => type);
      composition = sortedTypes.slice(0, 3).join('+') || 'empty';
    } else {
      // Create composition fingerprint based on tower type mix
      const towers = match.defender?.build?.towers || [];
      const towerList = Array.isArray(towers) ? towers : Object.values(towers);
      const typeCounts = {};
      towerList.forEach(tower => {
        const type = typeof tower === 'string' ? tower : tower.type;
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      const sortedTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([type]) => type);
      composition = sortedTypes.slice(0, 3).join('+') || 'empty';
    }

    if (!compositions.has(composition)) {
      compositions.set(composition, { wins: 0, total: 0 });
    }

    const stats = compositions.get(composition);
    stats.total++;

    const won = (side === 'attack' && match.winner === 'attacker') ||
                (side === 'defend' && match.winner === 'defender');
    if (won) stats.wins++;
  });

  return Array.from(compositions.entries())
    .filter(([, s]) => s.total >= 2)
    .map(([composition, s]) => ({
      composition,
      wins: s.wins,
      total: s.total,
      winRate: Math.round((s.wins / s.total) * 100)
    }))
    .sort((a, b) => b.winRate - a.winRate);
}

/**
 * Get overall meta analysis
 * @param {Array} history - Match history array (optional)
 * @returns {Object} Complete meta analysis
 */
function getMetaAnalysis(history = null) {
  const matches = history || loadMatchHistory();

  if (matches.length === 0) {
    return {
      totalMatches: 0,
      attackerWinRate: 50,
      defenderWinRate: 50,
      bestEnemyTypes: [],
      bestTowerTypes: [],
      attackCompositions: [],
      defenseCompositions: []
    };
  }

  const attackerWins = matches.filter(m => m.winner === 'attacker').length;

  const enemyStats = calculateEnemyEffectiveness(matches);
  const towerStats = calculateTowerEffectiveness(matches);

  return {
    totalMatches: matches.length,
    attackerWinRate: Math.round((attackerWins / matches.length) * 100),
    defenderWinRate: Math.round(((matches.length - attackerWins) / matches.length) * 100),
    bestEnemyTypes: getBestEnemyTypes(enemyStats),
    bestTowerTypes: getBestTowerTypes(towerStats),
    attackCompositions: getWinRateByComposition(matches, 'attack').slice(0, 5),
    defenseCompositions: getWinRateByComposition(matches, 'defend').slice(0, 5),
    enemyStats,
    towerStats
  };
}

module.exports = {
  calculateEnemyEffectiveness,
  calculateTowerEffectiveness,
  getBestEnemyTypes,
  getBestTowerTypes,
  getWinRateByComposition,
  getMetaAnalysis
};
