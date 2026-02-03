const express = require('express');
const path = require('path');
const { addToQueue } = require('../matchmaker');
const { loadMatchHistory, getLeaderboard } = require('../persistence');

// Import strategies from agents folder
const strategies = require(path.join(__dirname, '../../agents/strategies.js'));

// Import adaptive learning system
const { generateAdaptiveBuild, getLearningStats } = require(path.join(__dirname, '../../agents/learning/adaptive-agent'));
const { getMetaAnalysis } = require(path.join(__dirname, '../../agents/learning/effectiveness-tracker'));

const router = express.Router();

// Named agents with persistent identities for ELO tracking
const NAMED_AGENTS = {
  // Attackers
  BlitzRunner: {
    side: 'attack',
    description: 'Fast rush - runners with speedBoost',
    build: {
      waves: [
        { runner: 2 },
        { runner: 2 },
        { runner: 1, swarm: 1 },
        { runner: 2 },
        { runner: 1 }
      ],
      waveTimings: [
        { rush: false },
        { rush: true },
        { rush: true },
        { rush: true },
        { rush: true }
      ],
      powerUps: [
        { type: 'speedBoost', wave: 5 }
      ]
    }
  },

  IronWall: {
    side: 'attack',
    description: 'Tank sustain - tanks with healPulse',
    build: {
      waves: [
        { tank: 1 },
        { tank: 1 },
        { healer: 1 },
        { regenerator: 1 },
        { tank: 1 }
      ],
      waveTimings: [
        { rush: false },
        { rush: false },
        { rush: false },
        { rush: false },
        { rush: false }
      ],
      powerUps: [
        { type: 'healPulse', wave: 5 }
      ]
    }
  },

  Spectre: {
    side: 'attack',
    description: 'Stealth regen - invisibility and shields',
    build: {
      waves: [
        { shieldBearer: 1 },
        { runner: 2 },
        { healer: 1 },
        { regenerator: 1 },
        { runner: 1 }
      ],
      waveTimings: [
        { rush: false },
        { rush: true },
        { rush: false },
        { rush: false },
        { rush: true }
      ],
      powerUps: [
        { type: 'shield', wave: 4 },
        { type: 'invisibility', wave: 5 }
      ]
    }
  },

  // Defenders
  Sentinel: {
    side: 'defend',
    description: 'Balanced defense - sniper, chain, slow',
    build: {
      towers: [
        { x: 150, type: 'sniper', lane: 'top' },
        { x: 400, type: 'chain', lane: 'bottom' },
        { x: 600, type: 'slow', lane: 'top' },
        { x: 800, type: 'basic', lane: 'bottom' }
      ],
      powerUps: []
    }
  },

  Fortress: {
    side: 'defend',
    description: 'Slow wall - maximize enemy time in range',
    build: {
      towers: [
        { x: 100, type: 'slow', lane: 'top' },
        { x: 300, type: 'slow', lane: 'bottom' },
        { x: 500, type: 'support', lane: 'top' },
        { x: 600, type: 'basic', lane: 'bottom' },
        { x: 800, type: 'slow', lane: 'top' }
      ],
      powerUps: []
    }
  },

  Striker: {
    side: 'defend',
    description: 'Burst damage - front-loaded burst towers',
    build: {
      towers: [
        { x: 100, type: 'burst', lane: 'top' },
        { x: 250, type: 'burst', lane: 'bottom' },
        { x: 450, type: 'basic', lane: 'top' },
        { x: 650, type: 'basic', lane: 'bottom' }
      ],
      powerUps: []
    }
  },

  Guardian: {
    side: 'defend',
    description: 'Support focused - buffed damage output',
    build: {
      towers: [
        { x: 200, type: 'support', lane: 'top' },
        { x: 280, type: 'burst', lane: 'bottom' },
        { x: 500, type: 'chain', lane: 'top' },
        { x: 700, type: 'slow', lane: 'bottom' }
      ],
      powerUps: [
        { type: 'damageBoost', wave: 4 }
      ]
    }
  }
};

// Get all attackers and defenders
const ATTACKERS = Object.entries(NAMED_AGENTS).filter(([, v]) => v.side === 'attack').map(([k]) => k);
const DEFENDERS = Object.entries(NAMED_AGENTS).filter(([, v]) => v.side === 'defend').map(([k]) => k);

/**
 * Pick a random agent from a list
 */
function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Analyze recent match history to pick agents adaptively
 * Returns the agent with the lowest recent win rate or fewest matches
 */
