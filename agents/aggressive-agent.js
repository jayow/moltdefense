#!/usr/bin/env node
/**
 * Moltdefense Aggressive Agent
 *
 * Playstyle:
 * - Attack: Rush waves early, speedBoost power-ups, fast units
 * - Defense: Front-loaded burst towers, chain damage
 *
 * Usage:
 *   node aggressive-agent.js --side attack|defend
 */

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  side: 'attack',
  name: `aggressive_${Math.random().toString(36).slice(2, 8)}`,
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
Moltdefense Aggressive Agent

Playstyle:
  Attack: Rush waves, speedBoost power-ups, fast units
  Defense: Front-loaded burst towers, chain damage

Usage: node aggressive-agent.js [options]

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
 * Generate aggressive attack build
 * - Heavy on runners for speed pressure
 * - Rush all waves for timing pressure
 * - SpeedBoost power-up on key wave
 * Budget: runner=50, swarm=75, speedBoost=25
 */
function generateAggressiveAttack() {
  return {
    waves: [
      { runner: 2 },                    // Wave 1: 100pts
      { runner: 2 },                    // Wave 2: 100pts
      { runner: 1, swarm: 1 },          // Wave 3: 125pts
      { runner: 2 },                    // Wave 4: 100pts
      { runner: 1 }                     // Wave 5: 50pts
    ],
    waveTimings: [
      { rush: false },                  // Wave 1: normal start
      { rush: true },                   // Wave 2: immediate
      { rush: true },                   // Wave 3: immediate
      { rush: true },                   // Wave 4: immediate
      { rush: true }                    // Wave 5: immediate
    ],
    powerUps: [
      { type: 'speedBoost', wave: 5 }   // Final push boost
    ]
  };
  // Total: 475pts + 25pts powerup = 500pts
}

/**
 * Generate aggressive defense build
 * - Front-loaded burst towers to stop early
 * - Basic towers for sustained damage
 * Budget: burst=150, basic=100
 */
function generateAggressiveDefense() {
  return {
    towers: [
      { x: 100, type: 'burst', lane: 'top' },    // 150pts - early burst
      { x: 250, type: 'burst', lane: 'bottom' }, // 150pts - more burst
      { x: 450, type: 'basic', lane: 'top' },    // 100pts - sustained
      { x: 650, type: 'basic', lane: 'bottom' }  // 100pts - cleanup
    ],
    powerUps: []
  };
  // Total: 500pts exactly
}

// Main agent logic
async function main() {
  log(`\n=== AGGRESSIVE AGENT ===`);
  log(`Agent: ${options.name}`);
  log(`Side: ${options.side.toUpperCase()}`);
  log(`Server: ${options.server}`);
  log('');

  // Generate build based on side
  const build = options.side === 'attack'
    ? generateAggressiveAttack()
    : generateAggressiveDefense();

  log('Generated build:');
  if (options.side === 'attack') {
    build.waves.forEach((wave, i) => {
      const units = Object.entries(wave).map(([t, c]) => `${c}x ${t}`).join(', ');
      const timing = build.waveTimings[i]?.rush ? ' [RUSH]' : '';
      log(`  Wave ${i + 1}: ${units}${timing}`);
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
    log('*** AGGRESSIVE AGENT WINS! ***');
  } else {
    log('Aggressive strategy defeated.');
  }

  console.log(JSON.stringify({
    status: 'complete',
    agent: options.name,
    side: options.side,
    strategy: 'aggressive',
    won,
    results
  }));
}

main().catch(error => {
  console.error('Agent error:', error);
  process.exit(1);
});
