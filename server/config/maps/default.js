/**
 * Default Map Configuration - Classic Lane
 *
 * This is the default map with two parallel lanes.
 * Future maps can define different layouts, paths, and tower zones.
 */

module.exports = {
  id: 'default',
  name: 'Classic Lane',

  // Dimensions
  pathLength: 1000,
  canvasWidth: 800,
  canvasHeight: 200,

  // Lanes - enemies travel along these
  lanes: [
    { id: 'top', y: 50 },
    { id: 'bottom', y: 150 },
  ],

  // Tower zones - predefined positions for legacy slot-based placement
  towerZones: [
    { id: 'A', x: 100, allowedLanes: ['top', 'bottom'] },
    { id: 'B', x: 300, allowedLanes: ['top', 'bottom'] },
    { id: 'C', x: 500, allowedLanes: ['top', 'bottom'] },
    { id: 'D', x: 700, allowedLanes: ['top', 'bottom'] },
    { id: 'E', x: 900, allowedLanes: ['top', 'bottom'] },
  ],

  // Path segments - defines the path enemies walk
  pathSegments: [
    { startX: 0, endX: 1000, laneId: 'top' },
    { startX: 0, endX: 1000, laneId: 'bottom' },
  ],

  // Spawn and exit points
  spawnPoint: { x: 0 },
  exitPoint: { x: 1000 },

  // Free-flow placement rules
  freePlacement: {
    enabled: true,
    minX: 50,
    maxX: 950,
    minSpacing: 50,
  },
};