function pickAdaptive(agentList, side) {
  const history = loadMatchHistory();
  const recentHistory = history.slice(-50); // Look at last 50 matches

  // Count wins and total matches for each agent
  const stats = {};
  for (const agent of agentList) {
    stats[agent] = { wins: 0, total: 0, lastPlayed: 0 };
  }

  for (const match of recentHistory) {
    const agentId = side === 'attack' ? match.attacker?.agentId : match.defender?.agentId;
    if (stats[agentId]) {
      stats[agentId].total++;
      stats[agentId].lastPlayed = match.endTime || match.startTime || 0;
      if ((side === 'attack' && match.winner === 'attacker') ||
          (side === 'defend' && match.winner === 'defender')) {
        stats[agentId].wins++;
      }
    }
  }

  // Score each agent - lower score = more likely to be picked
  // Factors: low win rate, few recent matches, hasn't played recently
  const scored = agentList.map(agent => {
    const s = stats[agent];
    const winRate = s.total > 0 ? s.wins / s.total : 0.5;
    const matchCount = s.total;
    const recency = Date.now() - s.lastPlayed;

    // Score: prioritize agents with low win rate, few matches, or haven't played recently
    const score = (1 - winRate) * 100 + // Lower win rate = higher score
                  Math.max(0, 10 - matchCount) * 5 + // Fewer matches = higher score
                  Math.min(recency / 60000, 30); // More time since last = higher score (up to 30 min)

    return { agent, score, winRate: Math.round(winRate * 100), matches: matchCount };
  });

  // Sort by score descending (higher score = needs more matches)
  scored.sort((a, b) => b.score - a.score);

  // Pick from top 2 with some randomness to avoid always same matchup
  const top = scored.slice(0, Math.min(2, scored.length));
  return pickRandom(top.map(s => s.agent));
}

/**
 * POST /demo
 * Start a demo match using named agents
 *
 * Body options:
 *   attacker: string - specific attacker name (optional)
 *   defender: string - specific defender name (optional)
 *   adaptive: boolean - if true, use adaptive learning to generate evolved builds
 *   learning: boolean - alias for adaptive (uses full learning system)
 *
 * Random Demo: picks agents randomly, uses their static builds
 * Adaptive Demo: picks agents adaptively, uses learned/evolved builds
 */
router.post('/', async (req, res) => {
  const useAdaptive = req.body.adaptive === true || req.body.learning === true;

  // Pick agents based on mode
  let attackerName, defenderName;
  let attackBuild, defendBuild;
  let buildSource = 'static'; // Track where builds came from

  if (useAdaptive && !req.body.attacker && !req.body.defender) {
    // Adaptive mode: pick underperforming agents AND use learning system for builds
    attackerName = pickAdaptive(ATTACKERS, 'attack');
    defenderName = pickAdaptive(DEFENDERS, 'defend');

    // Generate evolved builds using the learning system
    try {
      attackBuild = generateAdaptiveBuild(attackerName, 'attack', defenderName);
      defendBuild = generateAdaptiveBuild(defenderName, 'defend', attackerName);
      buildSource = 'adaptive';
      console.log(`[Demo] Using adaptive builds for ${attackerName} vs ${defenderName}`);
    } catch (err) {
      console.error('[Demo] Adaptive build generation failed, using static:', err.message);
      // Fall back to static builds
      attackBuild = NAMED_AGENTS[attackerName].build;
      defendBuild = NAMED_AGENTS[defenderName].build;
    }
  } else {
    // Random mode or specific agents requested - use static builds
    attackerName = req.body.attacker || pickRandom(ATTACKERS);
    defenderName = req.body.defender || pickRandom(DEFENDERS);
    attackBuild = NAMED_AGENTS[attackerName]?.build;
    defendBuild = NAMED_AGENTS[defenderName]?.build;
  }

  // Validate agents exist
  const attackerConfig = NAMED_AGENTS[attackerName];
  const defenderConfig = NAMED_AGENTS[defenderName];

  if (!attackerConfig || attackerConfig.side !== 'attack') {
    return res.status(400).json({ error: `Invalid attacker: ${attackerName}` });
  }
  if (!defenderConfig || defenderConfig.side !== 'defend') {
    return res.status(400).json({ error: `Invalid defender: ${defenderName}` });
  }

  // Use static builds as fallback if adaptive failed
  if (!attackBuild) attackBuild = attackerConfig.build;
  if (!defendBuild) defendBuild = defenderConfig.build;

  const timestamp = Date.now();

  const attackerAgent = {
    agentId: attackerName,  // Use agent name for persistent ELO
    side: 'attack',
    build: attackBuild,
    submittedAt: timestamp
  };

  const defenderAgent = {
    agentId: defenderName,  // Use agent name for persistent ELO
    side: 'defend',
    build: defendBuild,
    submittedAt: timestamp
  };

  addToQueue(attackerAgent);
  const result = addToQueue(defenderAgent);

  if (result.matched) {
    res.json({
      status: 'matched',
      match_id: result.matchId,
      buildSource, // 'static' or 'adaptive'
      attacker: {
        name: attackerName,
        description: attackerConfig.description
      },
      defender: {
        name: defenderName,
        description: defenderConfig.description
      },
      spectate_url: `/match/${result.matchId}`,
      results_url: `/results/${result.matchId}`
    });
  } else {
    res.status(500).json({ status: 'error', error: 'Failed to create match' });
  }
});

