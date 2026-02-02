const express = require('express');
const path = require('path');
const { addToQueue } = require('../matchmaker');

// Import strategies from agents folder
const strategies = require(path.join(__dirname, '../../agents/strategies.js'));

const router = express.Router();

/**
 * POST /demo
 * Start a demo match with random strategies
 */
router.post('/', (req, res) => {
  // Get strategies from request body or use random
  const attackStrategy = req.body.attackStrategy || strategies.getRandomStrategy('attack');
  const defendStrategy = req.body.defendStrategy || strategies.getRandomStrategy('defend');

  // Generate builds using agent strategies
  const attackBuild = strategies.generateAttackBuild(attackStrategy);
  const defendBuild = strategies.generateDefenseBuild(defendStrategy);

  // Create unique agent IDs for this demo
  const timestamp = Date.now();
  const attackerName = `demo_attacker_${timestamp}`;
  const defenderName = `demo_defender_${timestamp}`;

  // Submit attacker first
  const attackerAgent = {
    agentId: attackerName,
    side: 'attack',
    build: attackBuild,
    cost: strategies.calculateAttackCost(attackBuild),
    submittedAt: timestamp
  };

  const attackResult = addToQueue(attackerAgent);

  // Submit defender
  const defenderAgent = {
    agentId: defenderName,
    side: 'defend',
    build: defendBuild,
    cost: strategies.calculateDefenseCost(defendBuild),
    submittedAt: timestamp
  };

  const defendResult = addToQueue(defenderAgent);

  // The defender submission should trigger the match
  if (defendResult.matched) {
    res.json({
      status: 'matched',
      match_id: defendResult.matchId,
      attacker: {
        name: attackerName,
        strategy: attackStrategy,
        build: attackBuild,
        cost: attackerAgent.cost
      },
      defender: {
        name: defenderName,
        strategy: defendStrategy,
        build: defendBuild,
        cost: defenderAgent.cost
      },
      spectate_url: `/match/${defendResult.matchId}`,
      results_url: `/results/${defendResult.matchId}`
    });
  } else {
    // This shouldn't happen since we submit both
    res.status(500).json({
      status: 'error',
      error: 'Failed to create demo match',
      attackResult,
      defendResult
    });
  }
});

/**
 * GET /demo/strategies
 * Get available strategies
 */
router.get('/strategies', (req, res) => {
  res.json({
    attack: strategies.ATTACK_STRATEGIES,
    defend: strategies.DEFEND_STRATEGIES
  });
});

module.exports = router;
