#!/usr/bin/env node
/**
 * Moltdefense Defensive Agent
 *
 * Playstyle:
 * - Attack: Tank + healer combos, regenerators, absorb damage
 * - Defense: Maximum slow coverage, spread across path
 *
 * Usage:
 *   node defensive-agent.js --side attack|defend
 */

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  side: 'defend',
  name: `defensive_${Math.random().toString(36).slice(2, 8)}`,
  server: 'http://localhost:3000',
  quiet: false
};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--side':
    case '-s':
      options.side = args[++i];
      break;
    case '--name':
    case '-n':
      options.name = args[++i];
      break;
    case '--server':
      options.server = args[++i];
      break;
    case '--quiet':
    case '-q':
      options.quiet = true;
      break;
    case '--help':
    case '-h':
      console.log(`
Moltdefense Defensive Agent

Playstyle:
  Attack: Tank + healer combos, regenerators, absorb damage
  Defense: Maximum slow coverage, spread across path

Usage: node defensive-agent.js [options]

Options:
  --side, -s <side>    Side to play (attack or defend)
  --name, -n <name>    Agent name (default: random)
  --server <url>       Server URL (default: http://localhost:3000)
  --quiet, -q          Minimal output
  --help, -h           Show this help
      `);
      process.exit(0);
  }
}

function log(...args) {
  if (!options.quiet) {
    console.log(...args);
  }
}

/**
 * Generate defensive attack build
 * - Tanks to absorb damage
 * - Healers to sustain
 * - Regenerators for self-heal
 * Budget: tank=100, healer=80, regenerator=85, healPulse=35
 */
function generateDefensiveAttack() {
  return {
    waves: [
      { tank: 1 },                       // Wave 1: 100pts
      { tank: 1 },                       // Wave 2: 100pts
      { healer: 1 },                     // Wave 3: 80pts
      { regenerator: 1 },                // Wave 4: 85pts
      { tank: 1 }                        // Wave 5: 100pts
    ],
    waveTimings: [
      { rush: false },
      { rush: false },
      { rush: false },
      { rush: false },
      { rush: false }
    ],
    powerUps: [
      { type: 'healPulse', wave: 5 }     // Heal for final push
    ]
  };
  // Total: 465pts + 35pts = 500pts
}

/**
 * Generate defensive defense build
 * - Slow towers spread across the path
 * - Maximize time enemies spend in range
 * - Support tower to boost damage
 * Budget: slow=100, support=80, basic=100
 */
function generateDefensiveDefense() {
  return {
    towers: [
      { x: 100, type: 'slow', lane: 'top' },     // 100pts
      { x: 300, type: 'slow', lane: 'bottom' },  // 100pts
      { x: 500, type: 'support', lane: 'top' },  // 80pts
      { x: 600, type: 'basic', lane: 'bottom' }, // 100pts
      { x: 800, type: 'slow', lane: 'top' }      // 100pts
    ],
    powerUps: []
  };
  // Total: 480pts (under budget, safe)
}

// Main agent logic
async function main() {
  log(`\n=== DEFENSIVE AGENT ===`);
  log(`Agent: ${options.name}`);
  log(`Side: ${options.side.toUpperCase()}`);
  log(`Server: ${options.server}`);
  log('');

  // Generate build based on side
  const build = options.side === 'attack'
    ? generateDefensiveAttack()
    : generateDefensiveDefense();

  log('Generated build:');
  if (options.side === 'attack') {
    build.waves.forEach((wave, i) => {
      const units = Object.entries(wave).map(([t, c]) => `${c}x ${t}`).join(', ');
      log(`  Wave ${i + 1}: ${units}`);
    });
    if (build.powerUps.length) {
      log(`  Power-ups: ${build.powerUps.map(p => `${p.type} (wave ${p.wave})`).join(', ')}`);
    }
  } else {
    build.towers.forEach((t, i) => {
      log(`  Tower ${i + 1}: ${t.type} at x=${t.x} (${t.lane})`);
    });
    if (build.powerUps.length) {
      log(`  Power-ups: ${build.powerUps.map(p => `${p.type} (wave ${p.wave})`).join(', ')}`);
    }
  }
  log('');

  // Submit to server
  log('Submitting build...');

  try {
    const response = await fetch(`${options.server}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: options.name,
        side: options.side === 'attack' ? 'attack' : 'defend',
        build
      })
    });

    const data = await response.json();

    if (data.status === 'error') {
      console.error('Error:', data.error);
      process.exit(1);
    }

    if (data.status === 'queued') {
      log(`Queued at position ${data.queue_position}`);
      log('Waiting for opponent...');
      console.log(JSON.stringify({ status: 'queued', agent: options.name }));
      return;
    }

    if (data.status === 'matched') {
      log(`Matched! Match ID: ${data.match_id}`);
      log(`Opponent: ${data.opponent}`);
      await pollForResults(data.match_id);
    }
  } catch (error) {
    console.error('Failed to connect to server:', error.message);
    process.exit(1);
  }
}

async function pollForResults(matchId) {
  log('Waiting for match to complete...');
  const timeout = 120000;
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${options.server}/results/${matchId}`);
      const data = await response.json();

      if (data.status === 'complete') {
        printResults(data);
        return;
      }

      await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error('Timeout waiting for match results');
  process.exit(1);
}

function printResults(results) {
  const won = (options.side === 'attack' && results.winner === 'attacker') ||
              (options.side === 'defend' && results.winner === 'defender');

  log('');
  log('=== MATCH RESULTS ===');
  log(`Winner: ${results.winner.toUpperCase()}`);
  log(`Duration: ${results.durationSeconds}s`);
  log('');

  if (won) {
    log('*** DEFENSIVE AGENT WINS! ***');
  } else {
    log('Defensive strategy defeated.');
  }

  console.log(JSON.stringify({
    status: 'complete',
    agent: options.name,
    side: options.side,
    strategy: 'defensive',
    won,
    results
  }));
}

main().catch(error => {
  console.error('Agent error:', error);
  process.exit(1);
});
