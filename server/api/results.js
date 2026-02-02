const express = require('express');
const { getMatch } = require('../matchmaker');
const { getMatchResults } = require('../simulation/match');

const router = express.Router();

/**
 * GET /results/:id
 * Get final results of a completed match
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

  if (match.status !== 'complete') {
    return res.json({
      status: match.status,
      match_id: matchId,
      message: 'Match is still in progress'
    });
  }

  const results = getMatchResults(match);
  res.json(results);
});

module.exports = router;
