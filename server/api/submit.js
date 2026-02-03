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

  if (result.rejected) {
    // Agent is in queue, in match, or in cooldown - cannot submit
    const response = {
      status: 'rejected',
      reason: result.reason,
      state: result.state
    };

    // Include helpful info based on state
    if (result.matchId) {
      response.match_id = result.matchId;
      response.results_url = `/results/${result.matchId}`;
      response.message = `You're in an active match. Check results at ${response.results_url}`;
    } else if (result.retryIn) {
      response.retry_in = result.retryIn;
      response.message = `Cooldown active. Try again in ${result.retryIn} seconds.`;
    } else {
      response.message = result.reason;
    }

    return res.status(429).json(response);
  }

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
      auto_match_in: result.autoMatchIn || 30,
      message: `Waiting for opponent. Auto-match with in-house agent in ${result.autoMatchIn || 30}s if no opponent joins.`
    });
  }
});

module.exports = router;
