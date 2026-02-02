const express = require('express');
const { validateSubmission } = require('./validate');
const { addToQueue, getQueuePosition } = require('../matchmaker');

const router = express.Router();

/**
 * POST /submit
 * Submit a build and join the matchmaking queue
 */
router.post('/', (req, res) => {
  const body = req.body;

  // Validate the submission
  const validation = validateSubmission(body);
  if (!validation.valid) {
    return res.status(400).json({
      status: 'error',
      error: validation.error
    });
  }

  // Create agent entry
  const agent = {
    agentId: body.agent_id,
    side: body.side,
    build: body.build,
    cost: validation.cost,
    submittedAt: Date.now()
  };

  // Add to matchmaking queue
  const result = addToQueue(agent);

  if (result.matched) {
    // Immediately matched with opponent
    return res.json({
      status: 'matched',
      match_id: result.matchId,
      opponent: result.opponent,
      spectate_url: `/match/${result.matchId}`,
      results_url: `/results/${result.matchId}`
    });
  } else {
    // Added to queue
    return res.json({
      status: 'queued',
      queue_position: result.position,
      estimated_wait: result.position === 1 ? 'Waiting for opponent...' : `${result.position * 10}s`
    });
  }
});

module.exports = router;
