const express = require('express');
const { getMatch } = require('../matchmaker');
const { getMatchState } = require('../simulation/match');

const router = express.Router();

/**
 * GET /match/:id
 * Get current state of a match for spectating
 */
router.get('/:id', (req, res) => {
  const matchId = req.params.id;

  const match = getMatch(matchId);
  if (!match) {
    return res.status(404).json({
      status: 'error',
      error: 'Match not found'
    });
  }

  const state = getMatchState(match);
  res.json(state);
});

module.exports = router;
