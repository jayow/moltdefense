/**
 * Test script to verify fixes for:
 * 1. Dashboard API returns wins/losses for all agents
 * 2. Tower positions in live state match expected values
 * 3. All 7 agents appear in leaderboard
 * 4. Tower position field is correctly used
 */

const { getLeaderboard, initializeNamedAgents } = require('./server/persistence');
const { initializeTowersV2 } = require('./server/simulation/towers');
const { getTowerState } = require('./server/simulation/towers');

// Named agents from demo.js
const NAMED_AGENTS = {
  BlitzRunner: 'attacker',
  IronWall: 'attacker',
  Spectre: 'attacker',
  Sentinel: 'defender',
  Fortress: 'defender',
  Striker: 'defender',
  Guardian: 'defender'
};

const ALL_AGENTS = Object.keys(NAMED_AGENTS);

console.log('='.repeat(60));
console.log('MOLTDEFENSE FIX VERIFICATION TEST');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

function test(name, condition, details = '') {
  if (condition) {
    console.log(`[PASS] ${name}`);
    passed++;
  } else {
    console.log(`[FAIL] ${name} - ${details}`);
    failed++;
  }
}

// ============================================
// TEST 1: Initialize all named agents
// ============================================
console.log('\n--- Test 1: Initialize named agents ---');

const created = initializeNamedAgents(ALL_AGENTS);
console.log(`Initialized ${created} new agents`);

// ============================================
// TEST 2: All 7 agents appear in leaderboard with wins/losses
// ============================================
console.log('\n--- Test 2: All agents in leaderboard with wins/losses ---');

const leaderboard = getLeaderboard(100);
const leaderboardAgents = new Map(leaderboard.map(e => [e.agentId, e]));

for (const agent of ALL_AGENTS) {
  const entry = leaderboardAgents.get(agent);

  test(
    `Agent ${agent} is in leaderboard`,
    entry !== undefined,
    'Not found in leaderboard'
  );

  if (entry) {
    test(
      `Agent ${agent} has wins defined`,
      entry.wins !== undefined,
      `wins=${entry.wins}`
    );

    test(
      `Agent ${agent} has losses defined`,
      entry.losses !== undefined,
      `losses=${entry.losses}`
    );
  }
}

const namedAgentsInLeaderboard = leaderboard.filter(e => NAMED_AGENTS[e.agentId]);
test(
  `All 7 named agents present`,
  namedAgentsInLeaderboard.length === 7,
  `Found ${namedAgentsInLeaderboard.length} named agents`
);

// ============================================
// TEST 3: Tower positions in live state
// ============================================
console.log('\n--- Test 3: Tower positions in live state ---');

const defenderBuild = {
  towers: [
    { x: 150, type: 'sniper', lane: 'top' },
    { x: 400, type: 'chain', lane: 'bottom' },
    { x: 600, type: 'slow', lane: 'top' },
    { x: 800, type: 'basic', lane: 'bottom' }  // Rightmost tower - previously buggy
  ]
};

const towers = initializeTowersV2(defenderBuild);
const towerStates = towers.map(getTowerState);

for (let i = 0; i < defenderBuild.towers.length; i++) {
  const expected = defenderBuild.towers[i];
  const actual = towerStates[i];

  test(
    `Tower ${i} has 'position' field`,
    actual.position !== undefined,
    `position field is ${actual.position}`
  );

  test(
    `Tower ${i} position matches (expected ${expected.x})`,
    actual.position === expected.x,
    `Expected ${expected.x}, got ${actual.position}`
  );

  test(
    `Tower ${i} lane is set correctly`,
    actual.lane === expected.lane,
    `Expected ${expected.lane}, got ${actual.lane}`
  );
}

// ============================================
// TEST 4: Projectile coordinate calculation
// ============================================
console.log('\n--- Test 4: Projectile coordinate calculation ---');

// Simulate the client-side findTowerForProjectile logic
function simulateFindTower(towerId, towers) {
  for (const tower of towers) {
    if (tower.slot === towerId || tower.id === towerId) {
      let canvasX, canvasY;

      // This is the FIXED logic - check position FIRST
      if (tower.position !== undefined) {
        canvasX = (tower.position / 1000) * 800;
        canvasY = tower.lane === 'bottom' ? 150 : 50;
      } else if (tower.x !== undefined) {
        canvasX = (tower.x / 1000) * 800;
        canvasY = tower.lane === 'bottom' ? 150 : 50;
      } else {
        return null;
      }

      return { x: canvasX, y: canvasY, type: tower.type };
    }
  }
  return null;
}

// Test with live tower states (which have 'position' field)
const expectedPositions = [
  { towerId: 'T0', expectedX: (150/1000)*800, expectedY: 50 },   // 120, top
  { towerId: 'T1', expectedX: (400/1000)*800, expectedY: 150 },  // 320, bottom
  { towerId: 'T2', expectedX: (600/1000)*800, expectedY: 50 },   // 480, top
  { towerId: 'T3', expectedX: (800/1000)*800, expectedY: 150 }   // 640, bottom (rightmost)
];

for (const check of expectedPositions) {
  const result = simulateFindTower(check.towerId, towerStates);

  test(
    `Tower ${check.towerId} X position (expected ${check.expectedX.toFixed(0)})`,
    result && Math.abs(result.x - check.expectedX) < 0.1,
    `Expected ${check.expectedX.toFixed(0)}, got ${result ? result.x.toFixed(0) : 'null'}`
  );

  test(
    `Tower ${check.towerId} Y position (expected ${check.expectedY})`,
    result && result.y === check.expectedY,
    `Expected ${check.expectedY}, got ${result ? result.y : 'null'}`
  );
}

// ============================================
// TEST 5: Renderer position check order
// ============================================
console.log('\n--- Test 5: Renderer position check order ---');

// Simulate the FIXED renderer logic for drawTowers
function simulateRendererPosition(tower, index) {
  let x, y;

  // FIXED: Check position FIRST (for live mode)
  if (tower.position !== undefined) {
    x = (tower.position / 1000) * 800;  // gameToCanvasX
    y = tower.lane === 'bottom' ? 150 : 50;
  } else if (tower.x !== undefined) {
    x = (tower.x / 1000) * 800;
    y = tower.lane === 'bottom' ? 150 : 50;
  } else {
    // Fallback (should not be used for proper data)
    x = (100 + index * 200) / 1000 * 800;
    y = index % 2 === 0 ? 50 : 150;
  }

  return { x, y };
}

for (let i = 0; i < towerStates.length; i++) {
  const state = towerStates[i];
  const result = simulateRendererPosition(state, i);
  const expected = expectedPositions[i];

  test(
    `Renderer T${i} uses position field correctly`,
    Math.abs(result.x - expected.expectedX) < 0.1,
    `Expected X=${expected.expectedX.toFixed(0)}, got ${result.x.toFixed(0)}`
  );
}

// ============================================
// SUMMARY
// ============================================
console.log('\n' + '='.repeat(60));
console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
console.log('='.repeat(60));

if (failed > 0) {
  console.log('\n⚠️  Some tests failed! Review the output above.');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
