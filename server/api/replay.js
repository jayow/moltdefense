/**
 * Replay API - Serves match replay data for playback
 */

const express = require('express');
const { loadMatchHistory } = require('../persistence');

const router = express.Router();

/**
 * GET /replay/:matchId
 * Returns full match data including events for replay playback
 */
router.get('/:matchId', (req, res) => {
  const { matchId } = req.params;

  const history = loadMatchHistory();
  const match = history.find(m => m.matchId === matchId);

  if (!match) {
    return res.status(404).json({
      error: 'Match not found',
      matchId
    });
  }

  // Calculate duration from timestamps
  const duration = match.endTime && match.startTime
    ? Math.round((match.endTime - match.startTime) / 1000)
    : null;

  res.json({
    matchId: match.matchId,
    winner: match.winner,
    wavesCompleted: match.wavesCompleted,
    duration,
    startTime: match.startTime,
    endTime: match.endTime,
    attacker: {
      agentId: match.attacker.agentId,
      build: match.attacker.build,
      totalEnemies: match.attacker.totalEnemies,
      leaked: match.attacker.leaked,
      rushBonus: match.attacker.rushBonus || 0
    },
    defender: {
      agentId: match.defender.agentId,
      build: match.defender.build,
      kills: match.defender.kills,
      damageDealt: match.defender.damageDealt
    },
    waveBreakdown: match.waveBreakdown || [],
    events: match.events || []
  });
});

/**
 * GET /replay/:matchId/events
 * Returns just the events array for lighter replay requests
 */
router.get('/:matchId/events', (req, res) => {
  const { matchId } = req.params;
  const { fromTick, toTick } = req.query;

  const history = loadMatchHistory();
  const match = history.find(m => m.matchId === matchId);

  if (!match) {
    return res.status(404).json({
      error: 'Match not found',
      matchId
    });
  }

  let events = match.events || [];

  // Filter by tick range if specified
  if (fromTick !== undefined || toTick !== undefined) {
    const from = parseInt(fromTick) || 0;
    const to = parseInt(toTick) || Infinity;
    events = events.filter(e => e.tick >= from && e.tick <= to);
  }

  res.json({
    matchId,
    eventCount: events.length,
    events
  });
});

/**
 * GET /replay
 * Returns list of matches available for replay (with events)
 */
router.get('/', (req, res) => {
  const { limit = 20 } = req.query;

  const history = loadMatchHistory();

  // Filter to matches that have events stored
  const replayable = history
    .filter(m => m.events && m.events.length > 0)
    .slice(-parseInt(limit))
    .reverse()
    .map(m => ({
      matchId: m.matchId,
      attacker: m.attacker.agentId,
      defender: m.defender.agentId,
      winner: m.winner,
      wavesCompleted: m.wavesCompleted,
      eventCount: m.events.length,
      timestamp: m.endTime || m.startTime
    }));

  res.json({
    available: replayable.length,
    matches: replayable
  });
});

module.exports = router;