/**
 * GET /demo/agents
 * Get list of available named agents
 */
router.get('/agents', (req, res) => {
  const agents = {};
  for (const [name, config] of Object.entries(NAMED_AGENTS)) {
    agents[name] = {
      side: config.side,
      description: config.description
    };
  }
  res.json({
    attackers: ATTACKERS,
    defenders: DEFENDERS,
    agents
  });
});

/**
 * GET /demo/strategies
 * Get available strategies (legacy)
 */
router.get('/strategies', (req, res) => {
  res.json({
    attack: strategies.ATTACK_STRATEGIES,
    defend: strategies.DEFEND_STRATEGIES
  });
});

/**
 * GET /demo/learning
 * Get learning system statistics and meta analysis
 */
router.get('/learning', (req, res) => {
  try {
    const meta = getMetaAnalysis();

    res.json({
      status: 'ok',
      meta: {
        totalMatches: meta.totalMatches,
        attackerWinRate: meta.attackerWinRate,
        defenderWinRate: meta.defenderWinRate
      },
      bestEnemyTypes: meta.bestEnemyTypes || [],
      bestTowerTypes: meta.bestTowerTypes || [],
      topAttackCompositions: meta.attackCompositions?.slice(0, 5) || [],
      topDefenseCompositions: meta.defenseCompositions?.slice(0, 5) || []
    });
  } catch (err) {
    console.error('[Demo] Learning stats error:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

/**
 * GET /demo/learning/:agentId
 * Get learning stats for a specific agent
 */
router.get('/learning/:agentId', (req, res) => {
  try {
    const stats = getLearningStats(req.params.agentId);
    res.json({
      status: 'ok',
      ...stats
    });
  } catch (err) {
    console.error('[Demo] Agent learning stats error:', err.message);
    res.status(500).json({ status: 'error', error: err.message });
  }
});

/**
 * POST /demo/batch
 * Run multiple matches with named agents
 *
 * Body:
 *   count: number (1-20, default 5)
 *   mode: 'named' | 'random' | 'mixed' (default 'named')
 */
router.post('/batch', async (req, res) => {
  const count = Math.min(Math.max(parseInt(req.body.count) || 5, 1), 20);
  const mode = req.body.mode || 'named';

  const matches = [];

  for (let i = 0; i < count; i++) {
    let attackerName, defenderName, attackBuild, defendBuild;

    if (mode === 'named' || mode === 'mixed' && i % 2 === 0) {
      // Use named agents
      attackerName = pickRandom(ATTACKERS);
      defenderName = pickRandom(DEFENDERS);
      attackBuild = NAMED_AGENTS[attackerName].build;
      defendBuild = NAMED_AGENTS[defenderName].build;
    } else {
      // Use random strategies with unique names
      const attackStrategy = strategies.getRandomStrategy('attack');
      const defendStrategy = strategies.getRandomStrategy('defend');
      attackerName = `batch_${attackStrategy}_${Date.now() + i}`;
      defenderName = `batch_${defendStrategy}_${Date.now() + i}`;
      attackBuild = strategies.generateAttackBuild(attackStrategy);
      defendBuild = strategies.generateDefenseBuild(defendStrategy);
    }

    const attackerAgent = {
      agentId: attackerName,
      side: 'attack',
      build: attackBuild,
      submittedAt: Date.now() + i
    };

    const defenderAgent = {
      agentId: defenderName,
      side: 'defend',
      build: defendBuild,
      submittedAt: Date.now() + i
    };

    addToQueue(attackerAgent);
    const result = addToQueue(defenderAgent);

    if (result.matched) {
      matches.push({
        index: i + 1,
        match_id: result.matchId,
        attacker: attackerName,
        defender: defenderName
      });
    }
  }

  res.json({
    status: 'ok',
    matchesStarted: matches.length,
    mode,
    matches
  });
});

module.exports = router;
