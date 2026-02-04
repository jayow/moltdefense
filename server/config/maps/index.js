/**
 * Map Loader - Load and manage map configurations
 *
 * Currently only supports the default map.
 * Future maps can be added by creating new files in this directory.
 */

const defaultMap = require('./default');

// Registry of available maps
const maps = new Map();
maps.set('default', defaultMap);

/**
 * Get a map by ID
 * @param {string} mapId - Map identifier
 * @returns {object|null} Map configuration or null if not found
 */
function getMap(mapId = 'default') {
  return maps.get(mapId) || null;
}

/**
 * Get all available map IDs
 * @returns {string[]} Array of map IDs
 */
function getAvailableMaps() {
  return Array.from(maps.keys());
}

/**
 * Register a new map
 * @param {string} mapId - Map identifier
 * @param {object} mapConfig - Map configuration
 */
function registerMap(mapId, mapConfig) {
  maps.set(mapId, mapConfig);
}

/**
 * Get tower zone by slot ID for a specific map
 * @param {string} mapId - Map identifier
 * @param {string} slotId - Slot identifier (A, B, C, D, E)
 * @returns {object|null} Tower zone configuration or null
 */
function getTowerZone(mapId, slotId) {
  const map = getMap(mapId);
  if (!map) return null;
  return map.towerZones.find(zone => zone.id === slotId) || null;
}

/**
 * Get lane Y position for a specific map
 * @param {string} mapId - Map identifier
 * @param {string} laneId - Lane identifier
 * @returns {number|null} Lane Y position or null
 */
function getLaneY(mapId, laneId) {
  const map = getMap(mapId);
  if (!map) return null;
  const lane = map.lanes.find(l => l.id === laneId);
  return lane ? lane.y : null;
}

module.exports = {
  getMap,
  getAvailableMaps,
  registerMap,
  getTowerZone,
  getLaneY,
};
