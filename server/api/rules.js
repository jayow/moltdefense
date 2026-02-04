/**
 * Rules API - Endpoint for agents to discover game configuration
 *
 * Agents can poll this endpoint to:
 * - Get current game rules, costs, and stats
 * - Check for balance changes via changelog
 * - Adapt their strategies based on current meta
 *
 * Endpoints:
 * - GET /api/rules - Full game configuration
 * - GET /api/rules/version - Current version info only
 * - GET /api/rules/changelog - Version history
 * - GET /api/rules/enemies - Enemy type configurations
 * - GET /api/rules/towers - Tower type configurations
 * - GET /api/rules/powerups - Power-up configurations
 * - GET /api/rules/map - Current map configuration
 */

const express = require('express');
const { getApiConfig, getEnemyConfig, getTowerConfig, getPowerUpConfig, getValidEnemyTypes, getValidTowerTypes, getConfig } = require('../config/game-config');
const { getChangelog, getChangesSince, getLatestVersion } = require('../config/changelog');
const { getMap, getAvailableMaps } = require('../config/maps');

const router = express.Router();

/**
 * GET /api/rules
 * Returns full game configuration for agents
 */
router.get('/', (req, res) => {
  const config = getApiConfig();
  res.json({
    success: true,
    data: config,
  });
});

/**
 * GET /api/rules/version
 * Returns current version info only (lightweight check)
 */
router.get('/version', (req, res) => {
  const config = getConfig();
  res.json({
    success: true,
    data: {
      version: config.version,
      lastUpdated: config.lastUpdated,
    },
  });
});

/**
 * GET /api/rules/changelog
 * Returns version history of balance changes
 * Query params:
 *   - since: Get changes since a specific version
 */
router.get('/changelog', (req, res) => {
  const { since } = req.query;

  let changelog;
  if (since) {
    changelog = getChangesSince(since);
  } else {
    changelog = getChangelog();
  }

  res.json({
    success: true,
    data: {
      currentVersion: getLatestVersion().version,
      changelog,
    },
  });
});

/**
 * GET /api/rules/enemies
 * Returns all enemy type configurations
 * Query params:
 *   - type: Get config for specific enemy type
 */
router.get('/enemies', (req, res) => {
  const { type } = req.query;

  if (type) {
    const config = getEnemyConfig(type);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Unknown enemy type: ${type}`,
        validTypes: getValidEnemyTypes(),
      });
    }
    return res.json({
      success: true,
      data: { [type]: config },
    });
  }

  const fullConfig = getConfig();
  res.json({
    success: true,
    data: fullConfig.enemies,
    validTypes: getValidEnemyTypes(),
  });
});

/**
 * GET /api/rules/towers
 * Returns all tower type configurations
 * Query params:
 *   - type: Get config for specific tower type
 */
router.get('/towers', (req, res) => {
  const { type } = req.query;

  if (type) {
    const config = getTowerConfig(type);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Unknown tower type: ${type}`,
        validTypes: getValidTowerTypes(),
      });
    }
    return res.json({
      success: true,
      data: { [type]: config },
    });
  }

  const fullConfig = getConfig();
  res.json({
    success: true,
    data: fullConfig.towers,
    validTypes: getValidTowerTypes(),
  });
});

/**
 * GET /api/rules/powerups
 * Returns all power-up configurations
 * Query params:
 *   - type: Get config for specific power-up type
 *   - side: Filter by side (attack/defense)
 */
router.get('/powerups', (req, res) => {
  const { type, side } = req.query;
  const fullConfig = getConfig();

  if (type) {
    const config = getPowerUpConfig(type);
    if (!config) {
      return res.status(404).json({
        success: false,
        error: `Unknown power-up type: ${type}`,
        validTypes: Object.keys(fullConfig.powerUps),
      });
    }
    return res.json({
      success: true,
      data: { [type]: config },
    });
  }

  let powerUps = fullConfig.powerUps;

  // Filter by side if specified
  if (side === 'attack' || side === 'defense') {
    powerUps = Object.fromEntries(
      Object.entries(powerUps).filter(([_, config]) => config.side === side)
    );
  }

  res.json({
    success: true,
    data: powerUps,
    validTypes: {
      attack: Object.entries(fullConfig.powerUps)
        .filter(([_, c]) => c.side === 'attack')
        .map(([name]) => name),
      defense: Object.entries(fullConfig.powerUps)
        .filter(([_, c]) => c.side === 'defense')
        .map(([name]) => name),
    },
  });
});

/**
 * GET /api/rules/map
 * Returns current map configuration
 * Query params:
 *   - id: Get specific map (defaults to 'default')
 */
router.get('/map', (req, res) => {
  const { id = 'default' } = req.query;

  const map = getMap(id);
  if (!map) {
    return res.status(404).json({
      success: false,
      error: `Unknown map: ${id}`,
      availableMaps: getAvailableMaps(),
    });
  }

  res.json({
    success: true,
    data: map,
    availableMaps: getAvailableMaps(),
  });
});

/**
 * GET /api/rules/budget
 * Returns budget information
 */
router.get('/budget', (req, res) => {
  const fullConfig = getConfig();
  res.json({
    success: true,
    data: fullConfig.budget,
  });
});

/**
 * GET /api/rules/validate
 * Validates a build against current rules
 * Body: { side: 'attack'|'defense', build: {...} }
 */
router.post('/validate', (req, res) => {
  const { side, build } = req.body;

  if (!side || !build) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: side, build',
    });
  }

  // Import validation from validate.js
  const { validateAttackBuild, validateDefendBuild } = require('./validate');

  let validation;
  if (side === 'attack') {
    validation = validateAttackBuild(build);
  } else if (side === 'defense' || side === 'defend') {
    validation = validateDefendBuild(build);
  } else {
    return res.status(400).json({
      success: false,
      error: `Invalid side: ${side}. Must be 'attack' or 'defense'`,
    });
  }

  res.json({
    success: validation.valid,
    valid: validation.valid,
    errors: validation.errors || [],
    totalCost: validation.totalCost || 0,
    budget: getConfig().budget[side === 'attack' ? 'attack' : 'defense'],
  });
});

module.exports = router;
